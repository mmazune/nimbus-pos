# Staff Lifecycle — invited → accepted → active → suspended → offboarded

Canonical record for Track B6, live-verified against an isolated local Docker
Postgres stack (see `MANAGER_SETTINGS_API_MATRIX.md` §7 for the exact setup). The API
is the source of truth (CLAUDE.md §19) — every stage below states what the code
actually does, not what the stage name implies it should do.

There are **two structurally different staff onboarding paths** in this codebase.
They are not variants of one flow — they use different models, different auth
mechanisms, and different permissions.

---

## Path A — Frontline staff (Quick-PIN), already built in Track B3

For Cashier / Waiter / Chef / Supervisor-tier roles that authenticate with a PIN, not
a password.

`POST /hr/frontline-staff/onboard` (`hr:frontline-staff:create`, held by Manager) is
**one call** that atomically creates `User` + `Membership` + `Employee` + a Quick-PIN,
already wired into `components/manager/staff/ManagerOnboardingScreen.tsx`. B6 does not
change this path — it is reused as-is, per the shared-component rule.

- **Invited:** N/A — there is no separate invited state; the call is synchronous
  create-and-activate.
- **Accepted:** N/A — no acceptance step. The PIN is live immediately.
- **Active:** the created `User.quickPinEnabled = true`; `Employee.status = ACTIVE`
  (schema default).
- **Suspended / offboarded:** see the shared "Employee status" section below — Path A
  and Path B converge here, since both create an `Employee` row.
- **Credential reset:** `POST /hr/frontline-staff/:id/quick-pin/reset`
  (`auth:quick-pin:write`), already wired into `ManagerQuickPinScreen.tsx`. B6 reuses
  this — see `MANAGER_SETTINGS_API_MATRIX.md` §2 for why the sibling
  `/auth/users/:id/reset-quick-pin` route is deliberately not duplicated in the UI.

## Path B — Office staff (email + password), Manager/Accountant roles

