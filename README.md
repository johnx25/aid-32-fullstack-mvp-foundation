# AID-32: Full-Stack MVP Foundation (Next.js + Prisma)

This repository provides a practical full-stack MVP baseline:

- Next.js (App Router, TypeScript)
- Prisma ORM + SQLite
- Task API + starter UI
- Discovery + Like/Match APIs
- Auth skeleton (header-based user identity, replaceable)

## Quick start

```bash
npm install --include=dev
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000`.

## Auth skeleton

Current MVP auth is a placeholder for integration speed:

- API endpoints expect `x-user-id` request header.
- Identity parsing lives in `src/lib/auth.ts`.
- Replace this with your real auth provider/session middleware.

## APIs

- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/discovery` (requires `x-user-id`)
- `POST /api/likes` (requires `x-user-id`, body: `{ "targetProfileId": <number> }`)

## Data model

- `User`
- `Profile`
- `Like` (unique per user pair)
- `Match` (created on reciprocal likes)
- `Task`

## Next steps

- Integrate real authentication/session handling
- Add validation layer (e.g., Zod)
- Add tests (unit/integration)
- Switch SQLite to Postgres for deployed environments
