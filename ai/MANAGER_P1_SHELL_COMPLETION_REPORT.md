# Manager Reconstruction — Prompt M-P1 Shell / Navigation / Session / Branch-Switcher Completion Report

**Canonical M-P1 record.** Manager becomes the **fourth consumer** of the shared operational UI
system: six-tab locked navigation, `ManagerShell` + `ManagerSessionGuard`, the branch switcher
(the one genuinely new shell affordance), login routing, a surface allow-list, six foundation
pages, a fourth role accent, a new assertion script, and a new Playwright suite.

- **Date:** 2026-08-20
- **Classification:** **A. M-P1 COMPLETE / READY FOR M-P2**
- **Change surface:** frontend + docs only. **No** backend / DTO / Prisma schema / migration /
  seed / permission / auth-semantics / branch-isolation / Postman change. **No commit. No push.**
- **Predecessor:** `ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md` (Classification A — GO for M-P1 with
  four conditions; all four addressed, see §12).

---

## 1. Repository, branch, initial state

- Repository: `/home/claude/nimbus-pos` (the authoritative dirty worktree).
- HEAD unchanged at `e05d944d532aac4ca7a3e75b740616cf170c3727`
  (`feat(cashier,supervisor): Cashier Floor-First C0-C2 + Supervisor Approvals reconstruction`).
- The worktree carried extensive pre-existing uncommitted work (Cashier C3, the rebrand wave, the
  M-P0 audit set). **Nothing was reset, restored, stashed, cleaned, or discarded.** Every M-P1
  change is additive or surgical on top of it.
- Verified before editing (matching M-P0 §13 exactly): `OperationalRole` was
  `"waiter" | "cashier" | "supervisor"`; `role-navigation.ts` registered three roles;
  `pages/manager/`, `components/manager/`, `lib/manager/` did not exist; `login.tsx` cleared the
  session for Manager users; `OperationalHeader` had no slot prop; the icon registry had 19 names
  and none of Overview/Operations/Staff/Reports/Settings.

## 2. Documents read (mandatory context)

`ai/MANAGER_RECONSTRUCTION_ROADMAP.md` (§0–§4, M-P0 status block, the full M-P1 section, M-P2
preview); `ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md` (§10–§16 in full, §1–§9 findings);
`Front End/manager_ui_full_docs_pack/manager-ui-docs/{MANAGER_NAV_AND_PAGE_MAP,managerui,manager_design,DESIGN,MANAGER_APPROVAL_DECISIONS}.md`;
the three existing shells (`components/{waiter,cashier,supervisor}/shell/*`),
`lib/{cashier,supervisor}/{routes,context,permissions,state}.ts`,
`components/pos-shell/*`, `lib/auth/{role,types,AuthProvider}`, `lib/api/client.ts`,
`pages/login.tsx`, `docs/UI_SYSTEM.md`, `docs/ROLE_CAPABILITY_MATRIX.md`, `docs/ROLE_JOURNEYS.md`.

## 3. Shell architecture — thin adapters, no fork

```
ManagerShell
└── ManagerBranchProvider            (new: selected-branch state, manager-scoped)
    └── ManagerSessionGuard          (new: modelled on Cashier/Supervisor guards)
        └── OperationalShell         (SHARED — unchanged layout)
            ├── header   = ManagerHeader        → OperationalHeader (SHARED) + branch switcher slot
            ├── readiness= ManagerReadinessStrip (new: three verified chips)
            ├── bottomNav= ManagerBottomNav     → OperationalBottomNav (SHARED) ← registry
            └── idle     = OperationalIdleLogoutHandler (SHARED — same 15-min mechanism)
```

No shared component was forked. `manager-p1-assertions.ts` asserts the absence of a
`ManagerOperationalShell` / `ManagerIdleLogoutHandler` / `ManagerTableCard` style fork.

## 4. Navigation (locked, six items)

