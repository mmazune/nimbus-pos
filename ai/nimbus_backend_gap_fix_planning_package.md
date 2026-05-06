
# Nimbus Backend Gap-Fix + Lucidchart Planning Package (Pre-M43/M44)

## Source-of-truth basis
This package was prepared against:
- ROADMAP.md
- final verified API audit / master audit (M0-M42)
- final missing endpoint recommendations
- report vs Postman reconciliation
- frontend workflow map
- reusable component map
- role endpoint matrix
- Lucidchart API tree
- postman issues and request register

## Executive gate
Do **not** start serious M43/M44 frontend implementation until backend gaps are:
- implemented and tested,
- explicitly deferred,
- explicitly marked internal/dev-only,
- or explicitly marked pending provider confirmation.

`/api/public/payments/*` remains:
- **CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION**
- **Not live**
- **Placeholder / skeleton only**
- **Do not build execution yet**

## Mini-milestone plan
### BG0 — Route Verification + Contract Cleanup
Purpose:
- clear the 42 report-only rows and reconcile 11 Postman-only rows before frontend tickets are finalized

Affects:
- route scan / docs / Postman / endpoint register

Key outputs:
- verified route checklist
- report-only classification
- Postman cleanup for superseded/placeholder rows
- canonical `/api/auth/me` frontend context note

### BG1 — Invitation Acceptance + Password Lifecycle + Frontline Staff Onboarding
Purpose:
- close the invited-user lifecycle gap and reduce manager friction for staff setup

Exact endpoint targets:
- POST /api/auth/invitations/accept
- POST /api/onboarding/invitations/:id/resend
- PATCH /api/onboarding/invitations/:id/revoke
- POST /api/auth/forgot-password
- POST /api/auth/reset-password
- POST /api/auth/force-password-change
- POST /api/hr/frontline-staff/onboard

Frontend screens depending on it:
- invited manager/accountant first-login
- forgot/reset password
- manager staff setup wizard
- quick PIN setup for frontline staff

### BG2 — Unified Approvals Inbox + Global Audit Timeline
Purpose:
- one approvals queue + one reusable audit read surface

Exact endpoint targets:
- GET /api/approvals
- GET /api/approvals/:id
- POST /api/approvals/:id/decide
- GET /api/audit/timeline

Frontend screens depending on it:
- manager approvals inbox
- owner approvals inbox
- reusable audit drawer/timeline

### BG3 — Reliability Rollout (Idempotency + Maintenance/Training Adoption)
Purpose:
- apply M41 and M42 primitives to real write surfaces

Write surfaces:
- payments/intents
- public holds/confirms
- POS close
- refunds
- inventory adjustments
- shifts/tills open/close/reconcile
- AR receipts
- AP payments
- payroll pay
- sync-facing writes
- selected HR/public booking/billing writes for maintenance/training

Frontend screens depending on it:
- POS terminal
- public booking flows
- finance payment screens
- payroll run pay screen
- reliability admin tools
- training mode banner / maintenance blocker

### BG4 — Receipts + POS Order Handoff Operations
Purpose:
- complete cashier/waiter support flows and common floor-ops mutations

Exact endpoint targets:
- GET /api/receipts/:id
- POST /api/receipts/:id/reprint
- POST /api/receipts/:id/send
- GET /api/receipts/:id/history
- POST /api/pos/orders/:id/split-bill
- POST /api/pos/orders/:id/split-items
- POST /api/pos/orders/merge
- POST /api/pos/orders/:id/transfer-table
- POST /api/pos/orders/:id/transfer-server
- POST /api/pos/orders/:id/move-items

Frontend screens depending on it:
- cashier close/receipt drawer
- waiter table operations
- supervisor support tools
- post-close support flow

### BG5 — Device / Printer / Terminal Registry
Purpose:
- support deployment-ready routing and registration without entering the deferred hardware wave

Exact endpoint targets:
- POST /api/devices/activate
- GET /api/devices
- GET /api/devices/:id
- PATCH /api/devices/:id/status
- POST /api/devices/kds/register
- POST /api/devices/printers/routes
- GET /api/devices/printers/routes
- POST /api/devices/terminals/pair
- PATCH /api/devices/terminals/:id/unpair
- GET /api/devices/:id/history

Frontend screens depending on it:
- device admin
- printer routing
- KDS screen registry
- terminal pairing stubs

### BG6 — Export / Download Consistency
Purpose:
- let one reusable frontend export/download component work across domains

Preferred endpoint shape:
- POST /api/exports
- GET /api/exports
- GET /api/exports/:id
- GET /api/exports/:id/download

Minimum fallback:
- normalize report/accounting/payroll/document generators into one artifact catalog/downloader

