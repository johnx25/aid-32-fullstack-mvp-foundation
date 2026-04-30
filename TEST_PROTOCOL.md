# Test Protocol (AID-59 PostgreSQL/Supabase Path)

Date: 2026-04-29 (UTC)

## Migration strategy

- PostgreSQL/Supabase migrations are consolidated in `prisma/migrations/`.
- The legacy SQLite migration path is removed to avoid dual-provider ambiguity during deploy and onboarding.
- Deterministic bootstrap remains `prisma migrate deploy` against an empty PostgreSQL-compatible database.

## Required environment

```bash
export DATABASE_URL='postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?schema=public'
export DIRECT_URL='postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?schema=public'
```

For Supabase, replace both URLs with Supabase-compatible values (pooled for `DATABASE_URL`, direct for `DIRECT_URL`).
If the environment cannot route IPv6 to `db.<project-ref>.supabase.co:5432`, set `SEED_DATABASE_URL` to the pooled URL for seed runs.

## Commands run and outcomes

1. `npm run prisma:generate` (with `DATABASE_URL` and `DIRECT_URL` set) -> PASS
2. `npx prisma validate` (with `DATABASE_URL` and `DIRECT_URL` set) -> PASS
3. `npm run lint` (with `DATABASE_URL` and `DIRECT_URL` set) -> PASS
4. `npm run build` (with `DATABASE_URL` and `DIRECT_URL` set) -> PASS
5. `npm run prisma:migrate:deploy` (with `DATABASE_URL` and `DIRECT_URL` set) -> PASS on a reachable PostgreSQL/Supabase target
6. `GET /api/health/db` against a running app + reachable DB -> PASS (`200`, `status: ok`)
7. `npm run test:integration:supabase-flow` -> PASS path for full migrated DB flow (generate/validate/migrate/seed/build/start/healthcheck)

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

For Supabase verification, provide a reachable Supabase `DATABASE_URL`/`DIRECT_URL` secret and rerun the same commands.

## Additional notes

- `prisma.config.ts` imports `dotenv/config`, so Prisma CLI commands resolve `.env` values in this repository layout.
- `.env` and `.env.example` use PostgreSQL sample URLs. `DIRECT_URL` is required for Prisma migrations and should be configured as a direct PostgreSQL URL.
