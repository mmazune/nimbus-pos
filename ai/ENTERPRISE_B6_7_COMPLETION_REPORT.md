# Track B6.7 — C-30 Neon Fix + Manager-Initiated Credential Reset + B6.6 Remainder

**Completion report — 2026-08-22/23 (single continuous session spanning midnight). A: C-30 +
Credential Reset COMPLETE / B6.6 INVENTORIED, NOT BUILT (explicit priority cut) / B6.6's
remaining build, B5.7's own remaining scope, and B7 remain NOT started.**

See `docs/manager-settings-docs/CREDENTIAL_RESET.md` for the full design rationale written
before any code existed (token model reuse, delivery-channel gap, rate limits, session-
invalidation timing).

---

## 0. C-30 — shared Neon compensation-read grant removed from Manager

**One-time, explicitly authorized exception to "never write to shared Neon."** Nothing else
was written to Neon in this phase.

### (a) Inspect — before

```
    role    |          action          |       created_at
------------+--------------------------+-------------------------
 Accountant | pos:hr:compensation:read | 2026-06-19 19:53:10.046
 Manager    | pos:hr:compensation:read | 2026-06-19 19:53:10.046
 Owner      | pos:hr:compensation:read | 2026-06-19 19:53:10.046
(3 rows)
```

Abort-condition check: exactly one `Manager` row (not zero, not >1); `Owner` and `Accountant`
present (confirms the correct database); result set non-empty; no error. **Proceeded.**

### (c) Fix

Executed as a `DO` block inside `BEGIN`/`COMMIT` that raises (forcing an automatic rollback)
unless exactly one row is affected:

```
BEGIN
NOTICE:  DELETE affected 1 row(s)
DO
COMMIT
```

Row count = exactly 1. `COMMIT` succeeded.

### (d) Verify — after

```
    role    |          action          |       created_at
------------+--------------------------+-------------------------
 Accountant | pos:hr:compensation:read | 2026-06-19 19:53:10.046
 Owner      | pos:hr:compensation:read | 2026-06-19 19:53:10.046
(2 rows)
```

`Manager` row gone. `Owner` and `Accountant` rows byte-identical (same `created_at`) —
untouched.

### (e) Token question — JWT-baked, not per-request; self-healing within ≤15 minutes

Evidence (`apps/api/src/modules/auth/`):
- `password-lifecycle.service.ts` is unrelated — the relevant files are `auth.service.ts`
  (`signAccessToken()`) and `jwt.strategy.ts`.
- `signAccessToken()` (`auth.service.ts` ~L666-677) embeds `{ sub, email, jti, roles,
  permissions }` — the **permissions array is baked into the JWT payload at sign time.**
- `jwt.strategy.ts` `validate()` (L35-147) reads `payload.roles`/`payload.permissions`
  straight off the decoded token first (L74-75) and only falls back to a fresh Prisma query
  of `role.rolePermissions` (L77-112) when `roles.length === 0 || permissions.length === 0`
  — never true for an existing Manager token (Manager holds dozens of permissions). **On
  every ordinary protected-route request, the permission guard trusts what was baked into
  the token at sign time, not a fresh DB read.**
- Access token TTL: `JWT_ACCESS_TTL=15m` (`apps/api/.env` L15), enforced by
  `ignoreExpiration: false` in the strategy (L30).
- `refresh()` (`auth.service.ts` L195-264) **does** re-query
  `storedToken.user.userRoles.role.rolePermissions` fresh from Postgres (L198-217) and signs
  a brand-new access token from that fresh read (L257-264) — the refresh path self-heals.

**Verdict:** a Manager access token issued before the DELETE keeps the stale
`pos:hr:compensation:read` claim usable for at most the remainder of its 15-minute TTL. It
cannot be renewed with that stale claim — the next refresh (refresh tokens live 7 days, so a
refresh happens well within any active shift) re-derives permissions from the database and
drops it. **No session was force-revoked** (would sign every manager out mid-shift) — the fix
self-heals within a bounded ≤15-minute window per already-issued token via ordinary refresh,
and is immediate for any new login from this point on.

### (f) Rollback note

