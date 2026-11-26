# U1 read-back (inside T1, phase 1) — 26 Nov 2026

Base `rebuild/main` at `0af95f8` (U0 merged). Branch `t1/screens`. Throwaway Postgres in this container; API run from a scratch folder (no `.env` loaded).

## Shell regions, today → after
- Today: `OperationalShell` = fixed `OperationalHeader` (64 px, branch label, clock, name, Log out) + a fixed 36 px readiness strip (shift banner / readiness chips) + fixed `OperationalBottomNav` (old style) for waiter, cashier, supervisor. Manager uses the same shell with `navigation="top"`.
- After: new `pos-shell/TouchShell` for the three touch roles: kit `TouchHeader` (64: mark, title, "as at HH:MM" line, search on Floor, name · role · terminal, Lock) at ≥ 640 px, kit `HeaderBand` under 640; kit `BottomBar` (76) at ≥ 640, `TabBar` (84) under. Readiness strip and count tiles leave; a shift that is not open is one kit `Banner` line with one button. Manager keeps `OperationalShell` untouched.
- Sections (filtered in `pos-shell`, not in `kit/sections.ts`, which I do not own): waiter Floor, Reservations, Me; cashier Floor, Receipts, Till, Me; supervisor Floor, Reservations, Approvals, Me. Ready (E5) and Team wait for U4.

## What a tile draws → where it comes from today
| Tile thing | Source today |
|---|---|
| Number | `table.label` (seeded "TD-01"; shown as given, measured in compact and phone tiles) |
| Area | `table.floorPlan.name` → area chips (Tapas Downtown: Main Dining 8, Patio 7, Private Room 7) |
| Seats | `table.capacity` |
| Free / reserved | table status + reservations (`PENDING`/`CONFIRMED` with `tableId`) |
| Reservation time and party | `reservation.reservationAt`, `partySize` |
| Open, whose | active order on the table, `order.user` → "First L."; mine = `order.userId` = me |
| Minutes open | `order.createdAt` (the column) |
| Amount | `order.total` (string; grouped as a string, never `Number`) |
| Not sent | order status `NEW` (items entered, nothing sent); item count from `order.items` |
| Cleaning | table status `CLEANING` (today hidden; will show) |
| Guests on an open table | **no data yet** (no guest count on an order) |
| Bill (asked / printed) | **no data yet**: `request-bill` writes an audit row only, nothing on the order |
| Ready | **not drawn** in `Table-Tile`; order `READY` shows as Open (E5 brings Ready) |
| Late, Tabs, New tab | **no data yet** (E5 kitchen times; T2 tabs) |

Truth checks done live: the active-orders call returns `total 135` but 100 rows at `pageSize=100`, so the Floor loader pages until it has all of them. 76 active dine-in orders sit on 20 tables, up to 19 on one table (demo data). Decision: a table's tile uses its **oldest** active order for whose and minutes and the **sum** of its active orders for the amount.

## Areas
From `floorPlan` on each table. A table without one goes in "Other". One chip "All" only if no table has an area. Supervisor at ≥ 1600 px wide also gets "All areas".

## Sections each role gets now / later
Waiter Floor, Reservations, Me (Ready later, E5/U4). Cashier Floor, Receipts (hidden route shown again), Till, Me. Supervisor Floor, Reservations, Approvals, Me (Team later, U4).

## What the old toolbar and siblings offered → where it goes
| Old | After |
|---|---|
| Status filter chips (All/Available/Occupied/Reserved/Mine) | Removed: area chips + "My tables · n / All tables" (drawing) |
| Floor-plan select | Area chips |
| Search table or waiter | Header search: finds a table by number |
| Cashier "Find bill", supervisor "Find order" | Kept: one tonal button in the Floor's top row |
| Count tiles, readiness chips, shift banner | Removed from the Floor; shift not open → one line + one button |
| Tapping a table | Unchanged: opens today's workspace (T3 owns it) |

## Playwright baseline (production build of `0af95f8` in a separate worktree, `NEXT_PUBLIC_KIT_GALLERY=1`, `vp-1440x900`, this DB) [live]
**151 passed, 7 failed, 3 skipped** (5.0 min). Full list: `reports/T1_PLAYWRIGHT_BASELINE.txt`.
| Folder | Passed | Failed at baseline |
|---|---|---|
| cashier-floor (27 files) | 48 | 0 |
| kit | 5 | 0 |
| manager-operations/tables-and-reservations | 8 | 0 |
| manager-shell | 32 | 2 (navigation-and-landing :96, :121) |
| supervisor-approvals | 23 | 5 (discount-approve-reject ×2, discount-self-approval, leave-approve-reject :33, shift-swap-reject :27) |
| supervisor-prompt3 | 16 | 0 |
| supervisor-reservations | 19 | 0 |
The DB was snapshotted (`nimbus_t1_pristine`) before the run; the final regression starts from the same snapshot.

## Contradictions and which won
- `CLAUDE.md` §9 locks Cashier nav "Floor · Till · Me" and Receipts hidden; `01-decisions` R9 and U1 part a show Receipts again. R9 / the prompt win (newer, owner-approved drawings).
- `CLAUDE.md` §8 "no commit/push"; LONG-RUN-RULES rule 3 and the launch message say push `t1/screens`. The rules win.
- `CLAUDE.md` says the waiter shift banner and readiness chips are locked; U1 removes them. U1 wins.
- U1 lists "ready" among tile states; `Table-Tile` draws no Ready look. Drawing wins: left out.

## Questions, with the default taken
1. Lock: no lock screen drawn. Default: Lock signs out and lands on the existing PIN screen (`/login`).
2. Seeded labels "TD-01": shown as given unless they clip; then the "Tab" pattern (small prefix above, large number).
3. 32- and 70-table proof: a second throwaway database filled through the API with numeric labels, not this one.
