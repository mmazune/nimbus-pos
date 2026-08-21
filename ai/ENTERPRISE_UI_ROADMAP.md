# Enterprise UI Roadmap — Nimbus POS

**Status:** **CANONICAL.** Created **2026-08-20**, immediately after the Odoo reference research and
the Nimbus-vs-Odoo gap analysis were completed and the product owner (Moses) issued four directives
(§1).
**Supersedes:** `ai/MANAGER_RECONSTRUCTION_ROADMAP.md` **from M-P2 onward** (M-P0 and M-P1 shipped
and their history stays intact — see §2.2 and the banner on that file).
**Does not supersede:** `docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md` (C4→C6 continue
unchanged, in parallel — Track C-P).

**Track B1 and B2 are COMPLETE (2026-08-20)** — see `ai/ENTERPRISE_B1_TOPNAV_COMPLETION_REPORT.md`
and `ai/ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md`. Every other Track B phase remains
unimplemented and **requires an explicit owner "go" before any runtime code is written**, per-phase.

> **Honesty rule for this document.** Every Odoo pattern referenced here is one that was actually
> observed and screenshotted in `ai/ODOO_REFERENCE_RESEARCH.md`. Where that research says
> **(not opened)**, this roadmap does not clone it and says so. Every Nimbus endpoint referenced is
> either live-verified (M-P0, 62 rows) or explicitly marked **claimed-by-code, unverified** (the
> ~90 accounting/finance routes and the addendum sections C–K of `MANAGER_API_MATRIX.md`).

---

## 1. Owner directives recorded (Moses, 2026-08-20 — APPROVED decisions)

| # | Directive | Where it lands |
| --- | --- | --- |
| **D1** | Manager (and later Owner) each get a **detailed dashboard**, modelled on the owner's Odoo instance. | Track B — **B2** (Manager Overview), **B7** (Owner variant) |
| **D2** | **Management navigation switches to an Odoo-style TOP NAV BAR** — module bar + dropdown submenus, search/filter bar, top-right cluster. **This SUPERSEDES the M-P1 bottom-nav decision for Manager.** Frontline roles (Waiter, Cashier, Supervisor) **keep bottom nav**. | Track B — **B1**; recorded in `docs/DECISIONS.md` as **D-MGRTOPNAV** |
| **D3** | The suite must reach **Odoo-grade**: control-panel pattern, list/kanban/form patterns, per-journal-style KPI cards, settings covering everything a manager configures (staff onboarding, password/Quick-PIN set + change, devices, alerts), and reporting with graph/pivot **when the backend allows**. | Track B — B1 primitives, B3 patterns, B4 reporting, B6 settings |
| **D4** | Gap fixes from the analysis get **scheduled** — including the accounting UI over the ~90 existing endpoints, and the true backend gaps (NG-01 fake PDF, NG-02 compensation leak, NG-06 report rows, NG-14 SSE auth, plaintext-PIN discipline, stale `MODULES.md`). | Track B — **B5**; Track C — every entry |

**D2 detail (the supersession, stated precisely).** M-P1 shipped a six-item **bottom** nav
(Overview · Operations · Staff · Reports · Settings · Me) for Manager. That decision is
**superseded in its presentation only**. What carries forward from M-P1 unchanged:

- Manager remains the **fourth consumer** of the shared operational UI system — never a fork.
- `ManagerShell` / `ManagerSessionGuard` / session + idle handling.
- The **branch switcher**, its `me.memberships` source, its `nimbus.managerBranchId` persistence,
  its `X-Branch-Id` plumbing and its narrow `["manager", …]` invalidation.
- `lib/manager/permissions.ts` as a **surface allow-list, not a permission check**.
- The honest foundation pages and the real Manager **Me**.
- The readiness strip's **three verified chips only** rule.

What changes: the **presentation of navigation** for Manager (and later Owner) — from a fixed
bottom bar of six tabs to a top module bar with dropdown submenus, plus the control-panel row
beneath it. The six M-P1 surfaces survive as the first six top-nav menus; Accounting (B5) is added
as a seventh (pending owner decision **OD-3**, §10).

---

## 2. Ground truth this plan is built on

### 2.1 What is verified

| Source | What it proves |
| --- | --- |
| `ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md` | **62** matrix rows live-verified (🟢 51 · 🟡 7 · 🔴 4). 18 findings **MP0-01…MP0-18**. Manager is multi-branch (4 memberships); branch switching is fail-closed; **61/61 permissions held** → every MVP restriction is a *product* constraint. |
| `docs/manager-ui-docs/MANAGER_API_MATRIX.md` (+ 2026-08-20 Addendum) | The verified 62 rows **plus** an addendum (sections A–K) enumerating everything the matrix omits — AP/AR/bank-rec/budget, accounting foundation + GL, settings, alerts, sync, audit, analytics, HR/workforce, exports, franchise. |
| `ai/ODOO_REFERENCE_RESEARCH.md` | 17 screenshots; the full 58-item Accounting menu tree; the control-panel anatomy; the KPI card anatomy; the user-form credential model; a 15-component inventory **C1…C15**. |
| `ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md` | 20 gaps **NG-01…NG-20**, typed UI-over-API / Backend / Mixed, with a top-10 priority list. |
| `ai/MANAGER_P1_SHELL_COMPLETION_REPORT.md` | The shipped shell, switcher, guard, allow-list and honest pages. |
| `docs/UI_SYSTEM.md` §1c–§5b | Today's density system, fullscreen lock screen, terminal identity, short table labels. |

### 2.2 What is NOT verified (and gates work)

- **The ~90 accounting/finance endpoints** (`accounting/ap`, `accounting/ar`, `accounting`
  bank-rec, `finance` budgets, `accounting` foundation, `ledger`) were found by **static route scan
  only**. No runtime probe, no permission check, no payload inspection. → **B0 exists for this.**
- `docs/MODULES.md` still marks *"Accounting (COA, GL, AP, AR) — M32–M36 — ⬜ Planned"* and
  *"Budgets / Forecasts — M37 — ⬜ Planned"*. **The controllers exist.** → **C-06**.
- Sections C–K of the addendum (settings, alerts, sync, audit, analytics, workforce, staff-insights,
  exports, franchise) are likewise unverified. → **B0**.

### 2.3 The single most important correction to the previous plan

The manager suite was scoped as if accounting were absent. **It is not.** Roughly 90
accounting/finance endpoints already exist across four modules that no Nimbus document admitted,
and the dominant cost there is **frontend, not backend** — *provided* those routes survive an
M-P0-style live verification, which has never been run.

---

## 3. Constraints that bind EVERY phase

These carry forward verbatim from `ai/MANAGER_RECONSTRUCTION_ROADMAP.md` §2 and remain in force.
A phase that violates one is **not complete**, regardless of its own gate.

**Truthfulness**
- **No fake success states of any kind** — no fake downloads, no fake print/terminal/receipt
  success, no fabricated metrics, no implied roster change, no fabricated report rows.
- A KPI, column, chart or chip with **no verified backing field is omitted, not estimated**.
- Where a capability is absent, the UI **says so** in product copy.

**Privacy / safety**
- Compensation, contracts, payroll, pay runs, payslips, bank details, tax IDs and private HR notes
  are **never rendered and never fetched** (NG-02 / MP0-01 — the leak is at the *wire*, so the
  projection must sit at the **API-client boundary**).
- Credentials are never logged, never persisted, never placed in a query cache (NG-09 / MP0-14).
- No real PII. No live MTN/Airtel/PesaPal diner execution. No printer-driver invocation. No
  card-terminal/acquirer traffic.

**Engineering**
- Manager/Owner are **consumers** of the shared operational UI system, **never a fork**. The
  top-nav is delivered as an **additive variant of the shared shell**, not a parallel shell (see
  B1 and **OD-5**).
- Icons only via the canonical registry (`pos-shell/role-icon-config.ts` + `role-icons.ts`); the
  `NimbusLogomark` brand mark is the one documented exception.
- Brand tokens only (`docs/BRAND_IDENTITY.md`); no hard-coded hexes; **do not port Odoo's dark
  palette** — Odoo's hexes in the research are a *layout and hierarchy* reference, not a colour
  source. Nimbus stays navy/silver/graphite.
- The 2026-08-20 **density mechanism** (`docs/UI_SYSTEM.md` §1c) is global and role-agnostic. Every
  new surface uses rem/Tailwind utilities; no raw px for vertical rhythm; icon geometry is retuned
  only through the registry.
- **No backend / DTO / Prisma schema / migration / seed / permission / auth-semantics /
  branch-isolation / Postman change** in any Track B phase. If a phase needs one, **stop and
  document it** — that is what Track C is for.
- Do not regress the performance hardening (no duplicate `/api/auth/me`, no request storms, no
  broad invalidation, no responsive double-mounts).
- Destructive/mutation QA on an **isolated disposable database only** — never shared Neon.
- **No commit and no push** unless the owner explicitly asks.

**Cross-track**
- Cashier C4→C6 runs in parallel (Track C-P). Any edit to `components/pos-shell/*` or
  `components/floor/*` propagates to Waiter, Cashier and Supervisor **by design** — coordinate
  before touching shared files and re-run the cross-role regression in the same phase.

---

# TRACK A — Experience polish

**Overall status: mostly DONE.** Recorded here so the enterprise push does not re-litigate it, plus
the enumerated remainder.

## A0 — Shipped 2026-08-20 (record only, no work)

| Item | What shipped | Canonical record |
| --- | --- | --- |
| **Global density system** | `html { font-size: clamp(13.5px, calc(0.625vh + 9.25px), 16px) }` + rem-normalized `--space-*`; icon registry 18/24/32 → **16/20/28**; table card `min-h-[9.5rem]`; grid track `13rem`; header + bottom nav **80 → 64px**; readiness 44 → 36px; `PageShell` title `text-2xl` → `text-xl`. Measured root font 13.50 / 14.05 / 14.88 / 16.00px across the viewport matrix; 1920×1080 identical to the pre-density baseline. | `docs/UI_SYSTEM.md` §1c · `docs/DECISIONS.md` D-DENSITY |
| **Fullscreen lock screen** | `/login` is a true `h-screen` + `overflow-hidden` layout with an internally scrolling card; page scroll is zero at 680/768/900/1080. Brand lockup + "Service terminal" + three status chips; role-marketing paragraph and footer sentence removed; truthful blocked-role toast unchanged. | `docs/UI_SYSTEM.md` §1d · D-LOGIN |
| **Terminal identity** | `pos-shell/station.ts` replaces the dead "Service area unavailable" / "Workstation unavailable" fallbacks with a deterministic station label (`localStorage["nimbus.stationTerminalLabel"]`, else **"Terminal 01"**), hydration-safe, documented in code as a station label and **not** backend data. | `docs/UI_SYSTEM.md` §2b · D-TERMINAL |
| **Short table labels** | Deterministic display-side abbreviation in `floor/formatters.ts` (`QA-P4-PASS2-1440` → `QP4P2-1440`); collision-safe within a fetched set; full label preserved in `title`/`aria-label`; card titles one line. | `docs/UI_SYSTEM.md` §5b · D-TABLELABEL |

Validation on record: typecheck + lint; **12/12** assertion scripts; Playwright **180/180** across
four viewport projects; zero console errors; 15 screenshots at 1280×680 + 1440×900.

## A1 — Remaining polish debt (the only Track A work left)

**Type:** frontend polish on shared components. **Sizing: S.**
**Dependencies:** none. Can run before, during or after B1 — but it touches shared files, so
coordinate with B1 and Cashier C4.

### Scope

| # | Item | Source | Note |
| --- | --- | --- | --- |
| **A1-1** | **Floor-toolbar / floor-plan select placement.** Search (`min-w-[280px] basis-[360px]`) + floor-plan select (`min-w-[220px]`) in a `flex-wrap` row wrap awkwardly at 1024×768 — a **shared** component, so it affects all four roles. | `docs/KNOWN_LIMITATIONS.md` §UI notes; Rebrand QA finding **(g)** | The density pass reduced surrounding chrome but did not re-lay-out this row. Fix once in `floor/OperationalFloorToolbar`. |
| **A1-2** | **Untruthful zero-bill copy.** The zero-bill "closed bills" list reuses `CashierBillSelector` copy — *"N payable bills are open"* — for a list of *closed* bills. Still present at `components/cashier/floor/CashierBillSelector.tsx:50`. | Rebrand QA finding **(e)** | **Owned by Cashier C4** (Track C-P), not by this track. Listed for completeness. |
| **A1-3** | **Cashier readiness badge copy.** Still reads *"Read-only readiness"* (`components/cashier/shell/CashierReadinessStrip.tsx:46`) above a surface where money now moves post-C3. | C3 finding **F-C3-6** | **Owned by Cashier C5/C6.** Listed for completeness. |
| **A1-4** | **Waiter Quick PIN unusable in practice.** Rebrand QA found no usable Quick PIN for `waiter@nimbus.demo` although `demo-data/DEMO_LOGIN_CREDENTIALS.md` + `WAITER_UI_DEMO_SCRIPT.md` advertise **246810** — and the mapping **does** exist at `packages/db/prisma/demo-import.ts:158`. Root cause not diagnosed. | Rebrand QA finding **(h)** | **Not a UI fix → Track C (C-13).** The PIN lookup hash is **branch-derived** — the most likely place to look. Manager's `11223344` is verified working. |

