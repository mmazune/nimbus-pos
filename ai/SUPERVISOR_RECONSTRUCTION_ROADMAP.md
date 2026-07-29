# Supervisor Reconstruction Roadmap

Status: Prompts 1-2, 3A, 3B1, 3B2, 3B3A, 3B3B complete (2026-07-28); Supervisor order-workspace financial actions feature-complete
Date: 2026-07-18 (updated 2026-07-28)
Rule: each implementation prompt must preserve Waiter and Cashier behavior unless explicitly scoped.

> **Prompt 3 split (2026-07-27).** The original Prompt 3/4 were re-scoped into:
> **Prompt 3A** — action foundation (idle parity, central action-availability
> module, canonical selected-order wiring, shared confirmation dialog,
> idempotency-intent utility) + safe service actions (Request bill, Mark served).
> **COMPLETE.**
> **Prompt 3B1** — Split bill, Split items, Move items, Merge on the 3A foundation
> (bounded target selector, shared line selector, EQUAL/CUSTOM validators, BG3
> idempotency). Required an authorized RBAC grant (Supervisor → `pos:order:split`/
> `merge`/`move-items`). **COMPLETE.** Report:
> `ai/SUPERVISOR_RECONSTRUCTION_PROMPT3B1_SPLIT_MOVE_MERGE_COMPLETION_REPORT.md`.
> **Prompt 3B2** — Transfer table (live, `pos:order:transfer`, BG3 optional
> idempotency, bounded branch-scoped target selector, URL re-anchor) + Find order
> (bounded Supervisor-only Floor lookup for tableless/takeaway/closed/exception/
> direct-reference; no order-number/date/free-text search — backend lacks it).
> Required an authorized RBAC grant (Supervisor → `pos:order:transfer`, seed
> mapping). transfer-server stays **deferred (Outcome B)** and UI-hidden — no safe
> narrow server selector, and the single `pos:order:transfer` permission also makes
> the transfer-server endpoint API-reachable. **COMPLETE (2026-07-28).** Report:
> `ai/SUPERVISOR_RECONSTRUCTION_PROMPT3B2_TRANSFER_AND_LOOKUP_COMPLETION_REPORT.md`.
> Live/browser QA remains **PENDING**.
> **Prompt 3B3A** — **Active-order void** (live, `pos:orders:void`,
> `POST /api/pos/orders/:id/void`, HTTP 200, not BG3; sets `status=VOIDED` only +
> auto-releases an idle DINE_IN table; distinct from refund/complimentary/post-close
> void) + **Discount request** (live, `pos:discount:request`,
> `POST /api/pos/orders/:id/discounts`, HTTP 201, not BG3; basis = order subtotal;
> backend amount-based auto-approval within `OrgSettings.discountApprovalThreshold`
> (default 5000) → APPROVED else PENDING; UI shows a labelled estimate and defers the
> final status/totals) + a **read-only Discounts panel** (`GET .../discounts`,
> `pos:discount:read`). Both actions are payment-gated in the **UI only** (availability
> module blocks when payment indicates money or can't be confirmed). **No permission and
> no backend change** — Supervisor already held all required grants; `seed.ts` not
> modified. **COMPLETE (2026-07-28).** Report:
> `ai/SUPERVISOR_RECONSTRUCTION_PROMPT3B3A_VOID_AND_DISCOUNT_REQUEST_COMPLETION_REPORT.md`.
> Live/browser QA + `/api/health` + Jest API suite remain **PENDING**.
> **Prompt 3B3B** — **Discount approve** (live, `pos:discount:approve`,
> `POST /api/pos/discounts/:id/approve`, HTTP 200, not BG3; PENDING-only else 409 and the
> order must stay discountable; recalcs totals so **payment-gated** in the UI; optional
> `managerPin` re-auths the approver's own PIN, UI does not collect it) + **Discount reject**
> (live, same `pos:discount:approve`, `POST /api/pos/discounts/:id/reject`, HTTP 200;
> `rejectionReason` required; totals unchanged so **not** payment-gated) — both rendered as
> **inline Approve/Reject on PENDING rows** in the read-only Discounts panel — plus
> **Complimentary** (live, `pos:discount:request`, **Outcome B**: whole-order
> `PERCENTAGE value=100` + `metadata { complimentary:true, category }` + required reason;
> whole-order only; threshold decides PENDING/APPROVED; payment-gated; not a void/refund).
> **No permission and no backend change** — Supervisor already held the grants; `seed.ts`
> unchanged. The backend **permits self-approval**; the UI matches it and flags it (a
> backend maker-checker guard is a recommended future control). Narrow invalidation of the
> discount approvals domain only; the Approvals **page** stays read-only. **COMPLETE
> (2026-07-28).** Report:
> `ai/SUPERVISOR_RECONSTRUCTION_PROMPT3B3B_DISCOUNT_DECISIONS_AND_COMPLIMENTARY_COMPLETION_REPORT.md`.
> Supervisor order-workspace financial actions are now **feature-complete** for the
> reconstruction scope. Out of scope (unbuilt): **transfer-server** (Outcome B, no safe
> selector), refund creation/approval, post-close void, payment collection, order close.
> **Next:** a consolidated **Prompts 3B1–3B3B live/browser QA sweep** + `/api/health` +
> Jest API suite (all **PENDING** — no API/DB/browser automation) and the (recommended)
> backend self-approval guard, then Reservations Prompt 4A/4B or the full Approvals-page
> reconstruction (**NOT started**).

> **Prompt 4B (2026-07-28) — Reservations page reconstruction. COMPLETE WITH KNOWN
> LIMITATIONS.** (This is the UI half of the Phase-Order Prompt 5 "Reservation lifecycle
> reconstruction"; Prompt 4A delivered the verified backend scope/complete contracts.)
> The old read-only Reservations page (triple all/today/upcoming fetch + browser merge,
> pageSize 100) is replaced by a **master-detail workspace** on the Prompt 4A
> `scope=active`/`scope=history` contracts. Four UI **views** (groupings, not new
> statuses): **Arriving / Seated / Attention** from **one** bounded `scope=active` query
> (page size 50) + **History** from a lazy `scope=history` query (backend default 25 /
> max 100). Default = Arriving, current operational date, page 1; URL-persisted
> (view/date/page/status/from/to/selected id). Lifecycle actions wired to already-verified
> endpoints with **no permission and no backend change** — Supervisor already held every
> grant: **Create** (`pos:reservation:create`), **Confirm** (`pos:reservation:confirm`),
> **Assign/Change table** (`pos:reservation:table:assign`), **Seat**
> (`pos:reservation:seat`), **Cancel** (`pos:reservation:cancel`), **No-show**
> (`pos:reservation:no-show`; never SEATED, never automatic), **Manual complete**
> (`pos:reservation:update`). Availability mirrors backend `VALID_TRANSITIONS`; terminal
> rows read-only. Attention = server overdue (grace 15 min) + structural SEATED
> inconsistencies, individual actions only (no bulk). Deposits **read-only** (create takes
> an optional `depositRequired` amount only — **no** capture); auto-completion on order
> close is canonical backend, never issued by this page. Narrow cross-role invalidation
> (Supervisor active/history/detail/events + Supervisor Floor + Waiter reservations/floor;
> never menu/profile/auth/shift/approvals/all-orders/cashier). New components under
> `apps/web/src/components/supervisor/reservations/` (view selector, row, date toolbar,
> table select, workspace, create dialog, lifecycle dialogs); 6 superseded read-only
> components removed; `lib/supervisor/reservations.ts` extended; Playwright suite
> `apps/web/e2e/supervisor-reservations/` (9 specs). Validation: web typecheck + lint +
> `next build`; reservation+order Jest 67/67; Playwright specs compile (72 tests × 4
> viewports). **Known limitation:** shared Neon `production` still lacks
> `ReservationEventType.COMPLETED` (migration `20260518000000` unapplied) → manual complete
> + auto-completion-on-order-close **error on shared Neon** until deployed; all other
> actions work on shared today. Live authenticated browser + 4-viewport execution and the
> disposable-branch mutation run remain **PENDING** (no API/DB/browser stack in this
> environment).

> **Prompt 4C (2026-07-29) — shared-Neon migration cutover + QA closure. COMPLETE WITH
> KNOWN LIMITATIONS / DEMO-READY.** A controlled shared-Neon deployment pass built on
> Prompt 4A (backend reservation lifecycle) and Prompt 4B (Reservations UI). Under
> explicit user authorization, migration
> `20260518000000_prompt4a_reservation_completed_event` was deployed to the shared Neon
> `production` branch with `prisma migrate deploy` (repo script `db:migrate:deploy`) —
> `ALTER TYPE "ReservationEventType" ADD VALUE IF NOT EXISTS 'COMPLETED' AFTER 'SEATED'`.
> Post-deploy verification (Neon MCP): recorded in `_prisma_migrations` (finished, not
> rolled back), checksum matches the repo file, enum now holds `COMPLETED` (10 values, 9
> prior retained), 58 migrations / 0 rolled back / 0 unfinished, reservation rows
> unchanged (126). **Effect:** manual complete (SEATED→COMPLETED) and auto-completion on
> order close now **work on shared Neon** — Prompt 4 reservations is now **demo-ready on
> shared** and the Prompt 4B "errors on shared until migration" limitation is closed. A
> user-authorized idempotent `db:seed` on `production` also added the `pos:order:transfer`
> Supervisor mapping (role_permissions 835→836, +1), making **Transfer table (Prompt
> 3B2)** functional on shared Neon (closes the 3D/3C shared-seed residual). **Durable
> safety fix:** shared/production deploys must use `db:migrate:deploy` (`prisma migrate
> deploy`); the repo `db:migrate` = `prisma migrate dev` is **unsafe** on shared/production
> (shadow DB, drift reset) — corrected in the deployment-readiness doc. A pre-migration
> Neon recovery branch is **retained** (enum values cannot be dropped; recovery = branch
> restore / forward-fix). Net shared-Neon change from 4C: +1 migration, +1 role_permission;
> reservation data unchanged. Validation: web typecheck + lint + build pass;
> reservation+order Jest **67/67**; Postman **56/56** parse; `git diff --check` clean; no
> code change; **no commit/no push**. **Outstanding QA gate:** the disposable-branch
> live-API matrix + Playwright four-viewport browser run were **not** completed — an
> isolation slip (shell/profile `DATABASE_URL` overrode the swapped `.env`, so an isolated
> API connected to production) was caught by the isolation check after it created ONE
> marked QA reservation on production, which was then deleted (user-authorized), restoring
> production to exactly 126 reservations / 12 events. Per user decision Prompt 4C was
> closed at **B**; the lifecycle stays proven by Jest 67/67 + the compiled Prompt 4B
> Playwright suite (72 tests × 4 viewports). Live browser/API execution against a
> properly-isolated stack remains the outstanding gate.

## Phase Order

| Prompt | Title | Recommended model | Scope | Acceptance |
|---|---|---|---|---|
| 1 | Shared shell, nav, and icon registry | Complete (2026-07-18) | Shared role-shell primitives, canonical icon registry, exact Supervisor four-tab nav, and safe legacy Orders redirects are implemented. | Passed: Supervisor has four visible tabs, legacy context is preserved, and Waiter/Cashier consume the shared shell without navigation-scope changes. |
| 2 | Shared operational floor presentation | Complete (2026-07-18) | Shared Floor/card/grid/toolbar/status/state/workspace primitives now serve Waiter and Supervisor; Supervisor adds a read-first table-control workspace after selection. | Passed: exact default Floor geometry/parity at four viewports, URL selection/history, legacy order handoff, and role-owned workspace behavior. |
| 3 | Supervisor Floor order workspace | GPT-5.5 high reasoning | Move Supervisor order work behind Floor table selection. Include exception lookup for tableless/takeaway/closed/direct reference/post-close review. | No Orders tab; table selection opens Supervisor workspace; lookup handles non-table orders without recreating primary nav. |
| 4 | Supervisor order exception actions | GPT-5.5 high reasoning | Add vetted Supervisor actions: split bill, split items, merge, move items, transfer table/server, void/request-bill/mark-served where permitted and confirmed. | High-impact actions confirm intent, use idempotency where supported, audit via backend, and invalidate related queries. |
| 5 | Reservation lifecycle reconstruction | GPT-5 high reasoning | Split active board/history/deposit watch, wire confirm/assign/seat/cancel/no-show, document completion blocker if no endpoint exists. | Active reservations do not pile up; terminal records move to history; unavailable completion is honest. |
| 6 | Approval lifecycle reconstruction | GPT-5.5 high reasoning | Normalize domain queues and add allowed decisions for discounts, leave, swaps, anomalies. Keep refunds/voids unavailable until queue contracts exist. | Decisions update rows, prevent duplicate submissions, show terminal state, and avoid global `/api/approvals`. |
| 7 | Final QA, Postman, docs, and status closeout | GPT-5 high reasoning | Full regression pass, route smoke, browser QA, Postman updates if any API/action contracts changed, docs/status/tree/report updates. | Waiter, Cashier, Supervisor smoke passes; docs match shipped behavior; known limitations are explicit. |

## Dependencies

| Dependency | Needed by | Reason |
|---|---|---|
| Shared icon registry | Prompts 1-7 | Prevents role drift for equivalent concepts. |
| Shared floor primitives | Prompts 2-3 | Supervisor Floor must match completed Waiter Floor. |
| Supervisor order lookup design | Prompts 3-4 | Replaces old Orders tab without losing exception access. |
| Reservation completion contract decision | Prompt 5 | Needed to move `SEATED` to durable history. |
| Pending refund and void candidate queues | Prompt 6 future extension | Required before showing refund/void queue rows. |

## Prompt 1 Result

- `OperationalShell`, `OperationalHeader`, and `OperationalBottomNav` are the single presentation foundation for Waiter, Cashier, and Supervisor.
- Role wrappers remain thin adapters; guards, readiness data, mutations, permissions, API calls, and React Query keys remain role-owned.
- Equivalent concepts resolve through the canonical operational icon registry.
- Supervisor Orders is absent from visible navigation and remains compatibility-only. Operational order work moves into Supervisor Floor in Prompts 2-3.

## Prompt 2 Result

- `OperationalFloor` is the single default Floor presentation for Waiter and Supervisor; shared edits propagate to both consumers.
- Role adapters own reads and normalization. Waiter retains instant menu entry and ownership rules; Supervisor never receives menu entry or Waiter ownership blocking.
- Supervisor table selection opens a read-first control workspace. Only the previously verified table-status mutation remains live, behind focused confirmation; split/merge/transfer/void/discount/comp/refund/payment/close stay deferred.
- Prompt 3 remains the exception lookup and high-impact order-action phase; it has not started.

## Out Of Scope Until Explicitly Requested

- Full accounting, payroll administration, franchise, developer portal, owner SaaS billing, PesaPal diner checkout, printer drivers, terminal/acquirer traffic, MSR login, badge login, and smart spouts.
- Waiter menu/order-entry redesign beyond safe shared floor extraction.
- Cashier payment/till/receipt ownership migration into Supervisor.

## Required Validation Per Implementation Prompt

- Web typecheck, lint, and build.
- API build when contracts or generated types are touched.
- Focused tests for changed service/controller logic.
- Browser QA for 390x844, 1024x768, 1366x768, and 1440x900.
- `/api/health` db ok when running authenticated flows.
- Postman collection updates only when API contracts or Supervisor action flows are added.
