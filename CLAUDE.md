# CLAUDE.md — Nimbus POS

> Primary onboarding file for Claude Code (and any AI agent) working in this
> repository. Read this **first**, then inspect the local worktree before making
> any assumption. When this file and the code disagree, **the code and the local
> dirty worktree win** — update the docs to match reality, never the reverse.

---

## 1. Project purpose

Nimbus POS is a full-depth restaurant/hospitality operating system: POS, KDS,
inventory, procurement, reservations, events, HR/workforce, payroll, accounting,
franchise, billing, developer portal, reporting, alerts, offline reliability, and
(late-wave) hardware. It is built from scratch under a strict milestone system.

- **Backend:** 100% complete through milestone **BG7** (M0–M42 + BG0–BG7).
- **Frontend:** the active phase. Operational role UIs (Waiter, Cashier,
  Supervisor) are being built on a **shared operational UI system**.
- **Brand (2026-08-20):** the **Aug-2026 Nimbus POS Brand Identity** (designer
  Andimashimwe Rhoda) has **fully landed** in the frontend — navy/silver/graphite
  tokens, an alpha-channel token system, true-vector steering-wheel logo assets in
  `apps/web/public/brand/`, and the `NimbusLogomark` brand mark. Canonical
  reference: **`docs/BRAND_IDENTITY.md`**. Do not reintroduce pre-Aug-2026 palette
  values from the `Front End/` doc packs.

## 2. Repository path

- **Canonical (use only this):** `C:\Users\arman\Desktop\nimbus-pos`
- **Forbidden / stale (never use):** `C:\Users\arman\Desktop\NIMBUS\nimbus-pos`

## 3. Package manager

- **pnpm `8.15.0`**, pinned via `packageManager` in `package.json`.
- Always invoke through **`corepack pnpm@8.15.0`** (Node ≥ 22, Turborepo monorepo).

## 4. Important commands

```bash
# Web app (apps/web, package @nimbus-pos/web) — run from repo root
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck   # tsc --noEmit
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint         # next lint
corepack pnpm@8.15.0 --filter @nimbus-pos/web build        # next build
corepack pnpm@8.15.0 --filter @nimbus-pos/web dev          # next dev -p 3000

# API (apps/api, package @nimbus-pos/api)
corepack pnpm@8.15.0 dev:api                               # nest dev (turbo)
# Recommended for a quiet/reliable boot: build once, then run dist
#   (from apps/api)  node dist/main.js       # API on :3001, prefix /api

# Health
#   GET http://localhost:3001/api/health  -> { status: "ok", ... }

# DB / seed (DO NOT run in this onboarding pass)
corepack pnpm@8.15.0 db:generate | db:migrate | db:seed
```

- API base: **`http://localhost:3001`**, global prefix **`/api`** → routes are
  `http://localhost:3001/api/<route>`. Web dev server runs on **`:3000`**.
- The web app has **no automated tests yet** (`test` script is a stub).

## 5. Repository structure (high level)

```
apps/web        Next.js 14 Pages Router + React Query + Tailwind (the UI)
apps/api        NestJS API (53 modules) — source of truth for business state
packages/db     Prisma schema, ~65 migrations, seed.ts, demo-import.ts
ai/             Governance docs, AI_STATUS, milestone & UI completion reports
docs/           Canonical architecture / conventions / role UI docs
Front End/      Legacy role UI design packs (waiter/cashier/supervisor/manager)
postman/        58 Postman collections (one per milestone/feature)
demo-data/      CSV demo dataset + credentials (source for demo-import.ts)
```

See `docs/REPOSITORY_MAP.md` for directory ownership and `docs/DOCUMENT_INDEX.md`
for the full document catalog with provenance.

## 6. Source-of-truth documents

| Topic | Canonical document |
| --- | --- |
| This onboarding | `CLAUDE.md` (this file) |
| Codex onboarding | `CODEX.md` |
| Progress / status | `PROGRESS.md` → detailed live tracker `ai/AI_STATUS.md` |
| Architecture (index) | `ARCHITECTURE.md` → detail `docs/ARCHITECTURE.md`, `docs/UI_SYSTEM.md` |
| Document catalog | `docs/DOCUMENT_INDEX.md` |
| Repo map | `docs/REPOSITORY_MAP.md` |
| UI/design system | `docs/UI_SYSTEM.md`, `PRODUCT.md` |
| Brand identity (palette/logo/type) | `docs/BRAND_IDENTITY.md` (canonical, Aug-2026 rebrand — supersedes every `Front End/` palette table) |
| Waiter role UI | `docs/waiter-ui-docs/{README,WAITER_API_MATRIX,WAITER_LIFECYCLE}.md` (canonical, new 2026-08-20) |
| Cashier API contract | `docs/cashier-ui-docs/CASHIER_API_MATRIX.md` (canonical, new 2026-08-20 — supersedes the legacy `Front End/cashier_ui_docs_pack` matrix) |
| Role journeys | `docs/ROLE_JOURNEYS.md` + per-role lifecycle docs |
| Capability matrix | `docs/ROLE_CAPABILITY_MATRIX.md` |
| **Enterprise UI plan (canonical)** | **`ai/ENTERPRISE_UI_ROADMAP.md`** (new 2026-08-20; Tracks A/B/C — **supersedes `ai/MANAGER_RECONSTRUCTION_ROADMAP.md` from M-P2 onward**) |
| Manager dashboard (Track B2) | `ai/ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md` (canonical B2 record, 2026-08-20) — shell record: `ai/ENTERPRISE_B1_TOPNAV_COMPLETION_REPORT.md` |
| Odoo reference + gap analysis | `ai/ODOO_REFERENCE_RESEARCH.md` (+ `ai/odoo-reference-screenshots/`), `ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md` |
| Track C backend gap batch 1 (C-02/MP0-10/MP0-09/C-01) | `ai/BACKEND_GAP_BATCH1_COMPLETION_REPORT.md` (canonical record, 2026-08-20) |
| Locked decisions | `docs/DECISIONS.md` |
| Testing / QA | `docs/TESTING_AND_QA.md` |
| Known limitations | `docs/KNOWN_LIMITATIONS.md` |
| Process / governance | `AGENTS.md`, `ai/AI_GOVERNANCE_PROMPT_UPDATED.md`, `ai/AI_ERROR_PROTOCOL.md` |
| API/Postman contract | `docs/API_CONVENTIONS.md`, `docs/POSTMAN_ENDPOINT_GUIDE.md` |
| Supervisor reconstruction | `ai/SUPERVISOR_RECONSTRUCTION_ROADMAP.md`, `docs/supervisor-ui-docs/*` |
| Cashier reconstruction | `docs/cashier-ui-docs/*`, `ai/CASHIER_FLOOR_RECONSTRUCTION_*.md` (**C3 complete 2026-08-20**; C4 not started) |

## 7. Local dirty-worktree safety rules

The worktree carries **extensive uncommitted work** that is the newest, most
authoritative state of the project. GitHub / the last commit are **stale**.

- **Never** `reset`, `restore`, `stash`, `clean`, `checkout --`, discard, or
  overwrite existing worktree changes.
- Do **not** assume the last commit reflects current code.
- Before editing, run `git status` and preserve all unrelated work.
- Prefer additive edits; never blow away another workflow's in-progress files.

## 8. No commit / no push

- **Do not `git commit` or `git push`** unless the user explicitly asks.
- All recent frontend waves end with "No commit or push occurred" by design.

## 9. Roles & boundaries

