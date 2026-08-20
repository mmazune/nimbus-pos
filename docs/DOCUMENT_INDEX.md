# DOCUMENT_INDEX.md — Nimbus POS documentation catalog & provenance

> Classifies every important document as **canonical**, **supporting**,
> **legacy/superseded**, **duplicate**, or **generated evidence**, and records
> supersession relationships. When docs conflict, the local **worktree code** and
> the top-of-file "Current State" in `ai/AI_STATUS.md` win.
> Last compiled: 2026-07-26. Updated 2026-08-20 — audited + live-verified the canonical
> `docs/supervisor-ui-docs/` set (8 files): `SUPERVISOR_API_MATRIX.md` gained a Verified column
> and a corrected quick-pin path (`/api/auth/quick-pin-login`, not `/api/auth/quick-pin/login`);
> `README.md` gained the Aug-2026 rebrand note; dated staleness corrections were added to the
> other six. Also 2026-08-20 — `docs/UI_SYSTEM.md` §9 corrected: its two "known UI
> inconsistencies" (supervisor shell omits idle-logout; waiter-namespaced idle constants) are
> both **stale**, struck through against the code. Also 2026-08-20 — added the new canonical
> `docs/waiter-ui-docs/` set (README, WAITER_LIFECYCLE, WAITER_API_MATRIX) and marked the
> Front End pack's `WAITER_LIFECYCLE.md` historical/superseded. Also 2026-08-20 — added
> canonical `docs/cashier-ui-docs/CASHIER_API_MATRIX.md` (the canonical Cashier directory had
> no API matrix) and marked the Front End pack's `CASHIER_API_MATRIX.md`
> historical/superseded by it. Also 2026-08-20 — added the **Enterprise UI push** section:
> the new canonical `ai/ENTERPRISE_UI_ROADMAP.md` (which **supersedes
> `ai/MANAGER_RECONSTRUCTION_ROADMAP.md` from M-P2 onward**) plus the two research documents it
> is built on, `ai/ODOO_REFERENCE_RESEARCH.md` and `ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md`, and the
> `ai/odoo-reference-screenshots/` evidence set.

## Legend

- **Canonical** — the current source of truth for its topic.
- **Supporting** — useful detail/design, not the top authority.
- **Legacy / superseded** — described an earlier state; kept for history. Do not
  treat as current spec. See supersession notes.
- **Duplicate** — a copy; prefer the canonical location.
- **Generated evidence** — historical build/QA output; immutable record.

## Root

| File | Class | Note |
| --- | --- | --- |
| `CLAUDE.md` | Canonical | Primary AI onboarding (start here). |
| `PROGRESS.md` | Canonical | Progress index → `ai/AI_STATUS.md`. |
| `ARCHITECTURE.md` | Canonical | Architecture index → `docs/ARCHITECTURE.md` + `docs/UI_SYSTEM.md`. |
| `AGENTS.md` | Canonical | Repo-wide governance / process. |
| `PRODUCT.md` | Canonical | Product thesis, users, design principles, a11y targets. |
| `README.md` | Canonical (backend); slightly stale on frontend status | Backend feature catalog; says frontend "deferred M43+". |
| `ROADMAP.md` | Canonical (roadmap); frontend section behind reality | BG7 complete; next M43. Role UIs already underway. |
| `repo file tree.txt` | Supporting (generated snapshot) | Drifts; still lists deleted floor components. |

## docs/ (canonical detail)

| File | Class |
| --- | --- |
| `docs/ARCHITECTURE.md` | Canonical (backend/system architecture detail) |
| `docs/UI_SYSTEM.md` | Canonical (frontend operational UI system) — new. **§9 corrected 2026-08-20:** both "known UI inconsistencies" were verified **stale** against the worktree and struck through with dated corrections — `SupervisorShell` *does* inject `OperationalIdleLogoutHandler`, and the idle constants now live in the shared `pos-shell/idle.ts` (`OPERATIONAL_IDLE_TIMEOUT_MS`). Section now has no live issues. |
| `docs/BRAND_IDENTITY.md` | Canonical (brand) — new, 2026-08-20. Source: Nimbus POS Brand Identity guide (Andimashimwe Rhoda, Aug 2026). Palette, logo system, typography, asset inventory. Supersedes every pre-Aug-2026 palette table in the `Front End/` doc packs. |
| `docs/REPOSITORY_MAP.md` | Canonical (directory ownership) — new |
| `docs/ROLE_JOURNEYS.md` | Canonical (role lifecycles index) — new |
| `docs/ROLE_CAPABILITY_MATRIX.md` | Canonical (role × page × capability × endpoint) — new |
| `docs/DECISIONS.md` | Canonical (locked/superseded product decisions) — new |
| `docs/TESTING_AND_QA.md` | Canonical (commands, demo accounts, viewport matrix) — new |
| `docs/KNOWN_LIMITATIONS.md` | Canonical (cross-role limitation index) — new |
| `docs/DOCUMENT_INDEX.md` | Canonical (this file) — new |
| `docs/API_CONVENTIONS.md`, `docs/POSTMAN_ENDPOINT_GUIDE.md` | Canonical (contract) |
| `docs/MODULES.md` | Canonical/Supporting (module map) |
| `docs/SYNC_CONTRACT.md`, `docs/M39_API_WORKFLOW_SPEC.md`, `docs/NIMBUS_POS_FOR_HMS_INTEGRATION_SPEC.md` | Canonical (domain specs) |
| `docs/*_GUIDE.md` (accounting, attendance, documents, feedback, GL, HR, payroll, reports, scheduling, staff-insights) | Canonical (backend domain guides) |

