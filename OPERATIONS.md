# Operations

## Accounts and environments

- GitHub: `Coding-Oafs/recovery-atlas-ma`.
- Vercel: `recovery-atlas-ma`, project `prj_U8LkxD6TXPJYLgYYPsOG2EZQoonj`, account `team_AaNu33R9ryV82b5tGD7DNxWD`.
- Neon: `recovery-atlas-ma`, project `curly-credit-55152977`, database `recovery_atlas`, AWS US East 1.
- Database branches: `main` for production; `preview` for protected test deployments.
- Computes: minimum 0.25, maximum 1 CU; sleep after 300 seconds idle. These settings limit compute size, not total spend.

Account secrets are intentionally absent from this repository. The initial administrator password is available only in the owner's ignored local `.local/admin-access.txt` and Vercel environment configuration. Rotate it by updating `ADMIN_PASSWORD` and `SESSION_SECRET` in Vercel, then redeploy. Use a long unique password. The administrator session lasts eight hours.

## Routine care

Check the administrator review inbox and failed source checks. Work through source reviews older than 90 days. For meetings and insurer records, check more frequently according to source reliability. A dated published source must not be relabeled as directly verified without contact.

Before changes, export the directory from `/admin/export`. Database edits are audited. Public results are cached for five minutes; administrator changes invalidate the cache immediately. A temporary database read failure serves the dated repository snapshot and displays a warning. It does not enable public writes without the database.

New listings can be added with the validated JSON import. Use exported records as examples and stable IDs. Confirm actual service location, original source, insurance wording and access requirements. Imports are limited to 100 records and 250 KB. Existing IDs are preserved. Do not add patient or member data.

The correction inbox is not an emergency channel. Submissions are rate-limited, size-limited and moderated. Do not forward or publish personal information submitted in error. Source-link checks only fetch approved public domains with manual redirect handling; new source domains require a code review.

## Cost controls

Review Neon compute, storage, history and branch usage and configure spending notifications in the Neon console. Idle sleep is enabled; public directory caching reduces database wakeups. OpenFreeMap does not charge map-view fees, but does not provide an SLA. ZIP/city lookup uses packaged postal data; explicit street-address lookup uses the US Census geocoder and is rate-limited. If traffic outgrows public services, select production providers and a budget before changing them.

Vercel currently uses the owner's existing plan. This task does not upgrade plans or buy a domain. Any future commercial use must fit the hosting plan's current terms. Keep daily cron within account limits.

## Regional imports and search

The initial HTML load contains at most 50 full listings. `/api/search` applies all filters in Postgres and returns at most 500 full cards and exact total/mapped counts. `/api/map` queries all matching coordinates inside the viewport and groups them in projected grid cells according to zoom, returning each cell’s exact resource count and bounds. The sum of counts equals the mapped matches in that viewport; there is no card-page cap on map coverage. Responses are compressed. `/api/resources/[id]` fetches full details on pin selection; `/api/map-selection` retrieves up to 100 grouped resources at a time using the same filters and geometry bounds. `/api/facets` supplies regional filter options. Search terms, saved IDs and coordinates travel to the app server; they are not written to a search-history table.

The administrator table searches at most 200 rows. `/admin/export` exports 1,000 records per page; follow the `X-Next-Cursor` header with `?after=...` until it is empty. Export includes unpublished staged records and must remain authenticated. Keep full imports in the database and ignored `.local/`, not in Git. The bundled 49-record JSON remains a dated outage fallback.

Import scripts download source facts, normalize and validate with `resourceSchema`, then stage new records unpublished through `scripts/stage-northeast.mts`. They never overwrite published edits. Review source counts, duplicates, coordinates, taxonomy choices and unknown insurer fields before publishing the staged IDs. Census batch caches are keyed by input content. Generate `public/coverage.json` after a reviewed release with `scripts/coverage-report.mjs`. The daily maintenance task is a link check, not an automatic refresh of clinical or meeting data.

Source adapters are a reproducible starting point; review each source's current structure and access policy before a refresh. NPPES queries recursively split capped postal prefixes and retain an incomplete-partition report. Active NPI status is not professional license verification. Do not label registry entries as licensed clinicians or assume they accept patients or insurance. Practice addresses can be outdated.

## Regional release workflow

Run additive migrations 002 and 003 before deploying regional code. `scripts/import-northeast-nppes.mjs`, `collect-regional-meetings.mjs`, `collect-regional-na.mjs` and `collect-regional-smart.mjs` retain public source responses under ignored `.local/northeast/`. `collect-regional-facilities.mjs` downloads official annual spreadsheets and the NY OASAS export; `read-national-facilities.py` reads spreadsheets with openpyxl without modifying them. Normalize using `normalize-northeast.mts`, `normalize-oasas.mts` and `normalize-regional-meetings.mts`. Review the hard-coded source review date before a new release. Census geocoding uses `geocode-statewide.mjs` with a normalized file path. Preserve public source dates and unknown insurance fields.

`stage-northeast.mts` inserts only missing IDs as unpublished, preserving existing edits. The ignored `staged-ids.json` records exactly the new release. Generate the proposed coverage report with `coverage-report.mjs --include-staged`; without that flag it counts published records only. Deploy the multi-state schema and map API before activating staged records. Record activation in `audit_events` and `sync_runs`, invalidate the resources cache, then compare public API totals with the report. Never enable regional records against the old MA-only schema. Before rolling back to MA-only code, unpublish only the regional release IDs.

## Expansion dependencies

SAMHSA API approval and any requesting-server IP requirements remain external dependencies. The state BSAS directory supplies public licensed-program facts independently. Western Mass Intergroup's public meeting server returned HTTP 508 during this release; preserve the source gap and official links. Other fellowships and unpublished services require additional source adapters. No directory can guarantee that it includes every current Northeast service.

The initial UI is English. Resource language filtering uses reported fields; it is not a translation feature. Appointment booking, live beds, patient portals and personal insurance eligibility checks are outside this pilot.

## Restore and rollback

For a code regression use Vercel's previous tested deployment. For a data issue, compare the audit event and restore the reviewed previous record; do not blindly reseed over live edits. Schema migrations are additive and idempotent. Do not delete or reset production branches as a repair shortcut.
