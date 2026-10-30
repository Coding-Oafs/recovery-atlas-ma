# Recovery Atlas � Northeast

A mobile-friendly map and directory for people exploring recovery, substance use treatment and mental health support across Connecticut, Massachusetts, Maine, New Hampshire, New Jersey, New York, Pennsylvania, Rhode Island and Vermont.

## What is included

- Regional public listings from NPPES, SAMHSA, New York OASAS, Massachusetts BSAS and MassGIS, AA, NA, SMART Recovery, Recovery Dharma and Refuge Recovery, alongside the original 49 curated listings. See `public/coverage.json` for source counts and limitations.
- Every mapped search match is represented, independent of list pagination. A viewport endpoint groups pins when zoomed out; zooming reveals individuals. Shared locations have paginated resource choices. City/ZIP/address search, browser location and mileage radius.
- State, keyword, service, recovery approach, format, payment, language, participation, meeting day and wheelchair-access filters.
- Recurring meeting calculation in Eastern time with next occurrences displayed in the visitor's time zone. Online-only meetings have no pins or physical radius restrictions.
- Evidence-labeled payment and insurer records, including McLean's published product restrictions.
- Browser-local bookmarks or private cross-device accounts with optional passkeys, recovery codes, CSV/JSON/PDF/calendar exports, crisis/help links, source dates, correction/new-resource submissions.
- Protected administrator dashboard: review inbox, listing and meeting edits, insurer/product edits, publication controls, export, validated insert-only JSON import, audit history and source connection status.
- Daily source-link checks on Vercel. Link checks never claim to verify clinical services or meeting operation.

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

Share [Recovery Atlas](https://recoveryatlas.vercel.app/). Visitors need no login or Vercel account. The footer�s Copy public link button copies this address without personal search terms. The production alias is public; preview and individual deployment URLs remain protected. Keep the existing project/repository names so current links continue to work. A custom domain is optional.

## Deployment

Connect this repository to the `recovery-atlas-ma` Vercel project. Set the environment variables for production and preview separately. Verify the intended account, project, commit and database branch before deployment. Use Vercel Git integration for preview builds; production tracks `main`. Standard deployment protection keeps preview and per-deployment URLs protected while the production domain is public. `/admin` has its own application authentication.

Vercel Cron calls `/api/maintenance` daily at 11:00 UTC (7am Eastern daylight / 6am Eastern standard). The endpoint requires the secret bearer token. It checks six source links per run, records results and expires old rate-limit records. It also rotates through two approved official meeting feeds, queues proposed changes for review and expires community records under the retention policy. It does not publish unreviewed changes, insurer lists or bed availability.

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

Apply migrations 006�008 before release and configure a separate MESSAGE_ENCRYPTION_SECRET in production and preview. Read OPERATIONS.md for retention, monitoring, moderation and recovery responsibilities.
