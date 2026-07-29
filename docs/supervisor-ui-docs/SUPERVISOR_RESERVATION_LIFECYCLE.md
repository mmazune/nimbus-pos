# Supervisor Reservation Lifecycle

Status: reconstruction standard — **updated by Prompt 4A (2026-07-28)**
Date: 2026-07-18 (rev 2026-07-28)

## Verified Statuses

`PENDING`, `CONFIRMED`, `SEATED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`

## Verified Transitions

| From | To | Endpoint | Notes |
|---|---|---|---|
| PENDING | CONFIRMED | `PATCH /api/reservations/:id/confirm` | Optional notes. |
| PENDING | CANCELLED | `PATCH /api/reservations/:id/cancel` | Requires reason and deposit outcome handling. |
| PENDING | NO_SHOW | `PATCH /api/reservations/:id/no-show` | Deposit outcome optional. |
| CONFIRMED | SEATED | `PATCH /api/reservations/:id/seat` | Requires assigned table or payload table; can create dine-in order. |
| CONFIRMED | CANCELLED | `PATCH /api/reservations/:id/cancel` | Requires reason and deposit outcome handling. |
| CONFIRMED | NO_SHOW | `PATCH /api/reservations/:id/no-show` | Deposit outcome optional. |
| SEATED | COMPLETED | `POST /api/reservations/:id/complete` | **Prompt 4A — now exposed.** Gated by `pos:reservation:update` (Supervisor/Owner/Manager). SEATED-only, idempotent, optional `note`. Also driven automatically by order close (below). |

### Prompt 4A additions (2026-07-28)

**Manual completion** — `POST /api/reservations/:id/complete` (200), permission
`pos:reservation:update`. SEATED-only (else 409). Idempotent: an already-COMPLETED
reservation returns its canonical state with no second event. Valid with or without
a linked order (no fabricated order/payment). Emits `ReservationEvent(COMPLETED,
{source:'manual'})` + `RESERVATION_COMPLETED` audit.

**Automatic completion on order close** — when an order reaches `CLOSED`, a
reservation explicitly linked via `seatedOrderId` **and** still `SEATED` is
auto-completed at the canonical `OrdersService.transitionOrder` choke point
(`source:'order-close'`, `orderId` in event metadata). Linkage is never inferred
from table/guest/date. Retry-safe/idempotent; a manual/auto race yields exactly one
completion event. If completion fails, the order close still succeeds and the
reservation stays SEATED for manual completion (failure is logged).

**Concurrency** — every transition uses a guarded conditional update
(`updateMany where {id, status: from}`); a stale request returns 409 with no
duplicate event and no lost update.

## Active vs. History queries (Prompt 4A)

Separated server-side — the browser no longer merges overlapping all/today/upcoming:

- **Active** — `GET /api/reservations?scope=active` → `PENDING`, `CONFIRMED`,
  `SEATED` only. Supports `date`, `from`/`to`, `tableId`, `status`, `page`,
  `pageSize`. Each row carries derived `overdue` / `overdueByMinutes` (never
  persisted; grace 15 min; overdue → Attention, never auto-NO_SHOW).
- **History** — `GET /api/reservations?scope=history` → `COMPLETED`, `CANCELLED`,
  `NO_SHOW` only. Server-paginated, newest-first (`reservationAt desc, id desc`).
- **Pagination** — default `pageSize=25`, **max 100** (clamped server-side).
  Response: `{ data, total, page, pageSize, totalPages, scope }`.
- **Timezone** — day/range boundaries applied server-side; branch timezone not yet
  modelled, so day edges use UTC (documented limitation).

Prompt 4B renders **Arriving / Seated / Attention / History** from these contracts
without fetching all reservations. Frontend helpers:
`fetchSupervisorActiveReservations`, `fetchSupervisorReservationHistory`,
`completeSupervisorReservation`, `supervisorReservationKeys`,
`supervisorReservationInvalidationKeys` (in `lib/supervisor/reservations.ts`).

## Active Board

Default Supervisor Reservations view should contain only operationally active rows:

- Awaiting confirmation: `PENDING`
- Confirmed and not seated: `CONFIRMED`
- Seated and still open: `SEATED`
- Deposit watch: active reservations with deposit required, received, or unresolved deposit metadata

## History

History should contain terminal rows:

- `COMPLETED`
- `CANCELLED`
- `NO_SHOW`

History should be filterable by date and searchable, but it should not be mixed into the active board by default.

