# Waiter UI Docs — Nimbus POS

Status: Draft v2  
Date: 2026-06-16

This folder contains Codex-ready documentation for the Nimbus POS waiter MVP frontend.

## Shared Floor status (2026-07-18)

Waiter and Supervisor now consume one shared operational Floor presentation: toolbar, search, filters, floor-plan selector, grid, card, status/staff formatting, loading/empty/error states, and selected-card treatment. Waiter behavior diverges only after selection, where the existing instant menu/order-entry workspace remains unchanged.

## Files

1. `AGENTS.md` — instructions and guardrails for coding agents.
2. `DESIGN.md` — global Nimbus POS design system with updated brand colors.
3. `waiter_design.md` — waiter role-specific design contract.
4. `waiterui.md` — waiter screen-by-screen UI blueprint.
5. `WAITER_LIFECYCLE.md` — exhaustive waiter lifecycle from table selection to bill/receipt/close visibility.

## Recommended placement in project

```txt
AGENTS.md
docs/
  DESIGN.md
  waiter_design.md
  waiterui.md
  WAITER_LIFECYCLE.md
```

Or keep this folder as:

```txt
docs/waiter-ui-docs/
```

and tell Codex:

```txt
Read docs/waiter-ui-docs/AGENTS.md first, then DESIGN.md, waiter_design.md, waiterui.md, and WAITER_LIFECYCLE.md before writing waiter frontend code.
```

## Source basis

These docs are based on:

- current Nimbus POS waiter MVP backend hardening;
- waiter role Postman collection verification;
- uploaded prior `DESIGN.md`, `waiter_design.md`, and `waiterui.md`;
- the Nimbus POS Brand Identity guide (Andimashimwe Rhoda, Aug 2026) — navy `#000033` / white / light grey `#B3B4AF` / dark grey palette, Inter-only type, steering-wheel logomark (see `docs/BRAND_IDENTITY.md`); it replaced the earlier visual reference image;
- agreed desktop-first waiter MVP scope.

## Most important product rules

- Waiter lands on Floor.
- Bottom nav: Floor, Reservations, Me.
- Orders is not a visible waiter destination. Order creation, item entry, active service, bill requests, and receipt access begin from the selected table on Floor.
- Table cards never show guest names or order numbers. Occupied cards show the assigned waiter and show `Mine` as a separate badge.
- Legacy `/waiter/orders`, `/waiter/orders/new?tableId=...`, and `/waiter/orders/[orderId]` URLs redirect into Floor while preserving safe table/order context.
- No Menu tab.
- Menu opens only from order flow.
- Available, waiter-owned Occupied, resumed draft, and seated-reservation entry paths all use one URL-backed full-screen order workspace.
- Menu navigation comes from `GET /api/menu/navigation`; no waiter taxonomy is hardcoded.
- Simple tiles add immediately; servings, modifiers, quantity, and item comments live in the focused configurator.
- Table statuses: Available, Occupied, Reserved.
- Waiter cannot edit another waiter's occupied order.
- Payment collection and order close remain outside waiter scope.
- No table notes.
- Item notes only.
- No combine/uncombine table MVP.
- Receipt send pending/no live adapter.
- Public mobile-money execution pending provider confirmation.

## Premium Menu Order Entry (2026-07-16)

Prompt 2 replaces the narrow table-panel menu with one full-screen desktop workspace. Its context bar preserves table, order state, ownership, item count, and running total. The left rail renders API sections and browse groups; the centre renders API subgroups, whole-menu search, and minimal item tiles; the right panel remains visible for draft lines, returned subtotal/tax/discount/total, send, bill, and receipt actions. Sent-order additions remain blocked because the backend has no per-line dispatch state.

## Premium Me and shared profile foundation (2026-07-18)

Waiter Me now uses a role-aware operational hero, one focused shift section, concise self-scoped attendance/leave/swap sections, branch/account context, and a quiet session card. Employee linkage is read only from verified auth context. Missing linkage produces one primary capability notice and compact dependent unavailable states; it never fabricates or creates an employee. Long-running or missing-start shifts are labeled `Shift issue` and remain untouched for operational review. Cashier and Supervisor reuse the visual profile primitives while retaining their own requests, permissions, and role actions.
