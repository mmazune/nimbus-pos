# Completion Report — M39.1 Commercial Foundation + SaaS Billing + Developer Portal

## Context Snapshot

- Current milestone: **M39.1 — Commercial Foundation + SaaS Billing + Developer Portal**
- Previous completed milestone: **M39 Plan-Catalog Correction — SOLO / GROWTH / FRANCHISE (location-only enforcement)**
- Next milestone: **M40 — TBD (see ROADMAP.md)**. The M39 split continues with M39.2 (onboarding / membership) and M39.3 (public booking + ops). **No hotel / property-group milestone is planned in this repo split.**

## Business Rules Applied (locked)

- Plans = **SOLO (1 location), GROWTH (≤3), FRANCHISE (4+)**.
- Pricing = SOLO USD 80/mo (864/yr), GROWTH USD 150/mo (1620/yr), FRANCHISE USD 200/mo (2160/yr) — annual ≈ 10% discount.
- **All plans grant the full Nimbus feature set.** No feature gating by plan tier.
- The **only enforced commercial cap is location count** (`Plan.maxBranches`, surfaced as `maxLocations`).
- **PesaPal is LIVE for owner SaaS billing only** — owners pay Nimbus for their subscription. PesaPal is NOT used for diner / restaurant payments in this milestone.
- API keys are **full-access integration keys** for trusted backend systems (owner-controlled servers, franchise IT, accounting integrations) — not for staff, browsers, or diners.
- Outbound developer webhooks (Nimbus → customer URL) are completely separate from inbound PesaPal callbacks (PesaPal → Nimbus).

## Summary

- What was built: M39.1 is a repo-local **split** of the prior M39 reconstruction. The good engineering already in place — `billing/`, `billing-pesapal/`, and `ops-portal/` modules with full lifecycle handling, location-only enforcement, ops plan-catalog admin, and developer portal — is **preserved**. M39.1 adds final wording / response-shape alignment, additional lifecycle tests, and a single canonical Postman collection that frames the surface area as "the commercial and platform-control foundation".
- What is now working:
  - Plan catalog (`/public/plans`, `/billing/plans`) returning SOLO / GROWTH / FRANCHISE with locked pricing, location cap, and a `policy.featureGating: false` note. **No feature-gating fields are returned anywhere.**
  - Billing overview (`GET /billing`) with a `locationCapacity` block that drives every UI upgrade prompt.
  - Subscription lifecycle covering PENDING_PAYMENT → ACTIVE → GRACE_PERIOD / PAST_DUE / SUSPENDED / CANCELLED, plus monthly ↔ annual and solo ↔ growth ↔ franchise transitions, with location-only validation on every plan change.
  - PesaPal SaaS checkout (`/billing/pesapal/{checkout-session, callback, ipn, reconcile-status}`) — LIVE — with PesaPal v3 token caching, IPN registration, idempotent re-checkout, and CANCELLED-on-retry semantics.
  - Developer portal (`/dev/api-keys`, `/dev/webhooks`, `/dev/usage`, `/dev/admins`) — keys returned in plaintext exactly once, signing secrets returned once, `/dev/usage` leads with the location-cap context.
  - Owner-facing support sessions (`/support/sessions` open / list / close) with 4-hour default expiry.
  - Internal Nimbus ops plan-catalog admin (`/ops/plans` + subscribers) with refusals on annual > 12 × monthly, lowering caps below current subscribers, and archiving plans with live subscribers.

## File-by-File Changes

### Refactored
- `apps/api/src/modules/public-commerce/public-commerce.controller.ts` — `GET /public/plans` rewritten to drop `maxUsers`, `analyticsEnabled`, `franchiseEnabled` and to return `{ policy: { enforcedMetric, featureGating: false, note }, plans: [{ code, name, description, priceMonthly, priceAnnual, annualDiscountPct, maxLocations, supportTier }] }` aligned with ops admin shape.

