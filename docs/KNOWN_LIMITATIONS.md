# KNOWN_LIMITATIONS.md — Nimbus POS (consolidated)

> Cross-role limitation index. Detailed registers:
> - Waiter: `ai/WAITER_MVP_KNOWN_LIMITATIONS.md`
> - Cashier: `ai/CASHIER_UI_KNOWN_LIMITATIONS.md` (current Queue-first build) +
>   `ai/CASHIER_FLOOR_RECONSTRUCTION_GAP_REGISTER.md` (locked Floor-First target, C0 complete)
> - Supervisor: `ai/SUPERVISOR_RECONSTRUCTION_GAP_REGISTER.md` (+ the reconciled final register,
>   `ai/SUPERVISOR_FINAL_KNOWN_LIMITATIONS.md`)

> **Backend gap batch 1 (2026-08-20) — `ai/BACKEND_GAP_BATCH1_COMPLETION_REPORT.md`.**
> Four Track C defects were fixed on the **local dev database only** (no schema, migration, seed or
> permission change; **shared-Neon deploy still pending the cutover gate**). Limitations
> **removed**, and the new ones the fixes leave behind:
>
> **REMOVED**
> - ~~`POST /reports/export` with `format: PDF` returns a plain-text file stamped
>   `application/pdf` at `status: READY`~~ (C-01/NG-01/MP0-03). It now returns **501** with an
>   honest message; the catalog advertises `['CSV']` on all 37 entries. **CSV is unchanged.**
> - ~~`GET /hr/employees` returns compensation + `dateOfBirth`/`address`/`emergencyContact*`/private
>   `notes`/`metadata` on every row, and `/:id` adds `contracts[].salaryAmount`~~
>   (C-02/NG-02/MP0-01). The default payload is a safe projection; the sensitive columns are not
>   selected from Postgres.
> - ~~`/dash/today-summary` publishes `netSales` larger than `grossSales`~~ (MP0-10). Now
>   `grossSales = SUM(order.total)`, `netSales = grossSales − taxTotal`, so **gross ≥ net always**.
> - ~~`/dash/open-orders` reports a count that is really the 50-row page length~~ (MP0-09). It now
>   also returns a real `total` that agrees with `/dash/manager.openOrders`.
>
> **NEW / RETAINED**
> - **BGB1-L1 — no PDF export exists at all.** Requesting one is an explicit 501; there is no
>   renderer and adding one is owner decision **OD-10**. `ExportArtifact` rows created **before**
>   2026-08-20 keep their fake `application/pdf` mime type and were not deleted (that would be a
>   data migration).
>   ⚠️ **Corrected by Track B4 (2026-08-20):** this entry previously said those legacy rows "are
>   still downloadable". They are **not** — `GET /api/reports/exports/:id/download` returns
>   **404 "Export file not found on disk"** for them, verified live. They still advertise
>   `status: READY`, so the row and the file disagree; B4 discloses them in words and never offers
>   a download control (**B4-F5**).
> - **BGB1-L2 — a Manager token can still opt into compensation.** The gate is the pre-existing
>   `pos:hr:compensation:read`, which the seeded matrix grants to Owner, **Manager** and Accountant.
>   Only the *default* payload is guaranteed compensation-free (for every role, including Owner).
>   Narrowing the Manager grant is a seed change and was not authorised (follow-up **FU-1**).
> - **BGB1-L3 — `KpiSnapshot` rows written before 2026-08-20 carry the OLD gross/net semantics**
>   (`grossSales = SUM(subtotal)`, `netSales = SUM(total)`). No backfill was performed. Any trend
>   built over historical snapshots mixes two definitions.
> - **BGB1-L4 — 38 accounting routes are unreachable by every role, including Owner**
>   (new Track C entry **C-21**). `accounts-payable` (19), `accounts-receivable` (10) and `budget`
>   (9) are guarded by 23 permission strings (`accounting:ap:*`, `accounting:ar:*`, `finance:*`)
>   that have **zero rows** in the `permissions` table. Live: owner
>   `POST /api/accounting/ap/suppliers` → **403**. `pos:accounting:*` (17 rows) is seeded, so
>   `accounting`, `ledger` and `bank-rec` are fine. **Track B5 must budget a permission/seed
>   cutover before any AP/AR/Budget UI.**
> - **BGB1-L5 — `/hr/employees` is still org-scoped** (`?branchId=` → 400, MP0-06 / C-09) and its
>   `take` is still unbounded (C-12). Neither was in this batch's scope.

