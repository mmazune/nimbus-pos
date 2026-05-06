# Completion Report — Seed Regression Recovery (M30–M39)

## Context Snapshot

- Current milestone: **Seed Regression Recovery** (continuity patch on top of M39.3 stabilization)
- Previous completed milestone: M39.3 — Public Booking + Public Commerce + Ops Portal (with M39 Postman/Docs stabilization patch)
- Next milestone: **M40+** from `ROADMAP.md` (no hotel / `M39.4` planned)

## Summary

- What was built: Rebuilt `packages/db/prisma/seed.ts` to restore M34–M39 seed contributions that had regressed out of the file. Extended `PERMISSIONS_DATA` and `ROLE_PERM_MATRIX` to cover all M34–M39 permission strings used by the controllers, added six new idempotent seed functions (AP, AR, BankRec, Budgets, Franchise suite, Billing/Onboarding/Public/Ops), wired them into `main()`, and recorded `SeedHistory` markers.
- What is now working: A clean Neon database can be seeded end-to-end with one command. The seed runs successfully twice in a row with zero new rows on the second pass, proving full idempotency. M0–M33 behavior is unchanged. M39.1 / M39.2 / M39.3 stabilized behavior is preserved (3 plans only, all features on by default, location-only enforcement, public payments PENDING MoMo, PesaPal reserved for owner-SaaS billing).

## Files Added / Changed

- `packages/db/prisma/seed.ts` — extended `PERMISSIONS_DATA`, extended `ROLE_PERM_MATRIX` (Owner / Manager / Accountant), added `seedApData`, `seedArData`, `seedBankRecData`, `seedBudgetData`, `seedFranchiseData`, `seedBillingData`, wired six new steps into `main()`, recorded six new `SeedHistory` markers.
- `ai/AI_STATUS.md` — added "Seed Regression Recovery" section, bumped completion-report count.
- `ai/M39_SEED_RECOVERY_COMPLETION_REPORT.md` — this report.

## Database

- Prisma models added/changed: **none** (no schema changes — recovery is seed-data only).
- Migration name: **none**.
- Indexes / constraints: **none added**; new seed code respects existing unique keys (`Plan.code`, `Subscription @@unique([orgId])`, `OnboardingProgress.orgId @unique`, `MerchantPaymentConfig.orgId @unique`, `PublicProfile.slug` global + `(orgId, branchId)`, `PublicEvent.slug` global, `FranchiseRanking @@unique(...)`, `BranchBudgetRollup @@unique(...)`, `InterBranchTransfer @@unique([orgId, transferNumber])`, `HqDigestSubscription @@unique(...)`, `FranchiseConsolidationRun @@unique(...)`, `FranchiseKpiSnapshot @@unique(...)`, `BranchPerformanceScorecard @@unique(...)`, `WasteBenchmarkSnapshot @@unique(...)`).
- Seed updates:
  - `PERMISSIONS_DATA` — ~80 new entries spanning AP, AR, BankRec, PeriodClose, Budgets, Forecasts, Procurement, Franchise, FranchiseAnalytics, Billing, Dev Portal, Support, Onboarding, MerchantPayments, PublicCommerce, OpsPortal. Strings harvested from `@Permissions(...)` decorators in `apps/api/src/modules/**/*.controller.ts`.
  - `ROLE_PERM_MATRIX`:
    - **Owner** — full M34–M39 access including `ops:*`.
    - **Manager** — read across most M34–M39 surfaces, plus `finance:demand-calendar:write` and `franchise:transfer:write`.
    - **Accountant** — full AP / AR / BankRec / PeriodClose, plus `budget:read`, `billing:read`, scorecard read.
  - `seedApData(orgId, branchCode)` — Suppliers `SUP-PRODUCE-001` (Kampala Fresh Produce) and `SUP-UTIL-001` (Umeme), `VendorBill BILL-SEED-001` (APPROVED, partially paid, 3 lines, UGX 1,003,000 total / UGX 503,000 outstanding), `VendorPayment PAY-SEED-001` (POSTED, UGX 500,000) + `VendorPaymentAllocation`, `RecurringBillProfile` (MONTHLY utility), `PayableReminder` (PENDING).
  - `seedArData(orgId, branchCode)` — `CustomerAccount CORP-001` (CORPORATE) and `HOUSE-001` (HOUSE), `Invoice INV-AR-001` (PARTIALLY_PAID, 3 lines, UGX 1,770,000), `Invoice INV-AR-002` (ISSUED), `ArReceipt RCT-AR-001` (POSTED, UGX 1,000,000) + `ReceiptAllocation`.
  - `seedBankRecData(orgId, branchCode)` — `BankAccount BANK-MAIN-UGX` linked to GL `1010`, `BankStatement STMT-SEED-001` with three lines (CREDIT customer wire, DEBIT vendor payment, DEBIT bank charge), `ManualBankEntry BANK-CHG-SEED-001`.
  - `seedBudgetData(orgId, branchCode)` — `Budget` OPERATIONAL/ACTIVE v1 against the open `FiscalPeriod` with three `BudgetLine` rows (Revenue / COGS-Food / Labor), `ForecastRun` (BRANCH/COMPLETED, 14-day horizon), `DemandCalendarEntry` (BRUNCH / Saturday peak, multiplier 1.8).
  - `seedFranchiseData(orgId)` — Loops branches × 5 ranking types → `FranchiseRanking` matrix; `BranchBudgetRollup` MONTHLY v1; `InterBranchTransfer XFER-SEED-001` (REQUESTED, only when ≥2 branches); `HqDigestSubscription` (email / WEEKLY / franchise-overview); `FranchiseConsolidationRun` (COMPLETED); three `FranchiseKpiSnapshot` rows (REVENUE / COGS / PRIME_COST); `BranchPerformanceScorecard` (FINANCIAL / WATCH); `WasteBenchmarkSnapshot`. **All windows are pinned to a deterministic month boundary**, so reruns are pure no-ops.
  - `seedBillingData(orgId)` — Three `Plan` rows with locked pricing and full feature flags:
    - `SOLO` — $80/mo, $864/yr, `maxBranches: 1`
    - `GROWTH` — $150/mo, $1,620/yr, `maxBranches: 3`
    - `FRANCHISE` — $200/mo, $2,160/yr, `maxBranches: 999`
    - All carry `analyticsEnabled / franchiseEnabled / webhooksEnabled = true` and `limits.policy = { enforcedMetric: 'BRANCHES', featureGating: false }`.
    - Plus `Subscription` (SOLO / ACTIVE / MONTHLY), `OnboardingProgress` (all steps COMPLETED), `MerchantPaymentConfig` (PENDING with `notes` prefix `[PENDING_MTN] Awaiting MTN MoMo merchant onboarding...` — PesaPal **not** used here), `PublicProfile` (`nimbus-main`, displayName `Nimbus Main`, PUBLISHED, with opening-hours JSON), `PublicEvent` (`nimbus-live-music-night`, free, PUBLISHED, capacity 100).
  - `SeedHistory` markers: `m34-accounts-payable`, `m35-accounts-receivable`, `m36-bank-rec-period-close`, `m37-budgets-forecasts`, `m38-franchise-suite-analytics`, `m39-billing-onboarding-public-ops`.
