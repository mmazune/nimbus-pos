# ROADMAP.md — Nimbus POS / ChefCloud POS Clean Rebuild

> **Purpose:** This is the rebuild roadmap for Nimbus POS.  
> It replaces ad-hoc feature work with a strict milestone system modeled after the HMS governance approach,
> but adapted to the real restaurant/bar/enterprise POS scope already present in Nimbus/ChefCloud.

This document is intentionally detailed. It must be sufficient to drive implementation milestone-by-milestone
without relying on chat memory.

## Core Rebuild Decision

We are rebuilding **from scratch**, but we are **not redesigning the product scope downward**.

That means:

- keep the same **enterprise POS vision**
- keep the same **backend-first discipline**
- keep the same **monorepo approach**
- keep the same **Neon + Prisma + NestJS + Postman** workflow
- keep all major domains documented, including those not implemented immediately
- defer only the highest-friction hardware paths until much later

## Explicitly Deferred Until Late Wave

The following are part of the product, but **must not be implemented in the early rebuild**:

1. **MSR / badge login**
2. **Smart spouts / pour telemetry**
3. deep hardware hardening beyond printer/payment-terminal stubs
4. advanced enterprise identity extras beyond core auth
5. aggressive offline sync beyond initial contracts

They remain in the roadmap as late milestones so they are not forgotten.

## Non-Negotiable Stack

| Layer           | Decision                                                          |
| --------------- | ----------------------------------------------------------------- |
| Runtime         | Node.js 22 + TypeScript strict mode                               |
| Monorepo        | pnpm workspaces + Turborepo                                       |
| Backend         | NestJS                                                            |
| ORM             | Prisma                                                            |
| Database        | Neon Postgres                                                     |
| Cache / Jobs    | Redis + BullMQ                                                    |
| Validation      | class-validator + class-transformer                               |
| Auth            | JWT access + refresh tokens first; passkeys later; MSR much later |
| Frontend        | Next.js Pages Router + React Query + Tailwind                     |
| API Testing     | Postman collections per milestone                                 |
| Automated Tests | Jest + Supertest                                                  |
| Docs            | Markdown + OpenAPI/Swagger                                        |
| IDs             | `cuid2` everywhere                                                |

## Mandatory Build Procedure

Every milestone follows this exact order:

1. **DB** — schema + migration + indexes
2. **Service** — business logic only
3. **Controller / endpoints**
4. **Tests** — unit + e2e minimum set
5. **Seed**
6. **Postman**
7. **Docs**
8. **AI status update + completion report**

## Global Architecture Rules

1. **Multi-tenancy first**  
   Most business tables must include `orgId`; branch-operational tables must also include `branchId`.

2. **Accounting-ready from early milestones**  
   We are not implementing full accounting first, but every operational document created from M4 onward must be
   capable of posting cleanly later. That means explicit totals, tax capture, source references, and immutable
   financial traces.

3. **Audit on all sensitive writes**  
   Security, money, stock, payroll, approvals, pricing, and configuration writes must create audit rows.

4. **Append-only ledgers where it matters**  
   Stock ledger, journal lines, and critical payment/webhook trails should prefer append-only patterns.

5. **No fat controllers**  
   Controllers validate and delegate. Services own state transitions.

6. **Idempotency for risky writes**  
   Payment, close, booking, stock, and sync-facing endpoints must be designed for idempotency even before the
   generic idempotency milestone is complete.

7. **Branch-aware but org-consistent**  
   Menu, pricing, tax, inventory, staffing, and reporting may vary by branch, but system contracts remain org-level.

## Milestone Index

