# MailSense

MailSense is an internal lead-verification tool for B2B marketing workflows. It imports CSV and XLSX lead files, stores canonical leads in SQLite, verifies addresses with an embedded Reacher CLI inside the app service, shows verification status and risk in a simple dashboard, and exports clean rows for a separate sending system.

## Stack

- SvelteKit 2 + Svelte 5
- Hono mounted under `/api`
- SQLite with Drizzle ORM and `better-sqlite3`
- Better Auth with Google OAuth
- Embedded Reacher CLI for in-app email verification
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

For local Google sign-in, the OAuth client must allow the exact local callback URL:

- `http://localhost:5173/api/auth/callback/google`

Required values for actual authentication and verification:

- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

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

The dev and build scripts automatically download a pinned Reacher CLI binary into `/.reacher`.
If you want to fetch or refresh it explicitly, run:

```sh
bun run reacher:install
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

## Google OAuth setup

MailSense uses Better Auth with the Google provider. Better Auth builds the callback URL from
`BETTER_AUTH_URL` and expects Google to redirect back to:

- `<BETTER_AUTH_URL>/api/auth/callback/google`

If Google shows `Error 400: redirect_uri_mismatch`, compare the URI in the error page with the
URIs configured in Google Cloud Console. They must match exactly, including scheme, host, port,
and path.

Recommended Google Cloud setup:

1. Open Google Cloud Console and create or select the project for MailSense.
2. Configure the OAuth consent screen for your organization.
3. Create an OAuth 2.0 Client ID of type `Web application`.
4. Add authorized JavaScript origins for every environment you use:
   - `http://localhost:5173`
   - `https://<your-railway-domain>` or your custom domain
5. Add authorized redirect URIs for every environment you use:
   - `http://localhost:5173/api/auth/callback/google`
   - `https://<your-railway-domain>/api/auth/callback/google`
6. Copy the client ID and client secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
7. Set `ORIGIN` and `BETTER_AUTH_URL` to the same base URL for that environment.

Rules that matter:

- `BETTER_AUTH_URL` and `ORIGIN` should point to the same public base URL.
- Production should use `https://`, not `http://`.
- If your local dev server uses a different port, register that exact port in Google Cloud.
- If you switch from the Railway generated domain to a custom domain, add the custom domain to both
  authorized origins and authorized redirect URIs.

## Environment variables

Key runtime settings:

- `DATABASE_URL`: SQLite file path. Local default is `./data/mailsense.db`.
- `ORIGIN`: Public app origin. In production this should be the `https://` URL users actually open.
- `BETTER_AUTH_URL`: Public base URL used by Better Auth. Keep it identical to `ORIGIN`.
- `BETTER_AUTH_SECRET`: Better Auth secret. Use a high-entropy value with at least 32 characters.
- `GOOGLE_CLIENT_ID`: Google OAuth client ID.
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret. Keep it only in server-side environment variables.
- `REACHER_FROM_EMAIL`: Optional sender address used by the embedded verifier when opening SMTP conversations.
- `REACHER_HELLO_NAME`: Optional EHLO/HELO name for the embedded verifier. Defaults to the app hostname.
- `REACHER_SMTP_PORT`: SMTP port used by the embedded verifier. Defaults to `25`.
- `REACHER_CHECK_GRAVATAR`: Optional `true`/`false` flag to enable Gravatar checks.
- `VERIFICATION_PACING_MS`: Delay between checks within a bulk chunk.
- `VERIFICATION_TIMEOUT_MS`: Per-check timeout.
- `VERIFICATION_BATCH_SIZE`: Maximum checks per bulk-processing request.
- `VERIFICATION_STALE_RUN_MINUTES`: When a processing run can be resumed safely.
- `MAX_UPLOAD_BYTES`: Upload size cap.

How embedded verification works:

- MailSense no longer depends on a hosted Reacher API or a separately deployed Reacher backend.
- `bun run dev` and `bun run build` download a pinned Reacher CLI binary into the app workspace.
- The backend executes that binary locally for manual checks and bulk verification runs.
- This preserves the single-service Railway deployment model from the user's point of view.
- Verification accuracy still depends on outbound DNS and SMTP reachability from the deployed container.
- Railway currently allows outbound SMTP on Pro plans and above, so embedded verification may be limited on lower plans even though no second service is required.

