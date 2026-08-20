# Completion Report — Enterprise UI Track B1: Manager TOP-NAV Shell Conversion

**Date:** 2026-08-20
**Status: B1 COMPLETE / READY FOR B0 (parallel) AND B2 (gated).** Frontend-only. No backend/
schema/migration/seed/permission/Postman change. No commit/push.

## Context Snapshot

- Current milestone: **Track B1** — Manager top-nav shell conversion (`ai/ENTERPRISE_UI_ROADMAP.md`).
- Previous completed milestone: **M-P1** — Manager shell foundation, bottom nav, branch switcher,
  session guard, surface allow-list, honest pages, real Me (`ai/MANAGER_P1_SHELL_COMPLETION_REPORT.md`).
- Next milestone: **B0** (API verification, can run in parallel, docs only) and **B2** (Overview
  KPI dashboard) — both remain gated on explicit owner authorization. **Nothing past B1 is started.**

## Summary

Manager's presentation converts from the M-P1 fixed six-item **bottom nav** to an Odoo-style **top
module bar**, delivered as an additive variant of the shared operational shell — never a Manager
fork. The six locked M-P1 surfaces (Overview · Operations · Staff · Reports · Settings · Me) survive
unchanged as the top-nav menu tree; Overview and Me stay direct links, Operations/Staff/Reports/
Settings gained click-to-open dropdowns carrying one real link to today's foundation page plus an
honest, inert "not-yet" tree naming the phase that will build each item. The reusable Manager chrome
primitives every later Track B phase depends on (control panel, breadcrumbs, content shell,
search/filter menu) are built and, where nothing yet exists to back them, deliberately left unmounted
rather than faked. Waiter, Cashier, and Supervisor were re-verified live and unchanged.

### Scope checklist vs. `ai/ENTERPRISE_UI_ROADMAP.md` B1

| Item | Status |
| --- | --- |
| (a) Module top bar: brand/home control, centred menu items, right-cluster (branch switcher, clock, identity/logout) | ✅ Done — `OperationalTopNav.tsx` |
| No apps-grid launcher, no messaging/activities/Studio cluster | ✅ Confirmed absent — not built |
| (b) Dropdown submenus: click-to-open, grouped by muted headers, scroll inside panel, `Escape` closes, full keyboard operation | ✅ Done — `OperationalTopNavDropdown.tsx`; verified live (keyboard specs) |
| (c) The six-menu tree with honest not-yet states | ✅ Done — `lib/manager/top-nav.ts`, derived from the locked `managerRoutes`, not hand-duplicated |
| (d) Control-panel row primitive (New/secondary, title+cog, chip search, server pager, view switcher) | ✅ Built — `ManagerControlPanel.tsx`; mounted with **title only** on every B1 page (no data to back the other slots yet) |
| (e) Search/filter dropdown (Filters / Group By / Favorites) | ✅ Built — `ManagerSearchFilterMenu.tsx`; **not mounted** (no B1 surface has filterable data) |
| (f) Breadcrumb + record pager | ✅ Built — `ManagerBreadcrumbs.tsx`; **not mounted** (no B1 surface has a record view) — same precedent the roadmap itself sets for this primitive |
| (g) Responsive collapse (OD-4) | ✅ Done, with a deliberate deviation — see "Decisions / Deviations" |
| (h) Additive shell variant, not a shell fork (OD-5) | ✅ Done — `OperationalShell` gained `navigation="top" \| "bottom"`, default `"bottom"`; frontline roles pass neither prop |
| No live data, no writes, no approval decisions, no apps-grid, no chatter, no graph/pivot | ✅ Confirmed — every mounted surface is still the honest M-P1 foundation screen |

## Files Added / Changed

**Added:**
- `apps/web/src/components/pos-shell/OperationalTopNav.tsx` — shared module-bar component (menu
  bar, roving-tabindex keyboard traversal, responsive collapse, identity/logout dropdown).
- `apps/web/src/components/pos-shell/OperationalTopNavDropdown.tsx` — shared click-to-open dropdown
  primitive (Escape, outside-click, route-change close, arrow-key item navigation).
- `apps/web/src/components/manager/shell/ManagerTopNav.tsx` — thin Manager adapter over the shared
  `OperationalTopNav`.
- `apps/web/src/components/manager/chrome/{ManagerControlPanel,ManagerBreadcrumbs,ManagerContentShell,ManagerSearchFilterMenu,index}.tsx`
  — the reusable Manager chrome primitives.
