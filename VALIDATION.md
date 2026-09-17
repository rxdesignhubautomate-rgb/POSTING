# RX Publer Web Validation

Validation updated on 2026-09-17.

## Checks

- `npm ci --no-fund`
- `npm test`
- `npm run build`

## Result

The clean install completed, the Node test suite passed, and the Next.js production build completed successfully.

The dashboard was opened locally in demo mode and the main workflow was checked:

- The dashboard loads with sample content.
- The editor opens from a job row.
- Brief editing and platform preview controls work.
- Pinterest and platform-specific copy previews render.
- Demo mode blocks live API writes until production environment variables are configured.

## Notes

Weekly autopilot coverage now includes planner slot generation, deterministic planning, YouTube video reuse limits, shortfall reporting, persona validation, cron authorization, existing route safety, model payloads, engine safety and auth.

Demo mode is intentional when `ADMIN_PASSWORD` is missing or `DEMO_MODE=true`. Production mode requires the environment variables listed in `.env.example`, the Neon SQL schema in `schema.sql`, Vercel Blob storage, OpenAI API access, Publer API access, and a configured cron trigger.

Live Neon/Blob/OpenAI/Publer acceptance and real social posting still require your account credentials and manual Publer verification.
