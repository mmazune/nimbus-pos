# Completion Report — M39 Stabilization Patch (Postman Standalone Hardening + Hotel/Property-Group Cleanup)

## Context Snapshot

- Current milestone: **M39 Stabilization Patch** (continuity, not a new feature milestone)
- Previous completed milestone: **M39.3 — Public Booking Website + Public Commerce Payment Skeleton + Nimbus Ops Portal**
- Next milestone: **M40+ from `ROADMAP.md`** — the M39 split is closed at M39.3. **No `M39.4` is planned.** The POS backend track stays restaurant-focused.

## Why This Patch Exists

The M39 split (M39.1, M39.2, M39.3) was code-complete but not
operationally clean:

1. Multiple docs (AI_STATUS, completion reports, the M39.2 collection
   description) advertised a future `M39.4` for "property-group / hotel-
   style multi-site hierarchy". The user has since locked the direction:
   **no hotel / property-group milestone is planned in this repo
   split**; any cross-system compatibility, if ever needed, will be
   designed against a separate system.
2. Postman collections only worked end-to-end if folders ran in order
   from a fresh login. Cold-session, single-folder runs frequently
   failed because `branchId`, `restaurantSlug`, `eventSlug`, `opsOrgId`,
   etc. were not auto-resolved.
3. There was no canonical, repo-level Postman rule book — every new
   milestone re-invented the wheel and re-introduced the same fragility.

This patch addresses 1, 2, and 3 in one continuity commit so future
milestones inherit the corrected reality.

## Summary

- What was done:
  - Removed every reference to `M39.4`, `property-group`,
    `hotel-style`, `multi-site hierarchy`, and "future hotel
    structures" from `ai/` docs and from the M39.2 Postman collection
    description. Replaced them with the locked phrasing: **"no hotel /
    property-group milestone is planned in this repo split."**
  - Replaced the collection-level pre-request script in M39.1, M39.2,
    and M39.3 with a **canonical standalone-resilience helper** that:
    1. auto-logs the owner in when `accessToken` is missing on a
       non-public route,
    2. calls `GET /api/auth/me` and seeds `orgId` / `branchId` when a
       request references either variable and it is empty,
    3. seeds `restaurantSlug`, `eventSlug`, and `opsOrgId` from their
       respective list endpoints when the variables are empty.
  - Kept the existing folder-level helpers in M39.2 folder H (auto-
    create / reuse a published event) and M39.3 folder E (auto-create
    fresh holds for the pending payment scaffolds).
  - Added [ai/AI_POSTMAN_WORKING_PATTERNS.md](ai/AI_POSTMAN_WORKING_PATTERNS.md)
    as the permanent Postman rule book (R1–R15), including the
    Postman-script-import cache warning (R8) and the `Login` 201
    convention (R12, mirroring `AI_ERROR_PROTOCOL` rule P1).
  - Updated `ai/AI_STATUS.md` to reflect the closed M39 split, the
    stabilization patch, and the locked direction.
- What is now working:
  - Every M39.1 / M39.2 / M39.3 folder can be run cold-import and
    standalone via newman (verified 13/13).
  - All three collections continue to pass full top-to-bottom newman
    runs (0 assertion failures, 0 request failures).
  - All M39 docs and the M39.2 collection description now state the
    locked direction unambiguously.

## Files Added / Changed

### Added
- [ai/AI_POSTMAN_WORKING_PATTERNS.md](ai/AI_POSTMAN_WORKING_PATTERNS.md) — permanent Postman rule book (R1–R15).
- [ai/M39_3_1_STABILIZATION_COMPLETION_REPORT.md](ai/M39_3_1_STABILIZATION_COMPLETION_REPORT.md) — this report.
- `_harden_m39_postman.cjs` — one-shot script that injected the canonical pre-request helper into the three collections (idempotent).
- `_cold_standalone_check.cjs` — newman cold-session validator (strips runtime variables, then runs hand-picked folders).

