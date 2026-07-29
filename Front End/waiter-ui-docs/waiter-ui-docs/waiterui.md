# waiterui.md — Nimbus POS Waiter UI Blueprint

Status: Draft v2  
Date: 2026-06-16  
Platform: Desktop-first shared POS terminal  
Role: Waiter  
Extends: `DESIGN.md` and `waiter_design.md`

---

## 1. Purpose

This file is the screen-by-screen blueprint for the Nimbus waiter MVP.

It tells frontend developers and Codex what each waiter screen should contain, how it behaves, and which actions are allowed.

For full action lifecycle and edge cases, read `WAITER_LIFECYCLE.md`.

---

## 2. Current backend truth

The waiter backend has been hardened and verified.

Confirmed backend behavior includes:

- waiter order ownership guard;
- table auto-occupy on dine-in order send;
- table auto-occupy on reservation seat;
- table auto-release on terminal order status where applicable;
- `GET /api/pos/orders?userId=me`;
- `GET /api/pos/orders?excludeStatus=NEW`;
- `POST /api/pos/orders/:id/request-bill`;
- shift gating for waiter operational writes;
- HR self-scope using `?mine=true`;
- tightened waiter reservation and handoff permissions;
- dedicated waiter role Postman collection.

Known caveats:

- receipt send is pending/no live adapter;
- public diner mobile-money execution is pending MTN/Airtel provider confirmation;
- no combine/uncombine table UI in waiter MVP;
- waiter does not perform reservation admin actions;
- waiter does not perform manager/cashier-only handoff/order surgery.

## Shared Floor implementation note (2026-07-18)

The Waiter Floor blueprint is now implemented through shared operational components also consumed by Supervisor. Search covers table/assigned staff presentation, filters are All/Available/Occupied/Reserved/Mine, and floor-plan selection appears when multiple plans exist. The card keeps complete identifiers visible and omits guest/order-number detail. Waiter selection still opens the existing instant menu/order workspace with its cached handoff and ownership behavior.

---

## 3. Waiter shell

### 3.1 Header

Persistent on all waiter screens.

Left:

- brand/logo slot;
- branch name;
- service area.

Center:

- current time only.

Right:

- waiter avatar;
- waiter name;
- logout button.

### 3.2 Bottom nav

Fixed bottom navigation with exactly:

1. Floor.
2. Reservations.
3. Me.

No Orders, Menu, Dashboard, Payments, or More tab.

### 3.3 Main area

Changes by selected tab.

---

## 4. Login and entry

### 4.1 Login modes

Shared login shell supports:

- Quick PIN;
- Email + Password.

Waiter default: Quick PIN.

### 4.2 Login content

Top:

- brand slot;
- branch name;
- current time;
- terminal/workstation label.

Center:

- mode switch;
- PIN pad or email/password form.

Bottom:

- online/offline status;
- app version/build.

### 4.3 Entry flow

1. Waiter enters PIN.
2. App authenticates.
3. App calls `GET /api/auth/me`.
4. App resolves branch/context.
5. App checks shift state.
6. App routes to Floor/Tables.

### 4.4 Shift not started

If shift is not open:

- waiter can see shell and read-safe content;
- operational write actions are blocked;
- show banner:
  `Shift not started — service actions disabled.`
- show CTA:
  `Start shift`.

---

## 5. Floor / Tables screen

Default screen after login.

### 5.1 Goal

Let waiter see table state and enter service quickly.

### 5.2 Layout

- header;
- toolbar;
- responsive table card grid;
- bottom nav.

### 5.3 Toolbar

Search:

- table number/name;
- guest name;
- order number.

Filters:

- All;
- Available;
- Occupied;
- Reserved;
- Mine.

Optional:

- service-area switcher if the waiter has access to multiple areas.

### 5.4 Table card content

All cards show:

- table number/name;
- status badge;
- capacity/seats.

#### Available card

Show:

- `Available`;
- capacity;
- quiet empty state such as `Ready for service`.

Action:

- tap to create order.

#### Reserved card

Show:

- `Reserved`;
- guest name;
- reservation time;
- table capacity.

Action:

- tap to view reservation detail and seat guest.

#### Occupied card

Show:

- `Occupied`;
- guest name if available;
- assigned waiter formatted as `FirstName L.`;
- separate `Mine` badge for the logged-in waiter;
- capacity.

