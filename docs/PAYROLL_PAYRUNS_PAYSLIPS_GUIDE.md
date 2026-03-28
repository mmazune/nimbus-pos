# M26 — Payroll Engine + Pay Runs + Payslips Guide

## Overview

M26 introduces the **Payroll Engine** for Nimbus POS, enabling restaurant owners to:
- Define reusable **Pay Components** (earnings, deductions, employer costs)
- Record **Payroll Adjustments** (bonuses, overtime, deductions, penalties, advances) per employee
- **Build Pay Runs** that automatically calculate gross/net pay from compensation profiles + active components + adjustments
- **Approve** and **Pay** runs through a DRAFT → APPROVED → PAID state machine
- View frozen **Pay Slips** with reproducible component snapshots

> **Scope boundary:** No GL posting, bank reconciliation, or tax filing. The `postingPayload` field stores a stub for future integration.

## Data Model

### Enums

| Enum | Values |
|---|---|
| `PayRunStatus` | DRAFT, APPROVED, PAID, CANCELLED |
| `PayComponentType` | EARNING, DEDUCTION, EMPLOYER_COST, OTHER |
| `PaySlipStatus` | DRAFT, FINAL, PAID |
| `PayrollAdjustmentType` | BONUS, OVERTIME, ADVANCE, DEDUCTION, PENALTY, OTHER |

### Models

| Model | Key Fields | Purpose |
|---|---|---|
| `PayComponent` | code (unique per org), name, componentType, defaultAmount, taxable | Master data for earnings/deductions |
| `PayrollAdjustment` | employeeId, adjustmentType, amount, effectiveDate | Per-employee payroll adjustments |
| `PayRun` | name, periodStart, periodEnd, status, grossTotal, netTotal | Payroll period batch |
| `PaySlip` | payRunId, employeeId, grossPay, netPay, componentSnapshot | Individual employee payslip |

### State Machine

```
PayRun:   DRAFT  →  APPROVED  →  PAID
PaySlip:  DRAFT  →  FINAL     →  PAID
```

- **Build** → creates PayRun (DRAFT) + PaySlips (DRAFT)
- **Approve** → PayRun → APPROVED, PaySlips → FINAL (frozen)
- **Pay** → PayRun → PAID, PaySlips → PAID, postingPayload generated

## API Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/api/payroll/components` | `pos:payroll:components:create` | Create pay component |
| GET | `/api/payroll/components` | `pos:payroll:components:read` | List pay components |
| POST | `/api/payroll/adjustments` | `pos:payroll:adjustments:create` | Create payroll adjustment |
| GET | `/api/payroll/adjustments` | `pos:payroll:adjustments:read` | List adjustments (filter: employeeId) |
| POST | `/api/payroll/runs/build` | `pos:payroll:runs:build` | Build new pay run |
| PATCH | `/api/payroll/runs/:id/approve` | `pos:payroll:runs:approve` | Approve DRAFT → APPROVED |
| PATCH | `/api/payroll/runs/:id/pay` | `pos:payroll:runs:pay` | Mark APPROVED → PAID |
| GET | `/api/payroll/runs` | `pos:payroll:runs:read` | List pay runs (filter: status, period) |
| GET | `/api/payroll/runs/:id` | `pos:payroll:runs:read` | Get pay run detail + slips |
| GET | `/api/payroll/slips` | `pos:payroll:slips:read` | List pay slips (filter: payRunId, employeeId) |
| GET | `/api/payroll/slips/:id` | `pos:payroll:slips:read` | Get pay slip detail |

## Permissions (9 total)

| Permission | Description |
|---|---|
| `pos:payroll:components:read` | List and view pay components |
| `pos:payroll:components:create` | Create pay components |
| `pos:payroll:adjustments:read` | List and view payroll adjustments |
| `pos:payroll:adjustments:create` | Create payroll adjustments |
| `pos:payroll:runs:read` | List and view pay runs |
| `pos:payroll:runs:build` | Build a new pay run |
| `pos:payroll:runs:approve` | Approve a pay run |
| `pos:payroll:runs:pay` | Mark a pay run as paid |
| `pos:payroll:slips:read` | List and view pay slips |

### Role Access Matrix

| Role | Access |
|---|---|
| Owner | Full (all 9 permissions) |
| Manager | All except `runs:pay` |
| Accountant | Read-only (components, adjustments, runs, slips) |
| Supervisor | Read + create adjustments |
| Cashier/Waiter | `slips:read` only |
| Chef/Bartender | None |

## Business Rules

1. **Unique component code** per organization (`@@unique([orgId, code])`)
2. **Overlapping period check** — cannot build a pay run if a non-CANCELLED run already covers overlapping dates
3. **Employee filtering** — only ACTIVE employees included, optionally filtered by `employeeIds`
4. **Gross calculation** = base pay (from CompensationProfile) + earning components (defaults) + earning adjustments (BONUS, OVERTIME)
5. **Deduction calculation** = deduction components (defaults) + deduction adjustments (DEDUCTION, PENALTY, ADVANCE)
6. **Net pay** = gross − deductions
7. **Component snapshot** is JSON-frozen at build time for reproducibility
8. **State enforcement** — approve requires DRAFT, pay requires APPROVED
9. **Transaction safety** — pay run + payslips created/updated in Prisma `$transaction`
10. **Branch isolation** — all queries scoped by branchId + orgId

## Postman Collection

File: `postman/collections/M26-Payroll-Engine-Pay-Runs-Payslips.postman_collection.json`

13 requests across 4 folders: Pay Components, Payroll Adjustments, Pay Runs, Pay Slips.

## Seed Data

The seed creates:
- 6 pay components (BASIC-SAL, TRANSPORT, HOUSING, NSSF-EMP, PAYE, NSSF-ER)
- 1 demo BONUS adjustment for the first active employee