### Changed
- [ai/AI_STATUS.md](ai/AI_STATUS.md) — added "M39 Stabilization Patch" block, replaced `M39.4` reservation with the locked "no hotel / property-group" wording (4 sites), bumped completion-report counter (46 → 47), refreshed "Current State" header.
- [ai/M39_1_COMPLETION_REPORT.md](ai/M39_1_COMPLETION_REPORT.md) — replaced 4 occurrences of "property-group / hotel structures (deferred)" with the locked phrasing.
- [ai/M39_2_COMPLETION_REPORT.md](ai/M39_2_COMPLETION_REPORT.md) — rewrote the ROADMAP-impact paragraph to drop the "property-group / hotel structures remain deferred" wording.
- [ai/M39_3_COMPLETION_REPORT.md](ai/M39_3_COMPLETION_REPORT.md) — removed `M39.4` from the "Next milestone" line, the "Docs" section, and the "Next Step" section.
- [postman/collections/M39.1-Commercial-Foundation-SaaS-Billing-Dev-Portal.postman_collection.json](postman/collections/M39.1-Commercial-Foundation-SaaS-Billing-Dev-Portal.postman_collection.json) — collection-level pre-request swapped for the canonical helper.
- [postman/collections/M39.2-Onboarding-Membership-Merchant-Public-Setup.postman_collection.json](postman/collections/M39.2-Onboarding-Membership-Merchant-Public-Setup.postman_collection.json) — collection-level pre-request swapped; `info.description` scrubbed of "Property-group / hotel structures".
- [postman/collections/M39.3-Public-Booking-Public-Commerce-MoMo-Pending-Ops.postman_collection.json](postman/collections/M39.3-Public-Booking-Public-Commerce-MoMo-Pending-Ops.postman_collection.json) — collection-level pre-request swapped.

### Not changed (intentional)
- Nest controllers, services, Prisma schema, seeds. This is a docs +
  Postman scripts patch only — no DB or API behavior changed.
- Folder-level pre-request helpers (M39.2 folder H, M39.3 folder E)
  were already correct and were left as-is.

## Database

- Prisma models added/changed: **none**.
- Migration name: **none**.
- Indexes / constraints: unchanged.
- Seed updates: none.
- Notes: stabilization patch only.

## API

- Modules added/changed: **none**.
- Endpoints added/updated: **none**.
- Guards applied: unchanged.
- Audit coverage: unchanged.
- Idempotency coverage: unchanged.

## Postman Hardening Summary

### Collection-level changes (M39.1 / M39.2 / M39.3)

The collection-level `prerequest` event in all three collections now
runs the canonical helper:

```text
ensureToken()                    // auto-login owner if accessToken missing on non-public route
  → ensureMeContext()            // /api/auth/me → orgId, branchId
  → ensureFromList(restaurantSlug, /api/public/restaurants)
  → ensureFromList(eventSlug,      /api/public/events)
  → ensureFromList(opsOrgId,       /api/ops/customers, requiresAuth=true)
```

Sandbox-safe: no `Buffer`, all `pm.sendRequest` calls promise-chained,
all errors logged via `console.log` (never thrown).

### Folder-level changes

- **M39.2 folder H (Merchant Events)** — left intact. Already auto-
  resolves `branchId` from `/api/auth/me` and auto-creates / reuses
  an event so H.2 (`PATCH .../capacity`), H.3 (`PATCH .../pricing`),
  H.4 (`PATCH .../publish`) work standalone.
- **M39.3 folder E (Pending Payments)** — left intact. Already auto-
  creates fresh `reservationHoldId` / `eventBookingHoldId` so E.1 and
  E.2 work standalone.
- **M39.1 folder D (PesaPal)** — D.2 (callback) and D.3 (IPN) keep
  their explicit "browser-redirected, public" / "server-to-server,
  public" labels; the canonical helper correctly skips auto-login for
  them.
- **M39.3 folder E** — E.0, E.3, E.4 already labelled `READ FIRST: this
  folder is NOT LIVE` / `RESERVED FUTURE CONTRACT`. No change needed.

### Variable resolution changes