> **Cashier Floor-First reconstruction (2026-07-31):** Cashier's nav changed from
> Queue/Receipts/Till/Me to **Floor/Till/Me** — **Prompt C1 is implemented** (default
> `/cashier/floor`, Cashier as the third shared-`OperationalFloor` consumer). The limitations below
> (LIM-001 through LIM-011) all describe the **current, still-accurate** Queue-first payment/split/
> receipt/Till logic, which is **preserved and reused, not rewritten** — it is now reached via the
> **hidden compatibility routes** `/cashier/queue` + `/cashier/receipts` (direct URL only, retire
> C4/C5) until its capabilities migrate into the settlement workspace (C2+). The reconstruction is
> C0–C6; **C0 + C1 + C2 are complete.**
>
> **Cashier Floor C2 — known limitations (non-blocking, 2026-07-31):**
> (1) **The settlement workspace is READ-ONLY.** C2 delivers table→bill resolution + a canonical
> read-only `CashierSettlementWorkspace` (Bill/Totals/Payment state/Settlement readiness/History).
> Payment collection, partial/split payment **execution**, and order **close** arrive in **C3**
> (intended scope, not a defect). (2) **Find bill receipt-reference search is deferred to C4** —
> the C2 Find bill supports order-number/exact-id/tableless/takeaway lookup; receipt-reference is
> shown as an explicit later-step capability. (3) **Receipt/refund indicators are read-only** —
> receipt print/reprint/deliver (C4) and refund creation (C4) are not exposed. (4) **Queue + Receipts
> remain reachable by direct URL** until retired (Receipts C4, Queue C5). (5) **Test-data note:** the
> table→single-bill auto-resolve QA reuses an existing single-payable table on the demo branch (the
> branch naturally carries several); behaviour is data-independent. See
> `ai/CASHIER_FLOOR_RECONSTRUCTION_C2_BILL_RESOLUTION_COMPLETION_REPORT.md` and
> `ai/CASHIER_FLOOR_RECONSTRUCTION_C2_QA_EVIDENCE_INDEX.md`.
>
> **Cashier Floor C1 — known limitations (non-blocking, 2026-07-31, superseded by C2 above):**
> (1) **The Cashier selected-table state is a read-only BOUNDARY only** —
> `CashierSelectedTablePanel` shows verified table identity/status + "Select a bill to continue."
> and exposes **no bill/settlement/payment/close/receipt** action. Table-to-order resolution,
> settlement, payment, and receipts arrive in **C2/C3** (this is the intended C1 scope, not a
> defect). (2) **Find bill is not yet implemented** — tableless/takeaway/direct-lookup/receipt-
> reference/closed-order lookup arrives with the settlement workspace (C2+). (3) **Queue + Receipts
> remain reachable by direct URL** (`/cashier/queue`, `/cashier/receipts`) even though they are off
> the visible nav, until retired (Receipts C4, Queue C5). See
> `ai/CASHIER_FLOOR_RECONSTRUCTION_GAP_REGISTER.md` and
> `ai/CASHIER_FLOOR_RECONSTRUCTION_C1_SHARED_FLOOR_COMPLETION_REPORT.md`.

> **Supervisor final closure (2026-07-31):** every Supervisor limitation below was reconfirmed
> live during the final integrated QA pass; none were found stale. One wording correction: the
> "leave stays org-scoped" note two paragraphs down describes the backend data model correctly
> (`branchId` is nullable on `LeaveRequest`), but live QA observed that the Approvals **UI/API
> list a Supervisor sees is filtered to their current branch context** in practice — seeding
> PENDING leave for a different branch produced an empty Needs-action queue until branch-scoped
> rows existed. Reasonable behavior, previously imprecise wording. See
> `ai/SUPERVISOR_FINAL_KNOWN_LIMITATIONS.md` for the full reconciled list and classification.

> **Supervisor Approvals — Prompt 5A (2026-07-30) known limitations (non-blocking):**
> (1) **No branch-wide discount history** — discounts expose only `/pos/discounts/pending`
> + per-order lists, so a branch-wide discount Resolved/History queue is unavailable without a
> new backend endpoint (SUP-RG-035). (2) **Shift-swap approve does not reassign the roster** — it
> writes status + audit only (SUP-RG-036). (3) **Anomaly resolve reuses `acknowledgedBy`** (no
> separate resolver column). (4) **Discount self-approval** stays backend-permitted (SUP-RG-030).
> (5) Seeded terminal records carry no audit events and 6 RESOLVED anomalies have null resolution
> notes (demo provenance — the 5B UI tolerates, does not repair). Shift-swap **create** UI remains
> deferred (no eligible-target selector, SUP-RG-021).
>
> These are honest, current constraints — do not hide them. Most are **backend
> contract gaps** or **deferred features**, not UI bugs.

