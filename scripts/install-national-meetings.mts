import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { neon } from "@neondatabase/serverless";
import {
  normalizeMeetingGuide,
  normalizeBmlt,
  normalizeOnlineIntergroup,
  meetingSignature,
} from "../src/lib/meeting-import";
import { resourceSchema, type Resource } from "../src/lib/types";

if (!process.env.DATABASE_URL) throw Error("Set the intended database URL.");
const sql = neon(process.env.DATABASE_URL),
  dir = ".local/national-meetings",
  date = new Date().toISOString().slice(0, 10);
let stagedIds: string[] = [];
try {
  stagedIds = JSON.parse(await readFile(dir + "/staged-ids.json", "utf8"));
} catch {}
if (process.argv.includes("--activate")) {
  if (!stagedIds.length) throw Error("Stage and review before activation.");
  const results = await sql.transaction([
    sql`WITH changed AS(UPDATE resources SET published=true WHERE id=ANY(${stagedIds}::text[]) AND NOT published RETURNING id) INSERT INTO audit_events(action,after_data) SELECT 'activate-national-meetings',jsonb_build_object('count',count(*),'ids',coalesce(jsonb_agg(id),'[]'::jsonb)) FROM changed RETURNING after_data`,
    sql`INSERT INTO sync_runs(source,status,details) VALUES('national-meetings','completed',${JSON.stringify({ date, activated: stagedIds.length, note: "Reviewed official public sources; existing edits and publication decisions preserved." })}::jsonb)`,
  ]);
  console.log(results[0]);
  process.exit(0);
}
const manifest = JSON.parse(await readFile(dir + "/manifest.json", "utf8"));
const rows: Resource[] = [];
for (const source of manifest.filter((s: any) => s.status === "public-feed")) {
  if (source.checkedAt !== date)
    throw Error("Refresh source capture before importing: " + source.id);
  const raw = JSON.parse(
    await readFile(dir + "/" + source.id + ".json", "utf8"),
  );
  rows.push(
    ...raw
      .map((m: any) => normalizeMeetingGuide(m, source, date))
      .filter(Boolean),
  );
}
try {
  const raw = gunzipSync(await readFile(".local/coverage-fix/na-export.gz"))
    .toString()
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  rows.push(
    ...raw
      .map((m) => normalizeBmlt(m, date))
      .filter((r): r is Resource => r !== null),
  );
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
const online = JSON.parse(await readFile(dir + "/oiaa.json", "utf8"));
rows.push(
  ...online.map((m: any) => normalizeOnlineIntergroup(m, date)).filter(Boolean),
);
const existing =
  await sql`SELECT data FROM resources WHERE resource_kind='meeting'`;
const ids = new Set(existing.map((r) => r.data.id)),
  signatures = new Set(existing.map((r) => meetingSignature(r.data)));
const candidates = rows.filter((r) => {
  if (ids.has(r.id) || signatures.has(meetingSignature(r))) return false;
  ids.add(r.id);
  signatures.add(meetingSignature(r));
  return true;
});
for (const r of candidates) resourceSchema.parse(r);
await writeFile(dir + "/normalized.json", JSON.stringify(candidates));
for (let offset = 0; offset < candidates.length; offset += 200) {
  const added =
    await sql`INSERT INTO resources(id,data,location,published) SELECT r->>'id',r,CASE WHEN r->>'lat' IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint((r->>'lng')::float8,(r->>'lat')::float8),4326)::geography END,false FROM jsonb_array_elements(${JSON.stringify(candidates.slice(offset, offset + 200))}::jsonb)r ON CONFLICT(id) DO NOTHING RETURNING id`;
  stagedIds = [...new Set([...stagedIds, ...added.map((r) => r.id)])];
  await writeFile(dir + "/staged-ids.json", JSON.stringify(stagedIds));
}
console.log(
  JSON.stringify({ candidates: candidates.length, staged: stagedIds.length }),
);
