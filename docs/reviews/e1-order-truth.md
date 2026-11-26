**Verdict: blockers.** Five live-red probes break a Done-when line or a path E1 changed (B1–B5); do not deploy E1 or build on it until E1F closes them.

# R-E1 — review of E1 (order truth)

Reviewer: track T4 (Opus), built none of E1. Reviewed: `origin/e1/order-truth` at `19e1eee` against `origin/rebuild/main` (`0af95f8`). The diff was judged, not the report. Date: 26 Nov 2026.
Database: the container's own Postgres 16, throwaway `nimbus_event_*` databases made by `tools/test-env.sh`, `localhost` only; each probe run on a fresh clone of one migrated and seeded template. Neon never touched; no `.env*` read (none exists in this container).
Grades: **[live]** run here and seen; **[emulation]** a real state written by SQL and the real code or migration run on it; **[code]** read in the source, not run; **[asserted]** taken from someone's word.

Probes (kept whether green or red; a red probe is a fault that is present):
- `apps/api/test/e1-review.probes.e2e-spec.ts` — P1–P25, live API + database.
- `apps/api/test/e1-review.writers.e2e-spec.ts` — W1, W2, static scan of `apps/api/src`.
- `tools/probes/e1-migration-on-live-data.sh` — the E1 migration on pre-E1 data.

Races are made deterministic, not left to timing: the probe holds the row lock of the reservation linked to the order, so a payment that reaches the close door has claimed the order and waits there; the second request is fired into that window (see the file header).

Probe run on a fresh clone, E1 tree: **27 tests, 16 green, 11 red** (P5, P6, P7, P8, P11, P15, P20, P22, P24, P25, W2) [live].

## Findings, most serious first

Origin tags: **E1-line** breaks a Done-when line of `E1-order-truth.md`; **E1-path** a path E1 edited; **E1-opened** pre-E1 code that E1's change made reachable; **pre-E1** there before and not made worse.