> **Supervisor Approvals UI — Prompt 5B1 (2026-07-30) known limitations (non-blocking):**
> (1) **Discount Resolved/History** is unavailable as a branch-wide queue (SUP-RG-035) — discounts
> appear only in Needs action; the workspace omits them from Resolved/History and shows a truthful
> "available from the related order" notice. Order-scoped discount history remains in the order
> workspace. (2) **Shift-swap + Anomaly decisions are read-only in 5B1** — rows/details render, but
> Acknowledge/Resolve/Approve controls arrive in Prompt 5B2. (3) **Resolved** uses a recent-window
> client-terminal filter and **History** is server-paginated with a client terminal filter over the
> page, so a page may render fewer than the page size when its window includes non-terminal rows.
> (4) **Isolated QA note:** `POST /pos/orders` returns 500 on a heavily-populated branch — a
> **pre-existing** order-number generation collision (`unique(branch_id, order_number)`), independent
> of Prompt 5B1 (recommended backend hardening, same class as SUP-RG-034); QA discounts were seeded
> via SQL rather than the order API because of it.

> **Supervisor Approvals — Prompt 5B2 (2026-07-31) known limitations (non-blocking):**
> (1) **Shift-swap approval with a roster effect is not available from Approvals (Outcome C, SUP-RG-042).**
> The runtime has **no roster-mutation service** (`ScheduleAssignment` is read-only across the API), the
> request references only a date (not a specific shift), and `pos:hr:shift-swaps:approve` has never
> mutated the roster. So the workspace exposes **Reject only** (truthful — no schedule change; verified
> 0 assignment rows touched) with honest copy that reassignment isn't supported. A real atomic roster
> swap is a deferred backend feature. (2) **Anomaly resolve reuses `acknowledgedBy`** (no separate
> resolver column). Anomaly acknowledge/resolve are otherwise fully live + branch-scoped. (3) The
> discount-history (SUP-RG-035), self-approval (SUP-RG-030), and order-number (SUP-RG-040) items stand.

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

## Manager Reports (Track B4, 2026-08-20) — known limitations

Canonical record: `ai/ENTERPRISE_B4_REPORTS_COMPLETION_REPORT.md`.

| Limitation | Consequence, and what the UI says |
| --- | --- |
| **No PDF renderer** — `POST /reports/export` with `format: PDF` returns **501** (C-01) | CSV is the only export offered anywhere. The catalog footnote states Nimbus has no PDF renderer. The format is **hard-coded** in the request layer, so no caller can ask for one. |
| **Legacy PDF artifacts advertise `status: READY` but their files 404** (B4-F5) | A run carrying one discloses that Nimbus withdrew its PDF writer and that the file is not downloadable. No PDF control is rendered. |
| **`/reports/:id` returns no rows** — `rowCount` + an aggregate `summary` only (MP0-08 / C-03) | The detail is a key/value panel. **No table is derived from `rowCount`**, which is labelled *"Records aggregated"* — it counts SOURCE records (219 for SALES_BY_HOUR, whose export is 24 rows). |
| **No per-order row payload → no graph and no pivot** (C-03) | Neither is built **and neither is advertised** — no menu row, no view-switcher entry. B4-F3 notes 16 of 24 summaries embed a real breakdown array (which the CSV is built from, and which B4 renders), but that is not a pivot source. |
| ⚠️ **`grossSales` carries two different tax bases** — tax-inclusive at summary level, **ex-tax** inside `topItems[]`/`categories[]` (B4-F2) | Each report declares its own breakdown columns mirroring its CSV header, so the per-item figure is labelled **"Gross sales (ex-tax)"**. A single global label map would mislabel money. Reconciling the backend vocabulary is a backend decision. |
| **`GET /reports/:id` and the artifact download are org-scoped, not branch-scoped** (MP0-12 / B4-F4) | The API client rejects a run whose own `branchId` is not the active branch, so another branch's money can never render under this branch's name. The route itself is still not branch-guarded. |
| **`/api/reports` has no server-side `@Max` on `pageSize`** (MP0-11 / C-12) | Every history request sends an explicit bound from one named constant. |
| **`parameters` is accepted by all 24 generator DTOs but read by none** (B4-F6) | No free-form parameters control is rendered — it would silently do nothing. |
| **`POST /reports/export` is gated by a *read* permission** (`pos:reports:exports:read`, MP0-13 / B4-F1) | No Manager impact — all export permissions are held. Recorded as a backend guard defect. |
| **`MENU_ENGINEERING` is `CONDITIONAL` in the catalog but has no POST route** | It is presented as **not yet available** with the API's own note about M8 recipe-costing data quality. Availability requires BOTH an `IMPLEMENTED` status and a real route. |

