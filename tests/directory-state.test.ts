import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultFilters, filterResources } from "../src/lib/search";
import { resourceActions } from "../src/lib/resource-links";
import { resourceFreshness } from "../src/lib/resource-quality";
import {
  readDirectorySnapshot,
  directorySearchKey,
  resourceLink,
  resourceIdFromUrl,
} from "../src/lib/directory-navigation";
import { resourceSchema } from "../src/lib/types";
import seed from "../data/resources.json";
const resources = seed.map((r) => resourceSchema.parse(r));

test("recovery programs precede registry records without hiding registry matches", () => {
  const base = resources.find((r) => !r.meeting)!;
  const program = { ...base, id: "program", name: "Z Recovery Program" };
  const registry = {
    ...base,
    id: "registry",
    name: "A Provider",
    sourceName: "NPPES public provider registry",
  };
  assert.deepEqual(
    filterResources([registry, program], defaultFilters).map((r) => r.id),
    ["program", "registry"],
  );
  assert.deepEqual(
    filterResources([registry, program], {
      ...defaultFilters,
      prioritizeRecovery: false,
    }).map((r) => r.id),
    ["registry", "program"],
  );
  assert.deepEqual(
    filterResources([registry, program], {
      ...defaultFilters,
      query: "A Provider",
    }).map((r) => r.id),
    ["registry"],
  );
});

test("restored searches validate all fields, expire and retain a stable ordering instant", () => {
  const now = Date.parse("2026-11-08T18:00:00Z");
  const snapshot = {
    version: 1,
    filters: defaultFilters,
    offset: 40,
    asOf: "2026-11-08T17:00:00Z",
    location: "Boston",
    locationLabel: "Boston MA",
    mobileView: "list",
    more: true,
    scrollTop: 350,
    windowY: 400,
  };
  const restored = readDirectorySnapshot(snapshot, now)!;
  assert.ok(restored);
  assert.equal(restored.offset, 40);
  assert.equal(restored.scrollTop, 350);
  assert.equal(
    directorySearchKey(restored),
    directorySearchKey({
      ...restored,
      filters: { ...defaultFilters, ...restored.filters },
    }),
  );
  for (const patch of [
    { offset: -20 },
    { offset: Infinity },
    { scrollTop: -1 },
    { filters: { ...defaultFilters, radius: "invalid" } },
    { asOf: "2026-11-07T18:00:00Z" },
    { asOf: "2026-11-09T18:00:00Z" },
  ]) {
    assert.equal(readDirectorySnapshot({ ...snapshot, ...patch }, now), null);
  }
});

test("listing links contain only the resource ID and reject malformed IDs", () => {
  assert.equal(resourceLink("aa-fireside"), "/?resource=aa-fireside");
  assert.equal(
    resourceIdFromUrl("https://example.com/?resource=aa-fireside"),
    "aa-fireside",
  );
  assert.equal(
    resourceIdFromUrl("https://example.com/?resource=%3Cscript%3E"),
    null,
  );
  assert.equal(resourceIdFromUrl("https://example.com/"), null);
});

test("quick actions distinguish joining instructions, telephone and physical directions", () => {
  const online = resources.find(
    (r) =>
      r.meeting &&
      r.formats.includes("online") &&
      !r.formats.includes("hybrid"),
  )!;
  const joined = {
    ...online,
    meeting: { ...online.meeting!, joinUrl: "https://example.org/join" },
  };
  assert.equal(
    resourceActions(joined).find((a) => a.label === "Join online")?.href,
    "https://example.org/join",
  );
  assert.ok(!resourceActions(joined).some((a) => a.label === "Directions"));
  const instructions = {
    ...joined,
    meeting: { ...joined.meeting, joinUrl: null },
  };
  assert.equal(
    resourceActions(instructions).find((a) => a.label === "Joining details")
      ?.href,
    online.website,
  );
  const physical = resources.find((r) => r.phone && r.address && !r.meeting)!;
  assert.ok(resourceActions(physical).some((a) => a.href.startsWith("tel:")));
  const directions = resourceActions(physical).find(
    (a) => a.label === "Directions",
  )!;
  assert.ok(
    new URL(directions.href).searchParams
      .get("destination")
      ?.includes(physical.city),
  );
});

test("source-review badges use meeting and facility review intervals without implying clinical verification", () => {
  const meeting = resources.find((r) => r.meeting)!;
  const clinic = resources.find((r) => !r.meeting)!;
  const now = new Date("2026-11-08T12:00:00Z");
  assert.equal(
    resourceFreshness({ ...meeting, sourceCheckedAt: "2026-10-01" }, now)
      .needsReview,
    true,
  );
  assert.equal(
    resourceFreshness({ ...clinic, sourceCheckedAt: "2026-10-01" }, now)
      .needsReview,
    false,
  );
  assert.equal(
    resourceFreshness({ ...clinic, sourceCheckedAt: "2026-07-01" }, now)
      .needsReview,
    true,
  );
});
