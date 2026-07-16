# Manager UI Repository Verification Report

---

## 1. Context Snapshot
- **Date**: 2026-07-06
- **Current Role-Build State**: Waiter MVP (demo-ready), Cashier MVP (demo-ready), Supervisor UI (final QA complete / demo-ready).
- **Next Workspace**: Manager / Branch Manager workspace shell foundation.

## 2. Repo Path Confirmed
- **Verified path**: `C:\Users\arman\Desktop\nimbus-pos` (Active)
- **Stale path avoided**: `C:\Users\arman\Desktop\NIMBUS\nimbus-pos`

## 3. Codex Skills Read
The following installed codex skills were read and applied during investigation:
1. `investigation-mode`
2. `impeccable`
3. `frontend-design`
4. `make-interfaces-feel-better`
5. `web-design-guidelines`

## 4. Files Read
- `ai/AI_STATUS.md`
- `README.md`
- `ROADMAP.md`
- `repo file tree.txt`
- `demo-data/DEMO_LOGIN_CREDENTIALS.md`
- `package.json`
- `pnpm-workspace.yaml`
- `apps/api/package.json`
- `apps/web/package.json`
- `packages/db/package.json`
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/seed.ts`
- `apps/web/src/pages/login.tsx`
- `apps/web/src/lib/auth/role.ts`
- `apps/web/src/components/supervisor/shell/SupervisorShell.tsx`
- `apps/web/src/components/supervisor/shell/SupervisorSessionGuard.tsx`
- `apps/api/src/modules/dashboards/dashboards.controller.ts`
- `apps/api/src/modules/dashboards/dashboards.service.ts`
- `apps/api/src/modules/reports/reports.controller.ts`
- `apps/api/src/modules/hr/hr.controller.ts`
- `apps/api/src/modules/attendance/attendance.controller.ts`
- `apps/api/src/modules/unified-approvals/unified-approvals.controller.ts`
- `apps/api/src/modules/unified-approvals/approval-source.types.ts`
- `apps/api/src/modules/device-registry/device-registry.controller.ts`
- `apps/api/src/modules/audit-timeline/audit-timeline.controller.ts`

## 5. Files Changed / Created
- `docs/manager-ui-docs/README.md`
- `docs/manager-ui-docs/MANAGER_API_MATRIX.md`
- `docs/manager-ui-docs/MANAGER_GAP_REGISTER.md`
- `docs/manager-ui-docs/MANAGER_LIFECYCLE.md`
- `ai/MANAGER_UI_REPO_VERIFICATION_REPORT.md` (This file)
- `ai/MANAGER_UI_SCOPE_AND_NAV_RECOMMENDATION.md`
- `ai/AI_STATUS.md` (To be updated)
- `repo file tree.txt` (To be updated)

### Unrelated Dirty Worktree Content (Preserved)
- `ai/AI_STATUS.md`
- `apps/api/src/main.ts`
- `apps/api/src/modules/attendance/attendance.controller.ts`
- `apps/api/src/modules/attendance/attendance.service.spec.ts`
- `apps/api/src/modules/attendance/attendance.service.ts`
- `apps/api/src/modules/attendance/dto/list-attendance-query.dto.ts`
- `apps/api/src/modules/attendance/dto/list-leave-query.dto.ts`
- `apps/api/src/modules/attendance/dto/list-shift-swaps-query.dto.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/me-membership-context.spec.ts`
- `apps/api/src/modules/orders/dto/list-orders-query.dto.ts`
- `apps/api/src/modules/orders/orders.controller.ts`
- `apps/api/src/modules/orders/orders.service.ts`
- `apps/api/src/modules/reservations/reservations.service.ts`
- `apps/web/package.json`
- `package.json`
- `packages/db/package.json`
- `packages/db/prisma/seed.ts`
- `pnpm-lock.yaml`
- `postman/collections/BG4B-Pos-Order-Handoff.postman_collection.json`
- `postman/collections/M10-POS-Orders.postman_collection.json`
- `postman/collections/M16-Reservations-Deposits-Seating.postman_collection.json`
- `postman/collections/M24-Attendance-Leave-Shift-Swaps.postman_collection.json`
- `repo file tree.txt`

## 6. Role Identity Findings
- The system role is named `Manager` in seed data (`roleName: 'Manager'`), corresponding to the enum value `JobRole.MANAGER`.
- There is no `BRANCH_MANAGER` enum value in `JobRole` or the schema.
- **Scope**: Most API endpoints are branch-scoped (`BranchContextGuard`). However, Manager users are seeded with org-level visibility across multiple branches (e.g. `MAIN` and `DOWNTOWN`), meaning the UI will need a branch switcher context.

## 7. Demo Credential Findings
- **Manager Account 1**:
  - Name: Daniel Okello
  - Email: `manager@nimbus.demo`
  - Password: `Demo1234!`
  - Quick PIN: `11223344` (HIGH_8)
  - Branch: Tapas Downtown
- **Manager Account 2 (Seed Fallback)**:
  - Name: Demo Manager
  - Email: `manager@demo.local`
  - Password: `Manager#123`
  - Quick PIN: `12345678` (HIGH_8)
  - Branch: Main Branch