| #       | Milestone                                                               | Complexity | Depends On |
| ------- | ----------------------------------------------------------------------- | ---------- | ---------- |
| **M0**  | Repo Bootstrap + Workspace Tooling                                      | Easy       | None       |
| **M1**  | Neon + Prisma Baseline + Seed Framework                                 | Easy       | M0         |
| **M2**  | Auth v1 (Email/Password/PIN) + JWT Sessions + RBAC                      | Easy       | M1         |
| **M3**  | Multi-Tenancy Core (Org, Branch, Membership, Platform Access)           | Easy       | M2         |
| **M4**  | Organization Settings + Numbering + Accounting Readiness Contracts      | Easy       | M3         |
| **M5**  | Floor Plans + Tables + Service Areas                                    | Easy       | M4         |
| **M6**  | Menu Catalog v1 (Categories, Items, Tax Categories, Availability)       | Medium     | M5         |
| **M7**  | Modifiers + Option Sets + Combo Rules                                   | Medium     | M6         |
| **M8**  | Recipe BOM + Yield + Costing Contracts                                  | Medium     | M7         |
| **M9**  | Inventory Master Data (Items, Units, Categories, Reorder Policies)      | Medium     | M8         |
| **M10** | FIFO Stock Batches + Ledger Core                                        | Medium     | M9         |
| **M11** | Suppliers + Purchase Orders                                             | Medium     | M10        |
| **M12** | Goods Receipts + Landed Cost + Batch Receiving                          | Medium     | M11        |
| **M13** | Stock Counts + Variance + Wastage + Adjustments                         | Medium     | M12        |
| **M14** | POS Orders Core (Draft -> Sent -> Served -> Closed)                     | Hard       | M13        |
| **M15** | KDS + Station Routing + SLA Timers                                      | Medium     | M14        |
| **M16** | Discounts + Manager Overrides + Void Rules                              | Medium     | M15        |
| **M17** | Shifts + Till Sessions + Cash Management                                | Medium     | M16        |
| **M18** | Payments v1 (Cash, Card Stub, Mobile Money Intents)                     | Hard       | M17        |
| **M19** | Refunds + Post-Close Voids + Receipt Reprints                           | Hard       | M18        |
| **M20** | Reservations + Deposits + Seating Bridge                                | Medium     | M19        |
| **M21** | Events + Booking Portal + Ticketing                                     | Hard       | M20        |
| **M22** | Anomaly Detection + Anti-Theft Signals                                  | Hard       | M21        |
| **M23** | Operational Dashboards + KPI Streams                                    | Medium     | M22        |
| **M24** | Reporting v1 + Exports (CSV/PDF)                                        | Hard       | M23        |
| **M25** | Customer Feedback + NPS + QR Follow-up                                  | Medium     | M24        |
| **M26** | Documents + Uploads + Attachments                                       | Medium     | M25        |
| **M27** | Employees + Contracts + HR Core                                         | Medium     | M26        |
| **M28** | Attendance + Leave + Shift Swaps                                        | Medium     | M27        |
| **M29** | Scheduling + Templates + Duty Roster                                    | Hard       | M28        |
| **M30** | Payroll Engine + Pay Runs + Payslips                                    | Complex    | M29        |
| **M31** | Staff Insights + Awards + Promotion Suggestions                         | Hard       | M30        |
| **M32** | Accounting Foundation (COA + Cost Centers + Fiscal Periods)             | Complex    | M31        |
| **M33** | General Ledger + Journal Entries + Posting Engine                       | Complex    | M32        |
| **M34** | Accounts Payable + Vendor Bills + Payments                              | Complex    | M33        |
| **M35** | Accounts Receivable + Invoicing + Direct Bill                           | Complex    | M34        |
| **M36** | Bank Reconciliation + Period Close + Locks                              | Complex    | M35        |
| **M37** | Budgets + Forecasts + Procurement Advisory                              | Hard       | M36        |
| **M38** | Franchise + Multi-Branch Suite                                          | Hard       | M37        |
| **M39** | Billing + Subscription Plans + Dev Portal                               | Hard       | M38        |
| **M40** | Alerts + Digests + Real-Time Owner Views                                | Medium     | M39        |
| **M41** | Reliability Layer (Idempotency + Offline Contracts + Sync)              | Complex    | M40        |
| **M42** | Feature Flags + Maintenance Windows + Training Mode                     | Medium     | M41        |
| **M43** | Frontend Shell + Role-Based Workspaces                                  | Hard       | M42        |
| **M44** | Frontend POS + KDS + Backoffice Vertical Screens                        | Complex    | M43        |
| **M45** | Passkeys + MFA + SSO/SCIM                                               | Hard       | M44        |
| **M46** | Deferred Hardware Wave (Badges/MSR + Smart Spouts + Peripheral Drivers) | Complex    | M45        |
| **M47** | Launch Hardening + E2E + Security + CI/CD                               | Complex    | M46        |

## Standard Deliverables For Every Milestone

- Prisma model changes committed
- Migration committed and applied
- DTO validation added with `class-validator`
- Permission guards applied
- Audit logging applied to all writes
- Idempotency applied where endpoint risk justifies it
- Seed updated and re-runnable
- Postman collection created or updated
- `pnpm lint` clean
- `pnpm test` clean
- `pnpm db:migrate` clean
- `pnpm db:seed` run twice successfully
- `ai/AI_STATUS.md` updated
- milestone completion report written

## Test Matrix Minimum For Every Milestone

- 1 happy-path e2e test
- 1 validation failure test
- 1 permission denial test
- 1 conflict/state-machine test where relevant
- 1 idempotency test for risky POST/PATCH flows where relevant

## Shared Seed Strategy

The rebuild seed must remain deterministic and idempotent.

### Core Seed Entities

- Organization: `Nimbus Hospitality Group`
- Primary branch: `Tapas Downtown`
- Optional secondary branches for later franchise milestones
- Demo users by role: Owner, Manager, Supervisor, Cashier, Waiter, Chef, Bartender, Stock Manager, Accountant
- Menu seeds sourced from current drinks / tapas menu references
- Inventory seeds sourced from the uploaded stock workbook structure
- Accounting seeds introduced only when the accounting milestones begin

## Accounting Readiness Contract

Before accounting is implemented for real, these source documents must already be stable and traceable:

| Source Document      | Must exist by | Later accounting effect                |
| -------------------- | ------------- | -------------------------------------- |
| POS close            | M18           | revenue, tax, cash / momo / card, COGS |
| Refund               | M19           | revenue reversal / cash outflow        |
| Reservation deposit  | M20           | liability / deferred revenue           |
| Goods receipt        | M12           | inventory / AP                         |
| Wastage              | M13           | wastage expense / inventory            |
| Payroll approved run | M30           | payroll expense / payroll payable      |
| Vendor bill          | M34           | AP recognition                         |
| AR invoice           | M35           | receivable recognition                 |

## Deferred Hardware Notice

The roadmap deliberately parks badge/MSR and smart spouts near the end.
This is not because they are unimportant. It is because they create integration and testing drag that can
slow down the clean rebuild of the software foundation.

# M0 — Repo Bootstrap + Workspace Tooling

### Outcome

Fresh monorepo with pnpm, Turbo, NestJS API, shared packages, lint/test/dev scripts, and docs scaffolding.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `none`

### Minimum API Surface

- `GET /api/health`

### Implementation Rules

- Use pnpm workspace layout from day one.
- No business logic in this milestone.
- All scripts must run from repo root.

### Seed Expectations

- No business seed; only placeholder health checks.

### Dependency Gate

- Must not start until **None** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M1 — Neon + Prisma Baseline + Seed Framework

### Outcome

Neon Postgres connection, Prisma client/migrations, deterministic idempotent seed runner, and DB-backed health endpoint.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `AppConfig`
- `SeedMeta`

### Minimum API Surface

- `GET /api/health`

### Implementation Rules

- Every future seed function must be idempotent.
- Environment validation must fail fast when DATABASE_URL is missing.

### Seed Expectations

- Create seed meta table and baseline app config row.

### Dependency Gate

- Must not start until **M0** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M2 — Auth v1 (Email/Password/PIN) + JWT Sessions + RBAC

