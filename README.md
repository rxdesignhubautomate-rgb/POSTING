# RX Studio — Vercel project

A complete Next.js web dashboard for RX Design Hub. Upload media, research a topic, write platform-specific copy, edit and preview each version, create Publer drafts, schedule posts, and export an Excel tracker.

The **Future Press** interface uses a brand-aware command workflow, dedicated loading and recovery screens, explicit request timeout messages, responsive navigation, and `/api/health` for a fast deployment availability check. A browser-level DNS/TLS failure happens before application code can load; use the health route or another network/browser to distinguish that condition from an RX Studio runtime error.

This is the web application. Deploy **this folder** (`rx-publer-web`), not the separate Windows CLI project.

## Try it immediately

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. With no credentials configured, the app opens a clearly labeled **demo workspace**. You can create/edit briefs, upload small sample media, switch platform previews, simulate publishing, browse the calendar and export a CSV tracker. Demo data stays in browser storage. Demo actions never call OpenAI, Publer, the database or Blob storage. Demo uploads are limited to 1 MB each and about 4 MB total browser storage; live limits are higher.

## Deploy a new Vercel project

### Option A — GitHub + Vercel dashboard

1. Extract the ZIP. Create a new **private** GitHub repository, for example `rx-publer-studio`.
2. Upload the **contents** of `rx-publer-web` to that repository. `package.json`, `app/`, `lib/`, `public/` and `next.config.mjs` should be at its root. Include `.env.example` and the lockfile. Never upload `.env.local`, `node_modules`, or `.next`.
3. In Vercel, choose **Add New → Project → Import Git Repository** and select the repository.
4. Framework: **Next.js**. Root directory: `./` if the project files are at the repository root; otherwise select `rx-publer-web`. Use Node.js **22 or newer**, the default `npm run build` command, and the framework's default output directory.
5. Deploy. The site works in demo mode immediately without API keys.
6. Add the services and variables below, then **redeploy**. Sign in and use **Connections → Sync Publer accounts**.

### Option B — Vercel CLI, without GitHub

From this folder:

```powershell
npm install
npx vercel login
npx vercel
```

Choose a new project and accept Next.js detection. Use Vercel's project dashboard to connect storage and add environment variables. After setup:

```powershell
npx vercel --prod
```

Vercel login is completed in your own browser. This project does not include someone else's account, credentials or deployed URL.

## Turn on live mode

You need three services besides the Vercel application: Neon Postgres, Vercel Blob, and your existing Publer/OpenAI accounts. Their quotas and charges depend on your plans.

### 1. Database

In the Vercel project's Storage/Marketplace area, connect a **Neon Postgres** database. Supply its connection string as `DATABASE_URL`; `POSTGRES_URL` is also accepted. The application creates its `rx_jobs`, `rx_settings` and `rx_limits` tables on the first authenticated operation. Use a database role allowed to create these tables, or run [schema.sql](schema.sql) once with an administrative role.

Job history, generated copy, research, account settings, import IDs, submission IDs and processing leases persist in Postgres. No job state depends on the ephemeral Vercel filesystem.

### 2. Media storage

Create and connect a **public Vercel Blob** store. Its `BLOB_READ_WRITE_TOKEN` must be available to the project. Set `BLOB_PUBLIC_ORIGIN` to the exact store origin, for example:

```text
https://your-store-id.public.blob.vercel-storage.com
```

Find the origin from a Blob file URL/store details. Use only the `https://hostname` portion, without a file path. The origin must match the actual connected store. This prevents arbitrary external URLs from being registered as uploaded media.

Live media uploads go **directly from the browser to Blob**, avoiding Vercel Functions' request-body limit. Authenticated upload tokens restrict content type, pathname and size. Limits: 20 MB per image, 200 MB per video; 1–10 images or one video per post. Publer imports the media from those hosted URLs. Public Blob URLs are deliberately accessible to anyone with the link: use public marketing assets only.