## Pile-Up Fix

Current UI merges all, today, and upcoming rows. Reconstruction should query intentionally:

- Active: separate `PENDING`, `CONFIRMED`, and `SEATED` reservation reads, unless a later backend multi-status query is added.
- Upcoming: `GET /api/reservations/upcoming`.
- History: separate `COMPLETED`, `CANCELLED`, and `NO_SHOW` reads, unless a later backend multi-status query is added.

Do not hide terminal rows by deleting data. Move them to History.

## Prompt 4B — Reservations UI lifecycle (2026-07-28, COMPLETE WITH KNOWN LIMITATIONS)

The old read-only Reservations page (triple all/today/upcoming fetch + `pageSize=100`
+ browser-side merge) is replaced by a **premium master-detail workspace** built on the
Prompt 4A `scope=active`/`scope=history` contracts.

### UI views (groupings, NOT new persisted statuses)

- **Arriving**, **Seated**, **Attention** — all derived from **one** bounded
  `GET /api/reservations?scope=active` query (page size 50; **no** triple fetch, **no**
  browser merge).
- **History** — a **separate, lazy, server-paginated** `GET /api/reservations?scope=history`
  query (backend default 25, max 100; no all-history initial fetch).
- Default view = **Arriving**, current operational date, page 1, bounded page size.
- **URL-persisted state:** view, date, page, status, from, to, and the selected
  reservation id — Back/Forward/refresh stable.

### Lifecycle actions (no permission/backend change — Supervisor already holds all)

Availability mirrors backend `VALID_TRANSITIONS` **exactly**
(PENDING→{CONFIRMED,CANCELLED,NO_SHOW}; CONFIRMED→{SEATED,CANCELLED,NO_SHOW};
SEATED→{COMPLETED}; terminal→none). Terminal reservations render **read-only**.

| Action | Endpoint | Permission | Transition |
|---|---|---|---|
| Create | `POST /api/reservations` | `pos:reservation:create` | — (new PENDING) |
| Confirm | `PATCH /api/reservations/:id/confirm` | `pos:reservation:confirm` | PENDING→CONFIRMED |
| Assign/Change table | `PATCH /api/reservations/:id/assign-table` | `pos:reservation:table:assign` | PENDING/CONFIRMED/SEATED |
| Seat | `PATCH /api/reservations/:id/seat` | `pos:reservation:seat` | CONFIRMED→SEATED (table required) |
| Cancel | `PATCH /api/reservations/:id/cancel` | `pos:reservation:cancel` | active→CANCELLED (reason required) |
| No-show | `PATCH /api/reservations/:id/no-show` | `pos:reservation:no-show` | PENDING/CONFIRMED→NO_SHOW (**never** SEATED, never automatic) |
| Manual complete | `POST /api/reservations/:id/complete` | `pos:reservation:update` | SEATED→COMPLETED |

### Attention view

Derives overdue from the server-provided `overdue`/`overdueByMinutes` (grace 15 min,
PENDING/CONFIRMED only) **plus** structural SEATED inconsistencies
(seated-without-linked-order, linked-order-closed, seated-without-table). Operational
copy only (e.g. "42 minutes overdue", "Seated without a linked order") — never
implementation copy. **Individual actions only; NO bulk resolution** (no Resolve all /
Mark all no-show / Complete all).

### Automatic completion

Automatic completion (order close → linked SEATED reservation COMPLETED) is presented
**truthfully**; the Reservations page **never** issues that mutation — the backend
order-close integration (Prompt 4A, `seatedOrderId` linkage) remains canonical.

### Boundaries

- **Guest privacy:** list rows show the guest **name only** (no full phone/email/raw
  ids); contact detail appears only in the selected workspace / create form; synthetic
  QA guests only.
- **Deposit boundary:** create form accepts an optional `depositRequired` (verified
  create-DTO field, an amount only); deposits show **read-only** in the workspace; **no
  payment collection or deposit capture**.
- **Cross-role invalidation:** Supervisor mutations persist canonically and narrowly
  invalidate Supervisor active/history/detail/events + Supervisor Floor overlay + Waiter
  reservations/floor — **never** menu/profile/auth/shift/approvals/all-orders/cashier.
- **Nav unchanged:** Floor · Reservations · Approvals · Me; shared shell/Floor/profile
  unchanged.

### Files

