# Supervisor MVP Inclusion And Deferral Matrix

Status: **FINAL CLOSURE (2026-07-31) — every "Included / live" row below was re-verified live in
the integrated final QA pass (four viewports, isolated stack); no inclusion/deferral decision
changed.** See `ai/SUPERVISOR_RECONSTRUCTION_FINAL_COMPLETION_REPORT.md`. Prior: Prompt 0 decision
matrix (Prompt 3A addendum 2026-07-27)
Date: 2026-07-18 (updated 2026-07-31)

> **Prompt 5B2 addendum (2026-07-31) — Approvals CLOSED.** **Anomaly** Acknowledge + Resolve are now
> **included / live**. **Shift-swap** is **Outcome C (user-authorized): Reject INCLUDED, Approve
> DEFERRED** — a roster-changing approval is unsupported (no roster-mutation service; request references
> only a date; approve permission has never mutated roster, SUP-RG-036/042), so the UI is truthful and
> exposes Reject only. **Branch-wide discount Resolved/History remains DEFERRED** (SUP-RG-035). Prompt 5
> closed at **B — demo-ready with known limitations**; no UI falsely claims a roster/financial effect.
>
> **Prompt 5B1 addendum (2026-07-30).** The Approvals **premium UI** is now **included / live** for
> two domains: **Discount** approve/reject and **Leave** approve/reject are actionable in the master-
> detail workspace (Needs action / Resolved / History, identity-safe rows, URL state, browser QA
> 80/80 × 4 viewports). **Shift-swap + Anomaly UI decisions are DEFERRED to Prompt 5B2** (rows/details
> render read-only now). **Branch-wide discount Resolved/History is DEFERRED** (no backend endpoint,
> SUP-RG-035) — discounts appear in Needs action only, with a truthful order-scoped notice.
>
> **Prompt 5A addendum (2026-07-30).** Approvals **backend/contract/QA foundation** is now
> **included / complete** (Prompt 5B builds the UI on it). Verified + hardened decision lifecycles
> for all four domains (discount/leave/shift-swap/anomaly) — bounded pagination, branch isolation
> (swap/anomaly; leave org-scoped), concurrency-safe claims, History date filters, minimal identity.
> Domain-specific architecture (no generic `/api/approvals/:id/decide`). **Deferred (unchanged):**
> shift-swap **create** UI (no eligible-target selector, SUP-RG-021), branch-wide discount
> **history** (no endpoint, SUP-RG-035), shift-swap roster reassignment on approve (SUP-RG-036),
> refund/post-close-void queues. No permission/schema/migration/seed/Postman change.
>
> **Prompt 3A addendum (2026-07-27).** Now **included / live** behind Floor table
> selection: **Request bill** (`POST /api/pos/orders/:id/request-bill`) and
> **Mark served** (`POST /api/pos/orders/:id/mark-served`), both `pos:orders:write`.
>
> **Prompt 3B1 addendum (2026-07-27).** Now **included / live** behind Floor table
> selection: **Split bill** (`/split-bill`), **Split items** (`/split-items`),
> **Move items** (`/move-items`), **Merge** (`/merge`) — all `pos:order:*` (granted
> to Supervisor via seed mapping), BG3 idempotency. Still **deferred to Prompt
> 3B2/3B3**: transfer-table, void, discount request/approve/reject, complimentary,
> refunds. **transfer-server** remains **blocked** (no safe narrow server selector).
>
> **Prompt 3B2 addendum (2026-07-28).** Now **included / live**: **Transfer table**
> (`/transfer-table`, `pos:order:transfer` granted to Supervisor via seed mapping,
> BG3 optional idempotency, bounded branch-scoped target selector, URL re-anchor)
> and **Find order** (Supervisor-only bounded Floor lookup for tableless/takeaway/
> closed/exception/direct-reference; `GET /api/pos/orders` + `:id` fallback). Still
> **deferred to Prompt 3B3**: void, discount, complimentary, refunds.
> **transfer-server** stays **deferred (Outcome B)** and UI-hidden — no safe server
> selector, and the single `pos:order:transfer` permission also makes the
> transfer-server endpoint API-reachable.
>
> **Prompt 3B3A addendum (2026-07-28).** Now **included / live** in the Floor
> **Adjustments** group (no permission/backend change — Supervisor already held the
> grants; `seed.ts` unchanged): **Void active order** (`/void`, `pos:orders:void`,
> HTTP 200, not BG3; sets `status=VOIDED` only + auto-releases an idle DINE_IN table;
> distinct from refund/complimentary/post-close void) and **Discount request**
> (`/discounts`, `pos:discount:request`, HTTP 201, not BG3; basis = order subtotal;
> backend amount-based auto-approval within `OrgSettings.discountApprovalThreshold`
> (default 5000) → APPROVED else PENDING, UI shows a labelled estimate) plus a
> **read-only Discounts panel** (`GET .../discounts`, `pos:discount:read`). Both are
> payment-gated in the **UI only**. Still **deferred to Prompt 3B3B**: discount
> approve/reject, complimentary, refunds, post-close void. **transfer-server** stays
> deferred (Outcome B).
>
> **Prompt 3B3B addendum (2026-07-28).** Now **included / live** (no permission/backend
> change — Supervisor already held the grants; `seed.ts` unchanged): **Discount approve**
> and **Discount reject** as **inline Approve/Reject controls on PENDING discount rows**
> (`POST /api/pos/discounts/:id/approve` and `/reject`, both `pos:discount:approve`, HTTP
> 200, not BG3; approve is PENDING-only + recalcs totals + payment-gated, reject requires
> `rejectionReason` + no total change + not payment-gated) and **Complimentary**
> (`pos:discount:request`, **Outcome B** = whole-order `PERCENTAGE value=100` +
> `metadata { complimentary:true, category }` + required reason; whole-order only;
> threshold decides PENDING/APPROVED; payment-gated). Supervisor order-workspace financial
> actions are now **feature-complete**. The backend permits self-approval; the UI matches
> and flags it (backend maker-checker guard recommended). Still **deferred / out of scope**:
> refund creation/approval, post-close void, payment collection, order close.
> **transfer-server** stays deferred (Outcome B).

