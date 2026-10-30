import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { resourceSchema } from "../src/lib/types";
import { nextMeeting } from "../src/lib/search";
import { localDate } from "../src/lib/meeting-time";
const base = process.env.TEST_BASE_URL || "http://localhost:4122",
  browser = await chromium.launch({
    executablePath:
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  }),
  context = await browser.newContext({
    baseURL: base,
    timezoneId: "UTC",
    viewport: { width: 1440, height: 1050 },
  }),
  page = await context.newPage();
try {
  const resource = resourceSchema.parse(
      await (await context.request.get("/api/resources/aa-newton-zoom")).json(),
    ),
    target = nextMeeting(resource, new Date(Date.now() + 45 * 86400000))!,
    date = localDate(target, "UTC");
  await page.goto("/");
  await page.locator(".resource-card").first().waitFor();
  await page
    .getByRole("textbox", { name: "Search keywords" })
    .fill(resource.name);
  await page.getByRole("button", { name: /More filters/ }).click();
  await page
    .getByLabel("Meeting date window", { exact: true })
    .selectOption("date");
  await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/search") &&
        r.request().postDataJSON()?.filters.meetingDate === date,
    ),
    page.getByLabel("Meeting date", { exact: true }).fill(date),
  ]);
  await page
    .locator(".resource-card")
    .filter({ hasText: resource.name })
    .getByRole("button", { name: "View details" })
    .click();
  await page.getByText("Add to your calendar", { exact: true }).click();
  for (const label of [
    "Google Calendar",
    "Outlook.com",
    "Microsoft 365",
    "Yahoo Calendar",
  ])
    assert.ok(
      await page
        .getByRole("link", { name: label, exact: true })
        .getAttribute("href"),
    );
  const google = new URL(
    (await page
      .getByRole("link", { name: "Google Calendar", exact: true })
      .getAttribute("href"))!,
  );
  assert.equal(
    google.searchParams.get("dates")!.split("/")[0],
    target
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z/, "Z"),
  );
  await page
    .getByLabel("Include a 10-minute reminder in calendar downloads", {
      exact: true,
    })
    .check();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Apple / Other calendars (.ics)",
      exact: true,
    })
    .click();
  const download = await downloadEvent,
    ics = await readFile((await download.path())!, "utf8");
  assert.ok(ics.includes("BEGIN:VALARM"));
  assert.ok(!ics.includes("RRULE:FREQ=WEEKLY"));
  assert.ok(
    ics.includes(
      localDate(target, resource.meeting!.timezone).replace(/-/g, "") +
        "T" +
        resource.meeting!.time.replace(":", "") +
        "00",
    ),
  );
  console.log(
    "Verified: all calendar-provider links, future-date matching and a real ICS download with reminders.",
  );
} finally {
  await context.close();
  await browser.close();
}