| id | sev | origin | where | wrong | probe | smallest fix |
|---|---|---|---|---|---|---|
| B1 | blocker | E1-line 7 (void needs the right; a sent line is never changed except by void) | `apps/api/src/modules/orders/orders.service.ts:579-640` (`updateOrderItem`) | E1 refuses edits only on a **voided** line. A **sent** line's quantity can still be lowered through `PATCH /api/pos/orders/:id/items/:itemId`, which needs only `pos:orders:write` — a key waiters hold. A sent line of 2 × 6,000 went to 1; the bill fell from 12,000 to 6,000; no void row, no reason, no `wasMade`, the kitchen ticket unchanged. It is a void without `pos:order:item:void` and without a trail. | P22 [live] red: 200, bill 6,000 | Refuse any change to a line with `sentAt` (409 "Ask a supervisor to void it"), as `removeOrderItem` already does at `:685-691`. |
| B2 | blocker | E1-line 5 ("never after CLOSED") | `orders.service.ts:507-548` (`addOrderItem`) | The status check reads the order **without a lock and outside a transaction**, then inserts and recalculates. A line added while a payment is closing lands on the closed order: order ORD-000007 ended **CLOSED, paid 25,000, total 32,000, one unsent line**. `recalcOrderTotals` rewrote the total of a closed, paid order. | P5 [live] red: add 201 | Take the same `SELECT … FOR UPDATE` on the order inside a transaction, re-check the status, insert and recalc in it (the pattern `sendOrder` already uses). |
| B3 | blocker | E1-path (E1 rewrote this gate) | `apps/api/src/modules/payments/payments.service.ts:849-889` (`createManualReferencePayment`) | The payable check runs in its own short transaction with no lock; the payment row is written afterwards, outside it. A MoMo manual reference fired while a cash close was in flight was posted on the closed order: ORD-000008 **CLOSED, total 40,000, paid 80,000**. | P6 [live] red: 201 | Lock the order row, run `assertOrderPayable` and the balance check, and insert the payment in one transaction. |
| B4 | blocker | E1-opened | `orders.service.ts:942-970` (`voidOrder`) | `voidOrder` reads the status unlocked and writes `VOIDED` with an unguarded `order.update`. Before E1 a payment needed `SERVED`, and `SERVED` cannot be voided, so the race could not happen; E1 now takes payment in `SENT`/`IN_KITCHEN`/`READY`, which are voidable. A void fired during a cash close overwrote it: ORD-000009 **VOIDED while holding 18,000 of completed payments**. | P7 [live] red: void 200 | Lock the order, guarded `updateMany` on the voidable states, and refuse when a `COMPLETED` payment exists (409). |
| B5 | blocker | E1 migration | `packages/db/prisma/migrations/20261126000000_e1_order_truth/migration.sql:25` | `CREATE UNIQUE INDEX kds_ticket_items_order_item_id_key` aborts if any line is already on two tickets. Pre-E1 code can leave exactly that: ticket creation was check-then-insert (`kds.service.ts:77-81` at base) and was fired, not awaited, by every send, and two sends fired together both passed the unguarded `NEW → SENT` transition. One such row stops the whole deploy. | migration probe case A+B+C [emulation]: `ERROR: could not create unique index … Key (order_item_id)=(probe_line_a1) is duplicated` | Before deploying anywhere with history: count duplicates (`SELECT order_item_id FROM kds_ticket_items GROUP BY 1 HAVING count(*) > 1`). If any, the migration must first set the later duplicates aside (for example re-point them to a kept row's ticket and mark them, never hard-delete) before building the index. |
| S1 | should-fix | E1 migration | `migration.sql:33-39` (backfill) | The backfill stamps `sent_at` on every line of every non-`NEW` order. Two kinds of line are marked sent that were never sent: (a) a line added **after** the first send (pre-E1 allowed it and never ticketed it): it is now "sent" with no ticket, so E1's next send skips it and the kitchen never hears of it; (b) every line of an order **voided while still `NEW`**. | migration probe case A+B [emulation]: `probe_line_a2_after_send SENT f`, `probe_line_b1 SENT f` | Backfill from evidence: `sent_at` = the ticket's `created_at` where a `kds_ticket_items` row exists; for lines with no ticket, only when the menu item's station is `NONE` and the order is not `VOIDED`. |
| S2 | should-fix | E1-opened | `orders.service.ts:148-165` (`autoReleaseTableIfIdle`, used by `voidOrder`) and `order-close.ts:100-115` | The close door locks the table before deciding; the whole-order void decides without the lock. Closing order A while order B on the same table is voided left the table **OCCUPIED with no open order**. | P8 [live] red; W2 [live] red names `orders.service.ts:161` | Move the free-the-table step into one exported helper that takes the table lock, and call it from both the close door and `voidOrder`. |
| S3 | should-fix | E1-line 5/7 (the prompt asked for "open at zero") | `orders.service.ts` `VALID_TRANSITIONS` (`SERVED: ['CLOSED']`) with `payments.service.ts:160-185` (`assertOrderPayable` refuses an order with no live line) | Voiding the last line of a `SERVED` order leaves it open at 0 with **no way out**: payment is refused (nothing to pay), a whole void is refused (`SERVED` cannot be voided), so the table stays occupied for good. | P20 [live] red | Ruling R-a below. Default: let the close door close a zero-total order (a "nothing to pay" close, audited), reachable by the cashier. |
| S4 | should-fix | E1-path (the rule E1 wrote) | `payments.service.ts:849-889` | The manual-reference route takes **any** amount: 200,000 by MoMo on a 74,000 bill is accepted (201) and settles the order with 126,000 over and no change. E1's part c says "any other method must equal what is left to pay"; the cash-close route enforces that, this route does not. | P15 [live] red | Ruling R-b. Default: refuse a non-cash amount above the balance (400), as the close route does. |
| S5 | should-fix | E1-path | `payments/dto/close-order.dto.ts:20-22`, `create-manual-reference.dto.ts:25-27` | Cash of 10,000,000,000 returns **500** (`tendered` is `DECIMAL(12,2)`); the DTO has no upper bound. | P25 [live] red: 500 | `@Max(9_999_999_999.99)` on every money field of these DTOs (400). |
| S6 | should-fix | E1-path (part c: "Money stays Decimal from request to row") | same DTOs; `payments.service.ts:882` (`amount: dto.amount`) | Every amount arrives as a JS `number` (`@IsNumber`), so the money path begins as a float; the manual-reference route hands that number straight to Prisma. Whole-UGX values below 2^53 are exact, so no wrong amount was produced here, but the rule is broken in letter. | [code] | Take amounts as strings validated as decimals (`@IsDecimal({ decimal_digits: '0,2' })`) and build `Decimal` from the string. |
| S7 | should-fix | E1-path (seed) | `packages/db/prisma/seed.ts:4326-4400` (demo orders) | The seed runs after the backfill and creates `SENT`, `IN_KITCHEN` and `CLOSED` demo orders whose lines have `sent_at` null. On a fresh database ORD-000002 (`SENT`) cannot be paid ("Send or remove the unsent items first") and a second send tickets its line again. | query on the seeded template [live] | Stamp `sentAt` on the seed's non-`NEW` demo lines (track owning the seed). |
| S8 | should-fix | pre-E1 | `orders.service.ts:942-990` (`voidOrder`) | Voiding a seated order leaves its reservation `SEATED` for good; only the close door completes one. | P11 [live] red | Ruling R-c. Default: the void releases the reservation (`COMPLETED` with `source: 'order-void'`, or a new terminal step if the architect prefers). |
| S9 | should-fix | E1-opened | `payments.service.ts:98-150` (`autoSettleIfFullyPaid`) | Auto-settle closes on balance alone; it does not apply `assertOrderPayable`. A MoMo webhook (intents are allowed on `NEW` orders) can close an order that was never sent, or one with lines added after the intent. Disclosed in E1's read-back Q1 as a default. | [code] | Ruling R-d. Default: the close door refuses when unsent lines exist and the order is left open for the cashier with the money recorded. |
| S10 | should-fix | E1-path | `orders.service.ts:873-876` (`sendOrder`) | `autoOccupyTable` runs after the send transaction has committed. A payment that closes the order in between finds the table not yet `OCCUPIED` (so frees nothing), then the late occupy marks it `OCCUPIED` with no open order. | [code] | Occupy the table inside the send transaction, under the table lock. |
| S11 | should-fix | E1-path | `orders.service.ts:1001-1150` (`voidOrderItem`) | A line void checks only `COMPLETED` payments. With a MoMo intent already pushed to the guest's phone for the old total, a void lowers the bill and the webhook later settles the larger amount (no change for non-cash). | [code] | Refuse a line void while a `PENDING` payment intent exists on the order (409), or cancel the intent first. |
| N1 | note | E1-path | `order-close.ts:119` | `findFirst` completes one reservation; two reservations linked to the same order (a bad link) leave the second `SEATED`. | P24 [live] red | `updateMany` all `SEATED` reservations with this `seatedOrderId`. |
| N2 | note | E1-path | `payments.service.ts:271-287` | "The change is larger than the last cash payment" refuses a valid split such as cash 75,000 + cash 5,000 on 74,000. | [code] | Allocate change across cash rows from the last backwards. |
| N3 | note | E1-path | `orders.service.ts:820`, `:1014`, `payments.service.ts:238` | The raw `SELECT … FOR UPDATE` on `orders` runs before the branch-scoped read, so a request for another branch's order id briefly locks that row before answering 404. No data leaks. | [code] | Lock with `WHERE id = … AND branch_id = …`. |

## Checked and found sound

| what | proof |
|---|---|
| Two cash payments in the same instant: one 200, one 409, one payment row | P1 [live] |
| A payment and a line void in the same instant: paid = total at close | P2 [live] |
| Two voids of the same line at once: voided once, one audit row, total right | P3 [live] |
| A send during a payment: never closes with an unsent line | P4 [live] |
| Two open orders on one table: stays occupied until the second is paid, then free | P9 [live] |
| An order with no table closes; change 2,000 on 8,000 | P10 [live] |
| Cash below the bill 400, nothing written; cash far above (10,000,000 on 74,000) stores amount 74,000, tendered 10,000,000, change 9,926,000 exactly | P12, P13 [live] |
| A non-cash amount above the bill on the close route: 400 | P14 [live] |
| Amounts with three decimals: 400 | P16 [live] |
| Void: waiter 403, cashier 403; supervisor under the Downtown header on a Main order never reaches it; line untouched | P17 [live] |
| Void refusals: unsent line 400, quantity 0 / 3 of 2 / 1.5 → 400, `OTHER` with a blank note 400, closed order 409 | P18 [live] |
| Supervisor may void a line on another person's order; part of 3 splits into 2 live + 1 voided; total 8,000; both on the ticket | P19 [live] |
| A line void after a part payment: 409 | P23 [live] |
| A send with every line voided: 409, no ticket | P21 [live] |
| A voided line cannot be voided before it is sent (unsent lines are removed, not voided), so "a second send that includes a line voided before sending" cannot arise | P18, P21 [live] |
| No code outside the close door writes `CLOSED` on an order, except the quick-sale insert (born closed, disclosed) | W1 [live] |
| `pos:order:item:void` held by Manager, Owner, Supervisor only | query on the seeded database [live] |
| Quick-sale engine and its tests untouched by E1 (`git diff --stat` empty on `quick-sale/**` and `test/quick-sale*`) | [live] |

## Done-when of `E1-order-truth.md`, against proof made here

| # | line | result |
|---|---|---|
| 1 | read-back exists, baseline recorded | exists; written after the build (disclosed by its author) [live] |
| 2 | one close function; no other code writes `CLOSED` | holds for `CLOSED` (W1) [live]; but other code still frees tables (S2) and `voidOrder` can overwrite a closed order (B4) |
| 3 | table freed after full payment unless another open order; reservation completed once | holds in the plain case (P9, Table 12) [live]; fails when a void races (P8), and with two linked reservations (P24) |
| 4 | second send tickets new lines only; doubled send none; nothing to send 409 | holds (E1's e2e, P21) [live] |
| 5 | lines added in every open state, never after `CLOSED`/`VOIDED` | **fails**: B2 [live] |
| 6 | cash above the bill accepted, stored with change; other methods must match | holds on the close route (P13, P14) [live]; **fails** on the manual-reference route (S4, B3) |
| 7 | void endpoint as specified; a sent line never deleted | endpoint holds (P17–P19) [live]; **fails** in spirit: a sent line can be shrunk without the void right (B1) |
| 8 | `pos:order:item:void` Owner/Manager/Supervisor only | holds [live] |
| 9 | Table 12 three runs in a row | **5/5, 5/5, 5/5** on one fresh clone [live] |
| 10 | typecheck 0, build 0, unit baseline + new 0 failed, e2e 0 failed, eslint clean, check:event green | typecheck 0, build 0, unit **1,309 / 71 suites, 0 failed**, `check:event` green, eslint as E1 reported (0 in its new files; `pos-handoff.service.ts` 858 vs 853 at base; `orders.controller.ts` 2 vs 2) [live]. e2e **not 0 failed**: 92 failed at base and 92 on E1, the same 92 by name (ruling 1) [live] |
| 11 | diff only in allowed places; migration only adds | allowed places: yes [live]. "Only adds": the schema change does, but the unique index can abort the deploy (B5) and the backfill writes wrong values (S1) [emulation] |

## The five rulings asked for

1. **The red e2e suites, by name.** Run here at `origin/rebuild/main` (`0af95f8`) and on E1, each on a fresh clone of its own migrated and seeded database: base **92 failed / 1,133 passed**, E1 **92 failed / 1,138 passed**, and the 92 failing tests are **the same 92 names** (diffed by suite file and full test name) [live]. E1 added no red test and fixed none; its +5 are its new tests. The builder's 91 left out `quick-sale.review` C10, which is red on a fresh database at base too. Which are this container and which are real faults is answered test by test in `docs/reviews/e2e-baseline.md` (phase 2 of track T4). C10 is already known to be test order, not code: it needs `quick-sale.e2e`'s 200-sale night to have run first on the same database, and Jest's file order does not guarantee it (red on three fresh clones, green when the night ran first) [live].
2. **The late read-back.** Its own section "Where state is written" lists `voidOrder` and every `Table.status` writer, but the build added locks to the close, send and line-void paths only. A read-back written first, with the prompt's question "where a payment checks status and amount" asked of every writer beside the new locked close, would have put `addOrderItem`, `updateOrderItem`, `voidOrder` and the manual-reference route on the list as unlocked writers to the same order, which is B1, B2, B3, B4 and S2. It would not have caught the migration faults (B5, S1), which need data, not reading.
3. **The two lines in `pos-handoff`.** Both are right [code]: the recompute at `pos-handoff.service.ts:169` now leaves voided lines out of the total, matching `recalcOrderTotals`; copying `sentAt` onto a moved or split part (`:482`, `:946`) keeps a sent part sent, so it is neither re-ticketed nor removable. The quick-sale engine does not import `pos-handoff` (grep) and its 166 tests are unchanged in name and result, so no behaviour change there [live]. One gap: a moved part of a sent line has no ticket item of its own, so a later void of that part flags nothing on any ticket (`voidOrderItem` updates ticket items by `orderItemId`). Note for E1F.
4. **One prefix.** `/api/pos/orders/:orderId/items/:itemId/void`. Every other order route, the item routes it sits beside and the web client live under `pos/orders` (`orders.controller.ts:31`); a second controller for one route splits the contract for no gain. The prompt's path was a slip. Should-fix in E1F (move the route; no client calls the current one yet).
5. **The three events.** Yes, all three are emitted after commit, ids only [code]: `order.lines.sent` after the send transaction (`orders.service.ts:877-884`), `order.line.voided` after the void transaction (`:1142-1148`, not on the "unchanged" repeat), `order.closed` after commit from all three close callers (`transitionOrder` `:762-763`, `closeOrderWithPayment` `payments.service.ts:362`, auto-settle `:132`). Each has a unit test (green in the 1,309).

## Rulings proposed for the architect (open points, with the default this review takes)

- **R-a** An order whose last line is voided: may it close at zero, and who may do it? Default: the close door closes a zero-total order on the cashier's tap, audited as a zero close (S3).
- **R-b** May a non-cash manual reference exceed the balance? Default: no, 400 (S4).
- **R-c** What happens to a seated reservation when its order is voided? Default: completed with `source: 'order-void'` (S8).
- **R-d** May a provider webhook close an order with unsent lines? Default: no; the money is recorded and the order stays open (S9).
- **R-e** A cap on cash handed over? None exists (10,000,000 on 74,000 is taken). Default: no business cap; the technical cap of S5 only.

## What could not be tested here

- A live pre-E1 run producing a duplicate ticket line from two concurrent sends: B5 rests on the base code read and on an emulated row. [code] + [emulation]
- MoMo or Airtel intents and webhooks end to end (S9, S11): no provider sandbox in this container. [code]
- The `autoOccupyTable` window (S10): a few milliseconds wide; not forced. [code]
- Anything in `apps/web`: E1 changed none of it.
