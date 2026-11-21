# A1 Backend audit - Nimbus POS (read-only), audited 2026-11-18
Repo: $HOME/mnt/Nimbus/POS (Mac). HEAD dbb5e25 (2026-08-22). Paths below are relative to repo root.

## 1. Stack and layout
- pnpm 8.15 + turbo monorepo, Node >=22 (package.json). Apps: apps/api (NestJS), apps/web (Next.js, Playwright e2e in apps/web/e2e), apps/desktop and apps/mobile (only package.json + src stubs). Packages: packages/db (Prisma, schema.prisma 7185 lines, 59 migration dirs), packages/shared.
- DB: PostgreSQL on Neon (schema.prisma:44-45; README.md:92). ids cuid, money Decimal(12,2).
- Auth: JWT (JwtAuthGuard + PermissionGuard + BranchContextGuard; X-Branch-Id header selects branch). Endpoints in apps/api/src/modules/auth/auth.controller.ts: login, pin-login, quick-pin-login (:105), refresh, logout, sessions, invitations/accept, forgot/reset password.
- Idempotency/offline wrapper: modules/bg3-reliability (Idempotency-Key on close etc.).
- Deploy: no Dockerfile or deploy config found in repo root listing. Only CI: .github/workflows/branch-validation.yml (lint + unit tests on push/PR). KNOWN_LIMITATIONS.md:374-382 says "only one API process on :3001; boot with nest build then node dist/main.js". Hosting of API in production: UNKNOWN from repo (memory/other docs not consulted for this). README mentions Redis + BullMQ box (README.md:63).
- Tests: ~1200 `it(` in apps/api/src specs (59 *.spec.ts files), ~1055 `it(` in apps/api/test (67 e2e-spec files). README claims ~700 unit / ~500 e2e (stale).
- Backend 54 feature modules (modules dir: orders, payments, menu, tenancy, tills, shifts, reports, dashboards, inventory, recipes, kds, receipts, events, refunds, discounts, device-registry, hms-integration, franchise, accounting, hr, payroll, etc).
- Doc claim: backend "100% complete through BG7" (ROADMAP.md:11-25, as of 2026-05-08); later work is frontend (Manager/Cashier/Supervisor/Waiter UIs) per docs/DECISIONS.md and docs/KNOWN_LIMITATIONS.md.

## 2. Tenancy model
Hierarchy in code: Organization -> Branch (+ Membership user x branch x role). No Merchant, Outlet or Station model. "Till" = TillSession.tillCode string within a branch+shift. KDS "station" is a plain string / PrepStation enum.
- Organization: packages/db/prisma/schema.prisma:428 (id, name, slug unique, legalName, taxId, status).
- Branch: schema.prisma:603 `organizationId, name, code, slug, timezone, currencyCode (default "USD"), address, phone, email, status`.
- Membership: schema.prisma:754 `userId, organizationId, branchId, roleId, status, isDefaultBranch; @@unique([userId, branchId])`. A user has one role per branch.
- Menu, Category, ModifierGroup, TaxCategory, Order, Payment all carry orgId + branchId (menu is per BRANCH, not per org).
- Answer: YES, one organiser org can hold two vendors as two Branches (Food, Drinks), each with its own menu/categories (MenuItem.branchId, schema.prisma:957) and own orders/payments. BUT: reports are single-branch (every report/dash function takes (orgId, branchId) from X-Branch-Id; reports.service.ts:183,275,350,400...). No org-wide combined sales report found. Closest: franchise module (modules/franchise*, GET /franchise/overview, consolidated-finance, drilldown) built for HQ rollups of finance/rankings, not payment-method/item sales. Combined report would need a new endpoint or two exports merged offline.
- Branch.currencyCode defaults "USD" - must be set to UGX per branch (D-CURRENCY locked UGX zero-fraction in DECISIONS.md:385; amounts still Decimal 2dp).

