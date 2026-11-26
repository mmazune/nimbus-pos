# T1 report — the shell, the Floor, and every section that already has an API

Branch `t1/screens`, cut from `rebuild/main` at `0af95f8`. Every commit was pushed to `origin/t1/screens`; no other branch was pushed, nothing was merged, no PR was opened.
Everything below ran in this container: a throwaway Postgres 16 (`nimbus_t1_*`, seed and demo import), the API from `apps/api/dist` on `:3001` with no `.env` file, and the production web build on `:3100`. Neon was never touched. Test PINs were set at load time through the manager's reset route and kept in test memory only.

Grades: **[live]** = driven in Chromium against the running app and API · **[code]** = read in the code · **[asserted]** = stated, not measured.

## Verdict
All six phases are done. Ten screens are built to their drawings and pass the look review; the lowest scores are Floor-Phone and Supervisor-Approvals at 20/24. The scores were given before the last drawing fixes. Where a drawing still differs, the difference is listed with its reason (Done-when 3). `pnpm verify:web` and the web build are green. The T1 suite passed 27/27, three runs in a row. The regression suite is 157 passed, 2 failed, 2 skipped, against a baseline of 151 / 7 / 3; both failures also failed at baseline. Product code stays inside T1's paths. Old specs in other test folders were updated and listed (Done-when 6 and 7).

## Phase 1 — Shell and Floor (U1 Done-when 1–10)
| # | Line | Proof |
|---|---|---|
| 1 | Read-back with the Playwright baseline | `reports/U1_READ_BACK.md`, `reports/T1_PLAYWRIGHT_BASELINE.txt` (151 passed / 7 failed / 3 skipped at `0af95f8`) |
| 2 | Header and bar as drawn, exactly the listed sections; TabBar on a phone | [live] `e2e/t1/floor.spec.ts`; `floor-measured.json` chrome: header 64 + bar 76 at 1280, header 106 + TabBar 84 at 390; waiter `floor, reservations, me`; cashier `floor, receipts, till, me`; supervisor `floor, reservations, approvals, me` |
| 3 | 32 tables 8 × 4 roomy at 1280 × 800; 7 across compact at 1024 × 768; 12 across "All areas" at 1920 × 1080; no scrolling | [live] `floor-measured.json`: waiter1280 roomy 8 cols, 32 of 32 visible, tile 142 × 108; waiter1024 compact 7 cols, 32 of 32, 129 × 84; supervisor1920 roomy 12 cols, 70 of 70 |
| 4 | Every tile state the data supports is on screen; the rest listed | [live] `Main-1280x800-waiter.png`, `Floor-1920x1080-supervisor.png` (Free, Reserved with time and party, Open mine/other with minutes and amount); left out: see the list below |
| 5 | No sideways scroll, no cut text, no target < 44, no text < 12, at all four sizes | [live] `pageRules` at 1024, 1280, 1920 and 390 — 0 on every count (`floor-measured.json`) |
| 6 | `check:ui` green; new screens under `src/screens/`, kit only | `check:ui green` (40 files, 0 allowed hits); screens in `src/screens/{floor,reservations,me,receipts,till,approvals,shared}` |
| 7 | Tapping a table still opens and completes an order, each role | [live] regression suites `cashier-floor` (settlement, close), `supervisor-prompt3` (table workspace actions); `e2e/t1/me.spec.ts` opens, sends and pays a waiter order through the API and the Floor |
| 8 | Lint 0, typecheck 0, build 0; no baseline-passing spec fails except updated ones | see Gates |
| 9 | Diff inside `apps/web`, `reports`, `SCREENS.md`, one script line; last commit on GitHub | see Gates (the branch named in U1 is replaced by `t1/screens` per T1) |
| 10 | `Main`, `Floor-1024`, `Floor-1920`, `Floor-Phone` say `built` with a score | `SCREENS.md`: 22, 23, 21, 20 of 24 |