## Production security checklist

- Keep `.env` local only and inject production secrets through Railway variables.
- Use a dedicated production Google OAuth client or at least dedicated production callback entries.
- Set `ORIGIN` and `BETTER_AUTH_URL` to the same `https://` URL.
- Store SQLite on a persistent Railway volume, typically `DATABASE_URL=/data/mailsense.db`.
- Generate a strong `BETTER_AUTH_SECRET` and rotate it if it was ever exposed.
- Remove any stale `REACHER_API_TOKEN` or `REACHER_BACKEND_URL` variables from production config; they are ignored now.
- Re-run `bun run validate:predeploy` before deployment changes.

## Railway deployment

The app is designed as a single deployable Railway service.

Recommended Railway setup:

1. Create one service from this repository.
2. Add a persistent volume mounted at `/data`.
3. Set `DATABASE_URL=/data/mailsense.db`.
4. Set `ORIGIN` and `BETTER_AUTH_URL` to the same Railway public URL or custom domain.
5. Add the Google OAuth secrets and any optional embedded-verifier tuning variables you want to use.
6. In Google Cloud, add the exact production callback URI:
   - `https://<your-railway-domain>/api/auth/callback/google`
7. If you expose a custom domain, add that exact callback URI too.

Railway note:

- The verifier is bundled into MailSense, but real SMTP reachability still depends on Railway plan and outbound-network policy.
- If Railway blocks SMTP for your environment, verification can still return `unknown` for domains the container cannot probe.

The deployment uses `bun run start`, which:

- ensures the SQLite directory exists
- runs Drizzle migrations from `drizzle/`
- starts the adapter-node server with Railway-friendly forwarded-header defaults

## Railway-like local validation

The local validation flow is designed to catch build and runtime surprises before you point Railway at the repo.

- `bun run validate:build`: removes the old build output, injects production-like runtime env defaults, and checks that adapter-node emits a runnable production bundle.
- `bun run validate:runtime`: builds, starts the production server through `bun run start`, verifies `HOST` and `PORT` binding, checks DB initialization and migrations, seeds a disposable Better Auth session, and smoke-tests protected import, leads, export, and embedded manual verification endpoints against the real production server.
- `bun run validate:predeploy`: runs the runtime validation plus a strict environment audit for Railway readiness. It intentionally fails if your current env still points at local callback URLs, lacks required auth variables, or uses a non-persistent `DATABASE_URL`.

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
- `bun run reacher:install`: download or refresh the pinned embedded Reacher CLI binary
- `bun run db:generate`: generate Drizzle SQL migration files
- `bun run db:push`: push schema directly to SQLite
- `bun run auth:schema`: regenerate Better Auth SQLite schema
- `bun run test`: run unit tests with Vitest

## Verification subdomain setup

MailSense supports configuring a dedicated verification identity so Reacher uses your own subdomain
when probing remote mail servers. This is optional — without it, Reacher uses its built-in defaults
(`reacher.email@gmail.com` as the `MAIL FROM` address and `gmail.com` as the `EHLO` name).

### Why use a dedicated subdomain

Using a dedicated subdomain keeps verification SMTP traffic separate from your primary domain and
gives you control over the identity that remote servers see during SMTP conversations.

### How to configure

1. **Choose a subdomain** — for example, `verify.yourdomain.com`.
2. **Create a DNS A record** pointing the subdomain to your server's public IP address.
3. **Set the environment variables:**
   ```sh
   REACHER_FROM_EMAIL=check@verify.yourdomain.com
   REACHER_HELLO_NAME=verify.yourdomain.com
   ```
4. **Restart the app** (or redeploy on Railway).

Both variables are optional. If either is unset, Reacher uses its own built-in default for that
value. The app does not invent fallback values — it either passes your configured value to the CLI
or omits the flag entirely.

### Reacher CLI flags used

The embedded Reacher CLI (pinned version) supports these identity-related flags:

