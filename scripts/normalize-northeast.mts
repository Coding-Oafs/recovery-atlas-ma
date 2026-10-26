import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import zipcodes from "zipcodes";
import { resourceSchema, type Resource } from "../src/lib/types";
import { regionStates, isRegionState } from "../src/lib/region";
const today = "2026-10-26",
  clean = (v: unknown) =>
    String(v ?? "")
      .replace(/\s+/g, " ")
      .trim(),
  title = (v: unknown) =>
    clean(v)
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  hash = (s: string) =>
    createHash("sha256")
      .update(s.toLowerCase().replace(/[^a-z0-9]/g, ""))
      .digest("hex")
      .slice(0, 20);
const base: Resource = {
  id: "pending",
  name: "Pending",
  kind: "provider",
  categories: ["mental-health"],
  address: "",
  city: "",
  state: "MA",
  zip: "",
  lat: null,
  lng: null,
  coordinateAccuracy: "unavailable",
  phone: "",
  website: "https://npiregistry.cms.hhs.gov/",
  description: "Public directory listing.",
  services: [],
  formats: ["in-person"],
  fellowship: null,
  languages: [],
  accessibility: [],
  populations: [],
  hours: "Not reported; confirm with provider.",
  intake:
    "Contact the provider to confirm current location, eligibility and intake requirements before traveling.",
  payment: [],
  insurance: [],
  paymentNote:
    "Payment details and insurance participation are not reported by this source. Confirm the exact location, service, provider and plan with the provider and your insurer.",
  sourceUrl: "https://npiregistry.cms.hhs.gov/",
  sourceName: "NPPES public provider registry",
  sourceCheckedAt: today,
  sourceUpdatedAt: null,
  verifiedAt: null,
  meeting: null,
  availability: "Not reported",
};
function locate(r: Resource) {
  const zip = zipcodes.lookup(r.zip);
  const zs =
    zip?.state === r.state ? [zip] : zipcodes.lookupByName(r.city, r.state);
  if (zs.length) {
    r.lat = zs.reduce((n, z) => n + z.latitude, 0) / zs.length;
    r.lng = zs.reduce((n, z) => n + z.longitude, 0) / zs.length;
    r.coordinateAccuracy = "approximate";
  }
  if (
    r.lat !== null &&
    (r.lat < 38.8 || r.lat > 47.6 || r.lng! < -80.6 || r.lng! > -66.8)
  ) {
    r.lat = r.lng = null;
    r.coordinateAccuracy = "unavailable";
  }
}
const relevant = (t: { code: string }) =>
  /^103T|^101Y|^1041C|^106H|^363LP|^2084P|^2084A0391|^2084A0401|^2083A|^207RA|^207QA|^261QM|^261QS1200|^261QR0405|^261QX0200|^3245|^323P|^3208|^322D/.test(
    t.code,
  );
