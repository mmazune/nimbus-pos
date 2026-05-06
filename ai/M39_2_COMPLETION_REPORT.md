# Completion Report — M39.2 — Client Onboarding + Membership Context + Merchant Public Setup

## Context Snapshot

- Current milestone: **M39.2 — Client Onboarding + Membership Context + Merchant Public Setup**
- Previous completed milestone: **M39.1 — Commercial Foundation + SaaS Billing + Developer Portal**
- Next milestone: **M39.3 — Public Diner Payment Execution (MTN/Airtel native)**

## Continuity from M39.1

- **Reused, NOT re-implemented:**
  - `BillingService.checkPlanLimit('BRANCH', …)` — the single location-cap
    enforcement point introduced in M39.1.
  - SaaS PesaPal billing flows (`/billing/pesapal/*`).
  - Developer Portal (`/dev/api-keys`, `/dev/webhooks`, `/dev/usage`,
    `/dev/admins`).
  - Ops Plan-Catalog Admin (`/ops/plans/*`).
  - SOLO / GROWTH / FRANCHISE plans, locked pricing, full-feature-set
    policy with `featureGating: false` exposed to `/public/plans`.
- **Subscription lifecycle, support sessions, plan-cap structured `409`
  with `recommendedNextPlan`** are all left intact and now consumed by the
  M39.2 onboarding branch creation path.

## Summary

- What was built:
  - **`/auth/me` membership context block** — frontend can now resolve org
    + branch immediately after a global Nimbus login.
  - **Real onboarding invitations** — `User + UserRole + Membership` rows
    created with one-time `tempPassword` + `invitationToken` per invitee;
    role limited to `Manager` and `Accountant` during the wizard.
  - **Branch-creation location-cap reuse** — `client-onboarding.createBranch
    ()` consults `BillingService.checkPlanLimit('BRANCH')` whenever a
    subscription exists.
  - **Booking settings persistence** — `PATCH /merchant/booking-settings`
    now stores into `PublicProfile.metadata.bookingSettings` and audits.
  - **Strengthened event capacity / pricing rules** — capacity refusal
    when below `bookedCount`; pricing requires positive amount when
    flipped to paid; both audited.
  - **Postman collection** with explicit invited-user first-login story.
- What is now working:
  - Owner can complete the entire 7-step wizard end-to-end and the invited
    Manager can log in globally and have their branch context auto-resolved.
  - Branch creation respects M39.1 SOLO / GROWTH / FRANCHISE caps.
  - Merchant public-profile + booking-settings + events are all branch-scoped
    and audited.
  - Merchant payment readiness remains generic (no diner PesaPal).

## Files Added / Changed

### Changed
- [apps/api/src/modules/auth/auth.service.ts](apps/api/src/modules/auth/auth.service.ts) — `me()` now returns `memberships[]` + `context` block.
- [apps/api/src/modules/client-onboarding/client-onboarding.service.ts](apps/api/src/modules/client-onboarding/client-onboarding.service.ts) — real invitation flow (`createInvitations` + private `inviteOne`).
- [apps/api/src/modules/public-commerce/public-commerce.service.ts](apps/api/src/modules/public-commerce/public-commerce.service.ts) — booking-settings persistence + capacity/pricing strengthening + extra audits.
- [apps/api/src/modules/public-commerce/public-commerce.controller.ts](apps/api/src/modules/public-commerce/public-commerce.controller.ts) — wires `PATCH /merchant/booking-settings` to the new service method.
- [apps/api/src/modules/client-onboarding/client-onboarding.service.spec.ts](apps/api/src/modules/client-onboarding/client-onboarding.service.spec.ts) — invitation + location-cap test suite.
- [apps/api/src/modules/public-commerce/public-commerce.service.spec.ts](apps/api/src/modules/public-commerce/public-commerce.service.spec.ts) — booking-settings + capacity/pricing tests appended.
- [ai/AI_STATUS.md](ai/AI_STATUS.md) — M39.2 status block + counters bumped.

### Added
- [apps/api/src/modules/auth/me-membership-context.spec.ts](apps/api/src/modules/auth/me-membership-context.spec.ts) — focused tests for `me()` membership/context shape (4 cases).
- [postman/collections/M39.2-Onboarding-Membership-Merchant-Public-Setup.postman_collection.json](postman/collections/M39.2-Onboarding-Membership-Merchant-Public-Setup.postman_collection.json) — full M39.2 collection.
- [ai/M39_2_COMPLETION_REPORT.md](ai/M39_2_COMPLETION_REPORT.md) — this file.

