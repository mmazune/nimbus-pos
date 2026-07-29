> ⚠️ **SUPERSEDED (2026-07-18).** Describes the original **5-tab** Supervisor
> lifecycle including a dedicated **Orders** screen. Shipped Supervisor is
> **4-tab** (**Floor · Reservations · Approvals · Me**), **no visible Orders tab**;
> order work is Floor-contained (Prompt 3+). Current canonical:
> `docs/supervisor-ui-docs/SUPERVISOR_LIFECYCLE.md`,
> `ai/SUPERVISOR_RECONSTRUCTION_*`, root `CLAUDE.md`. Kept for history.

# SUPERVISOR_LIFECYCLE.md — Nimbus POS Supervisor Lifecycle

Status: Draft v1  
Date: 2026-07-03  
Scope: Supervisor workflow lifecycle for review before implementation

## 1. Lifecycle summary

```txt
login
→ resolve /api/auth/me
→ branch/workstation context
→ shift/readiness check
→ Floor
→ monitor floor/table state
→ inspect orders and service risks
→ resolve verified order exceptions
→ manage reservations/seating
→ review approvals/escalations
→ punch/self-service under Me
→ logout
```

## 2. Login and context

Supervisor login must use shared auth shell, verify exact Supervisor credentials/PIN from live repo, call `/api/auth/me`, confirm role/permissions, route to `/supervisor/floor`, and block non-Supervisor users.

Open gaps: exact role enum value, exact demo credentials, PIN-first vs email-first, owner/manager fallback access rules.

## 3. Shift/readiness

Supervisor should see active shift, branch context, service-risk state, and optional till/receipt/device read status if relevant.

Supervisor should not inherit Cashier till write workflows unless permissions verify it.

## 4. Floor lifecycle

```txt
enter Floor
→ load branch floor/tables
→ load reservation overlays
→ load active order summaries
→ identify attention states
→ open table/order/reservation drawer
→ perform verified action or show blocked reason
→ refresh floor
```

Attention states: occupied with long-running order, ready/served but not settled, reservation due soon, blocked/dirty/unavailable table, transfer needed, unassigned server, bill requested if exact data exists.

## 5. Orders lifecycle

```txt
open Orders
→ filter active branch orders
→ inspect order detail
→ review line items/status/payment state
→ use verified resolution action
→ confirm high-impact action
→ submit with Idempotency-Key where supported
→ refresh order/queue/floor
```

Resolution actions pending verification: split bill, split items, merge, move items, transfer table, transfer server, void, discount/refund review.

Supervisor should not run KDS or waiter menu-edit workflows unless verified.

## 6. Reservations lifecycle

```txt
open Reservations
→ load today/upcoming
→ search/filter
→ open reservation detail
→ confirm / assign table / seat / cancel / no-show if permitted
→ record or view deposit if permitted
→ refresh floor and reservation list
```

High-impact actions require confirmation: cancel, no-show, table reassignment, deposit record, seat with table conflict.

## 7. Approvals lifecycle

```txt
open Approvals
→ load verified supervisor approval queues
→ select request
→ inspect context
→ approve/reject/escalate if permitted
→ confirm
→ submit with Idempotency-Key where supported
→ refresh queue
```

Approval categories must be verified: discounts, refunds, post-close void, leave, shift swaps, anomalies.

If global approvals are Owner/Manager-only, Supervisor Approvals must use domain-specific surfaces or show blocked boundaries.

## 8. Punch / Me lifecycle

```txt
open Me
→ view profile/session
→ view branch/workstation
→ view shift/readiness
→ punch/clock if permitted
→ view own attendance if permitted
→ request leave/swap if permitted
→ review scope/limitations
→ logout
```

No payroll, staff list, accounting, reports, franchise, or manager settings.

The Me page uses verified profile data only. If employee linkage is absent, it shows one capability notice, suppresses employee-dependent requests, and uses compact unavailable states for attendance, leave, and shift swaps. When linkage exists, the notice is absent. Shared presentation primitives do not own requests or permissions.

## 9. Receipt/audit lifecycle

Supervisor may view receipt/audit history if permissions verify it: view receipt, history, metadata-only reprint, pending digital send.

Caveats: no printer driver and no live delivery adapter.

## 10. Blocked states

Supervisor must see clear blocked states for unauthenticated, non-Supervisor user, missing branch, missing permission, unsupported DTO, manager/owner-only action, live provider/hardware unavailable, load failure, idempotency conflict, and maintenance mode.

## 11. Success lifecycle

Supervisor is demo-ready when login, floor, orders, reservations, approvals or safe boundaries, punch/self-service, caveats, and waiter/cashier regression all pass.
