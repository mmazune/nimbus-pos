---
reviewer_model: claude-opus-5-5
built_by_reviewer: no
reviewed_sha: eac1494c903f01c176b73fcea5dfaa85613f6cef
verdict: blockers
probes: apps/api/test/quick-sale.review.e2e-spec.ts
---

# H1-R: fresh review of the sale engine (`POST /api/pos/quick-sale`)

Reviewed: the full diff `23c7a2c..eac1494 -- apps packages`, the migration, `03_BACKEND_SPEC.md` §1–§3, `01_DIRECTION.md` (F1, F5, EV-2/5/14/15/16/20/22/23), G1 §2/§3/§8/§9, `reports/H1_EVIDENCE.md`, `H1_READ_BACK.md`, `proof/H1_live.txt`. `git diff b4f1c12..eac1494 -- apps packages` is empty, so the code the evidence pack describes is the code at HEAD.

**How it was run (all [live]).** A disposable Docker `postgres:16` (container `nimbus-event-h1r`, host port 55472, database `nimbus_event_h1r`), `migrate deploy` + `db:seed`, the URL passed inline. Probes are real HTTP against the Nest app in-process, the same `ValidationPipe` options as `src/main.ts`, and the H1 database-name guard. The repo has no `.loadmaster.toml`, so the checks ran through two review-only loadmaster tasks defined in the session scratchpad; nothing was added to the repo. The builder's own suites re-ran green on this database first: e2e **35/35**, unit **50/50**.