Do not show order number, `ORDER`, order status, bill state, or a nested order panel on table cards.

Action:

- if owned by current waiter: open order/service view;
- if another waiter owns it: show blocked panel.

### 5.5 Another waiter's occupied table

Do not open editable order flow.

Show blocked panel:

- assigned waiter;
- table status;
- order summary;
- explanation:
  `This table belongs to another waiter.`
- no edit actions.

---

## 6. Table tap flows

### 6.1 Available table

Tap available table → create dine-in order → open order builder/menu.

No table notes.

### 6.2 Reserved table

Tap reserved table → reservation detail.

Show:

- guest;
- reservation time;
- assigned table;
- reservation status.

Actions:

- Seat guest;
- create linked dine-in order;
- enter order builder.

### 6.3 Occupied own table

Tap occupied own table → order summary/edit.

Show:

- back button;
- table name;
- order number;
- elapsed time;
- items;
- status;
- bill state;
- total.

Actions:

- add items;
- edit allowed item details;
- send to kitchen/bar;
- request bill;
- open receipt if available.

### 6.4 Occupied other waiter table

Tap → blocked panel only.

---

## 7. Order Builder / Menu

Menu lives here only.

### 7.1 Entry points

- Available table.
- Reserved table after seat.
- Existing own order → Add items.

### 7.2 Layout

Desktop default:

- order context bar;
- menu/category browsing area;
- sticky order panel.

### 7.3 Order context bar

Show:

- back button;
- table name;
- order number;
- elapsed time;
- bill state.

Avoid extra metadata unless necessary.

### 7.4 Menu area

Include:

- category chips;
- item search;
- menu item cards/list;
- serving formats;
- modifiers/options;
- item note field.

### 7.5 Menu item card

MVP does not require food images.

Show:

- item name;
- price;
- short description if helpful;
- availability;
- Add action.

### 7.6 Item edit controls

Waiter can:

- add item;
- adjust quantity where allowed;
- remove item where allowed;
- choose modifier/options;
- add item-level note;
- send items/order.

### 7.7 Item notes

Item notes are kitchen/bar instructions.

Examples:

- No cheese.
- Add lemon.
- With ice.
- Extra spicy.

No table notes.

### 7.8 Send to kitchen/bar

Primary order action.

After send:

- order state updates;
- KDS/bar backend flow continues;
- table becomes Occupied for dine-in;
- show success toast:
  `Order sent to kitchen/bar.`

---

## 8. Legacy Orders routes

### 8.1 Purpose

Orders is no longer a visible waiter tab. Waiter-owned active service is selected from its linked table on Floor.

Compatibility behavior:

- `/waiter/orders` redirects to Floor;
- `/waiter/orders/new?tableId=...` redirects to the selected table on Floor;
- `/waiter/orders/[orderId]` resolves its linked table before redirecting, blocks other-waiter ownership, and shows a truthful fallback if no accessible table exists.

Backend list should use:

```txt
GET /api/pos/orders?userId=me&excludeStatus=NEW
```

### 8.2 Retained queue-component filters (not navigation)

- Active;
- Sent;
- Ready;
- Served;
- Closed Today.

No Draft filter.

### 8.3 Retained queue-component fields

Show only MVP fields:

- table name;
- guest name;
- order number;
- time/elapsed time;
- status;
- total;
- bill state.

### 8.4 Legacy order selection

Opens order detail/edit for waiter-owned order.

If backend returns ownership error:

- show blocked panel:
  `This order belongs to another waiter.`

---

## 9. Bill and receipt workflow

### 9.1 Request bill

When guest asks for bill:

- waiter taps Request bill;
- backend records `ORDER_BILL_REQUESTED`;
- no payment is captured by waiter action.

Show:

- `Bill requested.`

### 9.2 Receipt drawer

Open from order when receipt exists or bill flow reaches receipt stage.

Show:

- receipt/order number;
- table;
- waiter;
- items;
- subtotal;
- tax;
- discount;
- total;
- paid;
- outstanding;
- payment summary.

### 9.3 Receipt actions

- view;
- history;
- reprint;
- send receipt.

### 9.4 Receipt send caveat

Send receipt is not live delivery.

Show exact caveat:

```txt
PENDING — no live email/SMS/WhatsApp adapter
```

