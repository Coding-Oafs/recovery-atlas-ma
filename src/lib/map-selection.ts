import type { Resource } from "./types";

export function resourceMapTarget(resource: Resource | null) {
  if (!resource) return null;
  const { lat, lng } = resource;
  const onlineOnly =
    resource.kind === "meeting" &&
    resource.formats.includes("online") &&
    !resource.formats.includes("hybrid");
  if (
    onlineOnly ||
    lat === null ||
    lng === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 85 ||
    Math.abs(lng) > 180
  )
    return null;
  return {
    id: resource.id,
    center: [lng, lat] as [number, number],
    zoom: resource.coordinateAccuracy === "approximate" ? 12 : 15,
    approximate: resource.coordinateAccuracy === "approximate",
  };
}
