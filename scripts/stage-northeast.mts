import { readFile, writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { resourceSchema } from "../src/lib/types";
const sql = neon(process.env.DATABASE_URL!),
  names = process.argv.slice(2);
if (!names.length)
  throw Error(
    "Pass reviewed normalized file names such as CT ME meetings facilities",
  );
let staged: string[] = [];
try {
  staged = JSON.parse(
    await readFile(".local/northeast/staged-ids.json", "utf8"),
  );
} catch {}
const present = new Set((await sql`SELECT id FROM resources`).map((r) => r.id));
for (const name of names) {
  if (!/^[A-Za-z-]+$/.test(name)) throw Error("Invalid import name");
  const input = JSON.parse(
    await readFile(`.local/northeast/resources-${name}.json`, "utf8"),
  );
  for (const row of input) resourceSchema.parse(row);
  const seen = new Set<string>(),
    rows = input.filter((r: { id: string }) => {
      if (present.has(r.id) || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  let cursor = 0,
    done = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < rows.length) {
        const batch = rows.slice(cursor, (cursor += 500));
        const inserted =
          await sql`INSERT INTO resources(id,data,location,published) SELECT r->>'id',r,CASE WHEN r->>'lng' IS NULL THEN NULL ELSE ST_SetSRID(ST_MakePoint((r->>'lng')::float8,(r->>'lat')::float8),4326)::geography END,false FROM jsonb_array_elements(${JSON.stringify(batch)}::jsonb) r ON CONFLICT(id) DO NOTHING RETURNING id`;
        for (const r of inserted) {
          staged.push(r.id);
          present.add(r.id);
        }
        done += batch.length;
        if (done % 10000 === 0 || done === rows.length)
          console.log("Validated and staged", name, done, "of", rows.length);
      }
    }),
  );
  await writeFile(
    ".local/northeast/staged-ids.json",
    JSON.stringify([...new Set(staged)]),
  );
  console.log(name, "existing records preserved", input.length - rows.length);
}
console.log("Staged release IDs", new Set(staged).size);
