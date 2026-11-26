# T4 — Review E1, repair the test run, build the demo venue, write down people and access

Read `docs/prompts/LONG-RUN-RULES.md` first. It binds you.
Branch: `t4/review-and-data`, cut from `origin/e1/order-truth` (run `git fetch origin && git switch -c t4/review-and-data origin/e1/order-truth`). You review E1; you built none of it.
You own: `docs/reviews/**`, probe tests you add, the existing shared test helpers and e2e configuration under `apps/api/test/`, `tools/**`, `packages/db/demo-venue/**` and its loader script, `docs/direction/10-people-and-access.md`, `docs/direction/rights-matrix.json`, `reports/**`.
You never touch: product code under `apps/api/src/**` (a fault you find is written down for track T2, not fixed), `packages/db/prisma/schema.prisma`, `packages/db/prisma/seed.ts`, migrations, `apps/web/**`.

## Why

- "Building on a structure that is dependable." (Moses, 25 Nov 2026)
- "One can do profiles, users, database… Just get a lot done." (Moses, 26 Nov 2026)
- The E1 builder reported 91 failing e2e tests in 9 suites both before and after its work, compared by count only. On the owner's Mac the same suite was 166 of 166 five days earlier. Nobody knows yet whether that is this container or a real fault.
- The demo menu is a toy: 20 items. No screen can be judged on it.

## Phases

**1. Review E1. Push it within the first hour**, because track T2 reads it. Do `docs/prompts/RE1-review-order-truth.md` in full (its branch line is replaced by this file): the probes, the five points for a ruling, and `docs/reviews/e1-order-truth.md` with the verdict on its first line. Commit and push as soon as the review file exists; add to it later if you find more.

**2. Repair the test run.** Run the full API e2e suite at `origin/rebuild/main` and on this branch. Compare by test name. For every red test say which it is: this container (a service not started, missing test data, clock, order of tests, a port), or a real fault with file and line. Fix the first kind in the helpers and configuration. Write `tools/test-env.sh`: starts the container's Postgres (and Redis if a test needs it), makes an empty throwaway database, refuses any database address that is not `localhost`, prints the two shell exports, and does nothing else. Done when the suite is green, or every remaining red test is a named real fault in `docs/reviews/e2e-baseline.md` with a probe, for T2.

**3. The demo venue.** A whole made-up restaurant for testing and for the owner's demos, as data files in `packages/db/demo-venue/`, loaded by one script into a throwaway database only (same `localhost` guard; if `db:demo:validate` and `db:demo:import` already do this, extend them rather than start again). Name: Tapas Downtown. Contents:
- People: at least two per role (owner, manager, supervisor, cashier, waiter, bartender, chef, store keeper, accountant), from the fictional cast, phones from `+256 700 000 xxx`. PINs are random at load, shown once in the terminal, never written to a file.
- Floor: 64 tables marked Main hall 32, Terrace 16, Bar 10, VIP 6, using whatever marks an area today.
- Menu: at least 220 items in the Food and Drinks tree with groups and sub-groups as a real menu has them; spirits with tot, double and bottle; beers, soft drinks, wine by glass and bottle; at least 30 items with choices (how cooked, extras, leave out); prices in whole UGX that look real; made-up brand-free names.
- Stock: at least 120 stock items with units and at least 40 recipes whose amounts add up to believable costs.
- A service in progress: about 17 open tables across three waiters in every state the Floor draws (not sent, sent, ready, bill asked), 9 bookings for today including one late and one whose table is still in use, a till open with sales, a few paid bills.
A validator checks the files before loading (every reference resolves, no duplicate names, prices and units sane) and its output goes in the report. Never use real people, venues or brands.

**4. People and access, written down.** No code. `docs/direction/10-people-and-access.md`: for each role, how the person is created, how a PIN is issued and reset (by token only), what their profile holds, what starts and ends a shift, and every right they hold today against what `docs/direction/07-scenarios-and-rules.md` and section 11 of `03-stock-stores-availability.md` say they should hold. List each of the 35 permission keys that guards use but the seed never grants, with the endpoints behind it and a ruling: grant to which roles, or remove the endpoint. `docs/direction/rights-matrix.json` holds the same matrix for a later seed. Check R14 line by line and list every breach you find in the seed as it stands.

## Done when

1. `docs/reviews/e1-order-truth.md` is pushed with a verdict, findings with file and line, and a probe for each; the five rulings are answered.
2. `tools/test-env.sh` works from a fresh container and refuses a non-local address (shown).
3. The full e2e suite is green, or `docs/reviews/e2e-baseline.md` names every remaining red test with its cause and a probe.
4. The demo venue loads into an empty throwaway database in one command, the validator is green, and the counts in phase 3 are met (shown by queries in the report). No credential is in any file.
5. `10-people-and-access.md` and `rights-matrix.json` exist; all 35 keys have a ruling; R14 breaches are listed or stated as none.
6. `git diff --stat origin/e1/order-truth...HEAD` stays inside what you own; no product code changed.
