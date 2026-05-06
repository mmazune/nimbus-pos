# M39 — API Workflow Spec (Corrected Business Architecture)

> **Status:** This is the canonical reference for what every M39 endpoint
> means in business terms. It supersedes any earlier wording in the
> reconstruction completion report or Postman collection that implied
> diners pay through PesaPal.

## Locked business architecture

### 3 audiences

| # | Audience | Surface |
|---|----------|---------|
| 1 | Restaurant owners / operators buying Nimbus | nimbus.co.ug app + POS admin |
| 2 | Public diners / guests | booking.nimbus.co.ug |
| 3 | Nimbus internal staff | ops.nimbus.co.ug (internal only) |

### 2 payment domains

| Domain | Money flow | Provider | Status |
|--------|-----------|----------|--------|
| A. SaaS subscription billing | Owner → Nimbus | **PesaPal v3 (live)** | LIVE |
| B. Public commerce payments | Diner → Restaurant | **Mobile money (MTN / Airtel)** | **PENDING** |

**Rules:**
- PesaPal is for owner subscriptions ONLY. It is never used to charge diners.
- Diner payments are pending the MTN/Airtel integration. They MUST NOT be
  presented as live PesaPal checkout in code, docs, Postman, or completion
  reports.
- Public-payment endpoints exist but return
  `{ status: "PENDING_INTEGRATION", provider: "MOBILE_MONEY", message: "..." }`.

### Login & tenancy model

- Users log into Nimbus globally via `POST /api/auth/login`.
- Users do NOT "sign into an organization" first.
- After login the frontend calls `GET /api/me` (served by `TenancyController`, which uses `@Controller()` with no prefix). The backend returns the
  user's memberships (orgs + branches + roles).
- Frontend resolves the active org/branch context:
  - exactly one membership → auto-select
  - multiple memberships → prompt the user
- Branch-scoped routes require the `x-branch-id` header.
- Invited managers/accountants follow the SAME flow on first login. They
  never "join an org" via a separate login surface.

### Where staff are created

- During onboarding, the owner invites the **core team** (typically 1
  Manager + 1 Accountant) via `POST /api/onboarding/invitations`.
- Additional staff (Cashiers, Waiters, Bartenders, Chefs, Stock Managers)
  are created LATER from inside the app (POS admin module). They are NOT
  created in the public onboarding wizard.

### Webhook semantics — keep them separate

| Type | Direction | Endpoints | Status |
|------|-----------|-----------|--------|
| Inbound payment callback (SaaS) | Provider → Nimbus | `GET/POST /api/billing/pesapal/{callback,ipn}` | LIVE |
| Inbound payment callback (public) | Provider → Nimbus | `GET/POST /api/public/payments/{callback,ipn}` | **PENDING (scaffold)** |
| Outbound developer webhook | Nimbus → Customer system | `POST/GET/PATCH /api/dev/webhooks` | LIVE |

These three are *not* the same thing. Do not conflate.

---

## Endpoint catalogue (by subdomain)

### A. Plans & Pricing

| Endpoint | Audience | Live? | Purpose |
|----------|----------|-------|---------|
| `GET /api/public/plans` | Anyone (unauthenticated) | LIVE | Marketing site / pricing page lists Nimbus plans. |
| `GET /api/billing/plans` | Authenticated owner | LIVE | Same data, surfaced inside the app. |

**Pricing (locked):** SOLO $80/mo · GROWTH $150/mo · FRANCHISE $200/mo
(annual = 10% discount).

### B. SaaS Billing via PesaPal (owners only)

| Endpoint | Audience | Live? | Purpose |
|----------|----------|-------|---------|
| `POST /api/billing/pesapal/checkout-session` | Owner (auth + perm) | **LIVE** | Owner picks a plan; Nimbus creates a PesaPal hosted checkout and returns the redirect URL. Auto-cancels any prior INITIATED transaction. Creates/updates a `Subscription` row in `PENDING_PAYMENT`. |
| `GET /api/billing/pesapal/callback` | PesaPal browser redirect | **LIVE** | Marks transaction `REDIRECTED` and stores the PesaPal txn id. Owner-facing confirmation page consumes this. |
| `POST /api/billing/pesapal/ipn` | PesaPal server-to-server | **LIVE** | Persists the raw IPN, then triggers `reconcileTransactionStatus`, which calls `GetTransactionStatus` on PesaPal and, if COMPLETED, activates the subscription. |
| `POST /api/billing/pesapal/reconcile-status` | Owner (auth + perm) | **LIVE** | Manual recovery if the IPN didn't arrive. Polls PesaPal directly. |