`lib/manager/routes.ts` → registered in `pos-shell/role-navigation.ts` as the fourth entry.

| # | Label | Route | Icon name (registry) | Phosphor binding |
| --- | --- | --- | --- | --- |
| 1 | Overview | `/manager/overview` | `overview` | `ChartLineUp` |
| 2 | Operations | `/manager/operations` | `operations` | `ListChecks` |
| 3 | Staff | `/manager/staff` | `staff` | `UsersThree` |
| 4 | Reports | `/manager/reports` | `reports` | `FileText` |
| 5 | Settings | `/manager/settings` | `settings` | `GearSix` |
| 6 | Me | `/manager/me` | `me` (existing) | `UserCircle` |

**No More tab. No Approvals tab.** `/manager` → `/manager/overview` (non-permanent redirect).

**Icon registry: +6 names** (M-P0 predicted 5). The sixth is `caretDown` (`CaretDown`) for the
branch switcher's affordance — added to the shared registry rather than a Manager-local file, per
the shared-shell rule. `branch` (`Storefront`) is reused for the switcher's leading icon exactly as
M-P0 recommended. All six choices follow the Manager `DESIGN.md` §14 suggestions.

## 5. Login routing and role helpers

- `lib/auth/role.ts`: `MANAGER_COMPATIBLE_JOB_ROLES`, `isManagerCompatible()` (accepts
  `jobRole === "MANAGER"` **or** `roleName === "MANAGER"`, mirroring the cashier/supervisor form —
  the seeded account carries both, so this is a consistency decision, recorded here as M-P0 §13.3
  asked), and `getManagerLandingPath()` → `/manager/overview`. No `BRANCH_MANAGER` value.
- `lib/auth/AuthProvider.tsx` + `lib/auth/types.ts`: `isManager` added to the session state
  alongside `isWaiter`/`isCashier`/`isSupervisor`.
- `pages/login.tsx` — **all four M-P0 call sites** wired:
  1. the redirect `useEffect` now routes an authenticated manager to `getManagerLandingPath()`;
  2. the block guard now admits manager-compatible users and its copy reads *"waiter, cashier,
     supervisor, and manager workspaces only."*;
  3. + 4. the two landing ternaries were replaced by ONE `landingPath` constant used by both the
     `window.location.replace` and the `router.replace` path (manager > supervisor > cashier >
     waiter);
  - `getQueryReason` gained `manager_only` → *"This route is available to manager accounts only."*;
  - the hero and footer copy now name the manager workspace.

## 6. Branch context and the switcher (MANAGER-GAP-001)

| Concern | Decision |
| --- | --- |
| Source of branches | `me.memberships`, ACTIVE only — **zero extra requests** (M-P0 preferred this over `GET /branches`). |
| Initial branch | stored branch (if still an ACTIVE membership) → `context.defaultBranchId` → default-flagged membership → first → `null` (fail-closed). |
| Persistence key | **`nimbus.managerBranchId`** — the existing `nimbus.stationBranchId` naming pattern, but a **separate key on purpose**: the station key seeds the shared terminal's Quick-PIN branch field, and a manager switching to Rooftop Bar must not re-point the next waiter's PIN login. `STATION_BRANCH_KEY` is untouched (asserted). |
| `X-Branch-Id` | **No API-client change was needed.** `apiRequest` already takes `branchId` per call and sets the header; Manager reads pass the *selected* branch, the other three roles keep passing `useAuth().branchId`. |
| Invalidation | `invalidateQueries({ queryKey: ["manager"] })` — the Manager namespace only. **Never** `queryClient.clear()`, never auth/profile, never another role's keys (MANAGER-GAP-016). Verified live: a switch fires **no** `/api/auth/me`. |
| Key shape | `managerQueryKey(surface, branchId, ...)` → `["manager", surface, branchId, …]`, so per-branch results can never bleed across a switch. |
| Presentation | A native `<select>` (keyboard/screen-reader correct, no hand-rolled listbox) in the shared header's optional slot, styled with header tokens only. Accessible label "Active branch". |
| Header slot | `OperationalHeaderContext.branchSwitcher?: ReactNode` — **optional**. When absent the header renders exactly the markup it rendered before (asserted, plus a live per-role check). |

