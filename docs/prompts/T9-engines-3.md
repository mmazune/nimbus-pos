# T9 — Engines 3: review fixes, order numbers, sold out from stock, alerts, cost, reports, day close, money exceptions

Read `docs/prompts/LONG-RUN-RULES.md` first. It binds you.
Branch: `t9/engines-3`, cut from `origin/t6/engines-2` (`git fetch origin && git switch -c t9/engines-3 origin/t6/engines-2`). It already holds T2 and T4.
You own: `apps/api/**` including every test file, `packages/db/prisma/**`, `packages/db/demo-venue/**` (keep its loader working), `tools/**`, `docs/reviews/e2e-quarantine.md`, `reports/**`.
You never touch: `apps/web/**` (tracks T8 and T10), `design/**`, `docs/reviews/` files other than the quarantine list (track RT6 writes the review). Every change to an existing endpoint is additive: tracks T8 and T10 are building screens against T2's and T6's answers right now.

## Why

- "If lamb chops are done, they'll disappear from the menu, or they'll be grayed out… because the ingredients are not there." (Moses, 26 Nov 2026)
- "Alert the chef… kitchen store… items from the kitchen store are done." (Moses, 26 Nov 2026)
- "There's always a report that shows these… reports are another big part of it… I don't want dead ends." (Moses, 26 Nov 2026)

## Before each phase

`git fetch origin`. If `origin/rt6/review` has `docs/reviews/t6-engines-2.md`, read it (`git show origin/rt6/review:docs/reviews/t6-engines-2.md`). Fix every blocker and should-fix in your files before the next phase, each with the reviewer's probe copied in and passing, one commit named `fix(rt6f): …`. A finding you disagree with is answered in your report.

## Phases

**1. Order numbers and split.** Track T5 found (its decision 20): after `split-items` the next new order answers 500 every time, because the child is numbered `ORD-n-S1` and the generator reads the newest number and proposes one that exists; two bills opened at the same instant can collide too. Number orders the way the quick-sale engine already does (an advisory lock per branch and a numeric expression index, `apps/api/src/modules/orders/order-number.ts`), with split children numbered so they can never be taken by the next order. Take the order lock in `split-items`. Real case as an e2e test, **"Split, then a new table"**: split a bill by items, open a new table, then 20 new tables opened by four waiters at once: no 500, no duplicate number, three runs.

**2. Sold out from stock, and alerts.** `docs/direction/03-stock-stores-availability.md` section 6 item 3 (T6 started a read-only servings-left endpoint; finish it): servings left per item from the station's store, modes off, warn (default) and block per venue with a per-item override, the availability answer's `source: STOCK`, "We have it" clearing a block for the day and opening a count task, a send in block mode refusing only the line that cannot be made. Then the alert engine, exactly as `docs/direction/04-alerts.md`: the table of kinds, raised once per crossing, cleared by itself, climbing after the wait, read per person (`GET /api/alerts/mine`) and as each role's "Needs you" list, plus counts for the bottom-bar badges. Wire every kind whose event exists today; list the rest with what they wait for. Real case, **"Mince runs out"**: the kitchen store holds 600 g of mince; four burgers sent; servings left falls, `ITEM_LOW` at the low mark, `STORE_LOW` below minimum; in block mode the fifth burger is refused and the rest of that order sends; the chef's "We have it" puts it back for the day and opens a count; a delivery arrives and the alerts clear themselves.

**3. Cost.** `03` and `05` report 22: moving average cost per stock item per store (T6 updates it on deliveries; check it), cost per serving from the recipe and servings, margin per menu item, "No cost yet" and "Cost changed" lists for the accountant, the accountant's rights as `rights-matrix.json` gives them (sees costs and stock, sells nothing). Real case, **"The beef burger costs UGX 5,700"**: the recipe from `Manager-Item` (150 g mince, a bun, a cheese slice, lettuce, tomato, oil, 180 g chips) at the drawing's prices gives UGX 5,700 and a margin of UGX 22,300; a dearer mince delivery moves the cost and puts mince on "Cost changed".

**4. Reports and day close.** `docs/direction/05-reports.md`: the 24 reports as endpoints, each with a date range, a branch and CSV, built only from events (a number with no events behind it is left out; the sold-out estimate is labelled and empty until four weeks of data). Day close as `02-life-cycles.md` section 11: the business day ends at the venue's hour; closing lists every loose end with its way out (open tables carried or walked out, unsent lines, uncounted tills, pending mobile money, requests on their way) and refuses until none is left; then the day report is made, manual sold-out marks and counts reset and yesterday's list is kept for the morning. Real case, **"A day that will not close"**: three loose ends, each cleared its own way, then the close and the day report, whose totals match the payments, voids and waste of that day to the shilling.

**5. Money exceptions.** `docs/direction/07-scenarios-and-rules.md`, tables "Money" and "Sensitive actions": open item with the waiter's cap and a PIN above it; price change on a line with a PIN; on the house and staff meal as their own actions (never a 100% discount); service charge and tip as venue settings; pending mobile money and changing the method before and after the count; walk-out by a manager with a reason; drawer opened with no sale needs a reason; happy hour prices by day and hour; seat numbers on lines and split by seat. Each lands on the Exceptions report. Real case, **"Everything that bends, written down"**: one of each on the demo venue, then the Exceptions report lists all of them with who and why.

If time remains, start E12 from `06-roadmap.md` (held orders and send-once on a dropped connection) and record how far you got.

## Done when

1. Every RT6 finding in your files is fixed with its probe passing, or answered.
2. "Split, then a new table", "Mince runs out", "The beef burger costs UGX 5,700", "A day that will not close" and "Everything that bends, written down" each pass three runs in a row; every earlier real case still passes.
3. The default e2e run is 0 failed in both orders; anything added to quarantine is listed with its reason.
4. Each phase has one additive migration; no existing answer lost a field (shown by a test that compares T6's documented answers).
5. API typecheck 0, build 0, unit tests 0 failed, `eslint` clean on changed files, `pnpm check:event` green.
6. The report lists every new endpoint with path, body and answer for T8 and T10, and says which phases need an independent review (money, rights, stock: phases 1, 2, 4 and 5).
