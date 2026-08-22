# Credentials — how they actually work in this codebase today

Truthful description of the **current implementation**, per CLAUDE.md §19 (code wins
over any doc that disagrees). Written for Track B6 before any credential-adjacent UI
was built, per the standing rule that user/credential docs precede the UI. Every claim
below was verified by reading the actual service source in
`apps/api/src/modules/auth/` and, where noted, live-exercised against the isolated
stack described in `MANAGER_SETTINGS_API_MATRIX.md` §7.

---

## 1. What is stored, and how

| Secret | Column | Algorithm | Notes |
| --- | --- | --- | --- |
| Password | `User.passwordHash` | bcrypt, cost **12** (`password-lifecycle.service.ts`, `invitation-lifecycle.service.ts`) or cost **10** (`client-onboarding.service.ts`'s temp-password path — see §6) | Never stored or logged in plaintext anywhere this review found. |
| Legacy 4-digit PIN | `User.pinHash` | bcrypt, verified via `bcrypt.compare` in `auth.service.ts` `pinLogin()` | Pre-M3.1 mechanism, still live (`/auth/pin-login`), separate from Quick-PIN below. |
| Quick-PIN (M3.1) | `User.quickPinHash` (bcrypt) + `User.pinLookupHash` (HMAC-SHA256) | Two-hash design, see §2 | Branch-scoped; this is what Manager-facing Quick-PIN reset/disable/enable acts on. |
| Password reset token | `PasswordResetToken.tokenHash` | SHA-256 of a `prt_<48-hex>` random plaintext | Plaintext returned once in the API response, never persisted. |
| Invitation token | `Invitation.tokenHash` | SHA-256 of an `inv_<32-hex>` random plaintext | Same one-time-reveal pattern. |

**No plaintext secret was found stored, logged, or cached anywhere in `apps/api/src`.**
Confirmed by reading every write site for `passwordHash`, `pinHash`, `quickPinHash`,
and `tokenHash` — all are hash outputs, never the raw input, at the point of
persistence. `console.log`/`audit.log` calls near credential code were individually
checked (`password-lifecycle.service.ts`, `quick-pin.service.ts`) and none include the
secret value; the `NIMBUS_EXPOSE_RESET_TOKENS` dev-only response field (§6) is the one
place a fresh secret is echoed back, and only to the same HTTP response that requested
it, gated by an env flag documented as non-production.

## 2. Quick-PIN's two-hash design (correct, not a weakness — noted because it looks unusual)

A bcrypt hash cannot be looked up by value (each hash has a unique random salt), but
login needs to find *which* user a 4–8 digit PIN belongs to without an O(n) bcrypt
comparison against every user in the branch. The design:

1. `pinLookupHash = HMAC-SHA256(pepper, "<branchId>:<pin>")` — deterministic, keyed by
   a server-side pepper (`QUICK_PIN_PEPPER` env var), used **only** to find the
   candidate row (`User.pinLookupHash` is a unique-indexed column).
2. Once found, the actual PIN is verified with `bcrypt.compare(pin, user.quickPinHash)`
   — the real security boundary. The lookup hash alone cannot authenticate; it only
   narrows the search.

This defeats both a plain-lookup-hash rainbow-table attack (the pepper is a secret not
derivable from the hash) and an O(n) bcrypt sweep. `derivePinLookupHash()` is the one
function; both PIN creation and PIN login call it identically.

## 3. Lockout

| Mechanism | Password login (`/auth/login`) | Legacy PIN (`/auth/pin-login`) | Quick-PIN (`/auth/quick-pin-login`) |
| --- | --- | --- | --- |
| Failed-attempt counter | **None found** — `auth.service.ts` has no `failedLoginAttempts` field or lockout logic | **None found** | `User.failedPinAttempts`, tracked |
| Lockout | **None** | **None** | After `QUICK_PIN_MAX_FAILED_ATTEMPTS = 5` failures, `User.pinLockedUntil = now + QUICK_PIN_LOCKOUT_MINUTES (5) minutes`; a locked user's further attempts are rejected without decrementing further |
| Reset on success | N/A | N/A | `failedPinAttempts` and `pinLockedUntil` cleared on a successful Quick-PIN login |

**🔴 Password-based login (`/auth/login`, used by Manager/Accountant/Owner) has no
brute-force lockout at all.** This is a real gap, disclosed here rather than silently
carried forward. It predates this phase and is out of scope to fix (a lockout policy
is a behavioural change requiring its own design/authorization — see CLAUDE.md's "do
not weaken, bypass, or make configurable the existing hashing or auth checks," which
cuts the other way here: adding a NEW security control is not itself forbidden by that
rule, but it is a scope decision for the owner, not an implicit B6 deliverable).

## 4. What a Manager can and cannot do to another user's credentials

Verified against `auth.controller.ts` and `hr.controller.ts` directly, then
live-tested on the isolated stack:

| Action | Route | Manager holds it? | What it actually does |
| --- | --- | --- | --- |
| Reset Quick-PIN | `POST /hr/frontline-staff/:id/quick-pin/reset` (`auth:quick-pin:write`) | Yes | Generates a new PIN server-side, returns it **once** in the response, invalidates the old one. Manager never chooses the value. |
| Disable Quick-PIN | `PATCH .../quick-pin/disable` | Yes | `quickPinEnabled = false`; live-proven this phase: a subsequent `/auth/quick-pin-login` for that user returns `401`. |
| Enable Quick-PIN | `PATCH .../quick-pin/enable` | Yes | Reverses the above. |
| Reset another user's **password** | — | **No route exists** | See §5 — this is the headline finding of this document. |
| Force another user to change password on next login | `User.mustChangePassword` flag | **No route sets this for another user** — the flag exists and is honoured by `/auth/force-password-change`, but nothing in the codebase ever sets it to `true` on someone else's account | Dead half of a feature — see §5 |
| Disable another user's login entirely | — | **No route exists** (see `STAFF_LIFECYCLE.md` §5 — `Employee.status` does not cascade to `User.isActive`, and nothing else sets `isActive = false`) | |
| Revoke another user's active sessions | `POST /auth/logout-all` | **No** — this route only logs out the **caller's own** sessions (`@CurrentUser() user: {id}`, no `:id` param) | A Manager cannot force-terminate a compromised staff member's active session |
| **View** another user's password or PIN | — | **No route exists, by design** | Correct — there is no "reveal stored secret" feature anywhere, matching the SECURITY BOUNDARY this phase was scoped under. |

## 5. 🔴 The central finding: there is no Manager-initiated password reset

`password-lifecycle.service.ts`'s own docblock (line ~119) references "an admin via
force-reset (purpose=`FORCE_RESET_BY_ADMIN`)," and `PasswordResetPurpose` in
`schema.prisma` genuinely defines that enum value. **No controller route anywhere
creates a `PasswordResetToken` with that purpose.** A repo-wide grep for
`FORCE_RESET_BY_ADMIN`, `force-reset`, `forceReset`, and `adminReset` across every
`.ts` file in `apps/api/src` returns exactly one hit: the comment itself.

The only two ways a `PasswordResetToken` is ever created:

1. `POST /auth/forgot-password` (public, unauthenticated, self-service) — takes an
   `email` in the request body with **no permission check of any kind**. A Manager
   *could* call this with a staff member's email, but:
   - it is indistinguishable from that staff member requesting their own reset (no
     actor is authenticated, so the audit event `PASSWORD_RESET_REQUESTED` cannot
     record who actually triggered it — it can only record the target),
   - the reset link/token is only usable by whoever receives it (no email transport is
     wired yet; in non-production the token is echoed in the response, gated by
     `NIMBUS_EXPOSE_RESET_TOKENS`),
   - this does **not** satisfy the SECURITY BOUNDARY requirement that "every credential
     action emits an audit event recording actor, subject, and action" — there is no
     actor here.
2. `POST /auth/invitations/accept`'s underlying flow (Path B onboarding, itself
   unreachable per `STAFF_LIFECYCLE.md` C-31).

