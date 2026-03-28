# MailSense

MailSense is an internal lead-verification tool for B2B marketing workflows. It imports CSV and XLSX lead files, stores canonical leads in SQLite, verifies addresses with Reacher, shows verification status and risk in a simple dashboard, and exports clean rows for a separate sending system.

## Stack

- SvelteKit 2 + Svelte 5
- Hono mounted under `/api`
- SQLite with Drizzle ORM and `better-sqlite3`
- Better Auth with Google OAuth
- Bun for package management
- Railway deployment via `@sveltejs/adapter-node`

## Core flow

1. Sign in with Google.
2. Import `.csv` or `.xlsx` lead files.
3. Review accepted rows, linked duplicates, and rejected rows.
4. Run manual checks or create safe-paced bulk verification runs.
5. Review dashboard metrics and lead results.
6. Export filtered results to CSV or XLSX for the downstream marketing app.

## Local development

Install dependencies:

```sh
bun install
```

Create local environment variables:

```sh
cp .env.example .env
```

Required values for actual authentication and verification:

- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `REACHER_API_TOKEN` or `REACHER_BACKEND_URL`

Useful defaults are already present in `.env.example` for local development structure.

Start the dev server:

```sh
bun run dev
```

Validate the app:

```sh
bun run check
bun run lint
bun run build
```

Run Railway-like local validation:

```sh
bun run validate:build
bun run validate:runtime
```

Run the stricter pre-deploy validation:

```sh
bun run validate:predeploy
```

Generate a new migration after schema changes:

```sh
bun run db:generate
```

The current initial migration is stored in `drizzle/0000_loud_susan_delgado.sql`.

## Environment variables

Key runtime settings:

- `DATABASE_URL`: SQLite file path. Local default is `./data/mailsense.db`.
- `ORIGIN`: Public app origin.
- `BETTER_AUTH_URL`: Public base URL used by Better Auth.
- `BETTER_AUTH_SECRET`: Better Auth secret.
- `GOOGLE_CLIENT_ID`: Google OAuth client ID.
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret.
- `REACHER_API_TOKEN`: Hosted Reacher API token.
- `REACHER_BACKEND_URL`: Optional self-hosted Reacher endpoint.
- `VERIFICATION_PACING_MS`: Delay between checks within a bulk chunk.
- `VERIFICATION_TIMEOUT_MS`: Per-check timeout.
- `VERIFICATION_BATCH_SIZE`: Maximum checks per bulk-processing request.
- `VERIFICATION_STALE_RUN_MINUTES`: When a processing run can be resumed safely.
- `MAX_UPLOAD_BYTES`: Upload size cap.

## Railway deployment

The app is designed as a single deployable Railway service.

Recommended Railway setup:

1. Create one service from this repository.
2. Add a persistent volume mounted at `/data`.
3. Set `DATABASE_URL=/data/mailsense.db`.
4. Set `ORIGIN` and `BETTER_AUTH_URL` to the Railway public URL or custom domain.
5. Add Google OAuth and Reacher secrets.
6. Set the Google OAuth callback URLs to include your Railway domain.

The deployment uses `bun run start`, which:

- ensures the SQLite directory exists
- runs Drizzle migrations from `drizzle/`
- starts the adapter-node server with Railway-friendly forwarded-header defaults

## Railway-like local validation

The local validation flow is designed to catch build and runtime surprises before you point Railway at the repo.

- `bun run validate:build`: removes the old build output, injects production-like runtime env defaults, and checks that adapter-node emits a runnable production bundle.
- `bun run validate:runtime`: builds, starts the production server through `bun run start`, verifies `HOST` and `PORT` binding, checks DB initialization and migrations, seeds a disposable Better Auth session, and smoke-tests protected import, leads, export, and manual verification endpoints against the real production server.
- `bun run validate:predeploy`: runs the runtime validation plus a strict environment audit for Railway readiness. It intentionally fails if your current env still points at local callback URLs, lacks required auth or Reacher variables, or uses a non-persistent `DATABASE_URL`.

Validation artifacts are written under `/.tmp/railway-local` so your regular local database is left alone.

Health check endpoint:

```text
/api/health
```

## Notes on verification behavior

- Bulk runs are intentionally chunked and resumed through explicit API calls instead of an always-on worker.
- Progress is persisted in SQLite so a stalled run can be resumed without corrupting state.
- Results separate verification status from risk classification to keep B2B list decisions practical.

## Scripts

- `bun run dev`: local development server
- `bun run check`: SvelteKit sync + type checks
- `bun run lint`: Prettier + ESLint
- `bun run build`: production build
- `bun run start`: migration-aware production start command
- `bun run validate:build`: clean production build validation with Railway-like env defaults
- `bun run validate:runtime`: production runtime smoke test using the built server
- `bun run validate:predeploy`: strict Railway readiness audit plus runtime validation
- `bun run db:generate`: generate Drizzle SQL migration files
- `bun run db:push`: push schema directly to SQLite
- `bun run auth:schema`: regenerate Better Auth SQLite schema
