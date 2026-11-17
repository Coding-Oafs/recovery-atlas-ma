# National coverage operations

Recovery Atlas combines official public meeting publishers, national professional registries and facility directories. State, county and postal community presence are measures of imported records, not a claim of exhaustive coverage or current availability.

## Meeting sources

`data/meeting-refresh-sources.json` contains reviewed public publisher feeds. New sources must be linked from an official fellowship office or district, publicly accessible and reviewed for geography, schedule, attendance mode and time zone. Do not bypass authentication, automated-access blocks or privacy choices. Blocked candidates remain disabled in the source-health dashboard and retain official-directory links.

The source queue runs three times daily. Each source has its own lease, last attempt, last success, retry backoff and record-count guard. A failed or unexpectedly smaller capture preserves existing records. Missing rows are tracked separately from explicit closures. Published temporary closures and calendar end dates stop calculated occurrences. An administrator's local changes are preserved: automatic source changes apply only when current managed facts match the previous source baseline; other changes enter the quality inbox. Geocoding is outside the schedule baseline.

SMART schedules come from the calendar linked by the official meeting page, including its original wall time, time zone, start/end bounds and excluded dates. Unsupported recurrences are held instead of converted into guessed weekly meetings. Existing meeting pages are revisited in weekly shards; daily index discovery adds newly published meetings. Global online AA is separate from physical local coverage and has no map pins. NA uses its daily static BMLT export, checksum and publication date; no live aggregator traversal is required.

## National provider sources

The initial national baseline uses the November 2026 CMS NPPES v2 monthly file and NUCC 26.1 classification codes. Only active public business practice facts and relevant behavioral-health/recovery taxonomies are retained. Primary IDs remain `npi-NPI`; additional published practices use stable address suffixes. Existing IDs, publication choices and local evidence persist. No mailing addresses, tax identifiers, personal contact fields or user account information are included in prepared data assets.

The monthly GitHub workflow downloads and filters the official CMS archive, joins its additional-practice file, and publishes small checksummed public-fact release assets. It uses the repository's own short-lived GitHub token and never receives the directory database credential. The existing application discovers these assets and imports them in bounded jobs. The monthly preparer retries on the 10th, 17th and 24th and skips a previously published archive. Weekly CMS archives are discovered daily and applied independently. Older registry updates must not overwrite newer source dates. Explicit NPI deactivations withdraw unchanged registry records with an audit event; local changes remain reviewable.

Registry classification and a public practice address do not establish licensure, clinical quality, attendance mode, payer participation, costs or appointment availability. Unreported attendance mode remains unreported and appears only in the explicit unknown-details result set when a mode filter is selected.

## Locations and local coverage

County assignments use the Census 2025 cartographic boundary file, including county equivalents in five inhabited territories. Boundary preparation is reproducible with `scripts/prepare-county-boundaries.py`; the input URLs are in that script and the operations report. The Minor Outlying Islands are absent from this boundary file. Postal community names supplement source-reported cities and are not municipal boundaries.

Public street addresses are deduplicated and sent to the Census batch geocoder, never visitor searches or account records. Matches must remain in the reported state. Publisher-designated approximate meeting locations are excluded from sharpening. A Census match is street-range interpolation, not an entrance verification; unsuccessful matches retain honest approximate/unavailable labels. Unmatched addresses and out-of-boundary points remain visible in job health. Address enrichment and county assignment run three times daily; a large initial queue is processed gradually.

`/coverage` reports county-level physical resources, approximate pins and explicit gaps. `/coverage/cities` reports source and postal community names. Global online meetings are counted separately. County/city links open matching directory filters. `/admin/sources` shows job health, missing publisher rows and geocoding backlog. `/admin/quality` retains proposed changes and manual conflicts.

## Validation and recovery

Run `npm test`, `npm run typecheck`, `npm run data:check`, `npm run build` and the browser suite. Live regression checks must include Palo Alto at 50/100 miles, every state/DC provider presence, priority-state AA counts, territory treatment/meeting gaps, county/city deep links, online access without pins, and unknown-mode matching.

Initial imports are staged unpublished in `atlas_import_release` and activated only after validation. `atlas_import_release_member` records exactly which resources were inserted. Individual changes and enrichments have before/after audit events. A failed source never justifies bulk deletion or treating a region as having no meetings. Do not overwrite manually unpublished listings during an import. Production secrets stay in the existing database workspace and application environment.
