import { chromium } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const env = await readFile(".env.local", "utf8");
const password = env.match(/^ADMIN_PASSWORD=(.+)$/m)?.[1]?.trim();
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:4118";
await mkdir(".local/screenshots", { recursive: true });
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const context = await browser.newContext({
  baseURL: base,
  viewport: { width: 1440, height: 1050 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
const check = (name, ok) => {
  if (!ok) throw Error(name);
  results.push(name);
};
try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("heading", { name: "Your next step starts here." })
    .waitFor();
  check("Directory renders", true);
  await page
    .locator('.map-wrap[data-ready="true"]')
    .waitFor({ timeout: 20000 });
  check(
    "Map worker and style load",
    (await page.locator(".map-failure").count()) === 0,
  );
  await page.screenshot({
    path: ".local/screenshots/desktop.png",
    fullPage: true,
  });
  const count = await page.locator(".resource-card").count();
  check("Database resources visible", count > 0);
  await page
    .getByRole("textbox", { name: "Search keywords" })
    .fill("Worcester detox");
  await page.waitForTimeout(400);
  check(
    "Keyword filtering",
    (await page.locator(".resource-card").count()) === 1,
  );
  await page.getByRole("button", { name: "View details" }).first().click();
  await page
    .getByRole("heading", { name: "AdCare Hospital — Medical Detox" })
    .waitFor();
  check(
    "Treatment popup details",
    (await page.getByText("Facility-reported", { exact: true }).count()) > 0,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Massachusetts city, ZIP or address" })
    .fill("02118");
  await page.getByRole("button", { name: "Find support" }).click();
  await page.locator(".location-status").waitFor();
  check(
    "ZIP lookup and radius flow",
    await page
      .locator(".location-status")
      .innerText()
      .then((s) => s.includes("Boston")),
  );
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.getByRole("button", { name: "Meetings", exact: true }).click();
  await page.getByLabel("Attendance format").selectOption("online");
  await page.waitForTimeout(300);
  check(
    "Online and hybrid meeting results",
    (await page.locator(".resource-card").count()) >= 4,
  );
  await page.locator(".save-button").first().click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  check(
    "Saved resources persist locally",
    await page
      .locator(".saved-nav")
      .innerText()
      .then((s) => s.includes("1")),
  );
  await page
    .getByRole("button", { name: "Talk to someone who can help" })
    .click();
  check(
    "Help now resources",
    (await page
      .getByRole("link", { name: /Massachusetts Substance Use Helpline/ })
      .count()) === 1,
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  const unauthorized = await page.request.get("/admin/export");
  check("Admin export requires authentication", unauthorized.status() === 401);
  const cron = await page.request.get("/api/maintenance");
  check(
    "Maintenance endpoint rejects unauthorized access",
    cron.status() === 401,
  );
  const invalid = await page.request.post("/api/location", {
    headers: { Origin: "https://attacker.invalid" },
    data: { query: "Boston" },
  });
  check(
    "Location endpoint rejects cross-origin requests",
    invalid.status() === 403,
  );
  await page.goto(base + "/admin", {
    waitUntil: "domcontentloaded",
  });
  await page.getByLabel("Administrator password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("heading", { name: "A little care for the directory." })
    .waitFor();
  check("Administrator login and dashboard", true);
  const exported = await page.request.get("/admin/export");
  const data = await exported.json();
  check("Authenticated export returns database records", data.length >= 43);
  await page.screenshot({
    path: ".local/screenshots/admin.png",
    fullPage: true,
  });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mp = await mobile.newPage();
  await mp.goto(base, { waitUntil: "domcontentloaded" });
  await mp.locator(".resource-card").first().waitFor();
  await mp.screenshot({
    path: ".local/screenshots/mobile.png",
    fullPage: true,
  });
  check(
    "Mobile page has no horizontal overflow",
    await mp.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await mp.getByRole("button", { name: "Map", exact: true }).click();
  await mp.locator(".map-panel").waitFor({ state: "visible" });
  check("Mobile map/list toggle", true);
  check("No browser JavaScript errors", errors.length === 0);
  await writeFile(
    ".local/browser-check.json",
    JSON.stringify({ results, errors }, null, 2),
  );
  console.log(
    JSON.stringify({ passed: results.length, results, errors }, null, 2),
  );
} finally {
  await browser.close();
}