The pure half (`branch-model.ts`: option projection + resolution order) is separated from the React
binding (`branch-context.ts`) so the assertion script can execute it directly.

## 7. Surface allow-list — M-P1 GO condition 1

`lib/manager/permissions.ts` is an **allow-list of surfaces**, not a permission check, and says so
in a prominent header comment quoting M-P0 §12: the Manager JWT holds **214** permissions including
`pos:hr:compensation:read`, `pos:hr:contracts:*`, `approvals:decide`, `tenancy:membership:manage`
and `devices:status:write`, so a `hasPermission()`-driven UI would open payroll-adjacent surfaces.
The module exports six allowed surfaces (matching the six tabs, each with the phase that makes it
live) and five **excluded** surfaces rendered as honest disclosure on Manager Me. The assertion
script strips comments and then proves the executable code contains no `hasPermission(`,
`user.permissions`, or `permissions.includes(` lookup.

## 8. Pages — foundation, not fake

`pages/manager/{index,overview,operations,staff,reports,settings,me}.tsx`.

The five non-Me tabs render `ManagerFoundationScreen`: the surface's title/subtitle, an honest
"This surface is not built yet" statement, a **Live data arrives in M-P2…M-P6** badge, the planned
scope, the real active branch, and the **verified limits** that surface must respect (drawn from
M-P0: count-only tills/shifts, the org-scoped approvals list, the tax-inclusive "net" figure, the
compensation-on-the-wire employee endpoint, the fake PDF export, the read-only branch profile).
**No KPI tiles, no sample rows, no currency, no spinners implying data.** Asserted against
`UGX `, `0.00`, `Sample`, `Lorem`, `TODO`, `Coming soon`.

**Manager Me is real** (permitted by the roadmap's shared-profile reuse rule and cheap because the
data is already in hand): hero + identity + branch memberships + session + restricted surfaces, all
from the ONE `/api/auth/me` payload the shell already fetched. **No HR/employee read** (MP0-01), no
fabricated shift state, no extra request. It reuses `RoleProfileHero` / `ProfileSection` /
`ProfileMetaGrid` as the fourth `roleAccentMap` consumer, and selecting a membership card is the
same action as the header switcher.

## 9. Readiness strip — M-P1 GO condition 3

Three chips, each with an M-P0-verified source:

| Chip | Source | Live value observed |
| --- | --- | --- |
| Branch | `me.memberships` + selected branch | `Branch: Tapas Downtown` → `Branch: Rooftop Bar` after a switch |
| Reports | `GET /api/reports/catalog` (37 entries, truthful statuses) | `Reports: 24 of 37 generators ready` |
| Devices | `GET /api/devices?page=1&pageSize=50` (branch-scoped) | `Devices: 4 registered` |

**Tills and shifts chips are omitted entirely** — `GET /api/tills` and `GET /api/shifts` are 404 and
`/tills/active` + `/shifts/active` are operator-scoped, so no chip could truthfully describe the
branch (MP0-02). The pending-approvals chip is also omitted until M-P2 can filter the partly
org-scoped `/api/approvals` list (MP0-05). Both omissions are asserted, and the e2e suite asserts
the strip never renders a `Tills:`/`Shifts:` chip. Both reads send an explicit bounded page size
(MP0-11) and are keyed by branch with `staleTime` (5 min catalog / 1 min devices).

## 10. Role accent — the fourth navy-family step

| Token | Value | Renders | Contrast |
| --- | --- | --- | --- |
| `--color-role-manager` | `oklch(0.36 0.06 324)` | `#4D324F` | **white on solid 11.18:1** (≥7:1 required) |
| `--color-role-manager-soft` | `oklch(0.965 0.015 324)` | `#F9F0F9` | text-primary on soft **15.95:1** |

