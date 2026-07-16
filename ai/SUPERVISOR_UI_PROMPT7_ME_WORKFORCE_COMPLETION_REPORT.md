# Supervisor UI Prompt 7 - Me / Punch / Workforce Self-Service Completion Report

## 1 Context snapshot

- Current status before this prompt: Supervisor Prompt 6 Approvals complete; Me and punch build pending.
- Prompt 7 scope: frontend-only Supervisor Me, punch readiness, attendance history, leave self-service, shift-swap self-service, session/profile/readiness, boundaries, and limitations.
- Mandatory build order adapted to allowed scope: context/API verification -> client API helpers -> page/component implementation -> validation -> docs/status/report.
- Backend business logic, Prisma schema, migrations, seeds/demo import, package files, and Postman were out of scope and were not changed.

## 2 Repo path confirmed

- Confirmed active workspace: `C:\Users\arman\Desktop\nimbus-pos`.
- Did not use or edit any old `NIMBUS` path.
- Existing worktree was already very dirty before this prompt; unrelated modified/untracked files were preserved.

## 3 Codex skills read

- `emil-design-eng`: used for interface polish, clarity, and interaction feel.
- `frontend-design`: used for production-grade frontend composition and domain-appropriate UI.
- `make-interfaces-feel-better`: used for state handling, disabled-action clarity, and responsive control polish.
- `impeccable`: used for audit/polish framing; project-level product docs were missing in the primary repo, so Supervisor docs were used as the source of truth.
- `web-design-guidelines`: used for accessibility and web UI review guidance.

## 4 Files read

- Mandatory governance/context: `ROADMAP.md`, `repo file tree.txt`, `ai/AI_CONTEXT.md`, `ai/AI_STATUS.md`, `ai/AI_ERROR_PROTOCOL.md`, `ai/AI_COMPLETION_REPORT_TEMPLATE.md`, `docs/ARCHITECTURE.md`, `docs/API_CONVENTIONS.md`, `docs/POSTMAN_ENDPOINT_GUIDE.md`.
- Postman: existing collections under `postman/collections/` were inventoried/sketched before implementation; M24 HR collection was inspected for the attendance/leave/shift-swap contract.
- Supervisor docs/reports: Prompt 1-6 reports, API startup/floor QA report, repo verification, gap matrix, research report, implementation roadmap, root Supervisor API matrix, root gap register, and fallback design/lifecycle docs from `Front End/supervisor_ui_docs_pack/docs/supervisor-ui-docs/`.
- Frontend/backend contract files: Supervisor shell/context/permissions/routes/state, Waiter Me patterns, Cashier Me patterns, auth provider/types/api, HR attendance controller/service/DTOs, auth controller/service `/me`, Prisma employee/attendance/leave/shift-swap models/enums, and seed employee snippets.

## 5 Files changed

- Added `apps/web/src/lib/supervisor/workforce.ts`.
- Added `apps/web/src/components/supervisor/me/SupervisorMeScreen.tsx`.
- Added `apps/web/src/components/supervisor/me/index.ts`.
- Updated `apps/web/src/pages/supervisor/me.tsx`.
- Updated `ai/AI_STATUS.md`.
- Updated `repo file tree.txt`.
- Added `ai/SUPERVISOR_UI_PROMPT7_ME_WORKFORCE_COMPLETION_REPORT.md`.

## 6 Workforce API contract verification

- Verified M24 HR Postman and backend controllers expose:
  - `POST /api/hr/attendance/clock`
  - `GET /api/hr/attendance`
  - `POST /api/hr/leave`
  - `GET /api/hr/leave`
  - `PATCH /api/hr/leave/:id/review`
  - `POST /api/hr/shift-swaps`
  - `GET /api/hr/shift-swaps`
  - `PATCH /api/hr/shift-swaps/:id/approve`
- Verified self-scope reads support `mine=true`.
- Verified write DTOs require explicit employee identifiers.

## 7 Employee identity resolution findings

- `/api/auth/me` exposes user, roles, permissions, memberships, context, and session data.
- `/api/auth/me` does not expose a verified `employeeId`.
- `Employee.userId` exists in Prisma but is optional and was not safely available in current frontend auth context.
- HR `mine=true` reads can resolve by actor user on the backend, but write DTOs still require explicit employee IDs.
- Result: read-only self-scope workforce history is enabled; punch/leave/swap write actions are disabled until current-user employee identity is verified.

## 8 Workforce API/client implementation

- Added typed Supervisor workforce client helpers for attendance, leave, and shift swaps.
- Added normalization helpers for attendance records, leave requests, shift swaps, punch state, and status labels.
- Added write helper functions for future use, but the current UI does not wire them because write-safe identity resolution is not available.
- Fetch URLs use the verified `/api/hr/...` routes and branch-aware auth request pattern.

## 9 Me page implementation

- `/supervisor/me` now renders `SupervisorShell` plus `SupervisorMeScreen`.
- The page uses real Supervisor context, active auth state, role/membership information, branch/org context, and React Query.
- The page contains no fake employee rows, no fabricated punch state, and no placeholder data pretending to be live.

## 10 Profile/session/readiness implementation