## 3. Menu/catalogue
- Category (schema.prisma:914): branchId, name, sortOrder, isActive. Unique (branchId,name).
- MenuItem (schema.prisma:957): categoryId, taxCategoryId?, browseGroupId?, browseSubgroupId?, name, sku?, description?, price, itemType enum {FOOD, DRINK} (:898), station PrepStation {KITCHEN,BAR,COLD_KITCHEN,NONE}, sortOrder, isActive, metadata Json?. Unique (categoryId,name).
- MenuItemServing (:1068): format enum {GLASS,BOTTLE,JUG,PINT,HALF_PINT,SHOT,SINGLE,DOUBLE,CARAFE,FLIGHT,CUP,CUSTOM}, label, price, volumeText, isDefault - so Shot/Bottle/Double of one whiskey is supported (OrderItem.menuItemServingId, :1365).
- MenuBrowseGroup/Subgroup (:~1000-1060): POS browse tiles, section FOOD/DRINKS (e.g. Whiskey > Gin under DRINKS).
- ModifierGroup/ModifierOption (:1095,:1120), MenuItemOnGroup (:1140).
- BRAND field: NO dedicated column. grep for "brand" in menu service/DTOs: none. Options: encode brand via Category or BrowseSubgroup (e.g. subgroup "Johnnie Walker"), or MenuItem.metadata Json (not indexed, not exposed by reports). Reports group by menuItemId only.
- Endpoints (modules/menu/menu.controller.ts): categories, tax-categories, items (POST/GET/PATCH), catalog, browse-groups, subgroups, servings, navigation, modifier-groups. One-at-a-time create.
- CSV/bulk menu import: NOT in API. Only packages/db/prisma/demo-import.ts + demo-data/ (seed pack tooling, run by CLI, `db:demo:import`). No multipart/csv upload in menu or inventory modules.

## 4. Order and payment model
Order (schema.prisma:1305): orgId, branchId, tableId?, userId (creator/cashier), orderNumber (unique per branch), status {NEW,SENT,IN_KITCHEN,READY,SERVED,VOIDED,CLOSED}, serviceType {DINE_IN,TAKEAWAY}, subtotal, tax, discount, total, anomalyFlags, notes, metadata Json, split/merge refs.
OrderItem (:1365): menuItemId, menuItemServingId?, quantity, price, subtotal, notes, metadata, costUnit/costTotal/marginTotal/marginPct.

```prisma
enum PaymentMethod { CASH CARD MOMO BANK_TRANSFER }               // :1538
enum PaymentStatus { PENDING COMPLETED FAILED REFUNDED }
enum PaymentCaptureMode { ONLINE_PROVIDER MANUAL_REFERENCE }
enum PaymentVerificationStatus { NOT_REQUIRED UNVERIFIED VERIFIED REJECTED }

model Payment {                                                    // :1577
  id, orgId, branchId, orderId
  amount Decimal(12,2)
  method PaymentMethod
  status PaymentStatus @default(PENDING)
  captureMode PaymentCaptureMode @default(ONLINE_PROVIDER)
  verificationStatus PaymentVerificationStatus @default(NOT_REQUIRED)
  transactionId String?
  externalTransactionId String?
  payerPhone String?
  postedAt DateTime @default(now())
  enteredById String?            // user, only set by manual-reference path
  verificationNote String?
  metadata Json?
  createdAt, updatedAt
  relations: organization, branch, order, enteredBy, refunds, reservationDeposits, eventBookings
  indexes: orgId, branchId, orderId, method, status, captureMode, verificationStatus, createdAt, transactionId, externalTransactionId
}
model PaymentIntent { id, orgId, branchId, orderId, provider String, amount, currency "UGX", status {PENDING,REQUIRES_ACTION,SUCCEEDED,FAILED,CANCELLED}, providerRef, customerPhone, externalId @unique, providerTransactionId, requested/confirmedAmount, requested/confirmedMsisdn, expiresAt, webhookEventIdLast, idempotencyKey, failureReason, metadata }  // :1619, MoMo only
```
There is no separate Tender model; Payment is the tender. Split payments: yes - one order can hold many Payment rows (CloseOrderDto.payments is an array, min 1; payments.service.ts:149-260), e.g. cash + card; overpayment only if CASH is included.
Card scheme / last4 / terminal ref / RRN / auth code / terminal id: NO dedicated fields anywhere (grep for last4, rrn, cardScheme, cardBrand, acquirer, pdq: no hits in schema or payments module). Only places to put them: Payment.transactionId (close path), Payment.externalTransactionId (manual-reference path, required there, max 200), Payment.metadata Json (free-form, accepted from client on close: close-order.dto.ts CloseOrderPaymentDto.metadata; manual-reference path stores only {provider, captureMode} and verificationNote). Scheme would have to be stored as free JSON, which no report reads.
Two ways to record a card payment:
 a) POST /pos/orders/:id/close (permission pos:orders:close) with payments[{method:CARD, amount, transactionId?, metadata?}]; order must be SERVED; creates captureMode ONLINE_PROVIDER, verification NOT_REQUIRED (payments.service.ts:234-241). CARD needs no provider check; MOMO here requires a SUCCEEDED PaymentIntent (:187-196).
 b) POST /payments/manual-reference (pos:payment:manual-reference): method MOMO|CARD|BANK_TRANSFER, externalTransactionId required, optional provider (<=50 chars), payerPhone, postedAt, note; order any non-VOIDED state; dedupes by (order, externalTransactionId); does NOT close order (payments.service.ts:775-830). Gives UNVERIFIED + enteredById + verification workflow. Best fit for "card terminal then record in POS", but you still must call close afterwards.
