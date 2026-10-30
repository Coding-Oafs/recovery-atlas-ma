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

The initial HTML load contains at most 50 full listings. `/api/search` applies all filters in Postgres and returns a bounded page of full cards using offset pagination and exact total/mapped counts. `/api/map` queries all matching coordinates inside the viewport and groups them in projected grid cells according to zoom, returning each cell�s exact resource count and bounds. The sum of counts equals the mapped matches in that viewport; there is no card-page cap on map coverage. Responses are compressed. `/api/resources/[id]` fetches full details on pin selection; `/api/map-selection` retrieves up to 100 grouped resources at a time using the same filters and geometry bounds. `/api/facets` supplies regional filter options. Search terms, saved IDs and coordinates travel to the app server; they are not written to a search-history table.

The administrator table searches at most 200 rows. `/admin/export` exports 1,000 records per page; follow the `X-Next-Cursor` header with `?after=...` until it is empty. Export includes unpublished staged records and must remain authenticated. Keep full imports in the database and ignored `.local/`, not in Git. The bundled 49-record JSON remains a dated outage fallback.

Import scripts download source facts, normalize and validate with `resourceSchema`, then stage new records unpublished through `scripts/stage-northeast.mts`. They never overwrite published edits. Review source counts, duplicates, coordinates, taxonomy choices and unknown insurer fields before publishing the staged IDs. Census batch caches are keyed by input content. Generate `public/coverage.json` after a reviewed release with `scripts/coverage-report.mjs`. The daily maintenance task samples links and compares known listings with two rotating official meeting feeds, queuing proposed changes for approval. Clinical, insurance and direct-verification facts are never refreshed automatically.

Source adapters are a reproducible starting point; review each source's current structure and access policy before a refresh. NPPES queries recursively split capped postal prefixes and retain an incomplete-partition report. Active NPI status is not professional license verification. Do not label registry entries as licensed clinicians or assume they accept patients or insurance. Practice addresses can be outdated.

## Regional release workflow

Run additive migrations 002 and 003 before deploying regional code. `scripts/import-northeast-nppes.mjs`, `collect-regional-meetings.mjs`, `collect-regional-na.mjs` and `collect-regional-smart.mjs` retain public source responses under ignored `.local/northeast/`. `collect-regional-facilities.mjs` downloads official annual spreadsheets and the NY OASAS export; `read-national-facilities.py` reads spreadsheets with openpyxl without modifying them. Normalize using `normalize-northeast.mts`, `normalize-oasas.mts` and `normalize-regional-meetings.mts`. Review the hard-coded source review date before a new release. Census geocoding uses `geocode-statewide.mjs` with a normalized file path. Preserve public source dates and unknown insurance fields.

`stage-northeast.mts` inserts only missing IDs as unpublished, preserving existing edits. The ignored `staged-ids.json` records exactly the new release. Generate the proposed coverage report with `coverage-report.mjs --include-staged`; without that flag it counts published records only. Deploy the multi-state schema and map API before activating staged records. Record activation in `audit_events` and `sync_runs`, invalidate the resources cache, then compare public API totals with the report. Never enable regional records against the old MA-only schema. Before rolling back to MA-only code, unpublish only the regional release IDs.

## Expansion dependencies

SAMHSA API approval and any requesting-server IP requirements remain external dependencies. The state BSAS directory supplies public licensed-program facts independently. Western Mass Intergroup's public meeting server returned HTTP 508 during this release; preserve the source gap and official links. Other fellowships and unpublished services require additional source adapters. No directory can guarantee that it includes every current Northeast service.

The main UI offers English and a preliminary Spanish translation of selected controls. Listing language filtering uses reported fields. Spanish listings are not automatically translated; professional translation and usability review remain ongoing work. Appointment booking, live beds, patient portals and personal insurance eligibility checks are outside this pilot.

## Restore and rollback

For a code regression use Vercel's previous tested deployment. For a data issue, compare the audit event and restore the reviewed previous record; do not blindly reseed over live edits. Schema migrations are additive and idempotent. Do not delete or reset production branches as a repair shortcut.

## Private saved accounts and exports

The canonical public address is https://recoveryatlas.vercel.app/. Older production aliases continue serving the directory; their account panel links to the canonical address and offers an explicit browser-save transfer through a URL fragment. The fragment is removed on arrival and is not sent in HTTP requests. Browsing, guest saves and exports do not require sign-in. Never redirect the old root automatically: existing browser-only saves are origin-specific.

Better Auth 1.7.14 handles passwords, cookies, sessions and WebAuthn passkeys in the existing Neon database. Accounts use a pseudonymous username; the framework-required email field contains an opaque random @accounts.invalid identifier and is not a contact address. No email or social provider is enabled. Passwords require at least 15 characters. Rate limits use atomic database updates with HMAC keys; session IP/user-agent fields are cleared before storage. Administrator authentication remains separate.

