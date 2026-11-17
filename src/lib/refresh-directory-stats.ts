import { regionStates } from "./region";
import type { PipelineSql } from "./source-pipeline-store";
export async function refreshDirectoryStats(sql: PipelineSql) {
  const states = await sql.query(
    `SELECT resource_state AS state,count(*)::int AS listings,count(location)::int AS mapped,count(*) FILTER(WHERE resource_kind='meeting')::int AS meetings,count(*) FILTER(WHERE data->>'fellowship'='AA' AND data->'formats' ? 'in-person')::int AS "aaPhysical",count(*) FILTER(WHERE resource_kind='provider')::int AS providers,count(*) FILTER(WHERE data->'categories' ? 'treatment')::int AS treatment,count(*) FILTER(WHERE data->'categories' ? 'mental-health')::int AS "mentalHealth",count(*) FILTER(WHERE data->'categories' ? 'counseling')::int AS counseling,count(*) FILTER(WHERE data->'categories' ? 'support')::int AS support FROM resources WHERE published GROUP BY resource_state`,
  );
  const approaches = await sql.query(
    "SELECT data->>'fellowship' AS name,count(*)::int AS listings FROM resources WHERE published AND resource_kind='meeting' GROUP BY 1",
  );
  const coverage = {
    reviewedAt: new Date().toISOString().slice(0, 10),
    mode: "database",
    total: states.reduce((n, s) => n + Number(s.listings), 0),
    mapped: states.reduce((n, s) => n + Number(s.mapped), 0),
    nationalOnline: Number(states.find((s) => s.state === "US")?.listings || 0),
    states: regionStates.map(
      (state) =>
        states.find((r) => r.state === state) ?? {
          state,
          listings: 0,
          mapped: 0,
          meetings: 0,
          aaPhysical: 0,
          providers: 0,
          treatment: 0,
          mentalHealth: 0,
          counseling: 0,
          support: 0,
        },
    ),
    approaches,
  };
  const fields = await sql.query(
    "SELECT k.field,jsonb_agg(DISTINCT v.value ORDER BY v.value) AS values FROM resources r CROSS JOIN LATERAL(VALUES('services',r.data->'services'),('languages',r.data->'languages'),('populations',r.data->'populations'),('payment',r.data->'payment')) k(field,items) CROSS JOIN LATERAL jsonb_array_elements_text(k.items) v(value) WHERE r.published GROUP BY k.field",
  );
  const facets = Object.fromEntries(fields.map((r) => [r.field, r.values]));
  const insurance = await sql.query(
    "SELECT DISTINCT i->>'name' AS name FROM resources CROSS JOIN LATERAL jsonb_array_elements(data->'insurance') i WHERE published",
  );
  facets.payment = [
    ...new Set([...(facets.payment ?? []), ...insurance.map((r) => r.name)]),
  ].sort();
  await sql.query(
    "INSERT INTO atlas_directory_stats(id,data)VALUES('coverage',$1::jsonb),('facets',$2::jsonb)ON CONFLICT(id)DO UPDATE SET data=EXCLUDED.data,generated_at=now()",
    [JSON.stringify(coverage), JSON.stringify(facets)],
  );
  return coverage;
}
