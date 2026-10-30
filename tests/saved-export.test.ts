import { test } from "node:test";
import assert from "node:assert/strict";
import {
  csvCell,
  foldICS,
  savedCalendar,
  savedCSV,
  savedPrint,
} from "../src/lib/saved-export";
import { resourceSchema } from "../src/lib/types";
import data from "../data/resources.json";
const rows = data.map((r) => resourceSchema.parse(r)),
  meeting = rows.find((r) => r.meeting)!;
test("spreadsheet exports quote fields and neutralize formula injection", () => {
  for (const value of [
    "=SUM(A1:A2)",
    "+cmd",
    "-42",
    "@test",
    ' \t=HYPERLINK("bad")',
    "\rnew row",
  ])
    assert.ok(csvCell(value).startsWith("\"'"));
  assert.equal(csvCell('one,"two"'), '"one,""two"""');
  const csv = savedCSV([meeting]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes(meeting.sourceUrl));
  assert.ok(csv.includes("sourceReviewed"));
});
test("calendars preserve Eastern recurrence across DST and omit non-meetings", () => {
  const m = {
    ...meeting,
    meeting: {
      ...meeting.meeting!,
      days: [1, 3],
      time: "19:00",
      duration: null,
    },
  };
  const calendar = savedCalendar(
    [m, rows.find((r) => !r.meeting)!],
    new Date("2026-10-31T12:00:00Z"),
  );
  assert.equal((calendar.match(/BEGIN:VEVENT/g) ?? []).length, 1);
  assert.ok(calendar.includes("TZID:America/New_York"));
  assert.ok(calendar.includes("DTSTART;TZID=America/New_York:20261102T190000"));
  assert.ok(calendar.includes("RRULE:FREQ=WEEKLY;BYDAY=MO,WE"));
  assert.ok(!calendar.includes("DURATION:"));
  assert.ok(calendar.includes("CLASS:PRIVATE"));
  assert.ok(calendar.endsWith("\r\n"));
});
test("UTF-8 calendar folding respects 75 octets and preserves characters", () => {
  const line = "DESCRIPTION:" + "Recovery 🌱 meeting, ".repeat(20),
    folded = foldICS(line);
  for (const part of folded.split("\r\n"))
    assert.ok(Buffer.byteLength(part) <= 75);
  assert.equal(folded.replace(/\r\n /g, ""), line);
});
test("print exports escape source text and include evidence and contact details", () => {
  const r = {
    ...meeting,
    name: "<script>alert(1)</script>",
    description: 'Example <img onerror="evil()">',
  };
  const html = savedPrint([r]);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes(r.sourceCheckedAt));
  assert.ok(html.includes(r.sourceUrl));
});