### Outcome

Core auth without hardware dependency: register/login/refresh/logout/me, role system, permission guard, audit on auth writes.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `User`
- `Role`
- `Permission`
- `RolePermission`
- `RefreshToken`
- `Session`
- `AuditEvent`

### Minimum API Surface

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/pin-login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Implementation Rules

- JWT access + refresh tokens only.
- PIN is supported for POS flow; MSR is explicitly deferred.
- All protected routes must support permission-based gating, not role checks alone.

### Seed Expectations

- Owner, Manager, Supervisor, Cashier, Waiter, Chef, Accountant demo users and default roles/permissions.

### Dependency Gate

- Must not start until **M1** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M3 — Multi-Tenancy Core (Org, Branch, Membership, Platform Access)

### Outcome

Everything becomes org-scoped and branch-scoped with explicit membership, active branch context, and platform access matrix.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Organization`
- `Branch`
- `Membership`
- `PlatformPolicy`
- `UserBranchAccess`

### Minimum API Surface

- `GET /orgs/me`
- `GET /branches`
- `POST /branches`
- `POST /memberships`
- `PATCH /memberships/:id`

### Implementation Rules

- Every operational table after this milestone must include orgId and usually branchId.
- Cross-branch access must always be explicit and auditable.

### Seed Expectations

- Seed Tapas-style demo org with one main branch and optional second branch.

### Dependency Gate

- Must not start until **M2** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M4 — Organization Settings + Numbering + Accounting Readiness Contracts

### Outcome

Global settings, tax defaults, currency, number sequences, receipt rules, service-charge policy, and accounting posting contracts defined before transactional modules.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `OrgSettings`
- `BranchSettings`
- `NumberSequence`
- `TaxCategory`
- `PaymentMethodConfig`
- `PostingRule`
- `FiscalCalendar`

### Minimum API Surface

- `GET /settings/org`
- `PATCH /settings/org`
- `GET /settings/sequences`
- `POST /settings/sequences/:key/next`
- `GET /settings/payment-methods`

### Implementation Rules

- Do not implement full accounting yet.
- Define posting hooks now so POS, inventory, payroll, and reservations can post seamlessly later.
- Money fields must use Decimal strings end-to-end.

### Seed Expectations

- Default UGX currency, VAT tax category, service charge config, sequences for order/receipt/po/journal/invoice.

### Dependency Gate

- Must not start until **M3** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M5 — Floor Plans + Tables + Service Areas

### Outcome

Dining layout foundation with floors, sections, tables, capacities, and table states.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `FloorPlan`
- `ServiceArea`
- `DiningTable`
- `TableMergeRule`

### Minimum API Surface

- `GET /floor-plans`
- `POST /floor-plans`
- `GET /tables`
- `POST /tables`
- `PATCH /tables/:id/status`

### Implementation Rules

- Keep coordinates simple JSON in v1.
- Table state changes must be compatible with reservations and POS later.

### Seed Expectations

- Main Dining, Patio, and bar seating demo tables.

### Dependency Gate

- Must not start until **M4** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M6 — Menu Catalog v1 (Categories, Items, Tax Categories, Availability)

### Outcome

Core menu management with category hierarchy, item lifecycle, SKU/plu, base pricing, tax categories, and sellability flags.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `MenuCategory`
- `MenuItem`
- `MenuItemPrice`
- `MenuItemBranchOverride`

### Minimum API Surface

- `GET /menu/categories`
- `POST /menu/categories`
- `GET /menu/items`
- `POST /menu/items`
- `PATCH /menu/items/:id`

### Implementation Rules

- Never hard-delete sold items; use active/archive flags.
- Branch override pricing is allowed only after core item is present.

### Seed Expectations

- Starter categories derived from uploaded menu docs and demo flagship items.

### Dependency Gate

- Must not start until **M5** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M7 — Modifiers + Option Sets + Combo Rules

### Outcome

Modifier groups, min/max selection rules, price deltas, defaults, and combo scaffolding.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `ModifierGroup`
- `ModifierOption`
- `MenuItemModifierGroup`
- `ComboDefinition`
- `ComboSlot`

### Minimum API Surface

- `GET /menu/modifiers`
- `POST /menu/modifiers`
- `POST /menu/items/:id/modifier-groups`
- `PATCH /menu/modifiers/:id`

### Implementation Rules

- Selection limits must be enforced both in API and shared validation contracts.
- Modifier pricing must support positive and negative deltas.

### Seed Expectations

- Size, doneness, extras, mixers, sweetness/ice demo sets.

### Dependency Gate

- Must not start until **M6** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M8 — Recipe BOM + Yield + Costing Contracts

### Outcome

Recipe system with ingredient quantities, unit conversions, yields, prep-loss %, and theoretical cost computation per dish/drink.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Recipe`
- `RecipeLine`
- `RecipeVersion`
- `YieldProfile`
- `UnitConversion`

### Minimum API Surface

- `GET /recipes`
- `POST /recipes`
- `PATCH /recipes/:id`
- `GET /recipes/:id/cost-preview`

### Implementation Rules

- Recipes are versioned; existing sold orders keep old cost references.
- Micro-ingredients are supported via tiny decimal quantities.

### Seed Expectations

- Representative recipes mapped to menu items from drinks and tapas references.

### Dependency Gate

- Must not start until **M7** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M9 — Inventory Master Data (Items, Units, Categories, Reorder Policies)

### Outcome

Inventory catalog aligned with uploaded stock workbook: item master, units, categories, reorder levels, preferred supplier references.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `InventoryCategory`
- `InventoryItem`
- `InventoryUnit`
- `ParLevel`
- `ReorderPolicy`
- `InventoryLocation`

### Minimum API Surface

- `GET /inventory/items`
- `POST /inventory/items`
- `PATCH /inventory/items/:id`
- `GET /inventory/categories`

### Implementation Rules