| Variable | Resolution path (cold session) |
|---|---|
| `accessToken` | collection-level `ensureToken` → `POST /api/auth/login` (owner) |
| `orgId` / `branchId` | collection-level `ensureMeContext` → `GET /api/auth/me` (`context.defaultOrganizationId`, `context.defaultBranchId`, with `memberships[0]` fallback) |
| `restaurantSlug` | collection-level `ensureFromList` → `GET /api/public/restaurants[0].slug` |
| `eventSlug` | collection-level `ensureFromList` → `GET /api/public/events[0].slug` |
| `opsOrgId` | collection-level `ensureFromList` (auth) → `GET /api/ops/customers[0].id` |
| `eventId` (M39.2 H) | folder-level helper auto-creates if missing |
| `reservationHoldId` (M39.3 E.1) | folder-level helper auto-creates if missing |
| `eventBookingHoldId` (M39.3 E.2) | folder-level helper auto-creates if missing |

### Standalone execution changes

Folders that previously required prior folders to run first now resolve
their own context. Verified cold-session passes:

| Collection | Folder | Cold-session result |
|---|---|---|
| M39.1 | B. Plan Catalog & Billing Overview | PASS |
| M39.1 | E. Developer Portal | PASS |
| M39.1 | F. Support Sessions | PASS |
| M39.1 | G. Ops Plan Catalog Admin | PASS |
| M39.2 | F. Merchant Public Profile | PASS |
| M39.2 | G. Booking Settings | PASS |
| M39.2 | H. Merchant Events | PASS |
| M39.2 | I. Merchant Payment Readiness | PASS |
| M39.3 | A. Public Restaurant Browse | PASS |
| M39.3 | C. Reservation Holds + Confirm | PASS |
| M39.3 | D. Event Booking Holds + Confirm | PASS |
| M39.3 | E. Public Commerce Payments — Pending MoMo | PASS |
| M39.3 | F. Nimbus Ops Portal | PASS |

## Documentation Changes

### `ai/AI_STATUS.md`
- New "M39 Stabilization Patch (latest — on top of M39.3)" block
  detailing what was changed.
- "Current State" rewritten: explicit statements that
  - public diner payments remain pending the MTN / Airtel mobile-money
    integration,
  - PesaPal is reserved for owner SaaS subscription billing only,
  - no hotel / property-group milestone is planned in this repo split.
- Counter bumps: completion reports 46 → 47.
- Removed all four "M39.4 reserved" / "property-group / hotel structures
  deferred" wordings.

### Completion reports
- M39.1, M39.2, M39.3 reports updated to drop the `M39.4` reservation
  and the "property-group / hotel structures (deferred)" wording.
- Each report now states: **no hotel / property-group milestone is
  planned in this repo split.**

### New Postman working-pattern doc
- [ai/AI_POSTMAN_WORKING_PATTERNS.md](ai/AI_POSTMAN_WORKING_PATTERNS.md)
  defines R1–R15 for every future milestone:
  - R1 — read existing collections first
  - R2 — explain variable flow in `00 Read Me`
  - R3 — folders standalone where practical
  - R4 — auto-login on missing `accessToken`
  - R5 — `/api/auth/me` resolution for missing `orgId` / `branchId`
  - R6 — list-first / safe-create resolution for missing slugs / IDs
  - R7 — clearly label doc-only callbacks / IPNs
  - R8 — Postman script-import cache warning (re-import required)
  - R9 — `00 Read Me` / run-order section
  - R10 — capture IDs / tokens in test scripts
  - R11 — meaningful skip messages
  - R12 — Login asserts `[200, 201]` (P1 from `AI_ERROR_PROTOCOL`)
  - R13 — never hard-code production credentials
  - R14 — canonical pre-request helper definition
  - R15 — one canonical collection per milestone

## Validation Performed

### Full top-to-bottom newman runs (server up, fresh DB state from M39.3 work)

