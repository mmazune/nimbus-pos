# E1 — Order truth: one close door, send by line, pay with change, void one line

Model: Sonnet. If you are not Sonnet, say so and stop.
Size: one session, four parts, one demo (the e2e test "Table 12's evening").
Base: `rebuild/main`. Work on the branch this session gave you, cut from it. If `docs/direction/01-decisions.md` is missing, you are on the wrong base: say so and stop.
You may change: `apps/api/**`, `packages/db/**` (one new migration and the seed), `reports/**`. Nothing else.
Runs beside: U0, which owns `apps/web`. Do not touch it.
Ship policy: commit per part; push this session's branch; open no pull request; merge nothing; deploy nothing. This is the only session on this branch.

Database: a throwaway one inside this container only. Start the container's own Postgres (`service postgresql start`) or a Docker Postgres, create an empty database, and set `DATABASE_URL` and `DIRECT_DATABASE_URL` in the shell, never in a file. If the host in either is not `localhost` or `127.0.0.1`, stop. Never read, print or write `.env*`. Never connect to Neon. `db:seed` may run on the throwaway database only. Start Redis the same way only if a test needs it.
Commands: use `corepack pnpm@8.15.0`. Never run a lint script that contains `--fix` (the API's `lint` script does): call `eslint` directly on the files you changed. Record PIDs of anything you start and stop only those; never `pkill -f`.

First: load `moses-build-standards`, say so, and read §0, §1.3 and the money and audit rules. If the skill is not listed, say that in your report and carry on with this prompt.

## Why

- "When they press that table again, that's when they can edit an order." (Moses, 25 Nov 2026)
- "Supervisor… taps on the same table… void, split bills." (Moses, 25 Nov 2026)
- "Building on a structure that is dependable." (Moses, 25 Nov 2026)

The real case is table 12 on a busy evening, and today the code fails it four times:
1. 19:42, the waiter sends 1 beef burger (28,000), 2 chips (16,000), 1 chicken wings (24,000). The kitchen gets a ticket. Good.
2. 20:15, she adds 2 lagers (12,000), 1 double blended Scotch with cola (15,000), 1 cola (3,000) and sends. **The bar gets nothing**: tickets are made once per order (`apps/api/src/modules/kds/kds.service.ts`, about lines 72 to 82) and `NEW → SENT` is the only send (`orders.service.ts`, about line 44).
3. The guest sends back the wings. **Nobody can void one line**; only the whole order can be voided.
4. The bill is UGX 98,000 and the guest hands over 100,000. Payment closes the order by writing the status directly (`payments.service.ts`, about lines 244 to 247, and the auto-settle near 102 to 105), so **the table stays occupied and a linked reservation stays seated**. The code that frees the table lives in `transitionOrder` (about 713 to 742), and its only caller, `closeOrder()` (about 841), is called by nothing.

Decisions that bind this work: R4, R6, R7 and R14 in `docs/direction/01-decisions.md`. Where an older document disagrees (for example "cash is valid only on a SERVED bill"), this prompt wins; list each such case in the read-back.

## Read first

`docs/direction/01-decisions.md`; `docs/direction/research/A3_backend_as_built.md` sections on tables, orders, payments and kitchen tickets; `apps/api/src/modules/orders/`, `payments/`, `kds/`, `reservations/reservations.service.ts`; `packages/db/prisma/schema.prisma` models `Order`, `OrderItem`, `Payment`, `KdsTicket`, `KdsTicketItem`, `Table`, `Reservation`; the role and permission seed in `packages/db`; `apps/api/src/common/guards/permission.guard.ts`.

## Read-back (before any code)

Write `reports/E1_READ_BACK.md`, 60 lines at most: the order states and every place that writes `Order.status` or `Table.status`; where a payment checks status and amount; where tickets are made; the fields on `OrderItem` and `KdsTicketItem`; where permissions are seeded; contradictions and which document won; questions, each with the default you will take. Record the baseline: API typecheck, unit tests (expected 1,288 passed in 70 suites), the e2e suite on the throwaway database (expected 166 of 166), API build. Then continue unless blocked.

## Parts

**a. One close door.** Move what closing an order must do into one function, run inside the caller's transaction, and call it from the payment close, the auto-settle and `transitionOrder(… CLOSED)`. It frees the table (`AVAILABLE`) only when no other order on that table is still open; it completes a reservation linked by `seatedOrderId` that is still `SEATED`, once, with `source: 'order-close'`; it writes the audit row. Remove the dead `closeOrder()` or route it through the same door. Tests: pay in full and the table is free; two open orders on one table and it stays occupied; a linked reservation completes once even when the close is retried. Commit.

**b. Send by line.** One new migration, additive only: on `OrderItem` add `sentAt`, `voidedAt`, `voidedById`, `voidReason`, `voidNote`, `wasMade`; add what `KdsTicketItem` needs to show a void; backfill `sentAt` for every line of every order that is not `NEW`. Lines may be added while the order is `NEW`, `SENT`, `IN_KITCHEN`, `READY` or `SERVED`. Send (keep the existing route) stamps every line that is not sent and not voided, moves `NEW → SENT` the first time and leaves the status alone after that, and makes tickets for exactly the lines just sent, grouped by station. A line gets a ticket once: a retried or doubled send makes no second ticket (guard it in the database, not in memory). Send with nothing to send answers 409. Tests include two sends fired together. Commit.

**c. Pay with change.** A payment is accepted when the order is `SENT`, `IN_KITCHEN`, `READY` or `SERVED`, has at least one line that is not voided, and has no unsent line (409, "Send or remove the unsent items first"). Cash may be more than what is owed: store what was handed over and the change, and return the change. Any other method must equal what is left to pay, as now. Split and part payments behave as now. Money stays Decimal from request to row; no floats, no `parseFloat`, no `toFixed`. Tests: 100,000 on a 98,000 bill gives 2,000 change, closes the order and frees the table through part a. Commit.

**d. Void one line.** `POST /api/orders/:orderId/items/:itemId/void` with `reason` (one of `GUEST_CHANGED_MIND`, `WRONG_ITEM`, `KITCHEN_RAN_OUT`, `TOOK_TOO_LONG`, `GUEST_COMPLAINT`, `OTHER`), `note` (required with `OTHER`), `wasMade` (true or false, required) and an optional `quantity`. It needs the new key `pos:order:item:void`, seeded for Owner, Manager and Supervisor and nobody else. The line stays in the order with who, when, why and `wasMade`; it leaves the totals; its ticket item shows as voided. Part of a quantity splits the line in two. Refuse a line that was never sent (400, "Remove it instead"; the waiter's existing remove stays as it is), an order that is closed or voided, and an order that has a posted payment (409). Voiding an already voided line returns it unchanged. Voiding the last line leaves the order open at zero. Audit row every time. Tests: supervisor voids the wings and the bill becomes 74,000; a waiter and a cashier get 403. Commit.

Then write the e2e test **"Table 12's evening"**: the four steps above in order, on a table with a seated reservation, ending with the order closed, UGX 2,000 change, the table free, the reservation complete, two ticket sets (kitchen at step 1, bar at step 2) and no stock or web code touched.

## Not in it

No web change: the waiter screen's own block on adding after send (`WaiterOrderBuilderScreen.tsx`, about line 1119) goes in U2. No stock movement (E6). No printing (E4). No tax. No "Cleaning" step. No change to the quick-sale engine or its tests, which stay green, as does `pnpm check:event`. No new dependency. No edit to an existing migration. No lint config change.

## Done when

1. `reports/E1_READ_BACK.md` exists and the baseline is recorded.
2. One function closes an order; payment close, auto-settle and `transitionOrder` all use it; no other code writes `CLOSED`.
3. After full payment the table is `AVAILABLE` unless another open order sits on it, and a linked seated reservation is `COMPLETED` exactly once.
4. A second send makes tickets for the new lines only; a doubled send makes none; nothing to send is a 409.
5. Lines can be added in every open state and never after `CLOSED` or `VOIDED`.
6. Cash above the bill is accepted, stored with its change, and the change is in the answer; other methods still must match.
7. The void endpoint does what part d says, including the split, the refusals and the 403s; a sent line is never deleted.
8. `pos:order:item:void` is in the seed for Owner, Manager and Supervisor only; no other grant changed (show the seed diff).
9. "Table 12's evening" passes three runs in a row.
10. API typecheck 0, build 0; unit tests are the baseline plus yours with 0 failed; the full e2e suite has 0 failed; `eslint` on the files you changed is clean; `pnpm check:event` is green.
11. `git diff --stat rebuild/main...HEAD` shows changes only in the allowed places, and the migration only adds.

## Proof and report

Write `reports/E1_REPORT.md` with the gate outputs, the three e2e runs, the seed diff and the migration SQL. Grade every claim [live], [emulation], [code] or [asserted]. Name the way back (the migration is additive; reverting the branch is enough). This engine touches money and rights, so it is closed by a separate review (R-E1), not by you. Finish in chat with a block of 8 lines at most that opens with the verdict and ends with `You need to: …`.

Then STOP.