The `client-onboarding` module's invitation flow. **This path's create step was
unreachable by any role until this phase** — see `MANAGER_SETTINGS_API_MATRIX.md`
§3/§6, finding **C-31** (the concrete manifestation of C-22's `onboarding:*` bucket):
no seeded role, including Owner, held `onboarding:write`. This phase seeded
`onboarding:read`/`onboarding:write` to Owner and Manager (item 6's explicit
authorization to close exactly what B6 needs), so `POST /onboarding/invitations` is
now live and Manager-actionable — verified end-to-end on the isolated stack: a real
invitation for a new Accountant was created (201), listed, then a second,
directly-SQL-inserted fixture was used to separately prove resend/revoke/list before
the permission fix (both are now exercised through the real create path too).

### 1. Invited

`ClientOnboardingService.inviteOne()` (private, called only from `createInvitations`,
initially unreachable per C-31, since fixed — see above) does the following as a single logical sequence — **not**
a single DB transaction (each step is a separate Prisma call):

1. Look up the target `Role` by name. **Only `Manager` and `Accountant` are
   invitable** through this path (`INVITABLE_ROLES_DURING_ONBOARDING` — a hard-coded
   allow-list; any other role name throws `BadRequestException`).
2. If no `User` exists for the email, create one with a generated temp password
   (`Tmp-<random>!9`, bcrypt-hashed at cost 10) and bind a `UserRole` immediately so
   RBAC resolves at first login.
3. Upsert a `Membership` — **created with `status: 'ACTIVE'` immediately**, not a
   pending state. There is no `MembershipStatus.INVITED` — the enum is
   `ACTIVE | INACTIVE | SUSPENDED`. A brand-new invitee's membership is indistinguishable
   from an established one by status alone.
4. Expire any prior `PENDING` invitation for the same org+email (`updateMany`), then
   create the new `Invitation` row (`status: PENDING`, 14-day TTL, `tokenHash` =
   SHA-256 of a `inv_<32-hex>` plaintext token — the plaintext is returned **once**, in
   the API response only, never persisted).
5. Audit `ONBOARDING_INVITATION_CREATED`.

**Practical consequence of step 3 preceding true acceptance:** because the Membership
is already `ACTIVE`, an invitee holding the returned `tempPassword` could already log
in and act with their role's full permission set **before** ever calling
`/auth/invitations/accept`. Acceptance (below) is therefore a **credential-rotation**
step, not a gate on access — worth knowing before assuming "invited" means "cannot yet
act."

### 2. Resend / Revoke (Manager-actionable, live-proven this phase)

- `POST /onboarding/invitations/:id/resend` (`onboarding:invitation:write`) — rejects
  `ACCEPTED` (409) and `REVOKED` (409) invitations; otherwise rotates the token,
  extends expiry by 14 days, increments `resendCount`. Live-proven: `resendCount` went
  `0 → 1`.
- `PATCH /onboarding/invitations/:id/revoke` (`onboarding:invitation:write`) —
  rejects `ACCEPTED` (409, "cannot revoke"); revoking an already-`REVOKED` invitation
  is **idempotent** (`200`, `{alreadyRevoked: true}`, no duplicate audit side effect).
  Live-proven: `status: PENDING → REVOKED`.
- `GET /onboarding/invitations` — **new in B6**, see the API matrix §4. Without it,
  resend/revoke were unusable (no way to discover an id).
- Neither route checks whether the *original inviter* (`invitedById`) is still an
  active employee — see "What happens when the inviter is offboarded" below.

### 3. Accepted

`POST /auth/invitations/accept` (public, no auth guard, `AcceptInvitationDto`) is
handled by `InvitationLifecycleService.accept()`, not the client-onboarding service.
Not exercised live this phase (token-consuming and would burn the one live-inspectable
fixture) — described from source:

- Resolves the invitation by matching the SHA-256 hash of the presented plaintext
  token against `tokenHash`.
- Rejects if `status !== PENDING` or `expiresAt` has passed.
- Sets the user's real password (the invitee chooses one at accept time — this is
  where the temp password is actually replaced) and marks the invitation `ACCEPTED`,
  stamping `acceptedAt`/`acceptedById`.
- Given step 1.3 above, the Membership does not change state here — it was already
  `ACTIVE`. Acceptance's real effect is "the invitee now controls their own
  credential," not "the invitee gains access."

### 4. Active

No distinct "active" transition exists beyond `Membership.status = ACTIVE` (set at
invitation-creation time, Path B) or the Employee/User creation itself (Path A). There
is no separate activity/last-seen tracking consulted by this lifecycle.

### 5. Suspended / Offboarded — shared by both paths, and the most important finding in this document

Both paths eventually produce an `Employee` row (`Employee.status: EmployeeStatus`,
values `ACTIVE | ON_LEAVE | SUSPENDED | TERMINATED`). The only write path is
`PATCH /hr/employees/:id` (`pos:hr:employees:update`, held by Manager),
`UpdateEmployeeDto.status`.

**Live-proven on the isolated stack, in order, all HTTP 200:**
`ACTIVE → SUSPENDED → ACTIVE → TERMINATED → ACTIVE`.

**🔴 `Employee.status` has NO state machine and NO side effects anywhere in the
codebase.** Specifically, confirmed by direct source inspection (not assumption):

- **No transition is blocked.** `TERMINATED → ACTIVE` returned `200` with no guard —
  offboarding is not a terminal state at the API layer, unlike e.g. `FiscalPeriod`'s
  real `DRAFT → OPEN → CLOSED → LOCKED` pipeline or `Invitation`'s `ACCEPTED`/`REVOKED`
  guards. A Manager UI presenting "Offboard" as irreversible would be **overstating**
  what the backend enforces — it is reversible by anyone holding
  `pos:hr:employees:update`.
