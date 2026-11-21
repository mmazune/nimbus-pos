# H1F — Fix what the H1 review found

Model: Sonnet. If you are not Sonnet, say so and stop.
Size: M (1–2 h) · Sat 21 Nov 2026 · Depends on: H1-R (commits `3d9b593`, `ede9ea7`; `docs/reviews/h1-sale-engine.md` present)
Folder: `~/Code/nimbus-pos-event` · This is the only session in this folder.
Branch: `concert/event-till--moses`
Database: a disposable Docker `postgres:16` this session starts and removes: container `nimbus-event-h1f`, port **55473**, database `nimbus_event_h1f`. Nothing else.
Ports: API on **4093** for the live proof only.
Ship policy: commit per fix; no push, no merge, no deploy.

First: load `moses-build-standards`, say so, and read §0, §1.3, §6, §7, §8 (type A, product app).

## Why

- Moses, 18 Nov 2026: "They want to know how much payments like cash, card, how much came from Visa, what items are bought from Visa".
- The real case: **two beers by Visa at till `DRK-03` with no signal, posted twice when the signal returns.**
- A fresh reviewer returned "blockers". The worst one: a second, different sale sent with an already-used `clientSaleId` is answered "synced" and never written. On event night that is a sale that vanishes with no trace on the till or the server. The reviewer left 13 failing probes. This milestone turns them green without weakening one of them.

## Read first

1. `docs/reviews/h1-sale-engine.md`, whole. It names each finding, its file:line, its fix and its probe.
2. `apps/api/test/quick-sale.review.e2e-spec.ts` (the 13 red probes).
3. `docs/event/03_BACKEND_SPEC.md` §2, §3; `docs/event/01_DIRECTION.md` (EV-14, 15, 20).
4. `reports/H1_EVIDENCE.md` §5 and the H1 diff for the files the review names.

Where the review's named fix and this prompt differ, this prompt's **requirement** holds and the review's fix is the starting point for how. Say which you used.

## Read-back

Write `reports/H1F_READ_BACK.md` (≤ 40 lines): each finding, the fix you will make, the probe that proves it, questions with defaults. Then continue unless blocked.

## Rules that hold all session

- **Do not edit the assertions in `quick-sale.review.e2e-spec.ts`.** The reviewer wrote them; they are the gate. If you believe a probe is wrong, stop on that item, say why, and carry on with the rest.
- Additive. The restaurant flow keeps its behaviour: the till-open path, the legacy number generator and existing callers are not changed.
- Money stays `Decimal`; no float arithmetic. No full card number anywhere; `pnpm check:event` stays green.
- Disposable database only, URL inline; never read or write a `.env*`; `db:seed` on the disposable database only; no credential literal in any new file.
- Lint per file, never with `--fix`: new files 0 problems, touched files no worse than `reports/proof/H0_api_lint_by_file.txt`. No formatter over the repo. Never `pkill -f`.
- Hand-write any SQL. Do not edit H1's migration `20261121000000_event_till_quick_sale`; a schema change is a new, additive migration.
- Before a heavy test run, check the machine is quiet (`uptime`, `pgrep -fl "jest|playwright|next"`). Two sessions today saw tests flake under load.

## Parts

**§0 Preconditions.** `ede9ea7` is HEAD or an ancestor. The only uncommitted change allowed is this prompt file: commit it first as `docs(event): H1F prompt`. Run the review spec once and save the 13 red names to `reports/H1F_RED_RUN.txt`.

**a. Blocker 1 — a replay must be the same sale.**
- When a sale is first written, store a fingerprint of what was asked for: the lines (item, serving, quantity; order of lines does not matter), tender method, card scheme or mobile-money network, tendered amount, till code, and `soldAt` as sent.
- A request whose `clientSaleId` already exists in this branch is answered as a replay **only if its fingerprint matches**. If it differs: **409** with a clear code (for example `CLIENT_SALE_ID_PAYLOAD_MISMATCH`) and nothing written.
- This holds in **both** places a replay is answered: the up-front lookup and the handler for the duplicate-id race.
- `authCode`, `cardLast4` and `terminalId` are not part of the fingerprint. A replay never changes the stored sale.

Commit.

**b. Blocker 2 — the audit failure log.** When the audit write fails after a sale commits, the sale stands and the error log line carries order id, `clientSaleId`, `branchId` and `tillCode`. No card data in the line. Commit.

