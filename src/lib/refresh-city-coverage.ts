import type { PipelineSql } from "./source-pipeline-store";
export async function refreshCityCoverage(sql: PipelineSql) {
  await sql.query(
    `UPDATE atlas_city_coverage SET counts='{}',generated_at=now()`,
  );
  await sql.query(
    `INSERT INTO atlas_city_coverage(state,city,name,counts,generated_at) SELECT resource_state,lower(trim(data->>'city')),min(trim(data->>'city')),jsonb_build_object('listings',count(*),'aaPhysical',count(*) FILTER(WHERE data->>'fellowship'='AA' AND data->'formats' ? 'in-person'),'naPhysical',count(*) FILTER(WHERE data->>'fellowship'='NA' AND data->'formats' ? 'in-person'),'smartPhysical',count(*) FILTER(WHERE data->>'fellowship'='SMART Recovery' AND data->'formats' ? 'in-person'),'providers',count(*) FILTER(WHERE resource_kind='provider'),'support',count(*) FILTER(WHERE data->'categories' ? 'support')),now() FROM resources WHERE published AND resource_state<>'US' AND trim(data->>'city')<>'' AND NOT(resource_kind='meeting' AND data->'formats' ? 'online' AND NOT(data->'formats' ? 'hybrid')) GROUP BY resource_state,lower(trim(data->>'city')) ON CONFLICT(state,city)DO UPDATE SET counts=EXCLUDED.counts,generated_at=EXCLUDED.generated_at`,
  );
}
