---
reviewer_model: claude-opus-5-5
built_by_reviewer: no
reviewed_sha: a1a4f1de9da0e933ab7c1384e7523aa6b34ec01b
verdict: pass
round: 2
round_1_reviewed_sha: eac1494c903f01c176b73fcea5dfaa85613f6cef
round_1_verdict: blockers
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

---

# Round 2 (H1-R2): second look at the H1F fixes

```yaml
reviewer_model: claude-opus-5-5
built_by_reviewer: no
reviewed_sha: a1a4f1de9da0e933ab7c1384e7523aa6b34ec01b   # product code; 09120ec adds only the H1-R2 prompt
diff_reviewed: git diff ede9ea7..a1a4f1d -- apps packages tools
verdict: pass
probes: apps/api/test/quick-sale.review.e2e-spec.ts (describe "H1-R2", plus P1/P2 edits)
```

**Verdict: pass. Blockers 0 · should-fix 2 · notes 5.** All six round-1 findings are fixed in the code. Of the 13 round-1 probes, 12 pass in every run with P1 and P2 applied; the 13th (R2 lock-hold p95 ≤ 20 ms) is timing-dependent and passed in 4 of 8 runs here (N-5). All 13 passed together in one full run. No product code was changed in this review.

**How it was run [live].** Disposable Docker `postgres:16` `nimbus-event-h1r2` (:55474), fresh databases created inside it (`nimbus_event_h1r2`, `_mig`, `_q9`, `_final`), `migrate deploy` + `db:seed`, URL passed inline, no `.env*` read or written. Baseline: `nimbus-event-h1r2-base` (:55475) and a temporary worktree. Every check went through loadmaster with a throwaway `.loadmaster.toml` (kept out of git, removed at the end). The machine was **not quiet**: load 4.4–12 throughout, from other sessions.

