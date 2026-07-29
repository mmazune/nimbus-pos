# Supervisor Reservation — Shared Neon Data Audit (Prompt 4A)

**Status: EXECUTED (read-only) — 2026-07-28.** Live audit run via Neon MCP against
the shared branch (read-only) + an isolated disposable QA branch for all mutations.
**No guest PII** was read or copied — counts, ids, statuses, and timestamps only.

---

## 1. Redacted branch identity
- Neon project: **nimbus-pos** (`empty-glade-2684xxxx`), PG 17, org `Moses`.
- Shared branch: **`br-holy-darkness-…`** — name `production`, `default`+`primary`,
  the live DB the app connects to. **Classification: shared/production →
  READ-ONLY for destructive QA.** (No separate dev/demo branch exists.)
- Disposable QA branch: **`prompt4a-reservations-qa-20260728`**
  (`br-weathered-breeze-…`), forked from the shared branch, auto-expiry
  2026-07-29T02:00Z.
- **Isolation proof:** distinct branch id + independent compute; QA branch forked
  the real baseline (126 reservations, 6 SEATED, 57 migrations); all QA writes
  (2 completions, 3 events, 1 link) landed on the QA branch, and the shared branch
  counts were **identical before and after** (see §8).

## 2. Migration state
- Shared `_prisma_migrations`: **57 applied, 0 unfinished, 0 rolled back**, latest
  `20260508000000_bg7_hms_integration`.
- Repo migration dirs: **58** (57 through bg7 + the new
  `20260518000000_prompt4a_reservation_completed_event`).
- **Exactly one repo migration (the Prompt 4A one) is unapplied on shared —
  intended (not deployed this pass).** No drift, no DB-only orphan migration, no
  failed/partial/checksum issue.
- On the **QA branch**, the migration was applied via `ALTER TYPE … ADD VALUE
  IF NOT EXISTS 'COMPLETED' AFTER 'SEATED'` and verified (see §3).

## 3. Schema-drift result
- Actual `ReservationEventType` on **shared**: CREATED, CONFIRMED, DEPOSIT_RECORDED,
  TABLE_ASSIGNED, SEATED, CANCELLED, NO_SHOW, DEPOSIT_REFUNDED, DEPOSIT_FORFEITED
  — **no `COMPLETED`** (migration undeployed, as intended).
- Actual `ReservationEventType` on **QA branch (post-migration)**: `COMPLETED`
  present at sort-order 5.5 — **exactly between SEATED (5) and CANCELLED (6)**,
  matching the `AFTER 'SEATED'` clause and the Prisma schema order.
- `ReservationStatus` (both branches): PENDING, CONFIRMED, SEATED, COMPLETED,
  CANCELLED, NO_SHOW — matches Prisma. **No drift.**
- `reservations` table columns include `seated_order_id`, `completed_at`,
  `confirmed_at`, `seated_at`, `cancelled_at`, `no_show_at` — matches Prisma; no
  table change needed for completion.

## 4. Permission-mapping result (SQL, shared branch)
- **Supervisor** role → reservation permissions: `create, read, confirm, seat,
  cancel, no-show, deposit:record, deposit:read, table:assign, **update**`.
  → **`pos:reservation:update` is granted → manual completion is authorized at
  runtime. No seed change required.**
- `permissions` has exactly **1** row for `pos:reservation:update`.
- **0 duplicate** `role_permissions` rows (integrity clean).
- Seed application on shared Neon **not required** for Prompt 4A (no permission/
  seed change was made).

## 5. Reservation counts (shared branch, read-only) — counts only, no PII
Total **126** reservations (as of 2026-07-28).

| Status | Count | Notes |
|--------|------:|-------|
| PENDING | 9 | 8 in the past (overdue), 1 future |
| CONFIRMED | 52 | 47 in the past (overdue), 5 future |
| SEATED | 6 | all dated 2026-06-19 → 06-29 (past); **all `seated_order_id = NULL`** |
| COMPLETED | 57 | |
| CANCELLED | 1 | |
| NO_SHOW | 1 | |

**Active pile-up:** 67 non-terminal rows (9+52+6), of which **55 are overdue**
(past scheduled time, not seated/terminal) — exactly what accumulated in the
operational list and now surfaces in the Attention grouping via derived `overdue`.

Integrity: **0** COMPLETED-with-open-linked-order, **0** cross-branch reservation/
order links, **0** duplicate role-permission rows.

## 6. Stale-record categories (repair plan — NOT executed on shared)
- **SUPERVISOR DECISION REQUIRED** — the **6 SEATED** reservations (all
  `seated_order_id = NULL`, all in the past): "SEATED with no linked order."
  Order-close auto-completion cannot resolve these (no linked order); a Supervisor
  must Complete / Cancel / No-show each. **Not auto-resolved.**
- **SUPERVISOR DECISION REQUIRED** — 8 past PENDING + 47 past CONFIRMED (overdue):
  surface in Attention; Supervisor decides Seat / Cancel / No-show. **Not
  auto-NO_SHOW.**
- **SAFE AUTOMATIC CANDIDATE** — none found (no SEATED linked to a CLOSED order on
  shared, because all SEATED are order-less).
- **INCONSISTENT** — none (0 cross-branch links, 0 completed-with-open-order).

**Repair policy honored:** no mass shared-Neon mutation. Any future repair must be
branch-scoped, dry-run-first, report affected ids/counts, and is not executed
against shared Neon without explicit approval. No auto-NO_SHOW / no auto-complete
of ambiguous records.

## 7. Deployment step for the new migration (separate, when approved)
```
# from packages/db, against the shared branch DATABASE_URL
prisma migrate deploy   # applies 20260518000000_prompt4a_reservation_completed_event
```
Verified on the QA branch that the enum-value addition is non-destructive and
backward compatible (existing rows unaffected; existing reads unaffected).

## 8. Confirmation — shared branch not destructively mutated
- Shared reservation counts **before QA** = after QA: PENDING 9, CONFIRMED 52,
  SEATED 6, COMPLETED 57, CANCELLED 1, NO_SHOW 1 (126 total). **Identical.**
- Shared `reservation_events` = **12** before and after. **Identical.**
- Shared `ReservationEventType` enum still lacks `COMPLETED` (a `type='COMPLETED'`
  filter literally errors on shared — proof the migration never touched it).
- **All QA mutations were confined to the disposable branch.** ✅
- **Disposable branch DELETED 2026-07-28** (user-authorized); project now has only
  the `production` branch (`written_data_bytes: 0` on it). ✅