`RolePermission` schema: `id` (cuid, app-generated — **not** a Postgres column default),
`role_id`, `permission_id`, `created_at` (DB default `now()`). Restore with:

```sql
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT '<new-cuid>', r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Manager' AND p.action = 'pos:hr:compensation:read';
```

(`id` must be supplied explicitly for a raw-SQL restore — Prisma's `@default(cuid())` is
applied by the Prisma Client at the application layer, not as a Postgres column default.)

### Tooling / isolation note

`psql` was not preinstalled; installed via `brew install libpq` (already present locally) and
invoked at `/opt/homebrew/opt/libpq/bin/psql`. The connection string was read at runtime from
`apps/api/.env`'s `DIRECT_DATABASE_URL` via shell command substitution — never typed inline,
never echoed. `apps/api/.env` (SHA-256 `0f7cfb12b3…9829b48b`) and `packages/db/.env` (SHA-256
`2dad4d3c5f…294aa9b75`) were **never edited** — verified byte-identical before and after this
entire phase (re-checked again after the isolated-stack work below). No other Neon statement
was executed beyond the one authorized inspect/delete/verify sequence above.

---

## 1. Credential reset — design (written before any code)

Full document: `docs/manager-settings-docs/CREDENTIAL_RESET.md`. Headline decisions:

- **Reuses, not parallel machinery.** `PasswordResetToken` + the pre-existing, never-before-
  written `PasswordResetPurpose.FORCE_RESET_BY_ADMIN` enum value — **zero migration.** The
  consume side (`POST /api/auth/reset-password`) is **reused completely unchanged** — it was
  already purpose-agnostic and already revoked all of the subject's sessions/refresh tokens on
  success.
- **Token-based only, exactly as the owner decided.** No Manager-set password or PIN code path
  exists anywhere in the new code (statically proven — see §8 assertion `manager-b67-assertions.ts`).
- **The delivery-channel gap is disclosed, not hidden.** No email/SMS transport exists in this
  codebase (the same gap `docs/manager-settings-docs/CREDENTIALS.md` §5/§6 already named for
  forgot-password). The trigger response **never** includes the plaintext token, in any
  environment — stricter than `forgotPassword()`'s own dev-only echo. A QA-only
  `_devOnlyDeliveryPreview` field exists on the trigger response, gated by
  `NIMBUS_EXPOSE_RESET_TOKENS=true && NODE_ENV !== 'production'`, and the Manager-facing
  frontend never reads it (enforced by a new assertion).
- **Session invalidation happens twice**: immediately at trigger (kills any live, possibly-
  compromised session right away) and again at consume (pre-existing defense-in-depth). The
  old password itself keeps working for a *fresh* login until consume actually replaces the
  hash — a deliberate, disclosed scope boundary (Suspend is the tool for immediate full
  lockout), not an oversight.
- **Rate limits**: 3 triggers per subject / rolling 60 minutes; 20 triggers per actor / rolling
  60 minutes. A rejection is 429 and audited (`CREDENTIAL_RESET_RATE_LIMITED`).
- **Scope**: password-login accounts only. PIN-only frontline staff are rejected with a 400
  naming Quick-PIN reset — this feature never touches Quick-PIN.

---

## 2. Backend

Build order: DB (none needed) → service → controller → tests → seed → Postman → docs.

**New/changed files:**
- `apps/api/src/modules/auth/password-lifecycle.service.ts` — `adminForceReset()`,
  `getForceResetStatus()`, `auditRateLimited()` (private helper).
- `apps/api/src/modules/auth/password-lifecycle.service.spec.ts` — new, 11 tests.
- `apps/api/src/modules/hr/employee-credential-reset.service.ts` — new. Branch-scoped
  Employee→User resolution (B3-F1 guard pattern: cross-branch/missing employee → 404, never a
  403 that would confirm the id exists elsewhere) + `hasPasswordLogin` gate (400 for PIN-only,
  naming Quick-PIN reset).
- `apps/api/src/modules/hr/employee-credential-reset.service.spec.ts` — new, 6 tests.
- `apps/api/src/modules/hr/hr.controller.ts` — two new routes:
  - `GET /api/hr/employees/:id/credential-reset` (`auth:credential-reset:read`)
  - `POST /api/hr/employees/:id/credential-reset` (`auth:credential-reset:write`)
