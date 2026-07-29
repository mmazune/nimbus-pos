# Supervisor UI Docs

Status: Prompt 3B3B complete (2026-07-28); order-workspace financial actions feature-complete (consolidated 3B1–3B3B live/browser QA PENDING)
Date: 2026-07-18 (updated 2026-07-28)

## Current Decision

Supervisor reconstruction target:

- Visible nav: Floor, Reservations, Approvals, Me.
- No visible Orders tab.
- Order/table context enters from Floor after table selection. Live actions:
  **Request bill** + **Mark served** (Prompt 3A, `pos:orders:write`) and **Split
  bill / Split items / Move items / Merge** (Prompt 3B1, `pos:order:*`, BG3
  idempotency), plus **Transfer table** and **Find order** (Prompt 3B2,
  `pos:order:transfer` / bounded lookup). Payment/close stay in Cashier. Remaining
  high-impact actions are deferred to **Prompt 3B3B**; **transfer-server** stays
  deferred (Outcome B) and UI-hidden pending a safe server selector.
- **Prompt 3B3A (2026-07-28)** added an **Adjustments** group behind Floor selection —
  **Void active order** (`pos:orders:void`) and **Discount request**
  (`pos:discount:request`, basis = subtotal, backend threshold auto-approval) — plus a
  **read-only Discounts panel** (`pos:discount:read`). Both are payment-gated in the UI
  only; **no permission/backend change** (Supervisor already held the grants). Discount
  approve/reject, complimentary, refunds, and post-close void stay deferred to Prompt
  3B3B. Live/browser QA remains PENDING.
- **Prompt 3B3B (2026-07-28)** added **inline discount Approve/Reject** on PENDING rows in
  the Discounts panel (`pos:discount:approve`) and a **whole-order Complimentary** in
  Adjustments (`pos:discount:request`, Outcome B: `PERCENTAGE value=100` + metadata).
  Supervisor order-workspace financial actions are now **feature-complete**; the Approvals
  page stays read-only. **No permission/backend change** (grants already held); the backend
  **permits self-approval** — the UI matches and flags it (backend guard recommended).
  Refunds, post-close void, and transfer-server remain out of scope. Live/browser QA PENDING.
- **Prompt 3B2 (2026-07-28)** added **Transfer table** (re-anchor an order to another
  table via a bounded branch-scoped target selector; backend only sets `tableId`) and
  **Find order** (a Supervisor-only compact Floor control — not an Orders tab — for
  bounded tableless/takeaway/closed/exception/direct-reference lookup). transfer-server
  stays deferred. Live/browser QA remains PENDING.
- Exception order lookup exists inside the Floor/order workspace for tableless, takeaway, closed, direct-reference, and post-close review cases.
- Floor presentation now shares the completed Waiter Floor tree, toolbar, grid, card, status, search/filter/floor-plan behavior, and state treatments.
- Waiter, Cashier, and Supervisor already consume the shared operational shell/header/bottom-nav foundation and canonical icon registry.
- Role-specific guards, readiness queries, permissions, and business rules remain outside the shared shell.

- **Prompt 4B (2026-07-28) — Reservations page reconstruction (COMPLETE WITH KNOWN
  LIMITATIONS).** The old read-only Reservations page (triple all/today/upcoming fetch +
  browser merge, pageSize 100) is replaced by a **master-detail workspace** on the Prompt
  4A scope contracts: four UI **views** — **Arriving / Seated / Attention** from **one**
  bounded `scope=active` query and **History** from a lazy `scope=history` query —
  URL-persisted (view/date/page/status/from/to/selected id). Lifecycle actions wired to
  already-verified endpoints (**no permission/backend change** — Supervisor already holds
  all grants): create, confirm, assign/change table, seat, cancel, no-show (never SEATED,
  never automatic), and manual complete; availability mirrors backend `VALID_TRANSITIONS`;
  terminal rows read-only. Attention = server overdue (grace 15 min) + structural SEATED
  inconsistencies, individual actions only (no bulk). Deposits **read-only** (create takes
  an optional `depositRequired` amount only — no capture); auto-completion on order close
  is canonical backend, never issued here. **Known limitation:** shared Neon still lacks
  `ReservationEventType.COMPLETED` (migration `20260518000000` unapplied) so **complete**
  errors on shared Neon until deployed; all other actions work on shared today. Live
  browser + 4-viewport QA remains the outstanding gate. **→ Shared-Neon gate cleared in
  Prompt 4C (below).**

