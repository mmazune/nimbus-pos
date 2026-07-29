# Supervisor Reservation — QA Record Register (Prompt 4A)

Living register of reservation-lifecycle QA for the Prompt 4A reconstruction.
Mirrors the structure of `SUPERVISOR_PROMPT3_QA_RECORD_REGISTER.md`.

**Legend:** ✅ pass · ⏳ pending (Neon-gated) · ⚠️ pass with note · ❌ fail

## A. Static validation (executed)

| # | Check | Command | Result |
|---|-------|---------|--------|
| A1 | API typecheck (changed modules) | `tsc --noEmit` (apps/api) | ✅ 0 errors in reservations/orders |
| A2 | API typecheck (repo) | `tsc --noEmit` | ⚠️ 4 pre-existing errors in `accounts-receivable.service.spec.ts` (untouched) |
| A3 | Reservation + orders unit tests | `jest reservations.service.spec orders.service.spec` | ✅ 67/67 pass |
| A4 | Web typecheck | `pnpm --filter @nimbus-pos/web typecheck` | ✅ pass |
| A5 | Web lint | `pnpm --filter @nimbus-pos/web lint` | ✅ no warnings/errors |
| A6 | Web build | `pnpm --filter @nimbus-pos/web build` | ✅ compiled successfully |
| A7 | Prisma client regen | `pnpm db:generate` | ✅ v5.22.0 (codegen only) |
| A8 | Postman JSON parse (all 56) | json.load | ✅ all parse |

## B. Unit-test coverage of lifecycle contracts (executed)

| # | Scenario | Result |
|---|----------|--------|
| B1 | Manual complete SEATED → COMPLETED | ✅ |
| B2 | Complete rejects PENDING / CONFIRMED (409) | ✅ |
| B3 | Complete idempotent (already COMPLETED → no 2nd event) | ✅ |
| B4 | Manual/auto complete race → winner only, no duplicate event | ✅ |
| B5 | Order close auto-completes linked SEATED reservation | ✅ |
| B6 | Order close with no linked reservation → no-op | ✅ |
| B7 | Order-close vs manual-complete race → no duplicate | ✅ |
| B8 | Order close still succeeds if completion throws (failure-safe) | ✅ |
| B9 | Guarded transition conflict (confirm loses race → 409, no event) | ✅ |
| B10 | list scope=active → active statuses only | ✅ |
| B11 | list scope=history → terminal only, newest-first sort | ✅ |
| B12 | list pageSize clamp to 100; default 25 | ✅ |
| B13 | list overdue flag on past active reservation | ✅ |

## C. Isolated Neon live QA (EXECUTED 2026-07-28 via Neon MCP)

Project **nimbus-pos** (`empty-glade-…`), shared branch `production`
(`br-holy-darkness-…`, read-only), disposable QA branch
`prompt4a-reservations-qa-20260728` (`br-weathered-breeze-…`).

| # | Scenario | Result |
|---|----------|--------|
| C1 | Disposable QA branch created + isolation proven (forked 126 res / 57 migrations; distinct compute) | ✅ |
| C2 | Migration audit: shared 57 applied / 0 failed / 0 rolled-back; repo 58; only the 4A migration unapplied (intended); no drift | ✅ |
| C3 | Schema/enum parity: `COMPLETED` absent on shared, present at ord 5.5 (after SEATED) on QA post-migration; `ReservationStatus` matches Prisma | ✅ |
| C4 | Seed idempotency on QA branch | ⚠️ not re-run — **no seed change in 4A**; QA branch forked already-seeded data; prior Prompt 3D verified seed idempotency |
| C5 | RolePermission SQL: Supervisor has `pos:reservation:update` (+ 1 perm row, 0 dup role-perms) | ✅ |
| C6 | Shared-branch read-only reservation data audit (126 rows; 6 order-less SEATED; 55 overdue; 0 integrity issues) | ✅ |
| C7 | Lifecycle at DB layer: manual complete SEATED→COMPLETED (1 row) + `COMPLETED` event `{source:manual}` | ✅ (SQL) + service unit tests |
| C8 | Auto-complete on order close: linked SEATED→COMPLETED (1 row, 1 event `{source:order-close}`); duplicate close = 0 rows; unlinked = 0 rows | ✅ |
| C9 | Active/history separation on real data (active 65 + history 61 = 126, no overlap); pagination clamp/coercion | ✅ active/history (SQL) + unit tests for clamp/coercion |
| C10 | Concurrency compare-and-set: guarded `updateMany where status='SEATED'` re-run = 0 rows (no double-complete, no dup event) | ✅ (DB semantics) + unit tests |
| C11 | Order-close regression (payment/table release intact) | ✅ orders unit tests (67/67); live payment path unchanged by 4A |
| C12 | Query-plan review: active + history ≈0.07ms; seq-scan optimal at 126 rows; `[branch_id,status]`/`[branch_id,reservation_at]` cover growth → **no index migration** | ✅ |
| C13 | Isolated `GET /api/health` = ok | ⏳ API not booted (see §E) |
| C14 | Playwright reservation smoke (Supervisor + Waiter routes load) | ⏳ not run (see §E) |
| C15 | Shared Neon unmutated: before/after counts identical (126 res, 12 events); enum untouched | ✅ (branch deletion — see §E) |