for (const state of regionStates.filter((s) => s !== "MA")) {
  const source = JSON.parse(
    await readFile(`.local/northeast/nppes-${state}.json`, "utf8"),
  );
  const rows: Resource[] = [];
  for (const p of source) {
    const a = p.addresses.find(
      (a: any) => a.address_purpose === "LOCATION" && a.state === state,
    );
    if (!a) continue;
    const tax = p.taxonomies.filter(relevant),
      primary = tax.find((t: any) => t.primary) ?? tax[0];
    if (!primary) continue;
    const organization = p.enumeration_type === "NPI-2",
      substance = tax.some(
        (t: any) =>
          /Addiction|Substance|Methadone/i.test(t.desc ?? "") ||
          /^261QS1200|^261QR0405|^261QX0200|^3245|^3208/.test(t.code),
      ),
      hospital = organization && tax.some((t: any) => /^323P/.test(t.code));
    const name = organization
      ? title(p.basic.organization_name)
      : title(
          [p.basic.first_name, p.basic.middle_name, p.basic.last_name]
            .filter(Boolean)
            .join(" "),
        ) + (p.basic.credential ? ", " + clean(p.basic.credential) : "");
    if (name.length < 2) continue;
    const sourceUrl =
      "https://npiregistry.cms.hhs.gov/provider-view/" + p.number;
    const r: Resource = {
      ...base,
      id: "npi-" + p.number,
      name: name.slice(0, 220),
      kind: organization
        ? hospital
          ? "hospital"
          : substance
            ? "treatment"
            : "clinic"
        : "provider",
      categories: organization
        ? substance
          ? ["treatment"]
          : ["mental-health"]
        : /^103T|^101Y|^1041C|^106H/.test(primary.code)
          ? ["mental-health", "counseling"]
          : ["mental-health", ...(substance ? ["treatment" as const] : [])],
      state,
      address: [
        clean(a.address_1),
        clean(a.address_2),
        title(a.city) + ", " + state + " " + clean(a.postal_code).slice(0, 5),
      ]
        .filter(Boolean)
        .join(", ")
        .slice(0, 300),
      city: title(a.city).slice(0, 100),
      zip:
        clean(a.postal_code)
          .slice(0, 5)
          .match(/^\d{5}$/)?.[0] ?? "",
      phone: clean(a.telephone_number).slice(0, 70),
      website: sourceUrl,
      sourceUrl,
      sourceName: organization
        ? "NPPES public facility registry"
        : "NPPES public provider registry",
      description: `${organization ? "Organization" : "Individual professional"} registry entry reporting ${primary.desc ?? (substance ? "addiction services" : "mental-health services")}. Active NPI status does not verify professional or facility licensure, current location, accepting new patients or insurance participation. Confirm all details before arranging care.`,
      services: [
        organization
          ? substance
            ? "Addiction treatment (registry-reported)"
            : "Mental-health services (registry-reported)"
          : /^103T|^101Y|^1041C|^106H/.test(primary.code)
            ? "Therapy / counseling"
            : "Psychiatric care",
        ...new Set(
          tax
            .map((t: any) => t.desc)
            .filter(
              (s: unknown): s is string =>
                typeof s === "string" && s.length <= 100,
            ),
        ),
      ].slice(0, 30) as string[],
      sourceUpdatedAt: p.basic.last_updated?.slice(0, 10) || null,
      intake:
        "Registry record only. Confirm professional/facility licensure, actual service location, clinical fit, availability, insurance and admission requirements directly.",
    };
    locate(r);
    resourceSchema.parse(r);
    rows.push(r);
  }
  await writeFile(
    `.local/northeast/resources-${state}.json`,
    JSON.stringify(rows),
  );
  console.log(
    "Normalized",
    state,
    rows.length,
    "unmapped",
    rows.filter((r) => r.lat === null).length,
  );
}
const facilities = new Map<string, Resource>();
const selectedServices: Record<string, string> = {
  SA: "Substance use treatment",
  DT: "Detox / withdrawal management",
  MH: "Mental-health treatment",
  SUMH: "Co-occurring substance use and mental-health treatment",
  HI: "Hospital inpatient services",
  OP: "Outpatient care",
  RES: "Residential treatment",
  HID: "Hospital inpatient detoxification",
  OD: "Outpatient detoxification",
  IOP: "Intensive outpatient care",
  PHP: "Partial hospitalization / day treatment",
  RL: "Long-term residential treatment",
  RS: "Short-term residential treatment",
  OTP: "Opioid treatment program",
  MM: "Methadone maintenance",
  BUM: "Buprenorphine maintenance",
  NXN: "Naltrexone treatment",
  HH: "Transitional recovery housing",
  CMHC: "Community mental health center",
  PSY: "Psychiatric hospital",
  SHP: "State psychiatric hospital",
  IPSY: "Hospital psychiatric unit",
  TELE: "Telehealth counseling",
  PEER: "Peer support",
  DBT: "Dialectical behavior therapy",
  CBT: "Cognitive behavioral therapy",
};
const payment: Record<string, string> = {
  MC: "Medicare",
  MD: "Medicaid",
  TRICARE: "TRICARE",
  PI: "Private insurance (plan not specified)",
  CASH: "Self-pay",
  SS: "Sliding scale",
  PA: "Payment assistance",
};
for (const kind of ["su", "mh"]) {
  const source = JSON.parse(
    await readFile(`.local/northeast/samhsa-${kind}.json`, "utf8"),
  );
  for (const p of source.rows) {
    if (!isRegionState(p.state)) continue;
    const codes = new Set<string>(clean(p.service_code_info).split(/[\s*]+/)),
      name = [clean(p.name1), clean(p.name2)]
        .filter(Boolean)
        .join(" — ")
        .slice(0, 220),
      key = hash([p.name1, p.name2, p.street1, p.city, p.state].join("|")),
      old = facilities.get(key);
    const sourceUrl =
      kind === "su"
        ? "https://www.samhsa.gov/data/report/2025-national-directory-drug-and-alcohol-use-treatment"
        : "https://www.samhsa.gov/data/report/2025-national-directory-mental-health-treatment-facilit";
    const services = Object.entries(selectedServices)
        .filter(([c]) => codes.has(c))
        .map(([, s]) => s),
      payments = Object.entries(payment)
        .filter(([c]) => codes.has(c))
        .map(([, s]) => s);
    const r: Resource = {
      ...base,
      id: "samhsa-2025-" + key,
      name,
      kind:
        codes.has("SHP") || codes.has("PSY") || codes.has("HI")
          ? "hospital"
          : kind === "su"
            ? "treatment"
            : "clinic",
      categories: [
        ...(codes.has("SA") ? ["treatment" as const] : []),
        ...(kind === "mh" || codes.has("MH") || codes.has("SUMH")
          ? ["mental-health" as const]
          : []),
      ],
      address: [
        clean(p.street1),
        clean(p.street2),
        `${p.city}, ${p.state} ${p.zip}`,
      ]
        .filter(Boolean)
        .join(", ")
        .slice(0, 300),
      city: clean(p.city),
      state: p.state,
      zip:
        clean(p.zip)
          .padStart(5, "0")
          .match(/^\d{5}$/)?.[0] ?? "",
      phone: clean(p.intake1 || p.phone).slice(0, 70),
      website: sourceUrl,
      sourceUrl,
      sourceName: "SAMHSA 2025 national facility directories",
      description:
        "Facility reported in SAMHSA’s 2025 directory, based on the 2024 facility survey. Services and broad payment categories reflect that dated survey, not a live verification of operation, openings, admission eligibility or insurance networks. Contact the facility before arranging care.",
      services,
      formats: codes.has("TELE") ? ["in-person", "telehealth"] : ["in-person"],
      languages: codes.has("SP") ? ["Spanish"] : [],
      accessibility: codes.has("ASL") ? ["Sign language services"] : [],
      payment: payments,
      paymentNote:
        "The 2025 directory (2024 survey) reports these broad payment categories. No specific commercial plan, current network participation, individual benefits or authorization is confirmed. Contact the facility and your insurer for current details.",
      intake:
        "Use the published intake/contact number to confirm current operations, referral requirements, eligibility, payment and availability. Hospital listings do not establish walk-in admission.",
    };
    if (!r.categories.length) r.categories = ["treatment"];
    if (old) {
      r.categories = [...new Set([...old.categories, ...r.categories])];
      r.services = [...new Set([...old.services, ...r.services])].slice(0, 30);
      r.payment = [...new Set([...old.payment, ...r.payment])];
    }
    locate(r);
    resourceSchema.parse(r);
    facilities.set(key, r);
  }
}
await writeFile(
  ".local/northeast/resources-facilities.json",
  JSON.stringify([...facilities.values()]),
);
console.log("National facility records", facilities.size);
