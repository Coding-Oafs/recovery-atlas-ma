import { test } from "node:test";
import assert from "node:assert/strict";
import raw from "../data/resources.json";
import { resourceSchema } from "../src/lib/types";
import {
  defaultFilters,
  filterResources,
  miles,
  nextMeeting,
} from "../src/lib/search";
const resources = raw.map((r) => resourceSchema.parse(r));
test("all published seed records satisfy the directory schema", () => {
  assert.ok(resources.length >= 43);
  assert.equal(new Set(resources.map((r) => r.id)).size, resources.length);
});
test("online-only meetings have no map coordinates and survive physical radius filters", () => {
  const online = resources.filter(
    (r) =>
      r.kind === "meeting" &&
      r.formats.includes("online") &&
      !r.formats.includes("hybrid"),
  );
  assert.ok(online.length);
  for (const r of online) {
    assert.equal(r.lat, null);
    assert.equal(r.lng, null);
  }
  const result = filterResources(resources, {
    ...defaultFilters,
    category: "meetings",
    format: "online",
    center: { lat: 42.1, lng: -73.3 },
    radius: 5,
  });
  assert.ok(result.some((r) => r.id === "smart-boston-4223"));
});
test("radius search excludes faraway physical locations", () => {
  const results = filterResources(resources, {
    ...defaultFilters,
    category: "mental-health",
    center: { lat: 42.36, lng: -71.06 },
    radius: 10,
  });
  assert.ok(results.some((r) => r.city === "Boston"));
  assert.ok(!results.some((r) => r.city === "Pittsfield"));
});
test("map bounds exclude unmapped resources except online-only meetings", () => {
  const results = filterResources(resources, {
    ...defaultFilters,
    bounds: [-71.2, 42.2, -70.9, 42.5],
  });
  assert.ok(results.some((r) => r.city === "Boston"));
  assert.ok(!results.some((r) => r.city === "Pittsfield"));
  assert.ok(results.some((r) => r.id === "aa-newton-zoom"));
});
test("insurance and accessibility match reported data only", () => {
  assert.equal(
    filterResources(resources, {
      ...defaultFilters,
      payment: "Unknown insurer",
    }).length,
    0,
  );
  assert.ok(
    filterResources(resources, { ...defaultFilters, payment: "MassHealth" })
      .length >= 31,
  );
  assert.ok(
    filterResources(resources, {
      ...defaultFilters,
      accessibility: true,
    }).every((r) => r.accessibility.includes("Wheelchair access")),
  );
});
test("keywords AND across words and participant filters work", () => {
  assert.ok(
    filterResources(resources, {
      ...defaultFilters,
      query: "worcester detox",
    }).some((r) => r.id === "adcare-hospital"),
  );
  assert.ok(
    filterResources(resources, {
      ...defaultFilters,
      population: "LGBTQ+",
    }).some((r) => r.id === "aa-fireside"),
  );
});
test("next meetings respect Eastern standard and daylight saving time", () => {
  const r = resources.find((r) => r.id === "aa-fireside")!;
  assert.equal(
    nextMeeting(r, new Date("2026-10-22T12:00:00Z"))?.toISOString(),
    "2026-10-24T23:30:00.000Z",
  );
  assert.equal(
    nextMeeting(r, new Date("2026-11-02T12:00:00Z"))?.toISOString(),
    "2026-11-08T00:30:00.000Z",
  );
});
test("starting soon uses actual instants, not a day-only comparison", () => {
  const results = filterResources(
    resources,
    { ...defaultFilters, soon: true },
    [],
    new Date("2026-10-23T21:00:00Z"),
  );
  assert.ok(results.some((r) => r.id === "smart-boston-4223"));
  assert.ok(!results.some((r) => r.id === "aa-fireside"));
});
test("saved-only filters never show unsaved records", () => {
  assert.deepEqual(
    filterResources(resources, { ...defaultFilters, savedOnly: true }, [
      "aa-fireside",
    ]).map((r) => r.id),
    ["aa-fireside"],
  );
});
test("distance returns reasonable miles", () => {
  assert.equal(miles({ lat: 42, lng: -71 }, { lat: 42, lng: -71 }), 0);
  assert.ok(
    miles({ lat: 42.36, lng: -71.06 }, { lat: 42.26, lng: -71.8 }) > 35,
  );
});
