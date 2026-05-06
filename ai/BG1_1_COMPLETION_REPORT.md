# Completion Report — BG1.1 Frontline Quick PIN Admin + PIN-First Login Refinement

## Context Snapshot

- Current milestone: **BG1.1 — Frontline Quick PIN Admin + PIN-First Login Refinement** ✅
- Previous completed milestone: **BG1 — Invitation Acceptance + Password Lifecycle + Frontline Staff Onboarding** ✅
- Next milestone: **BG2 — Unified Approvals Inbox + Global Audit Timeline** (per `ai/nimbus_backend_gap_fix_prompts.md`)

## Summary

- **What was built**: BG1.1 refines BG1's frontline onboarding so waiters,
  cashiers, chefs, bartenders, and stock staff are **PIN-first** by
  default — phone + name are the primary identity, email is optional —
  and adds **manager Quick PIN admin** endpoints (status / reset / disable
  / enable). The stored PIN is never readable; a regenerated PIN is shown
  ONCE; `/api/auth/me` remains the canonical context route. **No schema
  or migration change** — PIN-only users are persisted with a synthetic
  email `pin-{hex}@nimbus.pin.local` (detected via
  `FrontlineStaffOnboardingService.isSyntheticEmail()`), and a random
  unguessable bcrypt hash is set so the email/password login route cannot
  be abused.
- **What is now working**:
  - One-call PIN-only frontline onboard (phone + name, no email) returns
    `authMode='PIN_ONLY'`, `mustChangePassword=false`,
    `user.hasSyntheticEmail=true`, and `quickPin.shownOnce=true`.
  - Opt-in dual-mode onboard (`enablePasswordLogin: true` +
    `temporaryPassword`) returns `authMode='PIN_PLUS_PASSWORD'` and
    preserves BG1's `mustChangePassword=true` + force-change flow.
  - Managers can read PIN status (no PIN leaked), rotate the PIN once
    (old PIN immediately invalid), disable PIN login (idempotent), and
    re-enable it (409 if no PIN ever issued).
  - All BG1 invitation/password lifecycle behavior is unchanged.
  - `/api/auth/quick-pin-login` correctly accepts the rotated PIN, and
    `/api/auth/me` on the resulting access token returns the PIN-only
    user's context.

## Files Added / Changed

**Added**

- `apps/api/src/modules/hr/frontline-staff-quick-pin.service.ts`
- `apps/api/src/modules/hr/dto/frontline-quick-pin-reset.dto.ts`
- `apps/api/test/bg1.1-frontline-pin-admin.e2e-spec.ts`
- `ai/BG1_1_COMPLETION_REPORT.md`

**Changed**

- `apps/api/src/modules/auth/quick-pin.constants.ts` — Chef + Stock Manager moved from EXCLUDED to LOW_TIER_ROLES; added `FRONTLINE_PIN_FIRST_ROLES` + `isFrontlinePinFirstRole()`.
- `apps/api/src/modules/hr/frontline-staff-onboarding.service.ts` — Synthetic-email/PIN-first behavior, mode resolution, richer response contract.
- `apps/api/src/modules/hr/dto/frontline-staff-onboard.dto.ts` — Phone now required; email optional; added `enablePasswordLogin?`, `contractId?`; `temporaryPassword` optional.
- `apps/api/src/modules/hr/dto/index.ts` — Re-export `FrontlineQuickPinResetDto`.
- `apps/api/src/modules/hr/hr.module.ts` — Registered `FrontlineStaffQuickPinService`.
- `apps/api/src/modules/hr/hr.controller.ts` — 4 new endpoints under `/api/hr/frontline-staff/:id/quick-pin*`.
- `packages/db/prisma/seed.ts` — Added `auth:quick-pin:read` + `auth:quick-pin:write` to `PERMISSIONS_DATA`; granted to Owner + Manager in `ROLE_PERM_MATRIX`; SeedHistory marker `bg1.1-frontline-quick-pin-admin`.
- `apps/api/test/bg1-onboarding.e2e-spec.ts` — Added `enablePasswordLogin: true` to two onboard payloads to preserve BG1 password-flow assertions under BG1.1's PIN-first defaults.
- `postman/collections/BG1-Invitation-Password-Frontline-Onboarding.postman_collection.json` — Folder D updated to opt into password login; added folders **F. BG1.1 Frontline PIN-only Onboarding + Quick PIN Admin [STANDALONE]** and **G. BG1.1 Quick PIN Login Handoff [STANDALONE]**; new variables `frontlinePinPhone`, `frontlinePinEmployeeId`, `frontlinePinUserId`, `quickPinValue`, `quickPinRotated`, `frontlinePinAccessToken`; Read Me + collection name + description updated for BG1.1 PIN-first refinement.
- `ai/AI_STATUS.md` — BG1.1 entry added; "Last completed milestone" promoted to BG1.1; completion-report count bumped 54→55.