## Database

- Prisma models added/changed: **none**. M39.2 reuses existing schema only:
  `User`, `UserRole`, `Role`, `Membership` (already had `unique([userId,
  branchId])`), `OnboardingProgress`, `PublicProfile.metadata` (Json),
  `PublicEvent`, `MerchantPaymentConfig`.
- Migration name: **none** (no schema delta).
- Indexes / constraints: the existing `Membership @@unique([userId,
  branchId])` is the idempotency key for the invitation flow.
- Seed updates: none.
- Notes: the invitation `tempPassword` is returned in the API response only
  (one-time) and stored as a bcrypt hash in `User.passwordHash`. The
  `invitationToken` is stateless (server does not persist it — it serves as
  a tracking handle for the response payload).

## API

### Endpoint architecture (M39.2 surface)

**A. Auth & Context (auth domain)**
- `POST /auth/login` — unchanged (global login)
- `GET /auth/me` — **enhanced**: now returns `memberships[]` + `context`

**B–E. Client Onboarding (`onboarding/`)**
- `GET /onboarding/status`
- `POST /onboarding/organization`
- `POST /onboarding/branches` (location-cap enforced via M39.1)
- `PATCH /onboarding/business-profile`
- `PATCH /onboarding/settings`
- `POST /onboarding/invitations` — **rewritten**: real `User + Membership`

**F–H. Merchant public setup (`merchant/` — branch-scoped)**
- `PATCH /merchant/public-profile`
- `PATCH /merchant/public-profile/publish`
- `PATCH /merchant/booking-settings` — **wired**
- `POST /merchant/events`
- `PATCH /merchant/events/:id`
- `PATCH /merchant/events/:id/capacity` — refuses below `bookedCount`
- `PATCH /merchant/events/:id/pricing` — refuses paid without amount
- `PATCH /merchant/events/:id/publish`

**I. Merchant payment readiness (`merchant/payments/`)**
- `POST /merchant/payments/connect`
- `PATCH /merchant/payments/config`
- `GET /merchant/payments/status`
- (legacy aliases `/merchant/payments/pesapal/*` retained)

### Guards applied
- `JwtAuthGuard + PermissionGuard` on all authenticated endpoints.
- `BranchContextGuard + @RequireBranchContext()` on every merchant
  endpoint that operates on branch-scoped data (`F.*`, `G.*`, `H.*`).
- `Permissions('onboarding:read'|'onboarding:write')` on onboarding
  routes; `merchant:public-profile:write`, `merchant:events:write`,
  `merchant:payment:read|write` on the merchant routes.

### Audit coverage (M39.2 emissions)
- `ONBOARDING_ORG_CREATED`
- `ONBOARDING_BRANCH_CREATED`
- `ONBOARDING_BUSINESS_PROFILE_UPDATED`
- `ONBOARDING_SETTINGS_UPDATED`
- `ONBOARDING_INVITATIONS_SENT`
- `ONBOARDING_INVITATION_CREATED` (new — per-invitee row)
- `PUBLIC_PROFILE_UPDATED`, `PUBLIC_PROFILE_PUBLISHED`
- `MERCHANT_BOOKING_SETTINGS_UPDATED` (new)
- `PUBLIC_EVENT_CREATED`, `PUBLIC_EVENT_UPDATED`, `PUBLIC_EVENT_PUBLISHED`
- `PUBLIC_EVENT_CAPACITY_UPDATED` (new)
- `PUBLIC_EVENT_PRICING_UPDATED` (new)
- `MERCHANT_PAYMENT_CONNECT_INITIATED`, `MERCHANT_PAYMENT_CONFIG_UPDATED`

### Idempotency coverage
- Onboarding step transitions are `upsert`-based and refuse re-completion
  (`409` on second `POST /onboarding/organization`, etc.).
- Invitation creates `User + Membership` only when missing, so re-invites
  are safe and surface `status: 'ALREADY_MEMBER'`.

## Tests

