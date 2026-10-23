import { neon } from "@neondatabase/serverless";
import { writeFile } from "node:fs/promises";
const sql = neon(process.env.DATABASE_URL);
const [summary] =
  await sql`SELECT count(*)::int AS total,count(location)::int AS mapped,count(*) FILTER(WHERE data->>'coordinateAccuracy'='approximate')::int AS approximate,count(*) FILTER(WHERE location IS NULL)::int AS online_or_unmapped FROM resources`;
const sources =
  await sql`SELECT data->>'sourceName' AS name,count(*)::int AS listings FROM resources GROUP BY 1 ORDER BY 2 DESC`;
const approaches =
  await sql`SELECT data->>'fellowship' AS name,count(*)::int AS listings FROM resources WHERE data->>'kind'='meeting' GROUP BY 1 ORDER BY 2 DESC`;
const report = {
  reviewedAt: "2026-10-22",
  ...summary,
  sources,
  approaches,
  limitations: [
    "Provider registry status does not verify professional licensure, insurance or appointment availability.",
    "Western Massachusetts AA directory currently returns HTTP 508; published official links remain available.",
    "Additional fellowships and services outside these public source directories are not exhaustively covered.",
    "Approximate pins use ZIP/city areas. Source review is not direct verification.",
    "This directory does not establish live beds, admissions or personalized insurance eligibility.",
  ],
};
await writeFile("public/coverage.json", JSON.stringify(report, null, 2));
console.log(report);
