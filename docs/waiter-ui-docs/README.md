# Waiter UI Docs

Status: **Canonical (waiter)** — the first in-repo canonical doc set for the Waiter role.
Date: 2026-08-20.

Waiter is the last operational role to get a `docs/<role>-ui-docs/` set. Until now the only
waiter documentation was the pre-implementation pack under
`Front End/waiter-ui-docs/waiter-ui-docs/`, and there was **no API matrix anywhere**. This
directory is the source of truth for the *implemented* waiter build; the pack is retained for
history.

---

## 1. Who the waiter is

The waiter is the **service-floor role**. They own the guest's table from the moment it is seated
until the bill is requested — and nothing after that. They work on a **shared POS terminal**,
desktop-first, logging in and out many times a shift, so the whole surface is built around fast
re-entry (Quick PIN), immediate table selection, and an idle logout.

The waiter is **table-centric, not order-centric**. They think "table 8", never "order 4471".
Every screen honours that.

Demo identity on the seeded stack: `waiter@nimbus.demo` — Brian Kisekka, role `Waiter` (L1),
`jobRole: WAITER`.

## 2. What the waiter sees

**Nav: Floor · Reservations · Me** (`apps/web/src/lib/waiter/routes.ts`, locked as D-NAV).
Default route `/waiter/floor`; `/waiter` redirects there.

### 2.1 Visual language (Nimbus rebrand, 2026-08-20)

Canonical source: `docs/BRAND_IDENTITY.md`. The waiter shell is **dark chrome around a light
workspace**:

- **Navy header** — `bg-brand-navy-950` (`#000024`, the deepest step of the navy ramp) with
  inverse text, a `brand-navy-800` (`#1E1E52`) time chip, and navy-800 hover states.
- **Navy bottom nav** — same `brand-navy-950` bar; the **active** tab inverts to a
  **white tile with navy-900 (`#000033`) content**, which is the shipped lockup pattern: never a
  navy mark on navy.
- **White / near-white page and cards** — the Floor grid, table cards, order builder, receipt
  drawer and Me panels all sit on light surfaces with subtle navy-tinted shadows (every
  `--shadow-*` token composes `rgba(0, 0, 51, …)`).
- **Silver `#B3B4AF`** is the quiet premium accent — dividers, disabled chrome, secondary
  surfaces. It is **never** used for text that must be read: silver-on-white fails AA.
- **Graphite `#6B6B6B`** carries secondary text and muted status.
- Focus rings and selection ink resolve to brand navy-900.

Do **not** reference the pre-Aug-2026 palette (`#0B1524`, `#101F34`, `#ACABA9`) anywhere in
waiter docs or UI; those values are superseded.

### 2.2 Floor (default)

The shared `OperationalFloor` — one presentation used by Waiter, Supervisor and Cashier
(D-FLOOR). A grid of `min-h-[9.5rem]` table cards (152px at 1920x1080, ~141px at 1440x900,
~128px at 1280x680 - the former fixed 176px was superseded by the owner-approved density pass,
2026-08-20, D-DENSITY) showing an abbreviated display label (full label in title/aria-label,
D-TABLELABEL), capacity, status, the assigned server as
`First L.` (never a guest name — D-PRIVACY), and a **Mine** badge on the waiter's own tables.
A readiness label ("Shift open" / "Shift not started") sits above the grid.

Selecting a card is **instant** and opens a full-screen table workspace over the Floor — there is
no page navigation, and the menu has already been prefetched. What opens depends on the card:
start a new order, resume the waiter's own order, view a reservation and seat it, or hit a
read-only ownership-blocked panel for another waiter's table.

### 2.3 Order builder (inside Floor, not a tab)

Manager-configured FOOD/DRINKS taxonomy → groups → subgroups → items; an item configurator for
serving, quantity, modifiers and a per-line note; a running order summary with UGX totals; and a
single **Send** action to the kitchen/bar. Below it, the **Bill** panel with *Request bill* and
*View bill or receipt*.

### 2.4 Reservations

Filters **Upcoming · Today · Seated · Late · All** over a bounded list, with a detail pane
(guest, party size, time, table, special requests, deposits — all read-only) and exactly one
action: **Seat guest**, which creates the linked dine-in order.

### 2.5 Me

Role hero, shift status card (start/end shift with an optional note), attendance clock toggle
with recent rows, leave requests with a submit form, read-only shift swaps, and logout. Panels
that need a linked employee record degrade to an honest capability notice rather than breaking.

## 3. What the waiter can and cannot do