## T1 Done-when
1. **Phase 1's ten lines hold** — the table above.
2. **Reservations** [live] `e2e/t1/reservations.spec.ts`. The waiter seats a booking that is late, at another free table that fits (`Reservations-Waiter-seated-1280x800.png`). The supervisor creates, confirms, moves (change table), cancels with a reason, and completes a booking (`Reservations-Supervisor-new-`, `-cancel-`, `-1280x800.png`). Drawing beside build: `reports/proof/T1/compare/Reservations-{Waiter,Supervisor}-vs-built.png`.
3. **Me, Receipts, Till and Approvals match their drawings.** The beside-builds are in `reports/proof/T1/compare/`. The screens are driven in:
   - `me.spec.ts`;
   - `receipts-till.spec.ts`: a real bill of 5 × 42,000; a pending refund of 160,000, above the 150,000 demo limit; a safe drop; a short count; closing and reopening the till. The drawer lines are checked to add up to "Should be in the drawer".
   - `approvals.spec.ts`: a discount declined with a reason, leave approved, a swap declined, an alert resolved, with who and when shown.

   A separate reviewer listed every difference in layout, sizes and words: `reports/T1_DRAWING_DIFF.md`. It found 26 that the screen files could fix. They were fixed:
   - **Me:**
     - the pill reads "On shift";
     - a leave reads "Leave, 12 to 14 Dec" (the month once), and a swap shows its weekday;
     - request rows are 56 px and "Ask for leave" is 44 px;
     - gaps are 12 px, the caption is padded as drawn, and My day figures are 16 px bold.
   - **Receipts:**
     - the search field has a hidden label, a search icon and the drawing's placeholder, and is top-aligned with the tabs;
     - bill lines are 52 px with a 28 px quantity box.
   - **Till:** the action row spans the width; the field label reads "Cash counted".
   - **Approvals:** queue rows are 76 px; a percentage discount shows its money; the detail heading names the action ("UGX 21,000 off bill 000060").

   Fixed after that:
   - Fact and drawer lines are 40 px, as drawn.
   - The Approvals detail has no status pill (the drawing has none); decisions show on the row and in "Approved by" / "Declined by".
   - Tall rows (Reservations, Approvals) have 17 px titles.
   - Me is a bare person and the lock has no keyhole, as drawn.
   - Receipt and CashRegister stay: they are the nearest glyphs in the icon set the kit uses.

   What still differs is listed in the table below, marked ⟵ Done-when 3. Each item is either a left-out part, where the drawing shows something no data or route supports and printing it would be faked, proven live, or a real state the drawing does not show. The header station name is a setting, not a difference: with the station named, the header reads "Sarah N. · Cashier · Till 1" as drawn ([live] `left-out.spec.ts` test 1, `Header-station-Till-1-1280x800.png`); an unnamed station shows the default "Terminal 01". The side panel is now 420 px as drawn (372 px content width + 24 px padding on each side, from existing tokens; measured in `approvals.spec.ts`).

4. **No permission key, route or endpoint on any reachable screen** [live] `e2e/t1/sweep.spec.ts`. It covers every section of the three roles, the hidden cashier Queue, and the "not your role" guards, at 1280 × 800 and 390 × 844, with a wider ban list: API, v1, stub, endpoint, backend, MVP, adapter, build-step names, broken values, raw status codes. One sentence is listed, not fixed. It contains "backend", is beyond Done-when 4's three items, and lives in `lib/cashier/payment-validation.ts`, outside T1's paths: "Cash close is available only when the backend order status is Served." It shows on the hidden Queue.
**The A2 list** (`docs/direction/research/A2_frontend_as_built.md` §6, the developer wording found on screen):
- **Gone with the old screens:**
  - shell: role codes in the header ("WAITER"), the readiness strips with "Provider mode: Manual/stub only", "Session context ready" and "Floor check pending", and "Branch context unavailable";
  - Floor: the "No active operational tables…" empty state, "Assigned waiter unavailable" on a tile, and abbreviated table labels (now shown in full, prefix small);
  - the old Waiter, Cashier and Supervisor Me, Reservations, Receipts and Till screens and their lines ("Confirm the backend is running…", "…refreshed from the backend", "This closes the active till if accepted by the backend", "Deferred" cash movements, the role-boundary rows);
  - the guards' "frontend MVP" and "authenticated session context" text;
  - the hidden Queue's "audit-derived" line, and two cashier checkout/resolution lines it shows.
