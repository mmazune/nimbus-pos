# Manager Lifecycle

This document describes the operational lifecycle states, state transitions, context tracking, and data security policies of the **Manager / Branch Manager** workspace.

---

## 2026-08-20 — Header note: Track B3 SHIPPED Operations + Staff (read this first)

**This lifecycle document predates the build.** Where it and the shipped code disagree, the code and
[`ai/ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md`](../../ai/ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md)
win. The corrections that matter:

| This doc says | What actually shipped (B3, 2026-08-20) |
| --- | --- |
| §4 Operations as a general oversight surface | **Strictly read-only**, three surfaces (Orders / Tables / Reservations). No mutation of any kind exists in `components/manager/operations` — proven by assertion. |
| §8 an Approvals Inbox committing via `POST /api/approvals/:id/decide` | **Not built, and deliberately.** No escalation write and no escalation *list* ships: `/api/approvals` is only partly branch-scoped (MP0-05 — a Tapas-scoped read returned 16 rows across **5 branches**), and the three domain DTOs were never verified. Approval **counts** stay on Overview from the four canonical branch-scoped domain endpoints. |
| Shift-swap approval as a lifecycle transition | **Outcome C — reject only.** Approving mutates **zero** roster rows; `scheduleAssignment` has no write path anywhere in the API. Proven live: 3 rows before a real rejection, 3 after. |
| Leave review as an HR lifecycle step | Correct, but it makes **no payroll or roster claim**, and the decision is **org-scoped** (leave has a nullable branch) rather than branch-guarded. The UI states both. |
| Staff data as a general employee record | The workspace holds an **allow-list of 14 safe fields**, projected at the API-client boundary. Compensation, contracts, `dateOfBirth`, `address`, `emergencyContact*` and private notes are never fetched — `?view=full` is never requested, and `GET /hr/employees/:id` is never called at all. |

Still true and unchanged: nav is the locked six modules, Operations excludes any cashier/waiter
clone, Staff excludes compensation/contracts/payroll, Reports must show a truthful
generator-unavailable state.

---

## 2026-08-20 — Header note: owner decisions are LOCKED

