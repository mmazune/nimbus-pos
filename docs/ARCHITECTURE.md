# ARCHITECTURE.md — Nimbus POS Rebuild

## Monorepo Structure

```text
nimbus-pos/
├── apps/
│   ├── api/                 # NestJS API (primary backend)
│   ├── web/                 # Next.js backoffice / shared web UI (M43+)
│   ├── desktop/             # Optional POS desktop shell (deferred)
│   └── mobile/              # Optional mobile companion (deferred)
├── packages/
│   ├── db/                  # Prisma schema, migrations, seed, client
│   └── shared/              # Shared types, enums, DTOs, constants
├── ai/                      # AI governance docs, status, reports
├── docs/                    # Architecture & convention documentation
└── postman/                 # Postman collections & environments
```

### Database Package (`packages/db`)

The Prisma schema, migrations, client, and seed all live in `packages/db`.

- Schema: `packages/db/prisma/schema.prisma`
- Migrations: `packages/db/prisma/migrations/`
- Seed: `packages/db/prisma/seed.ts` — idempotent by design
- Client: `packages/db/src/client.ts` — singleton Prisma client export

The API app consumes Prisma through a shared NestJS `PrismaModule` / `PrismaService`
located at `apps/api/src/common/prisma/`. This handles lifecycle (`$connect` / `$disconnect`)
and is registered as a global module so all business modules can inject it via DI.

Neon Postgres is used via `DATABASE_URL` and `DIRECT_DATABASE_URL` environment variables only.
No connection strings are ever committed to source control.

### Future packages (added as milestones require)

| Package              | Purpose                     | Added in    |
| -------------------- | --------------------------- | ----------- |
| `packages/contracts` | Shared API contracts / DTOs | When needed |
| `packages/ui`        | Shared React UI components  | M43+        |
| `packages/auth`      | Shared auth utilities       | M2+         |
| `packages/printer`   | ESC/POS printer adapters    | M46+        |

### Future services (added as milestones require)

| Service           | Purpose                         | Added in    |
| ----------------- | ------------------------------- | ----------- |
| `services/worker` | BullMQ jobs / reports / digests | When needed |
| `services/sync`   | Offline/sync service            | M41+        |

## Runtime Principles

- API is the source of truth for business state.
- Worker handles heavy reports, digests, retries, and scheduled jobs (added when needed).
- Sync service is late-wave and only appears once reliability contracts are mature.
- Shared packages prevent backend/frontend contract drift.

## Backend Module Style

Every business domain gets:

- Module
- Service
- Controller
- DTO folder
- Spec files
- e2e coverage in `test/` folder when milestone risk justifies it

## Cross-Cutting Layers

| Layer                        | Location                            | Added in |
| ---------------------------- | ----------------------------------- | -------- |
| PrismaModule / PrismaService | `apps/api/src/common/prisma/`       | M1 ✅   |
| Auth guards (JWT)            | `apps/api/src/common/guards/`       | M2 ✅   |
| Permission guard             | `apps/api/src/common/guards/`       | M2 ✅   |
| Platform-access guard        | `apps/api/src/common/guards/`       | M2 ✅   |
| Branch context guard         | `apps/api/src/common/guards/`       | M3 ✅   |
| Tenant / branch guards       | `apps/api/src/common/guards/`       | M3 ✅   |
| Quick PIN service            | `apps/api/src/modules/auth/`        | M3.1 ✅ |
| Org settings service         | `apps/api/src/modules/settings/`    | M4 ✅   |
| Audit service                | `apps/api/src/common/audit/`        | M2 ✅   |
| Idempotency interceptor      | `apps/api/src/common/interceptors/` | M41      |
| Global exception filter      | `apps/api/src/common/filters/`      | M1       |
| Request ID / correlation     | `apps/api/src/common/interceptors/` | M1       |

## Data Design Rules

- `orgId` first, `branchId` where operational
- `cuid2` IDs everywhere
- Decimal-safe money fields
- UTC timestamps
- Immutable history for stock / finance / security-sensitive flows

## Auth Architecture (M2)

### Token Strategy

- **Access token**: JWT HS256, signed with `JWT_ACCESS_SECRET`, default 15 min TTL.
- **Refresh token**: 48-byte cryptographic random hex, stored as SHA-256 hash in `RefreshToken` table.
  - Refresh token rotation: each use issues a new token pair and invalidates the old one.
  - Family-based revocation: if a revoked token is reused, the entire token family is revoked to prevent replay.
- Tokens are issued via `POST /api/auth/login`, `POST /api/auth/pin-login`, and `POST /api/auth/refresh`.

### Session Model

- A `Session` row is created on every login, storing `jti`, platform, source, IP, user-agent, and expiry.
- The JWT `validate()` callback checks that the session is still active (not revoked, not expired) on every request.
- `lastActivityAt` is bumped on each validated request for session-activity tracking.
- Logout revokes the session and all its child refresh tokens.

### RBAC Model

- **5 hierarchical role levels**: L1 (staff) → L5 (super-admin).
- **11 named job roles**: OWNER, GENERAL_MANAGER, BRANCH_MANAGER, ACCOUNTANT, HEAD_CHEF, SOUS_CHEF, CASHIER, WAITER, HOST, BARISTA, DELIVERY.
- Users can hold multiple roles (via `UserRole`) — the JWT strategy aggregates permissions from all roles.
- **Permissions** are string-based (`identity:user:read`, `identity:role:manage`, etc.) checked by `PermissionGuard`.

### Platform Access Guard

