# nimbus-pos for nimbus-hms — Integration Specification

**Document audience:** the LLM coding agent (and any human engineer) implementing the **nimbus-hms** (Hotel Management System) side of the integration with **nimbus-pos** (Restaurant Point-of-Sale).

**Document purpose:** total ground truth. Read this end-to-end before writing a single HMS-side line of code that touches the POS. If something here disagrees with code in the POS repo, the code wins — but file an issue and update this document.

**Document status:** v1 — shipped with **BG7 — HMS Integration** on 2026-05-08.

---

## Table of Contents

1. [What nimbus-pos is, in one paragraph](#1-what-nimbus-pos-is-in-one-paragraph)
2. [The two-system suite — where the seam lives](#2-the-two-system-suite--where-the-seam-lives)
3. [System architecture overview](#3-system-architecture-overview)
4. [Tenancy model — orgs, branches, scope](#4-tenancy-model--orgs-branches-scope)
5. [Authentication — the API key contract](#5-authentication--the-api-key-contract)
6. [Authorization — `hms:read:*`](#6-authorization--hmsread)
7. [Endpoint catalog — `/api/hms/*`](#7-endpoint-catalog--apihms)
8. [Pagination, time windows, branch filtering](#8-pagination-time-windows-branch-filtering)
9. [Error envelope](#9-error-envelope)
10. [Data shapes — every entity the HMS will see](#10-data-shapes--every-entity-the-hms-will-see)
11. [Field-by-field type reference](#11-field-by-field-type-reference)
12. [Access journal — `integration_access_logs`](#12-access-journal--integration_access_logs)
13. [Recommended sync patterns from the HMS side](#13-recommended-sync-patterns-from-the-hms-side)
14. [POS → HMS concept mapping](#14-pos--hms-concept-mapping)
15. [Currency, money, rounding](#15-currency-money-rounding)
16. [Time, timezones, ISO-8601](#16-time-timezones-iso-8601)
17. [Idempotency, retries, replay safety](#17-idempotency-retries-replay-safety)
18. [Operational concerns — rate limits, key rotation, IP allow-lists](#18-operational-concerns--rate-limits-key-rotation-ip-allow-lists)
19. [Security boundary — what the HMS cannot do](#19-security-boundary--what-the-hms-cannot-do)
20. [Future write-back surface](#20-future-write-back-surface)
21. [Curl examples](#21-curl-examples)
22. [Node / TypeScript client example](#22-node--typescript-client-example)
23. [Testing & local development](#23-testing--local-development)
24. [Glossary](#24-glossary)

---

## 1. What nimbus-pos is, in one paragraph

`nimbus-pos` is a multi-tenant, multi-branch restaurant Point-of-Sale system written in TypeScript (Node 22, NestJS, Prisma, Postgres on Neon, pnpm workspaces, Turborepo). It runs the entire restaurant operation: floor plan & tables, menu & modifiers, recipes & inventory, suppliers & purchase orders, POS orders & KDS routing, discounts & manager overrides, shifts & cash management, payments & refunds, restaurant reservations, catered events & ticketing, customer feedback, employees & payroll, and a full double-entry accounting back-office (COA, GL, AP, AR, bank reconciliation, period close, budgets). Forty-seven roadmap milestones and a growing list of background-gap milestones (BG0 through BG7) — see [ROADMAP.md](../ROADMAP.md), [README.md](../README.md), and [ai/AI_STATUS.md](../ai/AI_STATUS.md). For the HMS, almost none of that matters internally — what matters is the read contract published under `/api/hms/*`.

## 2. The two-system suite — where the seam lives

The product is two cooperating codebases:

| | nimbus-pos | nimbus-hms |
|---|---|---|
| Owns | Restaurant ops, restaurant tables, restaurant orders, restaurant payments, POS-side accounting | Rooms, room reservations, guest folios, housekeeping, hotel-side accounting |
| Reads from the other | Nothing today | Everything via `/api/hms/*` |
| Writes to the other | Nothing today | Nothing today (write-back deferred) |

The seam is one-directional and read-only in BG7: the HMS pulls from the POS. The HMS does **not** push to the POS, and the POS does **not** call the HMS. This keeps the POS authoritative for everything restaurant-shaped and keeps the HMS authoritative for everything hotel-shaped, while the HMS gets the data it needs to (a) post a guest's restaurant tab to that guest's hotel folio, (b) cross-check that an event-booking in the POS lines up with a hotel block-booking, and (c) pull POS revenue into its consolidated daily flash report.

## 3. System architecture overview

- **Runtime:** Node 22, TypeScript strict.
- **HTTP framework:** NestJS (modules → controllers → services → providers).
- **ORM:** Prisma 5.22 against Postgres (Neon, free-tier-friendly — connection pool budget is small).
- **Workspaces:** pnpm + Turborepo. POS code under `apps/api`. Shared code under `packages/`.
- **Auth (humans):** JWT bearer tokens, email/password login at `POST /api/auth/login`, canonical context resolution at `GET /api/auth/me`. Permissions are string literals (`pos:order:read`, `accounting:invoice:write`, etc.) attached to roles.
- **Auth (machines, NEW in BG7):** opaque API key in `x-api-key` header (or `Authorization: ApiKey <key>`). Validated by `ApiKeyAuthGuard`. Synthesises a `req.user` so the same `PermissionGuard` works.
- **Tenancy:** every operational table carries `orgId` + `branchId`. Two parent tables — `Organization` (the customer) and `Branch` (the physical site, e.g. one restaurant location).
- **Audit:** `audit_logs` for human writes; `integration_access_logs` (NEW in BG7) for HMS reads.
- **Idempotency:** `IdempotencyKey` table; `Bg3ReliabilityService.guard(...)` wraps risky writes. **Not used on `/api/hms/*` reads.**
- **Money:** stored as `Decimal` (Prisma `Decimal`), serialized as JSON strings (e.g. `"123.45"`). The HMS must parse them as strings, not as JavaScript numbers.

## 4. Tenancy model — orgs, branches, scope

- An **Organization** is a POS customer (a restaurant brand or a restaurant group).
- An organization has one or more **Branches** (each Branch is one physical restaurant).
- Every operational entity (Order, Payment, Reservation, Event, Shift, Invoice, VendorBill, …) carries both `orgId` and `branchId`.
- An API key belongs to **exactly one Organization**.
- An API key is either:
  - **Organization-wide** — `branchId` is `null`. Sees every branch in the org. Honours an optional `?branchId=<id>` query parameter to filter per-request.
  - **Branch-scoped** — `branchId` is set. Every read is forced to that branch. The `?branchId=` query parameter is ignored (the service deliberately uses the key's branch as the source of truth).

The HMS-side code should treat the key's scope as fixed at issue time. If the hotel needs to look at multiple branches but the key it was given is branch-scoped, the right answer is "ask the POS operator to mint an org-wide key", not "loop through branch IDs".

## 5. Authentication — the API key contract

### 5.1 Key shape

- Format: `nk_<8-hex>...` (existing M39 convention; the prefix is for human eyeballing, not for parsing).
- Plaintext returned **exactly once** on creation. Store it immediately and securely on the HMS side; the POS only stores `keyHash = sha256(plaintext)`.
- Status: `ACTIVE`, `REVOKED`. Revoked keys return 401.
- Optional `expiresAt`. Expired keys return 401.

### 5.2 Minting a key (operator workflow, not HMS-runtime)

A POS owner / SaaS admin mints the key from the dev portal:

```
POST /api/dev/api-keys
Authorization: Bearer <owner JWT>
Content-Type: application/json

{
  "name": "nimbus-hms production",
  "branchId": null            // omit for org-wide; set to a Branch.id for branch-scoped
}
```

Response (201, returned **once**):

```json
{
  "id": "ak_xxx",
  "name": "nimbus-hms production",
  "key": "nk_abcd1234...long-opaque-string...",
  "scope": "ORGANIZATION",       // or "BRANCH"
  "branchId": null,              // or the Branch.id
  "status": "ACTIVE",
  "createdAt": "2026-05-08T10:00:00.000Z",
  "expiresAt": null
}
```

### 5.3 Sending the key on every HMS request

Either header works; pick one and stick with it:

```
x-api-key: nk_abcd1234...
```

or

```
Authorization: ApiKey nk_abcd1234...
```

If both are present, `x-api-key` wins.

### 5.4 Revoking a key

```
POST /api/dev/api-keys/:id/revoke
Authorization: Bearer <owner JWT>
```

After revocation, every subsequent HMS request returns `401 { code: 'API_KEY_REVOKED' }`.

### 5.5 Auth error codes (all return HTTP 401)

| Code | Meaning |
|---|---|
| `API_KEY_MISSING` | No `x-api-key` and no `Authorization: ApiKey <key>` header. |
| `API_KEY_INVALID` | Header present but the SHA-256 lookup found nothing. |
| `API_KEY_REVOKED` | Key exists but `status='REVOKED'`. |
| `API_KEY_EXPIRED` | Key exists, ACTIVE, but `expiresAt` is in the past. |

## 6. Authorization — `hms:read:*`

The guard injects a synthetic principal:

```ts
req.user = {
  id: 'apikey:<apiKeyId>',
  apiKeyId: '<apiKeyId>',
  orgId: '<orgId>',
  branchId: '<branchId | null>',
  permissions: ['hms:read:*'],
  source: 'API_KEY',
};
```

The standard `PermissionGuard` then enforces `@Permissions('hms:read:*')` on every controller method. **No human role has this permission.** A human user, even an Owner, who tries to call `/api/hms/whoami` with their JWT receives 403. This is intentional — the HMS surface is for machines.

## 7. Endpoint catalog — `/api/hms/*`

All endpoints:

- Method: `GET` (read-only milestone).
- Authentication: `x-api-key` (required).
- Permission: `hms:read:*` (granted implicitly).
- Pagination: `?limit=` (1–200, default 50) + `?skip=` (≥0).
- Time window: `?from=<ISO>` + `?to=<ISO>` where supported.
- Branch filter: `?branchId=` honoured **only** for org-wide keys.

### 7.1 Identity & meta

#### `GET /api/hms/whoami`
Returns the API key's identity envelope.
```json
{
  "apiKeyId": "ak_xxx",
  "name": "nimbus-hms production",
  "organizationId": "org_xxx",
  "organizationName": "Nile Hotel Group",
  "branchId": null,
  "branchName": null,
  "scope": "ORGANIZATION",
  "grantedPermissions": ["hms:read:*"],
  "createdAt": "2026-05-08T10:00:00.000Z",
  "lastUsedAt": "2026-05-09T07:30:12.000Z",
  "expiresAt": null
}
```

#### `GET /api/hms/access-logs`
Paginated journal of this key's prior requests. Newest first.
```json
{
  "total": 1234,
  "limit": 50,
  "skip": 0,
  "items": [
    {
      "id": "ial_xxx",
      "apiKeyId": "ak_xxx",
      "branchId": "br_xxx",
      "routeMethod": "GET",
      "routePath": "/api/hms/orders",
      "statusCode": 200,
      "durationMs": 47,
      "ipAddress": "10.0.0.42",
      "userAgent": "nimbus-hms/1.0",
      "requestId": "req_xxx",
      "createdAt": "2026-05-09T07:30:12.000Z"
    }
  ]
}
```

#### `GET /api/hms/organization`
Organization profile + scope envelope.
```json
{
  "organization": {
    "id": "org_xxx",
    "name": "Nile Hotel Group",
    "currencyCode": "UGX",
    "timezone": "Africa/Kampala",
    "createdAt": "2025-01-01T00:00:00.000Z"
  },
  "branchScope": "ORGANIZATION",
  "branchId": null
}
```

### 7.2 Branches

#### `GET /api/hms/branches`
List of branches visible to the key.
- Org-wide key: every branch in the org.
- Branch-scoped key: exactly one (the key's branch).
```json
[
  {
    "id": "br_xxx",
    "name": "Speke Resort",
    "code": "SPK",
    "addressLine1": "Speke Hotel Ltd, Munyonyo",
    "city": "Kampala",
    "country": "UG",
    "currencyCode": "UGX",
    "timezone": "Africa/Kampala",
    "isActive": true
  }
]
```

### 7.3 Sales surface

#### `GET /api/hms/orders`
Paginated POS orders. Optional filters: `branchId`, `status`, `from`, `to`.
```json
{
  "total": 1834,
  "limit": 50,
  "skip": 0,
  "items": [
    {
      "id": "ord_xxx",
      "orderNumber": "BR-2026-05-08-0001",
      "orgId": "org_xxx",
      "branchId": "br_xxx",
      "tableId": "tbl_xxx",
      "serverId": "usr_xxx",
      "customerId": null,
      "status": "CLOSED",
      "serviceType": "DINE_IN",
      "subtotal": "45000.00",
      "discountTotal": "0.00",
      "taxTotal": "8100.00",
      "total": "53100.00",
      "currencyCode": "UGX",
      "openedAt": "2026-05-08T18:30:00.000Z",
      "closedAt": "2026-05-08T19:42:00.000Z",
      "createdAt": "2026-05-08T18:30:00.000Z",
      "updatedAt": "2026-05-08T19:42:00.000Z"
    }
  ]
}
```

#### `GET /api/hms/orders/:id`
Single order with line items + payments inlined.
```json
{
  "id": "ord_xxx",
  "orderNumber": "BR-2026-05-08-0001",
  "branchId": "br_xxx",
  "status": "CLOSED",
  "serviceType": "DINE_IN",
  "subtotal": "45000.00",
  "taxTotal": "8100.00",
  "discountTotal": "0.00",
  "total": "53100.00",
  "currencyCode": "UGX",
  "items": [
    {
      "id": "oi_xxx",
      "menuItemId": "mi_xxx",
      "name": "Tilapia Grill",
      "quantity": "1",
      "unitPrice": "30000.00",
      "lineTotal": "30000.00",
      "modifiers": [],
      "notes": null
    }
  ],
  "payments": [
    {
      "id": "pay_xxx",
      "method": "CASH",
      "amount": "53100.00",
      "currencyCode": "UGX",
      "status": "POSTED",
      "transactionId": "TXN-xxx",
      "externalTransactionId": null,
      "postedAt": "2026-05-08T19:42:00.000Z"
    }
  ],
  "openedAt": "2026-05-08T18:30:00.000Z",
  "closedAt": "2026-05-08T19:42:00.000Z"
}
```

#### `GET /api/hms/payments`
Paginated payments. Filters: `branchId`, `from`, `to`.
```json
{
  "total": 5212,
  "limit": 50,
  "skip": 0,
  "items": [
    {
      "id": "pay_xxx",
      "orderId": "ord_xxx",
      "branchId": "br_xxx",
      "method": "MOBILE_MONEY",
      "amount": "53100.00",
      "currencyCode": "UGX",
      "status": "POSTED",
      "transactionId": "TXN-xxx",
      "externalTransactionId": "MTN-REF-xxx",
      "postedAt": "2026-05-08T19:42:00.000Z",
      "createdAt": "2026-05-08T19:41:50.000Z"
    }
  ]
}
```

#### `GET /api/hms/refunds`
Paginated refunds.
```json
{
  "total": 47,
  "limit": 50,
  "skip": 0,
  "items": [
    {
      "id": "rfd_xxx",
      "orderId": "ord_xxx",
      "paymentId": "pay_xxx",
      "branchId": "br_xxx",
      "amount": "10000.00",
      "currencyCode": "UGX",
      "reason": "DUPLICATE_CHARGE",
      "status": "POSTED",
      "createdAt": "2026-05-08T20:10:00.000Z"
    }
  ]
}
```

#### `GET /api/hms/sales/summary`
Daily roll-up. Filters: `branchId`, `from`, `to` (defaults to today).
```json
{
  "window": { "from": "2026-05-08T00:00:00.000Z", "to": "2026-05-08T23:59:59.999Z" },
  "branchId": null,
  "totals": {
    "currencyCode": "UGX",
    "grossSales": "1245000.00",
    "netSales": "1055000.00",
    "tax": "190000.00",
    "discount": "0.00",
    "refunds": "10000.00",
    "orderCount": 23,
    "paymentsByMethod": [
      { "method": "CASH", "count": 14, "amount": "650000.00" },
      { "method": "MOBILE_MONEY", "count": 8, "amount": "490000.00" },
      { "method": "CARD", "count": 1, "amount": "105000.00" }
    ]
  }
}
```

### 7.4 Hospitality surface

#### `GET /api/hms/reservations`
Restaurant table reservations (NOT hotel room reservations — those live in the HMS).
```json
{
  "total": 312,
  "limit": 50,
  "skip": 0,
  "items": [
    {
      "id": "res_xxx",
      "branchId": "br_xxx",
      "guestName": "John Smith",
      "guestPhone": "+256770000000",
      "partySize": 4,
      "tableId": "tbl_xxx",
      "scheduledAt": "2026-05-09T19:00:00.000Z",
      "status": "CONFIRMED",
      "depositAmount": "0.00",
      "depositStatus": "NONE",
      "notes": null,
      "createdAt": "2026-05-08T10:00:00.000Z"
    }
  ]
}
```

#### `GET /api/hms/events`
Catered events (weddings, corporate functions held at the venue).
```json
{
  "total": 19,
  "limit": 50,
  "skip": 0,
  "items": [
    {
      "id": "evt_xxx",
      "branchId": "br_xxx",
      "name": "Smith Wedding Reception",
      "scheduledAt": "2026-06-15T17:00:00.000Z",
      "capacity": 150,
      "ticketPrice": "75000.00",
      "currencyCode": "UGX",
      "status": "SCHEDULED",
      "createdAt": "2026-04-01T10:00:00.000Z"
    }
  ]
}
```

#### `GET /api/hms/event-bookings`
Bookings for those events.
```json
{
  "total": 87,
  "limit": 50,
  "skip": 0,
  "items": [
    {
      "id": "evb_xxx",
      "eventId": "evt_xxx",
      "branchId": "br_xxx",
      "buyerName": "Jane Doe",
      "buyerPhone": "+256770000000",
      "ticketCount": 4,
      "amountPaid": "300000.00",
      "currencyCode": "UGX",
      "status": "CONFIRMED",
      "createdAt": "2026-04-15T12:00:00.000Z"
    }
  ]
}
```

### 7.5 Catalog & inventory

#### `GET /api/hms/menu`
Menu items.
```json
{
  "total": 142,
  "limit": 50,
  "skip": 0,
  "items": [
    {
      "id": "mi_xxx",
      "branchId": "br_xxx",
      "categoryId": "mc_xxx",
      "name": "Tilapia Grill",
      "description": "Whole tilapia, char-grilled, served with kachumbari.",
      "price": "30000.00",
      "currencyCode": "UGX",
      "isAvailable": true,
      "createdAt": "2025-09-01T00:00:00.000Z"
    }
  ]
}
```

#### `GET /api/hms/inventory`
Inventory items + on-hand quantities.
```json
{
  "total": 287,
  "limit": 50,
  "skip": 0,
  "items": [
    {
      "id": "inv_xxx",
      "branchId": "br_xxx",
      "name": "Tilapia (whole)",
      "sku": "FISH-TIL-WHL",
      "unit": "kg",
      "onHand": "47.5",
      "reorderPoint": "20",
      "isActive": true
    }
  ]
}
```

### 7.6 Operations

#### `GET /api/hms/shifts`
Cashier till sessions.
```json
{
  "total": 56,
  "limit": 50,
  "skip": 0,
  "items": [
    {
      "id": "shf_xxx",
      "branchId": "br_xxx",
      "userId": "usr_xxx",
      "openedAt": "2026-05-08T08:00:00.000Z",
      "closedAt": "2026-05-08T20:00:00.000Z",
      "openingFloat": "100000.00",
      "closingCash": "850000.00",
      "expectedCash": "850000.00",
      "variance": "0.00",
      "status": "CLOSED"
    }
  ]
}
```

### 7.7 Accounting

#### `GET /api/hms/accounting/accounts`
Chart of accounts.
```json
{
  "total": 78,
  "limit": 50,
  "skip": 0,
  "items": [
    {
      "id": "acc_xxx",
      "code": "4000",
      "name": "Sales — Food",
      "type": "REVENUE",
      "isActive": true
    }
  ]
}
```

#### `GET /api/hms/accounting/invoices`
AR invoices.
```json
{
  "total": 412,
  "limit": 50,
  "skip": 0,
  "items": [
    {
      "id": "inv_xxx",
      "invoiceNumber": "INV-2026-0123",
      "customerId": "cus_xxx",
      "customerName": "Speke Hotel Front Desk",
      "branchId": "br_xxx",
      "issueDate": "2026-05-01",
      "dueDate": "2026-05-31",
      "subtotal": "1000000.00",
      "taxTotal": "180000.00",
      "total": "1180000.00",
      "amountPaid": "0.00",
      "balance": "1180000.00",
      "currencyCode": "UGX",
      "status": "OPEN"
    }
  ]
}
```

#### `GET /api/hms/accounting/vendor-bills`
AP vendor bills.
```json
{
  "total": 218,
  "limit": 50,
  "skip": 0,
  "items": [
    {
      "id": "vb_xxx",
      "billNumber": "BILL-001",
      "supplierId": "sup_xxx",
      "supplierName": "Mukwano Industries",
      "branchId": "br_xxx",
      "issueDate": "2026-04-30",
      "dueDate": "2026-05-30",
      "subtotal": "500000.00",
      "taxTotal": "90000.00",
      "total": "590000.00",
      "amountPaid": "0.00",
      "balance": "590000.00",
      "currencyCode": "UGX",
      "status": "OPEN"
    }
  ]
}
```

## 8. Pagination, time windows, branch filtering

**Pagination.** All list endpoints accept:

| Param | Type | Default | Max |
|---|---|---|---|
| `limit` | integer | 50 | 200 |
| `skip` | integer | 0 | — |

Response envelope is always `{ total, limit, skip, items[] }`. The HMS should use `total` to drive its own pagination UI / iteration.

**Time windows.** Where supported (orders, payments, refunds, reservations, sales/summary, access-logs):

| Param | Type | Notes |
|---|---|---|
| `from` | ISO-8601 string | inclusive |
| `to` | ISO-8601 string | inclusive |

Both are optional. If the HMS sends only `from`, results from that timestamp onward are returned. Both omitted = no time filter.

**Branch filter.**

| Key scope | `?branchId=` behaviour |
|---|---|
| ORGANIZATION | Honoured. Filters the result to one branch. |
| BRANCH | Ignored. Result is always restricted to the key's branch. |

## 9. Error envelope

Standard NestJS error shape:

```json
{
  "statusCode": 401,
  "message": "API key revoked",
  "code": "API_KEY_REVOKED",
  "timestamp": "2026-05-09T07:30:12.000Z",
  "path": "/api/hms/whoami"
}
```

For validation failures (bad query params), the `message` field becomes an array of validation errors per `class-validator`:

```json
{
  "statusCode": 400,
  "message": ["limit must not be greater than 200"],
  "error": "Bad Request"
}
```

The HMS should branch on `statusCode` first, then on `code` for 401s, then on `message` content for 400s.

## 10. Data shapes — every entity the HMS will see

See section 7 for sample bodies. Every entity carries `id`, `createdAt`, and (where applicable) `updatedAt`. Money fields are always serialised as strings. Identifiers are opaque short strings (no assumed format).

## 11. Field-by-field type reference

A quick lookup for the HMS-side schema generators / DTOs.

### `Order`

| Field | Type | Notes |
|---|---|---|
| id | string | |
| orderNumber | string | Per-branch, monotonically increasing within a day |
| orgId | string | |
| branchId | string | |
| tableId | string \| null | |
| serverId | string \| null | |
| customerId | string \| null | |
| status | enum | DRAFT \| SENT \| SERVED \| CLOSED \| VOIDED |
| serviceType | enum | DINE_IN \| TAKEAWAY \| DELIVERY \| ROOM_SERVICE |
| subtotal | string (Decimal) | |
| discountTotal | string (Decimal) | |
| taxTotal | string (Decimal) | |
| total | string (Decimal) | |
| currencyCode | string (ISO-4217) | |
| openedAt | string (ISO-8601) | |
| closedAt | string (ISO-8601) \| null | |
| createdAt | string (ISO-8601) | |
| updatedAt | string (ISO-8601) | |

### `OrderItem`

| Field | Type | Notes |
|---|---|---|
| id | string | |
| menuItemId | string | |
| name | string | Snapshot at line-create time |
| quantity | string (Decimal) | Fractional supported (e.g. `"0.5"` for half a bottle of wine) |
| unitPrice | string (Decimal) | |
| lineTotal | string (Decimal) | |
| modifiers | array | Free-shape, opaque to the HMS |
| notes | string \| null | |

### `Payment`

| Field | Type | Notes |
|---|---|---|
| id | string | |
| orderId | string | |
| branchId | string | |
| method | enum | CASH \| CARD \| MOBILE_MONEY \| BANK_TRANSFER \| HOUSE_ACCOUNT \| OTHER |
| amount | string (Decimal) | |
| currencyCode | string | |
| status | enum | PENDING \| POSTED \| FAILED \| CANCELLED |
| transactionId | string \| null | POS-internal reference |
| externalTransactionId | string \| null | Provider reference (MTN, Airtel, etc.) |
| postedAt | string (ISO-8601) \| null | Set when status = POSTED |
| createdAt | string (ISO-8601) | |

### `Refund`

| Field | Type | Notes |
|---|---|---|
| id | string | |
| orderId | string | |
| paymentId | string \| null | |
| branchId | string | |
| amount | string (Decimal) | |
| currencyCode | string | |
| reason | string | |
| status | enum | PENDING \| POSTED \| FAILED \| CANCELLED |
| createdAt | string (ISO-8601) | |

### `Reservation`

| Field | Type | Notes |
|---|---|---|
| id | string | |
| branchId | string | |
| guestName | string | |
| guestPhone | string \| null | |
| partySize | integer | |
| tableId | string \| null | |
| scheduledAt | string (ISO-8601) | |
| status | enum | PENDING \| CONFIRMED \| SEATED \| CANCELLED \| NO_SHOW \| COMPLETED |
| depositAmount | string (Decimal) | |
| depositStatus | enum | NONE \| PENDING \| PAID \| REFUNDED \| FORFEITED |
| notes | string \| null | |
| createdAt | string (ISO-8601) | |

### `Event`

| Field | Type | Notes |
|---|---|---|
| id | string | |
| branchId | string | |
| name | string | |
| scheduledAt | string (ISO-8601) | |
| capacity | integer | |
| ticketPrice | string (Decimal) | |
| currencyCode | string | |
| status | enum | DRAFT \| SCHEDULED \| LIVE \| COMPLETED \| CANCELLED |
| createdAt | string (ISO-8601) | |

### `EventBooking`

| Field | Type | Notes |
|---|---|---|
| id | string | |
| eventId | string | |
| branchId | string | |
| buyerName | string | |
| buyerPhone | string \| null | |
| ticketCount | integer | |
| amountPaid | string (Decimal) | |
| currencyCode | string | |
| status | enum | PENDING \| CONFIRMED \| CHECKED_IN \| CANCELLED \| REFUNDED |
| createdAt | string (ISO-8601) | |

### `MenuItem`

| Field | Type | Notes |
|---|---|---|
| id | string | |
| branchId | string | |
| categoryId | string | |
| name | string | |
| description | string \| null | |
| price | string (Decimal) | |
| currencyCode | string | |
| isAvailable | boolean | |
| createdAt | string (ISO-8601) | |

### `InventoryItem`

| Field | Type | Notes |
|---|---|---|
| id | string | |
| branchId | string | |
| name | string | |
| sku | string \| null | |
| unit | string | e.g. `"kg"`, `"L"`, `"bottle"` |
| onHand | string (Decimal) | |
| reorderPoint | string (Decimal) | |
| isActive | boolean | |

### `Shift`

| Field | Type | Notes |
|---|---|---|
| id | string | |
| branchId | string | |
| userId | string | |
| openedAt | string (ISO-8601) | |
| closedAt | string (ISO-8601) \| null | |
| openingFloat | string (Decimal) | |
| closingCash | string (Decimal) \| null | |
| expectedCash | string (Decimal) \| null | |
| variance | string (Decimal) \| null | `closingCash - expectedCash` |
| status | enum | OPEN \| CLOSED |

### `Account`

| Field | Type | Notes |
|---|---|---|
| id | string | |
| code | string | e.g. `"4000"` |
| name | string | |
| type | enum | ASSET \| LIABILITY \| EQUITY \| REVENUE \| EXPENSE |
| isActive | boolean | |

### `Invoice` (AR)

| Field | Type | Notes |
|---|---|---|
| id | string | |
| invoiceNumber | string | |
| customerId | string | |
| customerName | string | |
| branchId | string | |
| issueDate | string (ISO-8601 date) | |
| dueDate | string (ISO-8601 date) | |
| subtotal | string (Decimal) | |
| taxTotal | string (Decimal) | |
| total | string (Decimal) | |
| amountPaid | string (Decimal) | |
| balance | string (Decimal) | |
| currencyCode | string | |
| status | enum | DRAFT \| OPEN \| PAID \| PARTIAL \| OVERDUE \| VOID |

### `VendorBill` (AP)

| Field | Type | Notes |
|---|---|---|
| id | string | |
| billNumber | string | |
| supplierId | string | |
| supplierName | string | |
| branchId | string | |
| issueDate | string (ISO-8601 date) | |
| dueDate | string (ISO-8601 date) | |
| subtotal | string (Decimal) | |
| taxTotal | string (Decimal) | |
| total | string (Decimal) | |
| amountPaid | string (Decimal) | |
| balance | string (Decimal) | |
| currencyCode | string | |
| status | enum | DRAFT \| OPEN \| PAID \| PARTIAL \| OVERDUE \| VOID |

### `Branch`

| Field | Type | Notes |
|---|---|---|
| id | string | |
| name | string | |
| code | string | |
| addressLine1 | string \| null | |
| city | string \| null | |
| country | string (ISO-3166 alpha-2) | |
| currencyCode | string (ISO-4217) | |
| timezone | string (IANA) | |
| isActive | boolean | |

## 12. Access journal — `integration_access_logs`

Every reached HMS request is journaled. The interceptor runs on both success and error paths. The journal is best-effort — if the insert itself fails, the original response is unaffected.

The HMS should poll `GET /api/hms/access-logs` periodically as a self-debug tool: if the HMS thinks it called something but no row exists, the request never reached the POS (network / DNS / load-balancer).

## 13. Recommended sync patterns from the HMS side

The POS does not push. The HMS must poll. Suggested cadence:

| Resource | Cadence | Strategy |
|---|---|---|
| `/orders` | every 30s for "today's" window | Pull `from = now - 35s`, `to = now`. De-dup by `id` on HMS side. |
| `/payments` | every 30s for "today's" window | Same as orders. |
| `/refunds` | every 60s | Same. |
| `/sales/summary` | every 5 min | Pull twice — once for "today", once for "yesterday" (in case of late-arriving payments). |
| `/reservations` | every 5 min for `from = now`, `to = now + 7d` | Future window. |
| `/events`, `/event-bookings` | every 15 min for `from = now - 1d`, `to = now + 30d` | |
| `/menu`, `/inventory` | every 60 min | Slow-changing reference data. |
| `/shifts` | every 5 min | |
| `/accounting/*` | every 60 min | Truly slow-changing. |
| `/whoami`, `/branches`, `/organization` | once at HMS boot, then every 24h | Configuration. |

The HMS should always tolerate **late-arriving rows** — a payment created at 23:59:59 might not be visible until 00:00:02 next day if the POS clock and the HMS clock disagree. Always overlap windows by at least 5 seconds.

The HMS should record its **last successful poll cursor** (max `createdAt` it has seen) per resource and use it to drive the next `from`.

## 14. POS → HMS concept mapping

| POS concept | Typical HMS counterpart |
|---|---|
| `Order` (status `CLOSED`, customer linked to a guest profile) | A folio charge on that guest's stay |
| `Order` (status `CLOSED`, no customer) | A walk-in restaurant sale — no folio impact |
| `Payment` (method `HOUSE_ACCOUNT`) | A folio post — settled at hotel checkout |
| `Payment` (method anything else) | Settled at the POS — counts toward POS-side cash & card reconciliation only |
| `Reservation` | A restaurant table reservation, possibly tied to a hotel guest by `guestPhone` / `guestName` |
| `Event` + `EventBooking` | A function-room booking — often paired with a hotel block-booking the HMS owns |
| `Invoice` (AR) | A direct-bill invoice, often issued to the hotel itself or to a corporate account |
| `Sales summary` | Restaurant revenue line on the hotel's daily flash report |
| `Shift` | A cashier session — no direct HMS analogue, but useful for variance reconciliation |
| `MenuItem` | Used by the HMS to display restaurant offerings in the in-room channel |
| `InventoryItem` | Used by the HMS for inter-departmental cost allocation (if the hotel runs central F&B accounting) |

## 15. Currency, money, rounding

- Every monetary field is a string serialised from a Prisma `Decimal`.
- The currency code lives on the parent (`Order.currencyCode`, `Branch.currencyCode`, etc.).
- The POS stores money to 2 decimal places.
- The HMS must parse money as `Decimal` (or `BigInt` of minor units) — **never** as `Number`.
- The POS does not perform FX conversion. If branches in the same org use different currencies, the HMS must handle conversion on its side.

## 16. Time, timezones, ISO-8601

- All timestamps are UTC, ISO-8601, with milliseconds and `Z` suffix.
- Date-only fields (`issueDate`, `dueDate`) are ISO-8601 dates, no time.
- The `Branch.timezone` field is the local timezone for that physical site (IANA name, e.g. `Africa/Kampala`). The HMS should use it when displaying day-aggregated data.
- "Today" is always defined relative to `Branch.timezone`, not the HMS's clock.

## 17. Idempotency, retries, replay safety

- All HMS reads are safe to retry — they're pure GETs. There is no "I already saw this" tracking inside the POS.
- The HMS should retry transient failures (5xx, network) with exponential back-off.
- The HMS should **not** retry on 4xx — fix the request instead.

## 18. Operational concerns — rate limits, key rotation, IP allow-lists

- **Rate limits.** None today. The HMS is treated as a trusted caller. If abuse appears, BG7+1 will introduce per-key rate limits — until then, please be polite (e.g. don't poll `/orders` every 100 ms).
- **Key rotation.** The recommended pattern is dual-key: mint a new key, deploy it on the HMS side, observe both keys in `/access-logs`, then revoke the old key. The POS supports any number of concurrent active keys per organization.
- **IP allow-lists.** Not implemented today. Deferred.
- **Webhooks.** Not implemented today. Deferred — for now, the HMS polls.

## 19. Security boundary — what the HMS cannot do

The API key gives **read access** to operational data. It deliberately cannot:

- Create, update, or delete anything in the POS (no POST/PATCH/DELETE on `/api/hms/*`).
- See API keys themselves (`api_keys` rows are not exposed; only `/whoami` echoes the calling key's metadata, and even then no hash, no plaintext).
- See human users' credentials (passwords, password resets, PINs).
- Access M39 SaaS-billing internals (subscriptions, plans, payment methods on the SaaS side — those are owner-portal-only).
- Trigger the M13.2 public-diner mobile-money flow.
- See M42 maintenance-window state.
- Be granted to a human role. `hms:read:*` is exclusive to API-key principals.

## 20. Future write-back surface

Likely to be tackled in a future BG (BG8 — *HMS Write-Back & Folio Sync*). When designed, expect:

- `POST /api/hms/folio-charges` — push a confirmation that the HMS has accepted a `HOUSE_ACCOUNT` payment.
- `POST /api/hms/reservations/:id/confirm` — confirm a restaurant reservation from the hotel side.
- `POST /api/hms/event-bookings` — create an event booking on behalf of a hotel guest.
- Webhooks: `POST <hms-callback-url>/pos/orders.closed`, `/pos/payments.posted`.

None of those exist today. Plan around polling.

## 21. Curl examples

### Whoami

```bash
curl -sS \
  -H 'x-api-key: nk_abcd1234...' \
  https://pos.example.com/api/hms/whoami
```

### Today's orders for a specific branch (org-wide key)

```bash
curl -sS \
  -H 'x-api-key: nk_abcd1234...' \
  'https://pos.example.com/api/hms/orders?branchId=br_xxx&from=2026-05-08T00:00:00.000Z&to=2026-05-08T23:59:59.999Z&limit=200'
```

### Access journal — last 50 reaches

```bash
curl -sS \
  -H 'Authorization: ApiKey nk_abcd1234...' \
  'https://pos.example.com/api/hms/access-logs?limit=50'
```

## 22. Node / TypeScript client example

```ts
import fetch from 'node-fetch';

const POS_BASE = process.env.POS_BASE_URL!;       // e.g. "https://pos.example.com"
const POS_KEY  = process.env.POS_API_KEY!;        // e.g. "nk_abcd1234..."

async function posGet<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams(
    Object.entries(query).map(([k, v]) => [k, String(v)])
  ).toString();
  const url = `${POS_BASE}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers: { 'x-api-key': POS_KEY } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`POS ${res.status} on ${path}: ${body}`);
  }
  return (await res.json()) as T;
}

// Example: poll today's orders
const today = new Date(); today.setUTCHours(0, 0, 0, 0);
const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const page = await posGet<{ total: number; items: any[] }>('/api/hms/orders', {
  from: today.toISOString(),
  to: tomorrow.toISOString(),
  limit: 200,
});
console.log(`Got ${page.items.length} of ${page.total} orders`);
```

## 23. Testing & local development

The POS ships:

- An **e2e spec** at `apps/api/test/bg7-hms-integration.e2e-spec.ts` that mints three keys (org-wide, branch-scoped, revoked) and exercises every endpoint + every error path.
- A **Postman collection** at `postman/collections/BG7-HMS-Integration.postman_collection.json` — import it, run folder-by-folder, and you have a working dev harness.

The HMS side should ship its own e2e harness that **mocks the POS** at the HTTP layer — do not require a running POS instance for the HMS test suite.

## 24. Glossary

| Term | Meaning |
|---|---|
| **POS** | nimbus-pos — this codebase. Restaurant operations. |
| **HMS** | nimbus-hms — separate codebase. Hotel / property operations. |
| **Branch** | A single physical restaurant location belonging to an organization. |
| **Organization** | A POS customer (a restaurant brand or a restaurant group). |
| **Folio** | Hotel-side concept: a guest's running tab during their stay. POS does not own folios. |
| **House account** | A POS payment method that defers settlement to an external system (typically the hotel folio). |
| **Order** | A POS sale. Lifecycle: DRAFT → SENT → SERVED → CLOSED (or VOIDED). |
| **Payment** | A money movement attached to an Order. |
| **Refund** | A reversed Payment, attached to an Order. |
| **Shift** | A cashier till session (open / close). |
| **Reservation** | A restaurant table booking. Distinct from a hotel room reservation. |
| **Event** | A catered function (wedding, corporate event) at the venue. |
| **EventBooking** | A ticket purchase against an Event. |
| **AR** | Accounts Receivable — money owed to the restaurant. |
| **AP** | Accounts Payable — money owed by the restaurant to suppliers. |
| **VendorBill** | An AP entry. |
| **Invoice** | An AR entry. |
| **MOBILE_MONEY** | MTN MoMo / Airtel Money / similar — a Payment.method enum value. |
| **scope: ORGANIZATION** | API key sees every branch in its org. |
| **scope: BRANCH** | API key locked to one branch. |

---

*End of document. Questions, gaps, or contradictions: please file an issue against the nimbus-pos repo.*