- `--from-email`: The email address used in the `MAIL FROM:` SMTP command. Reacher default: `reacher.email@gmail.com`.
- `--hello-name`: The hostname used in the `EHLO` SMTP command. Reacher default: `gmail.com`.
- `--smtp-port`: The SMTP port. Reacher default: `25`.

These are the only identity inputs passed to the CLI. MailSense does not add custom SMTP behavior,
synthetic flags, or app-level verification heuristics.

### CLI argument path

All verification flows — manual single verification and bulk verification runs — use the same
centralized `buildCliArguments` function. There is a single code path that constructs CLI arguments,
ensuring consistent identity across every verification.

## Setup assistant

The app includes a minimal setup assistant at `/setup` that helps the operator:

- See the effective verification identity configuration (configured values vs. Reacher defaults)
- Understand which values need to be configured for a dedicated subdomain
- Get copyable DNS record and environment variable templates
- Run a readiness check

### What the readiness check verifies

- Whether the Reacher CLI binary is installed
- Whether configured values are present
- Whether `REACHER_FROM_EMAIL` is a syntactically valid email address (if set)
- Whether `REACHER_HELLO_NAME` is a syntactically valid hostname (if set)
- Whether the `REACHER_HELLO_NAME` hostname resolves publicly via DNS (if set and valid)
- Whether the effective configuration is complete enough to run the CLI

### What the readiness check does NOT prove

- It does not verify that any email address is deliverable.
- It does not test SMTP reputation or sender trust.
- It does not guarantee that remote mail servers will accept SMTP connections.
- It does not replace running an actual Reacher verification.
- DNS resolution confirms the hostname exists, not that SMTP will succeed.

## Diagnostics

The app includes a diagnostics surface at `/diagnostics` and via `GET /api/diagnostics`. It provides
a comprehensive health check covering the embedded binary, configuration, network readiness, and
recent failure history.

### What diagnostics check

**Binary health:**
- Whether the Reacher CLI binary file exists at the configured path.
- Whether the binary is executable (has `X_OK` permission).
- The binary's reported version (`--version` output).

**Configuration health:**
- Whether `REACHER_FROM_EMAIL` is syntactically valid (if set).
- Whether `REACHER_HELLO_NAME` is syntactically valid (if set).
- Whether both identity values are set (subdomain configured).
- Whether the from-email domain matches the hello-name (identity alignment).
- Effective SMTP port, timeout, pacing, and batch size values.

**Network health:**
- Whether `REACHER_HELLO_NAME` resolves via DNS (A records).
- Whether MX records exist for the hello-name domain.
- Whether SMTP port 25 is reachable from the container to the hello-name IP.

**Last failure:**
- The most recent verification failure from the database, including its failure class,
  whether it was app-side or infrastructure-side, and the raw reason.

**Summary:**
- `appIntegrationHealthy`: binary is installed, executable, has a version, and config is valid.
- `infrastructureLikelyHealthy`: DNS resolves and SMTP port is reachable (null if no hello-name is configured).

### Diagnostics vs. setup

The `/setup` page runs a lightweight readiness check focused on whether the app can be configured.
The `/diagnostics` page runs a deep health check focused on whether the app is working correctly
in the current deployment environment. Use diagnostics to investigate why verifications return
`unknown` or fail.

## Failure classification

Every verification failure is classified into a structured failure class so operators can tell
whether a problem is app-side (configuration, binary, parsing) or infrastructure-side (DNS, SMTP,
remote provider behavior).

### Failure classes

| Class | Side | Meaning |
|---|---|---|
| `config_invalid` | App | Local configuration prevents verification from running. |
| `identity_config_invalid` | App | Subdomain identity config is malformed. |
| `binary_missing` | App | The Reacher CLI binary was not found. |
| `binary_unusable` | App | The binary exists but cannot be executed. |
| `cli_invocation_failure` | App | The CLI process exited with a non-zero code. |
| `cli_timeout` | App | The CLI process exceeded the configured timeout. |
| `malformed_output` | App | The CLI returned output that could not be parsed. |
| `dns_resolution_failure` | Infra | DNS lookup failed for the target domain. |
| `no_mx_or_smtp_target` | Infra | No MX records or SMTP targets were found. |
| `smtp_connection_refused` | Infra | The remote SMTP server refused the connection. |
| `smtp_timeout` | Infra | The SMTP connection timed out. |
| `remote_ambiguous` | Infra | The remote server gave an inconclusive response (greylisting, catch-all, etc.). |
| `app_error` | App | An internal app error occurred (persistence, state). |
| `unknown_failure` | Unknown | The failure could not be classified. |