> **Prompt 4B addendum (2026-07-28) — Reservations page reconstruction (DONE, COMPLETE
> WITH KNOWN LIMITATIONS).** Now **included / done** (no permission/backend change —
> Supervisor already held every grant): a master-detail Reservations workspace on the
> Prompt 4A scope contracts with four UI **views** (Arriving/Seated/Attention from one
> bounded `scope=active` query; **History** lazy `scope=history`), URL-persisted state,
> and the lifecycle actions **Create** (`pos:reservation:create`), **Confirm**
> (`pos:reservation:confirm`), **Assign/Change table** (`pos:reservation:table:assign`),
> **Seat** (`pos:reservation:seat`), **Cancel** (`pos:reservation:cancel`), **No-show**
> (`pos:reservation:no-show`; never SEATED, never automatic), and **Manual complete**
> (`pos:reservation:update`). Availability mirrors backend `VALID_TRANSITIONS`; terminal
> rows read-only; Attention = server overdue + structural SEATED inconsistencies with
> individual actions only (no bulk). **Still deferred / excluded:** deposit capture and
> payment collection (deposits are **read-only**; create takes an optional
> `depositRequired` amount only). **Known limitation:** shared Neon lacks
> `ReservationEventType.COMPLETED` (migration `20260518000000` unapplied) → **manual
> complete** (and auto-completion-on-order-close) error on shared Neon until deployed; all
> other actions work on shared today. **→ Deployed in Prompt 4C (below).**

