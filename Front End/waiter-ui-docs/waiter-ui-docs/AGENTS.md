# AGENTS.md — Nimbus POS Waiter MVP Frontend Agent Contract

Status: Draft v2  
Date: 2026-06-16  
Applies to: `waiter-ui-docs/` and any future waiter MVP frontend implementation  
Primary build target: **desktop-first shared POS terminal**  
Companion files: `DESIGN.md`, `waiter_design.md`, `waiterui.md`, `WAITER_LIFECYCLE.md`

---

## 1. Purpose and authority

This file is the instruction contract for Codex or any coding agent working on the Nimbus POS waiter MVP frontend.

The waiter MVP is not a general dashboard. It is a fast, enterprise-grade restaurant service surface for shared desktop POS terminals.

Before making any waiter frontend change, the agent must read files in this order:

1. `AGENTS.md` — global rules, file hierarchy, implementation guardrails.
2. `DESIGN.md` — global visual system, tokens, typography, layout, components, accessibility.
3. `waiter_design.md` — waiter-specific layouts, components, states, and icon registry.
4. `waiterui.md` — screen-by-screen waiter UI blueprint.
5. `WAITER_LIFECYCLE.md` — end-to-end waiter service lifecycle, actions, allowed/denied states, and backend caveats.
6. Backend/API source of truth:
   - `ai/WAITER_MVP_BACKEND_COMPLETION_REPORT.md`
   - `ai/WAITER_MVP_POSTMAN_COMPLETION_REPORT.md` if present
   - `postman/collections/WAITER-MVP-Role-Workflow.postman_collection.json`

Code may extend these files. Code must not contradict them.

---

## 2. Product position

Nimbus POS waiter MVP should feel like:

- a premium enterprise hospitality POS;
- a fast waiter service console;
- a calm shared terminal interface;
- a reliable operational tool for rush periods.

It must not feel like:

- a generic admin dashboard;
- a mobile-first app;
- a social media layout;
- a toy restaurant ordering demo;
- a flashy gradient SaaS page;
- a design built around fake frontend-only business logic.

---

## 3. Locked waiter MVP decisions

These are non-negotiable for MVP unless product updates this file.

1. Desktop-first only.
2. No mobile app.
3. Waiter logs in through the shared auth shell.
4. Waiter primarily uses Quick PIN.
5. Email + Password remains available in the shared login shell for manager/accountant/owner/backoffice users.
6. After waiter login, call `GET /api/auth/me` for canonical context.
7. Waiter lands directly on **Floor / Tables**.
8. No waiter dashboard.
9. Fixed header.
10. Fixed bottom nav.
11. Bottom nav items: **Floor**, **Reservations**, **Me**.
12. Orders is not a visible waiter navigation destination or standalone workspace.
13. Menu, order entry, active service, bill, and receipt work open contextually from the selected table on Floor.
14. Waiter table statuses shown in UI: **Available**, **Occupied**, **Reserved** only.
15. Do not show Cleaning or Blocked as waiter MVP table statuses.
16. No table notes.
17. Notes are item-level only.
18. Any waiter may seat a reserved guest if the backend permits `seat`.
19. An occupied table/order can only be opened for edit by its owning waiter.
20. Another waiter's occupied table opens only a blocked/read-only panel.
21. No combine/uncombine table UI in MVP.
22. Waiter reservation scope is operational only: list/read/detail/seat.
23. Waiter cannot create, confirm, cancel, assign tables, or handle reservation deposits.
24. Waiter cannot use order handoff/admin actions unless explicitly re-approved.
25. Idle timeout logs out and returns to login.
26. No switch-user flow.
27. No separate lock-screen mode.
28. Receipt send remains pending because there is no live email/SMS/WhatsApp adapter yet.
29. Public diner mobile-money execution remains pending provider confirmation and must not be presented as live.

---

## 4. Backend source of truth

Frontend may call only verified endpoints.

The dedicated waiter role Postman collection is the preferred frontend-facing proof of contract:

```txt
postman/collections/WAITER-MVP-Role-Workflow.postman_collection.json
```

Do not invent routes because a screen needs data. If a route is missing, add it to a gap report instead of fabricating a frontend-only contract.

### Required backend contracts to respect

- `ORDER_NOT_OWNED_BY_WAITER` means waiter tried to access another waiter's order.
- `ORDER_TRANSITION_NOT_WAITER_SAFE` means waiter tried a non-waiter transition.
- `SHIFT_NOT_OPEN` means waiter can be logged in but cannot perform operational writes.
- `ORDER_BILL_REQUESTED` is the audit action when waiter requests bill.
- `?userId=me` should be used for waiter order lists.
- `?excludeStatus=` should be used to remove non-waiter states from waiter order lists.
- `?mine=true` should be used for waiter HR/self-service reads.

---

## 5. Brand and visual rules

The waiter palette comes from the **Nimbus POS Brand Identity guide (Andimashimwe Rhoda, August 2026)** — canonical reference `docs/BRAND_IDENTITY.md`:

