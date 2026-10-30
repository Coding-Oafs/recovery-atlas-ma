import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarLinks } from "../src/lib/calendar-links";
import { savedCalendar } from "../src/lib/saved-export";
import { resourceFreshness } from "../src/lib/resource-quality";
import { nextMeeting } from "../src/lib/search";
import { resourceSchema } from "../src/lib/types";
import data from "../data/resources.json";
const source = resourceSchema.parse(data.find((r) => r.meeting));
const meeting = {
  ...source,
  name: "Recovery & community 🌱",
  meeting: {
    ...source.meeting!,
    days: [1],
    time: "19:00",
    duration: null,
    timezone: "Europe/London",
    exceptions: [{ date: "2026-11-02", cancelled: true, note: "Closed" }],
  },
};
const now = new Date("2026-10-31T12:00:00Z");
test("calendar providers agree on the next uncancelled instant in the meeting time zone", () => {
  const links = calendarLinks(meeting, 90, now)!;
  assert.equal(links.start.toISOString(), "2026-11-09T19:00:00.000Z");
  assert.equal(links.end.toISOString(), "2026-11-09T20:30:00.000Z");
  const google = new URL(links.google),
    outlook = new URL(links.outlook),
    microsoft = new URL(links.microsoft),
    yahoo = new URL(links.yahoo);
  assert.equal(google.searchParams.get("text"), meeting.name);
  assert.equal(google.searchParams.get("ctz"), "Europe/London");
  assert.equal(
    google.searchParams.get("dates"),
    "20261109T190000Z/20261109T203000Z",
  );
  assert.equal(outlook.searchParams.get("startdt"), links.start.toISOString());
  assert.equal(microsoft.hostname, "outlook.office.com");
  assert.equal(yahoo.searchParams.get("st"), "20261109T190000Z");
  assert.throws(() => calendarLinks(meeting, 0, now));
});
test("recurring exports include cancellation exclusions and opt-in private reminder text", () => {
  const ics = savedCalendar([meeting], now, { reminder: true }).replace(
    /\r\n /g,
    "",
  );
  assert.ok(ics.includes("TZID:Europe/London"));
  assert.ok(ics.includes("DTSTART;TZID=Europe/London:20261109T190000"));
  assert.ok(ics.includes("EXDATE;TZID=Europe/London:20261102T190000"));
  assert.ok(
    ics.includes("TRIGGER:-PT10M\r\nACTION:DISPLAY\r\nDESCRIPTION:Saved event"),
  );
  assert.ok(!ics.includes("DURATION:"));
  const single = savedCalendar([meeting], now, {
    nextOnly: true,
    duration: 90,
  });
  assert.ok(!single.includes("RRULE:FREQ=WEEKLY"));
  assert.ok(single.includes("DURATION:PT90M"));
  assert.ok(!single.includes("VALARM"));
});
test("calendar scheduling handles non-hour offsets and source evidence excludes future or expired checks", () => {
  const kolkata = {
    ...meeting,
    meeting: { ...meeting.meeting, timezone: "Asia/Kolkata", exceptions: [] },
  };
  assert.equal(
    nextMeeting(kolkata, now)?.toISOString(),
    "2026-11-02T13:30:00.000Z",
  );
  const evidence = [
    {
      field: "contact" as const,
      note: "Source confirmed phone",
      sourceUrl: source.sourceUrl,
      checkedAt: "2026-10-01",
      expiresAt: "2026-11-01",
    },
    {
      field: "contact" as const,
      note: "Older source confirmed phone",
      sourceUrl: source.sourceUrl,
      checkedAt: "2026-09-01",
      expiresAt: "2026-10-01",
    },
    {
      field: "contact" as const,
      note: "Future source confirmed phone",
      sourceUrl: source.sourceUrl,
      checkedAt: "2027-01-01",
      expiresAt: null,
    },
  ];
  assert.equal(
    resourceFreshness({ ...source, evidence }, now).currentEvidence.length,
    1,
  );
  assert.equal(
    resourceSchema.safeParse({ ...source, sourceCheckedAt: "2026-02-30" })
      .success,
    false,
  );
});
