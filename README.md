# Recovery Atlas — United States and territories

A mobile-friendly directory for recovery meetings, treatment and mental health support across all 50 US states, DC and US territories, to the extent supported by published sources. Coverage gaps and source dates are shown explicitly.

## What is included

- National SAMHSA facility listings and regional public listings from NPPES, SAMHSA, New York OASAS, Massachusetts BSAS and MassGIS, AA, NA, SMART Recovery, Recovery Dharma and Refuge Recovery, alongside the original 49 curated listings. See `public/coverage.json` for source counts and limitations.
- Every mapped search match is represented, independent of list pagination. A viewport endpoint groups pins when zoomed out; zooming reveals individuals. Shared locations have paginated resource choices. City/ZIP/address search, browser location and mileage radius.
- State, keyword, service, recovery approach, format, payment, language, participation, meeting day and wheelchair-access filters.
- Recurring meeting calculation in each source IANA time zone with next occurrences displayed in the visitor's time zone. Online-only meetings have no pins or physical radius restrictions.
- Evidence-labeled payment and insurer records, including McLean's published product restrictions.
- Browser-local bookmarks or private cross-device accounts with optional passkeys, recovery codes, CSV/JSON/PDF/calendar exports, crisis/help links, source dates, correction/new-resource submissions.
- Protected administrator dashboard: review inbox, listing and meeting edits, insurer/product edits, publication controls, export, validated insert-only JSON import, audit history and source connection status.
- Daily source-link checks on Vercel. Link checks never claim to verify clinical services or meeting operation.

The national release adds guided discovery, counted search alternatives, state and territory help, separate unreported-detail results, resource-specific summaries, Spanish search-to-contact guidance, a three-resource comparison and page-memory checklists. See `OPERATIONS.md` for insert-only staging and activation.

## Run locally

Use Node 22 or newer (production uses Node 24).

```sh
npm ci
```

Copy `.env.example` to `.env.local`. Configure a Neon connection in `DATABASE_URL`, then run:

```sh
node scripts/setup-local.mjs
npm run db:migrate
npm run db:seed
npm run dev
```

The directory is at `http://127.0.0.1:4117`; administrator sign-in is `/admin`. The setup script generates a strong random password and session/cron secrets. The administrator password is saved in the ignored `.local/admin-access.txt`. Never commit that file or any `.env.local`.

Without a database the public directory serves the dated bundled snapshot. Mutation and administrator workflows require the database; the site labels snapshot fallback explicitly.

## Configuration

| Variable                | Purpose                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| `DATABASE_URL`          | Neon Postgres connection, server only                                |
| `ADMIN_PASSWORD`        | Random administrator password, server only                           |
| `SESSION_SECRET`        | Long random cookie signing and rate-limit hashing secret             |
| `CRON_SECRET`           | Authenticates Vercel scheduled maintenance                           |
| `APP_ORIGIN`            | Optional expected application origin                                 |
| `NEXT_PUBLIC_MAP_STYLE` | Optional MapLibre-compatible style URL; default OpenFreeMap Positron |

Production and preview use separate Neon branches. Preview code must never receive the production connection. Keep secret environment variables in Vercel project settings. The map uses OpenFreeMap, OpenMapTiles and OpenStreetMap with built-in attribution; it does not require a paid map API key. Fonts are bundled locally with SIL Open Font License files in `public/fonts`.

## Public access