- Deep navy `#000033` (canonical brand Navy Blue).
- White `#FFFFFF`.
- Light grey `#B3B4AF` (brand Light Grey; the "warm silver" accent).
- Dark grey `#6B6B6B` (brand Dark Grey — sampled from the guide's Dark Grey swatch; the guide's printed hex is a typo).
- Complementary amber/status colors only where functionally needed.

Brand type is **Inter only** (ExtraBold display, Regular body). The logomark is the steering wheel — now shipped: extracted from the brand PDF into `apps/web/public/brand/`, rendered in-app by `components/pos-shell/NimbusLogomark.tsx`, and the favicon is the brand mark (the interim "N" placeholder is gone).

No arbitrary color values are allowed in components after tokens are created. Use tokens from `DESIGN.md`.

---

## 6. Typography rules

Use an enterprise-grade UI font. The approved recommendation is:

```txt
Inter Variable
```

Fallback:

```txt
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

Use tabular numbers for:

- current time;
- order totals;
- prices;
- table numbers;
- quantities;
- timers;
- receipt totals.

Do not use decorative serif fonts in waiter/cashier/KDS operational screens.

---

## 7. Icon rules

Use **Phosphor Icons** only for the waiter MVP.

Rules:

- no mixed icon families;
- no emojis;
- no icon-only primary actions unless the accessible label and visible context are obvious;
- active bottom nav may use filled/duotone icons, but inactive nav uses regular icons;
- icons use `currentColor`.

---

## 8. Implementation rules for Codex

1. Read the docs before coding.
2. Do not create frontend routes/pages that are not described in these docs.
3. Do not expose actions that the waiter role cannot perform.
4. Hide actions the waiter can never perform.
5. Disable or block actions that are temporarily unavailable because of current state.
6. Always show a reason for blocked waiter actions.
7. Use skeleton loading where the final layout is known.
8. Use inline progress only for short actions.
9. Do not use random mock data in production paths.
10. Use TypeScript types from API responses where possible.
11. Keep POS screens touch-friendly.
12. Respect the idle logout pattern.
13. No mobile-only assumptions.
14. No table-combine UI.
15. No mobile-money execution UI unless the provider-confirmed backend exists.

---

## 9. Required waiter frontend structure

Recommended folder structure:

```txt
src/
  app/
    waiter/
      floor/
      orders/
      reservations/
      me/
  components/
    waiter/
      shell/
      floor/
      orders/
      order-builder/
      reservations/
      receipt/
      me/
      states/
  lib/
    waiter/
      api.ts
      permissions.ts
      state.ts
      formatters.ts
```

Naming must stay domain-specific:

- `WaiterShell`
- `WaiterHeader`
- `WaiterBottomNav`
- `WaiterFloorScreen`
- `WaiterTableCard`
- `WaiterOrderBuilder`
- `WaiterReceiptDrawer`
- `WaiterReservationsScreen`
- `WaiterMeScreen`

---

## 10. Required state coverage

Every major waiter screen must implement:

- loading;
- empty;
- success feedback;
- failure;
- blocked;
- offline/degraded if applicable.

Blocked states must cover:

- shift not open;
- another waiter owns order;
- permission denied;
- maintenance;
- receipt adapter pending;
- route unsupported.

---

## 11. Copy rules

Use short operational copy.

Examples:

- `Shift not started — service actions disabled.`
- `This table belongs to another waiter.`
- `Order sent to kitchen/bar.`
- `Bill requested.`
- `Receipt send recorded as pending.`
- `No active orders. Start service from Floor.`

Avoid:

- long marketing copy;
- jokes;
- emojis;
- vague errors like `Something went wrong`.

---

## 12. Acceptance criteria

The waiter MVP frontend is acceptable only when:

1. Waiter can log in by PIN.
2. Waiter routes to Floor/Tables.
3. Waiter sees only Available, Occupied, Reserved.
4. Waiter can start order from available table.
5. Waiter can seat a reservation and create a linked order.
6. Waiter can edit only their own occupied order.
7. Another waiter's order is blocked.
8. Waiter can add items, modifiers, and item notes.
9. Waiter can send order to kitchen/bar.
10. Waiter can request bill.
11. Waiter can view receipt, history, reprint, and send-pending contract.
12. Waiter can resume waiter-owned orders from their linked table on Floor; `userId=me` remains an internal data-scope contract.
13. Waiter can use Me for shift/session/self-service utilities.
14. Idle timeout returns to login.
15. No unsupported action is silently visible as if it works.
16. No frontend route invents backend behavior.

---

## 13. Anti-patterns

Never build:

- a waiter dashboard;
- a separate visible waiter Orders workspace;
- menu as a bottom-nav tab;
- table notes;
- combine/uncombine table UI;
- waiter reservation admin;
- waiter cashier payment close flow unless backend role allows it;
- live mobile-money execution for public diners;
- fake receipt delivery success;
- fake printer/terminal hardware success;
- generic gradient cards;
- glassmorphism;
- mixed icon families;
- random hardcoded colors;
- mobile-first layouts for this MVP.
