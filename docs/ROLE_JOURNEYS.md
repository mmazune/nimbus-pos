# ROLE_JOURNEYS.md — Nimbus POS operational role journeys

> **Supervisor final closure (2026-07-31):** the full Supervisor journey below (Floor →
> Reservations → Approvals → Me) was walked end-to-end live in the final integrated QA pass,
> across all four viewports, plus Waiter/Cashier cross-role regression. See
> `ai/SUPERVISOR_RECONSTRUCTION_FINAL_COMPLETION_REPORT.md` and
> `ai/SUPERVISOR_FINAL_DEMO_SCRIPT.md` for the canonical walkthrough.

> **Prompt 5B2 (2026-07-31) — Approvals closed:** the journey now decides all four domains — plus
> Discount + Leave, the Supervisor **acknowledges/resolves Anomalies** in place (acknowledge keeps the
> row actionable; resolve requires a note). **Shift-swap** offers **Reject only** with an honest notice
> that schedule reassignment isn't available here (Outcome C, SUP-RG-042).
>
> **Prompt 5B1 (2026-07-30):** the Supervisor **Approvals** journey is now a premium decision
> workspace: land on **Needs action** (All), scan identity-safe queue rows with live counts, open a
> request in the master-detail panel, and **decide Discounts + Leave** in place (Shift-swap + Anomaly
> are read-only until Prompt 5B2). Resolved + History review terminal decisions (leave/swap/anomaly;
> discounts stay order-scoped, SUP-RG-035). All queue state is URL-persisted.
>
> **Prompt 5A (2026-07-30):** the Supervisor **Approvals** journey now has a verified backend
> foundation — the four decision lifecycles (discount/leave/shift-swap/anomaly) are hardened
> (branch isolation, concurrency-safe, bounded queues) and exposed via canonical domain endpoints;
> `Needs action`/`Resolved`/`History` are UI groupings over real statuses. The premium Approvals
> workspace UI is Prompt 5B. See `supervisor-ui-docs/SUPERVISOR_APPROVAL_LIFECYCLE.md`.

> Index of the operational role lifecycles and cross-role handoffs. Detailed
> state machines live in the per-role lifecycle docs (linked below); this file is
> the current, consolidated summary that matches the shipped code.

## Detailed sources

- **Waiter:** `Front End/waiter-ui-docs/waiter-ui-docs/WAITER_LIFECYCLE.md`
- **Cashier:** `Front End/cashier_ui_docs_pack/docs/cashier-ui-docs/CASHIER_LIFECYCLE.md`
- **Supervisor:** `docs/supervisor-ui-docs/SUPERVISOR_LIFECYCLE.md`
  (+ `SUPERVISOR_RESERVATION_LIFECYCLE.md`, `SUPERVISOR_APPROVAL_LIFECYCLE.md`)

## Waiter

**Nav: Floor · Reservations · Me.** Table-centric.

1. **Login** (password or per-branch Quick PIN) → Waiter shell.
2. **Floor** — shared `OperationalFloor`. Tables show status + assigned staff
   (`First L.`) + "Mine". Selecting a table is **instant** and opens a full-screen
   menu/order workspace inside the workspace frame (no separate Orders tab).
3. **Order entry** — browse manager-configured FOOD/DRINKS taxonomy, configure
   items (servings/modifiers), build the order summary with UGX totals, send.
4. **Ownership** — a table owned by another waiter shows an ownership-blocked panel
   (read-first), not an editable order.
5. **Receipts / bill** — request bill / preview receipt (send adapters pending).
6. **Reservations** — view and seat guests.
7. **Me** — shared profile (shift status, self-service, capability notices).
8. **Logout** — shared logout; idle-logout handler active.

Blocked: **post-send item additions** (backend lacks per-line sent state — WKL-010).

## Cashier

**Nav: Floor · Till · Me.** Payment-owning role. **Floor-first (Prompt C1+C2 implemented
2026-07-31):** default route `/cashier/floor`, Cashier is the third shared-`OperationalFloor`
consumer (as Waiter/Supervisor below), and `/cashier` redirects to `/cashier/floor`.

