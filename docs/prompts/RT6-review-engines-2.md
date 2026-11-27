# RT6 — Independent review of T6 (and the engines T2 built), by someone who built none of it

Read `docs/prompts/LONG-RUN-RULES.md` first. It binds you, except that you write no product code.
Branch: `rt6/review`, cut from `origin/t6/engines-2` (`git fetch origin && git switch -c rt6/review origin/t6/engines-2`).
You own: `docs/reviews/t6-engines-2.md`, new probe test files under `apps/api/test/` named `rt6-*.e2e-spec.ts`, `reports/**`.
You never touch: anything else. A fault you find is written down for track T9, which reads your file before each of its phases.

## Why

"Building on a structure that is dependable." (Moses, 25 Nov 2026). T6 changed who may do what, how PINs are issued, how money is refunded and how stock moves. Its own report asks for this review before anything is merged. T2's menu, tables and tickets engines were never reviewed by anyone else either.

## Do this, in order, and push after each step

1. **Within 90 minutes, push a first version** of `docs/reviews/t6-engines-2.md` with the verdict so far and the findings so far. T9 is waiting on it. Update it as you go.
2. Read `docs/prompts/T6-rights-tests-stock.md`, `reports/T6_REPORT.md` and the full diff `git diff origin/t4/review-and-data...origin/t6/engines-2` (that is T6 alone). Judge the diff, not the report. Re-run every gate it claims.
3. **Privacy and credentials:** try to read a payslip, a PIN, a PIN hash, a password hash, a setup token or a reset token as every role through every HR, auth, invitation, attendance, leave and swap endpoint; try a setup token twice, after 15 minutes, from another organisation, and after a reset; check logs and audit rows; check the forgot-password path on a non-production server.
4. **Rights:** run T6's walk test yourself; then probe by hand what a walk test misses: an endpoint that takes a branch or organisation id in the body or the path, a supervisor of branch A acting in branch B, a manager trying `pos:hr:compensation:read` by any route, decisions D8 (no billing or franchise grants) and D9 (operator portal closed).
5. **Approvals, refunds, till sign-off:** answer one approval twice at the same instant; answer by PIN from a different device; let it climb and answer at both levels; refund on the day and the next day around midnight and the business-day hour; a till difference exactly at the limit and one shilling above.
6. **Stock and stores:** two sends of the same order at once and the ledger rows; a void "not made" after a remake; take-out above the limit without and with a PIN; a request received twice; a count saved while sales continue; a delivery at a new price and the average cost to the shilling; negative stock; whether anything can delete or edit a ledger row.
7. **T2's engines:** the last serving raced by five sends; bulk add of tables racing with a put-away; two hand-overs of the same table; hold, fire and undo racing with a send; the order-number defect T5 found (write the probe even though T9 is fixing it).
8. For every finding: file and line, a probe test that fails while the fault is there (kept whether it passes or fails), and the smallest fix.

## Write

`docs/reviews/t6-engines-2.md`: the verdict on the first line, one of **pass**, **pass with should-fix**, **blockers**; findings most serious first, each marked blocker, should-fix or note, with file, line, probe and fix; what you could not test. Grade every claim [live], [emulation], [code] or [asserted].

## Done when

1. The review file is pushed with a verdict, and its first version was pushed within the first 90 minutes.
2. Steps 3 to 7 each have probes, listed in the review with their result.
3. No product file changed (`git diff --stat origin/t6/engines-2...HEAD` shows only your files).
