# Test Protocol (AID-34 Follow-up)

Date: 2026-04-28 (UTC)

## Validation commands

- `npm run lint` -> PASS
- `npm run build` -> PASS

## End-to-end API flow (local)

Tested in one shell session with app startup + curl flow:

1. Register
- `POST /api/auth/register` for `dave@example.com` -> created `userId=4`, `profileId=4`
- `POST /api/auth/register` for `erin@example.com` -> created `userId=5`, `profileId=5`

2. Login
- `POST /api/auth/login` for `dave@example.com` -> returned `userId=4`

3. Profile
- `GET /api/profile` with `x-user-id: 4` -> PASS
- `PATCH /api/profile` with `x-user-id: 4` (city/interests update) -> PASS

4. Discovery
- `GET /api/discovery` with `x-user-id: 4` -> Erin + seeded profiles returned

5. Swipe + Match
- Dave likes Erin: `POST /api/likes` -> `{ isMatch: false }`
- Erin likes Dave back: `POST /api/likes` -> `{ isMatch: true }`
- `GET /api/matches` for Dave -> returned `matchId=1`

6. Chat
- `POST /api/chats/1` as Dave -> message created
- `POST /api/chats/1` as Erin -> message created
- `GET /api/chats/1` as Dave -> both messages returned in order

## Notes

- Auth remains intentionally MVP-style via `x-user-id` header (documented in README).
- Chat authorization enforces match membership.