1. **Login / landing** → `/cashier/floor` (`getCashierLandingPath()` returns `/cashier/floor`).
2. **Floor** — the **same** shared `OperationalFloor` as Waiter/Supervisor (same toolbar/search/
   status filters/floor selector/grid/cards). It reads only shared-safe data (tables + active
   orders + reservations via one bounded query domain); cards show **no** guest name/contact/
   payment/receipt reference. Selecting a physical table sets canonical URL state
   `/cashier/floor?tableId=<id>` (refresh/Back/Forward restore it; invalid/cross-branch ids fail
   safe with a "Table unavailable" state).
3. **Selected table (C2 resolution + read-only settlement)** — one bounded
   `GET /pos/orders?tableId=` query is classified (fail-closed) into **zero** (truthful "No bill is
   available for this table." + read-only closed-bill list), **one** (auto-resolve, URL gains
   `orderId`, no selector), or **multiple** (explicit `CashierBillSelector`, never a silent
   first-pick). A selected bill opens ONE **read-only** `CashierSettlementWorkspace`
   (Bill/Totals/Payment state/Settlement readiness/History, reusing the checkout primitives) with
   **no** payment/close/split/refund/receipt/void/discount/transfer action (payment/close
   **execution** arrives C3). A Cashier-only **Find bill** sibling above the shared Floor opens
   tableless/takeaway/exact-id bills into the same workspace via `?orderId=` (receipt-reference
   search deferred to C4). Canonical URL state is `?tableId=&orderId=` (or `?orderId=` tableless),
   refresh/Back/Forward safe.
4. **Till** — open/close, safe-drop (idempotency backend-incomplete); paid-in/out deferred.
   **Unchanged and unregressed by C1.**
5. **Me** — shared profile. **Unchanged by C1.**
6. **Logout** — shared logout; idle-logout handler active.

**Legacy compatibility routes:** `/cashier/queue` and `/cashier/receipts` are **not deleted and
not redirected** in C1/C2 — they remain reachable only by direct URL (removed from visible nav),
preserving the historically-complete Queue-first payment/split/receipt logic (reused, not
rewritten) until retirement (Receipts C4, Queue C5). The pre-reconstruction Queue-first journey
is documented in `ai/CASHIER_UI_*`; the canonical target journey is
`docs/cashier-ui-docs/CASHIER_LIFECYCLE.md`. See
`ai/CASHIER_FLOOR_RECONSTRUCTION_C1_SHARED_FLOOR_COMPLETION_REPORT.md`.

## Supervisor

**Nav: Floor · Reservations · Approvals · Me.** Read-first oversight. **No Orders tab.**

1. **Login** → Supervisor shell (shared idle-logout parity active as of Prompt 3A —
   same 15-min timeout as Waiter/Cashier).
2. **Floor** — the **same** shared `OperationalFloor` as Waiter (identical default
   presentation). Selecting a table opens a **read-first** table-control workspace
   showing order, reservation, bill, payment, and table context. Live mutations:
   the verified **table-status** change (Review/Confirm) and, as of Prompt 3A, two
   safe order-service exceptions — **Request bill** (audit-only; notifies the
   cashier) and **Mark served** (READY→SERVED, explicit confirmation, optional
   reason). Both require `pos:orders:write` and are hidden without it. Payment
   collection/close stays in Cashier.
3. **Legacy Orders** — `/supervisor/orders` redirects into Floor, resolving any
   `orderId` → its `tableId`. No visible/hidden Orders nav item.
4. **Reservations** — view (Active/Today/Upcoming split is a future improvement).
5. **Approvals** — domain-specific approval queues (not the global `/api/approvals`).
   Currently read-first; resolution actions are Prompt 3+.
6. **Me** — shared profile.

Live as of **Prompt 3B1** (Split & combine group, all `pos:order:*`, hidden without
the permission): **Split bill** (EQUAL/CUSTOM allocation for the cashier — non-
physical, no payment collected), **Split items** (moves items to a new NEW child
order), **Move items** (to another open order via a bounded target selector), and
**Merge orders** (voids the source into a surviving target, then the workspace
navigates to the survivor). All confirm intent and use BG3 idempotency keys.

