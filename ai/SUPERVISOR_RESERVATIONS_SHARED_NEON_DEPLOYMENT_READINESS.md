# Supervisor Reservations — Shared Neon Deployment Readiness

**Date:** 2026-07-28 · **Prepared for:** the pre-demo shared-Neon cutover of the
Supervisor Reservations UI (Prompt 4B) built on the Prompt 4A lifecycle.

> ✅ **DEPLOYED in Prompt 4C (2026-07-28).** The migration below was applied to the
> shared Neon `production` branch via `db:migrate:deploy` after explicit authorization
> and **verified** (checksum match; `COMPLETED` present; 58 migrations, 0 rolled back;
> reservation counts unchanged). `db:seed` also applied the authorized
> `pos:order:transfer` Supervisor mapping. See
> `ai/SUPERVISOR_RECONSTRUCTION_PROMPT4C_SHARED_NEON_CUTOVER_COMPLETION_REPORT.md`.
> This document is retained as the cutover record + the procedure for any future branch.
>
> ⚠️ **Deploy command:** use **`db:migrate:deploy`** (`prisma migrate deploy`), NOT
> `db:migrate` (which is `prisma migrate dev` — unsafe on shared). Migrations need a
> **direct** (non-pooled) Neon connection.

---

## 1. Pending migration

| Field | Value |
| --- | --- |
| Migration | `20260518000000_prompt4a_reservation_completed_event` |
| Statement | `ALTER TYPE "ReservationEventType" ADD VALUE IF NOT EXISTS 'COMPLETED' AFTER 'SEATED';` |
| Kind | **Additive enum value** (idempotent via `IF NOT EXISTS`) |
| Schema change | Enum only — no table/column/index change (`Reservation.completed_at` already exists; existing `[branchId,status]` / `[branchId,reservationAt]` indexes cover the active/history split) |
| Transaction | PostgreSQL requires enum-value additions to run **outside** an explicit transaction; Prisma Migrate applies this statement on its own (consistent with prior enum-extension migrations, e.g. `20260328000000_m20_1_reporting_depth`) |

## 2. Shared branch identity (redacted)

- **Project:** `nimbus-pos` (Neon project id `empty-glade-…`, org Moses, pg 17).
- **Shared branch:** `production` (`br-holy-darkness-…`) — primary/default, the live
  app database. It is the shared dev/demo branch and is **read-only for destructive QA**.
- Connection strings / tokens / passwords are intentionally **not** recorded here.

## 3. Verified current state (read-only, via Neon MCP, 2026-07-28)

- `SELECT … FROM _prisma_migrations WHERE migration_name LIKE '%2026051%' OR … ILIKE '%complete%'`
  → **0 rows** (the Prompt 4A migration is **not applied**).
- `enum_range(ReservationEventType)` → `{CANCELLED, CONFIRMED, CREATED,
  DEPOSIT_FORFEITED, DEPOSIT_RECORDED, DEPOSIT_REFUNDED, NO_SHOW, SEATED,
  TABLE_ASSIGNED}` → **`COMPLETED` absent**.

## 4. Application compatibility impact (why it matters)

Until this migration is applied on shared Neon:

- ❌ **Manual complete** (`POST /api/reservations/:id/complete`) — the service writes a
  `ReservationEvent(type = COMPLETED)`; the enum rejects it → the action errors.
- ❌ **Automatic completion on order close** (`OrdersService.transitionOrder` → CLOSED →
  `completeForClosedOrder`) — same `COMPLETED` event write → logged failure (the order
  close itself still succeeds; completion is retried-safe and non-blocking).
- ✅ **Everything else works on shared today:** create, confirm, assign/change table,
  seat, cancel, no-show; the active/history scope split; **Attention/overdue**
  (`overdue`/`overdueByMinutes` are read-time derived — no migration needed).

## 5. Deployment command

From the repo root against the shared-branch `DATABASE_URL` (do not print the URL):

```bash
corepack pnpm@8.15.0 db:migrate:deploy   # = prisma migrate deploy — applies only unapplied migrations
```

> ⚠️ **Use `db:migrate:deploy`, NOT `db:migrate`.** In this repo `db:migrate` =
> `prisma migrate dev`, which is unsafe on a shared/production branch (shadow DB,
> drift detection, possible reset, new-migration generation). Only
> `db:migrate:deploy` (`prisma migrate deploy`) is safe for shared Neon — it applies
> pending migrations and records them in `_prisma_migrations` without any dev-mode
> behaviour. (Corrected in Prompt 4C preflight.)

## 6. Required seed step

**None** for this migration. Reservation permissions are already seeded and already on
the Supervisor role; the migration adds no data. (Separately, a prior Prompt 3 note
recommends `db:seed` to apply the `pos:order:transfer` mapping before a Neon demo —
that is unrelated to reservations.)

## 7. Verification steps (post-deploy)

1. `SELECT unnest(enum_range(NULL::"ReservationEventType"))::text ORDER BY 1;` →
   `COMPLETED` present (positioned after `SEATED`).
2. `SELECT migration_name FROM _prisma_migrations WHERE migration_name = '20260518000000_prompt4a_reservation_completed_event';` → 1 row, `finished_at` set.
3. Smoke: seat a synthetic reservation, `POST /:id/complete` → 200 + a
   `COMPLETED` lifecycle event; close a linked seated order → the reservation
   auto-completes.
4. `GET /api/health` → `{status:"ok", db:"ok"}`.

## 8. Rollback / recovery

- The change is **additive and idempotent**; re-running is a no-op.
- PostgreSQL does **not** support removing an enum value; there is no in-place
  rollback and none is needed (existing rows are unaffected; the value is simply
  available). If a full revert were ever required it would be a manual type
  rebuild — **not** recommended and not necessary for an additive value.
- Lock/risk: `ADD VALUE` takes a brief catalog lock only; no table rewrite, no row
  lock, negligible on a 126-row reservation table.

## 9. Prompt 4B destructive-QA isolation statement

Prompt 4B performed **only two read-only `SELECT`s** against shared Neon (migration
check + enum range). **No** INSERT/UPDATE/DELETE/DDL was issued to shared Neon, and
**no** disposable branch was created this pass. All destructive/mutation QA for this
feature must run on a disposable Neon branch (never the shared `production` branch),
per `docs/TESTING_AND_QA.md`.

## 10. Cutover checklist (pre-demo on shared Neon)

- [ ] Authorization obtained to deploy to shared `production`.
- [ ] `corepack pnpm@8.15.0 db:migrate` run against the shared branch.
- [ ] `enum_range` verification (step 7.1) confirms `COMPLETED`.
- [ ] `/api/health` = ok.
- [ ] Manual complete + order-close auto-complete smoke pass.
- [ ] (If a Neon demo also needs Transfer table) `db:seed` applied per the Prompt 3 note.
