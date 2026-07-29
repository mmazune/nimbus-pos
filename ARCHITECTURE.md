# ARCHITECTURE.md — Nimbus POS (repository index)

> Concise repository-level architecture index. This is **not** a replacement for
> the detailed documents — it points to them:
> - **Backend / system architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
> - **Frontend operational UI system:** [`docs/UI_SYSTEM.md`](docs/UI_SYSTEM.md)
> - **Module map:** [`docs/MODULES.md`](docs/MODULES.md)
> - **API conventions:** [`docs/API_CONVENTIONS.md`](docs/API_CONVENTIONS.md)
> - **Repo map:** [`docs/REPOSITORY_MAP.md`](docs/REPOSITORY_MAP.md)

## Stack at a glance

| Layer | Technology |
| --- | --- |
| Monorepo | pnpm workspaces + Turborepo (pnpm `8.15.0`, Node ≥ 22, TS strict) |
| Frontend | Next.js 14 **Pages Router** + React Query (TanStack) + Tailwind + Phosphor icons (`apps/web`, `:3000`) |
| API | NestJS, service-first, 53 modules, global prefix `/api` (`apps/api`, `:3001`) |
| ORM / DB | Prisma → Neon Postgres (`packages/db`); `cuid2` IDs; Decimal-safe money |
| Jobs/cache | Redis + BullMQ (added as needed) |
| Auth | JWT access + refresh; Quick PIN (per-branch); RBAC permissions |

## Runtime principles

- The **API is the source of truth** for business state.
- Controllers are thin; **services own rules and state transitions**.
- Data is `orgId`-scoped; branch-operational data carries `branchId`
  (enforced via `X-Branch-Id` header + `BranchContextGuard`).
- Stock, money, approvals, payroll, and sync flows are transaction-first;
  critical ledgers are append-only where possible; sensitive writes are audited.

## Frontend operational UI architecture (shared-first)

The three operational roles (Waiter, Cashier, Supervisor) are built on **shared
primitives** with thin per-role adapters. Detailed in `docs/UI_SYSTEM.md`.

```
Shared Operational Shell (components/pos-shell/OperationalShell)
  → role shell adapters (WaiterShell / CashierShell / SupervisorShell)
      → role routes/pages (pages/<role>/*.tsx)
  slots: header (OperationalHeader) · readiness · bottomNav (OperationalBottomNav)
         · idleHandler ; icons via canonical registry (role-icon-config + role-icons)

Shared Operational Floor (components/floor/OperationalFloor)
  → Waiter adapter (WaiterFloorScreen)
      → OperationalTableWorkspaceFrame → WaiterTableWorkspace (menu/order entry)
  → Supervisor adapter (SupervisorFloorScreen)
      → OperationalTableWorkspaceFrame → SupervisorTableControlWorkspace (read-first)

Shared Profile primitives (components/profile/*)
  → WaiterMeScreen · CashierMeScreen · SupervisorMeScreen
```

**Invariant:** changes to shared Floor cards, toolbars, status/staff formatting,
spacing, or breakpoints **propagate automatically to every consuming role**.
Waiter and Supervisor default Floor are **one shared presentation**; role
behaviour diverges only **after** a table is selected. Data access
(queries/mutations/permissions) stays role-owned; **presentation is shared**.

**Supervisor order actions (Prompt 3A + 3B1).** The read-first
`SupervisorTableControlWorkspace` derives every order action from one central module
(`lib/supervisor/order-actions.ts` → `getSupervisorOrderActionAvailability`) over
the canonical `["supervisor","order-detail",branchId,orderId]` query. Live actions:
Request bill + Mark served (`pos:orders:write`, 3A) and Split bill / Split items /
Move items / Merge (`pos:order:*`, 3B1). Shared pieces: `ActionConfirmDialog`
(composable — `children`/`confirmDisabled`/`size`), `lib/pos-shell/idempotency`
(idempotency-intent, used for the BG3-wrapped handoff endpoints), pure validators in
`lib/supervisor/order-action-forms.ts` (EQUAL/CUSTOM allocation, line validation),
and `SupervisorOrderTargetSelector` (bounded branch-scoped) + `SupervisorLineSelector`.
All three roles share `OperationalIdleLogoutHandler` + `pos-shell/idle`.

## Route compatibility & URL-backed context

- Table/order selection is URL-backed (`tableId`/`orderId` query), so browser
  Back/Forward work across Floor and the table workspace.
- Legacy Orders routes are redirect-only: `/waiter/orders*` → `/waiter/floor`;
  `/supervisor/orders` → `/supervisor/floor` (resolving `orderId`→`tableId`).
  **No visible Orders nav tab exists for Waiter or Supervisor.**

## Performance architecture (preserve)

JWT carries roles/permissions so downstream requests skip RBAC re-queries;
`/auth/me` reuses claims and parallelises reads; branch guard caches/dedupes;
session `lastActivityAt` writes are throttled (>60s) and fire-and-forget; API
client has request IDs + bounded 30s timeout + AbortController; secondary
invalidations are non-blocking; list N+1 payment/receipt fan-outs were removed.
See `docs/DECISIONS.md` and `ai/APPLICATION_PERFORMANCE_HARDENING_COMPLETION_REPORT.md`.

## Governance

API/Postman contracts are governed (see `AGENTS.md`, `docs/API_CONVENTIONS.md`,
`docs/POSTMAN_ENDPOINT_GUIDE.md`, `ai/AI_POSTMAN_WORKING_PATTERNS.md`).
Documentation governance and provenance: `docs/DOCUMENT_INDEX.md`.
