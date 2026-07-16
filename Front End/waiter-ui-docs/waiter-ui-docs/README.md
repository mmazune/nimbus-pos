# Waiter UI Docs — Nimbus POS

Status: Draft v2  
Date: 2026-06-16

This folder contains Codex-ready documentation for the Nimbus POS waiter MVP frontend.

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
- latest visual reference image with navy / white / silver / graphite palette;
- agreed desktop-first waiter MVP scope.

## Most important product rules

- Waiter lands on Floor.
- Bottom nav: Floor, Orders, Reservations, Me.
- No Menu tab.
- Menu opens only from order flow.
- Table statuses: Available, Occupied, Reserved.
- Waiter cannot edit another waiter's occupied order.
- No table notes.
- Item notes only.
- No combine/uncombine table MVP.
- Receipt send pending/no live adapter.
- Public mobile-money execution pending provider confirmation.