Hue 324 continues the existing 30° ladder derived from brand navy — waiter 232 · supervisor 264
(brand hue) · cashier 294 · **manager 324** — so the four heroes read as one family while staying
distinguishable. Mapped in `tailwind.config.ts` (`role.manager`, `role.manager-soft`) and
`roleAccentMap`. Contrast computed via OKLCH→sRGB→WCAG relative luminance and re-asserted in
`profile-assertions.ts` (now four roles, pairwise-distinct accents).

## 11. Shared files changed (all four roles re-verified)

| File | Change | Blast radius handling |
| --- | --- | --- |
| `pos-shell/types.ts` | `OperationalRole` += `"manager"`; `OperationalHeaderContext.branchSwitcher?` | Optional prop; other roles' header markup unchanged (asserted + live). |
| `pos-shell/role-navigation.ts` | `manager: managerRoutes` | Registry-only addition; other rows untouched. |
| `pos-shell/role-icon-config.ts` | +6 names | Additive; existing 19 names and their bindings unchanged. |
| `pos-shell/role-icons.ts` | +6 Phosphor bindings | Additive. |
| `pos-shell/OperationalHeader.tsx` | optional slot; the clock markup was hoisted into a local so the no-slot branch renders the previous tree verbatim | Waiter/Cashier/Supervisor headers verified live at 1440×900. |
| `lib/auth/{role,types,AuthProvider}` | manager helpers + `isManager` | Purely additive; existing helpers untouched. |
| `lib/profile/profile-model.ts` | `ProfileRole` += manager; accent entry | Additive. |
| `styles/globals.css`, `tailwind.config.ts` | +2 role tokens | Additive; no existing value changed. |
| `pages/login.tsx` | 4 call sites + reason + copy | Waiter/cashier/supervisor landing behaviour re-verified live. |
| `scripts/{shell,profile}-assertions.ts` | extended to four roles | Both still pass. |

## 12. M-P0 GO conditions — all four addressed

1. **Surface allow-list, not a permission check** — §7, enforced by assertion.
2. **Shared-file edits regressed across all roles** — §11 + §13: 12/12 assertion scripts,
   68/68 cross-role Playwright tests, and three live role smokes.
3. **Readiness omits tills/shifts** — §9, enforced by assertion and e2e.
4. **The roadmap's M-P5 section amended before M-P5 begins** — the roadmap now carries the MP0-16 /
   MP0-03 / MP0-08 amendment inline in the M-P5 section (see `ai/MANAGER_RECONSTRUCTION_ROADMAP.md`).

## 13. Validation (all executed on 2026-08-20)

| Gate | Command | Result |
| --- | --- | --- |
| Typecheck | `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` | **PASS** |
| Lint | `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` | **PASS** — no warnings or errors |
| Build | `next build` | **NOT RUN — deliberately.** The QA stack runs `next dev` on :3000 and the standing environment rule for this sandbox forbids a production build; stated here rather than implied. |
| New assertions | `npx tsx apps/web/scripts/manager-p1-assertions.ts` | **PASS** (≈70 invariants) |
| Existing assertions | `shell`, `floor`, `profile`, `cashier-c1/c2/c3`, `prompt3a/3b1/3b2/3b3a/3b3b` | **11/11 PASS** (`shell` + `profile` extended to four roles) |
| New e2e | `e2e/manager-shell/` × 4 viewports | **92/92 PASS** (23 tests × 4) |
| Cross-role regression e2e | `e2e/supervisor-prompt3/{regression,role-boundaries}`, `e2e/cashier-floor/{role-boundaries,navigation-and-default-route,cross-role-c2-regression,till-and-me-regression}` × 4 viewports | **68/68 PASS** |
| API health | `GET /api/health` | `{"status":"ok","db":"ok"}` |
| Whitespace | `git diff --check` | **Clean of new issues** — only the same four pre-existing markdown hard-line-break hits M-P0 recorded, in files M-P1 did not touch. |
| Commit/push | — | **None.** HEAD unchanged. |