**Final result of the probe spec on a fresh database** (`nimbus_event_h1r2_final`, after H1's own e2e 31/31): **100 tests**. All 13 round-1 probes that were red now pass (first clean run on the first database: 99/99, before the round-2 note probes were added). On the fresh database, two full runs were 99/100 each: run 1 lost one probe to the foreign-process 404 (N-4), run 2 lost the load-sensitive R2 lock-hold timing (N-5). The round-2 block is 21 green + 2 red; the 2 red are S-1 and S-2 below and stay red until fixed.

**Last run, the committed spec as is** (fresh `nimbus_event_h1r2_last`, migrate + seed, H1's e2e 31/31 first, load 18–23): **96 / 100**. Red: S-1 and S-2 (expected), R2 lock-hold (p95 57.4 ms at load 23; N-5), and F14, which got a foreign 404 (N-4, answered by `claude` PID 2400 on `127.0.0.1:49637`).

## a. The two probes (owner rulings P1, P2)

```diff
@@ A3: a unique violation on another constraint is not treated as a replay
+      // H1-R2 (owner ruling P1): authCode is capped at 8 letters or digits, so the code is
+      // 'P2' + the 6-hex run id (8 chars). The probe index covers exactly this run's code ...
+      const code = `P2${RUN}`;
+      await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS h1r_probe_authcode_uq');
       await prisma.$executeRawUnsafe(
-        `CREATE UNIQUE INDEX IF NOT EXISTS h1r_probe_authcode_uq ON payments (auth_code)
-         WHERE auth_code LIKE 'P2002%'`,
+        `CREATE UNIQUE INDEX h1r_probe_authcode_uq ON payments (auth_code)
+         WHERE auth_code = '${code}'`,
       );
-      const code = `P2002${RUN}`;

@@ R2: allocator with 10,000 orders in one branch
-    const ALLOC_SQL = (b: string) => `
-      SELECT MAX(CAST(SUBSTRING(order_number FROM '^ORD-([0-9]+)$') AS INTEGER)) AS max
-      FROM orders WHERE branch_id = '${b}'`;
+    // H1-R2 (owner ruling P2): the probe examines the query the allocator REALLY runs ...
+    const realAllocatorQuery = async (b: string): Promise<Prisma.Sql> => {
+      const seen: Prisma.Sql[] = [];
+      const stand = {
+        $executeRaw: async () => 0,
+        $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
+          seen.push(Prisma.sql(strings, ...values));
+          return [{ max: null }];
+        },
+      } as unknown as Prisma.TransactionClient;
+      await allocateOrderNumber(stand, b);
+      expect(seen).toHaveLength(1);
+      expect(seen[0].values).toEqual([b]);
+      return seen[0];
+    };
+    const runReal = async (q: Prisma.Sql) =>
+      (await prisma.$queryRawUnsafe<{ max: string | null }[]>(q.text, ...q.values))[0].max;
 ...
-      const e = await explain(ALLOC_SQL(branch.perf));
+      const q = await realAllocatorQuery(branch.perf);
+      const e = await explain(q.text, q.values);
+      // its answer agrees with the maximum computed in JS over every row of the branch
+      expect(all.length).toBeGreaterThanOrEqual(10000);
+      expect(await runReal(q)).toBe(jsMax.toString());
+      expect(e.scanned).toBeGreaterThanOrEqual(1);
       expect(e.scanned).toBeLessThanOrEqual(10);
```

- **P1, unchanged or stronger:** the property is the same (a P2002 on another unique constraint is never answered as a replay and writes nothing). The probe index now covers one exact value instead of a prefix, so nothing else in the database can trip it, and a stale index from an interrupted run is dropped first.
- **P2, stronger:** the probe now calls the real `allocateOrderNumber` and EXPLAINs the exact `Prisma.Sql` it sends, with its bound value. If the code's query ever stops matching the index, this probe goes red; a hand-copied query could not. It also checks the query's answer against a JS maximum over every row (a plan that reads nothing cannot pass).
- Result: `Result > Limit > Index Scan(orders_branch_id_order_number_numeric_idx); order rows read: 1; execution 0.04–0.19 ms` on 10,000 rows, in every run.
- Two harness fixes in the same file, no assertion weakened: the round-1 "named fix check" now drops its BIGINT probe index in `finally`, and builds it partial on its own branch. A whole-table BIGINT index **cannot even be built** once any row holds a 19+ digit `ORD-` number (`22003 … out of range for type bigint`, seen live): that is P4's reason for NUMERIC. The `post` helper now records who answered on any 404 (question 10).

**P3: confirmed.** `tools/check-event.allow.json` has one entry: file `apps/api/test/quick-sale.review.e2e-spec.ts`, pattern `pan-field`. `4111111111111111` is the published Visa test number (Luhn-valid, never issued). `check:event` is green and reports exactly 1 allowed hit. One caveat to note: the gate matches on file plus pattern, not line, so a future `pan` field anywhere in that one file would also be allowed. The round-2 code adds no `pan` identifier (and avoids the `card-number` pattern), so the count stays 1.

## Findings (round 2)

| id | severity | file:line | what is wrong | failure scenario on event night | fix | probe |
|---|---|---|---|---|---|---|
| S-1 | should-fix (the brief asked for a note; raised because H1F's expected-cash change is what makes both sessions count the same cash) | `apps/api/src/modules/tills/tills.service.ts:55-61` (open: exact-match duplicate check), `:393-397` (H1F widened expected cash to `[code, normalize(code)]`), `tills/dto/open-till.dto.ts:8` | Till open still compares codes byte for byte, so `DRK-03` and `drk-03` can both be OPEN in one branch. Since H1F, both sessions count every quick sale stored as `DRK-03`. | A supervisor opens `drk-03` for a relief cashier while `DRK-03` is still open. Every DRK-03 cash sale is now expected in both drawers. At cash-up the second drawer shows a shortage equal to all of DRK-03's cash, and someone is accused of a shortfall that never happened. | Normalise `OpenTillDto.tillCode` with the same `normalizeTillCode` `@Transform`, and make the duplicate-open check compare normalised codes. Existing sessions keep their code. (The till-open path was out of H1F's scope, so this is a follow-up, not an H1F defect.) | `H1-R2 › 6 › S-1` red: `second open as "drk-03": OPENED; expected cash DRK-03 8000, drk-03 8000` for one 8,000 sale |
| S-2 | should-fix | `apps/api/src/modules/quick-sale/dto/quick-sale.dto.ts:91-94` | `externalTransactionId` (≤ 100 chars) on a mobile-money sale accepts a full card number: 200, stored in `payments.external_transaction_id`. Round 1's F-6 fix named a Luhn check for this field; H1F made it MoMo-only, which closes card and cash sales but not this. | A cashier rings a MoMo sale and types the long number from the wrong slip (a card slip) into the transaction-id box. A full card number sits in plain text in the database. | Refuse any 13–19 digit run that passes Luhn in `externalTransactionId` (MTN/Airtel ids are shorter or not Luhn-valid; confirm on a captured real id first). The message must not echo the value. | `H1-R2 › 7 › S-2` red: `HTTP 200; stored rows 1; echoed false` |
| N-1 | note | `packages/db/prisma/migrations/20261121100000_event_order_number_index/migration.sql:10-11`, `apps/api/src/modules/orders/order-number.ts:29` | **P4, answered honestly: the index can fail an insert, but only past 131,072 digits.** Every value in the brief inserts fine through Prisma (`ORD-`, `ORD-abc`, `ORD-1e5`, `ORD-12 34`, `''`, 40 digits, 400 digits). NUMERIC has a ceiling of 131,072 digits before the point. A compressible number (repeated digits) passes the text unique index, so `ORD-` plus 131,073+ nines is refused **by the new index** (`22003 value overflows numeric format`). Control in psql, in a rolled-back transaction with the index dropped: the same insert succeeds. And one stored row of exactly 131,072 nines makes the next allocated number overflow: **every quick sale in that branch is a 500** (the F-4 class, threshold moved from 11 digits to 131,072). | None realistic: no API DTO takes an order number. Only the demo CSV import, the seed or manual SQL could write one. | Optional: bound the digits in both the index and the query, e.g. `'^ORD-([0-9]{1,18})$'` (then a longer value is NULL and ignored, and the cast can never overflow). It needs a new additive migration: create the new index, then drop the old one, with the query changed in the same PR. | `H1-R2 › 3 › note: NUMERIC ceiling` logs `insert 131072 nines ok; insert 131073 nines FAIL 22003 numeric overflow; next quick sale in that branch HTTP 500`; psql control above |
| N-2 | note | `apps/api/src/modules/quick-sale/quick-sale.service.ts:70`, `:225` | The fingerprint compares `soldAt` as a string. The same instant written with another offset (`…21:04:00+03:00` vs `…18:04:00Z`) is a 409, not a replay. | Only bites if the till's offline queue re-serialises `soldAt` on retry (e.g. `toISOString()` in UTC). The sale is stored once (no loss, no duplicate), but the tablet shows a conflict for a sale that did land. If the cashier then re-rings it under a new id, it is counted twice. | Compare instants (`Date.parse`) rather than strings; or confirm the till client sends the queued payload byte for byte. | `H1-R2 › 1 › note: soldAt` logs `200 then 409` |
| N-3 | note | `quick-sale.service.ts:222` | A sale stored before H1F (no `metadata.fingerprint`) is compared on till, method, scheme/network and lines only. An identical retry replays (200, `replayed: true`), different lines are a 409, but a different `tenderedAmount` is still a replay (200, `replayed: true`). No server error in any case. | Only pre-H1F rows; the event till is not deployed, so none exist outside test databases. | None needed; documented as the behaviour. | `H1-R2 › 1 › pre-H1F sale` logs `identical 200/true; other tender 200/true; other lines 409` |
| N-4 | note | `apps/api/test/quick-sale.review.e2e-spec.ts:114` (and every spec using `request(app.getHttpServer())`) | **Question 10, cause found [live]:** the empty-body 404 is answered by **another process**. Supertest opens a new ephemeral server per request; one request went to `http://127.0.0.1:56187`, and the reply was `text/plain "not found"` from `claude` PID 74501, which listens on `127.0.0.1:56187` (`lsof`, captured at that moment). The next time it was PID 2400 on `127.0.0.1:49637`: other Claude sessions' local servers on this machine. The ephemeral server shared the port number on another binding, and the loopback request reached the other process. It is a harness defect, not product behaviour. | None in production (the API listens on a fixed port). In CI or on a busy dev machine, a probe can fail with a 404 that no route returned. | Listen once, bound to `127.0.0.1` explicitly (`await app.listen(0, '127.0.0.1')`, then `request('http://127.0.0.1:' + port)`), so a clash fails loudly with `EADDRINUSE`. H1F already listens once in its own spec. | `post` helper diagnostics: `H1R2-404 url=http://127.0.0.1:56187/api/pos/quick-sale … text="not found" … claude 74501 … 127.0.0.1:56187 (LISTEN)` (seen in 3 of 9 full runs, answered by two different `claude` processes, PIDs 74501 and 2400) |
| N-5 | note | `quick-sale.review.e2e-spec.ts` R2 lock-hold probe; `quick-sale.h1f.e2e-spec.ts` part c | The lock-hold p95 gate (≤ 20 ms, timed in Node: event loop and round trips included) is unstable on this machine: 6.8 ms at load 4.4 but 20.9 and 38.1 ms at load 5.0, 102 ms at load 12. **Cause not isolated** (other sessions' CPU, the event loop, or pool waits). The Postgres side is fixed (1 row, ≤ 0.2 ms). | None from the code. As a gate it is unreliable on a shared machine. | Keep "index used, 1 row read" as the gate (now real, P2). Measure lock hold on Thursday's load test on a quiet box. | see "Allocator" below |

## b. Probes 1–8

1. **Replay fingerprint [live].** Two different sales under one `clientSaleId`, fired together, 10 times: every time exactly one 200 (`replayed: false`) and one 409 (`replayed` absent), one order. This shows the outcome, not which path produced it. The unique-violation path is proven by round 1's forced-race probe (`A1 (R3) › R3 race`, a `pg_sleep` trigger on the first insert), which is green. Two cash sales differing only in `tenderedAmount`: one 200, one 409 naming `payment.tenderedAmount`. An identical retry fired together with the original: one `false`, one `true`, same order id; a later retry: `true`. The stored fingerprint has exactly `soldAt` and `tenderedAmount`; the order's metadata holds no last four and no approval code. Pre-H1F rows: N-3. The 409's `differs` names fields only, never values; the mismatch warning logs names only.
2. **Real case [live].** Two beers by Visa at DRK-03 with `soldAt`, posted twice at the same moment: one sale, `replayed` false/true, same order, branch +1 order, total 8,000, one CARD/VISA payment of 8,000, `till_code` `DRK-03`, one line of quantity 2. H1's own e2e 31/31 (two fresh databases).
3. **Index never fails an insert [live]: not proven; it can, past 131,072 digits (N-1).** All seven values from the brief insert through Prisma with the index present. The allocator ignores the non-matching ones: a branch holding only `ORD-`, `ORD-abc`, `ORD-1e5`, `ORD-12 34`, `''` allocates `ORD-000001`, and a branch holding the 40- and 400-digit numbers allocates the 400-digit number + 1 exactly. Random-digit numbers of 5,000 and 8,000 digits are refused by the **existing text unique index** first (`index row size 5048 exceeds btree … maximum 2704`). Text is about twice the size of NUMERIC for the same digits, so the new index never refuses first there. The one way it does is N-1. Restaurant flow `POST /api/pos/orders` (Manager, takeaway) with the index present: 201, `ORD-000015`.
4. **Allocator [live].** Index used and 1 row read (above). `ORD-999999` → `ORD-1000000` → `ORD-1000001` and a branch above 2³¹ sells (round-1 B5, green). Lock held, p95 over 200 sales per run, review spec: 14.6 / 6.8 / 14.1 / 16.2 / 24.0 / 20.9 / 38.1 / 102.4 ms at load 4.4 / 4.4 / 7.1 / 8.2 / 7.5 / 5.0 / 5.0 / 12.0. H1F's own five-run test, three times: 14 of 15 runs ≤ 20 ms (5.9–23.2 ms, load 7–9). 0 non-200 in all 4,600 measured sales. **Under 20 ms at p95 is not established on this machine today;** it was never quiet (N-5). **Negative control:** with the `pg_advisory_xact_lock` line removed in place (copy restored afterwards, `git diff --exit-code -- apps/api/src packages/db` = 0), B7 goes **red** (19 of 20 non-200).
5. **Migration [live].** Applies on an empty database (61 migrations, index present). On a database brought to H1's state from a scratch copy of the migrations folder, a second `migrate deploy` applied only `20261121100000_event_order_number_index`. `prisma migrate diff --from-url <that db> --to-schema-datamodel schema.prisma --script`: 253 lines, **0 `DROP INDEX`, 0 mentions of the new index, 0 statements on `orders`**. All 253 are pre-existing drift (the same 15 tables as round 1). Prisma does not model expression indexes, so it neither drops nor recreates this one. Additive: one `CREATE INDEX`, nothing altered or dropped.
6. **Till codes [live].** `drk-03` and `DRK-03 ` are stored as `DRK-03` and reach the session opened as `DRK-03` (float 10,000 + 2 × 8,000 = 26,000). Both case variants open at once: S-1.
7. **Card number in a text field [live].** A 16-digit number in `authCode` or `terminalId`: 400, no order, no payment row holding it, not in the response body, and not in any `Logger` (log/warn/error/debug/verbose/fatal) or `console` output during the request. `externalTransactionId` and `payerPhone` on a card sale and on a cash sale: 400 each, nothing written. Remaining gap: S-2.
8. **Audit failure log [live].** With the audit insert forced to fail: sale 200, no audit row, and one error line `ORDER_QUICK_SALE audit write failed {"orderId","orderNumber","clientSaleId","branchId","tillCode":"DRK-03","error","reason"}`. The till code was sent as `drk-03` and logged normalised. No last four, approval code or terminal id in it. `reason` is the last line of the database error capped at 200 chars; here it is the trigger's own message.

## c. Open questions from H1F

9. **`orders.e2e` "close SERVED → CLOSED": pre-existing, not a regression.** At `23c7a2c` (temporary worktree `~/Code/nimbus-pos-event-baseline`, its own install and Prisma client, fresh `nimbus_event_h1r2_base` on :55475, 59 migrations + seed): **17/18, that test fails `expected 200 "OK", got 400`**. At HEAD (fresh `nimbus_event_h1r2_q9`, 61 migrations + seed): **17/18, the same test, the same 400**. Added to `docs/PRE_EXISTING_ISSUES.md` (new file). Worktree and container removed.
10. **Flake.** The quick-sale e2e (H1's spec plus H1F's), three runs: 66/66, 66/66 and 65/66. The one failure is H1F's lock-hold timing (p95 23.2 ms at load 9; N-5). **0 responses that were neither expected nor explained.** The H1F empty-body 404 did appear in 3 of 9 full review-spec runs, and its source is now captured (N-4: another local process on the same port number).

## Checked and found sound (round 2)

| Area | What |
|---|---|
| F-1 replay | Both paths (up-front lookup and unique-violation race) compare the sale; identical retries replay; the comparison excludes slip fields by design (round-1 R3 control still green). `CLIENT_SALE_ID_OTHER_BRANCH` is unchanged and checked first. |
| F-2 log | See probe 8. |
| F-3 / F-4 allocator | Real query uses the index; BigInt arithmetic, no `Number`; padding unchanged for ≤ 6 digits; branch above 2³¹ sells. |
| F-5 till codes | One helper; DTO `@Transform` plus service re-normalise (direct callers); expected cash matches both the opened spelling and the normalised one; the replay comparison normalises the stored code, so pre-H1F lower-case rows still replay. |
| F-6 | `authCode` `^[A-Za-z0-9]{1,8}$`, `terminalId` `^[A-Za-z0-9-]{1,12}$`, `payerPhone` at most 12 digits, MoMo-only slip fields. |
| Read-back after commit | Moving the order read outside the transaction does not change the response (round-1 suites green) and shortens the lock. |
| Restaurant flow | Create through the API with the index present: 201. The legacy number generator is untouched. |
| `check:event` | Green, 1 allowed hit (P3). |

## Not checked (round 2)

- The till client's real retry payload (N-2 depends on whether it re-serialises `soldAt`).
- Lock-hold timing on a quiet machine, and anything beyond 20 concurrent sales: Thursday's load test.
- Round 1's "Not checked" items that H1F did not touch (receipt history, `todayRange()` time zone, pool exhaustion) remain open.
- Web and Postman: out of scope (H1F reports newman 10/18/0; not re-run here).
- `quick-sale.h1f.e2e-spec.ts` (687 lines, H1F's own spec) was run (its timings are cited) but not reviewed line by line. The H1F edits to `quick-sale.e2e-spec.ts` (listen once; `allSettled` before judging) and `tills.service.spec.ts` (mock honours `{ in: [...] }`; one added case) were read: no case removed, no assertion relaxed beyond following the new `in` shape. H1F's `app.listen(0)` binds all interfaces, so the N-4 clash is rarer there (one bind, not one per request) but not impossible.
- H1's e2e count: 31/31 here; round 1 recorded 35/35. No `it(` was added or removed in that file since `eac1494`, so round 1's 35 came from a different file set or a miscount; not reproduced.

## Round 2 fixes (H1F2)

- **Commits:** `e4d3c75..10694e9` on `concert/event-till--moses` (nothing pushed).
- **S-1 closed:** one open till per code, compared trimmed and upper-cased; same 409; stored code unchanged.
- **S-2 closed:** a card number can no longer be sent as a mobile-money reference (`externalTransactionId`); `payerPhone` is optional, `+` and 9 to 13 digits.
- **Evidence:** three consecutive full e2e runs of the quick-sale, H1F and review specs, 166/166 each, with no foreign 404 (every spec now listens once on 127.0.0.1). API unit 1,288 tests in 70 suites. `check:event` green; `tsc` 0 errors; `nest build` passes at HEAD.
- **Perf probes now opt-in:** both p95 ≤ 20 ms wall-clock probes run only with `EVENT_PERF=1`. The reviewer's spec change was the permitted one; the same gate on the H1F spec's own probe went beyond the ruling and was accepted by the architect.
- **Still open:** the "Not checked (round 2)" list above, apart from lock-hold timing, which `EVENT_PERF=1` now makes measurable for Thursday's load test.
