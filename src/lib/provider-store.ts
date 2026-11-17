import type { Resource } from "./types";
import type { PipelineSql } from "./source-pipeline-store";
export const providerFields = [
  "name",
  "kind",
  "address",
  "city",
  "state",
  "zip",
  "phone",
  "services",
  "categories",
] as const;
export function providerHashSql(column: string) {
  return `md5(jsonb_build_object(${providerFields.map((k) => `'${k}',${column}->'${k}'`).join(",")})::text)`;
}
/** Update only registry-managed fields against a matching baseline; publication choices and local evidence persist. */
export async function installProviderChunk(sql: PipelineSql, rows: Resource[]) {
  let added = 0,
    updated = 0,
    queued = 0;
  const projection = (col: string) =>
    `jsonb_build_object(${[...providerFields, "sourceCheckedAt", "sourceUpdatedAt"].map((k) => `'${k}',${col}->'${k}'`).join(",")})`;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const [counts] = await sql.query(
      `WITH incoming AS MATERIALIZED(SELECT r->>'id' AS id,r AS fresh,${providerHashSql("r")} AS hash FROM jsonb_array_elements($1::jsonb)r),existing AS MATERIALIZED(SELECT r.id,r.data,r.published,i.fresh,i.hash,${providerHashSql("r.data")} AS current_hash FROM resources r JOIN incoming i ON i.id=r.id AND COALESCE(i.fresh->>'sourceUpdatedAt','0001-01-01')>=COALESCE(r.data->>'sourceUpdatedAt','0001-01-01')),added AS(INSERT INTO resources(id,data,location,published) SELECT i.id,i.fresh||jsonb_build_object('sourceRecordHash',i.hash),CASE WHEN i.fresh->>'lat' IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint((i.fresh->>'lng')::float8,(i.fresh->>'lat')::float8),4326)::geography END,true FROM incoming i WHERE NOT EXISTS(SELECT 1 FROM existing e WHERE e.id=i.id) ON CONFLICT DO NOTHING RETURNING id),changes AS MATERIALIZED(SELECT e.id,e.data AS before_data,e.data||${projection("e.fresh")}||jsonb_build_object('sourceRecordHash',e.hash)||CASE WHEN e.data->>'address' IS DISTINCT FROM e.fresh->>'address' OR e.data->>'city' IS DISTINCT FROM e.fresh->>'city' OR e.data->>'state' IS DISTINCT FROM e.fresh->>'state' THEN jsonb_build_object('lat',e.fresh->'lat','lng',e.fresh->'lng','coordinateAccuracy',e.fresh->'coordinateAccuracy','locationEvidence',e.fresh->'locationEvidence') ELSE '{}'::jsonb END AS after_data FROM existing e WHERE e.published AND e.data->>'sourceName' LIKE 'NPPES%' AND (e.current_hash=e.hash OR e.data->>'sourceRecordHash'=e.current_hash)),applied AS(UPDATE resources r SET data=c.after_data,location=CASE WHEN c.after_data->>'lat' IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint((c.after_data->>'lng')::float8,(c.after_data->>'lat')::float8),4326)::geography END,updated_at=now() FROM changes c WHERE r.id=c.id AND r.data=c.before_data AND r.data IS DISTINCT FROM c.after_data RETURNING r.id,c.before_data,c.after_data),audited AS(INSERT INTO audit_events(action,resource_id,before_data,after_data) SELECT 'nppes-source-refresh',id,before_data,after_data FROM applied),proposed AS(INSERT INTO atlas_quality_proposal(resource_id,source,proposal,before_data,reason,fingerprint) SELECT e.id,'NPPES public registry',e.data||${projection("e.fresh")},e.data,'Registry facts changed; local edits or an unknown baseline require review.',md5(e.id||e.hash) FROM existing e WHERE e.published AND NOT EXISTS(SELECT 1 FROM changes c WHERE c.id=e.id) AND e.current_hash<>e.hash ON CONFLICT(fingerprint)DO NOTHING RETURNING id) SELECT (SELECT count(*)::int FROM added) AS added,(SELECT count(*)::int FROM applied) AS updated,(SELECT count(*)::int FROM proposed) AS queued`,
      [JSON.stringify(chunk)],
    );
    added += counts.added;
    updated += counts.updated;
    queued += counts.queued;
  }
  return { added, updated, queued, scanned: rows.length };
}
