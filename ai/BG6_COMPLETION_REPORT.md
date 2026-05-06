# BG6 — Unified Exports / Downloads Facade + AP Supplier Detail — Completion Report

**Status:** ✅ Complete · 2026-05-03
**Module:** `apps/api/src/modules/exports`
**Migration:** none — fully additive at the application layer (delegates to existing `ExportArtifact` + `Document` tables)
**Seed marker:** `bg6-exports-and-downloads-facade`

---

## 1. Scope and intent

BG6 closes two gaps surfaced by the BG0 route audit:

1. **No single "download centre" surface.** Frontends had to reach into
   `ReportsService` (export artefacts) and `DocumentsService` (uploaded
   files) separately, with two unrelated envelopes, two id schemes and two
   download routes. BG6 introduces a normalisation-only facade at
   `/api/exports/*` that unifies those into one mental model.
2. **Missing AP supplier detail route.** `GET /api/accounting/ap/suppliers/:id`
   was declared but absent. Added with a single read endpoint that returns
   the supplier plus a roll-up summary and recent bills/payments.

It is a pure read/normalisation layer:

- **No new generation logic.** `POST /api/exports` delegates to the
  existing `ReportsService.createExport` and reshapes the persisted
  artefact. `GET /api/exports/:id/download` delegates to the underlying
  domain (Reports or Documents) and streams the same file.
- **No regressions.** All locked rules (BG0 surface, BG1 invitations + PIN,
  BG2 audit timeline, BG3 reliability facade, BG4.A receipts, BG4.B order
  handoff, BG5 device registry, M42 maintenance/training, `/api/auth/me` as
  canonical context, public diner payments PENDING via M13, PesaPal
  owner-SaaS-only) remain untouched.
- **Schema is unchanged.** No tables, no columns, no enums, no migration
  added. The unified `exportId` is encoded as `<sourceDomain>:<id>` so the
  download endpoint can route without storing a new column.
- **Permissions follow the same shape as BG5.** Three new keys under
  `exports:*`; Owner / Manager / Accountant get everything; Chef
  intentionally denied to keep the role-gating surface meaningful.

## 2. Endpoints (5)

All `/api/exports/*` routes live under `@Controller('exports')` guarded by
`JwtAuthGuard + PermissionGuard + BranchContextGuard`, requiring a
`branchContext` populated via the canonical `/api/auth/me` chain.
The supplier-detail route lives on the existing
`AccountsPayableController`.

| Method | Path | Permission | Idempotency | Notes |
|---|---|---|---|---|
| POST  | `/api/exports`                              | `exports:write`    | optional (BG3) | Delegates to `ReportsService.createExport`; today only `sourceDomain=reports` is POST-capable |
| GET   | `/api/exports`                              | `exports:read`     | n/a            | Unified list across reports + documents; supports `sourceDomain` / `format` / `requestedBy` / `status` / pagination |
| GET   | `/api/exports/:id`                          | `exports:read`     | n/a            | Detail by `<domain>:<id>`; 400 on malformed, 404 on unknown |
| GET   | `/api/exports/:id/download`                 | `exports:download` | n/a (pure read) | Streams the underlying file with the artefact's recorded `mimeType` + `fileName` |
| GET   | `/api/accounting/ap/suppliers/:id`          | `accounting:ap:supplier:read` | n/a | Supplier + summary + recent 10 bills / 10 payments |

`POST /api/exports` flows through:

```ts
this.bg3.guard(
  {
    req,
    scope: 'exports.create',
    routeMethod: 'POST',
    routePath: '/api/exports',
    category: null,                  // facade request itself is metadata; downstream generators carry their own category
    idempotencyMode: 'optional',
    fingerprintSource: { dto },
    actorUserId, orgId, branchId,
  },
  () => this.exports.createExport(...),
)
```

`category: null` keeps the facade-level POST outside the M42 maintenance
categorisation — the underlying domain generators (e.g. report builders)
remain free to apply their own categorisation independently. List, detail
and download are pure reads → no BG3 wrap.

## 3. Response envelope

The unified envelope normalises both report artefacts and documents into
one shape the frontend can render with a single component:

