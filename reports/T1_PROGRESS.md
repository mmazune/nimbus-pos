# T1 progress — screens: shell, Floor, and the sections with an API

Branch `t1/screens`, cut from `rebuild/main` at `0af95f8` (U0 merged; `kit/index.ts` present).

## Now
- Phases 1–3 committed and pushed (`718c91d` is phase 3). Phase 4 (Receipts, Till) written and green 3×, NOT committed: fixing the advisor's money points first (till remainder line, Earlier filter-then-cap, one idempotency key per attempt, pending refund test + trace on the bill, close confirm + open a new till, paid-time check, bounded reads, 390 sheets, old-screen inventory, two Floor assertions). Then regression, commit, phase 5. Scores in phase 6.

## Commits
| Phase.part | Commit | What |
|---|---|---|
| 1 read-back | `1f2…` (first push) | `reports/U1_READ_BACK.md`, this file |
| 1 a+b | `107fbae` | TouchShell, kit Floor, three role Floors |
| 1 c+d | (2nd feat commit) | e2e/t1 support + floor fixture + floor spec, tile prefix, verify:web, old shell pieces deleted |
| 2 | (3rd feat commit) | Reservations screen, kit Row extended, old reservation/nav/toolbar specs updated |

## Environment (this container, never Neon)
- Postgres 16 local. `nimbus_t1_pristine` = seed + demo import (+ QA rows from the first overlapping baseline runs). `nimbus_t1` = regression DB, re-cloned from pristine before each regression. `nimbus_t1_floor` = fixture DB (70 drawn tables; seeded tables set inactive; fresh waiter shift).
- API: `node apps/api/dist/main.js` from a scratch cwd (no `.env` loaded), `:3001`; DB chosen by `T1_DB`. Scripts in the session scratchpad: `start-api.sh`, `reset-db.sh <db> [keep]`, `serve-web.sh` (prod `next start` on `:3100`).
- Baseline: `0af95f8` built in a scratch worktree with `NEXT_PUBLIC_KIT_GALLERY=1`; 151 passed / 7 failed / 3 skipped at vp-1440x900 (`reports/T1_PLAYWRIGHT_BASELINE.txt`).
- Run e2e/t1 with: `T1_FLOOR_FIXTURE=1 T1_PASSWORD=<demo password, shell only> PW_BASE_URL=http://localhost:3100 PW_API_URL=http://localhost:3001 PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test e2e/t1 --project=vp-1440x900`.

## Decisions taken
1. moses-build-standards loaded (v5).
2. Sections filtered in `pos-shell/touch-sections.ts` (not in `kit/sections.ts`, not mine).
3. Lock signs out to the existing PIN screen (`/login?reason=logged_out`); no lock screen drawn.
4. Tile for a table with several open orders: whose/mine/minutes from the oldest, amount = sum (BigInt cents).
5. Only today's PENDING/CONFIRMED bookings mark a table Reserved.
6. Ready has no drawn tile look: an order in READY shows as Open.
7. A name with a prefix ("Tab 3", "TD-01") shows the prefix small above the number (kit TableTile) — fixes U0's carry-over.
8. Area chips sorted by name; "Other" for tables with no area.
9. Supervisor "All areas" from 1600 px wide, default when offered (Floor-1920).
10. Header summary short form ("17 of 32 open") and small search under 1280 px (Floor-1024).
11. Fixture DB only: seeded demo tables set inactive (PATCH, no delete), stale waiter shift closed and reopened.
12. Test PINs: made at load time by a manager reset (the only route that exists), kept in test memory, never written or printed.
13. "Filled button" rule ignores a chosen chip/option (aria-pressed/selected) and 1 px screen-reader-only labels.
14. Reservations: no endpoint edits a booking's details → "Change details" became "Change table" (assign-table).
15. Reservations: "Wait for table N" option left out (it calls nothing).
16. Reservations: supervisor keeps other days through a kit Switcher (‹ day ›); old history filters removed (not drawn).
17. Row tall size and leading width reuse the existing 76 px tokens (tokens file not mine).
18. Old specs keep working through `data-operational-table-id` on the tile wrapper.

## Left out (and why)
- Tile: guests on an open table, Late, Bill (asked/printed), Ready, Tabs/New tab — no data or no drawing yet (E1/E4/E5/T2).
- Supervisor Floor segmented "Late · n / Bill · n" — no data.
- Me: "Items voided" (no per-person void count), "Ask to swap" (needs a colleague list the role cannot read), "Change my PIN" (no endpoint lets a person set their own PIN; grep of the whole API: only manager reset/issue and HR reset).

## Specs updated (old shell/nav/toolbar/4B reservations)
cashier-floor: navigation-and-default-route, hidden-legacy-routes, legacy-compatibility-regression, responsive, responsive-c2, shared-floor-parity · supervisor-prompt3: floor, regression, role-boundaries · manager-shell: shell-parity (frontline case) · supervisor-reservations: fixtures, arriving-actions, attention, create-reservation, history-and-pagination, navigation-and-default-view, privacy-and-boundaries, responsive, seated-and-completion, waiter-visibility.

## Decisions since phase 2 (phase 3–4)
19. "as at HH:MM" = when the screen's data was read (`dataUpdatedAt`); Floor, Reservations, Receipts, Till refresh every 30 s.
20. An order with nothing on it (NEW, no items) does not make a table busy; a seated booking's table (OCCUPIED) shows open.
21. Order lists are read in pages of 500, de-duplicated by id: offset paging over tied createdAt lost rows (Me sales went down after a payment).
22. Deposits: keep / give back only when one was RECEIVED (the service only acts on RECEIVED); no-show asks.
23. Waiter seat sends createOrder: true (the old waiter screen did); supervisor seat sends the table only (4B did).
24. Me: "Sales so far" for the waiter only; attendance clock in/out kept in My shift (old Me had it); End my shift asks first; the "Open Me" shift line hides on Me.
25. Receipts: "Print again" left out (reprint only records); list "How" column left out (no method on the order list); Refund reuses the cashier refund rules.
26. Till: only what the summary returns; per-method tiles, cash sales line, Pay out, Open the drawer left out.
27. Sheets cover the bars: shell is `isolate`, bars at -z-10.

## Next
- Phase 3 Me: shoot, spec (e2e/t1/me.spec.ts), commit.
- Phase 4 Receipts + Till, phase 5 Approvals, phase 6 sweep + scores + report.
