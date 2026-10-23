import { readFile } from "node:fs/promises";
import { resourceSchema } from "../src/lib/types";
const rows = JSON.parse(
  await readFile(".local/imports/statewide-resources.json", "utf8"),
);
let errors = 0;
for (const row of rows) {
  const p = resourceSchema.safeParse(row);
  if (!p.success) {
    if (errors++ < 15) console.log(row.id, JSON.stringify(p.error.issues));
  }
}
console.log({ rows: rows.length, errors });
if (errors) process.exitCode = 1;
