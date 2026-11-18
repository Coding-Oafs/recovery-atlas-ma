import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVenueMeetings } from "../src/lib/venue-meetings";
import { localAaDirectory } from "../src/lib/local-aa-directory";
import { defaultFilters } from "../src/lib/search";

test("club schedules omit other fellowships, administrative events, and chair names", () => {
  const mustard = parseVenueMeetings(
    '<div class="gutentor-col-wrap"><h2 class="gutentor-text">Tuesday</h2><p class="gutentor-text"><strong>7:30 AM</strong><br>Big Book — Closed Meeting<br>Private Chair<br><br><strong>8:00 PM</strong><br>Gamblers Anonymous<br>Private Chair</p></div>',
    "mustard-seed",
  );
  assert.deepEqual(
    mustard.map(({ name, day, types }) => [name, day, types]),
    [["Big Book", 2, ["C"]]],
  );
  assert.doesNotMatch(JSON.stringify(mustard), /Private Chair/);
  const dallas = parseVenueMeetings(
    '<section><h1 class="wixui-rich-text">Ross Avenue Group</h1><h2 class="wixui-rich-text">Monday</h2><div class="wixui-rich-text">12:00PM - Open Discussion<br>6:30PM - DAA Big Book<br>7:00PM - Group Conscience</div><h2 class="wixui-rich-text">Peak Street Group</h2><h3 class="wixui-rich-text">Tuesday</h3><div class="wixui-rich-text">6:30PM - Women’s Meeting</div></section>',
    "dallas-24-hour",
  );
  assert.deepEqual(
    dallas.map(({ time, types, formatted_address }) => [
      time,
      types,
      formatted_address,
    ]),
    [
      ["12:00", ["O"], "4636 Ross Ave, Dallas, TX 75204"],
      ["18:30", ["W"], "1421 N Peak St, Dallas, TX 75204"],
    ],
  );
});

test("the room grid skips online-only and off-site slots", () => {
  const records = parseVenueMeetings(
    '<table><tr><th></th><th>Sunday</th><th>Monday</th><th>Tuesday</th><th>Wednesday</th><th>Thursday</th><th>Friday</th><th>Saturday</th></tr><tr><td>7:00AM</td><td style="background-color:#ffff00">Virtual Only</td><td>In Person</td><td>Beach*</td><td></td><td></td><td></td><td></td></tr></table>',
    "sobe-room",
  );
  assert.deepEqual(
    records.map(({ name, day, types }) => [name, day, types]),
    [["In Person", 1, ["O"]]],
  );
});

test("local AA links follow the selected city, county, or nearby center", () => {
  assert.equal(
    localAaDirectory({ ...defaultFilters, state: "IL", city: "CHICAGO" })?.name,
    "Chicago Area AA",
  );
  assert.equal(
    localAaDirectory({ ...defaultFilters, countyFips: "12086" })?.name,
    "Miami-Dade AA Intergroup",
  );
  assert.equal(
    localAaDirectory({ ...defaultFilters, center: { lat: 32.77, lng: -96.8 } })
      ?.name,
    "Dallas AA Intergroup",
  );
  assert.equal(
    localAaDirectory({
      ...defaultFilters,
      fellowship: "NA",
      countyFips: "12086",
    }),
    undefined,
  );
  assert.equal(
    localAaDirectory({
      ...defaultFilters,
      format: "online",
      countyFips: "12086",
    }),
    undefined,
  );
  assert.equal(localAaDirectory({ ...defaultFilters, state: "IL" }), undefined);
});