Integrations: only MTN/Airtel MoMo (modules/payments/adapters/mtn.adapter.ts; webhooks POST /webhooks/mtn, /webhooks/airtel; POST /payments/intents provider MTN|AIRTEL) - not verified live; KNOWN_LIMITATIONS "Cashier LIM-001/003: Mobile money & card = manual/reference only (no live provider)". No bank terminal / acquirer / Visa integration; "terminal/acquirer traffic" listed as deferred (KNOWN_LIMITATIONS.md:465-471). WKL-008 terminal pairing is a stub.
billing-pesapal (modules/billing-pesapal): SaaS subscription billing for Nimbus itself, NOT till payments. merchant-payments/merchant-payments.controller.ts:20-26 states explicitly "NOT a live PesaPal integration ... PesaPal reserved for SaaS billing"; its /merchant/payments/pesapal/* routes are legacy aliases. public-commerce-payments = public booking/commerce payments (MoMo pending). LIM-002 PesaPal excluded for diners.

## 5. Quick-sale (counter) flow
- Possible without tables/waiters: CreateOrderDto serviceType TAKEAWAY, tableId optional (create-order.dto.ts; orders.service.ts:154 TAKEAWAY must have no table). Waiter-only actors need an open shift (orders.service.ts:86-107); cashier path not checked there.
- BUT state machine is strict (orders.service.ts:43-50 VALID_TRANSITIONS): NEW->SENT->IN_KITCHEN->READY->SERVED->CLOSED, and close requires SERVED (payments.service.ts:34,162). No "quick sale / auto-serve" shortcut found (grep). So one sale = POST /pos/orders (1) + POST /pos/orders/:id/items per line, ONE item per call (add-order-item.dto.ts; N calls) + /send + /in-kitchen + /ready + /mark-served (4) + POST /pos/orders/:id/close (1) = 6 + N calls (7 for a single-line sale). For a drinks vendor with no KDS, someone/frontend must still step through SENT/IN_KITCHEN/READY. Manual-reference card path adds 1 more call. Reliability: close is wrapped by bg3 idempotency (optional key).
- Endpoints: orders.controller.ts: POST /pos/orders, :id/items (POST/PATCH/DELETE), :id/send, :id/in-kitchen, :id/ready, :id/mark-served, :id/request-bill, :id/void. KDS tickets created on send (modules/kds).
- Tills: POST /tills/open, /:id/safe-drop, /:id/reconcile, GET /tills/active, /:id, /:id/summary (tills.controller.ts); POST /shifts/open|close (shifts.controller.ts). TillSession.tillCode string identifies a till. Payments and orders are NOT linked to a till (no tillId on Payment or Order, schema.prisma:1577,1305); expected cash is computed from all CASH payments in the whole BRANCH in the till window (tills.service.ts:356-392). With 6-10 tills in one branch this makes per-till cash reconciliation wrong/overlapping.

## 6. Reports / analytics
Reports are POST (create a ReportRun) in modules/reports/reports.controller.ts with window/dateFrom/dateTo, all scoped to the active branch: shift-end, daily-sales, payment-mix (:94), top-items (:115), sales-by-category (:137), sales-by-hour (:158), open-closed-orders, discounts-summary, voids-summary, refunds-summary, cash-variance, cash-movements, stock-variance, wastage, low-stock, reservation*, event*, anomaly-summary, high-risk-actors, staff-operations. GET /reports/catalog, GET /reports, /:id, POST /reports/export (format CSV only; PDF returns 501, KNOWN_LIMITATIONS.md:19-23), GET /reports/exports/:id/download. Unified facade: /exports (exports.controller.ts). Dashboards (modules/dashboards): GET /dash/owner, manager, today-summary, payment-mix, open-orders, low-stock, snapshots; SSE /stream.
- By payment method: yes, groupBy Payment.method (reports.service.ts:350-383, dashboards payment-mix) - CASH/CARD/MOMO/BANK_TRANSFER only, per branch.
- By item: top-items groups OrderItem by menuItemId, qty + gross, status CLOSED|SERVED (reports.service.ts:395-440), default limit 20; no serving breakdown.
- By category: sales-by-category. By hour: sales-by-hour (orders groupBy). By cashier: staff-operations + high-risk-actors + shift-end; no sales-by-cashier-by-payment-method confirmed (UNKNOWN beyond Order.userId existing). By branch: only franchise endpoints (finance focus), not payment/item sales.
- MISSING for the concert: (1) card scheme split (no field); (2) items bought with Visa (needs Payment<->OrderItem join filtered on scheme; order-level only: with split payments item-to-payment attribution is undefined); (3) brand roll-up; (4) combined multi-branch (food+drinks) report; (5) sales by till (no tillId); (6) CSV of raw transactions line level (only report-run CSV artifacts); (7) payment-mix probably counts all COMPLETED incl. UNVERIFIED manual refs (not verified in this audit - check reports.service.ts:350-383 filter).

## 7. Roles and permissions
Seed roles (packages/db/prisma/seed.ts:44-105): Owner L5, Manager L4, Accountant L4, Supervisor L3, Cashier L2, Chef L2, Waiter L1, Bartender L2, Procurement L3, Stock Manager L3, Event Manager L3. JobRole enum (schema.prisma:60): OWNER MANAGER ACCOUNTANT PROCUREMENT STOCK_MANAGER SUPERVISOR CASHIER CHEF WAITER BARTENDER EVENT_MANAGER. Permissions via Role -> RolePermission (schema.prisma:299,332), ROLE_PERM_MATRIX in seed.ts:1719. Quick-PIN login for frontline staff (auth/quick-pin.service.ts).
Docs (docs/ROLE_CAPABILITY_MATRIX.md, 254 lines): Waiter/Cashier/Supervisor/Manager UI capability tables with state per row. Accounting: Owner+Accountant full, Manager read-only (15 strings, later PERMS-2 commit dbb5e25 "Manager full accounting access"), others none. Manager lost pos:hr:compensation:read. Manager excludes membership/role admin, receipt admin, owner/billing surfaces (matrix :239). Cashier limits (KNOWN_LIMITATIONS.md:256-270): LIM-006 paid-in/out/pickup deferred, LIM-007 safe-drop idempotency incomplete, LIM-008 split bill = allocation metadata only, LIM-011 partial cash tender blocked, LIM-012 manager-approval/post-close void = boundary cards only. Supervisor: reconstruction final closure 2026-07-31, shift-swap approve not exposed. ai/AI_STATUS.md, PROGRESS.md: not deep-read (large); PROGRESS.md and README.md modified in working tree.

## 8. Offline / sync
docs/SYNC_CONTRACT.md:3 "Status: LIVE" but it describes the SERVER side only: POST /api/sync/replay, GET /api/sync/jobs, conflicts (modules/reliability SyncService, IdempotencyService, ReplayDispatcherService) and says "service workers and offline clients written in future milestones MUST conform". README.md:19 says Next.js shell was the next phase. Offline order capture in a client: UNKNOWN (frontend agent's scope); no evidence of service-worker offline queue in API docs. Server replay types: see SYNC_CONTRACT.md "Replayable Types" (not enumerated here, GENERIC_REPLAY seen at :~40).

## 9. Stock / inventory
Selling does NOT decrement stock. orders.service.ts only reads recipe/inventory theoreticalUnitCost to snapshot COGS (orders.service.ts:375-407). inventory.service.ts:278-287 fifoDeduct comment: "will be reused by order-close deduction in M10+", but its only caller is stock adjustment (inventory.service.ts:226); grep found no deduct call in orders/payments. Recipes are optional (cost fields nullable on OrderItem). So inventory is optional and not auto-linked to sales; no stock-out blocking of sales. (Confirm by testing.)

## 10. Known limitations relevant to an event; working tree
- KNOWN_LIMITATIONS.md: card & MoMo manual/reference only (LIM-001/003); no live MTN/Airtel (deferred, :465-471); printers/receipt delivery are adapters pending (LIM-004/005, WKL-006/007: receipt printer = metadata only, no driver); no PDF export; split bill = metadata only (LIM-008); partial cash tender blocked (LIM-011); post-send item additions blocked (WKL-010, waiter); Neon cold-start / pool latency, Quick PIN warm ~3.8s, detail >5s (WKL-013, :374-382); only one API process; shared-Neon deploy of permission cutover and Track-C fixes "pending the cutover gate" (KNOWN_LIMITATIONS.md:10-60) - confirm production DB has the permission strings.
- DECISIONS.md: D-CURRENCY UGX zero-fraction (:385); D-BOUNDARY role boundaries (:391); Manager excludes compensation; do not re-litigate locked decisions without approval.
- Working tree: `git status --short` = 127 entries: apps/web 62, apps/api 50, plus packages/db 1, postman 1, docs 3, ai ~6, README.md, PROGRESS.md. README.md:3 restore note (2026-11-07): 5 local commits (tip 5a35a183) existed only in the iCloud original; this checkout is GitHub main dbb5e25 with files copied over, up to 98 evicted files at older version -> risk that the working tree is not the latest code. Needs verification before building the event system on it.

## 11. Gaps for the concert (facts)
1. No card scheme / last4 / RRN / auth / terminal id fields (schema.prisma:1577 Payment). Only free metadata Json.
2. No "items bought with Visa" or card-scheme report; reports.service.ts reports by method only.
3. No MenuItem brand column (schema.prisma:957); metadata Json only; reports group by menuItemId (reports.service.ts:418).
4. No org-wide combined report across branches for sales; reports take single branch (reports.service.ts:183+).
5. Payment not linked to till/terminal (schema.prisma:1577,1784); expected cash per branch (tills.service.ts:356-392) breaks 6-10 tills in one branch (unless one branch per vendor with distinct till reconcile windows).
6. No quick-sale endpoint; 6+N API calls and mandatory SENT/IN_KITCHEN/READY/SERVED steps (orders.service.ts:43-50; payments.service.ts:34). Items added one per call.
7. No bulk menu import API (no CSV in modules/menu); demo-import.ts is a CLI.
8. Card/MoMo are manual-only; MoMo via close needs a SUCCEEDED intent (payments.service.ts:187-196), so manual MoMo must use /payments/manual-reference then close; manual refs are UNVERIFIED unless someone verifies.
9. Stock not decremented on sale (inventory.service.ts:278-287, only adjustments) - no live stock for concert unless adjusted manually.
10. Receipt printing/delivery not wired (KNOWN_LIMITATIONS LIM-004/005).
11. Branch.currencyCode default USD (schema.prisma:603 region) - set UGX.
12. Deployment: no Dockerfile/infra in repo, only CI lint+unit; Neon cold-start latency noted; single API process; unclear prod host. Load for 6-10 tills untested (no load-test found).
13. Working tree uncommitted (127 files) and restore note on README.md:3 - code provenance risk.
14. Per-user sales: Order.userId exists (cashier), so cashier-level report is feasible via new query; staff-operations report exists but its payment-method split is UNKNOWN.
