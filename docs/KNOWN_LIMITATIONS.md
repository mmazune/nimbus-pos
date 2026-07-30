# KNOWN_LIMITATIONS.md — Nimbus POS (consolidated)

> Cross-role limitation index. Detailed registers:
> - Waiter: `ai/WAITER_MVP_KNOWN_LIMITATIONS.md`
> - Cashier: `ai/CASHIER_UI_KNOWN_LIMITATIONS.md`
> - Supervisor: `ai/SUPERVISOR_RECONSTRUCTION_GAP_REGISTER.md`
>
> These are honest, current constraints — do not hide them. Most are **backend
> contract gaps** or **deferred features**, not UI bugs.

## Waiter

| ID | Limitation |
| --- | --- |
| WKL-001 | Request-bill: backend accepts `NEW`; UI blocks until the order is sent. |
| WKL-002 | Unlinked employee accounts get no employee-bound self-service. |
| WKL-003 | Shift-swap create is read-only (no safe target-employee selector). |
| WKL-006 | Receipt send pending (no live email/SMS/WhatsApp adapter). |
| WKL-007 | Printer is metadata/audit only (no driver). |
| WKL-008 | Terminal pairing is a stub. |
| **WKL-010** | **Post-send item additions blocked** — backend lacks per-line sent state / idempotent send-additions contract. (Primary Waiter blocker.) |
| WKL-012 | Serving edits: `PATCH /orders/:id` doesn't accept `menuItemServingId`; serving read-only on edit. |
| WKL-013 | Local authenticated QA latency (warm Quick PIN ~3.8s; item detail can exceed 5s). |

## Cashier

| ID | Limitation |
| --- | --- |
| LIM-001/003 | Mobile money & card = manual/reference only (no live provider). |
| LIM-002 | PesaPal excluded. |
| LIM-004/005 | Printer + receipt delivery pending adapters. |
| LIM-006 | Paid-in/out/pickup deferred. |
| LIM-007 | Safe-drop idempotency backend-incomplete. |
| LIM-008 | Split bill = allocation metadata only. |
| LIM-009 | Split items creates a `NEW` child but **no KDS dispatch**. |
| LIM-010 | Transfer server deferred. |
| LIM-011 | Partial cash tender blocked. |
| LIM-012 | Manager approval / post-close void = boundary cards only. |
| LIM-018 | List rows not enriched until selected. |
| (resolved) | LIM-017 narrow-viewport overflow resolved 2026-07-18; startup requests ~101→~9. |

## Supervisor (reconstruction gap register — open items)

| ID | Limitation |
| --- | --- |
| ~~SUP-RG-004~~ | ~~Exception order lookup not yet Floor-contained~~ — **RESOLVED (Prompt 3B2):** compact **Find order** Floor control (no Orders tab). |
| SUP-RG-005/011/012 | Order + approval resolution actions read-only (not wired). |
| SUP-RG-007 | Reservations pile up (need Active/Today/Upcoming/Deposit/History split). |
| **SUP-RG-008/009** | **No verified reservation-completion endpoint and no `ReservationEventType.COMPLETED` enum** (needs backend contract + migration). |
| SUP-RG-013/014 | No pending-refund queue; no post-close void candidate queue. |
| SUP-RG-016 | Some cards fall back to raw IDs. |
| SUP-RG-017 | Supervisor formatters hardcode UGX (should reuse shared formatter). |
| SUP-RG-021 | Shift-swap create blocked (no selector). |
| SUP-RG-023 | Demo reservation data is dense (57 COMPLETED, 50 CONFIRMED, 8 PENDING, 5 SEATED). |
| **SUP-RG-031** | **Supervisor lacks `pos:order:transfer` on the active DB → Transfer table 403s at runtime** (Prompt 3C live QA). Seed-application gap, not a code defect — apply `db:seed` (idempotent) or insert the single authorised `role_permissions` row. |

## Supervisor order actions (Prompt 3A + 3B1 + 3B2 + 3B3A + 3B3B shipped — financial actions feature-complete)

- **3B3B added discount Approve/Reject + Complimentary.** Approve/Reject are inline on
  PENDING discount rows (`pos:discount:approve` gates both). Approve recalcs order totals
  (payment-gated); Reject requires a `rejectionReason` and leaves totals unchanged (not
  payment-gated). Complimentary is a whole-order 100% discount (`pos:discount:request`,
  Outcome B — `Discount.metadata` round-trips) with a category + reason; it is NOT a void
  or refund, is whole-order only (no backend line-level targeting), and may return PENDING
  above the org threshold. Approve/complimentary show a labelled estimate, never an
  optimistic final total (totals are backend-authoritative).
