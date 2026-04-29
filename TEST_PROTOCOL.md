# Test Protocol (AID-42 Stability)

Date: 2026-04-29 (UTC)

## Validation commands

- `DATABASE_URL='file:./prisma/dev.db' npm run prisma:migrate` -> PASS
- `DATABASE_URL='file:./prisma/dev.db' npm run lint` -> PASS
- `DATABASE_URL='file:./prisma/dev.db' npm run build` -> PASS
- `DATABASE_URL='file:./prisma/dev.db' AUTH_TOKEN_SECRET='<32+ char secret>' node scripts/stability-flow-check.mjs` (with app running) -> PASS

## End-to-end API flow (real scenario)

1. Register and store secret
- `POST /api/auth/register` for two new users -> `201`
- Both responses return one-time `secret` values

2. Duplicate registration edge case
- Register same email again -> `409 CONFLICT`

3. Login and failed-login edge case
- Login with wrong secret -> `401 UNAUTHORIZED` and failed-login log entry
- Login with correct secret -> `200`

4. Missing auth edge case
- `GET /api/profile` without auth cookie -> `401 UNAUTHORIZED`
- `GET /api/profile` with invalid auth cookie but valid legacy auth headers -> `200` (fallback still accepted during migration)

5. Discovery and likes
- `GET /api/discovery` returns other profiles
- Like target profile -> `201`
- Reciprocal like -> `201` with `isMatch: true` and match log entry

6. Match and chat
- `GET /api/matches` returns created match
- `POST /api/chats/:matchId` sends message -> `201` with chat log entry
- `GET /api/chats/:matchId` reads messages -> `200`

## Manual checklist

- [x] User can register
- [x] User can log in
- [x] Matching works
- [x] Chat works

## Known limitations

- Auth is still MVP-style and relies on signed lightweight tokens instead of real session middleware/JWT refresh flow.
- Secrets are hashed with scrypt; SHA-256 verification is retained only as a legacy fallback for older stored hashes. No password reset/recovery flow exists yet.
