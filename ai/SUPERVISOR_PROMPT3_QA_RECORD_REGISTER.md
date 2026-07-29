# Supervisor Prompt 3 — QA Record Register

> Register of QA data touched across Supervisor Reconstruction Prompt 3
> (3A → 3B1 → 3B2 → 3B3A → 3B3B → **3C consolidation**).
> Created by Prompt 3C. Do **not** silently delete audited records.

Last updated: 2026-07-28 (Prompt 3C consolidated live-QA pass).

---

## 0. Scope note for Prompt 3C

Prompt 3C is a **closure and verification** pass. In **this session** the live,
mutating API QA (§11–§23 of the 3C prompt) was **NOT executed against the shared
Neon demo database**, for two documented reasons:

1. The active `DATABASE_URL` targets a **shared live Neon instance**
   (`ep-empty-paper-…-pooler.us-east-1.aws.neon.tech`), not a throwaway local DB.
   Running the full destructive matrix (create/split/move/merge/void/discount on
   real demo orders) would churn shared demo data and leave audited records on it.
2. The environment's safety classifier **blocked direct database writes**, and no
   isolated test database was provisioned.

Therefore **Prompt 3C created zero new mutated business records.** The verification
that WAS performed this session is **non-mutating**: static gates, code-level
locked-decision verification, direct **read-only** DB inspection of permission
state, the API `orders.service` Jest suite, Postman JSON validation, and (where the
API booted) a read-only `/api/health` + `/auth/me` permission read.

The mutating live-QA records below (Prompts 3A / 3B1) were created by **earlier
prompts in their own environments** and are reproduced here for continuity.

---

## 0b. Prompt 3D — ISOLATED destructive QA executed (2026-07-28)

Prompt 3D provisioned a **disposable local Postgres** (Docker `postgres:16`,
`nimbus_prompt3_qa` on host port 55432) — **NOT** the shared Neon DB — applied all
migrations + `db:seed` + `db:demo:import`, and ran the full destructive matrix
against an isolated API (:4001) / web (:3100) stack. The authorized
`pos:order:transfer` mapping IS present there (Supervisor `HAS_TRANSFER=true`),
so Transfer table works at runtime on the isolated DB.

- **API mutation matrix:** 41 checks, all in-scope actions + rejection cases +
  idempotency replays PASS (3 initial harness/expectation items reconciled — see
  the 3D completion report). Marker `P3D-QA-<timestamp>`; ~24 transient orders +
  several discounts created ON THE DISPOSABLE DB only.
- **Defect found & fixed (backend):** `GET /pos/orders/:id/discounts?pageSize=N`
  returned **400** (query `pageSize`/`page` not coerced to number) — this is the
  exact read the Supervisor **Discounts panel** uses (`?pageSize=50`), so the panel
  read was broken. Fixed by adding `@Type(() => Number)` to
  `ListOrderDiscountsQueryDto` (mirrors the orders-list DTO). Now 200; complimentary
  `metadata {complimentary,category}` round-trips through that read. Focused DTO
  Jest spec added (6 tests, pass).
- **Playwright browser QA** across four viewports (1024×768 / 1366×768 / 1440×900 /
  1920×1080): auth, Floor + 4-tab nav (no Orders), Find order, workspace actions,
  Request bill through the real dialog, legacy-route redirect, role boundaries,
  responsive overflow, Waiter/Cashier regression.
- **All transient QA records live on the disposable DB**, which is destroyed at
  cleanup — no audited records were created on shared Neon.

## 1. Prompt 3C records (this session)

| # | Purpose | Record type | ID / result | Mutation? | Remains? | Cleanup |
|---|---------|-------------|-------------|-----------|----------|---------|
| — | Runtime permission verification | **read-only** DB inspect of `role_permissions` for role `Supervisor` (id `cmqlcft890006wp6loken0xub`) | Confirmed 9/10 grants present; **`pos:order:transfer` MISSING** | No | n/a | n/a |
| — | API order-service contract check | Jest unit suite `orders.service.spec.ts` | 26/26 passed (exit 0) | No | n/a | n/a |

**No orders, discounts, refunds, transfers, splits, merges, moves, or voids were
created or mutated by Prompt 3C.**

---

## 2. Pre-existing demo fixtures (unchanged)

The shared Neon DB is fully migrated (164 public tables) and pre-populated with the
project's demo dataset (organizations, branches, tables, menu, seeded orders,
users + quick PINs). Prompt 3C did **not** modify seed/demo import and did **not**
run `db:seed`. See `packages/db/prisma/seed.ts` / `demo-import.ts`.

---

## 3. Prior-prompt QA records (continuity — created by earlier prompts)

> These were logged as created by earlier prompts' own live QA (see each prompt's
> completion report and `ai/AI_STATUS.md`). They were **not** re-verified live by
> Prompt 3C. Left in place (audited); no cleanup performed.

### Prompt 3A (per its completion report)
- 1 demo order transitioned **READY → SERVED** (Mark served).
- Request-bill acknowledgements (audit-only, no state row).

### Prompt 3B1 (per its completion report)
- 1 **split-bill** payable-allocation metadata record (EQUAL, 3 groups, allocated == total).
- 1 **child split-items** order created (`ORD-…-S1`, status NEW).
- 1 **move-items** transfer between two orders (source/target totals updated).
- 1 **merged** source order left **VOIDED** (`mergedIntoOrderId` = surviving target).

### Prompts 3B2 / 3B3A / 3B3B
- No live mutating QA recorded in-environment (their reports mark live/browser QA
  as **PENDING** — the debt this 3C pass was meant to close). Transfer table,
  Find order, active-order Void, and the discount lifecycle were verified in
  **code** only by those prompts and re-verified in **code** by 3C (§ below).

---

## 4. Outstanding live-QA debt (carried forward)

The following require an **isolated/authorized database** and, for the browser
matrix, **browser automation tooling** (neither available this session):

- Live API mutation QA for Transfer table, Find order, active-order Void, Discount
  request/approve/reject, and Complimentary (§11–§23).
- Authenticated browser QA + four-viewport matrix + screenshots (§25–§27).
- The `pos:order:transfer` Supervisor mapping must be **applied** (see the
  completion report's "Defects / Gaps" section) before Transfer table can be
  exercised at runtime — it currently 403s for Supervisor on the live DB.
