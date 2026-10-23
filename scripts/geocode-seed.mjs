import { readFile, writeFile } from "node:fs/promises";
import zipcodes from "zipcodes";
const path = new URL("../data/resources.json", import.meta.url),
  rows = JSON.parse(await readFile(path, "utf8"));
for (const r of rows) {
  if (
    r.lat !== null ||
    (r.formats.includes("online") && !r.formats.includes("hybrid"))
  )
    continue;
  try {
    const address = r.address.replace(/,\s*(?:1st floor|Level 2)\s*/i, "");
    const url = new URL(
      "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress",
    );
    url.search = new URLSearchParams({
      address,
      benchmark: "Public_AR_Current",
      format: "json",
    }).toString();
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const data = await res.json();
    const m = data.result?.addressMatches?.[0];
    if (m && m.addressComponents?.state === "MA") {
      r.lat = m.coordinates.y;
      r.lng = m.coordinates.x;
      r.coordinateAccuracy = "address";
      r.geocodeSource = "US Census Geocoder";
    }
  } catch {}
  if (r.lat === null) {
    const z = zipcodes.lookup(r.zip);
    if (z?.state === "MA") {
      r.lat = z.latitude;
      r.lng = z.longitude;
      r.coordinateAccuracy = "approximate";
    }
  }
  console.log(r.id, r.coordinateAccuracy);
  await writeFile(path, JSON.stringify(rows, null, 2) + "\n");
}