- Separate menu items from stock items.
- Track stock reminder threshold and base cost basis from day one.

### Seed Expectations

- Initial items imported conceptually from ITEM MASTER workbook tabs, plus warehouse/bar/kitchen locations.

### Dependency Gate

- Must not start until **M8** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M10 — FIFO Stock Batches + Ledger Core

### Outcome

True stock batches, stock ledger, on-hand calculations, cost layers, and movement reasons.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `StockBatch`
- `StockLedgerEntry`
- `StockBalanceSnapshot`

### Minimum API Surface

- `GET /inventory/batches`
- `GET /inventory/ledger`
- `POST /inventory/opening-balance`

### Implementation Rules

- Batch depletion order is oldest received first unless manual override is explicitly allowed.
- Ledger is append-only; corrections happen via compensating entries.

### Seed Expectations

- Opening stock batches for priority inventory items.

### Dependency Gate

- Must not start until **M9** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M11 — Suppliers + Purchase Orders

### Outcome

Supplier master, contacts, payment terms, PO workflow, and approval thresholds.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Supplier`
- `SupplierContact`
- `PurchaseOrder`
- `PurchaseOrderLine`
- `PurchaseApproval`

### Minimum API Surface

- `GET /suppliers`
- `POST /suppliers`
- `GET /purchase-orders`
- `POST /purchase-orders`
- `PATCH /purchase-orders/:id/submit`
- `PATCH /purchase-orders/:id/approve`

### Implementation Rules

- PO workflow: DRAFT -> SUBMITTED -> APPROVED -> PARTIALLY_RECEIVED/RECEIVED/CANCELLED.
- Unit cost capture belongs on PO line and receipt line both.

### Seed Expectations

- Top demo suppliers for food, bar, packaging, and utilities.

### Dependency Gate

- Must not start until **M10** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M12 — Goods Receipts + Landed Cost + Batch Receiving

### Outcome

GRN flow that converts approved POs into stock batches, supports partial receipt, variances, and landed-cost allocation.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `GoodsReceipt`
- `GoodsReceiptLine`
- `LandedCostAllocation`

### Minimum API Surface

- `GET /goods-receipts`
- `POST /purchase-orders/:id/receive`
- `GET /goods-receipts/:id`

### Implementation Rules

- Receiving must create stock batches and ledger entries atomically.
- Over-receipt beyond tolerance requires approval.

### Seed Expectations

- One fully received and one partially received demo PO.

### Dependency Gate

- Must not start until **M11** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M13 — Stock Counts + Variance + Wastage + Adjustments

### Outcome

Cycle counts, shift-close counts, wastage reasons, shrinkage posting hooks, and manager overrides.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `StockCount`
- `StockCountLine`
- `WastageRecord`
- `StockAdjustment`
- `VarianceReview`

### Minimum API Surface

- `POST /inventory/counts`
- `PATCH /inventory/counts/:id/submit`
- `POST /inventory/wastage`
- `POST /inventory/adjustments`

### Implementation Rules

- All variance decisions must preserve before/after evidence.
- Negative stock is blocked by default except for controlled temporary override mode.

### Seed Expectations

- Demo wastage reasons, variance thresholds, and one closed stock count.

### Dependency Gate

- Must not start until **M12** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M14 — POS Orders Core (Draft -> Sent -> Served -> Closed)

### Outcome

Table and walk-in orders, order lines, notes, sent state, course/station routing metadata, and close readiness.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Order`
- `OrderLine`
- `OrderLineModifier`
- `OrderEvent`
- `OrderNumber`

### Minimum API Surface

- `GET /pos/orders`
- `POST /pos/orders`
- `PATCH /pos/orders/:id`
- `POST /pos/orders/:id/send`
- `POST /pos/orders/:id/close-request`

### Implementation Rules

- Order mutations must be idempotency-ready even if full infra lands later.
- State machine must block editing after close except via void/refund flows.

### Seed Expectations

- One open dine-in, one walk-in, one closed order.

### Dependency Gate

- Must not start until **M13** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M15 — KDS + Station Routing + SLA Timers

### Outcome

Kitchen/bar display tickets, station configs, routing rules, bump/ready flow, and basic SSE events.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `KdsStation`
- `KdsTicket`
- `KdsTicketLine`
- `KdsStationConfig`

### Minimum API Surface

- `GET /kds/tickets`
- `POST /kds/stations`
- `PATCH /kds/tickets/:id/start`
- `PATCH /kds/tickets/:id/ready`
- `GET /stream/kds`

### Implementation Rules

- Ticket generation happens when order is sent, not when it is drafted.
- Bar and kitchen must support separate routing paths.

### Seed Expectations

- Grill, fryer, salad, dessert, bar demo stations.

### Dependency Gate

- Must not start until **M14** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M16 — Discounts + Manager Overrides + Void Rules

### Outcome

Line/order discounts, reason codes, override approvals, pre-close voids, and anomaly signals.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `DiscountPolicy`
- `DiscountApplication`
- `VoidRecord`
- `ApprovalRequest`
- `ApprovalDecision`

### Minimum API Surface

- `POST /pos/orders/:id/discounts`
- `POST /pos/orders/:id/void-lines`
- `GET /approvals`
- `POST /approvals/:id/decide`

### Implementation Rules

- Post-kitchen or manager-threshold actions require override.
- Every void/discount must emit anti-theft/audit events.

### Seed Expectations

- Staff meal, promo %, manual amount, manager-only void reasons.

### Dependency Gate

- Must not start until **M15** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M17 — Shifts + Till Sessions + Cash Management

### Outcome

