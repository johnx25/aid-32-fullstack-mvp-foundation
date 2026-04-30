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
- `DIRECT_URL` must point to a direct PostgreSQL connection (required for Prisma migration commands).

2. Apply migrations (preferred deterministic path):
```bash
npm run prisma:migrate:deploy
```

3. Seed demo users (optional):
```bash
SEED_MODE=demo npm run prisma:seed
```

If Supabase secrets are unavailable, use any local PostgreSQL instance with the sample `DATABASE_URL` above for reproducible validation.
For Supabase: keep `DATABASE_URL` as pooled URL and set `DIRECT_URL` to the direct connection URL.

## Migration safety

- PostgreSQL/Supabase migrations are consolidated under `prisma/migrations_postgres/` (configured via `prisma.config.ts`).
- The repository no longer maintains a parallel SQLite migration path, reducing deploy/onboarding ambiguity.
- Safe execution path for this repo stage: start with an empty PostgreSQL database, run `npm run prisma:migrate:deploy`, then seed if needed.

## Beta launch controls

Use these env vars in `.env`:

- `BETA_MODE=true|false`
- `BETA_INVITE_CODES=code1,code2`
- `SEED_MODE=real|demo` (`real` skips fake users, `demo` loads test users)

## Auth skeleton

Current MVP auth uses registration secrets with hashed storage:

- `POST /api/auth/register` returns a one-time `secret`, sets a signed auth token in an HttpOnly cookie, and includes `authTokenExpiresAt` (ISO timestamp).
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
