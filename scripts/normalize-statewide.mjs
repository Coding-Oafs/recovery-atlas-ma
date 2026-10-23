import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import zipcodes from "zipcodes";
const today = "2026-10-22";
const seed = JSON.parse(await readFile("data/resources.json", "utf8"));
const rows = [],
  ids = new Set(seed.map((r) => r.id));
const title = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const clean = (s) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
const hash = (s) =>
  createHash("sha256")
    .update(s.toLowerCase().replace(/[^a-z0-9]/g, ""))
    .digest("hex")
    .slice(0, 12);
const empty = {
  kind: "clinic",
  categories: ["treatment"],
  address: "",
  city: "",
  state: "MA",
  zip: "",
  lat: null,
  lng: null,
  coordinateAccuracy: "unavailable",
  phone: "",
  website: "",
  description: "",
  services: [],
  formats: ["in-person"],
  fellowship: null,
  languages: [],
  accessibility: [],
  populations: [],
  hours: "Not reported; confirm with provider.",
  intake:
    "Contact the provider for intake, eligibility and current appointment availability.",
  payment: [],
  insurance: [],
  paymentNote:
    "Insurance participation and payment details are not reported by this source. Confirm the exact provider, location, service and plan with the provider and insurer.",
  sourceUrl: "",
  sourceName: "",
  sourceCheckedAt: today,
  verifiedAt: null,
  sourceUpdatedAt: null,
  meeting: null,
  availability: "Not reported",
};
function locate(r) {
  if (r.lat !== null) return;
  const z = zipcodes.lookup(r.zip);
  if (z?.state === "MA") {
    r.lat = z.latitude;
    r.lng = z.longitude;
    r.coordinateAccuracy = "approximate";
    return;
  }
  const city = zipcodes.lookupByName(r.city, "MA");
  if (city.length) {
    r.lat = city.reduce((n, z) => n + z.latitude, 0) / city.length;
    r.lng = city.reduce((n, z) => n + z.longitude, 0) / city.length;
    r.coordinateAccuracy = "approximate";
  }
}
function add(r) {
  r.id=r.id.toLowerCase();
  if (ids.has(r.id)) return;
  if (r.name.length > 220) r.name = r.name.slice(0, 220);
  if (r.address.length > 300) r.address = r.address.slice(0, 300);
  locate(r);
  rows.push(r);
  ids.add(r.id);
}
const programs = JSON.parse(
  await readFile(".local/sources/bsas-programs.json", "utf8"),
);
for (const p of programs) {
  if (p.Licensed !== "Yes") continue;
  const city = clean(p.city).replace(/^(?:In)?active City\s*/i, "");
  const address = clean(p.Address);
  const zip = address.match(/\bMA\s+(\d{5})/)?.[1] ?? "";
  const setting = p["Service Setting"];
  const normalizedName = clean(p["Program name"]);
  const preferred = seed.find(
    (r) =>
      r.city.toLowerCase() === city.toLowerCase() &&
      (r.name.toLowerCase().includes(normalizedName.toLowerCase()) ||
        normalizedName.toLowerCase().includes(r.name.toLowerCase())),
  );
  if (preferred) continue;
  const service =
    setting === "Residential Rehabilitation"
      ? "Residential treatment"
      : setting === "Opioid Treatment"
        ? "Opioid treatment"
        : setting === "Outpatient Services"
          ? "Outpatient care"
          : "Acute treatment / stabilization";
  const source = p.sourceUrl;
  let website = p.website;
  if (!/^https:\/\//i.test(website)) website = source;
  add({
    ...empty,
    id: "bsas-" + p.key,
    name: normalizedName,
    kind: "treatment",
    categories: ["treatment"],
    address,
    city,
    zip,
    phone: clean(p.Phone),
    website,
    sourceUrl: source,
    sourceName: "Massachusetts BSAS public program directory",
    description: `State directory listing for ${p["Organization name"]}. Published service setting: ${setting}. The state source lists this program as licensed; confirm current access and eligibility before traveling.`,
    services: [
      service,
      ...(setting === "Opioid Treatment" ? ["Medication treatment"] : []),
    ],
    intake: /correction|jail|sheriff|prison/i.test(
      normalizedName + " " + p["Organization name"],
    )
      ? "This is an institutional/correctional program and may be restricted to that population. Confirm access with the program."
      : empty.intake,
    populations: /correction|jail|sheriff|prison/i.test(
      normalizedName + " " + p["Organization name"],
    )
      ? ["Restricted institutional setting"]
      : [],
  });
}
const hospital = JSON.parse(
  await readFile(".local/sources/hospitals.json", "utf8"),
);
for (const { attributes: a, geometry: g } of hospital.features) {
  if (!(
    Number(a.PSYCHIATRIC) > 0 ||
    Number(a.PSYCH_LOCK) > 0 ||
    Number(a.PSYCH_UNLOCK) > 0
  ))
    continue;
  if (
    seed.some(
      (r) =>
        r.kind === "hospital" &&
        r.city.toUpperCase() === a.MUNICIPALITY &&
        (r.name
          .toLowerCase()
          .includes(a.FACILITY_NAME.toLowerCase().split(" — ")[0]) ||
          a.FACILITY_NAME.toLowerCase().includes(
            r.name.toLowerCase().replace(" — belmont", ""),
          )),
    )
  )
    continue;
  const source = "https://www.mass.gov/info-details/massgis-data-hospitals";
  add({
    ...empty,
    id: "massgis-hospital-" + a.DPH_FACILITY_ID,
    name: a.FACILITY_NAME,
    kind: "hospital",
    categories: ["mental-health"],
    address: `${a.STREET_ADDRESS}, ${title(a.MUNICIPALITY)}, MA ${a.ZIP_CODE}`,
    city: title(a.MUNICIPALITY),
    zip: a.ZIP_CODE,
    lat: g.y,
    lng: g.x,
    coordinateAccuracy: "address",
    phone: clean(a.PHONE),
    website: source,
    sourceUrl: source,
    sourceName: "MassGIS / Massachusetts DPH hospital dataset",
    sourceUpdatedAt: "2026-09-03",
    description:
      "Hospital with psychiatric beds reported in the state hospital dataset. Bed counts describe licensed capacity, not current availability. Source credit: MassGIS (Bureau of Geographic Information), Commonwealth of Massachusetts EOTSS.",
    services: ["Hospital psychiatric services"],
    intake:
      "Call the hospital to confirm the relevant unit, referral/admission process and current availability. This map does not establish walk-in admission.",
  });
}
const na = JSON.parse(await readFile(".local/sources/na-all.json", "utf8"));
const formatNames = new Map(
  na.formats.map((f) => [f.key_string, f.name_string]),
);
for (const m of na.meetings) {
  if (m.location_province !== "MA" || m.published !== "1") continue;
  const venue = Number(m.venue_type),
    online = venue === 2;
  const source = "https://nerna.org/find-a-meeting/";
  const formats =
    venue === 3
      ? ["in-person", "online", "hybrid"]
      : online
        ? ["online"]
        : ["in-person"];
  const keys = m.formats.split(",");
  const mins = m.duration_time.split(":").map(Number);
  const time = m.start_time.slice(0, 5);
  const day = Number(m.weekday_tinyint) - 1;
  if (!/^[0-2]\d:[0-5]\d$/.test(time) || day < 0 || day > 6)
    throw Error("Invalid NA schedule " + m.id_bigint);
  const r = {
    ...empty,
    id: "na-nerna-" + m.id_bigint,
    name: clean(m.meeting_name),
    kind: "meeting",
    categories: ["meetings"],
    address: online
      ? ""
      : `${m.location_street}, ${m.location_municipality}, MA ${m.location_postal_code_1}`.slice(
          0,
          300,
        ),
    city: clean(m.location_municipality) || "Massachusetts",
    zip:
      (m.location_postal_code_1 ?? "").slice(0, 5).match(/^\d{5}$/)?.[0] ?? "",
    lat: online ? null : Number(m.latitude) || null,
    lng: online ? null : Number(m.longitude) || null,
    coordinateAccuracy: online ? "unavailable" : "address",
    website: source,
    sourceUrl: source,
    sourceName: "NERNA public BMLT meeting service",
    fellowship: "NA",
    formats,
    description:
      "Narcotics Anonymous peer-support meeting published by the New England regional meeting service. Confirm current details with the official directory.",
    services: [
      "Peer support",
      ...keys
        .filter((k) => ["B", "D", "SP", "BT"].includes(k))
        .map((k) => formatNames.get(k))
        .filter(Boolean),
    ],
    payment: ["Free / donations"],
    paymentNote: "Peer-support meeting; insurance is not required.",
    accessibility: keys.includes("WC") ? ["Wheelchair access"] : [],
    populations: keys.includes("C")
      ? ["Closed meeting"]
      : keys.includes("O")
        ? ["Open meeting"]
        : [],
    meeting: {
      days: [day],
      time,
      duration: mins[0] * 60 + mins[1],
      timezone: "America/New_York",
      joinUrl: null,
      notes:
        "Joining and location details are maintained by the regional meeting service. Venue: " +
        clean(m.location_text),
    },
  };
  if (online) {
    rows.push(r);
    ids.add(r.id);
  } else add(r);
}
const nppes = JSON.parse(
  await readFile(".local/sources/nppes-providers.json", "utf8"),
);
const selected = (t) =>
  /^103T|^101Y|^1041C|^106H|^363LP|^2084P|^2084A|^2083A|^207RA|^207QA/.test(
    t.code,
  );
for (const p of nppes) {
  const a = p.addresses.find(
    (a) => a.address_purpose === "LOCATION" && a.state === "MA",
  );
  if (!a) continue;
  const first = clean(p.basic.first_name),
    last = clean(p.basic.last_name);
  if (
    seed.some(
      (r) =>
        r.kind === "provider" &&
        r.name.toLowerCase().includes(first.toLowerCase()) &&
        r.name.toLowerCase().includes(last.toLowerCase()),
    )
  )
    continue;
  const tax = p.taxonomies.filter(selected);
  const relevant = tax.find((t) => t.primary) ?? tax[0];
  if (!relevant) continue;
  const providerName =
    title([first, p.basic.middle_name, last].filter(Boolean).join(" ")) +
    (p.basic.credential ? ", " + p.basic.credential : "");
  const source = "https://npiregistry.cms.hhs.gov/provider-view/" + p.number;
  const counseling = /^103T|^101Y|^1041C|^106H/.test(relevant.code);
  add({
    ...empty,
    id: "npi-" + p.number,
    name: providerName,
    kind: "provider",
    categories: counseling
      ? ["mental-health", "counseling"]
      : ["mental-health", "treatment"],
    address: [
      clean(a.address_1),
      clean(a.address_2),
      title(clean(a.city)) + ", MA " + clean(a.postal_code).slice(0, 5),
    ]
      .filter(Boolean)
      .join(", "),
    city: title(clean(a.city)),
    zip:
      clean(a.postal_code)
        .slice(0, 5)
        .match(/^\d{5}$/)?.[0] ?? "",
    phone: clean(a.telephone_number),
    website: source,
    sourceUrl: source,
    sourceName: "NPPES public provider registry",
    sourceUpdatedAt: p.basic.last_updated?.slice(0, 10) || null,
    description: `Provider-registry entry reporting ${relevant.desc ?? "mental health or addiction services"}. Active NPI status is not professional license verification, current availability or insurance confirmation. Call to confirm this practice location and the services offered.`,
    services: [
      counseling ? "Therapy / counseling" : "Psychiatric care",
      ...new Set(
        tax
          .map((t) => t.desc)
          .filter((s) => typeof s === "string" && s.length <= 100),
      ),
    ].slice(0, 20),
    intake:
      "Registry record only. Independently confirm professional licensure, current practice address, appointment availability, clinical fit and insurance participation before arranging care.",
  });
}
await mkdir(".local/imports", { recursive: true });
await writeFile(
  ".local/imports/statewide-resources.json",
  JSON.stringify(rows),
);
const summary = {
  reviewedAt: today,
  curated: seed.length,
  importable: rows.length,
  bySource: Object.fromEntries(
    [...new Set(rows.map((r) => r.sourceName))].map((s) => [
      s,
      rows.filter((r) => r.sourceName === s).length,
    ]),
  ),
  addressPins: rows.filter((r) => r.coordinateAccuracy === "address").length,
  approximatePins: rows.filter((r) => r.coordinateAccuracy === "approximate")
    .length,
  onlineOnly: rows.filter(
    (r) =>
      r.kind === "meeting" &&
      r.formats.length === 1 &&
      r.formats[0] === "online",
  ).length,
  unmappedPhysical: rows
    .filter(
      (r) =>
        r.lat === null &&
        !(
          r.kind === "meeting" &&
          r.formats.length === 1 &&
          r.formats[0] === "online"
        ),
    )
    .map((r) => ({ id: r.id, address: r.address })),
};
await writeFile(
  ".local/imports/summary.json",
  JSON.stringify(summary, null, 2),
);
console.log(
  JSON.stringify(
    { ...summary, unmappedPhysical: summary.unmappedPhysical.length },
    null,
    2,
  ),
);