Frontend screens depending on it:
- reports
- accounting
- payroll
- documents
- franchise/HQ exports
- DownloadCenter component

## Postman update plan
For each mini-milestone:
- create/update one canonical collection
- mark every folder [STANDALONE] or [REQUIRES PRIOR FOLDERS]
- use `/api/auth/me` as canonical context resolver
- auto-resolve auth/org/branch/ID variables
- clearly label:
  - Verified
  - Missing — Implement
  - Needs Route Verification
  - Internal Only
  - Pending Provider
- keep `/api/public/payments/*` labelled CRITICAL — PENDING PROVIDER CONFIRMATION

## Test plan
Each mini-milestone must include:
- 1 happy path e2e
- 1 validation failure
- 1 permission denial
- 1 conflict/state-machine test
- 1 idempotency test for risky POST/PATCH where relevant

Additional required tests:
- BG1: revoked invite / duplicate staff onboard / temp password lifecycle
- BG2: aggregation across approval types / audit timeline filters
- BG3: same-key same-payload / same-key different-payload / maintenance block / training short-circuit
- BG4: receipt send history / split & merge integrity / transfer audit
- BG5: duplicate device activation / terminal pair conflict / printer route validation
- BG6: artifact generation / download auth / retention-safe lookup

## Verified API completeness checklist
Safe to call backend “frontend-ready” only when:
1. 42 report-only rows are classified and reconciled
2. 11 Postman-only rows are normalized or explained
3. BG1–BG6 are complete or explicitly deferred
4. public diner mobile-money execution remains clearly pending, not silently omitted
5. Postman collections reflect the final contract
6. reusable frontend components have one stable API pattern each

## Lucidchart map specification
Use the agreed 15-map set and the colour/legend rules already specified in chat.

Execution rule:
- solid lines = verified Postman-backed flows
- dotted lines = report-only / needs route verification
- dashed lines = pending / deferred flows
- red warning border = critical pending/provider confirmation items

Critical label:
- Public diner payment processing = **CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION**

## Frontend component/API assignment matrix
Use:
- AuthShell
- RoleRouter
- BranchContextSelector
- PermissionGate
- DataTable
- FilterBar
- EntityDetailDrawer
- FormDialog
- WizardStep
- StatusBadge
- StateMachineActions
- ExportButton
- DownloadCenter
- ApprovalInbox
- PinPadLogin
- BottomNav by role
- AlertToast
- OwnerLiveFeed
- TrainingModeBanner
- MaintenanceBlocker
- AuditTimelineDrawer
- ReceiptDrawer
- DeviceStatusBadge

Gating rule:
No component should be assigned to a backend path still in:
- Missing — Implement
- Needs Route Verification
- Pending Provider
unless the component itself is clearly marked placeholder-only.

## Role-by-role navigation plan
Owner:
- Overview
- POS / Operations
- Inventory / Procurement
- Reservations / Events
- Finance
- HR / Workforce
- Franchise / HQ
- Billing / Developer
- Reliability / Control Plane
- Settings

Manager:
- Overview
- POS / Operations
- Inventory / Procurement
- Reservations / Events
- HR / Scheduling
- Approvals
- Audit (limited)
- Settings

Accountant:
- Finance
- AP / AR
- Bank Rec
- Budgets / Forecasts
- Exports
- Audit
- Billing (read where allowed)

Stock Manager / Procurement:
- Inventory
- Suppliers
- Purchase Orders
- Goods Receipts
- Counts / Wastage / Adjustments
- Procurement suggestions

HR Manager:
- Employees
- Contracts
- Attendance
- Leave / Shift Swaps
- Scheduling
- Payroll
- Staff insights

Waiter / Cashier / Chef / Bartender / Supervisor / Event Manager:
- only the operational surfaces relevant to their role
- quick-PIN / role-routed entry
- no finance/admin/dev visibility unless explicitly granted

Nimbus Ops/Admin:
- billing ops
- support sessions
- customer lifecycle
- plan admin
- reliability/control-plane views where allowed

## When it is safe to start M43/M44
Safe to start M43 shell work when:
- BG0 is done
- BG1 and BG2 are done
- BG3 scope for idempotency/training/maintenance is at least applied to the write surfaces used by the first frontend screens
- BG4/BG5/BG6 are either done or clearly tagged deferred from the first shell iteration
- the route verification checklist is closed or all unresolved rows are explicitly classified

Safe to start M44 vertical screens when:
- BG1–BG6 are implemented/tested or explicitly deferred with product signoff
- Postman flows match the intended frontend journeys
- Lucidchart maps have been updated from verified contracts only
