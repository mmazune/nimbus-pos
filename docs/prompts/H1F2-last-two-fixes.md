# H1F2 — The last two fixes from the second review

Model: Sonnet. If you are not Sonnet, say so and stop.
Size: S (30–45 min) · Sat 21 Nov 2026 · Depends on: H1-R2 (commits `09120ec`, `e1fa3bd`, `64e37ff`; verdict pass, 2 should-fix)
Folder: `~/Code/nimbus-pos-event` · This is the only session in this folder.
Branch: `concert/event-till--moses`
Database: a disposable Docker `postgres:16` this session starts and removes: container `nimbus-event-h1f2`, port **55477**, database `nimbus_event_h1f2`. Nothing else.
Ship policy: commit per fix; no push, no merge, no deploy.

First: load `moses-build-standards`, say so, and read §0, §1.3, §6, §7, §8 (type A, product app).

## Why

- The real case: **two beers by Visa at till `DRK-03` with no signal, posted twice when the signal returns.**
- The second review passed the sale engine with two should-fixes, each with a failing probe. One would make two drawers each expect the same 8,000 on event night; the other still lets a full card number be stored. Both are small. After this, the engine is closed and the till and the deployment build on it.

## Read first

1. `docs/reviews/h1-sale-engine.md`, "Round 2": S-1, S-2, the notes, and the 404 finding.
2. `apps/api/test/quick-sale.review.e2e-spec.ts` (the two red probes and the timing probe).
3. `apps/api/src/modules/tills/tills.service.ts` (`openTill`), `apps/api/src/modules/quick-sale/till-code.ts`, the quick-sale DTO.

## Rules that hold all session

- Do not edit the reviewer's assertions, with **one** exception the owner has ruled on (part d).
- Additive; the restaurant flow keeps its behaviour apart from the one stricter check in part a.
- Disposable database only, URL inline; never read or write a `.env*`; no credential literal in a new file.
- Lint per file, never with `--fix`: new files 0 problems, touched files no worse than `reports/proof/H0_api_lint_by_file.txt`. Never `pkill -f`. Check the machine is quiet before a heavy run.

## Parts

**§0 Preconditions.** `64e37ff` is HEAD or an ancestor. The only uncommitted change allowed is this prompt file: commit it first as `docs(event): H1F2 prompt`. Run the review spec once; save the red names to `reports/H1F2_RED_RUN.txt`.

**a. S-1 — one till code, one open till.** `openTill` already refuses a second OPEN session with the same code in a branch. Make that check compare the trimmed, upper-cased forms, so `drk-03` cannot be opened while `DRK-03` is open (same 409 as today). The stored code is not changed. Add the case to `tills.service.spec.ts`. Commit.

**b. S-2 — no card number as a mobile-money reference.**
- `externalTransactionId` (mobile money only): letters, digits, dots and dashes, at most 32 characters. Refuse it (400) when, with dots and dashes removed, it is 13 to 19 digits and passes the Luhn check.
- `payerPhone`: an optional `+` and 9 to 13 digits.
- A refusal writes nothing and does not echo or log the value.

Commit.

**c. The stray 404.** The review traced it: another program on this Mac answered on the same port number as the test's server. Make every quick-sale e2e spec listen once on `127.0.0.1` and send its requests there. Commit.

**d. The timing probe (owner ruling).** The lock-hold probe passed in 4 of 8 runs because it measures wall-clock time on a busy laptop. Keep its deterministic half in the default run: the allocator's real query reads through the index and touches a handful of rows. Move the wall-clock threshold behind an opt-in switch (`EVENT_PERF=1`) so it runs on demand and at Thursday's load test, not in every run. This is the only change you may make to the reviewer's spec; show its diff in the report. Commit.

**e. Record, do not fix.** In `reports/H1_EVIDENCE.md`, under a dated "Accepted risks" heading: an order number longer than 131,072 digits would be refused by the new index; no API path can write one; the owner accepts this.

**f. Proof.** Run the review spec and both quick-sale e2e specs **three times in a row** on a quiet machine. Mark H1F2 in `docs/prompts/README.md`; add dated lines to `ai/AI_STATUS.md` and `PROGRESS.md`. Remove the container. Commit.

## Not in it

Anything the second review did not raise · storing till codes differently · capping order-number digits · event reports, scripts, deployment, web code · new dependencies.

## Done when

1. With `DRK-03` open, opening `drk-03` or `DRK-03 ` in the same branch is a 409; a different code still opens.
2. One 8,000 cash sale is expected in exactly one drawer.
3. A 16-digit Luhn-valid number as `externalTransactionId` is a 400, is not stored and is not echoed; an ordinary mobile-money reference is accepted.
4. The S-1 and S-2 probes pass with their assertions untouched.
5. Three consecutive full runs: every default probe passes, and no response comes from another program.
6. API unit tests are 1,254 plus the new ones, 0 failing; `tsc` and `nest build` clean; the lint rule met; `pnpm check:event` green.

## Report

At most 8 lines, verdict first: commits · S-1 and S-2 · the three runs as passed/total · the spec diff for part d · unit count · `You need to: …`.

Then STOP.
