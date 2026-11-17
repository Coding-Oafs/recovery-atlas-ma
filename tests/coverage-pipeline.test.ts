import { test } from "node:test";
import assert from "node:assert/strict";
import { readWeeklyCalendar } from "../src/lib/smart-calendar";
import {
  normalizeNationalProvider,
  clinicalTaxonomy,
} from "../src/lib/provider-import";
import { CsvStream } from "../src/lib/nppes-stream";
import { parsePublisherMeetings } from "../src/lib/publisher-csv";
import { censusBatchCsv, readCensusMatches } from "../src/lib/census-batch";
import {
  acceptableCapture,
  retryHours,
  sameFacts,
  sourceFacts,
  mergeSourceFacts,
} from "../src/lib/source-pipeline-core";
import {
  defaultFilters,
  filterResources,
  nextMeeting,
} from "../src/lib/search";
import { savedCalendar } from "../src/lib/saved-export";
import raw from "../data/resources.json";
import { resourceSchema } from "../src/lib/types";
const fixture = resourceSchema.parse(raw.find((r) => r.meeting)!);
const calendar = (rule = "FREQ=WEEKLY;BYDAY=TU;UNTIL=20261202T010000Z") =>
  `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART;TZID=America/New_York:20261124T080000\r\nDTEND;TZID=America/New_York:20261124T090000\r\nRRULE:${rule}\r\nEXDATE;TZID=America/New_York:20261124T080000\r\nDESCRIPTION:private access details\r\nEND:VEVENT\r\nEND:VCALENDAR`;