## docs/supervisor-ui-docs/ — CURRENT canonical Supervisor UI set

| File | Class | Note |
| --- | --- | --- |
| `README.md` | Canonical (current) | Reconstruction status + index; "No visible Orders tab". **Updated 2026-08-20:** carries the Aug-2026 rebrand note (palette + steering-wheel logomark → `docs/BRAND_IDENTITY.md`; no Supervisor behaviour change) and a dated correction marking the closing "Prompts 3-7 remain" paragraph as a stale Prompt-2 snapshot. |
| `SUPERVISOR_SHARED_COMPONENT_ARCHITECTURE.md` | Canonical (current) | Shared shell/Floor extraction + ownership. **Updated 2026-08-20:** dated rebrand note (header brand slot now renders `NimbusLogomark`; primitives/ownership unchanged) + a correction marking "Supervisor workspace is read-first … deferred to Prompt 3" as a stale Prompt-2 snapshot. |
| `SUPERVISOR_ICON_AND_NAVIGATION_STANDARD.md` | Canonical (current) | Four-tab nav; `/supervisor/orders` = legacy redirect. **Verified 2026-08-20 against code — accurate, no rows changed.** Two clarifications added: `Branch → Storefront` is still correct (the rebrand changed the header *brand slot* to the non-registry `NimbusLogomark`, not this registry), and the table mixes canonical `operationalIconNames` entries with role-owned action-glyph naming conventions. |
| `SUPERVISOR_LIFECYCLE.md`, `SUPERVISOR_RESERVATION_LIFECYCLE.md`, `SUPERVISOR_APPROVAL_LIFECYCLE.md` | Canonical (current) | State machines / workflow. **Verified 2026-08-20 (isolated local stack).** `SUPERVISOR_LIFECYCLE.md` — idle-logout claim confirmed **correct** (it was `docs/UI_SYSTEM.md` §9 that was wrong; corrected there). `SUPERVISOR_APPROVAL_LIFECYCLE.md` — domain-specific-approvals premise live-proven (`GET /api/approvals` → 403; all four queues 200; pagination clamps 400). `SUPERVISOR_RESERVATION_LIFECYCLE.md` — the "Completion Blocker" section is marked **RESOLVED** (endpoint + `COMPLETED` enum shipped; deployed to shared Neon in Prompt 4C), retained as a historical checklist. |
| `SUPERVISOR_API_MATRIX.md` | Canonical (current, **live-verified 2026-08-20**) | Orders APIs are for Floor-contained work, not a primary tab. **Audited + live-verified 2026-08-20** against `lib/supervisor/*.ts` + the NestJS controllers + an isolated local stack; a **Verified** column was appended to every table (waiter-matrix house style) and a dated verification banner + legend added. **Defect fixed:** the documented `POST /api/auth/quick-pin/login` does not exist (live **404**) — corrected to `POST /api/auth/quick-pin-login` (live **401** on a wrong-PIN probe), matching `docs/waiter-ui-docs/WAITER_API_MATRIX.md` §1. Rows that are permitted-but-uncalled by supervisor code are now flagged ⚠️ rather than removed. Structure preserved (append/annotate only). |
| `SUPERVISOR_GAP_REGISTER.md` | Canonical, with legacy rows | Has a supersession banner; read as historical. **Audit note added 2026-08-20** naming the specific stale rows (**:05** and **:23** = retired 5-tab nav; **:07/:08** = retired read-only `/supervisor/orders` screen) and re-confirming the two that are still accurate: **:16** (no `/api/approvals` call — live **403**) and **:19** (shift-swap create helper exists in `workforce.ts` but no component imports it). Rows deliberately not rewritten. |

## docs/cashier-ui-docs/ — CURRENT canonical Cashier UI set (locked target, 2026-07-31)

| File | Class | Note |
| --- | --- | --- |
| `README.md`, `AGENTS.md`, `CASHIER_ARCHITECTURE.md`, `CASHIER_LIFECYCLE.md`, `CASHIER_ROLE_BEHAVIOUR_MATRIX.md`, `CASHIER_COMPONENT_REUSE_MAP.md`, `CASHIER_RECONSTRUCTION_ROADMAP.md`, `CASHIER_TEST_PLAN.md` | Canonical (current, locked target — **C1+C2 implemented, C3+ pending**) | Nav = **Floor · Till · Me** (locked; **C1 landed the Floor/Till/Me nav + `/cashier/floor` default + shared-Floor consumption; C2 landed table→bill resolution + a read-only settlement workspace + Find bill — 2026-07-31**). Supersedes `Front End/cashier_ui_docs_pack/docs/cashier-ui-docs/*` wherever they conflict. Reconstruction tracked as 7 prompts C0–C6 (C0+C1+C2 complete) under `ai/CASHIER_FLOOR_RECONSTRUCTION_*`. `README.md` carries the 2026-08-20 rebrand note (no behaviour change). |
| `CASHIER_API_MATRIX.md` | **Canonical (cashier) — new, 2026-08-20** | Every endpoint the Cashier UI can call (**32**; 19 live-verified, 13 static/decorator-verified), by surface: Auth/session, Readiness, Floor & bill resolution, Find bill, Settlement workspace (read-only), Till — plus a separated **"Hidden compatibility surfaces (Queue/Receipts — retire C4/C5)"** section covering payments/close/split/merge/move/transfer/refund/receipt calls that are reachable **by direct URL only**. Method+path, purpose, backend controller, permission string from the actual guard, request/response essentials, error modes, and a **live-verified status** column (2026-08-20, isolated local stack). Records the C3 prohibitions (payment/close execution is deliberately not wired on the Floor path), the permissions cashier holds but never uses, and the mismatch register (§10: M1 no shift-open control vs. `POST /api/tills/open` requiring a self-opened shift; M2 handoff routes live in `pos-handoff.controller.ts` under the singular `pos:order:*` namespace; M3 three dead client helpers; M4 unscoped payment-summary read; M5 unbounded `pageSize`). **Supersedes** `Front End/cashier_ui_docs_pack/docs/cashier-ui-docs/CASHIER_API_MATRIX.md`. |

