# T5 progress — join the four tracks, then wire the screens to the new engines

Branch `t5/join-up`, cut from `rebuild/main` `41772c7`. Merge result (Done-when 9 baseline): `f0b6d87`.

## Now
- **Done.** Final three runs 53/53 ×3 on fresh venues; final gates green; look reviews done; report
  written (`reports/T5_REPORT.md`); branch pushed.

## Phases
| Phase | State | Commit |
|---|---|---|
| 1 One branch that works | done | f0b6d87, 0e1dac5 |
| 2 The menu knows what is left | built, proven (menu.spec 2/2) | 0ab105a |
| 3 Areas, tabs and moving people | built, proven (tables.spec 5/5) | ee2fa26 |
| 4 The kitchen talks back | built, proven in the Starters chain | ee2fa26, 053b3da |
| 5 The kitchen and bar screens | built, proven (kitchen.spec 4/4) | 7edbafd |
| 6 The chains in the browser | done (53/53 ×3 with everything) | 053b3da … |

## How to run (no credential in any file)
- `/tmp`-free: `apps/web/e2e/t5/stack.sh <command>` loads a fresh venue into a throwaway database,
  keeps its sign-in table in memory (`T5_SIGNIN`), re-seeds for areas, starts the built API on :3001.
- The web app must already be a production build served by `next start -p 3100`.
- `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium T1_FLOOR_FIXTURE=1 apps/web/e2e/t5/stack.sh npx playwright test e2e/t1 e2e/order/evening.spec.ts e2e/t5 --project=vp-1440x900`

## Decisions taken (numbered in the report)
1. Merge resolutions as listed in the report.
2. The venue's tables join their areas by a second `db:seed` on the throwaway database (the seed's own sweep).
3. Server areas pulled forward from phase 3 into phase 1 (T1's Tabs test needs real tabs).
4. The shift-swap step of T1's approvals spec is skipped on the venue: no roster exists and no route makes one.
5. "Lamb chops" is added to the venue by a manager's API call (the venue sells no chops).
6. Popular: a manager's own "Popular…" group pinned first, then the server's list.
7. A line's guest is set when ordering; giving a sent line a guest has no route (left out).
8. Hand-over colleagues are those holding tables now (a waiter cannot read a staff list).
9. Kitchen tickets oldest first (the API ranks red first).
10. Chef and bartender land on /kitchen; supervisor and manager may open it.

## Left out (with the milestone that brings it)
- Tile "Bill" (no API reads "bill asked"), E4. Ready's "Collected in the last hour" (no route).
- Waiter name on a kitchen ticket and "marked by" on sold out (ids only, no readable staff list).
- Kitchen Store and low stock (E6/E7). Paying one share of an amount/even split (U3).
- Re-assigning a sent line to a guest; a colleague with no table in the hand-over list.
