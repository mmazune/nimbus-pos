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
| Auth guards                  | `apps/api/src/common/guards/`       | M2       |
| Permission guards            | `apps/api/src/common/guards/`       | M2       |
| Tenant / branch guards       | `apps/api/src/common/guards/`       | M3       |
| Audit service / interceptor  | `apps/api/src/common/interceptors/` | M2       |
| Idempotency interceptor      | `apps/api/src/common/interceptors/` | M41      |
| Global exception filter      | `apps/api/src/common/filters/`      | M1       |
| Request ID / correlation     | `apps/api/src/common/interceptors/` | M1       |

## Data Design Rules

- `orgId` first, `branchId` where operational
- `cuid2` IDs everywhere
- Decimal-safe money fields
- UTC timestamps
- Immutable history for stock / finance / security-sensitive flows

## Frontend Strategy (M43+)

- Web shell first
- POS / KDS UI after backend maturity
- Shared role-filtered navigation
- React Query for API state
- Offline awareness reserved for reliability milestone (M41)
