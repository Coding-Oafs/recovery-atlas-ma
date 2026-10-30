import { chromium } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.TEST_BASE_URL ?? "http://localhost:4121",
  browser = await chromium.launch({
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  }),
  checks = [];
const check = (name, ok) => {
  if (!ok) throw Error(name);
  checks.push(name);
  console.log("Verified:", name);
};
const username = "test_" + randomBytes(7).toString("hex"),
  password = randomBytes(24).toString("base64url"),
  second = "other_" + randomBytes(7).toString("hex"),
  replacement = randomBytes(24).toString("base64url");
const contexts = [];
const context = async () => {
  const c = await browser.newContext({
    baseURL: base,
    viewport: { width: 1440, height: 1050 },
  });
  contexts.push(c);
  return c;
};
async function post(c, path, body, origin = base) {
  return c.request.post(path, { headers: { Origin: origin }, data: body });
}
async function signIn(c, name, pwd) {
  const r = await post(c, "/api/auth/sign-in/username", {
    username: name,
    password: pwd,
  });
  check("Sign-in succeeds", r.ok());
}
try {
  const guest = await context(),
    p = await guest.newPage();
  await p.goto("/");
  await p.locator(".resource-card").first().waitFor();
  await p.locator(".save-button").first().click();
  await p.getByRole("button", { name: /^Saved/ }).click();
  await p.getByRole("region", { name: "Saved resource options" }).waitFor();
  const download = p.waitForEvent("download");
  await p
    .getByRole("button", { name: "Spreadsheet (CSV)", exact: true })
    .click();
  const file = await download;
  check(
    "Guest saved list downloads as CSV",
    file.suggestedFilename().endsWith(".csv"),
  );
  const local = await p.evaluate(() =>
    JSON.parse(localStorage.getItem("atlas:saved:v1")),
  );
  check("Guest saves remain local", local.length === 1);
  const guestJson = await post(guest, "/api/saved/export", {
    ids: local,
    format: "json",
  });
  check(
    "Guest export includes full saved details",
    guestJson.ok() && (await guestJson.json()).resources[0].id === local[0],
  );
  const unauth = await guest.request.get("/api/me/saved");
  check("Account saves require authentication", unauth.status() === 401);
  const cross = await post(
    guest,
    "/api/auth/sign-up/email",
    { username, password },
    "https://attacker.invalid",
  );
  check(
    "Account creation rejects cross-origin requests",
    cross.status() === 403,
  );
  await p.goto("/account");
  await p.getByRole("button", { name: "Create account", exact: true }).click();
  await p.getByLabel("Username", { exact: true }).fill(username);
  await p.getByLabel("Password", { exact: true }).fill(password);
  await p.getByRole("button", { name: "Create my private account" }).click();
  await p
    .getByText("Signed in as", { exact: false })
    .waitFor({ timeout: 30000 });
  await p.getByLabel("Your recovery code").waitFor({ timeout: 20000 });
  const recovery = await p.getByLabel("Your recovery code").innerText();
  check(
    "Account created with a one-time recovery code",
    /^[a-f0-9-]{53}$/.test(recovery),
  );
  check(
    "Guest resources are not silently imported",
    (await (await guest.request.get("/api/me/saved")).json()).ids.length === 0,
  );
  await p
    .getByRole("button", { name: "Copy browser saves to account" })
    .click();
  await p
    .getByText("Browser saves copied to your account.", { exact: false })
    .waitFor();
  check(
    "Explicit import preserves guest resource",
    (await (await guest.request.get("/api/me/saved")).json()).ids.includes(
      local[0],
    ),
  );
  const device = await context();
  await signIn(device, username, password);
  check(
    "Second device sees saved resource",
    (await (await device.request.get("/api/me/saved")).json()).ids.includes(
      local[0],
    ),
  );
  const b = await context(),
    signup = await post(b, "/api/auth/sign-up/email", {
      username: second,
      password,
    });
  check("Separate account can register", signup.ok());
  const bId = (await (await b.request.get("/api/auth/get-session")).json()).user
    .id;
  const attempt = await post(b, "/api/me/saved", {
    id: "aa-newton-zoom",
    saved: true,
    userId: (await (await guest.request.get("/api/auth/get-session")).json())
      .user.id,
  });
  check(
    "Client userId cannot choose another account",
    attempt.ok() &&
      !(await (await guest.request.get("/api/me/saved")).json()).ids.includes(
        "aa-newton-zoom",
      ) &&
      (await (await b.request.get("/api/me/saved")).json()).ids.includes(
        "aa-newton-zoom",
      ),
  );
  const malicious = await post(
    device,
    "/api/me/saved",
    { id: "aa-newton-zoom", saved: true },
    "https://attacker.invalid",
  );
  check(
    "Private saves reject cross-origin requests",
    malicious.status() === 403,
  );
  const unknown = await post(device, "/api/me/saved", {
    id: "not-a-real-resource",
    saved: true,
  });
  check("Unpublished or missing IDs cannot be saved", unknown.status() === 400);
  const privateResponse = await device.request.get("/api/me/saved");
  check(
    "Private responses are not cacheable",
    privateResponse.headers()["cache-control"].includes("no-store"),
  );
  const cdp = await guest.newCDPSession(p);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  await p.getByRole("button", { name: "Add a passkey", exact: true }).click();
  await p
    .getByText("Passkey added.", { exact: false })
    .waitFor({ timeout: 30000 });
  const credentials = await cdp.send("WebAuthn.getCredentials", {
    authenticatorId,
  });
  check("Passkey registration succeeds", credentials.credentials.length === 1);
  await p.getByRole("button", { name: "Sign out", exact: true }).click();
  await p
    .getByRole("button", { name: "Sign in with a passkey", exact: true })
    .waitFor();
  await p
    .getByRole("button", { name: "Sign in with a passkey", exact: true })
    .click();
  await p
    .getByText("Signed in as", { exact: false })
    .waitFor({ timeout: 30000 });
  check("Passkey sign-in restores account access", true);
  const recovered = await post(b, "/api/me/recovery", {
    username,
    code: recovery,
    password: replacement,
  });
  check("Recovery code resets the correct account", recovered.ok());
  check(
    "Recovery revokes other device sessions",
    (await device.request.get("/api/me/saved")).status() === 401,
  );
  check(
    "Recovery code cannot be reused",
    (
      await post(b, "/api/me/recovery", { username, code: recovery, password })
    ).status() === 400,
  );
  await signIn(device, username, replacement);
  check(
    "Recovery removes old passkeys",
    (
      await (
        await device.request.get("/api/auth/passkey/list-user-passkeys")
      ).json()
    ).length === 0,
  );
  check(
    "Recovery preserves saved resources",
    (await (await device.request.get("/api/me/saved")).json()).ids.includes(
      local[0],
    ),
  );
  const calendar = await post(b, "/api/saved/export", {
    ids: ["aa-newton-zoom", "mclean-hospital-belmont"],
    format: "ics",
  });
  check(
    "Meeting calendar excludes nonmeeting resources",
    calendar.ok() &&
      ((await calendar.text()).match(/BEGIN:VEVENT/g) ?? []).length === 1,
  );
  const print = await b.request.post("/api/saved/export?format=print", {
    headers: { Origin: base },
    form: { ids: JSON.stringify(["aa-newton-zoom"]) },
  });
  check(
    "Printable PDF source is served privately",
    print.ok() &&
      print.headers()["content-type"].startsWith("text/html") &&
      print.headers()["content-security-policy"].includes("default-src 'none'"),
  );
  const mobile = await browser.newContext({
    baseURL: base,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  contexts.push(mobile);
  const mp = await mobile.newPage();
  await mp.goto("/account");
  await mp
    .getByRole("button", { name: "Create account", exact: true })
    .waitFor();
  check(
    "Mobile account page has no horizontal overflow",
    await mp.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await mkdir(".local/screenshots", { recursive: true });
  await mp.screenshot({
    path: ".local/screenshots/account-mobile.png",
    fullPage: true,
  });
  await p.goto("/");
  await p.getByRole("button", { name: /^Saved/ }).click();
  await p.getByRole("region", { name: "Saved resource options" }).waitFor();
  await p.screenshot({
    path: ".local/screenshots/saved-desktop.png",
    fullPage: true,
  });
  const printPopup = p.waitForEvent("popup");
  await p
    .getByRole("button", { name: "Print / Save PDF", exact: true })
    .click();
  const printPage = await printPopup;
  await printPage
    .getByRole("button", { name: "Print / Save as PDF", exact: true })
    .waitFor();
  await printPage.evaluate(() => {
    window.print = () => {
      document.body.dataset.printed = "true";
    };
  });
  await printPage
    .getByRole("button", { name: "Print / Save as PDF", exact: true })
    .click();
  check(
    "Actual browser print/PDF form and print action work",
    !!(await printPage.locator("body").getAttribute("data-printed")),
  );
  await printPage.close();
  const del = await post(device, "/api/auth/delete-user", {
    password: replacement,
  });
  check("Account owner can delete their account", del.ok());
  check(
    "Deleted account session cannot access saves",
    (await device.request.get("/api/me/saved")).status() === 401,
  );
  await post(b, "/api/auth/delete-user", { password });
  await writeFile(
    ".local/accounts/checks.json",
    JSON.stringify({ checks, username, other: second }, null, 2),
  );
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} catch (e) {
  console.error("Account test failed:", e.message);
  await writeFile(
    ".local/accounts/cleanup.json",
    JSON.stringify({ username, password, second, replacement }),
  );
  throw e;
} finally {
  for (const c of contexts) await c.close();
  await browser.close();
}
