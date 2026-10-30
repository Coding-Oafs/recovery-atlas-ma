import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLocationQuery } from "../src/lib/location-search";
import { resourceSchema } from "../src/lib/types";
import { filterResources, defaultFilters } from "../src/lib/search";
import { regionStates } from "../src/lib/region";
import raw from "../data/resources.json";
test("regional cities accept explicit state names and distinguish ambiguous places", () => {
  for (const [query, state] of [
    ["Albany, NY", "NY"],
    ["Portland, Maine", "ME"],
    ["Burlington VT", "VT"],
    ["Concord, NH", "NH"],
    ["Hartford CT", "CT"],
    ["Philadelphia PA", "PA"],
    ["Providence RI", "RI"],
    ["Newark NJ", "NJ"],
    ["Boston MA", "MA"],
  ]) {
    const p = parseLocationQuery(query);
    assert.equal(p.state, state);
    assert.ok(p.matches.length, query);
    assert.equal(p.ambiguous, false);
  }
  assert.equal(parseLocationQuery("Springfield").ambiguous, true);
  assert.equal(parseLocationQuery("Springfield", "MA").ambiguous, false);
  assert.equal(parseLocationQuery("Portland, ME", "NY").state, "ME");
});
test("all regional states validate, including southern New Jersey, and state filters agree", () => {
  const rows = regionStates.map((state) =>
    resourceSchema.parse({
      ...raw[0],
      id: "test-" + state.toLowerCase(),
      state,
      lat: 38.95,
      lng: -74.92,
    }),
  );
  assert.equal(rows.length, 9);
  assert.deepEqual(
    filterResources(rows, { ...defaultFilters, state: "NJ" }).map(
      (r) => r.state,
    ),
    ["NJ"],
  );
  assert.equal(
    resourceSchema.safeParse({ ...raw[0], state: "" }).success,
    false,
  );
  assert.equal(resourceSchema.safeParse({ ...raw[0], lat: 91 }).success, false);
});
