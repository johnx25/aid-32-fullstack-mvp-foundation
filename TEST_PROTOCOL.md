# Test Protocol (AID-59 PostgreSQL/Supabase Path)

Date: 2026-04-29 (UTC)

## Environment target

- Prisma datasource provider: `postgresql`
- Validation `DATABASE_URL`: `postgresql://postgres:postgres@127.0.0.1:5432/aid32_dev?schema=public`
- Supabase URL can be substituted directly for `DATABASE_URL`.

## Commands run and outcomes

1. `DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/aid32_dev?schema=public' npm run prisma:generate` -> PASS
2. `DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/aid32_dev?schema=public' npx prisma validate` -> PASS
3. `DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/aid32_dev?schema=public' npm run lint` -> PASS
4. `DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/aid32_dev?schema=public' npm run build` -> PASS
5. `DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/aid32_dev?schema=public' npm run prisma:migrate:deploy` -> FAIL (`P1001: Can't reach database server at 127.0.0.1:5432`)

## Reproducible local PostgreSQL fallback

When Supabase secrets are not available, start any local PostgreSQL 15+ instance and create DB `aid32_dev`, then rerun:

```bash
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/aid32_dev?schema=public' npm run prisma:migrate:deploy
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/aid32_dev?schema=public' SEED_MODE=demo npm run prisma:seed
```

## Supabase validation requirement

For full Supabase-path verification, provide a reachable Supabase `DATABASE_URL` (and optional `DIRECT_URL` if your environment requires a direct non-pooled connection for migrations).