The product owner approved the Manager core + MVP scope on **2026-08-20**. The canonical register is
[`Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md)
(every previously-pending row now reads **Approved (owner, 2026-08-20)**). The phased plan is
[`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`](../../ai/MANAGER_RECONSTRUCTION_ROADMAP.md). Read this
lifecycle under those locked constraints:

- Nav is **Overview · Operations · Staff · Reports · Settings · Me**; **no Approvals tab** and
  **no More tab**; landing `/manager/overview`; a **required** branch switcher drives every
  branch-scoped query.
- Operations (§4) is **read-only oversight** — no cashier-checkout or waiter-order-entry clone.
- Staff (§5) excludes **compensation / contracts / payroll**.
- Reports (§6) must show a truthful **generator-unavailable** state; **fake downloads forbidden**.
- Settings (§7): printer routes **metadata-only**, terminal pairing **stub-only**, alert rules
  **defer-or-read-only**, sync-conflict diff **deferred**.
- **§8 (Escalation & Approval) reads against the locked decision.** It describes an "Approvals
  Inbox" driven by `GET /api/approvals` and committing decisions with
  `POST /api/approvals/:id/decide`. The owner decision **prefers domain-specific decision routes**
  (Supervisor Option B precedent), and Approvals is **not a bottom tab** — counts surface on
  Overview, order/void/refund/discount escalation lives in Operations, leave/swap review in Staff.
  Treat §8's generic-decide flow as the **read/detail** path only; route every **write** through the
  verified domain endpoint. Details and the seed-permission finding (Manager **does** hold
  `approvals:read` + `approvals:decide`; Supervisor holds neither) are in the header annotation of
  [`MANAGER_API_MATRIX.md`](MANAGER_API_MATRIX.md).
- **Sequencing:** the "Manager is blocked until Cashier C6" rule is **replaced** — Cashier C3 is
  authorized in parallel and the Manager track is unblocked.

**This document has not been rewritten.** It is a condensed lifecycle; the **fuller** version is
[`Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_LIFECYCLE.md`](../../Front%20End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_LIFECYCLE.md)
(~4× longer), which is authoritative on edge cases, blocked states, and the full action contract.
Nothing below is live-verified against today's backend — that is **M-P0's** job.

---

## 1. Manager Login & Session
- **Authentication Routes**: The Manager authenticates at `http://localhost:3000/login` via either:
  1. **Email & Password**: `manager@nimbus.demo` / `Demo1234!` (or local seed `manager@demo.local` / `Manager#123`).
  2. **Quick PIN**: 8-digit high-tier PINs `11223344` (or local seed `12345678`).
- **Token Capture**: On success, the API returns a JWT access token and a refresh token.
- **Session Verification**: The frontend parses the `/api/auth/me` context to verify the role matching:
  - Job role `MANAGER` is present.
  - Organization ID is present.
  - Active branch ID is set (retrieved from `context.defaultBranchId` or fallbacks).
- **Redirection**: Redirects to the Manager workspace landing path `/manager/overview` (to be created in Prompt 1).

---

## 2. Branch Context & Switching
- **Initialization**: On landing, the app loads `localStorage.getItem("station_branch_id")` or resolves `context.defaultBranchId` from `me`.
- **Multi-Branch Membership**: Since managers have multi-branch memberships (e.g. `MAIN` and `DOWNTOWN` in demo data), the header dropdown lists all branches from `me.memberships`.
- **Switch Context**: Switching branches:
  1. Updates the selected `branchId` in the local React Context.
  2. Commits the new `branchId` to `localStorage` under `station_branch_id`.
  3. Re-fetches all branch-scoped queries (overview metrics, staff listings, active orders, and reports).

---

## 3. Overview Lifecycle
- **Mount**: The page `/manager/overview` mounts.
- **Readiness check**: Validates that an active shift and till are open (informs the manager of cashier coverage).
- **Queries**:
  - `GET /api/dash/manager` (aggregate metrics: gross/net sales, active tills, open orders count, anomaly counts).
  - `GET /api/stream/metrics` (subscribes to Server-Sent Events to keep overview metrics refreshed every 15s).
- **State Updates**: Updates key dashboard counters in real-time. No write mutations are triggered from this dashboard.

---

## 4. Operations Oversight Lifecycle
- **Oversight Scope**: The Manager has read-only access to branch floor layouts, orders queue, reservations list, and till session statuses.
- **Real-Time Polling**: Operational lists utilize React Query to poll endpoints (e.g. `GET /api/pos/orders`, `GET /api/tills`) to provide real-time updates.
- **Table Seating Handoff**: Clicking on active tables links directly to details in the reservation list, and vice versa.
- **State Actions**: The manager does not act as a waiter or cashier. They do not build orders or ring up payments, but can inspect all active lines.

---

## 5. Staff Oversight Lifecycle
- **List & Detail**: Managers view lists of employees, clock-in history, shift logs, leave requests, and shift swaps.
- **Onboarding**: Managers can onboard frontline staff via `POST /api/hr/frontline-staff/onboard`.
- **Quick PIN Admin**:
  - Fetch PIN status via `GET /api/hr/frontline-staff/:id/quick-pin-status`.
  - Reset, disable, or enable PINs via POST/PATCH writes.
- **Leave & Swap Decisions**: Managers review requests (`PATCH /api/hr/leave/:id/review` and `PATCH /api/hr/shift-swaps/:id/approve`), writing comments and resolving pending states.
- **Sensitivity Policy**: Compensation metrics (`compensationProfiles` or contracts) are omitted from the UI to protect sensitive payroll details from being exposed on shared devices.

---

## 6. Reports Lifecycle
- **Catalog Load**: Fetches `GET /api/reports/catalog` to see available report templates.
- **Report Generation**:
  - The Manager triggers report creation by sending a POST request to `/api/reports/<report-type>` (e.g. `shift-end`, `daily-sales`, `payment-mix`, `stock-variance`, `anomaly-summary`).
  - The backend generates the report payload asynchronously and saves it as a `ReportRun` record.
- **History View**: The UI polls `GET /api/reports` to list runs. Clicking a report fetches `GET /api/reports/:id` and renders the JSON summary in a readable table layout.
- **Export & Download**:
  - Manager clicks "Export (PDF/CSV)".
  - Triggers `POST /api/reports/export`.
  - Downloads the generated file via `GET /api/reports/exports/:id/download`.

---

## 7. Settings Visibility Lifecycle
- **Branch Settings**: Read branch profile details (`GET /api/branches`). Edit profile information (address, phone) using `PATCH /api/branches/:id`.
- **Device Registry**:
  - View device status via `GET /api/devices`.
  - Register new device slots (`POST /api/devices/activate`).
  - Config printer routes (`POST /api/devices/printers/routes`).
  - Initiate stub card terminal pairing (`POST /api/devices/terminals/pair`).
- **Exclusions**: Managers cannot edit global billing subscriptions, franchise configurations, SaaS packages, or developer settings.

---

## 8. Escalation & Approval Lifecycle
- **Approvals Inbox**: Re-queries `GET /api/approvals` for pending tasks.
- **Escalation Decisions**:
  - Refunds, high-value voids, and discount approvals appear as pending rows.
  - Selecting a row fetches detail.
  - Confirming with a manager action calls `POST /api/approvals/:id/decide` (or domain-specific paths) to commit the decision.
  - Invalidates the active order, payment, and approval query families.

---

## 9. Me / Logout Lifecycle
- **Identity Display**: Renders the Manager profile card (Name, Role, Branch Context, linked employee code).
- **Session Cleanup**: Clicking logout calls `POST /api/auth/logout`, clears tokens from memory and environment, deletes `station_branch_id` from localStorage (optional, based on station persist rules), and routes the browser back to `/login`.

---

## 10. Deferred Owner / Admin Lifecycle
- **Franchise & SaaS**: SaaS billing settings, subscription invoices, global tenant configuration, franchise-wide reports consolidation, and developer API keys are out of scope for the branch Manager workspace. These screens do not render paths, layouts, or menus.