Apply migrations 004 and 005 to production and preview before deploying. BETTER_AUTH_SECRET is optional when the existing strong SESSION_SECRET is set. Production defaults to the canonical site URL. Local testing must set BETTER_AUTH_URL to its localhost origin. Vercel previews infer their own origin from VERCEL_URL and use the preview database. Do not share production sessions or data with previews. User access is checked on each private endpoint with a database-backed session; no public/private result caching is shared.

Each account owns a list capped at 1,000 resource IDs. Save/remove operations change a single ID and do not overwrite another device�s list. Browser lists stay separate and require an explicit copy. Private saves are never put into localStorage. Account deletion cascades to sessions, credentials, passkeys, saves and recovery-code hashes. Daily maintenance removes expired session/verification/rate-limit records.

Recovery codes contain 192 bits of randomness; only SHA-256 hashes are stored. Generating/replacing a code requires a recent session. Recovery consumes the code once, uses the pinned library�s reset-token flow, revokes all sessions and removes passkeys. Code reset integration uses Better Auth internalAdapter: review this adapter contract whenever upgrading the pinned library. Users must keep a recovery code or usable passkey/password; there is no email reset. No administrator can retrieve passwords or recovery codes.

Export endpoints receive a selected list of public IDs and return CSV, JSON backup, source-time-zone ICS meetings or a printable HTML document for browser PDF saving. These exports intentionally work for guest saves. They do not enumerate account lists. Every export applies published=true, validates a maximum of 1,000 IDs, prevents spreadsheet formula injection and escapes print HTML. Downloads and private responses use no-store headers. Never log recovery codes, passwords, tokens or exported saved lists.

Passkeys are bound to recoveryatlas.vercel.app. If a future custom domain is adopted, retain the existing account origin until users have signed in and enrolled passkeys on the new domain. A passkey cannot be silently moved between unrelated domains.

## Community operations and monitoring

Apply migrations 006�008 to both environments. MESSAGE_ENCRYPTION_SECRET must be a separate strong random server-only secret for each environment. Preserve it in the owner�s secure secret backup. Rotating SESSION_SECRET can revoke sign-ins without changing message encryption. Never replace the messaging key without decrypting and re-encrypting existing messages and report evidence in a reviewed migration; a lost key makes those records unreadable.

The owner�s requested account dofarrell has a moderator role, assigned by stable user ID. Its supplied contact email is private role metadata, not a public profile or login-email change. Role grants must be performed by the site owner after verifying the account�s stable ID, and recorded in audit_events. There is no client-side role assignment. Moderator reports are at /moderation; claims, source proposals, stale records, potential duplicates and maintenance history are at /admin/quality. A moderator cannot pause another moderator through this UI. The site administrator must handle that separately.

Profiles are hidden by default and community features require self-confirmed age 18+ and guideline acceptance. Discovery uses a handle prefix of at least three characters. This is not identity or clinician verification. Requests are limited to ten per day; ongoing sends require acceptance and are throttled. Polling runs only while the page is visible and recently active. Read markers track only the recipient�s unread count; no read receipt is shown to peers.

Review reports regularly: no 24/7 coverage or external message alerting is promised. Daily maintenance removes messages at 180 days, unaccepted/declined requests at 30 days and report evidence at 90 days. Account deletion removes shared conversations for both participants; reported evidence remains until retention expires with account references cleared. Restoring access does not automatically re-enable profile discovery or incoming requests.

The hourly Public app health GitHub Actions workflow probes the public homepage, database, meeting search and unauthenticated private-endpoint guards. Enable watched-workflow failure notifications in the owner�s GitHub notification settings; the app does not send email itself. Scheduled Actions can be delayed and public-repository schedules can be disabled after inactivity. Check /admin/quality for source-refresh failures and run history. A failed link or HTTP 403 requires review and is never interpreted as a closed service. The clinical registry and non-feed sources still require scheduled human review and additional adapters.

## Recovery drill limits

Neon reports 24 hours of point-in-time history for this project as of October 30, 2026. This is a recovery window, not a long-term independent backup. The restore-check script round-trips up to 100 complete public-directory records through a local ignored JSON export and a temporary database table, compares every value and drops the temporary table at commit. It does not restore the production branch or test accounts, encryption keys or infrastructure recovery. Run with the preview environment, and keep its ignored export private. A full restore into a separately approved recovery branch and longer-term encrypted offsite backups remain owner operations; never reset or delete the production branch to test recovery.

The support hub contains external directories rather than invented mapped locations. Coverage remains the nine-state Northeast release. Country, postal-code and time-zone fields prepare the schema for later imports; search, geocoding, crisis guidance and source adapters still need country-specific work before a worldwide release.