```jsonc
{
  "exportId": "reports:cmf...",          // <sourceDomain>:<underlyingId>
  "sourceDomain": "reports" | "documents",
  "sourceType": "DAILY_SALES" | "DOCUMENT" | ...,
  "sourceRefId": "cmf...",               // reportRunId or documentId
  "requestedBy": "usr_...",
  "requestedAt": "2026-05-03T...",
  "status": "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED",
  "format": "PDF" | "CSV" | "XLSX" | "JSON" | "BINARY",
  "fileName": "...",
  "contentType": "application/pdf",
  "fileSizeBytes": 1234,
  "checksum": "sha256:...",
  "readyAt": "2026-05-03T...",
  "failedAt": null,
  "failureReason": null,
  "downloadReady": true,
  "downloadUrl": "/api/exports/reports:cmf.../download",
  "retentionExpiresAt": null
}
```

### Status mapping (reports → facade)

| `ExportArtifact.status` | Facade `status`     |
|---|---|
| `PENDING`                | `QUEUED`           |
| `READY`                  | `COMPLETED`        |
| `FAILED`                 | `FAILED`           |

Documents are always `COMPLETED` (the file is on storage at upload-time).

### Write envelope

```jsonc
{ "ok": true, "action": "EXPORT_REQUESTED", "export": { /* envelope */ } }
```

### List envelope

```jsonc
{ "data": [ /* envelope[] */ ], "total": 12, "page": 1, "pageSize": 25 }
```

## 4. Permissions

Three new keys appended to `PERMISSIONS_DATA` in
`packages/db/prisma/seed.ts` and seeded to roles:

| Permission | Owner | Manager | Accountant | Cashier | Waiter | Chef | Bartender |
|---|---|---|---|---|---|---|---|
| `exports:read`     | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `exports:write`    | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `exports:download` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

Chef denial is exercised by 4 × 403 assertions (one per route) in both
the e2e spec and the Postman collection.

The legacy `pos:reports:exports:read` / `pos:reports:exports:download`
keys are **left untouched** so existing direct callers of
`/api/reports/export` and `/api/reports/exports/:id/download` keep
working.

## 5. Boundary preservation

| Locked rule | Status |
|---|---|
| `/api/auth/me` is the canonical context source (R14)              | ✅ unchanged; e2e + Postman both go through `/me` |
| `POST /api/auth/login` accepts `[200, 201]` (R12)                  | ✅ unchanged; both clients accept both codes |
| Public diner payments still PENDING M13 (MTN/Airtel native)        | ✅ untouched; no payment route added |
| PesaPal reserved for owner SaaS billing                            | ✅ untouched; no PesaPal call added |
| No hotel / property-group structures                               | ✅ verified — no `Property`, `RoomType`, etc. introduced |
| BG3 facade reused, not re-implemented                              | ✅ `POST /api/exports` calls `bg3.guard(...)` |
| M42 maintenance categories preserved                               | ✅ `category: null` keeps facade writes outside the categorisation |
| BG2 audit timeline coverage                                        | ✅ underlying `ReportsService` / `DocumentsService` audit emissions unchanged; facade adds none of its own |
| Existing models stay byte-stable                                   | ✅ no schema change at all |
| `/api/reports/export` + `/api/reports/exports/:id/download` legacy | ✅ untouched and still functional |

## 6. Bugs found and fixed during e2e validation

The 17-test e2e spec surfaced two production bugs in
`getSupplierDetail` (added to `AccountsPayableService` for this BG):

### Bug 1 — Prisma pool exhaustion on Neon free-tier (HTTP 500)

`getSupplierDetail` initially issued eight queries via `Promise.all(...)`
(2 × `vendorBill.count`, 1 × `vendorPayment.count`, 2 × aggregates,
2 × `findMany`, 1 × `creditNote.aggregate`). On the Neon free-tier (25
connections, 10s pool timeout), this saturated the pool and produced
`Timed out fetching a new connection from the connection pool` errors.

**Fix:** serialised the eight queries to sequential `await` calls.
Mirrors the BG2 / BG4.A precedent for Neon-bound read fan-outs. Comment in
`accounts-payable.service.ts` documents the rationale.

### Bug 2 — Invalid `VendorPaymentStatus` enum members (HTTP 500)

`paidAgg` filtered on `status: { in: ['PAID', 'PARTIAL'] }`, but the
schema enum is `VendorPaymentStatus = PENDING | POSTED | FAILED | CANCELLED`
— there are no `PAID` / `PARTIAL` members. Prisma rejected the query
with `Invalid value for argument 'in'. Expected VendorPaymentStatus`.

