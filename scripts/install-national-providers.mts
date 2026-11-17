import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { Pool } from "pg";
import { normalizeNationalProvider } from "../src/lib/provider-import";
const uri = new URL(process.env.DATABASE_URL!);
uri.searchParams.set("sslmode", "verify-full");
const pool = new Pool({
    connectionString: uri.href,
    max: 2,
    ssl: { rejectUnauthorized: true },
  }),
  client = await pool.connect();
const release = process.env.IMPORT_RELEASE || "national-providers-20261117",
  today = new Date().toISOString().slice(0, 10);
const file = process.argv[2] || ".local/national-providers/filtered.ndjson.gz";
let scanned = 0,
  selected = 0,
  inserted = 0;
const batch: unknown[] = [];
try {
  await client.query(
    "INSERT INTO atlas_import_release(id,source) VALUES($1,'NPPES national monthly v2') ON CONFLICT(id)DO NOTHING",
    [release],
  );
  const existing = await client.query(
    "SELECT id FROM resources WHERE id LIKE 'npi-%'",
  );
  const ids = new Set(existing.rows.map((r) => r.id));
  async function flush() {
    if (!batch.length) return;
    const result = await client.query(
      `WITH added AS(INSERT INTO resources(id,data,location,published) SELECT r->>'id',r,CASE WHEN r->>'lat' IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint((r->>'lng')::float8,(r->>'lat')::float8),4326)::geography END,false FROM jsonb_array_elements($1::jsonb)r ON CONFLICT(id)DO NOTHING RETURNING id) INSERT INTO atlas_import_release_member(release_id,resource_id) SELECT $2,id FROM added ON CONFLICT DO NOTHING RETURNING resource_id`,
      [JSON.stringify(batch), release],
    );
    inserted += result.rowCount || 0;
    batch.length = 0;
  }
  const lines = createInterface({
    input: createReadStream(file).pipe(createGunzip()),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    scanned++;
    const row = JSON.parse(line);
    if (ids.has("npi-" + row.npi)) continue;
    const r = normalizeNationalProvider(row, today);
    if (!r) continue;
    ids.add(r.id);
    selected++;
    batch.push(r);
    if (batch.length >= 1000) await flush();
    if (selected % 10000 === 0)
      console.log(JSON.stringify({ scanned, selected, inserted }));
  }
  await flush();
  await client.query(
    "UPDATE atlas_import_release SET status='staged',details=$2::jsonb WHERE id=$1",
    [
      release,
      JSON.stringify({
        scanned,
        selected,
        inserted,
        checkedAt: today,
        note: "Insert-only public practice-location facts; no license, payer or availability inference.",
      }),
    ],
  );
  console.log(
    JSON.stringify({ release, scanned, selected, inserted, status: "staged" }),
  );
} finally {
  client.release();
  await pool.end();
}
