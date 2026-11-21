# 03 — Backend spec (H1, H2, H4a)

*21 Nov 2026. This summarises and decides. The line-by-line detail, with quotes, is in `research/G1_backend_build_spec.md`; section numbers below (G1 s…) point into it. All of this is [P] until built.*

## In short

- One additive migration, two new modules (`quick-sale`, `event-reports`), two scripts (`event-setup`, `import-event-menu`), and three small edits (`orders.service.ts`, `tills.service.ts`, `app.module.ts`).
- A quick sale is one call, one transaction, one payment, and is safe to replay.
- No new permission keys: Cashier already holds `pos:orders:write` and `pos:orders:close`.

## 1. Migration (hand-written, additive)

Schema diff and the SQL are in G1 s12. Summary:

| Table | Add | Notes |
|---|---|---|
| (new enums) | `CardScheme` VISA, MASTERCARD, OTHER · `MomoNetwork` MTN, AIRTEL | New types only. No `ADD VALUE` on existing enums |
| `orders` | `till_code` text null · `client_sale_id` text null · unique `(org_id, client_sale_id)` · index `(org_id, branch_id, till_code, created_at)` | Nulls stay distinct in the unique index |
| `payments` | `card_scheme`, `card_last4 varchar(4)`, `auth_code`, `terminal_id`, `till_code`, `momo_network` · index `(org_id, branch_id, till_code, created_at)` · index `(org_id, card_scheme)` | All nullable |
| `menu_items` | `brand` text null · index `(org_id, sku)` | Do **not** add unique `(branch_id, sku)` now; the import script enforces it. A unique index can fail on existing data |

Rules: `migrate deploy` only; direct (non-pooled) Neon URL; take a Neon restore branch first; the migration must apply on an empty database. Follow the repo's migration rules (G1 s10; `CLAUDE.md` section 14).

## 2. `POST /api/pos/quick-sale`

**Module:** `apps/api/src/modules/quick-sale/` (module, controller, DTO, service, spec).
**Guards:** `JwtAuthGuard, PermissionGuard, BranchContextGuard`, `@RequireBranchContext()`, `@Permissions('pos:orders:write','pos:orders:close')`. Branch comes from `X-Branch-Id`. No BG3 wrap, no `Idempotency-Key` header (EV-14).

**Request**

| Field | Rule |
|---|---|
| `clientSaleId` | string 8–64, `[A-Za-z0-9_-]`; made on the tablet (UUID). Required |
| `tillCode` | string ≤ 50. Required. Stored trimmed and upper-cased (H1F): `drk-03` and `DRK-03 ` are `DRK-03` |
| `soldAt` | ISO time with offset; when the cashier tapped. Optional; defaults to now |
| `lines[]` | 1–100. Each: `sku` **or** `menuItemId`; optional `menuItemServingId`; `quantity` integer ≥ 1 |
| `payment.method` | `CASH`, `CARD` or `MOMO`. Exactly one payment (EV-5) |
| `payment.tenderedAmount` | Cash only; ≥ total |
| `payment.cardScheme` | Required when CARD |
| `payment.authCode`, `cardLast4`, `terminalId` | **Optional** (G1 proposed `authCode` required; overridden: it would slow the queue). `cardLast4` must be 4 digits. H1F: `authCode` letters/digits, at most 8; `terminalId` letters/digits/dashes, at most 12; `externalTransactionId` and `payerPhone` (7 to 12 digits) are accepted on a mobile-money sale only |
| `payment.momoNetwork` | Required when MOMO |
| `payment.externalTransactionId`, `payerPhone` | Optional |

The global validation pipe uses `forbidNonWhitelisted`: an unknown field returns 400. Add fields as optional and ship the API before the till.

**Service steps**

1. **Replay check:** `order.findFirst({ orgId, clientSaleId })`. Found in the same branch: return it with `replayed: true` **only if it is the same sale** (H1F: till, method, scheme/network, lines as a multiset, tendered and `soldAt` as sent; `authCode`, `cardLast4`, `terminalId` are not compared), otherwise 409 `CLIENT_SALE_ID_PAYLOAD_MISMATCH` and nothing is written. Found in another branch: 409.
2. **Price outside the transaction:** load all needed menu items and servings for the branch in one query (by `sku` or id, `isActive`). Price in memory. Reuse the logic of `computeLinePricing` (`orders.service.ts:273-428`), which is private and uses `this.prisma`: give it an optional transaction-client parameter or extract a small pricing service. Existing callers must not change.
3. **Totals:** there is no tax or service-charge code in the API (G1 s1). Prices are tax-inclusive: `tax = 0`, `total = subtotal`.
4. **Transaction** (`{ timeout: 15000, maxWait: 5000 }`; only writes inside):
   - `SELECT pg_advisory_xact_lock(hashtext(branchId))`, then allocate the next `ORD-` number (EV-15).
   - Create the order: `serviceType TAKEAWAY`, `status CLOSED`, `tillCode`, `clientSaleId`, totals, `metadata { source: 'QUICK_SALE', soldAt, tendered, changeDue }`, with its items.
   - Create the payment: `amount = total`, `status COMPLETED`, `tillCode`, card and mobile-money fields; cash `captureMode ONLINE_PROVIDER`, `verificationStatus NOT_REQUIRED`; card and mobile money `MANUAL_REFERENCE`, `UNVERIFIED` (EV-23).