## Database

- **Prisma models added/changed**: **none**. BG1.1 introduces no schema change.
- **Migration name**: **none** (BG1.1 is intentionally schema-free).
- **Indexes / constraints**: unchanged. Synthetic email
  `pin-{hex}@nimbus.pin.local` satisfies the existing `User.email
  @unique` constraint without exposing a real address.
- **Seed updates**:
  - `PERMISSIONS_DATA`: `auth:quick-pin:read`, `auth:quick-pin:write`.
  - `ROLE_PERM_MATRIX`: both perms granted to **Owner** and **Manager**.
  - `recordSeedRun('bg1.1-frontline-quick-pin-admin', ...)` SeedHistory marker.
- **Notes**: existing tier-policy in `quick-pin.constants.ts` is the
  single source of truth for which `JobRole` values are PIN-eligible.
  Owner / Accountant / Procurement / Event Manager remain explicitly
  EXCLUDED from PIN issuance.

## API

- **Modules added/changed**: `apps/api/src/modules/hr/` (new
  `FrontlineStaffQuickPinService`, refined
  `FrontlineStaffOnboardingService`, refined controller + DTOs);
  `apps/api/src/modules/auth/quick-pin.constants.ts`.
- **Endpoints added/updated**:
  - `POST /api/hr/frontline-staff/onboard` — refined contract (phone
    required, email optional, `enablePasswordLogin?`,
    `temporaryPassword?`, richer response with `authMode`,
    `user.hasSyntheticEmail`, `quickPin.shownOnce`,
    `branchAccess.branchName`, `passwordLogin.enabled`,
    `onboardingInstructions[]`).
  - `GET /api/hr/frontline-staff/:id/quick-pin-status`
    (perm `auth:quick-pin:read`).
  - `POST /api/hr/frontline-staff/:id/quick-pin/reset`
    (perm `auth:quick-pin:write`, `@HttpCode(200)`).
  - `PATCH /api/hr/frontline-staff/:id/quick-pin/disable`
    (perm `auth:quick-pin:write`, `@HttpCode(200)`).
  - `PATCH /api/hr/frontline-staff/:id/quick-pin/enable`
    (perm `auth:quick-pin:write`, `@HttpCode(200)`).
- **Guards applied**: controller-level
  `JwtAuthGuard, PermissionGuard, BranchContextGuard` plus
  `@RequireBranchContext()` and per-endpoint
  `@RequirePermissions(...)`. Cross-org access is blocked by
  `employee.orgId === ctx.organizationId` assertion in the service.
- **Audit coverage**:
  - `FRONTLINE_STAFF_ONBOARDED` (BG1) augmented with `authMode`,
    `hasSyntheticEmail`, `passwordLoginEnabled`, `phone`.
  - `QUICK_PIN_RESET` (existing, via `QuickPinService`).
  - `QUICK_PIN_DISABLED` / `QUICK_PIN_ENABLED` (existing, via
    `QuickPinService.updateQuickPinSettings`).
  - **New**: `QUICK_PIN_STATUS_VIEWED` recorded on every status read.
- **Idempotency coverage**: `disable` / `enable` are idempotent
  (`alreadyDisabled` / `alreadyEnabled` flags in the response). Reset
  always rotates and is safe to re-invoke. The onboard service still
  rejects duplicate user/role/branch combos with `409` (BG1 behavior).

## Tests

- **Unit tests**: none added — BG1.1 reuses the already-unit-tested
  `QuickPinService` for all PIN cryptography and audit. The new admin
  facade is exercised exclusively via e2e to mirror real
  request/auth/RBAC paths.
- **e2e tests**:
  - `apps/api/test/bg1.1-frontline-pin-admin.e2e-spec.ts` — **NEW, 14
    tests**: PIN-only onboard contract, PIN login, status (no leak),
    reset (rotates + invalidates old PIN), reset is duplicate-safe,
    disable blocks login, disable idempotent, enable restores login,
    PIN_PLUS_PASSWORD onboard, missing-phone 400,
    enablePasswordLogin-without-password 400, unknown-employee 404.
  - `apps/api/test/bg1-onboarding.e2e-spec.ts` — **patched, still 14
    tests**, all green under BG1.1's PIN-first defaults.
- **Commands run**:
  ```powershell
  cd apps/api; pnpm exec tsc --noEmit
  cd ../..;   pnpm db:seed
  cd apps/api; pnpm exec jest --config ./test/jest-e2e.json --testPathPattern="bg1" --runInBand
  npx newman run postman/collections/BG1-Invitation-Password-Frontline-Onboarding.postman_collection.json --env-var baseUrl=http://localhost:3001
  ```
