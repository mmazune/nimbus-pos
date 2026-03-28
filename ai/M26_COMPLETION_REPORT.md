# M26 Completion Report — Payroll Engine + Pay Runs + Payslips

## Milestone Summary

| Item | Detail |
|---|---|
| Milestone | M26 |
| Title | Payroll Engine + Pay Runs + Payslips |
| Branch | `milestone/m26-payroll-engine-pay-runs-payslips` |
| Status | **COMPLETE** |

## Deliverables

### Schema
- 4 new enums: `PayRunStatus`, `PayComponentType`, `PaySlipStatus`, `PayrollAdjustmentType`
- 4 new models: `PayComponent`, `PayrollAdjustment`, `PayRun`, `PaySlip`
- Relations: User (builtBy, approvedBy, paidBy, adjustmentsCreated), Employee (adjustments, paySlips), Organization, Branch
- Migration: `20260401000000_m26_payroll_engine_pay_runs_payslips`

### Module Structure
- `apps/api/src/modules/payroll/`
  - `payroll.module.ts`
  - `payroll.controller.ts` (11 endpoints)
  - `payroll.service.ts` (11 methods)
  - `payroll.service.spec.ts` (24 unit tests)
  - `dto/` (6 DTOs + barrel index)

### Endpoints (11)
| # | Method | Path | Permission |
|---|---|---|---|
| 1 | POST | `/api/payroll/components` | `pos:payroll:components:create` |
| 2 | GET | `/api/payroll/components` | `pos:payroll:components:read` |
| 3 | POST | `/api/payroll/adjustments` | `pos:payroll:adjustments:create` |
| 4 | GET | `/api/payroll/adjustments` | `pos:payroll:adjustments:read` |
| 5 | POST | `/api/payroll/runs/build` | `pos:payroll:runs:build` |
| 6 | PATCH | `/api/payroll/runs/:id/approve` | `pos:payroll:runs:approve` |
| 7 | PATCH | `/api/payroll/runs/:id/pay` | `pos:payroll:runs:pay` |
| 8 | GET | `/api/payroll/runs` | `pos:payroll:runs:read` |
| 9 | GET | `/api/payroll/runs/:id` | `pos:payroll:runs:read` |
| 10 | GET | `/api/payroll/slips` | `pos:payroll:slips:read` |
| 11 | GET | `/api/payroll/slips/:id` | `pos:payroll:slips:read` |

### Permissions (9)
`pos:payroll:components:read`, `pos:payroll:components:create`, `pos:payroll:adjustments:read`, `pos:payroll:adjustments:create`, `pos:payroll:runs:read`, `pos:payroll:runs:build`, `pos:payroll:runs:approve`, `pos:payroll:runs:pay`, `pos:payroll:slips:read`

### Tests
- **Unit tests:** 24 test cases in `payroll.service.spec.ts`
- **E2e tests:** 20 test cases in `payroll.e2e-spec.ts`

### Seed Data
- 6 pay components + 1 demo adjustment
- Idempotent (safe for re-run)

### Postman
- `M26-Payroll-Engine-Pay-Runs-Payslips.postman_collection.json`
- 13 requests across 4 folders

### Documentation
- `docs/PAYROLL_PAYRUNS_PAYSLIPS_GUIDE.md`
- `ai/M26_COMPLETION_REPORT.md` (this file)
- Updated `AI_STATUS.md`

## Architecture Decisions

1. **No GL posting** — `postingPayload` stub field; deferred to future finance module
2. **Component snapshot** — JSON freeze at build time for audit reproducibility
3. **Transaction safety** — `$transaction` for payrun+payslips to prevent partial state
4. **Branch-scoped** — all data scoped by orgId + branchId
5. **State machine** — DRAFT→APPROVED→PAID with strict transition guards

## Scope Boundary

| In Scope | Out of Scope |
|---|---|
| Pay components CRUD | GL posting / journal entries |
| Payroll adjustments | Bank reconciliation |
| Pay run build/approve/pay | Tax filing / statutory returns |
| Pay slips with snapshots | Multi-currency payroll |
| Branch isolation | Employee self-service portal |

## Known Limitations

- No CANCELLED status transition endpoint (can be added via future admin endpoint)
- PAYE bracket calculation is placeholder (calculationMethod field stored but not evaluated)
- No email/notification on payslip generation