### Can

- Log in by **Quick PIN** (primary) or email + password (fallback).
- Start and end their own shift; clock attendance; request leave; read their own shift swaps.
- Read the Floor: tables, active orders, reservation overlay.
- Start a dine-in order on an Available table; add, edit and remove lines (serving, quantity,
  modifiers, notes) before send.
- **Send** the order to kitchen/bar.
- **Request the bill** — an audit-only signal.
- View a bill/receipt preview and its audit history; reprint or record a send **once the order is
  closed or voided**.
- Read reservations and **seat** a guest, creating the linked order.

### Cannot — and why

| Not allowed | Enforced by |
| --- | --- |
| **Collect payment · close an order · operate the till** | D-BOUNDARY. Cashier-owned. No `pos:orders:close` grant (live **403**); no payment/close/till surface exists in the waiter UI. |
| **Void an order** | No `pos:orders:void` grant (live **403**). |
| **Mark in-kitchen / ready** | Backend `assertWaiterTransitionAllowed` — only `SENT` and `SERVED` are waiter-safe (live **403 `ORDER_TRANSITION_NOT_WAITER_SAFE`**). KDS owns kitchen state. |
| **Open or edit another waiter's order** | Backend `assertWaiterOrderOwnership` → **403 `ORDER_NOT_OWNED_BY_WAITER`** (verified live); the Floor renders a read-first blocked panel. |
| **Any service write while off shift** | Backend `assertWaiterShiftOpen` → **409 `SHIFT_NOT_OPEN`**; the UI pre-disables the actions and shows the shift banner. |
| **Create / confirm / cancel / no-show a reservation, handle deposits, assign tables** | Those permissions are **explicitly revoked** from the Waiter role in `packages/db/prisma/seed.ts` (live **403** on create and confirm). Seat only. |
| **Transfer table/server, move items, split, merge** | Removed from waiter scope (cashier/supervisor). |
| **Create a shift swap** | No UI — the permission exists but no safe target selector has been built. |
| **Reprint / send a receipt on an open order** | Backend `isPrintable` → **400** unless `CLOSED`/`VOIDED`; the UI pre-disables with the same rule. |

> ⚠️ **Known over-grant.** The seeded Waiter role still carries `pos:payment:create`,
> `pos:payment:intent`, `pos:payment:manual-reference`, `pos:refund:create`, `pos:till:open`,
> `pos:till:reconcile`, `pos:till:safe-drop` (verified in the live JWT). No waiter surface uses
> any of them, so D-BOUNDARY holds in the product — but the endpoints are reachable with a waiter
> token. Flagged in `WAITER_API_MATRIX.md` §7 (M5) for a deliberate decision.

## 4. Locked decisions affecting the waiter

From `docs/DECISIONS.md`:

- **D-NAV** — waiter nav is exactly Floor · Reservations · Me.
- **D-NOORDERS** — **no visible Orders tab.** Order work is reached from Floor after a table is
  selected. `/waiter/orders*` are legacy redirects into Floor.
- **D-FLOOR** — one shared `OperationalFloor` across Waiter, Supervisor and Cashier; role
  behaviour diverges only *after* table selection. Presentation is shared, data access is
  role-owned. The waiter Floor is the origin of that shared tree.
- **D-SHELL** — one shared `OperationalShell` / header / bottom nav / logout; waiter adapters are thin.
- **D-ICONS** — icons come from the canonical registry by name; never import Phosphor directly in
  waiter routes/screens.
- **D-TAXONOMY** — the browse taxonomy is manager-configured; the waiter menu never hard-codes
  fallback categories and shows an honest empty state instead.
- **D-CURRENCY** — UGX, zero-fraction, via the single shared waiter formatter.
- **D-BOUNDARY** — payment / close / till are cashier-owned; the waiter cannot collect payment or close.
- **D-PRIVACY** — Floor cards show staff as `First L.` and never show guest names.
- **D-PERF** — JWT carries roles/permissions; branch guard caches; API client has request ids and
  a bounded 30 s timeout. The waiter menu prefetch and background draft creation are part of this.

## 5. Doc index

### This directory (canonical, waiter)

| File | What it is |
| --- | --- |
| `README.md` | This file — who the waiter is, what they see, what they can/cannot do, decisions, index. |
| `WAITER_LIFECYCLE.md` | The current, code-grounded lifecycle: login → shift → floor → order → bill → receipts → reservations → me → idle logout, plus deltas from the pack draft. |
| `WAITER_API_MATRIX.md` | Every endpoint the waiter UI calls: purpose, controller, permission, request/response essentials, error modes, and **live verification status** (2026-08-20). Includes the defect/mismatch register. |

