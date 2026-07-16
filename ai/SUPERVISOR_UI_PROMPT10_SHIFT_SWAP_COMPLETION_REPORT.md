# Supervisor UI Prompt 10 Shift Swap Completion Report

Date: 2026-07-06  
Repo: `C:\Users\arman\Desktop\nimbus-pos`  
Result: `SUPERVISOR_UI_PROMPT10_SHIFT_SWAP partial / selector contract required`

## 1. Context snapshot

`ai/AI_STATUS.md` started this prompt at `SUPERVISOR_UI_PROMPT9_LEAVE_REQUEST complete / shift-swap action pending`. Prompt 9 left shift-swap creation disabled because a safe target employee/shift selector contract was not verified.

## 2. Repo path confirmed

Used only `C:\Users\arman\Desktop\nimbus-pos`. Did not use `C:\Users\arman\Desktop\NIMBUS\nimbus-pos`.

## 3. Codex skills read

Read and applied: `vercel:investigation-mode`, `impeccable`, `frontend-design`, `make-interfaces-feel-better`, `web-design-guidelines`, `browser:control-in-app-browser`, and `codex-security:fix-finding`.

## 4. Files read

Read required Supervisor reports Prompts 0-9, API startup QA report, root Supervisor docs, fallback `Front End/supervisor_ui_docs_pack` docs, governance docs, Postman collections inventory, package scripts, HR/attendance/auth/employee/scheduling backend files, Prisma schema, demo data files, and Supervisor frontend workforce/me/context files.

Key contract files read included:

- `apps/api/src/modules/attendance/attendance.controller.ts`
- `apps/api/src/modules/attendance/attendance.service.ts`
- `apps/api/src/modules/attendance/dto.ts`
- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/workforce/workforce.controller.ts`
- `apps/api/src/modules/workforce/workforce.service.ts`
- `packages/db/prisma/schema.prisma`
- `demo-data/DEMO_LOGIN_CREDENTIALS.md`
- `demo-data/*.csv` files for employees, shifts, shift swaps, and schedule assignments
- `apps/web/src/lib/supervisor/workforce.ts`
- `apps/web/src/components/supervisor/me/SupervisorMeScreen.tsx`

## 5. Files changed

- `apps/api/src/modules/attendance/attendance.service.ts`
- `apps/api/src/modules/attendance/attendance.service.spec.ts`
- `apps/web/src/components/supervisor/me/SupervisorMeScreen.tsx`
- `docs/supervisor-ui-docs/SUPERVISOR_GAP_REGISTER.md`
- `ai/AI_STATUS.md`
- `ai/SUPERVISOR_UI_PROMPT10_SHIFT_SWAP_COMPLETION_REPORT.md`
- `repo file tree.txt`

## 6. Shift-swap API contract verification

Verified route: `POST /api/hr/shift-swaps`.

Permission: `pos:hr:shift-swaps:create`.

DTO fields:

- `requesterEmployeeId`: required string
- `targetEmployeeId`: required string
- `shiftDate`: required ISO date string
- `reason`: optional string, max length 1000

Response is a `ShiftSwapRequest` record. Status defaults to `PENDING`. No `sourceShiftId`, `targetShiftId`, open-shift id, idempotency key, `branchId`, or `orgId` field is accepted in the DTO.

## 7. Shift-swap ownership/security findings

Pre-prompt finding: create trusted same-org `requesterEmployeeId` and `targetEmployeeId` too broadly. A permitted user could submit a swap for another same-org employee.

Backend hardening added:

- requester employee must be linked to the authenticated `userId`
- requester must belong to active branch/org
- target must belong to active branch/org
- requester must have a published roster assignment on `shiftDate`
- target must have a published roster assignment on `shiftDate`

Focused tests now verify requester ownership rejection, requester/target branch rejection, missing requester assignment, missing target assignment, and duplicate-pending behavior.

## 8. Source shift selector findings

No dedicated Supervisor-safe eligible source shift selector exists. `GET /api/workforce/roster` can read schedule rows, but it is not a narrow self-service eligible-source contract and the shift-swap DTO only accepts `shiftDate`, not a source assignment or shift id.

## 9. Target selector findings

No Supervisor-safe eligible target/open-shift selector was verified. The create DTO still requires `targetEmployeeId`, and using a broad employee list or arbitrary employee-id input is not allowed for Supervisor v1.

## 10. Shift-swap create implementation or deferral

Backend create was hardened. Frontend shift-swap creation remains disabled because the safe eligible shift/target selector contract is still missing.

## 11. Shift-swap form validation

No shift-swap creation form was enabled. The existing disabled state was updated to explain that shift-swap request creation requires a verified eligible shift/target selector and that broad staff selection is not exposed.

## 12. Shift-swap list refresh behavior

The existing read-only list remains on `GET /api/hr/shift-swaps?mine=true&take=10`. No mutation is wired, so no create-success refresh path was added.

## 13. Leave regression status

Leave creation code was not changed. HTTP smoke verified `GET /api/hr/leave?mine=true&take=10` still succeeds, and frontend validation/build passed.

## 14. Frontend changes

Only Supervisor Me shift-swap disabled-state copy changed. No broad staff selector, no target employee input, no approval/rejection controls, and no fake shift rows were added.

## 15. Backend changes if any

`AttendanceService.createShiftSwap` now enforces linked requester ownership, branch scope, and published roster assignments for requester and target before creating/auditing a swap.

## 16. Postman status

Postman collections were read/inventoried. No Postman JSON changed because no endpoint path or DTO payload shape changed.

## 17. HTTP/browser QA result

Browser skill was read. HTTP smoke used temporary compiled API and production web servers, then stopped only the started processes.

Results:

- `/api/health`: `status=ok`, `db=ok`
- Supervisor login: token returned for `supervisor@nimbus.demo`
- `/api/auth/me`: returned EMP-004 / Peter Mugisha
- `GET /api/hr/shift-swaps?mine=true&take=10`: succeeded, returned 0 rows in this demo context
- `GET /api/hr/leave?mine=true&take=10`: succeeded, returned 1 row
- Web routes returned 200: `/supervisor/me`, `/supervisor/floor`, `/supervisor/orders`, `/supervisor/reservations`, `/supervisor/approvals`, `/waiter/me`, `/cashier/me`

No shift-swap create mutation was executed because the selector contract remains blocked.

## 18. Waiter/Cashier regression status

HTTP smoke returned 200 for `/waiter/me` and `/cashier/me`. No Waiter or Cashier source files were changed.

## 19. Security/privacy boundaries preserved

No broad staff directory, payroll fields, compensation, bank/tax details, global approvals, receipt/device admin, accounting, billing, franchise, developer, cashier checkout, or waiter order-entry surfaces were exposed.

## 20. Deferred surfaces preserved

Shift-swap approval/rejection remains outside Supervisor Me. Leave approval/rejection remains outside Me. Payroll, accounting, billing, franchise, developer, receipt/device admin, hardware, provider traffic, and global approvals remain deferred/excluded.

## 21. Validation performed

Passed:

- `corepack pnpm@8.15.0 --version`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/api test -- attendance.service.spec.ts`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/api build`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web build`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate`

No migrations, seed, demo import, or Newman run was performed.

## 22. Issues/blockers

Shift-swap frontend create remains blocked by missing Supervisor-safe eligible source/target selector contracts. The demo Supervisor's default membership branch and linked employee branch still differ, which also means blind branch-context shift-swap creation would be unsafe.

One HTTP smoke attempt failed before startup because PowerShell cannot redirect stdout and stderr to the same file in `Start-Process`; retried with separate log files and passed.

## 23. Recommended next prompt

Supervisor Prompt 11 should define and implement a narrow eligible shift-swap selector contract, preferably a backend endpoint that returns only the authenticated employee's eligible source assignments and eligible same-branch targets/open shifts without exposing a broad staff directory.

## 24. DONE checks

- used only `C:\Users\arman\Desktop\nimbus-pos`
- protected unrelated dirty/untracked worktree changes
- read Prompt 9 and Prompt 8 reports
- read all required Supervisor reports
- read shift-swap controller/service/DTO
- read shift/source/target selector contracts
- read employee/auth relation
- read frontend Supervisor workforce files
- read required Codex skills
- verified shift-swap create endpoint and DTO fields
- verified and hardened ownership/scope enforcement
- documented missing source and target selector contracts
- did not guess or hardcode employee IDs in UI
- did not expose broad staff list or payroll fields
- kept shift-swap create disabled because selector contract is unsafe/missing
- kept shift-swap approval/rejection out of Me
- preserved leave creation
- added no staff/admin/payroll/accounting/billing/franchise/developer/global approval/receipt/device UI
- changed no schema, migrations, seed, demo import, or Postman JSON
- ran web typecheck, web lint, API build, web build, targeted API tests, zero-write demo validation, and HTTP route smoke