- **⚠️ Self-approval is backend-permitted (governance limitation):** the backend does not
  block a requester from approving their own discount (small ones are even auto-approved by
  the creator). The UI matches the backend and **flags** self-approval ("You requested
  this…") but does not invent a stricter rule. **Recommended:** a backend self-approval /
  maker-checker guard. See `docs/DECISIONS.md` D-SUP-3B3B.
- **Manager PIN on approve is optional** and re-auths the approver's own quick-PIN (not a
  separate manager gate); it is not required, so the UI does not collect it.


- Live now: **Request bill** (audit-only — session-scoped acknowledgment, resets on
  refresh; truthful, not a bug), **Mark served** (READY→SERVED), **Split bill /
  Split items / Move items / Merge** (Prompt 3B1, `pos:order:*`, BG3 idempotency),
  **Transfer table** (Prompt 3B2, `pos:order:transfer`, BG3 optional idempotency), and
  **Void** active order + **Discount** request (Prompt 3B3A, `pos:orders:void` /
  `pos:discount:request`, neither BG3-wrapped).
- **Active void is status-only:** the backend sets `status=VOIDED` (items/totals
  unchanged) and auto-releases an idle DINE_IN table. It is NOT a refund, complimentary,
  or post-close void. Reason required for IN_KITCHEN/READY (UI requires it always).
- **Discount basis = subtotal; approval is amount-based:** the backend auto-approves
  when the amount is within the org threshold (default 5000) else returns PENDING. The
  threshold is org-config and not fetched, so the UI shows an **estimate** and defers the
  final APPROVED/PENDING status + totals to the response (no optimistic total).
- **Payment safety gate is UI-only:** the void and discount endpoints do NOT themselves
  check payment state; the UI blocks both when money is present (settled/partially-paid/
  pending/failed/refunded) or payment state can't be confirmed. This is a documented
  frontend safeguard, not a backend guarantee.
- The Discounts panel is **read-only** — discount approve/reject stay in Approvals
  (Prompt 3B3B). Multiple pending discounts are backend-allowed but UI-blocked to
  prevent accidental duplicates.
- Split bill is **non-physical** — it records payable allocation groups on order
  metadata for the cashier; it does not create new orders and collects no payment.
- **Transfer table is a table-only move:** the backend sets `order.tableId` and does
  NOT validate target occupancy/reservation/capacity or change table status. The UI
  shows honest **non-blocking** occupied/reserved warnings; it cannot guarantee a
  conflict-free transfer (no frontend-only guarantee is asserted).
- **Find order** is bounded: `GET /pos/orders` has **no order-number / date-range /
  free-text search** and `:id` is id-only. The lookup is a bounded recent page +
  status/service filters + client text filter + exact-order-ID direct-read fallback.
  Payment state is omitted from result rows to avoid an N-row payment fan-out.
- **Out of Supervisor reconstruction scope** (Cashier-owned / separate terminal
  workflows): refund creation/approval, post-close void, payment collection, order
  close, transfer server (no safe selector). These remain unbuilt for Supervisor.
- **transfer-server** stays **UI-blocked** (Outcome B): no safe narrow, branch-scoped,
  operational-role server selector exists (only admin-gated tenancy memberships or a
  PII/payroll-leaking HR/workforce directory with nullable `userId`). ⚠️ Because
  `pos:order:transfer` is a single backend gate for BOTH transfers, the
  transfer-server **endpoint is now API-reachable** for Supervisor (audit-logged,
  active-same-branch-membership required) even though no UI exposes it. A future
  backend split into per-action permissions would let it be gated independently.
- **RBAC note:** Prompt 3B1 granted `pos:order:split/merge/move-items`; Prompt 3B2
  granted `pos:order:transfer` — both user-authorized seed-mapping changes (existing
  perm rows), not schema changes. Requires re-seed to apply.
- **RBAC note (3B3A):** no permission change — Supervisor already held `pos:orders:void`
  and `pos:discount:request`. `GET /pos/discounts/pending` (Approvals count) uses
  `pos:discount:approve`, which Supervisor also already holds.
- **Browser/viewport + live QA pending:** Prompt 3B1, 3B2, 3B3A, and 3B3B were validated
  via typecheck/lint/build/assertions; a consolidated authenticated live endpoint QA,
  `/api/health`, the Jest API suite, and browser + viewport QA for Prompts 3B1–3B3B have
  not been run (no API/DB/browser automation here).