```pwsh
foreach ($f in 'M39.1-Commercial-Foundation-SaaS-Billing-Dev-Portal',
                'M39.2-Onboarding-Membership-Merchant-Public-Setup',
                'M39.3-Public-Booking-Public-Commerce-MoMo-Pending-Ops') {
  npx --yes newman run "postman/collections/$f.postman_collection.json" `
    --timeout-request 30000 --reporters json --reporter-json-export "_newman_$f.json"
}
```

Results:

| Collection | Asserts failed | Requests failed | Failures |
|---|---|---|---|
| M39.1 | 0 / 26 | 0 / 31 | 0 |
| M39.2 | 0 / 8 | 0 / 24 | 0 |
| M39.3 | 0 / 9 | 0 / 29 | 0 |

### Cold-session standalone folder runs (`_cold_standalone_check.cjs`)

The script clones each collection with all variables (except
`baseUrl`, `ownerEmail`, `ownerPassword`) cleared, then runs newman
against a single folder. This simulates a fresh Postman import where
the user clicks Run on one folder without ever running another.

Result: **13 / 13 folders passed** (see table above), 0 assertion
failures, 0 request failures.

### Hotel / property-group reference scrub

```pwsh
# ai/ tree
Select-String -Path "ai/**/*.md" -Pattern 'M39\.4|property-group|hotel-style|multi-site'
# postman tree
Select-String -Path "postman/collections/*.json" -Pattern 'M39\.4|property-group|hotel-style|hotel'
```

Result: only the new locked wording ("no hotel / property-group
milestone is planned in this repo split") matches; no `M39.4` or "hotel
structures deferred" wording remains.

## DONE Checks

- `pnpm lint` / full `pnpm test` / `pnpm db:migrate` / `pnpm db:seed` —
  not re-run; this patch is **docs + Postman scripts only**, no Nest /
  Prisma / seed change.
- `npx --yes newman run` for all three M39.x collections (full
  top-to-bottom): **0 assertion failures, 0 request failures.**
- `node _cold_standalone_check.cjs`: **13 / 13 cold-session folder
  runs passed.**

## Decisions / Deviations

1. **No M39.4 placeholder kept.** The user explicitly locked the
   direction: no hotel / property-group milestone is planned. We did
   not leave `M39.4 reserved` anywhere.
2. **Patch is filed as a stabilization continuity report, not a new
   numbered milestone.** Filename
   `M39_3_1_STABILIZATION_COMPLETION_REPORT.md` makes the lineage
   obvious without taking an `M40` number.
3. **No code changes.** Per the "do not invent features outside scope"
   rule and the patch brief, all changes are docs + Postman scripts.
4. **One canonical pre-request helper for all three collections.**
   This satisfies R14 of `AI_POSTMAN_WORKING_PATTERNS.md` and avoids
   per-folder script proliferation.
5. **Folder-level helpers preserved.** The M39.2 H and M39.3 E folder
   pre-requests already worked; replacing them was unnecessary risk.
6. **Doc-only callbacks (PesaPal D.2 / D.3 in M39.1; MoMo E.0 / E.3 /
   E.4 in M39.3) were left unchanged** — they were already labelled
   `(browser-redirected, public)`, `(server-to-server, public)`, or
   `RESERVED FUTURE CONTRACT`, satisfying R7. Adding more decoration
   would just churn the JSON.

## Known Issues

- None. Public diner payment execution remains **PENDING the MTN /
  Airtel mobile-money integration**; this is the locked product
  status, not a regression.
- Older M39-era collections
  (`M39-Billing-Subscriptions-Dev-Portal`,
  `M39-Complete-SaaS-Booking-Suite`,
  `M39-Correction-SaaS-Onboarding-Booking-Public-MoMo-Pending-Ops`,
  `M39-Plan-Catalog-Correction-Solo-Growth-Franchise`) remain in
  `postman/collections/` for historical context. Per R15, the
  canonical entry points going forward are M39.1 / M39.2 / M39.3 only.

## Next Step

- Resume the official ROADMAP sequence (M40+).
- When the MTN / Airtel mobile-money adapter lands, swap the bodies of
  `PublicCommercePaymentsService.{handleCallback, handleIpn,
  reconcileStatus}` and finalise
  `createReservationCheckout` / `createEventBookingCheckout` to call
  the real provider. The DTO contracts and audit shape will not need
  to change. M39.3 folder E in the Postman collection will then start
  returning live responses instead of the pending payload.
