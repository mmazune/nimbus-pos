> ⚠️ **SUPERSEDED (2026-07-18).** Describes the original **5-tab** Supervisor
> (Floor · **Orders** · Reservations · Approvals · Me) with a dedicated Orders
> layout and role-specific Floor. Shipped Supervisor is **4-tab** (**Floor ·
> Reservations · Approvals · Me**), **no visible Orders tab**, **shared** Floor.
> Current canonical: `docs/supervisor-ui-docs/*`, `docs/UI_SYSTEM.md`, root
> `CLAUDE.md`, `docs/DECISIONS.md`. Kept for history.

# DESIGN.md — Nimbus POS Supervisor Workspace Design System Extension

Status: Draft v1  
Date: 2026-07-03  
Extends: global Nimbus POS `DESIGN.md`  
Role: Supervisor

## 1. Purpose

This file extends the Nimbus POS design system for the Supervisor role: live floor control, order exception resolution, reservation operations, approval boundaries, punch/self-service, and service oversight.

Supervisor is an operational control role. It should be fast, serious, readable, and safe under pressure.

## 2. Supervisor mood

The workspace should feel command-center calm, front-of-house aware, premium, high-trust, and action-oriented. It should not feel like a waiter order pad, cashier checkout terminal, manager accounting dashboard, generic analytics product, or fake approval simulator.

## 3. Palette usage

Use global tokens only.

| UI area | Token usage |
|---|---|
| Header | `--color-brand-navy-950` |
| Active bottom nav | `--color-brand-navy-900` |
| Page background | `--color-page-bg` |
| Floor/table cards | `--color-surface`, `--color-surface-raised` |
| Live risk / pending approvals | warning tokens |
| Blocked/failed/void risk | danger tokens |
| Resolved/served/seated/approved | success tokens |
| Deferred/stub/metadata | neutral tokens |

Role-specific status treatment:

- Floor healthy: neutral/success.
- Table needs attention: warning.
- Stuck order / approval required: warning/danger depending severity.
- Unauthorized action: neutral blocked state, not a scary error.
- Live provider/hardware pending: caveat tag, never success.

## 4. Typography

Use Inter Variable or existing fallback. Use tabular numbers for table numbers, order numbers, timers, counts, party size, refund/discount values, expected wait times, current time, and shift/till values if shown.

No decorative type. No thin weights.

## 5. Interaction laws and principles

Supervisor workflows require safe rapid triage:

- **Fitts’s Law**: common actions like Open order, Seat, Confirm, Approve/Reject must be large enough for touch use.
- **Hick’s Law**: keep bottom nav to five approved items; move secondary resolution actions into panels.
- **Law of Proximity**: group floor/table status with order/reservation/service risk.
- **Jakob’s Law**: use familiar POS patterns: floor map, order list, reservation book, approval inbox.
- **Tesler’s Law**: backend permissions/state machines handle complexity; UI must not fake results.
- **Error prevention**: confirm void, approval, transfer, merge, split, no-show, cancel, and reconciliation-like actions.
- **Recognition over recall**: badges and chips show action availability and reason.
- **Progressive disclosure**: advanced resolution should not dominate the floor landing page.

## 6. Shell layout

Header height: 64px. Bottom nav height: 76–84px. Main padding: 20–24px.

Header:

- left: logo, branch, supervisor workstation;
- center: current time/service health summary;
- right: shift chip, service-risk chip, supervisor avatar/name, logout.

Bottom nav:

1. Floor
2. Orders
3. Reservations
4. Approvals
5. Me

No Dashboard, Reports, Menu, Payments, or More tab.

## 7. Floor layout

At 1440×900:

- floor/table map/list: 60–70%;
- right-side service/risk panel: 30–40%;
- reservation overlay drawer: 420–560px;
- order exception drawer: 560–760px.

Floor cards should show table number/name, status, party size, assigned server/waiter, active order count, bill requested/payment risk if verified, reservation status, and timer/last update if available.

## 8. Orders layout

Orders should show active branch orders with supervisor-safe grouping: Needs attention, Ready/served, Bill requested, Transfer/split candidates, Void/discount/refund review, and Closed today if supported.

Order detail should prioritize status and service risk, table/server, line items, payment state, exception tools, and approval/escalation state.

Supervisor Orders must not become Waiter menu-entry unless permissions prove it.

## 9. Reservations layout

Reservations should feel like an operational book: today timeline, upcoming list, status filters, table assignment, seat/no-show/cancel controls if verified, guest notes if safe, and deposit status if verified.

High-impact actions require confirmation.

## 10. Approvals layout

Approvals should be compact and stateful: discount approval, refund approval, post-close void boundary, shift swap/leave review if verified, and no global approval inbox unless Supervisor permission is verified.

Each approval card should show request type, amount/value, requester, context, threshold/policy reason, approve/reject only if permission verified, and escalation copy where blocked.

## 11. Me layout

Me should show profile/session, branch/workstation, shift/readiness, punch/clock controls if verified, own attendance if verified, leave/swap request if verified, Supervisor scope, restricted surfaces, known limitations, and logout.

No payroll, staff list, accounting, reports, franchise, or manager settings.

## 12. Caveat tags

Use exact caveat copy:

- `CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION`
- `PesaPal excluded — owner SaaS billing only`
- `STUB — no acquirer/card-terminal traffic`
- `Metadata only — no print-driver invocation`
- `PENDING — no live email/SMS/WhatsApp adapter`

## 13. Accessibility

- 44px minimum touch targets.
- Visible focus states.
- Icon-only buttons need `aria-label`.
- Statuses include text, not color alone.
- Confirmation dialogs need headings and explicit actions.
- Disabled actions must include reasons.
- Lists, table maps, and approval queues must be keyboard navigable.
- No information conveyed only through color.

## 14. Icon guidance

Use Phosphor icons only.

| Surface | Icon candidates |
|---|---|
| Floor | `GridFour`, `MapTrifold`, `SquaresFour` |
| Orders | `ListChecks`, `Receipt`, `ClipboardText` |
| Reservations | `CalendarCheck`, `CalendarDots` |
| Approvals | `SealCheck`, `ShieldCheck`, `WarningCircle` |
| Me | `UserCircle` |
| Transfer | `ArrowsLeftRight`, `ArrowSquareOut` |
| Void/blocked | `Prohibit`, `XCircle` |
| Punch | `ClockClockwise`, `Fingerprint` |
| Service risk | `WarningCircle` |
