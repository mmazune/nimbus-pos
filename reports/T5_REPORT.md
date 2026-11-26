# T5 report: the four tracks joined, the screens on the new engines

Branch `t5/join-up`, cut from `rebuild/main` `41772c7`; merge result `f0b6d87`. Session on Opus,
26 Nov 2026. `moses-build-standards` v5 loaded first (rule 8). Every proof ran on the T4 demo venue
(Tapas Downtown) loaded fresh into a throwaway Postgres in this container; Neon was never touched,
no `.env*` was read or written, and no password or PIN is in any file (see "How the proofs run").

Grades: **[live]** driven or run here in this turn; **[emulation]** headless Chromium at a set
viewport; **[code]** read; **[asserted]** stated, not checked.

## Verdict

**Done.** All six phases are built and every Done-when line is proven, or settled by a numbered
decision: Done-when 1–7 and 9 are proven [live]; Done-when 8 holds for every SCREENS.md row T5 set
(`Waiter-Ready` 22, `Kitchen` 20; re-scored `Main`, `Floor-Phone`, `Supervisor-Table` 20,
`Order-Terminal` 21), and every T7 form T5 built scores 20 or more (Join tables, the last one, 22 on
the final build). The four browser cases, with T1's 27 and the evening, passed 53/53 three runs in
a row on fresh demo venues. One API defect was found for T6 (decision 20).

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
table through T1's Floor (`e2e/t5/floor.ts`). Three runs in a row: **53 of 53, three runs in a row** (T1's 27 + the evening + T5's 25), each on its own fresh venue,
on the final web build (`reports/proof/T5/final_three_runs.txt`) [live]. Runs 2 and 3 show later commit
ids only because proof images were committed between runs; no code changed.

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
Three runs in a row with everything else: 53/53, 53/53, 53/53 (`final_three_runs.txt`) [live]. The chains
run alone also passed 6/6 before that.

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

Three reviews, each by a fresh subagent that built nothing and saw no earlier score (§5A.12, pass 20/24
with no zero), screenshots beside the drawings [emulation, reviewer]:

| Screen (drawing) | Round 1 | Round 2 | Round 3 |
|---|---|---|---|
| Floor with areas and tabs (Floor-Tabs; SCREENS rows Main, Floor-Phone) | 12 fail | 18 fail* | **20** |
| New tab (Tab-Name) | 17 | **21** | |
| Order: N left, sold out (Order-Terminal) | 16 | **21** | |
| Sold-out line and send report (Order-Line-Sold-Out) | 15 | **20** | |
| Item sheet: allergy, takeaway, hold, guest (Order-Line-Allergy) | 11 fail | **21** | |
| Fire with undo (Order-Hold-Fire) | 19 | **22** | |
| Table actions (Supervisor-Table) | 17 | **20** | |
| Move table (Table-Move) | 15 | **23** | |
| Join tables (Table-Join) | 18 | 19 | 19, 15, 20, then **22** on the final build (decision 19) |
| Move a line (Line-Move) | 14 | **23** | |
| Split by guest / item / amount / evenly | 17 / 16 / 15 / 17 | **21 / 21 / 22 / 22** | |
| Change waiter (Change-Waiter) | 15 | **22** | |
| Hand over your tables (Handover-Offer) | 15 | **21** | |
| Accept a hand-over (Handover-Accept) | 14 | **22** | |
| Waiter Ready (Waiter-Ready) | 15 | **22** | |
| Kitchen tickets (Kitchen) | 16 | **20** | |
| Bar tickets (Bar) | 16 | **20** (reviewer: tentative) | |
| Kitchen Done (Kitchen-Done) | 14 | **23** | |
| Kitchen Sold out (Kitchen-Sold-Out) | 14 | **22** | |
| Set a number (Kitchen-Set-Number) | 15 | **22** | |

\* round 2 scored a stale phone screenshot (its test had not re-run after the fix); round 3 used fresh ones.

What changed between rounds: the item sheet's filled button got its own row on a phone (it was cut at
390); tab tiles show the note in whole words that fit; sheets leave 32 px above them; the sold-out line
reads as drawn with a red Remove; kitchen and Ready cards are equal height, item lines larger, the bar
highlights the section you are on, Ready's age goes amber and red; split totals are money on the right
with "Each pays" as the big figure; Change waiter marks who has it now; Move and Join show one area at
a time; the tabs toggle and header say "tabs".

**Join (22/24 on the final build).** Rounds 3 and 4 scored 19; a fifth scored 15 because Main hall's 22
tables pushed the bills card off screen. The sheet was rebuilt to the drawing: it rises over the menu with
the order column in view, the amount on the table is under the title, the list shows three rows then
scrolls with a count line, the bills card (each table, then "One bill on …") and the footnote stay in view,
and Cancel sits beside the filled button. Two fresh reviewers then scored **20** and, on the final build,
**22**. Their remaining notes are on the shared kit (a selected area chip as dark as the chosen table; no
fade where the list scrolls) and go to the next kit pass, not this sheet.

SCREENS.md rows set this phase: `Waiter-Ready` built 22/24, `Kitchen` built 20/24; re-scored after
T5's changes: `Main` and `Floor-Phone` 20/24, `Order-Terminal` 21/24, `Supervisor-Table` 20/24. The T7
forms (Floor-Tabs, Tab-Name, Table-Move, …, Bar) have no rows in this branch's SCREENS.md (T7 adds them
on its branch); their scores are the table above.

## Done-when 9 — the diff

