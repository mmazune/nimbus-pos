> ⚠️ **SUPERSEDED (2026-07-18).** Describes the original **5-tab** Supervisor
> (Floor · **Orders** · Reservations · Approvals · Me) with a dedicated Orders
> screen and role-specific Floor. Shipped Supervisor is **4-tab** (**Floor ·
> Reservations · Approvals · Me**), **no visible Orders tab**, **shared** Floor.
> Current canonical: `docs/supervisor-ui-docs/*`, `ai/SUPERVISOR_RECONSTRUCTION_*`,
> root `CLAUDE.md`, `docs/DECISIONS.md`. Kept for history.
> Also: any palette values shown here are the **pre-Aug-2026** brand; current brand → `docs/BRAND_IDENTITY.md`.

# supervisor_design.md — Nimbus POS Supervisor Workspace Product Design

Status: Draft v1  
Date: 2026-07-03  
Scope: Supervisor research and design direction before implementation

## 1. Supervisor role thesis

Supervisor is the **front-of-house command role**. The role exists to keep service moving, handle exceptions, manage reservations, enforce operational boundaries, and escalate or approve only where permission allows.

Supervisor is not Waiter, Cashier, Manager, Chef, Bartender, Accountant, or Owner.

## 2. Approved navigation

```txt
Floor · Orders · Reservations · Approvals · Me
```

## 3. Landing page

Supervisor lands on:

```txt
/supervisor/floor
```

Reason:

- Supervisor's first job is live floor awareness.
- Orders, reservations, and approvals are all anchored to floor operations.
- This differs from Waiter, who lands on Floor for own service execution, and Cashier, who lands on Queue for settlement.

## 4. Header

Supervisor header should show Nimbus/ChefCloud brand, branch, `Supervisor terminal` fallback, current time, active shift/readiness, service risk summary, supervisor identity, and logout.

Do not include manager-only analytics links.

## 5. Floor screen

Primary purpose: **live service control**.

Sections:

1. Table/floor map or list.
2. Service-risk strip.
3. Reservations due now.
4. Active order exceptions.
5. Server/waiter load summary if verified.

Table card fields: table name/number, status, capacity/party size, assigned server, active order count, reservation overlay, bill-requested indicator if exact data exists, elapsed timer if available.

Actions only if verified: open table detail, open order detail, assign/transfer table, transfer server, seat reservation, change table status.

## 6. Orders screen

Primary purpose: **exception resolution and oversight**.

Filters: Active orders, Needs attention, Ready/served, Bill requested if exact data exists, Split/merge/transfer candidates, Void/discount/refund review, Closed today if supported.

Order detail: table/server/guest if safe, status lifecycle, line items, totals/payment state, service events, split/handoff tools if permitted, approval state if relevant.

Supervisor should not show food menu editing unless live repo confirms Supervisor order-entry permission.

## 7. Reservations screen

Primary purpose: **front-door and seating operations**.

Views: Today, Upcoming, Pending confirmation, Confirmed, Seated, No-show, Cancelled.

Actions if verified: create reservation, confirm, assign table, seat, cancel, no-show, record deposit, view deposit/event history.

High-impact actions require confirmation.

## 8. Approvals screen

Primary purpose: **safe exception approval or escalation**.

Possible panels after verification: discount requests, refund requests, post-close void requests, shift-swap approvals, leave review, anomaly acknowledgement/resolution.

Important boundary: the uploaded audit suggests the global approvals inbox may be Owner/Manager-only. Do not expose `/api/approvals` to Supervisor unless live seed/source proves permission.

## 9. Me screen

Primary purpose: **profile, session, punch, scope, limitations, logout**.

Sections: profile/session, branch/workstation, shift status, punch/attendance if verified, leave request if verified, shift swap request if verified, Supervisor scope, restricted surfaces, known limitations, logout.

## 10. Design risk

Main design risk is scope creep. Supervisor touches many workflows, so each action must have exact permission proof, clear state boundary, disabled reason if blocked, confirmation if high-impact, and caveat copy where applicable.
