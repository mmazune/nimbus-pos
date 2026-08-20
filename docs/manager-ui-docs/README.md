# Manager UI Documentation — Nimbus POS

**Status:** Owner decisions **APPROVED (2026-08-20)**. **M-P0 audit ✅ · M-P1 shell foundation ✅
(2026-08-20) · M-P2…M-P6 not started.** The Manager workspace shell, six-tab navigation, session
guard, and branch switcher are live in `apps/web`; every surface still renders an honest foundation
state with **no live data** except Manager Me (built solely from `/api/auth/me`).
**Role target:** `JobRole.MANAGER` (no separate `BRANCH_MANAGER` enum).
**Landing route:** `/manager/overview`.
**Bottom nav (locked):** Overview · Operations · Staff · Reports · Settings · Me.
**Last updated:** 2026-08-20.

This directory is the **in-repo, portable** Manager doc set. It is the copy to read from a repo
checkout — every link below is repo-relative and resolves on any machine. It is a *subset* of the
fuller planning pack under [`Front End/manager_ui_full_docs_pack/manager-ui-docs/`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/),
which remains the richer source for design, blueprint, scope, and gap detail (see the index below).

---

## Dated notes

### 2026-08-20 — M-P1 shell/nav/session/branch-switcher COMPLETE

Canonical record: [`ai/MANAGER_P1_SHELL_COMPLETION_REPORT.md`](../../ai/MANAGER_P1_SHELL_COMPLETION_REPORT.md).
Manager is now the **fourth consumer** of the shared operational UI system (never a fork).

- Locked nav shipped exactly: **Overview · Operations · Staff · Reports · Settings · Me**; landing
  `/manager/overview`; `/manager` redirects there; no More tab, no Approvals tab.
- **Branch switcher live** in a new *optional* shared-header slot: it lists the manager's ACTIVE
  memberships from `me.memberships` (zero extra requests), persists at `nimbus.managerBranchId`,
  drives `X-Branch-Id` on every manager read, and invalidates only the `["manager", …]` query
  namespace. Verified live across all four seeded branch memberships.
- `lib/manager/permissions.ts` is a **surface allow-list, not a permission check** — the manager
  token holds 214 permissions including compensation/contracts/approvals-decide, so a permission
  lookup would open surfaces the approved MVP forbids.
- Readiness strip ships **three verified chips only** (Branch, Reports generators, Devices).
  **Tills/shifts/pending-approvals chips are omitted, not faked.**
- Validation: typecheck + lint pass (`next build` deliberately not run in the dev QA sandbox);
  12/12 assertion scripts; Playwright `e2e/manager-shell/` **92/92** across four viewports;
  cross-role regression **68/68**; Waiter/Cashier/Supervisor re-verified live and unchanged.
- **No backend / schema / migration / seed / permission / Postman change. No commit, no push.**

**M-P2 (Overview dashboard) has NOT started and must not start without explicit authorization.**

### 2026-08-20 — Owner decisions approved; Manager track unblocked

