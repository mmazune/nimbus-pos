# Rebuild prompts

The Event Till was cancelled on 25 Nov 2026; its prompts are listed in `README.md` and stay parked. Plan and briefs: `docs/direction/06-roadmap.md`. How to continue: `docs/direction/09-architect-handover.md`. Long runs follow `LONG-RUN-RULES.md`: one cloud session at claude.ai/code per track, on Opus, on `rebuild/main`, each on its own branch.

## Third run: four tracks (written 27 Nov 2026)

| Track | Prompt | Branch | Starts from | Covers |
|---|---|---|---|---|
| T8 | `T8-touch-screens.md` | `t8/touch-screens` | rebuild/main + t5 + t6 + t7 | Touch screens follow T6's rights; shifts and own PIN; paying; kitchen and bar; stock and stores on screen (U6); supervisor Team |
| T9 | `T9-engines-3.md` | `t9/engines-3` | t6/engines-2 | Review fixes; order numbers and split; sold out from stock and the alert engine (E10); cost (E8); reports and day close (E11); money exceptions (E13) |
| T10 | `T10-back-office.md` | `t10/back-office` | rebuild/main + t5 + t6 + t7 | Manager, owner and accountant on laptop and phone (U7): Today, approvals, menu and recipes, floor and stores set-up, staff with setup tokens, stock, purchases, costs |
| RT6 | `RT6-review-engines-2.md` | `rt6/review` | t6/engines-2 | Independent review of T6 and of T2's engines; findings go to T9 |

Launch line, one per session:

`/goal Finish every phase of docs/prompts/<file> under docs/prompts/LONG-RUN-RULES.md: every Done-when line proven or settled by a numbered decision, the report written, the branch <branch> pushed. Do not stop and do not ask me anything until then. You have my go-ahead to push <branch>.`

Launching T8 and T10 is the owner's approval of the T7 drawings they build from.

Merge plan when they finish: an integration track merges `t8/touch-screens`, `t10/back-office` and `t9/engines-3` (after RT6's findings are fixed and a review of T9's money, rights and stock phases), wires the screens to T9's alerts, reports and day close (U9), and runs every browser chain; then that one branch goes into `rebuild/main`. Nothing from the first three runs is merged on its own.

## Done so far

| Run | Track | Branch | Head | Result |
|---|---|---|---|---|
| 1 | T1 screens | `t1/screens` | `76322c8` | Shell, Floor, Reservations, Me, Receipts, Till, Approvals |
| 1 | T2 engines | `t2/engines` | `e00f90e` | Menu in one call, sold out, areas, tabs, move, join, split, hand over, tickets; E1 blockers B1 to B4 |
| 1 | T3 order screen | `t3/order-screen` | `c68d70d` | One order screen for all roles |
| 1 | T4 review and data | `t4/review-and-data` | `e26bb73` | E1 review, e2e baseline, demo venue, people and access |
| 2 | T5 join-up | `t5/join-up` | `513f4f3` | T1 to T4 merged; screens wired to T2; Ready; kitchen and bar screens |
| 2 | T6 engines 2 | `t6/engines-2` | `92dc83a` | Payslip and PIN leaks closed, setup tokens, rights matrix, approvals by PIN, refund and till sign-off, e2e 0 failed of 1,293, stock ledger, stores; needs review |
| 2 | T7 drawings | `t7/drawings` | `c5cf6e0` | 184 more drawings, `OVERVIEW.md` |

## Single milestones

| ID | Status |
|---|---|
| U0 | merged into `rebuild/main` |
| E1 | on `e1/order-truth`; reviewed; fixed in T2 and T6 |
| E12, C1, D1 to D4 | briefs in `06-roadmap.md`; not written |
