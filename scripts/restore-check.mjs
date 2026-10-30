// A public-directory JSON round-trip drill, not a full Neon disaster-recovery test.
import { neon } from "@neondatabase/serverless";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const sql = neon(process.env.DATABASE_URL);
const rows =
  await sql`SELECT id,data,published FROM resources ORDER BY id LIMIT 100`;
await mkdir(".local/backups", { recursive: true });
const path = ".local/backups/restore-drill.json";
await writeFile(
  path,
  JSON.stringify({ exportedAt: new Date().toISOString(), resources: rows }),
);
const backup = JSON.parse(await readFile(path, "utf8"));
const results = await sql.transaction([
  sql`CREATE TEMP TABLE atlas_restore_drill (id text PRIMARY KEY,data jsonb NOT NULL,published boolean NOT NULL) ON COMMIT DROP`,
  sql`INSERT INTO atlas_restore_drill SELECT * FROM jsonb_to_recordset(${JSON.stringify(backup.resources)}::jsonb) AS x(id text,data jsonb,published boolean)`,
  sql`SELECT id,data,published FROM atlas_restore_drill ORDER BY id`,
]);
assert.deepEqual(results[2], rows);
console.log(
  "Restored and compared " +
    rows.length +
    " complete public records in a temporary table. No live records were changed.",
);
