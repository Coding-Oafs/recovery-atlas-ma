import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import zipcodes from "zipcodes";
import { resourceSchema, type Resource } from "../src/lib/types";
import { isRegionState } from "../src/lib/region";
const input = JSON.parse(
    await readFile(".local/northeast/oasas-programs.json", "utf8"),
  ),
  template = JSON.parse(
    await readFile(".local/northeast/resources-facilities.json", "utf8"),
  )[0],
  rows: Resource[] = [],
  seen = new Set();
const clean = (s: unknown) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
for (const p of input) {
  if (!isRegionState(p.PROGRAM_STATE)) continue;
  const places = [
    {
      street: p.PROGRAM_STREET_ADDRESS,
      city: p.PROGRAM_CITY,
      zip: p.PROGRAM_ZIP_CODE,
    },
    ...(clean(p.ADDITIONAL_LOCATION_STREET)
      ? [
          {
            street: p.ADDITIONAL_LOCATION_STREET,
            city: p.ADDITIONAL_LOCATION_CITY,
            zip: p.ADDITIONAL_LOCATION_ZIP,
          },
        ]
      : []),
  ];
  for (const [i, place] of places.entries()) {
    const state = p.PROGRAM_STATE,
      zip = clean(place.zip).padStart(5, "0").slice(0, 5),
      zs = zipcodes.lookup(zip),
      list =
        zs?.state === state
          ? [zs]
          : zipcodes.lookupByName(clean(place.city), state);
    const id =
      "ny-oasas-" +
      clean(p.PROGRAM_NUMBER) +
      (i
        ? "-" +
          createHash("sha256")
            .update(clean(place.street) + "|" + zip)
            .digest("hex")
            .slice(0, 10)
        : "");
    if (seen.has(id)) continue;
    const r: Resource = {
      ...template,
      id,
      name: clean(p.PROGRAM_NAME).slice(0, 220),
      kind: "treatment",
      categories: ["treatment"],
      address: [
        clean(place.street),
        clean(place.city) + ", " + state + " " + zip,
      ]
        .join(", ")
        .slice(0, 300),
      city: clean(place.city),
      state,
      zip: /^\d{5}$/.test(zip) ? zip : "",
      lat: list.length
        ? list.reduce((n, z) => n + z.latitude, 0) / list.length
        : null,
      lng: list.length
        ? list.reduce((n, z) => n + z.longitude, 0) / list.length
        : null,
      coordinateAccuracy: list.length ? "approximate" : "unavailable",
      phone:
        clean(p.ADMISSION_PHONE) +
        (clean(p.ADMISSION_PHONE_EXT)
          ? " ext " + clean(p.ADMISSION_PHONE_EXT)
          : ""),
      website: "https://webapps.oasas.ny.gov/providerDirectory/",
      description: `New York OASAS public program listing for ${clean(p.PROVIDER_NAME)}. Published service type: ${clean(p.SERVICE_TYPE)}. Confirm current eligibility, admission, location access, insurance and availability directly.`,
      services: [clean(p.PROGRAM_TYPE), clean(p.SERVICE_TYPE)]
        .filter(Boolean)
        .map((s) => s.slice(0, 100)),
      formats:
        p.TELEHEALTH_SERVICES === "Y"
          ? ["in-person", "telehealth"]
          : ["in-person"],
      languages: [],
      accessibility: [],
      populations: [
        ...(p.ADOLESCENT_DESIGNATION === "Y" ? ["Adolescents"] : []),
        ...(p.PARENTS_WITH_CHILDREN === "Y" ? ["Parents with children"] : []),
        ...(p.LGBTQ_ENDORSEMNT === "Y" ? ["LGBTQ"] : []),
      ],
      payment: [],
      insurance: [],
      paymentNote:
        "Insurance participation and payment terms are not reported in this program export. Confirm the exact location, service and plan with the program and your insurer.",
      sourceName: "New York OASAS public program directory",
      sourceUrl: "https://webapps.oasas.ny.gov/providerDirectory/",
      sourceCheckedAt: "2026-10-26",
      sourceUpdatedAt: null,
      verifiedAt: null,
      intake:
        "Use the program’s admission number to confirm referral requirements, eligibility and availability. Directory inclusion does not establish a current opening.",
      availability: "Not reported",
    };
    if (
      r.lat !== null &&
      (r.lat < 38.8 || r.lat > 47.6 || r.lng! < -80.6 || r.lng! > -66.8)
    ) {
      r.lat = r.lng = null;
      r.coordinateAccuracy = "unavailable";
    }
    resourceSchema.parse(r);
    seen.add(id);
    rows.push(r);
  }
}
await writeFile(".local/northeast/resources-oasas.json", JSON.stringify(rows));
console.log("New York OASAS program locations", rows.length);
