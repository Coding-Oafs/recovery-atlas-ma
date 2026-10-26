import { neon } from "@neondatabase/serverless";
import { readFile, writeFile } from "node:fs/promises";
const sql = neon(process.env.DATABASE_URL);
const includeStaged = process.argv.includes("--include-staged");
const staged = includeStaged
  ? JSON.parse(await readFile(".local/northeast/staged-ids.json", "utf8"))
  : [];
const selected = `published OR id=ANY($1::text[])`;
const [summary] = await sql.query(
  `SELECT count(*)::int AS total,count(location)::int AS mapped,count(*) FILTER(WHERE data->>'coordinateAccuracy'='approximate')::int AS approximate,count(*) FILTER(WHERE location IS NULL)::int AS online_or_unmapped,count(*) FILTER(WHERE location IS NULL AND NOT(resource_kind='meeting' AND data->'formats' ? 'online' AND NOT(data->'formats' ? 'hybrid')))::int AS unmapped_physical FROM resources WHERE ${selected}`,
  [staged],
);
const sources = await sql.query(
  `SELECT resource_source AS name,count(*)::int AS listings FROM resources WHERE ${selected} GROUP BY 1 ORDER BY 2 DESC`,
  [staged],
);
const states = await sql.query(
  `SELECT resource_state AS state,count(*)::int AS listings,count(location)::int AS mapped,count(*) FILTER(WHERE resource_kind='meeting')::int AS meetings FROM resources WHERE ${selected} GROUP BY 1 ORDER BY 1`,
  [staged],
);
const approaches = await sql.query(
  `SELECT data->>'fellowship' AS name,count(*)::int AS listings FROM resources WHERE (${selected}) AND resource_kind='meeting' GROUP BY 1 ORDER BY 2 DESC`,
  [staged],
);
const report = {
  reviewedAt: "2026-10-26",
  ...summary,
  states,
  sources,
  approaches,
  limitations: [
    "Counts are listings, including separate providers, programs and meetings at shared addresses; they are not unique venues.",
    "Every mapped search match is represented in the viewport map groups, independent of card pagination. Online-only meetings have no physical pin.",
    "NPPES registry status does not verify professional licensure, insurance, accepting new patients or current practice operations.",
    "SAMHSA 2025 facility directories reflect the 2024 survey. Their reported services and broad payment categories require current confirmation; private insurance does not identify a specific plan.",
    "Regional AA imports cover the public feeds and all-day pages listed in DATA_POLICY.md. Some western Massachusetts, northern New Jersey, Cape Atlantic, Albany, Rochester and Pittsburgh directories still need imports.",
    "Thirteen meeting records were held for review because their schedule, timezone or coordinates could not be represented reliably.",
    "The NPPES Counselor search for New Jersey ZIP 08060 reached the API limit of 1,200 results; that partition may omit additional providers.",
    "Approximate pins use a source-supported ZIP or city area. Street geocoding does not verify the building entrance. Source review is not direct verification.",
    "Coverage varies by state and fellowship and is not exhaustive. This directory does not establish live beds, admissions or personalized insurance eligibility.",
  ],
};
await writeFile("public/coverage.json", JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    { reviewedAt: report.reviewedAt, ...summary, states, approaches },
    null,
    2,
  ),
);
