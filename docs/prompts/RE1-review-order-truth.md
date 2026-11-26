# R-E1 — Review of E1 (order truth) by someone who built none of it

Model: Opus. If you are not Opus, say so and stop.
Size: one session. You change no product code.
Base: the branch `e1/order-truth` (start this session on it, or run `git fetch origin && git switch e1/order-truth`). If `reports/E1_REPORT.md` is missing, you are on the wrong branch: say so and stop.
You may add: test files that prove a fault ("probes") under `apps/api/test/` or beside the unit specs, `docs/reviews/e1-order-truth.md`, `reports/**`. Nothing else.
Database: a throwaway one inside this container only, on `localhost`, set in the shell. Never Neon. Never read, print or write `.env*`. Never a lint script with `--fix`.
Branch: before your first commit run `git switch -c re1/review`.
Ship policy: commit your probes and the review on that branch and push it with exactly `git push -u origin re1/review`. The owner's go-ahead for that push is this line and the message that started you. Never push `rebuild/main` or `e1/order-truth`, never force-push, merge nothing.

First: load `moses-build-standards`, say so, and read §0 and the review rules in §1.3.

## Why

"Building on a structure that is dependable." (Moses, 25 Nov 2026). E1 changed how an order is sent, voided, paid and closed. It touches money and rights, so it is not accepted on its builder's word.

## Do this

1. Read `docs/prompts/E1-order-truth.md`, `reports/E1_READ_BACK.md`, `reports/E1_REPORT.md`, then the whole of `git diff rebuild/main...HEAD`. Judge the diff, not the report.
2. Re-run every gate the report claims. A claim you cannot reproduce is a finding.
3. Try to break it. For each of these, write a probe test that fails if the fault is there, and keep it whether it passes or fails:
   - Two payments for the same order in the same instant; a payment and a void in the same instant; two voids of the same line; a send during a payment.
   - Any writer of `CLOSED` or of `Table.status` outside the one close function (search the whole API).
   - A table with two open orders; an order with no table; a reservation linked to a different order.
   - Cash below the bill; cash far above it; a non-cash method above the bill; amounts with more than two decimals; any float in the money path.
   - Void: by a waiter, a cashier, a supervisor from another branch, on another waiter's order, on an unsent line, on a paid order, a quantity of zero or above the line's, the last line of an order.
   - A second send that includes a line voided before sending; a send with every line voided.
   - The migration on a database that already holds sent and unsent orders: is the backfill right, and does it only add?
   - The quick-sale engine and its tests: untouched and green.
4. Check each "Done when" line of the prompt against proof you produced yourself.
5. Five things the builder's own report raises, each needing your ruling:
   - The full e2e suite shows 9 red suites and 91 failed tests both before and after E1, and the builder compared counts, not names. Run it at `rebuild/main` and on this branch, compare **by test name**, and say for each red suite whether it is this environment (missing seed, service not started, clock, order of tests) or a real fault. The older baseline on the owner's machine was 166 of 166.
   - The read-back was written after the build. Say what, if anything, a read-back first would have caught.
   - Two lines changed in `pos-handoff`: are they right, and do they change behaviour for the quick-sale engine?
   - The void route sits at `/api/orders/…` while the existing order routes sit under another prefix. Which is right for this codebase? One prefix only.
   - Does the code emit `order.lines.sent`, `order.line.voided` and `order.closed` after commit? (They were added to the prompt after this session may have started. If they are missing, list it as a should-fix, not a blocker.)

## Write

`docs/reviews/e1-order-truth.md`: a verdict on the first line, one of **pass**, **pass with should-fix**, **blockers**. Then findings, most serious first, each with file and line, the probe that shows it, and the smallest fix. Then what you could not test. Grade every claim [live], [emulation], [code] or [asserted]. Do not fix anything: a finding becomes prompt E1F, written by the architect.

Finish in chat with 8 lines at most, opening with the verdict and ending `You need to: …`.

Then STOP.
