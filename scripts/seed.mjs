import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
if (!process.env.DATABASE_URL) throw Error("Set DATABASE_URL");
const sql = neon(process.env.DATABASE_URL),
  rows = JSON.parse(
    await readFile(new URL("../data/resources.json", import.meta.url), "utf8"),
  );
await sql.transaction(
  rows.map(
    (r) =>
      sql`INSERT INTO resources(id,data,location) VALUES(${r.id},${JSON.stringify(r)}::jsonb,CASE WHEN ${r.lng}::float8 IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint(${r.lng}::float8,${r.lat}::float8),4326)::geography END) ON CONFLICT(id) DO NOTHING`,
  ),
);
console.log(
  `Seeded ${rows.length} sourced resources; existing edits preserved`,
);
