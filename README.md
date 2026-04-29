# AID-32: Full-Stack MVP Foundation (Next.js + Prisma)

This repository provides a practical full-stack MVP baseline:

- Next.js (App Router, TypeScript)
- Prisma ORM + SQLite
- Task API + starter UI
- Auth + Profile + Discovery + Swipe/Match + Chat APIs

## Quick start

```bash
npm install --include=dev
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev -- -p 3200
```

Open `http://localhost:3200`.

## Beta launch controls

Use these env vars in `.env`:

- `BETA_MODE=true|false`
- `BETA_INVITE_CODES=code1,code2`
- `SEED_MODE=real|demo` (`real` skips fake users, `demo` loads test users)

## Auth skeleton

Current MVP auth uses registration secrets with hashed storage:

- `POST /api/auth/register` returns a one-time `secret` for the created user.
- `POST /api/auth/login` requires `email` + `secret` and returns a signed `authToken`.
- Protected endpoints require `x-auth-token`; optional `x-user-id` must match token identity.
- Identity parsing lives in `src/lib/auth.ts`.
- Replace this with your real auth provider/session middleware.

## APIs

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/profile` (requires `x-user-id`)
- `PATCH /api/profile` (requires `x-user-id`)
- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/discovery` (requires `x-user-id`)
- `POST /api/likes` (requires `x-user-id`, body: `{ "targetProfileId": <number> }`)
- `GET /api/matches` (requires `x-user-id`)
- `GET /api/chats/:matchId` (requires `x-user-id`)
- `POST /api/chats/:matchId` (requires `x-user-id`, body: `{ "content": "..." }`)

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