Live as of **Prompt 3B2** (`pos:order:transfer`, hidden without it): **Transfer
table** — re-anchors the order to another table via a bounded branch-scoped target
selector (reuses the Floor query, excludes the current table, shows honest
non-blocking occupied/reserved warnings), confirms intent, reassigns the source and
target Floor caches, and re-anchors the URL to the returned table (`orderId`
preserved, refresh-stable). The backend only sets `tableId` — it does not validate
target occupancy/capacity or change table status. Prompt 3B2 also adds **Find order**,
a compact Supervisor-only control rendered **above** the shared Floor grid (not an
Orders tab): a focused dialog over one bounded/paginated branch page (page size 25)
with status/service/text filters and an exact order-ID (`GET /pos/orders/:id`)
fallback, used to open takeaway/tableless/closed/voided/exception orders in the
canonical workspace. Tableless orders open with `orderId` only (no fabricated table);
terminal (closed/voided) orders open read-only (handoff/service actions
disabled-with-reason). There is **no** order-number, date-range, or free-text search
(the backend has none). Still no Orders tab.

Live as of **Prompt 3B3A** (new **Adjustments** group; no permission/backend change —
Supervisor already held the grants): **Void active order** (`POST /pos/orders/:id/void`,
`pos:orders:void`; shared danger confirmation, reason required; valid for NEW/SENT/
IN_KITCHEN/READY; SERVED can only close, CLOSED/VOIDED rejected; backend sets
`status=VOIDED` only and auto-releases an idle DINE_IN table — it does **not** touch
reservation or payments, and void is **not** a refund, complimentary, or post-close
void) and **Discount request** (`POST /pos/orders/:id/discounts`, `pos:discount:request`;
PERCENTAGE/FIXED on basis = order **subtotal** (pre-tax); the backend auto-approves
within `OrgSettings.discountApprovalThreshold` (default 5000, org-config, not fetched by
the UI) and returns APPROVED else PENDING, so the UI shows a labelled **estimate** and
defers the final status + totals to the response; SERVED is not discountable; a second
request is blocked while one is PENDING). Both actions are **payment-gated in the UI
only**: the central availability module blocks them when payment state indicates money
or cannot be confirmed (loading/errored) — a frontend safeguard, not a backend
guarantee. A read-only **Discounts** panel lists each discount's type/value/status/
reason/requester/reviewer (`GET /pos/orders/:id/discounts`, `pos:discount:read`) with no
approve/reject controls.

Live as of **Prompt 3B3B** (no permission/backend change — Supervisor already held
`pos:discount:approve`/`pos:discount:request`; `seed.ts` unchanged): **inline
Approve/Reject on PENDING discount rows** in the read-only Discounts panel (shown only
when the reviewer holds `pos:discount:approve` and order-level availability permits) and
**Complimentary** in the Adjustments group. **Approve** (`POST /pos/discounts/:id/approve`,
HTTP 200, PENDING-only) recalcs order totals (latest approved wins) and is therefore
**payment-gated** in the UI; **Reject** (`POST /pos/discounts/:id/reject`, HTTP 200)
requires a `rejectionReason`, leaves totals unchanged, and is **not** payment-gated.
**Complimentary** is Outcome B — since no comp `DiscountType` exists it is a whole-order
`PERCENTAGE value=100` discount request plus `metadata { complimentary:true, category }`
and a required reason (constrained category list); it is whole-order only, may return
PENDING above the org threshold (default 5000, which decides PENDING vs APPROVED — not a
permission), is payment-gated, and shows a labelled estimate (no optimistic zero total).
The backend **permits a requester to approve their own discount** — the UI matches the
backend (it does not invent a stricter block) but surfaces a truthful self-approval note;
a backend maker-checker guard is a recommended future control. All three paths invalidate
only the discount approvals domain (and the Approvals discount count); the Approvals
**page** keeps its existing read-only layout. Supervisor order-workspace financial actions
are now feature-complete for the reconstruction scope. Still no Orders tab; payment stays
read-only.

Deferred / out of scope for Supervisor: refunds, post-close void, payment collection,
order close. **transfer-server** stays deferred (Outcome B) and UI-hidden until a safe
narrow server selector exists — note that `pos:order:transfer` gates both transfer-table
and transfer-server, so the transfer-server endpoint is API-reachable even though no UI
exposes it.

### Supervisor Reservations — Prompt 4B (2026-07-28)

