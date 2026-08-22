# B6 — Manager Settings, Staff Onboarding, and Credential Management — Completion Report

**Date:** 2026-08-22
**Precondition:** `git log -1` showed `139f1de` at HEAD on `main`, clean worktree, before any change
in this session.
**Status:** COMPLETE, with explicitly disclosed scope reductions (see §7). No fabricated validation —
every number below was executed and observed in this session.

**Scope note (read first):** this session's B6 was directed by an explicit owner prompt —
"MANAGER SETTINGS, STAFF ONBOARDING, AND CREDENTIAL MANAGEMENT" — which is narrower than the
original `ai/ENTERPRISE_UI_ROADMAP.md` "B6 — Settings" section (which also planned Branch profile,
Devices, Printers, Terminals, Alerts, Sync). That leftover scope is carried forward as the roadmap's
new **B6.6** section (added this session) — see the supersession note at the top of the roadmap's B6
entry. This report covers exactly what the owner's prompt asked for: org settings, staff lifecycle
docs, and a real Staff onboarding/credential-management UI pass.

---

## 0. Precondition fix — the 4 client-onboarding failures

All 4 were in `client-onboarding.service.spec.ts`'s `createInvitations` tests, root-caused to the
mock's `prisma.invitation` model being entirely absent (the real service calls
`invitation.updateMany`/`invitation.create`, which the mock never defined, so every call threw
`TypeError: Cannot read properties of undefined`). Fixed properly — the mock now defines
`invitation.{updateMany,create,findUnique,update,findMany}` matching the real Prisma client shape,
and each test's `setupInviteMocks()` seeds realistic return values. **No test was deleted, skipped,
or loosened.** API unit suite: **1182/1182** immediately after this fix, confirmed before any further
work began.

---

## 1. Endpoint inventory + 2. Documentation

Full census, live-verified against a freshly migrated + seeded isolated stack, in
**`docs/manager-settings-docs/MANAGER_SETTINGS_API_MATRIX.md`**. Companion docs:
**`docs/manager-settings-docs/STAFF_LIFECYCLE.md`** and
**`docs/manager-settings-docs/CREDENTIALS.md`**.

**Headline finding, before any UI was written — zero settings/identity endpoints had a Manager UI
before this phase.** 14 of 14 `SettingsController` routes (currency, tax matrix, rounding,
thresholds, platform access, exchange rates) had no consuming screen; `pages/manager/settings.tsx`
was the M-P1 honest not-yet foundation page. This matches the pattern the 2026-08-20 gap analysis
found for accounting (~90 endpoints, zero UI).

**Three research findings materially shaped what was built, all live-proven, none silently "fixed
around":**

- **C-30 (critical)** — shared Neon currently leaks compensation data to Manager. The FU-1
  permissions-cutover revocation of `pos:hr:compensation:read` from Manager exists correctly in
  `seed.ts` source but was never re-seeded onto shared Neon (every prior validation ran on an
  isolated stack by design). Live-proven: `GET /api/hr/compensation-profiles` on shared `:3001` → 200
  with real salary data for a Manager token; the identical call on a freshly seeded isolated stack →
  403. **Not fixed here** (reseeding shared Neon needs its own authorization gate) — flagged
  prominently for the next backend-authorized batch. This phase's own UI never calls that endpoint or
  requests `?view=full` regardless.
