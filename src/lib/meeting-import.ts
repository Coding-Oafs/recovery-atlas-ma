import { createHash } from "node:crypto";
import tzLookup from "tz-lookup";
import zipcodes from "zipcodes";
import bounds from "../../data/jurisdiction-bounds.json";
import { stateNames, isRegionState } from "./region";
import { resourceSchema, type Resource } from "./types";

export type MeetingSource = {
  id: string;
  page: string;
  fellowship: string;
  state?: string;
  nationalOnline?: boolean;
};
type Row = Record<string, any>;
const clean = (v: unknown) =>
  String(v ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const hash = (v: string) =>
  createHash("sha256").update(v).digest("hex").slice(0, 20);
const token = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
export const meetingSignature = (r: Resource) =>
  [
    r.fellowship,
    token(r.name),
    token(r.address.split(",")[0]),
    token(r.city),
    r.state,
    [...r.meeting!.days].sort().join(","),
    r.meeting!.time,
  ].join("|");
export function canonicalMeetingUrl(v: string) {
  const u = new URL(v);
  u.hash = "";
  for (const key of [...u.searchParams.keys()])
    if (/^utm_|^(fbclid|gclid)$/i.test(key)) u.searchParams.delete(key);
  return u.href.replace(/\/$/, "");
}
function https(v: unknown) {
  try {
    const u = new URL(clean(v));
    return u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}
function stateOf(v: unknown) {
  const s = clean(v);
  return isRegionState(s.toUpperCase())
    ? s.toUpperCase()
    : Object.entries(stateNames).find(
        ([, n]) => n.toLowerCase() === s.toLowerCase(),
      )?.[0];
}
function zone(v: unknown, lat: number | null, lng: number | null) {
  try {
    const value = clean(v);
    if (value) {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return value;
    }
    if (lat !== null && lng !== null) return tzLookup(lat, lng);
  } catch {}
  return null;
}
const base = (source: MeetingSource, today: string): Resource => ({
  id: "pending",
  name: "Pending",
  kind: "meeting",
  categories: ["meetings"],
  address: "",
  city: "",
  state: "US",
  country: "US",
  zip: "",
  lat: null,
  lng: null,
  coordinateAccuracy: "unavailable",
  phone: "",
  website: source.page,
  description:
    source.fellowship +
    " peer-support meeting published by its official directory. Confirm the current schedule and participation instructions on the source page.",
  services: ["Peer support"],
  formats: ["in-person"],
  fellowship: source.fellowship,
  languages: [],
  accessibility: [],
  populations: [],
  hours: "Recurring schedule; confirm on the official source page.",
  intake:
    "Check the official source for current attendance instructions and participant restrictions.",
  payment: ["Free / donations"],
  paymentNote: "Peer support; insurance is not required.",
  insurance: [],
  sourceUrl: source.page,
  sourceName: (
    source.fellowship +
    " official directory · " +
    new URL(source.page).hostname
  ).slice(0, 160),
  sourceCheckedAt: today,
  verifiedAt: null,
  sourceUpdatedAt: null,
  meeting: null,
  availability: "Published schedule; confirm with group",
});
/** Missing or ambiguous place/time-zone facts are held for review, never defaulted to Eastern. */
export function normalizeMeetingGuide(
  m: Row,
  source: MeetingSource,
  today: string,
): Resource | null {
  const types = Array.isArray(m.types) ? m.types : [];
  // Meeting Guide sheets can publish conferencing fields without attendance_option/ONL.
  // City-only entries are online availability, not physical venue addresses.
  const conference = !!clean(m.conference_url || m.conference_phone);
  const street = clean(m.address || m.formatted_address).split(",")[0];
  const physicalVenue =
    !/^(?:online|zoom|virtual|telephone)\b/i.test(street) &&
    /\d|\b(?:street|st|avenue|ave|road|rd|way|blvd|drive|dr|lane|ln|highway|hwy|court|ct|plaza|boulevard|place)\b/i.test(
      street,
    );
  const hybrid =
    m.attendance_option === "hybrid" ||
    types.includes("HY") ||
    (!m.attendance_option &&
      !types.includes("ONL") &&
      conference &&
      physicalVenue);
  const online =
    m.attendance_option === "online" ||
    (!m.attendance_option && !hybrid && (types.includes("ONL") || conference));
  if (types.includes("TC")) return null;
  if (
    /\bmonthly\b|once a month|\b(?:1st|2nd|3rd|4th|first|second|third|fourth|last)\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(
      clean(m.name) + " " + clean(m.notes),
    )
  )
    return null;
  const address = clean(m.formatted_address || m.address).replace(
    /,\s*(USA|United States)$/i,
    "",
  );
  const match = address.match(
    /,\s*([A-Z]{2})(?:\s+(\d{5})(?:-\d{4})?)?(?:,|$)/,
  );
  const state =
    stateOf(m.state) ||
    stateOf(match?.[1]) ||
    (source.nationalOnline && online ? "US" : source.state);
  if (!state || (!isRegionState(state) && state !== "US")) return null;
  if (
    /,\s*(Canada|Australia|United Kingdom|New Zealand|Germany|France|Ireland)$/i.test(
      address,
    )
  )
    return null;
  const days = (Array.isArray(m.day) ? m.day : [m.day]).map(Number);
  if (
    !days.length ||
    days.some((d) => !Number.isInteger(d) || d < 0 || d > 6) ||
    !/^([01]\d|2[0-3]):[0-5]\d/.test(m.time || "")
  )
    return null;
  let lat = Number(m.latitude),
    lng = Number(m.longitude);
  if (m.coordinates && (!Number.isFinite(lat) || !Number.isFinite(lng)))
    [lat, lng] = String(m.coordinates).split(",").map(Number);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !lat ||
    !lng ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    lat = NaN;
    lng = NaN;
  }
  const city = clean(
    m.city ||
      address.match(/,\s*([^,]+),\s*[A-Z]{2}\b/)?.[1] ||
      (Array.isArray(m.regions) ? m.regions.at(-1) : m.region) ||
      "",
  );
  let accuracy: Resource["coordinateAccuracy"] =
    m.approximate === "yes" ? "approximate" : "address";
  if (!Number.isFinite(lat) && isRegionState(state)) {
    const z = zipcodes.lookup(match?.[2] || ""),
      matches = z?.state === state ? [z] : zipcodes.lookupByName(city, state);
    if (matches.length) {
      lat = matches.reduce((n, z) => n + z.latitude, 0) / matches.length;
      lng = matches.reduce((n, z) => n + z.longitude, 0) / matches.length;
      accuracy = "approximate";
    }
  }
  const extent = bounds[state as keyof typeof bounds];
  if (
    extent &&
    Number.isFinite(lat) &&
    (lng < extent[0] || lat < extent[1] || lng > extent[2] || lat > extent[3])
  )
    return null;
  const timezone = zone(
    m.timezone,
    Number.isFinite(lat) ? lat : null,
    Number.isFinite(lng) ? lng : null,
  );
  if (!timezone || (!online && !Number.isFinite(lat))) return null;
  const r = base(source, today),
    time = String(m.time).slice(0, 5);
  const publishedUrl = https(m.url);
  const url = publishedUrl || source.page;
  const identity = publishedUrl
    ? canonicalMeetingUrl(publishedUrl)
    : source.page +
      "|" +
      clean(m.slug || m.id || hash([m.name, days, time, address].join("|")));
  const duration =
    (Number(String(m.end_time).slice(0, 2)) * 60 +
      Number(String(m.end_time).slice(3, 5)) -
      (Number(time.slice(0, 2)) * 60 + Number(time.slice(3))) +
      1440) %
    1440;
  Object.assign(r, {
    id:
      "meeting-" +
      hash(identity + (Array.isArray(m.day) ? "|" + days.join(",") : "")),
    name: clean(m.name).slice(0, 220),
    address: online && !hybrid ? "" : address.slice(0, 300),
    city: (state === "US" ? "Online" : city).slice(0, 100),
    state,
    zip: match?.[2] || "",
    lat: online && !hybrid ? null : lat,
    lng: online && !hybrid ? null : lng,
    coordinateAccuracy: online && !hybrid ? "unavailable" : accuracy,
    formats: hybrid
      ? ["in-person", "online", "hybrid"]
      : online
        ? ["online"]
        : ["in-person"],
    website: url,
    sourceUrl: url,
    accessibility: types.some((t: string) => ["X", "WA"].includes(t))
      ? ["Wheelchair access"]
      : [],
    languages: types.includes("S")
      ? ["Spanish"]
      : types.includes("EN")
        ? ["English"]
        : [],
    populations: types
      .filter((t: string) => ["O", "C", "M", "W", "YP", "LGBTQ"].includes(t))
      .map(
        (t: string) =>
          ({
            O: "Open meeting",
            C: "Closed meeting",
            M: "Men",
            W: "Women",
            YP: "Young people",
            LGBTQ: "LGBTQ+",
          })[t],
      ),
    meeting: {
      days,
      time,
      duration: duration > 0 && duration <= 720 ? duration : null,
      timezone,
      joinUrl: null,
      notes:
        "Use the official source page for current venue and online joining instructions.",
    },
  });
  if (/^\d{4}-\d{2}-\d{2}/.test(m.updated || ""))
    r.sourceUpdatedAt = m.updated.slice(0, 10);
  const result = resourceSchema.safeParse(r);
  return result.success ? result.data : null;
}

/** Daily static BMLT export: no live aggregator calls or private contact fields. */
export function normalizeBmlt(m: Row, today: string): Resource | null {
  const state = stateOf(m.location_province);
  if (!state || String(m.published) === "0") return null;
  const nation = clean(m.location_nation).toUpperCase();
  if (
    nation &&
    /^(CA|CAN|CANADA|AU|AUS|AUSTRALIA|UK|GB|UNITED KINGDOM|NZ|NEW ZEALAND|MEXICO|MX)$/.test(
      nation,
    )
  )
    return null;
  const lat = Number(m.latitude),
    lng = Number(m.longitude);
  const inUS =
    (lat >= 24 && lat <= 50 && lng >= -125 && lng <= -66) ||
    (state === "AK" && lat >= 50 && lat <= 72) ||
    (state === "HI" && lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154) ||
    (state === "PR" && lat >= 17 && lat <= 19 && lng >= -68 && lng <= -65) ||
    (state === "GU" && lat >= 13 && lat <= 14 && lng >= 144 && lng <= 146) ||
    (state === "VI" && lat >= 17 && lat <= 19 && lng >= -66 && lng <= -64);
  if (!inUS) return null;
  const timezone = zone(m.time_zone, lat, lng),
    day = Number(m.weekday_tinyint) - 1,
    time = clean(m.start_time).slice(0, 5);
  if (
    !timezone ||
    day < 0 ||
    day > 6 ||
    !Number.isInteger(day) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    return null;
  const online = Number(m.venue_type) === 2,
    hybrid = Number(m.venue_type) === 3;
  const page = https(m.root_server_uri) || "https://www.na.org/meetingsearch/";
  const source = { id: "bmlt", page, fellowship: "NA" },
    r = base(source, today);
  const duration = clean(m.duration_time).split(":").map(Number),
    minutes = duration[0] * 60 + duration[1];
  Object.assign(r, {
    id:
      "na-region-" +
      hash(
        clean(m.root_server_uri) +
          "|" +
          (clean(m.source_id) || clean(m.id_bigint)),
      ),
    name: clean(m.meeting_name).slice(0, 220),
    address: online ? "" : clean(m.location_street).slice(0, 300),
    city: clean(m.location_municipality).slice(0, 100),
    state,
    zip: clean(m.location_postal_code_1).match(/^\d{5}/)?.[0] || "",
    lat: online ? null : lat,
    lng: online ? null : lng,
    coordinateAccuracy: online ? "unavailable" : "address",
    formats: hybrid
      ? ["in-person", "online", "hybrid"]
      : online
        ? ["online"]
        : ["in-person"],
    sourceName: ("BMLT Aggregator · " + clean(m.service_body_name)).slice(
      0,
      160,
    ),
    website: "https://www.na.org/meetingsearch/",
    sourceUrl: "https://www.na.org/meetingsearch/",
    meeting: {
      days: [day],
      time,
      duration: minutes > 0 && minutes <= 720 ? minutes : null,
      timezone,
      joinUrl: null,
      notes:
        "Published by " +
        clean(m.service_body_name).slice(0, 160) +
        " through the BMLT Aggregator daily export. Confirm current details with the publishing NA service body.",
    },
  });
  const result = resourceSchema.safeParse(r);
  return result.success ? result.data : null;
}

export function normalizeOnlineIntergroup(
  m: Row,
  today: string,
): Resource | null {
  const instant = new Date(m.timeUTC || m.nextEventUTC),
    timezone = zone(m.timezone, null, null);
  if (!timezone || !Number.isFinite(instant.getTime()) || !m.slug) return null;
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: string) => p.find((x) => x.type === type)?.value;
  const r = normalizeMeetingGuide(
    {
      name: m.name,
      day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
        part("weekday")!,
      ),
      time: part("hour") + ":" + part("minute"),
      timezone,
      attendance_option: "online",
      types: [m.type, ...(m.communities || [])],
      slug: m.slug,
    },
    {
      id: "oiaa",
      page: "https://aa-intergroup.org/meetings/",
      fellowship: "AA",
      nationalOnline: true,
    },
    today,
  );
  if (!r) return null;
  r.id = "oiaa-" + hash(m.slug);
  r.sourceName =
    "Online Intergroup of Alcoholics Anonymous · Code for Recovery Central";
  r.meeting!.duration =
    Number(m.duration) > 0 && Number(m.duration) <= 720
      ? Number(m.duration)
      : null;
  const names: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    it: "Italian",
    pt: "Portuguese",
    ja: "Japanese",
    ko: "Korean",
    ru: "Russian",
    pl: "Polish",
    hi: "Hindi",
  };
  r.languages = (m.languages || [])
    .map((s: string) => names[s] || s)
    .filter((s: string) => s.length <= 80);
  return resourceSchema.parse(r);
}
