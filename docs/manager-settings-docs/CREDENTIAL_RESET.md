# Credential Reset — design (written before implementation, Track B6.7)

Per the standing rule that credential-adjacent docs precede the UI (CLAUDE.md §16,
followed for B6's `CREDENTIALS.md`/`STAFF_LIFECYCLE.md`), this document is written
**before** any B6.7 service/controller/UI code exists. It is the direct answer to the
headline finding of `CREDENTIALS.md` §5 ("there is no Manager-initiated password
reset") and to `STAFF_LIFECYCLE.md`'s note that `FORCE_RESET_BY_ADMIN` is a
schema-ready enum value nothing has ever used.

**Owner decision (2026-08-22): token-based reset only.** A Manager (or Owner)
triggers a reset for a staff member's account; the staff member receives a one-time
token and sets their own new secret. **The Manager never sees, chooses, or transmits
a credential.** Manager-set passwords/PINs were considered and explicitly **not**
chosen — do not build one, do not add one "for convenience," do not leave a code
path that would allow one. This document only covers **password-login** accounts
(Manager/Accountant, and any frontline staff who also have real password login,
i.e. `hasPasswordLogin === true` per `CREDENTIALS.md` §4/§5's `isSyntheticEmail`
check). **Quick-PIN staff are out of scope and untouched** — Quick-PIN's own
reset/disable/enable (`auth:quick-pin:*`, shipped in Track B3) is a *different*,
already-shipped, already-owner-approved mechanism (manager-reveals-once) that this
phase does not change, replace, or retrofit. The two are not in tension: Quick-PIN
staff who have no password identity at all cannot be targeted by this feature — the
service rejects them with a message pointing at Quick-PIN reset instead.

## 1. Reuse, not a parallel mechanism

Everything below reuses machinery `packages/db/prisma/schema.prisma` and
`apps/api/src/modules/auth/password-lifecycle.service.ts` already ship:

| Piece | Reused as-is? | Detail |
| --- | --- | --- |
| `PasswordResetToken` model | **Yes, unchanged** | `id / userId / tokenHash / purpose / expiresAt / consumedAt / invalidatedAt / ipAddress / userAgent / metadata / createdAt`. No migration. |
| `PasswordResetPurpose.FORCE_RESET_BY_ADMIN` | **Yes, unchanged** | Already defined in the enum since BG1; never previously written by any controller (confirmed by a repo-wide grep before this phase — the only hit was the docblock comment naming it). |
| `POST /api/auth/reset-password` (consume) | **Yes, unchanged, zero code touched** | Already purpose-agnostic — looks up by `tokenHash` regardless of `purpose`, checks `consumedAt`/`invalidatedAt`/`expiresAt`, hashes the new password (bcrypt cost 12), marks the token consumed, and — critically — **already revokes every active `Session` and `RefreshToken` row for the user** (`password-lifecycle.service.ts` L171-179). This single pre-existing code path satisfies the "reset must invalidate the subject's active sessions" security boundary on the consume side with no new code. |
| Token shape (random-hex, SHA-256-hashed-at-rest, single-use) | **Same pattern**, new prefix | `far_<48-hex>` (Force Admin Reset) vs. `prt_` (forgot-password) / `inv_` (invitation) — a distinct, greppable prefix, no format change. |
| Re-request-while-live behavior | **Same pattern as `forgotPassword()`** | Any previous un-consumed, un-invalidated `FORCE_RESET_BY_ADMIN` token for that subject is invalidated before a fresh one is issued — never two live tokens for the same subject+purpose at once. |
| `NIMBUS_EXPOSE_RESET_TOKENS` dev-only echo convention | **Same convention, narrower use** | See §4 — used only for QA, never for the Manager-facing response. |

**What is new:** one trigger-side service method, one status-read method, one HR
controller pair, one permission pair, one seed grant, and the audit events for the
trigger/rate-limit steps (the consume-side audit event already exists and is already
purpose-aware — see §6).

Nothing here required inventing a parallel token system — the brief's instruction to
reuse the invitation-token machinery is satisfied by reusing the sibling
`PasswordResetToken`/`FORCE_RESET_BY_ADMIN` machinery instead of `Invitation`
specifically, because `Invitation` is bound to *creating a brand-new user during
onboarding* (org/branch/role assignment, `INVITABLE_ROLES_DURING_ONBOARDING`), which
is the wrong shape for *resetting an existing user's credential* — `PasswordResetToken`
is the entity BG1 built for exactly this, and had already been earmarked
(`FORCE_RESET_BY_ADMIN`) for precisely this feature.

## 2. Where the route lives, and why

`POST /api/hr/employees/:id/credential-reset` and
`GET /api/hr/employees/:id/credential-reset` — alongside the existing employee
detail routes in `hr.controller.ts` (not `auth.controller.ts`'s older, org-only
`users/:id/...` shape used by M3.1 Quick-PIN). This mirrors the **B3-F1-fixed**
branch guard pattern (`frontline-staff-quick-pin.service.ts`'s `loadEmployeeForBranch`):
resolve the target `Employee` by `{id, orgId, branchId}` — a cross-branch or
missing employee is **404**, never a 403 that would confirm the id exists
elsewhere. An employee with no linked `User` account, or whose account is
PIN-only (`hasPasswordLogin === false`), is a **400** naming Quick-PIN reset as
the correct tool.

This also puts the control next to Suspend/Reactivate/Offboard on the same employee
detail panel the UI phase (item 3) targets, consistent with how those three actions
are wired (`PATCH /hr/employees/:id`, same panel, same branch context).

## 3. New permission

`auth:credential-reset:write` (trigger) and `auth:credential-reset:read` (status) —
seeded to **Owner and Manager only**, matching the exact grant shape
`auth:quick-pin:read`/`auth:quick-pin:write` already uses. Waiter, Cashier and
Supervisor hold neither string, so both routes 403 for them at the
`PermissionGuard` layer (verified live in §4 of the completion report).

⚠️ Per the standing project rule, this is a **local seed-only** grant until a
separate, explicitly authorized cutover deploys it to shared Neon (same pattern as
every prior permission addition in this project's history — C-21, C-22's
`onboarding:*` slice, etc.). It does not touch shared Neon in this phase.

## 4. The delivery-channel gap — disclosed, not solved here

`CREDENTIALS.md` §5/§6 already establishes the fact this phase inherits: **no
email or SMS transport is wired anywhere in this codebase.** The only place a
freshly generated plaintext token has ever left the server is the HTTP response of
the request that created it (`forgotPassword()`'s dev-only
`NIMBUS_EXPOSE_RESET_TOKENS` echo), or — for invitations — the create/resend
response itself (which is why B6 built `ManagerOneTimeSecretPanel`: the Manager
*is* the delivery channel for invitations, by necessity, not by choice).

This phase's owner decision is the opposite: the Manager must **never** see the
token. Combined with "no transport exists," the honest consequence is:

- **The trigger endpoint's response never includes the plaintext token, in any
  environment.** It returns only `{ ok, userId, expiresAt }` (the frontend's own
  `triggerManagerCredentialReset()` narrows this further, to `{ expiresAt }`
  only). This is an absolute rule with no dev exception (deliberately stricter than
  `forgotPassword()`'s own dev echo) — the Manager-facing API surface itself
  cannot leak the token even in non-production, because nothing distinguishes "a
  developer's Postman call" from "the real Manager's browser" at that boundary.
- **In production today, a triggered reset has no way to reach the staff member.**
  This is a disclosed, pre-existing infrastructure gap — identical in kind to the
  one `CREDENTIALS.md` already names for forgot-password — not something this
  phase's scope includes fixing (wiring email/SMS is separate, future,
  infrastructure work, tracked in `docs/KNOWN_LIMITATIONS.md`). What this phase
  *does* deliver, completely and correctly, is the authorization + audit +
  single-use + expiry + session-invalidation primitive around the token — the
  transport is the only missing piece, and it is missing for a documented,
  pre-existing reason, not a shortcut taken here.
- **For QA only**, a narrowly-scoped diagnostic field —
  `_devOnlyDeliveryPreview` — is added to the **trigger** response itself
  (there is nowhere else it *can* live: the plaintext exists for exactly one
  instant, at generation, and is never persisted anywhere, hashed or otherwise —
  a later status read has no plaintext to return under any gate, dev or not).
  It is gated by the exact same `NIMBUS_EXPOSE_RESET_TOKENS=true &&
  NODE_ENV !== 'production'` condition `forgotPassword()` already uses, and
  exists only so an automated QA harness (Postman/Playwright/psql-free browser
  QA) can complete the consume step without a real inbox. Putting it on the
  trigger response rather than a separate endpoint does not weaken the
  boundary — both are equally reachable by the same authenticated Manager via a
  direct API call in a non-production build; the actual protections are (a) the
  hard `NODE_ENV !== 'production'` gate, so the field cannot exist on any
  production response no matter who calls it, and (b) the Manager-facing
  **frontend** never reads or renders the field anywhere — enforced by a new
  assertion (§8) grepping the entire Manager tree for the field name. The
  **status** read (`GET .../credential-reset`) never includes it, in any
  environment, since it would have nothing correct to report there — the
  Manager-facing UI's own success state (item 3) is built against the status
  shape, not the trigger response, so this field never flows into anything the
  UI renders even in dev.

## 5. Rate limiting

No throttler/rate-limit infrastructure exists anywhere in this API today (checked —
zero `@nestjs/throttler` or equivalent usage repo-wide). Limits are enforced at the
service layer via a `PasswordResetToken.count()` query scoped by `purpose` and a
rolling window — no schema change, since `metadata` (existing `Json?` column)
already carries `{ triggeredByUserId, triggeredByBranchId }` (actor identity only,
never a secret) for the per-actor count to query against.

| Scope | Limit | Window | Rationale |
| --- | --- | --- | --- |
| Per subject | 3 triggers | rolling 60 minutes | Allows a legitimate "they said they didn't get it, try again" retry twice without allowing an unbounded token-minting loop against one account. |
| Per actor (Manager) | 20 triggers | rolling 60 minutes | High enough to never block a real onboarding/incident-response burst across many staff, low enough to bound a compromised or malicious Manager session's blast radius. |

A rejection is **429** and emits `CREDENTIAL_RESET_RATE_LIMITED` (audited — actor,
subject, no secret) rather than failing silently.

## 6. Session invalidation — when, and the one disclosed limitation

Sessions/refresh tokens for the **subject** are revoked at **two** points, both
already using the exact `session.updateMany` / `refreshToken.updateMany` pattern
`resetPassword()` already contains:

1. **At trigger time** (new) — immediately, so a Manager responding to a suspected
   compromise does not have to wait for the staff member to consume the token
   before the staff member's (or an attacker's) live session dies.
2. **At consume time** (pre-existing, unchanged) — defense-in-depth, catching any
   session created between trigger and consume.

⚠️ **Disclosed limitation, not fixed here:** neither step touches
`User.passwordHash` — only `resetPassword()`'s consume step ever replaces it. This
means between trigger and consume, the **old password itself still works** for a
brand-new login (a fresh session, with the pre-reset password) even though every
*existing* session was just killed. This is intentional scope discipline, not an
oversight: nulling/disabling the password at trigger time would make this feature a
second implementation of **Suspend** (already shipped in B6,
`PATCH /hr/employees/:id {status}`), which exists precisely for "lock this person
out entirely, right now." A Manager who needs both effects (kill the session *and*
make the old password stop working immediately) already has both tools and can use
them together; conflating them into one action would blur two distinct, already-
reasoned-about behaviors. `STAFF_LIFECYCLE.md`'s own disclosure that Suspend has no
cascade to sessions/PIN/login stays true and unrelated to this feature.

This satisfies the brief's "if the session model cannot do this, STOP and report" —
the session model demonstrably *can* revoke sessions (proven by `resetPassword()`'s
pre-existing code), so no session-only Manager action was left un-actioned; the
password-hash-timing caveat above is a distinct, disclosed design boundary, not a
capability gap.

## 7. Audit events

| Event | When | Actor | Subject | Metadata (never a secret) |
| --- | --- | --- | --- | --- |
| `CREDENTIAL_RESET_TRIGGERED` | New token issued | Manager/Owner (`actorUserId`) | employee's `User.id` (`entityId`) | `{ employeeId, branchId, expiresAt }` — branch-stamped per the C-26 precedent |
| `CREDENTIAL_RESET_RATE_LIMITED` | 429 | Manager/Owner | employee's `User.id` | `{ employeeId, branchId, scope: 'subject'\|'actor' }` |
| `PASSWORD_RESET_COMPLETED` | Consume (existing, unchanged) | the staff member themself (`actorUserId = user.id`, since `resetPassword()` is unauthenticated-by-token, not by session) | `User.id` | `{ purpose: 'FORCE_RESET_BY_ADMIN' }` — already purpose-aware, no code change |

No event, at any step, includes the plaintext token or password. Consistent with
`CREDENTIALS.md`'s own audit-review method, every metadata object above was designed
by naming its exact fields here before writing the call site, not by pattern-matching
after the fact.

## 8. Validation this design implies (carried into the build/QA tasks)

- Unit: single-use (second consume attempt on the same token → `ConflictException`,
  pre-existing `resetPassword()` behavior, re-asserted for `FORCE_RESET_BY_ADMIN`),
  expiry (`expiresAt < now` → `ConflictException`, pre-existing, re-asserted),
  re-request invalidates the prior token, rate limits at the exact boundary (3rd
  succeeds / 4th 429 per subject; 20th succeeds / 21st 429 per actor),
  `hasPasswordLogin === false` → 400, cross-branch/missing employee → 404.
- Assertion script: `_devOnlyDeliveryPreview` string appears nowhere under
  `apps/web/src/components/manager` or `apps/web/src/lib/manager`; no
  `useMutation`/fetch call in the Manager tree reads that field name.
- Cross-role: Waiter/Cashier/Supervisor tokens get 403 on both new routes (live
  `curl`, all three, both routes — never assumed from one role's result).