Share [Recovery Atlas](https://recoveryatlas.vercel.app/). Visitors need no login or Vercel account. The footer’s Copy public link button copies this address without personal search terms. The production alias is public; preview and individual deployment URLs remain protected. Keep the existing project/repository names so current links continue to work. A custom domain is optional.

## Deployment

Connect this repository to the `recovery-atlas-ma` Vercel project. Set the environment variables for production and preview separately. Verify the intended account, project, commit and database branch before deployment. Use Vercel Git integration for preview builds; production tracks `main`. Standard deployment protection keeps preview and per-deployment URLs protected while the production domain is public. `/admin` has its own application authentication.

Vercel Cron calls `/api/maintenance` daily at 11:00 UTC (7am Eastern daylight / 6am Eastern standard). The endpoint requires the secret bearer token. It checks six source links, rotates through six approved meeting feeds, refreshes bounded Georgia/Montana directory sections, checks a day of Online Intergroup schedules and imports the approved BMLT daily static export. New validated meetings are added; changed facts on existing listings become administrator review proposals. Source outages never delete meetings or imply none exist. Existing edits, insurer lists and availability claims are preserved.

## Nationwide meeting sources

AA imports use public local intergroup Meeting Guide feeds and crawler indexes, plus the Online Intergroup's public Code for Recovery Central service. Its default response covers only one hour; the initial collector explicitly retrieves a full week. Online AA records use national availability (`US`), appear with any selected state or territory and never receive physical map pins. AA presence in a state does not establish complete coverage of every city, county or group. Category-specific counts are available at `/api/coverage`.

County and county-equivalent lookup uses the [Census 2026 National Counties Gazetteer](https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2026_Gazetteer/2026_Gaz_counties_national.zip). County searches use a labeled representative center and the selected radius, rather than claiming a county-boundary filter.

To prepare a fresh reviewed release, run `npx tsx scripts/refresh-national-meetings.mts`, then `npx tsx --env-file=.env.local scripts/install-national-meetings.mts`. Review the ignored capture manifests, validation and staged IDs before running the installer with `--activate`. Imports are insert-only; existing publication decisions and edits are retained. SMART's current HTML format needs a separate schedule adapter; collecting its pages does not publish guessed schedules.

NA data comes from the [BMLT Aggregator daily static export](https://cdn.aws.bmlt.app/aggregator/manifest.json), with SHA-256 validation and publishing-service-body attribution. Third-party bulk imports must not use the live aggregator API. Raw and normalized NA captures remain in ignored `.local/` storage and the application database; do not commit or redistribute them as a bulk dataset. See the publisher's [terms](https://cdn.aws.bmlt.app/aggregator/tos.html).

## Verification

```sh
npm test
npm run typecheck
npm run data:check
npm run build
```

`scripts/browser-check.mjs` exercises desktop and mobile search, ZIP-radius lookup, details, bookmarks, help links, administrator login/export and unauthorized access checks. It uses installed Microsoft Edge on this Windows workstation and writes screenshots/results under ignored `.local/`. Adapt the executable path for other systems. `TEST_BASE_URL` can point it at a local preview. Do not run mutation checks against production unintentionally.

## Data maintenance

See [DATA_POLICY.md](DATA_POLICY.md) and [OPERATIONS.md](OPERATIONS.md). The canonical public snapshot is `data/resources.json`; the runtime source is the Neon database. `db:seed` adds missing IDs and preserves existing database edits. Export before replacing snapshots. The Zod schema in `src/lib/types.ts` validates imports; stable IDs prevent duplicate inserts.

Source review, source-reported update, direct verification and import/update dates have different meanings. Missing fields must remain unknown, not fabricated. Do not display current openings or exact insurance-network confirmation without a source that supports those claims.

## Scope and privacy

This is an independent directory, not a clinical assessment, referral intermediary, emergency response service or exhaustive regional registry. There are no paid placements, referral fees, advertising scripts or session replay. Browsing requires no account. Do not collect insurance IDs, clinical histories or appointment records through directory forms. Infrastructure vendors still process technical request metadata.

Individual clinician license status has not been independently verified. A provider profile or NPI is not license verification. Use official licensing and insurer sources when expanding verification.

## Community, calendars and practical support

Private accounts can create hidden-by-default profiles, opt into handle discovery and exchange adult-only message requests. Both participants must consent before ongoing messaging. Blocking, selected-message reporting and a moderator inbox support community boundaries. Messages use server-side authenticated encryption and HTTPS, not end-to-end encryption.

Meeting filters include today, tomorrow, next 24 hours, weekend, next seven days, a chosen date, day of week, morning/afternoon/evening/overnight and custom start times. Date/clock filters use the selected time zone; the day-of-week filter uses the source zone. The list and map share the same query and cancellation exclusions. These are scheduled start times, not live confirmations or provider opening hours.

Meeting details offer Google Calendar, Outlook.com, Microsoft 365 and Yahoo event links, plus Apple/other-calendar ICS files. People review and save events themselves. Single events follow the matching occurrence; recurring downloads include recorded cancellations. Optional 10-minute reminders use neutral alarm text. Downloads are snapshots, not subscribed feeds. Private saved collections support filtered CSV/JSON/PDF/calendar exports and an explicit offline device copy.

The support hub links to official housing, family, peer, transport, food, employment and harm-reduction resources. Practical listing details distinguish unknown access requirements from sourced facts. Organization representatives can request verified update access and submit changes for administrator review. Spanish covers selected interface controls as a preliminary version; source listings remain in their original language.

Apply migrations 006–008 before release and configure a separate MESSAGE_ENCRYPTION_SECRET in production and preview. Read OPERATIONS.md for retention, monitoring, moderation and recovery responsibilities.

## Directory navigation and browser checks

The directory keeps filters, page, meeting-ordering time, list/map choice and scroll position in the current tab's session storage and browser history. Refresh and Back/Forward restore that state; relative-time searches expire after 12 hours. Search terms and location are not put into share URLs. Listing links use `/?resource=<id>` and open that listing directly, including when it is not on the current result page.

Opening a mapped listing automatically centers and highlights its location, including shared links and map selections. The selection persists after closing details and is independent of card hover and clustered map responses. **Show on map** in the detail dialog reveals the map on mobile; approximate coordinates use an area-level zoom, and online-only or unmapped listings never receive a false physical pin.

Results prioritize meetings and programs over NPPES registry records by default. **All listings equally** removes that priority; registry results remain searchable in either mode. Cards expose available joining, telephone and directions links and the source-review date. Review-due badges describe source freshness, not current availability or independent clinical verification.

Run browser checks with `npx playwright install --with-deps chromium webkit` followed by `npm run test:browser`. The suite starts a local snapshot-backed app with no database credentials and runs desktop Chromium, mobile Chromium and mobile WebKit. CI runs the same suite on pull requests and main. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an already-installed Chromium for local testing.
