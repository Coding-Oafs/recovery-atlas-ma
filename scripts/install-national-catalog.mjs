import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { neon } from "@neondatabase/serverless";
if (!process.env.DATABASE_URL)
  throw Error("Set the intended database URL before importing.");
const manifest = JSON.parse(
  readFileSync("data/national-manifest.json", "utf8"),
);
if (!manifest.generatedAt || manifest.total < 10000)
  throw Error(
    "National catalog must be generated and checked before a database release.",
  );
const rows = JSON.parse(
  gunzipSync(readFileSync("data/national-catalog.json.gz")).toString("utf8"),
);
if (
  rows.length !== manifest.total ||
  new Set(rows.map((r) => r.id)).size !== rows.length
)
  throw Error("National catalog manifest mismatch");
const sql = neon(process.env.DATABASE_URL),
  file = ".local/national-staged-ids.json";
mkdirSync(".local", { recursive: true });
let staged = [];
try {
  staged = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const catalogIds = new Set(rows.map((r) => r.id));
if (staged.some((id) => !catalogIds.has(id)))
  throw Error("Staged IDs do not belong to this reviewed catalog.");
if (process.argv.includes("--activate")) {
  if (!staged.length)
    throw Error("Stage and review the release before activation.");
  const details = {
    sourceDate: manifest.generatedAt,
    releaseIds: staged,
    note: "Reviewed national annual-source release; existing publication decisions preserved.",
  };
  const result = await sql.transaction([
    sql`WITH activated AS (UPDATE resources SET published=true WHERE id=ANY(${staged}::text[]) AND NOT published RETURNING id)
   INSERT INTO audit_events(action,after_data) SELECT 'activate-national-catalog',jsonb_build_object('count',count(*),'ids',coalesce(jsonb_agg(id),'[]'::jsonb),'sourceDate',${manifest.generatedAt}::text) FROM activated RETURNING after_data`,
    sql`INSERT INTO sync_runs(source,status,details) VALUES('national-annual-catalog','completed',${JSON.stringify(details)}::jsonb)`,
  ]);
  console.log(JSON.stringify({ activated: result[0][0].after_data.count }));
  process.exit(0);
}
let inserted = 0;
for (let i = 0; i < rows.length; i += 250) {
  const batch = rows.slice(i, i + 250);
  const added = await sql`INSERT INTO resources(id,data,location,published)
 SELECT r->>'id',r,CASE WHEN r->>'lat' IS NULL OR r->>'lng' IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint((r->>'lng')::float8,(r->>'lat')::float8),4326)::geography END,false
 FROM jsonb_array_elements(${JSON.stringify(batch)}::jsonb) r
 ON CONFLICT(id) DO NOTHING RETURNING id`;
  inserted += added.length;
  staged = [...new Set([...staged, ...added.map((r) => r.id)])];
  writeFileSync(file, JSON.stringify(staged));
}
await sql`INSERT INTO sync_runs(source,status,details) VALUES('national-annual-catalog','staged',${JSON.stringify({ inserted, staged: staged.length, directoryYear: manifest.directoryYear, surveyYear: manifest.surveyYear, generatedAt: manifest.generatedAt, note: "Insert-only public annual-source facts; new rows remain unpublished. Existing records and publication decisions preserved." })}::jsonb)`;
console.log(
  JSON.stringify({
    catalog: rows.length,
    inserted,
    staged: staged.length,
    note: "Review before --activate.",
  }),
);
