import { test, expect } from "@playwright/test";
import seed from "../../data/resources.json";

// Keep the app's offline worker from bypassing mocked API failures in WebKit.
test.use({ serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  // Browser tests are isolated from accounts, map vendors and production data.
  await page.route("**/api/auth/**", (route) => route.fulfill({ json: null }));
  await page.route("**/api/facets", (route) => route.fulfill({ json: {} }));
  await page.route("**/api/map", (route) =>
    route.fulfill({ json: { pins: [], represented: 0 } }),
  );
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.abort(),
  );
});
const cards = (page: import("@playwright/test").Page) =>
  page.locator(".resource-card");
const range = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Resource result pages" });
async function ready(page: import("@playwright/test").Page) {
  await expect
    .poll(() => page.evaluate(() => Boolean(history.state?.atlasDirectory)))
    .toBe(true);
  // Filter recovery is recorded before a response, so a history entry alone
  // no longer means that cards have finished updating.
  await expect(page.locator("#results")).toHaveAttribute("aria-busy", "false");
}

test("view preference persists and duplicate category shortcuts are removed", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  const mode = page.getByLabel("View mode", { exact: true });
  await expect(mode).toHaveValue("standard");
  const standard = await page
    .locator("body")
    .evaluate((body) => getComputedStyle(body).backgroundColor);
  await mode.selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-view-mode", "dark");
  await expect(page.locator("body")).not.toHaveCSS(
    "background-color",
    standard,
  );
  await page.reload();
  await expect(mode).toHaveValue("dark");
  await expect(page.locator("html")).toHaveAttribute("data-view-mode", "dark");
  await mode.selectOption("standard");
  await expect(page.locator("body")).toHaveCSS("background-color", standard);
  await expect(
    page.getByRole("button", { name: "All resources", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Support for daily life", exact: true }),
  ).toBeVisible();
  for (const name of [
    "Find a meeting",
    "Explore treatment",
    "Find a therapist",
  ])
    await expect(
      page.locator(".guided-paths").getByRole("button", { name }),
    ).toHaveCount(0);
});

test("local AA search shows the matching official intergroup link", async ({
  page,
}) => {
  for (const [state, city, name, url] of [
    ["IL", "Chicago", "Chicago Area AA", "https://www.chicagoaa.org/meetings/"],
    [
      "TX",
      "Dallas",
      "Dallas AA Intergroup",
      "https://www.aadallas.org/find-a-meeting/",
    ],
    [
      "FL",
      "Miami",
      "Miami-Dade AA Intergroup",
      "https://aamiamidade.org/meetings",
    ],
  ]) {
    await page.goto("/?" + new URLSearchParams({ state, place: city }));
    await ready(page);
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute(
      "href",
      url,
    );
  }
});

test("pages, refresh, Back/Forward and details preserve the current search", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await ready(page);
  await expect(cards(page)).toHaveCount(20);
  const first = await cards(page).first().getAttribute("data-resource-id");
  await range(page)
    .getByRole("button", { name: "Next resources", exact: true })
    .click();
  await expect(range(page)).toContainText("21–40");
  await expect(page.locator("#results-title")).toBeFocused();
  const second = await cards(page).first().getAttribute("data-resource-id");
  expect(second).not.toBe(first);
  await expect
    .poll(() => page.evaluate(() => history.state?.atlasDirectory?.offset))
    .toBe(20);
  await page.reload();
  await ready(page);
  await expect(range(page)).toContainText("21–40");
  await expect(cards(page).first()).toHaveAttribute(
    "data-resource-id",
    second!,
  );
  await page.goBack();
  await expect(range(page)).toContainText("1–20");
  await page.goForward();
  await expect(range(page)).toContainText("21–40");
  const target = cards(page).nth(3);
  const id = await target.getAttribute("data-resource-id");
  await target.getByRole("button", { name: /View details/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`resource=${id}`));
  await expect(
    page.getByRole("button", { name: "Copy listing link" }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(range(page)).toContainText("21–40");
  await expect(target.locator(".card-open")).toBeFocused();
  await target.getByRole("button", { name: /View details/ }).click();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(range(page)).toContainText("21–40");
  expect(errors).toEqual([]);
});

test("filters survive refresh without putting search terms in the URL", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await page.getByRole("textbox", { name: "Search keywords" }).fill("Boston");
  await expect
    .poll(() =>
      page.evaluate(() => history.state?.atlasDirectory?.filters.query),
    )
    .toBe("Boston");
  expect(new URL(page.url()).search).toBe("");
  const ids = await cards(page).evaluateAll((rows) =>
    rows.map((r) => r.getAttribute("data-resource-id")),
  );
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Search keywords" }),
  ).toHaveValue("Boston");
  await expect
    .poll(() =>
      cards(page).evaluateAll((rows) =>
        rows.map((r) => r.getAttribute("data-resource-id")),
      ),
    )
    .toEqual(ids);
  await expect(page.getByLabel("Result priority")).toHaveValue("recovery");
  await page.getByLabel("Result priority").selectOption("all");
  await expect
    .poll(() =>
      page.evaluate(
        () => history.state?.atlasDirectory?.filters.prioritizeRecovery,
      ),
    )
    .toBe(false);
  await page.reload();
  await expect(page.getByLabel("Result priority")).toHaveValue("all");
});