- **Inside an open table, outside T1 (T3 and the table workspaces):**
  - the waiter order builder lines;
  - the supervisor table workspace and its dialogs;
  - the cashier checkout, split and settlement panels;
  - `lib/waiter/reservation-model.ts:179`, used only by the waiter table workspace.
- **Outside T1's paths, left as they are:**
  - `pages/login.tsx` (the "API" chip, the raw branch id, the branch-context lines);
  - `lib/api/client.ts`'s raw network messages (T1 screens show plain words instead, through `screens/shared/words.ts`);
  - `lib/cashier/payment-validation.ts` lines, shown on the hidden Queue and in the cashier table workspace;
  - the constant "Terminal 01" (`pos-shell/station.ts` reads a station label if one is set; no route sets one).
5. **Rule 10 at 1280 × 800 and 390 × 844** [live] every `rules(...)` call in e2e/t1 checks: no sideways page scroll, no element past the screen edge, no money broken across lines, no cut text, no target under 44 px, no text under 12 px, at most one filled button. The sheets are measured open. All counts are 0 in `*-measured.json`.
6. **`verify:web` and the web build green; no baseline-passing spec fails except the updated, listed ones** — see Gates.
7. **Diff inside T1's paths.** U1 Done-when 9 sets the test this phase is held to. The diff shows `apps/web`, `reports`, `design/screens/SCREENS.md` and the one `package.json` line, and nothing else (Gates lists the paths):
   - In `apps/web/src`, every product file is in T1's list.
   - In `apps/web/e2e`, the new specs are in `e2e/t1`.
   - The old specs updated in `cashier-floor`, `manager-shell`, `supervisor-prompt3`, `supervisor-reservations` and `supervisor-approvals` drove the old shell and screens that T1 replaced. Done-when 6 allows updating them ("except the ones you updated and list"), they are listed under "Specs changed", and no other track owns a test folder.
   - Nothing under `apps/api`, `packages/db`, `screens/order`, `components/waiter/orders`, any `*TableWorkspace*` file or a T3 kit file is touched.
8. **`SCREENS.md` rows say built, with their score** — ten rows, below.

## Look review (separate reviewer, built nothing; §5A.12, pass 20/24, no zero)
| Screen | First review | After fixes |
|---|---|---|
| Main | 22 | 22 |
| Floor-1024 | 23 | 23 |
| Floor-1920 | 21 | 21 |
| Floor-Phone | 21 | 20 |
| Reservations-Waiter | 21 | 21 |
| Reservations-Supervisor | 18 (fail: History tab past the 390 edge) | 21 |
| Waiter-Me | 20 | 22 |
| Cashier-Receipts | 20 | 21 |
| Cashier-Till | 16 (fail: money broken across lines) | 21 |
| Supervisor-Approvals | 19 (fail: Approve looked disabled) | 20 |

Full scores: `reports/T1_LOOK_REVIEW_1.md`, `reports/T1_LOOK_REVIEW_2.md`. Fixed between the two reviews:
- Phone History moved into the header, and full-width tabs are tighter.
- The booking sheet is one column on a phone.
- Money stays on one line (kit `Text`).
- Typed amounts are grouped.
- No "short by" shows before a count is typed.
- A blocked Approve gives its reason.
- The Approvals tab shows the waiting count.
- Receipts shows what was kept after refunds.
- The shift and attendance words no longer clash.

