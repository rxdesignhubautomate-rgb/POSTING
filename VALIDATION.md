# RX Publer Web Validation

Validation completed on 2026-09-17.

## Checks

- `npm run build`
- `npm test`
- Local browser preview at `http://127.0.0.1:3100/`

## Result

The Next.js production build completed successfully, and the Node test suite passed.

The dashboard was opened locally in demo mode and the main workflow was checked:

- The dashboard loads with sample content.
- The editor opens from a job row.
- Brief editing and platform preview controls work.
- Pinterest and platform-specific copy previews render.
- Demo mode blocks live API writes until production environment variables are configured.

## Notes

Demo mode is intentional when `ADMIN_PASSWORD` is missing or `DEMO_MODE=true`. Production mode requires the environment variables listed in `.env.example`, the Neon SQL schema in `schema.sql`, Vercel Blob storage, Anthropic API access, and Publer API access.