- `apps/web/src/lib/manager/top-nav.ts` — the top-nav menu tree, derived from `managerRoutes`.
- `apps/web/scripts/manager-b1-assertions.ts` (+ its tsconfig) — ~30 new static invariants.
- `apps/web/e2e/manager-shell/topnav-keyboard.spec.ts` — keyboard-only traversal specs.

**Changed:**
- `apps/web/src/components/pos-shell/types.ts`, `OperationalShell.tsx` — additive
  `navigation="top" | "bottom"` variant; `bottomNavigation` became optional.
- `apps/web/src/components/manager/shell/ManagerShell.tsx`, `index.ts` — wired to the top-nav
  variant.
- `apps/web/src/components/manager/foundation/ManagerFoundationScreen.tsx`,
  `apps/web/src/components/manager/me/ManagerMeScreen.tsx` — render through
  `ManagerControlPanel`/`ManagerContentShell` instead of the generic `PageShell`.
- `apps/web/scripts/manager-p1-assertions.ts` — the M-P1 shell-composition assertions were updated
  to reference `ManagerTopNav` instead of the retired `ManagerHeader`/`ManagerBottomNav` (see
  `docs/DECISIONS.md` D-MGRTOPNAV, following the precedent the density pass set for assertion
  updates).
- `apps/web/e2e/manager-shell/{fixtures,navigation-and-landing,role-boundaries,shell-parity}.spec.ts`
  — rewritten for the top-nav DOM/interaction model.
- `docs/DECISIONS.md`, `docs/UI_SYSTEM.md` — implementation notes (see below).

**Removed (retired, not left as dead code):**
- `apps/web/src/components/manager/shell/ManagerHeader.tsx`
- `apps/web/src/components/manager/shell/ManagerBottomNav.tsx`

## Tests

**Static assertions — all pass:**

```
npx tsx apps/web/scripts/manager-b1-assertions.ts
npx tsx apps/web/scripts/manager-p1-assertions.ts
npx tsx apps/web/scripts/shell-assertions.ts
npx tsx apps/web/scripts/floor-assertions.ts
npx tsx apps/web/scripts/profile-assertions.ts
npx tsx apps/web/scripts/cashier-c1-assertions.ts
npx tsx apps/web/scripts/cashier-c2-assertions.ts
npx tsx apps/web/scripts/cashier-c3-assertions.ts
npx tsx apps/web/scripts/prompt3a-assertions.ts
npx tsx apps/web/scripts/prompt3b1-assertions.ts
npx tsx apps/web/scripts/prompt3b2-assertions.ts
npx tsx apps/web/scripts/prompt3b3a-assertions.ts
npx tsx apps/web/scripts/prompt3b3b-assertions.ts
```

All 13 scripts pass. No existing assertion needed a behavioural change beyond the `manager-p1`
shell-composition update noted above.

**`corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck / lint / build`** — all pass (build
output unchanged in shape: `/manager/*` routes compile, no new route added).

**Playwright, executed live on an isolated stack** (local Docker `postgres:16` on `:55433` →
`prisma migrate deploy` + `db:seed` + `db:demo:import`; API on `:4001`; web built with
`NEXT_PUBLIC_API_BASE_URL=http://localhost:4001` and served on `:3100`; `GET /api/health` → `ok`
before and during the run):

| Suite | Result |
| --- | --- |
| `e2e/manager-shell/` (5 spec files, 4 viewport projects) | **125 passed / 11 skipped / 0 failed** (136 total) |
| `e2e/supervisor-prompt3/` (cross-role regression) | **64/64 passed** |
| `e2e/cashier-floor/{role-boundaries,navigation-and-default-route,cross-role-c2-regression,till-and-me-regression}` | **48/48 passed** |

The 11 skips are deliberate, not failures: five `navigation-and-landing.spec.ts` tests and four
`topnav-keyboard.spec.ts` tests assert desktop `role="menubar"` click-to-open mechanics, which exist
only at `xl` (1280px) and up per OD-4 (see below); at the 1024×768 project the module bar is
collapsed by design, and that collapse itself is proven by a dedicated, viewport-forced test in
`shell-parity.spec.ts` regardless of which project runs it.

**Keyboard-only traversal:** verified live — `ArrowLeft`/`ArrowRight`/`Home`/`End` roving tabindex
across the menubar; `Enter`/`Space` opens a dropdown and focuses its first item; `ArrowDown`/
`ArrowUp` move through dropdown items; `Escape` closes and returns focus to the trigger; outside
click closes; a route change closes any open dropdown; the identity/logout menu is independently
keyboard-operable (`e2e/manager-shell/topnav-keyboard.spec.ts`).

