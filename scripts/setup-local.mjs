import { randomBytes } from "node:crypto";
import { mkdir, appendFile, writeFile, readFile } from "node:fs/promises";
await mkdir(".local", { recursive: true });
let env = "";
try {
  env = await readFile(".env.local", "utf8");
} catch {}
const password = randomBytes(24).toString("base64url"),
  session = randomBytes(48).toString("base64url"),
  cron = randomBytes(32).toString("base64url");
if (!env.includes("ADMIN_PASSWORD=")) {
  await appendFile(
    ".env.local",
    `\nADMIN_PASSWORD=${password}\nSESSION_SECRET=${session}\nCRON_SECRET=${cron}\nAPP_ORIGIN=http://localhost:4117\n`,
  );
  await writeFile(
    ".local/admin-access.txt",
    `Recovery Atlas administrator\n\nSign in at /admin with the password below.\nKeep this file private. It is excluded from GitHub.\n\n${password}\n`,
  );
}
console.log("Local administrator credentials saved privately");
