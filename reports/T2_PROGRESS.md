# T2 progress (engines: menu, tables, tickets)

Branch `t2/engines`, cut from `rebuild/main` `0af95f8`, `origin/e1/order-truth` merged at `c6983c4`. `OrderItem.sentAt` present.
DB: throwaway Postgres 16, db `nimbus_event_t2`, role `t2`, localhost; URL set per shell, never in a file.

## Now
- Phase 1 DONE (commits fe01acb..63f9a37). Next: phase 2 (areas, tabs, moves, hand-over).

## Done
- Phase 1: workspace (239 items: 185,682 B, 36 ms), offers, sold out / back on / a number left, send hook, void give-back, reset + opening list. Lamb chops e2e 6 tests + Table 12, 3 runs green. Race x20 green; mutation with both guards removed goes red. Seed: 1 key, 5 roles (seeded twice). Migration additive, row counts unchanged.
- Baseline: tsc 0, build 0, unit 1,309/71, e2e touched suites 103/104 (1 pre-existing), check:event green.

## Decisions taken
- See `reports/E2_READ_BACK.md` Q1–Q5.
- No E1 review exists yet on `origin/t4/review-and-data` (branch absent at start of phase 1).

## Left out and why
- Whole-order void does not give counts back (only a "not made" line void does). Not asked.
- Lamb chops waiters B and C are played by the manager and supervisor accounts (only one waiter is seeded); the send engine does not read the role.
- changedSince: a change written inside a transaction that commits after a poll has read can be missed by that poll (window of milliseconds); not observed. [asserted]

## Last commit
- 63f9a37