The old read-only Reservations page (a triple all/today/upcoming fetch merged in
the browser) is replaced by a **premium master-detail workspace** built on the
Prompt 4A active/history scope contracts. It uses four UI **views** (groupings, not
new persisted statuses):

- **Arriving / Seated / Attention** derive from **one** bounded `scope=active`
  query (no triple fetch, no browser merge; page size 50).
- **History** is a separate, lazy, server-paginated `scope=history` query (backend
  default page 25 / max 100). Default view = **Arriving**, current operational date,
  page 1. No all-history initial fetch.
- **URL-persisted state:** view, date, page, status, from, to, and the selected
  reservation id — Back/Forward/refresh stable.

Lifecycle actions (Supervisor already holds every permission — **no permission and
no backend change**) mirror the backend `VALID_TRANSITIONS` exactly:

- **Create** — `POST /api/reservations` (`pos:reservation:create`).
- **Confirm** — PENDING→CONFIRMED (`pos:reservation:confirm`).
- **Assign/Change table** — PENDING/CONFIRMED/SEATED (`pos:reservation:table:assign`).
- **Seat** — CONFIRMED→SEATED, table required (`pos:reservation:seat`).
- **Cancel** — active→CANCELLED, reason required (`pos:reservation:cancel`).
- **No-show** — PENDING/CONFIRMED→NO_SHOW (`pos:reservation:no-show`); **never**
  offered for SEATED and never automatic.
- **Manual complete** — SEATED→COMPLETED (`pos:reservation:update`).

Terminal reservations render read-only (no active actions). The **Attention** view
derives overdue from the server `overdue`/`overdueByMinutes` (grace 15 min,
PENDING/CONFIRMED only) plus structural SEATED inconsistencies (seated-without-linked-
order, linked-order-closed, seated-without-table), with operational copy only and
**individual actions only** (no bulk resolution). Automatic completion (order close →
linked SEATED reservation COMPLETED) is presented truthfully; the Reservations page
never issues that mutation. **Deposit boundary:** the create form accepts an optional
`depositRequired` amount and deposits show read-only in the workspace — **no payment
collection or deposit capture**. Guest **contact** detail (phone/email) appears only in
the selected workspace / create form; list rows show the guest name only.

**Known limitation:** the shared Neon `production` branch still lacks the
`ReservationEventType.COMPLETED` enum (migration `20260518000000` unapplied), so
manual complete + auto-completion-on-order-close **error on shared Neon** until it is
deployed; every other action (create/confirm/assign/seat/cancel/no-show) and
Attention/overdue **work on shared today** (classification: COMPLETE WITH KNOWN
LIMITATIONS). **→ Resolved in Prompt 4C (below).**

### Supervisor Reservations — Prompt 4C (2026-07-29, shared-Neon cutover)

The Supervisor reservations journey is now **fully operable on shared Neon**. Under
explicit user authorization, migration `20260518000000_prompt4a_reservation_completed_event`
was deployed to the shared `production` branch (`db:migrate:deploy`), adding
`ReservationEventType.COMPLETED` — so **manual complete** (SEATED→COMPLETED) and
**automatic completion on order close** now persist correctly on the shared demo
database, closing the Prompt 4B limitation above. The same pass ran an idempotent
`db:seed` that granted Supervisor the `pos:order:transfer` mapping (+1 role_permission),
making **Transfer table** (Prompt 3B2) functional on shared Neon too. Reservation data
is unchanged (126 rows); a pre-migration recovery branch is retained. Classification:
**COMPLETE WITH KNOWN LIMITATIONS / DEMO-READY** — the live authenticated browser +
4-viewport run against a properly-isolated stack remains the outstanding QA gate (the
lifecycle is otherwise proven by 67/67 Jest tests + the compiled Playwright suite).

## Role boundaries & handoffs

- **Waiter → Cashier:** waiter builds/sends the order; **cashier** collects payment,
  issues receipts, and closes the till. Waiter cannot collect payment or close.
- **Supervisor** oversees Floor/reservations/approvals and may **read** order and
  payment state; it never collects payment, enters the menu, drives KDS, or issues
  receipts.
- **Floor parity:** Waiter, Supervisor, and Cashier (Prompt C1) share one Floor
  presentation; behaviour diverges only **after** table selection.