- **C-31 (= the concrete manifestation of C-22's `onboarding:* (2)` bucket)** — `onboarding:read`/
  `onboarding:write` were referenced by `client-onboarding.controller.ts` since BG1 but never seeded
  as `Permission` rows at all, so the entire onboarding create-wizard (org/branch/business-profile/
  settings/invitations-create) 403'd for **every** role, Owner included. Item 6 of this brief
  explicitly authorizes seeding exactly what a B6 surface needs — **fixed this phase**: both strings
  seeded, granted to Owner and Manager only (§6 below has the full before/after).
- **No Manager-initiated password reset exists.** `password-lifecycle.service.ts`'s own docblock
  references an admin force-reset path (`purpose=FORCE_RESET_BY_ADMIN`) that was never built — a
  repo-wide grep found zero routes creating a token with that purpose. The only password-reset
  trigger is the public, unauthenticated `forgot-password` self-service route, which cannot satisfy
  the SECURITY BOUNDARY's audit-actor requirement if used on someone else's behalf. **Not built
  around** — the Staff UI's credential-reset action is scoped to what genuinely exists and is
  audited: Quick-PIN reset (reused from B3), never a fabricated "reset password" button.

Also documented, not fixed (all pre-existing, all disclosed in `STAFF_LIFECYCLE.md` §5): `Employee.
status` has no state machine (`TERMINATED → ACTIVE` returns 200) and no cascade whatsoever to
`User.isActive`, sessions, Quick-PIN, or open orders/shifts — suspending or offboarding someone with a
linked login account does not, by itself, revoke that access.

---

## 2b. Backend change made this phase (minimal, justified)

**`GET /api/onboarding/invitations`** — new, read-only, org-scoped, gated on the existing
`onboarding:invitation:write` permission (no new permission string). Added because Manager held
resend/revoke but had no way to discover an invitation id (no list route existed, and Manager cannot
create invitations either without the C-31 fix, so it never sees a creation response). Unit-tested
(`describe('listInvitations')`, 2 new tests); live-proven end-to-end on the isolated stack (create →
201, list → 200 with the new row and no `tokenHash` on the wire, resend → 201, revoke → 200,
cross-role Waiter/Cashier/Supervisor → 403/403/403).

No other backend route, DTO, schema, or migration changed. The `onboarding:read`/`onboarding:write`
seed addition (§6) is the only permission-table change.

---

## 3. Settings UI

`/manager/settings` replaces the M-P1 foundation screen with a real Odoo-style section-rail + save-bar
editor (`ai/ODOO_REFERENCE_RESEARCH.md` screenshots 07–11), built on the shared `ManagerContentShell`/
`ManagerControlPanel` chrome — **7 sections**, each independently dirty-tracked:

| Section | Backed by | Fields |
| --- | --- | --- |
| Currency | `GET/PUT /settings/currency` | currency, baseCurrencyCode |
| Tax & VAT | `GET/PUT /settings/tax-matrix` | defaultVatPct + dynamic category overrides |
| Rounding | `GET/PUT /settings/rounding` | mode, increment |
| Approval thresholds | `GET/PATCH /thresholds` | lateVoidMin, heavyDiscountUGX, discountApprovalThreshold |
| Reservations & receipts | `GET /settings` + `PATCH /settings` | reservationHoldMinutes, receiptFooter, showCostToChef |
| Attendance & inventory | `GET /settings` + `PATCH /settings` | attendance.autoClockOutHours, inventoryTolerance.variancePct (full-object replace, spread-then-override) |
| Exchange rates | `GET /settings/exchange-rates`, `POST /settings/exchange-rate` | list + create only — no edit/delete route exists |

**Deliberately omitted, each with a written reason in `settings-model.ts`:** Platform access
(`useRoleDefaults`/`overrides` — stored but has zero consumers anywhere in `apps/api/src`, confirmed
by grep; a UI would visually imply an enforcement that does not exist), Booking policies (zero
consumers, no defined shape), Franchise weights (real and consumed, but gated on
`pos:staff:weights:update`, which Manager does not hold — editing it via the general `/settings`
PATCH would bypass that domain's own permission gate), free-form `metadata`/`defaults` (matches the
standing "no free-form parameters editor" rule from B4/B5.6).

**Dirty-state navigation guard** — `routeChangeStart` (in-app nav) and `beforeunload` (tab close/
refresh) both confirm before discarding unsaved changes, aggregated across whichever section is
currently mounted.

**Device/printer/terminal registry** — Manager holds full `devices:*` access with zero UI, matching
the same "endpoint exists, no UI" pattern; deliberately **not built** this phase (roadmap's original
B6 scope, now B6.6 — see the scope note above).

---

## 4. Staff onboarding + management UI

- **`ManagerEmployeeStatusAction`** (new) — Suspend / Reactivate / Offboard on the existing B3
  `ManagerEmployeeDetailPanel`, via `PATCH /hr/employees/:id {status}` (status field only — no other
  field is ever sent in the same request). Every action confirms first, naming the person, and the
  consequence copy states plainly that this changes the HR status field only — no cascade to login,
  PIN, sessions, or open orders/shifts, matching the live-proven finding in `STAFF_LIFECYCLE.md` §5.
  Where the employee has a linked login account, the copy points at Quick-PIN disable as the separate,
  real action for actually blocking sign-in.
- **`ManagerInvitationsScreen`** (new, `/manager/staff/invitations`) — invite a Manager/Accountant by
  email (only those two roles are invitable — the backend hard-codes the allow-list), list all
  invitations, resend, revoke (confirm dialog names the person, discloses that revoking does not
  itself invalidate an already-issued temp password). **No branch picker** — the backend always
  assigns the org's oldest active branch regardless of `X-Branch-Id`, and the screen says so rather
  than implying the current branch is honoured. The one-time temp password reuses B3's
  `ManagerOneTimeSecretPanel` (masked-by-default, reveal/copy-once, never cached/logged/stored) — see
  §5 for a live-QA-caught defect this reuse originally had.
- Frontline staff onboarding and Quick-PIN reset/disable/enable (B3) are **reused unchanged**, per the
  shared-component rule — no new Quick-PIN route was added.

---

## 5. Live-QA-caught defect (found in real Chrome, not by any static check)

`ManagerOneTimeSecretPanel` (B3) hard-coded the word "PIN" in two places in its copy. Reusing it for
the B6 invitation temp password rendered **"PIN · This is the only time the temporary password can be
read"** under a password value — accurate value, wrong label. Caught only by opening the real dialog
in Chrome after a live invite-create. Fixed with a new optional `secretLabel` prop (default `"PIN"`,
so every pre-existing B3 caller is byte-for-byte unchanged), and the Invitations screen passes
`secretLabel="temporary password"`. Re-verified live after the fix (rebuild + reload) — correct label.

---

## 6. C-22 permission check (item 6)

Yes — the Staff UI's invite-create action depends on `onboarding:write`, which is exactly one of
C-22's 37 unseeded deferred-module permissions (the `onboarding:* (2)` bucket). **Seeded this phase,
to Owner and Manager only:** `onboarding:read`, `onboarding:write` (descriptions in
`packages/db/prisma/seed.ts`'s `PERMISSIONS_DATA`). No other role touched — confirmed by grep, each
string appears exactly twice (Owner array, Manager array) plus once in `PERMISSIONS_DATA`.

**37 − 2 = 35 remain for a future Track B7 batch**: `franchise:*` (12), `ops:*` (8), `dev:*` (5),
`merchant:*` (4), `billing:*` (3), `support:*` (2). None of the seven deferred-module prefixes has any
dependency from a B6 surface.

---

## 7. Validation gate

- **typecheck / lint / build**: all pass. Production build (`next build`, run against an isolated
  scratch `distDir` so the pre-existing shared `next-server` on `:3000` was never touched or
  corrupted) compiles all new routes (`/manager/settings` 8.0 kB, `/manager/staff/invitations`
  324 B).
- **API unit suite: 1184/1184** (1182 baseline + 2 new `listInvitations` tests).
- **17 pre-existing static assertion scripts + 1 new one, all pass**: `manager-p1-assertions.ts`
  (inverted for Settings graduating off the foundation screen), `manager-b1/b2/b4/b5-assertions.ts`
  (unchanged, still pass), `manager-b3-assertions.ts` (mutation-count invariant updated 9→19 with a
  documented before/after, and the `hr/employees/:id` "never called" guard narrowed from a blanket URL
  ban to a method-aware check — GET is still banned, the one new PATCH is explicitly allow-listed),
  `shell-assertions.ts`, `floor-assertions.ts`, `profile-assertions.ts`, the 3 Cashier scripts, the 5
  `prompt3*` scripts — **zero regressions**. New **`manager-b6-assertions.ts`** (the compensation-leak
  /credential-boundary assertion this phase's item 5 asked for): proves the B6 file set never
  references `?view=full`, `/hr/compensation-profiles`, or any of the 20 forbidden staff-PII keys;
  proves no plaintext secret is logged/cached/stored; proves every destructive confirm dialog names
  the person; proves Platform access/Booking policies/Franchise weights/free-form parameters are never
  rendered; proves Invitations offers no branch picker and only Manager/Accountant roles; proves
  Settings has a real dirty-state guard.
- **Playwright**: the pre-existing `e2e/manager-staff/` suite (37 specs) run against the isolated
  stack at `vp-1440x900` — **29 passed, 8 skipped (pre-existing, fixture-dependent, unrelated to B6),
  0 failed** after two required updates: (a) `directory-and-privacy.spec.ts`'s "the employee record is
  read-only" test was **inverted, not deleted** — it now asserts PROFILE fields stay read-only (no
  edit/save/archive/change-pay/contract control) while explicitly asserting the new Suspend/Offboard
  buttons DO exist, and narrows the `/hr/employees/:id` guard to GET-only (the new PATCH is the B6
  write, not a regression of MP0-01); (b) `e2e/manager-operations/fixtures.ts`'s duplicated
  `MANAGER_STAFF_ROUTES` constant needed `invitations` added (it does not import the real
  `staff-route.ts`, by the file's own documented design — relative-import-only for `tsx` execution —
  so it needed its own update). **New `e2e/manager-staff/dialog-overflow.spec.ts`** (this phase, the
  brief's explicit dialog-overflow ask) — the two new confirm dialogs (Suspend/Reactivate/Offboard,
  Revoke invitation) checked at exactly the two short viewports the B5.7-GAP pass established
  (1280×680, 1366×768): **4/4 passed**, both bodies fit within the viewport, both primary actions
  reachable without page-body scroll, both overlays confirmed `position:fixed`.
  ⚠️ **Not run this phase, disclosed not fabricated:** the full 4-viewport regression across
  `e2e/manager-staff/` (only `vp-1440x900` was run) and `e2e/manager-shell/` (not run at all — no
  code in the shared shell/nav mechanics changed beyond one new menu row + one new route, already
  covered by `manager-p1-assertions.ts`'s static six/seven-surface nav checks). A future pass should
  run both across all 4 projects before any further B6-adjacent work.
- **Live curl cross-role matrix, every new/changed write route, both directions:** Manager 200/201 on
  all of `PUT currency`, `PUT tax-matrix`, `PUT rounding`, `PATCH thresholds`, `POST exchange-rate`,
  `PATCH settings` (general), `PATCH hr/employees/:id` (status), `POST/GET/POST/PATCH
  onboarding/invitations` (create/list/resend/revoke); **Waiter, Cashier, Supervisor 403 on every one**
  of those same routes (individually re-verified per role, not assumed from one role's result).
  Supervisor's `GET /settings` correctly returns 200 (pre-existing `tenancy:org:read` grant, an
  informational org-read, not a credential/PII surface — not a new leak).
- **Live browser QA in real Chrome** against an isolated web build (`NEXT_PUBLIC_API_BASE_URL` baked
  to the isolated API) — every major write action exercised with the DevTools network panel read for
  real status codes and the console read for real errors:
  - Settings → Tax & VAT: loaded existing values (200), edited Default VAT %, "Unsaved changes" bar
    appeared, Save → `PUT /settings/tax-matrix` **200**, bar cleared, value persisted through a
    refetch.
  - Invitations: create → **201** with the real one-time temp-password panel; resend → **201**
    (`resendCount` incremented); revoke → **200**, confirm dialog named the invitee, list updated to
    `Revoked` with Resend correctly disabled.
  - Employee status: Suspend → **200** (one 401 mid-session from an expired JWT, correctly caught by
    the existing auth-error guard and redirected to `/login?reason=session_required` — re-authenticated
    and retried, not a bug); status pipeline updated to `SUSPENDED`, buttons flipped to Reactivate/
    Offboard; Reactivate → **200**, state restored to `ACTIVE`.
  - **Zero console errors observed across the entire session.**
- **Isolation discipline:** local Docker `postgres:16` (`nimbus_b6_qa`, port `55491`) — 18 migrations
  applied clean, 0 drift; isolated API on port `4111`, isolated web on port `3111`; verified via
  `lsof -p <pid>` that the API process's only established TCP connection was to `localhost:55491`
  throughout. Shared Neon was **read-only-probed once** (the C-30 discovery — a single `GET
  /hr/compensation-profiles` and one `GET /auth/me`, both reads) and **never written to**. Both
  `apps/api/.env` and `packages/db/.env` are byte-identical to their pre-session state (git shows no
  diff). The one temporary edit to `apps/web/next.config.mjs` (an env-gated `distDir` override, so a
  build-only check could run without corrupting the pre-existing shared `next-server` on `:3000`) was
  fully reverted before this report was written — `git diff` on that file is empty. The isolated
  Postgres container, isolated API process, and isolated web process were all stopped and the
  container removed; both pre-existing shared dev servers (`:3000`, `:3001`) verified healthy
  immediately after.
- `git diff --check`: clean.

---

## Findings register (this phase)

| ID | Finding | Status |
| --- | --- | --- |
| C-30 | Shared Neon leaks `pos:hr:compensation:read` to Manager (FU-1 never re-seeded there) | Disclosed, not fixed — needs its own authorization gate |
| C-31 | `onboarding:read`/`onboarding:write` never seeded to any role (= C-22's `onboarding:*` bucket) | **Fixed** — seeded to Owner + Manager |
| — | No Manager-initiated password reset exists (`FORCE_RESET_BY_ADMIN` is schema-ready, never wired to a route) | Disclosed, not built around |
| — | `Employee.status` has no state machine and no cascade to login/sessions/PIN/orders | Disclosed in `STAFF_LIFECYCLE.md`, UI copy reflects it honestly |
| — | Invitations have no branch picker — backend always assigns the org's oldest branch | Disclosed in the UI, no picker offered |
| — | Onboarding temp-password hash uses bcrypt cost 10 vs. cost 12 everywhere else | Disclosed in `CREDENTIALS.md`, not fixed (out of scope) |
| — | Password-based login has no brute-force lockout (Quick-PIN does) | Disclosed in `CREDENTIALS.md`, not fixed (new security control, owner decision) |
| — | `ManagerOneTimeSecretPanel` hard-coded "PIN" wording | **Fixed** (live-QA-caught) |

---

## Deliverables

- `docs/manager-settings-docs/{MANAGER_SETTINGS_API_MATRIX,STAFF_LIFECYCLE,CREDENTIALS}.md`
- `apps/api/src/modules/client-onboarding/{client-onboarding.service.ts,client-onboarding.controller.ts,client-onboarding.service.spec.ts}` (test fix + new `listInvitations`)
- `apps/api/src/modules/hr/employee-projection.ts` (stale-comment correction)
- `packages/db/prisma/seed.ts` (`onboarding:read`/`onboarding:write`, Owner + Manager only)
- `apps/web/src/{lib,components}/manager/settings-*` (new module)
- `apps/web/src/{lib,components}/manager/invitations-*` (new module)
- `apps/web/src/components/manager/staff/{ManagerEmployeeStatusAction,ManagerInvitationsScreen}.tsx` (new)
- `apps/web/src/components/manager/staff/ManagerOneTimeSecretPanel.tsx` (`secretLabel` prop, backward-compatible)
- `apps/web/src/components/manager/staff/ManagerEmployeeDetailPanel.tsx` (status action mounted)
- `apps/web/src/pages/manager/{settings.tsx,staff/invitations.tsx}`
- `apps/web/src/lib/manager/{staff-api,staff-context,staff-model,staff-route,top-nav}.ts` (extended)
- `apps/web/scripts/manager-b6-assertions.ts` + `tsconfig.manager-b6-assertions.json` (new)
- `apps/web/scripts/manager-b3-assertions.ts`, `manager-b4-assertions.ts`, `manager-p1-assertions.ts` (inverted, not deleted)
- `apps/web/e2e/manager-staff/dialog-overflow.spec.ts` (new), `directory-and-privacy.spec.ts` (inverted), `../manager-operations/fixtures.ts` (route added)
- `ai/ENTERPRISE_UI_ROADMAP.md` (B6 supersession note + new B6.6 section)
- This report.

**Track B6.6 (Branch profile/Devices/Printers/Terminals/Alerts/Sync), B5.7's own remaining scope, and
B7 remain NOT started — do not begin any of them without explicit owner authorisation.**
