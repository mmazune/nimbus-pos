# Supervisor UI Prompt 8 - Employee Identity Contract / Punch Enablement Completion Report

## 1. Context snapshot

- Previous status: `SUPERVISOR_UI_PROMPT7_ME_WORKFORCE complete / action workflows pending`.
- Prompt 8 goal: verify and expose a safe current-user employee identity contract, then enable Supervisor punch only if server-side ownership was safe.
- Scope held: employee identity plus self-punch only. Leave creation and shift-swap creation remain deferred.

## 2. Repo path confirmed

- Active repo: `C:\Users\arman\Desktop\nimbus-pos`.
- Did not use or edit `C:\Users\arman\Desktop\NIMBUS\nimbus-pos`.
- Existing worktree was already dirty; unrelated modified/untracked files were preserved.

## 3. Codex skills read

- `vercel:investigation-mode`
- `impeccable`
- `frontend-design`
- `make-interfaces-feel-better`
- `web-design-guidelines`
- `browser:control-in-app-browser`

## 4. Files read

- Mandatory context: `ROADMAP.md`, `repo file tree.txt`, `ai/AI_CONTEXT.md`, `ai/AI_STATUS.md`, `ai/AI_ERROR_PROTOCOL.md`, `ai/AI_COMPLETION_REPORT_TEMPLATE.md`, `docs/ARCHITECTURE.md`, `docs/API_CONVENTIONS.md`, `docs/POSTMAN_ENDPOINT_GUIDE.md`.
- Postman inventory: all existing files under `postman/collections/`; M24 attendance/leave/shift-swap collection inspected for HR contracts.
- Supervisor context: Prompt 1-7 reports, API startup/floor QA report, repo verification, gap matrix, API matrix, gap register, fallback lifecycle/design docs.
- Code contracts: auth `/me`, attendance controller/service/DTOs/specs, HR controller/service/DTOs, Prisma Employee/Attendance/Leave/ShiftSwap models, seed/demo employee linkage, Supervisor context/workforce/Me UI, Waiter/Cashier Me patterns.

## 5. Files changed

- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/me-membership-context.spec.ts`
- `apps/api/src/modules/attendance/attendance.service.ts`
- `apps/api/src/modules/attendance/attendance.service.spec.ts`
- `apps/web/src/lib/auth/types.ts`
- `apps/web/src/lib/supervisor/context.ts`
- `apps/web/src/lib/supervisor/workforce.ts`
- `apps/web/src/lib/waiter/me-model.ts`
- `apps/web/src/components/supervisor/me/SupervisorMeScreen.tsx`
- `ai/AI_STATUS.md`
- `docs/supervisor-ui-docs/SUPERVISOR_GAP_REGISTER.md`
- `repo file tree.txt`
- `ai/SUPERVISOR_UI_PROMPT8_EMPLOYEE_IDENTITY_PUNCH_COMPLETION_REPORT.md`

## 6. Employee identity contract findings

- Prisma already has a safe one-to-one link: `Employee.userId` is optional and unique.
- Demo data links `supervisor@nimbus.demo` to employee `EMP-004` / Peter Mugisha.
- Safe fields are employee id, employee code, name, status, org id, branch id, and position label/code.
- Sensitive fields excluded: compensation, payroll profile, bank/tax data, address, phone/email, date of birth, emergency contact, notes, contracts, and arbitrary metadata.

## 7. Auth/me or employee endpoint implementation

- Extended `GET /api/auth/me` response with `employee`.
- The field is returned only when an employee is linked to the current user and belongs to the current organization context.
- No new endpoint was added because `/api/auth/me` is already the authenticated session/context contract used by the frontend.

## 8. Attendance clock security findings

- Before this pass, `POST /api/hr/attendance/clock` accepted any same-org `employeeId` supplied by a permitted user.
- That was not safe enough for Supervisor self-punch enablement.
- `AttendanceService.clockInOut` now rejects clock attempts unless the target employee is linked to the authenticated user.

## 9. Punch enablement or deferral

- Punch is enabled in `/supervisor/me` only when the user is a Supervisor, has branch context, has the linked `employee.id`, and has `pos:hr:attendance:clock`.
- Punch requires a confirmation dialog before mutation.
- The mutation refreshes Supervisor attendance history after success.

## 10. Leave/shift swap deferral update

- Leave creation remains disabled.
- Shift-swap creation remains disabled.
- Reason: safe leave form rules and safe target employee selector are outside Prompt 8.

## 11. Frontend context updates

- Added typed `AuthEmployeeIdentity`.
- Supervisor workspace context now carries employee id, label, code, branch, status, and job role.
- `resolveSupervisorEmployeeIdentity` now marks identity write-safe only when `/api/auth/me.employee.id` exists.
- Waiter Me keeps its older employee-id resolution path so this Supervisor pass does not accidentally enable Waiter punch.

## 12. Backend changes if any

- `AuthService.me` selects a minimal employee identity by `userId`.
- `AttendanceService.clockInOut` enforces current-user employee ownership with `ForbiddenException`.
- Added unit coverage for the `/auth/me` employee identity shape and forbidden cross-employee clock attempts.

## 13. Postman status

- Existing collections were read/inventoried as required.
- No Postman collection was changed because this was not a new milestone endpoint set and no endpoint path or payload contract changed for collection consumers.

## 14. HTTP/browser QA result

- `GET /api/health` returned `status: ok`, `db: ok`.
- `supervisor@nimbus.demo` login succeeded and `/api/auth/me` returned `employeeCode: EMP-004`, `displayName: Peter Mugisha`, `status: ACTIVE`.
- `GET /api/hr/attendance?mine=true` returned the expected `data,total` shape.
- HTTP route smoke returned 200 for `/supervisor/me`, `/supervisor/floor`, `/supervisor/orders`, `/supervisor/reservations`, `/supervisor/approvals`, `/waiter/me`, and `/cashier/me`.
- Full interactive browser click-through was not completed in this pass; route/API smoke and builds passed.

## 15. Waiter/Cashier regression status

- Waiter employee-id resolution was intentionally kept on the prior fields only.
- `GET /waiter/me` route smoke returned 200.
- `GET /cashier/me` route smoke returned 200.
- Web typecheck, lint, and build passed.

## 16. Security/privacy boundaries preserved

- No payroll, compensation, tax, bank, emergency contact, contract, note, or broad HR profile data is exposed through `/api/auth/me`.
- Attendance punch now uses server-side ownership enforcement, not only frontend button gating.
- No admin employee selector or broad employee write UI was added.

## 17. Deferred surfaces preserved

- No Prisma schema, migration, seed, demo import, package, or Postman changes.
- No hardware, MSR, smart spout, provider, accounting, billing, franchise, developer portal, admin HR, payroll, pay-run, receipt, device, or broad reporting surface was pulled forward.

## 18. Validation performed

- `corepack pnpm@8.15.0 --filter @nimbus-pos/api test -- attendance.service.spec.ts me-membership-context.spec.ts`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/api build`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web build`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate`
- API and route HTTP smoke checks listed above.

## 19. Issues or blockers

- The seeded Supervisor employee branch differs from the default membership branch, so the identity contract does not claim branch equality.
- A duplicate API startup attempt hit `EADDRINUSE` while another API listener was already serving traffic.
- A read-only attendance smoke initially failed because the request used unsupported `limit`; rerun without `limit` passed.
- Legacy E2E tests that assume admin-style arbitrary employee punching may need a follow-up split between self-clock and admin-clock contracts.

## 20. Recommended next prompt

- Supervisor UI Prompt 9: safe leave request creation with DTO-backed form rules, confirmation, audit-aware copy, and no shift-swap target selector yet.

## 21. DONE checks

- Employee identity verified and exposed safely.
- Attendance self-clock ownership enforced server-side.
- Supervisor punch enabled only under safe identity, branch, role, and permission conditions.
- Leave and shift-swap creation remain deferred.
- Validation and HTTP smoke completed.
- Status, gap register, file tree, and completion report updated.
