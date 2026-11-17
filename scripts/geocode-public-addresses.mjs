import { writeFile } from "node:fs/promises";
/** Existing database connection is supplied by the caller; only public directory addresses go to Census. */
export async function geocodePublicAddresses({
  pool,
  helpers,
  progressFile,
  maxBatches = 30,
  batchSize = 5000,
}) {
  let batches = 0,
    submitted = 0,
    matched = 0,
    updated = 0;
  const q = async (t, p) => (await pool.query(t, p)).rows;
  const key = `md5(concat_ws('|',lower(trim(regexp_replace(data->>'address','\\s+',' ','g'))),lower(trim(regexp_replace(data->>'city','\\s+',' ','g'))),lower(resource_state),COALESCE(data->>'zip','')))`;
  const eligible = `data->>'coordinateAccuracy' IN('approximate','unavailable') AND resource_state<>'US' AND data->>'address'~'^[0-9]' AND data->>'address' !~* 'p[.]?o[.]? box' AND COALESCE(data->'locationEvidence'->>'method','')<>'publisher-approximate' AND (resource_kind<>'meeting' OR data->'locationEvidence'->>'method' IN('city-centroid','zip-centroid') OR data->>'sourceName' LIKE 'SMART%')`;
  await q(
    `INSERT INTO atlas_geocode_cache(address_key,address,city,state,zip) SELECT DISTINCT ON(${key}) ${key},data->>'address',data->>'city',resource_state,COALESCE(data->>'zip','') FROM resources WHERE ${eligible} AND (published OR id IN(SELECT resource_id FROM atlas_import_release_member WHERE release_id='national-providers-20261117')) ORDER BY ${key} ON CONFLICT DO NOTHING`,
  );
  while (batches < maxBatches) {
    const rows = await q(
      `WITH due AS(SELECT address_key FROM atlas_geocode_cache WHERE status IN('pending','retry') AND next_attempt_at<=now() ORDER BY attempts,address_key LIMIT $1 FOR UPDATE SKIP LOCKED) UPDATE atlas_geocode_cache c SET status='processing',attempts=attempts+1,next_attempt_at=now()+interval '20 minutes' FROM due WHERE c.address_key=due.address_key RETURNING c.*`,
      [batchSize],
    );
    if (!rows.length) break;
    try {
      const form = new FormData();
      form.set(
        "addressFile",
        new Blob([helpers.censusBatchCsv(rows)], { type: "text/csv" }),
        "addresses.csv",
      );
      form.set("benchmark", "Public_AR_Current");
      form.set("vintage", "Current_Current");
      const response = await fetch(helpers.censusBatchUrl, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(180000),
      });
      if (!response.ok) throw Error("Census HTTP " + response.status);
      const facts = helpers.readCensusMatches(await response.text(), rows);
      if (facts.length < rows.length * 0.95)
        throw Error("Incomplete Census batch response");
      await q(
        `UPDATE atlas_geocode_cache c SET status=r->>'status',lat=(r->>'lat')::float8,lng=(r->>'lng')::float8,matched_address=r->>'matched_address',match_type=r->>'match_type',county_fips=r->>'county_fips',checked_at=now(),next_attempt_at=now()+interval '90 days' FROM jsonb_array_elements($1::jsonb)r WHERE c.address_key=r->>'address_key'`,
        [JSON.stringify(facts)],
      );
      batches++;
      submitted += rows.length;
      matched += facts.filter((r) => r.status === "matched").length;
    } catch (e) {
      await q(
        "UPDATE atlas_geocode_cache SET status='retry',next_attempt_at=now()+interval '6 hours' WHERE address_key=ANY($1::text[])",
        [rows.map((r) => r.address_key)],
      );
      await writeFile(
        progressFile,
        JSON.stringify({
          batches,
          submitted,
          matched,
          updated,
          error: e.message,
        }),
      );
      throw e;
    }
    // Preserve dates and administrator edits. Interpolation is identified explicitly and never called an entrance verification.
    const changed = await q(
      `WITH changes AS(SELECT r.id,r.data AS before_data,r.data||jsonb_build_object('lat',c.lat,'lng',c.lng,'coordinateAccuracy','address','locationEvidence',jsonb_build_object('method','census-street-range','sourceUrl','https://geocoding.geo.census.gov/geocoder/','checkedAt',c.checked_at::date::text)) AS after_data,c.lat,c.lng FROM resources r JOIN atlas_geocode_cache c ON c.address_key=${key} WHERE c.status='matched' AND ${eligible}), applied AS(UPDATE resources r SET data=c.after_data,location=ST_SetSRID(ST_MakePoint(c.lng,c.lat),4326)::geography,updated_at=now() FROM changes c WHERE r.id=c.id AND r.data=c.before_data RETURNING r.id,c.before_data,c.after_data) INSERT INTO audit_events(action,resource_id,before_data,after_data) SELECT 'census-address-interpolation',id,before_data,after_data FROM applied RETURNING resource_id`,
    );
    updated += changed.length;
    await writeFile(
      progressFile,
      JSON.stringify(
        { batches, submitted, matched, updated, at: new Date().toISOString() },
        null,
        2,
      ),
    );
  }
  await q(
    "UPDATE atlas_geocode_cache SET status='retry' WHERE status='processing' AND next_attempt_at<now()",
  );
  return { batches, submitted, matched, updated };
}
