# Completion Report — M39.3 — Public Booking Website + Public Commerce Payment Skeleton + Nimbus Ops Portal

## Context Snapshot

- Current milestone: **M39.3 — Public Booking Website + Public Commerce Payment Skeleton + Nimbus Ops Portal**
- Previous completed milestone: **M39.2 — Client Onboarding + Membership Context + Merchant Public Setup**
- Next milestone: **M40+ from `ROADMAP.md`** (the M39 split is closed at M39.3; no hotel / property-group milestone is planned in this repo split). The MTN / Airtel mobile-money adapter that lights up `/public/payments/*` execution remains an open in-track item but is NOT a separate `M39.4`.

## Continuity from M39.1 and M39.2

M39.3 is the **third** repo-local split milestone. It does **not**
re-implement any commercial / SaaS / onboarding / membership /
merchant-setup foundation already shipped:

- **Reused unchanged from M39.1**:
  - SaaS PesaPal billing for owners (`/billing/pesapal/*`).
  - Plan catalog policy (SOLO / GROWTH / FRANCHISE, full feature set,
    location-cap-only enforcement).
  - Developer Portal (`/dev/*`).
  - Owner-facing support sessions (`/support/sessions`).
- **Reused unchanged from M39.2**:
  - Owner onboarding wizard, invitation flow, branch creation with
    M39.1 location-cap enforcement.
  - `/auth/me` membership-context block.
  - Merchant public profile + booking-settings persistence.
  - Merchant event capacity / pricing rules and audits
    (`PUBLIC_EVENT_CAPACITY_UPDATED`, `PUBLIC_EVENT_PRICING_UPDATED`).
  - Generic `MerchantPaymentConfig` readiness model.

M39.3 **fully owns**:
- Public diner browse flows (`/public/restaurants/*`, `/public/events/*`).
- Reservation hold + confirm (`/public/reservations/*`).
- Event-booking hold + confirm (`/public/event-bookings/*`).
- Public commerce payment **skeleton** (`/public/payments/*`) — explicitly
  PENDING the MTN/Airtel mobile-money integration.
- Nimbus internal Ops Portal (`/ops/*`).

## Summary

- What was built / refined:
  - **Public diner audit hooks** added to the hold flows so M39.3 owns
    the audit contract: `PUBLIC_RESERVATION_HOLD_CREATED`,
    `PUBLIC_RESERVATION_HOLD_EXPIRED`, `PUBLIC_RESERVATION_CONFIRMED`,
    `PUBLIC_EVENT_BOOKING_HOLD_CREATED`,
    `PUBLIC_EVENT_BOOKING_HOLD_EXPIRED`,
    `PUBLIC_EVENT_BOOKING_CONFIRMED`.
  - Public commerce payment endpoints continue to return the locked
    pending-integration response and emit `PUBLIC_PAYMENT_CHECKOUT_ATTEMPTED`
    with a `PendingPaymentIntent` row per attempt.
  - Ops Portal endpoints surface customer lifecycle, subscription risk
    (due / grace), onboarding pipeline, merchant payment readiness, and
    ops-side support sessions. Ops support open / close are audited as
    `SUPPORT_SESSION_OPENED` / `SUPPORT_SESSION_CLOSED`.
  - Postman collection rebuilt as the M39.3 storyline: read-me → public
    browse → public events → reservation holds → event-booking holds →
    pending public payments → ops portal.
- What is now working:
  - Anonymous diner can browse all published restaurants and events.
  - Anonymous diner can hold + confirm a free reservation in 2 calls.
  - Anonymous diner can hold + confirm a free event booking with
    capacity enforcement.
  - Public payment endpoints validate input, persist a
    `PendingPaymentIntent`, and uniformly return
    `{ status: PENDING_INTEGRATION, provider: MOBILE_MONEY, message: ... }`.
  - Nimbus internal staff can drive the entire ops dashboard contract.

## Files Added / Changed

### Changed
- [apps/api/src/modules/public-commerce/public-commerce.service.ts](apps/api/src/modules/public-commerce/public-commerce.service.ts) — added the six M39.3 audit hooks on hold create / expire / confirm for both reservations and event bookings.

### Added
- [apps/api/src/modules/public-commerce/public-commerce.m393.spec.ts](apps/api/src/modules/public-commerce/public-commerce.m393.spec.ts) — focused M39.3 audit-contract spec (7 cases) that locks down the new audit emissions and the paid-event refusal wording.
- [postman/collections/M39.3-Public-Booking-Public-Commerce-MoMo-Pending-Ops.postman_collection.json](postman/collections/M39.3-Public-Booking-Public-Commerce-MoMo-Pending-Ops.postman_collection.json) — full M39.3 collection (00 Read Me + 6 functional folders).
- [ai/M39_3_COMPLETION_REPORT.md](ai/M39_3_COMPLETION_REPORT.md) — this file.