### Tests (added)
- `apps/api/src/modules/billing/billing.service.spec.ts` — 5 new tests:
  - `M39.1: transitions PENDING_PAYMENT → ACTIVE after PesaPal verification`
  - `M39.1: SOLO → GROWTH allowed regardless of user/api-key/webhook count`
  - `M39.1: FRANCHISE → GROWTH blocked when active locations exceed 3`
  - `M39.1: GROWTH at cap returns upgradeRequired=true with recommendedNextPlan=franchise`
  - `M39.1: getUsage emphasizes location capacity at the top level`

### Tests (fixed pre-existing TS errors)
- `apps/api/src/modules/billing-pesapal/billing-pesapal.service.spec.ts` — added missing `updateMany: jest.fn()` to the prisma mock and missing `InternalServerErrorException` import. These were breaking the suite before M39.1 (compile-time errors); fixed to unblock DONE checks.

### Postman (added)
- `postman/collections/M39.1-Commercial-Foundation-SaaS-Billing-Dev-Portal.postman_collection.json` — single canonical M39.1 collection with 8 folders: `00 Read Me`, `A. Auth`, `B. Plan Catalog & Billing Overview`, `C. Subscription Change (location-only enforcement)`, `D. SaaS Billing via PesaPal`, `E. Developer Portal`, `F. Support Sessions`, `G. Ops Plan Catalog Admin`.

### Docs
- `ai/AI_STATUS.md` — updated current state, added M39.1 section, bumped collection count to 43, completion-report count to 44.
- `ai/M39_1_COMPLETION_REPORT.md` — this file.

### Preserved (no change required, already correct)
- `apps/api/src/modules/billing/billing.service.ts` — already implements the full `M39 PLAN-CATALOG CORRECTION` block: `locationCapacity` in overview, location-only enforcement in `checkPlanLimit('BRANCH')`, no-op for `API_KEY` / `WEBHOOK`, `recommendedNextPlan` math, `VALID_TRANSITIONS` including `PENDING_PAYMENT`.
- `apps/api/src/modules/billing/billing.controller.ts` — already exposes `GET /billing`, `GET /billing/plans`, `PATCH /billing/subscription`, `/dev/api-keys`, `/dev/webhooks`, `/dev/usage`, `/dev/admins`, `/support/sessions`.
- `apps/api/src/modules/billing-pesapal/*` — full PesaPal v3 implementation with auth + IPN registration + CANCELLED-on-retry idempotency.
- `apps/api/src/modules/ops-portal/*` — full `/ops/plans` CRUD + subscribers, with locked feature policy, annual ≤ 12 × monthly validation, refuse-cap-lower-when-subscribers-exceed, refuse-archive-with-live-subscribers (force override).
- `packages/db/prisma/seed.ts` — already seeds the locked SOLO / GROWTH / FRANCHISE catalog and all 13 M39 permissions (`billing:read`, `billing:subscription:write`, `billing:pesapal:checkout`, `dev:api-key:{read,write}`, `dev:webhook:{read,write}`, `dev:usage:read`, `support:session:{read,write}`, `ops:plans:{read,write}`, etc.).

## Endpoint Architecture

### B. Plan Catalog & Billing Overview (3 endpoints)
- `GET /api/public/plans` — unauthenticated, M39.1-aligned shape, no feature gating fields.
- `GET /api/billing/plans` — authenticated (`billing:read`).
- `GET /api/billing` — authenticated (`billing:read`), returns `subscription`, `plan`, `limits`, `currentUsage`, **`locationCapacity`** (`current`, `allowed`, `upgradeRequired`, `recommendedNextPlan`, `note`), `usage`.

### C. Subscription Change (1 endpoint)
- `PATCH /api/billing/subscription` (`billing:subscription:write`) — supports `planCode` change, `billingCycle` change, and `status` change in one endpoint. All plan changes call `enforcePlanLimitsOnChange()` which only checks branch count.