**End-to-end SaaS flow:**
1. Owner picks plan in app.
2. App calls `checkout-session` → receives `redirectUrl`.
3. Owner is redirected to the PesaPal hosted page.
4. PesaPal redirects back to `callback` and pushes IPN to `ipn`.
5. Nimbus reconciles, sets `PesapalTransaction` to COMPLETED, sets
   `Subscription` to ACTIVE, marks onboarding step 1 complete.

### C. Subscription Lifecycle

| State | Meaning |
|-------|---------|
| `PENDING_PAYMENT` | Checkout session created; awaiting first successful PesaPal settlement. |
| `ACTIVE` | Paid and current. |
| `PAST_DUE` | Renewal payment failed but inside grace period. |
| `CANCELLED` | Owner or ops cancelled. |

State transitions are owned by `BillingService.VALID_TRANSITIONS` (M39
original) and `BillingPesapalService.reconcileTransactionStatus`.

### D. Client Onboarding

7-step idempotent wizard, owner-driven.

| Endpoint | Audience | Live? | Purpose |
|----------|----------|-------|---------|
| `GET /api/onboarding/status` | Owner | LIVE | Returns `OnboardingProgress` row (per step status) and `totalSteps`. |
| `POST /api/onboarding/organization` | Owner | LIVE | Creates the `Organization` (idempotent — 409 if already created). |
| `POST /api/onboarding/branches` | Owner | LIVE | Creates the first `Branch`. |
| `PATCH /api/onboarding/business-profile` | Owner | LIVE | Updates business type, timezone, etc. |
| `PATCH /api/onboarding/settings` | Owner | LIVE | Currency, language, etc. |
| `POST /api/onboarding/invitations` | Owner | LIVE | Sends Manager + Accountant invitations (see E). |

Step 1 (subscription paid) is implicit — completed by the PesaPal IPN
in section B.

### E. Team Invitations + Membership / Branch Context

| Endpoint | Audience | Live? | Purpose |
|----------|----------|-------|---------|
| `POST /api/onboarding/invitations` | Owner | LIVE | Invite core team. |
| `POST /api/auth/login` | Invited user | LIVE | Same global Nimbus login. No "org login". |
| `GET /api/me` | Invited user | LIVE | Returns memberships → frontend picks org/branch context. (Served by `TenancyController` with no controller prefix.) |

Branch-scoped routes elsewhere (POS, KDS, menu, payments, etc.) require
the `x-branch-id` header. The frontend supplies it after resolving context.

### F. Merchant Booking Website Setup

Branch-scoped (requires `x-branch-id`).

| Endpoint | Audience | Live? | Purpose |
|----------|----------|-------|---------|
| `PATCH /api/merchant/public-profile` | Owner/Manager | LIVE | Edit displayed restaurant profile. |
| `PATCH /api/merchant/public-profile/publish` | Owner/Manager | LIVE | Move profile from DRAFT to PUBLISHED. |
| `PATCH /api/merchant/booking-settings` | Owner/Manager | LIVE | Online reservation settings, hold minutes. |
| `POST /api/merchant/events` | Owner/Manager | LIVE | Create a public event. |
| `PATCH /api/merchant/events/:id` | Owner/Manager | LIVE | Edit event. |
| `PATCH /api/merchant/events/:id/publish` | Owner/Manager | LIVE | Publish event to booking site. |
| `PATCH /api/merchant/events/:id/capacity` | Owner/Manager | LIVE | Adjust capacity. |
| `PATCH /api/merchant/events/:id/pricing` | Owner/Manager | LIVE | Adjust ticket pricing. |

#### Merchant payment-connectivity setup (readiness only — NOT live PesaPal)

