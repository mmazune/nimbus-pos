# H1 — Sale engine: `POST /api/pos/quick-sale`

Model: Sonnet. If you are not Sonnet, say so and stop.
Size: L · Sat 21 – Sun 22 Nov 2026 · Depends on: H0 (its three commits at HEAD, `reports/H0_BASELINE.md` present)
Folder: `~/Code/nimbus-pos-event` · This is the only session in this folder.
Branch: `concert/event-till--moses`
Database: a disposable Docker `postgres:16` this session starts and removes: container `nimbus-event-h1`, port **55471**, database `nimbus_event_h1`. Nothing else.
Ports: API on **4091** for the live proof only. No web app.
Ship policy: commit per checkpoint; no push, no merge, no deploy.
Risk: this is a money and idempotency engine. Sonnet builds it; a fresh Opus session that built none of it (H1-R) closes it. Leave it the evidence it needs.

First: load `moses-build-standards`, say so, and read §0, §1.3, §6, §7, §8 (type A, product app).

/goal — phases: a migration · b pricing and numbering · c quick-sale · d till cash · e tests · f proof. Each turn print `GOAL-STATUS: <phase> <done|in progress>; build exit; next`. Print `PAUSED: … checkpointed at <commit>` only after a commit.

## Why

- Moses, 18 Nov 2026: "They want to know how much payments like cash, card, how much came from Visa, what items are bought from Visa".
- Moses, 21 Nov 2026: "the gaps we really, really have that we need to close before the concert in seven days… for manager, everyone".
- **The real case, which becomes a fixture test:** two beers at UGX 4,000 each, paid by Visa, at drinks till `DRK-03` with no signal. The tablet rings it at 21:14, gets signal at 21:20 and posts it twice because the first reply was lost. The result must be **one** order with the next `ORD-` number, status CLOSED, total 8,000, and **one** payment: COMPLETED, CARD, VISA, till `DRK-03`. The second reply says `replayed: true`.
- Today a sale needs five kitchen states and 30–40 database round trips, order numbers collide when two tills sell at once (`orders.service.ts:67-81`), and nothing records the card type. This milestone is the one the event cannot run without.

## Read first

1. `docs/event/README.md`; `docs/event/01_DIRECTION.md` (F1, F5, F6, F7; EV-2, 3, 5, 7, 14, 15, 16, 20, 23).
2. `docs/event/03_BACKEND_SPEC.md` §1, §2, §3. **This is the contract.**
3. `docs/event/research/G1_backend_build_spec.md` §1 (order path, numbering race, pricing, side effects), §2, §3 (idempotency), §4 (auth, part a), §8 (tills), §10, §11, §12. Open the section, not the file.
4. `reports/H0_BASELINE.md`; `CLAUDE.md` §8, §14, §15, §16; `docs/TESTING_AND_QA.md` (the disposable Docker Postgres recipe, about lines 280–300).
5. Code: `apps/api/src/modules/orders/orders.service.ts` (67–81, 273–468), `tills/tills.service.ts` (364–452) and its spec, `payments/payments.service.spec.ts` (10–70, the mock pattern), `common/audit/audit-branchid-guard.spec.ts`, `app.module.ts`, the `Order`, `Payment` and `MenuItem` models, and migration `20260821200636_b5_4_d1_posting_error_resolution` as the style to copy.

Where G1 and `03` differ, **`03` wins**. Three known cases: `authCode` is optional; a cash sale does not require an open till session; there is no unique index on `(branch_id, sku)`.

## Read-back

Write `reports/H1_READ_BACK.md` (≤ 60 lines): the route, the columns, what is inside the transaction and what is outside, contradictions and which document won, questions with defaults, the baseline unit-test count. Then continue unless blocked.

## Rules that hold all session

- Event work is additive. Existing callers of the orders, payments and tills services keep their behaviour; the legacy `generateOrderNumber` stays as it is for the restaurant flow.
- Money stays `Decimal(12,2)` as the schema has it (EV-7). No `parseFloat`, `toFixed` or float arithmetic on money in new code.
- No full card number, CVV or free-text card field anywhere. Brand, last four, approval code and terminal ID only. `pnpm check:event` stays green.
- Tests and the live proof use the disposable database only. Pass its URL inline on each command; never write or read a `.env*`; the throwaway password never appears in a report. Print `select current_database(), inet_server_port()` before the first test run.
- `db:seed` may run on the disposable database only. It never runs on anything else.
- Never the API's `lint` script (it has `--fix`); call eslint directly. Never `pkill -f`: stop the API by its recorded PID and the container by its name.
- Do not take the raw output of `prisma migrate dev`: the repo carries schema drift that a raw diff would apply. Hand-write the SQL.
- Decide, log under "Decisions taken", continue. Ask only if a rule here would have to be broken.

