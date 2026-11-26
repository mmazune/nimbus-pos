# T4 progress (review E1, repair the test run, demo venue, people and access)

Branch `t4/review-and-data`, cut from `origin/e1/order-truth` (`19e1eee`). Push only with
`git push -u origin t4/review-and-data` (the branch tracks `origin/e1/order-truth`; a bare push could hit it).

## Now
- Phase 1 (review E1): review file and probes written; committing and pushing. Next: phase 2.

## Phases
| phase | state | last commit |
|---|---|---|
| 1 Review E1 | review pushed (can be added to) | see `git log` |
| 2 Repair the test run | started: `tools/test-env.sh` written; base and E1 full runs done (92 = 92 by name) | |
| 3 Demo venue | not started | |
| 4 People and access | not started | |

## Decisions taken
- **The five ruling points** come from `origin/rebuild/main`'s `docs/prompts/RE1-review-order-truth.md` (the copy on the E1 branch predates them). Read with `git show`/a scratch worktree; `rebuild/main` is not merged in (that would break T4 Done-when 6).
- **Base for comparison** is `origin/rebuild/main` at `0af95f8`, run from a detached worktree in the session scratchpad (not in the repo), with its own throwaway database migrated and seeded by its own code.
- **`tools/test-env.sh`** takes `--redis` (start Redis on 127.0.0.1 if nothing answers), `--reuse <db>` (rotate the run role's password and print the exports again, so a password never has to be kept in a file between shells) and `--check <url>` (run only the localhost guard). Databases are named `nimbus_event_*` so the existing `assertDisposableEventDb` guard accepts them.
- **Fresh clone per run:** each suite or probe run uses a new `CREATE DATABASE … TEMPLATE` of one migrated and seeded database, so earlier runs' rows (including the probes' deliberately bad rows) never colour a later run.
- **Races are forced, not timed:** probes hold the linked reservation's row lock to park a payment inside the close door.
- **Redis** was started by this session at the start (PID 763, `--save '' --appendonly no`); stop it with `redis-cli -p 6379 shutdown nosave` when done.
- The probe specs log in with the seeded demo passwords as literals, as every existing e2e spec does (rule 15 note; no new credential was created in a file).

## Left out, and why
- A live pre-E1 run producing a duplicate ticket line (B5): emulated by SQL instead; base code read cited.

## Next
1. Phase 2: classify each of the 92 red tests (container or real fault), fix the container kind in `apps/api/test/` helpers/config, write `docs/reviews/e2e-baseline.md`.
