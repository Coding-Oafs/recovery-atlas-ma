// Creates an unpublished synthetic listing in the preview database and removes it afterwards.
import { chromium } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://localhost:4122";
if (!base.startsWith("http://localhost:"))
  throw Error("Use a local preview build");
const sql = neon(process.env.DATABASE_URL),
  id = "test-quality-" + randomBytes(5).toString("hex"),
  name = "Temporary quality review " + id;
const [source] = await sql`SELECT data FROM resources ORDER BY id LIMIT 1`;
const before = { ...source.data, id, name },
  proposed = { ...before, name: name + " approved" },
  fingerprint = randomBytes(24).toString("hex");
const browser = await chromium.launch({
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  }),
  context = await browser.newContext(),
  p = await context.newPage();
try {
  await sql`INSERT INTO resources(id,data,published) VALUES(${id},${JSON.stringify(before)}::jsonb,false)`;
  await sql`INSERT INTO atlas_quality_proposal(resource_id,source,proposal,before_data,reason,fingerprint) VALUES(${id},'test-review',${JSON.stringify(proposed)}::jsonb,${JSON.stringify(before)}::jsonb,'Temporary test proposal',${fingerprint})`;
  await p.goto(base + "/admin");
  await p.getByLabel("Administrator password").fill(process.env.ADMIN_PASSWORD);
  await p.getByRole("button", { name: "Sign in", exact: true }).click();
  await p
    .getByRole("heading", { name: "A little care for the directory." })
    .waitFor();
  await p.goto(base + "/admin/quality");
  await p
    .locator("article")
    .filter({ has: p.getByRole("heading", { name, exact: true }) })
    .getByRole("button", { name: "Approve reviewed changes" })
    .click();
  await p.waitForURL("**/admin/quality?updated=1");
  const [approved] =
    await sql`SELECT p.status,r.data FROM atlas_quality_proposal p JOIN resources r ON r.id=p.resource_id WHERE fingerprint=${fingerprint}`;
  assert.equal(approved.status, "approved");
  assert.equal(approved.data.name, proposed.name);
  console.log(
    "Verified: approved source proposal changes the listing and records review.",
  );
  await sql`INSERT INTO atlas_quality_proposal(resource_id,source,proposal,before_data,reason,fingerprint) VALUES(${id},'test-conflict',${JSON.stringify({ ...proposed, name: name + " obsolete" })}::jsonb,${JSON.stringify(before)}::jsonb,'Temporary obsolete test proposal',${fingerprint + "c"})`;
  await p.goto(base + "/admin/quality");
  await p
    .locator("article")
    .filter({
      has: p.getByRole("heading", { name: proposed.name, exact: true }),
    })
    .getByRole("button", { name: "Approve reviewed changes" })
    .click();
  await p.waitForURL("**/admin/quality?conflict=1");
  const [conflict] =
    await sql`SELECT p.status,r.data,(SELECT count(*)::int FROM audit_events WHERE resource_id=${id} AND action='quality-proposal-reviewed') AS audits FROM atlas_quality_proposal p JOIN resources r ON r.id=p.resource_id WHERE fingerprint=${fingerprint + "c"}`;
  assert.equal(conflict.status, "conflict");
  assert.equal(conflict.data.name, proposed.name);
  assert.equal(conflict.audits, 1);
  console.log(
    "Verified: concurrent-edit conflicts preserve current data without a false approval audit.",
  );
} finally {
  await sql`DELETE FROM resources WHERE id=${id} AND NOT published`;
  await context.close();
  await browser.close();
}
