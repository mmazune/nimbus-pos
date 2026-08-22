# Manager Settings / Identity / Invitations / Credentials — API Matrix

**Canonical, live-verified record for Track B6.** Every row below was hit against a
freshly migrated + seeded **isolated local Docker Postgres stack** (`nimbus_b6_qa`,
port `55491`, API on port `4111`) — never shared Neon for writes. A secondary
read-only probe was also run against the pre-existing shared-Neon dev API (`:3001`)
to establish what production actually serves today; where the two disagree, both
numbers are given and the reason is explained (see §5).

Status codes are **observed**, not inferred from source. Login returns 201 per
project convention; every other status below is the literal HTTP code returned.

---

## 1. Settings (`SettingsController`, `apps/api/src/modules/settings/`)

Org-level singleton (`OrgSettings`, one row per `orgId`, resolved from the caller's
first ACTIVE membership — **no branch scoping, no `X-Branch-Id` predicate anywhere
in this controller**). Audit events are `C-28-EXEMPT` (OrgSettings has no
`branch_id` column) — correctly exempt, not a gap.

| Route | Method | Permission | Branch-scoped? | Manager holds it? | Observed (isolated) | UI before B6 |
| --- | --- | --- | --- | --- | --- | --- |
| `/settings` | GET | `tenancy:org:read` | No (org) | Yes | 200 | None |
| `/settings` | PATCH | `tenancy:settings:manage` | No (org) | Yes | 200 | None |
| `/settings/currency` | GET | `tenancy:org:read` | No (org) | Yes | 200 | None |
| `/settings/currency` | PUT | `tenancy:settings:manage` | No (org) | Yes | 200 | None |
| `/settings/tax-matrix` | GET | `tenancy:org:read` | No (org) | Yes | 200 | None |
| `/settings/tax-matrix` | PUT | `tenancy:settings:manage` | No (org) | Yes | 200 | None |
| `/settings/rounding` | GET | `tenancy:org:read` | No (org) | Yes | 200 | None |
| `/settings/rounding` | PUT | `tenancy:settings:manage` | No (org) | Yes | 200 | None |
| `/thresholds` | GET | `tenancy:org:read` | No (org) | Yes | 200 | None |
| `/thresholds` | PATCH | `tenancy:settings:manage` | No (org) | Yes | 200 | None |
| `/settings/platform-access` | GET | `tenancy:org:read` | No (org) | Yes | 200 | None |
| `/settings/platform-access` | PUT | `tenancy:settings:manage` | No (org) | Yes | 200 | None |
| `/settings/exchange-rate` | POST | `tenancy:settings:manage` | No (org) | Yes | Not exercised live this pass (shape identical to sibling PUTs; DTO-validated) | None |
| `/settings/exchange-rates` | GET | `tenancy:org:read` | No (org) | Yes | 200 | None |

**Fields covered by `PATCH /settings` (`UpdateOrgSettingsDto`):** `vatPercent`,
`currency`, `discountApprovalThreshold`, `reservationHoldMinutes`, `receiptFooter`,
`metadata`, `anomalyThresholds`, `platformAccess`, `franchiseWeights`,
`showCostToChef`, `defaults`, `baseCurrencyCode`, `taxMatrix`, `rounding`,
`bookingPolicies`, `attendance`, `inventoryTolerance`.

**Zero settings/identity endpoints existed with a Manager UI before this phase** — 14
of 14 Settings routes above had no Manager-facing screen; `pages/manager/settings.tsx`
was the honest not-yet foundation page from M-P1/B1. This matches the pattern the
2026-08-20 gap analysis found for accounting (~90 endpoints, zero UI): a fully-built,
permission-correct backend with no consuming screen.