test("filters survive a failed search and refresh before results arrive", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/search", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Temporary search failure" },
    }),
  );
  await page.goto("/");
  await ready(page);
  await page.getByRole("textbox", { name: "Search keywords" }).fill("Boston");
  await page.getByRole("button", { name: /More filters/ }).click();
  await page.getByLabel("State", { exact: true }).selectOption("MA");
  await expect
    .poll(() =>
      page.evaluate(() => history.state?.atlasDirectory?.filters.query),
    )
    .toBe("Boston");
  await expect(page.locator("#results").getByRole("alert")).toContainText(
    "Temporary search failure",
  );
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Search keywords" }),
  ).toHaveValue("Boston");
  await expect(page.getByLabel("State", { exact: true })).toHaveValue("MA");
  await page
    .getByRole("textbox", { name: "Search keywords" })
    .fill("Cambridge");
  // Reload during debounce: preservation cannot depend on a successful response.
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Search keywords" }),
  ).toHaveValue("Cambridge");
  expect(errors).toEqual([]);
});

test("direct listing links open the right resource and expose usable actions", async ({
  page,
}) => {
  const online = seed.find((r) => r.meeting && r.formats.includes("online"))!;
  await page.goto(`/?resource=${online.id}`);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: online.name, exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Copy listing link" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("resource")).toBe(false);
  await page
    .getByRole("textbox", { name: "Search keywords" })
    .fill(online.name);
  const card = cards(page).filter({
    has: page.getByRole("heading", { name: online.name, exact: true }),
  });
  await expect(
    card.getByRole("link", {
      name: online.meeting!.joinUrl ? "Join online" : "Joining details",
      exact: true,
    }),
  ).toHaveAttribute("href", online.meeting!.joinUrl || online.website);
  await expect(card.locator(".source-review")).toContainText("Source reviewed");
  const physical = seed.find((r) => r.phone && r.address && !r.meeting)!;
  await page
    .getByRole("textbox", { name: "Search keywords" })
    .fill(physical.name);
  const physicalCard = cards(page).filter({
    has: page.getByRole("heading", { name: physical.name, exact: true }),
  });
  await expect(
    physicalCard.getByRole("link", { name: "Call", exact: true }),
  ).toHaveAttribute("href", /^tel:/);
  await expect(
    physicalCard.getByRole("link", { name: "Directions", exact: true }),
  ).toHaveAttribute("href", /^https:\/\/www.google.com\/maps\/dir\//);
});

test("results scroll position survives refresh and closing a listing", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await ready(page);
  await cards(page).nth(5).locator(".card-open").scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const s = history.state?.atlasDirectory;
        return Boolean(s && (s.scrollTop > 100 || s.windowY > 100));
      }),
    )
    .toBe(true);
  const before = await page.evaluate(() => ({
    panel: document.getElementById("results")!.scrollTop,
    window: window.scrollY,
  }));
  await page.reload();
  await ready(page);
  await expect
    .poll(() =>
      page.evaluate(
        (mobile) =>
          mobile
            ? window.scrollY
            : document.getElementById("results")!.scrollTop,
        isMobile,
      ),
    )
    .toBeCloseTo(isMobile ? before.window : before.panel, -1);
  await cards(page).nth(5).locator(".card-open").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        (mobile) =>
          mobile
            ? window.scrollY
            : document.getElementById("results")!.scrollTop,
        isMobile,
      ),
    )
    .toBeCloseTo(isMobile ? before.window : before.panel, -1);
});