### The `Front End/waiter-ui-docs/waiter-ui-docs/` pack

| File | Status |
| --- | --- |
| `WAITER_LIFECYCLE.md` | **Historical / superseded** by `docs/waiter-ui-docs/WAITER_LIFECYCLE.md`. A 2026-06-16 pre-implementation draft; still the best record of intent and of the denied-action reasoning. |
| `waiterui.md` | **Supporting** — screen blueprint (layout, states, component inventory). Read alongside the lifecycle doc, not instead of it. |
| `waiter_design.md` | **Supporting** — waiter-specific design notes. Palette references predate the rebrand; defer to `docs/BRAND_IDENTITY.md`. |
| `DESIGN.md` | **Canonical (global design system)** — updated in place (v3, 2026-08-20) with the Aug 2026 brand values. Despite living in the waiter pack, this is the cross-role design system. |
| `README.md`, `AGENTS.md` | Supporting; pack-local orientation. `AGENTS.md` carries at least one stale component name. |

### Cross-role

| File | Waiter-relevant content |
| --- | --- |
| `docs/DECISIONS.md` | The locked decisions in §4. |
| `docs/ROLE_JOURNEYS.md` | §"Waiter" — the consolidated 8-step journey and the **Waiter → Cashier** handoff ("waiter builds/sends the order; cashier collects payment, issues receipts, and closes the till"). Its "Detailed sources" pointer for Waiter should now be this directory's `WAITER_LIFECYCLE.md`. |
| `docs/ROLE_CAPABILITY_MATRIX.md` | §"Waiter" — page × capability × endpoint × state, including the two Deferred rows (**WKL-010** add items after send; **WKL-012** edit serving on an existing line) and the Excluded row (collect payment / close). |
| `docs/BRAND_IDENTITY.md` | Canonical palette, type and logo — the source for §2.1. |
| `docs/UI_SYSTEM.md` | Component system the waiter screens consume. |
| `docs/DOCUMENT_INDEX.md` | Provenance and supersession for all of the above. |

## 6. Where the code lives

| Area | Path |
| --- | --- |
| API clients | `apps/web/src/lib/waiter/{floor,order,receipt,reservation,me}-api.ts` |
| View models / normalizers | `apps/web/src/lib/waiter/*-model.ts`, `formatters.ts` |
| Nav + readiness | `apps/web/src/lib/waiter/routes.ts`, `useActiveShift.ts` |
| Shell | `apps/web/src/components/waiter/shell/*` (over `components/pos-shell/*`) |
| Screens | `apps/web/src/components/waiter/{floor,orders,receipts,reservations,me}/*` |
| Pages | `apps/web/src/pages/waiter/*` (`orders/index` + `orders/new` are redirects) |
| Shared auth | `apps/web/src/lib/auth/{auth-api,AuthProvider,role}.ts(x)`, `lib/api/client.ts` |
| Backend waiter rules | `apps/api/src/common/auth/waiter-scope.ts`, `apps/api/src/modules/orders/orders.service.ts` |
| Role permissions | `packages/db/prisma/seed.ts` (`ROLE_PERM_MATRIX.Waiter`, `revokeStaleWaiterPermissions`) |

## 7. Open items

- **L1 / L2 (blocking, engineering):** on the isolated stack verified 2026-08-20,
  `POST /api/pos/orders/:id/items` and `GET /api/receipts/:id` both return **500** with
  `[DecimalError] Invalid argument` from the compiled money paths. Adding an item to an order —
  the core waiter action — does not work there. See `WAITER_API_MATRIX.md` §7.
- **WKL-010** — items cannot be added after send (no per-line sent state).
- **WKL-012** — serving cannot be changed on an existing line (`UpdateOrderItemDto` has no
  `menuItemServingId`).
- **Dead surfaces** — `WaiterOrdersQueueScreen` and `WaiterNewOrderScreen` are exported but not
  mounted by any page; either retire them or document them as intentionally retained.
- **Service area** — the waiter header renders a hard-coded "Service area unavailable"; no API
  resolves it.
- **Me self-service branch alignment** — the demo waiter's `Employee` row sits in a different
  branch from the operating branch, so seeded attendance/leave/swap history reads empty.
- **Receipt ownership** — `GET /api/receipts/:id` is branch-scoped but not waiter-ownership-scoped,
  unlike `GET /api/pos/orders/:id`.