**c. Order numbers: fast, and safe at large values.**
- The allocator must not read every order in the branch while holding the lock. Use the review's named fix (an index on the numeric part of the number) or an equal one; a new index is a new additive migration, following the repo's earlier raw-SQL index migrations. Check that `prisma migrate diff` does not propose dropping it, and write down what it shows.
- A branch whose highest number is above 2³¹ still allocates the next one; no server error. Past `ORD-999999` the number simply grows a digit.
- Rows whose number does not match `ORD-` plus digits are ignored by the allocator.
- Measure with 10,000 orders in one branch and 20 concurrent sales, five runs: the query plan uses the index and the lock is held under 20 ms at p95 in **all five**. Save the plan and the five figures to `reports/proof/H1F_allocator.txt`.

Commit.

**d. Till codes that match.**
- Quick sale stores `tillCode` trimmed and upper-cased on the order and the payment.
- The till's expected-cash query matches payments on the trimmed, upper-cased form of that till session's code. The till-open path is not changed.
- Result: cash rung as `drk-03` or `DRK-03 ` reaches the expected cash of the till opened as `DRK-03`.

Commit.

**e. No card number in a text field.**
- `authCode`: letters and digits only, at most 8 characters.
- `terminalId`: letters, digits and dashes only, at most 12 characters.
- `externalTransactionId` and `payerPhone` are accepted only on a mobile-money sale; on a card or cash sale they are a 400. `payerPhone` must look like a phone number.
- Each refusal is a 400 with nothing written, and the refused value is not echoed back or logged.

Commit.

**f. Two things the reviewer could not reach.**
- Add a test for a cash sale that arrives after its till was reconciled (the tablet was offline at cash-up): it is accepted and stored with its till code, never lost. State in the report where that cash shows up and where it does not, so the runbook can say "every tablet shows Synced before cash-up".
- Tests flaked under load (two 404s, dropped connections), and one H1 test's count depended on the test before it. Make each H1 e2e test take its own starting count. Find the cause of a 404 from a route that exists; if you cannot reproduce it, say so plainly under "Unverified" rather than guessing.

Commit.

**g. Proof.** Review spec: 13 of 13 formerly red probes green, none edited. H1's e2e suite, the unit suite and the restaurant-flow suites the reviewer ran. Update `reports/H1_EVIDENCE.md` with a dated "H1F" section: each finding, the commit that fixed it, its probe. Mark H1F in `docs/prompts/README.md`, add dated lines to `ai/AI_STATUS.md` and `PROGRESS.md`, and update the Postman entry if a status code changed. Remove the container; stop the API by PID. Commit.

## Not in it

Anything the review did not raise · event reports, scripts, deployment, web code · receipt history (no receipts at the event) · changing how a till is opened · a load test beyond 20 concurrent sales (that is Thursday's, against the deployed API) · new dependencies.

## Done when

1. Same `clientSaleId` with different lines, a different tender or a different till returns 409 and writes nothing, whether the second request arrives after the first or at the same moment. An identical retry still returns `replayed: true`.
2. The real case still passes: posted twice, one order, 8,000, VISA, `DRK-03`.
3. A forced audit failure leaves the sale in place and logs order id, `clientSaleId`, `branchId` and `tillCode`.
4. Allocator: index used; lock held under 20 ms at p95 in five of five runs with 10,000 orders; a branch above 2³¹ and a branch at `ORD-999999` both allocate the next number.
5. Cash rung as `drk-03` and as `DRK-03 ` counts in the expected cash of the till opened as `DRK-03`; the two-till case from H1 still passes.
6. A 16-digit number in `authCode` or `terminalId` is a 400, is not stored and is not echoed.
7. All 13 formerly red probes pass with their assertions untouched (`git diff ede9ea7 -- apps/api/test/quick-sale.review.e2e-spec.ts` shows no assertion change).
8. H1's quick-sale e2e passes; API unit tests are 1,234 plus the new ones with 0 failing; the reviewer's restaurant-flow run is still 83/83.
9. `tsc` and `nest build` clean; the lint rule met for every touched file; `pnpm check:event` green; any new migration is additive and applies on an empty database and on one that already has H1's migration.
10. The late cash sale test exists and the report says where that cash appears.

## Report

At most 8 lines, verdict first: commits · the 13 probes · each of the six findings as fixed or not · allocator figures · anything unverified (the 404s) · unit and e2e counts · `You need to: …`.

Then STOP.
