# Test Protocol (AID-59 PostgreSQL/Supabase Path)

Date: 2026-04-29 (UTC)

## Forward-safe migration strategy

- Legacy SQLite migration history remains untouched in `prisma/migrations/`.
- PostgreSQL/Supabase path is isolated in `prisma/migrations_postgres/` and is now the configured migrations path.
- Rationale: avoids rewriting semantics/checksums of previously applied migrations while enabling deterministic PostgreSQL bootstrap via `migrate deploy`.

## Required environment

```bash
export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/aid32_dev?schema=public'
export DIRECT_URL='postgresql://postgres:postgres@127.0.0.1:5432/aid32_dev?schema=public'
```

For Supabase, replace both URLs with Supabase-compatible values (pooled for `DATABASE_URL`, direct for `DIRECT_URL` if required by your setup).

## Commands run and outcomes

1. `npm run prisma:generate` (with `DATABASE_URL` and `DIRECT_URL` set) -> PASS
2. `npx prisma validate` (with `DATABASE_URL` and `DIRECT_URL` set) -> PASS
3. `npm run lint` (with `DATABASE_URL` and `DIRECT_URL` set) -> PASS
4. `npm run build` (with `DATABASE_URL` and `DIRECT_URL` set) -> PASS
5. `npm run prisma:migrate:deploy` (with `DATABASE_URL` and `DIRECT_URL` set) -> FAIL (`P1001: Can't reach database server at 127.0.0.1:5432`)

## Deterministic validation path (preferred)

For an empty local PostgreSQL database:

```bash
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/aid32_dev?schema=public' \
DIRECT_URL='postgresql://postgres:postgres@127.0.0.1:5432/aid32_dev?schema=public' \
npm run prisma:migrate:deploy

DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/aid32_dev?schema=public' \
DIRECT_URL='postgresql://postgres:postgres@127.0.0.1:5432/aid32_dev?schema=public' \
SEED_MODE=demo npm run prisma:seed
```

For Supabase verification, provide reachable Supabase `DATABASE_URL`/`DIRECT_URL` secrets and rerun the same commands.