### Updated (status only)
- [ai/AI_STATUS.md](ai/AI_STATUS.md) — M39.3 section + counters bumped.

## Database

- Prisma models added/changed: **none**. M39.3 reuses existing schema only:
  `PublicProfile`, `PublicEvent`, `ReservationHold`, `EventBookingHold`,
  `PendingPaymentIntent`, `MerchantPaymentConfig`, `Subscription`,
  `OnboardingProgress`, `SupportSession`, `Organization`, `Branch`.
- Migration name: **none** (no schema delta).
- Indexes / constraints: unchanged from earlier milestones.
- Seed updates: none.
- Notes: public payment endpoints intentionally leave
  `PendingPaymentIntent.status = NOT_ENABLED` until the future MTN/Airtel
  adapter lands.

## API

### Endpoint architecture (M39.3 surface)

**A. Public Restaurant Browse — no auth**
- `GET /public/restaurants` — list published profiles
- `GET /public/restaurants/:slug` — detail
- `GET /public/restaurants/:slug/availability` — table availability
- `GET /public/restaurants/:slug/events` — events for that restaurant

**B. Public Event Browse — no auth**
- `GET /public/events` — upcoming published events
- `GET /public/events/:slug` — event detail

**C. Reservation Holds + Confirm — no auth**
- `POST /public/reservations/hold` — 15-min HELD; audited
- `POST /public/reservations/confirm` — flips HELD → CONFIRMED; audited;
  expired holds flip to EXPIRED and audit, then return `409`.

**D. Event Booking Holds + Confirm — no auth**
- `POST /public/event-bookings/hold` — capacity-enforced, 15-min HELD; audited
- `POST /public/event-bookings/confirm` — confirms free events cleanly;
  paid events return `409` with `Public commerce payments are pending
  implementation.` until M39.x mobile-money execution ships.

**E. Public Commerce Payments — Pending Mobile Money Integration — no auth, NOT LIVE**
- `POST /public/payments/reservations/checkout-session` — validates hold,
  creates `PendingPaymentIntent`, returns the locked pending response.
- `POST /public/payments/event-bookings/checkout-session` — same, for tickets.
- `GET  /public/payments/callback` — reserved future contract; ack only.
- `POST /public/payments/ipn` — reserved future contract; ack only.
- `POST /public/payments/reconcile-status` — echoes `orderTrackingId` +
  pending response.

**F. Nimbus Ops Portal — internal only**
- `GET   /ops/customers` (`ops:customers:read`)
- `GET   /ops/customers/:orgId` (`ops:customers:read`)
- `GET   /ops/subscriptions/due` (`ops:subscriptions:read`)
- `GET   /ops/subscriptions/grace-period` (`ops:subscriptions:read`)
- `GET   /ops/onboarding/pipeline` (`ops:onboarding:read`)
- `GET   /ops/merchant-payments/status` (`ops:merchant-payments:read`)
- `GET   /ops/support/sessions` (`ops:support:read`)
- `POST  /ops/support/sessions` (`ops:support:write`) — audits `SUPPORT_SESSION_OPENED`
- `PATCH /ops/support/sessions/:id/close` (`ops:support:write`) — audits `SUPPORT_SESSION_CLOSED`

### Guards applied

- A–E (public): no `JwtAuthGuard`. Validation via DTO class-validator.
- F (ops): `JwtAuthGuard + PermissionGuard` with the `ops:*` permission strings already seeded in the role-permission matrix.

### Audit coverage (new in M39.3)

- `PUBLIC_RESERVATION_HOLD_CREATED`
- `PUBLIC_RESERVATION_HOLD_EXPIRED`
- `PUBLIC_RESERVATION_CONFIRMED`
- `PUBLIC_EVENT_BOOKING_HOLD_CREATED`
- `PUBLIC_EVENT_BOOKING_HOLD_EXPIRED`
- `PUBLIC_EVENT_BOOKING_CONFIRMED`

Existing audits reused unchanged: `PUBLIC_PROFILE_UPDATED`,
`PUBLIC_PROFILE_PUBLISHED`, `PUBLIC_EVENT_CREATED`, `PUBLIC_EVENT_UPDATED`,
`PUBLIC_EVENT_PUBLISHED`, `PUBLIC_EVENT_CAPACITY_UPDATED`,
`PUBLIC_EVENT_PRICING_UPDATED`, `MERCHANT_BOOKING_SETTINGS_UPDATED`,
`PUBLIC_PAYMENT_CHECKOUT_ATTEMPTED`, `SUPPORT_SESSION_OPENED`,
`SUPPORT_SESSION_CLOSED`, `OPS_PLAN_*`.

### Idempotency