- `X-Platform` header (default: `POS_DESKTOP`) is validated against a level-based access matrix:
  - L5 → all 6 platforms
  - L4 → WEB_BACKOFFICE, MOBILE_APP, POS_DESKTOP
  - L3 → KDS_SCREEN, POS_DESKTOP
  - L2 → POS_DESKTOP, MOBILE_APP
  - L1 → MOBILE_APP

### Audit Log

The `AuditService` (global module at `apps/api/src/common/audit/`) writes structured entries to the `AuditLog` table. Every auth action (login, logout, refresh, failures) is audited with actor, action, entity, IP, and user-agent metadata.

### Deferred to Later Milestones

- MSR / badge swipe login → M46
- MFA / passkeys / SSO → M45
- Org / branch scoping in roles (`orgId`, `branchId` on `UserRole`) → M3

## Multi-Tenancy Architecture (M3)

### Tenancy Model

Nimbus uses **branch-based tenancy**:

- **Organization** = tenant root entity. All business data is ultimately org-scoped.
- **Branch** = physical store/location unit within an organization. Branch-operational data (orders, inventory, shifts) is scoped to a branch.
- **Membership** = links a user to a branch within an org with a specific role. A user may belong to multiple branches.

### Branch Isolation Rules

- Users can only access branches where they have an ACTIVE membership.
- `GET /api/branches` returns only branches the current user is a member of.
- `GET /api/branches/:id` verifies membership before returning data.
- Future modules (M4+) requiring branch-scoped data must use the `BranchContextGuard`.

### X-Branch-Id Header

For branch-scoped modules (M4+), requests must include `X-Branch-Id` header:

- Missing header → `400 Bad Request`
- Branch not found or inactive → `400 Bad Request`
- User not a member of the branch → `403 Forbidden`
- Valid → `branchContext` object attached to the request with `branchId`, `organizationId`, `roleId`, `membershipId`

### Session/Auth Integration

- Sessions carry optional `orgId` and `branchId` fields for future branch-switching context.
- `GET /api/me` returns full tenancy context: organizations, branches, roles, permissions, default branch.
- `GET /api/auth/me` remains for backward-compatible auth-only context.
- Login does not require branch selection; branch context is determined per-request via header or membership defaults.

### Future Modules That Must Be Branch-Scoped

All operational modules from M5 onward must accept `X-Branch-Id`:
- Floor plans, tables, service areas (M5)
- Menu catalog (M6-M7)
- Inventory, stock (M9-M13)
- POS orders, KDS (M14-M15)
- Payments, shifts, tills (M17-M19)
- HR scheduling at branch level (M27-M29)

### Org Settings and Branch Settings

These are deferred to M4. M3 only establishes the tenancy structure.

### Audit Events (M3)

| Action                    | Trigger                        |
| ------------------------- | ------------------------------ |
| ORG_CREATED               | Organization created           |
| BRANCH_CREATED            | Branch created                 |
| MEMBERSHIP_CREATED        | User added to a branch         |
| BRANCH_ACCESS_DENIED      | User tried to access a branch without membership |
| TENANCY_PERMISSION_DENIED | Permission guard rejected access |

## Org Settings Architecture (M4)

### Single Source of Truth

`OrgSettings` is a single row per organization storing all org-level defaults. Branch modules in M5+ will read these defaults; branch-specific overrides are deferred to later milestones.

### Settings Model

- One `OrgSettings` row per `Organization` (unique `orgId` FK).
- Scalar fields for critical values: `vatPercent`, `currency`, `discountApprovalThreshold`, `reservationHoldMinutes`, `showCostToChef`.
- JSON fields for structured configs: `taxMatrix`, `rounding`, `anomalyThresholds`, `platformAccess`, `bookingPolicies`, `attendance`, `inventoryTolerance`, `franchiseWeights`, `metadata`, `defaults`.
- `ExchangeRate` table for multi-currency rate history.

### Settings Impact on Future Modules

| Setting                  | Consumers                                |
| ------------------------ | ---------------------------------------- |
| VAT / taxMatrix          | Menu, orders, invoices, accounting       |
| currency / baseCurrency  | Reporting, accounting, exchange rates    |
| reservationHoldMinutes   | Reservations, events                     |
| bookingPolicies          | Reservations, events, ticketing          |
| platformAccess           | Workspace and device access              |
| anomalyThresholds        | Anti-theft, alerts, anomaly detection    |
| showCostToChef           | KDS costing visibility                   |
| inventoryTolerance       | Stock counts, reconciliation             |
| franchiseWeights         | Future branch rankings                   |
| rounding                 | POS orders, invoicing                    |
| attendance               | HR, scheduling                           |

### M4 Permissions

| Permission               | Purpose                   |
| ------------------------ | ------------------------- |
| tenancy:settings:manage  | Create/update settings    |
| tenancy:org:read         | Read settings             |

### M4 Audit Events

| Action                    | Trigger                       |
| ------------------------- | ----------------------------- |
| ORG_SETTINGS_CREATED      | Settings row auto-created     |
| ORG_SETTINGS_UPDATED      | General settings patch        |
| CURRENCY_UPDATED          | Currency changed              |
| TAX_MATRIX_UPDATED        | Tax matrix changed            |
| ROUNDING_UPDATED          | Rounding policy changed       |
| THRESHOLDS_UPDATED        | Thresholds changed            |
| PLATFORM_ACCESS_UPDATED   | Platform access changed       |
| EXCHANGE_RATE_CREATED     | New exchange rate added       |

## Frontend Strategy (M43+)

- Web shell first
- POS / KDS UI after backend maturity
- Shared role-filtered navigation
- React Query for API state
- Offline awareness reserved for reliability milestone (M41)
