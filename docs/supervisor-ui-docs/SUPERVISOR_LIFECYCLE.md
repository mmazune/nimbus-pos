# Supervisor Lifecycle

> **Verified 2026-08-20 — no stale claims found in this document; two confirmations.**
> (1) **Idle logout — this doc is CORRECT.** "Supervisor sessions share the operational
> idle-logout mechanism" (Prompt 3A note below) matches the code:
> `components/supervisor/shell/SupervisorShell.tsx` passes
> `idleHandler={<OperationalIdleLogoutHandler />}` to `OperationalShell`, and the handler reads
> `OPERATIONAL_IDLE_TIMEOUT_MS` (15 min) from the shared `components/pos-shell/idle.ts`.
> `docs/UI_SYSTEM.md` §9 claimed the opposite ("Supervisor shell omits the idle-logout handler");
> **that claim was the stale one and has been struck through with a dated correction** — code wins.
> (2) **Aug-2026 rebrand is presentation-only for this document:** palette → navy `#000033` /
> light grey `#B3B4AF` / dark grey `#6B6B6B`, and the steering-wheel logomark is live in the
> header and login (`docs/BRAND_IDENTITY.md`). **No lifecycle, state machine, invalidation rule,
> endpoint, or permission in this document is affected.**

Status: Prompt 5B2 — Approvals CLOSED (Discount + Leave + Anomaly actionable; Shift-swap reject-only Outcome C); Prompt 3B3B order-workspace financial actions feature-complete

> **Prompt 5B2 (2026-07-31):** Anomaly Acknowledge/Resolve are live; Shift-swap is Reject-only
> (Outcome C — no roster-mutation service exists, so no truthful Approve; SUP-RG-042). All four
> approval domains are integrated. Supervisor Approvals is closed at B / demo-ready.
>
> **Prompt 5B1 (2026-07-30):** Approvals is now a premium master-detail decision workspace. Discount
> approve/reject (payment-gated, self-approval-flagged) and Leave approve/reject (org-scoped, no
> payroll/roster claim) are live via their canonical domain endpoints; terminal records are read-only.
> Shift-swap + Anomaly render read-only until Prompt 5B2.
Date: 2026-07-18 (updated 2026-07-30)

> **Prompt 5A (2026-07-30).** The four Approvals decision lifecycles are verified live and hardened
> (branch isolation on shift-swap approve + anomaly ack/resolve; leave org-scoped; concurrency-safe
> conditional claims → duplicate/raced = 409/400; bounded pagination; History date filters; anomaly
> `actorUser` identity include). Domain-specific endpoints only (no generic `/api/approvals/:id/decide`).
> The Approvals page stays read-only until the Prompt 5B UI. Details in `SUPERVISOR_APPROVAL_LIFECYCLE.md`.

