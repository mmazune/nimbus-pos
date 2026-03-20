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
| Tenant / branch guards       | `apps/api/src/common/guards/`       | M3       |
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

## Frontend Strategy (M43+)

- Web shell first
- POS / KDS UI after backend maturity
- Shared role-filtered navigation
- React Query for API state
- Offline awareness reserved for reliability milestone (M41)
