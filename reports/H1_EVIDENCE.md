# H1 evidence pack (for the fresh reviewer, H1-R)

Branch `concert/event-till--moses`, code at HEAD `b4f1c12` (later commits touch docs and proof files only). Built by Sonnet 5.5. Nothing pushed, merged or deployed. Every claim is graded [live] (ran against the disposable Postgres `nimbus_event_h1`, container `nimbus-event-h1`, host port 55471) or [code] (read, not run).

## 1. One negative control per guard [live]
Driver: `reports/proof/H1_mutation_controls.py`; output: `reports/proof/H1_mutation_controls.txt`. Each defect planted alone, files restored from a copy, and the run ended on an empty source `git diff`.

| Guard | Defect planted | Went red |
|---|---|---|
| Replay lookup | ignore the stored sale | unit 2 red. **e2e stayed green**: the `client_sale_id` unique-violation handler is a backstop and still returned the replay. Two layers cover it; only the unit spec isolates the lookup |
| Other-branch replay is 409 | branch check removed | unit 2 red, e2e `409` test red (got 200) |
| Advisory lock | removed | unit 1 red, e2e 20-concurrent red |
| Order-number retry | lock and retry removed | unit 3 red, e2e red. Status spread with the lock gone: retry kept 200×5 / 409×15; retry gone 200×2 / 409×18; **5xx 0** in both (`H1_lock_removed_spread.txt`), so the real Prisma P2002 target maps to 409, not to a 500 |
| `client_sale_id` P2002 handler | removed | unit 2 red, e2e same-moment double post red |
| `@Permissions` | removed | e2e Bartender test red (got 200) |
| Branch scope of menu query | `branchId` filter removed | unit 1 red, e2e 2 red (SKU and `menuItemId` of another branch priced, 200) |
| Active-only | `isActive` filter removed | unit 1 red, e2e red |
| Atomicity | order created outside the transaction | e2e red: DB trigger fails the payment, 1 order row left behind |
| Till cash | `OR tillCode/null` removed | unit 3 red, e2e red (100,000 where 50,000 expected) |
| Audit `branchId` | key dropped | unit 2 red, e2e red |
| Cash tendered ≥ total | check removed | unit and e2e red |
| CARD needs cardScheme | check removed | unit and e2e red |
| DB host guard | made-up remote URL; wrong database name | both refused before any connection (`H1_guard_red.txt`) |
| Auth and branch membership | no token; no membership | e2e: 401; refused, nothing written |

