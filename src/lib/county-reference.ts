import domestic from "../../data/us-counties.json";
import territories from "../../data/us-territory-counties.json";

/** 2026 Census Gazetteer plus 2025 cartographic equivalents for the island areas. */
export const countyReferences = [...domestic, ...territories];
