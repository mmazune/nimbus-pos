# BG5 — Device / Printer / Terminal Registry — Completion Report

**Status:** ✅ Complete · 2026-05-02
**Module:** `apps/api/src/modules/device-registry`
**Migration:** `packages/db/prisma/migrations/20260502000000_bg5_device_printer_terminal_registry`
**Seed marker:** `bg5-device-printer-terminal-registry`

---

## 1. Scope and intent

BG5 closes the previously empty backend device-management gap that frontline
operations (POS terminals, KDS screens, kitchen/bar/receipt printers, payment
terminals) need but neither BG0–BG4 nor M0–M42 had implemented. It is a pure
registry / configuration layer:

- **No live hardware integration.** Printer routes are metadata only — no
  print-driver invocation. Payment terminals expose a STUB pairing surface
  only — no card-terminal traffic, no acquirer integration.
- **No regressions.** All existing locked rules (BG0 route surface, BG1
  invitations + PIN, BG2 audit timeline, BG3 reliability facade, BG4.A
  receipts, BG4.B order handoff, M42 maintenance/training, /api/auth/me as
  canonical context, public diner payments PENDING via M13, PesaPal
  owner-SaaS-only) remain untouched.
- **Schema is additive only.** Two new tables (`devices`, `printer_routes`)
  + three new enums. No back-relations are added on `Branch` or
  `Organization`, mirroring the BG1 Invitation precedent so those models
  stay byte-stable.
- **Permissions follow the same shape as BG4.B.** Five new keys, all under
  the `devices:*` namespace; Owner + Manager get everything, Cashier +
  Waiter get read-only, Chef intentionally denied to keep the role-gating
  test surface meaningful.

## 2. Endpoints (10)

All routes live under `@Controller('devices')`, guarded by
`JwtAuthGuard + PermissionGuard + BranchContextGuard`, and require a
`branchContext` populated via the canonical `/api/auth/me` chain.

| Method | Path | Permission | Idempotency | Audit emitted |
|---|---|---|---|---|
| POST  | `/api/devices/activate`                  | `devices:write`           | optional (BG3) | `DEVICE_ACTIVATED` |
| POST  | `/api/devices/kds/register`              | `devices:write`           | optional (BG3) | `DEVICE_ACTIVATED` + `KDS_DEVICE_REGISTERED` |
| GET   | `/api/devices`                           | `devices:read`            | n/a            | — |
| GET   | `/api/devices/:id`                       | `devices:read`            | n/a            | `DEVICE_VIEWED` (fire-and-forget) |
| GET   | `/api/devices/:id/history`               | `devices:read`            | n/a            | — |
| PATCH | `/api/devices/:id/status`                | `devices:status:write`    | optional (BG3) | `DEVICE_STATUS_CHANGED` |
| POST  | `/api/devices/printers/routes`           | `devices:routes:write`    | optional (BG3) | `PRINTER_ROUTE_CONFIGURED` \| `PRINTER_ROUTE_DISABLED` |
| GET   | `/api/devices/printers/routes`           | `devices:read`            | n/a            | — |
| POST  | `/api/devices/terminals/pair`            | `devices:terminals:write` | optional (BG3) | `TERMINAL_PAIRED` |
| PATCH | `/api/devices/terminals/:id/unpair`      | `devices:terminals:write` | optional (BG3) | `TERMINAL_UNPAIRED` |

All mutating endpoints flow through:

```ts
this.bg3.guard(
  {
    req,
    scope: 'devices.<surface>',
    routeMethod, routePath,
    category: null,                  // not BILLING/ACCOUNTING/INVENTORY/PUBLIC_BOOKING/SYNC
    idempotencyMode: 'optional',     // R3/R4-safe
    fingerprintSource: { dto, ... },
    actorUserId, orgId, branchId,
  },
  () => this.devices.<method>(...),
)
```

`category: null` means M42 maintenance windows do **not** block these
writes — the registry is operational configuration, not booking/billing/
accounting/inventory traffic.

### Static-segment ordering

Static segments (`activate`, `kds/register`, `printers/routes`,
`terminals/pair`, `terminals/:id/unpair`) are declared **before** the
generic `:id` routes inside the controller so Nest does not interpret
those literal segments as device ids.

## 3. Schema additions (additive only)

New enums:

```prisma
enum DeviceType        { POS_TERMINAL  KDS_SCREEN  PRINTER  PAYMENT_TERMINAL_STUB }
enum DeviceStatus      { ACTIVE  INACTIVE  DISABLED  RETIRED }
enum PrinterRouteType  { RECEIPT  KITCHEN  BAR }
```

New tables (FKs enforced at DB layer only — no Prisma back-relations on
`Branch` / `Organization`):

