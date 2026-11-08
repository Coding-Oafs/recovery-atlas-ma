import { test } from "node:test";
import assert from "node:assert/strict";
import { resourceMapTarget } from "../src/lib/map-selection";
import { resourceSchema } from "../src/lib/types";
import raw from "../data/resources.json";
const physical = raw
  .map((r) => resourceSchema.parse(r))
  .find((r) => r.lat !== null && r.lng !== null)!;

test("mapped selections use longitude/latitude order and street-level zoom", () => {
  const target = resourceMapTarget({
    ...physical,
    coordinateAccuracy: "address",
  })!;
  assert.deepEqual(target.center, [physical.lng, physical.lat]);
  assert.equal(target.id, physical.id);
  assert.equal(target.zoom, 15);
  assert.equal(target.approximate, false);
  assert.deepEqual(
    resourceMapTarget({ ...physical, lat: 0, lng: 0 })!.center,
    [0, 0],
  );
});
test("approximate locations use an area-level view", () => {
  const target = resourceMapTarget({
    ...physical,
    coordinateAccuracy: "approximate",
  })!;
  assert.equal(target.zoom, 12);
  assert.equal(target.approximate, true);
});
test("online-only meetings and invalid or missing coordinates never create a selected pin", () => {
  assert.equal(resourceMapTarget(null), null);
  for (const coordinates of [
    { lat: null },
    { lng: null },
    { lat: NaN },
    { lng: Infinity },
    { lat: 90 },
    { lng: 181 },
  ]) {
    assert.equal(resourceMapTarget({ ...physical, ...coordinates }), null);
  }
  const online = {
    ...physical,
    kind: "meeting" as const,
    formats: ["online" as const],
  };
  assert.equal(resourceMapTarget(online), null);
  assert.ok(resourceMapTarget({ ...online, formats: ["online", "hybrid"] }));
});