**⚠️ `platformAccess` (`UpdatePlatformAccessDto` shape `{useRoleDefaults, overrides}`) is
stored but has ZERO consumers anywhere in `apps/api/src`** (repo-wide grep for
`platformAccess` outside `modules/settings/` returns nothing). `PermissionGuard` never
reads it. It is dead configuration — writable, persisted, and inert. Building a UI for
it would visually imply a permission-override capability that does not exist. **This
phase's Settings UI deliberately omits Platform Access**, with this finding as the
written reason (do not add it without first wiring a real consumer).

---

## 2. Identity / Tenancy (`TenancyController`, plus `identity:*` strings used by `auth.controller.ts`)

| Route | Method | Permission | Branch-scoped? | Manager holds it? | Observed (isolated) |
| --- | --- | --- | --- | --- | --- |
| `/orgs` | POST | `tenancy:org:write` | No | No | Not probed (Owner-class route; out of B6 scope) |
| `/orgs` | GET | none (any authenticated) | No | Yes | Not probed |
| `/orgs/:orgId` | GET | none | No | Yes | Not probed |
| `/orgs/:orgId/branches` | POST | `tenancy:branch:write` | No | Yes | Not probed |
| `/branches` | GET | none | No | Yes | 200 |
| `/branches/:branchId` | GET | none | No | Yes | Not probed |
| `/orgs/:orgId/branches/:branchId/memberships` | POST | `tenancy:membership:manage` | Yes | Yes | Not probed (would create a real membership; deferred) |
| `/orgs/:orgId/branches/:branchId/memberships` | GET | `tenancy:membership:manage` | Yes | Yes | 200 |
| `/auth/me` | GET | none | — | Yes | 200 |
| `/auth/sessions` | GET | none (own sessions only) | — | Yes | 200 |
| `/auth/users/:id/issue-quick-pin` | POST | `identity:user:write` | No (org-wide route — see CREDENTIALS.md §3) | Yes | Not probed (issue is for a PIN-less user; reset was probed instead, same permission) |
| `/auth/users/:id/reset-quick-pin` | POST | `identity:user:write` | No | Yes | 201 |
| `/auth/users/:id/quick-pin-settings` | PATCH | `identity:user:write` | No | Yes | 200 (both disable and re-enable) |
| `/auth/users/:id/quick-pin-status` | GET | `identity:user:read` | No | Yes | 200 |

**There are two independent Quick-PIN reset code paths** gated by two different
permission strings, both held by Manager:

1. `POST /auth/users/:id/reset-quick-pin` (`identity:user:write`) — the general
   identity-module route, takes a raw `userId`.
2. `POST /hr/frontline-staff/:id/quick-pin/reset` (`auth:quick-pin:write`) — the
   HR-module route already wired into the B3 `ManagerQuickPinScreen`, takes an
   `employeeId` and resolves to the linked user internally.

This phase's Staff UI **reuses path 2** (already built, already tested) rather than
adding a second, parallel Quick-PIN reset control bound to path 1 — one action per
concept, per the shared-component reuse rule.

---

## 3. Invitations (`ClientOnboardingController`, `apps/api/src/modules/client-onboarding/`)

| Route | Method | Permission | Branch-scoped? | Manager holds it? | Observed (isolated) |
| --- | --- | --- | --- | --- | --- |
| `/onboarding/status` | GET | `onboarding:read` | No (org) | **Yes, as of this phase** | Pre-fix: 403 for Owner and Manager (no role held this string). Post-fix: not re-probed live (read-only, low risk; permission grant verified via JWT payload instead — see §6) |
| `/onboarding/organization` | POST | `onboarding:write` | No | **Yes, as of this phase** | Pre-fix: 403 for Owner and Manager — see §5/§6, finding C-31/C-22. Post-fix: not re-probed live (org-creation is a one-shot, non-idempotent action; the sibling `POST /onboarding/invitations` below was used as the live proof instead, same permission gate) |
| `/onboarding/branches` | POST | `onboarding:write` | No | **Yes, as of this phase** | Not probed live (same reason as above) |
| `/onboarding/business-profile` | PATCH | `onboarding:write` | No | **Yes, as of this phase** | Not probed live (same reason) |
| `/onboarding/settings` | PATCH | `onboarding:write` | No | **Yes, as of this phase** | Not probed live (same reason) |
| `/onboarding/invitations` | POST | `onboarding:write` | No (`Invitation.branchId` is required, but resolution is org-wide) | **Yes, as of this phase** | Pre-fix: 403 (Owner). **Post-fix: 201 (Manager) — live-proven, see §6** |
| `/onboarding/invitations` | GET | `onboarding:invitation:write` | No (org) | Yes | **200 — new in B6, see §4** |
| `/onboarding/invitations/:id/resend` | POST | `onboarding:invitation:write` | No (org) | Yes | 201 |
| `/onboarding/invitations/:id/revoke` | PATCH | `onboarding:invitation:write` | No (org) | Yes | 200 |
| `/auth/invitations/accept` | POST | none (public, token-based) | — | — | Not probed live this pass (token-consuming, one-shot; would burn the test fixture) |

