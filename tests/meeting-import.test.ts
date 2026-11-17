import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeMeetingGuide,
  normalizeOnlineIntergroup,
  normalizeBmlt,
} from "../src/lib/meeting-import";
import {
  parseCrawlerIndex,
  parseMontana,
  parseGeorgia,
  parseSiouxFalls,
} from "../src/lib/meeting-index";
import {
  defaultFilters,
  filterResources,
  nextMeeting,
} from "../src/lib/search";
import { parseLocationQuery } from "../src/lib/location-search";
const date = "2026-11-17",
  source = {
    id: "aa-santa-clara",
    state: "CA",
    fellowship: "AA",
    page: "https://aasanjose.org/meetings",
  };
const meeting = {
  name: "Example Group",
  slug: "example",
  day: 5,
  time: "10:10",
  end_time: "11:10",
  formatted_address: "670 E Meadow Dr, Palo Alto, CA 94306, USA",
  coordinates: "37.42333,-122.11525",
  types: ["O", "X"],
};
test("Palo Alto feed rows retain distinct identities, mapped addresses and Pacific schedules", () => {
  const a = normalizeMeetingGuide(meeting, source, date)!,
    b = normalizeMeetingGuide(
      { ...meeting, slug: "other-day", day: 3 },
      source,
      date,
    )!;
  assert.notEqual(a.id, b.id);
  assert.equal(a.city, "Palo Alto");
  assert.equal(a.meeting!.timezone, "America/Los_Angeles");
  assert.equal(a.meeting!.duration, 60);
  assert.equal(a.lat, 37.42333);
  assert.equal(
    nextMeeting(a, new Date("2026-11-19T00:00:00Z"))!.toISOString(),
    "2026-11-20T18:10:00.000Z",
  );
  assert.equal(
    filterResources([a], {
      ...defaultFilters,
      category: "meetings",
      fellowship: "AA",
      format: "in-person",
      state: "CA",
      center: { lat: 37.4419, lng: -122.143 },
      radius: 50,
    }).length,
    1,
  );
});
test("meeting feeds accept multiple days, island coordinates and geographic time zones", () => {
  const hawaii = normalizeMeetingGuide(
    {
      ...meeting,
      day: [1, 4],
      formatted_address: "123 Main St, Honolulu, HI 96813, USA",
      coordinates: "21.3069,-157.8583",
    },
    { ...source, state: "HI" },
    date,
  )!;
  assert.deepEqual(hawaii.meeting!.days, [1, 4]);
  assert.equal(hawaii.meeting!.timezone, "Pacific/Honolulu");
  const alaska = normalizeMeetingGuide(
    {
      ...meeting,
      formatted_address: "123 Main St, Anchorage, AK 99501, USA",
      coordinates: "61.2181,-149.9003",
    },
    { ...source, state: "AK" },
    date,
  )!;
  assert.equal(alaska.meeting!.timezone, "America/Anchorage");
});
test("ambiguous schedules, closed locations, non-US places and monthly events are held", () => {
  assert.equal(
    normalizeMeetingGuide({ ...meeting, time: "25:00" }, source, date),
    null,
  );
  assert.equal(
    normalizeMeetingGuide({ ...meeting, types: ["TC"] }, source, date),
    null,
  );
  assert.equal(
    normalizeMeetingGuide(
      { ...meeting, formatted_address: "Toronto, ON, Canada" },
      source,
      date,
    ),
    null,
  );
  assert.equal(
    normalizeMeetingGuide(
      { ...meeting, notes: "Third Sunday of each month" },
      source,
      date,
    ),
    null,
  );
  assert.equal(
    normalizeMeetingGuide(
      { name: "Online", day: 2, time: "19:00", attendance_option: "online" },
      source,
      date,
    ),
    null,
  );
});
test("Online Intergroup meetings are available for every selected jurisdiction and never get a map pin", () => {
  const r = normalizeOnlineIntergroup(
    {
      slug: "test-online",
      name: "Online Example",
      timezone: "America/Chicago",
      timeUTC: "2026-11-18T01:00:00Z",
      duration: 60,
      languages: ["es"],
      type: "O",
      groupEmail: "private@example.test",
      conference_url: "https://example.test/?pwd=secret",
    },
    date,
  )!;
  assert.equal(r.state, "US");
  assert.equal(r.lat, null);
  assert.equal(r.meeting!.time, "19:00");
  assert.deepEqual(r.meeting!.days, [2]);
  assert.deepEqual(r.languages, ["Spanish"]);
  for (const state of ["CA", "AK", "AS", "PR", "ND"])
    assert.equal(
      filterResources([r], {
        ...defaultFilters,
        state,
        format: "online",
        center: { lat: 37.4, lng: -122.1 },
        radius: 1,
      }).length,
      1,
    );
  assert.equal(
    filterResources([r], { ...defaultFilters, format: "in-person" }).length,
    0,
  );
  assert.ok(!JSON.stringify(r).includes("private@example"));
  assert.ok(!JSON.stringify(r).includes("pwd=secret"));
});
test("NA export accepts full state names, blank country and missing zones without importing contacts", () => {
  const r = normalizeBmlt(
    {
      published: "1",
      location_province: "California",
      location_nation: "",
      latitude: "37.44",
      longitude: "-122.14",
      weekday_tinyint: "3",
      start_time: "19:00:00",
      duration_time: "01:00:00",
      venue_type: 1,
      root_server_uri: "https://example.test/main_server/",
      source_id: "123",
      meeting_name: "Example NA",
      location_municipality: "Palo Alto",
      location_street: "Example Street",
      contact_email_1: "private@example.test",
      admin_notes: "private notes",
    },
    date,
  )!;
  assert.equal(r.state, "CA");
  assert.equal(r.meeting!.timezone, "America/Los_Angeles");
  assert.deepEqual(r.meeting!.days, [2]);
  assert.ok(!JSON.stringify(r).includes("private"));
});
test("counties, parishes and county equivalents resolve across the country and distinguish ambiguity", () => {
  for (const [q, state] of [
    ["Santa Clara County, CA", "CA"],
    ["Cook County Illinois", "IL"],
    ["Orleans Parish, LA", "LA"],
    ["Anchorage Municipality AK", "AK"],
  ]) {
    const result = parseLocationQuery(q);
    assert.equal(result.county?.state, state, q);
    assert.equal(result.ambiguous, false, q);
  }
  assert.equal(parseLocationQuery("Washington County").ambiguous, true);
});
test("crawler indexes retain day/time/coordinates and reject table headings", () => {
  const rows = parseCrawlerIndex(
    '<table><tr><th>Day</th></tr><tr><td>Monday</td><td>Noon</td><td><a href="https://example.test/m">Example</a></td><td>Hall</td><td>1 Main St, Fargo, ND 58102, USA</td><td>Fargo</td><td></td><td>Open, Wheelchair Access</td><td>46.87</td><td>-96.78</td></tr></table>',
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].time, "12:00");
  assert.equal(rows[0].day, 1);
});
test("custom statewide schedules preserve separate days and exclude nonweekly events", () => {
  const ga = parseGeorgia(
    '<table><tr><td><h3><a href="/meetings/group/1">Example</a></h3><p>1 Main St<br>Atlanta, GA 30303</p></td><td><div class="meeting"><p>7:00 PM 1hr</p></div></td><td><div class="meeting"><p>8:00 PM 1hr</p></div></td><td></td><td></td><td></td><td></td><td></td></tr></table>',
  );
  assert.equal(ga.length, 2);
  assert.equal(ga[0].day, 0);
  assert.equal(ga[1].time, "20:00");
  assert.notEqual(ga[0].slug, ga[1].slug);
  const row = (notes: string) =>
    "<tr>" +
    [
      "Example",
      "Tuesday",
      notes,
      "8:00 pm",
      "1 Main St",
      "",
      "!",
      "",
      "",
      "",
      "",
      "",
      "",
    ]
      .map((v) => "<td>" + v + "</td>")
      .join("") +
    "</tr>";
  assert.equal(
    parseMontana(
      "<table>" + row("Discussion") + row("Third Tuesday only") + "</table>",
      "Billings",
      "https://www.aa-montana.org/meetings.php",
    ).length,
    1,
  );
});
test("Sioux Falls schedules associate addresses with map coordinates and omit Al-Anon", () => {
  const markers = [
    [
      "Example",
      '<b>Example</b><br>1 Main St, Sioux Falls, SD, 57104<br><a class="maplink" href="/meetings/example">Info</a>',
      43.55,
      -96.73,
    ],
  ];
  const html =
    "<script>var e=" +
    JSON.stringify(markers) +
    '</script><h2 id="tuesday">Tuesday</h2><ul><li><noscript>19:00</noscript><a href="/meetings/example">Example AA</a></li><li><noscript>20:00</noscript><a href="/meetings/example">Example Al-Anon</a></li></ul>';
  const rows = parseSiouxFalls(html);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].latitude, 43.55);
  assert.equal(rows[0].day, 2);
  assert.equal(rows[0].formatted_address, "1 Main St, Sioux Falls, SD, 57104");
});