### How classification works

Classification happens at two levels:

1. **Process-level**: When `runEmbeddedReacher` throws an error (binary missing, timeout, spawn failure,
   malformed output), the error message is pattern-matched to determine the failure class.
2. **Field-level**: When Reacher returns a JSON result but a field contains an error object (e.g., DNS
   failure in the `mx` field, connection refused in the `smtp` field), the error type and message
   are pattern-matched to classify the infrastructure issue.

Classification never overrides Reacher's verdict. It only annotates failures with structured metadata
to help operators diagnose problems.

### Where classification appears

- In the `details` column of `leadVerifications` database records (as `failureClass`, `failureSummary`,
  `isAppSide`, `isInfrastructureSide`).
- In structured console logs emitted during verification.
- In the diagnostics page under "Last failure".
- Accessible via the API in verification responses.

## Troubleshooting verification issues

### Verifications return "unknown"

This is the most common issue. `unknown` means Reacher ran but could not determine deliverability.

1. Open `/diagnostics` and check the health summary.
2. If **app integration is unhealthy**: fix the binary or config issue shown.
3. If **infrastructure is unhealthy**: the container cannot reach SMTP servers. Check:
   - Is outbound port 25 allowed? (Railway Pro plan required.)
   - Does the hello-name resolve in DNS?
   - Are MX records configured for your subdomain?
4. If **both are healthy** but verifications still return unknown: the remote mail server may be
   greylisting, rate-limiting, or blocking the verification IP. This is expected behavior that
   Reacher reports honestly.

### Verifications fail with errors

Check the failure class in the lead's verification details or in `/diagnostics`:

- **App-side failures** (binary_missing, cli_timeout, malformed_output, etc.) indicate a deployment
  or configuration problem. Fix the app environment.
- **Infrastructure-side failures** (dns_resolution_failure, smtp_connection_refused, smtp_timeout)
  indicate a network or DNS problem. Check the container's network access and DNS configuration.

### Timeout vs. unknown

- **Timeout** (`cli_timeout`): The Reacher process was killed because it exceeded `VERIFICATION_TIMEOUT_MS`.
  The remote server may be slow or unreachable. Consider increasing the timeout.
- **Unknown** (`remote_ambiguous`): Reacher completed but the remote server's response was inconclusive.
  This is a normal outcome for many domains and is not an error.

## Testing

Run the test suite:

```sh
bun run test
```

### What the tests cover

**Failure classification tests** (`failure-classification.test.ts`):
- Process-level error classification (binary missing, timeout, malformed output, exit codes, signals).
- Field-level error classification (DNS failures, connection refused, SMTP timeout, greylisting, catch-all).
- Label and remediation hint generation for all 14 failure classes.

**Reacher CLI tests** (`reacher-cli.test.ts`):
- CLI argument construction for all configuration combinations.
- Output parsing for valid JSON, JSON with leading noise, empty output, and malformed payloads.
- Binary availability and version detection.

**Verification tests** (`verification.test.ts`):
- Integration of failure classification into the verification pipeline.
- Classification of different error types during verification.
- Centralized verifier path consistency (both single and bulk flows use the same code path).

**Diagnostics tests** (`diagnostics.test.ts`):
- Binary health reporting (installed, executable, version).
- Configuration health validation (from-email, hello-name, identity alignment).
- DNS resolution and network health checks.
- Effective CLI argument reporting.

**Setup tests** (`setup.test.ts`):
- Readiness check for binary presence, config validity, and DNS resolution.

### What the tests do NOT prove

- Tests do not verify that any email address is actually deliverable.
- Tests do not make real SMTP connections — network checks are mocked.
- Tests do not prove that Reacher will produce a specific verdict for a given email.
- Tests do not validate Railway deployment configuration or volume mounts.
- Passing tests confirm app-side correctness, not infrastructure readiness.
