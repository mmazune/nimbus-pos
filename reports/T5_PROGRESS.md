# T5 progress — join the four tracks, then wire the screens to the new engines

Branch `t5/join-up`, cut from `rebuild/main` `41772c7`. Merge result (Done-when 9 baseline): `f0b6d87`.

## Now
- Phase 1, part a: merges done and committed; next the demo venue on a throwaway database and the gates.

## Phases
| Phase | State | Last commit |
|---|---|---|
| 1 One branch that works | in progress | f0b6d87 |
| 2 The menu knows what is left | not started | |
| 3 Areas, tabs and moving people | not started | |
| 4 The kitchen talks back | not started | |
| 5 The kitchen and bar screens | not started | |
| 6 The chains in the browser | not started | |

## Conflict resolutions (merge of origin/t1/screens)
1. `components/{waiter,cashier,supervisor}/floor/*FloorScreen.tsx`: T1's `FloorScreen` is the floor; a table tap mounts T3's `OrderScreen`. T1's `extraAction` (Find bill / Find order) replaces the old sibling button above the floor; T3's "Table unavailable" block is kept; T3's reservation card and shift banner props are kept.
2. `design/screens/SCREENS.md`: every row kept; for each row the side that moved past `drawn` wins. No row had both sides changed.
3. No other file conflicted (T2, T4, T3 merged clean in that order).

## Decisions taken
(numbered in the report)

## Left out
