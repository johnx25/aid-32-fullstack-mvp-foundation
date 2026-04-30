# AID-32: Full-Stack MVP Foundation (Next.js + Prisma)

This repository provides a practical full-stack MVP baseline:

- Next.js (App Router, TypeScript)
- Prisma ORM + PostgreSQL (Supabase-compatible)
- Task API + starter UI
- Auth + Profile + Discovery + Swipe/Match + Chat APIs

## Quick start

```bash
npm install --include=dev
cp .env.example .env
npm run prisma:migrate
npm run prisma:seed
npm run dev -- -p 3200
```

Open `http://localhost:3200`.

Set `AUTH_TOKEN_SECRET` in `.env` to a random string with at least 32 characters.

## Database setup for local test path (AID-59)

This repo now targets PostgreSQL for local/test and Supabase connectivity.

1. Configure `.env`:
- `DATABASE_URL` should point to either:
  - PostgreSQL/Supabase (example): `postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?schema=public`
  - Supabase pooled URL (transaction mode)
- `DIRECT_URL` is preferred for Prisma migration commands and should point to a direct PostgreSQL connection URL when available.
- Optional: `MIGRATION_URL` can explicitly override the migration connection target for CI/runners with network constraints.
- For non-migration Prisma commands, if `DIRECT_URL` is not set, it falls back to `DATABASE_URL` via `prisma.config.ts`.
- For migration commands, Prisma resolves connection target in order: `DIRECT_URL`, `MIGRATION_URL`, then `DATABASE_URL`.
- For Supabase setups, keep `DATABASE_URL` as pooled URL and set `DIRECT_URL` to the direct connection URL.
- Optional for seed runs: `SEED_DATABASE_URL` overrides the Prisma seed connection target.

2. Apply migrations (preferred deterministic path):
```bash
npm run prisma:migrate:deploy
```

3. Seed demo users (optional):
```bash
SEED_MODE=demo npm run prisma:seed
```

4. Run the migrated DB integration flow (migration + seed + healthcheck):
```bash
DATABASE_URL='postgresql://...' DIRECT_URL='postgresql://...' npm run test:integration:supabase-flow
```

If `DIRECT_URL` is unreachable in your runner, set `MIGRATION_URL` to a reachable PostgreSQL endpoint (or allow the script fallback to `DATABASE_URL`).

If seed runs fail with `P1001` against `db.<project-ref>.supabase.co:5432`, your environment likely lacks IPv6 routing. Use a pooled Supabase URL in `DATABASE_URL` or set `SEED_DATABASE_URL` to the pooled URL.

If Supabase secrets are unavailable, use any local PostgreSQL instance with the sample `DATABASE_URL` above for reproducible validation.

## Migration safety

- PostgreSQL/Supabase migrations are consolidated under `prisma/migrations/` (configured via `prisma.config.ts`).
- The repository no longer maintains a parallel SQLite migration path, reducing deploy/onboarding ambiguity.
- Existing environment upgrade path:
  - If your database already contains `User/Profile/Like/Match/Message/Task` tables, do not run `prisma migrate deploy` first.
  - Verify the current schema is compatible with `prisma/migrations/20260429150000_postgres_baseline/migration.sql`.
  - Mark the baseline as already applied: `npx prisma migrate resolve --applied 20260429150000_postgres_baseline`
  - Then run: `npm run prisma:migrate:deploy`
- Guardrail: `scripts/verify-migration-target.sh` blocks `migrate deploy` when app tables already exist but the baseline is not yet recorded in `_prisma_migrations`.

## Beta launch controls

Use these env vars in `.env`:

- `BETA_MODE=true|false`
- `BETA_INVITE_CODES=code1,code2`
- `SEED_MODE=real|demo` (`real` skips fake users, `demo` loads test users)

## Auth skeleton

Current MVP auth uses registration secrets with hashed storage:

- `POST /api/auth/register` returns a one-time `secret` only when the server generated it (client-supplied secrets are never echoed back), sets a signed auth token in an HttpOnly cookie, and includes `authTokenExpiresAt` (ISO timestamp).
- `POST /api/auth/login` requires `email` + `secret`, sets a signed auth token in an HttpOnly cookie, and includes `authTokenExpiresAt` (ISO timestamp).
- `POST /api/auth/logout` clears the auth cookie.
- `GET /api/auth/session` reads the current authenticated session from cookie.
- Protected endpoints require a valid auth cookie (legacy `x-auth-token` header fallback is still accepted).
- Identity parsing lives in `src/lib/auth.ts`.
- Replace this with your real auth provider/session middleware.

## APIs

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/health/db` (database reachability probe)
- `GET /api/profile` (requires auth)
- `PATCH /api/profile` (requires auth)
- `GET /api/tasks` (requires auth)
- `POST /api/tasks` (requires auth)
- `GET /api/discovery` (requires auth)
- `POST /api/likes` (requires auth, body: `{ "targetProfileId": <number> }`)
- `GET /api/matches` (requires auth)
- `GET /api/chats/:matchId` (requires auth)
- `POST /api/chats/:matchId` (requires auth, body: `{ "content": "..." }`)

## Data model

- `User`
- `Profile` (with `avatarUrl`)
- `Like` (unique per user pair)
- `Match` (created on reciprocal likes)
- `Message` (chat messages scoped to a match)
- `Task`

## Manual beta test checklist

- New user can sign up
- User is guided to complete profile
- User cannot like others with incomplete profile
- Matching works
- Chat works with empty-message rejection and cooldown
