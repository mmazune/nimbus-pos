# T5 report: the four tracks joined, the screens on the new engines

Branch `t5/join-up`, cut from `rebuild/main` `41772c7`; merge result `f0b6d87`. Session on Opus,
26 Nov 2026. `moses-build-standards` v5 loaded first (rule 8). Every proof ran on the T4 demo venue
(Tapas Downtown) loaded fresh into a throwaway Postgres in this container; Neon was never touched,
no `.env*` was read or written, and no password or PIN is in any file (see "How the proofs run").

Grades: **[live]** driven or run here in this turn; **[emulation]** headless Chromium at a set
viewport; **[code]** read; **[asserted]** stated, not checked.

## Verdict

__VERDICT__

## How the proofs run (rules 14, 15, 24)

- `apps/web/e2e/t5/stack.sh <command>`: one shell makes an empty `nimbus_event_*` database
  (`tools/test-env.sh`), loads the venue (`packages/db/demo-venue/run.sh`), reads the loader's
  sign-in table from stderr **into a shell variable only** and hands it to the tests as `T5_SIGNIN`,
  re-runs `db:seed` so the venue's tables join their areas (decision 3), starts the built API on
  :3001 with JWT secrets minted for that boot, runs the command, and stops the API by its PID.
- The web app is a production build (`next build`, then `next start -p 3100`), rebuilt after every
  code change and restarted by its recorded PIDs; nothing else was stopped.
- Chromium is the container's own (`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`, the config's hook).

## Phase 1 — One branch that works

Done-when 1: **the four branches are merged; every phase-1 gate is green; the resolutions are listed.**

Merges, in the order given, each `git merge --no-edit`: `origin/t2/engines`, `origin/t4/review-and-data`,
`origin/t3/order-screen` (all clean), `origin/t1/screens` (four conflicts, as the trial said).

| Conflict | Resolution |
|---|---|
| `components/waiter/floor/WaiterFloorScreen.tsx` | T1's `FloorScreen` is the floor; a table tap mounts T3's `OrderScreen` with its reservation card and shift banner; T1's data loading (all open orders, 30 s poll) kept; T3's "Table unavailable" block kept |
| `components/cashier/floor/CashierFloorScreen.tsx` | the same; T1's `extraAction` ("Find bill" inside the Floor's top row) replaces the old sibling button above the floor |
| `components/supervisor/floor/SupervisorFloorScreen.tsx` | the same, with "Find order" |
| `design/screens/SCREENS.md` | every row kept; each row takes the side that had moved past `drawn` (no row had both sides changed) |
| anything else | nothing else conflicted; no `apps/api` or `packages/db` file needed resolving |

Gates on the merge (`reports/proof/T5/phase1_gates.txt`) [live]: `verify:web` exit 0 ("No ESLint
warnings or errors", `check:ui` green); API `tsc --noEmit` exit 0; API `nest build` exit 0; API unit
**1,318 passed, 72 suites, 0 failed**; `check:event` green; web `next build` exit 0.

Both tracks' browser suites run on the demo venue (T1 and T3 wrote theirs for the old import's cast):
each suite gained a venue mode — the venue's own people and load-time PINs, a 42,000 dish found by name,
`M`-prefixed labels, the drawn states made through the API, a real Tabs area — and T3's specs reach a
table through T1's Floor (`e2e/t5/floor.ts`). Three runs in a row: __THREE_RUNS__

The cashier sentence in `lib/cashier/payment-validation.ts` that said "backend" now reads "Cash can
be taken once everything on the bill has been served."; T1's sweep no longer allows the old line.

## Phase 2 — The menu knows what is left

Done-when 2: **one menu call; "3 left", sold out and the red line; proven on two terminals at once.**
`e2e/t5/menu.spec.ts` [live, emulation]: three waiters' terminals open at once (Sanyu, Brian, Gloria).
- The order screen's menu is one `GET /api/menu/workspace` (the waiter Floor warms the same cache); the
  network log shows no `/menu/navigation`, `/menu/catalog` or per-item read.
- The chef sets 2 left: all three show "2 left" within 10 s; one is sent, the other two count to "1 left".
- The chef marks it sold out: every terminal shows "Sold out since HH:MM" within 10 s (the screen polls
  the changed-since endpoint every 4 s); Brian's unsent lamb turns red — "Sold out, it cannot be sent" —
  with Remove, and leaves Send's count and the total.
- Send names what it skipped ("Not sent: 1 Lamb chops · Sold out. The rest went to the kitchen.") and the
  cola is sent (checked on the server). The server also refuses adding the sold-out dish (409).
- Phone, 390 × 844: "3 left" and "Sold out since" on a phone tile, rule 10 green.
- Popular and Offers come from the server (decision 6). Pure tests: `e2e/t5/menu-data.spec.ts` 4/4.

## Phase 3 — Areas, tabs and moving people

