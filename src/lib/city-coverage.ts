import "server-only";
import { db } from "./db";
export async function getCityCoverage(
  state: string,
  query: string,
  page: number,
  missing: boolean,
) {
  if (!process.env.DATABASE_URL)
    return { rows: [], total: 0, mode: "unavailable" };
  const [result] = await db().query(
    `WITH cities AS(SELECT * FROM atlas_city_coverage WHERE ($1='' OR state=$1) AND ($2='' OR city ILIKE '%'||$2||'%') AND (NOT $3 OR COALESCE((counts->>'aaPhysical')::int,0)=0)) SELECT (SELECT count(*)::int FROM cities) AS total,COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM(SELECT * FROM cities ORDER BY state,city LIMIT 25 OFFSET $4)c),'[]') AS rows`,
    [state, query, missing, (page - 1) * 25],
  );
  return {
    rows: result?.rows ?? [],
    total: Number(result?.total ?? 0),
    mode: "database",
  };
}
