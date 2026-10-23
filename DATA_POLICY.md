# Directory data policy

Initial pilot source review: October 22, 2026. Only factual fields and independently written descriptions are included. No source's public accessibility is treated as a blanket bulk-republication license.

## Source inventory

| Source | Pilot use | Automated import status |
| --- | --- | --- |
| [Mass.gov CBHC locations](https://www.mass.gov/find-a-cbhc/locations) | 31 factual locations, addresses and contacts across four pages | Curated snapshot; no hidden API dependency |
| [Mass.gov CBHC program policy](https://www.mass.gov/community-behavioral-health-centers) | Program-level services, hours and MassHealth policy | Review source when policy changes; do not assume every service is covered |
| [AA Boston](https://aaboston.org/meetings) | Six selected individual meeting records | No bulk feed enabled; local feed access/reuse must be established |
| [Recovery Dharma](https://recoverydharma.org/meetings/) | Two selected individual records | No bulk feed enabled |
| [SMART Recovery #4223](https://meetings.smartrecovery.org/meetings/4223/) | One Boston online meeting, Eastern-time schedule | No bulk feed enabled |
| [Mass.gov WRCH](https://www.mass.gov/locations/worcester-recovery-center-and-hospital-wrch) and [Taunton](https://www.mass.gov/locations/taunton-state-hospital) | Public hospital facts | Referral/admission requirements must be confirmed |
| [AdCare](https://adcare.com/locations/adcare-hospital/) | Detox location and broad payment statements | No bed availability inferred; dynamically displayed advertising phone omitted |
| [Spectrum](https://www.spectrumhealthsystems.org/154-155-oak-street-westborough/) | Campus, intake and services | No bed availability inferred |
| [BMC Addiction Psychiatry](https://www.bmc.org/departments/psychiatry/addiction-psychiatry-treatment-program) and individual linked profiles | Program and three team clinicians | Profile statements are not independent licensing verification; actual appointment sites must be confirmed |
| [McLean insurer document](https://www.massgeneralbrigham.org/content/dam/unified-xwalk/documents/en/patients-visitors/mcl-insurance-accepted.pdf) | Selected insurer/product facts with exclusions | Published August 2026 document; not a benefits guarantee |
| [FindTreatment.gov](https://findtreatment.gov/api-request-form) | Official directory fallback | API access/application and server-IP requirements unresolved; no API import enabled |

Every listing carries its own source URL and dates. Clinical listings do not imply endorsement or quality ranking. Meeting listings are selected examples, not complete fellowship coverage; original directories remain prominent fallbacks.

## Insurance evidence

- **Facility-reported:** facility says it accepts an insurer; the record does not establish network participation under a particular product.
- **Published source:** a dated policy or plan document supports the listed wording and restrictions. It is not personalized benefits verification.
- **Directly confirmed:** requires confirmation for the listed service, provider/location, product/network and date. Record who/what was checked in the notes without private patient data.

Do not copy a hospital-level policy onto each individual clinician. Preserve exclusions. Medicare, Medicaid/MassHealth, commercial acceptance, in-network participation, eligibility and authorization are separate facts.

## Location and schedule

US Census address matches identify an approximate street position, not a verified building entrance. Two CBHC pins currently use ZIP-area coordinates and are explicitly labeled approximate. Some clinician pins represent a program contact location; the description and intake fields explain this limitation.

Online-only meetings have no coordinates. Hybrid meetings keep one identity with both formats. A recurring schedule is calculated in `America/New_York` and shown in the visitor's zone; source changes/cancellations are not predicted. Do not infer weekly days from a day-filtered index.

## Refresh workflow

1. Review a source's access and reuse requirements.
2. Fetch using a permitted interface; retain stable source IDs and provenance.
3. Normalize, validate and compare with existing records.
4. Flag changes, potential duplicates, closures and missing fields for review.
5. Publish reviewed facts, preserving audit history and each field's evidence.

The current production job checks source-link reachability only. A working URL is not clinical or meeting verification. HTTP 403 means manual review, not closure. The administrator can import reviewed JSON; insert-only imports never overwrite manually maintained records.
