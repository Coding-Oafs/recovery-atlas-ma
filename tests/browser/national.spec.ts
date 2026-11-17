import { test, expect } from "@playwright/test";
import seed from "../../data/resources.json";
import agencies from "../../data/state-help.json";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/**", (r) => r.fulfill({ json: null }));
  await page.route("**/api/map", (r) =>
    r.fulfill({ json: { pins: [], represented: 0 } }),
  );
  await page.route("https://tiles.openfreemap.org/**", (r) => r.abort());
});
test("guided finder applies visible national preferences and help follows the state", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Help me choose", exact: true })
    .click();
  await page.getByLabel("Who are you looking for?").selectOption("other");
  await page.getByLabel("What are you looking for?").selectOption("treatment");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByLabel("State or territory", { exact: true })
    .selectOption("NV");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Show matching resources", exact: true })
    .click();
  await expect(page.getByLabel("State", { exact: true })).toHaveValue("NV");
  await expect(page.locator(".resource-card").first()).toBeVisible();
  await expect(
    page.locator(".resource-card").first().locator(".card-location"),
  ).toContainText(", NV");
  await page
    .getByRole("button", { name: /Talk to someone who can help/ })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: agencies.NV.name }),
  ).toHaveAttribute("href", agencies.NV.url);
});
test("zero-result alternatives display actual counts and preserve chosen geography", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /More filters/ }).click();
  await page.getByLabel("State", { exact: true }).selectOption("CA");
  await page
    .getByRole("textbox", { name: "Search keywords", exact: true })
    .fill("zzzxxyy-no-matches");
  const option = page.getByRole("button", {
    name: /Search without these keywords \([\d,]+\)/,
  });
  await expect(option).toBeVisible();
  await option.click();
  await expect(page.getByLabel("State", { exact: true })).toHaveValue("CA");
  await expect(
    page.getByRole("textbox", { name: "Search keywords", exact: true }),
  ).toHaveValue("");
  await expect(page.locator(".resource-card").first()).toBeVisible();
});
test("meeting details prioritize schedule and newcomers without treatment fields", async ({
  page,
}) => {
  const r = seed.find((r) => r.meeting)!;
  await page.goto("/?resource=" + r.id);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", {
      name: "Meeting schedule & joining",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", {
      name: "Arriving & participating",
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog).not.toContainText("bed availability");
  await expect(dialog).not.toContainText("Referral required");
  await dialog
    .getByText("My optional next-step checklist", { exact: true })
    .click();
  await dialog.getByLabel("Confirm schedule", { exact: true }).check();
  await expect(
    dialog.getByLabel("Confirm schedule", { exact: true }),
  ).toBeChecked();
});
test("shortlist compares two resources and clears its page-memory checklist on refresh", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".resource-card")).toHaveCount(20);
  await page
    .locator(".resource-card")
    .nth(0)
    .getByRole("button", { name: "Compare", exact: true })
    .click();
  await page
    .locator(".resource-card")
    .nth(1)
    .getByRole("button", { name: "Compare", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Compare selected resources", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("table")).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("rowheader", { name: "Insurance & payment", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.reload();
  await expect(page.locator(".comparison-tray")).toHaveCount(0);
});
test("Spanish search, help, details and correction form remain usable after refresh", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Interface language").selectOption("es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByRole("textbox", {
      name: "Palabras clave de búsqueda",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await page
    .locator(".resource-card")
    .first()
    .getByRole("button", { name: "Ver detalles", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "De un vistazo", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Sugerir una corrección", exact: true })
    .click();
  await expect(
    dialog.getByRole("textbox", { name: "¿Qué se debe cambiar?", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Enviar para revisión", exact: true }),
  ).toBeVisible();
});
