import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [],
  failures = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(e.message));
page.on("requestfailed", (r) =>
  failures.push({ url: r.url().split("?")[0], error: r.failure()?.errorText }),
);
await page.goto(process.env.TEST_BASE_URL ?? "http://127.0.0.1:4118", {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(8000);
await page.screenshot({
  path: ".local/screenshots/map-check.png",
  fullPage: true,
});
console.log(
  JSON.stringify(
    {
      errors,
      failures,
      mapFailed: await page.locator(".map-failure").count(),
      canvas: await page.locator("canvas.maplibregl-canvas").count(),
    },
    null,
    2,
  ),
);
await browser.close();
