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

## Expansion dependencies

SAMHSA API approval, a suitable requesting-server IP arrangement if required, and fellowship bulk-feed permissions remain external dependencies. Do not enable an undocumented scraper as a substitute. The pilot remains usable using curated data and links to authoritative directories.

The initial UI is English. Resource language filtering uses reported fields; it is not a translation feature. Appointment booking, live beds, patient portals and personal insurance eligibility checks are outside this pilot.

## Restore and rollback

For a code regression use Vercel's previous tested deployment. For a data issue, compare the audit event and restore the reviewed previous record; do not blindly reseed over live edits. Schema migrations are additive and idempotent. Do not delete or reset production branches as a repair shortcut.
