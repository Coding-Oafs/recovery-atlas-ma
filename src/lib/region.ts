export const regionStates = [
  "MA",
  "CT",
  "ME",
  "NH",
  "NJ",
  "NY",
  "PA",
  "RI",
  "VT",
] as const;
export type RegionState = (typeof regionStates)[number];
export const stateNames: Record<RegionState, string> = {
  MA: "Massachusetts",
  CT: "Connecticut",
  ME: "Maine",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NY: "New York",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  VT: "Vermont",
};
export const regionBounds = [-80.6, 38.8, -66.8, 47.6] as const;
export function isRegionState(value: string): value is RegionState {
  return (regionStates as readonly string[]).includes(value);
}
