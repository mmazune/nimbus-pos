# BG7 — HMS Integration Completion Report

**Date:** 2026-05-08
**Slug:** `bg7-hms-integration`
**Migration:** `20260508000000_bg7_hms_integration`
**Status:** ✅ Code complete. e2e + Newman runs pending operator (TBD).

---

## 1. Summary

BG7 introduces the contract surface that the parallel **nimbus-hms** property-management system uses to read everything that happens inside this POS — sales, payments, refunds, shifts, restaurant reservations, event bookings, menu, inventory, and the accounting back-office (COA, AR invoices, AP vendor bills). The surface is exposed under `/api/hms/*` and authenticated by an opaque API key (`x-api-key` header or `Authorization: ApiKey <key>`), validated by a new `ApiKeyAuthGuard` that synthesises a `req.user` carrying the implicit permission `hms:read:*`. A key may be minted **organization-wide** (sees every branch in the org) or **branch-scoped** (locked to a single branch). Every reached HMS request is journaled to `integration_access_logs` for HMS-side debugging. The surface is intentionally **read-only** — write-back endpoints (e.g. push charges, sync hotel adjustments) are deferred.

User intent (verbatim): *"this api key should give full access so they the hms system can see everything from sales, accounts, reservations etc all of it"* + *"it can connect one restaurant or the whole organization"* + *"create the necessary milestone bg7… necessary connections for postman and endpoints"*.

---

## 2. Schema Changes

Migration `packages/db/prisma/migrations/20260508000000_bg7_hms_integration/migration.sql`:

| Table | Change |
|---|---|
| `api_keys` | + `branch_id TEXT NULL` (FK→`branches.id` ON DELETE SET NULL ON UPDATE CASCADE) |
| `api_keys` | + `last_used_ip TEXT NULL` |
| `api_keys` | + index `api_keys_branch_id_idx (branch_id)` |
| `integration_access_logs` | **NEW** — `id, org_id, api_key_id, branch_id?, route_method, route_path, status_code INT, duration_ms INT, ip_address?, user_agent?, request_id?, metadata JSONB?, created_at` |

Indexes on `integration_access_logs`: `(org_id, created_at DESC)`, `(api_key_id, created_at DESC)`, `branch_id`, `status_code`.

FKs on `integration_access_logs`: `org_id`→Organization (Cascade), `api_key_id`→ApiKey (Cascade), `branch_id`→Branch (SetNull).

**Byte-stable Branch preserved.** `Branch` carries no Prisma `@relation` back-reference for either `api_keys.branch_id` or `integration_access_logs.branch_id` — DB-level FK only, matching the BG1 / BG5 precedent. `Organization` does receive a `integrationAccessLogs IntegrationAccessLog[]` back-relation alongside the existing `apiKeys ApiKey[]`.

---

## 3. Endpoints

All under `/api/hms/*`. Permission: `hms:read:*` (implicit on every active API key — never attached to any human role).

| Method | Path | Purpose |
|---|---|---|
| GET | `/whoami` | Identity of the authenticated key — `{ apiKeyId, organizationId, branchId, scope: ORGANIZATION|BRANCH, grantedPermissions[] }` |
| GET | `/access-logs` | Paginated journal of this key's prior requests |
| GET | `/organization` | Organization profile + scope envelope |
| GET | `/branches` | Branches visible to the key (org-wide → all; branch-scoped → exactly one) |
| GET | `/orders` | Paginated POS orders (`limit`, `skip`, `from`, `to`, `branchId?`, `status?`) |
| GET | `/orders/:id` | Single order with line items + payments |
| GET | `/payments` | Paginated payments |
| GET | `/refunds` | Paginated refunds |
| GET | `/sales/summary` | Daily roll-up — `{ window, totals: { grossSales, netSales, tax, discount, refunds, paymentsByMethod[] } }` |
| GET | `/reservations` | Restaurant table reservations |
| GET | `/events` | Catered events |
| GET | `/event-bookings` | Bookings for those events |
| GET | `/menu` | Menu items (categories, prices, availability) |
| GET | `/inventory` | Inventory items + on-hand quantities |
| GET | `/shifts` | Till sessions / cashier shifts |
| GET | `/accounting/accounts` | Chart of accounts |
| GET | `/accounting/invoices` | AR customer invoices |
| GET | `/accounting/vendor-bills` | AP vendor bills |

**Pagination contract:** `limit` (1–200, default 50), `skip` (≥0). Window: `from` / `to` ISO-8601. Branch filter: `?branchId=` honoured only when caller is org-wide; ignored on branch-scoped keys.

**No POST/PATCH/DELETE** on `/api/hms/*` this milestone.

---

## 4. Authentication & Authorization

`apps/api/src/common/guards/api-key-auth.guard.ts` — `ApiKeyAuthGuard implements CanActivate`:

1. Pull key from `x-api-key` header, falling back to `Authorization: ApiKey <key>`.
2. SHA-256 hash → `prisma.apiKey.findFirst({ where: { keyHash } })`.
3. Validate `status === 'ACTIVE'` (codes `API_KEY_REVOKED` if `REVOKED`, `API_KEY_INVALID` otherwise) and `expiresAt` (code `API_KEY_EXPIRED`).
4. Synthesise `req.user = { id: 'apikey:<id>', apiKeyId, orgId, branchId, permissions: ['hms:read:*', ...scopes], source: 'API_KEY' }`.
5. Stash `req.apiKeyContext = { apiKeyId, orgId, branchId, ipAddress }` for the access-log interceptor.
6. Fire-and-forget update of `lastUsedAt` + `lastUsedIp`.