Open/close shifts, opening float, cash pickups, safe drops, till reconciliation, and shift-close report baseline.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Shift`
- `TillSession`
- `CashMovement`
- `ShiftCloseSummary`

### Minimum API Surface

- `POST /shifts/open`
- `POST /shifts/:id/close`
- `POST /tills/open`
- `POST /tills/:id/safe-drop`
- `POST /tills/:id/reconcile`

### Implementation Rules

- No cash payment acceptance without an active till session.
- Close requires cash reconciliation and may depend on stock count completion.

### Seed Expectations

- One open shift and one closed shift report.

### Dependency Gate

- Must not start until **M16** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M18 — Payments v1 (Cash, Card Stub, Mobile Money Intents)

### Outcome

Payment records, split payments, mobile money intent + webhook contract, and settlement-ready payment states.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Payment`
- `PaymentIntent`
- `WebhookEvent`
- `Receipt`

### Minimum API Surface

- `POST /payments/intents`
- `POST /payments/intents/:id/cancel`
- `POST /pos/orders/:id/close`
- `POST /webhooks/mtn`
- `POST /webhooks/airtel`

### Implementation Rules

- Order close must validate payment total equals payable amount within rounding tolerance.
- Webhooks must be signature-verified and idempotent.

### Seed Expectations

- Cash and MOMO demo payment method configs.

### Dependency Gate

- Must not start until **M17** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M19 — Refunds + Post-Close Voids + Receipt Reprints

### Outcome

Refund lifecycle, post-close void approval, reversal artifacts, and receipt reprint trail.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Refund`
- `RefundLine`
- `ReceiptPrintLog`

### Minimum API Surface

- `POST /refunds`
- `POST /pos/orders/:id/post-close-void`
- `GET /receipts/:id`
- `POST /receipts/:id/reprint`

### Implementation Rules

- Refunds after close create financial reversal hooks but not the GL itself yet.
- Approvals above threshold are mandatory.

### Seed Expectations

- Refund reasons and threshold config.

### Dependency Gate

- Must not start until **M18** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M20 — Reservations + Deposits + Seating Bridge

### Outcome

Table reservations with deposit tracking and conversion into seated orders.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Reservation`
- `ReservationDeposit`
- `ReservationEvent`

### Minimum API Surface

- `GET /reservations`
- `POST /reservations`
- `PATCH /reservations/:id/confirm`
- `PATCH /reservations/:id/seat`
- `PATCH /reservations/:id/cancel`

### Implementation Rules

- Reservation seating must attach table and optionally open POS order.
- Deposit handling must preserve a later accounting hook.

### Seed Expectations

- Future reservations, one confirmed deposit-backed booking, one no-show.

### Dependency Gate

- Must not start until **M19** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M21 — Events + Booking Portal + Ticketing

### Outcome

Premium events, event tables, ticket codes, check-in, and prepaid credit hooks.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Event`
- `EventTable`
- `EventBooking`
- `Ticket`
- `CheckInRecord`
- `PrepaidCredit`

### Minimum API Surface

- `GET /events`
- `POST /events`
- `POST /bookings`
- `PATCH /bookings/:id/confirm`
- `POST /events/checkin`
- `GET /events/bookings/:id/ticket`

### Implementation Rules

- Public booking endpoints require throttling and idempotent payment submission.
- Ticket code must not expose PII.

### Seed Expectations

- One flagship event and demo bookings.

### Dependency Gate

- Must not start until **M20** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M22 — Anomaly Detection + Anti-Theft Signals

### Outcome

Threshold rules and derived signals for void spikes, discount abuse, cash variance, shrinkage, and suspicious staff behavior.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `AnomalyRule`
- `AnomalyEvent`
- `RiskThreshold`
- `StaffRiskSnapshot`

### Minimum API Surface

- `GET /analytics/anomalies`
- `POST /analytics/anomaly-rules`
- `PATCH /analytics/anomalies/:id/acknowledge`
- `GET /analytics/risk-dashboard`

### Implementation Rules

- Signals are advisory first; no automated punishment flow.
- All anomaly calculations must explain their basis in metadata.

### Seed Expectations

- Starter thresholds for void rate, wastage, late close, and price overrides.

### Dependency Gate

- Must not start until **M21** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M23 — Operational Dashboards + KPI Streams

### Outcome

Owner/manager live dashboards, today/MTD sales, payment mix, open orders, low stock, and SSE-backed KPI streams.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `KpiSnapshot`
- `KpiSubscription`

### Minimum API Surface

- `GET /dash/owner`
- `GET /dash/manager`
- `GET /stream/metrics`
- `GET /dash/today-summary`

### Implementation Rules

- Use cached aggregates where possible.
- Do not introduce reporting-grade financial statements yet.

### Seed Expectations

- Warm cache script or sample snapshots.

### Dependency Gate

- Must not start until **M22** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M24 — Reporting v1 + Exports (CSV/PDF)

### Outcome

Shift-end, daily sales, payment mix, top items, stock variance, and export jobs.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `ReportRequest`
- `ReportArtifact`
- `ExportTemplate`

### Minimum API Surface

- `POST /reports/shift-end`
- `POST /reports/daily-sales`
- `POST /reports/export`
- `GET /reports/history/:id`

### Implementation Rules

- Expensive reports should run async through worker service.
- Artifacts need retention policy fields.

### Seed Expectations

- Saved report templates and digest schedules stub.

### Dependency Gate

- Must not start until **M23** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M25 — Customer Feedback + NPS + QR Follow-up

### Outcome

Feedback collection linked to orders/reservations/events, NPS rollups, and manager review views.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Feedback`
- `FeedbackTag`
- `NpsSummary`
- `FeedbackRequest`

### Minimum API Surface

- `POST /feedback/public`
- `GET /feedback`
- `GET /feedback/nps-summary`
- `PATCH /feedback/:id/tag`

### Implementation Rules

- Public endpoint must rate-limit and de-duplicate.
- Critical feedback must be ack-trackable.

### Seed Expectations

- Positive, neutral, and critical sample feedback linked to demo orders.

### Dependency Gate

- Must not start until **M24** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M26 — Documents + Uploads + Attachments

### Outcome

