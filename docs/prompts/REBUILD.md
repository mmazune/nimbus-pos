# Rebuild prompts

The Event Till was cancelled on 25 Nov 2026; its prompts are listed in `README.md` and stay parked. Plan and briefs: `docs/direction/06-roadmap.md`. How to continue: `docs/direction/09-architect-handover.md`.

## Running now: four long tracks (26 Nov 2026)

The owner asked for sessions that work for hours without him. Each track is one cloud session at claude.ai/code on `rebuild/main`, on Opus, started with a `/goal` line. Each owns its own folders and its own branch, pushes only that branch, and follows `LONG-RUN-RULES.md`. The owner merges afterwards, in this order: `u0/foundations` (done), `e1/order-truth` once the review passes, `t2/engines`, `t4/review-and-data`, `t3/order-screen`, `t1/screens`.

| Track | Prompt | Branch | Covers |
|---|---|---|---|
| T1 | `T1-screens-shell-floor-sections.md` | `t1/screens` | U1, and Reservations, Me, Receipts, Till, Approvals on today's API |
| T2 | `T2-engines-menu-tables-tickets.md` | `t2/engines` | E2, E3, E5, and fixes from the E1 review |
| T3 | `T3-order-screen.md` | `t3/order-screen` | U2 and the table actions, void and cash from U3 |
| T4 | `T4-review-tests-demo-venue.md` | `t4/review-and-data` | R-E1, the e2e baseline, the demo venue, people and access |

Launch line, one per session, with the track's file name and branch put in:

`/goal Finish every phase of docs/prompts/<file> under docs/prompts/LONG-RUN-RULES.md: every Done-when line proven, the report written, the branch <branch> pushed. Do not stop and do not ask me anything until then. You have my go-ahead to push <branch>.`

## Single milestones

| ID | Prompt | Status |
|---|---|---|
| U0 | `U0-foundations.md` | built and pushed as `u0/foundations` on 26 Nov 2026; merged into `rebuild/main` by the owner |
| E1 | `E1-order-truth.md` | built and pushed as `e1/order-truth` on 26 Nov 2026; under review in T4 |
| R-E1, U1, E2 | `RE1-review-order-truth.md`, `U1-shell-and-floor.md`, `E2-menu-and-availability.md` | now run inside T4, T1 and T2 |
| E4, E6 … D4 | briefs in `06-roadmap.md` | not written |

## Carried over

- After the tracks: the order screen (T3) switches its menu source to `/api/menu/workspace` (T2), wires sold out, "3 left", hold and fire, allergy, Ready and the table states; the Floor (T1) takes areas, tabs and "New tab" from T2. That joining-up is the next prompt.
- E4 (printing) was skipped on purpose: it needs a decision on printers.
