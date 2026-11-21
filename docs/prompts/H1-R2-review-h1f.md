# H1-R2 — Second look: the H1F fixes and two probes

Model: Opus. If you are not Opus, say so and stop.
Size: S (30–45 min) · Sat 21 Nov 2026 · Depends on: H1F (commits `7b35577..a1a4f1d`)
Folder: `~/Code/nimbus-pos-event` · This is the only session in this folder.
Branch: `concert/event-till--moses`
Database: disposable Docker `postgres:16` containers this session starts and removes: `nimbus-event-h1r2` on port **55474** (database `nimbus_event_h1r2`) and, for the baseline check only, `nimbus-event-h1r2-base` on port **55475** (database `nimbus_event_h1r2_base`).
Ship policy: commit the review and probe changes; no push, no merge, no deploy.
You built none of H1 or H1F. **You do not change product code.** You may change only `apps/api/test/quick-sale.review.e2e-spec.ts` and `docs/reviews/h1-sale-engine.md`.

First: load `moses-build-standards`, say so, and read §0, §1.3 (risky engines), §6, §8 (code review format).

## Why

- The real case: **two beers by Visa at till `DRK-03` with no signal, posted twice when the signal returns.**
- The first review found two blockers and four should-fixes in the sale engine. H1F reports all six fixed and 12 of 13 probes green, and says two probes cannot pass as written. The fixes touched the replay path, the order-number allocator and a new index on the `orders` table, which the restaurant flow also writes to. Code changed after a review has not been reviewed. This is that review, and it settles the two probes.

## Read first

1. `docs/reviews/h1-sale-engine.md` (round 1) and the "H1F" section of `reports/H1_EVIDENCE.md`; `reports/proof/H1F_allocator.txt`.
2. The full fix diff: `git diff ede9ea7..a1a4f1d -- apps packages tools`. Every changed line, and the new migration.
3. `apps/api/src/modules/orders/order-number.ts`, `apps/api/src/modules/quick-sale/till-code.ts`, the quick-sale service and DTO, `apps/api/test/quick-sale.h1f.e2e-spec.ts`.
4. `docs/prompts/H1F-review-fixes.md` (what the builder was asked for).

## Rules that hold all session

- Disposable databases only, URL inline; never read or write a `.env*`; `db:seed` on the disposable databases only; no credential literal in a new file.
- Never `pkill -f`; never the API's `lint` script or a formatter. Check the machine is quiet before a heavy run (`uptime`).
- Every finding needs a probe whose output shows the failure. Judge the diff, not the builder's report.

## Rulings already made by the owner

| # | Point | Ruling |
|---|---|---|
| P1 | Probe A3 sends an 11-character `authCode`; H1F caps it at 8 | **The cap stays at 8.** An approval code on a slip is normally six characters, and a short cap is what keeps a card number out of the field. Change the probe's test value to fit; keep the property it tests |
| P2 | The R2 probe EXPLAINs a hard-coded copy of the old `CAST … AS INTEGER` query | The probe must examine **the query the allocator really runs** (take it from `order-number.ts`), and assert it reads a handful of rows. A copy of old SQL proves nothing about the code |
| P3 | `tools/check-event.allow.json` gained one entry for the review spec's `pan` test variable | Approved **if** the entry names that one file and one pattern only, and the number in the spec is a published test number, not a real card. Confirm both |
| P4 | The builder indexed the number as `NUMERIC`, not the review's `BIGINT` | Accepted in principle: an index expression that can overflow would fail inserts for the whole table. **Prove** it cannot (probe 3 below) |

## Parts

**§0 Preconditions.** `a1a4f1d` is HEAD or an ancestor. The only uncommitted change allowed is this prompt file: commit it first as `docs(event): H1-R2 prompt`.

**a. Settle the two probes (P1, P2).** Make the two changes, show the diff of the spec in the review, and say in one line each why the property tested is unchanged or stronger. Then the review spec runs 13 of 13.

**b. Review the fix diff. Probe at least:**

1. **Replay fingerprint.** Two different sales under one `clientSaleId` sent at the same moment: exactly one is written and the other gets 409, never `replayed: true`. An identical retry still replays. A stored sale with **no** fingerprint (written by H1 before this fix) is handled without a server error; say what it does. The fingerprint holds no card data.
2. **The real case** still passes end to end.
3. **The new index can never fail an insert.** Through Prisma, insert orders numbered `ORD-`, `ORD-abc`, `ORD-1e5`, `ORD-12 34`, an empty-suffix value, a 40-digit number and a 400-digit number. None may fail because of the index, and the allocator ignores those that do not match. Create an order through the **restaurant** flow with the index present.
4. **Allocator.** Re-measure once yourself (10,000 orders, 20 concurrent sales): index used, lock held under 20 ms at p95. `ORD-999999` is followed by `ORD-1000000`; a branch above 2³¹ allocates. With the lock disabled in a scratch copy, the 20-concurrent test still goes red.
5. **Migration.** Additive; applies on an empty database and on one that already has H1's migration; `prisma migrate diff` does not propose dropping the index. State what it shows.
6. **Till codes.** `drk-03` and `DRK-03 ` reach the till opened as `DRK-03`. What happens if `DRK-03` and `drk-03` are both open in one branch: note it with a recommendation, since the till-open path was not to be changed.
7. **Card number in a text field.** A 16-digit number in `authCode` or `terminalId` is a 400, is not stored, and does **not** appear in the response body or the API log. `externalTransactionId` and `payerPhone` on a card or cash sale are a 400.
8. **Audit failure log.** The line carries order id, `clientSaleId`, `branchId` and `tillCode`, and no card data.

**c. Two open questions from H1F.**

9. **Regression or not.** H1F saw `orders.e2e` "close SERVED→CLOSED" fail and did not run it at the baseline. Run that spec at `23c7a2c` (a temporary worktree at `~/Code/nimbus-pos-event-baseline`, its own database on 55475) and at HEAD, both on a fresh migrate-plus-seed database. Say plainly: fails at both (pre-existing: add it to `docs/PRE_EXISTING_ISSUES.md`) or only at HEAD (a regression: blocker). Remove the worktree after.
10. **Flake.** On a quiet machine run the quick-sale e2e three times. Count any response that is neither expected nor explained. H1F saw one 404 with an empty body and could not reproduce it; if you see it, capture which process answered. If you do not, leave it under "Unverified" for Thursday's load test.

## Deliverables

1. `docs/reviews/h1-sale-engine.md` gains "Round 2": `reviewer_model`, `built_by_reviewer: no`, `reviewed_sha`, `verdict: pass | blockers`; the findings table (id · severity · file:line · what is wrong · failure scenario on event night · fix · probe); "checked and found sound"; "not checked".
2. The amended probe spec, committed.
3. Containers and the temporary worktree removed; `git status` clean.

## Not in it

Fixing product code · anything outside the H1F diff, except question 9 · event reports, scripts, deployment, web code.

## Done when

1. The review spec is 13 of 13 with P1 and P2 applied, and the review shows the spec diff.
2. Probes 1–8 were each run, with results in the review.
3. Question 9 has a plain answer backed by both runs.
4. P3 is confirmed or refused with the reason.
5. The verdict is stated. If "blockers", each has file:line, an event-night scenario, a named fix and a failing probe.
6. No product code changed.

## Report

At most 8 lines, verdict first: blockers and should-fix counts · the two probes · the index insert-safety result · your allocator figure · question 9 answer · flake result · `You need to: …`.

Then STOP.