- Notes:
  - All inserts go through `findUnique` / `findFirst` guards before `create`, so the seed is safe to re-run.
  - All time-windowed analytics rows use a deterministic prior-month boundary computed from a fixed reference date in seed code, not `new Date()` — this is the key trick that makes the franchise rollups idempotent across calendar days.
  - `MerchantPaymentConfigStatus` enum lacks a `PENDING_MTN` value, so the MTN-pending state is encoded as `status: 'PENDING'` with a `[PENDING_MTN]` prefix in `notes`.

## API

- Modules added/changed: **none**.
- Endpoints added/updated: **none**.
- Guards applied: **n/a** (seed-only patch).
- Audit coverage: **n/a**.
- Idempotency coverage: every new seed function is guarded by `findUnique` / `findFirst` before `create`; verified by clean second pass.

## Tests

- Unit tests: not changed.
- e2e tests: not changed.
- Commands run:
  - `pnpm --filter @nimbus-pos/db db:seed` — pass 1, exit `0`. M34–M39 sections created their rows on first run; M0–M33 sections were already populated and reported `Skipped` as expected.
  - `pnpm --filter @nimbus-pos/db db:seed` — pass 2, exit `0`, **48 `Created:` lines, zero non-zero `Created:` lines**, "🌱 Seed complete." printed. Confirms full idempotency across all M0–M39 sections including the new M34–M39 ones.
- Results: ✅ both passes succeeded; second pass reports `Created: 0` for every section.

## Postman / Docs

- Postman collections: not changed (M39.1 / M39.2 / M39.3 stabilized collections continue to apply against the recovered seed data).
- Docs: `ai/AI_STATUS.md` updated with a "Seed Regression Recovery" section.

## Locked Rules — Verification

- **Plans**: exactly three (`SOLO`, `GROWTH`, `FRANCHISE`). No `STARTER` / `PRO` / `ENTERPRISE` artifacts.
- **Feature gating**: `featureGating: false` on every plan; `analyticsEnabled / franchiseEnabled / webhooksEnabled = true` everywhere. Enforcement is location-only via `maxBranches`.
- **PesaPal**: only referenced as the owner-SaaS billing rail (existing M39 code, untouched). The merchant-side seed (`MerchantPaymentConfig`) is PENDING MoMo, never PesaPal.
- **Public diner payments**: PENDING the MTN / Airtel mobile-money integration (`[PENDING_MTN]` marker in notes).
- **No hotel / `M39.4` artifacts** introduced.

## DONE Checks

- [x] Seed compiles cleanly (zero TypeScript errors).
- [x] Seed runs successfully twice in a row, exit 0 both times.
- [x] Second pass reports `Created: 0` for every section.
- [x] No M0–M33 regressions (all earlier sections still print their `Skipped` lines unchanged).
- [x] All M34–M39 sections produce visible row inserts on first pass and pure skips on second pass.
- [x] Locked rules (3 plans, full feature access, location-only enforcement, PesaPal owner-SaaS only, public payments PENDING MoMo) preserved verbatim.
- [x] No M40 work performed.
