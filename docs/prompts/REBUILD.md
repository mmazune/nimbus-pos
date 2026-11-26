# Rebuild prompts

The Event Till was cancelled on 25 Nov 2026; its prompts are listed in `README.md` and stay parked. These are the prompts for the rebuild. Plan and briefs for the unwritten ones: `docs/direction/06-roadmap.md`. How to continue: `docs/direction/09-architect-handover.md`. One prompt is one milestone is one session, run by path at claude.ai/code on `rebuild/main`. One screens session and one engine session at a time.

Every session works on its own branch, named in its prompt, and pushes only that branch. The owner merges into `rebuild/main`. Start a session with the full line in the last column: it carries the owner's go-ahead to push.

| ID | Prompt | Model | Branch | Start when | Status | Paste this |
|---|---|---|---|---|---|---|
| U0 | `U0-foundations.md` | Opus | `u0/foundations` | — | built 26 Nov 2026; waiting to be pushed, then merged | — |
| E1 | `E1-order-truth.md` | Sonnet | `e1/order-truth` | — | built 26 Nov 2026; waiting to be pushed, then reviewed | — |
| R-E1 | `RE1-review-order-truth.md` | Opus | `re1/review` | `e1/order-truth` is on GitHub | ready | `Implement docs/prompts/RE1-review-order-truth.md. You have my go-ahead to push the branch re1/review.` |
| U1 | `U1-shell-and-floor.md` | Opus | `u1/shell-and-floor` | U0 is merged into `rebuild/main` | ready | `Implement docs/prompts/U1-shell-and-floor.md. You have my go-ahead to push the branch u1/shell-and-floor.` |
| E2 | `E2-menu-and-availability.md` | Sonnet | `e2/menu-and-availability` | E1 passed R-E1 and is merged | ready | `Implement docs/prompts/E2-menu-and-availability.md. You have my go-ahead to push the branch e2/menu-and-availability.` |
| U2, E3 … D4 | briefs in `06-roadmap.md` | — | `<id>/<slug>` | — | not written | — |

## Carried over

- From U0 into U1: the "Tab 3" compact tile on a phone; `check:ui` in a `verify:web` script. Both are in the U1 prompt.
- From E1: the five points for the reviewer are in the R-E1 prompt. The three order events may be missing; if so E1F adds them before E6 needs them.
- Both first sessions committed on `rebuild/main` in their own containers and were refused the push. Later prompts name a branch and an exact push command so this cannot repeat.