**Screenshots:** captured at 1440×900 and 1280×680 — Manager Overview with the Operations dropdown
open at both sizes. Tailwind's `xl` breakpoint (`min-width: 1280px`) is inclusive at exactly 1280px,
so both captures show the **full desktop module bar** with the Operations dropdown open (not the
collapsed control — the collapse only engages below 1280px, e.g. the 1024×768 project; proven
separately by the dedicated OD-4 e2e test). Also captured: Waiter/Cashier/Supervisor shells at both
sizes, proving the frontline bottom-nav header is unchanged. **Zero console errors** across all eight
captures (`page.on("console")`/`pageerror` listeners, verified programmatically, not just eyeballed).

**Isolated-DB rule:** followed via the documented `.env`-swap recipe
(`docs/TESTING_AND_QA.md` "Recommended isolated stack"). Both `apps/api/.env` and `packages/db/.env`
were backed up before the swap and restored byte-for-byte after (`git diff --check` on those two
files is empty post-run — verified). The disposable Postgres container was removed after the run;
shared Neon was never touched.

## Docs

- `ai/ENTERPRISE_UI_ROADMAP.md` — B1 marked complete (see status line change below).
- `docs/UI_SYSTEM.md` §3b rewritten from "NOT YET IMPLEMENTED" to the implemented spec with final
  file names, keyboard contract, and the OD-4 breakpoint deviation; §2/§3 nav table and top banner
  updated.
- `docs/DECISIONS.md` D-MGRTOPNAV and D-NAV's Manager row carry an "IMPLEMENTED 2026-08-20" note
  with the OD-4 answer.
- `PROGRESS.md`, `ai/AI_STATUS.md` — dated entries (this pass).
- `CLAUDE.md` + `CODEX.md` — paired short milestone paragraph (this pass).

## Decisions / Deviations

- **OD-4 answered with a deviation from the roadmap's suggested breakpoint.** The roadmap suggested
  the collapse threshold be "the existing 1024 project boundary." Measuring the full bar's real
  width (brand lockup + six menu items + branch switcher + clock + identity cluster) showed it does
  not reliably fit at 1024×768 without risking the exact class of horizontal-overflow regression
  A1-1/OD-8 were created to prevent. The collapse threshold was set to Tailwind's `xl` (1280px)
  instead: the full bar shows at 1366×768/1440×900/1920×1080 (verified overflow-free live) and
  collapses to a single "Menu" control at 1024×768. This is a **stricter**, not weaker, application
  of the existing "no horizontal overflow at 1024×768" invariant — recorded in `docs/DECISIONS.md`
  D-MGRTOPNAV rather than silently deviating from the roadmap text.
- **OD-5 needed no fallback.** The shared `OperationalShell` absorbed the top-nav variant cleanly via
  one additive prop; a separate `ManagementShell` was not needed.
- **OD-3 was not decided here** — Accounting is not added as a seventh menu; that stays gated on B5
  per the roadmap.
- **OD-7 applied conservatively.** `ManagerSearchFilterMenu`'s Favorites column is built to be
  explicitly labelled "saved on this terminal only," but since B1 mounts no search box anywhere, the
  honest choice was to ship the primitive unmounted rather than force a demonstration search box
  onto a page with nothing real to search — mounting an inert-looking search UI would itself have
  been a soft untruth the standing rules forbid.
- **`ManagerHeader.tsx`/`ManagerBottomNav.tsx` were deleted, not deprecated-in-place.** They had no
  remaining consumer after the shell rewire; keeping unreachable code around invites drift.

## Known Issues / Deferred Items

- **`ManagerSearchFilterMenu` and `ManagerBreadcrumbs` are unmounted.** Built and exported, exercised
  only by `manager-b1-assertions.ts` (source-level checks) — no live surface consumes them yet. First
  real consumer: B3 (list/form/breadcrumb patterns).
- **`ManagerControlPanel`'s other slots (New action, actions cog, search, pager, view switcher) are
  unmounted** for the same reason — no B1 surface has data to back them.
- Every item outside B1 scope named in the roadmap ("Out of scope" section) remains untouched: no
  live data, no writes, no approval decisions, no apps-grid, no chatter rail, no graph/pivot, no
  frontline navigation change, no permission change.

## Next Step

**B0** (API verification extension, docs-only, can run in parallel — no shared-file contact) and
**B2** (Manager Overview KPI dashboard, gated on B1) are the two roadmap-designated next prompts.
**Neither may start without an explicit owner go for that specific prompt.**
