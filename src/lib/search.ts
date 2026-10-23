import type { Resource, Filters } from "./types";
export function miles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180;
  const x =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function wallParts(d: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return {
    year: v("year"),
    month: v("month"),
    day: v("day"),
    hour: v("hour"),
    minute: v("minute"),
  };
}
export function nextMeeting(r: Resource, now = new Date()): Date | null {
  if (!r.meeting) return null;
  const m = r.meeting,
    p = wallParts(now, m.timezone);
  const [hour, minute] = m.time.split(":").map(Number);
  for (let n = 0; n < 8; n++) {
    const day = new Date(Date.UTC(p.year, p.month - 1, p.day + n));
    if (!m.days.includes(day.getUTCDay())) continue;
    const target = Date.UTC(
      day.getUTCFullYear(),
      day.getUTCMonth(),
      day.getUTCDate(),
      hour,
      minute,
    );
    let t = target;
    for (let i = 0; i < 3; i++) {
      const w = wallParts(new Date(t), m.timezone);
      t += target - Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
    }
    const candidate = new Date(t);
    const check = wallParts(candidate, m.timezone);
    if (check.hour !== hour || check.minute !== minute) continue;
    if (t >= now.getTime()) return candidate;
  }
  return null;
}
export function filterResources(
  resources: Resource[],
  f: Filters,
  saved: string[] = [],
  now = new Date(),
) {
  const words = f.query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return resources
    .filter((r) => {
      if (
        f.category !== "all" &&
        !r.categories.includes(f.category as Resource["categories"][number])
      )
        return false;
      if (
        f.format === "online" &&
        !r.formats.some((x) => ["online", "hybrid"].includes(x))
      )
        return false;
      if (
        f.format === "in-person" &&
        !r.formats.some((x) => ["in-person", "hybrid"].includes(x))
      )
        return false;
      if (
        ["hybrid", "telehealth"].includes(f.format) &&
        !r.formats.includes(f.format as "hybrid" | "telehealth")
      )
        return false;
      if (f.fellowship && r.fellowship !== f.fellowship) return false;
      if (
        f.payment &&
        !r.payment.includes(f.payment) &&
        !r.insurance.some((x) => x.name === f.payment)
      )
        return false;
      if (f.service && !r.services.includes(f.service)) return false;
      if (f.language && !r.languages.includes(f.language)) return false;
      if (f.population && !r.populations.includes(f.population)) return false;
      if (f.accessibility && !r.accessibility.includes("Wheelchair access"))
        return false;
      if (f.savedOnly && !saved.includes(r.id)) return false;
      if (
        f.day !== "" &&
        (!r.meeting || !r.meeting.days.includes(Number(f.day)))
      )
        return false;
      if (f.soon) {
        const next = nextMeeting(r, now);
        if (!next || next.getTime() - now.getTime() > 3 * 3600000) return false;
      }
      const online =
        r.kind === "meeting" &&
        r.formats.includes("online") &&
        !r.formats.includes("hybrid");
      if (f.bounds && !online) {
        if (r.lat === null || r.lng === null) return false;
        const [w, s, e, n] = f.bounds;
        if (r.lng < w || r.lng > e || r.lat < s || r.lat > n) return false;
      }
      if (f.center && !online) {
        if (
          r.lat === null ||
          r.lng === null ||
          miles(f.center, { lat: r.lat, lng: r.lng }) > f.radius
        )
          return false;
      }
      const hay = [
        r.name,
        r.city,
        r.address,
        r.description,
        r.fellowship,
        ...r.services,
        ...r.languages,
        ...r.populations,
        ...r.payment,
        ...r.insurance.map((i) => i.name + " " + i.plan),
      ]
        .join(" ")
        .toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => {
      if (f.category === "meetings" || f.format === "online" || f.soon) {
        return (
          (nextMeeting(a, now)?.getTime() ?? Infinity) -
            (nextMeeting(b, now)?.getTime() ?? Infinity) ||
          a.name.localeCompare(b.name)
        );
      }
      if (f.center) {
        const distance = (r: Resource) =>
          r.lat !== null && r.lng !== null
            ? miles(f.center!, { lat: r.lat, lng: r.lng })
            : Infinity;
        return distance(a) - distance(b) || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
}
export const defaultFilters: Filters = {
  query: "",
  category: "all",
  format: "",
  fellowship: "",
  payment: "",
  service: "",
  language: "",
  accessibility: false,
  population: "",
  day: "",
  soon: false,
  radius: 25,
  center: null,
  bounds: null,
  savedOnly: false,
};
