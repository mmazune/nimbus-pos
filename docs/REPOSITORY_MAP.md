# REPOSITORY_MAP.md — Nimbus POS directory ownership

> What lives where and who owns it. Paired with `docs/DOCUMENT_INDEX.md`
> (documentation provenance) and `ARCHITECTURE.md` (system shape).

## Top-level

| Path | Owner / purpose |
| --- | --- |
| `apps/web/` | `@nimbus-pos/web` — Next.js 14 Pages Router UI (the operational role apps). |
| `apps/api/` | `@nimbus-pos/api` — NestJS API, 53 modules, source of truth for state. |
| `packages/db/` | Prisma schema, ~65 migrations, idempotent `seed.ts`, `demo-import.ts`. |
| `ai/` | Governance docs, `AI_STATUS.md`, milestone & UI completion reports. |
| `docs/` | Canonical architecture / conventions / role-UI docs. |
| `Front End/` | Legacy role-UI **design packs** (waiter/cashier/supervisor/manager). |
| `postman/` | 56 Postman collections (one per milestone/feature) + guide. |
| `demo-data/` | CSV demo dataset + credentials (source for `demo-import.ts`). |
| `nimbus_enterprise_demo_data_pack/` | Duplicate delivery copy of demo-data (legacy). |
| `exports/` | Generated export artifacts. |
| `prisma/` | Root-level prisma helper (schema authority is `packages/db`). |

## apps/web/src (the UI)

| Path | Ownership |
| --- | --- |
| `components/pos-shell/` | **Shared** operational shell: `OperationalShell`, `OperationalHeader`, `OperationalBottomNav`, `CurrentTime`, `RoleIdentity`, `BranchContextLabel`, `OperationalIdleLogoutHandler`, `role-navigation.ts`, `role-icon-config.ts`, `role-icons.ts`, `layout.ts`, `types.ts`. |
| `components/floor/` | **Shared** operational Floor: `OperationalFloor`, `OperationalFloorToolbar`, `OperationalTableGrid`, `OperationalTableCard`, `OperationalTableStatusBadge`, `OperationalTableWorkspaceFrame`, `OperationalFloorErrorState`, `formatters.ts`, `types.ts`. |
| `components/profile/` | **Shared** profile primitives: `RoleProfileHero`, `ProfileSection`, `ProfileMetaGrid`, `SessionCard`, `ShiftStatusCard`, `OperationalStatusBadge`, `CapabilityNotice`, `CompactUnavailableState`. |
| `components/ui/` | Base UI primitives (Badge, StatusMessage, etc.). |
| `components/providers/` | `AppProviders`, `ToastProvider`. |
| `components/waiter/` | Waiter adapters: `shell/`, `floor/` (`WaiterFloorScreen`, `WaiterTableWorkspace`, `WaiterOwnershipBlockedPanel`), `orders/` (order builder + legacy redirect), `receipts/`, `reservations/`, `me/`. |
| `components/cashier/` | Cashier adapters: `shell/`, `queue/`, `receipts/`, `till/`, `refunds/`, `me/`. |
| `components/supervisor/` | Supervisor adapters: `shell/`, `floor/` (`SupervisorFloorScreen`, `SupervisorTableControlWorkspace`), `approvals/`, `me/`, `orders/` (data + **legacy redirect**; the visual `SupervisorOrder*` components are dead-but-reserved for Prompt 3 — see note). |
| `lib/<role>/` | Role data layers: `routes.ts` (nav), `context.ts`, `floor.ts`/`floor-model.ts`, `order*.ts`, `me-model.ts`, etc. |
| `lib/profile/` | Shared `profile-model.ts` (role accents, initials, datetime). |
| `lib/api/client.ts` | Shared API client (request IDs, bounded timeout, AbortController). |
| `lib/auth/` | `AuthProvider`, auth types. |
| `pages/` | Next.js Pages Router routes per role; legacy Orders pages are redirect-only. |
| `scripts/` | Static assertion scripts (`floor-assertions.ts`, `shell-assertions.ts`, `profile-assertions.ts`) with their own tsconfigs — structural guards, not Jest tests. |
| `public/` | Static assets (`favicon.svg`). |

### Note — reserved Supervisor order components

`components/supervisor/orders/SupervisorOrderCard|List|DetailPanel|StatusBadge|
Toolbar|Summary.tsx` are **not** referenced outside their own folder (only the
barrel `index.ts` re-exports them). The order **data layer** `lib/supervisor/orders.ts`
IS actively used by the shared Floor workspace, approvals, and the legacy redirect.
The visual components are intentionally retained for the planned **Prompt 3**
Floor-contained order workspace — do **not** delete them, and do **not** wire them
into a visible Orders tab.

## apps/api/src/modules (53 modules)

accounting, accounts-payable, accounts-receivable, alerts, analytics, attendance,
audit-timeline, auth, bank-rec, bg3-reliability, billing, billing-pesapal, budget,
client-onboarding, controlplane, dashboards, device-registry, discounts, documents,
events, exports, feedback, floor, franchise, franchise-analytics, hms-integration,
hr, inventory, kds, ledger, menu, merchant-payments, ops-portal, orders, payments,
payroll, pos-handoff, public-commerce, public-commerce-payments, receipts, recipes,
refunds, reliability, reports, reservations, settings, shifts, staff-insights,
tenancy, tills, unified-approvals, workforce.

- `main.ts` — global prefix `/api`, port `3001` (`API_PORT`), health at `/api/health`.
- Common: `common/prisma/` (global PrismaModule/Service), `common/guards/branch-context.guard.ts`.

## Generated / temporary (safe to ignore; not authoritative)

- Root: `_*.txt`, `_*.log`, `_*.cjs`, `_*.mjs`, `seed*.log`, `seed*.txt`, `_qa-logs/`.
- `apps/api/`, `packages/db/`: similar `_*`/`seed*` console dumps.
- These are throwaway console captures and ad-hoc verification scripts from prior
  workflows. They are referenced by no build or test. They were left in place
  during this onboarding pass (no deletions) — see the onboarding report.