New (`apps/web/src/components/supervisor/reservations/`):
`SupervisorReservationViewSelector`, `SupervisorReservationRow`,
`SupervisorReservationsDateToolbar`, `SupervisorReservationTableSelect`,
`SupervisorReservationWorkspace`, `SupervisorCreateReservationDialog`,
`SupervisorReservationLifecycleDialogs`. **Removed** the 6 superseded read-only
components (`SupervisorReservationCard/List/Summary/Toolbar/DetailPanel/StatusBadge`).
`lib/supervisor/reservations.ts` extended (mutations, view grouping, attention
derivation, action availability, cache invalidation helper, date nav). Playwright suite
`apps/web/e2e/supervisor-reservations/` (9 specs).

### Shared-Neon gate (verified read-only via Neon MCP)

The shared `production` branch enum `ReservationEventType` still **lacks** `COMPLETED`;
migration `20260518000000_prompt4a_reservation_completed_event` is **unapplied**.
Consequence: **manual complete + auto-completion-on-order-close ERROR on shared Neon
until deployed**; ALL other actions (create/confirm/assign/seat/cancel/no-show) and
Attention/overdue **work on shared today** — hence classification **COMPLETE WITH KNOWN
LIMITATIONS**. Validation passed: web typecheck + lint + `next build`; reservation+order
Jest 67/67; Playwright specs compile (72 tests × 4 viewports). QA-blocked (not
fabricated): live authenticated browser + 4-viewport execution and the disposable-branch
mutation run require a running API/web/browser stack unavailable in this environment.

## Prompt 4C — Shared-Neon migration cutover (2026-07-29, DEMO-READY)

The Prompt 4B shared-Neon gate above is now **cleared**. Under explicit user
authorization, migration `20260518000000_prompt4a_reservation_completed_event` was
deployed to the shared Neon `production` branch with `prisma migrate deploy` (repo
script `db:migrate:deploy`). SQL applied:
`ALTER TYPE "ReservationEventType" ADD VALUE IF NOT EXISTS 'COMPLETED' AFTER 'SEATED'`.

**Consequence:** manual completion (`POST /api/reservations/:id/complete`, SEATED→COMPLETED)
and automatic completion on order close now **persist correctly on shared Neon** — the
`COMPLETED` event they emit no longer errors because the enum value exists. Every
reservation lifecycle action is now fully operable on the shared demo database.

**Post-deploy verification (Neon MCP):** the migration is recorded in `_prisma_migrations`
(finished, not rolled back), its checksum
(`8f1317fa72baaddcd81d5410c8be3e9261e287fc465c3e8c2cf2d8ab382f6d7d`) matches the repo
file, the enum now holds `COMPLETED` alongside all 9 prior values (10 total), 58
migrations total / 0 rolled back / 0 unfinished, and the enum add left reservation row
counts unchanged (126 reservations).

**Safety note (durable):** shared/production deploys must use `db:migrate:deploy`
(`prisma migrate deploy`); the repo `db:migrate` script is `prisma migrate dev`, which
is **unsafe** on shared/production (shadow DB, drift reset). A pre-migration Neon
recovery branch is **retained** — Postgres enum values cannot be dropped, so recovery is
branch restore / forward-fix, never enum-value removal.

**Also in this pass:** an idempotent, user-authorized `db:seed` on `production` added
the `pos:order:transfer` Supervisor mapping (role_permissions 835→836, +1), making
Transfer table (Prompt 3B2) functional on shared Neon. Net shared-Neon change from 4C:
+1 migration, +1 role_permission; reservation data unchanged.

**Outstanding QA gate (classification COMPLETE WITH KNOWN LIMITATIONS / DEMO-READY):**
the live authenticated browser + 4-viewport execution against a properly-isolated stack
was **not** completed — an isolation slip (a shell/profile `DATABASE_URL` overrode the
swapped `.env`, so an isolated API connected to production) was caught by the isolation
check after it created ONE marked QA reservation on production, which was then deleted
(user-authorized), restoring production to exactly 126 reservations. Per user decision
Prompt 4C was closed at B; the lifecycle remains proven by 67/67 reservation+order Jest
tests and the compiled Prompt 4B Playwright suite (72 tests × 4 viewports). Web
typecheck + lint + build pass; Postman 56/56 parse; `git diff --check` clean; no code
change; no commit/push.

## Completion Blocker

Before adding a Complete action, verify or add:

- Controller endpoint.
- DTO if needed.
- Audit event.
- `ReservationEventType.COMPLETED` or equivalent event strategy.
- Postman coverage.
- Seed/demo idempotency impact.