## Parts

**§0 Preconditions.** H0's commits at HEAD, clean tree, `pnpm check:event` green. Start the container. Stop if port 55471 is taken; do not reuse someone else's database.

**a. Migration (`03` §1, G1 §12).** One new folder under `packages/db/prisma/migrations/`, timestamped today, named `event_till_quick_sale`.
- New enums `CardScheme` (VISA, MASTERCARD, OTHER) and `MomoNetwork` (MTN, AIRTEL).
- `orders`: `till_code`, `client_sale_id`, unique `(org_id, client_sale_id)`, index `(org_id, branch_id, till_code, created_at)`.
- `payments`: `card_scheme`, `card_last4 varchar(4)`, `auth_code`, `terminal_id`, `till_code`, `momo_network`; index `(org_id, branch_id, till_code, created_at)`; index `(org_id, card_scheme)`.
- `menu_items`: `brand`; index `(org_id, sku)`. No unique index on SKU.
- Every column nullable. No `DROP`, no `ALTER TYPE … ADD VALUE`, no edit to an older migration.
- Update `schema.prisma` to match; `pnpm db:generate`; `migrate deploy` on the empty disposable database must apply every migration.

Commit.

**b. Pricing and numbering that work inside a transaction.** Make the line-pricing logic of `computeLinePricing` usable with a transaction client (an optional client parameter, or a small extracted service). Add a number allocator for quick sales: inside the transaction take `pg_advisory_xact_lock(hashtext(branchId))`, then allocate the next `ORD-` number with the same six-digit format. `orders.service.spec.ts` passes without edits to its assertions. Commit.

**c. The quick-sale module (`03` §2, steps 1–7).** `apps/api/src/modules/quick-sale/`: module, controller, DTO, service, spec; registered in `app.module.ts`.
- Guards `JwtAuthGuard, PermissionGuard, BranchContextGuard`, `@RequireBranchContext()`, `@Permissions('pos:orders:write','pos:orders:close')`, `@HttpCode(200)`. No BG3 wrap, no `Idempotency-Key`, no `/sync/replay`, no new permission key, no `seed.ts` change.
- Request and response exactly as `03` §2. Exactly one payment.
- Replay check first, by `(orgId, clientSaleId)`: same branch returns the stored sale with `replayed: true`; another branch returns 409.
- Load and price every line **outside** the transaction, in one query. Prices are tax-inclusive: `tax = 0`, `total = subtotal`.
- The transaction (`timeout 15000`, `maxWait 5000`) holds only writes: the lock and number, the order with its items (`serviceType TAKEAWAY`, `status CLOSED`, `tillCode`, `clientSaleId`, `metadata { source: 'QUICK_SALE', soldAt, tendered, changeDue }`), and the payment (`amount = total`, `status COMPLETED`, `tillCode`, card or mobile-money fields; cash `NOT_REQUIRED`, card and mobile money `UNVERIFIED`).
- A unique violation on `client_sale_id` returns the original as a replay. On `order_number`, retry up to three times.
- After commit, one audit entry `ORDER_QUICK_SALE` whose metadata includes `branchId`.
- Defaults to take and log, since `03` is silent: (1) `tenderedAmount` is optional for cash and means "exact" when absent; (2) card or mobile-money fields sent on a cash sale are a 400; (3) a SKU that matches more than one active item in the branch is a 400 and nothing is written; (4) `soldAt` is stored as given and is never used for numbering, locking or ordering: `createdAt` stays the server's time.

Commit.

**d. Till cash (`03` §3, EV-20).** `tills.service.ts:381-389`: the cash query adds `OR: [{ tillCode: till.tillCode }, { tillCode: null }]`. Extend `tills.service.spec.ts` with the two-till case below. Do not change `shifts.service.ts`; note that it has the same branch-wide pattern. Commit.

