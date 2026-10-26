import { chromium } from "@playwright/test";
import { writeFile, mkdir } from "node:fs/promises";
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:4120",
  minimum = Number(process.env.MIN_RESOURCE_COUNT ?? 49),
  regional = minimum > 100000;
const filters = {
    query: "",
    category: "all",
    state: "",
    format: "",
    fellowship: "",
    payment: "",
    service: "",
    language: "",
    population: "",
    day: "",
    accessibility: false,
    soon: false,
    radius: 25,
    center: null,
    bounds: null,
    savedOnly: false,
  },
  bounds = [-80.6, 38.8, -66.8, 47.6],
  checks = [];
const check = (name, ok) => {
  if (!ok) throw Error(name);
  checks.push(name);
};
async function post(path, body) {
  const r = await fetch(base + path, {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(path + " " + r.status + " " + data.error);
  return data;
}
const search = (change = {}, saved = [], limit = 20) =>
  post("/api/search", { filters: { ...filters, ...change }, saved, limit });
const map = (change = {}, zoom = 5, view = bounds, saved = []) =>
  post("/api/map", {
    filters: { ...filters, ...change },
    saved,
    bounds: view,
    zoom,
  });
const all = await search(),
  overview = await map();
check("Coverage reaches expected release size", all.total >= minimum);
check(
  "Every mapped record is represented beyond paginated cards",
  all.resources.length === 20 &&
    overview.represented === all.mapped &&
    overview.pins.reduce((n, p) => n + p.count, 0) === all.mapped &&
    all.mapped + all.online_or_unmapped === all.total,
);
const sampleGroups = overview.pins
  .filter((p) => p.count > 1)
  .sort((a, b) => b.count - a.count)
  .slice(0, 3);
for (const group of sampleGroups) {
  const a = await post("/api/map-selection", {
    filters,
    saved: [],
    bounds: group.bounds,
    offset: 0,
  });
  check(
    "Group selection exactly matches count " + group.count,
    a.total === group.count && a.resources.length === Math.min(100, a.total),
  );
  if (a.total > 100) {
    const b = await post("/api/map-selection", {
      filters,
      saved: [],
      bounds: group.bounds,
      offset: 100,
    });
    check(
      "Group pagination has no first-page duplicates",
      !b.resources.some((r) => a.resources.some((x) => r.id === x.id)),
    );
  }
}
const zoomed = await map({}, 10);
check(
  "Zoom does not lose mapped resources",
  zoomed.represented === all.mapped &&
    zoomed.pins.length >= overview.pins.length,
);
for (const state of ["MA", "CT", "ME", "NH", "NJ", "NY", "PA", "RI", "VT"]) {
  const s = await search({ state }),
    m = await map({ state });
  check(
    "State filter and map agree " + state,
    s.resources.every((r) => r.state === state) &&
      m.represented === s.mapped &&
      (!regional || s.total > 100),
  );
}
const last = zoomed.pins.find((p) => p.count === 1),
  detail = await fetch(base + "/api/resources/" + last.id);
check(
  "Individual map details load",
  detail.ok && (await detail.json()).id === last.id,
);
const saved = await search({ savedOnly: true }, [last.id]),
  savedMap = await map({ savedOnly: true }, 5, bounds, [last.id]);
check(
  "Saved filters apply to cards and map",
  saved.total === 1 && savedMap.represented === 1,
);
const online = await search(
  { category: "meetings", format: "online" },
  [],
  100,
);
check(
  "Online-only meetings have no physical pins",
  online.resources
    .filter((r) => !r.formats.includes("hybrid"))
    .every((r) => r.lat === null),
);
const area = { bounds: [-74.2, 40.6, -73.7, 40.95] },
  as = await search(area),
  am = await map(area);
check("Search area and map totals agree", as.mapped === am.represented);
const radius = { center: { lat: 40.75, lng: -73.99 }, radius: 10 },
  rs = await search(radius),
  rm = await map(radius);
check("Radius and map totals agree", rs.mapped === rm.represented);
for (const [query, state] of [
  ["10001", "NY"],
  ["05401", "VT"],
  ["04101", "ME"],
  ["06103", "CT"],
  ["03301", "NH"],
  ["19103", "PA"],
  ["07030", "NJ"],
  ["02903", "RI"],
  ["02118", "MA"],
])
  check(
    "ZIP lookup " + state,
    (await post("/api/location", { query })).state === state,
  );
const invalid = await fetch(base + "/api/map", {
  method: "POST",
  headers: {
    Origin: "https://attacker.invalid",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ filters, saved: [], bounds, zoom: 5 }),
});
check("Map rejects cross-origin requests", invalid.status === 403);
const browser = await chromium.launch({
  executablePath:
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
});
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let latest;
  page.on("response", async (r) => {
    if (r.url().endsWith("/api/map") && r.ok()) {
      try {
        latest = { body: r.request().postDataJSON(), data: await r.json() };
      } catch {}
    }
  });
  const navigation = await page.goto(base, { waitUntil: "domcontentloaded" });
  check(
    "Public page loads without Vercel authentication",
    navigation.status() === 200 && !page.url().includes("vercel.com/login"),
  );
  await page
    .locator('.map-wrap[data-ready="true"]')
    .waitFor({ timeout: 30000 });
  await page.waitForFunction(
    () =>
      Number(
        document.querySelector(".map-wrap")?.getAttribute("data-represented"),
      ) > 0,
    { timeout: 30000 },
  );
  check("Browser map has live grouped resources", true);
  await page
    .getByRole("button", { name: "More filters", exact: false })
    .click();
  await page.getByLabel("State", { exact: true }).selectOption("MA");
  await page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/search") &&
      r.request().postDataJSON()?.filters.state === "MA",
  );
  check("State dropdown searches the backend", true);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Northeast city, state, ZIP or address" })
    .fill("02118");
  await page.getByRole("button", { name: "Find support", exact: true }).click();
  await page.locator(".location-status").waitFor();
  // Project a returned group through the same Web Mercator viewport to exercise real canvas clicks.
  const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  let popup = false;
  for (let i = 0; i < 7; i++) {
    await page.waitForTimeout(1200);
    if (!latest?.data.pins?.length) continue;
    const p = latest.data.pins
      .filter((p) => p.count > 1)
      .sort((a, b) => b.count - a.count)[0];
    if (!p) break;
    const [w, s, e, n] = latest.body.bounds,
      canvas = page.locator("canvas.maplibregl-canvas"),
      box = await canvas.boundingBox();
    const x = ((p.lng - w) / (e - w)) * box.width,
      y = ((merc(n) - merc(p.lat)) / (merc(n) - merc(s))) * box.height;
    const pending = page
      .waitForResponse((r) => r.url().endsWith("/api/map") && r.ok(), {
        timeout: 10000,
      })
      .catch(() => null);
    await canvas.click({ position: { x, y } });
    if (await page.locator(".pin-popup").count()) {
      await page.locator(".pin-choices button").first().click();
      await page.getByRole("heading", { name: "Location & access" }).waitFor();
      popup = true;
      break;
    }
    await pending;
  }
  check("Zoomed shared pin opens a resource detail", popup);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await mkdir(".local/screenshots", { recursive: true });
  await page.screenshot({
    path: ".local/screenshots/northeast-desktop.png",
    fullPage: true,
  });
  check("No browser JavaScript errors", errors.length === 0);
  await writeFile(
    ".local/regional-check.json",
    JSON.stringify(
      {
        base,
        total: all.total,
        mapped: all.mapped,
        groups: overview.pins.length,
        checks,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        total: all.total,
        mapped: all.mapped,
        passed: checks.length,
        checks,
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
