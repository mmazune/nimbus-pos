# Nimbus POS

**Nimbus POS** is a full-stack, enterprise-grade hospitality Point-of-Sale platform purpose-built for restaurants, bars, and multi-branch food & beverage operations. It is not a wrapper around a generic POS SDK — every domain has been designed from scratch with hospitality-specific business logic. The system covers the entire operating lifecycle of a modern F&B business in a single codebase: front-of-house order management, a live Kitchen Display System, table reservations, events & ticketing with QR check-in, FIFO inventory costing, recipe-driven true COGS calculation, multi-dimensional HR & payroll, a complete double-entry accounting suite, franchise HQ consolidation, SaaS subscription billing, real-time anomaly & anti-theft detection, and a reliability layer engineered for intermittent-connectivity edge environments.

The backend is **100% complete** through milestone **BG7** — 51 database migrations, 56 Postman collections with Newman validation, 61 milestone completion reports, ~700 unit tests, and ~500 end-to-end tests. The Next.js frontend shell is the next phase.

---

## Table of Contents

1. [What Makes Nimbus Different](#what-makes-nimbus-different)
2. [Architecture Overview](#architecture-overview)
3. [Tech Stack](#tech-stack)
4. [Workspace Layout](#workspace-layout)
5. [Feature Domains](#feature-domains)
6. [Cross-Cutting Infrastructure](#cross-cutting-infrastructure)
7. [API Surface Summary](#api-surface-summary)
8. [Seed Data & Demo Environment](#seed-data--demo-environment)
9. [Testing Strategy](#testing-strategy)
10. [Quick Start](#quick-start)
11. [Roadmap Status](#roadmap-status)
12. [Deferred / Upcoming](#deferred--upcoming)

---

## What Makes Nimbus Different

Most POS systems are cash-register software with a cloud sync layer bolted on. Nimbus was designed around four principles that make it genuinely different:

**1. True COGS from Recipes, Not Estimates**
Every menu item carries a full Bill-of-Materials recipe. When an order item is added to a ticket, the COGS is computed from the recipe at that moment — not approximated from a flat cost field. Each ingredient is resolved to its FIFO batch unit cost, its yield-adjusted quantity, and its modifier-linked variant cost. The result is a `componentSnapshot` per order item that captures `extendedCost`, `totalCogs`, `margin`, and `marginPct` at point-of-sale — immutable forever. Operators know their real food cost, not their budgeted guess.

**2. Accounting-Ready from Day One**
Every operational document — POS close, refund, goods receipt, wastage, reservation deposit, payroll — is designed to post to a double-entry General Ledger cleanly. Thirteen system-locked accounts (Cash, Bank, Inventory, Accounts Receivable, Accounts Payable, Equity, Revenue, COGS, Discounts, Output Tax, Deposit Liability, Payroll Payable, Input Tax Recoverable) are seeded automatically. Nine `PostingSourceMap` records pre-wire business events to their journal entries. The accounting engine is not a future add-on; it receives live data from the POS layer from day one.

**3. Reliability for the Real World**
Hospitality environments have intermittent connectivity, distracted staff, and high-frequency concurrent mutations. Nimbus has a dedicated reliability layer (BG3) that wraps every high-risk write surface with idempotency keys, maintenance window enforcement, and training-mode simulation. If a cashier double-taps "Pay", the second call returns the cached response — no duplicate payment intent. If the accountant is closing a fiscal period, billing writes return 423. If a manager puts a new cashier through a training session, every simulated operation returns a realistic response without touching production data.

**4. One System, Not a Collection of Integrations**
HR, payroll, inventory, accounting, reservations, and POS all share the same database, the same audit log, the same permission system, and the same tenant context. There is no middleware ETL between modules. A payroll pay run creates a posting-ready payload that feeds directly into the GL journal engine. A reservation deposit posts directly to the Deposit Liability account. A goods receipt lands in both inventory and accounts payable simultaneously. No sync jobs, no webhook bridges, no data silos between operational domains.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  Client surfaces  (deferred — M43+)                                 │
│  Next.js Backoffice · POS Desktop Shell · Mobile Companion          │
└─────────────────────────────────┬───────────────────────────────────┘
                                   │  HTTPS / REST
┌─────────────────────────────────▼───────────────────────────────────┐
│  NestJS API  (apps/api)                                             │
│                                                                     │
│  54 feature modules · JWT guard · Permission guard · Branch guard  │
│  class-validator DTOs · Audit logging · BG3 reliability facade     │
│  Prisma client · Decimal(10,2) money fields · cuid2 IDs            │
└──────────────┬──────────────────────────────────────┬──────────────┘
               │                                      │
┌──────────────▼──────────────┐         ┌─────────────▼──────────────┐
│  Neon Postgres               │         │  Redis + BullMQ            │
│  51 migrations               │         │  (jobs contracted;         │
│  Prisma ORM                  │         │   background workers       │
│  cuid2 PKs everywhere        │         │   deferred)                │
│  Append-only ledgers         │         └────────────────────────────┘
│  Immutable financial traces  │
└──────────────────────────────┘
```

**Global architecture rules enforced on every milestone:**
- Multi-tenancy: every business table carries `orgId`; branch-operational tables also carry `branchId`
- Audit logging on every sensitive write (money, stock, payroll, config) — append-only `AuditLog` table
- Append-only ledgers: `JournalLine`, `StockAdjustment`, `ReservationEvent` never mutate rows
- No fat controllers — controllers validate and delegate; services own all state transitions
- `class-validator` + `class-transformer` on every DTO; no raw `any` in the API layer
- Money: `Decimal(10,2)` (or `Decimal(14,2)` for large aggregates); serialized as strings
- IDs: `cuid2` strings everywhere — no auto-increment integers in business tables
- `@@unique` composite constraints on all business document numbers per org/branch

---

## Tech Stack

| Layer           | Decision                                       |
|-----------------|------------------------------------------------|
| Runtime         | Node.js 22 + TypeScript (strict mode)          |
| Monorepo        | pnpm workspaces + Turborepo                    |
| Backend         | NestJS                                         |
| ORM             | Prisma                                         |
| Database        | Neon Postgres (serverless)                     |
| Cache / Jobs    | Redis + BullMQ (contracted; workers deferred)  |
| Validation      | class-validator + class-transformer            |
| Auth            | JWT access + refresh tokens; PIN-first login   |
| Frontend        | Next.js Pages Router + React Query + Tailwind (M43+) |
| API Testing     | Postman / Newman (56 collections)              |
| Automated Tests | Jest + Supertest (~1,200+ tests)               |
| IDs             | cuid2                                          |
| Docs            | Markdown + OpenAPI/Swagger                     |

---

## Workspace Layout

```
nimbus-pos/
├── apps/
│   ├── api/                  # NestJS API — 54 feature modules
│   ├── web/                  # Next.js backoffice UI  (M43+)
│   ├── desktop/              # POS desktop shell      (deferred)
│   └── mobile/               # Mobile companion       (deferred)
├── packages/
│   ├── db/                   # Prisma schema, 51 migrations, seed, client
│   └── shared/               # Shared types, enums, DTOs
├── docs/                     # Architecture & convention docs
├── ai/                       # Milestone completion reports, AI governance
│   ├── AI_STATUS.md          # Live progress tracker
│   └── M*_COMPLETION_REPORT.md  # 61 detailed completion reports
└── postman/
    ├── collections/          # 56 Postman collections
    └── environments/         # Dev / staging environments
```

---

## Feature Domains

### 1. Authentication & PIN-First Access

Every frontline staff member — Cashier, Waiter, Chef, Bartender — logs in by PIN, not password. This is a first-class design decision, not an afterthought. The PIN tier (`QuickPinTier`) is bound to the role: `LOW_6` (6-digit) for operational roles, `HIGH_8` (8-digit) for elevated roles. Managers can reset staff PINs via a dedicated admin endpoint. Password-based login remains for backoffice roles.

**Session model:** JWT access token + refresh token pair. Sessions carry `SessionSource` (PASSWORD / PIN / API_KEY / SSO / WEBAUTHN) and `SessionPlatform` (WEB_BACKOFFICE / POS_DESKTOP / MOBILE_APP / KDS_SCREEN / DEV_PORTAL), so every audit event knows which surface it came from.

**11 roles:** OWNER, MANAGER, ACCOUNTANT, PROCUREMENT, STOCK_MANAGER, SUPERVISOR, CASHIER, CHEF, WAITER, BARTENDER, EVENT_MANAGER — each with a distinct permission matrix and ~200+ granular permissions seeded.

**Endpoints:** `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/refresh`, `GET /api/auth/me`, `POST /api/auth/pin/login`, `POST /api/auth/pin/reset`, invitation acceptance + full password lifecycle (BG1/BG1.1).

---

### 2. Multi-Tenancy: Org, Branch & Memberships

Every request is scoped to an `Organization` and an optional `Branch`. Memberships link users to organisations with a status lifecycle (ACTIVE / INACTIVE / SUSPENDED). A user can hold memberships in multiple organisations. The `X-Branch-Id` header gates branch-scoped endpoints; org-level endpoints work without it.

---

### 3. Organization Settings & Numbering

`OrgSettings` stores operational configuration that drives behaviour across multiple modules:

- `receiptFooter` — text printed at the bottom of every receipt
- `discountApprovalThreshold` — discounts above this amount require manager approval; this same value is reused as the refund auto-complete threshold, ensuring consistent approval logic across the POS
- `showCostToChef` — when `false`, all cost fields (`extendedCost`, `totalCogs`, `margin`, `marginPct`) are **stripped** from recipe cost responses at the service layer — not nulled, removed entirely, so a Chef console cannot infer costs from null patterns
- Document numbering configuration: prefix + zero-padding per document type
- Exchange rate management for multi-currency display

---

### 4. Floor Plans & Table Management

Multi-zone floor plans with named service areas. Each `Table` carries a `TableStatus` (AVAILABLE / OCCUPIED / RESERVED / BLOCKED). The floor plan is the source of truth for seating assignments in both the live POS order flow and the reservation seating bridge. Table conflict detection prevents double-booking across overlapping reservation windows.

---

### 5. Menu Catalog, Servings & Modifiers

**Menu structure:**
- `Category` → `MenuItem` — standard parent/child grouping
- `MenuItemServing` — a single item can have multiple serving variants (Small / Large / Jug) each with its own price and COGS link
- `MenuBrowseGroup` / `MenuBrowseSubgroup` / `MenuSection` — front-of-house display taxonomy separate from the kitchen category structure (e.g., "Happy Hour Drinks", "Chef's Specials")
- `TaxCategory` — tax rate at item level, not order level, supporting mixed-tax menus

**Modifier system:**
- `ModifierGroup` linked to menu items (e.g., "Cooking preference", "Add-ons")
- `ModifierOption` with price deltas and ingredient cost links — the cost of a modifier option (e.g., "Add bacon +Ksh 150") flows through to the COGS calculation
- Combo rule contracts for bundled offerings

**Availability toggling:** items can be enabled/disabled per branch without deletion.

---

### 6. Recipe BOM with True COGS Costing

This is one of Nimbus's most distinctive features. Every menu item carries a Bill-of-Materials recipe mapping it to inventory ingredients. When an order item is added to a ticket, the COGS snapshot is computed and frozen at that moment — not estimated later from a flat cost field.

**Recipe model fields per ingredient row:** `effectiveQty`, `unitOfMeasure`, `yieldFactor`, `wasteAllowancePct`, `unitCost` (from FIFO batch), `extendedCost`, `isCritical`, `isModifierLinked`.

**Cost breakdown endpoint** (`GET /api/inventory/recipes/:menuItemId/cost`) returns:
- Per-ingredient: `effectiveQty`, `extendedCost`
- Summary: `totalCogs`, `margin`, `marginPct`
- Modifier-linked costs (extra ingredients pulled by a modifier option)
- **Chef cost masking:** when `OrgSettings.showCostToChef = false`, the entire cost block is omitted for Chef-role sessions — not nulled, removed — so the API shape reveals nothing

**Recipe set is atomic:** `POST /api/inventory/recipes/:menuItemId` is a full replace inside a Prisma transaction. No partial patch — this prevents half-states where some ingredients are priced against an old recipe version.

**Endpoints (7):** create/get/update inventory items; set/get recipe; get cost breakdown.

---

### 7. Inventory: FIFO Stock Batches & Ledger

Inventory costing uses genuine FIFO, not weighted average or standard cost. Each receiving event creates a `StockBatch` with its own unit cost, received quantity, and remaining quantity. When stock is consumed, the oldest batches are depleted first. A restaurant that received chicken at Ksh 450/kg in January and Ksh 510/kg in March will correctly cost January chicken at 450 and March chicken at 510 — automatically.

**Ledger design:** `StockAdjustment` is append-only. Every movement — RECEIVING, DEDUCTION, WASTAGE, MANUAL, COUNT — creates a new ledger row. No row is ever mutated. This gives a complete, auditable history of every unit of stock.

**Reorder management:** each `InventoryItem` carries `reorderPoint`, `parLevel`, and `preferredSupplierId`. The procurement advisory engine (§35) reads these alongside GL actuals to generate purchase suggestions automatically.

**24 items seeded:** proteins, produce, dairy, bakery, beverages, bar, pizza base, pasta categories — all with realistic unit costs.

---

### 8. Suppliers, Purchase Orders & Goods Receipts

**Supplier management:** full profiles with contact, payment terms, and `CounterpartyType` (INVENTORY_SUPPLIER / UTILITY_PROVIDER / SERVICE_PROVIDER / ENTERTAINER / CONTRACTOR / FREELANCER / SUBSCRIPTION / LANDLORD / MISCELLANEOUS). The same AP supplier system handles a chicken supplier, a KPLC electricity bill, a freelance DJ booking, and a SaaS subscription — one unified payables workflow.

**Purchase orders:** DRAFT → APPROVED → SENT → PARTIALLY_RECEIVED → FULLY_RECEIVED.

**Goods receipts:** landed cost allocation; batch receiving creates `StockBatch` rows and posts to the stock ledger. A goods receipt simultaneously updates inventory and creates an Accounts Payable vendor bill — no manual AP entry required.

---

### 9. Stock Counts, Wastage & Adjustments

**Stock count sessions:** captures actual physical quantities, computes variance (expected − actual), assigns a cost using current FIFO batch cost, and records as an adjustment. Negative variances flag potential shrinkage and surface in the anomaly engine.

**Wastage logging:** explicit wastage events (spilled batch, expired stock, training waste) create `WASTAGE` adjustment rows wired to the `PostingSourceMap` (`WASTAGE_ADJUSTMENT`) for GL posting to a Wastage Expense account.

**Training mode integration:** `POST /api/inventory/adjustments` respects the M42 training mode flag — adjustments in a training session return realistic simulated responses without writing real inventory rows.

---

### 10. POS Orders: Full State Machine

The order lifecycle is enforced as a strict state machine:

```
NEW → SENT → IN_KITCHEN → READY → SERVED → CLOSED
           ↘ VOIDED (from any pre-served state)
```

Every transition is a dedicated endpoint. Skipping states returns 400. This prevents phantom orders — orders that appear closed but were never actually served or paid.

**Key order behaviours:**
- `ServiceType`: DINE_IN (requires table) or TAKEAWAY (table forbidden)
- `recalcOrderTotals()` runs on every item add/update/delete — totals are always live
- **COGS snapshot written per `OrderItem` at add time** from the recipe engine — see §6
- Pricing snapshot frozen on every `OrderItem`: unit price, tax rate, serving variant — immune to menu price changes during service
- Order number unique per branch: `@@unique([branchId, orderNumber])`
- Void from post-kitchen states requires a `reason`
- Full paginated list with filters: `status`, `serviceType`, `serverId`, `dateFrom`, `dateTo`, `tableId`

**Endpoints (12):** create, list, detail, add/update/remove items, send, in-kitchen, ready, mark-served, close, void.

---

### 11. Kitchen Display System (KDS)

KDS tickets are generated automatically when an order transitions to SENT. Tickets are routed to stations by `PrepStation` enum: KITCHEN, BAR, COLD_PREP, PASTRY, etc. — a burger ticket goes to the grill station and a cocktail ticket goes to the bar screen simultaneously.

**SLA timers:** each station has a configurable `KdsSlaConfig` (target minutes). Tickets exceeding SLA transition to `KdsUrgencyState.URGENT` and are flagged visually on the KDS screen. Kitchen managers get real-time visibility into late tickets without shouting across the kitchen.

**Ticket state machine:** PENDING → IN_PROGRESS → COMPLETE.

**KDS device registration** flows through the BG5 device registry (`POST /api/devices/kds/register`), linking a physical screen to a station and branch.

---

### 12. Discounts & Manager Override Workflow

**Discount types:** PERCENTAGE, FIXED, ITEM_LEVEL, ORDER_LEVEL.

**Approval workflow:** `OrgSettings.discountApprovalThreshold` defines the auto-approve limit. Discounts above it are created as `PENDING_APPROVAL` and route to the Unified Approvals Inbox (§41) for manager PIN approval. This prevents cashiers from giving arbitrary discounts without oversight.

**Audit trail:** every discount — approved or auto-approved — creates an `AuditLog` row with the approver's identity.

---

### 13. Shifts, Till Sessions & Cash Management

**Shifts:** `POST /api/shifts/open` / `POST /api/shifts/:id/close`. A shift cannot close with open till sessions.

**Till sessions:** each physical till has its own session. Cash movements (floats, drops, paid-outs) are recorded as `CashMovement` rows.

**Till reconciliation** (`POST /api/tills/:id/reconcile`): cashier counts physical cash. System computes expected cash (opening float + cash payments − paid-outs) and calculates `varianceAmount`. Variances feed the anomaly engine.

**Anomaly signals generated:**
- `CASH_VARIANCE` — absolute variance exceeds threshold
- `LATE_CLOSE` — shift duration exceeds configured hours

**BG3 reliability:** shifts/open, shifts/close, tills/open, tills/reconcile all wrapped with idempotency keys.

---

### 14. Payments: Cash, Card & Mobile Money

**Supported payment modes:**
- **Cash** — direct, reconciled against till session
- **Card** — STUB (no live card acquirer; terminal pairing via device registry is metadata only)
- **MTN Mobile Money** (M13.1) — native Request-to-Pay with webhook IPN; offline manual reference fallback for connectivity failures
- **Airtel Money** (M13.2) — contracted, not yet implemented
- **PesaPal v3** — live integration for owner SaaS subscription billing only (not for diner payments)

**Payment intent lifecycle:** PENDING → PROCESSING → COMPLETED / FAILED. Intents are idempotent on `idempotencyKey` — a network retry cannot create a second charge.

**BG3 reliability:** `POST /api/payments/intents` is category `BILLING_WRITES` — returns 423 during a maintenance window rather than silently failing.

---

### 15. Refunds & Post-Close Voids

**Refund workflow:**
- Any closed order can be refunded up to the full paid amount
- Below `OrgSettings.discountApprovalThreshold` → auto-completes
- Above threshold → created as `PENDING`, routed to approvals inbox
- Manager approval requires PIN re-entry
- Refund spike detection: many refunds by same cashier in a short window triggers `REFUND_SPIKE` anomaly

**Post-close void** (`POST /api/pos/orders/:id/post-close-void`):
- 15-minute window from order close timestamp
- Requires manager PIN
- Creates an audit log row — cannot be performed silently

---

### 16. Receipts Surface

Receipts are composited views, not stored blobs. `GET /api/receipts/:id` assembles from live order, items, payments, table, server identity, branch/org name, and `OrgSettings.receiptFooter` on every call — a footer change immediately reflects on re-viewed receipts.

**Endpoints (4):**
- `GET /receipts/:id` — full receipt with totals (`subtotal`, `tax`, `discount`, `total`, `paid`, `outstanding`, `currencyCode`)
- `GET /receipts/:id/history` — paginated audit trail merging receipt-side events with the order lifecycle
- `POST /receipts/:id/reprint` — BG3-wrapped, idempotent, `reason?`, `copies?` (1–10), audits `RECEIPT_REPRINTED`
- `POST /receipts/:id/send` — 202 PENDING only (no live email/SMS/WhatsApp adapter yet)

Receipt ID equals the order ID — no separate receipt record, no schema change.

---

### 17. Order Handoff: Split, Merge & Transfer

Real restaurants split bills, merge tables, and hand off to a different server mid-service. All six handoff operations are first-class endpoints:

| Endpoint | Operation |
|---|---|
| `POST /pos/orders/:id/split-bill` | Split into N equal-share child orders |
| `POST /pos/orders/:id/split-items` | Move specific items into a new child order |
| `POST /pos/orders/:id/merge` | Merge two orders into one |
| `POST /pos/orders/:id/transfer-table` | Reassign to a different table |
| `POST /pos/orders/:id/transfer-server` | Reassign to a different server |
| `POST /pos/orders/:id/move-items` | Move specific items between any two orders |

**KDS strategy on split/merge:** source tickets are marked as superseded; destination requires explicit `/send` to re-fire kitchen tickets — no ghost tickets.

`Order.splitFromOrderId` / `Order.mergedIntoOrderId` self-FKs preserve split/merge lineage in the database.

---

### 18. Reservations, Deposits & Seating Bridge

**Reservation lifecycle:** PENDING → CONFIRMED → SEATED → COMPLETED / CANCELLED / NO_SHOW

**Reservation sources:** WALK_IN, PHONE, WHATSAPP, INSTAGRAM, MANUAL, OTHER — channel attribution on every cover for marketing analysis.

**Deposit management:** RECEIVED → REFUNDED or FORFEITED. Forfeit on no-show is a deliberate state, not a deletion. Deposits are wired to `PostingSourceMap` (`DEPOSIT_COLLECTED`) for GL posting to a Deposit Liability account.

**Seating bridge:** `PATCH /api/reservations/:id/seat` with `{ createOrder: true }` creates a DINE_IN order, assigns it to the confirmed table, and links it via `seatedOrderId`. Reservation is instantly live in the POS flow — no manual order creation required.

**Table conflict detection:** overlap check by `reservationAt ± expectedDurationMinutes` (default 120 min). 409 if the table is already booked.

**Reservation number format:** `RES-XXXXXX` per branch.

**Endpoints (12):** create, list, upcoming, detail, confirm, seat, cancel, no-show, assign-table, deposit CRUD, events log.

---

### 19. Events, Booking Portal & Ticketing

Full event management with public booking and QR check-in — no external ticketing platform dependency.

**Event lifecycle:** DRAFT → PUBLISHED → OPEN → CLOSED → COMPLETED / CANCELLED

**Ticket classes:** GENERAL, VIP, EARLY_BIRD, GROUP, COMPLIMENTARY — each with own `capacity`, `price`, `soldCount`. Over-selling rejected at the database level.

**Public booking portal:** `PATCH /events/:id/publish` generates a unique 32-byte hex `portalKey`. `GET /api/public/events/portal/:portalKey` is unauthenticated — no login required for the public booking flow.

**QR check-in:** each ticket issued gets a unique 16-byte hex QR token. `POST /api/events/tickets/:ticketId/check-in` returns ADMITTED / DUPLICATE (409) / DENIED (409), and auto-transitions the booking to CHECKED_IN when all tickets on the booking are scanned.

**Booking window enforcement:** `bookingOpensAt` / `bookingClosesAt` gates reject out-of-window bookings.

**Number formats:** EVT-XXXXXX, BKG-XXXXXX, TKT-XXXXXX

**Endpoints (16):** event CRUD, publish/close, ticket classes, booking create/list/detail/cancel, ticket issuance, check-in.

---

### 20. Anomaly Detection & Anti-Theft Signals

A built-in behavioural analytics engine watches for patterns associated with theft, fraud, or operational breakdown — without a separate BI platform.

**Five implemented signal types:**

| Signal | Logic |
|---|---|
| VOID_SPIKE | Voided orders by `userId` within window; flags when count ≥ threshold — cashiers who void excessively may be covering up theft |
| DISCOUNT_ABUSE | Discounts by `createdById` within window; high-volume self-approved discounts |
| CASH_VARIANCE | `TillSession.variance` on reconcile; flags `abs(variance) ≥ threshold` |
| LATE_CLOSE | Shift open duration exceeds configured hours — a shift left open overnight is a control failure |
| REFUND_SPIKE | Refunds by cashier within window; high refund rates are a known shrinkage vector |

**Advisory-first:** signals create `AnomalyEvent` rows surfaced in the risk dashboard. No automated discipline — the system advises; a manager decides.

**Staff risk snapshots:** per-user `StaffRiskSnapshot` aggregates anomaly counts across signal types into a single risk score.

**6 seeded risk thresholds:** void_rate_pct, discount_limit_per_hour, cash_variance_limit, late_close_hours, refund_spike_per_hour, price_override_enabled.

**Endpoints (13):** anomaly rules CRUD, anomaly list/detail, acknowledge/resolve, risk dashboard, staff risk by user, threshold management, manual recalculate.

---

### 21. Operational KPI Dashboards

`KpiSnapshot` records per branch per metric window (DAILY / WEEKLY / MONTHLY). `KpiSubscription` allows managers to subscribe to specific KPI feeds. `GET /api/dashboards/today-summary` returns a live aggregation: orders opened, orders closed, gross revenue, voids, covers served, and average spend — scoped to the requesting user's branch.

---

### 22. Reporting & Exports

**Report types:** sales summary, item performance, payment method breakdown, staff performance, inventory movement, wastage, payroll summary, and more.

**Report run lifecycle:** PENDING → RUNNING → COMPLETE / FAILED with progress tracking.

**Export artifacts:** CSV, PDF, XLSX, JSON. Each `ExportArtifact` carries MIME type, file size, SHA-256 checksum, and `retentionExpiresAt` for storage lifecycle management.

**Unified download centre** (BG6): `GET /api/exports` provides a normalised paginated list across both report exports and uploaded documents — a single endpoint for a complete download history.

---

### 23. Customer Feedback & NPS

**QR follow-up:** after a meal, `FeedbackRequest` generates a QR code link. Guests scan and submit — no app download required.

**NPS aggregation:** `NpsSummary` records aggregate promoter/passive/detractor scores by branch and period.

**Sentiment tagging:** POSITIVE / NEUTRAL / NEGATIVE with category tags (food quality, service speed, ambience, value).

**Feedback sources:** DINE_IN / TAKEAWAY / DELIVERY / EVENT / RESERVATION / WALK_IN.

---

### 24. Documents & File Uploads

**SHA-256 deduplication:** before storing, service computes SHA-256 and checks for an existing `Document` with the same hash per org. Duplicate upload returns the existing document — no wasted storage.

**20 MB upload limit** via `FileInterceptor` multipart.

**Pluggable storage providers:** `StorageProviderConfig` supports LOCAL (v1) with S3 and GCS ready via the provider enum.

**Document linking:** many-to-many `DocumentLink` between documents and any business record (order, reservation, event, export, vendor bill, employee contract, etc.).

**Soft delete:** status-flagged with `deletedAt` / `deletedById` — never hard-deleted.

**Audit events:** DOCUMENT_UPLOADED, DOCUMENT_DOWNLOADED, DOCUMENT_LINKED, DOCUMENT_DELETED, DOCUMENT_RESTORED, DOCUMENT_DEDUPE_HIT.

**Endpoints (10):** upload, list, detail, stream download, delete, link/unlink, metadata update, storage config.

---

### 25. HR: Employees, Contracts & Positions

**Employee profiles:** full HR record with `employeeCode` (unique per org), `dateOfBirth`, `nationalId`, `taxPin`, `nhifNumber`, `nssfNumber`, `emergencyContact`, `bankDetails` — every field needed for Kenyan statutory compliance.

**Employment contracts:** `contractNumber` (auto-generated CTR-XXXXX), `startDate`, `endDate`, `employmentType` (FULL_TIME / PART_TIME / CONTRACT / CASUAL / INTERN), `probationEndDate`, `contractStatus`.

**Compensation profiles:** reusable `CompensationProfile` records define a pay structure that can be assigned to multiple employees.

**8 positions seeded:** Barista, Cashier, Bartender, Chef de Partie, Sous Chef, Floor Supervisor, Stock Manager, Event Coordinator.

**Endpoints (10):** employee CRUD, contract create/list, position CRUD, compensation profile CRUD.

---

### 26. Attendance, Leave & Shift Swaps

**Clock-in / clock-out:** `AttendanceRecord` rows with `clockInAt`, `clockOutAt`, `branchId`, `workDate`. Attendance policy defines grace period and overtime threshold.

**Leave requests:** ANNUAL_LEAVE, SICK_LEAVE, MATERNITY_LEAVE, PATERNITY_LEAVE, COMPASSIONATE_LEAVE, UNPAID_LEAVE. Routes to the Unified Approvals Inbox for manager decision.

**Shift swaps:** request a swap with another employee; supervisor reviews via the approvals inbox.

---

### 27. Scheduling & Duty Roster

**Shift templates:** reusable templates with start/end times, required roles, minimum cover counts per role.

**Schedule generation:** weekly `Schedule` assembled from templates, assigned to employees via `ScheduleAssignment`. The engine checks `CoverageRule` violations (e.g., "at least one CHEF on every dinner shift").

**Coverage severity:** CRITICAL / HIGH / MEDIUM / LOW. CRITICAL violations surface prominently in the dashboard.

---

### 28. Payroll Engine: Pay Runs & Payslips

The payroll engine is one of the most carefully designed modules in Nimbus. Every payslip is a snapshot — it cannot drift after approval.

**Pay components:** reusable `PayComponent` definitions (Basic Salary, Housing Allowance, Transport Allowance, NSSF, PAYE, Loan Recovery) uniquely coded per org. Each is EARNING or DEDUCTION.

**Pay run lifecycle:** DRAFT → APPROVED → PAID (no skipping). Paying before approval returns 400. Overlap detection prevents two active runs covering the same period.

**Immutable component snapshot:** at `PATCH /payroll/runs/:id/approve`, each `PaySlip.componentSnapshot` (JSON) freezes the exact computation: `basePay + earningComponents + deductionComponents + adjustments + grossPay + totalDeductions + netPay`. Write-once. Historical payslips always reproduce the same figures even if component definitions change later.

**Posting-ready payload:** stored on `PayRun` at the PAID stage for direct GL integration via `PostingSourceMap` (`PAYROLL_EXPENSE`).

**6 seeded components:** Basic Salary, Housing Allowance, Transport Allowance, NSSF, PAYE, Loan Recovery.

**Endpoints (13):** component CRUD, adjustment CRUD, run build/approve/pay, run list/detail, payslip list/detail.

---

### 29. Staff Insights, Awards & Promotion Suggestions

**Performance snapshots:** `StaffInsightSnapshot` computes a score per employee based on attendance rate, shift coverage, anomaly count, and peer feedback.

**Awards:** managers issue `StaffAward` records (EMPLOYEE_OF_MONTH, BEST_ATTENDANCE, MOST_IMPROVED, etc.) linked to specific periods.

**Promotion suggestions:** data-driven from performance snapshots; manager reviews (PENDING → REVIEWED). The system suggests; the human decides.

---

### 30. Accounting Foundation: COA, Cost Centres & Fiscal Periods

Nimbus's accounting is a full double-entry system, not a reporting layer on top of the POS.

**13 system-locked accounts** (seeded automatically, `allowManualPosting: false`):

| Account | Type | Purpose |
|---|---|---|
| Cash on Hand | ASSET | Cash payments in till |
| Bank Account | ASSET | Bank transfers |
| Inventory Asset | ASSET | Stock value |
| Accounts Receivable | ASSET | Unpaid direct-bill invoices |
| Accounts Payable | LIABILITY | Unpaid vendor bills |
| Owner Equity | EQUITY | Capital accounts |
| Sales Revenue | REVENUE | POS order revenue |
| Cost of Goods Sold | EXPENSE | Recipe-derived food cost |
| Discounts & Promotions | EXPENSE | Approved discount amounts |
| Output Tax Payable | LIABILITY | Collected VAT/sales tax |
| Deposit Liability | LIABILITY | Event/reservation deposits |
| Payroll Payable | LIABILITY | Accrued wages before payment |
| Input Tax Recoverable | ASSET | Recoverable purchase tax |

**9 PostingSourceMaps** pre-wired: `ORDER_REVENUE`, `PAYMENT_RECEIVED`, `REFUND_ISSUED`, `GOODS_RECEIPT`, `WASTAGE_ADJUSTMENT`, `PAYROLL_EXPENSE`, `DEPOSIT_COLLECTED`, `VENDOR_BILL_PAYABLE`, `AR_INVOICE_RECEIVABLE`

**Fiscal period lifecycle:** DRAFT → OPEN (close and lock controlled by bank reconciliation module).

**Endpoints (11):** account CRUD, cost centre CRUD, period lifecycle, posting source map management, tax ledger config.

---

### 31. General Ledger & Posting Engine

**Double-entry enforcement:** every `JournalEntry` must have balanced debits and credits. An unbalanced journal is rejected with 400 before it touches the database.

**Journal replay engine:** `POST /api/accounting/posting/replay` re-processes all `PostingSourceMap` events not yet journalled. Each `PostingRun` uses a deterministic hash of `orgId + sourceKey + sourceDocumentId` as its `runKey` — making replay fully idempotent. Re-running after a failure creates no duplicate journals.

**Full reversal:** `POST /api/accounting/journals/:id/reverse` creates a mirror journal. Idempotent; blocks double-reversal with 409.

**Error tracking:** `PostingError` rows capture replay failures with a resolution lifecycle (PENDING → RESOLVED / IGNORED).

**Endpoints (8):** journal create/list/detail, journal reverse, posting replay, posting run list, error list/detail.

---

### 32. Accounts Payable: Vendor Bills & Payments

AP in Nimbus covers any outgoing obligation, not just inventory suppliers.

**CounterpartyType (9 values):** INVENTORY_SUPPLIER, UTILITY_PROVIDER, SERVICE_PROVIDER, ENTERTAINER, CONTRACTOR, FREELANCER, SUBSCRIPTION, LANDLORD, MISCELLANEOUS. A single workflow manages chicken suppliers, KPLC electricity, DJ bookings, SaaS subscriptions, and rent.

**Vendor bill sources:** PO-backed, MANUAL, RECURRING, ONE_OFF_EVENT, UTILITY, SUBSCRIPTION.

**Recurring bill profiles:** `RecurringBillProfile` defines cadence (WEEKLY / MONTHLY / QUARTERLY / YEARLY). `POST /api/accounting/ap/recurring-profiles/:id/generate-bill` creates the next bill with duplicate-prevention via `lastGeneratedBillId`.

**Payable reminders:** auto-generated from `dueDateLeadDays`. Surface in the owner's live view. Auto-resolve when bill is paid.

**AP aging summary:** counterparty-grouped aging buckets — standard AP control report.

**Service period tracking:** `servicePeriodStart` / `servicePeriodEnd` supports accrual-basis accounting for subscription and utility bills.

**BG2 unified approvals:** high-value vendor bills route to the approvals inbox.

**Endpoints (18):** supplier CRUD, bill lifecycle, AP payments, credit notes, aging, recurring profiles, reminders, supplier detail with roll-up summary.

---

### 33. Accounts Receivable: Invoicing & AR Aging

**Customer account types:** CORPORATE, HOUSE, INDIVIDUAL. Corporate and house accounts support direct-bill invoicing.

**Invoice sources:** DIRECT_BILL, EVENT, RESERVATION, CORPORATE, MANUAL.

**Partial settlement:** `POST /api/accounting/ar/receipts` supports partial payments. `Invoice.outstandingBalance` decremented on each receipt; status auto-transitions ISSUED → PARTIALLY_PAID → PAID.

**5-bucket AR aging** (`GET /api/accounting/ar/aging`): current, 1–30, 31–60, 61–90, 90+ days — with per-account and grand totals.

**GL posting on receipt:** Dr Cash, Cr Accounts Receivable — with graceful fallback if GL account IDs are not yet configured.

**Endpoints (10):** customer account CRUD, invoice create/list/detail, AR receipt, aging, credit notes.

---

### 34. Bank Reconciliation & Period Close

**Manual-first reconciliation:** bank statement lines are matched to GL transactions by accountant review. This avoids probabilistic auto-matching errors common in noisy, mixed-currency hospitality environments.

**Manual bank entries:** `ManualBankEntry` captures bank charges, interest, and corrections that exist on the bank statement but have no GL transaction yet.

**Live difference computation:** `difference = statementBalance − matchedTotal` computed on every call — no stale cached balance.

**Period close stores:** `incomeTotal`, `expenseTotal`, `retainedEarningsAmount` on `PeriodCloseRun`.

**Fiscal period lock:** `PATCH /api/accounting/periods/:id/lock` prevents further journal postings against the period.

**Endpoints (15):** bank account CRUD, statement import, reconciliation lifecycle (open/match/skip/complete), manual bank entries, period close/lock.

---

### 35. Budgets, Forecasts & Procurement Advisory

**Budget versioning:** `@@unique([orgId, branchId, fiscalPeriodId, budgetType, version])` supports multiple versions per period (initial vs. revised) without overwriting history.

**Budget actuals sync:** `POST /api/finance/budgets/:id/update-actuals` pulls real GL amounts from `JournalLine`, populates `budgetLine.actualAmount` and `budgetLine.variancePct` automatically.

**Forecast engine:** computes a daily run-rate from the last 90 days of GL history and projects 30 days forward per branch. Results are cached; pass `refresh=true` to recompute.

**Procurement advisory:** after forecast computation, the engine checks every inventory item's projected consumption against its `reorderPoint`. Items predicted to fall below reorder level get a `ProcurementSuggestion` row — PENDING → REVIEWED → ACTIONED / DISMISSED.

---

### 36. Franchise & Multi-Branch Suite

**5 ranking dimensions** (`GET /api/franchise/rankings`): REVENUE, BUDGET_VARIANCE, STOCK_HEALTH, PROCUREMENT_PREPAREDNESS, DEMAND_READINESS. Each branch receives a score per dimension and an OVERALL rank.

**HQ overview** (`GET /api/franchise/overview`): per-branch current period budget vs. actual, procurement pressure score, stock health %, demand readiness, pending inter-branch transfers.

**Inter-branch stock transfers:** STOCK and EQUIPMENT types, urgency levels (LOW / NORMAL / HIGH / CRITICAL). State machine: REQUESTED → [APPROVED / REJECTED / CANCELLED] → IN_TRANSIT → COMPLETED.

**HQ digest subscriptions:** EMAIL or IN_APP at DAILY / WEEKLY / BIWEEKLY / MONTHLY. Duplicate subscriptions upsert rather than conflict.

**Org-level context:** franchise endpoints require no `X-Branch-Id`.

**Endpoints (12):** overview, rankings, budget rollups, transfers lifecycle, procurement pressure, digest subscriptions.

---

### 37. SaaS Billing & Developer Portal

Nimbus is itself a SaaS product. The billing module is the commercial layer for operator subscriptions.

**Plans (locked):**
| Plan | Locations | Monthly | Annual |
|---|---|---|---|
| SOLO | 1 | USD 80 | USD 864 |
| GROWTH | ≤3 | USD 150 | USD 1,620 |
| FRANCHISE | 4+ | USD 200 | USD 2,160 |

Full feature set on all plans — no feature gating between tiers. Only `maxBranches` differs.

**PesaPal v3:** live payment processing for owner SaaS billing. Token caching, IPN registration, idempotent re-checkout, CANCELLED-on-retry semantics.

**Subscription lifecycle:** PENDING_PAYMENT → ACTIVE → GRACE_PERIOD → PAST_DUE → SUSPENDED → CANCELLED.

**Developer Portal:** API key management (plaintext exactly once, `nk_` prefix), webhook management (signing secrets once, `whsec_` prefix), usage metering with `locationCapacity` block.

**Operations Portal:** platform admin manages plans, views subscriber lists. Refuses to lower `maxBranches` below current subscriber count; refuses annual > 12× monthly; refuses archiving plans with live subscribers.

---

### 38. Alerts, Digests & Real-Time Owner Views

**Alert rules:** configurable per org with `severity` (INFO / WARNING / HIGH / CRITICAL) and channel assignments. 6 defaults seeded covering the most common hospitality failures.

**3-channel fan-out:** CRITICAL rules deliver to all channels simultaneously (EMAIL + SMS + SLACK).

**Deduplication:** SHA-256 hash of `orgId | ruleId | alertType | title` as dedup key — same alert cannot be delivered twice in the same window.

**Retry with backoff:** failed deliveries enter a retry queue. `RETRY_EXHAUSTED` is a terminal state.

**Owner live view** (`GET /api/owner/live`): real-time aggregation — open shifts, today's reservations, pending vendor bills, subscription status (PAST_DUE / GRACE_PERIOD alerts).

**6 seeded default rules:** low-stock-default, cash-variance-default, booking-reminder-24h, billing-payment-failure-saas, overdue-vendor-bill, shift-not-closed-16h.

---

### 39. Reliability Layer: Idempotency & Offline Sync

The reliability layer was designed for the reality of a busy restaurant environment — intermittent Wi-Fi, double-tap payments, cashiers who hit the button twice.

**`IdempotencyKey` model:** scoped by `(scope, key, routeMethod, routePath)` with a request fingerprint. Four canonical outcomes: `first`, `replay`, `conflict`, `in_flight`.

**Offline sync:** `SyncJob` records offline-captured write intents. `POST /api/sync/replay` replays a batch with `(orgId, clientMutationId)` deduplication — a POS terminal offline for 20 minutes can replay its captured operations without creating duplicates.

**14 sync job types** covering orders, payments, inventory adjustments, and attendance clocks.

**Endpoints (7):** sync replay, job list/retry, conflict list/resolve, idempotency key inspect.

---

### 40. Feature Flags, Maintenance Windows & Training Mode

**Feature flags:** three-tier precedence (BRANCH > ORG > GLOBAL) with `rolloutPercent` ceiling for gradual rollouts.

**Maintenance windows:** SCHEDULED → ACTIVE → COMPLETED. Two modes: `ANNOUNCEMENT_ONLY` (banner only) and `BLOCK_WRITES` (hard block with 423). Write block categories: INVENTORY_WRITES, BILLING_WRITES, ACCOUNTING_WRITES, PUBLIC_BOOKING_WRITES.

**Training mode:** operators start a training session (`POST /api/training/start`). Integrated write surfaces return realistic simulated responses via `x-training-session-id` header — without writing real rows. Max 1 ACTIVE session per actor; sessions expire at `expiresAt`.

---

### 41. Unified Approvals Inbox & Global Audit Timeline

**Unified inbox** (`GET /api/approvals`): single paginated list across every approval domain — discounts, refunds, leave requests, shift swaps, vendor bills, inter-branch transfers.

**6 wired approval sources:**

| Source | Domain | Can Reject |
|---|---|---|
| discount | pos | Yes |
| refund | pos | No |
| leave_request | hr | Yes |
| shift_swap | hr | Yes |
| vendor_bill | accounting | No |
| inter_branch_transfer | franchise | Yes |

**Approval decision routing:** `POST /api/approvals/:id/decide` routes to the correct domain service — the caller does not need to know which service owns the entity.

**Global audit timeline** (`GET /api/audit/timeline`): full `AuditLog` history with 14 filter knobs including `entityType`, `action`, `actionPrefix`, `actorId`, `branchId`, `orgId`, `dateFrom/dateTo`, `severity`, `ipAddress`, `platform`, `sessionSource`.

---

### 42. Device, Printer & Terminal Registry

**Device types:** POS_TERMINAL, KDS_SCREEN, PRINTER, PAYMENT_TERMINAL_STUB

**Device lifecycle:** ACTIVE → INACTIVE → DISABLED → RETIRED. RETIRED is terminal — cannot be re-activated.

**Printer routing:** `PrinterRoute` maps `(branchId, routeType, station, printerId)`. Route types: RECEIPT, KITCHEN, BAR. Upserted by composite key.

**KDS registration shortcut:** `POST /api/devices/kds/register` is a convenience wrapper over `/devices/activate` with `type: KDS_SCREEN`.

**Terminal pairing:** `POST /api/devices/terminals/pair` is STUB (mode: `STUB`) — registers the terminal in the registry, does not invoke a live card-terminal driver.

**Idempotent activation:** `POST /api/devices/activate` is idempotent on `activationCode`.

**8 audit actions:** DEVICE_ACTIVATED, DEVICE_VIEWED, DEVICE_STATUS_CHANGED, KDS_DEVICE_REGISTERED, PRINTER_ROUTE_CONFIGURED, PRINTER_ROUTE_DISABLED, TERMINAL_PAIRED, TERMINAL_UNPAIRED.

---

### 43. Unified Exports & Downloads Facade

`GET /api/exports` provides a single normalised list across both `ExportArtifact` (report exports) and `Document` (uploaded files) — the frontend download centre does not need to stitch two APIs together.

**Composite export ID:** `<sourceDomain>:<underlyingId>` — no new schema column; routing is pure application logic.

**Status normalisation:** `PENDING → QUEUED`, `READY → COMPLETED`, `FAILED → FAILED`; documents always `COMPLETED`.

**Stream download:** `GET /api/exports/:id/download` streams with correct `Content-Type` and `Content-Disposition` headers.

**Permissions:** `exports:read`, `exports:write`, `exports:download` — Owner / Manager / Accountant; Chef denied all routes.

### 44. HMS Integration — Read-Only `/api/hms/*` Facade

Nimbus POS is the restaurant half of a two-system hospitality suite. **nimbus-hms** (the hotel/property-management counterpart) needs a complete, real-time view of every POS event so it can post restaurant charges to guest folios, reconcile event-bookings against hotel reservations, and include POS revenue in its daily flash report. BG7 delivers this contract surface.

**Authentication via API Key.** The HMS system authenticates with an opaque `nk_`-prefixed API key minted from the existing dev portal (`POST /api/dev/api-keys`). Keys are SHA-256-hashed at rest — the plaintext is returned exactly once on creation. Send it as `x-api-key: <key>` or `Authorization: ApiKey <key>`. A new `ApiKeyAuthGuard` validates status, expiry, and synthesises a `req.user` carrying the implicit permission `hms:read:*` — allowing the existing `PermissionGuard` to enforce `@Permissions('hms:read:*')` without any special branching.

**Key scope.** A key is either:
- **Organisation-wide** (`branchId` omitted on creation) — sees every branch and may filter per request with `?branchId=`
- **Branch-scoped** (`branchId` set on creation) — every read is locked to that branch; `?branchId=` parameter is ignored

**18 read-only endpoints under `/api/hms/*`:**

| Endpoint | Data |
|---|---|
| `GET /hms/whoami` | API key identity, scope, granted permissions |
| `GET /hms/access-logs` | Paginated journal of prior HMS requests |
| `GET /hms/organization` | Organisation profile and scope envelope |
| `GET /hms/branches` | All branches visible to the key |
| `GET /hms/orders` | Paginated POS orders (`from`, `to`, `status?`, `branchId?`) |
| `GET /hms/orders/:id` | Single order with line items and payments |
| `GET /hms/payments` | Paginated payments |
| `GET /hms/refunds` | Paginated refunds |
| `GET /hms/sales/summary` | Daily sales summary — revenue, covers, voids |
| `GET /hms/reservations` | Paginated restaurant reservations |
| `GET /hms/events` | Paginated events |
| `GET /hms/event-bookings` | Paginated event bookings with ticket counts |
| `GET /hms/menu` | Full menu catalog (categories, items, pricing) |
| `GET /hms/inventory` | Inventory items and current stock levels |
| `GET /hms/shifts` | Paginated shift records |
| `GET /hms/accounting/accounts` | Chart of accounts |
| `GET /hms/accounting/invoices` | AR customer invoices |
| `GET /hms/accounting/vendor-bills` | AP vendor bills |

**Access audit journal.** Every reached HMS request is journaled to `integration_access_logs` (route, method, status, duration, IP, user-agent). The HMS can pull its own request history via `GET /api/hms/access-logs` — full request traceability without touching any other audit surface.

**Security guarantees.** `hms:read:*` is never attached to any human role and never appears in JWT claims — even the broadest OWNER role cannot accidentally reach `/api/hms/*`. All Prisma selects use explicit `select:` lists — no key hashes, no plaintext secrets, no PII beyond what the HMS legitimately needs.

**Intentionally read-only.** Write-back surfaces (push charges to hotel folio, sync hotel-side adjustments back to POS) are deferred to a future BG milestone.

**Integration spec.** The long-form field-by-field integration specification, recommended polling cadence, and POS→HMS concept mapping live at [docs/NIMBUS_POS_FOR_HMS_INTEGRATION_SPEC.md](docs/NIMBUS_POS_FOR_HMS_INTEGRATION_SPEC.md).

---

## Cross-Cutting Infrastructure

### RBAC & Permission System

- ~200+ permissions seeded across all modules
- Granular namespaces: `pos:*`, `accounting:*`, `finance:*`, `franchise:*`, `alerts:*`, `devices:*`, `exports:*`, `billing:*`, `dev:*`, `ops:*`, `sync:*`, `idempotency:*`, `hr:*`, `payroll:*`, `reports:*`, `reservations:*`, `events:*`, `hms:*`
- Guard chain on every endpoint: `JwtAuthGuard` → `PermissionGuard` → `BranchContextGuard`
- Chef is intentionally denied on all financial, management, and receipt surfaces — used as a test control in every milestone's e2e suite to verify role gating actually works

### Audit Logging

Every write touching money, stock, payroll, config, or security emits an `AuditLog` row. Reads on sensitive surfaces (recipe cost, receipt, device detail) emit fire-and-forget audit events. The global audit timeline (`GET /api/audit/timeline`) exposes the full history with 14 filter dimensions.

### BG3 Idempotency Facade

16 high-risk write surfaces wrapped by `Bg3ReliabilityService.guard()`:

| Surface | Category | Training Sim |
|---|---|---|
| `POST /payments/intents` | BILLING_WRITES | Yes |
| `POST /pos/orders/:id/close` | BILLING_WRITES | No |
| `POST /pos/orders/:id/refunds` | BILLING_WRITES | Yes |
| `POST /accounting/ar/receipts` | ACCOUNTING_WRITES | No |
| `POST /accounting/ap/payments` | ACCOUNTING_WRITES | No |
| `PATCH /payroll/runs/:id/pay` | ACCOUNTING_WRITES | No |
| `POST /shifts/open` | — | No |
| `POST /shifts/:id/close` | — | No |
| `POST /tills/open` | — | No |
| `POST /tills/:id/reconcile` | — | No |
| `POST /public/reservations/hold` | PUBLIC_BOOKING_WRITES | No |
| `POST /public/reservations/confirm` | PUBLIC_BOOKING_WRITES | No |
| `POST /public/event-bookings/hold` | PUBLIC_BOOKING_WRITES | No |
| `POST /public/event-bookings/confirm` | PUBLIC_BOOKING_WRITES | No |
| `POST /inventory/adjustments` | INVENTORY_WRITES | Yes |
| `POST /sync/replay` | — | No |

Error contract: `409 IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`, `409 IDEMPOTENCY_IN_FLIGHT`, `409 MAINTENANCE_WINDOW_ACTIVE`, `423 MAINTENANCE_WINDOW_BLOCKED`.

### Seed System

Fully idempotent — every entity upserted, not inserted. `SeedHistory` records each step. Running `pnpm db:seed` twice produces identical state.

Demo data: Organisation *Nimbus Hospitality Group*, branch *Tapas Downtown*, 9 demo users (one per major role), 24 inventory items, 13 system-locked GL accounts, 9 posting source maps, 8 HR positions, 6 payroll components, 6 alert rules, 6 risk thresholds, and the full role-permission matrix for all 11 roles.

---

## API Surface Summary

| Domain | Module(s) | Approx Endpoints |
|---|---|---|
| Health | — | 1 |
| Auth | `auth` | 8 |
| Tenancy | `tenancy` | 10 |
| Org Settings | `settings` | 6 |
| Floor / Tables | `floor` | 8 |
| Menu Catalog | `menu` | 14 |
| Recipes / Costing | `recipes` | 7 |
| Inventory | `inventory` | 12 |
| POS Orders | `orders` | 12 |
| KDS | `kds` | 8 |
| Discounts | `discounts` | 6 |
| Shifts / Tills | `shifts`, `tills` | 10 |
| Payments | `payments` | 8 |
| Refunds | `refunds` | 5 |
| Receipts | `receipts` | 4 |
| Order Handoff | `pos-handoff` | 6 |
| Reservations | `reservations` | 12 |
| Events / Ticketing | `events` | 16 |
| Anomaly Detection | `analytics` | 13 |
| Dashboards | `dashboards` | 6 |
| Reporting | `reports` | 8 |
| Feedback / NPS | `feedback` | 8 |
| Documents | `documents` | 10 |
| HR | `hr` | 10 |
| Attendance | `attendance` | 12 |
| Scheduling | `workforce` | 10 |
| Payroll | `payroll` | 13 |
| Staff Insights | `staff-insights` | 8 |
| Accounting COA | `accounting` | 11 |
| General Ledger | `ledger` | 8 |
| Accounts Payable | `accounts-payable` | 18 |
| Accounts Receivable | `accounts-receivable` | 10 |
| Bank Reconciliation | `bank-rec` | 15 |
| Budgets / Forecasts | `budget` | 7 |
| Franchise | `franchise` | 12 |
| Billing / SaaS | `billing`, `billing-pesapal`, `ops-portal` | 20 |
| Alerts / Digests | `alerts` | 14 |
| Reliability / Sync | `reliability` | 7 |
| Feature Flags | `controlplane` | 12 |
| Unified Approvals | `unified-approvals` | 4 |
| Audit Timeline | `audit-timeline` | 1 |
| Device Registry | `device-registry` | 10 |
| Exports | `exports` | 5 |
| HMS Integration | `hms` | 18 |
| Public Commerce | `public-commerce`, `merchant-payments` | 12 |

**Total: ~420+ endpoints across 54 modules.**

---

## Seed Data & Demo Environment

```
Organization:   Nimbus Hospitality Group
Branch:         Tapas Downtown

Demo users (password: Demo1234! / PIN varies by role tier):
  owner@nimbus.com        → OWNER
  manager@nimbus.com      → MANAGER
  accountant@nimbus.com   → ACCOUNTANT
  supervisor@nimbus.com   → SUPERVISOR
  cashier@nimbus.com      → CASHIER
  waiter@nimbus.com       → WAITER
  chef@nimbus.com         → CHEF
  bartender@nimbus.com    → BARTENDER
  stockmanager@nimbus.com → STOCK_MANAGER
```

---

## Testing Strategy

Every milestone delivers a minimum test set:
- 1 happy-path e2e test
- 1 validation failure (400) test
- 1 permission denial (403) test — always tested against the Chef role
- 1 state-machine conflict (409) test
- 1 idempotency replay test for risky write surfaces

**Current coverage:**
- ~700 unit tests across 40+ spec files
- ~500 e2e tests across 45+ e2e spec files
- 56 Postman / Newman collections (23 to 68 assertions per collection)

```bash
# Unit tests
pnpm test

# E2E tests (from apps/api/)
pnpm exec jest --config test/jest-e2e.json

# Postman / Newman
npx --yes newman@6 run postman/collections/<collection>.json \
  --environment postman/environments/dev.json
```

---

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Set environment variables
#    Copy .env.example → .env in packages/db/ and apps/api/
#    Fill in DATABASE_URL and DIRECT_DATABASE_URL (Neon Postgres)

# 3. Generate Prisma client
pnpm db:generate

# 4. Apply all 51 migrations
pnpm db:migrate

# 5. Seed the database (fully idempotent — safe to run multiple times)
pnpm db:seed

# 6. Start the API in watch mode
pnpm dev:api
# → API available at http://localhost:3001/api
# → Health check: GET http://localhost:3001/api/health

# 7. Run unit tests
pnpm test

# 8. Open Prisma Studio
pnpm db:studio
```

**Required environment variables:**
```
DATABASE_URL=postgresql://...@....neon.tech/nimbuspos?sslmode=require
DIRECT_DATABASE_URL=postgresql://...@....neon.tech/nimbuspos?sslmode=require
JWT_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<strong-random-secret>
```

---

## Roadmap Status

| # | Milestone | Status |
|---|---|---|
| M0 | Repo Bootstrap + Workspace Tooling | ✅ |
| M1 | Neon + Prisma Baseline + Seed Framework | ✅ |
| M2 | Auth v1 (Email/Password/PIN) + JWT + RBAC | ✅ |
| M3 | Multi-Tenancy Core | ✅ |
| M3.1 | Quick PIN Login Refinement | ✅ |
| M4 | Organization Settings + Numbering | ✅ |
| M5 | Floor Plans + Tables + Service Areas | ✅ |
| M6 | Menu Catalog v1 | ✅ |
| M6.1 | Menu Taxonomy + Serving Formats | ✅ |
| M7 | Modifiers + Option Sets + Combo Rules | ✅ |
| M8 | Recipe BOM + Yield + Costing | ✅ |
| M9 | Inventory Master Data + FIFO Stock | ✅ |
| M10 | FIFO Stock Batches + Ledger Core | ✅ |
| M11 | Suppliers + Purchase Orders | ✅ |
| M12 | Goods Receipts + Landed Cost | ✅ |
| M13 | Stock Counts + Variance + Wastage | ✅ |
| M13.1 | MTN Mobile Money Native | ✅ (code complete; PENDING external delivery) |
| M14 | POS Orders Core | ✅ |
| M15 | KDS + Station Routing + SLA Timers | ✅ |
| M16 | Discounts + Manager Overrides + Void Rules | ✅ |
| M17 | Shifts + Till Sessions + Cash Management | ✅ |
| M18 | Payments v1 (Cash, Card Stub, Mobile Money) | ✅ |
| M19 | Refunds + Post-Close Voids + Receipt Reprints | ✅ |
| M20 | Reservations + Deposits + Seating Bridge | ✅ |
| M20.1 | Reservation Depth + Finalization | ✅ |
| M21 | Events + Booking Portal + Ticketing | ✅ |
| M22 | Anomaly Detection + Anti-Theft Signals | ✅ |
| M23 | Operational Dashboards + KPI Streams | ✅ |
| M24 | Reporting v1 + Exports | ✅ |
| M24.1 | Reporting Depth Finalization | ✅ |
| M25 | Customer Feedback + NPS + QR Follow-up | ✅ |
| M26 | Documents + Uploads + Attachments | ✅ |
| M27 | Employees + Contracts + HR Core | ✅ |
| M28 | Attendance + Leave + Shift Swaps | ✅ |
| M29 | Scheduling + Templates + Duty Roster | ✅ |
| M30 | Payroll Engine + Pay Runs + Payslips | ✅ |
| M31 | Staff Insights + Awards + Promotion Suggestions | ✅ |
| M32 | Accounting Foundation (COA + Cost Centres + Periods) | ✅ |
| M33 | General Ledger + Journal Entries + Posting Engine | ✅ |
| M34 | Accounts Payable + Vendor Bills + Payments | ✅ |
| M35 | Accounts Receivable + Invoicing + Direct Bill | ✅ |
| M36 | Bank Reconciliation + Period Close + Locks | ✅ |
| M37 | Budgets + Forecasts + Procurement Advisory | ✅ |
| M38 | Franchise + Multi-Branch Suite | ✅ |
| M38.1 | Franchise Analytics + Consolidation | ✅ |
| M39 | Billing + Subscription Plans + Dev Portal | ✅ |
| M39.1 | Commercial Foundation + SaaS Billing | ✅ |
| M39.2 | Onboarding + Membership + Merchant Public Setup | ✅ |
| M39.3 | Public Booking + Public Commerce + MoMo Pending | ✅ |
| M40 | Alerts + Digests + Real-Time Owner Views | ✅ |
| M41 | Reliability Layer (Idempotency + Offline Sync) | ✅ |
| M42 | Feature Flags + Maintenance Windows + Training Mode | ✅ |
| BG0 | Route Verification + Contract Cleanup | ✅ |
| BG1 | Invitation Acceptance + Password Lifecycle | ✅ |
| BG1.1 | Quick PIN Admin + PIN-First Login Refinement | ✅ |
| BG2 | Unified Approvals Inbox + Global Audit Timeline | ✅ |
| BG3 | Reliability Rollout (16 surfaces) | ✅ |
| BG4.A | Receipts Surface | ✅ |
| BG4.B | Order Handoff (Split / Merge / Transfer) | ✅ |
| BG5 | Device / Printer / Terminal Registry | ✅ |
| BG6 | Unified Exports / Downloads Facade + AP Supplier Detail | ✅ |
| BG7 | HMS Integration — Read-Only `/api/hms/*` Facade + API Key Auth | ✅ |
| M43 | Frontend Shell + Role-Based Workspaces | ⬜ Next |
| M44 | Frontend POS + KDS + Backoffice Vertical Screens | ⬜ |
| M45 | Passkeys + MFA + SSO/SCIM | ⬜ |
| M46 | Deferred Hardware Wave (Badges/MSR + Smart Spouts) | ⬜ |
| M47 | Launch Hardening + E2E + Security + CI/CD | ⬜ |

---

## Deferred / Upcoming

| Item | Status |
|---|---|
| Airtel Money native integration (M13.2) | Not started |
| HMS write-back endpoints (push charges, hotel sync) | Deferred — BG7 is read-only only |
| Live receipt delivery (email / SMS / WhatsApp) | Contracted — `POST /receipts/:id/send` returns 202 PENDING |
| Live card-terminal driver | STUB only — pairing is metadata |
| Live printer dispatch driver | Metadata only — routes configured, no print engine |
| Frontend shell — Next.js backoffice (M43) | Next milestone |
| POS desktop shell (M44) | Deferred |
| Passkeys / MFA / SSO (M45) | Deferred |
| Badge / MSR login (M46) | Deliberately late — hardware drag deferred |
| Smart spout / pour telemetry (M46) | Deliberately late — hardware drag deferred |
| BullMQ background workers | Contracted — dispatch uses in-process mock |

---

## Documentation

- [ROADMAP.md](ROADMAP.md) — Full M0–M47 milestone index with detailed scope per milestone
- [ai/AI_STATUS.md](ai/AI_STATUS.md) — Live progress tracker with per-milestone summaries
- [postman/POSTMAN_GUIDE.md](postman/POSTMAN_GUIDE.md) — How to run Postman collections
- [ai/AI_POSTMAN_WORKING_PATTERNS.md](ai/AI_POSTMAN_WORKING_PATTERNS.md) — Newman/Postman rules and patterns
- `ai/M*_COMPLETION_REPORT.md` — Detailed completion reports for every milestone (61 reports)
- `docs/` — Architecture and API convention docs

---

## HMS Integration (`/api/hms/*`) — BG7 ✅ 2026-05-08

**nimbus-pos** is the restaurant/POS half of a two-system suite. The other half — **nimbus-hms** (a separate codebase) — runs the hotel/property side: rooms, folios, guest profiles, housekeeping. BG7 ships the read-only contract surface the HMS consumes to keep its folios, restaurant charges, event bookings, and accounting mirrors in sync with this POS.

**Authentication.** The HMS authenticates with an opaque `nk_`-prefixed API key minted from the existing dev portal (`POST /api/dev/api-keys`). Send it as either `x-api-key: <key>` or `Authorization: ApiKey <key>`. Keys are SHA-256-hashed at rest; the plaintext is returned exactly once on creation. A new `ApiKeyAuthGuard` validates `status='ACTIVE'` and `expiresAt`, then synthesises `req.user` with `hms:read:*` — the existing `PermissionGuard` enforces access without any special HMS branching.

**Key scope.** A key is either:
- **Organization-wide** (`branchId` omitted on creation) — sees every branch in the org; filter per request with `?branchId=<id>`
- **Branch-scoped** (`branchId` set on creation) — every read is locked to that single branch; `?branchId=` is ignored

**18 read-only GET endpoints under `/api/hms/*`** (see Feature Domain §44 for the full table). Pagination: `limit` (≤200) + `skip`; time windows: `from` / `to` (ISO-8601). No POST/PATCH/DELETE on `/api/hms/*`.

**Schema.** Migration `20260508000000_bg7_hms_integration`: `api_keys` gains `branch_id` (FK→branches, ON DELETE SET NULL) and `last_used_ip`; new table `integration_access_logs` journals every reached HMS request with route, method, status code, duration, IP, user-agent, and `metadata JSONB`.

**Audit journal.** Every reached HMS request is journaled to `integration_access_logs` via `HmsAccessLogInterceptor` (best-effort, swallowed on failure). The HMS can pull its own request history via `GET /api/hms/access-logs`.

**Permissions.** `hms:read:*` is granted **implicitly by the API key** — it is never attached to any human role and never appears in JWT claims. Human users cannot reach `/api/hms/*` regardless of role.

**Write-back deferred.** Pushing charges to hotel folios and syncing hotel-side adjustments back to POS are deferred to a future BG milestone.

**For the parallel HMS implementer:** the long-form integration spec lives at [docs/NIMBUS_POS_FOR_HMS_INTEGRATION_SPEC.md](docs/NIMBUS_POS_FOR_HMS_INTEGRATION_SPEC.md) — every request/response shape, field-by-field types, recommended polling cadence, and POS→HMS concept mapping.

---

## License

UNLICENSED — Proprietary. All rights reserved.
