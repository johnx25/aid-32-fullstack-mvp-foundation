# AID-32: Full-Stack MVP Foundation (Next.js + Prisma)

This repository provides a minimal production-ready starting point for a full-stack MVP:

- Next.js (App Router, TypeScript)
- Prisma ORM
- SQLite for local development
- Basic Task model + API + UI wiring

## Quick start

```bash
npm install
npx prisma migrate dev --name init
npm run dev
```

Open `http://localhost:3000`.

## Included foundation

- `src/app/page.tsx`: server-rendered starter UI with form action
- `src/app/api/tasks/route.ts`: GET/POST task endpoints
- `src/lib/prisma.ts`: singleton Prisma client setup
- `prisma/schema.prisma`: initial `Task` model

## Next steps

- Add authentication (e.g. NextAuth / Clerk)
- Switch to PostgreSQL for staging/production
- Add validation layer (Zod) and domain services
- Add test suite (unit + integration)