## 8. Permission Map
- **Branch Operations**: `pos:floor:read`, `pos:table:read`, `pos:orders:read`, `pos:shift:read`, `pos:till:read`, `pos:reservation:read`.
- **Staff / HR**: `pos:hr:employees:read/create/update`, `hr:frontline-staff:create`, `auth:quick-pin:read/write`, `pos:hr:leave:read/review`, `pos:hr:shift-swaps:read/approve`.
- **Approvals**: `approvals:read`, `approvals:decide`, `pos:discount:approve`, `pos:refund:approve`, `pos:void:postclose`.
- **Reports**: Generates all daily, sales, payment mix, top items, variance, wastage, anomaly, and staff reports.
- **Settings**: `tenancy:branch:write`, `tenancy:settings:manage`, `devices:read/write/routes/terminals`.

## 9. Backend API Findings
- Mapped 50+ candidate endpoints spanning Dashboards, Orders, Unified Approvals, HR, Attendance, Reports, and Device/Branch Settings. See [MANAGER_API_MATRIX.md](file:///C:/Users/arman/Desktop/nimbus-pos/docs/manager-ui-docs/MANAGER_API_MATRIX.md).

## 10. Postman Inventory Findings
- The repository has 56 Postman collections under `postman/collections/`.
- Major manager-level logic is covered by:
  - `M19-Operational-Dashboards-KPI-Streams.postman_collection.json`
  - `M20-Reporting-v1-Exports.postman_collection.json`
  - `BG2-Unified-Approvals-And-Audit-Timeline.postman_collection.json`
  - `M24-Attendance-Leave-Shift-Swaps.postman_collection.json`
  - `M23-Employees-Contracts-HR-Core.postman_collection.json`
  - `M3_1-Quick-PIN-Login.postman_collection.json`
  - `BG1-Invitation-Password-Frontline-Onboarding.postman_collection.json`

## 11. Frontend Pattern Findings
- Waiter, Cashier, and Supervisor use Next.js Pages router (`apps/web/src/pages/<role>/*`).
- They utilize layout shells (`SupervisorShell`, `CashierShell`) enclosing top headers, bottom tabs, a session guard (`SupervisorSessionGuard`), and a readiness strip checking active shift and till statuses.

## 12. Manager-Safe Surfaces
- Overview dashboard summary.
- Active operations oversight (read-only floor, active orders, active tills, active shifts).
- Staff directory, frontline onboarding, Quick PIN reset/disable/enable.
- Leave & shift-swap approvals.
- Reports generation, history viewing, and Excel/PDF exporting.
- Branch profile edit, printer routes management, device status logs.

## 13. Forbidden Surfaces
- Access matrix role permission modifications (`identity:access-matrix:write`).
- SaaS organization profile billing and subscription creation (`tenancy:org:write`, SaaS subscription portal).
- Physical printer invocations and live terminal pairing.
- Payroll pay runs execution and employee compensation updates (contracts data should remain deferred).

## 14. Data Sensitivity Findings
- HR Compensation details (`pos:hr:compensation:read`) are flagged as highly sensitive.
- These fields must be skipped/hidden in the frontend employee view to prevent sensitive payroll leakage on restaurant POS devices.

## 15. Recommended Manager MVP Nav
1. **Overview**: Live branch summary indicators, open orders count, pending approvals, and low stock count.
2. **Operations**: Real-time read-only active floor, tills list, and active shifts tracker.
3. **Staff**: Staff directory, frontline onboarding, PIN resets, leave reviews, and shift swaps approvals.
4. **Reports**: Generated reports history log, report templates trigger form, and downloads list.
5. **Settings**: Branch metadata profiles, active devices register, and printer routing rules.
6. **Me**: Manager session profile card, active branch selector, and logout.

## 16. Recommended Implementation Sequence
1. **Prompt 1 — Shell & Guard Foundation**: Manager Bottom/Top Navigation, Context Provider (with multi-branch selector), `ManagerSessionGuard`, and routing fallback configuration.
2. **Prompt 2 — Overview Dashboard**: Connect `GET /api/dash/manager` and SSE streams to render branch gross/net sales, coverage alerts, and status cards.
3. **Prompt 3 — Operations Oversight**: Render read-only floors, orders table, tills table, and active shift tables.
4. **Prompt 4 — Staff Administration**: Roster directory list, frontline onboard form, and quick PIN administration modal.
5. **Prompt 5 — Approvals Inbox**: Connect the Unified Approvals list and decide drawer to decide on discounts, leave, and refunds.
6. **Prompt 6 — Reporting & Downloads**: Report catalog generation forms, report run status pollers, and file download streams.
7. **Prompt 7 — Settings & Devices**: Branch settings forms, device registry list, and printer routing configurations.
8. **Prompt 8 — Final QA & Walkthrough**: E2E validation, visual checks, and final verification report.

## 17. Known Gaps/Blockers
- **GAP-01**: Branch context dropdown switcher must be added to the Shell to support multi-branch managers.
- See full register in [MANAGER_GAP_REGISTER.md](file:///C:/Users/arman/Desktop/nimbus-pos/docs/manager-ui-docs/MANAGER_GAP_REGISTER.md).

## 18. Validation Performed
- `corepack pnpm@8.15.0 --version` => `8.15.0`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` => PASSED (No errors)
- `corepack pnpm@8.15.0 --filter @nimbus-pos/api build` => PASSED
- `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate` => PASSED (dry-run, zero database writes)

## 19. Recommended Next Prompt
- **Prompt 1**: Establish the Manager Shell foundation, dynamic branch context selector, `ManagerSessionGuard`, landing routes, and standard bottom tab navigation.

## 20. DONE Checks
- Confirmed use of `C:\Users\arman\Desktop\nimbus-pos`.
- Protected unrelated dirty files.
- Verified role identity and demo credentials.
- Created all 5 required documentation files under `docs/manager-ui-docs/` and `ai/`.
- Verified API matrix and gap registers.
