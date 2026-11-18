import {
  censusBatchUrl,
  censusBatchCsv,
  readCensusMatches,
  type CensusAddress,
} from "./census-batch";
import type { PipelineSql } from "./source-pipeline-store";
export async function fetchCensusBatch(rows: CensusAddress[]) {
  const boundary = "----RecoveryAtlas" + Date.now().toString(16);
  const body = Buffer.from(
    "--" +
      boundary +
      '\r\nContent-Disposition: form-data; name="addressFile"; filename="addresses.csv"\r\nContent-Type: text/csv\r\n\r\n' +
      censusBatchCsv(rows) +
      "\r\n--" +
      boundary +
      '\r\nContent-Disposition: form-data; name="benchmark"\r\n\r\nPublic_AR_Current\r\n--' +
      boundary +
      '\r\nContent-Disposition: form-data; name="vintage"\r\n\r\nCurrent_Current\r\n--' +
      boundary +
      "--\r\n",
  );
  const response = await fetch(censusBatchUrl, {
    method: "POST",
    headers: { "Content-Type": "multipart/form-data; boundary=" + boundary },
    body,
    signal: AbortSignal.timeout(150000),
  });
  if (!response.ok) throw Error("Census HTTP " + response.status);
  const facts = readCensusMatches(await response.text(), rows);
  if (facts.length < rows.length * 0.95)
    throw Error("Incomplete Census batch response");
  return facts;
}
export const addressKeySql = (column = "data") =>
  `md5(concat_ws('|',lower(trim(regexp_replace(${column}->>'address','\\s+',' ','g'))),lower(trim(regexp_replace(${column}->>'city','\\s+',' ','g'))),lower(${column}->>'state'),COALESCE(${column}->>'zip','')))`;
const eligible = `data->>'coordinateAccuracy' IN('approximate','unavailable') AND data->>'state'<>'US' AND data->>'address'~'^[0-9]' AND data->>'address' !~* 'p[.]?o[.]? box' AND COALESCE(data->'locationEvidence'->>'method','')<>'publisher-approximate' AND (resource_kind<>'meeting' OR data->'locationEvidence'->>'method' IN('city-centroid','zip-centroid') OR data->>'sourceName' LIKE 'SMART%')`;
/** Keyset scan and a persistent address/resource join avoid repeated national table scans. */
export async function seedAddressQueue(
  sql: PipelineSql,
  cursor = "",
  limit = 25000,
) {
  const [result] = await sql.query(
    `WITH chunk AS MATERIALIZED(SELECT id,data,${addressKeySql()} AS address_key FROM resources WHERE published AND id>$1 AND ${eligible} ORDER BY id LIMIT $2),addresses AS(INSERT INTO atlas_geocode_cache(address_key,address,city,state,zip) SELECT DISTINCT ON(address_key) address_key,data->>'address',data->>'city',data->>'state',COALESCE(data->>'zip','') FROM chunk ON CONFLICT DO NOTHING RETURNING address_key) SELECT count(*)::int AS scanned,max(id) AS cursor,(SELECT count(*)::int FROM addresses) AS queued FROM chunk`,
    [cursor, limit],
  );
  if (result.scanned)
    await sql.query(
      `INSERT INTO atlas_resource_address(resource_id,address_key) SELECT id,${addressKeySql()} FROM resources WHERE published AND id>$1 AND id<=$2 AND ${eligible} ON CONFLICT(resource_id)DO UPDATE SET address_key=EXCLUDED.address_key,checked_at=now()`,
      [cursor, result.cursor],
    );
  return {
    scanned: result.scanned,
    queued: result.queued,
    cursor: result.scanned === limit ? result.cursor : "",
  };
}
export async function applyGeocodedAddresses(
  sql: PipelineSql,
  keys?: string[],
  limit?: number,
) {
  const rows = await sql.query(
    `WITH changes AS MATERIALIZED(
      SELECT r.id,r.data AS before_data,
        r.data||jsonb_build_object('lat',c.lat,'lng',c.lng,'coordinateAccuracy','address',
          'locationEvidence',jsonb_build_object('method','census-street-range','sourceUrl','https://geocoding.geo.census.gov/geocoder/','checkedAt',c.checked_at::date::text)) AS after_data,c.lat,c.lng
      FROM atlas_geocode_cache c JOIN atlas_resource_address a ON a.address_key=c.address_key
      CROSS JOIN LATERAL (
        SELECT r.id,r.data FROM resources r
        WHERE r.id=a.resource_id AND r.published AND ${eligible} AND a.address_key=${addressKeySql("r.data")}
        LIMIT 1
      ) r
      WHERE c.status='matched' AND ($1::text[] IS NULL OR c.address_key=ANY($1::text[]))
      LIMIT $2
    ), applied AS(
      UPDATE resources r SET data=c.after_data,location=ST_SetSRID(ST_MakePoint(c.lng,c.lat),4326)::geography,updated_at=now()
      FROM changes c WHERE r.id=c.id AND r.data=c.before_data RETURNING r.id,c.before_data,c.after_data
    ), invalidated AS(
      DELETE FROM atlas_resource_county x USING applied a WHERE x.resource_id=a.id
    ) INSERT INTO audit_events(action,resource_id,before_data,after_data)
      SELECT 'census-address-interpolation',id,before_data,after_data FROM applied RETURNING resource_id`,
    [keys ?? null, limit ?? null],
  );
  return rows.length;
}
export async function runGeocodingBatch(sql: PipelineSql, batchSize = 3000) {
  await sql.query(
    "UPDATE atlas_geocode_cache SET status='retry' WHERE status='processing' AND next_attempt_at<now()",
  );
  const rows = await sql.query(
    `WITH due AS(SELECT address_key FROM atlas_geocode_cache WHERE status IN('pending','retry') AND next_attempt_at<=now() ORDER BY attempts,address_key LIMIT $1 FOR UPDATE SKIP LOCKED) UPDATE atlas_geocode_cache c SET status='processing',attempts=attempts+1,next_attempt_at=now()+interval '20 minutes' FROM due WHERE c.address_key=due.address_key RETURNING c.*`,
    [batchSize],
  );
  if (!rows.length) return { submitted: 0, matched: 0 };
  try {
    const facts = await fetchCensusBatch(rows);
    await sql.query(
      `UPDATE atlas_geocode_cache c SET status=r->>'status',lat=(r->>'lat')::float8,lng=(r->>'lng')::float8,matched_address=r->>'matched_address',match_type=r->>'match_type',county_fips=r->>'county_fips',checked_at=now(),next_attempt_at=now()+interval '90 days' FROM jsonb_array_elements($1::jsonb)r WHERE c.address_key=r->>'address_key'`,
      [JSON.stringify(facts)],
    );
    return {
      submitted: rows.length,
      matched: facts.filter((r) => r.status === "matched").length,
    };
  } catch (e) {
    await sql.query(
      "UPDATE atlas_geocode_cache SET status='retry',next_attempt_at=now()+interval '6 hours' WHERE address_key=ANY($1::text[])",
      [rows.map((r) => r.address_key)],
    );
    throw e;
  }
}
