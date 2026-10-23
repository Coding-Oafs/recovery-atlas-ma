# Directory data policy

Initial pilot source review: October 22, 2026. Only factual fields and independently written descriptions are included. No source's public accessibility is treated as a blanket bulk-republication license.

## Source inventory

| Source                                                                                                                                                           | Pilot use                                                                                        | Automated import status                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| [Mass.gov CBHC locations](https://www.mass.gov/find-a-cbhc/locations)                                                                                            | 31 factual locations, addresses and contacts across four pages                                   | Curated snapshot; no hidden API dependency                                                                                |
| [Mass.gov CBHC program policy](https://www.mass.gov/community-behavioral-health-centers)                                                                         | Program-level services, hours and MassHealth policy                                              | Review source when policy changes; do not assume every service is covered                                                 |
| [AA Boston](https://aaboston.org/meetings)                                                                                                                       | Public meeting names, schedules, formats and locations across seven day pages                    | Published HTML facts only; no restricted AJAX endpoint used                                                               |
| [Worcester Area Intergroup](https://aaworcester.org/meetinglist.aspx?grp=wai)                                                                                    | Additional central Massachusetts meetings                                                        | Public all-days search; overlapping Boston address/day/time records omitted                                               |
| [Recovery Dharma](https://recoverydharma.org/meetings/)                                                                                                          | Massachusetts meetings                                                                           | Public JSON feed explicitly loaded by official meeting page; personal contacts omitted                                    |
| [SMART Recovery](https://meetings.smartrecovery.org/meetings/)                                                                                                   | Massachusetts meetings across every result page                                                  | Official public detail/calendar facts; no facilitator identities or meeting passwords copied                              |
| [Refuge Recovery](https://refugerecoverymeetings.org/meetings)                                                                                                   | Massachusetts meetings                                                                           | Public JSON feed explicitly loaded by official page; personal contacts omitted                                            |
| [NERNA](https://nerna.org/find-a-meeting/)                                                                                                                       | Published Massachusetts NA meetings                                                              | Public read-only BMLT service; no personal contacts or credentials copied                                                 |
| [Massachusetts BSAS](https://hhsvgapps03.hhs.state.ma.us/elicensing-pubweb/prog/main.htm)                                                                        | Programs marked licensed in all 351 city pages                                                   | State public directory; contracted status never implies an insurance plan                                                 |
| [MassGIS hospitals](https://www.mass.gov/info-details/massgis-data-hospitals)                                                                                    | Hospitals reporting psychiatric beds                                                             | Public-use geographic dataset with MassGIS/Commonwealth attribution; capacity is not availability                         |
| [NPPES](https://npiregistry.cms.hhs.gov/api-page)                                                                                                                | Active individual mental-health/addiction taxonomy records with Massachusetts practice addresses | Public API v2.1; postal-prefix partitioning avoids its 1,200-record query cap; no license, payer or appointment inference |
| [Mass.gov WRCH](https://www.mass.gov/locations/worcester-recovery-center-and-hospital-wrch) and [Taunton](https://www.mass.gov/locations/taunton-state-hospital) | Public hospital facts                                                                            | Referral/admission requirements must be confirmed                                                                         |
| [AdCare](https://adcare.com/locations/adcare-hospital/)                                                                                                          | Detox location and broad payment statements                                                      | No bed availability inferred; dynamically displayed advertising phone omitted                                             |
| [Spectrum](https://www.spectrumhealthsystems.org/154-155-oak-street-westborough/)                                                                                | Campus, intake and services                                                                      | No bed availability inferred                                                                                              |
| [BMC Addiction Psychiatry](https://www.bmc.org/departments/psychiatry/addiction-psychiatry-treatment-program) and individual linked profiles                     | Program and three team clinicians                                                                | Profile statements are not independent licensing verification; actual appointment sites must be confirmed                 |
| [McLean insurer document](https://www.massgeneralbrigham.org/content/dam/unified-xwalk/documents/en/patients-visitors/mcl-insurance-accepted.pdf)                | Selected insurer/product facts with exclusions                                                   | Published August 2026 document; not a benefits guarantee                                                                  |
| [FindTreatment.gov](https://findtreatment.gov/api-request-form)                                                                                                  | Official directory fallback                                                                      | API access/application and server-IP requirements unresolved; no API import enabled                                       |

Every listing carries its own source URL and dates. Clinical listings do not imply endorsement or quality ranking. Imports cover the observed public sources, not every possible Massachusetts service. Western Mass Intergroup's meeting server returned HTTP 508 during this release; its official website remains linked. Additional fellowships and unlisted services remain outside current coverage. Counts represent listings, including separate programs and meetings at shared addresses.

## Insurance evidence

- **Facility-reported:** facility says it accepts an insurer; the record does not establish network participation under a particular product.
- **Published source:** a dated policy or plan document supports the listed wording and restrictions. It is not personalized benefits verification.
- **Directly confirmed:** requires confirmation for the listed service, provider/location, product/network and date. Record who/what was checked in the notes without private patient data.

Do not copy a hospital-level policy onto each individual clinician. Preserve exclusions. Medicare, Medicaid/MassHealth, commercial acceptance, in-network participation, eligibility and authorization are separate facts.

## Location and schedule

US Census address matches identify a street position, not a verified building entrance. Unmatched addresses fall back to a Massachusetts ZIP/city area only when supported by postal data, with an explicit approximate label. NPPES practice addresses are self-reported public professional data and can be stale; the registry does not establish current licensure or clinical suitability.

Online-only meetings have no coordinates. Hybrid meetings keep one identity with both formats. A recurring schedule is calculated in `America/New_York` and shown in the visitor's zone; source changes/cancellations are not predicted. Do not infer weekly days from a day-filtered index.

## Refresh workflow

1. Review a source's access and reuse requirements.
2. Fetch using a permitted interface; retain stable source IDs and provenance.
3. Normalize, validate and compare with existing records.
4. Flag changes, potential duplicates, closures and missing fields for review.
5. Publish reviewed facts, preserving audit history and each field's evidence.

The current production job checks source-link reachability only. A working URL is not clinical or meeting verification. HTTP 403 means manual review, not closure. The administrator can import reviewed JSON; insert-only imports never overwrite manually maintained records.
