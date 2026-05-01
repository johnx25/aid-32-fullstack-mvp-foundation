# Database setup

## What the app needs

Set these values in `.env`:

- `DATABASE_URL` = runtime connection string
- `DIRECT_URL` = direct PostgreSQL connection string for Prisma migrations
- `AUTH_TOKEN_SECRET` = long random secret

## Recommended setup

For this project, use PostgreSQL (local or Supabase).

### Option A: Supabase (recommended)

- `DATABASE_URL`: pooled connection string
- `DIRECT_URL`: direct connection string

### Option B: local PostgreSQL

Use the same local connection string for both values.

Example:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aid32?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/aid32?schema=public"
```

## Migration flow

```bash
npm install --include=dev
npm run prisma:migrate:deploy
npm run prisma:seed
npm run dev -- -p 3200
```