Red-first record: `reports/H1_RED_RUN.txt` (part 1 compile-red; part 2 behavioural red, all 27 e2e tests red on 404 (27 ✕ listed; the file's summary line was cut by `head`); part 3 the two till tests red before the EV-20 fix).

## 2. Failure modes considered
- **Two tills, same instant, same branch.** Serialised by `pg_advisory_xact_lock(hashtext(branchId))`; a legacy writer takes no lock, so the `order_number` unique violation is still handled by up to 3 attempts, then 409 `ORDER_NUMBER_CONTENTION` (never 5xx).
- **Lost reply, tablet retries (sequential and simultaneous).** Replay by `(orgId, clientSaleId)`; the race is closed by the unique index and the handler below.
- **Same id from another branch.** 409 before validation; nothing written.
- **Payment fails after the order insert.** Both are in one transaction; DB-level trigger proves rollback.
- **Pool exhaustion.** Waiters on the lock hold a connection each. `maxWait 5000` bounds it. Not load-tested here; H2 owns the load test.
- **Audit write fails after commit.** Swallowed and logged; the sale is not turned into an error the tablet would retry. A replay never back-fills a missing audit row.
- **Retried payload differs from the stored sale.** The stored sale is returned as is, by the spec's "return it".
- **Overflow.** Total ≥ 10,000,000,000 is a 400; quantity ≤ 1000, lines ≤ 100.
- **Cross-tenant.** Every query carries `orgId`; branch comes from the guard's membership check, not the body.

## 3. `file:line` (HEAD `b4f1c12`)
| What | Where |
|---|---|
| Advisory lock; number allocation (MAX over numeric part) | `apps/api/src/modules/orders/order-number.ts:19`, `:21` |
| Replay check (first thing) | `quick-sale.service.ts:82-83` |
| Replay lookup scoped org + clientSaleId | `:123-125` |
| Other-branch replay 409 | `:130-135` |
| `client_sale_id` unique-violation handler | `:99-103` |
| `order_number` retry then 409 | `:104-110` (`attempt < MAX_ATTEMPTS` at `:105`) |
| P2002 target decoding | `:61` |
| Transaction and timeouts | `:91-93` |
| Allocation inside the transaction; order create; payment create | `:266`, `:267`, `:304` |
| Menu query: org, branch, active | `:188-190` |
| Audit after commit, with `branchId` | `:346-351`; swallowed at `:362` |
| Guards, permissions, `@HttpCode(200)` | `quick-sale.controller.ts:14-15`, `:20-21` |
| Per-till cash | `tills/tills.service.ts:389` |
| Module registered | `app.module.ts:21`, `:80` |
| Migration | `packages/db/prisma/migrations/20261121000000_event_till_quick_sale/migration.sql` |

Org and branch scope of each query: replay `findFirst` (org; branch compared after, `:123-135`); menu `findMany` (org + branch + active, `:186-198`); allocation `MAX` (branch, `order-number.ts:21-23`); order and payment creates (org + branch from the guard context, `:269-270`, `:306-307`); till cash query (org + branch + till, `tills.service.ts:381-390`).

Every money operation, all `Decimal`, no `parseFloat`/`toFixed`/`Number` on money in the module (grep at HEAD: none): price `:221-232`; subtotal sum `:232`; total `:243`; limit `:244`; tendered `:249`; below-total check `:250`; change `:252`; stored amounts `:274-277`, payment amount in `write()`. Test side only: fixtures use integer shillings.

## 4. Rollback
Revert the H1 commits (`git revert 0c1fa50^..HEAD`, or drop the branch). The migration is additive and nullable, so no down migration is needed: the previous app version keeps working with the extra columns present. On a shared database, only `migrate deploy` ever; a Neon restore branch first (not done here: shared Neon was never touched).

## 5. Decisions taken (beyond `03`)
1. `tenderedAmount` optional for cash, absent = exact. 2. Card or mobile-money fields on a cash sale: 400; likewise `momoNetwork` on card, card fields on MOMO, and `tenderedAmount` on non-cash. 3. A SKU matching more than one active branch item: 400. 4. `soldAt` stored in metadata as given (defaults to the server's now when absent, per `03`); never used for numbering or ordering. 5. Quick sale prices from one in-memory query and **skips recipe cost snapshots** (`costUnit`/`costTotal`/margin stay null on its items). 6. `computeLinePricing` gained an optional `client` parameter as the prompt asked; **it has no caller yet**. 7. Limits not in `03`: quantity ≤ 1000, total < 10^10. 8. Order numbers come from `MAX(numeric part)` over the branch, not "latest by created_at".

## 6. Look hardest at
- Whether swallowing the audit failure is acceptable for a money path.
- The allocator scans the branch's orders while holding the lock; fine for a night, measure in H2.
- Replay returning the original when the payload differs.
- `MANUAL_REFERENCE` + `UNVERIFIED` for card and mobile money (as `03`), so nothing verifies them later in H1.

## 7. Disclosures and limits
- The full unit run once showed 1 failure in `quick-pin.service.spec.ts` (untouched, bcrypt-heavy, host load ~25); it passed alone 3 times and the full re-run was 1234/1234 (`H1_final_unit_build.txt`). Not fixed.
- Quick-sale e2e refuses any database not named `nimbus_event_*`, so a full `test:e2e` elsewhere shows it red by design.
- Prettier ran on new files only; checks ran directly, not through loadmaster (no `.loadmaster.toml`), as in H0.
- `ShiftCloseSummary` (`shifts.service.ts`) has the same branch-wide cash pattern; deliberately not changed (prompt).
- The Postman collection has empty credential variables; its auto-login reads them from a Postman environment.
- Not run: web, Playwright, any shared or Neon database, four-viewport sweeps (no web code).

## 8. Proof files (`reports/proof/`)
`H1_migration.txt` · `H1_schema_parity.txt` · `H1_guard_red.txt` · `H1_mutation_controls.{py,txt}` · `H1_lock_removed_spread.txt` · `H1_live.txt` · `H1_newman.txt` · `H1_final_unit_build.txt` · `H1_final_e2e.txt` · `H1_lint_by_file.txt` · `H1_final_check_event.txt`