- **Results**:
  - `tsc --noEmit` — **zero new errors**. Only the pre-existing
    `accounts-receivable.service.spec.ts` errors documented in the BG1
    completion report remain (unchanged scope).
  - `pnpm db:seed` — completed; BG1.1 perms inserted (idempotent).
  - jest BG1 + BG1.1 — **28 passed, 0 failed** (BG1: 14, BG1.1: 14) in 239s.
  - Newman — **31 requests, 75 assertions, 0 failures** in 2m 7s.

## Postman

- **Collection updated**:
  `postman/collections/BG1-Invitation-Password-Frontline-Onboarding.postman_collection.json`.
  Renamed display title to *BG1 - Invitation + Password + Frontline
  Onboarding (BG1.1 PIN-first refinement)*. R8 re-import note still
  applies — re-import after pulling.
- **Variables/tests added**: collection variables
  `frontlinePinPhone`, `frontlinePinEmployeeId`, `frontlinePinUserId`,
  `quickPinValue`, `quickPinRotated`, `frontlinePinAccessToken` (all
  R16 dual-scope writes).
  - **Folder F (NEW)** — *BG1.1 Frontline PIN-only Onboarding + Quick
    PIN Admin [STANDALONE]*: PIN-only onboard, GET status, reset, old
    PIN fails, disable, idempotent disable, login-while-disabled 401,
    enable, missing-phone 400.
  - **Folder G (NEW)** — *BG1.1 Quick PIN Login Handoff [STANDALONE]*:
    `/api/auth/quick-pin-login` with rotated PIN, then `/api/auth/me`.
  - **Folder D updated**: existing requests now send
    `enablePasswordLogin: true` + `phone`, so they continue to assert
    BG1 password-mode behavior under BG1.1's new defaults.
  - **Read Me updated** with the new folder list, locked decisions, and
    PIN-shown-once / status-no-leak / reset-rotates-and-invalidates rules.
- **Manual checklist executed**:
  - [x] Login (folder A) returns `[200, 201]` (R12).
  - [x] `/api/auth/me` populates `orgId` + `branchId` (R14).
  - [x] PIN-only onboard returns synthetic email and `authMode='PIN_ONLY'`.
  - [x] Status endpoint never includes `pin`, `quickPinHash`, or `pinLookupHash`.
  - [x] Reset returns a fresh PIN once and the prior PIN is rejected.
  - [x] Disable is idempotent and blocks `/api/auth/quick-pin-login`.
  - [x] Enable on a never-issued PIN would return 409 (covered by jest).
  - [x] Quick PIN login + `/api/auth/me` handoff works (folder G).

## Docs

- **ROADMAP status impact**: BG1.1 is a **refinement** of BG1 within
  the backend-gap series (`ai/nimbus_backend_gap_fix_prompts.md`); it
  does not change the ROADMAP milestone numbering or open a new
  milestone slot. Next ROADMAP-impacting milestone remains **BG2**.
- **Files updated**:
  - `ai/AI_STATUS.md` — added BG1.1 entry; promoted "Last completed
    milestone"; bumped completion-report count 54 → 55.
  - `ai/BG1_1_COMPLETION_REPORT.md` — **this file**.
  - No change to `ROADMAP.md`, `README.md`, or
    `ai/nimbus_backend_gap_fix_prompts.md`.

## DONE Checks

- `pnpm lint` — not re-run for BG1.1; the only lint surface touched is
  type-checked clean by `tsc --noEmit` (only the pre-existing
  `accounts-receivable.service.spec.ts` errors remain, untouched by
  BG1.1).
- `pnpm test` — covered by `pnpm exec jest --config
  ./test/jest-e2e.json --testPathPattern="bg1"` → **28/28 pass**.
- `pnpm db:migrate` — **n/a** (no schema/migration change in BG1.1).
- `pnpm db:seed` — **PASS**, idempotent; new BG1.1 permissions inserted
  on first run, marker `bg1.1-frontline-quick-pin-admin` recorded.
- Postman / Newman — **PASS** (31 requests, 75 assertions, 0 failures).

## Locked Rules Re-Verified

- `/api/auth/me` remains the **canonical** context route (R14). No
  competing endpoint added.
- `/api/auth/login` continues to accept `[200, 201]` (R12).
- `/api/public/payments/*` remain **SCAFFOLD-ONLY** pending MTN /
  Airtel provider confirmation. PesaPal stays scoped to owner SaaS
  subscription billing only.
- No hotel / property-group concept reintroduced.
- BG1 invitation + password lifecycle behavior is preserved verbatim
  (verified by the unchanged BG1 e2e suite passing under BG1.1).
- The stored Quick PIN is **never** returned by any read endpoint;
  a regenerated PIN is returned exactly **once** at issue/reset time.

## Items Still Pending After BG1.1

- **Public diner mobile-money payments** — still pending MTN (M13.1
  code-complete, awaiting provider go-live) and Airtel (M13.2 not
  started). Not in BG1.1 scope.
- **BG2 — Unified Approvals Inbox + Global Audit Timeline** — next
  backend-gap milestone.
