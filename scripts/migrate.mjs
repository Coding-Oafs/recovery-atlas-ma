import { readFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
if (!process.env.DATABASE_URL) throw Error("Set DATABASE_URL");
const sql = neon(process.env.DATABASE_URL);
const source = await readFile(
  new URL("../db/001_initial.sql", import.meta.url),
  "utf8",
);
const statements = [];
let current = "",
  quoted = false;
for (let i = 0; i < source.length; i++) {
  const c = source[i];
  current += c;
  if (c === "'" && source[i + 1] === "'" && quoted) {
    current += source[++i];
    continue;
  }
  if (c === "'") quoted = !quoted;
  if (c === ";" && !quoted) {
    statements.push(current);
    current = "";
  }
}
if (current.trim()) statements.push(current);
await sql.transaction(statements.map((statement) => sql.query(statement)));
console.log("Database schema ready");