### D. SaaS Billing via PesaPal (4 endpoints, LIVE)
- `POST /api/billing/pesapal/checkout-session` — auth (`billing:pesapal:checkout`).
- `GET /api/billing/pesapal/callback` — public (browser redirect from PesaPal).
- `POST /api/billing/pesapal/ipn` — public (PesaPal server-to-server).
- `POST /api/billing/pesapal/reconcile-status` — auth (`billing:pesapal:checkout`).

### E. Developer Portal (8 endpoints)
- `POST /api/dev/api-keys` (`dev:api-key:write`) — returns plaintext `key` once.
- `GET /api/dev/api-keys` (`dev:api-key:read`).
- `POST /api/dev/api-keys/:id/revoke` (`dev:api-key:write`).
- `POST /api/dev/webhooks` (`dev:webhook:write`) — returns `signingSecret` once.
- `GET /api/dev/webhooks` (`dev:webhook:read`).
- `PATCH /api/dev/webhooks/:id` (`dev:webhook:write`).
- `GET /api/dev/usage` (`dev:usage:read`) — leads with `locations` block.
- `GET /api/dev/admins` (`billing:read`).

### F. Support Sessions (3 endpoints)
- `POST /api/support/sessions` (`support:session:write`).
- `GET /api/support/sessions` (`support:session:read`).
- `PATCH /api/support/sessions/:id/close` (`support:session:write`).

### G. Ops Plan Catalog Admin (5 endpoints)
- `GET /api/ops/plans` (`ops:plans:read`) — includes `policy.featureGating: false`.
- `POST /api/ops/plans` (`ops:plans:write`).
- `PATCH /api/ops/plans/:id` (`ops:plans:write`).
- `PATCH /api/ops/plans/:id/status` (`ops:plans:write`).
- `GET /api/ops/plans/:id/subscribers` (`ops:plans:read`).

### Guards applied
- `JwtAuthGuard + PermissionGuard` on every authenticated endpoint above.
- PesaPal `callback` and `ipn` are intentionally public (no guard) — they are reached by PesaPal, not the owner.

### Audit coverage
- `SUBSCRIPTION_PLAN_CHANGED`, `SUBSCRIPTION_STATUS_CHANGED`, `PLAN_LIMIT_ENFORCED`, `USAGE_METERS_REFRESHED`, `API_KEY_CREATED`, `API_KEY_REVOKED`, `WEBHOOK_CREATED`, `WEBHOOK_UPDATED`, `SUPPORT_SESSION_OPENED`, `SUPPORT_SESSION_CLOSED`, `SAAS_CHECKOUT_SESSION_CREATED`, `SAAS_PAYMENT_CONFIRMED`, `SAAS_PAYMENT_FAILED`, `SAAS_PAYMENT_RECONCILED`, `OPS_PLAN_CREATED`, `OPS_PLAN_UPDATED`, `OPS_PLAN_STATUS_CHANGED`.

## Postman Collection

- Path: `postman/collections/M39.1-Commercial-Foundation-SaaS-Billing-Dev-Portal.postman_collection.json`
- Folders (8):
  1. `00 Read Me` — orientation, locked rules.
  2. `A. Auth` — login (auto-captures `accessToken` and `orgId`).
  3. `B. Plan Catalog & Billing Overview` — `/public/plans`, `/billing/plans`, `/billing`.
  4. `C. Subscription Change (location-only enforcement)` — change to GROWTH (allowed), change to ANNUAL, change to SOLO (blocked example), CANCEL.
  5. `D. SaaS Billing via PesaPal` — checkout-session (auto-captures `orderTrackingId`), callback, IPN, reconcile-status.
  6. `E. Developer Portal` — create / list / revoke API key (auto-captures `apiKeyId`); create / list / update webhook (auto-captures `webhookId`); usage; admins.
  7. `F. Support Sessions` — open (auto-captures `supportSessionId`), list, close.
  8. `G. Ops Plan Catalog Admin` — list catalog (auto-captures `planId` for `growth`), create, update, status flip, list subscribers.
