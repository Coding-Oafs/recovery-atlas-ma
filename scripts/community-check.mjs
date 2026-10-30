// Run only against the isolated preview database and a local build.
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { neon } from "@neondatabase/serverless";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.TEST_BASE_URL || "http://localhost:4122";
if (!base.startsWith("http://localhost:") || !process.env.DATABASE_URL)
  throw Error("Use a local build and preview environment");
const sql = neon(process.env.DATABASE_URL),
  browser = await chromium.launch({
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  });
const contexts = [],
  users = [],
  checks = [],
  errors = [],
  suffix = randomBytes(5).toString("hex");
await mkdir(".local/community", { recursive: true });
const check = (name, ok) => {
  if (!ok) throw Error(name);
  checks.push(name);
  console.log("Verified:", name);
};
const post = (c, path, data) =>
  c.request.post(path, { headers: { Origin: base }, data });
const json = async (r) => {
  if (!r.ok())
    throw Error("Request failed: " + r.status() + " " + (await r.json()).error);
  return r.json();
};
const profile = (name, visible = false) => ({
  displayName: name,
  bio: "A temporary test profile.",
  region: "Broad test region",
  languages: ["English"],
  discoverable: visible,
  acceptsRequests: visible,
  adultConfirmed: true,
  guidelinesAccepted: true,
});
try {
  for (const letter of ["a", "b", "c"]) {
    const c = await browser.newContext({
      baseURL: base,
      viewport: { width: 1440, height: 1050 },
      extraHTTPHeaders: {
        "x-forwarded-for": "192.0.2." + (1 + (randomBytes(1)[0] % 254)),
      },
    });
    contexts.push(c);
    const username = "community_" + letter + "_" + suffix,
      password = randomBytes(24).toString("base64url");
    const r = await post(c, "/api/auth/sign-up/email", { username, password });
    check("Temporary account " + letter + " registers", r.ok());
    const session = await json(await c.request.get("/api/auth/get-session"));
    users.push({ id: session.user.id, username, password });
    await json(
      await post(c, "/api/community/profile", profile("Test member " + letter)),
    );
  }
  const [a, b, c] = contexts,
    [ua, ub, uc] = users;
  check(
    "Hidden profiles are excluded from discovery",
    (await json(await a.request.get("/api/community/people?q=" + ub.username)))
      .people.length === 0,
  );
  await json(
    await post(b, "/api/community/profile", profile("Test member b", true)),
  );
  const found = await json(
    await a.request.get("/api/community/people?q=" + ub.username),
  );
  check(
    "Only opted-in public profile fields are returned",
    found.people.length === 1 &&
      !JSON.stringify(found).includes("@accounts.invalid") &&
      !("email" in found.people[0]),
  );
  const cross = await a.request.post("/api/community/profile", {
    headers: { Origin: "https://attacker.invalid" },
    data: profile("Changed"),
  });
  check("Profile edits reject foreign origins", cross.status() === 403);
  const intro = "Unreported private introduction " + suffix;
  const thread = await json(
    await post(a, "/api/community/conversations", { recipient: ub.id, intro }),
  );
  check(
    "New conversations require recipient consent",
    thread.status === "pending",
  );
  check(
    "Pending requests cannot send follow-ups",
    (
      await post(a, "/api/community/conversations/" + thread.id, {
        action: "message",
        body: "Cannot send",
      })
    ).status() === 403,
  );
  check(
    "Requesters cannot accept their own request",
    (
      await post(a, "/api/community/conversations/" + thread.id, {
        action: "respond",
        accept: true,
      })
    ).status() === 403,
  );
  check(
    "Unrelated accounts cannot read a conversation",
    (
      await c.request.get("/api/community/conversations/" + thread.id)
    ).status() === 404,
  );
  check(
    "Unrelated accounts cannot respond to a conversation",
    (
      await post(c, "/api/community/conversations/" + thread.id, {
        action: "respond",
        accept: true,
      })
    ).status() === 404,
  );
  await json(
    await post(b, "/api/community/conversations/" + thread.id, {
      action: "respond",
      accept: true,
    }),
  );
  const body = "Reported test message " + suffix;
  await json(
    await post(b, "/api/community/conversations/" + thread.id, {
      action: "message",
      body,
    }),
  );
  const history = await json(
      await a.request.get("/api/community/conversations/" + thread.id),
    ),
    last = history.messages.at(-1);
  check(
    "Accepted peers can exchange messages",
    last.body === body && !last.mine,
  );
  const encrypted =
    await sql`SELECT body_encrypted FROM atlas_message WHERE conversation_id=${thread.id}::uuid ORDER BY id DESC LIMIT 1`;
  check(
    "Message storage is encrypted",
    encrypted[0].body_encrypted.startsWith("v1.") &&
      !encrypted[0].body_encrypted.includes(body),
  );
  const after = await json(
    await a.request.get(
      "/api/community/conversations/" +
        thread.id +
        "?after=" +
        history.messages[0].id,
    ),
  );
  check(
    "Incremental polling returns only newer messages",
    after.messages.length === 1 && after.messages[0].id === last.id,
  );
  check(
    "Unread counts belong to the receiving account",
    (await json(await a.request.get("/api/community/conversations")))
      .conversations[0].unread === 1,
  );
  await json(
    await post(a, "/api/community/conversations/" + thread.id, {
      action: "read",
      messageId: last.id,
    }),
  );
  check(
    "Read markers clear the account�s own unread count",
    (await json(await a.request.get("/api/community/conversations")))
      .conversations[0].unread === 0,
  );
  await json(
    await post(a, "/api/community/safety", {
      action: "report",
      conversationId: thread.id,
      messageId: last.id,
      reason: "Temporary moderation flow test.",
    }),
  );
  check(
    "Nonmoderators cannot see reported messages",
    !(await (await c.request.get("/moderation")).text()).includes(body),
  );
  await sql`INSERT INTO atlas_community_role(user_id,role) VALUES(${ua.id},'moderator')`;
  check(
    "Moderator role is recognized",
    (await json(await a.request.get("/api/community/status"))).moderator ===
      true,
  );
  const mod = await a.newPage();
  mod.on("pageerror", (e) => errors.push(e.message));
  await mod.goto("/moderation");
  await mod.getByRole("heading", { name: "Moderation inbox" }).waitFor();
  check(
    "Moderator sees selected report evidence only",
    (await mod.locator("main").innerText()).includes(body) &&
      !(await mod.locator("main").innerText()).includes(intro),
  );
  await json(
    await post(a, "/api/community/safety", {
      action: "block",
      userId: ub.id,
      blocked: true,
    }),
  );
  check(
    "Blocking prevents messages in both directions",
    (
      await post(b, "/api/community/conversations/" + thread.id, {
        action: "message",
        body: "Blocked",
      })
    ).status() === 403 &&
      (
        await a.request.get("/api/community/conversations/" + thread.id)
      ).status() === 403,
  );
  await json(
    await post(a, "/api/community/safety", {
      action: "block",
      userId: ub.id,
      blocked: false,
    }),
  );
  await mod.getByRole("button", { name: "Review & pause member" }).click();
  await mod.waitForURL("**/moderation?updated=1");
  check(
    "Moderators can pause reported community access",
    (await b.request.get("/api/community/profile")).status() === 403,
  );
  check(
    "A community pause does not remove private saved access",
    (await b.request.get("/api/me/saved")).ok(),
  );
  await mod.getByRole("button", { name: "Restore community access" }).click();
  await mod.getByText("No members are paused.", { exact: true }).waitFor();
  check(
    "Moderators can restore access",
    (await b.request.get("/api/community/profile")).ok(),
  );
  await json(
    await post(a, "/api/me/saved", { id: "aa-newton-zoom", saved: true }),
  );
  await json(
    await post(a, "/api/me/collections", {
      action: "create",
      name: "Meetings to try",
    }),
  );
  const list = (await json(await a.request.get("/api/me/collections")))
    .collections[0];
  await json(
    await post(a, "/api/me/collections", {
      action: "assign",
      resourceId: "aa-newton-zoom",
      collectionId: list.id,
    }),
  );
  check(
    "Saved resources can be organized into a private list",
    (await json(await a.request.get("/api/me/collections"))).items[0]
      .collectionId === list.id,
  );
  await json(
    await post(b, "/api/me/saved", { id: "aa-newton-zoom", saved: true }),
  );
  check(
    "Other accounts cannot assign resources to a private list",
    (
      await post(b, "/api/me/collections", {
        action: "assign",
        resourceId: "aa-newton-zoom",
        collectionId: list.id,
      })
    ).status() === 404,
  );
  const calendar = await post(a, "/api/saved/export", {
      ids: ["aa-newton-zoom"],
      format: "ics",
      nextOnly: true,
      duration: 90,
      reminder: true,
    }),
    ics = await calendar.text();
  check(
    "Calendar downloads include opt-in reminders and no weekly rule for one occurrence",
    calendar.ok() &&
      ics.includes("BEGIN:VALARM") &&
      !ics.includes("RRULE:FREQ=WEEKLY") &&
      ics.includes("TZID:America/New_York"),
  );
  check(
    "Unapproved organizations cannot change listings",
    (
      await post(c, "/api/quality", {
        action: "propose",
        resourceId: "aa-newton-zoom",
        changes: { phone: "", hours: "", intake: "", availability: "" },
        sourceUrl: "https://example.org/",
        reason: "Temporary test proposal",
      })
    ).status() === 403,
  );
  const p = await a.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("/community");
  await p.getByLabel("Display name", { exact: true }).waitFor();
  await p.getByRole("button", { name: /Messages/ }).click();
  await p.getByRole("button", { name: /Test member b/ }).click();
  await p.getByText(body, { exact: true }).waitFor();
  await p
    .getByLabel("Message", { exact: true })
    .fill("A message sent through the browser.");
  await p.getByRole("button", { name: "Send message", exact: true }).click();
  await p
    .getByText("A message sent through the browser.", { exact: true })
    .waitFor();
  check("Browser messaging works end to end", true);
  const axes = [];
  for (const path of ["/community", "/saved", "/support", "/"]) {
    await p.goto(path);
    await p.locator("main h1").waitFor();
    if (path === "/") await p.locator(".resource-card").first().waitFor();
    if (path === "/community")
      await p.getByLabel("Display name", { exact: true }).waitFor();
    const audit = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    axes.push({ path, violations: audit.violations });
  }
  await writeFile(
    ".local/community/accessibility.json",
    JSON.stringify(axes, null, 2),
  );
  check(
    "Directory, community, saved lists and support pages pass automated accessibility checks",
    axes.every((x) => !x.violations.length),
  );
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto("/community");
  await p.getByLabel("Display name", { exact: true }).waitFor();
  check(
    "Community fits a narrow screen",
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await p.screenshot({
    path: ".local/community/community-mobile.png",
    fullPage: true,
  });
  await p.goto("/saved");
  await p.getByRole("combobox", { name: /^Show list/ }).waitFor();
  await p.getByText("Keep an optional offline copy", { exact: true }).click();
  await p.getByRole("button", { name: "Save these resources offline" }).click();
  await p.getByText(/Offline copy saved/).waitFor();
  await p.goto("/offline");
  await p.getByRole("heading", { name: "Your offline resources" }).waitFor();
  check(
    "Offline snapshot contains selected public resources",
    (await p.locator("article").count()) === 1,
  );
  await p.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await p.context().setOffline(true);
  await p.reload();
  await p.getByRole("heading", { name: "Your offline resources" }).waitFor();
  check(
    "Opt-in saved copy opens without a connection",
    (await p.locator("article").count()) === 1,
  );
  await p.context().setOffline(false);
  check("No browser runtime errors", errors.length === 0);
  await writeFile(
    ".local/community/checks.json",
    JSON.stringify({ checks, passed: checks.length }, null, 2),
  );
} finally {
  const ids = users.map((u) => u.id);
  if (ids.length) {
    await sql`DELETE FROM atlas_community_report WHERE reporter_id=ANY(${ids}::text[]) OR subject_id=ANY(${ids}::text[])`;
    for (let i = 0; i < users.length; i++)
      await post(contexts[i], "/api/auth/delete-user", {
        password: users[i].password,
      });
    const remains =
      await sql`SELECT id FROM atlas_user WHERE id=ANY(${ids}::text[])`;
    if (remains.length)
      await writeFile(".local/community/cleanup.json", JSON.stringify(users));
    else console.log("Temporary accounts and their conversations removed.");
  }
  for (const c of contexts) await c.close();
  await browser.close();
}