**Fix:** corrected to `where: { orgId, supplierId, status: 'POSTED' }`.
The aggregated `_sum: { amount: true }` shape and the response field
(`summary.paidTotal`) are unchanged.

Both fixes verified by the e2e suite (17/17) and by the Postman run
(44/44) post-rebuild.

## 7. Validation runs

### `pnpm db:seed`
- Idempotent run: `Seed complete.` SeedHistory marker
  `bg6-exports-and-downloads-facade` recorded. Three new permissions
  granted to Owner / Manager / Accountant.

### `pnpm exec tsc --noEmit` (apps/api)
- Zero new errors introduced; 0 BG6 / exports matches in the error stream.
  (Pre-existing unrelated errors remain.)

### e2e — `apps/api/test/bg6-exports-and-downloads.e2e-spec.ts`

```
PASS test/bg6-exports-and-downloads.e2e-spec.ts
Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
```

Coverage:
- A) AP supplier detail: happy / 404 unknown id / 403 chef.
- B) `POST /api/exports`: happy daily-sales PDF / 400 missing
  reportRunId / 400 unsupported sourceDomain / 403 chef / BG3
  idempotency replay returns identical `exportId`.
- C) `GET /api/exports` + `GET /api/exports/:id`: list / `sourceDomain`
  filter / detail by id / 400 malformed id / 404 unknown id / 403 chef.
- D) `GET /api/exports/:id/download`: happy stream / 400 malformed id /
  403 chef.

### Postman — `postman/collections/BG6-Exports-And-Downloads.postman_collection.json`

```
iterations          1 / 0
requests           26 / 0
test-scripts       23 / 0
prerequest-scripts 25 / 0
assertions         44 / 0
total run duration: 1m 59s
```

Folders: 00 Read Me · A. Auth & Context Baseline ·
B. AP Supplier Detail · C. Create Export · D. Export List / Detail ·
E. Download · F. Edge Cases / Conflicts · G. Permission Denial — Chef
(4 × 403) · H. Reliability / Idempotency Checks (BG3 replay).
Per `ai/AI_POSTMAN_WORKING_PATTERNS.md`: dual-scope vars, canonical
`/api/auth/me`, owner+chef logins accept `[200,201]`, fixtures created
in separate sequential request items so Newman can await them.

## 8. Files touched

### Created
- `apps/api/src/modules/exports/exports.module.ts`
- `apps/api/src/modules/exports/exports.controller.ts`
- `apps/api/src/modules/exports/exports.service.ts`
- `apps/api/src/modules/exports/index.ts`
- `apps/api/src/modules/exports/dto/{create-export,list-exports,index}.dto.ts`
- `apps/api/test/bg6-exports-and-downloads.e2e-spec.ts`
- `postman/collections/BG6-Exports-And-Downloads.postman_collection.json`
- `ai/BG6_COMPLETION_REPORT.md` (this file)

### Modified
- `apps/api/src/app.module.ts` (added `ExportsModule` to the `imports`
  array)
- `apps/api/src/modules/accounts-payable/accounts-payable.controller.ts`
  (added `GET /:id` route handler — closes BG0 missing route)
- `apps/api/src/modules/accounts-payable/accounts-payable.service.ts`
  (added `getSupplierDetail`; fixed Prisma pool exhaustion via
  sequential awaits; fixed invalid `VendorPaymentStatus` enum members)
- `packages/db/prisma/seed.ts` (added 3 perms, Owner/Manager/Accountant
  full grants, marker `bg6-exports-and-downloads-facade`)
- `ai/AI_STATUS.md` (bumped collection + report counters; added BG6
  section; updated last-completed milestone)

## 9. Out of scope (intentionally deferred)

- POST-creating a Document via the facade (`sourceDomain=documents` is
  list/download only; uploads continue to go through
  `POST /api/documents/upload`).
- New domain generators (e.g. accounting period exports beyond what
  `ReportsService` already produces). The facade is generation-agnostic;
  add a domain by adding its envelope mapper, not by changing the
  contract.
- Async generation transitions (RUNNING). Today's `ReportsService`
  generates synchronously, so the facade returns `COMPLETED` immediately.
  The contract honestly exposes `QUEUED` / `RUNNING` so a future async
  generator can be wired up without a contract break.
- Frontend / desktop screens for the download centre — backend is
  frontend-ready (single envelope, predictable error codes, predictable
  download URL shape).