> **Prompt 4C addendum (2026-07-29) — shared-Neon migration cutover (DEMO-READY).** The
> Prompt 4B known limitation is **resolved**: under explicit user authorization, migration
> `20260518000000_prompt4a_reservation_completed_event` was deployed to the shared Neon
> `production` branch via `db:migrate:deploy` (adds `ReservationEventType.COMPLETED`), so
> **manual complete and automatic completion on order close now work on the shared demo
> database** — every reservation lifecycle action is now fully operable on shared Neon. An
> idempotent user-authorized `db:seed` also granted Supervisor `pos:order:transfer` (+1
> role_permission), making **Transfer table** functional on shared Neon too. Net
> shared-Neon change: +1 migration, +1 role_permission; reservation data unchanged (126); a
> pre-migration recovery branch is retained. Classification: **COMPLETE WITH KNOWN
> LIMITATIONS / DEMO-READY** — the live authenticated browser + 4-viewport run against a
> properly-isolated stack remains the outstanding QA gate (lifecycle otherwise proven by
> 67/67 Jest tests + the compiled Prompt 4B Playwright suite). No code change; no commit.

> **Prompt 4D addendum (2026-07-29) — isolated live QA (DEMO-READY, B).** The reservation
> lifecycle is now **live-QA-verified**: a live mutation matrix passed **53/53** (local,
> authoritative — create/confirm/assign/reassign/seat/cancel/no-show/manual-complete/
> queries/pagination/overdue/branch-isolation/concurrency) and the Playwright reservations
> suite (9 specs × 4 viewports = 72 tests) was genuinely executed against an isolated stack.
> QA ran on a disposable Neon branch + local Docker Postgres behind new fail-closed
> `tools/qa/` DB-isolation tooling; shared Neon `production` verified untouched. **QA/
> test-infra/isolation-tooling only — NO scope, capability, permission, contract, schema,
> seed, or backend change.** Classification **B (DEMO-READY)**. Residual: order-close
> automatic completion proven by Jest 67/67 + the 4C cutover but not re-driven end-to-end
> through the live Cashier close flow. Reports:
> `ai/SUPERVISOR_RECONSTRUCTION_PROMPT4D_ISOLATED_LIVE_QA_COMPLETION_REPORT.md`,
> `ai/PROMPT4D_DATABASE_ISOLATION_EVIDENCE.md`.

