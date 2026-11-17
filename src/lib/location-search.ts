import zipcodes from "zipcodes";
import counties from "../../data/us-counties.json";
import {
  territoryPlaces,
  regionStates,
  stateNames,
  isRegionState,
  type RegionState,
} from "./region";
export function parseLocationQuery(query: string, preferred = "") {
  const names = Object.entries(stateNames)
    .flatMap(([code, name]) => [code, name])
    .sort((a, b) => b.length - a.length);
  const match = query.match(
    new RegExp("(?:,?\\s+)(" + names.join("|") + ")$", "i"),
  );
  const state = match
    ? regionStates.find(
        (s) =>
          s.toLowerCase() === match[1].toLowerCase() ||
          stateNames[s].toLowerCase() === match[1].toLowerCase(),
      )
    : isRegionState(preferred)
      ? preferred
      : undefined;
  const city = match ? query.slice(0, match.index).trim() : query;
  const plainCity = city.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const county =
    /\b(county|parish|borough|census area|municipality|municipio)\b/i.test(
      plainCity,
    )
      ? counties.filter(
          (c) =>
            (!state || c.state === state) &&
            c.name
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .toLowerCase() === plainCity.toLowerCase(),
        )
      : [];
  const matches = (state ? [state] : regionStates)
    .flatMap((s) => zipcodes.lookupByName(plainCity, s))
    .filter((z) => isRegionState(z.state));
  if (!matches.length) {
    for (const place of territoryPlaces) {
      if (
        (!state || place.state === state) &&
        place.city.toLowerCase() === plainCity.toLowerCase()
      ) {
        matches.push({ ...place, country: "US" } as (typeof matches)[number]);
      }
    }
  }
  return {
    state: state as RegionState | undefined,
    city,
    county: county.length === 1 ? county[0] : undefined,
    matches,
    ambiguous:
      county.length > 1 || new Set(matches.map((z) => z.state)).size > 1,
  };
}
