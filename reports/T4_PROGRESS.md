# T4 progress (review E1, repair the test run, demo venue, people and access)

Branch `t4/review-and-data`, cut from `origin/e1/order-truth` (`19e1eee`). Push only with
`git push -u origin t4/review-and-data` (the branch tracks `origin/e1/order-truth`; a bare push could hit it).

## Now
- All four phases done; report `reports/T4_REPORT.md`; final gates `reports/proof/T4/final_gates.txt`. Next: nothing (stop Redis and Postgres started by this session).

## Phases
| phase | state | last commit |
|---|---|---|
| 1 Review E1 | done, pushed (`964500b`, B5 live proof after) | |
| 2 Repair the test run | done: 92 → 72 pre-existing red + 11 probes; all named | see `git log` |
| 3 Demo venue | done | see `git log` |
| 4 People and access | done | see `git log` |

## Decisions taken
- **The five ruling points** come from `origin/rebuild/main`'s `docs/prompts/RE1-review-order-truth.md` (the copy on the E1 branch predates them). Read with `git show`/a scratch worktree; `rebuild/main` is not merged in (that would break T4 Done-when 6).
- **Base for comparison** is `origin/rebuild/main` at `0af95f8`, run from a detached worktree in the session scratchpad (not in the repo), with its own throwaway database migrated and seeded by its own code.
- **`tools/test-env.sh`** takes `--redis` (start Redis on 127.0.0.1 if nothing answers), `--reuse <db>` (rotate the run role's password and print the exports again, so a password never has to be kept in a file between shells) and `--check <url>` (run only the localhost guard). Databases are named `nimbus_event_*` so the existing `assertDisposableEventDb` guard accepts them.
- **Fresh clone per run:** each suite or probe run uses a new `CREATE DATABASE … TEMPLATE` of one migrated and seeded database, so earlier runs' rows (including the probes' deliberately bad rows) never colour a later run.
- **Races are forced, not timed:** probes hold the linked reservation's row lock to park a payment inside the close door.
- **Redis** was started by this session at the start (PID 763, `--save '' --appendonly no`); stop it with `redis-cli -p 6379 shutdown nosave` when done.
- The probe specs log in with the seeded demo passwords as literals, as every existing e2e spec does (rule 15 note; no new credential was created in a file).

- **Phase 2 fix lives in config, not in other people's specs:** `test/support/e2e-sequencer.js` (no new dependency: a standalone class, since `@jest/test-sequencer` is not resolvable from `apps/api` under pnpm). The lasting fixes for `bg1-onboarding` (restore the user it changes) and the stale specs F2/F4 are for their owners.

- **Demo venue built fresh in `packages/db/demo-venue/`**, not by extending `db:demo:import`: that importer and its CSVs live outside T4's folders, hold 99 items and 68 tables over four branches, use phones outside the fictional block, have no localhost guard, and keep fixed passwords in a committed credentials file.
- **No cast existed in the repo**: the venue's 21 people are a new made-up cast in `data/people.json` (chef2 renamed from the owner's own first name).
- **Store keeper = the seeded role "Stock Manager"** (`JobRole.STOCK_MANAGER`); there is no other store-keeper role.
- **Areas = floor plans**: the Floor groups tables by `floorPlan.name`; the table's `metadata.area` repeats it.
- **`db:seed` runs first** inside `run.sh` (roles and permissions are global and only the seed makes them); its own demo org comes along.
- **No ESLint config covers `packages/db`**; the venue files pass a strict `tsc` and `prettier --check` instead.

- **Phase 4 rulings take R14 literally** (every key to Manager except `pos:hr:compensation:read`), flag `pos:hr:compensation:create` for the owner, keep `ops:*` off every venue role (platform operators only), and treat `hms:read:*` and `pos:feedback:public:token:read` as non-role keys.

## Left out, and why
- "Bill asked" is only an `ORDER_BILL_REQUESTED` audit row; no API reads it back (venue README).
- No stock on hand in the venue (E6).

## Next
1. Phase 4: `docs/direction/10-people-and-access.md`, `rights-matrix.json`, the 35 ungranted keys, R14 check.