The standard `PermissionGuard` then enforces `@Permissions('hms:read:*')` exactly the same way it enforces every other permission — no special-case branch in the request pipeline.

Error codes: `API_KEY_MISSING | API_KEY_INVALID | API_KEY_REVOKED | API_KEY_EXPIRED` (all 401).

---

## 5. Audit / Access Journal

`HmsAccessLogInterceptor` wraps every HMS controller method. On both `next()` and `error()` paths it calls `HmsIntegrationService.recordAccess(...)` which inserts into `integration_access_logs` with `{ orgId, apiKeyId, branchId, routeMethod, routePath, statusCode, durationMs, ipAddress, userAgent, requestId }`. Failures are swallowed — the journal is best-effort and must never break a working request.

The HMS pulls its own journal via `GET /api/hms/access-logs` (newest first, paginated).

---

## 6. Files Touched

| File | Change |
|---|---|
| `packages/db/prisma/migrations/20260508000000_bg7_hms_integration/migration.sql` | NEW — schema migration |
| `packages/db/prisma/schema.prisma` | `ApiKey` + `branchId` / `lastUsedIp` / `integrationLogs[]`; new `IntegrationAccessLog` model; `Organization.integrationAccessLogs[]` back-relation |
| `apps/api/src/common/guards/api-key-auth.guard.ts` | NEW — `ApiKeyAuthGuard` |
| `apps/api/src/common/guards/index.ts` | Re-export `ApiKeyAuthGuard` |
| `apps/api/src/modules/hms-integration/hms-integration.module.ts` | NEW |
| `apps/api/src/modules/hms-integration/index.ts` | NEW |
| `apps/api/src/modules/hms-integration/dto/index.ts` | NEW — `HmsPaginationDto` etc. |
| `apps/api/src/modules/hms-integration/hms-access-log.interceptor.ts` | NEW |
| `apps/api/src/modules/hms-integration/hms-integration.service.ts` | NEW — 17 read methods + `recordAccess` + `whoAmI` |
| `apps/api/src/modules/hms-integration/hms-integration.controller.ts` | NEW — 18 GET endpoints |
| `apps/api/src/app.module.ts` | Registers `HmsIntegrationModule` |
| `apps/api/src/modules/billing/dto/create-api-key.dto.ts` | + optional `branchId` |
| `apps/api/src/modules/billing/billing.service.ts` | `createApiKey` validates branch membership + persists `branchId`; returns `scope: ORGANIZATION|BRANCH`; `listApiKeys` exposes `branchId` + `lastUsedIp` |
| `packages/db/prisma/seed.ts` | + `hms:read:*` permission row + `recordSeedRun('bg7-hms-integration', ...)` marker |
| `apps/api/test/bg7-hms-integration.e2e-spec.ts` | NEW — full e2e |
| `postman/collections/BG7-HMS-Integration.postman_collection.json` | NEW |
| `ai/AI_STATUS.md` | Current State + BG7 paragraph |
| `README.md` | New "HMS Integration" section |
| `docs/NIMBUS_POS_FOR_HMS_INTEGRATION_SPEC.md` | NEW — long-form spec for the HMS-side LLM |

---

## 7. Permissions

| Permission | Granted to | Notes |
|---|---|---|
| `hms:read:*` | **No human role.** Implicit on every active API key. | Synthesised by `ApiKeyAuthGuard` into `req.user.permissions`. Never appears in JWT claims. |

---

## 8. Locked Rules Verified

- ✅ **Byte-stable Branch.** No Prisma `@relation` back-ref on `Branch` for either new column. DB FKs only.
- ✅ **`/api/auth/me` untouched** — JWT identity flow is independent of the API-key flow.
- ✅ **No idempotency wrapping on reads.** BG3 `Bg3ReliabilityService.guard` is not invoked for any `/api/hms/*` route.
- ✅ **No audit-log entries on read endpoints** — `integration_access_logs` is the read trail; the human `audit_logs` table stays a write-only signal.
- ✅ **Plaintext API key returned exactly once** on creation (existing M39 contract preserved).
- ✅ **Public diner payments still PENDING** (M13.2 untouched).
- ✅ **PesaPal still owner-SaaS-only** — no changes to the M39 billing flow.
- ✅ **No hotel structures introduced inside POS** — rooms, folios, guests live in nimbus-hms.

---

## 9. Test Counts (TBD pending operator run)

- e2e: `pnpm exec jest --config test/jest-e2e.json bg7-hms-integration` — TBD.
- Newman: `pnpm exec newman run postman/collections/BG7-HMS-Integration.postman_collection.json` — TBD.

---

## 10. Known Limitations

- **Read-only.** No write-back surface; HMS cannot push folio charges, settle a hotel-side adjustment, or reverse a POS payment via this API. Deferred to a future BG (likely BG8 — *HMS Write-Back & Folio Sync*).
- **No rate limiting** on `/api/hms/*` this milestone. The HMS is a trusted caller; abuse protection deferred.
- **No IP allow-listing** on API keys. Deferred.
- **No webhook fan-out.** HMS must poll. A push channel (webhooks / SSE) is a candidate for the same future BG.
- **`integration_access_logs` retention is unbounded** — no TTL job ships in BG7. Operator will manually trim if it grows.

---

## 11. Hand-off Notes

The companion document for the **nimbus-hms** LLM is [docs/NIMBUS_POS_FOR_HMS_INTEGRATION_SPEC.md](../docs/NIMBUS_POS_FOR_HMS_INTEGRATION_SPEC.md) — it carries every request/response shape, recommended polling cadence, error envelope, and POS→HMS concept mapping. Hand that file (and this report) to the HMS implementer.