```prisma
model Device {
  id                String         @id @default(cuid())
  orgId             String
  branchId          String
  type              DeviceType
  name              String
  station           String?
  activationCode    String         @unique
  status            DeviceStatus   @default(ACTIVE)
  pairedToDeviceId  String?        // self-FK; only meaningful for PAYMENT_TERMINAL_STUB
  capabilities      Json?
  metadata          Json?
  lastSeenAt        DateTime?
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  @@unique([branchId, name])
  @@index([orgId, branchId])
  @@index([type])
  @@index([status])
  @@index([pairedToDeviceId])
  @@map("devices")
}

model PrinterRoute {
  id          String           @id @default(cuid())
  orgId       String
  branchId    String
  printerId   String
  routeType   PrinterRouteType
  station     String?
  enabled     Boolean          @default(true)
  priority    Int              @default(100)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  @@unique([branchId, routeType, station, printerId])
  @@index([branchId, routeType])
  @@index([printerId])
  @@map("printer_routes")
}
```

Migration `20260502000000_bg5_device_printer_terminal_registry/migration.sql`
applies these as `CREATE TYPE` + `CREATE TABLE` + 6 FK constraints
(devices→organizations, devices→branches, devices→devices self,
printer_routes→organizations, printer_routes→branches, printer_routes→devices).
Applied successfully via `prisma migrate deploy`.

## 4. Permissions

Five new keys appended to `PERMISSIONS_DATA` in `packages/db/prisma/seed.ts`
and seeded to roles:

| Permission | Owner | Manager | Cashier | Waiter | Chef | Bartender |
|---|---|---|---|---|---|---|
| `devices:read`            | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `devices:write`           | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `devices:status:write`    | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `devices:routes:write`    | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `devices:terminals:write` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

Chef denial is exercised by 5 × 403 assertions in both the e2e spec and
the Postman collection.

## 5. Audit actions (8)

All emitted on `entityType: 'device'`, `entityId == device.id`, and are
therefore picked up automatically by the BG2 `/api/audit/timeline` surface.

| Action | Emitted by |
|---|---|
| `DEVICE_ACTIVATED`         | `POST /activate` (and as the underlying call from `/kds/register`) |
| `DEVICE_VIEWED`            | `GET /:id` (fire-and-forget) |
| `DEVICE_STATUS_CHANGED`    | `PATCH /:id/status` (when status actually changes) |
| `KDS_DEVICE_REGISTERED`    | `POST /kds/register` (in addition to `DEVICE_ACTIVATED`) |
| `PRINTER_ROUTE_CONFIGURED` | `POST /printers/routes` (when `enabled: true`) |
| `PRINTER_ROUTE_DISABLED`   | `POST /printers/routes` (when `enabled: false`) |
| `TERMINAL_PAIRED`          | `POST /terminals/pair` |
| `TERMINAL_UNPAIRED`        | `PATCH /terminals/:id/unpair` (only when previously paired) |

Constants exported as `DEVICE_AUDIT_ACTIONS` from
`apps/api/src/modules/device-registry/device-registry.service.ts`.

## 6. Write-surface matrix (locked-rule traceability)

| Endpoint | Idempotency (BG3) | M42 maintenance/training | Audit emitted | Stub vs Live | Frontend-safe? |
|---|---|---|---|---|---|
| `POST /devices/activate`              | ✅ optional | ❌ category null | `DEVICE_ACTIVATED` | Live (DB only) | ✅ |
| `POST /devices/kds/register`          | ✅ optional | ❌ category null | `DEVICE_ACTIVATED` + `KDS_DEVICE_REGISTERED` | Live (DB only) | ✅ |
| `PATCH /devices/:id/status`           | ✅ optional | ❌ category null | `DEVICE_STATUS_CHANGED` | Live (DB only) | ✅ |
| `POST /devices/printers/routes`       | ✅ optional | ❌ category null | `PRINTER_ROUTE_CONFIGURED` \| `PRINTER_ROUTE_DISABLED` | Metadata only — no print driver invoked | ✅ |
| `POST /devices/terminals/pair`        | ✅ optional | ❌ category null | `TERMINAL_PAIRED` | **STUB** — `mode: 'STUB'` in response, no card-terminal traffic | ✅ |
| `PATCH /devices/terminals/:id/unpair` | ✅ optional | ❌ category null | `TERMINAL_UNPAIRED` | **STUB** — `mode: 'STUB'` in response | ✅ |

All read endpoints (`GET /`, `GET /:id`, `GET /:id/history`, `GET /printers/routes`)
are unconstrained by BG3 / M42 and are therefore frontend-safe by default.

## 7. Boundary preservation