**Already fixed since the rebrand QA report was filed — verified against the code on 2026-08-20;
no work remains, do not re-open:**

| Was | Status now | Evidence |
| --- | --- | --- |
| Status-token contrast — `status-warning` **2.37:1**, `status-success` 3.94, `status-danger` 3.83 (rebrand finding **b**) | ✅ **FIXED** — status ink darkened, hue preserved; each now clears AA on its own surface, on white, and as white-on-solid: success `#11774E` (5.06), warning `#8A6410` (4.99), danger `#B7384C` (5.00), info `#2B69B2` (4.95). | `apps/web/src/styles/globals.css:48-53` + the `-ch` channel triplets at `:21-23`; `docs/UI_SYSTEM.md` §1b |
| Off-brand role accents (finding **c**) | ✅ **FIXED** — all four `--color-role-*` accents re-derived from brand navy on a 30° OKLCH hue ladder (waiter 232 · supervisor 264 · cashier 294 · manager 324). The old amber cashier accent that read as a warning colour is gone. White-on-solid 9.13 / 12.55 / 10.83 / 11.18:1. | `globals.css:68-73`; `docs/UI_SYSTEM.md` §1b |
| Neutral/graphite decoupling (finding **d**) | ✅ **RESOLVED as a deliberate, documented decoupling** — `--color-status-neutral #616367` is intentionally not `--color-brand-graphite #6B6B6B`. Not an open item. | `docs/UI_SYSTEM.md` §1b |
| Internal jargon leak — *"Prompt 3B3A discount validation"* (finding **f**) | ✅ **FIXED** — the string no longer appears anywhere in `apps/web/src`. | repo scan, 2026-08-20 |
| Inter webfont not bundled (finding **i**) | ✅ **FIXED** — self-hosted **Inter Variable** (woff2, `font-display: swap`) loaded in `_app.tsx`; the CSS stack lists `"Inter Variable"` first, then a system-installed `Inter`. The app no longer depends on a system font — **B4's dense numeric tables are safe.** | `apps/web/src/pages/_app.tsx:6-12`; `globals.css:160-161` |

### Out of scope

Any redesign of the completed Waiter experience. Any change to the density mechanism's mechanics
(only its consumers). Any role fork. Re-opening anything in the "already fixed" table above.
A1-2 and A1-3 are **Cashier-owned** (C4 / C5-C6) and must not be fixed here — they sit inside
components another track is actively rewriting.

### Acceptance gates

- typecheck / lint / build pass.
- `shell-assertions.ts`, `floor-assertions.ts`, `profile-assertions.ts` and every existing
  assertion script still pass (shared files touched).
- Playwright cross-role regression across all four viewport projects — **Waiter, Cashier,
  Supervisor and Manager** — because A1-1 is a shared Floor component.
- Screenshot evidence at **1024×768** specifically (the viewport A1-1 is about) plus 1440×900.
- `git diff --check` clean; no commit/push.

### Completion report

`ai/ENTERPRISE_A1_POLISH_COMPLETION_REPORT.md` — from `ai/AI_COMPLETION_REPORT_TEMPLATE.md`, stating
per item: fixed / deferred-with-reason / owner-decision-pending, with before/after measurements for
any contrast or layout change.

---

# TRACK B — Management suite (the core)

Seven build phases plus one audit phase. Each is an independent prompt with its own gate and its
own completion report. **Do not merge phases.**

## B0 — API verification extension (M-P0 pass #2)

> ✅ **COMPLETE — 2026-08-20.** Executed as part of the **permissions cutover** milestone rather
> than standalone, because its subject matter (the AP/AR/budget block) was **403 for every role**
> until C-21 seeded the missing permissions — B0 could not verify what nobody could call.
> Report: **`ai/ACCOUNTING_API_VERIFICATION_REPORT.md`** (not the originally-planned filename
> `ENTERPRISE_B0_API_VERIFICATION_REPORT.md`, so that the accounting subject matter is findable
> by name). Findings are numbered **PC-01…PC-07** rather than `BV-*`, because this pass shipped a
> backend + seed change and `BV-*` was reserved for a docs-only B0.
> **Verdict: 🟡 CONDITIONAL GO for B5** — blocking on **PC-03** (four accounting reads leak across
> branches) and **PC-04** (AP recurring-bill duplicate prevention is dead code).
> Sections A, B, C, D, E and F were covered. **Section G (analytics)** was not re-probed (already
> verified for Supervisor 5A/5B2), **sections I/J (franchise)** were not covered beyond
> `franchise:forecast:read`, the **chatter-rail question was not investigated** (no chatter
> endpoint exists in the section list), and the **20 B6 write routes were not exercised**.

**Type:** documentation and verification only. **No runtime code.** **Sizing: M.**

> **Why this exists.** The gap analysis' headline finding is that ~90 accounting/finance endpoints
> exist and are undocumented. They were found by **static scan only**. Designing B5 against
> unverified routes would repeat exactly the mistake M-P0 was created to prevent. B0 is the same
> pass, extended to the addendum.

### Scope

- Run an **M-P0-style live verification** over addendum sections **A** (AP/AR/bank-rec/budget, ~59
  routes) and **B** (accounting foundation + GL, ~15 routes): route registered, HTTP method,
  exact `@Permissions` string on the real guard, `@RequireBranchContext` presence, service `where`
  clause (org- vs branch-scoped), live HTTP code, and the **actual response shape**.
- Then sections **C** (settings, 8 routes), **D** (alerts), **E** (sync/reliability), **F**
  (`GET /api/audit/timeline`), **G** (analytics — especially `GET /analytics/anomalies` and
  `GET /analytics/risk-dashboard`).
- Record, per route, whether the **Manager JWT actually holds** the permission. The guides
  (`docs/ACCOUNTING_FOUNDATION_GUIDE.md`, `docs/GL_POSTING_ENGINE_GUIDE.md`) *claim* Manager holds
  read on accounts/cost-centers/periods/posting-source-maps/tax-config and create on
  accounts/cost-centers/periods, and `journals:read` / `posting-runs:read` / `posting-errors:read`
  but **not** `journals:create` / `journals:reverse` / `posting:replay`. **Those role tables were
  never re-verified.** Verify them.
- Probe the three failure modes B5 must render honestly: an unseeded/empty AP/AR ledger, a
  reconciliation with no statement imported, and a budget with no actuals.
- Flag every new finding in the `MP0-*` house style, numbered **BV-01…** to avoid collision.

### Out of scope

Any UI. Any backend fix (document only). Rewriting the addendum body rather than adding a
`Verified` column. Sections **H** (HR/workforce — partly covered, and the compensation-adjacent
routes are excluded by locked decision), **I**, **J** (franchise), **K** beyond what B6/B7 need.

### Dependencies

None. **B0 can run in parallel with B1** — it writes only documentation and touches no shared file.

### Acceptance gates

- Every route in sections A, B, C, D, E, F, G carries a verified status with evidence (controller
  file + line, permission string, live HTTP code or an explicit `not exercised (mutation)`).
- Live probes on an **isolated disposable stack** via the `tools/qa/` fail-closed launcher;
  `GET /api/health` → `ok`; shared Neon proven untouched.
- The AP/AR/bank-rec/budget block carries an explicit **go / no-go for B5** with the reason.
- `git diff --check` clean. No commit/push.

### Completion report

`ai/ENTERPRISE_B0_API_VERIFICATION_REPORT.md`, plus a `Verified (B0, <date>)` column appended to the
`MANAGER_API_MATRIX.md` addendum (annotate, never rewrite), plus the `BV-*` finding table.

---

## B1 — Manager TOP-NAV shell conversion

**Status: ✅ COMPLETE (2026-08-20).** See `ai/ENTERPRISE_B1_TOPNAV_COMPLETION_REPORT.md` for the
full scope checklist, validation numbers, and recorded deviations (OD-4 answered at the `xl`/1280px
breakpoint rather than the `lg`/1024px suggested below — the full bar does not reliably fit at
1024×768). **B0, B2 and every later phase remain gated on an explicit owner go.**

**Type:** frontend implementation on shared components. **Sizing: L.**
**This is the foundation every later Track B phase mounts on.**

**Odoo patterns cloned:** **C1** control panel (`05`, `12`), **C2** search/filter dropdown (`15`),
**C3** filter chips (`05`, `07`), **C15** breadcrumb + record pager (`06`), and §1.2/§1.3/§1.7 of
the research (module bar, click-to-open dropdowns, top-right cluster).

### Scope

**(a) The module top bar.** Structured left → right per research §1.2:

```
[brand/home] [Nimbus POS · Manager] [ menu · menu · menu … ]     [branch switcher] [clock] [identity ▾]
```

- Left: the `NimbusLogomark` tile (already the header brand mark) doubling as the **home control**
  → `/manager/overview`. Odoo's app-grid launcher has **no Nimbus equivalent** (Nimbus has one
  workspace per role, not 21 apps) — **do not build an apps grid.**
- Centre: text menu items, ~13px, generous horizontal padding, no separators, active item in a
  subtle rounded outline box.
- Right: the **existing** branch switcher (carried forward from M-P1 unchanged), the shared
  `CurrentTime`, and the identity/logout cluster. Odoo's messaging bubble, activities clock and
  Studio button have **no Nimbus equivalent** — **do not build them.**

**(b) Dropdown submenus.** **Click-to-open** (research §1.3 — hover alone does not open in the
reference), left-aligned under their trigger, internally grouped by muted section headers, scrolling
inside the panel when long, `Escape` closes. Full keyboard operation is mandatory (arrow keys, Home/
End, `Escape`, focus return to trigger) — Odoo's own behaviour is the layout reference, **not** the
accessibility reference.

**(c) The initial menu tree** (six menus — the M-P1 surfaces, re-presented):

| Menu | Items |
| --- | --- |
| **Overview** | direct action → `/manager/overview` |
| **Operations** | Orders · Tables · Reservations · Exceptions *(B3 fills these; B1 ships the tree with honest not-yet states)* |
| **Staff** | Directory · Onboarding · Attendance · Leave · Shift swaps |
| **Reports** | Catalog · Report runs |
| **Settings** | Branch profile · Devices · Printers · Terminals · Alerts · Sync |
| **Me** | direct action → `/manager/me` |

Accounting is **added in B5** (subject to **OD-3**).

**(d) The control-panel row** — the single most reusable primitive in the whole reference (§1.5).
One row under the module bar:

```
[New] [secondary]  Title ⚙     [🔍 (chip)(chip)✕  Search… ▾]     1-25/312 ‹ ›     [▤ ▦ 📊 ▦]
```

Built once as a shared primitive with slots, so every later page is cheap: primary/secondary action
slot, title + actions-cog slot, chip search box, **server-backed pager**, view-type switcher.
**Rules:** the pager reflects the endpoint's real `total` — never a client-side count; the view
switcher only ever offers views that exist for that surface (no greyed-out promises); the cog menu
is omitted entirely on surfaces with no record actions.

**(e) Search / filter dropdown** (§1.5, screenshot `15`) — three columns: **Filters** (divider-
grouped, ending in `Custom Filter…` **only if** the surface's endpoint supports it), **Group By**
(only fields the endpoint can actually group by — **most Nimbus list endpoints cannot group**, so
this column is frequently absent and must not be faked), **Favorites**. Applied filters render as
**chips inside the search box** with `✕`.

> **NG-11 constraint.** Nimbus has **no saved-view/filter concept in the API**. Favorites therefore
> ships either (i) not at all, or (ii) **localStorage-only, explicitly labelled "saved on this
> terminal only"**. Recommendation and owner decision: **OD-7**.

**(f) Breadcrumb + record pager** (§1.6) — on a record, a two-line title area: parent list as a link
on line 1, record identity on line 2 with its cog; the record pager (`1 / 5 ‹ ›`) walks the
underlying list. Ships as a primitive in B1, consumed from B3 onward.

**(g) Responsive behaviour.** The top nav is the Manager presentation at desktop widths. Below the
breakpoint the module bar collapses to a single menu control — **it does not fall back to the
frontline bottom nav** (that would reintroduce exactly what D2 supersedes). Exact breakpoint and
collapsed presentation: **OD-4**.

**(h) Shared-shell strategy.** Deliver the top nav as an **additive variant of `OperationalShell`**
(e.g. a `navigation="top" | "bottom"` shape, defaulting to `bottom`), *not* a `ManagerShell` fork.
Waiter, Cashier and Supervisor must render **byte-identically** afterwards. See **OD-5** if the
shared component cannot absorb it cleanly.

### Out of scope

Any live data on any surface (that is B2…B6). Any write action. Any approval decision. An apps-grid
launcher. Odoo's messaging/activities/Studio cluster. Chatter (that is B3). Graph/pivot views (B4,
and gated on NG-06). Changing the frontline roles' navigation in any way. Any permission change.