### Finding C-31 — `onboarding:write` was unreachable by every seeded role, including Owner (FIXED this phase, see §6)

`packages/db/prisma/seed.ts`'s `ROLE_PERM_MATRIX` did not grant `onboarding:write` (or
`onboarding:read`) to **any** role — the two strings were referenced by
`client-onboarding.controller.ts` since BG1 but never declared as `Permission` rows at
all. `PermissionGuard` has no bypass for Owner or any other role — it is a flat
`requiredPermissions.every(p => userPermissions.includes(p))` check. Live-proven
**before the fix** on the isolated stack: `POST /onboarding/organization` and
`POST /onboarding/invitations` both returned **403 for the Owner demo user**, not just
Manager.

Consequences before the fix:
- The entire client-onboarding **create** wizard (org → branch → business profile →
  settings → team invitations) was unreachable through the API by anyone.
- No `Invitation` row had ever been created through this endpoint in any environment
  this phase could inspect — `seed.ts` and `demo-import.ts` do not create `Invitation`
  rows directly either, so the model had no organic data anywhere.

**This is exactly item 6's C-22 check surfacing a concrete consequence, not a separate
new bug class** — `onboarding:*` is one of the seven unseeded-permission prefixes
already catalogued as C-22 ("`onboarding:* (2)`" — precisely `onboarding:read` and
`onboarding:write`). Item 6 explicitly authorizes seeding exactly what a B6 surface
needs; the Staff UI's "invite staff" action needs a working create path, so **both
strings were added to `PERMISSIONS_DATA` and granted to Owner and Manager only** (the
same two roles that already held `onboarding:invitation:write`) — see §6 for the full
before/after and the live re-verification. No other role was touched.

---

## 4. New in B6 — `GET /onboarding/invitations`

Added because Manager holds `onboarding:invitation:write` (resend/revoke) but had **no
way to discover an invitation id** — there was no list route, and Manager cannot create
invitations either (C-31), so it never sees a creation response. Without this route,
resend/revoke were permission-correct but practically unusable through any UI.

- **Route:** `GET /api/onboarding/invitations`
- **Permission:** `onboarding:invitation:write` (reused — no new permission string, no
  seed change)
- **Scope:** organisation-wide (matches `resendInvitation`/`revokeInvitation`'s own
  `resolveOrgContext` scoping; `Invitation.branchId` is a column but the module has no
  branch-filtered read anywhere)
- **Shape:** bare array (`PC-06`-style — no server `total`; the codebase does not
  paginate list-only entities that lack a `GET :id`), never returns `tokenHash`
- **Unit-tested:** `client-onboarding.service.spec.ts` → `describe('listInvitations')`
  (queries by `organizationId`, orders `createdAt desc`, asserts `tokenHash` absent
  from the Prisma `select`)
- **Live-proven full lifecycle** on the isolated stack (a row was inserted directly via
  SQL since no live create path exists per C-31): list → 200 (row visible, no
  `tokenHash` on the wire) → resend → 201 (`resendCount` incremented) → revoke → 200
  (`status: REVOKED`) → cross-role Waiter/Cashier/Supervisor list → 403/403/403.

