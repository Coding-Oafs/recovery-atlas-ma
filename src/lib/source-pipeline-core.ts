import { createHash } from "node:crypto";
import type { Resource } from "./types";

/** Only publisher-managed facts. Geocoding and administrator-added evidence are independent. */
export function sourceFacts(r: Resource) {
  return {
    name: r.name,
    address: r.address,
    city: r.city,
    state: r.state,
    zip: r.zip,
    formats: [...r.formats].sort(),
    languages: [...r.languages].sort(),
    accessibility: [...r.accessibility].sort(),
    populations: [...r.populations].sort(),
    meeting: r.meeting
      ? {
          days: [...r.meeting.days].sort(),
          time: r.meeting.time,
          duration: r.meeting.duration,
          timezone: r.meeting.timezone,
          startsOn: r.meeting.startsOn ?? null,
          endsOn: r.meeting.endsOn ?? null,
          exceptions: r.meeting.exceptions ?? [],
        }
      : null,
  };
}
function canonical(v: any): any {
  return Array.isArray(v)
    ? v.map(canonical)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, canonical(v[k])]),
        )
      : v;
}
export const sameFacts = (a: unknown, b: unknown) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
export const fingerprint = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
export function retryHours(attempts: number) {
  return Math.min(168, 2 ** Math.min(8, Math.max(1, attempts)));
}
export function acceptableCapture(
  previous: number | null,
  count: number,
  rawCount: number,
) {
  return (
    rawCount > 0 &&
    count > 0 &&
    count >= rawCount * 0.2 &&
    (!previous || previous < 20 || count >= previous * 0.5)
  );
}
export function mergeSourceFacts(old: Resource, fresh: Resource): Resource {
  const moved =
    old.address !== fresh.address ||
    old.city !== fresh.city ||
    old.state !== fresh.state;
  return {
    ...old,
    ...sourceFacts(fresh),
    meeting: fresh.meeting
      ? {
          ...old.meeting,
          ...fresh.meeting,
          startsOn: fresh.meeting.startsOn,
          endsOn: fresh.meeting.endsOn,
        }
      : null,
    ...(moved
      ? {
          lat: fresh.lat,
          lng: fresh.lng,
          coordinateAccuracy: fresh.coordinateAccuracy,
        }
      : {}),
    sourceCheckedAt: fresh.sourceCheckedAt,
    sourceUpdatedAt: fresh.sourceUpdatedAt,
  };
}