test("SMART calendars preserve wall time, local date bounds and cancellations without access credentials", () => {
  const s = readWeeklyCalendar(calendar())!;
  assert.equal(s.time, "08:00");
  assert.equal(s.timezone, "America/New_York");
  assert.equal(s.duration, 60);
  assert.equal(s.endsOn, "2026-12-01");
  assert.equal(s.exceptions[0].date, "2026-11-24");
  assert.ok(!JSON.stringify(s).includes("private"));
  const r = { ...fixture, meeting: { ...fixture.meeting!, ...s } };
  assert.equal(
    nextMeeting(r, new Date("2026-11-17T00:00:00Z"))?.toISOString(),
    "2026-12-01T13:00:00.000Z",
  );
  assert.equal(nextMeeting(r, new Date("2026-12-02T00:00:00Z")), null);
  assert.match(
    savedCalendar([r], new Date("2026-11-17T00:00:00Z")),
    /UNTIL=20261202T045959Z/,
  );
});
test("unsupported or ambiguous recurring calendars are held", () => {
  for (const rule of [
    "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU",
    "FREQ=MONTHLY;BYDAY=TU",
    "FREQ=WEEKLY;COUNT=5",
    "FREQ=WEEKLY;BYSETPOS=1;BYDAY=TU",
  ])
    assert.equal(readWeeklyCalendar(calendar(rule)), null);
  assert.equal(
    readWeeklyCalendar(calendar().replace("America/New_York", "Not/AZone")),
    null,
  );
});
test("provider imports separate public practice facts from clinical access claims", () => {
  const base = {
    npi: "1234567890",
    entity: "1",
    organization: "",
    first: "Example",
    last: "Clinician",
    address: "123 Main Street",
    city: "Boston",
    state: "MA",
    postal: "02118",
    taxonomies: [{ code: "101YM0800X", label: "Mental Health Counselor" }],
  };
  const r = normalizeNationalProvider(base, "2026-11-17")!;
  assert.ok(r);
  assert.deepEqual(r.formats, []);
  assert.deepEqual(r.payment, []);
  assert.equal(r.verifiedAt, null);
  assert.equal(r.coordinateAccuracy, "approximate");
  assert.ok(r.sourceUrl.endsWith(base.npi));
  assert.notEqual(
    normalizeNationalProvider(
      { ...base, siteKey: "abcdef123456" },
      "2026-11-17",
    )!.id,
    r.id,
  );
  assert.equal(
    clinicalTaxonomy({ code: "106S00000X", label: "Behavior Technician" }),
    false,
  );
  assert.equal(
    clinicalTaxonomy({ code: "2084N0400X", label: "Neurology Physician" }),
    false,
  );
  assert.equal(
    normalizeNationalProvider({ ...base, state: "ON" }, "2026-11-17"),
    null,
  );
  assert.equal(
    filterResources([r], { ...defaultFilters, format: "in-person" }).length,
    0,
  );
  assert.equal(
    filterResources([r], {
      ...defaultFilters,
      format: "in-person",
      uncertainOnly: true,
    }).length,
    1,
  );
});
test("streaming NPPES CSV handles doubled quotes and line endings across any chunk boundary", () => {
  const rows: string[][] = [];
  const parser = new CsvStream((r) => rows.push(r));
  const text = 'NPI,Name,City\r\n123,"A ""Quoted""\r\nName",Boston\r\n';
  for (const c of text) parser.push(c);
  parser.push("", true);
  assert.deepEqual(rows, [
    ["NPI", "Name", "City"],
    ["123", 'A "Quoted"\r\nName', "Boston"],
  ]);
});
test("public district CSV schedules retain place and attendance facts", () => {
  const [r] = parsePublisherMeetings(
    'Day,Time,Name,Address,City,State,Zip,Types,Id\r\nTuesday,7:30 PM,Example Group,123 Main Street,Charleston,WV,25301,"Open, Wheelchair Access",group1',
    "WV",
  );
  assert.equal(r.time, "19:30");
  assert.equal(r.day, 2);
  assert.match(r.formatted_address, /Charleston, WV 25301/);
  assert.ok(r.types.includes("X"));
  assert.equal(r.slug, "group1");
});
test("Census batches reject cross-state matches and distinguish no matches", () => {
  const addresses = [
    {
      address_key: "one",
      address: "123 Main Street",
      city: "Boston",
      state: "MA",
      zip: "02118",
    },
    {
      address_key: "two",
      address: "100 Road",
      city: "Boston",
      state: "MA",
      zip: "02118",
    },
  ];
  assert.match(censusBatchCsv(addresses), /"one","123 Main Street"/);
  const matches = readCensusMatches(
    '"one","input","Match","Exact","123 MAIN ST, BOSTON, MA, 02118","-71.1,42.3","1","L","25","025","1","1"\n"two","input","Match","Exact","100 ROAD, SOMEWHERE, NH, 03000","-71.1,42.3","1","L","33","001","1","1"',
    addresses,
  );
  assert.equal(matches[0].status, "matched");
  assert.equal(matches[0].county_fips, "25025");
  assert.equal(matches[1].status, "unmatched");
  assert.equal(matches[1].lat, null);
});
test("source baselines ignore geocoding, compare JSONB key order and preserve local evidence", () => {
  const fresh = structuredClone(fixture);
  fresh.meeting!.time = "20:30";
  const geocoded = {
    ...fixture,
    lat: 42.4,
    lng: -71.2,
    coordinateAccuracy: "address" as const,
  };
  assert.ok(sameFacts(sourceFacts(fixture), sourceFacts(geocoded)));
  assert.ok(sameFacts({ a: 1, b: 2 }, { b: 2, a: 1 }));
  const merged = mergeSourceFacts(geocoded, fresh);
  assert.equal(merged.lat, 42.4);
  assert.equal(merged.meeting!.time, "20:30");
  assert.equal(merged.verifiedAt, geocoded.verifiedAt);
  assert.ok(!acceptableCapture(100, 20, 100));
  assert.ok(acceptableCapture(100, 90, 100));
  assert.ok(retryHours(8) <= 168);
});
test("county filters keep global online access while separating physical counties", () => {
  const physical = {
      ...fixture,
      countyFips: "06085",
      formats: ["in-person" as const],
    },
    online = {
      ...fixture,
      id: "global-example",
      state: "US",
      countyFips: undefined,
      lat: null,
      lng: null,
      coordinateAccuracy: "unavailable" as const,
      formats: ["online" as const],
    };
  assert.equal(
    filterResources([physical, online], {
      ...defaultFilters,
      countyFips: "06001",
    }).length,
    1,
  );
  assert.equal(
    filterResources([physical, online], {
      ...defaultFilters,
      countyFips: "06085",
    }).length,
    2,
  );
});
