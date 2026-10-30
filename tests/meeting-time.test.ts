import { test } from "node:test";
import assert from "node:assert/strict";
import { meetingTimeBounds, matchingStartTime } from "../src/lib/meeting-time";
import {
  nextMeeting,
  defaultFilters,
  filterResources,
} from "../src/lib/search";
import { calendarLinks } from "../src/lib/calendar-links";
import { savedCalendar } from "../src/lib/saved-export";
import { resourceSchema } from "../src/lib/types";
import data from "../data/resources.json";
const source = resourceSchema.parse(data.find((r) => r.meeting));
const daily = {
  ...source,
  meeting: {
    ...source.meeting!,
    days: [0, 1, 2, 3, 4, 5, 6],
    time: "19:00",
    timezone: "America/New_York",
  },
};
test("today and tomorrow respect daylight saving days rather than fixed 24-hour days", () => {
  const now = new Date("2026-10-31T16:00:00Z"),
    b = meetingTimeBounds(
      { meetingWindow: "tomorrow", timeZone: "America/New_York" },
      now,
    );
  assert.equal(b.start.toISOString(), "2026-11-01T04:00:00.000Z");
  assert.equal(b.end?.toISOString(), "2026-11-02T05:00:00.000Z");
  const spring = meetingTimeBounds(
    { meetingWindow: "tomorrow", timeZone: "America/New_York" },
    new Date("2027-03-13T16:00:00Z"),
  );
  assert.equal(spring.end!.getTime() - spring.start.getTime(), 23 * 3600000);
});
test("overnight start-time windows wrap midnight and end boundaries are excluded", () => {
  const f = { startAfter: "22:00", startBefore: "05:00", timeZone: "UTC" };
  assert.equal(matchingStartTime(new Date("2026-11-01T23:00:00Z"), f), true);
  assert.equal(matchingStartTime(new Date("2026-11-01T04:59:00Z"), f), true);
  assert.equal(matchingStartTime(new Date("2026-11-01T05:00:00Z"), f), false);
  assert.equal(matchingStartTime(new Date("2026-11-01T12:00:00Z"), f), false);
});
test("a selected future date and calendar links use the matching occurrence", () => {
  const now = new Date("2026-10-31T16:00:00Z"),
    f = {
      ...defaultFilters,
      meetingWindow: "date" as const,
      meetingDate: "2027-02-01",
      timeZone: "America/New_York",
    };
  assert.equal(
    nextMeeting(daily, now, f)?.toISOString(),
    "2027-02-02T00:00:00.000Z",
  );
  assert.equal(
    calendarLinks(daily, 60, now, f)?.start.toISOString(),
    "2027-02-02T00:00:00.000Z",
  );
  assert.ok(
    savedCalendar([daily], now, { nextOnly: true, timeFilters: f }).includes(
      "DTSTART;TZID=America/New_York:20270201T190000",
    ),
  );
  assert.equal(
    filterResources([daily], { ...f, startBefore: "12:00" }, [], now).length,
    0,
  );
});
test("weekend on Sunday covers the remaining Sunday, while Monday selects the upcoming weekend", () => {
  const sun = meetingTimeBounds(
    { meetingWindow: "weekend", timeZone: "UTC" },
    new Date("2026-11-01T10:00:00Z"),
  );
  assert.equal(sun.end?.toISOString(), "2026-11-02T00:00:00.000Z");
  const mon = meetingTimeBounds(
    { meetingWindow: "weekend", timeZone: "UTC" },
    new Date("2026-11-02T10:00:00Z"),
  );
  assert.equal(mon.start.toISOString(), "2026-11-07T00:00:00.000Z");
  assert.equal(mon.end?.toISOString(), "2026-11-09T00:00:00.000Z");
});