## docs/waiter-ui-docs/ — CURRENT canonical Waiter UI set (2026-08-20)

Waiter was the last operational role without an in-repo canonical doc set and had **no API
matrix anywhere**. This directory closes both gaps. It is grounded in the implemented code
(`apps/web/src/lib/waiter/*`, `components/waiter/**`, `pages/waiter/**`, `apps/api/src/modules/**`)
and in live verification against an isolated local stack on 2026-08-20.

| File | Class | Note |
| --- | --- | --- |
| `README.md` | Canonical (current) | Waiter role overview: who the waiter is, each screen (with the new-brand visual language — navy header/bottom nav, white cards, silver accents, per `docs/BRAND_IDENTITY.md`), can/cannot table with the enforcement for each row, locked decisions, doc index, code map, open items. |
| `WAITER_LIFECYCLE.md` | Canonical (current) | The condensed **current** lifecycle: login (Quick PIN primary / email fallback) → shift readiness → Floor → table select → order build/send → request bill → receipt visibility boundary → reservations (seat) → Me → idle logout. Every claim cites a file. §11 records the deltas from the 2026-06-16 pack draft. |
| `WAITER_API_MATRIX.md` | Canonical (current) | Every endpoint the Waiter UI calls (37), by surface (Auth/session, Shift, Floor, Order builder, Bill & receipts, Reservations, Me) with method+path, purpose, backend controller, permission string, request/response essentials, error modes, and a **verified-status** column. Carries the "Live verification (2026-08-20, isolated local stack)" note, the defect/mismatch register (§7), and the QA rows left behind. |

## Role UI docs (Waiter / Cashier)

| Location | Class | Note |
| --- | --- | --- |
| `Front End/waiter-ui-docs/waiter-ui-docs/WAITER_LIFECYCLE.md` | **Legacy / superseded (historical)** | Draft v1, 2026-06-16 — a pre-implementation draft, superseded by `docs/waiter-ui-docs/WAITER_LIFECYCLE.md` (2026-08-20). Retained for history: it is still the best record of intent and of the denied-action reasoning. Deltas are enumerated in §11 of the superseding file. Do not treat it as current spec. |
| `Front End/waiter-ui-docs/waiter-ui-docs/{waiterui,waiter_design,README,AGENTS}.md` | Supporting | Screen blueprint + waiter design notes + pack-local orientation. Palette references predate the Aug-2026 rebrand — defer to `docs/BRAND_IDENTITY.md`. Minor stale component name in `AGENTS.md`. |
| `Front End/waiter-ui-docs/waiter-ui-docs/DESIGN.md` | Canonical (global design system) | Updated in place (v3, 2026-08-20). Despite living in the waiter pack this is the cross-role design system — see "Brand palette provenance" below. |
| `Front End/cashier_ui_docs_pack/docs/cashier-ui-docs/*` (except `CASHIER_API_MATRIX.md`) | Legacy/superseded for target architecture; still Canonical evidence for the currently-implemented build | Nav = Queue/Receipts/Till/Me — this is the **currently implemented** state (demo-ready) but is superseded as the target by `docs/cashier-ui-docs/*` above. |
| `Front End/cashier_ui_docs_pack/docs/cashier-ui-docs/CASHIER_API_MATRIX.md` | **Legacy / superseded (historical), 2026-08-20** | Verified v1, 2026-07-01 — the pre-reconstruction, Queue-first cashier endpoint matrix. **Superseded by `docs/cashier-ui-docs/CASHIER_API_MATRIX.md`** (2026-08-20), which adds the C2 Floor/bill-resolution/Find-bill/settlement rows it has no concept of, a live-verified status column, and the compat-route separation. It remains an accurate record of the **pre-reconstruction** surface — which is exactly what the hidden `/cashier/queue` + `/cashier/receipts` routes still mount, now documented as §7 of the superseding file. A supersession banner has been added in place; the body is untouched. Do not treat it as current spec. |

## LEGACY / SUPERSEDED — Supervisor 5-tab "Orders tab" material

These describe the retired **5-tab Supervisor with a dedicated Orders screen** and
**role-specific (non-shared) Floor**. Superseded by `docs/supervisor-ui-docs/*` +
`ai/SUPERVISOR_RECONSTRUCTION_*`. A supersession banner has been added to the pack
docs during this pass.