Document store for invoices, receipts, contracts, payslips, and linked records.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Document`
- `DocumentLink`
- `StorageProviderConfig`

### Minimum API Surface

- `POST /documents/upload`
- `GET /documents`
- `GET /documents/:id/download`
- `DELETE /documents/:id`

### Implementation Rules

- Soft-delete only.
- Checksum and metadata are stored for dedupe and audit.

### Seed Expectations

- Placeholder receipt and contract documents.

### Dependency Gate

- Must not start until **M25** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M27 — Employees + Contracts + HR Core

### Outcome

Employee profiles, contract types, positions, salary basis, and staffing metadata for later attendance/payroll modules.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Employee`
- `EmploymentContract`
- `Position`
- `CompensationProfile`

### Minimum API Surface

- `GET /hr/employees`
- `POST /hr/employees`
- `PATCH /hr/employees/:id`
- `GET /hr/contracts`

### Implementation Rules

- Support employees without system login for temporary staff.
- Separation between employee and auth user must remain explicit.

### Seed Expectations

- Permanent, temporary, and casual demo staff.

### Dependency Gate

- Must not start until **M26** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M28 — Attendance + Leave + Shift Swaps

### Outcome

Clock events, presence statuses, leave requests, attendance policy rules, and peer shift-swap flow.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `AttendanceRecord`
- `LeaveRequest`
- `ShiftSwapRequest`
- `AttendancePolicy`

### Minimum API Surface

- `POST /hr/attendance/clock`
- `GET /hr/attendance`
- `POST /hr/leave`
- `POST /hr/shift-swaps`
- `PATCH /hr/shift-swaps/:id/approve`

### Implementation Rules

- This milestone uses PIN/password auth only; MSR login remains deferred.
- Grace rules must be configurable per org.

### Seed Expectations

- Attendance policies, leave types, and example late/covered shifts.

### Dependency Gate

- Must not start until **M27** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M29 — Scheduling + Templates + Duty Roster

### Outcome

Shift templates, rosters, role coverage rules, and branch duty planning.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `ShiftTemplate`
- `Schedule`
- `ScheduleAssignment`
- `CoverageRule`

### Minimum API Surface

- `GET /workforce/templates`
- `POST /workforce/templates`
- `POST /workforce/schedules`
- `PATCH /workforce/schedules/:id/publish`

### Implementation Rules

- Publishing schedule versions must not mutate historical attendance data.
- Coverage gaps should be detectable immediately.

### Seed Expectations

- Weekday, weekend, brunch, and event-night schedule templates.

### Dependency Gate

- Must not start until **M28** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M30 — Payroll Engine + Pay Runs + Payslips

### Outcome

Payroll calculation from attendance/contracts/components with approval and payable hook generation.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `PayRun`
- `PaySlip`
- `PayComponent`
- `PayrollAdjustment`

### Minimum API Surface

- `POST /payroll/runs/build`
- `PATCH /payroll/runs/:id/approve`
- `PATCH /payroll/runs/:id/pay`
- `GET /payroll/payslips/:id`

### Implementation Rules

- Gross/net calculations must be reproducible from saved component snapshots.
- Do not post to GL yet; create posting-ready payloads only.

### Seed Expectations

- Earnings/deductions components and one draft pay run.

### Dependency Gate

- Must not start until **M29** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M31 — Staff Insights + Awards + Promotion Suggestions

### Outcome

Composite performance scoring across sales, reliability, attendance, wastage, and risk signals.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `StaffAward`
- `PromotionSuggestion`
- `StaffInsightSnapshot`

### Minimum API Surface

- `GET /staff/insights`
- `POST /staff/awards`
- `POST /staff/promotion-suggestions/generate`
- `PATCH /staff/promotion-suggestions/:id/decision`

### Implementation Rules

- Awards must exclude staff with critical unresolved risk flags.
- Weights must be configurable.

### Seed Expectations

- Award periods, categories, and seeded snapshots.

### Dependency Gate

- Must not start until **M30** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M32 — Accounting Foundation (COA + Cost Centers + Fiscal Periods)

### Outcome

Start real accounting after ops are stable: chart of accounts, departments/cost centers, fiscal periods, and lock policy.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Account`
- `CostCenter`
- `FiscalPeriod`
- `PostingSourceMap`
- `TaxLedgerConfig`

### Minimum API Surface

- `GET /accounting/accounts`
- `POST /accounting/accounts`
- `GET /accounting/periods`
- `PATCH /accounting/periods/:id/open`

### Implementation Rules

- COA must be seeded and partly system-locked.
- Posting source maps must align with contracts defined in M4.

### Seed Expectations

- System accounts for cash, bank, inventory, AP, AR, revenue, COGS, payroll, tax, discounts, deposits.

### Dependency Gate

- Must not start until **M31** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M33 — General Ledger + Journal Entries + Posting Engine

### Outcome

Balanced journals, posting service, reversals, and first-class automated operational postings.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `JournalEntry`
- `JournalLine`
- `PostingRun`
- `PostingError`

### Minimum API Surface

- `GET /accounting/journals`
- `POST /accounting/journals`
- `POST /accounting/journals/:id/reverse`
- `POST /accounting/posting/replay`

### Implementation Rules

- Every journal must balance and be source-traceable.
- Auto-post from POS close, refunds, goods receipt, wastage, payroll, and deposits.

### Seed Expectations

- Opening balances and sample posted transactions.

### Dependency Gate

- Must not start until **M32** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M34 — Accounts Payable + Vendor Bills + Payments

### Outcome

Vendor bill workflow and AP aging integrated with PO/GRN and service-provider expenses.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `VendorBill`
- `VendorBillLine`
- `VendorPayment`
- `CreditNote`

### Minimum API Surface

- `GET /accounting/ap/bills`
- `POST /accounting/ap/bills`
- `POST /accounting/ap/bills/:id/approve`
- `POST /accounting/ap/payments`

### Implementation Rules

- Bills can originate from GRN or manual services.
- AP payments must post to GL through posting engine.

### Seed Expectations

- One outstanding bill, one partial payment, one credit note.

### Dependency Gate

- Must not start until **M33** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M35 — Accounts Receivable + Invoicing + Direct Bill

### Outcome

Customer/house accounts, invoice generation, receipts, credit notes, and aging.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `CustomerAccount`
- `Invoice`
- `InvoiceLine`
- `ReceiptAllocation`
- `ArCreditNote`

### Minimum API Surface

- `GET /accounting/ar/accounts`
- `POST /accounting/ar/invoices`
- `POST /accounting/ar/receipts`
- `GET /accounting/ar/aging`

### Implementation Rules

- Allow corporate/event/customer billing.
- Payment application must support partial settlement.

### Seed Expectations

- Corporate customer and one direct-bill invoice.

### Dependency Gate

- Must not start until **M34** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M36 — Bank Reconciliation + Period Close + Locks

### Outcome

Bank statement import, matching, close workflow, retained earnings transfer, and lock controls.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `BankAccount`
- `BankStatement`
- `BankStatementLine`
- `BankReconciliation`
- `PeriodCloseRun`

### Minimum API Surface

- `POST /accounting/bank-statements/import`
- `POST /accounting/reconciliation/match`
- `PATCH /accounting/periods/:id/close`
- `PATCH /accounting/periods/:id/lock`

### Implementation Rules

- Closed periods can only be reopened by top-level authority with audit reason.
- Bank rec mismatches must remain visible until resolved.

### Seed Expectations

- One bank account and sample unmatched statement lines.

### Dependency Gate

- Must not start until **M35** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M37 — Budgets + Forecasts + Procurement Advisory

### Outcome

Operational and financial budgets, variance tracking, and stocking guidance for branches and franchise rollups.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Budget`
- `BudgetLine`
- `ForecastRun`
- `ProcurementSuggestion`