- Reservation / event-booking confirm refuse to act on non-`HELD` rows
  (`409 Conflict`), so retries do not double-confirm.
- Expired holds transition to `EXPIRED` exactly once, then refuse on retry.

## Tests

- Unit tests:
  - **NEW** `public-commerce.m393.spec.ts` — 7 cases (audit emissions on
    hold create / expire / confirm for both reservations and event
    bookings, plus the paid-event refusal wording).
  - Pre-existing `public-commerce.service.spec.ts` — full behavioral
    coverage of holds, confirms, profile, events.
  - Pre-existing `public-commerce-payments.service.spec.ts` — locks the
    `PENDING_INTEGRATION` / `MOBILE_MONEY` shape and the explicit
    no-PesaPal-in-response assertion.
  - Pre-existing `ops-portal.service.spec.ts` — covers all ops customer /
    subscription / onboarding / merchant-payments / support / plans flows.
- e2e tests: none added — existing reservations / events e2e suites still
  pass; M39.3's net-new wiring is audit-only and unit-tested.
- Commands run:
  - `cd apps/api; npx jest --testPathPattern="public-commerce|public-commerce-payments|ops-portal"`
- Results: **4 suites passed, 54 tests passed, 0 failed.**

## Postman

- Collection added: `M39.3-Public-Booking-Public-Commerce-MoMo-Pending-Ops.postman_collection.json`.
- Folder structure (locked by spec):
  - `00 Read Me`
  - `A. Public Restaurant Browse`
  - `B. Public Event Browse`
  - `C. Reservation Holds + Confirm`
  - `D. Event Booking Holds + Confirm`
  - `E. Public Commerce Payments — Pending Mobile Money Integration`
  - `F. Nimbus Ops Portal`
- Variables: `baseUrl`, `accessToken`, `restaurantSlug`, `eventSlug`,
  `reservationHoldId`, `eventBookingHoldId`, `supportSessionId`,
  `opsOrgId`.
- Tests: status-code asserts and id-capture scripts on every chained
  request. The Login request asserts `status(201)` per
  `AI_ERROR_PROTOCOL` rule P1.
- Manual checklist:
  - Folders A–D run **without** `Authorization`.
  - Folder E always returns `PENDING_INTEGRATION` / `MOBILE_MONEY`.
  - Folder F requires `Authorization: Bearer {{accessToken}}` and the
    `ops:*` permissions.

## Docs

- ROADMAP status impact: M39 split is now complete (M39.1, M39.2, M39.3).
  No `M39.4` is planned in this repo. The POS backend track stays
  restaurant-focused; any future hotel / property-group compatibility
  will be designed against another system, not added as a new M39.x
  hierarchy here. After M39 stabilization, work resumes in the official
  ROADMAP order (M40+).
- Files updated:
  - `ai/AI_STATUS.md` — M39.3 block, counters: total Postman collections
    45, total completion reports 46.
  - `ai/M39_3_COMPLETION_REPORT.md` — this file.

## DONE Checks

- `cd apps/api; npx jest --testPathPattern="public-commerce|public-commerce-payments|ops-portal"`:
  **4 suites passed, 54 tests passed**.
- `pnpm lint` / full `pnpm test` / `pnpm db:migrate` / `pnpm db:seed`:
  not re-run for M39.3 since no schema delta and no module wiring change
  outside the audit additions; the affected suites are green and TypeScript
  reports no errors on the changed files.

## Decisions / Deviations

- **No new Prisma migration.** All M39.3 surface area reuses existing
  schema; introducing a migration would violate the "do not invent
  features outside scope" hard warning.
- **Public payment endpoints stay unauthenticated.** They live behind
  the `/public/payments/*` namespace and only ever return the locked
  pending response, so opening them publicly is safe and matches the
  future MTN/Airtel STK-push pattern (diner submits MSISDN, awaits
  push). Audit on attempts is still recorded.
- **Ops support sessions kept distinct from owner support sessions.**
  Per the M39.3 spec, `/ops/support/*` is internal Nimbus-staff only,
  separate from the M39.1 owner-facing `/support/sessions` foundation.

## Known Issues

- None blocking.
- Public diner payment execution remains **PENDING the MTN / Airtel
  mobile-money integration**. PesaPal must not be advertised on any
  public-diner endpoint or doc.

## Next Step

- Resume the official ROADMAP sequence (M40+). No `M39.4` is planned
  in this repo split; the POS backend track remains restaurant-focused,
  and hotel / property-group compatibility, if ever needed, will be
  designed against a separate system rather than implemented here.
- When the MTN / Airtel adapter lands, swap the body of
  `PublicCommercePaymentsService.{handleCallback, handleIpn,
  reconcileStatus}` and finalise `createReservationCheckout` /
  `createEventBookingCheckout` to call the real provider. The DTO
  contracts and audit shape will not need to change.