**Consequence for this phase's UI:** the brief's item 4 asks for a way to "trigger a
credential reset" for staff. For **Quick-PIN staff (Path A)**, this is real, audited,
and already gated correctly — the UI reuses it. For **password-based staff (Path B)**,
there is genuinely nothing for a Manager-facing "Reset password" button to call that
would be honest about who triggered it and satisfy the audit requirement. **This phase
does not add such a button.** Building one against `/auth/forgot-password` would
either misrepresent an unauthenticated self-service route as an authorized admin
action, or require adding a genuinely new, permission-gated, audited endpoint — the
latter is a real option for a future phase (the schema already has the `purpose` enum
value ready) but was judged out of scope for a phase whose brief is explicit that
"Manager-initiated credential actions should go through an invitation or reset-token
flow" — the flow to route it through does not exist yet. **Flagged for the owner, not
built.**

The `mustChangePassword` flag has the same shape of gap: `forcePasswordChange` (self,
authenticated) reads and clears it, but nothing ever sets it `true` on another user's
account. A "require this user to change their password next login" Manager action
would need the same kind of new endpoint as the admin password reset above.

## 6. Two things worth knowing that are not gaps

- **Onboarding's temp password uses bcrypt cost 10, not 12.**
  `client-onboarding.service.ts`'s `inviteOne()` hashes the generated temp password at
  `bcrypt.hash(tempPassword, 10)` while every other password hash in the codebase uses
  cost 12. This is a real inconsistency (not a vulnerability at either cost — both are
  well above the commonly-cited minimum of 10 — but worth normalizing in a future
  backend pass) and is disclosed rather than silently carried forward. **Not fixed
  here** — touching `client-onboarding.service.ts` beyond the item-0 test-mock repair
  was judged out of the docs/UI scope of this phase, and the route it belongs to is
  itself unreachable per C-31.
- **`NIMBUS_EXPOSE_RESET_TOKENS`** is an intentional, explicitly-gated dev convenience
  (`process.env.NODE_ENV !== 'production'` also gates it) — not a bug. No email
  transport is wired yet, so without this the forgot-password flow would be
  untestable outside of direct DB inspection. It is scoped to the response of the
  request that generated the token, never logged, never a list endpoint.

## 7. Audit coverage

Every credential and role-assignment write path this phase inspected (`login`,
`pin-login`, `quick-pin-login`, `logout`, `logout-all`, `forgot-password`,
`reset-password`, `force-password-change`, `issue-quick-pin`, `reset-quick-pin`,
`quick-pin-settings`, invitation create/resend/revoke/accept) calls `audit.log(...)`.
None of the audited metadata objects this phase inspected contain a raw secret value
— confirmed by reading each call site's `metadata` object, not by pattern-matching
field names. Branch-stamping (`C-28`) was already swept repo-wide in the prior phase
(commit `139f1de`, "B5.7-GAP closure") — the auth-module credential events are
correctly `C-28-EXEMPT` (login/logout/PIN events have no branch context to stamp; two
Quick-PIN settings events are marked exempt-and-deferred pending a signature change
out of scope here). See `MANAGER_SETTINGS_API_MATRIX.md` §5 for the one place audit
*correctness* does not currently match the locked product decision — the compensation
read leak, C-30 — which is a permission-grant problem, not an audit-logging one.
