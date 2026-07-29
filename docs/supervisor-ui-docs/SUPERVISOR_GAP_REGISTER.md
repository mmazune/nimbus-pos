# Supervisor Gap Register

Status: final Supervisor QA closeout  
Date: 2026-07-06

## 2026-07-18 Reconstruction Supersession

This historical register is retained for the original Supervisor UI closeout. Current reconstruction scope is governed by `ai/SUPERVISOR_RECONSTRUCTION_REPO_VERIFICATION_REPORT.md`, `ai/SUPERVISOR_RECONSTRUCTION_GAP_REGISTER.md`, and the updated docs in this folder. The visible Supervisor nav is now Floor, Reservations, Approvals, Me. Orders is no longer a visible Supervisor nav tab; order work must enter from Floor after table selection, with a Floor-contained exception lookup path for tableless, takeaway, closed, direct-reference, and post-close review cases.

| ID | Area | Gap/Decision | Current Evidence | Status |
|---|---|---|---|---|
| SUP-GAP-001 | Role | Exact Supervisor role verified. | `JobRole.SUPERVISOR`, seed role `Supervisor` L3 | Closed |
| SUP-GAP-002 | Credentials | Demo credentials verified. | `supervisor@nimbus.demo`, `Demo1234!`, `22334455` | Closed |
| SUP-GAP-003 | Auth | Supervisor password/PIN login and workspace routing are implemented. | login routes Supervisor to `/supervisor/floor`; Supervisor guard protects `/supervisor/*` | Done |
| SUP-GAP-004 | Permissions | Supervisor has broad operational permissions. Must avoid UI scope creep. | seed role matrix | Closed with product constraints |
| SUP-GAP-005 | Nav | Approved nav is still safe if scoped carefully. | Floor/Orders/Reservations/Approvals/Me | Closed |
| SUP-GAP-006 | Floor | Read/write table status is allowed. | `pos:floor:*`, `pos:table:*` | Closed |
| SUP-GAP-007 | Orders | Orders read surface is implemented; create/edit/send remains intentionally excluded to avoid a Waiter clone. | `/supervisor/orders` uses read-only order/payment/refund/discount reads | Done with product constraint |
| SUP-GAP-008 | Payments | Payment/till writes are allowed by seed but remain intentionally excluded to avoid a Cashier clone. | Supervisor Orders shows payment state read-only only | Deferred with exact role-boundary reason |
| SUP-GAP-009 | Resolution | Split/merge/move/transfer verified. | BG4.B permissions/controllers | Closed |
| SUP-GAP-010 | KDS | KDS writes verified but not exposed as a Supervisor primary surface. | no KDS action controls in Supervisor UI | Deferred with exact role-boundary reason |
| SUP-GAP-011 | Discounts | Request/read/approve/reject verified. | discounts module | Closed |
| SUP-GAP-012 | Refunds | Create/read/approve verified. | refunds module | Closed |
| SUP-GAP-013 | Post-close void | Permission exists; DTO requires manager PIN. | refunds DTO/controller | Closed high-risk |
| SUP-GAP-014 | Reservations | First-class tab justified; permissions complete. | reservations module | Closed |
| SUP-GAP-015 | Deposits | Record/read verified; money-adjacent confirmation needed. | reservations deposit endpoints | Closed high-risk |
| SUP-GAP-016 | Global approvals | Not Supervisor-safe. | missing `approvals:*`; no `/api/approvals` client call | Blocked with exact permission reason |
| SUP-GAP-017 | Punch | Current-user employee identity is now exposed through `/api/auth/me`, and attendance clock writes enforce linked-user ownership before recording a punch. | AuthService.me, AttendanceService.clockInOut, Supervisor Me | Closed for self-punch |
| SUP-GAP-018 | Leave/swaps | Current-user leave creation is implemented. Shift-swap reads are implemented. Shift-swap create is backend-hardened but UI creation remains unavailable until selector contract exists. | attendance module, leave form, self-scope shift-swap reads | Done for leave/read; shift-swap create deferred |
| SUP-GAP-019 | Shift-swap selector | Shift-swap create still requires `targetEmployeeId`; no Supervisor-safe eligible source shift plus eligible same-branch target selector is verified, and broad staff selection remains forbidden. | DTO requires target employee; no eligible target endpoint found | Blocked with exact missing selector contract |
| SUP-GAP-020 | Receipts | Backend exists, but Supervisor lacks receipt permissions and no receipt action is exposed. | missing `pos:receipt:*` | Blocked with exact permission reason |
| SUP-GAP-021 | Audit timeline | Backend exists, but Supervisor lacks audit permission. | missing `audit:read` | Blocked with exact permission reason |
| SUP-GAP-022 | Devices | Backend exists, but Supervisor lacks device permissions and no device admin is exposed. | missing `devices:*` | Blocked with exact permission reason |
| SUP-GAP-023 | Reports | Operational report permissions exist, but no Reports nav is approved for Supervisor closeout. | selected `pos:reports:*`; nav remains five tabs | Deferred with nav-scope reason |
| SUP-GAP-024 | Payroll | Read/adjustment permissions exist, but payroll is outside approved Supervisor nav and role thesis. | selected payroll perms; no payroll UI | Deferred with role-boundary reason |
| SUP-GAP-025 | Accounting/franchise/billing | Not permission-safe and outside role thesis. | no Supervisor perms; no UI exposed | Blocked with exact permission/scope reason |
| SUP-GAP-026 | Public MTN/Airtel | Pending provider confirmation. | public commerce payment service/import validation | Locked caveat |
| SUP-GAP-027 | PesaPal | Owner SaaS billing only. | roadmap/README/billing module | Locked exclusion |
| SUP-GAP-028 | Printer | Metadata only; no print driver. | BG5/README/demo validation | Locked caveat |
| SUP-GAP-029 | Terminal | STUB only; no acquirer traffic. | BG5/README/demo validation | Locked caveat |
| SUP-GAP-030 | Receipt send | Pending/no adapter. | receipt service/DTO | Locked caveat |
| SUP-GAP-031 | Demo fixtures | Dry-run validation passed in prior prompts; Supervisor routes now rely on existing real demo entities and honest empty states. | previous `db:demo:validate`; no seed/demo writes in closeout | Done with no new demo import |
| SUP-GAP-032 | Postman | No Supervisor workflow collection is required for this closeout because no API contract changed. | collection inventory; no new endpoint | Deferred unless a future Supervisor API contract is added |
| SUP-GAP-033 | Root docs path | Requested root docs were absent; created verified root docs from pack/source evidence. | `Front End/supervisor_ui_docs_pack` | Closed |
| SUP-GAP-034 | API/browser QA | Compiled API startup is the verified local QA path; final closeout attempted/records route visual QA separately. | `node dist/main`, `/api/health`, finalization report | Closed with local startup note |

## Build Rule

If a future UI action lacks a verified Supervisor permission or safe DTO path, hide it or render a disabled state with the exact reason. Do not add frontend-only fake behavior.
