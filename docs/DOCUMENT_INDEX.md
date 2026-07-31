# DOCUMENT_INDEX.md — Nimbus POS documentation catalog & provenance

> Classifies every important document as **canonical**, **supporting**,
> **legacy/superseded**, **duplicate**, or **generated evidence**, and records
> supersession relationships. When docs conflict, the local **worktree code** and
> the top-of-file "Current State" in `ai/AI_STATUS.md` win.
> Last compiled: 2026-07-26.

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
| `docs/UI_SYSTEM.md` | Canonical (frontend operational UI system) — new |
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
| `README.md` | Canonical (current) | Reconstruction status + index; "No visible Orders tab". |
| `SUPERVISOR_SHARED_COMPONENT_ARCHITECTURE.md` | Canonical (current) | Shared shell/Floor extraction + ownership. |
| `SUPERVISOR_ICON_AND_NAVIGATION_STANDARD.md` | Canonical (current) | Four-tab nav; `/supervisor/orders` = legacy redirect. |
| `SUPERVISOR_LIFECYCLE.md`, `SUPERVISOR_RESERVATION_LIFECYCLE.md`, `SUPERVISOR_APPROVAL_LIFECYCLE.md` | Canonical (current) | State machines / workflow. |
| `SUPERVISOR_API_MATRIX.md` | Canonical (current) | Orders APIs are for Floor-contained work, not a primary tab. |
| `SUPERVISOR_GAP_REGISTER.md` | Canonical, with legacy rows | Has a supersession banner, but rows :16/:18/:19 still describe the old Orders surface — read as historical. |

## docs/cashier-ui-docs/ — CURRENT canonical Cashier UI set (locked target, 2026-07-31)

| File | Class | Note |
| --- | --- | --- |
| `README.md`, `AGENTS.md`, `CASHIER_ARCHITECTURE.md`, `CASHIER_LIFECYCLE.md`, `CASHIER_ROLE_BEHAVIOUR_MATRIX.md`, `CASHIER_COMPONENT_REUSE_MAP.md`, `CASHIER_RECONSTRUCTION_ROADMAP.md`, `CASHIER_TEST_PLAN.md` | Canonical (current, locked target — **C1+C2 implemented, C3+ pending**) | Nav = **Floor · Till · Me** (locked; **C1 landed the Floor/Till/Me nav + `/cashier/floor` default + shared-Floor consumption; C2 landed table→bill resolution + a read-only settlement workspace + Find bill — 2026-07-31**). Supersedes `Front End/cashier_ui_docs_pack/docs/cashier-ui-docs/*` wherever they conflict. Reconstruction tracked as 7 prompts C0–C6 (C0+C1+C2 complete) under `ai/CASHIER_FLOOR_RECONSTRUCTION_*`. |

## Role UI docs (Waiter / Cashier)

| Location | Class | Note |
| --- | --- | --- |
| `Front End/waiter-ui-docs/waiter-ui-docs/*` | Canonical (current) for Waiter | Already carries "Shared Floor (2026-07-18)" + "no visible Orders tab". Minor stale component name in `AGENTS.md`. |
| `Front End/cashier_ui_docs_pack/docs/cashier-ui-docs/*` | Legacy/superseded for target architecture; still Canonical evidence for the currently-implemented build | Nav = Queue/Receipts/Till/Me — this is the **currently implemented** state (demo-ready) but is superseded as the target by `docs/cashier-ui-docs/*` above. |

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

## Manager docs (planning only — UI not built)

| Location | Class | Note |
| --- | --- | --- |
| `Front End/manager_ui_full_docs_pack/manager-ui-docs/*` | Supporting (forward planning) | Fuller source. |
| `docs/manager-ui-docs/*` | Duplicate/overlap | In-repo subset from Prompt 0. Pick as canonical when Manager UI starts. |

## Duplicates

| Canonical | Duplicate(s) |
| --- | --- |
| `docs/POSTMAN_ENDPOINT_GUIDE.md` | `ai/POSTMAN_ENDPOINT_GUIDE.md`, `postman/POSTMAN_GUIDE.md` (overlapping) |
| `demo-data/**` | `nimbus_enterprise_demo_data_pack/**` (delivery pack copy) |
| `docs/manager-ui-docs/*` | `Front End/manager_ui_full_docs_pack/*` |

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
one. Consider adding a current one when Supervisor Prompt 3 begins.
