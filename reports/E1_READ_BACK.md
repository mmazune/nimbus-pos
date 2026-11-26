# E1 read-back (order truth)

Late, and I say so: the code was read before I wrote any, but this file was written after the build. It describes the base (`27790c1`), not my changes.

## Baseline (base `27790c1`, throwaway Postgres 16 in the container, db `nimbus_event_*`, localhost only)
- API typecheck: 0 errors. Unit: **1,288 passed, 70 suites** (matches the prompt).
- e2e, order-adjacent suites only (orders payments kds reservations floor waiter-mvp quick-sale*): 265 of 267 passed.
  - `orders.e2e` › "POST /pos/orders/:id/close — SERVED → CLOSED" **fails at base**: it pays 9,999 cash on a seeded item that costs more, so it gets 400. Not caused by E1.
  - `quick-sale.review` had 2 red probes on the first run, 0 on the next three (they are timing probes, the H1F note says two need a ruling). Not touched.
- Full e2e at base is measured in `E1_REPORT.md` (same-database-clone comparison). The prompt's "166 of 166" is the three quick-sale specs only, not the whole suite; the whole suite has pre-existing red (CLAUDE.md records 98–121).
- API build: not run at base; run after the change (0).

## Where state is written
- `Order.status`: `OrdersService.transitionOrder` (all steps), `voidOrder`; `PaymentsService.closeOrderWithPayment` and `autoSettleIfFullyPaid` wrote `CLOSED` directly; quick-sale inserts an order born CLOSED (H1, left alone); `pos-handoff` merge voids the source order.
- `Table.status`: `autoOccupyTable` (on SENT), `autoReleaseTableIfIdle` (only in `transitionOrder` CLOSED and `voidOrder`), `reservations.seat`, `floor.service`.
- Payment status/amount checks: `closeOrderWithPayment` (needed SERVED; refused cash over, stored the handed-over amount as `amount`), `createManualReferencePayment` (only refused VOIDED, so it accepted CLOSED and NEW orders), webhook → `autoSettleIfFullyPaid`.
- Tickets: `KdsService.createTicketsForOrder`, once per order (returned the old tickets if any existed), called fire-and-forget from `sendOrder`.
- `OrdersService.closeOrder()` had no caller; it closed without payment. Removed.

## Fields
- `OrderItem`: price, subtotal, quantity, notes, metadata, cost snapshot. No sent or void field.
- `KdsTicketItem`: ticketId, orderItemId. No unique on `orderItemId`.
- Permissions: seeded in `packages/db/prisma/seed.ts` (`PERMISSIONS_DATA` + `ROLE_PERM_MATRIX`); the guard is `PermissionGuard` reading `@Permissions()`.

## Contradictions (which document won)
1. Old rule "cash is valid only on a SERVED bill" (and `CLOSABLE_STATES = ['SERVED']`): the prompt wins; payment is accepted in SENT, IN_KITCHEN, READY, SERVED.
2. Prompt route `POST /api/orders/:orderId/items/:itemId/void` vs every other order route under `/api/pos/orders/…`: the prompt wins; a second small controller carries exactly that path.
3. Prompt step 4 says the bill is 98,000 and 100,000 is handed over, but step 3 voids the wings first, so the bill is 74,000. Prompt part c's own test is "100,000 on a 98,000 bill". I test both: the evening ends with 76,000 on 74,000 (change 2,000); a separate test does 100,000 on 98,000.
4. "No other code writes CLOSED": quick-sale inserts an order that is CLOSED from birth (no table, no reservation, no send). The prompt forbids touching that engine, so it stays; every dine-in close goes through the door.
5. "A sent line is never deleted": the waiter's existing remove deleted any line. Now refused (409) for a sent line; unsent lines still delete as before.
6. Reservation completion used to run after the order commit and swallow errors; it now runs in the close transaction, so it cannot be skipped silently.

## Questions, with the default I took
- Q1 Should a payment gate also apply to MoMo intent creation? Default: no (intents already require a payable state); the gate is on the close and manual-reference routes. A provider webhook that settles the balance still closes the order (the money has moved).
- Q2 pos-handoff (split/merge/move) is outside the allowed list? It is under `apps/api`, which is allowed. Default: two tiny edits only (totals ignore voided lines; a moved part of a sent line stays sent). Not tested beyond the existing suite.
- Q3 Backfill value for `sent_at`: the order's `updated_at`; the real send time was never stored.