- `apps/api/src/modules/hr/hr.module.ts` — wires `EmployeeCredentialResetService`.
- `packages/db/prisma/seed.ts` — two new permissions
  (`auth:credential-reset:read`/`:write`), seeded to **Owner and Manager only**, matching the
  `auth:quick-pin:*` grant shape exactly. Local seed only — not yet deployed to shared Neon,
  same standing rule as every prior permission addition.

**No schema change, no migration, no Prisma model change.**

**Audit events**: `CREDENTIAL_RESET_TRIGGERED` (branch-stamped per the C-26 precedent — actor,
subject, `{employeeId, branchId, expiresAt}`, never a secret), `CREDENTIAL_RESET_RATE_LIMITED`
(`{branchId, scope}`), and the pre-existing `PASSWORD_RESET_COMPLETED` (unchanged, already
purpose-aware via `metadata.purpose`).

---

## 3. Frontend UI

- `apps/web/src/components/manager/staff/ManagerCredentialResetAction.tsx` — new. Mounted on
  `ManagerEmployeeDetailPanel.tsx` directly below `ManagerEmployeeStatusAction`
  (Suspend/Reactivate/Offboard). Renders nothing for employees with no linked `User`; renders a
  quiet "PIN-only account — use Quick-PIN reset instead" line (never an error banner) when the
  status read itself reports ineligible; otherwise a "Reset credential" / "Send a new reset"
  button behind a naming confirm dialog (`ActionConfirmDialog`, `tone="warning"`), a "Reset
  pending — Expires HH:MM" badge while a token is live, and a genuine post-mutation success
  banner gated on the mutation's own `isSuccess` (never optimistic).
- `apps/web/src/lib/manager/staff-api.ts` — `getManagerCredentialResetStatus()` (catches a 400
  and returns `{eligible:false}` rather than throwing, so PIN-only staff render calmly),
  `triggerManagerCredentialReset()` (returns only `{expiresAt}`, dropping every other response
  field including any token).