- Profile card shows current user identity, role, branch, organization, membership, and workstation context from existing auth/Supervisor state.
- Session card shows session id, platform/source where available, created/last-activity values, roles, orgs, branches, and active state.
- Readiness card shows active shift readiness plus verified navigation scope for Floor, Orders, Reservations, Approvals, and workforce self-scope reads.

## 11 Punch/attendance handling

- Attendance reads call `GET /api/hr/attendance?mine=true&take=10`.
- Current punch state is derived from returned attendance rows.
- Punch action is visibly disabled when no verified current-user employee ID exists.
- Attendance history renders loading, error, empty, and populated states.

## 12 Leave handling

- Leave reads call `GET /api/hr/leave?mine=true&take=10`.
- Leave request creation UI is disabled with a clear reason when employee identity is unavailable.
- Leave history renders loading, error, empty, and populated states.

## 13 Shift swap handling

- Shift-swap reads call `GET /api/hr/shift-swaps?mine=true&take=10`.
- Shift-swap creation UI is disabled with a clear reason when employee identity/selector requirements are not verified.
- Shift-swap history renders loading, error, empty, and populated states.

## 14 Mutation enablement or deferral reasons

- Punch mutation deferred because `ClockAttendanceDto` requires `employeeId`.
- Leave mutation deferred because `CreateLeaveRequestDto` requires `employeeId`.
- Shift-swap mutation deferred because `CreateShiftSwapDto` requires `requesterEmployeeId` and `targetEmployeeId`.
- No frontend mutation was wired without a verified employee identity source.

## 15 Restricted surfaces and known limitations

- The Me page explicitly preserves restrictions around global approvals, receipts, devices, accounting, billing, franchise, developer tools, payroll/pay runs, staff admin, cashier checkout, waiter menu entry, MTN/Airtel, PesaPal diner checkout, printer driver, and acquirer/card-terminal surfaces.
- Known limitations include slow/quiet Nest watch startup, browser attach timeout risk, no verified pending refund queue, no verified post-close void candidate queue, and disabled workforce write actions until employee identity is exposed safely.

## 16 Error/empty/blocked states

- Auth errors clear the session through existing auth handling.
- HR list fetch failures render retry-friendly error states.
- Empty attendance/leave/shift-swap results render honest empty copy.
- Blocked actions render disabled controls with nearby reason text rather than silently hiding the limitation.

## 17 Browser/HTTP QA result

- HTTP route smoke passed with a temporary local web dev server:
  - `/login` returned 200.
  - `/supervisor/me` returned 200.
  - `/supervisor/floor` returned 200.
  - `/supervisor/orders` returned 200.
  - `/supervisor/reservations` returned 200.
  - `/supervisor/approvals` returned 200.
  - `/waiter/me` returned 200.
  - `/cashier/me` returned 200.
- Temporary web server processes/logs were stopped/removed.
- Authenticated browser visual QA was not completed in this prompt.

## 18 Waiter/Cashier regression status

- No Waiter route/page logic was changed.
- No Cashier route/page logic was changed.
- HTTP smoke confirmed `/waiter/me` and `/cashier/me` still serve successfully.

## 19 Role boundaries preserved

- Supervisor shell/guard boundaries remain intact.
- The page uses Supervisor context and does not grant Waiter, Cashier, Owner, Accountant, or Admin-only workflows.
- Protected actions remain read-only or disabled unless the underlying verified contract supports them safely.

## 20 Deferred surfaces preserved

- No deferred hardware/provider work was pulled forward.
- MSR/badge login, smart spouts, live printer drivers, card terminals, provider settlement, accounting execution, billing/admin/developer/franchise surfaces, payroll execution, receipts/devices, and full accounting work remain deferred/out of Prompt 7 scope.

## 21 Validation performed

- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` passed with no warnings after fixing a memo dependency warning.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/api build` passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web build` initially timed out when run during concurrent work; after applying the error protocol and rerunning in isolation, it passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate` passed with zero database writes.
- HTTP smoke passed for Supervisor, Waiter, Cashier, and login routes listed above.

## 22 Issues or blockers

- Current-user employee ID is not exposed by `/api/auth/me`; this blocks safe punch, leave-create, and shift-swap-create wiring.
- Authenticated visual browser QA was not completed.
- The repo has substantial pre-existing unrelated dirty/untracked files; this prompt preserved them and only added/updated the Prompt 7 files listed above.

## 23 Recommended next prompt

- Add a verified current-user employee identity contract, preferably backend-owned, then wire Supervisor punch, leave request creation, and shift-swap request creation behind that contract.
- Keep the next step narrow: expose/verify identity first, then enable one mutation family at a time with tests and Postman updates.

## 24 DONE checks

- DONE: Repo path confirmed as `C:\Users\arman\Desktop\nimbus-pos`.
- DONE: Mandatory context and Postman contract review completed before edits.
- DONE: Frontend-only implementation completed.
- DONE: No backend business logic, Prisma schema, migrations, seed/demo import, package files, or Postman collections changed by this prompt.
- DONE: No fake operational data added.
- DONE: Workforce reads use verified HR APIs.
- DONE: Unsafe workforce writes are disabled with explicit reasons.
- DONE: Supervisor role boundaries and deferred surfaces preserved.
- DONE: Typecheck, lint, API build, web build, zero-write demo validation, and HTTP smoke passed.
- DONE: `ai/AI_STATUS.md`, `repo file tree.txt`, and this completion report were updated.