| Locked rule | Status |
|---|---|
| `/api/auth/me` is the canonical context source (R14) | ✅ unchanged; e2e + Postman both go through `/me` |
| `POST /api/auth/login` accepts `[200, 201]` (R12) | ✅ unchanged; both clients accept both codes |
| Public diner payments still PENDING M13 (MTN/Airtel native) | ✅ untouched; no payment route added |
| PesaPal reserved for owner SaaS billing | ✅ untouched; no PesaPal call added |
| No hotel / property-group structures | ✅ verified — no `Property`, `RoomType`, etc. introduced |
| BG3 facade reused, not re-implemented | ✅ all 6 mutating routes call `bg3.guard(...)` |
| M42 maintenance categories preserved | ✅ `category: null` keeps registry writes outside the M42 categorisation |
| BG2 audit timeline auto-includes device events | ✅ all events use `entityType: 'device'` on the canonical `AuditLog` |
| Branch/Organization models stay byte-stable | ✅ no Prisma back-relations added; FKs at DB layer only |

## 8. Validation runs

### `pnpm db:seed`
- Idempotent run: `Seed complete.` SeedHistory marker
  `bg5-device-printer-terminal-registry` recorded.

### `pnpm exec tsc --noEmit` (apps/api)
- Zero new errors introduced; 0 device/BG5 matches in the error stream.
- (Pre-existing `accounts-receivable.service.spec.ts` errors remain
  unrelated to BG5.)

### e2e — `apps/api/test/bg5-device-printer-terminal-registry.e2e-spec.ts`

```
PASS test/bg5-device-printer-terminal-registry.e2e-spec.ts (293 s)
Test Suites: 1 passed, 1 total
Tests:       27 passed, 27 total
```

Coverage: device activation (happy + 400 missing type + 409 duplicate name +
idempotent on activationCode), KDS registration (happy + 403 chef), printer
routes (400 wrong type + upsert configured + upsert disabled keeps id +
GET list + 403 chef), terminal pair/unpair (happy STUB + 400 wrong type +
unpair clears + idempotent unpair on already-unpaired + 403 chef), list
filters, detail incl. PRINTER routes, 404 on unknown id, status change +
no-op + RETIRED→other rejection + 403 chef, history retrieval, BG3
idempotency replay returning identical body.

### Postman — `postman/collections/BG5-Device-Printer-Terminal-Registry.postman_collection.json`

```
iterations          1 / 0
requests           33 / 0
test-scripts       30 / 0
prerequest-scripts 31 / 0
assertions         68 / 0
total run duration: 2m 12.1s
```

Folders: 00 Read Me · A. Auth & Context Baseline · B. Device Activation
(happy + 400 + 409 + idempotency replay) · C. KDS Registration ·
D. Printer Routes (BAR enabled → disabled upsert + wrong-type 400 + GET) ·
E. Terminal Pair / Unpair (STUB pair + unpair + idempotent unpair) ·
F. List / Detail / Status / History · G. Permission Denial — Chef
(5 × 403). Per `ai/AI_POSTMAN_WORKING_PATTERNS.md`: dual-scope vars,
canonical `/api/auth/me`, owner+chef logins accept `[200,201]`,
fixtures created in separate sequential request items so Newman can
await them.

## 9. Files touched

### Created
- `packages/db/prisma/migrations/20260502000000_bg5_device_printer_terminal_registry/migration.sql`
- `apps/api/src/modules/device-registry/device-registry.module.ts`
- `apps/api/src/modules/device-registry/device-registry.controller.ts`
- `apps/api/src/modules/device-registry/device-registry.service.ts`
- `apps/api/src/modules/device-registry/index.ts`
- `apps/api/src/modules/device-registry/dto/{activate-device,update-device-status,list-devices,device-history-query,register-kds-device,upsert-printer-route,list-printer-routes,pair-terminal,unpair-terminal,index}.dto.ts`
- `apps/api/test/bg5-device-printer-terminal-registry.e2e-spec.ts`
- `postman/collections/BG5-Device-Printer-Terminal-Registry.postman_collection.json`
- `ai/BG5_COMPLETION_REPORT.md` (this file)

### Modified
- `packages/db/prisma/schema.prisma` (appended BG5 enums + models; no
  back-relations on existing models)
- `apps/api/src/app.module.ts` (added `DeviceRegistryModule` to the
  `imports` array, after `PosHandoffModule`)
- `packages/db/prisma/seed.ts` (added 5 perms, Owner/Manager full grants,
  Cashier/Waiter `devices:read`, marker `bg5-device-printer-terminal-registry`)
- `ai/AI_STATUS.md` (bumped counters to migrations 50, collections 54,
  reports 59; added BG5 section; updated last-completed milestone)

## 10. Out of scope (intentionally deferred)

- Live print-driver invocation (ESC/POS, Star, Epson) — `PrinterRoute`
  remains routing **configuration** only.
- Live card-terminal protocols (USB/Bluetooth/Ethernet acquirer
  integration) — terminal pair/unpair return `mode: 'STUB'` only.
- Frontend / desktop screens for device management — backend is
  frontend-ready (consistent envelope: `{ ok, action, ... }` for writes,
  `{ data, total, page, pageSize }` for lists, error envelope
  `{ code, message }` for 4xx).
- MSR / badge login, deep terminal settlement workflows, hotel /
  property-group device hierarchies (all explicitly excluded by the
  locked-rule set).
