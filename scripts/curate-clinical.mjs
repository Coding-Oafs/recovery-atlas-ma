import { readFile, writeFile } from "node:fs/promises";
const p = new URL("../data/resources.json", import.meta.url),
  rows = JSON.parse(await readFile(p, "utf8"));
const b = {
  ...rows[0],
  lat: null,
  lng: null,
  coordinateAccuracy: "unavailable",
  insurance: [],
  payment: [],
  formats: ["in-person"],
  languages: [],
  accessibility: [],
  populations: ["Adults"],
  hours: "Call to confirm",
  verifiedAt: null,
  sourceUpdatedAt: null,
  meeting: null,
  availability: "Not reported",
};
const additions = [
  {
    ...b,
    id: "bmc-addiction-psychiatry",
    name: "BMC Addiction Psychiatry Treatment Program",
    kind: "clinic",
    categories: ["mental-health", "counseling", "treatment"],
    address: "801 Massachusetts Ave, 1st Floor, Boston, MA 02119",
    city: "Boston",
    zip: "02119",
    phone: "617-414-4238",
    description:
      "Outpatient care for adults with both substance use and mental health conditions, including assessment, medication management and psychotherapy.",
    services: [
      "Addiction psychiatry",
      "Medication management",
      "Individual and group therapy",
      "Co-occurring care",
    ],
    intake:
      "Call the psychiatry department to discuss assessment, referrals, current availability and the appointment location.",
    sourceUrl:
      "https://www.bmc.org/departments/psychiatry/addiction-psychiatry-treatment-program",
    sourceName: "Boston Medical Center",
    paymentNote:
      "Specific insurance and program coverage have not been documented here. Confirm benefits with the department and your health plan.",
  },
  {
    ...b,
    id: "spectrum-westborough",
    name: "Spectrum Health Systems — Westborough Campus",
    kind: "treatment",
    categories: ["treatment"],
    address: "155 Oak St, Westborough, MA 01581",
    city: "Westborough",
    zip: "01581",
    phone: "877-697-3422",
    description:
      "A treatment campus offering inpatient detoxification, clinical stabilization and residential care.",
    services: [
      "Medical detox",
      "Clinical stabilization",
      "Residential treatment",
    ],
    intake:
      "Call intake for clinical assessment, program location, payment options and current availability. The official campus address is 154–155 Oak Street.",
    sourceUrl:
      "https://www.spectrumhealthsystems.org/154-155-oak-street-westborough/",
    sourceName: "Spectrum Health Systems",
    payment: ["Sliding scale"],
    paymentNote:
      "The organization publishes a sliding fee schedule. Confirm eligibility, program charges and your specific insurance plan with intake.",
  },
  {
    ...b,
    id: "mclean-hospital-belmont",
    name: "McLean Hospital — Belmont",
    kind: "hospital",
    categories: ["mental-health", "treatment"],
    address: "115 Mill St, Belmont, MA 02478",
    city: "Belmont",
    zip: "02478",
    phone: "",
    description:
      "Behavioral health hospital in Belmont. Contact the hospital about the appropriate psychiatric or substance use program and referral pathway.",
    services: ["Psychiatric care", "Substance use treatment"],
    intake:
      "Use the official hospital website to contact the relevant program. Admission, insurance and payment vary by program; a listing does not indicate an available bed.",
    sourceUrl:
      "https://www.massgeneralbrigham.org/en/locations/belmont-ma/mclean-hospital-loc0000280582",
    sourceName: "Mass General Brigham / McLean Hospital",
    payment: ["Commercial insurance", "MassHealth", "Medicare"],
    paymentNote:
      "The hospital publishes an August 2026 insurer/product list. Some programs, services and affiliated clinicians may have different arrangements. Confirm the exact program, benefits and authorization.",
  },
  {
    ...b,
    id: "darline-justal-np",
    name: "Darline Justal, NP — BMC",
    kind: "provider",
    categories: ["mental-health", "treatment"],
    address: "850 Harrison Avenue, Boston, MA 02118",
    city: "Boston",
    zip: "02118",
    phone: "617-414-4238",
    description:
      "BMC lists Darline Justal as a psychiatric and mental health nurse practitioner in its Addiction Psychiatry Treatment Program. Credentials are reported from the provider profile; license status has not been independently verified here.",
    services: ["Psychiatric nurse practitioner", "Addiction psychiatry"],
    intake:
      "Call BMC psychiatry for appointment availability, eligibility and the correct appointment location.",
    sourceUrl:
      "https://www.bmc.org/about-us/directory/doctor/darline-justal-np",
    sourceName: "Boston Medical Center provider profile",
    paymentNote:
      "Individual provider insurance participation is not reported here. Do not assume coverage from the hospital’s general insurance list.",
  },
  {
    ...b,
    id: "brooke-rogers-psychologist",
    name: "Brooke Rogers, PhD, MPH — BMC",
    kind: "provider",
    categories: ["mental-health", "counseling"],
    address: "801 Massachusetts Ave, Boston, MA 02119",
    city: "Boston",
    zip: "02119",
    phone: "617-414-4238",
    description:
      "BMC lists Brooke Rogers as a clinical psychologist providing psychological services for addiction. The address is the Addiction Psychiatry Treatment Program contact location; confirm the actual appointment site. License status is not independently verified here.",
    services: [
      "Clinical psychology",
      "Individual and group therapy",
      "Substance use counseling",
    ],
    intake:
      "Contact the Addiction Psychiatry Treatment Program to ask about this clinician’s current availability and appointment location.",
    sourceUrl: "https://www.bmc.org/node/173187",
    sourceName: "BMC provider profile and Addiction Psychiatry program",
    paymentNote:
      "Individual clinician insurance participation has not been documented. Confirm the clinician, location and plan with BMC and your insurer.",
  },
  {
    ...b,
    id: "william-reid-varley-md",
    name: "William Bernard Reid-Varley, MD, MPH — BMC",
    kind: "provider",
    categories: ["mental-health", "treatment"],
    address: "801 Massachusetts Ave, Boston, MA 02119",
    city: "Boston",
    zip: "02119",
    phone: "617-414-4238",
    description:
      "Physician listed on BMC’s Addiction Psychiatry Treatment Program team. The map shows the program contact location, not a confirmed appointment site. Professional license status has not been independently verified here.",
    services: ["Psychiatry", "Addiction psychiatry"],
    intake:
      "Contact BMC psychiatry to confirm this provider’s availability, eligibility and actual appointment location.",
    sourceUrl:
      "https://www.bmc.org/about-us/directory/doctor/william-bernard-reid-varley-md-mph",
    sourceName: "BMC provider profile and Addiction Psychiatry team",
    paymentNote:
      "Individual clinician insurance participation is not reported here. Confirm the specific provider, service and plan.",
  },
];
const insuranceSource =
  "https://www.massgeneralbrigham.org/content/dam/unified-xwalk/documents/en/patients-visitors/mcl-insurance-accepted.pdf";