The rule-10 check was too weak to catch the History overflow and the broken money; it now fails on both. The greyed Approve in the first two reviews was a colour fade caught mid-way; the proof helpers now wait for finite animations.

Not fixed, for the next pass (all scored, none a fail):
- Phone Tab tiles are tight, and the header says "tables" for tabs.
- Guest names in the demo data are long digit strings that wrap on a phone.
- Cancel-booking confirm is navy, not red (no filled red button in the kit).
- Refund reads pale (tonal with a lock).
- The till lists "Opening float" as a movement as well as the float line.
- Approvals has no "bill after" figure.

## Gates (final)
| Gate | Result |
|---|---|
| `pnpm verify:web` (web lint, typecheck, `check:ui`) | exit 0: "No ESLint warnings or errors", "check:ui green" (40 files, 0 allowed hits) |
| Web typecheck | exit 0 |
| Web build (`next build`) | exit 0 (final build after the last screen change) |
| Web unit tests | none exist (the `test` script is a stub), so 0 failed |
| `pnpm check:event` | green (1368 files, 1 pre-existing allow entry) |
| `git diff --check` | clean |
| T1 e2e, three runs in a row on a fresh fixture DB each run | 27 passed · 27 passed · 27 passed (`reports/proof/T1/e2e-t1-three-runs-final.txt`) |
| Regression, the baseline folders at vp-1440x900 | 157 passed, 2 failed, 2 skipped (`reports/proof/T1/regression-final.txt`). Baseline: 151 / 7 / 3. The 2 failures are baseline failures in manager-shell (`navigation-and-landing.spec.ts:96`, `:121`; not T1's surface). The 2 skips are the anomaly specs, which skip when the demo has no open alert; both skipped at baseline. Every other baseline pass still passes; the 5 other baseline failures (approvals discount/leave/swap) now pass. |
| `git diff --stat rebuild/main...HEAD` | 251 files. Outside `apps/web`: `reports/**`, `design/screens/SCREENS.md` (Status cells of T1's ten rows only), and root `package.json` (+1 line `verify:web`). Inside `apps/web`: T1 paths only — `pos-shell`, `floor`, role folders outside the workspaces and order files, `screens/{floor,reservations,me,receipts,till,approvals,shared}`, the pages for those routes, kit header/bars/tile/row/segmented/text/touch header and the new kit `ListTable`, and `e2e`. No `*TableWorkspace*`, `components/waiter/orders`, `screens/order`, T3 kit file, `apps/api` or `packages/db` file is touched. |

## Left out, and why (nothing faked)
| What | Why | Brought by |
|---|---|---|
| Tile: guests on an open table, Late, Bill asked/printed, Ready, Tabs / New tab | no data for them yet | E1 order truth, E4 bill, E5 tickets, T2 tables |
| Supervisor Floor "Late · n / Bill · n" | no data | E1 / E4 |
| Me: Items voided | no per-person void count | E1 |
| Me: Ask to swap | needs a colleague list these roles cannot read | U4 Team |
| Me: Change my PIN | no route lets a person set their own PIN (only manager reset/issue, HR reset) | API work, U4 |
| Reservations: "Wait for table N"; change details | the first calls nothing; no route edits details (Change table kept) | E3 / U4 |
| Reservations: old history filters | not drawn | — |
| Receipts: Print again, Send receipt | reprint only writes an audit row; no delivery | E4 |
| Receipts: "How" column, Paid time | the order list has no method and orders have no paid time; the list shows when a bill was opened | E1 / E4 |
| Till: per-method tiles, cash sales line, Pay out, Open the drawer, bill count | not in the till summary; no drawer driver | E4, hardware wave |
| Approvals: Void, Refund, Take over rows; PIN on the spot | no route lists pending refunds or voids; take-over has no route | E1 / E4 / U3 |
| ⟵ Done-when 3 · Till: "A supervisor signs any difference" | a supervisor sign-off on a till difference does not exist. Closing a till takes the cashier's written reason and writes an audit row (`tills.service.ts` reconcile), and no route records a sign-off. Printing the drawn sentence would claim a control that is not there (LONG-RUN-RULES: leave out and list, never fake), so the screen says "Write why if it does not match", which is what the route asks for  [live] `e2e/t1/left-out.spec.ts` test 2: a close sent with a sign-off field is refused, `400 property supervisorId should not exist` (`reports/proof/T1/left-out-proof.json`). | API work, U3 |
| ⟵ Done-when 3 · Receipts: "· needs a supervisor" on Refund | only refunds above the org's limit need a supervisor; smaller ones are paid at once (`refunds.service.ts`). A cashier gets 403 on `/settings`, so the screen cannot know the limit, and the drawn words would be false for small refunds. The button reads "Refund" (tonal with a lock, as drawn), and a refund that waits says so after it is asked  [live] `left-out.spec.ts` test 3: the cashier gets `403` on `/settings`; the org limit is 150,000; a 1,000 refund comes back `COMPLETED` at once, with no supervisor. | settings read for cashiers |
| ⟵ Done-when 3 · Me: "Needs a review", "Off shift" | not drawn, but real shift states (flagged shift, no shift); shown beside the drawn "On shift" | — |
| Shift-swap Approve | Outcome C: no roster write exists (decline only) | roster engine |

## Decisions taken
Decisions 1–27 are in `reports/T1_PROGRESS.md`. Added in phases 5–6:

28. Approvals reads the four domain lists (discount, leave, swap, alert), not the generic inbox: the supervisor does not hold `approvals:read`.
29. The approvals fixture asks for a 160,000 discount: the demo org approves anything up to 150,000 on its own, so a smaller one never waits.
30. A discount cannot be approved once the bill has taken money (UI gate, as before). While the payments are being read, or if they cannot be read, Approve waits and says why.
31. The Approvals tab count shares the Approvals screen's own queries and keys, so that screen makes one read, not two.
32. The sweep bans more than Done-when 4 names. The one hit in a file outside T1 is listed, not edited.
33. On a phone, the supervisor's History is a header action. Four tabs do not fit 390 px.
34. Money is never split across lines. Kit `Text` keeps a money string on one line.
35. Rule-10 proofs wait for finite animations before they measure or shoot.

## Specs changed (old specs, updated and listed)
- cashier-floor: hidden-legacy-routes, legacy-compatibility-regression, navigation-and-default-route, responsive, responsive-c2, shared-floor-parity
- manager-shell: shell-parity (frontline case)
- supervisor-prompt3: floor, regression, role-boundaries
- supervisor-reservations: fixtures, arriving-actions, attention, create-reservation, history-and-pagination, navigation-and-default-view, privacy-and-boundaries, responsive, seated-and-completion, waiter-visibility
- supervisor-approvals: approvals-fixtures and every spec in the folder, rewritten for the kit screen

Two specs failed at baseline and still fail, untouched: `manager-shell/navigation-and-landing.spec.ts:96`, `:121`.

## Notes for other tracks
- **T3 (order screen):** the table workspaces were not touched. Old specs reach a table through `data-operational-table-id` on the tile wrapper; keep that attribute. The kit `Text` now keeps a money string on one line. The shell root is `isolate` with the bars at `-z-10`, so sheets cover the bars.
- **T3 / cashier:** `lib/cashier/payment-validation.ts:161` still says "backend" on the hidden Queue. The Queue and checkout still use the old components.
- **T4 (tests, demo venue):** e2e/t1 runs against `nimbus_t1_floor`, a fixture with 70 drawn tables (seeded tables set inactive, never deleted) and needs `T1_FLOOR_FIXTURE=1` and `T1_PASSWORD` from the shell. Demo guest names are long digit strings and wrap on a phone; a fictional cast would read better.
- **Everyone:** `scripts/*-assertions.ts` were not run in this track; some pin old shell file names that were deleted (old headers, bottom navs, readiness strip).
