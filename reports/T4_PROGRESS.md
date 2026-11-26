# T4 progress (review E1, repair the test run, demo venue, people and access)

Branch `t4/review-and-data`, cut from `origin/e1/order-truth` (`19e1eee`). Push only with
`git push -u origin t4/review-and-data` (the branch tracks `origin/e1/order-truth`; a bare push could hit it).

## Now
- Phase 2 done: sequencer fixes C1 (test order) and C2 (shared cashier password); 83 red named in `docs/reviews/e2e-baseline.md`; `tools/test-env.sh` proven from a stopped Postgres. Next: phase 3 (demo venue).

## Phases
| phase | state | last commit |
|---|---|---|
| 1 Review E1 | done, pushed (`964500b`, B5 live proof after) | |
| 2 Repair the test run | done: 92 → 72 pre-existing red + 11 probes; all named | see `git log` |
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

- **Phase 2 fix lives in config, not in other people's specs:** `test/support/e2e-sequencer.js` (no new dependency: a standalone class, since `@jest/test-sequencer` is not resolvable from `apps/api` under pnpm). The lasting fixes for `bg1-onboarding` (restore the user it changes) and the stale specs F2/F4 are for their owners.

## Left out, and why
- (none yet)

## Next
1. Phase 3: Tapas Downtown venue under `packages/db/demo-venue/` (new; the existing `demo-data` importer is outside T4's folders, has 99 items and 68 tables over 4 branches, phones outside the fictional block, no localhost guard, and a committed credentials file).