- Unit tests:
  - `me-membership-context.spec.ts` — 4 tests
  - `client-onboarding.service.spec.ts` — 14 tests (added invitation +
    location-cap suites)
  - `public-commerce.service.spec.ts` — 22 tests (added booking-settings,
    capacity, pricing)
  - `merchant-payments.service.spec.ts` — 13 tests (unchanged, regression
    safe)
  - `billing.service.spec.ts` — 40 tests (unchanged, regression safe)
- Commands run:
  ```pwsh
  npx jest --testPathPattern="me-membership-context|client-onboarding.service.spec|public-commerce.service.spec|merchant-payments.service.spec|billing.service.spec" --no-coverage --runInBand
  ```
- Results: **5 suites passed, 93 tests passed, 0 failures**.

## Postman

- Collection added: [postman/collections/M39.2-Onboarding-Membership-Merchant-Public-Setup.postman_collection.json](postman/collections/M39.2-Onboarding-Membership-Merchant-Public-Setup.postman_collection.json)
- Folder structure (run order):
  - `00 Read Me`
  - `A. Auth & Context Resolution`
  - `B. Onboarding Status`
  - `C. Organization + Branch Creation`
  - `D. Business Profile + Settings`
  - `E. Team Invitations & First Login Story` (includes Manager `/auth/login` + `/auth/me`)
  - `F. Merchant Public Profile`
  - `G. Booking Settings`
  - `H. Merchant Events`
  - `I. Merchant Payment Readiness`
- Variables auto-captured: `accessToken`, `orgId`, `branchId`,
  `membershipId`, `managerEmail`, `managerTempPassword`,
  `managerAccessToken`, `managerMembershipId`, `accountantTempPassword`,
  `publicProfileSlug`, `eventId`, `eventSlug`.
- Per-request descriptions explain audience, purpose, and a real-world
  example, and the `00 Read Me` request narrates the locked workflow rules
  + chronological story.

## Docs

- ROADMAP status impact: M39.2 is a repo-local split — ROADMAP M39 line
  unchanged. Public diner payment execution remains deferred to the
  MTN / Airtel mobile-money adapter. **No hotel / property-group
  milestone is planned in this repo split**; the POS backend track
  stays restaurant-focused.
- Files updated: [ai/AI_STATUS.md](ai/AI_STATUS.md), this completion report.

## DONE Checks

- `npx tsc --noEmit`: **0 new errors** in M39.2 files. Only 4 pre-existing
  errors in `accounts-receivable.service.spec.ts` (not touched by M39.2).
- `npx jest …`: **5 suites passed, 93 tests passed, 0 failures** for the
  M39.2-affected modules.
- `pnpm db:generate`: not re-run — no schema delta in M39.2.
- `pnpm db:migrate` / `pnpm db:seed`: not re-run — no migration / seed
  changes in M39.2.

## Decisions / Deviations

1. **No new migration.** Booking settings reuse the existing
   `PublicProfile.metadata` JSON column (`metadata.bookingSettings`).
   Invitations reuse existing `User` + `Membership` tables. The
   `invitationToken` is intentionally stateless (returned only).
2. **Invitation tempPassword** is returned ONCE in the response. There is
   no email service in scope for M39.2; password handover happens
   out-of-band. M39.3+ may add email-based activation tokens.
3. **Onboarding invitations are restricted to Manager / Accountant.**
   Other staff roles return `400` with an explicit message that broader
   staff are added later from inside the app — matches the locked
   workflow rules in the prompt.
4. **`PATCH /merchant/booking-settings` auto-creates a DRAFT
   `PublicProfile`** if none exists yet. This lets the owner configure
   booking rules before publishing the public-facing profile.
5. **Merchant payment readiness was already aligned** by the M39
   correction — no further refactor was needed. M39.2 only confirms via
   tests that responses use `provider: 'MOBILE_MONEY'`, the readiness
   enum, and `live: false` until the integration ships.

## Known Issues

1. **Invitation email delivery is not wired.** The owner must communicate
   the `tempPassword` to the invitee via a secure channel. Email
   integration is a future-milestone concern.
2. **Public diner payment execution still pending (M39.3).** Public
   reservation / event-booking holds work, paid event confirmations still
   reject with the `PENDING_INTEGRATION` message from M39 correction.

## Next Step

- M39.3 — Public Diner Payment Execution (MTN / Airtel native mobile-money
  adapter; flips `MerchantPaymentConfig` to `LIVE` once wired and enables
  `/public/payments/*` endpoints).
- ROADMAP M40+ remains untouched.