Viewport projects executed: `vp-1024x768`, `vp-1366x768`, `vp-1440x900`, `vp-1920x1080`.

### Live QA (browsed, screenshotted, and viewed)

Manager `manager@nimbus.demo` on the isolated QA stack (web :3000 `next dev`, API :3001):

- login → **landed on `/manager/overview`**; all six tabs rendered and navigated; zero console
  errors at both 1440×900 and 1024×768; zero horizontal overflow on any tab.
- Branch switcher listed **exactly the 4 ACTIVE memberships** — Tapas Downtown, Rooftop Bar,
  Garden Cafe, Events Kitchen / Banquet Hall — defaulting to Tapas Downtown.
- Switching to Rooftop Bar: header branch label, readiness `Branch:` chip, and the active-branch
  card all re-scoped; `localStorage['nimbus.managerBranchId']` = the Rooftop id; the selection
  survived a **reload** and a **route change**; the refetched reads carried the new header —
  captured live:
  `/api/reports/catalog` + `/api/devices` with `X-Branch-Id: cb27be…` (Tapas) then the same two
  with `X-Branch-Id: c1f953…` (Rooftop). **No `/api/auth/me` was re-issued by the switch.**
- Network/console clean; the only `requestfailed` entries were `ERR_ABORTED` on navigation-cancelled
  dev-asset/in-flight requests, i.e. normal hard-navigation aborts, not failures.
- `/api/auth/me` fired **once per hard page load** (10 loads → 10 calls) — no duplicate-per-mount
  regression.

Screenshots (all **viewed**, not merely written) in `/tmp/qa-shots/manager/`:
`{1440x900,1024x768}-{overview,operations,staff,reports,settings,me}.png`,
`…-switcher-focus.png`, `…-switched-rooftop.png`, `…-after-reload.png`,
`1440x900-me-memberships.png`, `1440x900-me-scrolled.png`,
`crossrole-{waiter,cashier,supervisor}.png`.

### Cross-role regression proof (live)

| Role | Landing | Nav observed | Branch switcher present? | Console errors |
| --- | --- | --- | --- | --- |
| Waiter | `/waiter/floor` | Floor · Reservations · Me | **0** | 0 |
| Cashier | `/cashier/floor` | Floor · Till · Me | **0** | 0 |
| Supervisor | `/supervisor/floor` | Floor · Reservations · Approvals · Me | **0** | 0 |

Plus the 68/68 four-viewport cross-role Playwright run above, and per-role e2e assertions that each
existing header still renders with no `[data-manager-branch-switcher]` node.

## 14. Findings recorded, not implemented

1. **Guard "Return to login" can lose its reason (pre-existing, all four roles).** Every role guard
   calls `clearSession()` then `router.replace("/login?reason=<role>_only")`; clearing the session
   makes the guard's own session effect fire `router.replace("/login?reason=session_required")`,
   which can win the race. Observed once at `vp-1366x768`. Manager **deliberately mirrors** the
   existing guard shape rather than diverging (e.g. to `window.location.replace`), so the e2e
   asserts "returned to login with a stated reason" plus a separate deterministic check that
   `/login?reason=manager_only` renders the manager-only copy. **Fix not implemented** — it is a
   shared-guard behaviour change affecting Waiter/Cashier/Supervisor and belongs to an authorized
   pass.
2. **Header branch label truncates at 1024×768** (`Rooft…`). Cosmetic and pre-existing to
   `BranchContextLabel`'s truncation rules; the switcher beside it shows the full branch name.
