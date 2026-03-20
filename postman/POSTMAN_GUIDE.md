# Postman Guide — Nimbus POS

## Directory Structure

```
postman/
├── POSTMAN_GUIDE.md
├── collections/
│   ├── M0-Repo-Bootstrap.postman_collection.json
│   ├── M1-Health-DB.postman_collection.json
│   └── M2-Auth-RBAC.postman_collection.json
└── environments/
    └── dev.postman_environment.json
```

## Setup

1. Import the **environment** file `postman/environments/dev.postman_environment.json` into Postman.
2. Import the relevant **collection** from `postman/collections/`.
3. Select the `Nimbus POS — Dev` environment.
4. Run requests.

## Conventions

- One collection per milestone (minimum).
- Collections are named `M<N>-<Short-Name>.postman_collection.json`.
- Each collection should include test scripts that validate response shape.
- Environment variables are used for `baseUrl`, tokens, and dynamic IDs.

## Token Capture

Auth is implemented in **M2**. The `Login (Owner)` request in the M2 collection
includes test scripts that automatically save `accessToken`, `refreshToken`, and
`userId` into the active environment. The `Refresh Token` request rotates both
tokens and updates the environment variables automatically.

All authenticated requests in the M2+ collections inherit a **Bearer** token
from the collection-level auth setting, using `{{accessToken}}`.

## Milestone Coverage

| Milestone | Collection          | Auth Required              |
| --------- | ------------------- | -------------------------- |
| M0        | `M0-Repo-Bootstrap` | No                         |
| M1        | `M1-Health-DB`       | No                         |
| M2        | `M2-Auth-RBAC`       | Yes — token capture active |

## Manual Checklist — M0

- [ ] Import `dev.postman_environment.json`
- [ ] Import `M0-Repo-Bootstrap.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `GET {{baseUrl}}/api/health` — expect `200` with `{ "status": "ok" }`
- [ ] Confirm no auth headers are required

## Manual Checklist — M1

- [ ] Import `dev.postman_environment.json` (if not already imported)
- [ ] Import `M1-Health-DB.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `GET {{baseUrl}}/api/health` — expect `200`
- [ ] Verify `status` = `"ok"`
- [ ] Verify `db` = `"ok"`
- [ ] Verify `timestamp` exists and is a valid ISO string
- [ ] Confirm no auth headers required
- [ ] Note: auth/token capture starts in M2, not M1

## Manual Checklist — M2

- [ ] Import `dev.postman_environment.json` (re-import to get `refreshToken` + `userId` vars)
- [ ] Import `M2-Auth-RBAC.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `GET {{baseUrl}}/api/health` — expect `200` with `status: ok, db: ok`
- [ ] Run `POST /api/auth/login` with owner@demo.local / Owner#123 — expect `201` with tokens
- [ ] Verify `accessToken` and `refreshToken` are auto-saved to environment
- [ ] Run `GET /api/auth/me` — expect `200` with user profile, roles, permissions, session
- [ ] Run `GET /api/auth/sessions` — expect `200` with sessions array
- [ ] Run `POST /api/auth/pin-login` with cashier@demo.local / 3456 — expect `201`, source: PIN
- [ ] Run `POST /api/auth/refresh` with `{{refreshToken}}` — expect `201` with rotated tokens
- [ ] Run `GET /api/auth/_perm-test` as Owner with X-Platform: WEB_BACKOFFICE — expect `200`
- [ ] Login as Cashier, run `GET /api/auth/_perm-test` — expect `403` (insufficient permissions)
- [ ] Login as Waiter, run `GET /api/auth/_perm-test` with X-Platform: WEB_BACKOFFICE — expect `403`
- [ ] Run `POST /api/auth/logout` — expect `201` with logged-out message
- [ ] Run `POST /api/auth/logout-all` — expect `201` with all sessions revoked