## Manager Operations + Staff (Track B3, 2026-08-20) — known limitations

Canonical record: `ai/ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md`.

### Backend constraints the UI works around and discloses

| Limitation | Consequence, and what the UI says |
| --- | --- |
| `GET /hr/employees` is **organization-scoped and 400s on `?branchId=`** (MP0-06 / C-09; re-verified live — the payload spans **5 branches**) | The directory reads the org with an explicit `take=100` bound and narrows **in the browser**. The screen states this and offers an explicit whole-organization view, so the branch switcher does not look broken. A server-side branch filter is the real fix. |
| No **bulk** Quick-PIN status endpoint | Status is read **one employee at a time**, on selection. A status column for 40 people would be 40 requests on mount. The screen says so rather than hiding it. |
| `/hr/leave` and `/hr/shift-swaps` **embed full employee PII** on the wire (`dateOfBirth`, `address`, `emergencyContact*`, `notes`) | The client projects to a name + code identity at the **API-client boundary**; the raw object never reaches state or the React Query cache. A render-time whitelist would not be sufficient. |
| `POST /hr/frontline-staff/onboard` and `/quick-pin/reset` return a **plaintext PIN** (MP0-14) | Displayed **masked**, revealed only on a deliberate action, copy-once, and never logged, cached, stored or URL-encoded. **The backend behaviour itself is unchanged and remains a gap.** |
| `GET /api/tills` and `GET /api/shifts` **do not exist** (MP0-02, re-confirmed live 404/404) | No tills or shifts list anywhere in Operations. The Tables screen **discloses the absence in words**; Overview shows counts only. |
| `/pos/orders` returns **no aggregate** | The orders totals row is a **page** total, labelled "This page", with a footnote saying day totals live on Reports. |
| `/pos/orders`, `/hr/employees` and `/reports` have **no server-side `@Max`** (MP0-11 / C-12) | Every Manager list sends an explicit bound from a named constant. |
| Leave review is **organization-scoped**, not branch-guarded (`{id, orgId}` lookup by design — leave has a nullable branch) | The list is branch-filtered server-side, but the decision is not branch-guarded. The UI states this rather than implying a boundary that is not enforced. |
| A decided leave request or shift swap **400s on a second review** | Terminal rows render read-only; offering the buttons would be offering a guaranteed error. |

### New findings — recorded, NOT implemented

| ID | Finding | Why it was not fixed |
| --- | --- | --- |
| **B3-F1** | `GET/POST/PATCH /hr/frontline-staff/:id/quick-pin*` resolve the employee by `{ id, orgId }` only — they are **org-scoped, not branch-guarded**. Verified live: 200 from a second branch. A manager could administer the PIN of an employee in a branch they do not manage, by id. | Backend change, out of B3 scope. The B3 UI only lists employees from the selected branch, so it cannot reach one by accident. Recommended fix: add `branchId` to `loadEmployeeForOrg`, matching the shift-swap approve hardening. |
| **B3-F2** | **FU-1 confirmed live:** `?view=full` returns full compensation and PII to a **Manager** token, because the seeded matrix grants `pos:hr:compensation:read` to Owner, Manager and Accountant. | Seed/permission change, explicitly unauthorised. The frontend never sends it, and an assertion proves the string appears nowhere in the Manager surface. |
| **B3-F3** | `POST /api/hr/leave` and `POST /api/hr/shift-swaps` are **self-service only** — a manager cannot file leave or a swap on an employee's behalf (403: *"can only create leave for their own linked employee profile"*). | Correct as designed. Recorded so it is not re-discovered as a missing feature; B3 offers no create control for either. |
| **B3-D1** *(fixed)* | Backend gap batch 1 **inverted** `grossSales`/`netSales`, so the B2 Overview rendered the **ex-tax** figure under the label "Sales today (tax-inclusive)". | **Fixed in B3** — bindings re-pointed and pinned by an assertion. Recorded here because FU-3 described it as merely stale documentation. |

### Deliberately deferred, with reasons

- **Operations → Exceptions** and **Staff → Attendance** — outside the owner's enumerated B3 scope.
  Both are tagged **`Deferred`** in the menu tree rather than given an invented phase number.
- **Chatter rail (Odoo C6)** over `GET /api/audit/timeline` — gated on **B0**, which has not run.
- **All escalation writes, and the escalation list** — see `docs/DECISIONS.md` D-B3-READONLY.
- **Graph and pivot views** — impossible until `GET /api/reports/:id` returns rows (C-03 / NG-06).
  The view switcher does not advertise them.
- **Supervisor/Manager roles in the onboarding picker** — creating an account with approval
  authority is not "frontline onboarding". Omitted from the picker, not disabled in it.

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
