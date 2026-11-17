import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { resourceSchema } from "../src/lib/types";
import { regionStates } from "../src/lib/region";
import { parseLocationQuery } from "../src/lib/location-search";
import { searchAlternatives } from "../src/lib/discovery";
import { defaultFilters, filterResources } from "../src/lib/search";
import { catalogQuery } from "../src/lib/catalog-query";
import { translate } from "../src/lib/i18n";
import { resourceQuestions } from "../src/lib/resource-quality";
import agencies from "../data/state-help.json";
import manifest from "../data/national-manifest.json";
import seed from "../data/resources.json";
test("national catalog validates every imported record and documents every jurisdiction", () => {
  const rows = JSON.parse(
    gunzipSync(readFileSync("data/national-catalog.json.gz")).toString("utf8"),
  ).map((r: unknown) => resourceSchema.parse(r));
  assert.equal(rows.length, manifest.total);
  assert.equal(
    new Set(rows.map((r: { id: string }) => r.id)).size,
    rows.length,
  );
  assert.equal(regionStates.length, 57);
  assert.equal(Object.keys(agencies).length, 56);
  for (const state of regionStates) {
    assert.ok(manifest.jurisdictions.some((j) => j.state === state));
    if (state !== "AS" && state !== "UM")
      assert.ok(
        rows.some((r: { state: string }) => r.state === state),
        state,
      );
  }
  for (const state of ["AS", "UM"])
    assert.equal(
      manifest.jurisdictions.find((j) => j.state === state)?.listings,
      0,
    );
  assert.ok(
    rows.every((r: { verifiedAt: string | null }) => r.verifiedAt === null),
  );
});
test("location lookup resolves continental, island and accented territory names", () => {
  for (const [query, state] of [
    ["Reno NV", "NV"],
    ["Los Angeles California", "CA"],
    ["Honolulu HI", "HI"],
    ["San Juan PR", "PR"],
    ["Hagåtña GU", "GU"],
    ["Pago Pago AS", "AS"],
    ["Saipan MP", "MP"],
  ]) {
    const parsed = parseLocationQuery(query);
    assert.equal(parsed.state, state);
    assert.ok(parsed.matches.length, query);
  }
});
test("alternative searches preserve unrelated preferences and count their actual matches", () => {
  const f = {
    ...defaultFilters,
    category: "meetings",
    format: "in-person",
    state: "MA",
    language: "Spanish",
    payment: "Free",
    center: { lat: 42.3, lng: -71.1 },
    radius: 10,
    meetingWindow: "today" as const,
  };
  const choices = searchAlternatives(f);
  const wider = choices.find((c) => c.id === "radius")!;
  assert.equal(wider.filters.radius, 50);
  assert.equal(wider.filters.payment, "Free");
  assert.equal(wider.filters.language, "Spanish");
  assert.equal(wider.filters.state, "MA");
  const online = choices.find((c) => c.id === "online")!;
  assert.equal(online.filters.center, null);
  assert.equal(online.filters.format, "online");
  assert.equal(online.filters.language, "Spanish");
  const rows = seed.map((r) => resourceSchema.parse(r));
  for (const choice of choices) {
    const page = catalogQuery(rows, choice.filters, [], 1, {
      asOf: "2026-11-17T12:00:00Z",
    });
    assert.equal(
      "total" in page ? page.total : NaN,
      filterResources(
        rows,
        choice.filters,
        [],
        new Date("2026-11-17T12:00:00Z"),
      ).length,
    );
  }
});
test("unreported facts form a separate result set and do not admit known nonmatches", () => {
  const base = resourceSchema.parse(seed[0]),
    rows = [
      {
        ...base,
        id: "documented",
        languages: ["Spanish"],
        payment: ["Medicaid"],
      },
      {
        ...base,
        id: "unknown",
        languages: [],
        payment: ["Medicaid"],
        insurance: [],
      },
      {
        ...base,
        id: "nonmatch",
        languages: ["English"],
        payment: ["Medicaid"],
      },
    ];
  const f = { ...defaultFilters, language: "Spanish", payment: "Medicaid" };
  assert.deepEqual(
    filterResources(rows, f).map((r) => r.id),
    ["documented"],
  );
  assert.deepEqual(
    filterResources(rows, { ...f, uncertainOnly: true }).map((r) => r.id),
    ["unknown"],
  );
});
test("meeting guidance avoids treatment intake and Spanish copy handles typographic punctuation", () => {
  const meeting = resourceSchema.parse(seed.find((r) => r.meeting));
  assert.ok(
    resourceQuestions(meeting).every(
      (q) => !/insurance|appointment|referral/i.test(q),
    ),
  );
  assert.equal(
    translate("You don’t have to figure it out alone.", "es"),
    "No tienes que resolverlo sin ayuda.",
  );
  assert.equal(translate("Meeting date", "es"), "Fecha de la reunión");
  assert.equal(translate("Source reviewed", "en"), "Source reviewed");
});
