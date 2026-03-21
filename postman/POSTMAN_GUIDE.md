# Postman Guide — Nimbus POS

## Directory Structure

```
postman/
├── POSTMAN_GUIDE.md
├── collections/
│   ├── M0-Repo-Bootstrap.postman_collection.json
│   ├── M1-Health-DB.postman_collection.json
│   ├── M2-Auth-RBAC.postman_collection.json
│   ├── M3-Tenancy.postman_collection.json
│   ├── M3_1-Quick-PIN-Login.postman_collection.json
│   ├── M4-Org-Settings.postman_collection.json
│   └── M5-Floor-Plans-Tables.postman_collection.json
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
| M3        | `M3-Tenancy`         | Yes — token capture active |
| M3.1      | `M3_1-Quick-PIN-Login` | Yes — token capture active |
| M4        | `M4-Org-Settings`      | Yes — token capture active |
| M5        | `M5-Floor-Plans-Tables`  | Yes — token capture active |

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

## Manual Checklist — M3

- [ ] Import `dev.postman_environment.json` (re-import to get `orgId`, `branchId`, etc.)
- [ ] Import `M3-Tenancy.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `Login (Owner)` — expect `201` with tokens auto-saved
- [ ] Run `GET /api/me` — expect `200` with user, organizations, memberships, branches, roles, permissions, session
- [ ] Run `POST /api/orgs` with `{ "name": "Test Org", "slug": "test-org" }` — expect `201`, `orgId` auto-saved
- [ ] Run `POST /api/orgs/{{orgId}}/branches` with `{ "name": "Test Branch" }` — expect `201`, `branchId` auto-saved
- [ ] Run `GET /api/branches` — expect `200` with branches array for the logged-in user
- [ ] Run `GET /api/branches/{{branchId}}` — expect `200` with branch detail
- [ ] Login as Waiter, run `POST /api/orgs/{{orgId}}/branches/{{branchId}}/memberships` to add waiter — expect `201`
- [ ] Run `GET /api/orgs/{{orgId}}/branches/{{branchId}}/memberships` — expect `200` with memberships array
- [ ] Run `GET /api/branch-test` **without** X-Branch-Id header — expect `400` (missing branch context)
- [ ] Run `GET /api/branch-test` **with** X-Branch-Id header (valid branchId) — expect `200` (branch context OK)
- [ ] Run `GET /api/branch-test` with X-Branch-Id for a branch user has no membership — expect `403`

## Manual Checklist — M3.1

- [ ] Import `dev.postman_environment.json` (re-import to get `waiterUserId`, `cashierUserId`, `managerUserId`, `quickPinAccessToken`)
- [ ] Import `M3_1-Quick-PIN-Login.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `Login (Owner)` — expect `201`, tokens auto-saved
- [ ] Run `Login (Waiter/Cashier/Manager)` — expect `201`, userId vars auto-saved
- [ ] Run `Issue Quick PIN (Waiter)` — expect `201`, 6-digit PIN, tier=LOW_6
- [ ] Run `Issue Quick PIN (Cashier)` — expect `201`, 6-digit PIN, tier=LOW_6
- [ ] Run `Issue Quick PIN (Manager)` — expect `201`, 8-digit PIN, tier=HIGH_8
- [ ] Run `Quick PIN Login (Waiter on POS_DESKTOP)` — expect `201`, session source=PIN, platform=POS_DESKTOP
- [ ] Run `Quick PIN Login (Cashier on POS_DESKTOP)` — expect `201`, session source=PIN
- [ ] Run `Quick PIN Login (Manager on POS_DESKTOP)` — expect `201`, session source=PIN
- [ ] Run `Me after Quick PIN Login` — expect `200` with valid session
- [ ] Run `Wrong PIN → 401` — expect `401`
- [ ] Run `Wrong Platform → 403` — expect `403` (non-POS_DESKTOP platform rejected)
- [ ] Run `Reset Quick PIN (Waiter)` — expect `201`, new 6-digit PIN
- [ ] Run `Update Quick PIN Settings (Waiter)` — expect `200`, displayName updated
- [ ] Run `Quick PIN Status (Waiter)` — expect `200` with quickPinEnabled + hasPin flags

## Manual Checklist — M4

- [ ] Import `dev.postman_environment.json` (re-import to get `waiterAccessToken`)
- [ ] Import `M4-Org-Settings.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `Login (Owner)` — expect `201`, tokens auto-saved
- [ ] Run `Login (Waiter)` — expect `201`, waiterAccessToken auto-saved
- [ ] Run `Get Settings` — expect `200` with seeded defaults (currency=UGX, vatPercent=18, rounding, taxMatrix)
- [ ] Run `Get Currency` — expect `200` with currency=UGX
- [ ] Run `Update Currency` — expect `200` with currency=USD
- [ ] Run `Get Tax Matrix` — expect `200` with vatPercent and taxMatrix
- [ ] Run `Update Tax Matrix` — expect `200` with updated defaultVatPct=20
- [ ] Run `Get Rounding` — expect `200` with rounding object
- [ ] Run `Update Rounding` — expect `200` with mode=UP, increment=50
- [ ] Run `Get Thresholds` — expect `200` with discountApprovalThreshold and anomalyThresholds
- [ ] Run `Update Thresholds` — expect `200` with updated anomalyThresholds.lateVoidMin=10
- [ ] Run `Get Platform Access` — expect `200` with platformAccess
- [ ] Run `Update Platform Access` — expect `200` with useRoleDefaults=false
- [ ] Run `Create Exchange Rate` — expect `201` with EUR/UGX rate
- [ ] Run `List Exchange Rates` — expect `200` with array including seeded and new rates
- [ ] Run `Permission Denial — Waiter Update Currency → 403` — expect `403`
- [ ] Run `Permission Denial — Waiter Update Thresholds → 403` — expect `403`

## Manual Checklist — M5

- [ ] Import `dev.postman_environment.json` (re-import to get `floorPlanId`, `tableId` vars)
- [ ] Import `M5-Floor-Plans-Tables.postman_collection.json`
- [ ] Select `Nimbus POS — Dev` environment
- [ ] Run `Login (Owner)` — expect `201`, tokens auto-saved
- [ ] Run `Login (Waiter)` — expect `201`, waiterAccessToken auto-saved
- [ ] Run `List Floor Plans` — expect `200` with array of seeded floor plans for the branch
- [ ] Run `Create Floor Plan` — expect `201` with new floor plan, `floorPlanId` auto-saved
- [ ] Run `Get Floor Plan` — expect `200` with floor plan detail including tables
- [ ] Run `Update Floor Plan` — expect `200` with updated name/data
- [ ] Run `Create Table` — expect `201` with new table, `tableId` auto-saved
- [ ] Run `List Tables` — expect `200` with tables array for the branch
- [ ] Run `Get Table` — expect `200` with table detail
- [ ] Run `Update Table` — expect `200` with updated label/capacity
- [ ] Run `Change Table Status` — expect `200` with status changed to OCCUPIED
- [ ] Run `Get Availability` — expect `200` with summary (total, available, occupied, reserved, cleaning)
- [ ] Run `Permission Denial — Waiter Create Floor Plan → 403` — expect `403`
- [ ] Run `Permission Denial — Waiter Create Table → 403` — expect `403`
- [ ] Run `Missing Branch Header → 400` — expect `400` (no X-Branch-Id header)
- [ ] Run `Invalid Status Enum → 400` — expect `400` (bad table status value)
