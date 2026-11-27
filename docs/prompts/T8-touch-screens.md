# T8 — Touch screens: join everything, follow the new rights, then shifts, paying, kitchen, bar and stock

Read `docs/prompts/LONG-RUN-RULES.md` first. It binds you.
Branch: `t8/touch-screens`, cut from `rebuild/main`. Then `git merge --no-edit` in this order: `origin/t5/join-up`, `origin/t6/engines-2`, `origin/t7/drawings`. A trial showed all three merge clean. Track T10 starts from the same three merges; you two split `apps/web` by the lists below.
You own: in `apps/web/src`: `screens/{approvals,floor,kitchen,me,order,ready,receipts,reservations,shared,till}/**` and new `screens/{lock,store,team,pay}/**`; `components/{pos-shell,floor,waiter,cashier,supervisor,kitchen,kit,kit-gallery,profile,providers,ui}/**` **except** `pos-shell/OperationalTopNav*`; pages `_app.tsx`, `index.tsx`, `login.tsx`, `kit.tsx`, `waiter/**`, `cashier/**`, `supervisor/**`, `kitchen/**`, new `store/**`; `lib/**` except `lib/manager/**` and `lib/backoffice/**`; `styles/**`, `tailwind.config.ts`; e2e folders `t1`, `t5`, `order`, `cashier-floor`, `kit`, `supervisor-*` and new `t8`. Also `reports/**` and the Status cells of `design/screens/SCREENS.md` and `SCREENS-2.md`.
You never touch: T10's folders (`screens/{backoffice,manager,owner,accountant}`, `components/manager`, `pos-shell/OperationalTopNav*`, pages `manager/**`, `owner/**`, `accounting/**`, `lib/manager`, `lib/backoffice`, e2e `manager-*` and `t10`), `apps/api/**`, `packages/db/**` (track T9), `design/screens/html|png|kit.css`.

## Why

- "Waiters, supervisors, cashiers… these people use touch screens." "Everything 2 to 3 taps away." (Moses, 25 and 26 Nov 2026)
- "A chef can mark something as wastage… main and secondary store… how a chef is notified." (Moses, 25 and 26 Nov 2026)
- "They should work autonomously until a goal is achieved." (Moses, 26 Nov 2026)

The real case: track T6 changed the rules under the screens on 26 Nov. A manager no longer types a new person's password or PIN (onboarding returns a one-time setup token and the person sets their own PIN on the device); waiters lost payment and till rights and supervisors lost payment rights; each order now says what the caller may do (`allowedActions`); approvals can be answered by a supervisor's PIN on the asking device and climb to managers after 3 minutes; a refund after the day it was paid needs a manager; a till over or short by more than the limit waits for a supervisor's sign-off. The screens built by T1, T3 and T5 were built before that. T6 also built stock and stores (ledger, take-out, remake, stores chain, requests with PIN receipt, deliveries, counts), and nothing on screen uses them yet. Track T7 drew 184 more screens; launching this track is the owner's approval of the ones you build from.

## Read first

`reports/T5_REPORT.md`, `reports/T6_REPORT.md` (its endpoint list and "For the other tracks"), `reports/T7_REPORT.md`, `design/screens/SCREENS-2.md` and `OVERVIEW.md`, `docs/direction/02-life-cycles.md`, `03-stock-stores-availability.md`, `07-scenarios-and-rules.md`, `10-people-and-access.md`.

## Phases

**1. One branch that works under the new rules.** Do the merges. Load the demo venue (its loader must work with T6's schema; if not, fix the loader, which is yours here). Make T1's, T3's and T5's browser suites pass against T6's API, three runs. Then: every button on the order screen and the table actions sheet takes its shown or hidden state from `allowedActions`, not from the role; remove what a role lost; the approval paths use T6's approval requests, with the supervisor PIN pad on the asking device from the T7 drawing; refund shows "needs a supervisor" or "needs a manager" as the server says; the Till shows "A supervisor signs any difference" and its sign-off, now that it is true (the two sentences T1 left out). Add `SCREENS-2.md` rows (status `built`) for any form T5 built without a drawing.

**2. Start of a shift (T7 group 1).** Lock screen with PIN pad, wrong PIN with tries left, **set your own PIN** from a setup token (the person types it twice; nobody else sees it), start my shift, the Floor when the shift is not started, the cashier's Floor, a tab with a name. Real case in the browser, **"A new waiter sets her own PIN"**: a manager onboards her through the API, she opens the terminal with the token, sets her PIN, signs in, starts her shift and opens a table.

**3. Paying (T7 group 4).** On T6's and T2's endpoints: mobile money by reference and its pending state, card by reference, paying one share of a split bill, paid with the receipt on screen, "Bill changed" since printing, refund asking for approval. Anything without an endpoint (walk-out, change of method after the count) is left out and listed for T9.

**4. Kitchen and bar (T7 group 6).** The bar screen; Done with bring back; Sold out with mark, back on and set a number; remake on a ticket (T6's remake: stock leaves again with the reason); the opening list "still sold out?" (T2's yesterday list); the low-stock banner on the kitchen screen from T6's levels and minimums.

**5. Stock on touch screens (T7 group 7, and `Store-Requests`, `Kitchen-Store`, `Chef-Request-Phone`, `Chef-Waste-Phone`).** Store keeper: Requests (issue, decline), Stock with minimum and fill-to, Receive a delivery (full, short, dearer), Count (blind), To buy. Chef and bartender: Store with the suggested request ready, ask, receive with my PIN, received short; Take out of stock with the fixed reasons and the supervisor PIN above the limit. The store keeper signs in with a PIN and lands on Requests; the kitchen's bar gains Store.

**6. Supervisor (T7 group 5).** Team (who is on, their tables and sales, move tables between waiters); supervisor Me; new booking, edit, cancel with a reason, no-show, history and Attention to the drawings.

**7. Prove the chains in the browser on the demo venue,** three runs each at 1280 × 800 (kitchen screens also at 1920 × 1080), the waiter's and chef's phone parts again at 390 × 844:
- "A new waiter sets her own PIN" (phase 2).
- **"Twelve buns short" through the screens:** the kitchen banner, the chef sends the suggested request, the store keeper issues 36, the chef receives 24 with his PIN, the loss shows to the store keeper, a count closes it.
- **"A burger takes 150 g of mince" through the screens:** a waiter sends a burger, the supervisor voids one as not made, the chef remakes one and takes 1.5 kg out as spoiled with a supervisor's PIN; the store keeper's Stock shows each movement.
- **"A refund the next day":** the supervisor's refund on a bill from yesterday asks for a manager.
- Every earlier suite still passes.
Score every screen you built against the look review; 20 of 24 passes.

## Done when

1. The three branches are merged; T1's, T3's and T5's suites pass against T6's API, three runs.
2. No button shows for a role that lacks the right; shown by a test that signs in as each touch role and compares visible actions with `allowedActions`.
3. Each screen in phases 2 to 6 sits beside its drawing in `reports/proof/T8/`; differences are listed with the reason.
4. The four chains in phase 7 pass three runs in a row.
5. No screen, log or test output shows another person's PIN.
6. Rule 10 holds on every screen at its sizes; `pnpm verify:web` and the web build are green.
7. `git diff --stat` from the last merge commit stays inside what you own.
8. `SCREENS.md` and `SCREENS-2.md` rows for what you built say `built` with their score.
