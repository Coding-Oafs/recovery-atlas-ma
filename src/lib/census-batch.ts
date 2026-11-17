import { parseCsv } from "./publisher-csv";
export const censusBatchUrl =
  "https://geocoding.geo.census.gov/geocoder/geographies/addressbatch";
export type CensusAddress = {
  address_key: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};
const cell = (s: string) => '"' + s.replace(/"/g, '""') + '"';
export function censusBatchCsv(rows: CensusAddress[]) {
  return rows
    .map((r) =>
      [r.address_key, r.address, r.city, r.state, r.zip].map(cell).join(","),
    )
    .join("\r\n");
}
export function readCensusMatches(csv: string, rows: CensusAddress[]) {
  // Census batch files have no header: id,input,match,match-type,matched-address,lon/lat,TIGER-id,side,state,county,tract,block.
  const parsed = parseCsv(
      "id,input,status,type,matched,coordinates,tiger,side,state,county,tract,block\n" +
        csv,
    ),
    known = new Map(rows.map((r) => [r.address_key, r]));
  return parsed.flatMap((r) => {
    const input = known.get(r.id);
    if (!input) return [];
    const [lng, lat] = (r.coordinates || "").split(",").map(Number);
    const match =
      r.status === "Match" &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180;
    // Matched address carries postal state; a nearby border match must never relocate a listing to another state.
    const state = r.matched.match(
      /,\s*([A-Z]{2})\s*,?\s*\d{5}(?:-\d{4})?\s*$/,
    )?.[1];
    const valid = match && state === input.state;
    return [
      {
        address_key: r.id,
        status: valid ? "matched" : "unmatched",
        lat: valid ? lat : null,
        lng: valid ? lng : null,
        matched_address: valid ? r.matched : null,
        match_type: valid ? r.type : null,
        county_fips:
          valid && /^\d{2}$/.test(r.state) && /^\d{3}$/.test(r.county)
            ? r.state + r.county
            : null,
      },
    ];
  });
}
