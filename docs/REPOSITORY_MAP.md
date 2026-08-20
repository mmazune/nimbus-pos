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
| `components/cashier/` | Cashier adapters: `shell/`, **`floor/` (C2: `CashierFloorScreen`, `CashierBillResolutionPanel`, `CashierBillSelector`, `CashierSettlementWorkspace`, `CashierFindBillDialog`, `index`; plus the retained-but-unused C1 `CashierSelectedTablePanel`) — Cashier is the third shared-`OperationalFloor` consumer; a table selection resolves to zero/one/multiple bills and opens ONE read-only settlement workspace (reusing `queue/CashierOrderTotals` + `queue/CashierPaymentSummary`); a Cashier-only Find bill dialog is a sibling above the shared Floor**, `queue/`, `receipts/`, `checkout/`, `resolution/`, `till/`, `refunds/`, `states/`, `me/`. **C1 (2026-07-31) landed Floor-first nav (Floor/Till/Me) and `/cashier/floor` as default; C2 (2026-07-31) landed table→bill resolution + the read-only settlement workspace + Find bill**; `queue/` + `receipts/` remain as **hidden compatibility routes** (reachable only by direct URL, removed from visible nav; planned retirement Receipts C4 / Queue C5). Reconstruction is C0–C6, C0+C1+C2 complete — see `docs/cashier-ui-docs/*` and `ai/CASHIER_FLOOR_RECONSTRUCTION_COMPONENT_AUDIT.md` for the full per-file migration classification. |
| `components/supervisor/` | Supervisor adapters: `shell/`, `floor/` (`SupervisorFloorScreen`, `SupervisorTableControlWorkspace`), `approvals/`, `me/`, `orders/` (data + **legacy redirect**; the visual `SupervisorOrder*` components are dead-but-reserved for Prompt 3 — see note). |
| `lib/<role>/` | Role data layers: `routes.ts` (nav), `context.ts`, `floor.ts`/`floor-model.ts`, `order*.ts`, `me-model.ts`, etc. Cashier C1 added `lib/cashier/floor-api.ts` (bounded shared-safe reads: `/api/tables`, `/api/pos/orders?excludeStatus=CLOSED,VOIDED`, `/api/reservations`), `floor-model.ts` (Floor view model), `floor-route.ts` (canonical `?tableId=` URL state) and modified `lib/cashier/routes.ts` (Floor/Till/Me nav) + `lib/auth/role.ts` (`getCashierLandingPath()` → `/cashier/floor`). Cashier C2 added `lib/cashier/bill-resolution.ts` (fail-closed table→bill classifier + zero/one/multiple resolver), `lib/cashier/bill-query-keys.ts` (narrow read-domain keys), and extended `floor-route.ts` with `buildCashierBillQuery`/`clearCashierBillQuery` (`?tableId=&orderId=` model). |
| `lib/profile/` | Shared `profile-model.ts` (role accents, initials, datetime). |
| `lib/api/client.ts` | Shared API client (request IDs, bounded timeout, AbortController). |
| `lib/auth/` | `AuthProvider`, auth types. |
| `pages/` | Next.js Pages Router routes per role; legacy Orders pages are redirect-only. Cashier C1 added `pages/cashier/floor.tsx` (default landing) + `pages/cashier/index.tsx` (redirects `/cashier` → `/cashier/floor`); `pages/cashier/queue.tsx` + `receipts.tsx` remain as **hidden compatibility routes** (direct-URL only, off the visible nav — retire C4/C5); `till.tsx` + `me.tsx` unchanged. |
| `scripts/` | Static assertion scripts (`floor-assertions.ts`, `shell-assertions.ts`, `profile-assertions.ts`, `cashier-c1-assertions.ts` + tsconfig) with their own tsconfigs — structural guards, not Jest tests. |
| `public/` | Static assets. `favicon.svg` — the **brand favicon** (navy `#000033` rounded tile + white steering-wheel mark, 64 viewBox; replaced the interim "N"). `public/brand/` — **shipped** brand asset directory, extracted as true vectors from the brand PDF: logomark(-white).svg, wordmark(-white).svg, wordmark-stacked(-white).svg, combination-mark(-white).svg, combination-mark-stacked(-white).svg, favicon.svg + favicon-16/32/48.png, apple-touch-icon.png (180), icon-192/512.png + icon-512-maskable.png, og-image.png (1200×630), manifest.webmanifest. `_app.tsx` links the svg favicon + 32px PNG fallback, apple-touch-icon, manifest, and og:image. See `docs/BRAND_IDENTITY.md` §5. |

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