| Capability | MVP decision | Entry point | Backend contract | Reason |
|---|---|---|---|---|
| Floor | Include | Visible nav | `/api/tables`, `/api/floor-plans`, `/api/floor/availability` | Primary Supervisor operational surface. |
| Reservations | Include | Visible nav and Floor handoff | `/api/reservations*` | Supervisor owns reservation oversight and seating exceptions. |
| Approvals | Include | Visible nav | Domain APIs only | Supervisor owns operational exceptions. |
| Me | Include | Visible nav | `/api/auth/me`, HR self-scope APIs | Session, identity, punch, leave/swaps read/self-service. |
| Orders primary tab | Defer/remove | None | Existing read route only | New product decision removes visible Orders nav. |
| Table order handling | Include | Floor table selection | POS order read/write and handoff APIs | Supervisor order work starts from tables. |
| Tableless/takeaway lookup | Included / live (Prompt 3B2) | Find order control above Floor | `/api/pos/orders` query + `:id` detail | Bounded Supervisor-only lookup; no Orders tab, no order-number/date/free-text search. |
| Split bill | Include after Prompt 4 | Order exception workspace | `/api/pos/orders/:id/split-bill` | Supervisor exception workflow; BG3 wrapped. |
| Split items | Include after Prompt 4 | Order exception workspace | `/api/pos/orders/:id/split-items` | Supervisor exception workflow; BG3 wrapped. |
| Merge orders | Include after Prompt 4 | Order exception workspace | `/api/pos/orders/merge` | Supervisor exception workflow; BG3 wrapped. |
| Transfer table | Included / live (Prompt 3B2) | Order exception workspace | `/api/pos/orders/:id/transfer-table` (`pos:order:transfer`) | Bounded branch-scoped target selector, non-blocking warnings, URL re-anchor; backend only sets `tableId`. |
| Transfer server | Deferred (Outcome B) | UI-hidden | `/api/pos/orders/:id/transfer-server` (`pos:order:transfer`) | No safe branch-scoped server selector; single `pos:order:transfer` permission also makes this endpoint API-reachable. |
| Move items | Include after Prompt 4 | Order exception workspace | `/api/pos/orders/:id/move-items` | Supervisor exception workflow; BG3 wrapped. |
| Void active order | Included / live (Prompt 3B3A) | Order exception workspace (Adjustments) | `/api/pos/orders/:id/void` (`pos:orders:void`) | High-impact Supervisor exception; shared danger confirm, reason required, HTTP 200 not BG3; sets `status=VOIDED` only + auto-releases idle DINE_IN table; UI payment gate. Distinct from refund/complimentary/post-close void. |
| Discount request | Included / live (Prompt 3B3A) | Order exception workspace (Adjustments) | `/api/pos/orders/:id/discounts` (`pos:discount:request`) | Basis = order subtotal; HTTP 201 not BG3; backend auto-approves within `OrgSettings.discountApprovalThreshold` (default 5000) → APPROVED else PENDING; UI shows labelled estimate + payment gate; blocks a 2nd request while one is PENDING. |
| Discount history panel | Included read-only (Prompt 3B3A) | Order detail | `/api/pos/orders/:id/discounts` (`pos:discount:read`) | Read-only list; inline Approve/Reject on PENDING rows added in Prompt 3B3B. |
| Complimentary | Included / live (Prompt 3B3B — Outcome B) | Order exception workspace (Adjustments) | `/api/pos/orders/:id/discounts` (`pos:discount:request`) | No comp DiscountType exists → whole-order `PERCENTAGE value=100` + `metadata { complimentary:true, category }` + required reason; whole-order only; threshold decides PENDING/APPROVED; payment-gated; not a void/refund. |
| Payment collection | Defer | Cashier | close/payment/till endpoints | Cashier-owned workflow. |
| Receipts/printers/devices | Defer | Cashier/admin later | receipt/device endpoints | Not Supervisor MVP; hardware deferred. |
| Refund approval queue | Defer | Approvals future | Missing pending queue | Cannot show fake queue rows. |
| Refund detail from order | Include read-only | Order detail | `/api/pos/orders/:id/refunds`, `/api/pos/refunds/:id` | Useful exception context. |
| Post-close void execution | Defer until candidate UX | Exception lookup future | `/api/pos/orders/:id/post-close-void` | High-risk; needs candidate discovery and PIN UX. |
| Reservation confirm | Include after Prompt 5 | Reservations | confirm endpoint | Supervisor lifecycle action. |
| Reservation assign table | Include after Prompt 5 | Reservations/Floor | assign-table endpoint | Supervisor lifecycle action. |
| Reservation seat | Include after Prompt 5 | Reservations/Floor | seat endpoint | Supervisor lifecycle action. |
| Reservation cancel/no-show | Include after Prompt 5 | Reservations | cancel/no-show endpoints | Supervisor lifecycle action with deposit outcome. |
| Reservation complete | Defer/block | Reservations future | No verified controller endpoint | Needs backend contract and event enum. |
| Discount approve/reject | Included / live (Prompt 3B3B) | Order exception workspace (inline on PENDING rows) | `POST /api/pos/discounts/:id/approve` \| `/reject` (`pos:discount:approve`) | Approve PENDING-only + recalcs totals + payment-gated (optional `managerPin`); reject requires `rejectionReason`, no total change, not payment-gated. Backend permits self-approval (UI flags it; guard recommended). |
| Leave review | Include after Prompt 6 | Approvals | `/api/hr/leave/:id/review` | Verified domain action. |
| Shift-swap review | Include after Prompt 6 | Approvals | `/api/hr/shift-swaps/:id/approve` | Verified domain action. |
| Anomaly acknowledge/resolve | Include after Prompt 6 | Approvals | anomaly endpoints | Verified domain action. |
| Global approvals | Exclude | None | `/api/approvals*` | Supervisor lacks global approval permissions. |
| Accounting/payroll/franchise/billing/dev portal | Exclude | None | Various | Outside Supervisor MVP role thesis. |
