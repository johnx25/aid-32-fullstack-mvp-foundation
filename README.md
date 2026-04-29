# AID-32: Full-Stack MVP Foundation (Next.js + Prisma + Supabase)

This repository provides a practical full-stack MVP baseline:

- Next.js (App Router, TypeScript)
- Prisma ORM + Supabase Postgres
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

## Supabase setup

1. Create a Supabase project.
2. Copy both connection strings into `.env`:
- `DATABASE_URL`: transaction pooler URL (`...pooler.supabase.com:6543...`)
- `DIRECT_URL`: direct DB URL (`db.<project-ref>.supabase.co:5432`)
- `AUTH_TOKEN_SECRET`: random secret string with at least 32 characters
3. Run migrations and seed:

```bash
npm run prisma:migrate
npm run prisma:seed
```

For production deploys, use:

```bash
npm run prisma:migrate:deploy
```

## Beta launch controls

Use these env vars in `.env`:

- `BETA_MODE=true|false`
- `BETA_INVITE_CODES=code1,code2`
- `SEED_MODE=real|demo` (`real` skips fake users, `demo` loads test users)

## Auth skeleton

Current MVP auth uses registration secrets with hashed storage:

- `POST /api/auth/register` returns a one-time `secret` for the created user.
- `POST /api/auth/login` requires `email` + `secret` and sets a signed auth token in an HttpOnly cookie.
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