- **Prompt 4C (2026-07-29) — shared-Neon migration cutover + QA closure (COMPLETE WITH
  KNOWN LIMITATIONS / DEMO-READY).** Under explicit user authorization, migration
  `20260518000000_prompt4a_reservation_completed_event` was deployed to the shared Neon
  `production` branch via `db:migrate:deploy` (adds `ReservationEventType.COMPLETED`), so
  **manual complete + auto-completion-on-order-close now work on shared Neon** — closing
  the Prompt 4B limitation; every reservation lifecycle action is now fully operable on
  the shared demo DB. An idempotent user-authorized `db:seed` also granted Supervisor
  `pos:order:transfer` (+1 role_permission), so **Transfer table (Prompt 3B2) is now
  functional on shared Neon**. Net shared-Neon change: +1 migration, +1 role_permission;
  reservation data unchanged (126); pre-migration recovery branch retained. Durable
  safety fix: shared/production deploys must use `db:migrate:deploy` (`prisma migrate
  deploy`), **not** `db:migrate` (`migrate dev`, unsafe on shared). Validation: web
  typecheck + lint + build pass; reservation+order Jest 67/67; Postman 56/56 parse; no
  code change. **Outstanding gate:** the live authenticated browser + 4-viewport /
  disposable-branch API run was **not** completed (an isolation slip was caught and
  reverted); the lifecycle stays proven by Jest 67/67 + the compiled Prompt 4B Playwright
  suite (72 tests × 4 viewports).

## Documents

| File | Purpose |
|---|---|
| `SUPERVISOR_API_MATRIX.md` | Verified backend contracts and exclusions for Supervisor reconstruction. |
| `SUPERVISOR_LIFECYCLE.md` | Overall Supervisor workflow and invalidation model. |
| `SUPERVISOR_SHARED_COMPONENT_ARCHITECTURE.md` | Shared shell/floor/profile/component extraction plan. |
| `SUPERVISOR_RESERVATION_LIFECYCLE.md` | Reservation state machine, pile-up fix, and completion blocker. |
| `SUPERVISOR_APPROVAL_LIFECYCLE.md` | Approval domain queue/action lifecycle. |
| `SUPERVISOR_ICON_AND_NAVIGATION_STANDARD.md` | Four-tab nav and shared icon registry. |
| `SUPERVISOR_GAP_REGISTER.md` | Legacy Supervisor gap register retained for history. |

## AI Planning Artifacts

| File | Purpose |
|---|---|
| `ai/SUPERVISOR_RECONSTRUCTION_REPO_VERIFICATION_REPORT.md` | Prompt 0 evidence report. |
| `ai/SUPERVISOR_RECONSTRUCTION_ROADMAP.md` | Prompt 1-7 implementation roadmap. |
| `ai/SUPERVISOR_RECONSTRUCTION_GAP_REGISTER.md` | Reconstruction-specific gaps. |
| `ai/SUPERVISOR_MVP_INCLUSION_DEFER_MATRIX.md` | MVP include/defer/exclude decisions. |

## Implementation Status

Prompts 1-2 implement the shared shell/navigation/icons, exact shared Waiter/Supervisor Floor presentation, URL-backed selection, a read-first Supervisor table-control workspace, and safe legacy Orders handoff. Final tableless lookup, high-impact order actions, reservation actions, approval actions, and reconstruction closeout remain in Prompts 3-7.
