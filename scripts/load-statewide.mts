import { readFile, writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { resourceSchema } from "../src/lib/types";
if (!process.env.DATABASE_URL) throw Error("DATABASE_URL required");
const sql = neon(process.env.DATABASE_URL);
const paths = [
  ".local/imports/statewide-resources.json",
  ".local/imports/aa-resources.json",
  ".local/imports/central-aa-resources.json",
  ".local/imports/dharma-resources.json",
  ".local/imports/smart-resources.json",
  ".local/imports/refuge-resources.json",
];
let rows: any[] = [];
for (const path of paths)
  rows.push(...JSON.parse(await readFile(path, "utf8")));
const seed = JSON.parse(await readFile("data/resources.json", "utf8"));
const seedUrls = new Set(seed.map((r: any) => r.sourceUrl.replace(/\/$/, "")));
rows = rows.filter(
  (r) => !seedUrls.has(r.sourceUrl.replace(/\/$/, "")) || r.kind !== "meeting",
);
for (const r of rows) r.id = r.id.toLowerCase();
for (const r of rows) resourceSchema.parse(r);
const stats = {
  reviewedAt: "2026-10-22",
  imported: rows.length,
  sources: Object.fromEntries(
    [...new Set(rows.map((r) => r.sourceName))].map((name) => [
      name,
      rows.filter((r) => r.sourceName === name).length,
    ]),
  ),
  addressPins: rows.filter((r) => r.coordinateAccuracy === "address").length,
  approximatePins: rows.filter((r) => r.coordinateAccuracy === "approximate")
    .length,
  unmappedPhysical: rows
    .filter((r) => r.lat === null && !r.formats.includes("online"))
    .map((r) => r.id),
};
await writeFile(
  ".local/imports/final-summary.json",
  JSON.stringify(stats, null, 2),
);
let cursor = 0,
  done = 0;
const present = new Set((await sql`SELECT id FROM resources`).map((r) => r.id));
rows = rows.filter((r) => !present.has(r.id));
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (cursor < rows.length) {
      const batch = rows.slice(cursor, (cursor += 150));
      await sql.transaction(
        batch.map(
          (r) =>
            sql`INSERT INTO resources(id,data,location,published) VALUES(${r.id},${JSON.stringify(r)}::jsonb,CASE WHEN ${r.lng}::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(${r.lng}::float8,${r.lat}::float8),4326)::geography END,false) ON CONFLICT(id) DO NOTHING`,
        ),
      );
      done += batch.length;
      if (done % 3000 === 0 || done === rows.length)
        console.log("Validated and staged", done, "of", rows.length);
    }
  }),
);
console.log(JSON.stringify(stats));