## D. Sign-off assessment

The **reservation lifecycle + queue contracts are proven at BOTH the service/DTO
unit-test layer (67/67) AND the live isolated-DB layer** (migration, schema,
permissions, real-data lifecycle, idempotency, active/history separation, query
plans). Shared Neon received **zero** writes. → **B. COMPLETE WITH KNOWN
LIMITATIONS / READY FOR PROMPT 4B.**

## E. Remaining non-blocking QA depth (optional)

- **HTTP-layer API matrix + isolated `/api/health` + Playwright smoke (C13/C14)** —
  would require booting the NestJS API against the QA branch connection string
  (secret handling) + Next build server. The controller/DTO/permission stack is
  already unit-tested and the DB contract is proven live; this is additional
  end-to-end confidence, not a gap in the contracts. Can be run on request.
- **Disposable branch cleanup** — ✅ **DELETED 2026-07-28** (user-authorized);
  `describe_project` confirms only the `production` branch remains.

---

# Prompt 4B — Reservations UI QA Records

**Legend:** ✅ pass · ⏳ pending (stack-gated) · ⚠️ pass with note · ❌ fail

## P4B-A. Static validation (executed)

| # | Check | Command | Result |
|---|-------|---------|--------|
| P4B-A1 | Web typecheck | `pnpm --filter @nimbus-pos/web typecheck` | ✅ 0 errors |
| P4B-A2 | Web lint | `pnpm --filter @nimbus-pos/web lint` | ✅ no warnings/errors |
| P4B-A3 | Web build | `pnpm --filter @nimbus-pos/web build` | ✅ compiled; `/supervisor/reservations` 21.4 kB |
| P4B-A4 | Reservation + orders unit tests | `jest reservations orders` (apps/api) | ✅ 67/67 pass |
| P4B-A5 | Playwright suite compiles | `playwright test --list e2e/supervisor-reservations` | ✅ 72 tests × 4 viewports enumerated |
| P4B-A6 | `git diff --check` | — | ✅ clean (LF→CRLF notices only) |
| P4B-A7 | Postman JSON parse (56) | BOM-tolerant JSON.parse | ✅ all parse (3 pre-existing BOM); 0 Postman changes |

## P4B-B. Neon MCP verification (read-only, executed)

| # | Check | Result |
|---|-------|--------|
| P4B-B1 | Project / branch identity | ✅ `nimbus-pos` / `production` (shared) |
| P4B-B2 | Prompt 4A migration on shared | ⏳ **NOT applied** (`_prisma_migrations` 0 rows) |
| P4B-B3 | `ReservationEventType` enum on shared | ⏳ **`COMPLETED` absent** |
| P4B-B4 | Shared-Neon writes this pass | ✅ **zero** (2 read-only SELECTs only) |

## P4B-C. Intended synthetic QA scenario matrix (`P4B-QA-<timestamp>`) — ⏳ STACK-GATED

These are authored as Playwright specs and API fixtures (`apps/web/e2e/supervisor-reservations/`)
and require a disposable Neon branch + isolated API :4001 / web :3100 + Chromium to
**execute** (not available to this background agent — not fabricated):

