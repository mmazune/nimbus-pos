# T2 progress (engines: menu, tables, tickets)

Branch `t2/engines`, cut from `rebuild/main` `0af95f8`, `origin/e1/order-truth` merged at `c6983c4`. `OrderItem.sentAt` present.
DB: throwaway Postgres 16, db `nimbus_event_t2`, role `t2`, localhost; URL set per shell, never in a file.

## Now
- Phase 1, E1F, phase 2, phase 3 DONE. Report: reports/T2_REPORT.md. Last step: final full e2e by name, then push.

## Done
- Phase 1: workspace (239 items: 185,682 B, 36 ms), offers, sold out / back on / a number left, send hook, void give-back, reset + opening list. Lamb chops e2e 6 tests + Table 12, 3 runs green. Race x20 green; mutation with both guards removed goes red. Seed: 1 key, 5 roles (seeded twice). Migration additive, row counts unchanged.
- Baseline: tsc 0, build 0, unit 1,309/71, e2e touched suites 103/104 (1 pre-existing), check:event green.

## Decisions taken
- Phase 3: fire is deferred (goes out after the 3 s undo window, timer + lazy release on reads); no grant needed (Chef and Bartender already held pos:kds:*); station check refuses waiter and cashier on Ready and recall; the shift-close guard is for waiters only.
- E1F rulings, reviewer defaults taken: R-a a SERVED order left at zero may be voided (no cashier zero-close); R-b manual reference never above the balance; R-c a void completes the seated reservation (source order-void); R-d auto-settle never closes with unsent lines and closes once they are sent or removed.
- S6: money DTOs take a decimal string; a JSON number is still accepted and turned into its exact string (no client breaks).
- Line void also answers under /api/pos/orders/:id/items/:itemId/void; the first path stays.
- B5, S1 (E1's migration) answered, not fixed: editing an applied migration is forbidden.
- Phase 2: areas/tables use the existing pos:table:write (Owner, Manager, Supervisor): no new grant. Tabs and hand-overs use pos:orders:write (waiters). Moves use the existing order keys (transfer, merge, move-items, split). Change waiter also checks the job role (Owner, Manager, Supervisor).
- Tabs are numbered per branch, lowest free number; a put-away tab's label gets its id tail so the number is free again.
- Each Busy Friday run makes its own branch so numbers 1-68 and tabs 1-30 are real.
- See `reports/E2_READ_BACK.md` Q1–Q5.
- No E1 review exists yet on `origin/t4/review-and-data` (branch absent at start of phase 1).

## Left out and why
- Split evenly or by amount: the existing split-bill records the shares only; paying one share needs a part cash payment, which the close route does not take (it wants the whole balance). For U3.
- transfer-table, merge, split-items and move-items (pos-handoff) still take no locks and do not touch table state; the new seating routes do. Not rewritten (changes least); voided lines are now refused by split-items and move-items.
- A KDS ticket keeps the order it was made for after a join or a line move.
- Whole-order void does not give counts back (only a "not made" line void does). Not asked.
- Lamb chops waiters B and C are played by the manager and supervisor accounts (only one waiter is seeded); the send engine does not read the role.
- changedSince: a change written inside a transaction that commits after a poll has read can be missed by that poll (window of milliseconds); not observed. [asserted]

## Last commit
- see git log (phase 2 pushed)