> **Prompt 3A (2026-07-27).** The Floor table-control workspace offers two live
> service actions behind table selection — **Request bill** (audit-only,
> duplicate-safe) and **Mark served** (READY→SERVED, explicit confirmation) — both
> `pos:orders:write` and hidden without it. Payment remains read-only. Supervisor
> sessions share the operational idle-logout mechanism.
>
> **Prompt 3B1 (2026-07-27).** Added the Split & combine actions in the same
> workspace: **Split bill** (non-physical payable allocation for the cashier),
> **Split items** (→ new NEW child order), **Move items** (→ existing open order),
> and **Merge** (source → VOIDED into a surviving target). All require `pos:order:*`
> (granted to Supervisor via seed mapping), confirm intent, and use BG3 idempotency.
>
> **Prompt 3B2 (2026-07-28).** Added **Transfer table** in the same workspace
> (`pos:order:transfer`, granted to Supervisor via seed mapping): a bounded
> branch-scoped target selector (reuses the Floor query, excludes the current table,
> shows honest non-blocking occupied/reserved warnings), confirmed intent, BG3
> optional idempotency, source+target Floor cache reassignment, and a post-transfer
> URL re-anchor to the returned table (`orderId` preserved, refresh-stable). The
> backend only sets `order.tableId` — no occupancy/capacity validation, no
> table-status change. Also added **Find order**, a Supervisor-only compact control
> rendered above the shared Floor (not an Orders tab): a focused dialog over one
> bounded/paginated branch page (page size 25) with status/service/text filters and
> an exact order-ID fallback (`GET /api/pos/orders/:id`), opening takeaway/tableless/
> closed/voided/exception orders in the canonical workspace. Tableless orders open
> with `orderId` only (no fabricated table); terminal (closed/voided) orders are
> read-only (handoff/service actions disabled-with-reason). No order-number,
> date-range, or free-text search — the backend has none.
>
> **Prompt 3B3A (2026-07-28).** Added an **Adjustments** group in the same workspace
> (no permission/backend change — Supervisor already held the grants; `seed.ts`
> unchanged): **Void active order** (`POST /api/pos/orders/:id/void`, `pos:orders:void`,
> HTTP 200, not BG3; shared danger confirm with a required reason; valid for NEW/SENT/
> IN_KITCHEN/READY, SERVED→409, CLOSED/VOIDED rejected; backend sets `status=VOIDED`
> only and auto-releases an idle DINE_IN table — no reservation/payment change; on
> success the order-detail merges to VOIDED, the source Floor card frees, and the
> workspace stays on the read-only voided order) and **Discount request**
> (`POST /api/pos/orders/:id/discounts`, `pos:discount:request`, HTTP 201, not BG3;
> PERCENTAGE/FIXED on basis = order **subtotal**; backend amount-based auto-approval
> within `OrgSettings.discountApprovalThreshold` (default 5000, not fetched by the UI)
> → APPROVED else PENDING, so the UI shows a labelled **estimate** and defers the final
> status/totals to the response; SERVED not discountable; a 2nd request is blocked while
> one is PENDING). A read-only **Discounts** panel lists history
> (`GET .../discounts`, `pos:discount:read`) with no approve/reject controls. Both
> actions are **payment-gated in the UI only** (the availability module blocks them when
> payment indicates money or can't be confirmed — a frontend safeguard, not a backend
> guarantee). Void ≠ refund/complimentary/post-close void (different endpoints). Remaining
> high-impact actions (discount approve/reject, complimentary, refunds, post-close void)
> stay deferred to Prompt 3B3B; **transfer-server** stays deferred (Outcome B) and
> UI-hidden — no safe server selector, and the single `pos:order:transfer` permission
> also makes the transfer-server endpoint API-reachable. Live/browser QA remains PENDING.
>
> **Prompt 3B3B (2026-07-28).** Added discount **decisions** and **complimentary** in the
> same workspace (no permission/backend change — Supervisor already held
> `pos:discount:approve`/`pos:discount:request`; `seed.ts` unchanged). PENDING discount rows
> in the read-only Discounts panel now carry **inline Approve/Reject** (shown only with
> `pos:discount:approve` and when order-level availability permits; APPROVED/REJECTED rows
> stay terminal read-only): **Approve** (`POST /api/pos/discounts/:id/approve`, HTTP 200, not
> BG3) is PENDING-only (else 409, order must stay discountable), **recalcs order totals**
> (latest approved wins) and is therefore **payment-gated** in the UI — its optional
> `{ managerPin? (<=8) }` re-auths the approver's **own** quick-PIN (sets `managerPinVerified`)
> and the UI does not collect it; **Reject** (`POST /api/pos/discounts/:id/reject`, HTTP 200)
> requires `{ rejectionReason (<=500) }`, leaves totals unchanged and is **not** payment-gated.
> Both return a bare Discount, so the UI re-fetches order + discounts for canonical totals and
> approver identity. **Complimentary** (Adjustments group, `pos:discount:request`) is
> **Outcome B**: no comp `DiscountType` exists, so it is a **whole-order**
> `PERCENTAGE value=100` discount request + `metadata { complimentary:true, category }` + a
> required reason (constrained category list); whole-order only (no line targeting); it may
> return PENDING above the org threshold (default 5000, which decides PENDING vs APPROVED —
> not a permission); it is payment-gated, shows a labelled estimate (no optimistic zero
> total), and is **not** a void or refund. The backend **permits a requester to approve their
> own discount** — the UI matches the backend (it does not invent a stricter block) but
> surfaces a truthful self-approval note; a backend maker-checker guard is a recommended
> future control. All three paths use **narrow invalidation** (order-discounts + order-detail
> and Floor for approve/complimentary + the Approvals discount-count/detail keys) and never
> touch leave/shift-swap/anomaly/reservation/profile/auth/shift; the Approvals **page** keeps
> its read-only layout. Supervisor order-workspace financial actions are now
> **feature-complete** for the reconstruction scope (out of scope: transfer-server, refund,
> post-close void, payment collection, order close). Live/browser QA remains PENDING.

> **Prompt 4B (2026-07-28) — Reservations page reconstruction.** The old read-only
> Reservations page (triple all/today/upcoming fetch + browser merge, pageSize 100) is
> replaced by a **master-detail workspace** on the Prompt 4A scope contracts. Four UI
> **views** (groupings, **not** new statuses): **Arriving / Seated / Attention** from
> **one** bounded `GET /api/reservations?scope=active` (page size 50) and **History**
> from a lazy `GET /api/reservations?scope=history` (backend default 25 / max 100).
> Default = Arriving, current operational date, page 1. URL-persisted state (view, date,
> page, status, from, to, selected id) is Back/Forward/refresh stable. Lifecycle actions
> wired to already-verified endpoints (Supervisor **already holds** every permission —
> **no permission/backend change**): **Create** (`pos:reservation:create`), **Confirm**
> (`pos:reservation:confirm`), **Assign/Change table** (`pos:reservation:table:assign`),
> **Seat** (`pos:reservation:seat`), **Cancel** (`pos:reservation:cancel`), **No-show**
> (`pos:reservation:no-show`; **never** offered for SEATED, never automatic), and
> **Manual complete** (`pos:reservation:update`). Availability mirrors backend
> `VALID_TRANSITIONS`; terminal rows read-only. **Attention** derives overdue from server
> `overdue`/`overdueByMinutes` (grace 15 min, PENDING/CONFIRMED only) + structural SEATED
> inconsistencies, with operational copy and **individual actions only** (no bulk
> resolution). Deposits are **read-only**; the create form accepts an optional
> `depositRequired` amount only (**no** payment/deposit capture). Guest **contact** shows
> only in the workspace/create form; list rows show name only. Cross-role invalidation is
> narrow (Supervisor active/history/detail/events + Supervisor Floor overlay + Waiter
> reservations/floor; **never** menu/profile/auth/shift/approvals/all-orders/cashier).
> Classification **COMPLETE WITH KNOWN LIMITATIONS**: the shared Neon `production` branch
> still lacks `ReservationEventType.COMPLETED` (migration `20260518000000` unapplied), so
> manual complete + auto-completion-on-order-close **error on shared Neon** until
> deployed; all other actions work on shared today. Live browser + 4-viewport execution
> remains the outstanding QA gate.