### Dependencies

M-P1 (complete). **Blocks B2, B3, B4, B5, B6, B7.** Coordinate with Cashier **C4** — both touch
shared `pos-shell/*`.

### Acceptance gates

- typecheck / lint / build pass.
- `enterprise-b1-assertions.ts` proves: the module bar renders exactly the approved menu tree; every
  icon resolves through the canonical registry; the branch switcher is present and still drives
  `X-Branch-Id`; **the frontline roles still render the bottom nav** and their headers are
  unchanged; the control-panel pager is fed from a `total`, never a page length.
- Existing `shell-assertions.ts` / `floor-assertions.ts` / `profile-assertions.ts` /
  `manager-p1-assertions.ts` / cashier C1–C3 assertions all still pass — **updated only where the
  top-nav conversion makes an assertion factually wrong, and each such update recorded in
  `docs/DECISIONS.md`** (the precedent set by the density pass).
- Playwright `e2e/manager-topnav/` × 4 viewport projects **plus** full cross-role regression
  (`e2e/cashier-floor/`, `e2e/supervisor-prompt3/`, supervisor approvals/reservations,
  `e2e/manager-shell/`).
- **Keyboard-only** traversal of the module bar and every dropdown, and a screen-reader label pass.
- Zero console errors; screenshots at 1024×768, 1366×768, 1440×900, 1920×1080.
- Isolated-DB rule; `GET /api/health` → `ok`; `git diff --check` clean; no commit/push.

### Completion report

`ai/ENTERPRISE_B1_TOPNAV_SHELL_COMPLETION_REPORT.md` — must state explicitly which shared files
changed, the cross-role regression result, and how the frontline bottom nav was proven unchanged.

---

## B2 — Manager Overview dashboard

**Status: ✅ COMPLETE (2026-08-20)** — `ai/ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md`.
Eight cards over the five verified `/dash/*` reads plus four branch-scoped approval-count endpoints;
polled at 60 s with a permanent, truthful degraded-stream statement (C-04 still open); every KPI
bound to a verified field through a machine-checked registry; no charting dependency added.
**B3 remains gated on an explicit owner go.**

**Type:** frontend implementation. **Sizing: M.**

**Odoo pattern cloned:** **C10** KPI card grid — the Accounting Dashboard, screenshot `02`,
research §2.1/§2.2. That screen is literally a **kanban of journals**, which is why it carries a
search bar, a `Favorites` chip and a pager `1-6 / 6`.

### Scope

**(a) The card grid.** 3 columns × N rows of bordered cards with a coloured left accent bar, each
following the observed skeleton:

```
Title
[action][action]                    <count label>   <amount>
                                    <count label>   <amount>
──────────── mini chart OR checklist OR nothing ────────────
                                                       [⋮]
```