Done-when 3: **Areas, Tabs and "New tab" on the Floor; move, join, split four ways, move a line,
change waiter and hand over each work from the table actions sheet.** `e2e/t5/tables.spec.ts` 5/5 [live]:
- The Floor's area chips are `GET /api/areas` in the manager's order, the Tabs area last; "New tab"
  (drawing Tab-Name) opens "Tab n" with its note, the order screen opens on it, and the tile carries the note.
- Tiles take Late, Ready, Not sent and Joined from `GET /api/floor/state`.
- Supervisor: Move table (M01 → M05, the order moves), Join tables (M07 onto M04, one bill = the sum;
  M07's tile reads "Joined"), Split tables again (M07 gets its own bill back, same total), Move a line
  (M09 → M02, a bill opens there), Change waiter (M12 → Brian). Each checked on the server.
- Split the bill: by guest (two bills from lines tagged Guest 1 and Guest 2 when ordered), by item (a
  second bill on M15), by amount (Half) and evenly (3), the last two recorded for the cashier.
- Hand over this table (Gloria → Brian; Brian accepts on his own screen), then Gloria's "End my shift" is
  refused with the way out shown — "Hand over your tables" — Brian accepts all, and the shift ends.
- Phone 390 × 844: the Tabs area with "New tab", rule 10 green.

## Phase 4 — The kitchen talks back

Done-when 4: **Ready reaches the waiter and is collected; hold, fire, undo, allergy and takeaway work.**
Proven inside the "Starters now, mains later" chain at 1280 × 800 and 390 × 844 [live]:
- The waiter's bar gains Ready with a live count; `/waiter/ready` (drawing Waiter-Ready) lists what is on
  the pass for them, oldest first, with Collected.
- The item sheet (drawing Order-Line-Allergy) gains Allergy (Nuts, Gluten, Dairy, Eggs, Shellfish, Other),
  "Where it is eaten" (Here / Takeaway), "When" (with the next Send / Hold for later) and "For guest".
- Held lines sit under "Held for later" with "Fire now"; firing shows "… goes to the kitchen in 3 seconds ·
  Undo" (drawing Order-Hold-Fire); Undo keeps it held (proven on the server after the window: held, never
  sent), a second fire reaches the kitchen.
