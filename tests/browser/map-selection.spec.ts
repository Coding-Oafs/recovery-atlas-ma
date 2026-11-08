import { test, expect } from "@playwright/test";
import raw from "../../data/resources.json";
import { filterResources, defaultFilters } from "../../src/lib/search";
import { resourceSchema } from "../../src/lib/types";
const resources = raw.map((r) => resourceSchema.parse(r));
const physical = resources.find((r) => r.lat !== null && r.lng !== null)!;
const online = resources.find(
  (r) =>
    r.kind === "meeting" &&
    r.formats.includes("online") &&
    !r.formats.includes("hybrid"),
)!;

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/**", (route) => route.fulfill({ json: null }));
  await page.route("**/api/facets", (route) => route.fulfill({ json: {} }));
  // A local blank style exercises the real WebGL map without vendor requests.
  await page.route("https://tiles.openfreemap.org/**", (route) =>
    route.fulfill({
      json: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#e8ede1" },
          },
        ],
      },
    }),
  );
  // Selected pins must survive even if the viewport's clustered response is empty.
  await page.route("**/api/map", (route) =>
    route.fulfill({ json: { pins: [], represented: 0 } }),
  );
});
async function expectLocation(
  page: import("@playwright/test").Page,
  resource = physical,
) {
  const map = page.locator(".map-wrap");
  await expect(map).toHaveAttribute("data-ready", "true");
  await expect(map).toHaveAttribute("data-selected-resource", resource.id);
  await expect
    .poll(async () => Number(await map.getAttribute("data-center-lng")))
    .toBeCloseTo(resource.lng!, 3);
  await expect
    .poll(async () => Number(await map.getAttribute("data-center-lat")))
    .toBeCloseTo(resource.lat!, 3);
  await expect
    .poll(async () => Number(await map.getAttribute("data-zoom")))
    .toBeGreaterThanOrEqual(
      resource.coordinateAccuracy === "approximate" ? 11.99 : 14.99,
    );
  await expect(page.locator(".map-selection")).toContainText(resource.name);
}

test("opening a listing automatically centers and highlights it, and online meetings clear the pin", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Search keywords" })
    .fill(physical.name);
  await page
    .locator(`[data-resource-id="${physical.id}"]`)
    .getByRole("button", { name: "View details" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // Desktop map centers immediately, while the details dialog remains open.
  if (!isMobile) await expectLocation(page);
  await page.getByRole("button", { name: "Show on map", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#resource-map")).toBeVisible();
  await expectLocation(page);
  await expect(
    page.getByRole("button", { name: "Search this area", exact: true }),
  ).toHaveCount(0);
  // Moving away from the list or refreshing viewport pins cannot remove selection.
  await page.mouse.move(1, 1);
  await expect(page.locator(".map-wrap")).toHaveAttribute(
    "data-selected-resource",
    physical.id,
  );
  if (isMobile)
    await page.getByRole("button", { name: "List", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search keywords" })
    .fill(online.name);
  await page
    .locator(`[data-resource-id="${online.id}"]`)
    .getByRole("button", { name: "View details" })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show on map", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  if (isMobile)
    await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.locator(".map-wrap")).toHaveAttribute(
    "data-selected-resource",
    "",
  );
  await expect(page.locator(".map-selection")).toContainText(
    "Online meeting · no physical map location",
  );
});

test("a shared listing outside the current page is still centered and marked", async ({
  page,
}) => {
  const target = filterResources(resources, defaultFilters)
    .slice(20)
    .find((r) => r.lat !== null && r.lng !== null)!;
  await page.goto(`/?resource=${target.id}`);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(`[data-resource-id="${target.id}"]`)).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Show on map", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectLocation(page, target);
  await page
    .getByRole("button", { name: "Clear selected map resource", exact: true })
    .click();
  await expect(page.locator(".map-wrap")).toHaveAttribute(
    "data-selected-resource",
    "",
  );
  await expect(page.locator(".map-selection")).toHaveCount(0);
});