**Result of the probe spec (final run on a fresh database, 21 Nov 2026 afternoon, load ≈ 3.9, run after H1's own e2e so the fixture night is present):** 77 tests, **64 pass, 13 fail**. Twelve fail in every full run; the R2 lock-hold measurement is load-sensitive and sits on its threshold (see R2). The failing probes are the findings below and stay red for H1F.

## Verdict

**Blockers: 2** (R3 replay with a different payload; R1 log lacks `clientSaleId` and `branchId`). **Should-fix: 4.** **Notes: 2.**

## Owner rulings, measured

| # | Answer |
|---|---|
| **R1** | **Blocker.** The sale survives a failed audit write and the rows alone are sufficient (`orders.user_id`, `orders.till_code`, `orders.created_at`, `payments.entered_by_id`, `payments.till_code`, `payments.created_at`, all checked). But the error line is `ORDER_QUICK_SALE audit write failed for order <id>: <prisma message>`: no `clientSaleId`, no `branchId`. The ruling requires both. |
| **R2** | **Should-fix.** With 10,000 orders in one branch the number query reads **all of them**: `Aggregate > Index Scan(orders_branch_id_idx)` or `Aggregate > Seq Scan` depending on the run (10,000–10,314 rows read), **13.4 ms** execution in Postgres. With the fix below: `Limit > Index Scan`, **1 row, 0.07 ms**. Lock held, timed in the Node process from the lock statement's return to the transaction's return (so it includes event-loop and round-trip time, not only Postgres), under 10 rounds of 20 concurrent in-process requests: p95 **18.0 / 24.3 / 19.6 / 20.0 / 26.1 ms** over five runs (p50 13–15 ms, max 23–85 ms, 0 non-200, load 2.3–5.8). The ruling's first condition (no index used for the maximum) is met outright; the 20 ms p95 condition is met in 3 of 5 runs. Fix named and proven below. |
| **R3** | **Blocker, confirmed on both paths.** Same `clientSaleId` with different lines, a different tender, or a different till each return **200 `replayed: true`** with the first sale; the second sale is never written. The same happens when the different sale races the first (forced with a probe-only `pg_sleep` trigger on the first insert, so the second request misses the lookup and lands in the unique-violation handler). Optional slip fields correctly do not matter (control passes). |

## Findings

| id | severity | file:line | what is wrong | failure scenario on event night | fix | probe (red today) |
|---|---|---|---|---|---|---|
| F-1 | **blocker** | `apps/api/src/modules/quick-sale/quick-sale.service.ts:82-83`, `:99-101`, `:130-139` | The replay path returns the stored sale for any request with a known `clientSaleId`, without comparing it. Same on the unique-violation race path (`:99`). | A tablet bug or a reset id counter reuses an id: DRK-03 rings 2 Nile by Visa, later 3 Club by cash under the same id. The till is told "synced", shows no error, and the 3 Clubs and their cash are gone from every figure and from the sponsor report. Nobody can find them afterwards. | Before returning a replay (both paths), compare the request to the stored sale: `tillCode`; `payment.method` plus `cardScheme`/`momoNetwork`; lines as a multiset of (item id resolved from `sku` or `menuItemId`, `menuItemServingId`, `quantity`). Any difference: 409 `CLIENT_SALE_ID_REUSED`, nothing written. Exclude `authCode`, `cardLast4`, `terminalId` (and treat `tenderedAmount`, `soldAt`, `externalTransactionId`, `payerPhone` as non-identifying unless the owner says otherwise). | `A1 (R3)` × 4: "different lines", "different tender", "different till" (lookup path, `:82-83`); "R3 race (unique-violation path)" (`:99-101`). Fixing only one path leaves the other probe red. |
| F-2 | **blocker** | `quick-sale.service.ts:365-366` | Audit failure is logged without `clientSaleId` or `branchId` (ruling R1). | The audit table is briefly unwritable (disk, lock, migration). Sales go through, and the only trace of the failure is an order id. Matching that log line back to a till's offline queue and branch needs a database lookup per line, during the event. | Log, at error level, `orderId`, `orderNumber`, `clientSaleId`, `branchId`, `tillCode` as fields (no card data). | `R1` › "the error log carries order id, clientSaleId and branchId" |
| F-3 | should-fix | `apps/api/src/modules/orders/order-number.ts:20-23` | The maximum is computed by evaluating the regex on every order in the branch while the branch lock is held (R2). Lock hold grows with the branch's order count and serialises every till in the branch. | Ten tills in one branch at the 22:00 rush, plus offline queues replaying: sales in a branch are serialised by the lock, and each one pays a scan that grows with every sale already made. Measured in Postgres: 13.4 ms for the scan alone at 10,000 orders, against 0.07 ms with the index. At this size it still works (0 failures in 800 measured sales); the risk is that the per-sale cost keeps growing as the night goes on, and the queue lengthens with it. Derived from the measurements, not load-tested: H2 owns the load test. | Additive migration: `CREATE INDEX … ON orders (branch_id, (CAST(SUBSTRING(order_number FROM '^ORD-([0-9]+)$') AS BIGINT)))`. Change the query to `MAX(` that same expression `)`. Proven in the probe: plan becomes `Limit > Index Scan`, **1 row read**, same answer as today. **Do not** use "highest `order_number` via the existing unique index": it sorts as text, and the probe shows `ORD-999999` sorts above `ORD-1000001`. | `R2` › "the number query reads a handful of rows" (the gate for this fix); "lock held … p95 <= 20 ms" (a load-sensitive measurement, passed in 3 of 5 runs; not a gate on its own) |
| F-4 | should-fix | `order-number.ts:21` | `CAST(… AS INTEGER)`: one row `ORD-` + more than 10 digits (≥ 2^31) in the branch makes every quick sale in that branch a **500** (`22003 value out of range for type integer`). | A demo import, a manual fix or a test row with a long number lands in an event branch. Every till in that branch fails every sale for the whole night, and offline queues keep replaying into 500s. | Cast to `BIGINT` (or `NUMERIC`); the F-3 index uses `BIGINT` already. | `B5` › "an ORD- number beyond 2^31 … does not stop the branch selling" |
| F-5 | should-fix | `apps/api/src/modules/quick-sale/dto/quick-sale.dto.ts:104` (and `tills/dto/open-till.dto.ts:8`, `tills/tills.service.ts:389`) | `tillCode` is matched byte for byte. Cash posted as `drk-03`, `DRK-03 ` or ` DRK-03` is accepted (200) but counted in **no** till's expected cash. A till code with no session at all is accepted the same way (note N-2). | One tablet is set up with `drk-03`. All night its cash is in the drawer but not in DRK-03's expected cash. At cash-up DRK-03 shows a large overage, and no till shows the matching shortfall. | Normalise at both ends with one helper: `trim()` + upper-case, via `@Transform` on `QuickSaleDto.tillCode` and `OpenTillDto.tillCode`. Optionally restrict to `^[A-Z0-9-]{1,20}$`. Existing sessions keep their code. | `F13` × 3: `"drk-03"`, `"DRK-03 "`, `" DRK-03"` |
| F-6 | should-fix | `quick-sale.dto.ts:73`, `:78` (comment at `:24`) | `authCode` (≤ 32 chars) and `terminalId` (≤ 64) accept a full card number. `4111111111111111` is stored in `payments.auth_code`/`terminal_id` and echoed in the response. The DTO comment says no field can carry one. | A cashier in a hurry types the long number from the slip into the approval-code box. A full card number now sits in plain text in the database and in the till's response cache: card data the event was never meant to hold. | Restrict `authCode` to `^[A-Za-z0-9]{1,12}$` (approval codes are 6). Refuse any `terminalId` or `externalTransactionId` containing a 13–19 digit run that passes Luhn. The refusal message must not echo the value (it currently does not). | `H18` › "a full card number typed into authCode / terminalId is refused" |
| N-1 | note | `quick-sale.service.ts` (plan) | An item priced 0 makes a CLOSED sale with a COMPLETED payment of 0. | Probably intended (free water, comps). Payment-mix counts get a zero-value row per such sale. | Owner decision; no change proposed. | `C9` › "note: an item priced 0 …" (passes; documents) |
| N-2 | note | `03` §2 "Skipped on purpose" | Cash at a till code with no open session (`DRK-99`) is accepted and counted by no till. This is `03`'s explicit choice, so it is not a finding here. It is the same failure route as F-5, though, and it makes F-5 silent. | As F-5. | If F-5 is fixed, consider at least a warning flag in the response for an unknown till code. | `F13` › "note (documents …)" (passes; documents) |

## Negative controls (both run, both red, both restored)

| # | Mutation (scratch copy, restored from the copy) | Probe | Result with the mutation |
|---|---|---|---|
| 7 | `order-number.ts`: removed the `pg_advisory_xact_lock` line | `B7` › 20 concurrent sales in one branch | **Red**: 19 of 20 responses non-200 (green at HEAD: 20 × 200, 20 distinct contiguous numbers) |
| 14 | `tills.service.ts:389`: removed `OR: [{ tillCode }, { tillCode: null }]` | `F14` › each till's expected cash is its own | **Red**: DRK-01 expected 52,000, wanted 32,000 (green at HEAD) |

After each, `git diff --exit-code -- apps/api/src packages/db` returned 0.

## Checked and found sound

| Area | What | Probe (passes) |
|---|---|---|
| A2 / EV-22 / G15 | A Supervisor voids a quick sale with their own PIN within 15 minutes: order VOIDED, payment REFUNDED. Replaying it afterwards returns the original (VOIDED, REFUNDED, `replayed: true`) and writes no new order. | `A2 + G15` × 2 |
| A3 | A unique violation on another constraint (a probe-only unique index on `payments.auth_code`) is not taken for a replay: it rolls back, writes nothing, returns no order. It surfaces as a 500 (acceptable for a constraint that does not exist in the product). | `A3` |
| A4 | `orgId`, `organizationId`, `branchId` in the body: 400. The same `clientSaleId` in another organisation makes a new sale there, so the lookup is scoped by the guard's organisation. | `A4` × 2 |
| B5 | Odd newest numbers (`EVT-77`, `ORD-12A`) do not reset the counter. After `ORD-999999` come `ORD-1000000`, `ORD-1000001`. | `B5` × 2 |
| B6 | A forced one-shot `order_number` collision (a `BEFORE INSERT` trigger driven by a sequence, which survives the rollback) is retried in a **new** transaction: 200, `ORD-000002`, the trigger fired (control). | `B6` |
| B7 | 20 concurrent sales: 20 distinct contiguous numbers, no failures. | `B7` |
| C8 | `price`/`unitPrice` on a line, `total` at the top, `amount` in payment: 400, nothing written. | `C8` × 4 |
| C9 | Quantity 0, −1, 1.5, 10^9, `"2"`; 101 lines; empty lines; payment as an array; total 10^11; tendered 10^15; tendered with 3 decimals: all 400, never 5xx, nothing written. 100 lines (800,000) and quantity 1000 (4,000,000) priced exactly. | `C9` × 14 |
| C10 | Every quick-sale order in the database has exactly one payment, and `amount = total`: 504 rows on the final fresh database, **including all 200 rows of H1's fixture night** (checked by their `night-` ids), and 803–1,050 rows on the first database. No `parseFloat`, `toFixed`, `Number(`, `Math.` or `.toNumber(` in the service or allocator; money is `Decimal` throughout. | `C10` × 2 |
| D11 | `menuItemId` from another branch, from another organisation; a serving of another item: 400. A branch without membership, another organisation's branch: 403. Permissions are all-of: a Waiter (holds `pos:orders:write` only) gets 403. Nothing written in any case. | `A4 + D11` × 6 |
| E12 | Unknown field inside `payment` and inside a line: 400 (nested whitelist works). Card fields on cash, bad `cardLast4` (3 digits, letters, 5 digits), over-long `authCode`/`terminalId`/`tillCode`/`externalTransactionId`/`payerPhone`, empty `tillCode`, unknown scheme or method, `soldAt` without offset, bad `clientSaleId`: all 400, nothing written. | `E12` × 18 |
| F13 / F14 | Exact till code reaches its till's expected cash; two tills in a branch each count only their own cash (plus no-till cash). | `F13` exact, `F14` |
| G16 / EV-16 | `GET /api/dash/today-summary` as Manager, branch a: `closedOrders` 9 → 10, `grossSales` 4,848,000 → 4,856,000, `paymentMix.card` 4,848,000 → 4,856,000 after one 8,000 Visa quick sale. | `G16` |
| H17 | `migrate deploy` on an empty DB (60 migrations, exit 0). On the seeded DB: H1's objects stripped and its row deleted, then `migrate deploy` re-applied only `20261121000000_event_till_quick_sale` (exit 0). `prisma migrate diff --from-url <db> --to-schema-datamodel` afterwards: **0** lines mention any event column, enum or index. Pre-existing drift listed separately below. | command output, this session |
| H18 | Audit metadata of a card sale carries no last four or approval code. A refused `cardLast4` is not echoed in the 400. The R1 error log carries no card data. | `H18` × 2, `R1` × 1 |
| R1 rows | Order and payment rows alone show who, which till, when. | `R1` › "rows alone" |
| Restaurant flow unchanged | H1's only edit to it is the optional `client` parameter on `computeLinePricing`. Its two callers (`orders.service.ts:495`, `:577`) do not pass it, so both still use `this.prisma`. The `orders`, `payments` and `refunds` unit specs: **83/83**. `tills.service.ts:389` changes the restaurant path only by also counting `till_code IS NULL` cash, which is what it counted before. | unit run + grep, this session |

**Pre-existing drift (not H1):** `migrate diff` produces 85 statements on 15 tables, none event-related: `api_keys`, `branches`, `devices`, `feature_flags`, `flag_audits`, `forecast_runs`, `idempotency_keys`, `integration_access_logs`, `maintenance_windows`, `organizations`, `printer_routes`, `sync_conflicts`, `sync_job_attempts`, `sync_jobs`, `training_sessions` (FK renames and `updated_at` defaults).

## Not checked

- **Offline replay after the till is reconciled.** Expected cash windows on `payments.created_at`, not `soldAt`. A cash sale replayed after its till session closed should land in no session, or in a later session that reuses the code. Not probed, for time.
- **Receipt history (suspected, not proven).** `ORDER_QUICK_SALE` is not in `ORDER_LIFECYCLE_ACTIONS` (`receipts.service.ts:45-49`), so `GET /api/receipts/:id/history` probably omits the sale event. Read in code only. If it holds, the fix is to add the action to that set.
- **`todayRange()`** uses the server's local midnight, so a sale after midnight Kampala time may fall into the next day's dashboard depending on the server's zone. Reports are H4a's scope; not probed.
- **Connection-pool exhaustion** beyond 20 concurrent (`maxWait 5000`). H2 owns the load test.
- **Harness flakes, disclosed.** Run 1 had two 404s (`C9` zero-price, `F14`). One later run had a "socket hang up" (`E12` empty `tillCode`). No guard, filter or middleware in this route returns 404. Both probes passed in every other run and in isolation, and the load average was 3–6. I read them as supertest transport failures, not product behaviour: suspected, not proven. H1's own e2e showed the same class on the fresh database: `read ECONNRESET` in its 20-concurrent test. The requests still in flight then landed inside the next test ("CARD without cardScheme") and broke its order-count check (43 expected, 61). The same suite was 35/35 on the first database. Worth hardening before it is used as a gate (await all in-flight requests on failure; a retry-free transport).
- Web and the Postman collection: out of scope (the restaurant flow is under "Checked").

## Probes that fail today (for H1F to turn green)

1. `A1 (R3)` › R3 different lines: second post is 409 and only the first sale exists
2. `A1 (R3)` › R3 different tender: …
3. `A1 (R3)` › R3 different till: …
4. `A1 (R3)` › R3 race (unique-violation path): a different sale racing the first under the same id is a 409
5. `R1` › the error log carries order id, clientSaleId and branchId
6. `R2` › the number query reads a handful of rows, not every order in the branch
7. `R2` › lock held (lock acquired -> commit returned) p95 <= 20 ms over 10 rounds of 20 concurrent sales (load-sensitive; passed in 3 of 5 runs)
8. `B5` › an ORD- number beyond 2^31 in the branch does not stop the branch selling
9. `F13` › "drk-03": the cash reaches DRK-03 expected cash (or the sale is refused)
10. `F13` › "DRK-03 ": …
11. `F13` › " DRK-03": …
12. `H18` › a full card number typed into authCode is refused (400), not stored
13. `H18` › a full card number typed into terminalId is refused (400), not stored

Run: first H1's own `test/quick-sale.e2e-spec.ts` (it writes the fixture night the C10 control looks for), then `DATABASE_URL=<disposable nimbus_event_* URL> npx jest --config ./test/jest-e2e.json --runInBand test/quick-sale.review.e2e-spec.ts` from `apps/api` (through loadmaster where a task exists). The spec creates its own organisations, users (generated passwords) and branches, and suffixes every `clientSaleId` with a random run id, so it can re-run on the same database.
