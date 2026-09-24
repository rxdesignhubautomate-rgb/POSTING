# RX Publer Web Validation

Validation updated on 2026-09-24.

## Checks

- `npm ci --no-fund`
- `npm test`
- `npm run build`

## Result

The Node test suite passed (11 files, 85 tests), and the Next.js 16 production build completed successfully with all 12 pages/routes generated.

The dashboard was opened locally in demo mode and the main workflow was checked:

- The dashboard loads with sample content.
- The editor opens from a job row.
- Brief editing and platform preview controls work.
- Pinterest and platform-specific copy previews render.
- Demo mode blocks live API writes until production environment variables are configured.

## Notes

Weekly autopilot coverage now includes brand-scoped planning, deterministic seeds, YouTube video reuse limits, shortfall reporting, persona validation, cron authorization, existing route safety, model payloads, engine safety and auth. Reset coverage verifies dry runs, exact confirmation, backup-before-delete ordering, settings preservation and non-fatal Publer failures.

Demo mode is intentional when `ADMIN_PASSWORD` is missing or `DEMO_MODE=true`. Production mode requires the environment variables listed in `.env.example`, the Neon SQL schema in `schema.sql`, Vercel Blob storage, OpenAI API access, Publer API access, and a configured cron trigger. Database URL fallbacks include `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, `DATABSE_...`, and `DATABSEE_...`.

Live Neon/Blob/OpenAI/Publer acceptance and real social posting still require your account credentials and manual Publer verification.