| Endpoint | Audience | Live? | Purpose |
|----------|----------|-------|---------|
| `POST /api/merchant/payments/connect` | Owner/Manager | LIVE (config only) | Declare readiness target (`PENDING_MTN` / `PENDING_AIRTEL` / `READY_FOR_INTEGRATION`). Creates a `MerchantPaymentConfig` row with `provider = MOBILE_MONEY`. Does NOT provision any real payment account. |
| `PATCH /api/merchant/payments/config` | Owner/Manager | LIVE (config only) | Update readiness / notes. |
| `GET /api/merchant/payments/status` | Owner/Manager | LIVE (config only) | Returns `{ readiness, live, message }`. `live` is always `false` until the mobile-money integration is wired. |
| `POST /api/merchant/payments/pesapal/connect` *(legacy alias)* | Owner/Manager | LIVE (config only) | Backward-compat alias for `connect`. **Does NOT create a real PesaPal merchant account.** Kept only to avoid breaking earlier callers. |
| `PATCH /api/merchant/payments/pesapal/config` *(legacy alias)* | Owner/Manager | LIVE (config only) | Backward-compat alias for `config`. |

The legacy `pesapal/...` paths are deliberately retained but their
semantics are now generic. Do not advertise them as live PesaPal
collection. Prefer the generic paths going forward.

### G. Public Booking & Event Workflow (diner-facing, no auth)

| Endpoint | Audience | Live? | Purpose |
|----------|----------|-------|---------|
| `GET /api/public/restaurants` | Diner | LIVE | Browse published restaurants. |
| `GET /api/public/restaurants/:slug` | Diner | LIVE | Restaurant detail. |
| `GET /api/public/restaurants/:slug/availability` | Diner | LIVE | Availability for date/time. |
| `GET /api/public/restaurants/:slug/events` | Diner | LIVE | Restaurant's published events. |
| `GET /api/public/events` | Diner | LIVE | Cross-restaurant event browse. |
| `GET /api/public/events/:slug` | Diner | LIVE | Event detail. |
| `POST /api/public/reservations/hold` | Diner | LIVE | Create 15-minute reservation hold. |
| `POST /api/public/reservations/confirm` | Diner | LIVE | Confirm hold WITHOUT payment. |
| `POST /api/public/event-bookings/hold` | Diner | LIVE | Create 15-minute event ticket hold. |
| `POST /api/public/event-bookings/confirm` | Diner | LIVE | Confirm ticket hold WITHOUT payment. |

`/confirm` paths intentionally complete without a payment step today,
because section H is not live. When mobile money goes live, confirmation
will become deposit-conditional.

### H. Public Commerce Payments — PENDING Mobile Money Integration

**SCAFFOLD ONLY. NOT LIVE. NOT PESAPAL.**

| Endpoint | Audience | Live? | Purpose |
|----------|----------|-------|---------|
| `POST /api/public/payments/reservations/checkout-session` | Diner | **PENDING** | Validates payload, creates a `PendingPaymentIntent`, returns `{ status: "PENDING_INTEGRATION", provider: "MOBILE_MONEY", ... }`. |
| `POST /api/public/payments/event-bookings/checkout-session` | Diner | **PENDING** | Same shape, for event tickets. |
| `GET /api/public/payments/callback` | Future provider redirect | **PENDING** | Reserved URL. Returns the pending response. |
| `POST /api/public/payments/ipn` | Future provider webhook | **PENDING** | Reserved URL. Returns the pending response. |
| `POST /api/public/payments/reconcile-status` | Diner / future ops | **PENDING** | Returns the pending response. |

These endpoints are wired through `PublicCommercePaymentsService`, which
is documented as scaffold-only. They MUST NOT be described as live
PesaPal checkout in any documentation.

### I. Developer Portal (per-org integrations)