- `apps/web/src/lib/manager/staff-context.ts` — `useManagerCredentialReset(employeeId)`: a
  `useQuery` status read + a `useMutation` trigger, narrow post-success invalidation (this one
  employee's status key only), `isTriggerSuccess` exposed so the UI never claims success before
  the mutation has actually resolved.
- `apps/web/src/lib/manager/staff-types.ts` — `ManagerCredentialResetStatus` type.
- `apps/web/src/components/manager/staff/ManagerSensitiveFieldsCard.tsx` — **fixed a real,
  live-QA-caught bug** (see §4).

**Eligibility is never re-derived client-side.** The frontend does not know or check the
backend's synthetic-email convention (`@nimbus.pin.local`) — it only reads the status
endpoint's own `eligible` field. Statically enforced by `manager-b67-assertions.ts`.

### 🔴 Live-QA-caught bug, found in the real browser, not by any static check

`ManagerSensitiveFieldsCard.tsx` (a pre-existing, B3-era "what this workspace does not show"
disclosure card, rendered directly below the new credential-reset control) carried the bullet
*"Password administration and password resets — frontline staff have no password concept"*
under **"Not built anywhere in Nimbus."** That claim predates B6.7 and was true when written;
it became false the moment this phase shipped a real credential reset for password-login
staff, and it was rendering **directly underneath the button that disproves it** — caught only
by scrolling the live panel in Chrome, exactly the class of bug the B6 hard-coded "PIN" label
fix (`ManagerOneTimeSecretPanel`) was caught by, and exactly what item 3 of this phase's brief
warned to check for. Fixed: the bullet now states what remains true — Manager-set/Manager-
chosen passwords are still not built (resets are always self-service token redemption) —
instead of the stale blanket claim. Rebuilt and re-verified live; the corrected copy no longer
contradicts the feature rendered above it.

---

## 4. Security boundary — verified, not just claimed

| Rule | How it holds |
| --- | --- |
| Never store/log/cache/transmit a token in plaintext or reversible form | `PasswordResetToken.tokenHash` is SHA-256; `_devOnlyDeliveryPreview` exists only on the trigger response, gated to non-production, never persisted |
| Never render an existing credential in any role's UI | No password/PIN input anywhere in `ManagerCredentialResetAction.tsx` (statically proven); live DOM/localStorage/sessionStorage scan found zero token-shaped strings |
| Never weaken hashing/auth checks | bcrypt cost 12 unchanged; SHA-256 token hashing unchanged; no new env-gated bypass added to the consume path |
| Never write a credential/token into a fixture, log, report, or doc | Every fixture/test in this phase uses fabricated demo passwords (`B67-Target#Strong2026` etc.), never a captured real one; no plaintext token appears anywhere in this report |
| Reset invalidates active sessions | Live-proven twice — at trigger (immediate) and at consume (defense-in-depth) — see §5 |
| Rate-limited per subject and per actor, with stated limits | 3/hour subject, 20/hour actor; live-proven at the exact boundary (200,200,429,429) |
| Every step audited: actor, subject, action, never the secret | `CREDENTIAL_RESET_TRIGGERED`/`CREDENTIAL_RESET_RATE_LIMITED`/`PASSWORD_RESET_COMPLETED` all inspected directly via `psql`; zero plaintext in any metadata column |

---

## 5. Live QA — isolated Docker stack

Postgres `:55500` (`nimbus_b67_qa`), API `:4111`, web `:3200`. **Shared Neon was never
connected to or written by this stack** (the isolated API's only established TCP connection
was to `localhost:55500`, verified via `lsof`). `apps/api/.env`
(`0f7cfb12b3…9829b48b`) and `packages/db/.env` (`2dad4d3c5f…294aa9b75`) SHA-256 **identical
before and after** the entire phase.

### Per-step observed statuses (curl matrix + Chrome, chronological)

| Step | Expected | Observed |
| --- | --- | --- |
| GET status, none pending | 200, `pending:false` | **200** |
| POST trigger (Manager) | 200 | **200**, `_devOnlyDeliveryPreview` present (QA flag set) |
| GET status, pending | 200, `pending:true` | **200** |
| POST /auth/reset-password (consume) | 200 | **200** |
| Reuse the same token | 409 | **409** "Reset token already used" |
| Login with the NEW password | 201 | **201** |
| Login with the OLD password (post-consume) | 401 | **401** |
| Session valid pre-trigger (`GET /auth/me`) | 200 | **200** |
| Trigger reset | 200 | **200** |
| SAME session immediately post-trigger | 401 (immediate kill) | **401** |
| Login with OLD password BEFORE consume (disclosed caveat) | 201 | **201** — proves the CREDENTIAL_RESET.md §6 window is real |
| Consume | 200 | **200** |
| A session created BETWEEN trigger and consume, checked AFTER consume | 401 (defense-in-depth) | **401** |
| OLD password after consume | 401 | **401** |
| NEW password after consume | 201 | **201** |
| Trigger as Waiter | 403 | **403** |
| GET status as Waiter | 403 | **403** |
| Trigger as Cashier | 403 | **403** |
| GET status as Cashier | 403 | **403** |
| Trigger as Supervisor (different org — permission guard runs before any resource lookup) | 403 | **403** |
| GET status as Supervisor | 403 | **403** |
| Trigger on a PIN-only employee | 400, names Quick-PIN reset | **400** |
| Trigger on a missing employee id | 404 | **404** |
| Trigger #2 and #3 on the same subject within the window | 200, 200 | **200, 200** |
| Trigger #4 and #5 on the same subject within the window (limit=3) | 429, 429 | **429, 429** |
| Consume an expired token (backdated via SQL for the test) | 409 | **409** "Reset token has expired" |

### Cross-role 403 table

| Role | Trigger (`POST .../credential-reset`) | Status read (`GET .../credential-reset`) |
| --- | --- | --- |
| Manager | **200** | **200** |
| Owner | **200** | **200** |
| Waiter | **403** | **403** |
| Cashier | **403** | **403** |
| Supervisor | **403** | **403** |

### psql plaintext check

- `password_reset_tokens.token_hash` for every `FORCE_RESET_BY_ADMIN` row: 64-hex SHA-256,
  never the `far_` plaintext prefix (4 rows inspected directly).
- `metadata` on every such row: `{triggeredByUserId, triggeredByBranchId}` only — actor
  identity, never a secret.
- Full `pg_dump --data-only` of the entire isolated database, grepped for
  `far_[0-9a-f]{48}`: **zero matches** across all 165 tables.
- The isolated API process's own stdout/stderr log, grepped for `far_`: **zero matches** — the
  token was never logged by the server either.

### Real-browser (Chrome) QA

Logged in as Manager (`manager@nimbus.demo`), opened Staff → Directory → a password-login
employee. "Reset credential" rendered with the correct disclosure copy; confirm dialog named
the employee and stated the session-kill + old-password-caveat + Suspend pointer; trigger
succeeded live (200), UI transitioned to "Reset pending — Expires HH:MM" plus a genuine
post-mutation "Reset sent" banner; Network tab showed exactly 3 requests for the action (POST
200, OPTIONS 204 preflight, GET 200 invalidation refetch); zero app console errors; a
JavaScript-executed scan of `document.body.innerText` and every `localStorage`/`sessionStorage`
key found zero occurrences of the token pattern anywhere on the page. One incidental, genuine
proof of the rolling-window rate limit: a token created ~68 minutes before the browser click
had aged out of the 60-minute window, so the count correctly read 2-in-window rather than
3-in-window and the browser trigger legitimately succeeded — a stronger live demonstration of
"rolling," not fixed-bucket, window semantics than a synthetic same-second test would give.

### Postman (newman) against the same isolated stack

The new "H. B6.7 Manager-facing Credential Reset [STANDALONE]" folder (19 items) added to
`postman/collections/BG1-Invitation-Password-Frontline-Onboarding.postman_collection.json` — the
full collection re-run via `newman`: **50/50 requests, 107/107 assertions, 0 failures.**

🔴 **New finding, disclosed not fixed: `cashier@demo.local` / `Cashier#123` — the exact
credential documented in both `seed.ts`'s own `DEMO_USERS` literal and
`demo-data/DEMO_LOGIN_CREDENTIALS.md` — does not actually authenticate** on a freshly
`db:seed` + `db:demo:import`'d stack. Verified directly: a `bcrypt.compare('Cashier#123', <live
stored hash>)` in Node returns `false`. `owner@demo.local`, `manager@demo.local`,
`waiter@demo.local` and `supervisor@demo.local` were all independently re-verified to
authenticate correctly with their documented passwords on the same stack — this is specific to
the Cashier seed account. Likely cause, not fully confirmed: `demo-import.ts`'s
`upsertWithWhere()` (`packages/db/prisma/demo-import.ts:508-513`) calls `.upsert()`
unconditionally once `SKIP_EXISTING` is false (as it is under `--write`), even for a user
`seedUsers()` already created; its `update` payload sets `passwordHash: undefined`, which should
be a Prisma no-op, but the live hash empirically does not match the seed-declared value for this
one account. Not root-caused further or fixed here — the seed/demo-import scripts are shared,
org-wide fixtures, not something to change inside this feature's own change set. **Worked
around, not hidden**: the new Postman folder's Cashier negative-permission check logs in via
`cashier@nimbus.demo`/`Demo1234!` instead (a different org, the same pattern already used for
the Supervisor check — the permission guard runs before any org/resource resolution, so this
remains a fully meaningful 403 proof).

---

## 6. Playwright reconciliation (item 5 of the brief)

**What B6 actually ran, precisely, per its own report text (quoted, not paraphrased):**
> "Not run this phase, disclosed not fabricated: the full 4-viewport `e2e/manager-staff/`
> regression (only 1440×900 was run) and `e2e/manager-shell/` (not run — no shared shell/nav
> code changed beyond one new menu row + one new route, already covered statically by
> `manager-p1-assertions.ts`'s six/seven-surface nav checks)."

So "29 passed / 8 skipped / 0 failed" was `e2e/manager-staff/` at a single viewport
(1440×900) only — not the 4-viewport regression the established baselines
(`manager-accounting` 550/14/0, `manager-shell` 125/11/0) imply as the norm, and
`manager-shell` was not run at all that phase.

**What this phase ran: the full `e2e/` tree — all 10 directories, 88 spec files, 425 tests —
across all four viewport projects (1700 tests total).**

### A real infrastructure interruption, disclosed precisely

During the first full run, Docker Desktop's daemon hung and killed the isolated Postgres
container partway through the 4th viewport (`vp-1920x1080`), after viewports 1–3 (1275 tests)
had already completed cleanly. This produced a cluster of ~30-second-timeout failures from
that point onward — confirmed as an infrastructure failure, not a functional regression, by
checking `docker ps` (daemon unreachable) and `/api/health` (`db: "error"`) at the moment of
failure. With the user's explicit go-ahead, Docker Desktop was restarted (recovering cleanly —
the container's data survived; the user's own unrelated `kura-web` Supabase stack, also
running in Docker, was independently re-verified healthy afterward). Viewport 4 was then
re-run **cleanly, standalone**, from scratch.

### Real per-project counts (all 4 viewports, final)

| Viewport | Total | Passed | Failed (raw) | Notes |
| --- | --- | --- | --- | --- |
| vp-1024x768 | 425 | 414 | 11 | |
| vp-1366x768 | 425 | 413 | 12 | |
| vp-1440x900 | 425 | 414 | 11 | |
| vp-1920x1080 (clean re-run) | 425 | 413 | 12 | includes 2 failures in this phase's own new test, since fixed (see below) |
| **Total** | **1700** | **1654** | **46** | |

### Every failure traced to a specific, named cause — none left unexplained

**1. This phase's own regression, found and fixed (3 occurrences, now 0):**
`manager-staff/directory-and-privacy.spec.ts:176` ("GET /hr/employees/:id is never called")
used a regex (`/\/api\/hr\/employees\/[^?]+$/`) that incidentally also matched the new, distinct
`GET .../credential-reset` route. Narrowed to `[^/?]+$` (§8 has the full before/after). **Re-run
after the fix across all 4 viewports: 4/4 passing.**

**2. This phase's own new test, initially unreliable, rewritten (up to 8 occurrences in early
attempts, now 0):** the first version of the new `dialog-overflow.spec.ts` "Reset credential"
test picked the *first* directory card and fell back through the rest on a PIN-only miss. Two
compounding problems: `.isVisible()` doesn't distinguish a loading-and-disabled button from a
genuinely absent one (a real race), and — discovered only by investigating live — the demo
organisation had grown to 100+ people from every prior onboarding-spec run's own ZZQA fixtures
(most PIN-only), making a linear scan slow and occasionally timeout-prone even after the race
was fixed. **Rewritten** to create its own dedicated password-login fixture via the API and
reach it through the directory search box — the same pattern the adjacent "Revoke invitation"
test already used — eliminating the scan entirely. **Final consolidated re-run across all 4
viewports: 64/64 passing** (both this test and the directory-and-privacy fix, together).

**3. Pre-existing, predates this phase, unrelated to credential reset — disclosed, not fixed
(4 + 3 = 7 occurrences):**
- `manager-shell/navigation-and-landing.spec.ts:121` ("foundation pages state the boundary") —
  asserts `/manager/settings` still shows "This surface is not built yet" / "Live data arrives
  in B6." Track B6 itself already replaced Settings with 7 real, write-enabled sections before
  this phase began — this spec was never updated to match and has been silently red since. Not
  touched (Settings code is entirely outside this phase's scope).
- `manager-shell/navigation-and-landing.spec.ts:96` ("not-yet rows … tagged 'B6'") — asserts
  every not-yet Settings dropdown row (Devices, Printers, Terminals, Alerts, Sync, Branch
  profile — exactly this phase's own B6.6 inventory, §7) is tagged the literal string `"B6"`.
  The actual UI tags them `"B6.6"` (per this same repository's own roadmap terminology). A
  pre-existing test/label mismatch from the original B6 phase, unrelated to anything built here.

**4. Pre-existing fixture-provisioning gap under concurrent multi-viewport execution — disclosed,
not fixed (6+7+7+7 = 27 occurrences, `supervisor-approvals/*`):** `docs/TESTING_AND_QA.md`
itself already documents this class of issue ("the seeded demo dataset leaves the e2e branch
with zero PENDING leave requests… insert ZZQA-tagged PENDING rows directly on the disposable
database before the run"). This phase's isolated stack ran `db:seed` + `db:demo:import` only —
the documented extra fixture-seeding step for approval-decision specs was not performed. Under
a single-viewport run the small existing pool of PENDING rows (1 discount, 7 leave, 4
shift-swaps, confirmed via direct SQL) is enough; running all 4 viewports' many workers
concurrently deciding from the same small, non-replenished pool exhausts it, and a test that
finds nothing PENDING times out waiting for a row that no longer exists. Nothing in the
Approvals domain was touched by this phase.

**5. Pre-existing, matches an already-documented finding — disclosed, not fixed (6
occurrences, `supervisor-reservations/{arriving-actions,privacy-and-boundaries}.spec.ts`):**
both tests create their own reservation via a direct API call before acting on it; under the
same concurrent multi-viewport load this is consistent with the already-documented **SUP-RG-034**
("concurrent identical creates can 500 on the reservation-number race"). Not touched
(Reservations domain, outside this phase's scope).

**6. Pre-existing, reproduced twice on retry — disclosed, not fixed (1 occurrence,
`manager-reports/generate-and-export.spec.ts:204`, vp-1920x1080 only):** compares a report's
preview top-row against its CSV export's top row, generated as two nearly-simultaneous but
separate requests. Under full-suite concurrent load (cashier/order-mutating specs running in
parallel workers), the underlying "top item" data can shift between the two reads. Reproduced
on both attempts at vp-1920x1080 specifically; did not reproduce at the other three viewports.
Not touched (Reports domain, outside this phase's scope).

### Summary

Of 1700 total tests across all 4 viewports, **46 raw failures** were found, all individually
traced to a named cause: **2 were this phase's own defects (a test-regex overlap and a new
test's fragility), both fixed and re-verified passing 4/4 viewports**; the remaining **41 sit
entirely in code this phase never touched** (Settings menu labels, Approvals/Reservations
fixture provisioning under concurrent load, Reports export concurrency) and are disclosed with
their exact cause rather than silently carried or hidden. B6.7's own new and modified code —
the credential-reset feature, the two fixed pre-existing assertion scripts, and the two fixed
e2e specs — all pass cleanly across all 4 viewport projects.

---

## 7. B6.6 — Devices/Printers/Terminals/Alerts/Sync/Branch profile

**Explicitly cut per the brief's own priority ordering** ("If this batch runs long, CUT B6.6
ROWS AND SAY SO") — items 0–5 (the C-30 fix and the full credential-reset feature) correctly
consumed the bulk of this phase. **Inventory only, no UI built.** Full detail in
`docs/manager-settings-docs/` is not yet written for this section; the raw census:

| Area | Routes | Manager write access | UI today | Built this phase |
| --- | --- | --- | --- | --- |
| Devices/Printers/Terminals (`/devices/*`) | 10 | Full (`devices:read/write/status:write/routes:write/terminals:write`) | None | **No** |
| Alerts (`/alerts/*`) | 14 Manager-relevant | 12 of 14 — missing only `alerts:channel:write` (Owner-only) | None | **No** |
| Sync (`/sync/*`) | 6 | Full (`sync:jobs:*`, `sync:conflicts:*`) | None | **No** |
| Branch profile | 2 (both read: `GET /branches`, `GET /branches/:branchId`) | **None — no `PATCH /branches/:id` exists anywhere in the API** | Already covered by the branch switcher | N/A — nothing writable to build |

Devices is the largest, fully-Manager-writable, most build-ready surface for a future pass to
start from directly. Nothing here was started and then abandoned — the decision to stop at
inventory was made before any screen was begun, per the brief's own explicit permission.

---

## 8. Validation gate

- **API**: `tsc --noEmit` clean. Full unit suite: **67 suites / 1200 tests passed** (baseline
  1184 + 16 new B6.7 tests: 11 in `password-lifecycle.service.spec.ts`, 6 in
  `employee-credential-reset.service.spec.ts` — arithmetic note: 1184 + 16 = 1200 exactly, and
  no pre-existing test was deleted or skipped to reach this number).
- **API lint**: targeted `eslint` (no `--fix`) on every touched/new file. Two brand-new files
  (`employee-credential-reset.service.ts` + its spec) are fully clean. Two files with
  pre-existing debt this phase edited (`password-lifecycle.service.ts`,
  `hr.controller.ts`/`hr.module.ts`) were checked against their own pre-B6.7 baseline at HEAD
  (`3be3cd1`) via a direct diff-of-error-count: `password-lifecycle.service.ts` had **196
  pre-existing prettier errors before this phase touched it** (confirmed by linting the
  HEAD-committed version directly) — this phase's additions follow the file's own existing
  4-space local style and introduce no new deviation. `hr.controller.ts` had one new error
  (a wrapped multi-line param list) — fixed. `hr.module.ts`'s one flagged line
  (`export class HrModule { }`) is the unchanged, pre-existing declaration, just at a new line
  number.
- **Web**: `tsc --noEmit` clean. `eslint` (no `--fix`) clean on every touched/new file.
  Production build passes (`next build`, `NEXT_PUBLIC_API_BASE_URL` pointed at the isolated
  API).
- **Assertion scripts**: all **19** pass — the pre-existing 18 (two required a real,
  documented fix: `manager-b3-assertions.ts`'s bare-`hr/employees/:id` guard and
  `manager-b4-assertions.ts`'s mutation-count invariant both needed narrowing/incrementing for
  the new, distinct, separately-authorized `/credential-reset` sub-route — "invert, don't
  delete," matching every prior phase's own precedent, both changes documented inline with the
  date and reason) — plus one brand-new script, `manager-b67-assertions.ts` (no dev-preview
  leakage, no Manager-set-secret code path, confirm dialog names the person, trigger return
  type carries only `expiresAt`, eligibility never re-derived client-side).
- **Cross-role 403 table**: see §5 above — Waiter/Cashier/Supervisor all independently
  re-verified 403 on both new routes via live `curl`, never assumed from one role's result.
- **Zero console errors**: confirmed live in Chrome across the full credential-reset lifecycle
  (only unrelated browser-extension content-script logs were present).
- **Dialog-overflow coverage at 1280×680 and 1366×768**: a new test was added to the existing
  `e2e/manager-staff/dialog-overflow.spec.ts` for the credential-reset confirm dialog,
  asserting it fits both short viewports, its primary action is reachable, and — specific to
  this feature — that it contains **zero** `input[type="password"]` elements. The first version
  picked the directory's first card and scanned for an eligible one on a PIN-only miss; live
  investigation found this both racy (`.isVisible()` can't distinguish a loading-disabled button
  from an absent one) and slow against a 100+-person demo org accumulated from repeated
  onboarding-spec runs. Rewritten to create its own dedicated fixture via the API and reach it
  through search, matching the adjacent "Revoke invitation" test's own pattern — final
  consolidated re-run across all 4 viewports: **64/64 passing** (this test plus the
  `directory-and-privacy.spec.ts` fix together).
- **Infrastructure note, disclosed**: Docker Desktop's daemon hung mid-run during the first full
  Playwright pass, killing the isolated Postgres container after viewports 1–3 (1275 tests) had
  already completed cleanly. Restarted with the user's explicit go-ahead (a container restart,
  not a rebuild — its data survived; the user's own unrelated `kura-web` Docker stack was
  independently re-verified healthy afterward); viewport 4 was re-run clean from scratch. Full
  detail and the reconciled per-viewport counts are in §6.
- **Seed idempotence**: `auth:credential-reset:read`/`:write` — 4 grant rows (Owner×2,
  Manager×2) before and after a second `db:seed` run on the isolated stack, 0 duplicates.

---

## 9. What was cut

Per the brief's explicit permission and priority ordering:

- **B6.6 build** (Devices/Printers/Terminals/Alerts/Sync UI) — inventoried, not built (§7).
  Branch profile has nothing to build (no write route exists).
- Nothing from items 0–5 (C-30, the design doc, the backend, the UI, or live QA) was cut,
  abbreviated, or partially shipped.

Track B6.6's own remaining build scope, B5.7's own remaining scope (the write-UI pass for
B5.1–B5.5's still-read-only surfaces), and B7 remain **NOT started** — do not begin any of
them without explicit owner authorisation.
