# Rebuild prompts

The Event Till was cancelled on 25 Nov 2026; its prompts are listed in `README.md` and stay parked. Plan and briefs: `docs/direction/06-roadmap.md`. How to continue: `docs/direction/09-architect-handover.md`. Long runs follow `LONG-RUN-RULES.md`: one cloud session at claude.ai/code per track, on Opus, on `rebuild/main`, each on its own branch.

## Second run: three tracks (written after the first run finished)

| Track | Prompt | Branch | Covers |
|---|---|---|---|
| T5 | `T5-join-up.md` | `t5/join-up` | Merges T2, T4, T3, T1 into one branch; wires the order screen and Floor to the new engines; Ready; the kitchen and bar screens (U5) |
| T6 | `T6-rights-tests-stock.md` | `t6/engines-2` | Payslip and PIN leaks, E1's migration, the rights matrix (E9), a green e2e run, stock (E6), stores (E7) |
| T7 | `T7-drawings.md` | `t7/drawings` | The owed drawings, about 100 boards, for the owner to approve |

Launch line, one per session:

`/goal Finish every phase of docs/prompts/<file> under docs/prompts/LONG-RUN-RULES.md: every Done-when line proven or settled by a numbered decision, the report written, the branch <branch> pushed. Do not stop and do not ask me anything until then. You have my go-ahead to push <branch>.`

Merge order when they finish: `t5/join-up` first (it already holds T1 to T4), then `t6/engines-2` after its review, then `t7/drawings` once the owner has approved the drawings. Nothing from the first run is merged on its own.

## First run: done 26 Nov 2026

| Track | Branch | Head | Result |
|---|---|---|---|
| T1 screens | `t1/screens` | `76322c8` | Done. Decisions 36 and 37 stand: two drawn sentences left out because the engine did not do them yet (T6 phase 2 builds both); old tests for replaced screens updated. |
| T2 engines | `t2/engines` | `e00f90e` | Done: E2, E3, E5, and the E1 review blockers B1 to B4 fixed. B5 and S1 (E1's migration) and the payslip leak pass to T6. The whole-suite e2e line could not be met; T6 owns the old specs now. |
| T3 order screen | `t3/order-screen` | `c68d70d` | Done, all eleven lines. |
| T4 review and data | `t4/review-and-data` | `e26bb73` | Done. E1 review: five blockers. e2e baseline: 72 old real faults named. Demo venue. People and access with 36 keys ruled on. |

Rulings by the architect after the first run: (1) T1's decisions 36 and 37 stand. (2) Specs for endpoints the product's own rules let no role reach are quarantined, not deleted and not unlocked by seeding. (3) E1's migration may be corrected in place, because it has only run on throwaway databases. (4) The manager gets his 15 missing rights; `pos:hr:compensation:read` stays revoked. (5) Nobody is ever shown another person's PIN.

## Single milestones

| ID | Prompt | Status |
|---|---|---|
| U0 | `U0-foundations.md` | merged into `rebuild/main` |
| E1 | `E1-order-truth.md` | on `e1/order-truth`; reviewed; fixes on `t2/engines` and in T6 |
| R-E1, U1, E2 | run inside T4, T1, T2 | done |
| Reviews of T2 and T6, E10, E8, E11, E13, U6, U7, U9, E12, C1, D1 to D4 | briefs in `06-roadmap.md` | not written |
