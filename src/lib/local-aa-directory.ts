import { miles } from "./search";
import type { Filters } from "./types";

const directories = [
  {
    state: "IL",
    county: "17031",
    cities: ["chicago"],
    lat: 41.8781,
    lng: -87.6298,
    name: "Chicago Area AA",
    url: "https://www.chicagoaa.org/meetings/",
  },
  {
    state: "TX",
    county: "48113",
    cities: ["dallas"],
    lat: 32.7767,
    lng: -96.797,
    name: "Dallas AA Intergroup",
    url: "https://www.aadallas.org/find-a-meeting/",
  },
  {
    state: "FL",
    county: "12086",
    cities: [
      "miami",
      "miami beach",
      "north miami",
      "coral gables",
      "hialeah",
      "homestead",
      "palmetto bay",
      "key biscayne",
    ],
    lat: 25.7617,
    lng: -80.1918,
    name: "Miami-Dade AA Intergroup",
    url: "https://aamiamidade.org/meetings",
  },
];

export function localAaDirectory(filters: Filters) {
  if (
    filters.savedOnly ||
    filters.format === "online" ||
    (filters.fellowship && filters.fellowship !== "AA") ||
    !["all", "meetings"].includes(filters.category)
  )
    return undefined;
  const city = filters.city?.trim().toLowerCase();
  return directories.find((entry) => {
    if (filters.state && filters.state !== entry.state) return false;
    if (filters.countyFips) return filters.countyFips === entry.county;
    if (city)
      return filters.state === entry.state && entry.cities.includes(city);
    const center = filters.center;
    return center && miles(center, entry) <= 20;
  });
}