- **No cascade to `User.isActive`.** A repo-wide grep for `isActive: false` and
  `data.isActive` across every `.service.ts` in `apps/api/src/modules` found writes in
  `franchise`, `recipes`, `accounts-payable`, `menu`, `floor`, `bank-rec` — **none in
  `auth` or `hr`**. There is no code path anywhere that sets `User.isActive = false`.
  Suspending or terminating an `Employee` does **not** disable the linked `User`'s
  ability to log in with password or PIN.
- **No cascade to sessions, refresh tokens, or Quick-PIN.** Unlike the password-reset
  flow (which explicitly revokes all sessions/refresh tokens — see `CREDENTIALS.md`
  §2), an employee-status change touches only the `Employee` row.
- **No cascade to open orders, shifts, or tills.** A repo-wide search for
  `EmployeeStatus.SUSPENDED`/`TERMINATED` outside `hr` found zero references in
  `orders`, `shifts`, or `tills` modules. A suspended/terminated employee whose linked
  `User` remains active can still open a shift, operate a till, and take orders — the
  HR record and operational capability are fully decoupled today.
- **Most demo `Employee` rows have no linked `User` at all** — `SELECT COUNT(*) FROM
  employees WHERE user_id IS NOT NULL` returned `0` on the freshly seeded isolated
  stack. The seeded HR dataset (positions, contracts, compensation profiles) was never
  cross-linked to the seeded auth Users (Waiter/Cashier/etc. with PINs). Only staff
  created through Path A's one-call frontline onboarding get a real `Employee.userId`
  link.

**Consequence for the UI built in this phase:** the Suspend/Reactivate/Offboard
actions are honestly presented as **HR-record status only**. Where an employee has a
linked frontline `User` (Path A), the confirm dialog offers — as a **separate,
explicit, opt-in step** — the one credential action that is real and already audited:
disabling Quick-PIN (`PATCH .../quick-pin/disable`, already built in B3). It never
implies that changing `Employee.status` alone revokes access, because it does not.

### What happens to an in-flight invitation when the inviter is offboarded?

**Nothing.** `Invitation.invitedById` is written once at creation and never read again
by `resendInvitation`, `revokeInvitation`, `listInvitations`, or `accept()` — none of
them check the inviter's current `Employee.status` or `User.isActive`. An invitation
created by a since-offboarded Manager remains fully resendable, revocable, and
acceptable by the invitee until it naturally expires (14 days) or someone with
`onboarding:invitation:write` revokes it. `invitedById` is a historical attribution
field only.

### What happens to a staff member's open orders/shifts when suspended?

**Nothing automatic**, per the "no cascade" findings above. An open order, shift, or
till session is not reassigned, flagged, or closed when the assigned employee's
`Employee.status` changes. If the underlying `User` also remains active (the common
case, since nothing disables it), the person can continue operating exactly as before.
This is disclosed in the Suspend/Offboard confirm dialog copy this phase ships, rather
than silently omitted.

---

## Summary table

| Stage | Path A (frontline / PIN) | Path B (office / password) |
| --- | --- | --- |
| Invited | N/A (synchronous create) | `Invitation` row, `PENDING`, 14-day TTL — create route now live for Owner/Manager (C-31 fixed this phase) |
| Accepted | N/A | `POST /auth/invitations/accept` sets real password, invitation → `ACCEPTED`. Membership was already `ACTIVE` before this step. |
| Active | `Employee.status = ACTIVE` (default), `User.quickPinEnabled = true` | `Membership.status = ACTIVE` from creation |
| Suspended | `PATCH /hr/employees/:id {status: SUSPENDED}` — HR record only, no login effect | same |
| Offboarded | `PATCH /hr/employees/:id {status: TERMINATED}` — HR record only, reversible, no login effect | same |
| Credential reset (Manager-actionable) | Quick-PIN reset/disable/enable (B3, reused) | No admin-initiated path exists — see `CREDENTIALS.md` §4 |