## Role Thesis

Supervisor is the operational exception controller for the floor. The role sees Floor, Reservations, Approvals, and Me. It does not get a visible Orders tab, a Cashier checkout surface, or a Manager/admin back office.

## Primary Loop

1. Supervisor opens Floor.
2. Floor uses the shared operational table grid.
3. Supervisor selects a table.
4. The table workspace shows table/service state, active order lines and totals, bill state, read-only payment state, reservation context, and operational attention.
5. The previously verified table-status change is the only live Floor mutation. High-impact order resolution remains deferred.

## Secondary Loops

| Loop | Entry | Exit |
|---|---|---|
| Reservation lifecycle | Reservations nav or Floor table reservation handoff | Active row moves to next status or History. |
| Approval lifecycle | Approvals nav | Decision moves row to terminal state or next anomaly state. |
| Me/session | Me nav | Shift/profile/workforce state updated or sign out. |
| Tableless order lookup | Floor exception lookup | Order opened in workspace, not persistent nav. |

## Navigation Contract

Visible tabs:

- Floor
- Reservations
- Approvals
- Me

Internal/deep-link-only compatibility:

- `/supervisor/orders` redirects to `/supervisor/floor` and must not appear in bottom nav.
- `tableId` is preserved directly.
- `orderId` is resolved through the existing order-detail read when its table is available; otherwise the order reference is preserved as truthful Floor lookup context.
- No mutation occurs during compatibility routing. Prompt 2 resolves linked table/order context into the Floor workspace; final tableless lookup and high-impact exception actions remain Prompt 3.

## Prompt 2 Selection Lifecycle

Table selection updates local selected state and shallow URL context immediately. `tableId` and optional `orderId` survive refresh; browser Back closes the workspace and Forward restores it. Closing returns focus to the selected card. Cached Floor context renders first while table/order/payment/reservation detail reads stay localized. A known table from a legacy route is not labelled tableless while Floor data is still resolving.

## Shared Shell Lifecycle

Waiter, Cashier, and Supervisor now share one header, clock, identity/logout placement, bottom-navigation presentation, fixed offsets, and responsive width behavior. Supervisor guards and readiness remain authoritative role adapters; the shared shell performs no API query, permission decision, or operational mutation.

## Lifecycle Invalidation Map

| Action | Invalidate |
|---|---|
| Table status update | Supervisor floor, tables, availability, selected table. |
| Order split/merge/move/transfer | Supervisor floor, order detail, order lookup, table detail, payments/refunds/discounts as relevant. |
| Order void/mark-served/request-bill | Supervisor floor, order detail, table detail. |
| Discount request (Prompt 3B3A) | Order detail + order discounts + (when APPROVED) Supervisor floor + the Approvals discount-count key `["supervisor","approvals","discounts",branchId]`. Never touches leave/shift-swap/anomaly/reservation/profile/auth/shift; Approvals UI stays read-only. |
| Discount approve/reject + complimentary (Prompt 3B3B) | Order discounts + order detail (approve/complimentary only) + Supervisor floor (approve/complimentary only) + the Approvals discount-count key `["supervisor","approvals","discounts",branchId]` + `["supervisor","approval-detail","discount",branchId,id]`. Reject touches only order-discounts + the approvals keys (no total change). Never touches leave/shift-swap/anomaly/reservation/profile/auth/shift; Approvals page stays read-only. |
| Reservation confirm/assign/seat/cancel/no-show | Reservations, reservation detail/events/deposits, Floor, selected table, order lookup if seating creates an order. |
| Approval decision | Approvals domain queue, selected detail, affected order/workforce/anomaly context. |
| Punch/shift/leave | Me, readiness, attendance/leave/shift-swap lists. |

## Non-Negotiables

- No fake rows.
- No frontend-only state transitions.
- No weakened guards.
- No hidden Cashier checkout inside Supervisor.
- No global approvals calls.
- No Postman skip if API/action contracts change.