| Endpoint | Audience | Live? | Purpose |
|----------|----------|-------|---------|
| `POST /api/dev/api-keys` | Owner | LIVE | Create API key. |
| `GET /api/dev/api-keys` | Owner | LIVE | List API keys. |
| `POST /api/dev/api-keys/:id/revoke` | Owner | LIVE | Revoke API key. |
| `POST /api/dev/webhooks` | Owner | LIVE | Register an OUTBOUND webhook (Nimbus → customer URL). NOT a payment callback. |
| `GET /api/dev/webhooks` | Owner | LIVE | List outbound webhooks. |
| `PATCH /api/dev/webhooks/:id` | Owner | LIVE | Edit outbound webhook. |
| `GET /api/dev/usage` | Owner | LIVE | Per-org API usage. |
| `GET /api/dev/admins` | Owner | LIVE | List org developer admins. |
| `POST /api/support/sessions` | Owner | LIVE | Open a support session against Nimbus. |
| `GET /api/support/sessions` | Owner | LIVE | List org's support sessions. |
| `PATCH /api/support/sessions/:id/close` | Owner | LIVE | Close a support session. |

### J. Nimbus Internal Ops Portal (Nimbus staff only)

| Endpoint | Audience | Live? | Purpose |
|----------|----------|-------|---------|
| `GET /api/ops/customers` | Nimbus staff | LIVE | All customer orgs. |
| `GET /api/ops/customers/:orgId` | Nimbus staff | LIVE | Customer detail (org + subscription + onboarding + merchant readiness). |
| `GET /api/ops/subscriptions/due` | Nimbus staff | LIVE | Subscriptions whose period is ending. |
| `GET /api/ops/subscriptions/grace-period` | Nimbus staff | LIVE | Subscriptions in PAST_DUE. |
| `GET /api/ops/onboarding/pipeline` | Nimbus staff | LIVE | Cross-customer onboarding funnel. |
| `GET /api/ops/merchant-payments/status` | Nimbus staff | LIVE | All restaurants' public-payment readiness. Reflects `MerchantPaymentConfig` (PENDING_MTN / PENDING_AIRTEL / READY_FOR_INTEGRATION / LIVE / DISABLED). NOT a list of live PesaPal merchants. |
| `GET /api/ops/support/sessions` | Nimbus staff | LIVE | All open support sessions. |
| `POST /api/ops/support/sessions` | Nimbus staff | LIVE | Open support session targeting a customer org. |
| `PATCH /api/ops/support/sessions/:id/close` | Nimbus staff | LIVE | Close. |

---

## End-to-end story (chronological)

1. Owner visits marketing site → `GET /api/public/plans`.
2. Owner registers + logs in → `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me`.
3. Owner picks plan → `POST /api/billing/pesapal/checkout-session` → redirect to PesaPal.
4. PesaPal callback + IPN → `POST /api/billing/pesapal/ipn` → subscription ACTIVE.
5. Onboarding wizard runs through `POST /api/onboarding/organization` → `branches` → `business-profile` → `settings`.
6. Owner invites Manager + Accountant → `POST /api/onboarding/invitations`.
7. Manager logs into Nimbus globally → `GET /api/me` resolves their org/branch.
8. Restaurant configures booking site → `PATCH /api/merchant/public-profile`, `publish`, `POST /api/merchant/events`.
9. Restaurant declares public-payment readiness → `POST /api/merchant/payments/connect` (PENDING_MTN). Stays pending until mobile-money goes live.
10. Diner browses booking site → `GET /api/public/restaurants*`, `GET /api/public/events*`.
11. Diner creates a hold → `POST /api/public/reservations/hold` (or event-bookings/hold).
12. Diner *would* pay → `POST /api/public/payments/reservations/checkout-session` returns `PENDING_INTEGRATION / MOBILE_MONEY`.
13. Diner confirms hold without payment for now → `POST /api/public/reservations/confirm`.
14. Nimbus ops monitors via `GET /api/ops/customers`, `subscriptions/due`, `onboarding/pipeline`, `merchant-payments/status`, `support/sessions`.

## Security rules applied

- No payment secrets in code, docs, seeds, Postman, or completion reports.
- PesaPal credentials read from env: `PESAPAL_CONSUMER_KEY`,
  `PESAPAL_CONSUMER_SECRET`, `PESAPAL_BASE_URL`, `PESAPAL_IPN_CALLBACK_URL`.
- No raw card data is stored or returned anywhere.
- No mobile-money PINs are stored. The future MTN/Airtel adapter will
  follow the M13.1 / M13.2 patterns and never persist sensitive
  credentials.
- Any previously shared payment credentials are treated as compromised
  and not repeated in this repo.