Removing media from an editable draft also deletes that job-owned Blob immediately. Archiving preserves the record until the configured retention window, after which daily cleanup removes the record and its managed media.

### 3. Environment variables

Add these in **Vercel → Project → Settings → Environment Variables** for the deployment environments you use:

| Variable | Value |
|---|---|
| `DEMO_MODE` | `false` |
| `ADMIN_PASSWORD` | A private password of at least 16 characters |
| `SESSION_SECRET` | A random secret of at least 32 characters |
| `DATABASE_URL` | Neon connection string |
| `BLOB_READ_WRITE_TOKEN` | Token from the connected public Blob store |
| `BLOB_PUBLIC_ORIGIN` | Exact public Blob HTTPS origin |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `AI_MODEL` | Main OpenAI model; defaults to `gpt-5.6-terra` |
| `AI_MODEL_FAST` | Optional faster/cheaper model for per-post copy; defaults to `gpt-5.6-luna` |
| `OPENAI_MODEL` | Legacy alias, still accepted |
| `OPENAI_MODEL_FAST` | Legacy fast-model alias, still accepted |
| `WEEKLY_MAX_AI_CALLS` | Optional weekly call guardrail; defaults to `400` |
| `CRON_SECRET` | Random secret of at least 32 characters for `/api/cron/tick` |
| `APP_URL` | Your deployed app URL, used by the GitHub Actions tick fallback |
| `PUBLER_API_KEY` | Your Publer API key, without the `Bearer-API` prefix |
| `PUBLER_WORKSPACE_ID` | Your intended Publer workspace ID |

Generate a session secret locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

None of these variables uses a `NEXT_PUBLIC_` prefix. They must remain server-side. Rotate `SESSION_SECRET` to invalidate existing sessions. Password changes alone do not invalidate already signed sessions, so rotate both if access must be revoked immediately. Sessions expire after twelve hours. This is a single-admin studio, not a multi-user application.

If you don't know the workspace ID: configure your Publer key and all login/storage variables, redeploy, sign in and click Sync Publer accounts. The Connections page lists accessible workspace IDs. Set the intended ID in Vercel, redeploy and sync again. Create new jobs after selecting the workspace; job/import state is intentionally bound to its original workspace.

If Neon created variables with your database prefix instead of `DATABASE_URL`, the app also accepts `DATABSE_DATABASE_URL_UNPOOLED`, `DATABSE_POSTGRES_URL`, `DATABSE_POSTGRES_PRISMA_URL`, `DATABSE_POSTGRES_URL_NO_SSL`, and the same `DATABSEE_...` spellings.

## Weekly workflow

Use **All Brands** for the combined overview, then open an RX Design Hub Global, Visual Aid Manufacturer Lucknow, or Shubham Personal Branding dashboard. Topics, media pools, channel selection, statistics, calendars and media libraries are scoped to the active brand.

1. **Connections → Sync Publer accounts.** In **Brand & channel mapping**, map each channel to its brand, persona, Publer account and (for Pinterest) board. Set the production cadence from 1–10 posts per week and save it.
2. **This Week → add topics.** Ek line me topic likho: `topic | keyword | notes`. Add 3-15 topics.
3. **Upload videos/images.** Video ke liye notes zaroor do, because the AI cannot watch video files. Notes explain what the video shows.
4. **Build week.** The planner creates slots only for the active brand (or all enabled channels from All Brands), rotates topics, avoids duplicate YouTube video use, and reports shortfalls when more videos are needed.
5. **Wait for drafts.** Cron/background tick researches, writes and reviews drafts. Browser band karne ke baad bhi cron drafts banata rahega when configured.
6. **Approve all valid.** Approval sends only the active brand's valid drafts to Publer at the planned IST slots. `needs_fix` drafts stay isolated and do not block the rest of the week.

## Brand dashboards

The sidebar contains four dashboard choices:

- **All Brands** — a combined overview with an ink-plate summary for each brand.
- **RX Design Hub Global** — pan-India pharma branding using the RX national persona.
- **Visual Aid Manufacturer Lucknow** — local Lucknow/UP search and service content.
- **Shubham Personal Branding** — first-person founder, automation and bootstrapping content.

