import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import zipcodes from "zipcodes";
import { neon } from "@neondatabase/serverless";
import { resourceSchema, type Resource } from "../src/lib/types";
import {
  regionStates,
  stateNames,
  isRegionState,
  type RegionState,
} from "../src/lib/region";
const sql = neon(process.env.DATABASE_URL!),
  today = "2026-10-26",
  clean = (s: unknown) =>
    String(s ?? "")
      .replace(/\s+/g, " ")
      .trim(),
  token = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ""),
  hash = (s: string) =>
    createHash("sha256").update(s).digest("hex").slice(0, 20),
  canonical = (s: string) => {
    const u = new URL(s);
    u.search = "";
    u.hash = "";
    return u.href.replace(/\/$/, "");
  };
const existing =
  await sql`SELECT data FROM resources WHERE published AND data->>'kind'='meeting'`;
const signature = (r: Resource) =>
  [
    r.fellowship,
    token(r.name),
    token(r.address.split(",")[0]),
    token(r.city),
    r.state,
    r.meeting?.days[0],
    r.meeting?.time,
  ].join("|");
const seen = new Set(existing.map((r) => signature(r.data)));
const urls = new Set(
  existing
    .filter((r) => /\/meetings\//.test(r.data.sourceUrl))
    .map((r) => canonical(r.data.sourceUrl)),
);
const rows: Resource[] = [],
  review: unknown[] = [];
const base: Resource = {
  id: "pending",
  name: "Pending",
  kind: "meeting",
  categories: ["meetings"],
  address: "",
  city: "",
  state: "MA",
  zip: "",
  lat: null,
  lng: null,
  coordinateAccuracy: "unavailable",
  phone: "",
  website: "https://www.aa.org/",
  description: "Published peer-support meeting.",
  services: ["Peer support"],
  formats: ["in-person"],
  fellowship: "AA",
  languages: [],
  accessibility: [],
  populations: [],
  hours: "Recurring schedule; confirm on the official source page.",
  intake:
    "Check the official meeting page for current attendance instructions and any participant restrictions.",
  payment: ["Free / donations"],
  paymentNote:
    "Peer support; insurance is not required. Confirm any meeting-specific details with the group.",
  insurance: [],
  sourceUrl: "https://www.aa.org/",
  sourceName: "Official public meeting directory",
  sourceCheckedAt: today,
  verifiedAt: null,
  sourceUpdatedAt: null,
  meeting: null,
  availability: "Schedule reported; confirm with group",
};
function place(r: Resource) {
  if (r.lat !== null) return;
  const z = zipcodes.lookup(r.zip),
    zs = z?.state === r.state ? [z] : zipcodes.lookupByName(r.city, r.state);
  if (zs.length) {
    r.lat = zs.reduce((n, z) => n + z.latitude, 0) / zs.length;
    r.lng = zs.reduce((n, z) => n + z.longitude, 0) / zs.length;
    r.coordinateAccuracy = "approximate";
  }
}
function add(r: Resource) {
  r.name = r.name.slice(0, 220);
  r.address = r.address.slice(0, 300);
  if (r.formats.includes("online") && !r.formats.includes("hybrid")) {
    r.address = "";
    r.lat = r.lng = null;
    r.coordinateAccuracy = "unavailable";
  } else place(r);
  if (
    r.lat !== null &&
    (r.lat < 38.8 || r.lat > 47.6 || r.lng! < -80.6 || r.lng! > -66.8)
  ) {
    review.push({
      id: r.id,
      reason: "Source coordinates outside the covered region",
    });
    return;
  }
  if (
    seen.has(signature(r)) ||
    (urls.has(canonical(r.sourceUrl)) && /\/meetings\//.test(r.sourceUrl))
  )
    return;
  resourceSchema.parse(r);
  seen.add(signature(r));
  if (/\/meetings\//.test(r.sourceUrl)) urls.add(canonical(r.sourceUrl));
  rows.push(r);
}
const fallback: Record<string, RegionState> = {
  "aa-nh": "NH",
  "aa-ny": "NY",
  "aa-pa": "PA",
  "aa-lehigh": "PA",
  "aa-south-nj": "NJ",
  "aa-ri-all": "RI",
  "aa-buffalo": "NY",
  "aa-syracuse": "NY",
};
const manifest = JSON.parse(
  await readFile(".local/northeast/meetings/manifest.json", "utf8"),
);
for (const entry of manifest.filter((e: any) => e.status === "public-feed")) {
  const list = JSON.parse(
    await readFile(`.local/northeast/meetings/${entry.id}.json`, "utf8"),
  );
  for (const m of list) {
    const address = clean(m.formatted_address).replace(/, USA$/, ""),
      match = address.match(
        /,\s*(CT|MA|ME|NH|NJ|NY|PA|RI|VT)(?:\s+(\d{5}))?(?:,|$)/i,
      );
    const state = match
      ? (match[1].toUpperCase() as RegionState)
      : (regionStates.find((s) =>
          (m.regions ?? [m.region]).includes(stateNames[s]),
        ) ??
        entry.state ??
        fallback[entry.id]);
    if (!isRegionState(state ?? "")) continue;
    const online = m.attendance_option === "online",
      hybrid = m.attendance_option === "hybrid";
    if ((m.types ?? []).includes("TC") && !online) continue;
    if (
      m.timezone &&
      !["America/New_York", "US/Eastern"].includes(m.timezone)
    ) {
      review.push({
        source: entry.id,
        id: m.id,
        reason: "Source timezone requires review",
      });
      continue;
    }
    if (
      !Number.isInteger(Number(m.day)) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(m.time ?? "")
    ) {
      review.push({
        source: entry.id,
        id: m.id,
        reason: "Missing recurrence schedule",
      });
      continue;
    }
    const city =
      address.match(/,\s*([^,]+),\s*[A-Z]{2}\b/)?.[1] ??
      (online
        ? "Regional online meeting"
        : clean(m.region) || stateNames[state]);
    const start = Number(m.time.slice(0, 2)) * 60 + Number(m.time.slice(3)),
      end = m.end_time
        ? Number(m.end_time.slice(0, 2)) * 60 + Number(m.end_time.slice(3))
        : NaN,
      duration = (end - start + 1440) % 1440;
    const sourceUrl = canonical(m.url),
      types = m.types ?? [];
    add({
      ...base,
      id: "meeting-" + hash(sourceUrl),
      name: clean(m.name),
      address,
      city: city.slice(0, 100),
      state,
      zip: match?.[2] ?? "",
      lat: online ? null : Number(m.latitude) || null,
      lng: online ? null : Number(m.longitude) || null,
      coordinateAccuracy: online
        ? "unavailable"
        : m.approximate === "yes"
          ? "approximate"
          : "address",
      formats: hybrid
        ? ["in-person", "online", "hybrid"]
        : online
          ? ["online"]
          : ["in-person"],
      website: sourceUrl,
      sourceUrl,
      sourceName:
        entry.fellowship === "AA"
          ? "AA official directory · " + new URL(entry.url).hostname
          : entry.fellowship + " official public meeting feed",
      fellowship: entry.fellowship,
      description: `${entry.fellowship} peer-support meeting published in its official meeting directory. Confirm current schedule, location and joining details with the group.`,
      languages: types.includes("EN")
        ? ["English"]
        : types.includes("S")
          ? ["Spanish"]
          : [],
      accessibility: types.some((t: string) => ["X", "WA"].includes(t))
        ? ["Wheelchair access"]
        : [],
      populations: types
        .filter((t: string) => ["M", "W", "LGBTQ", "YP", "C", "O"].includes(t))
        .map(
          (t: string) =>
            ({
              M: "Men",
              W: "Women",
              LGBTQ: "LGBTQ",
              YP: "Young people",
              C: "Closed meeting",
              O: "Open meeting",
            })[t]!,
        ),
      sourceUpdatedAt: /^\d{4}-\d{2}-\d{2}/.test(m.updated ?? "")
        ? m.updated.slice(0, 10)
        : null,
      meeting: {
        days: [Number(m.day)],
        time: m.time,
        duration: duration > 0 && duration <= 720 ? duration : null,
        timezone: "America/New_York",
        joinUrl: null,
        notes:
          "See the original meeting page for current attendance, location access and joining instructions.",
      },
    });
  }
}
for (const [id, fallbackState] of [
  ["aa-ct", "CT"],
  ["aa-vt-all", "VT"],
  ["aa-maine-all", "ME"],
  ["aa-downeast-all", "ME"],
] as const) {
  const $ = load(
    await readFile(`.local/northeast/meetings/${id}.html`, "utf8"),
  );
  for (const tr of $("tr").toArray()) {
    const row = $(tr),
      url = row.find("td.name a").attr("href"),
      sort = row.find("td.time").attr("data-sort") ?? "",
      time = sort.match(/^([0-6])-(\d{2}:\d{2})-/);
    if (!url || !time) continue;
    const addrSort = row.find("td.address").attr("data-sort") ?? "";
    if (/-canada-/i.test(addrSort)) {
      review.push({
        source: id,
        url,
        reason: "Physical meeting outside the covered states",
      });
      continue;
    }
    const stateMatch = addrSort.match(
        /-(ct|ma|me|nh|nj|ny|pa|ri|vt)(?:-(\d{5})(?:-\d{4})?)?-usa-/i,
      ),
      state = (stateMatch?.[1]?.toUpperCase() ?? fallbackState) as RegionState,
      street = row.find("td.address").text().trim(),
      city = row.find("td.region").text().trim(),
      types = row.find("td.types").text().trim(),
      online = row.hasClass("attendance-online"),
      hybrid = row.hasClass("attendance-hybrid"),
      sourceUrl = canonical(url);
    add({
      ...base,
      id: "meeting-" + hash(sourceUrl),
      name: row.find("td.name a").text().trim(),
      address: online ? "" : `${street}, ${city}, ${state}`,
      city: city || stateNames[state],
      state,
      zip: stateMatch?.[2] ?? "",
      formats: hybrid
        ? ["in-person", "online", "hybrid"]
        : online
          ? ["online"]
          : ["in-person"],
      website: sourceUrl,
      sourceUrl,
      sourceName: "AA official directory · " + new URL(url).hostname,
      description:
        "Alcoholics Anonymous peer-support meeting published in the official regional directory. Confirm current attendance details on the original meeting page.",
      accessibility: /Wheelchair Access/i.test(types)
        ? ["Wheelchair access"]
        : [],
      populations: types
        .split(",")
        .map((s) => s.trim())
        .filter((s) =>
          ["Men", "Women", "Young People", "Closed", "Open", "LGBTQ"].includes(
            s,
          ),
        ),
      meeting: {
        days: [Number(time[1])],
        time: time[2],
        duration: null,
        timezone: "America/New_York",
        joinUrl: null,
        notes:
          "Published meeting formats: " +
          types +
          ". Check the source for duration and current joining/location details.",
      },
    });
  }
}
const na = JSON.parse(
  await readFile(".local/northeast/na-regional.json", "utf8"),
);
for (const m of na.meetings) {
  if (!isRegionState(m.location_province) || m.published === "0") continue;
  const venue = Number(m.venue_type);
  if (![1, 2, 3].includes(venue)) continue;
  const day = Number(m.weekday_tinyint) - 1,
    time = clean(m.start_time).slice(0, 5);
  if (day < 0 || day > 6 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) continue;
  const root = clean(m.root_server_uri),
    sourceId = clean(m.source_id) || clean(m.id_bigint),
    online = venue === 2,
    parts = clean(m.duration_time).split(":").map(Number),
    duration = parts[0] * 60 + parts[1],
    keys = clean(m.formats).split(","),
    state = m.location_province;
  add({
    ...base,
    id: "na-region-" + hash(root + "|" + sourceId),
    name: clean(m.meeting_name),
    state,
    city: clean(m.location_municipality) || stateNames[state],
    address: online
      ? ""
      : `${clean(m.location_street)}, ${clean(m.location_municipality)}, ${state} ${clean(m.location_postal_code_1)}`,
    zip:
      clean(m.location_postal_code_1)
        .slice(0, 5)
        .match(/^\d{5}$/)?.[0] ?? "",
    lat: online ? null : Number(m.latitude) || null,
    lng: online ? null : Number(m.longitude) || null,
    coordinateAccuracy: online ? "unavailable" : "address",
    formats:
      venue === 3
        ? ["in-person", "online", "hybrid"]
        : online
          ? ["online"]
          : ["in-person"],
    fellowship: "NA",
    website: "https://usa-na.org/find-na/",
    sourceUrl: "https://usa-na.org/find-na/",
    sourceName: "NA USA / public BMLT regional meeting aggregate",
    description:
      "Narcotics Anonymous peer-support meeting from the public regional BMLT services used by the NA USA finder. Confirm the current schedule and attendance instructions with the source.",
    accessibility: keys.includes("WC") ? ["Wheelchair access"] : [],
    meeting: {
      days: [day],
      time,
      duration: duration > 0 && duration <= 720 ? duration : null,
      timezone: "America/New_York",
      joinUrl: null,
      notes:
        "See the official finder for the local NA service body, meeting location and current joining details.",
    },
  });
}
const smartStates = Object.fromEntries(
  Object.entries(stateNames).map(([code, name]) => [name, code]),
);
const smartUrls = JSON.parse(
  await readFile(".local/northeast/smart/urls.json", "utf8"),
);
for (const [url, stateName] of smartUrls) {
  const id = url.match(/meetings\/(\d+)/)?.[1];
  if (!id) continue;
  const state = smartStates[stateName] as RegionState,
    $ = load(
      await readFile(`.local/northeast/smart/meeting-${id}.html`, "utf8"),
    ),
    cal = $(".addeventatc"),
    start = cal.find(".start").text().trim(),
    end = cal.find(".end").text().trim(),
    zone = cal.find(".timezone").text().trim(),
    rule = cal.find(".recurring").text().trim();
  if (zone !== "America/New_York" || !rule.startsWith("FREQ=WEEKLY;BYDAY=")) {
    review.push({
      source: "SMART",
      id,
      reason: "Non-weekly or non-Eastern schedule requires review",
    });
    continue;
  }
  const days = rule
    .split("BYDAY=")[1]
    .split(";")[0]
    .split(",")
    .map((d) => ["SU", "MO", "TU", "WE", "TH", "FR", "SA"].indexOf(d));
  const city =
      $("title")
        .text()
        .match(/Meeting #\d+ (.*), /)?.[1] || stateNames[state],
    link = $("a[href]")
      .toArray()
      .map((e) => $(e).attr("href"))
      .find((h) => h?.startsWith("https://www.google.com/maps/dir//")),
    address = link
      ? decodeURIComponent(link.split("/dir//")[1].split("?")[0])
      : "",
    online = !address,
    zip = address.match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1] ?? "",
    text = cal.find(".description").text().replace(/\s+/g, " ").trim(),
    program =
      text.match(/Program: (.*?) Audiences:/)?.[1] ?? "Recovery support",
    audience = text.match(/Audiences: (.*?) Languages spoken:/)?.[1] ?? "",
    duration =
      (Date.parse(end.replace(" ", "T") + "Z") -
        Date.parse(start.replace(" ", "T") + "Z")) /
      60000;
  add({
    ...base,
    id: "smart-" + id,
    name: `SMART Recovery · ${program} — ${city} #${id}`,
    city,
    state,
    address,
    zip,
    formats: online ? ["online"] : ["in-person"],
    fellowship: "SMART Recovery",
    website: url,
    sourceUrl: url,
    sourceName: "SMART Recovery official public meeting pages",
    description:
      "SMART Recovery mutual-support meeting from the official meeting finder. Confirm the current schedule, participant eligibility and joining instructions on the original meeting page.",
    services: ["Peer support", program],
    languages: text.includes("Languages spoken: English") ? ["English"] : [],
    populations: audience ? [audience] : [],
    meeting: {
      days,
      time: start.slice(11, 16),
      duration: duration > 0 && duration <= 720 ? duration : null,
      timezone: "America/New_York",
      joinUrl: null,
      notes:
        "Schedule follows the source’s named local calendar time zone. See the official meeting page for access instructions.",
    },
  });
}
await writeFile(
  ".local/northeast/resources-meetings.json",
  JSON.stringify(rows),
);
await writeFile(
  ".local/northeast/meeting-review.json",
  JSON.stringify(review, null, 2),
);
console.log({
  newMeetings: rows.length,
  byState: Object.fromEntries(
    regionStates.map((s) => [s, rows.filter((r) => r.state === s).length]),
  ),
  byApproach: Object.fromEntries(
    [...new Set(rows.map((r) => r.fellowship))].map((s) => [
      s,
      rows.filter((r) => r.fellowship === s).length,
    ]),
  ),
  review: review.length,
});