---

## 10. Reservations tab

### 10.1 Purpose

Operational seating support, not reservation management.

### 10.2 Show

- today’s reservations;
- upcoming reservations;
- guest name;
- time;
- assigned table;
- status.

### 10.3 Allowed actions

- open detail;
- seat confirmed guest;
- create linked dine-in order.

### 10.4 Not allowed

- create reservation;
- confirm reservation;
- cancel reservation;
- deposits;
- assign table;
- event admin;
- ticketing.

Denied actions should not appear in UI.

---

## 11. Me tab

### 11.1 Purpose

Keep identity/session utilities out of service screens.

### 11.2 Show

The page uses a premium operational profile hierarchy:

1. role-aware profile hero with verified name, initials, account identifier, branch, optional assigned service area, and shift state;
2. one shift section with start time, elapsed duration, branch, shift note, operational warning, and exactly one Start shift or End shift action;
3. concise attendance history;
4. current/recent leave plus a focused request form when supported;
5. incoming and outgoing shift-swap history;
6. branch/account context;
7. session context and Sign out.

### 11.3 Rules

- no payroll;
- no staff list;
- no reports;
- no accounting;
- no manager settings.
- no fabricated avatar or service area;
- no raw internal IDs;
- one employee-link capability notice at most;
- dependent sections use compact unavailable states and do not repeat the primary notice;
- abnormal long-running or missing-start shifts are labeled `Shift issue` and are never changed automatically;
- status always includes text and is not color-only.

---

## 12. Search and filters by tab

### Floor

Search:

- table number/name;
- guest name;
- order number.

Filters:

- All;
- Available;
- Occupied;
- Reserved;
- Mine.

### Orders

Search:

- order number;
- table;
- guest.

Filters:

- Active;
- Sent;
- Ready;
- Served;
- Closed Today.

### Reservations

Search:

- guest name;
- phone if allowed;
- table.

Filters:

- Today;
- Upcoming;
- Seated;
- Reserved/Confirmed if mapped by backend.

### Me

No search.

---

## 13. Pending and caveat states

### Receipt send

Pending/no live adapter.

### Mobile money

Public diner mobile-money execution is pending MTN/Airtel provider confirmation. Do not build or imply live mobile-money execution.

### Combined tables

Not in waiter MVP.

### Order handoff

Waiter handoff/admin order surgery is not in waiter MVP.

### Closing/payment

Waiter requests bill. Cashier/payment role completes payment/close unless backend explicitly allows waiter close later.

### Sent-order additions

The current backend does not expose per-line sent state or a dedicated additions-dispatch endpoint.
The UI must not call the initial send transition again from `SENT` or imply that later lines reached
KDS. Keep sent-order item mutations blocked until a safe backend contract exists.

---

## 14. Acceptance criteria

Waiter UI is acceptable when:

1. Waiter logs in via PIN.
2. App calls `GET /api/auth/me`.
3. Waiter lands on Floor.
4. Header and nav match the contract.
5. Table cards show only Available/Occupied/Reserved.
6. Available table starts order flow.
7. Reserved table seats guest and creates linked order.
8. Occupied own table opens order workflow.
9. Occupied other-waiter table blocks edit.
10. Menu is not a nav tab.
11. Item notes are item-level only.
12. No Orders tab is visible; table-linked order work opens from Floor.
13. Request bill is present.
14. Receipt send is caveated.
15. Me tab handles shift/session utilities.
16. Idle timeout logs out.
17. Unsupported actions are hidden or blocked.

---

## 15. Full-screen order-entry screen

The selected order replaces normal Floor content. The top bar contains Back to Floor, complete table identifier, order state, Mine/ownership, item count, and running total. The fixed desktop body is:

- left: API section switcher and browse-group rail;
- centre: API subgroup row, whole-menu search, and minimal item grid;
- right: persistent active-order lines, returned totals, Send to kitchen/bar, bill, and receipt access.

Clearing search restores the previously active group/subgroup. The UI never displays internal backend categories, tax categories, stations, or IDs. Unavailable items are not selectable.

The item configurator is a full-height side sheet. Required/optional state, min/max guidance, Included/price-delta copy, quantity, serving, and item comment are visible together. Required and maximum selection constraints are enforced before Add/Update. Existing-line serving is read-only under the current PATCH contract.
