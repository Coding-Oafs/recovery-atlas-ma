import { readFile } from "node:fs/promises";
const resources = JSON.parse(
  await readFile(new URL("../data/resources.json", import.meta.url), "utf8"),
);
const dup = resources.filter(
  (r, i) => resources.findIndex((x) => x.id === r.id) !== i,
);
if (dup.length) throw Error("Duplicate IDs");
for (const r of resources) {
  if (!r.sourceUrl.startsWith("https://"))
    throw Error("Missing secure source " + r.id);
  if (
    r.lat !== null &&
    (r.lat < 41 || r.lat > 43 || r.lng < -74 || r.lng > -69)
  )
    throw Error("Coordinates outside MA " + r.id);
  if (
    r.kind === "meeting" &&
    r.formats.includes("online") &&
    !r.formats.includes("hybrid") &&
    r.lat !== null
  )
    throw Error("Online map pin " + r.id);
}
console.log(
  JSON.stringify(
    {
      total: resources.length,
      cbhc: resources.filter((r) => r.sourceName === "Mass.gov CBHC directory")
        .length,
      meetings: resources.filter((r) => r.meeting).length,
      approximatePins: resources
        .filter((r) => r.coordinateAccuracy === "approximate")
        .map((r) => r.id),
      missingPins: resources
        .filter((r) => r.lat === null && !r.formats.includes("online"))
        .map((r) => r.id),
    },
    null,
    2,
  ),
);