**e. Tests, seen failing first.** Write each test before the code it proves where you can, and save the red run to `reports/H1_RED_RUN.txt` before the green one.
- Unit tests in the repo's mock pattern for validation, the replay branch and both unique-violation branches.
- Integration tests against the disposable database, in the repo's e2e style (boot `AppModule`, real HTTP): `apps/api/test/quick-sale.e2e-spec.ts`. Setup is `migrate deploy` plus `db:seed`, then the spec creates its own branch items with SKUs through Prisma. If no Bartender user is seeded, the spec creates one.
- A guard at the top of the new specs: refuse to run unless the database host is `localhost` or `127.0.0.1` and the name starts with `nimbus_event_`. Prove it red with a made-up remote URL; no connection is attempted.
- A deterministic fixture night of about 200 sales across two branches and four tills, in `apps/api/test/fixtures/event-night.ts`, with its expected totals computed in the fixture. H4a reuses it.

Commit.

**f. Proof and hand-off.**
- Live: start the API on 4091 against the disposable database, log in as a seeded cashier, post the real case twice with `curl`. Save status codes and the two `replayed` values to `reports/proof/H1_live.txt`. No token in the file.
- `reports/H1_EVIDENCE.md` for the reviewer: one negative control per guard; the failure modes you considered; `file:line` for the lock, the replay check, both unique-violation handlers, every query's org and branch scope, and every money operation; the rollback (revert the commits; the migration is additive and needs no down).
- Repo hygiene, briefly: the new route in the Postman collection (the repo's dual-scope variable rule; login asserts 201), a dated entry in `ai/AI_STATUS.md` and `PROGRESS.md`, H1 marked in `docs/prompts/README.md`.
- Stop the API by PID. Remove the container by name.

Commit.

## Not in it

Event reports (H4a) · `event-setup.ts` and `import-event-menu.ts` (H2) · health 503, trust proxy, secret boot checks (H2) · any web code · fixing the legacy number generator for the restaurant flow · `shifts.service.ts` · new permission keys · receipts, kitchen display, ledger posting, stock · a unique SKU index · changing money to integer units · new dependencies.

## Done when

1. The migration applies on an empty Postgres with `migrate deploy`, exit 0, and its SQL has no `DROP`, no `ADD VALUE` and no non-null column.
2. One `POST /api/pos/quick-sale` writes one CLOSED, TAKEAWAY order and one COMPLETED payment in one transaction, both carrying `tillCode`, with `metadata.source = 'QUICK_SALE'`.
3. The real case passes: posted twice, one order, total 8,000, VISA, `DRK-03`, second reply `replayed: true`. The same holds when the two posts are sent at the same moment.
4. The same `clientSaleId` from another branch returns 409 and writes nothing.
5. Twenty concurrent sales in one branch get twenty distinct order numbers with no 5xx, three runs in a row.
6. CARD without `cardScheme`, MOMO without `momoNetwork`, cash tendered below the total, two payments in one request, an inactive SKU and another branch's SKU each return 400 and the order count does not change.
7. A Bartender-role user gets 403; a Cashier gets 200.
8. Cash payments are `NOT_REQUIRED`; card and mobile money are `UNVERIFIED`; `changeDue` equals tendered minus total.
9. Two tills in one branch, cash 30,000 on `DRK-01` and 50,000 on `DRK-02`: `DRK-01`'s expected cash is its float plus 30,000. A cash payment with no till code is still counted, as before.
10. A payment failure inside the transaction leaves no order row.
11. The fixture night reconciles to the shilling: the sum of order totals equals the sum of payment amounts equals the fixture's expected total; the same per tender; each till's cash equals the cash term of that till's summary.
12. The audit entry carries `branchId` and `audit-branchid-guard.spec.ts` is green.
13. API unit tests: the H0 count plus the new ones, 0 failing. eslint without `--fix`, `tsc` and `nest build` are clean or no worse than `reports/H0_BASELINE.md`. `pnpm check:event` is green.
14. No `parseFloat` or `toFixed` on money in the new module; the database guard was seen red; the red-run file exists.

## Report

At most 8 lines, verdict first: commits · migration result · the fourteen checks as passed/failed counts, naming any failure · unit-test count against the H0 baseline · decisions taken · what the reviewer should look at hardest · `You need to: …`.

Then STOP.