5. **Unique violations:** on `client_sale_id`, return the original as a replay (after the same same-sale comparison as step 1). On `order_number`, retry up to 3 times.
6. **After commit:** one audit entry `ORDER_QUICK_SALE`. Its metadata **must** include `branchId` or `audit-branchid-guard.spec.ts` fails the build.
7. **Response:** `{ replayed, order { id, orderNumber, status, total, tillCode, createdAt }, items[], payment {…}, changeDue }`.

**Skipped on purpose:** the kitchen state machine (KDS fires only from `sendOrder`), till-session requirement for cash (none exists today), ledger posting (none fires today).

**Tests (see them fail first)**

| Test | Proves |
|---|---|
| Same `clientSaleId` twice | One order; second response `replayed: true` |
| 20 concurrent sales in one branch | 20 distinct order numbers; no 5xx |
| CARD without `cardScheme`; MOMO without `momoNetwork` | 400 |
| Cash with tendered < total | 400 |
| Two payments in one request | 400 (shape allows only one) |
| Inactive or other-branch SKU | 400, nothing written |
| Bartender-role user | 403 |
| Fixture night of about 200 sales | Totals reconcile to the shilling in section 4 |

Tests run against a disposable Postgres (`docs/TESTING_AND_QA.md`), never a real database; no host guard exists today (G1 R13).

## 3. Till cash fix (EV-20)

`apps/api/src/modules/tills/tills.service.ts:381-389`: add `OR: [{ tillCode: till.tillCode }, { tillCode: null }]` to the cash-payments query, and update `tills.service.spec.ts`. With quick sales always setting `tillCode`, each till's expected cash is its own. `ShiftCloseSummary` (`shifts.service.ts:228-245`) has the same branch-wide pattern; do not change it in H1, note it.

## 4. Event reports (H4a)

**Module:** `apps/api/src/modules/event-reports/`. Guards `JwtAuthGuard, PermissionGuard` only (no branch guard): organisation from the caller's membership, branches filtered to that organisation, following the franchise module's pattern (G1 s4). Do not reuse the `franchise:*` permission keys; they are not seeded. Gate on a key Manager already holds (choose from `seed.ts` and record which).

| Endpoint | Returns |
|---|---|
| `GET /api/event-reports/summary?from&to&branchIds?` | The five numbers (below), JSON |
| `GET /api/event-reports/lines.csv?from&to&branchIds?` | One row per order line: time, branch, till, cashier, order number, SKU, item, brand, category, quantity, line total, tender, card scheme, mobile-money network, approval code, verification status. Streamed, values escaped |

`from` and `to` are ISO times **with offset** and are required. Existing reports use server-local day windows; do not copy that.

**A sale is:** `Order.status = 'CLOSED' AND Payment.status = 'COMPLETED'`, joined one-to-one (EV-5). Completed refunds are netted, or the response says plainly that they are not.

| # | Number | Definition |
|---|---|---|
| 1 | Tender split | Sum and count of payments by `method`, with mobile money split by `momoNetwork` |
| 2 | Visa value and share | Sum where `cardScheme = VISA`; share of card value and of all value. Mastercard and Other alongside |
| 3 | Items by card type | Line quantity and value grouped by tender and `cardScheme` |
| 4 | Top items | Grouped by `COALESCE(sku, id)` with name and brand; quantity and value; per branch and combined |
| 5 | Per-till cash-up | Per `(branch, tillCode)`: sales count, cash, card, mobile money; opening float, counted cash and variance from `TillSession` where one exists |

Brands by category and the hour curve are H5.

## 5. Scripts (H2)

**`packages/db/prisma/event-setup.ts`** — idempotent, takes a JSON config, has `--dry-run`, refuses to run unless `EVENT_SETUP_CONFIRM` names the target organisation.

| Creates or sets | Detail |
|---|---|
| Roles and permissions | The role/permission part of the seed **only**. Never the demo organisation or demo users (EV-18) |
| Organisation and two branches | Food, Drinks; `currencyCode UGX`, `timezone Africa/Kampala` |
| Users | Cashiers per branch (Cashier role, never Bartender), 1–2 Supervisors per branch, one Manager with membership in both branches for the organiser, one for Moses |
| PINs | Generated; written once to a **gitignored** file for printing. Cashier 6 digits, Supervisor 8 |
| Tills | Till codes per branch (for example `DRK-01`…`DRK-06`, `FOOD-01`…`FOOD-04`) and a till-to-terminal-ID map kept in config |

**`packages/db/prisma/import-event-menu.ts`** — `demo-import.ts` is unusable (needs all 65 CSVs). New script, CSV per branch:

`sku, name, brand, category, price, serving, sort_order, active`

- Upsert by `(branchId, sku)`; refuse duplicate SKUs within a file; create missing categories.
- `price` is a whole number of shillings, tax-inclusive.
- `--dry-run` prints creates, updates and deactivations; the real run needs the dry-run output acknowledged.
- SKU is the stable key everywhere: import, till tiles, reports, CSV. A blank SKU is rejected.

## 6. Other small API changes (H2)

| Change | Why |
|---|---|
| `GET /api/health` returns 503 when the database check fails | Monitors read status codes (F13) |
| `app.set('trust proxy', 1)` behind Caddy | Audit IPs are otherwise the proxy's |
| Fail boot in production if `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` or `QUICK_PIN_PEPPER` is unset or equals the built-in default | F9 |
| `JWT_ACCESS_TTL=12h` on the event deployment (env only) | EV-17 |

## What is still unverified

- The exact `AppModule` import list and the `CreateRefundDto` fields (G1 UNKNOWN).
- Transaction time over Neon with real latency; measured in the H2 load test.
- Whether per-line recipe-cost queries inside pricing can be skipped for items with no recipe.
- Server timezone of the host; the event reports avoid depending on it.
