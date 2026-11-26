# E1 report: order truth

Built by Sonnet 5.5 on `rebuild/main` (base `27790c1`). Database: throwaway Postgres 16 inside the container, `nimbus_event_*`, localhost only; Neon never touched; no `.env` read. Closed by a separate review (R-E1), not by me. Read-back: `reports/E1_READ_BACK.md` (written late: disclosed there).

## Gates (all on HEAD of this branch)
| Gate | Result | Grade |
|---|---|---|
| API typecheck (`tsc --noEmit`) | 0 errors | [live] |
| API build (`nest build`) | exit 0 | [live] |
| Unit tests | **1,309 passed / 71 suites, 0 failed** (base 1,288 / 70; +21 mine: close door 8, send 5, void 6, KDS lines 3, pay-with-change 7, less 8 replaced old tests) | [live] |
| `eslint` on changed files (called directly, no `--fix` script) | 0 errors in every file I created and in every file that was clean at base. Pre-existing prettier errors remain in `pos-handoff.service.ts` (853 at base, 858 now: my 5 are indentation of two copy blocks in that file's own style), `orders.controller.ts` (2, same as base) | [live] |
| `pnpm check:event` | green | [live] |
| Full e2e, both trees on fresh clones of one seeded db, quick-sale specs excluded | **base 91 failed / 968 passed (9 suites red); E1 91 failed / 973 passed (the same 9 suites red).** The +5 passes are my 5 new tests. Failure *names* were not diffed (default reporter prints none for multi-suite runs); suite list and counts are identical | [live] |
| Quick-sale specs (3) | green when run with the order suites (earlier run); not re-run in the full pass | [live] |
| "Table 12's evening" | 5 of 5 tests, **three runs in a row** (`reports/proof/E1_table12_runs.txt`) | [live] |

**The full e2e suite does not have 0 failed. It has the same 91 failures at base** (billing, franchise, HMS, quick-pin, tenancy, attendance, control-plane, franchise-analytics, plus `orders.e2e` "close — SERVED → CLOSED", which pays 9,999 on a dearer item). Done-when item 10 is therefore met as "no new failure", not "zero".

## What changed, by part
- **a. One close door** [code][live]. `orders/order-close.ts` `closeOrderInTx(tx, …)`: guarded `updateMany` so only an open order closes once; locks the table row, frees it only when no other open order sits on it; completes a `seatedOrderId` reservation still `SEATED`, once, with `source: 'order-close'`; writes the audit rows; all in the caller's transaction. Called by payment close, auto-settle and `transitionOrder(… CLOSED)`. Dead `closeOrder()` removed (it closed without payment). `order.closed` is emitted after commit. Quick-sale inserts orders already CLOSED and is untouched (disclosed).
- **b. Send by line** [code][live]. Migration adds `sentAt`, void fields, `wasMade` on `OrderItem`, void fields on `KdsTicketItem`, a **unique index on `kds_ticket_items.order_item_id`**, and `tendered`/`change_given` on `payments`; backfills `sentAt` from the order's `updated_at`. `sendOrder` locks the order row, stamps unsent live lines, moves NEW → SENT only the first time, tickets exactly those lines per station, in one transaction; nothing to send is 409. Three sends fired together give `[200, 409, 409]` and one ticket item per line.
- **c. Pay with change** [code][live]. Payable in SENT / IN_KITCHEN / READY / SERVED, needs a live line, 409 "Send or remove the unsent items first" if any line is unsent (also on the manual-reference route, which used to accept CLOSED and NEW orders). Cash may exceed what is owed: row `amount` = applied, `tendered` = handed over, `changeGiven` = change; other methods must still match; all Decimal. 100,000 on 98,000 gives 2,000 change, closes, frees the table.
- **d. Void one line** [code][live]. `POST /api/orders/:orderId/items/:itemId/void`, key `pos:order:item:void`. Split by quantity, refusals (never sent 400, closed/voided and posted-payment 409), idempotent repeat, audit row, ticket item flagged voided; totals exclude voided lines (also in `pos-handoff` recompute). Waiter and cashier 403 (live). The waiter's delete is refused (409) for a sent line.
- **Events** [code]: `order.lines.sent`, `order.line.voided`, `order.closed`, ids only, after commit, one unit test each. Nothing listens.

## Seed diff (item 8) [live]
`reports/proof/E1_seed_diff.txt`: one permission row plus the key added to exactly three role lists. On the migrated+seeded db the key is held by Manager, Owner, Supervisor only (query run). No other grant changed.

## Migration SQL (item 11)
`reports/proof/E1_migration.sql`. Additive: one enum, nullable columns, one unique index, one `UPDATE` backfill. `prisma migrate diff` after it shows no difference on the touched tables (the rest of the diff is drift that was there before).

## Mutation control [live]
Removing the order-row lock in `sendOrder` turns "two sends fired together" red (`reports/proof/E1_mutation_lock_removed.txt`); restored.

## Not proven / disclosed
- The 98,000 → 100,000 example and the wings void cannot both be in one evening (bill is 74,000 after the void): the evening pays 76,000 on 74,000, a second test does 100,000 on 98,000 [read-back, contradiction 3].
- No red-first run for every unit test; one mutation control only. Reservation completion "exactly once under retry" is proven by unit (guarded update, closed:false on retry) and by one live close, not by a concurrent live retry.
- `pos-handoff` edits are two small lines, covered only by the existing suite.
- The `sent_at` backfill uses `orders.updated_at`: an estimate for old orders.
- Commits are three checkpoints (schema+seed, engine+unit tests, e2e+reports), not one per part: the parts share files and do not compile apart.
- Not run: newman/Postman (no collection edited, no contract tested here), the web app (not touched).

## Way back
The migration is additive. Reverting the branch is enough; the extra columns are nullable and unread by older code. The only data rewrite is `order_items.sent_at`.
