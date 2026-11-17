import es from "../../data/es.json";
const normalize = (value: string) =>
  value
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, ".")
    .replace(/\s+/g, " ")
    .trim();
const catalog = new Map(
  Object.entries(es).map(([key, value]) => [normalize(key), value]),
);
export function translate(value: string, language: string): string {
  if (language !== "es") return value;
  return catalog.get(normalize(value)) ?? value;
}
