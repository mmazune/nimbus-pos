# MANAGER_APPROVAL_DECISIONS.md — Product Owner Decisions Before Manager Prompt 1

Status: Draft v1  
Date: 2026-07-06

This document lists the decisions the product owner should approve before Manager implementation starts.

## 1. Core identity decisions

| Decision | Recommended choice | Status |
|---|---|---|
| Role enum | `JobRole.MANAGER` | Pending owner approval |
| Separate Branch Manager role | No | Pending owner approval |
| Landing route | `/manager/overview` | Pending owner approval |
| Branch switcher | Required in shell/header | Pending owner approval |
| Multi-branch behavior | Selected branch drives every branch-scoped query | Pending owner approval |

## 2. Navigation decisions

| Decision | Recommended choice | Status |
|---|---|---|
| Bottom nav | Overview, Operations, Staff, Reports, Settings, Me | Pending owner approval |
| Separate Approvals tab | No for MVP; integrate into Overview/Operations/Staff | Pending owner approval |
| Reports as first-class tab | Yes | Pending owner approval |
| Settings as first-class tab | Yes, branch/device scoped only | Pending owner approval |
| More tab | No | Pending owner approval |

## 3. Staff decisions

| Decision | Recommended choice | Status |
|---|---|---|
| Staff directory | Include safe fields | Pending owner approval |
| Frontline onboarding | Include if DTO verified | Pending owner approval |
| Quick PIN controls | Include with confirmations | Pending owner approval |
| Leave review | Include | Pending owner approval |
| Shift swap review | Include | Pending owner approval |
| Compensation/contracts | Exclude from MVP | Pending owner approval |
| Payroll/pay runs | Exclude | Pending owner approval |

## 4. Operations decisions

| Decision | Recommended choice | Status |
|---|---|---|
| Tables/floor | Read-only oversight | Pending owner approval |
| Orders | Read-only oversight initially | Pending owner approval |
| Tills | Read-only oversight initially | Pending owner approval |
| Shifts | Read-only oversight initially | Pending owner approval |
| Reservations | Read-only oversight initially | Pending owner approval |
| Cashier checkout clone | Forbidden | Pending owner approval |
| Waiter order-entry clone | Forbidden | Pending owner approval |

## 5. Reports decisions

| Decision | Recommended choice | Status |
|---|---|---|
| Report catalog | Include | Pending owner approval |
| Generate reports | Include after DTO verification | Pending owner approval |
| History/detail | Include | Pending owner approval |
| Export/download | Include with generator-unavailable state | Pending owner approval |
| Fake downloads | Forbidden | Pending owner approval |

## 6. Settings decisions

| Decision | Recommended choice | Status |
|---|---|---|
| Branch profile | Include | Pending owner approval |
| Device registry | Include | Pending owner approval |
| Printer routes | Metadata-only | Pending owner approval |
| Terminal pairing | Stub-only | Pending owner approval |
| Alert rules | Defer or read-only | Pending owner approval |
| Sync conflict resolution | Defer complex diff view | Pending owner approval |
| Owner/Admin settings | Exclude | Pending owner approval |
| SaaS billing | Exclude | Pending owner approval |

## 7. Approval decisions

| Decision | Recommended choice | Status |
|---|---|---|
| Approval counts on Overview | Include | Pending owner approval |
| Leave/swap review in Staff | Include | Pending owner approval |
| Refund/discount/void escalation in Operations or action prompt | Include after verification | Pending owner approval |
| Generic `/api/approvals/:id/decide` | Use only when DTO mapping is clear | Pending owner approval |
| Domain-specific decision routes | Prefer where safer | Pending owner approval |

## 8. Safety decisions

| Decision | Recommended choice | Status |
|---|---|---|
| MTN/Airtel diner execution | Pending provider confirmation; not live | Locked |
| PesaPal diner checkout | Excluded | Locked |
| Receipt send | Pending/no adapter | Locked |
| Printer driver invocation | Excluded unless verified | Locked |
| Card terminal/acquirer traffic | Stub-only unless verified | Locked |
| Payroll/compensation exposure | Excluded | Locked |
| Real PII | Forbidden | Locked |
| Fake success states | Forbidden | Locked |

## 9. Approval checklist

Before creating `MANAGER_UI_PROMPT1_SHELL_NAV_SESSION_FOUNDATION`, confirm:

- [ ] Role is `MANAGER`.
- [ ] Manager lands on `/manager/overview`.
- [ ] Bottom nav is Overview / Operations / Staff / Reports / Settings / Me.
- [ ] Branch switcher is required in Manager shell.
- [ ] Reports is first-class.
- [ ] Approvals is not a bottom tab in MVP.
- [ ] Staff includes roster, onboarding, PIN, leave, and shift swaps.
- [ ] Compensation/contracts/payroll are excluded.
- [ ] Settings is branch/device scoped only.
- [ ] No Cashier checkout or Waiter order-entry clones.