3. **The switcher option list drops the "(default)" suffix.** With it, the closed native select
   truncated the branch name in the header. The default branch is marked with a `Default` badge on
   Manager Me instead. Recorded as a deliberate presentation decision.
4. **`/api/devices` and `/api/reports/catalog` are the only Manager reads in M-P1.** Both are
   readiness-strip sources. M-P2 must not treat them as a licence to widen shell-level fetching —
   the performance budget is per-role and was measured at one `/auth/me` per load.

## 15. Files

**New (23)**

```
apps/web/src/lib/manager/routes.ts
apps/web/src/lib/manager/permissions.ts          (surface allow-list)
apps/web/src/lib/manager/branch-model.ts          (pure branch resolution)
apps/web/src/lib/manager/branch-context.ts        (React provider + narrow invalidation)
apps/web/src/lib/manager/context.ts               (workspace context + readiness)
apps/web/src/lib/manager/state.ts                 (query-key namespace, tones, caveat copy)
apps/web/src/lib/manager/api.ts                   (the two verified readiness reads)
apps/web/src/components/manager/shell/ManagerShell.tsx
apps/web/src/components/manager/shell/ManagerHeader.tsx
apps/web/src/components/manager/shell/ManagerBottomNav.tsx
apps/web/src/components/manager/shell/ManagerBranchSwitcher.tsx
apps/web/src/components/manager/shell/ManagerReadinessStrip.tsx
apps/web/src/components/manager/shell/ManagerSessionGuard.tsx
apps/web/src/components/manager/shell/index.ts
apps/web/src/components/manager/foundation/ManagerFoundationScreen.tsx
apps/web/src/components/manager/me/ManagerMeScreen.tsx
apps/web/src/pages/manager/{index,overview,operations,staff,reports,settings,me}.tsx
apps/web/scripts/manager-p1-assertions.ts + scripts/tsconfig.manager-p1-assertions.json
apps/web/e2e/manager-shell/{fixtures.ts,navigation-and-landing.spec.ts,branch-switcher.spec.ts,
                            role-boundaries.spec.ts,shell-parity.spec.ts}
```

**Modified (12)** — `pos-shell/{types,role-navigation,role-icon-config,role-icons}.ts`,
`pos-shell/OperationalHeader.tsx`, `lib/auth/{role.ts,types.ts,AuthProvider.tsx}`,
`lib/profile/profile-model.ts`, `pages/login.tsx`, `styles/globals.css`, `tailwind.config.ts`,
`scripts/{shell,profile}-assertions.ts`.

**Docs** — this report; `ai/MANAGER_RECONSTRUCTION_ROADMAP.md`;
`docs/manager-ui-docs/README.md`; `docs/UI_SYSTEM.md`; `docs/ROLE_CAPABILITY_MATRIX.md`;
`docs/ROLE_JOURNEYS.md`; `PROGRESS.md`; `ai/AI_STATUS.md`; `CLAUDE.md`; `CODEX.md`.

## 16. What M-P1 deliberately did NOT do

No KPI/dashboard data, no SSE client, no orders/tables/reservations reads, no staff directory, no
report generation or export, no device or branch settings, no approval count, no write action of
any kind, no permission change, no backend change, no Postman change, no commit, no push.

## 17. Readiness for M-P2

The foundation every later phase mounts on is live and proven: role registry, six-tab nav, guard,
branch context driving `X-Branch-Id`, narrow invalidation, allow-list, accent, assertions, e2e.

**M-P2 (Overview dashboard) has NOT started and must not start without explicit authorization.**
When it does, it inherits four non-negotiables from M-P0: tills/shifts are **counts only**;
approval counts must be **client-filtered** before display; SSE needs a **`fetch` + ReadableStream**
reader because `EventSource` cannot carry `Authorization` + `X-Branch-Id`; and the `gross`/`net`
labels must be qualified because the backend's `netSales` is tax-inclusive.

---

**Classification: A. M-P1 COMPLETE / READY FOR M-P2.**