- Floor tiles show "Ready" and "Late" from the server (T1's floor spec now allows both on the venue).

## Phase 5 — The kitchen and bar screens

Done-when 5: **a chef and a bartender each sign in to their own screen; eight tickets fit 1920 × 1080;
Done and Sold out work.** `e2e/t5/kitchen.spec.ts` 4/4 [live]:
- A chef's PIN lands on `/kitchen` ("Kitchen", the kitchen, cold kitchen and dessert stations); a
  bartender's lands on `/kitchen` too and sees "Bar" with bar tickets only. Their bar: Tickets · Done ·
  Sold out (Store waits for its engine).
- Tickets (drawings Kitchen, Bar): oldest first, coloured by age against the station's own limits,
  allergies in red, voided lines struck with "Voided HH:MM, do not make", Ready; "To make now, all
  orders"; "Sold out today". At 1920 × 1080 nine open tickets were all fully on screen, no scrolling.
- Done (Kitchen-Done): last hour or today, how long each took, collected or not; "Bring back to Tickets".
- Sold out (Kitchen-Sold-Out, Kitchen-Set-Number): out or low and all items, Mark sold out, Back on,
  Set a number — each followed on the waiter's menu.

## Phase 6 — The chains, as real people, on the demo venue

Done-when 6: **the four browser cases pass three runs in a row.** `e2e/t5/chains.spec.ts`, each chain at
1280 × 800 and again with the waiters at 390 × 844:
- "Lamb chops": the chef sets 2 left on the kitchen screen; one waiter sends one; two waiters press Send
  at the same moment for the last; exactly one sends it (server), the other is told by name and the rest
  of that order goes; the dish ends SOLD_OUT and a fourth terminal shows it grey within 10 s.
- "Starters now, mains later": as in phase 4, the kitchen seeing only the starter, then the main.
- "A busy Friday": a tab opened and named, a party moved, two tables joined and split, a hand-over
  accepted, then the shift ended.
- "Table 12's evening" still passes (T3's spec, on the venue).
Three runs: __THREE_RUNS_SHORT__

## Done-when 7 — rule 10, check:ui, no developer wording

Rule 10 is measured on every screen proven above (T1's page measurer; on an open order screen T3's
measurer, scoped to the screen and its sheet, because the full-screen order screen covers the Floor):
no sideways scroll, nothing clipped, no target under 44 px, no text under 12 px, at most one filled
button — at 1280 × 800, 390 × 844 and (kitchen) 1920 × 1080. Measurements:
`reports/proof/T5/phase*-measured.json`. `check:ui` green. Developer wording: T1's sweep now includes
`/waiter/ready`; `e2e/t5/sweep.spec.ts` sweeps the chef's and bartender's sections and the order
screen's new sheets with T1's ban list (plus raw codes such as SOLD_OUT and OPEN_TABLES). The login
page's "This frontend currently supports …" sentence is gone.

## Done-when 8 — SCREENS.md and the look review

__LOOK__

## Done-when 9 — the diff

`git diff --stat f0b6d87..HEAD`: __DIFFSTAT__

## Gates (final, this turn)

__GATES__

## Decisions taken

1. **Merge resolutions** as in the phase 1 table.
2. **Disclosed slip:** at the start I wrote the throwaway database's URL into a scratch file for a
   moment; it was shredded at once and every later shell got the URL from `test-env.sh --reuse` or
   `stack.sh` in memory only (rules 14, 15).
3. **The venue's tables had no area** (the loader runs after the seed); `stack.sh` re-runs the idempotent
   `db:seed` on the throwaway database, whose sweep puts them in areas named after their floor plans
   (T2's own instruction). No file under `packages/db` changed.
4. **T1's approvals spec skips the shift-swap step on the venue**: the venue holds no roster and no route
   makes one, so no swap can exist there; it still runs where the data holds one (rule 21).
5. **"Lamb chops" is added to the venue by a manager's API call** (fictional price 45,000, in Grill): the
   venue grills lamb but sells no chops, and the case keeps its name.
6. **Popular:** a group a manager named "Popular…"/"Offers…" is pinned first, then the server's list
   (sales over 14 days, or menu order). T3's specs now click "Popular" (the server's group).
7. **Server areas were pulled forward into phase 1**, so T1's Tabs test runs on real T2 tabs, not on
   tables named "Tab n".
8. **The waiter Floor's old menu prefetch** (navigation + catalog for the deleted order builder) now warms
   the workspace instead: one menu call per terminal.
9. **A line's guest is set when it is ordered** (the item sheet's "For guest"); a sent line cannot be
   changed (T2: ITEM_ALREADY_SENT), so the drawing's "tap a line, then the guest" after sending is left out.
10. **Hand-over colleagues** are the colleagues holding tables now, read from the open orders: no staff
    list is readable to a waiter. A colleague on shift with no table yet is not offered.
11. **Split by amount and evenly record shares for the cashier**; paying one share waits for U3 (T2).
12. **Tabs areas are made by a manager** (`POST /api/areas` kind TABS) — on the venue, by the fixture as a
    manager would; no settings screen exists yet. "New tab" is the waiter's.
13. **Kitchen tickets oldest first**, as drawn (the API ranks red first).
14. **Chef and bartender land on `/kitchen`**; a supervisor or manager may open it and sees every station.
15. **The fire's undo window** is the server's `undoUntil`, shown as a countdown clamped to 0.5–3.5 s.
16. **Specs I changed outside `e2e/t5`** (rule 23; all under `apps/web`, testing what T5 replaced):
    T1 `support.ts`, `floor-fixture.ts`, `floor.spec.ts`, `approvals.spec.ts`, `left-out.spec.ts`,
    `me.spec.ts`, `receipts-till.spec.ts`, `reservations.spec.ts`, `sweep.spec.ts`; T3 `fixture.ts`,
    `actions`, `evening`, `kept`, `phone`, `taps`, `waiter` specs; `cashier-floor/settlement-fail-closed.spec.ts`.
17. **A production build ran while my own `next start` served the same folder** once; the server was
    restarted by its PIDs, an orphaned `next-server` of mine was stopped by PID, and from then on the
    restart helper records the whole process tree.
__EXTRA_DECISIONS__

## Left out, and which milestone brings it

| What | Why | Brings it |
|---|---|---|
| Tile "Bill" | "bill asked" is only an audit row; no API reads it | E4 |
| Ready's "Collected in the last hour" | the ready route lists only what waits; nothing lists collected tickets | E5 follow-up |
| Waiter's name on a kitchen ticket; "marked by" on sold out | the answers carry ids only; a chef cannot read the staff list | E9 (people) |
| Kitchen Store, "Low in the store", "Check stock / We have it" | stock engine | E6, E7 |
| Paying one share of an amount or even split | the close route takes the whole balance | U3 |
| Giving a sent line a guest; "Guests 2" on a new tab | no route | later E3 pass |
| A colleague with no table in the hand-over list | no who-is-on-shift route a waiter can read | E9 |
| Guest picker on the phone's order screen as a strip | the item sheet carries it on both sizes; no separate strip | — |

## For the other tracks

- **T6 (API):** a who-is-on-shift list readable to a waiter, collected tickets, and the waiter's name on
  the ticket queue would close three left-outs above. `split-items` still takes no locks (T2's note).
- **T7 (drawings):** the T7 forms are built (Floor-Tabs, Tab-Name, Table-Move, Table-Join, Line-Move,
  Split-Guest/Item/Amount/Even, Change-Waiter, Handover-Offer/Accept, Order-Hold-Fire,
  Order-Line-Allergy, Order-Line-Sold-Out, Kitchen-Done/Sold-Out/Set-Number, Bar); their SCREENS.md rows
  live on your branch, so their scores are in this report, not in SCREENS.md.
- **T4 / seed owner:** the venue loader could give tables their `areaId` itself (today the seed's second
  run does it) and could make a Tabs area.
- **Everyone:** run browser proofs through `apps/web/e2e/t5/stack.sh`.