- Auto-captured variables: `accessToken`, `orgId`, `planId`, `apiKeyId`, `webhookId`, `supportSessionId`, `orderTrackingId`.
- Inline test scripts assert the M39.1 invariants: `policy.featureGating === false`, plan codes are SOLO / GROWTH / FRANCHISE only, locked pricing, `locationCapacity` block presence, `usage.locations` leads, signing-secret prefix `whsec_`, key prefix `nk_`.

## AI_STATUS Update

`ai/AI_STATUS.md` updated with:
- Last completed milestone → **M39.1 Commercial Foundation + SaaS Billing + Developer Portal**.
- Total Postman collections → 43.
- Total completion reports → 44.
- New section detailing M39.1 (location-only enforcement; PesaPal LIVE only for owner SaaS billing; full feature access on all plans; no hotel / property-group milestone planned in this repo split).

## Tests

- Unit tests (focused suites):
  - `billing.service.spec.ts` — **32/32 pass** (27 prior + 5 new M39.1 assertions).
  - `billing-pesapal.service.spec.ts` — **16/16 pass** (after fixing 2 pre-existing TS-compile errors in mock + import).
  - `public-commerce.service.spec.ts` — **19/19 pass** (no regression from `/public/plans` reshape).
  - `ops-portal.service.spec.ts` — **17/17 pass**.
  - **Total: 84/84 pass across the four M39.1 surface suites.**
- Command run:
  ```
  npx jest --testPathPattern="(billing|public-commerce|ops-portal|billing-pesapal)\.service\.spec"
  ```
- Result: `Test Suites: 4 passed, 4 total. Tests: 84 passed, 84 total.`

## DONE Checks

- `pnpm db:generate` — green (schema unchanged).
- `npx jest` (M39.1 surface suites) — 84/84 pass.
- No new migrations required (M39.1 is API-shape + tests + Postman only).
- Linter — no new warnings introduced; touched files compile cleanly.

## Decisions / Deviations

1. **No new modules created.** The M39 reconstruction already implemented every M39.1 endpoint; M39.1 reorganizes wording, response shape, and Postman framing rather than rebuilding code.
2. `/public/plans` previously selected `maxUsers`, `analyticsEnabled`, `franchiseEnabled` — these are removed from the response because they imply tier-based feature gating which violates the M39.1 locked rule. The shape now matches the ops admin shape (`{ policy, plans: [{ code, name, description, priceMonthly, priceAnnual, annualDiscountPct, maxLocations, supportTier }] }`).
3. Pre-existing TS errors in `billing-pesapal.service.spec.ts` (missing `updateMany` mock function and missing `InternalServerErrorException` import) were fixed as part of this milestone because they blocked the M39.1 DONE check; the underlying service code was untouched.
4. Login is asserted as `[200, 201]` in Postman because Nest's default for POST is 201 while existing M39 collections asserted 200; both responses produce a valid `accessToken`.
5. Public commerce (restaurants, events, holds), merchant payment connectivity, and public-side diner payments stay under the M39 reconstruction footprint and are explicitly **out of M39.1 scope**.
6. **No hotel / property-group milestone is planned in this repo split.** The POS backend track stays restaurant-focused; future work resumes in the official ROADMAP order (M40+).

## Known Issues

1. PesaPal endpoints require valid `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, and `PESAPAL_IPN_CALLBACK_URL` env vars; without them the checkout endpoint returns `500 InternalServerErrorException("PesaPal credentials not configured")`. Documented in the Postman collection's request description.
2. The pre-existing seed file has 1 unrelated TS warning around `WebhookEventType` (carried over from M39 reconstruction); not in M39.1 scope.
3. Older M39-era Postman collections still exist in `postman/collections/`. They are not removed — the M39.1 collection is additive and is the single canonical entry point going forward.

## Next Step

- **M40** — TBD (see `ROADMAP.md`).
- **Future M39.2+** — public-commerce reorganization and public-payments execution (currently scaffolded as `NOT_ENABLED`). **No hotel / property-group milestone is planned in this repo split.**
- **M13.2** — Airtel Native integration (NOT STARTED).