| File | Class |
| --- | --- |
| `Front End/supervisor_ui_docs_pack/docs/supervisor-ui-docs/{README, AGENTS, DESIGN, supervisor_design, supervisorui, SUPERVISOR_LIFECYCLE, SUPERVISOR_API_MATRIX, SUPERVISOR_GAP_REGISTER}.md` | Legacy/superseded |
| `Front End/supervisor_ui_docs_pack/ai/{SUPERVISOR_UI_RESEARCH_REPORT, SUPERVISOR_UI_IMPLEMENTATION_ROADMAP, SUPERVISOR_UI_REPO_VERIFICATION_PROMPT, AI_STATUS_SUPERVISOR_APPEND}.md` | Legacy/superseded |
| `ai/SUPERVISOR_UI_PROMPT4_ORDERS_COMPLETION_REPORT.md` | Generated evidence (legacy — delivered the retired Orders tab) |
| `ai/SUPERVISOR_UI_{PROMPT1..10, FINALIZATION, GAP_CONFIRMATION_MATRIX, REPO_VERIFICATION, IMPLEMENTATION_ROADMAP, API_STARTUP_AND_FLOOR_QA}*.md` | Generated evidence (legacy 5-tab build) |
| `ai/AI_STATUS.md` line describing "Floor, Orders, Reservations, Approvals, Me" | Historical status entry — superseded by top-of-file Current State |

## Enterprise UI push (new 2026-08-20) — research, gap analysis, and the canonical roadmap

| File | Class | Note |
| --- | --- | --- |
| `ai/ENTERPRISE_UI_ROADMAP.md` | **CANONICAL — the enterprise-suite plan, new 2026-08-20** | The three-track phased plan the whole UI push now runs from. **Track A** experience polish (A0 shipped 2026-08-20 — density, fullscreen login, terminal identity, short table labels; A1 the remainder). **Track B** the management suite: **B0** API verification extension → **B1** Manager **top-nav shell conversion** (module bar, click dropdowns, control panel, chip search, pager, view switcher, breadcrumb) → **B2** Overview KPI card grid → **B3** Operations + Staff (list/kanban/form + chatter) → **B4** Reporting (CSV-only; graph/pivot gated) → **B5** Accounting suite over the ~90 existing endpoints, sub-phased B5.1–B5.6 with a 7-menu tree adapted from Odoo → **B6** Settings (C11 two-pane) → **B7** Owner variant. **Track C** the true backend/discipline gaps **C-01…C-20**, each naming the Track B phase it unblocks, plus **Track C-P** carrying Cashier **C4→C6** forward unchanged. Each phase carries scope, out-of-scope, dependencies, acceptance gates, S/M/L sizing and its required completion report. Also carries the sequencing diagram, the "next three prompts", and **11 open owner decisions (OD-1…OD-11)** with recommendations. **Supersedes `ai/MANAGER_RECONSTRUCTION_ROADMAP.md` from M-P2 onward** (M-P0 + M-P1 history intact). **Track B: B1 + B2 + B3 shipped 2026-08-20; B4–B7 and B0 are NOT started.** **Track C: C-01 + C-02 landed 2026-08-20 (backend gap batch 1), which also added C-21; C-05 and C-19 were handled as discipline in B3, and C-09 was mitigated (not fixed) there.** |
| `ai/BACKEND_GAP_BATCH1_COMPLETION_REPORT.md` | **Canonical — Track C backend gap batch 1, new 2026-08-20** | The first owner-authorized Track C batch: **C-02** (`/hr/employees` compensation + PII projection — default payload no longer *selects* `compensationProfile`/`dateOfBirth`/`address`/`emergencyContact*`/`notes`/`metadata`; `?view=full` behind the pre-existing `pos:hr:compensation:read`), **MP0-10** (gross/net inversion — `grossSales = SUM(order.total)`, `netSales = gross − tax`, additive `subtotalSales`; live 33,014,100 ≥ 27,978,300), **MP0-09** (`/dash/open-orders` gains a real `total` = 107, matching `/dash/manager.openOrders`; `count` stays the page length), **C-01** (the fake PDF export returns **501**; `generateTextPdf` deleted; catalog CSV-only). Carries the consumer audit for `/hr/employees`, before/after numbers per fix, the full validation bundle (unit/e2e/Playwright/newman on an isolated stack), and four follow-ups — incl. **FU-1** (Manager still holds `pos:hr:compensation:read`) and **FU-2 → new Track C `C-21`: 38 accounting routes are 403 for every role because `accounting:*`/`finance:*` permissions were never seeded**. **No schema/migration/seed/permission/frontend change; shared-Neon deploy still gated.** |
| `ai/ODOO_REFERENCE_RESEARCH.md` | **Canonical — external UI reference, new 2026-08-20** | Live read-only exploration of the owner's Odoo instance (MARU CREDIT LIMITED, Uganda, Odoo 18-era, dark theme) through his authenticated browser session. **No record was created, edited or deleted.** Documents the global navigation model (apps grid, per-module top bar, click-to-open grouped dropdowns, top-right cluster), the **full 58-item Accounting menu tree** across all six menus, the **control-panel row** anatomy (`New` + title + cog + chip search + pager + view switcher), the three-column search dropdown, breadcrumbs + record pager, the Accounting **dashboard card** anatomy (counts-as-links, amounts-as-data, mixed-weight buttons, chart-or-checklist-or-nothing), an approximate palette, the Settings two-pane layout, the Employees kanban, the **user-form credential model** (invite → self-set password → admin force-change/reset/2FA-disable/device-revoke/archive), and a **15-component inventory C1…C15** mapped to Nimbus surfaces. Every claim is read off a screenshot; surfaces that were not opened are marked **(not opened)** rather than guessed, and §6 states plainly what the instance does **not** have (no Point of Sale app, no Sales app, reports not opened). Screenshots: `ai/odoo-reference-screenshots/` (17 files). |
| `ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md` | **Canonical — gap analysis, new 2026-08-20** | Nimbus vs the Odoo reference across accounting, dashboards, reporting, staff/HR admin and settings. **Headline finding: Nimbus's accounting backend is far larger than any Nimbus document admits** — a route scan found four registered, wired controllers (`accounts-payable` 20 routes, `accounts-receivable` 11, `bank-rec` 16, `budget` 12) that `docs/MODULES.md` still marks "⬜ Planned", so most of what the owner admires in Odoo Accounting is a **UI gap over an existing API**. ⚠️ Those four modules were found by **static scan only** and are explicitly marked *claimed-by-code, unverified-at-runtime*. 20 typed gaps **NG-01…NG-20** (UI-over-API / Backend / Mixed) with sizing, a top-10 priority list, and a UI-gap-vs-backend-gap summary. |
| `ai/odoo-reference-screenshots/` | Generated evidence (immutable) | 17 screenshots referenced inline by the research doc: apps grid, accounting dashboard, two accounting menus, invoice list + form/chatter, settings general + menu, three user-form views, employees kanban, graph view, pivot view, search dropdown, and two palette zooms. |

