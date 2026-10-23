import { readFile, writeFile } from "node:fs/promises";
const p = new URL("../data/resources.json", import.meta.url),
  rows = JSON.parse(await readFile(p, "utf8"));
const base = {
  kind: "meeting",
  categories: ["meetings"],
  address: "",
  city: "Boston",
  state: "MA",
  zip: "",
  lat: null,
  lng: null,
  coordinateAccuracy: "unavailable",
  phone: "",
  description:
    "A peer-led recovery meeting. Check the original listing before attending.",
  services: ["Peer support"],
  formats: ["in-person"],
  fellowship: "AA",
  languages: [],
  accessibility: [],
  populations: ["Open meeting"],
  hours: "",
  intake:
    "See the original listing for current participation and joining details.",
  payment: ["Free / donations"],
  insurance: [],
  paymentNote: "Peer support meeting; insurance is not required.",
  sourceName: "AA Boston Central Service",
  sourceCheckedAt: "2026-10-22",
  verifiedAt: null,
  sourceUpdatedAt: null,
  availability: "Not reported",
};
const meetings = [
  {
    id: "aa-fireside",
    name: "Fireside (Hybrid)",
    address: "60 Kilmarnock St, Suite 1000, Boston, MA 02215",
    zip: "02215",
    formats: ["in-person", "online", "hybrid"],
    services: ["Peer support", "Big Book"],
    populations: ["Open meeting", "LGBTQ+"],
    accessibility: ["Wheelchair access", "Accessible bathroom"],
    sourceUpdatedAt: "2022-12-12",
    slug: "fireside",
    day: 6,
    time: "19:30",
    notes: "Suite 1000. Public joining details are on the original listing.",
  },
  {
    id: "aa-port-norfolk",
    name: "Port Norfolk (Hybrid)",
    address: "51 Walnut St, Dorchester, MA 02122",
    city: "Dorchester",
    zip: "02122",
    formats: ["in-person", "online", "hybrid"],
    slug: "port-norfolk",
    day: 6,
    time: "19:00",
    sourceUpdatedAt: "2026-07-06",
    notes:
      "Christ Community Church. Public joining details are on the original listing.",
  },
  {
    id: "aa-newton-zoom",
    name: "Newton Zoom Group",
    city: "Newton",
    formats: ["online"],
    slug: "new-norumbega-14",
    day: 6,
    time: "19:00",
    sourceUpdatedAt: "2021-07-15",
    notes:
      "Online only. Confirm the schedule and join from the original listing.",
  },
  {
    id: "aa-there-is-hope",
    name: "There Is Hope",
    address: "1189 Main St, Worcester, MA 01603",
    city: "Worcester",
    zip: "01603",
    slug: "there-is-hope",
    day: 6,
    time: "19:00",
    sourceUpdatedAt: "2025-01-24",
    notes: "Christ Tabernacle Apostolic Church.",
  },
  {
    id: "aa-acceptance-beginners",
    name: "Acceptance Beginners",
    address: "77 Rockland St, Hanover, MA 02339",
    city: "Hanover",
    zip: "02339",
    slug: "acceptance-beginners-2",
    day: 6,
    time: "18:00",
    accessibility: ["Wheelchair access"],
    populations: ["Open meeting", "Newcomers"],
    sourceUpdatedAt: "2022-10-27",
    notes: "Lutheran Church. Discussion meeting welcoming newcomers.",
  },
  {
    id: "aa-sobah-at-7",
    name: "Sobah at 7",
    address: "33 E Merrimack St, Lowell, MA 01852",
    city: "Lowell",
    zip: "01852",
    slug: "sobah-at-7-6",
    day: 6,
    time: "19:00",
    accessibility: ["Wheelchair access", "Accessible bathroom"],
    sourceUpdatedAt: "2026-03-03",
    notes: "The Bridge Club.",
  },
  {
    id: "rd-boston-area",
    name: "Boston Area Recovery Dharma",
    address: "120 South St, Jamaica Plain, MA 02130",
    city: "Jamaica Plain",
    zip: "02130",
    fellowship: "Recovery Dharma",
    languages: ["English"],
    sourceName: "Recovery Dharma",
    url: "https://recoverydharma.org/meetings/boston-area-recovery-dharma/",
    day: 6,
    time: "10:00",
    sourceUpdatedAt: "2025-01-26",
    notes: "Open to members and non-members. Buddhist-inspired peer support.",
  },
  {
    id: "rd-haverhill",
    name: "Recovery Dharma — Haverhill",
    address: "76 Merrimack St, STE 11, Haverhill, MA 01830",
    city: "Haverhill",
    zip: "01830",
    fellowship: "Recovery Dharma",
    languages: ["English"],
    sourceName: "Recovery Dharma",
    url: "https://recoverydharma.org/meetings/rd-haverhill/",
    formats: ["in-person", "online", "hybrid"],
    day: 5,
    time: "19:00",
    sourceUpdatedAt: "2026-07-18",
    notes:
      "Nichiren Buddhist Sangha of Greater New England. Join online through the official listing.",
  },
  {
    id: "smart-boston-4223",
    name: "SMART Recovery — Boston #4223",
    city: "Boston",
    fellowship: "SMART Recovery",
    sourceName: "SMART Recovery",
    url: "https://meetings.smartrecovery.org/meetings/4223/",
    formats: ["online"],
    languages: ["English"],
    populations: ["Adults 18+"],
    day: 5,
    time: "18:00",
    duration: 90,
    notes:
      "4-Point Recovery. The source renders this meeting in Eastern time. Use the official page to join.",
  },
];
for (const m of meetings) {
  const { day, time, notes, duration = 60, slug, url, ...props } = m;
  const source = url ?? `https://aaboston.org/meetings/${slug}`;
  const r = {
    ...base,
    ...props,
    website: source,
    sourceUrl: source,
    meeting: {
      days: [day],
      time,
      duration,
      timezone: "America/New_York",
      joinUrl: null,
      notes,
    },
  };
  if (!rows.some((x) => x.id === r.id)) rows.push(r);
}
const facility = {
  ...base,
  kind: "hospital",
  categories: ["mental-health"],
  fellowship: null,
  populations: [],
  formats: ["in-person"],
  services: ["Inpatient psychiatric care"],
  meeting: null,
  payment: [],
  paymentNote:
    "Payment and program eligibility are not reported here. Contact the hospital for admission requirements.",
  intake:
    "Specialized state hospital. Admission requires clinical assessment and the applicable referral or legal process. This listing does not indicate walk-in admission or an available bed.",
  sourceName: "Mass.gov Department of Mental Health",
  description:
    "Massachusetts state psychiatric hospital. Contact the hospital or your care team about referral and admission pathways.",
};
for (const m of [
  {
    id: "worcester-recovery-center-hospital",
    name: "Worcester Recovery Center and Hospital",
    address: "309 Belmont St, Worcester, MA 01604",
    city: "Worcester",
    zip: "01604",
    phone: "508-368-4000",
    sourceUrl:
      "https://www.mass.gov/locations/worcester-recovery-center-and-hospital-wrch",
  },
  {
    id: "taunton-state-hospital",
    name: "Taunton State Hospital",
    address: "60 Hodges Avenue, Taunton, MA 02780",
    city: "Taunton",
    zip: "02780",
    sourceUrl: "https://www.mass.gov/locations/taunton-state-hospital",
  },
]) {
  const r = { ...facility, ...m, website: m.sourceUrl };
  if (!rows.some((x) => x.id === r.id)) rows.push(r);
}
const adcare = {
  ...facility,
  id: "adcare-hospital",
  name: "AdCare Hospital — Medical Detox",
  kind: "treatment",
  categories: ["treatment"],
  address: "107 Lincoln St, Worcester, MA 01605",
  city: "Worcester",
  zip: "01605",
  description:
    "Hospital-based alcohol and drug withdrawal management in Worcester, with planning for continued care.",
  services: [
    "Medical detox",
    "Alcohol treatment",
    "Drug treatment",
    "Co-occurring care",
    "Residential treatment",
  ],
  sourceUrl: "https://adcare.com/locations/adcare-hospital/",
  website: "https://adcare.com/locations/adcare-hospital/",
  sourceName: "AdCare Hospital",
  intake:
    "Contact the official admissions team for assessment, current availability and benefits verification. Published same-day admissions are not a guarantee of an available bed.",
  hours: "Medical detox services operate 24/7; contact admissions.",
  payment: ["Medicare", "MassHealth", "Commercial insurance", "Self-pay"],
  paymentNote:
    "Facility website reports Medicare, MassHealth and commercial insurance acceptance. No specific commercial plan or network is verified here.",
  insurance: [
    {
      name: "Medicare",
      plan: "Not specified",
      status: "reported",
      note: "Facility website reports acceptance; confirm your benefits and admission.",
      sourceUrl: "https://adcare.com/locations/adcare-hospital/",
      checkedAt: "2026-10-22",
    },
    {
      name: "MassHealth",
      plan: "Not specified",
      status: "reported",
      note: "Facility website reports acceptance; confirm program and plan eligibility.",
      sourceUrl: "https://adcare.com/locations/adcare-hospital/",
      checkedAt: "2026-10-22",
    },
  ],
};
if (!rows.some((x) => x.id === adcare.id)) rows.push(adcare);
await writeFile(p, JSON.stringify(rows, null, 2) + "\n");
console.log(`${rows.length} curated resources`);