| Role | Visible nav (LOCKED) | Owns |
| --- | --- | --- |
| **Waiter** | **Floor · Reservations · Me** | Table-centric order entry (order builder behind Floor table selection) |
| **Cashier** | **Floor · Till · Me** (Prompt C1–C3, default `/cashier/floor`; Queue/Receipts are hidden compatibility routes reachable by direct URL only, retire C4/C5) | Payment collection, receipts, till/close (C2 delivered table→bill resolution + the canonical settlement workspace + Find bill; **C3 delivered payment / partial / split / close execution inside that workspace**; receipts + refunds arrive C4) |
| **Supervisor** | **Floor · Reservations · Approvals · Me** | Read-first oversight; table-control workspace behind Floor selection |
| **Manager** | **Overview · Operations · Staff · Reports · Settings · Me** as an Odoo-style TOP NAV BAR module bar (Track B1, 2026-08-20; landing `/manager/overview`; owner-approved `docs/DECISIONS.md` D-MGRTOPNAV, **now implemented** — supersedes the M-P1 bottom-nav presentation). Overview/Me are direct links; Operations/Staff/Reports/Settings host click-to-open dropdowns with one real link + an honest not-yet tree. | Branch-level oversight. M-P1 shipped shell/nav/guard/**branch switcher** + honest foundation pages + a real Me; B1 shipped the top-nav shell + Manager chrome primitives; **B2 shipped the live Overview dashboard (8 cards over the verified `/dash/*` reads)**; Operations/Staff/Reports/Settings data is **B3+ and NOT started** |

⚠️ **Cashier Floor-First reconstruction (locked target, C3 complete / C4 not started, 2026-08-20):**
Cashier's Queue-first navigation above is **historically complete and demo-ready but superseded** as
the target architecture. The locked target nav is **Floor · Till · Me** (default route
`/cashier/floor`), landing on the same shared `OperationalFloor` as Waiter/Supervisor. C2 delivered
table-to-bill resolution plus the canonical settlement workspace and a bounded **Find bill** sibling;
**C3 (2026-08-20) delivered payment / partial / split / close execution inside that workspace** by
mounting the existing verified checkout primitives. Queue and Receipts are removed
as standalone navigation/pages **only after** their capabilities are migrated (a 7-prompt C0-C6
reconstruction).
Canonical docs: `docs/cashier-ui-docs/*`, `ai/CASHIER_FLOOR_RECONSTRUCTION_DECISION.md`,
`ai/CASHIER_FLOOR_RECONSTRUCTION_GAP_REGISTER.md`, `ai/CASHIER_FLOOR_RECONSTRUCTION_ROADMAP.md`
(roadmap), plus the C0 audit set under `ai/CASHIER_FLOOR_RECONSTRUCTION_C0_*`/`ai/CASHIER_FLOOR_
RECONSTRUCTION_{COMPONENT,ROUTE_AND_NAV,CAPABILITY_MIGRATION,PERMISSION_AND_API,TEST_INVENTORY}*.md`.
**Do not begin C4 implementation (receipt print/reprint/deliver, receipt search, refund execution),
remove or redirect Queue/Receipts, or fork the shared Floor for Cashier without explicit
authorization to proceed past C3.** The previously completed Cashier payment, split,
receipt, Till, refund, session, profile, and performance logic is **preserved and reused**, not
rewritten — see `docs/cashier-ui-docs/AGENTS.md`.

- Payment collection / order close / till are **Cashier-owned**. Supervisor may
  only **read** payment/order state. Waiter cannot collect payment or close.
- **There is NO visible Orders tab** for Waiter or Supervisor. Order work is
  reached from Floor **after** a table is selected. Legacy `/waiter/orders` and
  `/supervisor/orders` routes exist only as **redirects** into Floor (preserving
  `tableId`/`orderId`).

## 10. Current implementation milestone

**BACKEND GAP BATCH 1 COMPLETE — Track C: C-02 · MP0-10 · MP0-09 · C-01 (2026-08-20) — A: BATCH
COMPLETE / B3 UNBLOCKED ON C-02 / SHARED-NEON DEPLOY STILL GATED.** The first owner-authorized Track
C batch fixes four backend defects. **No schema / migration / seed / permission change, no frontend
file touched, local dev DB only.**
**C-02 (NG-02/MP0-01)** — new `apps/api/src/modules/hr/employee-projection.ts`. The **default**
payload on `GET /hr/employees`, `GET /hr/employees/:id`, the POST/PATCH echoes and the employee
embedded in `/hr/contracts` never *selects* `compensationProfile`, `dateOfBirth`, `address`,
`emergencyContact*`, private `notes` or `metadata` from Postgres; `/:id` returns contracts with no
salary field. `?view=full` restores the historical payload behind the **pre-existing**
`pos:hr:compensation:read` (403 without it; unknown `view` → 400). Live: 40 manager rows, zero
forbidden keys. ⚠️ The seeded matrix grants that permission to Owner, **Manager** and Accountant, so a
Manager can still opt in explicitly — narrowing it is a seed change, **not authorized** (FU-1). **B3's
Staff directory is unblocked.**
**MP0-10** — the gross/net inversion was a labelling defect: `Order.total = subtotal + tax − discount`,
so `total` is tax-inclusive. Now **`grossSales = SUM(order.total)`**, **`netSales = gross − taxTotal`**,
with the old ex-tax figure kept **additively** as **`subtotalSales`**; `gross = net + tax` ⇒
`gross ≥ net`. Live: gross **28,107,000 → 33,014,100**, net **33,014,100 → 27,978,300**. Applied to
`/dash/{today-summary,owner,manager}`, `/stream/metrics`, `kpi/refresh` **and** the SHIFT_END /
DAILY_SALES report summaries (one `salesFigures()` helper) so dashboard and export cannot disagree.
**MP0-09** — `/dash/open-orders` gains **`total`** (uncapped) + `limit` + `truncated` from the *same*
`where` the dashboards count with; `count` deliberately keeps its page-length meaning so B2 keeps
working. Live: `total 107` == `/dash/manager.openOrders 107` (was 50 vs 107). **Use `total` for any
number shown to a user.**
**C-01 (NG-01/MP0-03)** — `format: PDF` now returns **501** before any artifact row is created;
`generateTextPdf` is deleted; all 37 catalog entries advertise `['CSV']`; the BG6 `/api/exports`
facade 501s too. **No PDF renderer was added — OD-10 stays open.** Pre-2026-08-20 PDF artifacts keep
their fake mime type.
Validated on an isolated local Docker Postgres stack (never shared Neon; both `.env` files restored
byte-for-byte): API unit **1057/1061** (4 pre-existing failures, proven at `HEAD` in a throwaway
worktree); `hr` e2e 25/25, `dashboards`+`reports` e2e 53/53; web typecheck pass, **14/14** assertion
scripts, Playwright `manager-dashboard` **84/84**, `manager-shell` 125 passed/11 skipped, cross-role
36/36 — **the B2 dashboard is untouched and still passes**; newman M19 55/55, M20 40/40, M23 39/39,
BG6 46 with 7 pre-existing AP failures; 56/56 collections parse; `/api/health` → ok.
🔴 **New finding → Track C `C-21`: 38 accounting routes are 403 for EVERY role, including Owner** —
AP (19), AR (10) and Budget (9) are guarded by 23 permission strings (`accounting:ap:*`,
`accounting:ar:*`, `finance:*`) with **zero rows** in the permissions table. `pos:accounting:*` (17
rows) is seeded, so `accounting`/`ledger`/`bank-rec` are fine. **B5 must budget a permission/seed
cutover before any AP/AR/Budget UI.**
**Deploying these fixes to shared Neon is still gated on the cutover authorization. B3 and every
other Track B phase remain NOT started.** See `ai/BACKEND_GAP_BATCH1_COMPLETION_REPORT.md`.

**Prior milestone record (superseded above) — ENTERPRISE UI TRACK B2 COMPLETE — Manager Overview dashboard (2026-08-20) — A: B2 COMPLETE /
GATED FOR B3.** Frontend-only; no backend/schema/migration/seed/permission/Postman change.
`/manager/overview` graduates from the B1 honest-foundation screen to a real branch dashboard: the
Odoo **C10** journal-card pattern rebuilt natively as a 3-column grid of **eight** cards with a
coloured left accent bar — Sales today · Orders today · Payment mix · Open orders · Low stock · Needs
a decision · Shift & till coverage · Branch readiness — composed through the B1 chrome
(`ManagerControlPanel` + `ManagerContentShell`; `ManagerSearchFilterMenu`/`ManagerBreadcrumbs` stay
unmounted — Overview has no record list). New `components/manager/dashboard/*` and
`lib/manager/dashboard-{types,model,api,context}.ts`. **Every rendered figure resolves through the
26-entry `MANAGER_KPI_BINDINGS` registry** binding it to a verified endpoint field AND a drill-in
target — an unregistered KPI **throws** rather than renders, and only the two till/shift KPIs may
lack a drill-in (each with a written reason, MP0-02). Boundaries reproduced live: the open count uses
`/dash/manager.openOrders` (**107**) not `/dash/open-orders.count` (**50** = capped page length,
MP0-09, disclosed in card copy); `netSales` **33,014,100** > `grossSales` **28,107,000** (MP0-10) so
both labels state the tax basis and **no bare Gross/Net exists**; approval counts come from the four
canonical **branch-scoped domain endpoints**, never the partly org-scoped `/api/approvals` inbox
(MP0-05), bounded to `take=1`/`limit=1` and **projected to count-only at the API-client boundary** so
the leave/shift-swap PII payload never reaches state or cache (MP0-01); tills/shifts are counts with
no list and no drill-in. Overview **decides nothing** — counts link into the owning surface.
**Polled, not streamed** (60 s) with a permanent worded degraded state; there is **no SSE code** and
the assertion script fails if any appears (C-04/NG-14 still open). `POST /dash/kpi/refresh` sits
behind the shared `ActionConfirmDialog` + an in-flight lock, then narrowly re-reads the **nine**
dashboard keys. **No charting dependency was added** — three hand-rolled token-driven SVG marks, each
`role="img"` with `<title>`/`<desc>`; new `chart-series-1…4`/`chart-track` tokens and two new
canonical icon names (`revenue`, `inventory`). **Defect found by this phase's own e2e and fixed:**
M-P1's branch-switch `invalidateQueries` refetched the OUTGOING branch's keys (9 wasted requests per
switch) — now `refetchType: "none"`. Foundation `liveFrom` badges re-tagged M-P* → Track B (B3/B3/B4/
B6). Validated 2026-08-20: typecheck/lint/build pass; **14/14** assertion scripts; Playwright on an
isolated local Docker Postgres stack (never shared Neon) — `e2e/manager-dashboard/` **84/84**,
`e2e/manager-shell/` **125 passed / 11 deliberately skipped**, `e2e/supervisor-prompt3/` **64/64**,
`e2e/cashier-floor` cross-role **48/48**; **12 requests** measured for one Overview load (1
`/auth/me` + 2 shell + 9 dashboard); 5 screenshots at 1440×900 + 1280×680 viewed; zero console
errors; `/api/health` → `ok`; stack torn down and both `.env` files restored byte-for-byte. See
`ai/ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md`. **NEXT = B3 (Operations + Staff) and B0 (API
verification, docs-only, parallel). Neither is started — do not begin B3 or any later Track B phase
without an explicit owner go.**

**Prior milestone record (superseded above) — ENTERPRISE UI TRACK B1 COMPLETE — Manager top-nav shell conversion (2026-08-20) — A: B1 COMPLETE /
GATED FOR B0+B2.** Frontend-only; no backend/schema/migration/seed/permission/Postman change; no
commit/push. Manager's presentation converts from the M-P1 fixed bottom nav to an Odoo-style top
module bar, shipped as an **additive `OperationalShell` variant** (`navigation="top" | "bottom"`,
default `"bottom"`) — never a Manager shell fork; the three frontline roles were verified live to
render byte-identically. New shared `components/pos-shell/OperationalTopNav.tsx` +
`OperationalTopNavDropdown.tsx` (click-to-open, full keyboard operation: roving-tabindex menubar,
Escape/outside-click/route-change close) are consumed by a thin `ManagerTopNav` adapter; the retired
M-P1 `ManagerHeader.tsx`/`ManagerBottomNav.tsx` were deleted. The six locked M-P1 surfaces survive
unchanged as the menu tree — Overview/Me stay direct links; Operations/Staff/Reports/Settings host
dropdowns, each with ONE real link to today's foundation page plus an honest, inert not-yet tree
tagged by phase (e.g. "Orders — B3"); Accounting is **not** a seventh menu (OD-3 stays open, gated on
B5). New reusable Manager chrome primitives (`components/manager/chrome/`: `ManagerControlPanel`,
`ManagerBreadcrumbs`, `ManagerContentShell`, `ManagerSearchFilterMenu`) — B1 mounts only
`ManagerControlPanel`/`ManagerContentShell`, title-only, since no B1 surface has data to back a
create action, search, pager, or view switcher; `ManagerSearchFilterMenu`/`ManagerBreadcrumbs` ship
built but deliberately unmounted (first consumed from B3). **OD-4 answered with a recorded
deviation:** the collapse breakpoint is `xl` (1280px), not the roadmap-suggested `lg` (1024px) — the
full bar does not reliably fit at 1024×768, so that project gets the collapsed "Menu" control too,
never falling back to the frontline bottom nav. **OD-5 needed no fallback** — the shared shell
absorbed the variant with one additive prop. Validated: typecheck/lint/build pass; 13 static
assertion scripts pass; Playwright executed live on an isolated local Docker Postgres stack (never
shared Neon) — `e2e/manager-shell/` **125/136 passed, 11 deliberately skipped** (desktop-only
mechanics at the collapsed viewport, proven separately), `e2e/supervisor-prompt3/` **64/64**,
`e2e/cashier-floor` cross-role regression **48/48**; 8 screenshots at 1440×900 + 1280×680, zero
console errors; isolated stack fully torn down, `.env` files restored byte-for-byte. See
`ai/ENTERPRISE_B1_TOPNAV_COMPLETION_REPORT.md`. *(B2 has since shipped — see the entry above.)*

**Prior milestone record (superseded above) — ENTERPRISE UI RESEARCH COMPLETE; NEW CANONICAL ROADMAP
ADOPTED (2026-08-20) — documentation only.** The owner's live Odoo instance was explored read-only (17 screenshots, no record created or
edited) → `ai/ODOO_REFERENCE_RESEARCH.md`, and compared against this repo →
`ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md` (20 typed gaps **NG-01…NG-20**). **Headline finding:
~90 accounting/finance endpoints already exist with zero UI** — `accounts-payable`,
`accounts-receivable`, `bank-rec` and `budget` are registered and wired while `docs/MODULES.md`
still marks them "⬜ Planned"; ⚠️ they were found by **static scan only** and are
*claimed-by-code, unverified-at-runtime*. The new canonical plan is
**`ai/ENTERPRISE_UI_ROADMAP.md`** — three tracks: **A** experience polish (A0 shipped; A1 = the
shared floor-toolbar wrap at 1024×768), **B** the management suite (**B0** API verification → **B1**
top-nav shell → **B2** Overview → **B3** Operations+Staff → **B4** Reporting → **B5** Accounting
suite → **B6** Settings → **B7** Owner), **C** the true backend gaps **C-01…C-20** plus **C-P**
carrying Cashier C4→C6 forward unchanged.
⚠️ **Owner decision (`docs/DECISIONS.md` D-MGRTOPNAV): management navigation switches to an
Odoo-style TOP NAV BAR — module bar + click-to-open dropdown submenus, a control-panel row (`New` +
title + chip search + server pager + view switcher) and breadcrumb + record pager. This SUPERSEDES
the M-P1 bottom-nav decision for Manager. Waiter, Cashier and Supervisor KEEP bottom nav** and must
render byte-identically. **Only the navigation presentation is superseded** — M-P1's shell, session
guard, branch switcher, surface allow-list, honest pages and Manager Me carry forward, and M-P0's
MP0-01…MP0-18 remain in force. `ai/MANAGER_RECONSTRUCTION_ROADMAP.md` is **superseded from M-P2
onward** (M-P0/M-P1 history intact). **No code, no backend/schema/seed/permission/Postman change, no
commit/push. Nothing in Track B is implemented — do not begin B1 (or any Track B phase) without an
explicit owner go.** Eleven open owner decisions **OD-1…OD-11** are recorded with recommendations;
**OD-4** (sub-desktop collapse — never fall back to the frontline bottom nav) and **OD-5** (additive
`OperationalShell` variant vs a separate management shell) must be answered at the start of B1.

**MANAGER RECONSTRUCTION — PROMPT M-P1 COMPLETE (2026-08-20) — A: M-P1 COMPLETE / READY FOR M-P2.**
The Manager workspace foundation is live and Manager is the **fourth consumer** of the shared
operational UI system — never a fork. Shipped (frontend + docs only): `"manager"` in
`OperationalRole` + `role-navigation.ts`; the **locked six-tab nav Overview · Operations · Staff ·
Reports · Settings · Me** (no More tab, no Approvals tab), landing `/manager/overview`, `/manager`
redirecting there; six new canonical icon-registry names; `components/manager/shell/*` as thin
adapters over `OperationalShell`/`OperationalHeader`/`OperationalBottomNav` + the shared idle
handler; `ManagerSessionGuard` (non-managers → `/login?reason=manager_only`); and the **branch
switcher** in a new **optional** `OperationalHeaderContext.branchSwitcher` slot (so the other three
headers render byte-identically) sourced from `me.memberships` with **zero extra requests**,
persisted at `nimbus.managerBranchId` (deliberately NOT the station key), driving `X-Branch-Id`
through the existing `apiRequest({ branchId })` parameter — **no API-client change** — and
invalidating **only** the `["manager", …]` query namespace. `lib/manager/permissions.ts` is a
**surface allow-list, NOT a permission check** (the manager JWT holds 214 permissions incl.
compensation/contracts/`approvals:decide`, which the approved MVP forbids). Six honest foundation
pages with **no fabricated data**, plus a real Manager **Me** built solely from the already-fetched
`/api/auth/me`. Readiness ships **three verified chips only** (Branch, report generators, devices);
**tills/shifts/approval chips are omitted, not faked.** Fourth navy-family role accent
`--color-role-manager` `oklch(0.36 0.06 324)` (white-on-solid 11.18:1). Validated: typecheck + lint
pass (`next build` deliberately not run in the dev QA sandbox); `manager-p1-assertions.ts` +
**11/11** existing assertion scripts; Playwright `e2e/manager-shell/` **92/92** across four
viewports; cross-role regression **68/68**; live manager browse with a captured `X-Branch-Id` change
and persistence across reload; Waiter/Cashier/Supervisor re-verified live and unchanged. **No
backend / schema / migration / seed / permission / Postman change; no commit/push. M-P2 (Overview
dashboard) NOT started — do not start it, or any later Manager phase, without explicit
authorization.** See `ai/MANAGER_P1_SHELL_COMPLETION_REPORT.md` and
`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`.

**Cashier Floor-First reconstruction — Prompt C3 COMPLETE (2026-08-20) — A: C3 COMPLETE / READY FOR
C4.** The C2 read-only settlement workspace is now a working, **fail-closed payment + close**
surface — built as a **mount, not a rewrite**. New `components/cashier/floor/CashierSettlementActions.tsx`
composes the already-verified primitives (`CashierPaymentPanel` incl. `CashierCloseOrderPanel`, and
`CashierResolutionPanel` with the additive `variant="split-only"` → split-bill + split-items; the
merge/move-items/transfer-table group is deliberately not mounted), and new
`lib/cashier/settlement-mutations.ts` owns the only post-mutation refresh — it **awaits** a canonical
re-read of `orderDetail` + `orderPayments` before showing any result (no optimistic money), then
narrowly invalidates `tableBills` / `floor` / the `find-bills` prefix / the Waiter+Supervisor Floor
keys through the C2 key factories (no broad sweep; **9 requests** measured after a close). Live:
cash settles **and** closes in one call at the single verified choke point
`POST /pos/orders/:id/close`; card/MTN/Airtel/bank post manual references (a final one auto-settles);
partial payment shows a canonical remaining balance; split-bill records allocation metadata and
split-items creates a `NEW` child order (correctly not payable); a CLOSED/VOIDED bill renders **no**
settlement control. **Documented deviation: there is no standalone Close button** — the backend has
no zero-payment close (`CloseOrderDto.payments` is `@ArrayMinSize(1)`; order must be `SERVED` with
the balance covered), so close is reached through payment and the close panel states the real
precondition. **Frontend-only — no backend/schema/migration/seed/permission/Postman change; no
commit/push.** Validated 2026-08-20: web typecheck + lint pass (`next build` deliberately not run in
the QA sandbox); shell/floor/profile/C1/C2/**C3** assertions pass; Playwright `e2e/cashier-floor/`
**192/192** (48 × 4 viewports) + cross-role regression **20/20**, executed with REAL payments/closes
on an isolated disposable local Postgres; console/network clean; 36 screenshots at 1440×900 +
1024×768. Six findings recorded and **none implemented** (manual-reference accepts a payment on a
CLOSED order; reservation auto-completion does not fire on the cashier close path;
`generateOrderNumber` can 500 on branch-prefixed demo numbers; cashier idempotency keys are not
reused across retries; sub-unit UGX split amounts; an ambiguous readiness-strip badge). **C4 NOT
started — do not implement receipt print/reprint/deliver, receipt search, or refund execution, and
do not retire Queue/Receipts.** See `ai/CASHIER_FLOOR_RECONSTRUCTION_C3_SETTLEMENT_COMPLETION_REPORT.md`
and `ai/CASHIER_FLOOR_RECONSTRUCTION_C3_QA_EVIDENCE_INDEX.md`.

**REBRAND + ROLE UI QA WAVE COMPLETE (2026-08-20).** The Aug-2026 Nimbus POS Brand Identity
(designer Andimashimwe Rhoda) is fully landed in `apps/web` — navy/silver/graphite tokens
(navy-900 `#000033` canonical), a **new alpha-channel token system** that fixed a pre-existing
app-wide defect where every `token/alpha` utility (all modal scrims) rendered transparent,
true-vector steering-wheel assets in `apps/web/public/brand/`, the non-registry `NimbusLogomark`
in the operational header + login hero, PWA/OG metadata, and new canonical `docs/BRAND_IDENTITY.md`.
Shared-component accessibility fixes landed (Button `inverse` variant, header logout 2.71→20.48:1,
disabled 3.62→8.51:1, a visible `focus-inverse` ring on navy surfaces, navy scrims, two
invisible-label fixes). Waiter, Cashier (within the C2 boundary — nothing gated implemented), and
Supervisor each got a full live QA pass at 1440×900 + 1024×768 on an isolated local Postgres 16 +
WASM-Prisma stack (shared Neon untouched), producing new canonical `docs/waiter-ui-docs/*` and
`docs/cashier-ui-docs/CASHIER_API_MATRIX.md` and a live-verified `SUPERVISOR_API_MATRIX.md`.
Frontend + docs only — **no backend/schema/migration/seed/permission/Postman change; no
commit/push.** Validated 2026-08-20: web typecheck + lint + production build all pass; ~180 QA
screenshots. Nine open findings are recorded for the owner and **none were implemented**. **Cashier
C3 and Manager reconstruction both remain gated.** See `ai/REBRAND_AND_ROLE_QA_COMPLETION_REPORT.md`.

**SUPERVISOR RECONSTRUCTION FINAL CLOSURE COMPLETE (2026-07-31) — B: COMPLETE WITH KNOWN
LIMITATIONS / DEMO-READY.** An integrated final QA pass executed the full Supervisor experience
live (Floor/order-workspace, Reservations, Approvals, Me), cross-role Waiter/Cashier regression,
and role/privacy boundaries across all four viewports on an isolated stack (disposable Neon branch
for API matrices, local Docker Postgres for the four-viewport Playwright browser suite — 262/264
executed passed, 0 unresolved failures). Two test-harness defects were found and fixed (a
multi-role-login race in the shared `uiLogin` fixture; a reservation-create test asserting
nonexistent validation copy / conflating native-date-constraint blocking with app-level
validation); zero product-code defects were found. Shared Neon `production` verified
byte-for-byte unchanged before/after. See `ai/SUPERVISOR_RECONSTRUCTION_FINAL_COMPLETION_REPORT.md`
(canonical closure record), `ai/SUPERVISOR_FINAL_QA_EVIDENCE_INDEX.md`,
`ai/SUPERVISOR_FINAL_KNOWN_LIMITATIONS.md`, `ai/SUPERVISOR_FINAL_DEMO_SCRIPT.md`, and
`ai/SUPERVISOR_FINAL_DEMO_DATA_REGISTER.md`. **Manager reconstruction NOT started — it remains
blocked until Cashier reconstruction (below) closes at C6.** See `PROGRESS.md`.

**Cashier Floor-First reconstruction — Prompt C2 COMPLETE (2026-07-31) — A: C2 COMPLETE / READY FOR
C3.** C2 replaces C1's neutral selected-table boundary with the **table→bill resolution + canonical
read-only settlement-workspace foundation** (frontend-only; **no backend/schema/migration/seed/
permission/Postman change**). Selecting a table runs ONE bounded, branch-scoped
`GET /pos/orders?tableId=` query and classifies results through a central fail-closed helper
(`lib/cashier/bill-resolution.ts`): **zero** payable → truthful "No bill is available for this table."
(+ read-only closed-bill list when present); **one** → auto-resolve into the workspace (URL gains
`orderId`, no visible selector); **multiple** → an explicit bounded selector (**never** a silent
first-pick). Canonical URL state is `?tableId=&orderId=` (or `?orderId=` for tableless/takeaway/Find
bill) — refresh/Back/Forward safe; invalid/cross-branch orderId fails safe. The one canonical
`CashierSettlementWorkspace` is **read-only** (Bill / Totals / Payment state / Settlement readiness /
History) and **reuses** the existing checkout primitives (`CashierOrderTotals`,
`CashierPaymentSummary`, `normalizeCashierOrder`) — it exposes **no** payment/split/close/receipt/
refund control (those are C3/C4). Payment state **fails closed** (unavailable is never shown as
unpaid). A compact Cashier-only **Find bill** dialog (sibling above the shared Floor, never a fork;
bounded/branch-scoped; tableless+takeaway; exact-id fallback) routes results into the same workspace;
receipt-reference search is deferred to C4. Queue/Receipts remain hidden compatibility routes (not
deleted, not redirected, not mounted on Floor). New: `lib/cashier/bill-resolution.ts`,
`lib/cashier/bill-query-keys.ts`, `components/cashier/floor/{CashierBillResolutionPanel,
CashierBillSelector,CashierSettlementWorkspace,CashierFindBillDialog}.tsx`,
`scripts/cashier-c2-assertions.ts`, and the `e2e/cashier-floor/` C2 specs. Validated: web
typecheck/lint/build; C1+C2+shell+floor assertions; Playwright `e2e/cashier-floor/` executed on an
**isolated local Docker Postgres** stack (never shared Neon); no commit/push. **C3 (payment/close
execution) NOT started** — do not implement payment/split/close/receipt/refund, retire
Queue/Receipts, fork the shared Floor, or change any Cashier permission without explicit
authorization to proceed past C2. See `ai/CASHIER_FLOOR_RECONSTRUCTION_C2_BILL_RESOLUTION_COMPLETION_REPORT.md`,
`ai/CASHIER_FLOOR_RECONSTRUCTION_C2_QA_EVIDENCE_INDEX.md`, and
`ai/CASHIER_FLOOR_RECONSTRUCTION_PROMPT_C3.md`.

**Prior milestone record (superseded by C2 above, kept for history) — Cashier Floor-First
reconstruction Prompt C1 COMPLETE (2026-07-31).** The locked Floor-first
target (nav **Floor · Till · Me**, default route `/cashier/floor`, Cashier as the third
`OperationalFloor` consumer alongside Waiter/Supervisor, a settlement workspace behind table
selection, and a compact **Find bill** sibling control) is now **implemented for C1**, on top of
the C0 audit. C1 delivered (frontend-only; **no backend/schema/migration/seed/permission/Postman
change**): Cashier nav changed to Floor/Till/Me; `/cashier/floor` page + `/cashier` → `/cashier/floor`
redirect; `getCashierLandingPath()` → `/cashier/floor`; the new `CashierFloorScreen` renders the
shared `OperationalFloor` (no forked card/grid/toolbar) with a Cashier data layer
(`lib/cashier/floor-{api,model,route}.ts`) over `pos:table:read`/`pos:orders:read`/`pos:reservation:read`
(already held); canonical `?tableId=` selection URL state (refresh/Back/Forward safe; invalid table
fails safe); and a **read-only, truthful settlement boundary** (`CashierSelectedTablePanel`, "Select a
bill to continue.") that exposes **no** payment/close/split/refund/receipt action — the mount point
C2 replaces. **Queue and Receipts are NOT deleted and NOT redirected** — they remain hidden
compatibility routes reachable only by direct URL (retire Receipts→C4, Queue→C5). Till/Me unchanged.
Validated: web typecheck/lint/build; shell/floor/cashier-c1 assertion scripts; Playwright
`e2e/cashier-floor/` **88/88** (22 × 4 viewports) + cross-role regression **40/40**, executed on an
**isolated local Docker Postgres** stack (never shared Neon); `git diff --check` clean; no commit/push.
See `ai/CASHIER_FLOOR_RECONSTRUCTION_C1_SHARED_FLOOR_COMPLETION_REPORT.md` (canonical C1 record),
`ai/CASHIER_FLOOR_RECONSTRUCTION_C1_QA_EVIDENCE_INDEX.md`, and `ai/CASHIER_FLOOR_RECONSTRUCTION_PROMPT_C2.md`
(next-prompt spec). **C2 (table→order resolution + settlement workspace foundation + Find bill
foundation) has NOT started.** Do not implement payment/split/close, remove or redirect
Queue/Receipts, fork the shared Floor for Cashier, or change any Cashier permission without explicit
authorization to proceed past C1. Manager reconstruction remains paused until Cashier C6 closes.

**Prior milestone record (superseded by the final closure above, kept for history):**
WAITER complete + SUPERVISOR RECONSTRUCTION through Prompt 5B2 — SUPERVISOR APPROVALS CLOSED
(Reservations UI complete with known limitations; order-workspace financial actions feature-complete;
Prompt 4A–4D reservation lifecycle + isolated live QA + fail-closed DB isolation tooling; Prompt 5A
Approvals backend/contract/QA foundation; Prompt 5B1 Discount + Leave decisions; Prompt 5B2 Anomaly
acknowledge/resolve + Shift-swap Outcome C reject-only — PROMPT 5 CLOSED AT B / DEMO-READY WITH KNOWN
LIMITATIONS).

- **Supervisor Approvals — Prompt 5B2 PROMPT 5 CLOSED (2026-07-31).** Completes the four-domain
  Approvals workspace. **Anomaly** Acknowledge (OPEN→ACKNOWLEDGED, note optional; the row **stays** in
  Needs action until resolved) + Resolve (ACKNOWLEDGED→RESOLVED, note **required**) are live via the
  `pos:analytics:anomalies:acknowledge`-gated endpoints; evidence is preserved and the underlying
  order/till/payment/attendance/shift record is **not** mutated. **Shift-swap = Outcome C
  (user-authorized): Reject only, NO Approve control.** A truthful atomic roster swap is unsupported —
  `ScheduleAssignment` is **read-only across the entire API** (no roster-mutation service; assignments
  are only seeded), the request references only a `shiftDate` (no specific-shift FK), and
  `pos:hr:shift-swaps:approve` has never mutated the roster (SUP-RG-036/042). The UI says so honestly
  ("schedule reassignment is not supported"); Reject writes status + audit and changes **0** roster
  rows (verified). **Do NOT add a shift-swap Approve/roster-mutation control, a roster-write service,
  or a schedule permission without explicit authorization.** Frontend-only: **no backend / schema /
  migration / seed / permission / Postman change; no commit/push.** Validated: web typecheck/lint/build;
  API 126/126 + reservations 39/39; isolated live QA on disposable branch `br-hidden-king-a4rbwvj0`
  (API matrix — shift-swap reject/dup/bound + anomaly ack/resolve/dup/stale = **11/11**; roster
  integrity 0 assignments touched; full Playwright Approvals suite × 4 viewports executed); shared
  `production` untouched; branch deleted. **Prompt 5 (Supervisor Approvals) is CLOSED at B — COMPLETE
  WITH KNOWN LIMITATIONS / DEMO-READY.** Next major track: **Manager reconstruction (not started)**.

- **Supervisor Approvals — Prompt 5B1 (2026-07-30).** The read-only Approvals
  page is replaced by a premium `SupervisorApprovalsWorkspace` on the 5A `approvals-contract.ts`:
  **Needs action / Resolved / History** scope tabs, All + per-domain filters, server-`total` counts,
  one identity-safe queue row shell, responsive master-detail (desktop split / mobile stack — one
  detail workspace), URL-persisted `scope`/`domain`/`page`/`from`/`to`/`selDomain`/`selId` (default
  Needs action / All / page 1; **never** History; filter changes use `router.replace`). **Discount +
  Leave are fully actionable** — Discount reuses the Prompt 3 `/pos/discounts/:id/approve|reject` +
  financials with the **UI-only payment-safety gate** + truthful **self-approval notice**; Leave uses
  `PATCH /hr/leave/:id/review` with **no payroll/roster claim**; terminal records are read-only.
  **Shift-swap + Anomaly render READ-ONLY** (their decisions land in Prompt 5B2 — do NOT add
  Acknowledge/Resolve/Approve controls). **Discounts are omitted from Resolved/History** (no
  branch-wide endpoint, SUP-RG-035; a truthful "available from the related order" notice shows if
  forced). New files: `apps/web/src/lib/supervisor/approvals-workspace.ts`,
  `apps/web/src/components/supervisor/approvals/workspace/*`, `apps/web/e2e/supervisor-approvals/*`
  (the old read-only `components/supervisor/approvals/*` remain but are unused). **No permission,
  schema, migration, seed, backend, or Postman change; no commit/push.** Validated: web
  typecheck/lint/build; API 126/126 + reservations 39/39; isolated live browser QA on disposable Neon
  branch (Playwright Approvals suite × 4 viewports executed); shared `production` untouched. Do NOT
  begin Prompt 5B2, add a generic approvals decide endpoint, or add a permission without approval.

- **Supervisor Approvals — Prompt 5A COMPLETE / READY FOR PROMPT 5B (2026-07-30).** Backend +
  contract + isolated-live-QA foundation for the premium Approvals UI (Prompt 5B). **No new
  permission, schema, migration, seed, or Postman change; no commit/push.** The four approval
  domains (Discount, Leave, Shift-swap, Anomaly) already had working decision lifecycles (pass
  Jest); 5A **audited** them against real code + live Neon and applied **backward-compatible
  hardening** — bounded leave/shift-swap list pagination (coerced `@Type`+`@Max(100)`+service
  clamp), **branch isolation** on shift-swap approve + anomaly acknowledge/resolve (leave stays
  **org-scoped** by design — nullable branch), **concurrency-safe** status-guarded conditional
  `updateMany` claims on all four decisions (duplicate/raced → 409 discount / 400–409 others, no
  double mutation or audit), optional `dateFrom`/`dateTo` History filters on leave/swap/anomaly
  lists, and a minimal `actorUser` identity projection on the anomaly **list**. **Architecture is
  domain-specific (Option B):** Supervisor does **not** hold `approvals:read`/`approvals:decide`,
  so the generic `unified-approvals` inbox (`POST /api/approvals/:id/decide`) is NOT the Supervisor
  path — every decision uses its canonical domain endpoint (`/pos/discounts/:id/approve|reject`,
  `/hr/leave/:id/review`, `/hr/shift-swaps/:id/approve`, `/analytics/anomalies/:id/acknowledge|resolve`).
  Leave + shift-swap live in the **attendance** module; anomalies in **analytics**. Added the
  additive `apps/web/src/lib/supervisor/approvals-contract.ts` (Needs-action/Resolved/History
  scopes over real statuses, canonical endpoints, bounded per-domain query builder, minimal
  identity resolvers, query-key factory, counts-from-`total`, narrow decision invalidation, error
  mapping); the read-only Approvals **page is visually unchanged**. **Isolated live QA executed** on
  a disposable Neon branch (Prompt 4D fail-closed launcher): API decision matrix **29/29** (incl.
  branch-isolation 404, duplicate 409/400, required-reason, identity names) + Playwright Approvals
  smoke **8/8** (4 viewports); shared `production` verified untouched (58/0/836/126). **Documented
  gap (SUP-RG-035):** discounts have no branch-wide list endpoint (only `/pending` + per-order) →
  no branch-wide discount Resolved/History without a new endpoint. Do NOT begin the Prompt 5B UI,
  add a generic approval decide endpoint, or add a permission without approval.

- **Supervisor Reservations — Prompt 4D COMPLETE WITH KNOWN LIMITATIONS (2026-07-29).** The
  outstanding live-browser/API QA gate is closed. Durable **fail-closed isolation tooling** now
  lives under `tools/qa/` (env-isolation lib + DB-identity preflight using the API's own Prisma
  client + launcher: denylist → preflight → spawn; plus a live reservation mutation-matrix
  runner). It fixes the 4C incident root cause — an inherited shell `DATABASE_URL` overrode a
  swapped `.env` (`dotenv` never overrides an already-set env var), so isolation now constructs
  the child-process env explicitly and strips inherited DB vars, and refuses to start the API
  unless the denylist + sentinel + migration + `COMPLETED` enum + demo-branch identity checks
  pass. **Live reservation mutation matrix 53/53** (create/confirm/assign/reassign/seat/cancel/
  no-show/manual-complete/queries/pagination/overdue/branch-isolation/concurrency); the
  Playwright reservations suite (9 specs × 4 viewports = 72 tests) was **actually executed**
  against an isolated local Docker stack (the disposable Neon branch's EAT↔us-east-1 latency
  exceeds the app's 30s client abort under the reservations page's concurrent fan-out — an
  external limit, not a UI defect). First-execution spec fragilities (loose selectors, hardcoded
  times, a page-local lookup helper) were found and fixed; the product is independently verified
  (create-dialog validation renders correctly; Jest 67/67; matrix 53/53). **Shared Neon verified
  untouched** (126 reservations / 12 events / 0 QA rows; recovery branch `br-dawn-truth-a4zjs1p7`
  retained). **NO backend/DTO/schema/migration/seed/permission/Postman change.** New non-blocking
  gap **SUP-RG-034** (concurrent identical creates can 500 on the reservation-number race —
  recommended backend hardening, out of scope). Do NOT begin Approvals reconstruction.

- **Supervisor Reservations UI — Prompt 4B COMPLETE WITH KNOWN LIMITATIONS.** The
  read-only triple-query page is replaced by a premium master-detail workspace on the
  Prompt 4A `scope=active|history` contracts: **Arriving / Seated / Attention / History**
  views (one bounded `scope=active` query feeds the three active views + a lazy
  `scope=history` query — no all/today/upcoming triple-fetch, no browser merge, no
  all-history initial load, no pageSize-100 default), reservation **creation**, and the
  full verified lifecycle (**Confirm, Assign/Change table, Seat, Cancel, No-show,
  Manual complete**) plus truthful automatic-completion presentation and an
  Attention workflow (overdue + structural SEATED issues; individual actions, **no bulk
  resolution**). **The Supervisor role already holds every `pos:reservation:*`
  permission — NO permission change and NO backend change.** Action availability mirrors
  backend `VALID_TRANSITIONS` exactly. Cross-role Waiter visibility via narrow
  invalidation; URL-persisted view/date/page/status/from/to/selected. ⚠️ **Shared Neon
  still needs migration `20260518000000_prompt4a_reservation_completed_event`
  (`ReservationEventType.COMPLETED`) before manual-complete + order-close auto-completion
  work there** (all other actions + Attention/overdue work on shared today — verified
  read-only via Neon MCP). Live browser/4-viewport/`/api/health`/disposable-branch
  mutation execution remains the outstanding QA gate (not fabricated).

- **Waiter UI — complete & visually locked** (premium menu/order entry, instant
  table→menu flow, UGX totals, shared profile Me).
- **Application-wide performance hardening — complete** (residual Neon/local
  latency remains, documented, not a frontend deadlock).
- **Shared profile — complete** (Waiter/Cashier/Supervisor reuse profile primitives).
- **Supervisor Reconstruction — Prompt 0, 1, 2, 3A, 3B1, 3B2, 3B3A, 3B3B complete.**
  Prompt 3A added idle parity, the central order action-availability module,
  canonical selected-order wiring, a shared confirmation dialog + idempotency-intent
  utility, and the service actions (**Request bill**, **Mark served**). Prompt 3B1
  added the handoff actions inside the Floor workspace: **Split bill, Split items,
  Move items, Merge** (`pos:order:split`/`merge`/`move-items`, BG3 idempotency).
  Prompt 3B2 added **Transfer table** (`pos:order:transfer`, BG3 optional
  idempotency; bounded branch-scoped target selector; canonical source/target Floor
  reassignment; post-transfer URL re-anchor) and a compact **Find order** Floor
  lookup (bounded/paginated; status/service filters; exact-ID fallback) that opens
  takeaway/tableless/closed/voided/exception orders in the canonical workspace.
  Payment stays read-only. ⚠️ The authorized `pos:order:transfer` grant is a single
  backend gate for BOTH transfer-table and transfer-server; **transfer-server has
  no UI (Outcome B — deferred)** but its endpoint is now API-reachable. Prompt 3B3A
  added **active-order Void** (`pos:orders:void`) and **order-level Discount request**
  (`pos:discount:request`) in a new **Adjustments** group, plus a read-only Discounts
  panel. Void is separated from refund/complimentary/post-close void; discount basis
  is the subtotal and the backend threshold (default 5000) decides APPROVED vs PENDING
  (UI shows an estimate, never an optimistic final total). A **documented UI-only
  payment safety gate** blocks void + discount when money is present (the backend does
  not itself check payment). Prompt 3B3B added **discount Approve/Reject** (inline on
  PENDING discount rows, `pos:discount:approve` — one permission gates both) and
  **Complimentary** (whole-order 100% discount via `pos:discount:request`, Outcome B —
  `Discount.metadata` round-trips). Approve recalcs totals (payment-gated); reject leaves
  totals unchanged; complimentary may return PENDING above the org threshold. **Self-
  approval is backend-permitted** — the UI matches it and flags it ("You requested
  this"); a backend self-approval/maker-checker guard is recommended. No permission or
  backend change in 3B3A/3B3B (perms pre-existed).
- **Supervisor order-workspace financial actions are feature-complete for the
  reconstruction scope.** Do NOT wire out-of-scope actions (transfer **server**, refund
  creation/approval, post-close void, payment collection, order close). **Reservations
  Prompt 4A (backend) and Prompt 4B (UI) are now complete** — do NOT start the full
  Approvals-page reconstruction unless explicitly approved, and do NOT extend Reservations
  beyond the 4B scope (no reservation deposit capture / payment, no bulk resolution) without
  approval.
- **Pending QA:** consolidated authenticated live/browser/viewport QA and `/api/health`
  verification for Prompts 3B1–3B3B **and Prompt 4B** remain outstanding (no API/DB/browser
  automation in the current environment; Prompt 4B static gates + Neon MCP read-only
  verification passed). Do not claim demo-ready on shared Neon until the Prompt 4A
  `COMPLETED` migration is deployed there and live QA is run.

## 11. Locked decisions (do not change without explicit approval)

**Waiter:** nav = Floor/Reservations/Me; no Orders tab; instant table→menu; full-
screen menu/order workspace; manager-configured FOOD/DRINKS taxonomy (never
hard-code fallback categories — show an honest "manager configuration" empty
state); UGX with zero-fraction rendering via the shared waiter currency formatter;
guest names never shown on Floor cards.

**Shared shell:** one `OperationalShell` + `OperationalHeader` + shared
`CurrentTime` + shared logout + `OperationalBottomNav` + canonical icon registry
serve all three roles via thin per-role adapters.

**Shared Floor:** Waiter and Supervisor render **one** `OperationalFloor`
presentation (same toolbar, grid, cards, status labels, staff formatting
`First L.`, breakpoints, 176px card height). **Role behaviour differs only AFTER
table selection** — Waiter opens its menu/order workspace; Supervisor opens a
read-first table-control workspace. Changes to shared Floor cards/toolbar/status/
spacing/breakpoints propagate to **every** consuming role by design.

**Supervisor:** nav = Floor/Reservations/Approvals/Me; no visible Orders tab;
legacy Orders routes redirect into Floor. Live Floor-workspace mutations: table
status (Review/Confirm); **Request bill** + **Mark served** (`pos:orders:write`,
Prompt 3A); **Split bill / Split items / Move items / Merge** (`pos:order:*`,
Prompt 3B1, BG3 idempotency); and **Transfer table** (`pos:order:transfer`,
Prompt 3B2, BG3 optional idempotency); **Void** active order + **Discount** request
(`pos:orders:void` / `pos:discount:request`, Prompt 3B3A); and **Discount Approve/Reject**
+ **Complimentary** (`pos:discount:approve` gates both approve+reject; complimentary uses
`pos:discount:request`, Prompt 3B3B) — the financial actions live in an **Adjustments**
group and none are BG3-wrapped. A compact **Find order** control on Floor (Supervisor-only
sibling above the shared `OperationalFloor`, never a forked Floor or an Orders tab)
opens takeaway/tableless/closed/voided/exception orders in the canonical workspace. A
read-only **Discounts** panel lists existing discounts with **inline Approve/Reject on
PENDING rows** (shown only with `pos:discount:approve`). No menu entry, no payment
collection, no order close, no KDS, no receipt controls.
**Void/Discount/Approve/Complimentary are UI-gated off orders with payment (a documented
UI-only safety boundary — the backend does not itself check payment); reject is NOT
payment-gated (non-mutating). Discount basis = subtotal; the backend threshold (default
5000) decides APPROVED vs PENDING — never inferred client-side; approve recalcs totals,
reject leaves them unchanged; no optimistic totals.** **Complimentary = Outcome B**: a
whole-order 100% discount + persisted `metadata {complimentary,category}` + reason
(whole-order only; may return PENDING) — NOT a void and NOT a refund. **Self-approval is
backend-permitted; the UI matches it and flags it** (a backend guard is recommended).
Void is NOT a refund/complimentary/post-close void. **transfer-server is deferred (Outcome
B — no safe server selector); `pos:order:transfer` is a single backend gate for BOTH
transfer-table and transfer-server, so the transfer-server endpoint is API-reachable
for Supervisor but has NO UI.** Out-of-scope (never wire without approval): transfer
server, refund, post-close void, payment collection, order close. All three roles share
one idle-logout mechanism (`pos-shell/idle`).

**Reservation lifecycle (Prompt 4A — COMPLETE WITH KNOWN LIMITATIONS, isolated Neon QA executed):**
`SEATED → COMPLETED` is exposed via `POST /api/reservations/:id/complete`
(`pos:reservation:update`, already on Supervisor/Owner/Manager — do NOT add a new
permission) and **auto-fires on order close** at the single `OrdersService.transitionOrder`
CLOSED choke point (explicit `seatedOrderId` linkage, retry-safe, never in Cashier FE).
All reservation transitions use guarded conditional updates (concurrency-safe). Lists are
bounded server-side: `scope=active|history`, `pageSize` default 25 / **max 100**, derived
`overdue` (never auto-NO_SHOW). Only schema change is the `ReservationEventType.COMPLETED`
enum + migration `20260518000000_...`, **not yet deployed to shared Neon**. **Testing
rule:** destructive reservation QA runs ONLY on a disposable Neon branch; the shared
dev/demo branch is read-only for QA; no mass shared-Neon data repair without approval.

**Reservations UI (Prompt 4B — COMPLETE WITH KNOWN LIMITATIONS):** premium master-detail
workspace over the 4A scope contracts. **Views = Arriving / Seated / Attention / History**
(UI groupings, never persisted statuses). **One bounded `scope=active` query** feeds the
three active views (client derivation — no browser merge, no triple-fetch); **History** is a
separate lazy `scope=history` query (server-paginated, default 25/max 100). Default =
Arriving + today + page 1; **never** default to All / all-dates / all-statuses / full history
/ pageSize 100. Lifecycle actions expose already-verified endpoints (all already permitted for
Supervisor — **do NOT add a permission, do NOT change the backend**): Create / Confirm /
Assign-table / Seat / Cancel / No-show / Manual-complete; **action availability mirrors backend
`VALID_TRANSITIONS` exactly** (never offer an action the service would 409); No-show is **never**
offered for SEATED and **never** automatic; Seat fabricates **no** order. **Attention** = server
overdue (grace 15m, PENDING/CONFIRMED) + structural SEATED issues (no linked order / linked-order
closed / no table); **individual actions only — NO bulk resolution**; the 6 order-less SEATED +
55 overdue shared records surface individually (no mass repair without approval). Guest privacy:
names in rows, contact only in the workspace/create form. Deposit stays read-only (create accepts
optional `depositRequired` amount; no payment/deposit capture). Cross-role invalidation is narrow
(Supervisor active/history/detail/events + Supervisor Floor overlay + Waiter reservations/floor
only — never menu/profile/auth/shift/approvals/all-orders/cashier). ⚠️ **Manual-complete +
order-close auto-completion require migration `20260518000000_prompt4a_reservation_completed_event`
on shared Neon** (see `ai/SUPERVISOR_RESERVATIONS_SHARED_NEON_DEPLOYMENT_READINESS.md`); all other
actions + Attention/overdue work on shared today.

Full list with rationale/dates: `docs/DECISIONS.md`.

## 12. Do NOT (prohibited)

- Do not implement out-of-scope order-resolution actions: refund creation/approval,
  post-close void, transfer **server**, payment collection, order close. Reservations
  Prompt 4A (backend) + 4B (UI) are complete — do not start the full Approvals-page
  reconstruction, and do not extend Reservations beyond the 4B scope (no reservation
  deposit capture / payment, no bulk resolution, no new reservation status). (Prompt 3A's
  Request bill + Mark served, 3B1's Split bill/Split items/Move items/Merge, 3B2's
  **Transfer table** + **Find order**, 3B3A's active-order **Void** + **Discount
  request**, and 3B3B's discount **Approve/Reject** + **Complimentary** are already live
  and in-scope; do not extend beyond them without approval. transfer-server stays
  UI-blocked pending a safe server selector even though `pos:order:transfer` makes its
  endpoint reachable. Do not add a backend self-approval guard, refund, or post-close
  void UI without approval.)
- Do not reintroduce an Orders navigation tab (Waiter or Supervisor).
- Do not recreate role-specific Floor components (the old `WaiterTable*` /
  `SupervisorTable*`/`SupervisorFloor*` files were intentionally deleted).
- Do not redesign the completed Waiter experience.
- Do not alter API contracts, DTOs, Prisma schema, migrations, seed/demo import,
  permissions, auth semantics, or branch isolation.
- Do not edit Postman collections unless an actual contract change requires it.
- Manager reconstruction **M-P1, Track B1 (top-nav shell conversion) and Track B2 (Overview
  dashboard) are COMPLETE** (shell, nav, session guard, branch switcher, foundation pages, Manager
  Me, the Odoo-style top module bar + Manager chrome primitives, and the live eight-card Overview
  dashboard). Do not add an approval **decision** control to Overview, render a KPI that is not in
  `MANAGER_KPI_BINDINGS`, add an SSE/`EventSource` client (gated on C-04), add a charting dependency,
  fabricate a revenue trend (no bucketed series exists and `/dash/snapshots` needs
  `pos:dash:owner:read`, which Manager does not hold), take the open-order count from
  `/dash/open-orders.count`, or read approval counts from the generic `/api/approvals` inbox.
  **B3…B7 (and B0, B5's sub-phases) are NOT started and plan from
  `ai/ENTERPRISE_UI_ROADMAP.md` Track B, not from `ai/MANAGER_RECONSTRUCTION_ROADMAP.md`. Do not
  begin B3 (Operations + Staff) or any later Track B phase without explicit authorization.**
  Do not add a Manager More/Approvals tab, change the `/manager/overview` landing, turn
  `lib/manager/permissions.ts` into a
  `hasPermission()` check, add tills/shifts chips or lists (those routes do not exist), fetch
  `/hr/employees` into Manager state without the agreed allow-list projection, offer a PDF report
  export (the backend's PDF is a plain-text file), build a branch-profile edit form
  (`PATCH /branches/:id` does not exist), fork any shared shell/floor/profile component for Manager,
  add Accounting as a seventh top-nav menu (OD-3 stays open, gated on B5), or mount
  `ManagerSearchFilterMenu`/`ManagerBreadcrumbs` on any surface without real filterable/record data
  to back them.
- Cashier reconstruction Prompt **C3 is COMPLETE** (nav Floor/Till/Me, `/cashier/floor` default,
  shared-Floor consumer, table→bill resolution with zero/one/multiple handling, canonical
  `?tableId=&orderId=` URL state, ONE `CashierSettlementWorkspace` reusing the checkout primitives,
  a bounded Cashier-only **Find bill** sibling, and — new in C3 — **payment collection, partial
  payment, split settlement and order close executing inside that workspace**). **Do not begin
  Prompt C4 (or any prompt past C3)** — do not implement receipt print/reprint/deliver, receipt
  search, or refund execution; do not delete or redirect Cashier's Queue/Receipts pages (hidden
  compatibility routes until C4/C5); do not fork the shared Floor for Cashier; do not mount the
  merge / move-items / transfer-table handoff group on the Cashier Floor path (it is intentionally
  excluded via `CashierResolutionPanel variant="split-only"`); do not add a synthetic standalone
  Close control (the backend has no zero-payment close); do not change any Cashier permission —
  without explicit authorization to proceed past C3. See §10,
  `ai/CASHIER_FLOOR_RECONSTRUCTION_ROADMAP.md`, and
  `ai/CASHIER_FLOOR_RECONSTRUCTION_C3_SETTLEMENT_COMPLETION_REPORT.md`.
- Backend gap batch 1 is **complete and must not be undone**: do not reintroduce a PDF export path
  (`format: PDF` returns 501; there is no renderer — OD-10 is still open) or re-advertise PDF in the
  report catalog; do not widen the employee safe projection or add `compensationProfile`,
  `dateOfBirth`, `address`, `emergencyContact*`, `notes` or `metadata` to a default `/hr/employees`
  payload; do not take an open-order **count** from `/dash/open-orders.count` (that is the page
  length — use `total`); and do not reintroduce `grossSales = SUM(subtotal)` /
  `netSales = SUM(total)`. **Do not seed the missing `accounting:*` / `finance:*` permissions
  (C-21), change the Manager role's `pos:hr:compensation:read` grant (FU-1), or deploy this batch to
  shared Neon without the cutover gate.**
- Do not broadly refactor React Query or the performance architecture.
- Do not hide known limitations or fabricate QA results.

If an issue needs a future feature phase, **document it — do not implement it.**

## 13. Shared-component reuse rules

- Equivalent UI concepts across roles **must** consume the shared assets in
  `apps/web/src/components/pos-shell/`, `.../components/floor/`, and
  `.../components/profile/` — never fork a per-role copy.
- When you change a shared component, verify **every** consuming role.
- Icons come **only** from the canonical registry
  (`pos-shell/role-icon-config.ts` + `role-icons.ts`); reference by name, never
  import Phosphor directly in routes/screens. Sizes/weights use the registry
  tokens (bottomNav 24 / compactAction 18 / pageState 32; active nav `fill`,
  inactive `bold`).
- **Brand-mark exception (2026-08-20):** `pos-shell/NimbusLogomark.tsx` is the
  Nimbus steering-wheel **brand mark**, not a UI icon, so it is deliberately
  **NOT** in the icon registry. It renders inline SVG in `currentColor` and is
  mounted in `BranchContextLabel` (44px header tile) and `login.tsx` (56px hero
  tile). This is the **only** documented exception — it is not a licence to import
  glyphs directly. Raster/vector brand files live in `apps/web/public/brand/`; see
  `docs/BRAND_IDENTITY.md`.

## 14. Database & migration rules

- Prisma + Neon Postgres. Schema at `packages/db/prisma/schema.prisma`;
  migrations committed under `packages/db/prisma/migrations/`.
- Never edit a shared/applied migration. New migration or (local-only) reset.
- Seed (`seed.ts`) is idempotent and must stay so. Money is Decimal-safe
  end-to-end; stock must not go negative without a controlled override.
- **In an onboarding/polish pass, do not run migrations or seed and do not change
  seed/demo data.**
- **Shared/production Neon deploys use `db:migrate:deploy` (`prisma migrate deploy`)
  ONLY — never `db:migrate`, which is `prisma migrate dev` (shadow DB / drift-reset,
  unsafe on shared). Prisma migrations need a DIRECT (non-pooled) Neon connection —
  strip `-pooler` from the endpoint host.** Any shared-Neon migration/seed requires an
  explicit per-cutover authorization gate (read-only preflight + a retained
  pre-migration recovery branch first); Postgres enum values cannot be dropped, so
  recovery = branch restore / forward-fix, never enum-value removal. The Prompt 4A
  `COMPLETED` enum migration + the `pos:order:transfer` seed mapping were deployed to
  `production` in Prompt 4C (2026-07-29) under such a gate.
- **Isolation for disposable-branch QA:** swapping `apps/api/.env` alone does NOT
  isolate a Node process — an inherited shell/profile `DATABASE_URL` overrides it
  (`dotenv` never overrides an already-set env var). To target a disposable branch,
  unset that env, point BOTH `apps/api/.env` and `packages/db/.env` at it, and verify
  isolation with a READ before any write. Destructive/mutation QA never runs against
  `production`.

## 15. Performance-preservation rules

Recent hardening must not regress. Avoid reintroducing: duplicate `/api/auth/me`
or shell/readiness queries, duplicate timers, Floor/reservation request storms,
responsive double-mounts, broad query invalidation, blocked mutation settlement,
or full-page loading for ordinary actions. The API client has a bounded 30s
timeout + AbortController + request IDs; secondary invalidations are non-blocking.
Cashier startup was reduced from ~101 → ~9 requests — keep it that way.

## 16. Validation & completion expectations

Before claiming any phase complete, run **executable** validation:

- `typecheck`, `lint`, `build` for `@nimbus-pos/web` (all must pass).
- `GET /api/health` returns `ok`.
- `git diff --check` clean; every Postman collection JSON still parses; Postman
  contract diff empty unless a real contract change was required.
- Authenticated QA across the viewport matrix (1024×768, 1366×768, 1440×900,
  1920×1080) — see `docs/TESTING_AND_QA.md`.
- **Browser/E2E QA:** a Playwright harness exists at `apps/web/playwright.config.ts`
  + `apps/web/e2e/supervisor-prompt3/` (4 viewport projects, env-driven creds, no
  hard-coded secrets; artifacts git-ignored). Reuse/extend it — don't fork a new one.
- **Destructive/mutation QA uses an ISOLATED disposable database (never shared
  Neon).** Stand up a local Docker `postgres:16` (unique DB name + non-conflicting
  port), `migrate deploy` + `db:seed` (+ `db:demo:import` for a Supervisor login),
  run against an isolated API/web on non-default ports, then tear it all down. Full
  recipe in `docs/TESTING_AND_QA.md`.
- **Never claim a phase complete without executable validation.** Report failures
  honestly with the command + exact output (see `ai/AI_ERROR_PROTOCOL.md`).
- Update `ai/AI_STATUS.md`, `PROGRESS.md`, `repo file tree.txt` (if structure
  changed), and write a completion report from
  `ai/AI_COMPLETION_REPORT_TEMPLATE.md`.

## 17. Known high-risk areas

- Neon/local Prisma connection-pool pressure & cold-start latency (external, not
  a frontend bug). Only one API process on `:3001` at a time.
- Backend gaps that block frontend features (e.g. no per-line sent-order state →
  post-send item additions blocked; no verified reservation-completion contract).
- Legacy documentation that still describes a 5-tab Supervisor with an Orders
  page — treat as **superseded** (see `docs/DOCUMENT_INDEX.md`).

## 18. Deferred features

Full accounting, payroll admin, franchise, developer portal, owner SaaS billing,
PesaPal diner checkout, live mobile-money (MTN/Airtel) diner payments, printer
drivers, terminal/acquirer traffic, MSR/badge login, and smart spouts. Details in
`docs/KNOWN_LIMITATIONS.md`.

## 19. When documentation conflicts with code

1. Trust the **local worktree code** and the top-of-file "Current State" in
   `ai/AI_STATUS.md`.
2. Verify against the route registry, navigation, and permissions in code.
3. Update the stale doc (or add a supersession notice) — do **not** change code
   to match stale docs, and do **not** rewrite historical completion reports as
   if they were current specifications.

## 20. Claude + Codex synchronization rule

`CLAUDE.md` and `CODEX.md` are paired agent onboarding files. Whenever durable
project guidance changes in either file — status summaries, locked decisions,
paths, commands, role boundaries, validation expectations, governance rules, or
handoff notes — update the other file in the same change with the same facts,
adapted only for tool-specific wording. If a change intentionally applies to
only one agent, say why in the changed file so the other agent does not treat the
omission as drift.
