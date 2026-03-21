# Completion Report — M3 Multi-Tenancy Core (Org / Branch / Membership)

## Context Snapshot

- Current milestone: M3 ✅
- Previous completed milestone: M2 — Auth v1 + JWT Sessions + RBAC + Audit Log
- Next milestone: M4 — Settings + Numbering + Accounting Readiness

## Summary

- What was built: Multi-tenancy core layer — Organization, Branch, and Membership models with full CRUD, a reusable BranchContextGuard for branch-scoped access control, tenancy-aware `/api/me` endpoint, 5 new permissions, audit logging for tenancy writes, and seed baseline data.
- What is now working: Organizations can be created and listed. Branches can be created under orgs and listed/retrieved. Memberships link users to branches with roles. The BranchContextGuard validates `X-Branch-Id` header, checks branch status, and verifies user membership before allowing access. The `/api/me` endpoint returns full tenancy context (orgs, branches, memberships, roles, permissions, session). All M2 auth flows remain intact.

## Files Added / Changed

### Added
- `apps/api/src/modules/tenancy/tenancy.module.ts`
- `apps/api/src/modules/tenancy/tenancy.controller.ts`
- `apps/api/src/modules/tenancy/tenancy.service.ts`
- `apps/api/src/modules/tenancy/tenancy.service.spec.ts`
- `apps/api/src/modules/tenancy/dto/index.ts`
- `apps/api/src/modules/tenancy/dto/create-org.dto.ts`
- `apps/api/src/modules/tenancy/dto/create-branch.dto.ts`
- `apps/api/src/modules/tenancy/dto/create-membership.dto.ts`
- `apps/api/src/common/guards/branch-context.guard.ts`
- `apps/api/src/common/guards/branch-context.guard.spec.ts`
- `apps/api/src/common/decorators/require-branch-context.decorator.ts`
- `apps/api/test/tenancy.e2e-spec.ts`
- `postman/collections/M3-Tenancy.postman_collection.json`

### Changed
- `packages/db/prisma/schema.prisma` — added Organization, Branch, Membership models + enums
- `packages/db/prisma/seed.ts` — added M3 permissions, org/branch/membership seeding, updated version to 0.3.0
- `apps/api/src/app.module.ts` — imported TenancyModule
- `apps/api/src/common/guards/index.ts` — exported BranchContextGuard
- `apps/api/src/common/decorators/index.ts` — exported RequireBranchContext + BRANCH_CONTEXT_KEY
- `postman/environments/dev.postman_environment.json` — added orgId, branchId, secondUserId, secondAccessToken, waiterRoleId

## Database

- Prisma models added: Organization, Branch, Membership
- Enums added: OrganizationStatus (ACTIVE, SUSPENDED, CLOSED), BranchStatus (ACTIVE, INACTIVE, CLOSED), MembershipStatus (ACTIVE, INACTIVE, REVOKED)
- Migration name: `20260320073537_m3_tenancy_org_branch_membership`
- Indexes / constraints: Organization.slug (unique), Branch.[organizationId, code] (unique composite), Membership.[userId, branchId] (unique composite), FK relations to User, Role, Organization
- Seed updates: 1 org ("Nimbus Restaurant Group"), 2 branches ("Main Branch" + "Downtown Branch"), 6 memberships across owner/manager/accountant/cashier/chef/waiter. 5 new permissions added to role-permission matrix.
- Notes: All seed operations are idempotent (upsert-based). User and Role models gained `memberships` relation.

## API

- Modules added: TenancyModule (apps/api/src/modules/tenancy/)
- Endpoints added:
  - `POST /api/orgs` — create organization (tenancy:org:write)
  - `GET /api/orgs` — list user's organizations
  - `GET /api/orgs/:orgId` — get organization detail
  - `POST /api/orgs/:orgId/branches` — create branch (tenancy:branch:write)
  - `GET /api/branches` — list user's branches
  - `GET /api/branches/:branchId` — get branch detail
  - `POST /api/orgs/:orgId/branches/:branchId/memberships` — create membership (tenancy:membership:manage)
  - `GET /api/orgs/:orgId/branches/:branchId/memberships` — list memberships
  - `GET /api/me` — tenancy-aware session context
  - `GET /api/branch-test` — BranchContextGuard smoke test (requires X-Branch-Id)
- Guards applied: JwtAuthGuard (all), PermissionGuard (write endpoints), BranchContextGuard + @RequireBranchContext (branch-test)
- Audit coverage: ORG_CREATED, BRANCH_CREATED, MEMBERSHIP_CREATED, BRANCH_ACCESS_DENIED
- Idempotency coverage: Duplicate slug → 409, duplicate membership → 409

## Tests

- Unit tests: 11 new (7 tenancy.service.spec + 4 branch-context.guard.spec) — all passing
- E2e tests: 13 new (tenancy.e2e-spec across 3 suites: Org+Branch CRUD, Membership CRUD, BranchContextGuard+Permissions) — all passing
- M2 regression: All 20 unit + 16 e2e tests still passing
- Commands run: `npx jest --config apps/api/test/jest-e2e.json`, `cd apps/api && npx jest --passWithNoTests`
- Results: 31 unit tests passing (6 suites), 29 e2e tests passing (3 suites)

## Postman

- Collection added: `M3-Tenancy.postman_collection.json` (11 requests)
- Variables added: orgId, branchId, secondUserId, secondAccessToken, waiterRoleId
- Test scripts: Token capture on login, orgId/branchId capture on create, status code + schema assertions
- Manual checklist: Documented in POSTMAN_GUIDE.md

## Docs

- ROADMAP status impact: M3 milestone marked complete
- Files updated:
  - `README.md` — milestones table updated (M3 ✅)
  - `docs/ARCHITECTURE.md` — added Multi-Tenancy Architecture section
  - `docs/API_CONVENTIONS.md` — added Tenancy endpoints table + Branch Context Header docs
  - `docs/MODULES.md` — tenancy module marked Implemented
  - `postman/POSTMAN_GUIDE.md` — added M3 checklist + updated directory structure + coverage table
  - `ai/AI_STATUS.md` — updated current milestone, added M3 checklist
  - `repo file tree.txt` — added all new M3 files

## DONE Checks

- `pnpm lint` — 0 errors
- `pnpm test` — 31 tests passing (6 suites)
- `pnpm test:e2e` — 29 tests passing (3 suites)
- `pnpm db:migrate` — all migrations applied (3 total)
- `pnpm db:seed` — idempotent (verified 2 runs)
- `pnpm dev:api` — API starts on port 3001
- Manual verification: GET /api/health → 200, GET /api/me → 200 with tenancy context

## Decisions / Deviations

- Controller path: Used `modules/tenancy/` instead of `modules/org/` as referenced in MODULES.md — "tenancy" better reflects the module's scope (org + branch + membership).
- Branch-test endpoint: Added `GET /api/branch-test` as a smoke-test route for BranchContextGuard; intended for dev verification only, can be removed in production.
- Membership scoping: List endpoints (orgs, branches) are scoped to the authenticated user's memberships rather than returning all records — follows principle of least privilege.

## Known Issues

- None.

## Next Step

- M4 — Settings + Numbering + Accounting Readiness: org settings, branch settings, number sequences, tax categories, payment method config, posting rule contracts.
