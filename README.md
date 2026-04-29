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

## Auth skeleton

Current MVP auth is a placeholder for integration speed:

- API endpoints expect `x-user-id` request header.
- Identity parsing lives in `src/lib/auth.ts`.
- `POST /api/auth/login` returns the `userId` used for the header-based session simulation.
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
- `Profile`
- `Like` (unique per user pair)
- `Match` (created on reciprocal likes)
- `Message` (chat messages scoped to a match)
- `Task`
