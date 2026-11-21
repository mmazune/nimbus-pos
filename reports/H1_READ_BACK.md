# H1 read-back

*21 Nov 2026, Sonnet 5.5, branch `concert/event-till--moses`, base `23c7a2c` + prompt v2.*

## Route
`POST /api/pos/quick-sale` (controller `pos`, handler `quick-sale`, `@HttpCode(200)`).
Guards `JwtAuthGuard, PermissionGuard, BranchContextGuard`, `@RequireBranchContext()`,
`@Permissions('pos:orders:write','pos:orders:close')`. `PermissionGuard` uses `every()`, so a
role needs both. Bartender holds only `pos:orders:read` in `seed.ts`, so it gets 403. No BG3 wrap.

## Columns (migration `event_till_quick_sale`, all nullable, additive)
- enums `CardScheme`, `MomoNetwork` (new types only)
- `orders`: `till_code`, `client_sale_id`; unique `(org_id, client_sale_id)`; index `(org_id, branch_id, till_code, created_at)`
- `payments`: `card_scheme`, `card_last4 varchar(4)`, `auth_code`, `terminal_id`, `till_code`, `momo_network`; two indexes
- `menu_items`: `brand`; index `(org_id, sku)` (not unique)

## Inside the transaction / outside
- Outside: replay lookup, one menu-item query (with servings) for all lines, in-memory pricing, audit write.
- Inside (`timeout 15000, maxWait 5000`, writes only): `pg_advisory_xact_lock(hashtext(branchId))`,
  next `ORD-` number, order + items, payment.

## Contradictions and which document won
- G1 `authCode` required vs `03` optional: `03` wins (optional).
- G1 cash needs open till session vs `03`: none required.
- G1 unique `(branch_id, sku)` vs `03`: plain index only.
- `03` says card/MOMO `captureMode MANUAL_REFERENCE`; prompt §c says `UNVERIFIED` verification. Both applied.
- Prompt §c line 73 says cash `NOT_REQUIRED`; `03` also sets cash `captureMode ONLINE_PROVIDER` (the schema default). Applied.

## Decisions with defaults (prompt §c)
1. `tenderedAmount` optional for cash, absent means exact.
2. Card or MOMO fields on a cash sale: 400.
3. A SKU matching more than one active branch item: 400, nothing written.
4. `soldAt` stored in metadata only; `createdAt` is the server's time.
Extra: `computeLinePricing` pulls recipe costs per line (3 queries). The quick sale needs
no per-line recipe cost to price, so I extract pure price selection and skip cost snapshots
(costUnit etc. stay null). Logged as a decision.

## Questions
None blocking.

## Baseline
H0: API unit tests 1,200 passed in 67 suites. Lint baseline per file is in `reports/proof/H0_api_lint_by_file.txt`
(`orders.service.ts` 6 errors / 4 warnings; `orders.service.spec.ts` 0/1; `tills.service.spec.ts` 0/5; `app.module.ts` 1/0; `tills.service.ts` not listed = 0).
