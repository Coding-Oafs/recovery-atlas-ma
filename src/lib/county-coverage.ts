import "server-only";
import { db } from "./db";
import { countyReferences as counties } from "./county-reference";
export async function getCountyCoverage(input: {
  state: string;
  query: string;
  page: number;
  program: string;
  missing: boolean;
}) {
  if (!process.env.DATABASE_URL)
    return { mode: "unavailable", rows: [], total: 0, generatedAt: null };
  const metric = [
    "aaPhysical",
    "naPhysical",
    "smartPhysical",
    "providers",
    "support",
  ].includes(input.program)
    ? input.program
    : "aaPhysical";
  const rows = await db().query(
    `WITH selected AS(SELECT c.fips,c.state,c.name,c.population,v.counts,v.generated_at FROM atlas_county c LEFT JOIN atlas_county_coverage v ON c.fips=v.county_fips WHERE ($1='' OR c.state=$1) AND ($2='' OR c.name ILIKE '%'||$2||'%') AND (NOT $3 OR (v.generated_at IS NOT NULL AND COALESCE((v.counts->>$4)::int,0)=0))) SELECT (SELECT count(*)::int FROM selected) AS total,(SELECT max(generated_at) FROM selected) AS generated_at,COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM(SELECT * FROM selected ORDER BY state,name,fips LIMIT 25 OFFSET $5)s),'[]') AS rows`,
    [input.state, input.query, input.missing, metric, (input.page - 1) * 25],
  );
  return {
    mode: "database",
    rows: rows[0].rows,
    total: rows[0].total,
    generatedAt: rows[0].generated_at,
  };
}
export function countyOptions(state: string) {
  return counties
    .filter((c) => c.state === state)
    .map((c) => ({ fips: c.fips, name: c.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