Faithful details worth cloning (research §2.2): **counts are the drill-in links, amounts are plain
data**; buttons are **mixed weight** (one primary, the rest outlined secondaries); a button's label
may itself be a live count (Odoo's `2 to reconcile` fuses an action and a KPI); **a card may
legitimately have no chart** (Salaries) **or a checklist instead of a chart** (Tax Returns); the
grid does not force visual symmetry.

**(b) Nimbus cards, each backed by a verified field.** Sources: `/dash/manager`,
`/dash/today-summary`, `/dash/payment-mix`, `/dash/open-orders`, `/dash/low-stock`,
`/dash/snapshots`, `POST /dash/kpi/refresh`. Binding rules:

| Rule | Origin |
| --- | --- |
| Every KPI **carries a drill-in target** (Odoo's count-is-a-link pattern). `/dash/manager` returns numbers, not targets — the mapping is a **frontend concern** and must be explicit. | NG-05 |
| **Use `/dash/manager.openOrders` for the open-order number.** `/dash/open-orders` hard-caps at `take: 50` and returns `count = page length`; treat that list as a **capped preview**. | MP0-09 |
| **Never label a bare "Gross" / "Net".** `netSales` is `SUM(total)` (tax-inclusive) and is *larger* than `grossSales` = `SUM(subtotal)` (ex-tax) — inverted vs hospitality convention. Qualify both labels. | MP0-10 |
| **Approval counts are filtered client-side before display.** `GET /api/approvals` is only partly branch-scoped (`leave_request`, `vendor_bill`, `inter_branch_transfer` are org-scoped; live `total: 16` across 5 branches incl. a non-membership branch and 5 FINANCE rows). Filter on `branchId === activeBranchId`, exclude FINANCE, and label the KPI honestly. | MP0-05 |
| **Tills and shifts are counts only** from `/dash/manager.shiftSummary`. `GET /api/tills` and `GET /api/shifts` **do not exist**; `/tills/active` and `/shifts/active` are **operator-scoped** and return the Manager's own row. Never present the Manager's own shift as the branch's. | MP0-02 |
| **Charts.** Nimbus has **no bucketed time series** equivalent to Odoo's 6-bucket aging bar chart on any dashboard endpoint. `/dash/snapshots` is the nearest candidate and is **untested for this use**. → Either B0/B2 proves `/dash/snapshots` can back a real series, or **cards ship chartless** (which the reference explicitly permits). **Never render a synthetic series.** | NG-05, gap analysis §2 |
| **Checklist cards are honest.** Odoo's Tax Returns card is a setup checklist (done = green tick, pending = hollow dot). Nimbus's honest analogue is a **branch readiness checklist** built from the three already-verified M-P1 chips (branch, report generators, devices) — **not** a fabricated onboarding flow. | research §2.2 |

**(c) Live data.** SSE `/api/stream/metrics` with a truthful **degraded** state: *"Live stream
unavailable — showing latest fetched data."* Never a spinner that implies live data.
**Gated on C-04 (NG-14):** `EventSource` cannot carry `Authorization` + `X-Branch-Id` and
`apps/web` has **no SSE client at all**. Until C-04 lands, **B2 ships polled** and says so.

**(d) States.** Loading skeleton, empty, failure, degraded-stream, no-branch — all five.

**(e) `POST /dash/kpi/refresh`** behind explicit confirmation + an in-flight lock.

### Out of scope

Every other menu. Any approval **decision** (Overview decides nothing — counts link into the surface
that owns the decision). Any KPI not backed by a verified response field. Owner/franchise/global
financials (that is B7). Graph/pivot (B4). Accounting cards (B5).

### Dependencies

**B1** (control panel + shell). **C-04 (NG-14)** for live mode — optional, degrades to polling.

### Acceptance gates

- typecheck / lint / build pass.
- `enterprise-b2-assertions.ts` proves: **every rendered KPI maps to a verified response field**;
  every count has a drill-in target; no bare `Gross`/`Net` label exists; the approvals count path
  filters by `branchId` before display; no tills/shifts *table* renders; the degraded-stream state
  renders when the stream fails.
- Playwright `e2e/manager-overview/` × 4 viewports **including a forced stream failure** and a
  forced empty-branch case.
- Branch-switch re-fetch proven (captured `X-Branch-Id` change); **no request storm** (measured
  request count recorded, per the performance-preservation rules).
- Isolated-DB rule; `git diff --check` clean; no commit/push.

### Completion report

**Delivered as `ai/ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md`** (the owner's B2 brief named the
file `…_DASHBOARD_…`; this is the canonical B2 record). It carries the **KPI → endpoint field →
drill-in target** table and an explicit list of the Odoo card features that were *not* cloned and
why — including the revenue trend, which could not be proven: Nimbus exposes no bucketed series, and
`/dash/snapshots` is gated behind `pos:dash:owner:read`, which the Manager does **not** hold.

---

## B3 — Operations + Staff (list / kanban / form patterns)

> ✅ **COMPLETE — 2026-08-20.** Canonical record:
> [`ai/ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md`](./ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md)
> · evidence: [`ai/ENTERPRISE_B3_QA_EVIDENCE_INDEX.md`](./ENTERPRISE_B3_QA_EVIDENCE_INDEX.md).
> The scope below is the ORIGINAL brief and is deliberately not rewritten; the report records
> item-by-item what shipped, what was deliberately not cloned, and what was deferred with a reason
> (Operations **Exceptions**, Staff **Attendance**, the **chatter rail** — still gated on B0 — and
> every escalation write).

**Type:** frontend implementation. **Sizing: L.**

**Odoo patterns cloned:** **C4** list view (`05`), **C5** form view (`06`), **C7** kanban cards +
left facet sidebar (`12`), **C12** security/action table (`10`), **C13** record-cog actions menu
(`11`), **C14** statusbar pipeline (`06`, `09`), **C6** chatter (`06`).

> This phase deliberately pairs Operations and Staff because they are the **same three view
> patterns** over different data. Building them once, twice-consumed, is cheaper and more
> consistent than two separate phases.

### Scope — Operations (read-only oversight)

- **Orders list** cloning C4: leading checkbox column *(only if a bulk action actually exists —
  otherwise omit it; Nimbus has none today, so **omit**)*, right-aligned numerics, status as a
  coloured pill, overdue emphasis, **an optional-column gear at the far right of the header**, a
  column-totals row where the endpoint returns totals, and the control-panel pager fed by the real
  `total`. **Always send an explicit bounded page size** — `/pos/orders` has no `@Max` and no clamp
  (MP0-11).
- **Order detail** cloning C5: statusbar action buttons left + a **status pipeline** right
  (`Draft ▸ Posted` in Odoo → the real Nimbus order lifecycle), a smart-button strip, the record
  title, a two-column field block, inner notebook tabs over the line grid, and a totals block. All
  **read-only** — Operations is oversight.
- **Tables / floor**: if a Floor-like view is used it renders the shared `OperationalFloor`
  **read-only** — same toolbar, grid, cards, status labels, `First L.` staff formatting,
  breakpoints, card height. **Never a `ManagerFloor*` fork. Guest names never on Floor cards.**
- **Reservations snapshot** and **operational exceptions**, read-only.
- **Escalations.** Operations may **surface** a refund/discount/void escalation and route to its
  decision affordance. Any decision **write** uses a **domain-specific** route
  (`/pos/discounts/:id/approve|reject`, `/pos/refunds/:id/approve`,
  `/pos/orders/:id/post-close-void`) — never the generic `POST /api/approvals/:id/decide` (Option B
  precedent) — and carries confirmation + in-flight lock + an honest audit result. **If the DTO is
  not verified, ship the read-only surface and defer the write.**
- **Chatter rail (C6)** over `GET /api/audit/timeline` — the right-rail, date-grouped feed of
  avatar + author + timestamp + tracked-field diffs (`old → new (Field)`). NG-12 calls this "the
  cheapest large gain in perceived enterprise-ness"; **the data already exists**. Gated on **B0**
  verifying the endpoint's shape and permission.

### Scope — Staff administration

- **Staff directory** cloning **C7** kanban (avatar colour block + stacked icon/value rows + status
  dot) with an optional **left facet sidebar** (Odoo's `DEPARTMENT → All / ▸ Administration 3`
  panel), plus a C4 list view via the view switcher.
- 🔴 **GATED ON C-02 (NG-02 / MP0-01).** `GET /hr/employees` returns the full
  `compensationProfile` (`baseAmount`, `salaryBasis`, `allowances`, `deductions`) on **all 40 rows**,
  and `/hr/employees/:id` adds `contracts[].salaryAmount`, plus `dateOfBirth`, `address` and private
  HR `notes`. **A frontend whitelist does not stop the wire transfer.** The directory **must not
  ship** until an **allow-list projection at the API-client boundary** exists so raw data never
  reaches cache or state — and a backend projection is requested (C-02).
- Also: `/hr/employees` is **org-scoped and rejects `?branchId=`** (400, MP0-06) — filter
  client-side and **say so in the UI**, or the branch switcher looks broken.
- **Staff detail form** cloning **C5** with a **statusbar pipeline**. Odoo's is `Invited ▸ Confirmed`
  — Nimbus has **no invite-by-email flow** (NG-08), so the honest Nimbus pipeline is the real
  onboarding state, not a borrowed one.
- **Frontline onboarding** (`POST /api/hr/frontline-staff/onboard`) behind confirmation.
  🔴 **NG-09 / MP0-14 discipline:** the response returns a **plaintext** `quickPin.pin` and
  `issueQuickPin` defaults **true**. The PIN is **masked, copy-once**, carries expiry copy, and is
  **never logged, never persisted, never placed in a query cache.** The onboard DTO's nested
  `employee` accepts `contractId` and `compensationProfileId` — **the form must never expose or
  send either** (MP0-15).
- **Quick-PIN admin** cloning **C12** — Odoo's Security tab is a label ↔ one-line description ↔
  single-action-button table (Change Password / 2FA / API Keys / Passkeys / Devices). Nimbus's
  honest version of that table has **exactly the rows it can back**: Quick-PIN status, Reset,
  Disable, Enable (`GET /hr/frontline-staff/:id/quick-pin-status`, `POST /:id/quick-pin/reset`,
  `PATCH /:id/quick-pin/disable`, `PATCH /:id/quick-pin/enable`). **Password, 2FA, API keys,
  passkeys and per-user session revocation do not exist in Nimbus** (NG-08) — they are **omitted,
  not greyed out and not stubbed.** `/api/devices` is a hardware registry, **not** user sessions.
- **Record-cog actions menu (C13)** with only the actions that exist.
- **Attendance** timeline (read). **Leave review** (`PATCH /hr/leave/:id/review`) making **no
  payroll or roster claim**. **Shift-swap review** — 🔴 M-P0 **re-confirmed** SUP-RG-036/042:
  `scheduleAssignment` has six call sites API-wide, **all reads**, and approving a swap mutates
  **zero** roster rows. Follow the Supervisor **Outcome C** precedent: honest notice, **no Approve
  control that implies a roster change**.
- **Sensitive-fields exclusion card** stating plainly what Manager cannot see.

### Out of scope

Any cashier-checkout clone, tender panel, order builder, order close, table-status mutation or KDS.
Compensation, contracts, payroll, pay runs, payslips, bank details, tax IDs, private HR notes —
**excluded and not fetched**. Any role/permission editor (Odoo's per-domain permission-level
dropdowns have **no Nimbus equivalent by design** — role→permission is fixed in
`packages/db/prisma/seed.ts` `ROLE_PERM_MATRIX`). Any invite-by-email flow. Graph/pivot (B4).

### Dependencies

**B1.** 🔴 The **Staff directory is hard-gated on C-02**. The chatter rail is gated on **B0**
verifying `GET /api/audit/timeline`. Operations escalation writes are gated on a verified domain
DTO.

### Acceptance gates

- typecheck / lint / build pass.
- `enterprise-b3-assertions.ts` proves: the safe-field set is an **allow-list, not a deny-list**;
  **no** compensation / contract / bank / tax / `dateOfBirth` / `address` / HR-notes key can reach a
  rendered component **or the query cache**; no checkout/tender/order-builder control renders on any
  Operations surface; the shared Floor is consumed unforked; every list sends a bounded page size;
  the PIN value never enters a cache key, a log, or `localStorage`.
- Playwright `e2e/manager-operations/` + `e2e/manager-staff/` × 4 viewports covering PIN
  confirm/cancel, onboarding confirm/cancel, leave approve/reject and the shift-swap path as
  decided, **plus cross-role Floor parity regression** (Waiter, Cashier, Supervisor).
- **Live mutation matrix on an isolated disposable DB** — duplicate-submit, wrong-branch,
  stale-record; **roster-integrity check proving 0 `ScheduleAssignment` rows changed** if any swap
  decision ships.
- Network capture proving the compensation projection: the raw payload never lands in React Query
  state.
- `git diff --check` clean; no commit/push.

### Completion report

`ai/ENTERPRISE_B3_OPERATIONS_STAFF_COMPLETION_REPORT.md` — must resolve the recorded
"Operations is read-only" vs "escalations live in Operations" tension explicitly, and state the
shift-swap outcome explicitly.

---

## B4 — Reporting

**Type:** frontend implementation. **Sizing: M** (L only if NG-06 lands and pivot/graph ship).

**Odoo patterns cloned:** **C8** graph view toolbar (`13`), **C9** pivot view toolbar (`14`), plus
C1/C4 from B1/B3. **Not cloned:** Odoo's account-report engine (comparison/date pickers,
hierarchical expandable lines) — the research explicitly records that **the reports themselves were
not opened**, so their internal layout **is not documented** and must not be invented.

### Scope

- **Catalog** — `GET /api/reports/catalog` returns **37 entries** with truthful
  `IMPLEMENTED` (24) / `CONDITIONAL` (1) / `PENDING_LATER` (12) statuses. **The generator-availability
  source already exists and is honest** — drive the UI from it, including a real
  **generator-unavailable** state.
- **Generate** — 🟢 **MP0-16: one generic form is DTO-correct.** All 24 generator DTOs are
  `{reportWindow, dateFrom?, dateTo?, parameters?}`; only `top-items` adds `limit?`. The earlier
  "template-aware forms, generic form rejected" requirement is **superseded**. Scope shrinks
  materially.
- **History** — `GET /api/reports` with bounded pagination (no `@Max` server-side, MP0-11 — the
  client always sends an explicit bound).
- **Detail** — 🔴 `GET /api/reports/:id` returns **no rows**, only `summary` + `rowCount`. Render the
  `summary` as a **key/value panel**. **Do not fabricate a row table.** Also display each run's own
  `branchId` and never link into a run outside the active branch — reads are looked up by `orgId`
  only and **cross-branch read was verified live** (MP0-12).
- **Export — CSV only.** 🔴 `POST /reports/export` with `format: PDF` produces a **plain-text file
  stamped `application/pdf`** and reports `status: READY` — a fake success already in the backend.
  **PDF is not offered.** If the owner wants a PDF affordance at all, it renders as unavailable with
  honest copy. Then `GET /api/reports/exports/:id/download`. Full honest state set: ready /
  generating / failed / generator-unavailable / downloaded.
- **Graph (C8) and Pivot (C9) — 🔴 GATED ON C-03 (NG-06).** Odoo's pivot is backed by real grouped
  reads. Nimbus has **no row payload**, so a pivot/graph clone is a **backend gap, not a UI gap**.
  Until C-03 lands, B4 ships **no graph and no pivot**, and the view switcher **does not advertise
  them**. When C-03 lands, clone the observed toolbars: `Measures ▾`, chart-type toggle,
  stacked/cumulative, sort asc/desc (graph); `Measures ▾`, flip-axis, expand-all, download,
  `⊟/⊞` expandable headers with a `Total` spine (pivot). **`Insert in Spreadsheet` has no Nimbus
  equivalent — do not build it.**
- **Financial statements** (Balance Sheet, P&L, Cash Flow, Trial Balance, General Ledger, Partner
  Ledger, Aged Receivable/Payable) are **not** among the 24 generators. **Deferred** (NG-07 → C-11).
  The first true financial reports Nimbus can ship are the **AP/AR aging views** over the existing
  `accounting/ap/aging` and `accounting/ar/aging` endpoints — and those live in **B5**.

### Out of scope

Fake PDF/Excel downloads. Any client-side fabricated file. Any success state on a failed
generate/export. Scheduled/emailed report delivery (no verified adapter). SaaS invoices.
Owner/franchise consolidated reporting (B7). Financial statements.

### Dependencies

**B1.** Graph/pivot 🔴 **gated on C-03 (NG-06)**. Typography is no longer a risk here: the brand's
Inter Variable is now self-hosted, so dense numeric tables render on the intended face.

### Acceptance gates

- typecheck / lint / build pass.
- `enterprise-b4-assertions.ts` proves: the generate payload matches the verified uniform DTO; **no
  code path synthesizes a file client-side**; **no PDF option is reachable**; no row table renders
  from `/reports/:id`; every history list sends a bounded page size; a run's own `branchId` is
  displayed.
- Playwright `e2e/manager-reports/` × 4 viewports including a **forced generator-unavailable** case
  and a **failed export**.
- Live generate + export matrix on an **isolated disposable DB**; the downloaded artifact is
  inspected and asserted to be real CSV.
- `git diff --check` clean; no commit/push.

### Completion report

`ai/ENTERPRISE_B4_REPORTING_COMPLETION_REPORT.md` — must state that PDF is withheld and why, and
whether graph/pivot shipped or stayed gated.

---

## B5 — Accounting suite UI

**Type:** frontend implementation over ~90 existing endpoints. **Sizing: L (sub-phased).**
**This is the single biggest capability unlock in the whole roadmap (NG-03).**

**Odoo patterns cloned:** the six-menu structure (research §1.4), C1/C4/C5/C14/C15 from B1/B3, and
**C10** for the accounting dashboard cards.

> 🔴 **HARD GATE: B5 does not start until B0 returns a go for the AP/AR/bank-rec/budget block.**
> Those routes are claimed-by-code and **unverified at runtime**.

### The Nimbus menu tree (Odoo's six menus, adapted — never invented)

Odoo's Accounting module carries **58 leaf items** across `Dashboard · Customers · Vendors ·
Accounting · Review · Reporting · Configuration`. Nimbus can honestly back a **subset**. Items
Nimbus cannot back are **absent**, not greyed out.

| Odoo menu | Nimbus menu | Items (each mapped to a real endpoint) | Odoo items with **no Nimbus backing** — omitted |
| --- | --- | --- | --- |
| **Dashboard** | **Dashboard** | Per-ledger KPI cards (C10) over AP/AR `aging`, budgets, bank balances | per-journal charts (no bucketed series endpoint) |
| **Customers** | **Customers** | Invoices (`ar/invoices`) · Credit Notes (`ar/credit-notes`) · Receipts (`ar/receipts`) · Customer accounts (`ar/accounts`) | Products *(lives in Nimbus menu/inventory, not accounting)* |
| **Vendors** | **Vendors** | Bills (`ap/bills`, incl. `:id/approve`) · Payments (`ap/payments`) · Credit Notes (`ap/credit-notes`) · Suppliers (`ap/suppliers`) · Recurring profiles (`ap/recurring-profiles`, incl. `:id/generate-bill`) · Reminders (`ap/reminders`, `generate` / `:id/dismiss`) | Expense *(no expense document)* · Products |
| **Accounting** | **Accounting** | *Transactions:* Journal Entries (`accounting/journals`, `journals/:id`, `journals/:id/reverse`) · *Closing:* Fiscal periods (`accounting/periods`, `:id/open`, `:id/close`, `:id/lock`) · Period close runs (`period-close-runs`) | Assets · Loans · Tax Returns *(NG-17/NG-19 — backend gaps, deferred)* |
| **Review** | **Review** | *Control:* Journal items · Posting runs (`posting-runs`) · Posting errors (`posting-errors`, `:id`) · *Logs:* Audit trail (`/api/audit/timeline`) | Working Files · Inventory Valuation · Depreciation Schedule · Loans Analysis · Unrealized Currencies · Deferred Revenues/Expenses · Bill To Receive / Billed Not Received |
| **Reporting** | **Reporting** | Aged Receivable (`ar/aging`) · Aged Payable (`ap/aging`) · Budgets vs actuals (`finance/budgets`, `:id/update-actuals`) · Procurement suggestions (`finance/procurement-suggestions`) · Demand calendar (`finance/demand-calendar`) | **Balance Sheet · Profit and Loss · Cash Flow · Trial Balance · General Ledger · Partner Ledger · Tax Report · Fiscal Report · Invoice Analysis · Analytic Report · Executive Summary** — none exist (NG-07 → C-11) |
| **Configuration** | **Configuration** | Chart of Accounts (`accounting/accounts`) · Cost centres (`accounting/cost-centers`) · Posting source maps (`posting-source-maps`, `:id`) · Tax config (`tax-config`) · Bank accounts (`bank-accounts`) · Currency + exchange rates (`/settings/currency`, `/settings/exchange-rate(s)`) · Rounding (`/settings/rounding`) · Tax matrix (`/settings/tax-matrix`) | Journals-as-config · Fiscal Positions · Multi-Ledger · Checks · Asset Models · Payment Terms · Follow-up Levels · Payment Providers · Payment Methods |
| *(no Odoo equivalent)* | **Bank** | Bank statements (`bank-statements`, `:id`, `import`) · **Reconciliation workbench** (`reconciliation`, `:id`, `POST`, `:id/match`, `:id/skip`, `:id/complete`) · Manual entries (`manual-bank-entries`) | — *(Odoo's Reconcile lives under `Accounting → Closing`; Nimbus's bank-rec is large enough to deserve its own menu — a deliberate adaptation, recorded here)* |

### Sub-phases

> ⚠️ **RENUMBERED 2026-08-21 by owner brief.** The dashboard was scheduled LAST (B5.6) and the
> lists first. The owner inverted that so the module has a landing page and a menu before any list
> exists, and **B5.1 shipped on 2026-08-21** in that form. Every other sub-phase shifted by one. The
> renumber is encoded in `apps/web/src/lib/accounting/menu.ts` (`ACCOUNTING_SUBPHASES`), so the
> phase tag on every not-yet menu row in the product matches this table.

| Sub-phase | Scope | Size | Gate |
| --- | --- | --- | --- |
| **B5.1 — Module shell, menu tree + dashboard** | Accounting as the **seventh** top-nav module (OD-3), the full grouped Odoo-style menu tree with honest not-yet rows, and the C10 card grid over the verified reads. *(Was B5.6.)* | M | ✅ **COMPLETE (2026-08-21)** — `ai/ENTERPRISE_B5_1_ACCOUNTING_SHELL_COMPLETION_REPORT.md` |
| **B5.2 — Customers + Vendors lists** | AR invoices + AP bills as C4 list views with C5 detail forms; supplier/customer records; the highest-leverage starting point per NG-03. *(Was B5.1.)* | M | ✅ **COMPLETE (2026-08-21)** — `ai/ENTERPRISE_B5_2_CUSTOMERS_VENDORS_COMPLETION_REPORT.md`. Nine list surfaces (three AR: Invoices, Customer accounts, Credit notes; six AP: Bills, Suppliers, Credit notes, Payments, Recurring profiles, Payment reminders) plus the two Reporting → Aged receivable/payable views pulled forward from B5.6 (same `ar.aging`/`ap.aging` routes the B5.1 dashboard already reads — see that row's note). Four detail views (Invoice, Customer account, Bill, Supplier — the last a non-flat `{supplier,summary,recentBills,recentPayments}` shape). |
| **B5.3 — Bank reconciliation workbench** | Statements + import + the match/skip/complete reconciliation flow. ⚠️ The demo dataset carries **zero** bank accounts, statements and reconciliations — B5.3 needs a fixture or a generator before it can be designed. *(Was B5.2.)* | M | ✅ **COMPLETE (2026-08-21)** — `ai/ENTERPRISE_B5_3_BANK_RECONCILIATION_COMPLETION_REPORT.md`. Bank accounts (list-only), Bank statements (list+detail) and Reconciliation (list+detail) all shipped READ-ONLY (PC-01) — no import/match/skip/complete control anywhere. Fixtures created live via the API (Owner token) on the isolated stack: 2 bank accounts, 2 statements, 2 reconciliations (one COMPLETED with a zero difference, one IN_PROGRESS with a live-proven UGX 6,350,000 non-zero difference). The B5.1 Bank dashboard card's three KPIs are now real links. |
| **B5.4 — Accounting core + Review** | Journal entries (**read-only for Manager — B0 confirmed `journals:create`/`reverse`/`posting:replay` are 403**), posting runs, posting errors, the audit-trail rail. ✅ **B5-F4 FIXED (batch 3, 2026-08-21)** — `/api/audit/timeline` now scopes to `X-Branch-Id` by default (still pages with `pageSize`, unchanged); **C-23** means the journals surface has no Postman verification. *(Was B5.3.)* | M | 🔴 NOT STARTED |
| **B5.5 — Closing** | Fiscal periods open/close/lock + period-close runs. **Nimbus's honest analogue of Odoo's Tax Returns + Lock Dates** (NG-17). **PC-07**: four states, `LOCKED` terminal, no unlock; both models are **organisation-level**. Manager can neither close nor lock. *(Was B5.4.)* | S | 🔴 NOT STARTED |
| **B5.6 — Reporting + Configuration** | ~~Aged Receivable/Payable views~~ **shipped early, in B5.2 (2026-08-21)** — pulled forward because they cite the same `ar.aging`/`ap.aging` routes the B5.1 dashboard already reads and the B5.2 brief explicitly scoped them. Remaining: budgets vs actuals, demand calendar; then Chart of Accounts, cost centres, posting source maps, tax config. ⚠️ Procurement suggestions are **403 for Manager** (PC-02) and budgets/demand-calendar are **empty on the demo dataset**. ~~⚠️ **B5-F1**: `ar/aging.summary` totals only the returned page.~~ **FIXED (batch 3, 2026-08-21)**. *(Was B5.5.)* | S | 🔴 NOT STARTED |

### Out of scope (all sub-phases)

Assets, loans, deferred revenue/expense, unrealized-currency revaluation, fiscal positions, payment
terms, follow-up/dunning levels, tax-return documents, and every financial statement — **all backend
gaps** (NG-07, NG-17, NG-19). Any GL write Manager does not provably hold permission for. Any
invented ledger concept. Payroll (locked exclusion).

### Dependencies

🔴 **B0 go** · **B1** · B3's list/form/chatter primitives (strongly recommended — B5 is mostly the
same three patterns over new data).

### Acceptance gates (per sub-phase)

- typecheck / lint / build pass.
- `enterprise-b5-<n>-assertions.ts` proves: **every menu item resolves to a verified endpoint**;
  no menu item exists without one; every list sends a bounded page size; every money value renders
  through the shared UGX formatter; **no financial statement is offered**; no write control renders
  for a permission the Manager does not hold.
- Playwright `e2e/manager-accounting/` × 4 viewports including empty-ledger, failed-import and
  reconciliation-with-no-statement states.
- **Live matrix on an isolated disposable DB** for every write (bill approve, reconciliation
  match/skip/complete, period close/lock, budget update-actuals) — duplicate-submit, wrong-branch,
  stale-record; **money assertions with explicit before/after numbers**.
- `git diff --check` clean; no commit/push.

### Completion report

One per sub-phase, `ai/ENTERPRISE_B5_<n>_<NAME>_COMPLETION_REPORT.md`, each carrying the
endpoint→surface table and the explicit list of Odoo items deliberately **not** cloned.

---

## B6 — Settings

**Type:** frontend implementation. **Sizing: M.**

**Odoo pattern cloned:** **C11** two-pane settings (screenshot `07`) — an **icon sidebar of scopes**
+ a right pane of **full-width banded section headers** each containing a 2-column grid of setting
blocks + a control panel where `New` is replaced by **`Save` / `Discard`** (settings is a giant
dirty-state form). Also **C12** (label ↔ description ↔ single action button).

### Scope — the scopes in the sidebar

| Scope | Backed by | Constraint |
| --- | --- | --- |
| **Branch profile** | `GET /api/branches` | 🔴 **READ-ONLY.** `PATCH /api/branches/:id` **does not exist** (404, MP0-04). Odoo's `Update Info` has **no Nimbus counterpart**. Do not build an edit form. |
| **Devices** | `GET /api/devices`, `POST /devices/activate`, `GET /devices/:id/history`, `GET /devices/:id/status` | A genuine Nimbus **differentiator with no Odoo reference** (NG-16) — original design. Device registry **with status history** is richer than anything in the reference instance. |
| **Printers** | `POST /devices/printers/routes` | **Metadata-only**, with copy that says so. **No print-driver invocation. No print-success claim.** |
| **Terminals** | `POST /devices/terminals/pair`, `POST /devices/terminals/:id/unpair` | **Stub-only**, labelled as a stub. **No acquirer / card-terminal traffic.** |
| **Alerts** | `GET /api/alerts`, `/alerts/rules`, `/alerts/channels`, `/alerts/deliveries` (+ `:id/retry`), `/alerts/digests` (+ `:id/run`), `POST /alerts/test` | **Rules are read-only** by locked owner decision — no visual rule builder. **Deliveries, channels and digests read surfaces are NOT covered by that lock** and are needed for a real settings module. Another Nimbus differentiator with no Odoo reference. |
| **Sync / reliability** | `GET /sync/jobs`, `/sync/jobs/:id`, `POST /sync/jobs/:id/retry`, `GET /sync/conflicts` | Jobs list and conflict **list** ship read-only; the **conflict diff is deferred** by locked decision. Third differentiator with no Odoo reference. |
| **Org settings** | `GET/PATCH /api/settings`, `/settings/currency`, `/settings/tax-matrix`, `/settings/rounding`, `/thresholds`, `/settings/platform-access`, `/settings/exchange-rate(s)` | 🟡 Gated on **B0** verifying each route's permission and Manager's actual hold. Several overlap B5.5 Configuration — **surface once, link from the other**. |

**Explicitly absent, with no menu entry and no path:** Owner/Admin settings, SaaS billing,
franchise, developer keys. Also absent because Nimbus has no such concept: document layout, email
templates, language management, multi-company switcher UI, user invitation by email, 2FA / API keys
/ passkeys / per-user session revocation (NG-08).

### Out of scope

Alert rule authoring. Sync conflict diff/resolution UI. Branch edit form. Any live hardware traffic.
Owner/billing/franchise/developer surfaces of any kind.

### Dependencies

**B1** · **B0** (for the settings/alerts/sync route verification).

### Acceptance gates

- typecheck / lint / build pass.
- `enterprise-b6-assertions.ts` proves: **no owner / billing / franchise / developer route or menu
  entry exists**; printer and terminal copy carries the metadata/stub caveat; the branch profile
  renders **no edit control**; alert **rules** render read-only; no sync conflict **diff** renders.
- Playwright `e2e/manager-settings/` × 4 viewports.
- **Live settings mutation matrix on an isolated disposable DB** — device activate, printer route,
  terminal pair — asserting **stub behaviour, not fabricated success**.
- `git diff --check` clean; no commit/push.

### Completion report

`ai/ENTERPRISE_B6_SETTINGS_COMPLETION_REPORT.md`.

---

## B7 — Owner dashboard variant

**Type:** frontend implementation. **Sizing: M.**

**Odoo pattern cloned:** **C10** again — the same card grid, wider scope. There is **no separate
"owner" screen** in the reference instance; this is a Nimbus scope variant, not an Odoo clone.

### Scope

- The Owner reuses the **same top-nav shell, the same control panel, the same list/form/kanban
  primitives** — a **scope variant, not a second application** (recommendation, **OD-1**).
- Owner Overview over `GET /api/dash/owner` plus, where B0/verification allows, the franchise
  rollups (`franchise/overview`, `rankings`, `consolidated-finance`, `financial-comparison`,
  `scorecards`, `drilldown`).
- 🔴 **Cross-branch leakage warning.** `GET /api/approvals` proved org-scoped in places (MP0-05) and
  report reads are looked up by `orgId` only (MP0-12). Org-scoped rollups **leak across branches by
  construction** — for Owner that may be *correct*, but every such surface must **label its scope
  explicitly** (org-wide vs active branch) so the branch switcher's meaning stays unambiguous.
- A multi-branch presentation of the switcher (Odoo's company-name button is the nearest reference,
  §1.7) — likely "All branches" plus per-branch selection. Requires a decision on whether "All
  branches" is a real query mode or a client aggregation; **do not aggregate client-side and present
  it as a server total.**

### Out of scope

SaaS billing. Developer portal. Any Owner-only write not verified. Any KPI without a verified field.

### Dependencies

**B1, B2** (the card grid) · **B0** (franchise route verification) · **OD-1** (owner decision on
whether Owner reuses the suite).

### Acceptance gates

typecheck / lint / build; `enterprise-b7-assertions.ts` proving every Owner KPI maps to a verified
field and every org-scoped surface carries an explicit scope label; Playwright
`e2e/owner-overview/` × 4 viewports; **role-boundary regression proving a Manager cannot reach any
Owner-only surface**; isolated-DB rule; `git diff --check` clean; no commit/push.

### Completion report

`ai/ENTERPRISE_B7_OWNER_COMPLETION_REPORT.md`.

---

# TRACK C — Backend + discipline gaps

One entry per **true** gap, each naming the Track B phase it unblocks. **None of these are Track B
work** — each needs a backend/seed/docs change and therefore explicit per-change authorization
under the standing rule.

| ID | Gap | What is wrong | Type | Unblocks | Size | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| **C-01** ✅ | **NG-01 / MP0-03** — fake PDF export | ~~`POST /reports/export` with `format: PDF` emits a **plain-text file stamped `application/pdf`** at `status: READY` (`reports.service.ts:2056` → `generateTextPdf`).~~ **DONE 2026-08-20 (backend gap batch 1).** `format: PDF` now returns **501** with an honest message before any artifact row is created; `generateTextPdf` is deleted; all 37 catalog entries advertise `['CSV']` only. CSV verified unchanged. **No renderer was added — OD-10 still open.** | Backend | **B4** PDF export | S (withhold) / M (real renderer) | **1 — trust-destroying** |
| **C-02** ✅ | **NG-02 / MP0-01** — compensation leak | ~~`GET /hr/employees` returns full `compensationProfile` on **all 40 rows**; `/:id` adds `contracts[].salaryAmount`, `dateOfBirth`, `address`, HR `notes`.~~ **DONE 2026-08-20 (backend gap batch 1).** The default payload is a safe projection whose sensitive columns are **not selected from Postgres** (list, detail, write echoes, and the employee embedded in `/hr/contracts`); the historical payload survives behind `?view=full`, gated by the existing `pos:hr:compensation:read`. ✅ **FU-1 RESOLVED 2026-08-20 (permissions cutover):** `pos:hr:compensation:read` was **revoked from Manager** (Owner + Accountant keep it), so a Manager token now gets **403** on `?view=full` and on `/hr/compensation-profiles` — verified live. The default wire payload is safe for every role, which is what B3 needed. | Mixed | 🟢 **B3** Staff directory — **unblocked** | S (client projection) / M (backend projection) | **2** |
| **C-03** | **NG-06 / MP0-08** — no report rows | `GET /reports/:id` returns `summary` + `rowCount` only. **A pivot/graph clone is a backend gap, not a UI gap.** | Backend | **B4** graph + pivot | S (accept summary) / L (row payload) | 5 |
| **C-04** | **NG-14 / MP0-07** — SSE unusable from the browser | `/api/stream/metrics` requires `Authorization` **and** `X-Branch-Id`; `EventSource` supports neither; `apps/web` has **no SSE client at all**. 15s interval verified. | UI infra | **B2** live mode (degrades to polling) | M | 6 |
| **C-05** ✅ | **NG-09 / MP0-14 + MP0-15** — plaintext credential | `POST /hr/frontline-staff/onboard` returns a plaintext `quickPin.pin`; `issueQuickPin` defaults **true**; the DTO accepts `contractId` + `compensationProfileId`. | Discipline (+ backend hardening) | **HANDLED IN B3 (2026-08-20)** as discipline: the PIN is masked, copy-once, never cached/logged/persisted/URL-encoded; `issueQuickPin: true` is sent EXPLICITLY rather than inherited; the form structurally cannot carry `contractId`/`compensationProfileId`. ⚠️ The BACKEND still returns the plaintext PIN — that hardening is untouched and still open | S | 3 |
| **C-06** | **NG-04** — stale module docs | `docs/MODULES.md` marks Accounting (COA/GL/AP/AR) and Budgets **"⬜ Planned"** though the controllers exist and are wired. Causes systematic under-scoping. | Docs | **B0 / B5** planning | S | **4 — cheapest fix here** |
| **C-07** | **F-C3-2 / M7** — closed-order payment hole | `POST /api/payments/manual-reference` accepts a payment on an **already-CLOSED** order (only `VOIDED` refused) → overpayment with no close event. Verified: closed 122,700 bill accepted a further `CARD:1,000` (201) → `totalPaid 123,700`. | Backend | Cashier C4/C6 correctness; Manager Operations order truth | S | 7 |
| **C-08** | **F-C3-4** — reservation auto-complete misses the cashier path | Auto-completion lives in `OrdersService.transitionOrder`, but `PaymentsService.closeOrderWithPayment` sets `status: CLOSED` directly, so it never fires on a cashier close. | Backend | Cashier C4/C6; Manager reservations snapshot accuracy | S | 8 |
| **C-09** | **NG-18 / MP0-06** — `/hr/employees` has no branch filter | Org-scoped; `?branchId=` → **400** (re-confirmed live in B3; the payload spans **5 branches**). | Backend (small) | **MITIGATED IN B3, not fixed**: the directory reads the org with an explicit bound, narrows to the branch in the browser, **says so on screen**, and offers an explicit whole-organization view. A server-side filter is still the real fix | S | 9 |
| **C-10** | **NG-13 / MP0-04** — no branch update route | `PATCH /api/branches/:id` **does not exist** (404) — no update route of any method. | Backend | **B6** branch profile (ships read-only meanwhile) | S | 10 |
| **C-11** | **NG-07** — no financial statements | Balance Sheet / P&L / Cash Flow / Trial Balance / General Ledger / Partner Ledger are **not** among the 24 generators; only AP/AR `aging` exists. | Backend | **B5.5** reporting depth | L | Defer |
| **C-12** | **NG-20 / MP0-11** — unbounded pagination | No `@Max`, no clamp on `/pos/orders`, `/reports`, `/hr/employees`. Client must always send an explicit bound. | Backend (small) | B3, B4, B5 hygiene | S | 11 |
| **C-13** | Seed/demo-data truth | Rebrand QA found the advertised waiter Quick PIN **246810** unusable for `waiter@nimbus.demo`, **although the mapping exists** (`packages/db/prisma/demo-import.ts:158`) and the docs advertise it (`demo-data/DEMO_LOGIN_CREDENTIALS.md`, `WAITER_UI_DEMO_SCRIPT.md`). Root cause undiagnosed — the PIN lookup hash is **branch-derived** (`derivePinLookupHash(pepper, branchId, pin)`), which is the first place to look. Manager PIN `11223344` **is** real and verified. Note `seed.ts`'s own `DEMO_QUICK_PINS` covers only `*@demo.local` accounts, not the `*@nimbus.demo` demo-import set. | Seed/docs | QA reliability across every track | S | 12 |
| **C-14** | **MP0-13** — read permission on a write route | `POST /reports/export` is gated by `pos:reports:exports:read` (`reports.controller.ts:609`). Guard defect; no Manager impact today. | Backend | — | S | 13 |
| **C-15** | **NG-11** — no saved views/filters | No saved-view/filter concept anywhere in the API. Odoo's `Favorites → Save current search` has no counterpart. | Backend | **B1** Favorites column (else localStorage-only) | M | Defer / **OD-7** |
| **C-16** | **NG-08** — credential admin absent | No password concept for frontline staff, no `Send Password Reset Instructions`, no 2FA admin, no API keys/passkeys, **no per-user session revocation** (`/api/devices` is a hardware registry). No invite-by-email, no `Invited ▸ Confirmed` lifecycle. | Backend | **B3 shipped the honest subset**: the C12 table carries only Quick-PIN status/reset/disable/enable, and the absent capabilities are **omitted, not greyed out**; the employee statusbar uses the REAL `EmployeeStatus` lifecycle instead of Odoo's borrowed `Invited ▸ Confirmed`. The full table still needs the backend | L | Defer |
| **C-17** | **NG-17** — no tax-return document | Nimbus has `tax-config` + `periods/:id/close\|lock` + `period-close-runs` but **no return object**. | Backend | **B5.4** ships the honest period-close analogue instead | M | Defer |
| **C-18** | **NG-19** — assets / loans / deferrals | Assets, Loans, Deferred Revenue/Expense, Unrealized Currencies — none exist. | Backend | — | L | **Defer — out of scope for a hospitality POS** |
| **C-19** ✅ | `hr` module surface | `POST/GET /api/hr/positions` and `/api/hr/compensation-profiles` exist and are **compensation-adjacent** — they fall under the locked exclusion. Recorded so nobody re-discovers them as "missing features". | Docs/discipline | **DONE in B3**: neither is called. The directory's position facets are derived from the `position` object already embedded in the safe employee payload (verified salary-free against the Prisma model), so no extra request and no excluded endpoint | S | Record only |
| **C-21** ✅ | **Accounting/AP/AR/Budget permissions were never seeded** | ~~Guarded by 23 permission strings with zero rows; 38 routes 403 for everyone including Owner.~~ **DONE 2026-08-20 (permissions cutover).** ⚠️ The original count was an **undercount**: it was a prefix check, not a string check. `bank-rec` references **11** `pos:accounting:*` strings that share the prefix with the seeded M28/M29 rows but are themselves absent (all 6 of its GET routes were 403 for Owner, measured live), and `budget` references two strings outside the `finance:` prefix. **The real gap was 36 strings over 56 routes.** All 36 are now seeded — **Owner FULL · Accountant FULL · Manager READ-ONLY (15) · nobody else** (the OD-9 resolution). Seed idempotence proven three ways; AP+AR e2e went **69 failed → 1 failed**. See `ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md`. 🔴 **Shared-Neon deploy still gated.** | Seed + permissions | ~~**B5**~~ **cleared** — B5 now gated on the B0 verdict instead | S (seed) but needs a shared-Neon cutover gate | **DONE** |
| **C-20** | **F-C3-1** — order-number collision 500 | `OrdersService.generateOrderNumber` (`orders.service.ts:67`) parses `/ORD-(\d+)/`; a branch-prefixed demo number (`ORD-TAPAS_DOWNTOWN-00374`) does not match, the sequence resets to `ORD-000001`, and the unique constraint fires. Breaks QA fixtures. | Backend | QA fixtures for every track | S | 14 |
| **C-22** | **37 further guard permissions have no seeded row** | Discovered by B0 while verifying C-21. `franchise:*` (12), `ops:*` (8), `dev:*` (5), `merchant:*` (4), `billing:*` (3), `onboarding:*` (2), `support:*` (2) are referenced by `@Permissions(...)` guards but have **zero rows** in the `permissions` table, so franchise, ops-portal, developer-portal and owner-SaaS-billing are **403 for every role including Owner** — exactly the state accounting was in before the cutover. **Deliberately NOT seeded**: every one of those modules is deferred (`docs/KNOWN_LIMITATIONS.md`), and seeding a permission for a surface nobody may build yet only widens the blast radius of a shared-Neon deploy. ⚠️ **B7 (and any developer-portal or franchise work) MUST budget the same cutover** — a permission/seed change plus a shared-Neon gate — before designing against those routes. Do **not** re-derive the gap with a prefix match; that is precisely how C-21's count came out as 23 instead of 36. | Seed + permissions | **B7** (+ any franchise / dev-portal / SaaS-billing phase) | S (seed) but needs a shared-Neon cutover gate | Recorded, **not implemented** |
| **C-23** | **M33 GL Postman collection cannot run** | Found by backend gap batch 2 (2026-08-21). `M33-General-Ledger-Journals-Posting-Engine` sends a literal `{{accountId}}` — the variable is never resolved, so `POST /api/accounting/journals` returns **400 `"Account {{accountId}} not found or inactive"`** and cascades into 20 failed assertions over 18 requests. It needs the **R17** folder-level upstream resolution (list `/accounting/accounts`, capture the first active id) that the other accounting collections already carry. Proven **pre-existing**: identical 20/42 failure set at `bcbabd9` on a from-scratch database, so it is a collection defect, not a product one. B0 never ran M33. | Postman | **B5.4** (journals surface — corrected 2026-08-21; the sub-phase renumber moved journals from B5.3 to B5.4 and this row was not updated at the time) | S | Recorded, **not implemented** |
| **C-24** ✅ | **B5.1 accounting read-integrity findings — B5-F1…F4** | Surfaced by Track B5.1 once the dashboard actually consumed these routes (2026-08-21). **B5-F1** 🔴 `ar/aging.summary` aggregated only the RETURNED PAGE, not the whole `where` — a bounded read understated the branch receivable balance (`?take=1` → 599,800 vs a true 9,106,400). **B5-F2** 🔴 `ar/invoices?status=<invalid>` → 500 (unvalidated raw string), plus five sibling routes with the same pattern. **B5-F3** ⚠️ no server maximum on `take` for fourteen paginated accounting/finance list routes — B0's own probe methodology, not the routes, was the original defect (it combined `take`+`pageSize`+`limit` and misread the resulting 400 as a bound). **B5-F4** ⚠️ `GET /api/audit/timeline` ignored `X-Branch-Id`. **DONE 2026-08-21 (backend gap batch 3).** `summary` now reduces from a separate unpaginated query (proven page-size independent live on a 125-invoice/10,306,400 dataset — a `take=1` page would previously have shown 10,000); six routes gained `@IsEnum` validation; a shared `@Max(100)` + `clampTake()` bound now applies to all fourteen paginated routes; `audit/timeline` now scopes to `X-Branch-Id` by default. No schema/migration/seed/permission change. Zero regressions: full API e2e (1043 tests) and full unit suite produced **identical failing test-name sets** before/after on equally clean isolated databases. See `ai/BACKEND_GAP_BATCH3_COMPLETION_REPORT.md`. | Backend + frontend (minimal) | **B5.2** unblocked on read integrity | S–M | **DONE** |

## Track C-P — Cashier reconstruction (independent, parallel, unchanged scope)

Carried forward from `docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md` **verbatim**. This
roadmap does **not** change Cashier scope, sequencing, or gates.

| Phase | Scope (unchanged) | Status |
| --- | --- | --- |
| **C4** | Receipt preview + actions into the selected workspace; initial print, reprint, verified delivery channels; receipt/order lookup through Find bill; eligible refund workflow from closed-order/receipt context; redirect legacy `/cashier/receipts`; remove the Receipts page **only after** reference + executable QA gates. | ⏭️ **NEXT — not started, gated on explicit authorization** |
| **C5** | Queue retirement + Find bill completion (takeaway, tableless, direct reference, partially-paid, failed/pending payment, closed order); redirect legacy `/cashier/queue`; prove no Floor+Queue duplicate request pattern remains. | Not started |
| **C6** | Integrated live QA, cross-role regression, Cashier closure — continuous journey on fail-closed disposable infrastructure, four viewports, shared-Floor parity, Waiter/Supervisor regression, boundary verification, final demo script + evidence index + completion report, shared Neon proven unchanged. | Not started |

**Cross-track note:** Cashier C4 and Track B1 both touch `components/pos-shell/*`. **Coordinate
before editing shared files** and re-run the cross-role regression in whichever phase lands second.
Findings **C-07** and **C-08** are natural C4/C6 inputs. Rebrand finding **(e)** (untruthful
zero-bill copy) and **F-C3-6** (readiness badge copy) belong to C4 and C5/C6 respectively.

---

# 4. Sequencing / dependency diagram

```text
                        ┌──────────────────────────────────────────────────────────┐
   TRACK A (polish)     │  A0 shipped 2026-08-20 ──▶ A1 remaining polish debt (S)   │
                        │      (A1-1 floor toolbar; A1-2/3 are Cashier-owned)        │
                        └───────────────┬──────────────────────────────────────────┘
                                        │ shares pos-shell/* + floor/* — coordinate
                                        ▼
   TRACK B (suite)   B0 API verification (M, docs only) ─────────┐
                        ║ parallel, no shared-file contact       │
                        ▼                                        │
                     B1 TOP-NAV SHELL (L)  ◀── supersedes M-P1 bottom nav (D2)
                        │  control panel · search/filters · breadcrumb · pager
       ┌────────────────┼───────────────┬───────────────┬────────┴────────┐
       ▼                ▼               ▼               ▼                 ▼
   B2 Overview ✅   B3 Ops+Staff ✅   B4 Reports ✅   B6 Settings (M)  [B5 waits on B0]
       │                │               │               │
       │ live mode      │ directory     │ graph/pivot   │ settings routes
       │ ◀── C-04       │ ✅◀── C-02    │ 🔴◀── C-03    │ ◀── B0
       │                │               │
       ▼                ▼               │
   B7 Owner (M) ◀───────┘               │
       ▲                                │
       └──── B0 (franchise routes) ─────┘

                     B5 ACCOUNTING (L) 🔴 requires B0 go + B1 (+ B3 primitives)
                        B5.1 Customers+Vendors ─▶ B5.2 Bank rec
                                │                     │
                                ├─▶ B5.3 Core+Review ─┴─▶ B5.4 Closing
                                └─▶ B5.5 Reporting+Config ──▶ B5.6 Dashboard

   TRACK C (gaps)    C-01 ✅DONE   C-02 ✅DONE   C-03 ▶B4   C-04 ▶B2   C-05 ✅B3(discipline)   B0 ✅DONE
                     C-06 ▶B0/B5   C-09 ~B3(mitigated)   C-10 ▶B6   C-15 ▶B1   C-21 ✅DONE
                     C-07/C-08/C-20 ▶ Cashier C4/C6 · C-11/16/17/18 deferred

   TRACK C-P         Cashier C4 ──▶ C5 ──▶ C6   (independent, unchanged, parallel)
                        ▲ shares pos-shell/* with B1 — coordinate
```

**Critical path to an Odoo-grade suite:** ~~`B1 → B3`~~ **both complete 2026-08-20** → `B5.1`
(with `B0` running alongside). B3 also delivered the list/form/statusbar/cog primitives B5 was to reuse.
**Hard blocks:** ~~`C-02` → B3 Staff directory~~ **cleared** · ~~`B0 go` → B5~~ **answered 🟡 CONDITIONAL** · `C-03` → B4
graph/pivot · **`C-21` (unseeded `accounting:*` / `finance:*` permissions) → B5, which must budget a
permission/seed cutover before any AP/AR/Budget UI**.
**Soft blocks (degrade honestly):** `C-04` → B2 live mode (polls instead) · ~~`C-01` → B4 PDF~~
**resolved: PDF returns 501, B4 ships CSV-only by contract** · `C-15` → B1 Favorites
(localStorage-only or absent).

---

# 5. Track / phase summary table

| Track | Phase | One-line scope | Size | Gates / blockers |
| --- | --- | --- | --- | --- |
| A | **A0** | Density, fullscreen login, terminal identity, short labels | — | **DONE 2026-08-20** — record only |
| A | **A1** | Remaining polish debt: **floor-toolbar wrap at 1024** is the only item this track owns; the cashier copy items belong to C4/C5-C6 and the waiter PIN to C-13. Token contrast, role accents, jargon leak and the Inter bundle are **already fixed** | **S** | Shared-file coordination with B1 + Cashier C4 |
| B | **B0** | M-P0-style live verification of the ~90 accounting/finance routes + settings/alerts/sync/audit/analytics | **M** | ✅ **COMPLETE (2026-08-20)**, folded into the permissions cutover; **verdict upgraded 🟡 → 🟢 GO on 2026-08-21** by backend gap batch 2. 112 routes reconciled against the Nest route map; 75-route accounting block verified live across 4 roles; **25 live writes** incl. a reconciliation to `COMPLETED` and a period `DRAFT→OPEN→CLOSED→LOCKED`; 17 B6 GET routes verified. **Verdict: 🟡 CONDITIONAL GO for B5** → `ai/ACCOUNTING_API_VERIFICATION_REPORT.md`. Findings **PC-01…PC-07** + **C-22** |
| B | **B1** | Manager **top-nav shell**: module bar, click dropdowns, control panel, chip search, pager, view switcher, breadcrumb | **L** | ✅ **COMPLETE (2026-08-20).** Blocks B2–B7 (still gated on their own owner go). Shared-shell variant, frontline unchanged |
| B | **B2** | Manager Overview — Odoo C10 KPI card grid over `/dash/*`, truthful checklists, degraded stream | **M** | ✅ **COMPLETE (2026-08-20).** 8 cards, 9 bounded reads, polled (C-04 still open). Blocks nothing; B3–B7 stay gated |
| B | **B3** | Operations (read-only lists/forms/floor) + Staff (kanban directory, onboarding, Quick-PIN table, leave & swap review) | **L** | ✅ **COMPLETE (2026-08-20).** 8 surfaces, 7 allow-listed mutations, 0 `view=full`, 0 roster writes. Shift-swap = **Outcome C** (reject only, roster integrity proven live). Chatter **still gated on B0** and NOT built; exceptions + attendance **deferred with reasons**. FU-3 carried — **and a defect it understated (B3-D1) found and fixed**. Blocks nothing; B4–B7 stay gated |
| B | **B4** | Reports — catalog, one generic generate form, history, summary detail, **CSV-only** export | **M** | ✅ **COMPLETE (2026-08-20).** 37-entry catalog driven by the API's own status (24/1/12), one DTO-correct generate form, server-paginated persisted history, summary detail + real CSV. **No PDF affordance** (C-01 501 re-verified live); **graph/pivot NOT built and NOT advertised** — C-03 still open. Found + fixed **B4-D1** (duplicate catalog query) and recorded **B4-F2** (`grossSales` means tax-inclusive at summary level but ex-tax inside `topItems`/`categories`). Blocks nothing; B5–B7 stay gated |
| B | **B5** | Accounting suite over ~90 endpoints — 7-menu tree, sub-phased B5.1…B5.6 | **L** | 🟢 **GO (2026-08-21)**. **B5.1 ✅ COMPLETE (2026-08-21)** — Accounting is the seventh top-nav module (OD-3 approved), a 24-row grouped menu tree with 1 live link and 23 phase-tagged not-yet rows, and a 5-card dashboard over live-verified reads; **read-only by permission — no write affordance renders, not even disabled** (PC-01/PC-02 re-verified live). ⚠️ **Sub-phases renumbered**: the dashboard moved from B5.6 to B5.1 and everything else shifted by one. ✅ **C-24 — B5-F1…F4 all FIXED (backend gap batch 3, 2026-08-21)**: `ar/aging.summary` is now correct regardless of page size (proven live on a 125-invoice dataset), `ar/invoices?status=<invalid>` and five sibling routes now 400 instead of 500, all fourteen paginated accounting/finance list routes now reject `take` above 100, and `audit/timeline` now scopes to `X-Branch-Id`. Two 🟡 **design decisions** still stand: **PC-06** (10 bare-array lists — B5.1 ships them client-counted and labelled *"Showing all N"*; **never fabricate a total from `array.length`**) and **PC-01/PC-02** (Manager holds **no** accounting write). ⚠️ **C-23**: the M33 GL collection cannot run, so B5.4's journals surface has no Postman verification. Still no financial statements (NG-07 → C-11). **B5.2 ✅ COMPLETE (2026-08-21)** — nine Customers/Vendors list surfaces (four with a detail view) plus the two Aged receivable/payable reports pulled forward from B5.6, all still READ-ONLY BY PERMISSION with the same no-write-affordance guard extended over the new tree. One live-QA-caught frontend bug (a route-registry `:id`-placeholder path double-appended, 404ing every invoice/account/bill detail) found and fixed in this phase — see the completion report. **B5.3 ✅ COMPLETE (2026-08-21)** — Bank accounts (list-only), Bank statements (list+detail) and Reconciliation (list+detail) shipped READ-ONLY, fixtures created live via the API since the demo dataset carries zero bank rows by default; the B5.1 Bank dashboard card's three KPIs are now real links. One stale B5.1 type field (`BankAccountRow.currentBalance`, which does not exist on the schema) found and fixed in this phase — see the completion report. **B5.4…B5.6 are NOT STARTED — each needs explicit owner authorisation** |
| B | **B6** | Settings — C11 two-pane: branch (read-only), devices, printers (metadata), terminals (stub), alerts (rules read-only), sync (no diff), org settings | **M** | B1 + B0. Branch read-only per **C-10** |
| B | **B7** | Owner dashboard variant — same shell, wider scope, explicit org-vs-branch scope labels | **M** | B1, B2, B0. Needs **OD-1** |
| C | **C-01…C-24** | Backend + discipline gaps, each naming the phase it unblocks | S–L | Each needs explicit per-change authorization. **C-01 + C-02 DONE 2026-08-20** (backend gap batch 1); **C-21 + FU-1 + B3-F1 DONE 2026-08-20** (permissions cutover — `ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md`); **PC-03 + PC-04 DONE 2026-08-21** (backend gap batch 2 — `ai/BACKEND_GAP_BATCH2_COMPLETION_REPORT.md`); **C-24 (B5-F1…F4) DONE 2026-08-21** (backend gap batch 3 — `ai/BACKEND_GAP_BATCH3_COMPLETION_REPORT.md`); **C-22** — 37 further guard permissions (franchise/ops/dev/billing/merchant/onboarding/support) still have no seeded row, so those deferred surfaces are 403 for every role, and **B7 must budget the same cutover**; **C-23** — the M33 GL Postman collection cannot run (unresolved `{{accountId}}`), proven pre-existing |
| C-P | **C4 → C6** | Cashier receipts/refunds → Queue retirement → closure QA | — | Unchanged scope; **C4 gated on explicit authorization** |

---

# 6. Next three prompts to run

> **B1 is complete** (2026-08-20) — see `ai/ENTERPRISE_B1_TOPNAV_COMPLETION_REPORT.md`. None of the
> remaining prompts below may start without the owner's explicit go for that specific prompt.

### 1. **B1 — Manager top-nav shell conversion** ✅ COMPLETE (2026-08-20)

Converted Manager navigation from the M-P1 bottom nav to the Odoo-style top module bar, and built the
reusable primitives every later phase depends on: the module bar with click-to-open grouped
dropdowns, the control-panel row (`New` + title + cog + chip search + server pager + view switcher),
the three-column search/filter dropdown, and the breadcrumb + record pager. The branch switcher,
session guard, idle handling and surface allow-list carried forward from M-P1 **unchanged**.
Delivered as an **additive variant of the shared `OperationalShell`**, not a Manager fork — Waiter,
Cashier and Supervisor were verified live to render byte-identically. The six existing menus ship
honest not-yet states; **no live data, no writes**. Full cross-role regression + keyboard traversal
executed live on an isolated stack. **Size L.** See the completion report for the full checklist,
the OD-4 breakpoint deviation, and what remains deliberately unmounted (search/filter menu,
breadcrumbs, and the control panel's non-title slots).

### 2. **B0 — API verification extension (M-P0 pass #2)** *(can run in parallel — docs only)*

Run an M-P0-style live verification over the ~90 claimed-but-unverified accounting/finance routes
(AP, AR, bank-rec, budget, accounting foundation, GL) and then the settings, alerts, sync,
audit-timeline and analytics controllers: route, method, exact `@Permissions` string, branch-vs-org
scoping, live HTTP code, real response shape, and **whether the Manager JWT actually holds each
permission** (the accounting/GL guides' role tables have never been re-verified). Probe the honest
failure modes B5 must render. Produce a `Verified (B0, …)` column on the matrix addendum, a `BV-*`
finding table, and an explicit **go / no-go for B5**. **Isolated disposable stack only.**
**Size M. No runtime code.**

### 3. **B2 — Manager Overview dashboard** ✅ COMPLETE (2026-08-20)

Build the Odoo-style KPI card grid over the verified `/dash/*` reads: three columns of bordered
cards with a coloured accent bar, **counts as drill-in links and amounts as plain data**,
mixed-weight action buttons, and a card that is allowed to have no chart or a truthful readiness
checklist instead. Bind every card to a verified field; use `/dash/manager.openOrders` for the open
count; never label a bare Gross/Net; filter approval counts by branch before display; tills and
shifts are counts only. Ship polled with a truthful degraded-stream state unless **C-04** has landed
an authenticated SSE reader. **Size M.** — *Delivered exactly as specified. Eight cards; the revenue
trend was proven impossible (no bucketed series; `/dash/snapshots` needs `pos:dash:owner:read`, which
Manager does not hold) so the money cards ship chartless, and the payment-mix ring plus the
open-order aging bars are both derived from rows the endpoints actually return. See
`ai/ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md`.*

### 4. **B3 — Operations + Staff** ✅ COMPLETE (2026-08-20)

Delivered as `ai/ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md` (+
`ai/ENTERPRISE_B3_QA_EVIDENCE_INDEX.md`). Eight surfaces across two modules, built on the B1 chrome
primitives — which B3 is the first phase to actually MOUNT (`ManagerSearchFilterMenu`,
`ManagerBreadcrumbs`), alongside four new ones (C4 list, C14 statusbar, view switcher, C13 record
cog).

The report resolves the two things the roadmap required it to state explicitly:

- **"Read-only Operations" vs "escalations live in Operations"** — Operations ships strictly
  read-only and **no escalation write was built**, because the roadmap's own precondition (a verified
  domain DTO) was unmet, and because a read-only escalation *list* has no honest source
  (`/api/approvals` is only partly branch-scoped, MP0-05; discounts have no branch-wide list,
  SUP-RG-035).
- **Shift-swap outcome** — **Outcome C, reject only.** Proven live, not asserted: a real rejection
  changed **0** of 3 `schedule_assignment` rows.

⚠️ **This phase also found and fixed a live defect FU-3 understated (B3-D1):** backend gap batch 1
*inverted* the meaning of `grossSales`/`netSales`, so B2's Overview was rendering the ex-tax figure
under the label "Sales today (tax-inclusive)". The KPI bindings are re-pointed and pinned by an
assertion. See the report §3.

### 5. **B4 — Reporting** *(✅ COMPLETE 2026-08-20 — `ai/ENTERPRISE_B4_REPORTS_COMPLETION_REPORT.md`)*

Shipped as a two-surface module (`/manager/reports/catalog`, `/manager/reports/runs`) with the module
root redirecting, exactly as B3 converted Operations and Staff. Every acceptance gate in §B4 above was
met: the generate payload matches the verified uniform DTO (MP0-16, re-verified live on all 24
routes), **no code path synthesizes a file client-side**, **no PDF option is reachable**, no row table
is derived from `/reports/:id`, every history list sends a bounded page size, and a run's own
`branchId` is displayed and enforced (MP0-12).

**Graph and pivot stayed gated on C-03 and are not advertised** — no menu row, no view switcher entry.
B4-F3 records the nuance that 16 of 24 summaries embed a real breakdown array (which the CSV is built
from, and which B4 renders), but there is still no per-order row payload, so **C-03 does not move**.

**B0 is COMPLETE (2026-08-20) and C-21 is DONE — the permissions cutover shipped both.** The next
runtime phases are **B5 (Accounting)** and **B6 (Settings)**. Neither is started. B5 now carries a
**🟡 CONDITIONAL GO** rather than a hard block: see `ai/ACCOUNTING_API_VERIFICATION_REPORT.md` §9 for
the conditions (**PC-03** cross-branch leakage and **PC-04** duplicate vendor bills are blocking).

---

# 7. Open owner decisions

Each carries a recommendation. **OD-4 and OD-5 are ANSWERED** (B1, 2026-08-20) — see the outcome
column. The rest remain open.

| ID | Question | Recommendation | Outcome |
| --- | --- | --- | --- |
| **OD-1** | **Does Owner reuse the manager suite with wider scope, or get its own application?** | **Reuse.** One suite, one shell, one set of primitives; Owner is a **scope variant** — a wider dashboard (`/dash/owner` + franchise rollups) and additional menus, gated by the same surface allow-list mechanism. A second application would double the maintenance of every primitive built in B1 and would fork the shell the whole architecture forbids. Ship as **B7**. | Open |
| **OD-2** | **Does the accounting UI live under Manager, or wait for a future Accountant role?** | **Build it under Manager now, designed to be remounted.** The endpoints exist today and Manager provably holds most of the reads; waiting for a role that does not exist delays the single biggest capability unlock. Build B5 as a **self-contained module** (`components/manager/accounting/*` + `lib/accounting/*`) with **no Manager-specific coupling**, so an Accountant role later mounts the same module behind its own allow-list. **Write** surfaces stay gated on B0 proving the permission is actually held. | Open |
| **OD-3** | **Does Accounting become a seventh top-nav menu for Manager?** | **Yes** — as a top-level module entry alongside the six M-P1 surfaces. Record explicitly that the locked "exactly six tabs, no More tab" decision applied to the **bottom nav** presentation, which D2 supersedes; it was never a statement about how many *modules* Manager may reach. If the owner prefers, Accounting can instead sit behind a module launcher — but do **not** hide it inside Reports. | **ANSWERED as recommended, 2026-08-21.** Accounting shipped as the seventh top-level module in **B5.1**, inserted before Settings. The M-P1 "exactly six tabs" lock is recorded as a statement about the **bottom-nav presentation** that D-MGRTOPNAV superseded, never a cap on modules. Five assertions that pinned Accounting's absence were **inverted, not deleted**, each naming OD-3 and the date. |
| **OD-4** | **What happens to the top nav below desktop width?** *(B1 must answer)* | Collapse the module bar to a **single menu control** at the same left position, opening the full menu tree as a panel. **Do not** fall back to the frontline bottom nav — that reintroduces exactly what D2 supersedes, and Manager's tree is bigger than six items. Suggested breakpoint: the existing 1024 project boundary. | **Answered, with a deviation.** Collapse breakpoint is Tailwind `xl` (1280px), not `lg`/1024 as suggested — measured, the full bar (brand + six menus + branch switcher + clock + identity) does not reliably fit at 1024×768, so that project gets the collapsed control too. Never falls back to the frontline bottom nav (verified live). |
| **OD-5** | **Additive shell variant, or a separate management shell?** *(B1 must answer)* | **Additive variant of `OperationalShell`** (`navigation="top" \| "bottom"`, default `bottom`). It keeps one layout, one idle handler, one guard pattern and one density system, and it keeps Manager as the fourth *consumer* rather than a fork. Fall back to a separate `ManagementShell` **only if** B1 finds the shared component genuinely cannot absorb the variant — and record that finding explicitly rather than forking quietly. | **Answered as recommended.** The shared shell absorbed the variant cleanly; no `ManagementShell` fork was needed. |
| **OD-6** | **Do Manager approvals move to the generic `POST /api/approvals/:id/decide` now that the top nav has room for an inbox?** | **No — keep Option B.** Manager *does* hold `approvals:read` + `approvals:decide` (seed 974/975), so this is a product/safety choice, not a permission block. Domain routes preserve per-domain DTOs, per-domain audit and the Supervisor precedent. Use the generic endpoint for **reads and counts only**, and keep the branch-filtering discipline (MP0-05). |
| **OD-7** | **Odoo's `Favorites → Save current search` — build it, fake it, or omit it?** | **Ship localStorage-only, explicitly labelled "saved on this terminal only"**, or omit the Favorites column entirely. Nimbus has **no saved-view concept in the API** (NG-11). A server-looking "saved filter" that lives in one browser is exactly the kind of soft untruth the standing rules forbid — the label is what makes it honest. A real implementation is **C-15**, deferred. |
| **OD-8** | **Is the floor-toolbar wrap at 1024×768 (A1-1) worth fixing before B1, or folded into it?** | **Fix it standalone, first.** It is a **shared** `floor/` component touched by Waiter, Cashier, Supervisor and Manager, and both B1 and Cashier C4 will be editing neighbouring shared files. Landing a small, independently-regressed layout fix before either lands avoids attributing a Floor regression to the top-nav conversion. *(This slot previously asked about status-token contrast and role accents — both were fixed and owner-approved on 2026-08-20; see the Track A "already fixed" table.)* |
| **OD-9** | **How much accounting *write* does Manager get?** | **Read-first.** The accounting/GL guides claim Manager holds `journals:read` / `posting-runs:read` / `posting-errors:read` but **not** `journals:create`, `journals:reverse` or `posting:replay` — and those tables were never verified. Let **B0** settle it. Ship reads plus the operationally-necessary writes (AP bill approve, reconciliation match/skip/complete, period close/lock, budget update-actuals) **only where B0 proves the permission is held**. |
| **OD-10** | **Is a real PDF renderer worth backend work (C-01)?** | **Not yet — but delete the fake now.** The immediate requirement is that `format: PDF` stops returning a plain-text file at `status: READY`; CSV covers the actual manager need. Schedule the renderer only if the owner has a concrete external requirement (auditor, bank, franchise reporting) — otherwise it is a large cost for a format nobody has asked to *receive*. |
| **OD-11** | **Is report row data (C-03) worth backend work?** | **Yes, but scoped.** Pivot/graph is a marquee Odoo capability and it is *impossible* without rows. Rather than a generic row payload across all 24 generators, pick the **3–5 highest-value generators** and add a bounded, grouped row read. That converts NG-06 from L to M and unlocks a real B4 graph/pivot on the reports managers actually run. |

---

# 8. Expected artifacts per phase

Every Track B phase must produce:

- a focused completion report from `ai/AI_COMPLETION_REPORT_TEMPLATE.md`;
- updated `ai/AI_STATUS.md`, `PROGRESS.md`, and `repo file tree.txt` if structure changed;
- focused assertion scripts and Playwright specs (four viewport projects);
- an honest QA evidence index — failures reported with command + exact output per
  `ai/AI_ERROR_PROTOCOL.md`;
- the **next** prompt spec, written only after the current gate passes;
- an explicit statement of **what was deliberately not cloned from the Odoo reference, and why**.

# 9. Reference set

- **Research:** `ai/ODOO_REFERENCE_RESEARCH.md` (+ `ai/odoo-reference-screenshots/`, 17 files)
- **Gap analysis:** `ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md` (NG-01…NG-20)
- **Verification:** `ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md` (MP0-01…MP0-18) ·
  `docs/manager-ui-docs/MANAGER_API_MATRIX.md` (62 verified rows + the 2026-08-20 addendum)
- **Superseded-from-M-P2:** `ai/MANAGER_RECONSTRUCTION_ROADMAP.md` (M-P0/M-P1 history intact)
- **Shipped foundation:** `ai/MANAGER_P1_SHELL_COMPLETION_REPORT.md`
- **Parallel track:** `docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md` (C4→C6)
- **Decisions:** `docs/DECISIONS.md` · **UI system:** `docs/UI_SYSTEM.md` ·
  **Brand:** `docs/BRAND_IDENTITY.md` · **QA:** `docs/TESTING_AND_QA.md` ·
  **Limitations:** `docs/KNOWN_LIMITATIONS.md`