`git diff --stat f0b6d87..HEAD`: 188 files changed, 5247 insertions(+), 320 deletions(-), of which `apps/web` 75, `reports` 112,
`design/screens/SCREENS.md` 1 (Status cells only) [live]. Nothing under `apps/api`, `packages/db` or
`design/screens/html|png|kit.css`.

## Gates (final, this turn)

`reports/proof/T5/final_gates.txt` [live]:

```
final gates on cc33ee3 2026-11-26T18:49:37Z
api typecheck exit 0
api build exit 0
Test Suites: 72 passed, 72 total
Tests:       1318 passed, 1318 total
 ✓ Compiled successfully
Route (pages)                                              Size     First Load JS
+ First Load JS shared by all                              109 kB
web build: last next build exit 0 (web.sh stops on failure)
✔ No ESLint warnings or errors
check:ui green
verify:web exit 0
check:event green
```

After the last web change (the Join rework and the blank-choice fix, `33926b4`) the web gates were run
again [live]: next build ok (`web.sh build` stops on failure), web typecheck exit 0, eslint on every
changed web file exit 0, check:ui green, check:event green; `apps/api` has not changed since `cc33ee3`.
Then three full runs, 53/53 ×3, on `33926b4` (`final_three_runs.txt`).

`eslint` (no `--fix`) on every changed web file: clean (`next lint` in `verify:web` covers them all). No file under `apps/api` or `packages/db` changed, so the API gates are the merge's, re-run here.

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
18. **All browser proofs share one fresh venue per run** (T1's 27, the evening, every T5 spec, in that
    order). Where one case changes what a later case starts from, the later case sets up its own start
    through the API as staff would (a waiter starts a shift, the chef puts a dish back on, its own table),
    never by editing the database.
19. **Join tables: what differs from its drawing, on purpose.** The drawing's last sentence, "another
    waiter's table needs a supervisor", is left out: the join route checks only the join right, so the
    sentence would be untrue. Guests are not stored on an order, so the subtitle shows the amount only.
    The venue's areas hold up to 22 tables, so the sheet adds area chips and a three-row list that scrolls.
    Scored 22/24 on the final build by a fresh reviewer.
20. **An API defect found, not fixed (T6's code):** after a `split-items`, the next `POST /api/pos/orders`
    on the branch answers 500 every time: the child is numbered `ORD-n-S1`, and `generateOrderNumber`
    takes the newest order's number, reads `n` and proposes `ORD-(n+1)`, which already exists. The T5
    hand-over case therefore runs before the split case. Reproduce: split items on any bill, then open a
    new table.
21. **T1's and T3's proof images were regenerated** by T5's runs on the demo venue (their specs ran here
    as phase 1's gate) and are committed as such; their reports describe their original fixtures.
22. **Rule 10 on an open order screen** uses T3's measurer, scoped to the screen and its sheet; T1's page
    measurer would count the Floor tiles hidden under the full-screen order screen.
23. **A tab's note on its tile** is shortened to whole words that fit (about 16 letters, no dangling little
    word); the whole note is kept on the tab.
24. **Tests run in Kampala time** (T5's own terminals), so the header clock and "since 19:40" agree.
25. **The Lamb chops race opens each racing bill first.** Two new bills created at the same instant can
    collide on the API's order number (a 500; one run in three hit it; decision 20's class, T6's code). The
    race the case proves is for the last portion, so each racer's table gets its bill (a soft drink, sent)
    one after the other, then both send the lamb at the same moment. Exactly one gets it, the other is told.
26. **A choice saved without a name shows nothing** on an order line (a demo line showed a bare "· ·").

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
| Join's "another waiter's table needs a supervisor" | the join route checks only the join right (decision 19) | — |
| Guest picker on the phone's order screen as a strip | the item sheet carries it on both sizes; no separate strip | — |

## For the other tracks

- **T6 (API):** a who-is-on-shift list readable to a waiter, collected tickets, and the waiter's name on
  the ticket queue would close three left-outs above. `split-items` still takes no locks (T2's note). Order numbers collide after a split and when two bills
  open at the same instant (decisions 20, 25).
- **T7 (drawings):** the T7 forms are built (Floor-Tabs, Tab-Name, Table-Move, Table-Join, Line-Move,
  Split-Guest/Item/Amount/Even, Change-Waiter, Handover-Offer/Accept, Order-Hold-Fire,
  Order-Line-Allergy, Order-Line-Sold-Out, Kitchen-Done/Sold-Out/Set-Number, Bar); their SCREENS.md rows
  live on your branch, so their scores are in this report, not in SCREENS.md.
- **T4 / seed owner:** the venue loader could give tables their `areaId` itself (today the seed's second
  run does it) and could make a Tabs area.
- **Everyone:** run browser proofs through `apps/web/e2e/t5/stack.sh`.

## Closing

```
Done: the four tracks are joined on t5/join-up and the screens run on T2's engines.
Menu: one call, "N left", sold out within 10 s on every terminal, the red line, Send names what it skipped.
Floor: server areas, Tabs and New tab, Ready/Late/Not sent/Joined; move, join and split again, line move,
  four splits, change waiter, hand-overs with the colleague accepting and the shift-end way out.
Kitchen and bar screens for chef and bartender; Ready reaches the waiter; hold, fire, undo, allergy, takeaway.
Proof: 53/53 three runs in a row on fresh demo venues; API unit 1,318/0 failed; all web gates green.
Look: every SCREENS.md row T5 set scores 20 or more; every T7 form T5 built too (Join tables 22).
Found for T6: order numbers collide after split-items and when two bills open at once (20, 25).
You need to: review t5/join-up and decide when it merges; give T6 decision 20's order-number defect;
  ask T7 to add rows for its built forms.
```