## Manager docs (planning only — UI not built; owner decisions APPROVED 2026-08-20)

| Location | Class | Note |
| --- | --- | --- |
| `Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md` | **Canonical — decisions register, APPROVED (owner, 2026-08-20)** | The single source of truth for what is locked on Manager. All 42 previously "Pending owner approval" table cells now read **Approved (owner, 2026-08-20)**; the 8 §8 Safety rows stay **Locked**; the §9 checklist is fully ticked. Carries a dated header recording the approval session and the **sequencing change**: the "Manager blocked until Cashier C6" rule is **replaced** — Cashier C3 authorized in parallel, Manager track unblocked. Approval of decisions is **not** authorization to write Manager runtime code. |
| `ai/MANAGER_RECONSTRUCTION_ROADMAP.md` | **Canonical for M-P0 + M-P1 history — SUPERSEDED FROM M-P2 (2026-08-20)** | ⛔ **M-P2 … M-P6 are superseded by `ai/ENTERPRISE_UI_ROADMAP.md` Track B** (owner-approved 2026-08-20). Do not plan or execute M-P2–M-P6 from this file. **M-P0 and M-P1 are not superseded** — they shipped, and everything M-P1 delivered (shared-system 4th consumer, shell + session guard, **branch switcher**, surface allow-list, honest foundation pages, Manager Me, three-verified-chips readiness rule) carries forward unchanged. Only the **navigation presentation** changed: Manager converts from bottom nav to an **Odoo-style top module bar** (`docs/DECISIONS.md` **D-MGRTOPNAV**). The M-P0 findings **MP0-01…MP0-18** and the §2 locked constraints remain fully in force and are carried into Track B verbatim. *(Original description:)* The phased-prompt plan (**M-P0 → M-P6**: repo/API verification audit → shell/nav/session/branch-switcher → Overview → Operations read-only → Staff → Reports → Settings+Me+closure QA), modelled on `docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md`. Each phase carries scope, out-of-scope, key files, validation gates (typecheck/lint/build, assertion scripts, Playwright 4-viewport matrix, isolated-DB rule) and the locked constraints it must respect. Also records the **shared-shell reuse rule** (Manager is the **4th consumer** of `OperationalShell`/`OperationalHeader`/`OperationalBottomNav`/icon registry via thin adapters — **not a fork**; Floor-like views reuse `OperationalFloor` read-only), the rebrand reference, and (§8) the **7 recorded contradictions** between the pack docs and the locked decisions. **Supersedes** the 8-prompt sequence in `MANAGER_NAV_AND_PAGE_MAP.md` §5 and the 9-phase list in the pack `README.md`. |
| `docs/manager-ui-docs/*` | **Canonical (portable in-repo set) — reconciled 2026-08-20** | Was classed "Duplicate/overlap". Now the portable copy: all dead `file:///C:/Users/arman/...` links replaced with repo-relative paths, status/date header added, plus a doc index stating **which copy is authoritative for what** and the dated decisions-approved + rebrand notes. Authoritative here: the **endpoint matrix**, the **condensed lifecycle**, and the orientation README. Authoritative in the pack: **decisions, nav/page map, feature scope, `managerui.md` blueprint, full lifecycle, full 18-row gap register, DESIGN/manager_design, AGENTS**. |
| `ai/ENTERPRISE_B4_REPORTS_COMPLETION_REPORT.md` | **Canonical — Track B4 completion record, new 2026-08-20** | Manager **Reports**. Classification **A — B4 COMPLETE / B5 · B6 · B0 · permissions-cutover GATED**. `/manager/reports` becomes a module carrying `/reports/catalog` and `/reports/runs`. **Availability is driven by the API's own catalog `status`** (IMPLEMENTED 24 / CONDITIONAL 1 / PENDING_LATER 12 of 37), so the 13 non-implemented entries are structurally uncallable and each names the milestone the API cites. ONE generate form (MP0-16 re-verified live — all 24 routes returned **201**). History is **genuinely persisted** (verified before it was built). **CSV-only export with the format hard-coded**; `format: PDF` → **501** and a legacy PDF artifact's download → **404**, both disclosed in prose and never offered as a control. **No graph or pivot, and neither advertised** (C-03). Records the §0 finding that **B3 was not committed and its e2e evidence unfinished** — repaired and committed as `c34d12e` first; **defect B4-D1** (a second catalog query key made the page fetch `/api/reports/catalog` twice — now shared with the M-P1 readiness strip); and **B4-F2**, that `grossSales` is tax-inclusive at summary level but **ex-tax** inside `topItems[]`/`categories[]`. Findings **B4-F1…F6**. |
| `ai/ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md` | **Canonical — Track B3 completion record, new 2026-08-20** | Manager **Operations + Staff**. Classification **A — B3 COMPLETE / B4 GATED**. Operations and Staff become modules carrying **eight live surfaces** on the B1 chrome primitives (B3 is the first phase to MOUNT `ManagerSearchFilterMenu` + `ManagerBreadcrumbs`) plus four new shared ones — `ManagerListTable` (Odoo **C4**), `ManagerStatusPipeline` (**C14**), `ManagerViewSwitcher`, `ManagerRecordActionsMenu` (**C13**). **Operations is strictly read-only** (zero mutations, asserted); **Staff writes exactly four things** — onboarding, Quick-PIN reset/disable/enable, leave review, shift-swap **rejection**. Resolves the two questions the roadmap required B3 to answer explicitly: the **"read-only vs escalations" tension** (§4 — no escalation write and no escalation list; the roadmap's own DTO precondition was unmet and `/api/approvals` is only partly branch-scoped) and the **shift-swap outcome** (§5 — **Outcome C, reject only**, proven live: 0 of 3 roster rows changed). Records **defect B3-D1** — backend gap batch 1 *inverted* `grossSales`/`netSales`, so the B2 Overview was labelling the ex-tax figure "tax-inclusive"; fixed and pinned by assertion. Also records the four hard guards and how each is proven, the deferred items with reasons, and findings **B3-F1…F3**. |
| `ai/ENTERPRISE_B3_QA_EVIDENCE_INDEX.md` | **Canonical — Track B3 evidence, new 2026-08-20** | Isolated-stack provenance (Docker `postgres:16` :55437, API :4001, web :3100; `.env` restored byte-for-byte, SHA-256 verified; shared Neon never touched), the 15/15 assertion-script results, the **39/39** live API matrix (reads + a mutation matrix including the **roster-integrity** proof), the four-viewport Playwright results, the screenshot set, and — per `ai/AI_ERROR_PROTOCOL.md` — **every failure encountered with its diagnosis**: one product defect (B3-D1, fixed) and four test-harness defects in specs written during the phase, each with the probe that distinguished them from product bugs. |
| `ai/MANAGER_P1_SHELL_COMPLETION_REPORT.md` | **Canonical — M-P1 completion record, new 2026-08-20** | The Manager shell / navigation / session-guard / branch-switcher foundation. Classification **A — M-P1 COMPLETE / READY FOR M-P2**. Manager becomes the **fourth consumer** of the shared operational UI system (never a fork): locked six-tab nav **Overview · Operations · Staff · Reports · Settings · Me**, landing `/manager/overview`, `ManagerShell`/`ManagerSessionGuard` over the shared `OperationalShell`, and the **branch switcher** in a new *optional* header slot — sourced from `me.memberships` (zero extra requests), persisted at `nimbus.managerBranchId`, driving `X-Branch-Id`, invalidating only the `["manager"]` query namespace. `lib/manager/permissions.ts` is a **surface allow-list, not a permission check** (M-P0 GO condition 1). Readiness ships three verified chips; tills/shifts/approval chips omitted, not faked (GO condition 3). Records validation (12/12 assertion scripts, `e2e/manager-shell/` **92/92** × 4 viewports, cross-role regression **68/68**, live QA) and three findings recorded but not implemented. **M-P2 not started.** |
| `ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md` | **Canonical — M-P0 completion record, new 2026-08-20** | The Manager repo/API/permission verification audit. Classification **A — M-P0 COMPLETE / GO FOR M-P1 (4 conditions)**. All **62** `MANAGER_API_MATRIX.md` rows verified twice — statically against `apps/api/src/modules/**/*.controller.ts` (route, method, exact `@Permissions` string, `@RequireBranchContext`, service `where` clause) and live against an isolated QA stack (API `:3001`, disposable local Postgres, `manager@nimbus.demo`). Result **🟢 51 · 🟡 7 · 🔴 4**. **RED:** `GET /api/tills` and `GET /api/shifts` **do not exist** (and `/tills/active` + `/shifts/active` are *operator-scoped*, not branch-scoped); `PATCH /api/branches/:id` **does not exist**; `GET /api/hr/employees` returns **full `compensationProfile` (baseAmount/salaryBasis/allowances/deductions)** on every row plus `dateOfBirth`/`address`/private HR `notes`, org-scoped with **no branch filter** — a wire-level breach of the locked "compensation never fetched" rule; and `POST /api/reports/export` with `format: PDF` emits a **plain-text file stamped `application/pdf`** (a backend fake-success state). **Confirmed:** the demo Manager is **multi-branch (4 memberships)** and branch switching works fail-closed; **61/61 matrix permissions are HELD** (zero mismatches) so every MVP restriction is a **product constraint, not a permission block**; SSE `/api/stream/metrics` has **no `@Permissions`** and a verified **15 s** interval; the seeded Quick PIN `11223344` is real; and **approving a shift swap mutates ZERO `ScheduleAssignment` rows** (SUP-RG-036/042 holds → Supervisor **Outcome C** applies to Manager). **Disproved:** MANAGER-GAP-009 — all 24 generator DTOs are uniform, so one generic form is DTO-correct. Carries 18 findings (**MP0-01 … MP0-18**) with severity and owning phase. |
| `docs/manager-ui-docs/MANAGER_API_MATRIX.md` | Canonical (endpoint table) — **LIVE-VERIFIED 2026-08-20 via a new `Verified` column** | **2026-08-20 update:** every one of the **62** rows now carries a `Verified (M-P0, 2026-08-20)` column recording the controller file+line, whether the `@Permissions` string matches, the observed live HTTP code (or `not exercised (mutation)`), the actual response fields, and a 🟢/🟡/🔴 verdict — **51/7/4**. A new M-P0 header section states that **the `Verified` column supersedes the `Permission`, `Role-scope notes`, and `Caveats` columns wherever they disagree**, lists the four 🔴 rows, and records two headline corrections: the **17 report-generator rows are a subset of 24** (7 undocumented routes enumerated; `cash-movements` has no row at all) and **`GET /api/approvals` is only partly branch-scoped** (`leave_request`/`vendor_bill`/`inter_branch_transfer` are org-scoped — live `total: 16` across 5 branches). Row bodies remain the 2026-07-06 draft — **annotated, never rewritten**. Evidence: `ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md`. *(Prior header note, still present:)* owner decisions locked. The generic `GET /api/approvals`, `GET /api/approvals/:id`, and `POST /api/approvals/:id/decide` rows are annotated: owner **prefers domain-specific decision routes** (Supervisor **Option B** precedent). **Seed finding recorded:** `packages/db/prisma/seed.ts` grants MANAGER **both** `approvals:read` (line 974) and `approvals:decide` (line 975), while the `Supervisor:` block (line 1090) grants **neither** — so for Manager the preference is a **product/safety constraint the frontend must enforce, not a permission block**. Body untouched. |
| `docs/manager-ui-docs/MANAGER_LIFECYCLE.md` | Canonical (condensed) — **header note added** | Dated note: decisions locked; §8's generic approvals-inbox/decide flow reads as **read/detail only** under the domain-route preference; the **pack copy (~4× longer) is authoritative on edge cases**. Body untouched. |
| `docs/manager-ui-docs/MANAGER_GAP_REGISTER.md` | Supporting — **superseded in detail** | Dated note: the pack register's **18** rows (`MANAGER-GAP-001…018`) subsume these **6** (`GAP-01…06`); a row-mapping table is included. Flags that **GAP-06's "mock/stub downloads" wording contradicts the locked "fake downloads forbidden" decision** — the approved behaviour is a truthful generator-unavailable state. Body untouched. |
| `Front End/manager_ui_full_docs_pack/manager-ui-docs/*` (remaining files) | Supporting (forward planning) — **richer source** | `MANAGER_NAV_AND_PAGE_MAP.md`, `MANAGER_FEATURE_SCOPE.md`, `managerui.md`, `MANAGER_LIFECYCLE.md` (full), `MANAGER_GAP_REGISTER.md` (18 rows), `AGENTS.md`, `DESIGN.md`, `manager_design.md`. ⚠️ Palette tables defer to `docs/BRAND_IDENTITY.md`; the nav-map §5 prompt sequence defers to `ai/MANAGER_RECONSTRUCTION_ROADMAP.md`. |
| `ai/MANAGER_UI_REPO_VERIFICATION_REPORT.md`, `ai/MANAGER_UI_SCOPE_AND_NAV_RECOMMENDATION.md` | Generated evidence (Prompt 0) | The verification report and the nav/scope recommendation the owner approved on 2026-08-20. |

**Manager docs reconciliation status (2026-08-20):** ✅ reconciled. `docs/manager-ui-docs/` is portable
(no dead absolute links) and no longer a plain duplicate — it is the in-repo subset with an explicit
authority split against the pack. Decisions are approved and locked; the canonical roadmap exists;
7 pack-vs-decision contradictions are recorded in `ai/MANAGER_RECONSTRUCTION_ROADMAP.md` §8 rather
than silently resolved. **Manager UI implementation remains NOT STARTED**, but is **no longer blocked
by Cashier C6**. Documents still describing Manager as C6-blocked (`CLAUDE.md` §10/§12, `CODEX.md`,
`PROGRESS.md` role table, `docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md` scope lock) are
**stale on sequencing only**.

## Brand palette provenance (2026-08-20 rebrand)

`docs/BRAND_IDENTITY.md` is canonical for brand colors, type, and logo. Every palette
table elsewhere is downstream of it. Status of the four `Front End/` DESIGN.md packs:

| File | Palette status |
| --- | --- |
| `Front End/waiter-ui-docs/waiter-ui-docs/DESIGN.md` | **Updated in place (v3, 2026-08-20) — still Canonical** for the global design system. §4 tables now carry the Aug 2026 values. |
| `Front End/cashier_ui_docs_pack/docs/cashier-ui-docs/DESIGN.md` | **Updated in place** — §3 palette references rebranded. (Its nav architecture remains superseded by `docs/cashier-ui-docs/*`, unchanged by this pass.) |
| `Front End/manager_ui_full_docs_pack/manager-ui-docs/DESIGN.md` | **Updated in place** — §3 palette references rebranded. Still Supporting (forward planning). |
| `Front End/supervisor_ui_docs_pack/docs/supervisor-ui-docs/DESIGN.md`, `supervisor_design.md` | **Superseded — not rewritten.** Their supersession banners were extended: palette values shown are the pre-Aug-2026 brand. |

Also carrying a rebrand supersession banner (historical records, bodies untouched):
`ai/CASHIER_UI_REPO_VERIFICATION_REPORT.md` (claims a "navy/silver/slate" token theme),
`ai/SUPERVISOR_RECONSTRUCTION_PROMPT1_SHARED_SHELL_COMPLETION_REPORT.md` (favicon claims).

## Duplicates

| Canonical | Duplicate(s) |
| --- | --- |
| `docs/POSTMAN_ENDPOINT_GUIDE.md` | `ai/POSTMAN_ENDPOINT_GUIDE.md`, `postman/POSTMAN_GUIDE.md` (overlapping) |
| `demo-data/**` | `nimbus_enterprise_demo_data_pack/**` (delivery pack copy) |
| `docs/manager-ui-docs/*` | ~~`Front End/manager_ui_full_docs_pack/*`~~ — **no longer a plain duplicate (reconciled 2026-08-20).** The two sets now have an explicit authority split: `docs/manager-ui-docs/` owns the endpoint matrix + condensed lifecycle + orientation README; the pack owns decisions, nav/page map, feature scope, blueprint, full lifecycle, and the 18-row gap register. See the Manager docs section above. |

## Generated evidence (historical — do not treat as current spec)

- `ai/M0..M42 + BG0..BG7 *_COMPLETION_REPORT.md` — per-milestone backend evidence.
- `ai/{WAITER,CASHIER,SUPERVISOR}_*` completion/QA reports — role UI build evidence.
  Newest waiter/perf/profile/supervisor-reconstruction reports are **current** evidence.
  Historical `ai/CASHIER_UI_*` reports remain valid evidence of the currently-implemented
  Queue-first build; they are not the target architecture for the Floor-First reconstruction
  (see `ai/CASHIER_FLOOR_RECONSTRUCTION_*` below).
- `ai/CASHIER_FLOOR_RECONSTRUCTION_*.md` — Cashier Floor-First reconstruction (locked target,
  **C0+C1+C2 complete / C3 not started, 2026-07-31**): `CASHIER_FLOOR_RECONSTRUCTION_DECISION.md`
  (canonical decision), `_GAP_REGISTER.md`, `_C0_REPO_VERIFICATION_REPORT.md` (canonical C0 record),
  `_COMPONENT_AUDIT.md`, `_ROUTE_AND_NAV_AUDIT.md`, `_CAPABILITY_MIGRATION_MATRIX.md`,
  `_PERMISSION_AND_API_MATRIX.md`, `_TEST_INVENTORY.md`, `_PROMPT_C0.md`, `_PROMPT_C1.md`.
  **Prompt C1 (shared Cashier Floor/shell/nav/routing) IMPLEMENTED:**
  `_C1_SHARED_FLOOR_COMPLETION_REPORT.md` (canonical C1 record),
  `_C1_QA_EVIDENCE_INDEX.md` (C1 QA evidence). **Prompt C2 (table→bill resolution + read-only
  settlement workspace + Find bill) IMPLEMENTED:** `_C2_BILL_RESOLUTION_COMPLETION_REPORT.md`
  (canonical C2 record), `_C2_QA_EVIDENCE_INDEX.md` (C2 QA evidence), `_PROMPT_C3.md` (next-prompt
  spec — payment/close execution, **not started**).
- Root/`apps/api`/`packages/db` `_*.txt`, `_*.log`, `seed*.log/.txt`, `_*.cjs/.mjs`
  — throwaway console dumps and ad-hoc verification scripts (see
  `docs/REPOSITORY_MAP.md` §Generated/temporary).

## AGENTS.md files

| File | Governs |
| --- | --- |
| `AGENTS.md` (root) | Whole repo — governance, non-negotiables, error/Postman protocols. |
| `Front End/waiter-ui-docs/waiter-ui-docs/AGENTS.md` | Waiter UI docs (current-ish). |
| `Front End/cashier_ui_docs_pack/docs/cashier-ui-docs/AGENTS.md` | Cashier UI docs. |
| `Front End/supervisor_ui_docs_pack/docs/supervisor-ui-docs/AGENTS.md` | Supervisor UI docs — **legacy 5-tab/Orders contract** (supersession banner added). |
| `Front End/manager_ui_full_docs_pack/manager-ui-docs/AGENTS.md` | Manager UI docs (planning). |

**Governance gap:** there is no AGENTS.md inside the current in-repo
`docs/supervisor-ui-docs/`; the only Supervisor AGENTS contract is the legacy pack
one. ~~Consider adding a current one when Supervisor Prompt 3 begins.~~
**Updated 2026-08-20:** the trigger sentence is stale — Supervisor Prompt 3 finished long ago and
the whole reconstruction **closed on 2026-07-31**. The gap itself is **still open** (the directory
still has 8 files and no `AGENTS.md`, confirmed 2026-08-20) and is now a closure-hygiene item, not
a "when Prompt 3 begins" item. Compare `docs/cashier-ui-docs/AGENTS.md`, which exists.
