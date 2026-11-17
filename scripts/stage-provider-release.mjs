import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

/** Runs in the existing trusted database workspace. Never exports database credentials. */
export async function stageProviders({
  pool,
  normalize,
  file,
  progressFile,
  release,
  checkedAt,
}) {
  const client = await pool.connect();
  let scanned = 0,
    selected = 0,
    inserted = 0;
  const batch = [];
  const report = async (status) =>
    writeFile(
      progressFile,
      JSON.stringify(
        {
          release,
          status,
          scanned,
          selected,
          inserted,
          checkedAt,
          at: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  try {
    await client.query(
      "INSERT INTO atlas_import_release(id,source) VALUES($1,'NPPES national monthly v2') ON CONFLICT(id)DO NOTHING",
      [release],
    );
    const existing = await client.query(
      "SELECT resource_id AS id FROM atlas_import_release_member WHERE release_id=$1",
      [release],
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
      await report("staging");
    }
    for await (const line of createInterface({
      input: createReadStream(file).pipe(createGunzip()),
      crlfDelay: Infinity,
    })) {
      scanned++;
      const row = JSON.parse(line);
      if (!row.siteKey && ids.has("npi-" + row.npi)) continue;
      const r = normalize(row, checkedAt);
      if (!r) continue;
      selected++;
      ids.add(r.id);
      batch.push(r);
      if (batch.length >= 1000) await flush();
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
          checkedAt,
          note: "Insert-only public practice-location facts. License, payer, attendance mode and availability are unconfirmed.",
        }),
      ],
    );
    await report("staged");
    return { release, scanned, selected, inserted };
  } catch (e) {
    await report("failed: " + e.message);
    throw e;
  } finally {
    client.release();
  }
}