The product owner (Moses) approved the full Manager core + MVP scope recommendation. The
canonical decision register is
[`Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md)
— every row that read *Pending owner approval* now reads **Approved (owner, 2026-08-20)**; the
§8 Safety rows stay **Locked**.

Locked outcomes that bind every document in this directory:

- Role `JobRole.MANAGER`; no separate Branch Manager role; landing `/manager/overview`.
- Bottom nav is exactly **Overview · Operations · Staff · Reports · Settings · Me**. **No More tab.**
- A **branch switcher is required** in the shell/header, and the selected branch drives **every**
  branch-scoped query.
- **Approvals is NOT a bottom tab in MVP** — approval affordances are integrated into
  Overview (counts), Operations (order/void/refund/discount escalation), and Staff (leave, swaps).
- **Reports and Settings are first-class tabs.**
- *Staff:* directory (safe fields), frontline onboarding, Quick PIN admin, leave review, shift-swap
  review. **Compensation / contracts / payroll excluded.**
- *Operations:* **read-only oversight** of tables/orders/tills/shifts/reservations. **No
  cashier-checkout clone, no waiter-order-entry clone.**
- *Reports:* catalog + generate (DTO-verified) + history/detail + export **with a truthful
  generator-unavailable state**. **Fake downloads forbidden.**
- *Settings:* branch profile + device registry; printer routes **metadata-only**; terminal pairing
  **stub-only**; alert rules **defer-or-read-only**; sync-conflict diff **deferred**; owner/admin
  and SaaS billing **excluded**.
- **Domain-specific decision routes are preferred** over the generic `POST /api/approvals/:id/decide`
  (the **Supervisor Option B precedent**). See the annotation in
  [`MANAGER_API_MATRIX.md`](MANAGER_API_MATRIX.md).

**Sequencing changed by the same decision.** The previous rule *"Manager reconstruction is blocked
until Cashier reconstruction closes at C6"* is **replaced**: **Cashier C3 is authorized to proceed
in parallel** and the **Manager track no longer waits for Cashier C6**. Older documents (including
`CLAUDE.md` §10/§12, `PROGRESS.md`, and `docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md`'s
"no Manager UI before C6 closure" scope lock) still carry the superseded wording — treat this note
and the decision register as authoritative on sequencing.

The phased implementation plan produced from these decisions is
[`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`](../../ai/MANAGER_RECONSTRUCTION_ROADMAP.md) (**canonical**,
M-P0 → M-P6). **Approval of the decisions is not authorization to write Manager runtime code** —
each phase has its own gate, and **M-P0 (repo/API verification audit) runs first.**

### 2026-08-20 — Aug-2026 rebrand is canonical

The Nimbus POS brand identity refresh has shipped in `apps/web`. Canonical reference:
[`docs/BRAND_IDENTITY.md`](../BRAND_IDENTITY.md).

- Navy **`#000033`** (navy-900, the canonical brand navy), Light Grey **`#B3B4AF`**,
  Dark Grey **`#6B6B6B`**.
- The **steering-wheel logomark** is the brand mark, rendered by
  `apps/web/src/components/pos-shell/NimbusLogomark.tsx` — a **documented non-registry exception**
  (it is a brand mark, not a UI icon). Vector/raster assets live in `apps/web/public/brand/`.
- Manager surfaces must consume the `--color-brand-*` design tokens; **do not hard-code hexes** and
  **do not reintroduce pre-Aug-2026 palette values** from any `Front End/` pack table.
- The rebrand changed **no** Manager route, permission, endpoint, or scope decision.

### 2026-08-20 — Dead-link repair

Every `file:///C:/Users/arman/...` absolute link in this README has been replaced with a
repo-relative path. Those links were unresolvable outside one Windows machine and are the reason
this set was previously classed a non-portable duplicate.

---

## Document index — and which copy is authoritative for what

**Rule of thumb:** this directory is authoritative for the **in-repo endpoint matrix, the condensed
lifecycle, and this orientation README**. The pack is authoritative for **design, screen blueprint,
navigation/page map, feature scope, the full gap register, and the decision register**.

### In this directory (`docs/manager-ui-docs/`) — portable set

| File | Authoritative for | Notes |
| --- | --- | --- |
| [`README.md`](README.md) (this file) | Orientation, dated decision/rebrand notes, the doc index | Start here. |
| [`MANAGER_API_MATRIX.md`](MANAGER_API_MATRIX.md) | The endpoint table (surface → method → endpoint → permission → sensitivity → MVP use) | **Same table body** as the pack copy. The pack copy adds §1 *General rules* and §3 *Domain implementation notes* — read those there. Carries the 2026-08-20 decisions-locked header + the approvals-route annotation. **Not yet live-verified** — that is M-P0's job. |
| [`MANAGER_LIFECYCLE.md`](MANAGER_LIFECYCLE.md) | A **condensed** operational lifecycle (login → branch context → per-tab flows) | **The pack copy is ~4× longer** and is authoritative on edge cases, blocked states, and the full action contract. Use this copy for orientation, the pack copy for detail. |
| [`MANAGER_GAP_REGISTER.md`](MANAGER_GAP_REGISTER.md) | Nothing exclusively — **superseded in detail** | 6 gaps (GAP-01…06). The pack register has **18** (MANAGER-GAP-001…018) and subsumes all six. **Read the pack register.** |

### In the planning pack (`Front End/manager_ui_full_docs_pack/manager-ui-docs/`) — richer source

| File | Authoritative for |
| --- | --- |
| [`MANAGER_APPROVAL_DECISIONS.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md) | **The owner decision register — approved 2026-08-20.** The single source of truth for what is locked. |
| [`MANAGER_NAV_AND_PAGE_MAP.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_NAV_AND_PAGE_MAP.md) | Final navigation, route map, shell sections, per-page section breakdown. ⚠️ Its §5 *Prompt sequence* (8 prompts) predates and is **superseded by** [`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`](../../ai/MANAGER_RECONSTRUCTION_ROADMAP.md) (M-P0…M-P6). |
| [`MANAGER_FEATURE_SCOPE.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_FEATURE_SCOPE.md) | Capability boundaries: what Manager can see / do / must not see / must not do, plus the route capability map. |
| [`managerui.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/managerui.md) | The screen-by-screen UI blueprint (Overview / Operations / Staff / Reports / Settings / Me), copy, states, acceptance criteria. |
| [`MANAGER_LIFECYCLE.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_LIFECYCLE.md) | The **full** lifecycle and action contract, including edge/blocked states. |
| [`MANAGER_GAP_REGISTER.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_GAP_REGISTER.md) | The **full** 18-row gap register with evidence, impact, and proposed action. |
| [`MANAGER_API_MATRIX.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_API_MATRIX.md) | The general API rules (§1) and per-domain implementation notes (§3) around the shared table. |
| [`AGENTS.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/AGENTS.md) | Coding-agent contract and guardrails for Manager implementation. |
| [`DESIGN.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/DESIGN.md) · [`manager_design.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/manager_design.md) | Manager design-system extension and role-specific shell/page/component/state contract. ⚠️ **Palette tables defer to [`docs/BRAND_IDENTITY.md`](../BRAND_IDENTITY.md).** |

### Cross-references (elsewhere in the repo)

| File | Purpose |
| --- | --- |
| [`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`](../../ai/MANAGER_RECONSTRUCTION_ROADMAP.md) | **Canonical** phased-prompt implementation plan (M-P0 → M-P6) grounded in the docs above + the locked decisions. |
| [`ai/MANAGER_UI_REPO_VERIFICATION_REPORT.md`](../../ai/MANAGER_UI_REPO_VERIFICATION_REPORT.md) | Prompt 0 repository verification and dirty-file tracking report. |
| [`ai/MANAGER_UI_SCOPE_AND_NAV_RECOMMENDATION.md`](../../ai/MANAGER_UI_SCOPE_AND_NAV_RECOMMENDATION.md) | The nav/scope recommendation the owner approved on 2026-08-20. |
| [`docs/BRAND_IDENTITY.md`](../BRAND_IDENTITY.md) | Canonical brand palette, type, and logo. Supersedes every `Front End/` palette table. |
| [`docs/UI_SYSTEM.md`](../UI_SYSTEM.md) | Shared operational UI system — the shell/nav/icon rules Manager must consume, not fork. |
| [`docs/ROLE_CAPABILITY_MATRIX.md`](../ROLE_CAPABILITY_MATRIX.md) · [`docs/ROLE_JOURNEYS.md`](../ROLE_JOURNEYS.md) | Cross-role capability and journey context. |
| [`docs/supervisor-ui-docs/SUPERVISOR_APPROVAL_LIFECYCLE.md`](../supervisor-ui-docs/SUPERVISOR_APPROVAL_LIFECYCLE.md) | The **Option B** domain-specific-approvals precedent the Manager approvals decision aligns with. |
| [`docs/DOCUMENT_INDEX.md`](../DOCUMENT_INDEX.md) | Full document catalog with provenance and supersession status. |

---

## Reading order before Manager implementation

1. [`MANAGER_APPROVAL_DECISIONS.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md) — what is locked.
2. [`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`](../../ai/MANAGER_RECONSTRUCTION_ROADMAP.md) — the phase you are in and its gates.
3. [`MANAGER_NAV_AND_PAGE_MAP.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_NAV_AND_PAGE_MAP.md) + [`MANAGER_FEATURE_SCOPE.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_FEATURE_SCOPE.md) — structure and boundaries.
4. [`managerui.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/managerui.md) — screen blueprint.
5. [`MANAGER_LIFECYCLE.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_LIFECYCLE.md) (pack, full) — flows and edge cases.
6. [`MANAGER_API_MATRIX.md`](MANAGER_API_MATRIX.md) — endpoints, permissions, sensitivity.
7. [`MANAGER_GAP_REGISTER.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_GAP_REGISTER.md) (pack, 18 rows) — known gaps.
8. [`docs/BRAND_IDENTITY.md`](../BRAND_IDENTITY.md) + [`docs/UI_SYSTEM.md`](../UI_SYSTEM.md) — visual and shared-component rules.
9. The **local worktree code** — it wins over every document here.

## Source-of-truth precedence

1. Local dirty worktree code and verified runtime contracts.
2. [`MANAGER_APPROVAL_DECISIONS.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md) (owner-locked) and [`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`](../../ai/MANAGER_RECONSTRUCTION_ROADMAP.md).
3. This directory.
4. The `Front End/manager_ui_full_docs_pack/` planning pack.
5. Root canonical architecture/governance docs.

When code and these documents conflict, **do not silently change the code to match**. Record the
conflict and resolve it through the relevant roadmap phase.

## Shared-component rule (non-negotiable)

Manager is the **fourth consumer** of the shared operational UI system — **not a fork**.
`OperationalShell`, `OperationalHeader`, `OperationalBottomNav`, `CurrentTime`, the shared logout /
idle mechanism, and the canonical icon registry (`pos-shell/role-icon-config.ts` + `role-icons.ts`)
are consumed through **thin Manager adapters**, exactly as Waiter, Cashier, and Supervisor do. If a
Manager Floor-like view is built, it reuses `OperationalFloor` **read-only**. Recreating
Manager-specific copies of shared shell/floor components is prohibited.