### Minimum API Surface

- `GET /finance/budgets`
- `POST /finance/budgets`
- `POST /finance/budgets/update-actuals`
- `GET /franchise/forecast`

### Implementation Rules

- Actuals should ultimately source from GL or approved ops tables, not ad-hoc calculations.
- Forecast outputs are advisory.

### Seed Expectations

- Monthly branch budget and forecast assumptions.

### Dependency Gate

- Must not start until **M36** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M38 — Franchise + Multi-Branch Suite

### Outcome

HQ dashboards, branch rankings, inter-branch visibility, central procurement, and multi-branch scorecards.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `FranchiseRanking`
- `BranchBudgetRollup`
- `InterBranchTransfer`
- `HqDigestSubscription`

### Minimum API Surface

- `GET /franchise/overview`
- `GET /franchise/rankings`
- `GET /franchise/budgets`
- `POST /franchise/transfers`

### Implementation Rules

- Cross-branch data must be read-only unless user has franchise/HQ authority.
- Branch comparison metrics must use normalized date windows.

### Seed Expectations

- Tapas/Cafesserie-style demo branch portfolio.

### Dependency Gate

- Must not start until **M37** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M39 — Billing + Subscription Plans + Dev Portal

### Outcome

Plan limits, restaurant lifecycle, dev admins, API keys, webhooks, support sessions, and usage logs.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Plan`
- `Subscription`
- `UsageMeter`
- `ApiKey`
- `WebhookEndpoint`
- `SupportSession`

### Minimum API Surface

- `GET /billing`
- `PATCH /billing/subscription`
- `POST /dev/api-keys`
- `POST /dev/webhooks`
- `GET /dev/usage`

### Implementation Rules

- Two super dev admins are system-protected.
- Plan enforcement must degrade safely with grace periods and audit.

### Seed Expectations

- Starter/growth/franchise plans and demo usage rows.

### Dependency Gate

- Must not start until **M38** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M40 — Alerts + Digests + Real-Time Owner Views

### Outcome

Email/SMS/Slack alert channels, scheduled digests, live owner streams, and escalation routing.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `AlertRule`
- `AlertChannel`
- `AlertDelivery`
- `DigestSchedule`

### Minimum API Surface

- `GET /alerts`
- `POST /alerts/rules`
- `POST /alerts/test`
- `GET /owner/live`

### Implementation Rules

- Notification delivery failures must be recorded for retries.
- Critical alerts may fan out to multiple channels.

### Seed Expectations

- Low-stock, cash variance, booking reminder, payment failure alerts.

### Dependency Gate

- Must not start until **M39** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M41 — Reliability Layer (Idempotency + Offline Contracts + Sync)

### Outcome

Generic idempotency storage, offline-safe write contracts, queue replay rules, and service worker/sync planning.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `IdempotencyKey`
- `SyncJob`
- `SyncConflict`

### Minimum API Surface

- `POST /sync/replay`
- `GET /sync/jobs`
- `POST /sync/jobs/:id/retry`

### Implementation Rules

- All financially sensitive endpoints must require or strongly support Idempotency-Key.
- Conflict resolution must prefer server truth with auditable diff.

### Seed Expectations

- No business seed; generate cleanup job config.

### Dependency Gate

- Must not start until **M40** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M42 — Feature Flags + Maintenance Windows + Training Mode

### Outcome

Operational control plane for staged rollout, demo safety, and training/sandbox modes.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `FeatureFlag`
- `MaintenanceWindow`
- `TrainingSession`
- `FlagAudit`

### Minimum API Surface

- `GET /flags`
- `POST /flags`
- `PATCH /flags/:key`
- `POST /training/start`

### Implementation Rules

- Training mode must never post to real accounting or inventory tables.
- Maintenance windows can optionally block writes.

### Seed Expectations

- Demo protect, training mode, beta feature flags.

### Dependency Gate

- Must not start until **M41** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M43 — Frontend Shell + Role-Based Workspaces

### Outcome

Unified web shell with role-filtered sidebar, dashboard landing pages, and shared UI patterns.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `none-runtime; frontend milestone`

### Minimum API Surface

- `Uses prior APIs only`

### Implementation Rules

- Do not invent endpoints in frontend milestones; backend must exist first.
- Respect platform access matrix and role visibility.

### Seed Expectations

- Demo route fixtures only.

### Dependency Gate

- Must not start until **M42** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M44 — Frontend POS + KDS + Backoffice Vertical Screens

### Outcome

Production UI for POS terminal, KDS wallboard, inventory, finance, HR, analytics, reservations, and documents.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `none-runtime; frontend milestone`

### Minimum API Surface

- `Uses /pos/* /kds/* /inventory/* /finance/* /reports/* and related APIs`

### Implementation Rules

- POS UX must be touch-first and offline-aware.
- Backoffice uses shared data tables and filters consistently.

### Seed Expectations

- Demo accounts and route fixtures for all roles.

### Dependency Gate

- Must not start until **M43** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M45 — Passkeys + MFA + SSO/SCIM

### Outcome

Passwordless auth, TOTP policy, and enterprise identity integrations.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Passkey`
- `TotpSecret`
- `SsoProvider`
- `ScimProvisioningLog`

### Minimum API Surface

- `POST /auth/passkeys/register`
- `POST /auth/passkeys/login`
- `POST /auth/totp/enable`
- `POST /auth/sso/callback`

### Implementation Rules

- Passkeys are the preferred modern path.
- This milestone does not reintroduce MSR; that remains later.

### Seed Expectations

- SSO config stubs only; no real provider secrets.

### Dependency Gate

- Must not start until **M44** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M46 — Deferred Hardware Wave (Badges/MSR + Smart Spouts + Peripheral Drivers)

### Outcome

Late-wave hardware integration only after core product is stable: badge lifecycle, MSR auth, device custody, bar spout calibration and pour telemetry, printers/payment terminals hardening.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `Badge`
- `BadgeAssignment`
- `BadgeCustodyLog`
- `Device`
- `SpoutDevice`
- `SpoutCalibration`
- `PourEvent`

### Minimum API Surface

- `POST /auth/msr-swipe`
- `POST /badges/assign`
- `POST /badges/:id/revoke`
- `POST /spouts/sessions`
- `POST /spouts/calibrations`
- `GET /devices`

### Implementation Rules

- This entire milestone is explicitly deferred.
- Do not start it until all software-only milestones are green in production-like environments.

### Seed Expectations

- Test-only badge and spout fixtures; never required for core dev loop.

### Dependency Gate

- Must not start until **M45** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# M47 — Launch Hardening + E2E + Security + CI/CD

### Outcome

Full regression suite, performance budgets, observability, backups, deployment scripts, and launch gates.

### Scope

Implement only the scope of this milestone. Do not pre-build the next one unless a schema hook or enum is
explicitly required for continuity.

### Required Models / Tables

- `ReleaseGate`
- `DiagSnapshot`
- `BackupRun`

### Minimum API Surface

- `GET /diag/health`
- `POST /diag/snapshot`
- `GET /release/gates`

### Implementation Rules

- Every prior milestone must have collection, tests, and docs before final launch sign-off.
- Load, backup, restore, and rollback procedures are mandatory.

### Seed Expectations

- Synthetic monitoring checks and smoke-test fixtures.

### Dependency Gate

- Must not start until **M46** is complete and verified.

### Mandatory Deliverables

- DB schema / migration
- NestJS module, service, controller, DTOs
- Permission coverage
- Audit coverage for writes
- Unit tests + e2e tests
- Postman collection
- AI status update
- milestone completion report

# Appendix A — Suggested Permission Families

Use permission strings instead of relying only on role levels.

- `auth:*`
- `org:*`
- `branch:*`
- `settings:*`
- `floor:*`
- `menu:*`
- `recipe:*`
- `inventory:*`
- `supplier:*`
- `procurement:*`
- `pos:*`
- `kds:*`
- `payment:*`
- `refund:*`
- `reservation:*`
- `event:*`
- `analytics:*`
- `report:*`
- `feedback:*`
- `document:*`
- `hr:*`
- `attendance:*`
- `schedule:*`
- `payroll:*`
- `accounting:*`
- `franchise:*`
- `billing:*`
- `alerts:*`
- `flags:*`
- `support:*`
- `device:*`
- `spout:*`

# Appendix B — Suggested Role Families

These are defaults, not a prison. Permission-based access still wins.

- OWNER
- GENERAL_MANAGER
- ASSISTANT_MANAGER
- ACCOUNTANT
- PROCUREMENT
- STOCK_MANAGER
- SUPERVISOR
- CASHIER
- WAITER
- BARTENDER
- CHEF
- HEAD_CHEF
- EVENT_MANAGER
- TICKET_MASTER
- HR_MANAGER
- DEV_ADMIN
- SUPPORT_ADMIN

# Appendix C — Repo Build Philosophy

- Prefer explicit service classes over utility sprawl.
- Prefer dedicated modules over giant catch-all modules.
- Prefer deterministic seeds over random fixtures.
- Prefer clear migrations over schema churn.
- Prefer ledger/event history over destructive mutation.
- Prefer platform guards and tenant guards in backend, not only frontend.

# Appendix D — Immediate “Do Not Forget” Items

These are easy to accidentally under-document. Do not skip them in implementation.

- receipt numbering
- order numbering per branch
- rounding policy
- tax category inheritance
- service charge flags
- split payment math
- offline conflict behavior
- stock negative-balance prevention
- wastage reason taxonomy
- discount / override reasons
- cash variance explanation capture
- reservation seating -> order linkage
- event deposit -> prepaid credit linkage
- payroll component snapshotting
- AP/AR partial allocations
- bank rec matching states
- retention rules for documents and exports
- audit + request-id correlation
- feature flag audit
- maintenance/training mode write blocking
- hardware fixture segregation from normal dev flow
