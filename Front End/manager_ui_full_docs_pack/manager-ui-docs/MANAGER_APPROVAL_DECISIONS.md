# MANAGER_APPROVAL_DECISIONS.md — Product Owner Decisions Before Manager Prompt 1

Status: **APPROVED (owner, 2026-08-20)** — was Draft v1  
Date: 2026-07-06 (drafted) · **2026-08-20 (approved)**

This document lists the decisions the product owner should approve before Manager implementation starts.

---

## 2026-08-20 — Owner approval session (Moses, product owner)

**Every "Pending owner approval" row below is now `Approved (owner, 2026-08-20)`.** The
rows already marked **Locked** (§8 Safety decisions) were already binding and are unchanged.

What was approved, verbatim in substance:

1. **Manager core — as recommended.** Role is `JobRole.MANAGER`; no separate Branch Manager
   role; landing route `/manager/overview`; bottom nav **Overview · Operations · Staff ·
   Reports · Settings · Me**; a branch switcher is **required** in the shell/header and the
   selected branch drives **every** branch-scoped query; **Approvals is NOT a bottom tab in
   MVP** (integrated into Overview / Operations / Staff); Reports and Settings are
   first-class tabs; **no More tab**.
2. **Manager MVP scope — as recommended.**
   - *Staff:* directory (safe fields), frontline onboarding, Quick PIN admin, leave review,
     shift-swap review. **Compensation / contracts / payroll EXCLUDED.**
   - *Operations:* read-only oversight (tables, orders, tills, shifts, reservations).
     **No cashier-checkout clone and no waiter-order-entry clone.**
   - *Reports:* catalog + generate (DTO-verified) + history/detail + export, with a truthful
     generator-unavailable state. **Fake downloads forbidden.**
   - *Settings:* branch profile + device registry; printer routes **metadata-only**; terminal
     pairing **stub-only**; alert rules **defer-or-read-only**; sync-conflict diff **deferred**;
     owner/admin settings and SaaS billing **excluded**.
   - *Approvals:* approval **counts on Overview** are included; **domain-specific decision
     routes are preferred** over the generic `POST /api/approvals/:id/decide`, aligning with
     the **Supervisor Option B precedent**.
3. **Sequencing changed by owner decision.** The previous rule — *"Manager reconstruction is
   blocked until Cashier reconstruction closes at C6"* — is **replaced**. **Cashier C3 is
   authorized to proceed in parallel**, and the **Manager track no longer waits for Cashier
   C6**. Manager documentation and the phased reconstruction roadmap may proceed now.

Roadmap created from these decisions: **`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`** (canonical
phased-prompt plan, M-P0 → M-P6).

**Approval of these decisions is not authorization to write Manager runtime code.** Each
roadmap phase still carries its own completion gate, and M-P0 (repo/API verification audit)
must run before any implementation phase.

## 1. Core identity decisions

| Decision | Recommended choice | Status |
|---|---|---|
| Role enum | `JobRole.MANAGER` | **Approved (owner, 2026-08-20)** |
| Separate Branch Manager role | No | **Approved (owner, 2026-08-20)** |
| Landing route | `/manager/overview` | **Approved (owner, 2026-08-20)** |
| Branch switcher | Required in shell/header | **Approved (owner, 2026-08-20)** |
| Multi-branch behavior | Selected branch drives every branch-scoped query | **Approved (owner, 2026-08-20)** |

## 2. Navigation decisions

| Decision | Recommended choice | Status |
|---|---|---|
| Bottom nav | Overview, Operations, Staff, Reports, Settings, Me | **Approved (owner, 2026-08-20)** |
| Separate Approvals tab | No for MVP; integrate into Overview/Operations/Staff | **Approved (owner, 2026-08-20)** |
| Reports as first-class tab | Yes | **Approved (owner, 2026-08-20)** |
| Settings as first-class tab | Yes, branch/device scoped only | **Approved (owner, 2026-08-20)** |
| More tab | No | **Approved (owner, 2026-08-20)** |

