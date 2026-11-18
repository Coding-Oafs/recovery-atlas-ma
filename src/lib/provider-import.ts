import { createHash } from "node:crypto";
import zipcodes from "zipcodes";
import { resourceSchema, type Resource } from "./types";
import { isRegionState } from "./region";
type ProviderRow = {
  siteKey?: string;
  npi: string;
  entity: string;
  organization: string;
  first: string;
  middle?: string;
  last: string;
  credential?: string;
  address: string;
  address2?: string;
  city: string;
  state: string;
  postal: string;
  phone?: string;
  updated?: string;
  taxonomies: { code: string; label: string }[];
};
const clean = (v: unknown) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
export const clinicalTaxonomy = (t: { code: string; label: string }) =>
  /^(101Y|103T|1041|106H|102L|103G)/.test(t.code) ||
  (!/Behavior (?:Technician|Analyst)|Assistant Behavior/i.test(t.label) &&
    /psychiatr|psycholog|addiction|substance (?:abuse|use)|mental health|psych\/mental/i.test(
      t.label,
    ));
const geoCache = new Map<string, { lat: number; lng: number } | null>();
export function practicePoint(city: string, state: string, zip: string) {
  const key = state + "|" + zip + "|" + city.toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key)!;
  const z = zipcodes.lookup(zip),
    matches = z?.state === state ? [z] : zipcodes.lookupByName(city, state);
  const point = matches.length
    ? {
        lat: matches.reduce((n, z) => n + z.latitude, 0) / matches.length,
        lng: matches.reduce((n, z) => n + z.longitude, 0) / matches.length,
      }
    : null;
  geoCache.set(key, point);
  return point;
}
export function providerAddressKey(
  address: string,
  city: string,
  state: string,
  zip: string,
) {
  return createHash("md5")
    .update(
      [address, city, state, zip].map((v) => clean(v).toLowerCase()).join("|"),
    )
    .digest("hex");
}
export function normalizeNationalProvider(
  row: ProviderRow,
  checkedAt: string,
): Resource | null {
  if (!/^\d{10}$/.test(row.npi) || !isRegionState(row.state)) return null;
  const taxonomy = row.taxonomies.filter(clinicalTaxonomy);
  if (!taxonomy.length) return null;
  const individual = row.entity === "1",
    labels = [...new Set(taxonomy.map((t) => clean(t.label).slice(0, 100)))];
  const addiction = labels.some((t) =>
      /addiction|substance (?:abuse|use)/i.test(t),
    ),
    counseling = taxonomy.some((t) =>
      /^(101Y|103T|1041|106H|102L|103G)/.test(t.code),
    );
  const name = clean(
    individual
      ? [row.first, row.middle, row.last].filter(Boolean).join(" ")
      : row.organization,
  );
  const address = clean([row.address, row.address2].filter(Boolean).join(", ")),
    city = clean(row.city),
    zip = clean(row.postal).match(/^\d{5}/)?.[0] || "";
  if (name.length < 2 || !address || !city) return null;
  const point = practicePoint(city, row.state, zip),
    sourceUrl = "https://npiregistry.cms.hhs.gov/provider-view/" + row.npi;
  const updated = row.updated?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const r: Resource = {
    id: "npi-" + row.npi + (row.siteKey ? "-site-" + row.siteKey : ""),
    name: name.slice(0, 220),
    kind: individual ? "provider" : addiction ? "treatment" : "clinic",
    categories: [
      ...(addiction ? ["treatment" as const] : []),
      "mental-health",
      ...(counseling ? ["counseling" as const] : []),
    ],
    country: "US",
    address: address.slice(0, 300),
    city: city.slice(0, 100),
    state: row.state,
    zip,
    lat: point?.lat ?? null,
    lng: point?.lng ?? null,
    coordinateAccuracy: point ? "approximate" : "unavailable",
    phone: clean(row.phone).slice(0, 70),
    website: sourceUrl,
    sourceUrl,
    sourceName: "NPPES national public provider registry",
    sourceCheckedAt: checkedAt,
    sourceUpdatedAt: updated
      ? updated[3] + "-" + updated[1] + "-" + updated[2]
      : null,
    verifiedAt: null,
    description:
      "Public NPPES practice-location registry record. Taxonomies are registry-reported classifications. Confirm services, professional licensure, appointment availability and whether care is offered at this address directly with the practice.",
    services: labels.slice(0, 30),
    formats: [],
    fellowship: null,
    languages: [],
    accessibility: [],
    populations: [],
    hours: "Hours are not reported in this registry. Contact the practice.",
    intake:
      "Contact the practice to confirm services, referral requirements and whether it is accepting patients.",
    payment: [],
    paymentNote:
      "Insurance participation, self-pay prices and financial assistance are not reported in this registry.",
    insurance: [],
    meeting: null,
    availability: "Patient availability and attendance mode not reported",
  };
  const parsed = resourceSchema.safeParse(r);
  return parsed.success ? parsed.data : null;
}