---

## 5. Shared-Neon vs. isolated-stack disagreement — Finding C-30 (critical, live-proven)

A read-only probe against the pre-existing shared-Neon dev API (`:3001`, the same
database referenced throughout this project's history) showed:

```
GET /api/hr/compensation-profiles  (Manager token)  →  200, real salary data returned
```

On the freshly seeded isolated stack (current `seed.ts` source, matching the FU-1
locked decision), the identical call returns:

```
GET /api/hr/compensation-profiles  (Manager token)  →  403
```

**Root cause:** `packages/db/prisma/seed.ts`'s `REVOKED_ROLE_PERMISSIONS` table
correctly declares `pos:hr:compensation:read` revoked from Manager (FU-1, the
2026-08-20 permissions cutover), and `revokeStaleRolePermissions()` correctly deletes
the `RolePermission` row when run. But **shared Neon has never had this function run
against it** — every historical validation pass for FU-1 and everything downstream
(the permissions cutover, backend gap batches 1–4, B5.1–B5.7) was explicitly performed
on an **isolated** stack precisely so shared Neon would never be touched, and every one
of those completion reports states "Shared-Neon deploy is STILL GATED." This is not a
new regression this phase introduced — it is the accumulated, previously-undescribed
consequence of that gating: **right now, on the database the pre-existing `:3001` dev
API actually serves, a Manager token can read real employee salary data**, directly
contradicting the locked "compensation excluded from the Manager MVP" decision.

Confirmed via the live JWT payload, not just the route response: the Manager demo
user's `permissions` array on shared Neon still contains `pos:hr:compensation:read`
(214 total permissions); the same user's array on the freshly seeded isolated stack
does not (256 total permissions, matching current seed.ts exactly — the isolated count
is higher because it reflects every merged fix since the shared-Neon snapshot,
compensation exclusion included).

**Not fixed here** — reseeding shared Neon requires the same explicit per-cutover
authorization gate every prior phase has required (CLAUDE.md §14), and is out of scope
for a docs/UI-focused phase. **This phase's own Manager Staff UI never calls
`/hr/compensation-profiles` and never requests `?view=full`**, so it does not itself
leak anything regardless of what the live grant allows — see `CREDENTIALS.md` §5 and
the compensation-leak assertion in `scripts/manager-b6-assertions.ts`. Flagged here as
the most important finding of this phase's research pass; recommend the next
backend-authorized batch include a shared-Neon reseed (or a targeted `DELETE FROM
role_permissions WHERE …` cutover) to close this live gap.

---

## 6. C-22 permission check (item 6) — `onboarding:read`/`onboarding:write` seeded, 35 of 37 remain

Per the brief's item 6: determine whether any B6 settings surface depends on one of the
37 unseeded deferred-module permissions (`franchise:*` 12, `ops:*` 8, `dev:*` 5,
`merchant:*` 4, `billing:*` 3, `onboarding:*` 2, `support:*` 2). **Yes** — the Staff
UI's invite-staff action depends on `onboarding:write`, and the wizard-status read
depends on `onboarding:read`; both are exactly the two strings in C-22's
`onboarding:*` bucket.

**Seeded, this phase, to Owner and Manager only:**

| Permission | Description | Granted to |
| --- | --- | --- |
| `onboarding:read` | Read client-onboarding wizard progress/status | Owner, Manager |
| `onboarding:write` | Create org/branch during onboarding; update business profile/settings; create invitations | Owner, Manager |

No other role (Accountant, Supervisor, Cashier, Chef, Waiter, Bartender, Procurement)
was touched — confirmed by grepping `seed.ts` for both literal strings after the edit:
they appear exactly twice each, once in `PERMISSIONS_DATA` and once in each of the
Owner/Manager arrays.

**Live re-verified on the isolated stack after a second, idempotent `db:seed` run**
(0 created / all skipped for every non-permission seed section — confirms the second
run did not duplicate or disturb existing data):

- Fresh Owner login → `onboarding:read` ✅, `onboarding:write` ✅ (274 total permissions,
  up from 272 before this phase's seed edit).
- Fresh Manager login → `onboarding:read` ✅, `onboarding:write` ✅ (258 total, up from
  256 before this phase's seed edit).
- `POST /onboarding/invitations` as Manager, inviting a real Accountant → **201**,
  full response including `tempPassword`/`invitationToken` (one-time reveal, matching
  the existing pattern), a real `User`+`Membership`+`Invitation` created.
- `GET /onboarding/invitations` as Manager → **200**, both the newly created
  invitation and the earlier SQL-seeded fixture visible, 2 rows.
- `GET /onboarding/invitations` as Waiter → **403** (unchanged — Waiter's permission
  set was not touched by this edit; verified directly against the seed source, not
  re-derived).

**37 − 2 = 35 of the C-22 deferred-module permissions remain unseeded for a future
Track B7 (Owner/franchise/dev-portal/billing) batch**: `franchise:*` (12), `ops:*`
(8), `dev:*` (5), `merchant:*` (4), `billing:*` (3), `support:*` (2). None of these
seven prefixes has any dependency from a B6 settings/staff/credential surface — B6
does not touch, need, or recommend seeding any of them.

## 7. Settings census summary

| Category | Endpoints found | Manager holds all of them? | UI before B6 |
| --- | --- | --- | --- |
| Org settings (currency/tax/rounding/thresholds/platform-access/exchange-rate) | 14 | Yes (all 14) | 0 of 14 |
| Identity/session (`identity:*`) | 4 relevant to this phase | Yes | 0 (Sessions has no Manager screen; out of B6's staff/settings scope) |
| Invitations | 8 (7 pre-existing + 1 new) | Yes — create (`onboarding:write`, C-31/C-22, fixed this phase) + read/resend/revoke, all held by Manager | 0 of 8 |
| Quick-PIN | 4 (`identity:user:*` path) + 4 (`hr:frontline-staff` path, already UI'd in B3) | Yes | 4 of 4 already shipped (B3); this phase adds no new Quick-PIN route |
| HR employees (status/suspend) | 1 (`PATCH /hr/employees/:id`) | Yes | Directory existed (B3, read + limited fields); status-transition control did not |
| Device/printer/terminal registry | 9 (`devices:*`) | Yes (full access) | **0 of 9 — explicitly out of scope for B6, see below** |

**Device/printer/terminal registry (`device-registry.controller.ts`) is a real,
zero-UI settings surface Manager fully holds** (`devices:read/write/status:write/
routes:write/terminals:write`), matching the item-1 census brief's "receipt/printer/
device config" category. It is **not built in this phase** — B6's brief is scoped by
the owner's own framing ("onboarding and password setting/changing for staff") and by
the Odoo reference screenshots this phase follows (07–11: settings, users, password —
not hardware). Recorded here so a future phase does not have to re-discover it from
scratch; no code was written against it.

---

## 8. Method

Two-pass verification:

1. **Read-only probe against shared-Neon `:3001`** — establishes production-adjacent
   reality (surfaced finding C-30). No write requests were sent to this API at any
   point in this phase.
2. **Full read+write verification against an isolated local Docker Postgres stack**
   (`nimbus_b6_qa`, `postgres:16`, port `55491`) — fresh `prisma migrate deploy` (18
   migrations, 0 drift) + fresh `db:seed`, API built via `nest build` and run as
   `node dist/main.js` on port `4111` with an explicitly constructed child
   environment (`DATABASE_URL`/`DIRECT_DATABASE_URL` exported inline, never written to
   any `.env` file). Isolation verified via `lsof -p <pid>` showing the API process's
   only established TCP connection is to `localhost:55491`.