| # | Scenario | Spec | Status |
|---|----------|------|--------|
| P4B-C1 | New PENDING reservation (create) | create-reservation | ⏳ authored |
| P4B-C2 | Past-time + missing-name validation | create-reservation | ⏳ authored |
| P4B-C3 | Confirm PENDING→CONFIRMED | arriving-actions | ⏳ authored |
| P4B-C4 | Assign table then seat; no-show hidden once seated | arriving-actions | ⏳ authored |
| P4B-C5 | Cancel requires reason | arriving-actions | ⏳ authored |
| P4B-C6 | Overdue PENDING surfaces in Attention (operational copy, no bulk) | attention | ⏳ authored |
| P4B-C7 | Manual complete SEATED→COMPLETED (no linked order) → History terminal | seated-and-completion | ⏳ authored |
| P4B-C8 | History terminal filters + read-only + pagination URL state | history-and-pagination | ⏳ authored |
| P4B-C9 | Supervisor-created reservation visible in Waiter | waiter-visibility | ⏳ authored |
| P4B-C10 | No horizontal overflow × 4 viewports; create dialog fits | responsive | ⏳ authored |
| P4B-C11 | Rows hide contact PII; no payment/deposit/close surfaces; no Orders tab | privacy-and-boundaries | ⏳ authored |
| P4B-C12 | Default Arriving + four views + URL persistence + no Orders tab | navigation-and-default-view | ⏳ authored |

## P4B-D. Stack-gated execution (not run here — not fabricated)

- Live authenticated Supervisor + Waiter + Cashier browser QA, 4-viewport matrix,
  `/api/health`, and the disposable-branch mutation run require a running API/web/
  browser stack unavailable in this background environment.
- **Note:** on shared Neon today, C7 (manual complete) and order-close auto-completion
  would error until `20260518000000_prompt4a_reservation_completed_event` is deployed
  (see `SUPERVISOR_RESERVATIONS_SHARED_NEON_DEPLOYMENT_READINESS.md`); C1–C6, C8–C12
  work on shared today.

---

# Prompt 4C — Shared-Neon Cutover QA Records (2026-07-29)

| # | Check | Result |
|---|-------|--------|
| P4C-1 | Read-only preflight (identity/migrations/enum/perms/counts) | ✅ target=`production`; 1 pending migration; enum lacked COMPLETED; Supervisor lacked `pos:order:transfer`; 126 reservations |
| P4C-2 | Recovery branch (pre-migration snapshot) | ✅ `br-dawn-truth-a4zjs1p7` created + RETAINED |
| P4C-3 | Migration deploy (`db:migrate:deploy`, direct conn) | ✅ only the 4A migration applied |
| P4C-4 | Migration record + checksum | ✅ finished, not rolled back, checksum `8f1317fa…` matches repo |
| P4C-5 | Enum has COMPLETED (all prior retained) | ✅ 10 values |
| P4C-6 | Reservation counts unchanged by migration | ✅ 126 → 126 |
| P4C-7 | `db:seed` → Supervisor `pos:order:transfer` | ✅ role_permissions 835→836 (+1); other counts unchanged |
| P4C-8 | Shared read-only DB smoke (enum/migration/counts) | ✅ via Neon MCP |
| P4C-9 | Isolated API `/api/health` (:4002) | ✅ `{status:ok, db:ok}` |
| P4C-10 | Isolated API branch isolation | ❌ API hit **production** (inherited shell `DATABASE_URL`); 1 QA row created then **deleted** (user-authorized) → production restored to 126/12 |
| P4C-11 | Live reservation matrix + Playwright four-viewport | ⏳ NOT executed (isolation fragility + classifier); closed at B per user; lifecycle proven by Jest 67/67 + compiled Playwright |
| P4C-12 | Disposable branch cleanup / recovery retained | ✅ disposable deleted; recovery retained |
| P4C-13 | Shared-Neon net change | ✅ +1 migration, +1 role_permission; reservation/order/payment/user data unchanged |

**Synthetic marker:** `P4C-QA-20260729-0304Z` (the single created row was on production and was removed; no synthetic dataset persisted).
