// Read-only comparison against the small preview dataset. Use --conditions=react-server --import=tsx.
import assert from "node:assert/strict";
import { queryDirectory } from "../src/lib/directory-query";
import { defaultFilters, filterResources } from "../src/lib/search";
import { resourceSchema, type Filters } from "../src/lib/types";
const all = (await queryDirectory(defaultFilters, [], 500)) as {
  resources: unknown[];
  total: number;
};
assert.ok(all.total <= 500, "Run this comparison on the small preview dataset");
const resources = all.resources.map((r) => resourceSchema.parse(r));
const cases: Partial<Filters>[] = [
  { meetingWindow: "today" },
  { meetingWindow: "tomorrow" },
  { meetingWindow: "24h" },
  { meetingWindow: "7days" },
  { meetingWindow: "weekend" },
  {
    meetingWindow: "date",
    meetingDate: new Date(Date.now() + 45 * 86400000)
      .toISOString()
      .slice(0, 10),
  },
  { startAfter: "08:00", startBefore: "12:00" },
  { startAfter: "22:00", startBefore: "05:00" },
  { soon: true },
  { day: "0" },
  { meetingWindow: "tomorrow", timeZone: "Europe/London" },
  {
    meetingWindow: "today",
    timeZone: "America/Los_Angeles",
    startAfter: "12:00",
  },
];
for (const partial of cases) {
  const f = { ...defaultFilters, ...partial };
  const expected = filterResources(resources, f),
    actual = (await queryDirectory(f, [], 500)) as {
      resources: { id: string }[];
      total: number;
      mapped: number;
    };
  assert.deepEqual(
    actual.resources.map((r) => r.id).sort(),
    expected.map((r) => r.id).sort(),
    JSON.stringify(partial),
  );
  const map = (await queryDirectory(f, [], 500, {
    map: { bounds: [-180, -85, 180, 85], zoom: 5 },
  })) as { represented: number };
  assert.equal(
    map.represented,
    actual.mapped,
    "Map and list filters must agree",
  );
  console.log("Verified time filter:", JSON.stringify(partial));
}
