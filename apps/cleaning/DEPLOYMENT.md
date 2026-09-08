# Cleaning ERP — Production Deployment Runbook

The Cleaning app runs on its **own** Supabase project and Vercel project, fully
isolated from Relay and hce-books. It shares only the `@hce/auth`/`@hce/ui`
packages — never a database.

## Environment variables — where each value comes from
| Variable | Source | Notes |
|---|---|---|
| `DATABASE_URL` | **Supabase** | Pooler (port 6543), append `?pgbouncer=true`. Runtime app. |
| `DIRECT_URL` | **Supabase** | Direct (port 5432). Used only by Prisma CLI for migrations (DDL). |
| `DATABASE_POOL_MAX` | *you (optional)* | Runtime pool cap; defaults to 3. |
| `CLEANING_SESSION_SECRET` | **you generate** | `openssl rand -base64 32`. Required in prod (min 32 chars). |
| `BLOB_READ_WRITE_TOKEN` | **Vercel Blob** | Create a Blob store → copy its read/write token. Required in prod. |
| `CLEANING_BOOTSTRAP_TOKEN` | **you generate** | The `/register` setup code; share with the customer. |
| `CRON_SECRET` | **you generate** | Protects the generation cron. |
| `RESEND_API_KEY` | **Resend** *(optional)* | Enables real email (reset + notifications). |
| `CLEANING_EMAIL_FROM` | **Resend/you** *(optional)* | e.g. `HCE Cleaning <no-reply@yourdomain.com>` (verified domain). |
| `CLEANING_APP_URL` | **you** *(optional)* | Base URL for reset links, e.g. `https://cleaning.yourdomain.com`. |

Never commit these values. Set them in the Vercel project's Environment Variables.

## 0. Create the Vercel project (monorepo)
The repo is a pnpm + turbo monorepo; deploy Cleaning as its own Vercel project:
1. New Vercel Project → import this repo.
2. **Root Directory: `apps/cleaning`** (like Relay uses `apps/relay`). Vercel installs
   pnpm workspace deps from the repo root automatically; `next.config.ts` pins
   `outputFileTracingRoot` to the monorepo root.
3. Framework preset: **Next.js**. Build command comes from `apps/cleaning/vercel.json`
   (`prisma generate && next build`) — leave the Vercel override empty.
4. Add all environment variables from the table above.

## 1. Provision Supabase
1. Create a **new** Supabase project (do not reuse Relay's / hce-books').
2. Copy the pooler (6543) and direct (5432) connection strings.
3. Set `DATABASE_URL` (pooler, `?pgbouncer=true`) and `DIRECT_URL` (direct) in Vercel.

## 2. Run migrations (production-compatible path)
Migrations are **not** run during the Vercel build (build only does `prisma
generate && next build`). Apply them once with `prisma migrate deploy` against
`DIRECT_URL` — from CI or a local shell — **before** the first deploy serves traffic:

```
cd apps/cleaning
pnpm install                       # ensures prisma CLI + generated client
DIRECT_URL=... DATABASE_URL=... pnpm exec prisma migrate deploy
```

It applies the committed migrations in `prisma/migrations` in order and is
idempotent (safe to re-run). Re-run it after any future deploy that adds
migrations. Prisma connects via `DIRECT_URL` (Supabase's transaction pooler
stalls on DDL).

## 3. Configure environment (Vercel → Project → Settings → Environment Variables)
See `.env.example` for the full list. Required in production:
- `DATABASE_URL`, `DIRECT_URL`
- `CLEANING_SESSION_SECRET` (`openssl rand -base64 32`)
- `BLOB_READ_WRITE_TOKEN` — create a Vercel Blob store and copy its RW token.
  **Without this the app refuses to store photos** (no ephemeral-disk fallback).
- `CLEANING_BOOTSTRAP_TOKEN` — the setup code for `/register` (sales-assisted).
- `CRON_SECRET` — protects the generation cron.
Optional: `RESEND_API_KEY` + `CLEANING_EMAIL_FROM` + `CLEANING_APP_URL` for real
email (password reset + notifications). Without them, emails are logged only.

## 4. Cron
`vercel.json` registers `/api/cron/generate-jobs` daily at 08:00 UTC. Vercel
sends `Authorization: Bearer $CRON_SECRET` automatically. The route rolls a
60-day horizon of jobs for every org; it is idempotent (safe to retry).

## 5. Health checks
- Liveness: `GET /api/health` → `{ status: "ok" }` (no DB).
- Readiness: `GET /api/health?deep=1` → pings the DB; `503` if unreachable.

## 6. First customer onboarding (no developer/SQL)
1. Set `CLEANING_BOOTSTRAP_TOKEN` and share it with the customer.
2. Customer visits `/register`, creates their org + owner account + timezone.
3. Owner adds employees under **Team** and issues temporary passwords (or has
   them use **Forgot password**). Employees sign in and change their password
   under **Settings**.

## 7. Backup / recovery assumptions
We rely on **Supabase's managed backups** (Point-in-Time Recovery / daily
backups per plan) — we do not run a custom backup platform. Object storage
(Vercel Blob) is independently durable. Verify the backup cadence on the chosen
Supabase plan before go-live. There is no cross-region DR in V1.

## 8. Post-deploy smoke checklist
- `GET /api/health?deep=1` returns `db: ok`.
- `/register` creates an org (with the token); a wrong/absent token is rejected.
- Login, create an employee, sign in as that employee.
- Upload a proof photo on a job; confirm it serves via `/api/photos/[id]`.
- Trigger the cron once manually: `GET /api/cron/generate-jobs?secret=$CRON_SECRET`.