const plans = [
  [
    "Aetna",
    "HMO, POS, PPO and selected other products",
    "Excludes Premier Care Network and Medicaid replacement products.",
  ],
  [
    "Blue Cross Blue Shield",
    "HMO, POS, PPO and selected other products",
    "Select Blue, High Performance and Anthem Pathway networks excluded; Medicare Advantage has referral restrictions.",
  ],
  [
    "Cigna",
    "HMO, POS, PPO and selected other products",
    "Local Plus IN excluded; verify behavioral health administrator.",
  ],
  [
    "Harvard Pilgrim Health Care",
    "HMO, POS, PPO, HPI, ConnectorCare",
    "HPI Select, Elevate HMO and NH Local excluded.",
  ],
  [
    "MassHealth",
    "MassHealth, PCC, MBHP and listed ACO products",
    "Limited coverage restricted to emergency services.",
  ],
  [
    "Medicare",
    "Parts A and B",
    "Confirm the specific service and any authorization requirements.",
  ],
];
const mc = additions.find((x) => x.id === "mclean-hospital-belmont");
mc.insurance = plans.map(([name, plan, note]) => ({
  name,
  plan,
  status: "published",
  note,
  sourceUrl: insuranceSource,
  checkedAt: "2026-10-22",
}));
for (const r of additions) {
  r.website = r.sourceUrl;
  if (!rows.some((x) => x.id === r.id)) rows.push(r);
}
for (const r of rows) {
  if (
    r.sourceName === "Mass.gov CBHC directory" &&
    !r.categories.includes("support")
  )
    r.categories.push("support");
}
await writeFile(p, JSON.stringify(rows, null, 2) + "\n");
console.log(`${rows.length} sourced resources`);