## Resolved (Prompt 3A, 2026-07-27)

- **Supervisor idle-logout parity** (was SUP-RG-020): SupervisorShell now injects
  the shared `OperationalIdleLogoutHandler`; idle constants renamed to the shared
  `@/components/pos-shell/idle` namespace. All three roles share one idle mechanism.

## UI notes (documented, low-risk, not changed)

| Area | Finding | Why not changed |
| --- | --- | --- |
| Floor toolbar | Search (`min-w-[280px] basis-[360px]`) + floor-plan select (`min-w-[220px]`) in a `flex-wrap` row have large min-widths. | Wraps rather than overflowing; no confirmed defect. Watch at ≤1024px. |

**Fixed in the 2026-07-26 onboarding pass:** `OperationalTableCard` capacity footer
now matches its accessible label (was visible `"? seats"` vs. aria "seat capacity
unavailable").

## Infrastructure / environment

- Neon/local Prisma connection-pool pressure and cold-start latency (external, not
  a frontend deadlock). Quick PIN, catalog/detail, and some list reads can exceed
  targets on cold/noisy runs.
- Only one API process on `:3001`. Recommended boot: `nest build` then
  `node dist/main.js`.
- Recommended backend follow-ups: aggregate list-summary (payment/receipt)
  endpoints; reservation-completion contract.

## Reservation lifecycle (Prompt 4A, 2026-07-28)

- **Branch timezone not modelled** — reservation date/day/range query boundaries
  use **UTC** day edges, not branch-local time. Documented; a per-branch/org
  timezone is a future enhancement.
- **Order-close → reservation completion is an after-close reconciliation**, not a
  single DB transaction (the existing order-close path is not transactional). The
  order close stays canonical; a completion failure is **logged, not swallowed**,
  and leaves the reservation `SEATED` for manual completion. There is **no
  automatic retry** (a closed order cannot be re-closed), so a rare failure needs a
  manual `POST /reservations/:id/complete`.
- **Attention derivation is `overdue`-only in 4A.** Deeper linkage-inconsistency
  signals (e.g. "SEATED but its order is CLOSED") are surfaced via the included
  `seatedOrder.status` for Prompt 4B to render; the root cause is fixed going
  forward by auto-completion.
- **Existing stale reservations are not repaired** in this pass. A categorized,
  dry-run-first, approval-gated repair plan lives in
  `ai/SUPERVISOR_RESERVATION_SHARED_NEON_DATA_AUDIT.md`. No auto-NO_SHOW / no
  auto-complete of ambiguous records.
- **`ReservationEventType.COMPLETED` migration is authored but not deployed to
  shared Neon** in this pass (tested on a disposable branch); deployment step is
  documented separately.
- **Isolated Neon live QA pending** — the completion contract is unit-tested
  (67/67) but the disposable-branch API matrix / concurrency / query-plan / smoke
  runs were blocked pending Neon MCP auth completion.

## Deferred features (product-level, by design)

Full accounting, payroll admin, franchise, developer portal, owner SaaS billing,
PesaPal diner checkout, live MTN MoMo / Airtel Money diner payments, printer
drivers, terminal/acquirer traffic, MSR/badge login, smart spouts / pour telemetry
(late hardware wave M46).

---

## Supervisor Reservations UI (Prompt 4B) — known limitations (2026-07-28)

- **Shared-Neon completion gate:** the shared `production` branch enum
  `ReservationEventType` still lacks `COMPLETED` (migration
  `20260518000000_prompt4a_reservation_completed_event` unapplied — verified
  read-only via Neon MCP). Until it deploys, **manual "Mark visit complete" and
  automatic completion on order close error on shared Neon**; create/confirm/assign/
  seat/cancel/no-show and Attention/overdue all work there today. See
  `ai/SUPERVISOR_RESERVATIONS_SHARED_NEON_DEPLOYMENT_READINESS.md`.
- **Live QA outstanding:** authenticated browser QA across the four viewports,
  `/api/health`, and the disposable-Neon-branch mutation run were **not executed**
  (this background environment has no running API/web/browser stack). Static gates
  (web typecheck/lint/build, reservations+orders Jest 67/67, Playwright suite
  compiles as 72 tests × 4 viewports) and read-only Neon MCP verification passed;
  live execution is not fabricated.
- **Bounded active window:** Arriving/Seated/Attention derive from one bounded
  `scope=active` request (pageSize 50). If a branch ever exceeds 50 concurrent
  active reservations, an honest "showing first N of M active" banner is shown
  (no silent cap); the operational set is normally well within this bound.
- **Search is page-local:** search filters within the loaded, bounded page and is
  labelled as such (the backend exposes no cross-page reservation text search).
- **Timezone:** operational-day edges are UTC (branch timezone not modelled —
  inherited Prompt 4A limitation).
- **Stale shared records:** the 6 order-less SEATED + 55 overdue PENDING/CONFIRMED
  reservations from the Prompt 4A shared-data audit surface in Attention
  **individually**; no bulk repair is offered (a future explicit, approved
  data-repair operation).

---

## Supervisor Reservations — Prompt 4C shared-Neon cutover (2026-07-29)

- **RESOLVED (was a 4B limitation):** the `ReservationEventType.COMPLETED` migration is
  now deployed on shared Neon `production`, so **manual "Mark visit complete" and
  order-close auto-completion work on shared** (verified). Supervisor **Transfer table**
  also now works on shared (`pos:order:transfer` seeded).
- **Still outstanding:** live authenticated browser + four-viewport + live-API reservation
  matrix execution. The Prompt 4C isolated-API run could not be safely isolated in this
  environment — a shell/profile `DATABASE_URL` overrode the swapped `apps/api/.env`
  (`dotenv` won't override existing env), so the API hit production; one marked QA row was
  created and then deleted (production restored to 126). Closed at B; lifecycle proven by
  67/67 Jest + compiled Playwright (72 tests × 4 viewports).
- **Isolation procedure for the next live run:** unset the inherited `DATABASE_URL`, point
  BOTH `apps/api/.env` and `packages/db/.env` at the disposable branch, and verify
  isolation with a READ before any write.
- **Recovery branch** `br-dawn-truth-a4zjs1p7` (pre-migration snapshot) is retained until
  the user authorizes its removal.

---

## Supervisor Reservations — Prompt 4D isolated live QA (2026-07-29)

**RESOLVED (was the outstanding 4B/4C gate):** the live-API reservation mutation matrix and
the four-viewport Playwright suite were actually executed on a properly-isolated stack (a
disposable Neon branch for the API matrix; a local Docker Postgres for the browser suite).
Live matrix **53/53** (local, authoritative); shared Neon verified untouched. Fail-closed
isolation tooling now lives under `tools/qa/` (see `docs/TESTING_AND_QA.md`).

Remaining non-blocking limitations:

- **SUP-RG-034 (new):** concurrent *identical* reservation creates can return **500** (not a
  graceful 409) because `generateReservationNumber` is a read-increment against the
  `@@unique([branchId, reservationNumber])` constraint — under a true race the loser hits the
  unique violation. Non-blocking: the Create UI single-submit-guards; no normal path fires two
  identical concurrent creates. Backend hardening (retry / catch P2002 → 409) is recommended
  but out of scope (backend contract change). Surfaced by live QA.
- **Order-close AUTOMATIC completion** is proven by unit tests (67/67) and the 4C shared-Neon
  cutover; it was **not** re-driven end-to-end through the full live Cashier payment/close flow
  in 4D (order close is Cashier-owned `pos:orders:close`; Supervisor is 403 by design).
- **Playwright reservations suite** (first-ever execution in 4D) had first-run spec fragilities
  — loose selectors (strict-mode violations vs. a11y labels / hidden `<option>`s / toasts),
  hardcoded past times, and a page-local `openReservationByName` helper — several were fixed;
  residual dev-mode/single-worker timing + pagination assumptions can still flake individual
  specs. These are **test-harness** issues; the reservation UI itself is verified (create-dialog
  validation renders correctly; API matrix 53/53; Jest 67/67).
- **Disposable Neon branch latency** (EAT ↔ us-east-1, 0.25 CU) exceeds the app's 30s client
  abort under the reservations page's concurrent query fan-out, so the browser suite runs against
  a local Docker stack (documented canonical path), not the Neon branch. External latency, not a
  UI deadlock.
- **`next build`** (production) intermittently hits a Windows build-worker fault
  (`3221226505` during "Collecting page data"); `next dev` is used for browser QA. Not a code
  error ("Compiled successfully" passes).
- Existing **stale shared reservations** (order-less SEATED + overdue) still require individual
  Supervisor decisions — **no bulk resolution** (unchanged).