The selected dashboard is remembered in browser storage. Creating a post from a brand dashboard pre-fills its CTA, persona, enabled platforms, mapped accounts and Pinterest board. Brand ownership is stored in existing JSONB records, so no database migration is required.

## Fresh start / reset

The reset tool is destructive, so its default mode is a read-only preview:

```powershell
npm run reset
```

It prints row counts plus scheduled/draft Publer posts that would be removed. To proceed, use:

```powershell
npm run reset -- --confirm
```

Before any deletion, this writes `backups/rx-backup-<timestamp>.json` with every reset table and settings row. The reset truncates `rx_jobs`, `rx_weeks`, `rx_media`, `rx_research`, `topic_research`, `ai_usage`, and `rx_limits`; it deletes the `channels` setting so shipped brand defaults reload, while keeping the `connections` setting.

- Add `--all` to delete every settings row, including the saved Publer connection sync.
- Add `--blob` to delete managed `media/` and `pool/` objects from Vercel Blob.
- Publer scheduled/draft deletion is attempted when credentials exist. API/plan failures do not stop the database reset; the command prints IDs that must be removed manually in **Publer → Calendar**.

The same guarded workflow is available in **Connections → Danger zone · Fresh start**. It previews counts, requires typing `RESET` exactly, downloads the JSON backup, and then refreshes the empty workspace. It is disabled in demo mode.

### Background cron

The project ships two tick options:

- `vercel.json` includes `/api/cron/tick` every 10 minutes. Vercel Hobby plans may only allow daily cron frequency, so use Vercel Pro for frequent ticks.
- `.github/workflows/rx-tick.yml` is the free fallback. Add GitHub repo secrets `APP_URL` and `CRON_SECRET`; it calls `/api/cron/tick?limit=6` every 10 minutes.

The cron route requires `Authorization: Bearer CRON_SECRET`. It performs one saved phase per job and stops before the serverless timeout. Ambiguous Publer writes still go to `needs_attention` and are not blindly retried.

The same cron performs retention cleanup at most once per day. By default, it removes submitted posts seven days after they were sent, scheduled posts seven days after their publishing time, and archived items after seven days. It also removes their managed `media/<job-id>/` Blob files, orphaned weekly media pools, expired research caches, old AI usage rows, and empty old week records. Drafts (including Publer drafts), review items, failed/ambiguous jobs, running work, and future scheduled posts are never selected. `RETENTION_DAYS=7` is the minimum and recommended setting; it can be increased up to 3650 days. This cleanup removes RX Studio records and managed Blob objects only; it does not delete posts from social platforms or Publer.

### 4. Redeploy and verify

Environment changes require a new deployment. Open the deployed site and sign in with your studio password. On Connections, check that the four services show configured and sync your Publer accounts/boards. A configured badge indicates that environment variables exist, not that external service access has been verified; a successful operation verifies access.

Start with one real photo and one platform:

1. **Create a post** → enter topic, keyword, language, CTA and notes.
2. Select platforms, the actual target accounts, and Pinterest boards where applicable.
3. Upload media, then **Generate content**.
4. Review the research sources and every platform preview. Edit copy or alt text in **Platform copy**.
5. Save changes and click **Review / continue**. Edits require a new compliance check.
6. Choose **Create Publer draft** and confirm. Review the real draft in Publer before using Schedule or Publish now.

## How processing works on Vercel

The app uses short, resumable requests instead of a permanent folder watcher:

- Research is one saved phase, including support for web-search continuations.
- Each platform's copy is generated in its own request, with one automated repair and final deterministic validation.
- A separate review checks the assembled copy against source facts and brand rules.
- Media import starts once and is polled in separate requests.
- Delivery saves a submission marker before calling Publer, then stores its job ID for subsequent polling.

