import zipcodes from "zipcodes";
import {
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
  const matches = (state ? [state] : regionStates)
    .flatMap((s) => zipcodes.lookupByName(city, s))
    .filter((z) => z.country === "US" && isRegionState(z.state));
  return {
    state: state as RegionState | undefined,
    city,
    matches,
    ambiguous: new Set(matches.map((z) => z.state)).size > 1,
  };
}