## 3. Staff decisions

| Decision | Recommended choice | Status |
|---|---|---|
| Staff directory | Include safe fields | **Approved (owner, 2026-08-20)** |
| Frontline onboarding | Include if DTO verified | **Approved (owner, 2026-08-20)** |
| Quick PIN controls | Include with confirmations | **Approved (owner, 2026-08-20)** |
| Leave review | Include | **Approved (owner, 2026-08-20)** |
| Shift swap review | Include | **Approved (owner, 2026-08-20)** |
| Compensation/contracts | Exclude from MVP | **Approved (owner, 2026-08-20)** |
| Payroll/pay runs | Exclude | **Approved (owner, 2026-08-20)** |

## 4. Operations decisions

| Decision | Recommended choice | Status |
|---|---|---|
| Tables/floor | Read-only oversight | **Approved (owner, 2026-08-20)** |
| Orders | Read-only oversight initially | **Approved (owner, 2026-08-20)** |
| Tills | Read-only oversight initially | **Approved (owner, 2026-08-20)** |
| Shifts | Read-only oversight initially | **Approved (owner, 2026-08-20)** |
| Reservations | Read-only oversight initially | **Approved (owner, 2026-08-20)** |
| Cashier checkout clone | Forbidden | **Approved (owner, 2026-08-20)** |
| Waiter order-entry clone | Forbidden | **Approved (owner, 2026-08-20)** |

## 5. Reports decisions

| Decision | Recommended choice | Status |
|---|---|---|
| Report catalog | Include | **Approved (owner, 2026-08-20)** |
| Generate reports | Include after DTO verification | **Approved (owner, 2026-08-20)** |
| History/detail | Include | **Approved (owner, 2026-08-20)** |
| Export/download | Include with generator-unavailable state | **Approved (owner, 2026-08-20)** |
| Fake downloads | Forbidden | **Approved (owner, 2026-08-20)** |

## 6. Settings decisions

| Decision | Recommended choice | Status |
|---|---|---|
| Branch profile | Include | **Approved (owner, 2026-08-20)** |
| Device registry | Include | **Approved (owner, 2026-08-20)** |
| Printer routes | Metadata-only | **Approved (owner, 2026-08-20)** |
| Terminal pairing | Stub-only | **Approved (owner, 2026-08-20)** |
| Alert rules | Defer or read-only | **Approved (owner, 2026-08-20)** |
| Sync conflict resolution | Defer complex diff view | **Approved (owner, 2026-08-20)** |
| Owner/Admin settings | Exclude | **Approved (owner, 2026-08-20)** |
| SaaS billing | Exclude | **Approved (owner, 2026-08-20)** |

## 7. Approval decisions

| Decision | Recommended choice | Status |
|---|---|---|
| Approval counts on Overview | Include | **Approved (owner, 2026-08-20)** |
| Leave/swap review in Staff | Include | **Approved (owner, 2026-08-20)** |
| Refund/discount/void escalation in Operations or action prompt | Include after verification | **Approved (owner, 2026-08-20)** |
| Generic `/api/approvals/:id/decide` | Use only when DTO mapping is clear | **Approved (owner, 2026-08-20)** |
| Domain-specific decision routes | Prefer where safer | **Approved (owner, 2026-08-20)** |

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

- [x] Role is `MANAGER`.
- [x] Manager lands on `/manager/overview`.
- [x] Bottom nav is Overview / Operations / Staff / Reports / Settings / Me.
- [x] Branch switcher is required in Manager shell.
- [x] Reports is first-class.
- [x] Approvals is not a bottom tab in MVP.
- [x] Staff includes roster, onboarding, PIN, leave, and shift swaps.
- [x] Compensation/contracts/payroll are excluded.
- [x] Settings is branch/device scoped only.
- [x] No Cashier checkout or Waiter order-entry clones.