The browser advances these saved steps while open. **Closing the browser pauses advancement after the current request.** Reopen the editor and choose Review / continue, the publishing action, or Activity → Check status as applicable. A hard timeout may leave a processing lease in place for up to 310 seconds; wait and retry. The app does not claim a durable autonomous queue is running after the browser closes.

Once Publer accepts a scheduled post, **Publer handles its scheduled publication without this app or browser staying open**. Schedule inputs mean Asia/Kolkata (`+05:30`). Publish now requires a confirmation dialog. A successful creation job is shown as Submitted/Publer draft/Scheduled; final network publication should be checked in Publer.

Concurrent requests are serialized with database leases and compare-and-swap writes. Known job IDs are polled rather than resubmitted. Ambiguous timeouts or 5xx write responses are stopped for manual Publer reconciliation, avoiding blind duplicate posts. Partial failures are retained and never automatically replayed. No automatic retry of uncertain writes is performed.

## Format decisions

This project follows the API findings from the CLI build:

- Reels and Shorts use `type:"video"` with `details.type:"reel"`/`"short"`.
- Conservative Shorts selection is vertical video <=60 seconds; otherwise regular YouTube video.
- Google Business uses a photo update and `title:"LEARN_MORE"`/`url`; video is skipped because Publer's detailed format guide excludes it.
- Pinterest boards are selected using `accounts[].album_id`.
- Instagram hashtag comments use account callbacks.
- Threads is skipped in scheduled posts. This web version has no publish-now fallback for a scheduled Threads post.
- Upload `validity` must affirm the network/format. Missing or false validity skips the platform; no remaining accounts means no submission.
- Browser image/video metadata helps select formats; Publer upload validity remains the final media compatibility check. The web project does not package FFmpeg, compress/transcode videos, or watch local folders.
- Research facts must reference actual web-search URLs. Hashtags are relevance suggestions, not claimed verified trends. Automated compliance checks reduce risk but cannot guarantee factual correctness.
- The web version stores research per job; it does not share the CLI's seven-day research cache across jobs.

## Development and validation

```powershell
npm ci
npm test
npm run build
npm run start
```

For local live testing, copy `.env.example` to `.env.local` and set your variables. Use `npm run dev` for non-secure localhost cookies; deployed production uses secure, HTTP-only, SameSite=Strict cookies. Use Vercel Preview deployments to verify the full Blob callback flow.

Local production build and automated tests are recorded in [VALIDATION.md](VALIDATION.md). Live Neon/Blob/OpenAI/Publer acceptance and actual Vercel deployment require your account access and are not represented as tested.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Still in demo mode | Set `DEMO_MODE=false` and `ADMIN_PASSWORD`; redeploy |
| Login error about database | Connect Neon and set `DATABASE_URL`; schema initialization requires access |
| Invalid session configuration | `SESSION_SECRET` needs 32+ characters, password needs 16+ |
| No accounts | Sync Connections; check Publer API plan/scopes and workspace ID |
| Blob URL rejected | Verify `BLOB_PUBLIC_ORIGIN` matches the connected store exactly |
| Cannot read MOV metadata | Convert to H.264 MP4; browser codec support varies |
| Job is busy | Wait for the active request; after a hard timeout, wait up to 310 seconds |
| Content needs review | Save changes, then Review / continue |
| No suitable media/accounts | Inspect Activity/JSON and Publer validity; choose a compatible platform/media |
| Media acceptance uncertain | Inspect Publer and the downloaded job JSON; do not blindly create a duplicate |
| Publer request fails with partial success | Reconcile successful accounts; create a new job only for confirmed failures |
| Image/video removed but storage unchanged | Detaching media does not delete the Blob; manage storage in Vercel |
| Research call timed out | Retry the saved phase; check OpenAI model access and balance |

## Official references

- [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- [Vercel Blob browser uploads](https://vercel.com/docs/vercel-blob/client-upload)
- [Publer quickstart](https://publer.com/docs/getting-started/quickstart.md)
- [Publer format reference](https://publer.com/docs/posting/create-posts/networks.md)
- [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses)
