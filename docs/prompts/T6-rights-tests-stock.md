# T6 — Engines 2: private things stay private, the rights matrix, a green test run, then stock and stores

Read `docs/prompts/LONG-RUN-RULES.md` first, including its last section. It binds you.
Branch: `t6/engines-2`, cut from `rebuild/main`. Then `git merge --no-edit origin/t2/engines` and `git merge --no-edit origin/t4/review-and-data` (a trial showed both merge clean; if a conflict appears, in `apps/api/test` helpers and configuration take T4's side, elsewhere take T2's, and write it down).
You own: `apps/api/**` including **every existing test file**, `packages/db/prisma/**`, `tools/**`, `docs/reviews/e2e-quarantine.md`, `reports/**`.
You never touch: `apps/web/**` (track T5), `design/screens/**` (track T7), `packages/db/demo-venue/**` except to keep its loader working with your schema changes.

## Why

- "Building on a structure that is dependable." (Moses, 25 Nov 2026)
- Standing rules of this product: the manager has every right except compensation; waiter, cashier and supervisor never get accounting or procurement rights; nobody sets or sees another person's PIN.
- "When I place an order, it deducts even items from the inventory… main and secondary store… a chef can mark something as wastage that went bad, or missing." (Moses, 25 and 26 Nov 2026)

The real case, all found live by the review track on 26 Nov (`docs/direction/10-people-and-access.md`, `docs/reviews/e1-order-truth.md`, `docs/reviews/e2e-baseline.md`): a waiter and a cashier can list every payslip in the branch; a manager is shown a new staff member's PIN at onboarding and at reset; the manager lacks 15 rights he should hold; 36 permission keys are held by no role, so their endpoints refuse everyone; 72 end-to-end tests have been red since before the rebuild and no track owned them; E1's migration breaks on a database where one order line sits on two kitchen tickets, and stamps the wrong "sent" time on old lines.

## Phases

**1. Private things stay private.** (a) Payslips: a person sees their own; a branch-wide list needs the payroll right, which waiter, cashier and supervisor do not hold. Check every other HR endpoint the same way against R14 and fix each breach `10-people-and-access.md` lists. (b) PINs: no response, screen payload, log or audit row ever carries a PIN or a reusable secret for someone else to read. Read the product's own rule on credential reset first (`CLAUDE.md`, `docs/DECISIONS.md`: token only) and make onboarding and reset obey it; where a PIN is issued in person, the person types their own PIN on the device and nobody else is shown anything. (c) E1's migration: it has only ever been applied to throwaway databases, so correct it in place in one commit: remove duplicate ticket rows before the unique index, and backfill `sent_at` from the ticket item's time as T2's report sets out. Prove it on a database built from the old code with doubled tickets. Real cases as e2e tests: **"The payslip stays private"** and **"A new waiter sets her own PIN"**.

**2. The rights matrix.** Apply `docs/direction/rights-matrix.json` to the seed: the manager's 15 missing rights (never `pos:hr:compensation:read`); each of the 36 unheld keys by its ruling. Where the product's rules forbid granting a key (billing, franchise, HMS), grant nothing. Then: a request for approval can be answered by a supervisor's PIN on the same device, or from Approvals, and climbs to managers after the wait in settings (3 minutes); an order's payload says what this person may do to it (`allowedActions`), so screens stop guessing; a refund needs a supervisor on the same day and a manager after; a till closed over or short above the venue's limit needs a supervisor's sign-off (both were drawn and left out by track T1 because the engine did not do them). One test walks every endpoint a screen calls, as every role, against the matrix.

**3. A test run that means something.** Using `docs/reviews/e2e-baseline.md`: fix the real faults in your folders; update the specs that test replaced behaviour; give `bg1-onboarding` its own user so it stops changing the shared cashier. Specs whose endpoints no role may reach by the product's own rules move to a named quarantine group that the default run skips and a second command runs, each listed in `docs/reviews/e2e-quarantine.md` with the reason and what would bring it back. Done when the default run is 0 failed in Jest's own order and in T4's fixed order.

**4. Stock that moves.** `docs/direction/03-stock-stores-availability.md` sections 3, 4, 5 and 7, with one store per branch for now: units by kind with whole-number amounts; "how is it sold" on a menu item; the append-only movement ledger; stock leaves on send (listen to the order events; one row per ingredient, in the send's own transaction or made safe against a double send); a void marked "not made" puts it back; take out of stock with the fixed reasons, the value limit and the supervisor PIN above it; remake; we found more. A sale is never refused for lack of stock (R18). The servings-per-recipe fault the code audit found (a double costs the same as a single) is fixed here. Real case, **"A burger takes 150 g of mince"**: the recipe from `Manager-Item`, one burger sent, one voided as not made, one remade, 1.5 kg taken out as spoiled, each with its ledger row and cost.

**5. Stores.** `03` sections 2, 7, 8, 9 and 10: the chain of stores and which station takes from which; minimum and fill-to; the suggested request; ask, issue, receive with the receiver's PIN, received short as a loss on that trip; deliveries with and without an order, average cost; To buy; blind counts that never stop selling, with the limit and the manager's note. Rights by `03` section 11. Real case, **"Twelve buns short"**: the kitchen falls below minimum, the request is suggested and sent, 36 issued, 24 received, the gap is on the trip, the store keeper and manager can see it, a count closes it.

If time remains after phase 5, start `03` section 6 item 3 (servings left from stock, with the three modes); record how far you got.

## Not in it

No web change. No alerts table yet (E10). No reports (E11). No printing. No messages to phones.

## Done when

1. A waiter and a cashier get 403 on the branch payslip list and 200 on their own; no HR breach from `10-people-and-access.md` remains, each shown by a test.
2. No API answer, log line or audit row contains a PIN or a reusable secret; shown by a test that searches every response in the onboarding and reset flows.
3. E1's migration applies to a database with doubled tickets and stamps the right sent times; shown.
4. The seed matches `rights-matrix.json`; the manager holds everything but compensation; waiter, cashier and supervisor hold no accounting or procurement right; the matrix test passes.
5. PIN-on-the-spot approval, the climb, `allowedActions`, refund approval and till sign-off each have a passing e2e test.
6. The default e2e run is 0 failed, twice, in both orders; the quarantine list is written.
7. "A burger takes 150 g of mince" and "Twelve buns short" pass three runs in a row; the four earlier real cases still pass.
8. Each phase that changes the schema has one additive migration (the E1 correction is the one exception); money and amounts are exact.
9. API typecheck 0, build 0, unit tests 0 failed, `eslint` clean on changed files, `pnpm check:event` green.
10. The report lists every new endpoint with path, body and answer, and says plainly that phases 1, 2, 4 and 5 need an independent review before they are merged.
