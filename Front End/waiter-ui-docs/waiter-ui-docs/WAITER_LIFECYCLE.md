# WAITER_LIFECYCLE.md — Nimbus POS Waiter Service Lifecycle

> ⚠️ **HISTORICAL / SUPERSEDED (2026-08-20).** This is a pre-implementation draft
> (Draft v1, 2026-06-16). It has been **superseded by
> `docs/waiter-ui-docs/WAITER_LIFECYCLE.md`**, which documents the implemented build and
> cites the code for every claim; the deltas from this draft are enumerated in its §11.
> Endpoint contracts, permissions and live-verification status now live in
> `docs/waiter-ui-docs/WAITER_API_MATRIX.md`.
>
> This file is retained for history — it remains the best record of intent and of the
> denied-action reasoning. **Do not treat it as current spec.** Palette references also
> predate the Aug-2026 rebrand; `docs/BRAND_IDENTITY.md` is canonical for brand colours.

Status: Draft v1 (superseded — see banner above)  
Date: 2026-06-16  
Purpose: exhaustive waiter MVP lifecycle and action contract  
Scope: backend-verified waiter MVP, desktop-first shared POS terminal

---

## Shared operational shell status (2026-07-18)

Waiter consumes the shared `OperationalShell`, `OperationalHeader`, `OperationalBottomNav`, `CurrentTime`, navigation presentation, and canonical operational icon registry also used by Cashier and Supervisor. Waiter navigation remains exactly Floor, Reservations, Me. Waiter guards, shift/readiness data, table/order behavior, permissions, queries, and mutations remain role-owned; shared-shell changes do not grant new capabilities.

## Shared operational Floor status (2026-07-18)

Waiter and Supervisor consume the same `OperationalFloor`, toolbar, grid, table card, status badge, staff-name formatter, and state treatments. Waiter still owns table/order/reservation normalization, menu prefetch, immediate workspace mounting, background draft creation, early-item queuing, reserved seating handoff, and other-waiter blocking. Shared Floor extraction does not change those lifecycle rules.

## 1. Why this document exists

This document describes the complete waiter lifecycle in Nimbus POS:

```txt
login → shift readiness → floor/table selection → order creation → item edits → send to kitchen/bar → active service → request bill → receipt/payment-adjacent flow → order closure visibility → logout
```

It is designed to make sure the UI does not skip any step and does not expose actions that are not backed by the backend.

Use this file as the product checklist before implementing waiter screens.

---

## 2. Waiter MVP operating model

### Waiter can do

- log in by Quick PIN;
- resolve context through `GET /api/auth/me`;
- start/open shift if allowed;
- view Floor/Tables;
- start an order on an Available table;
- open Reserved table details;
- seat a guest from reservation;
- create linked dine-in order through reservation seat;
- open own Occupied table/order;
- add items;
- add item modifiers/options;
- add item-level notes;
- update or remove allowed item lines;
- send order to kitchen/bar;
- resume own active service from its linked table on Floor;
- request bill;
- view receipt if available;
- reprint receipt if permitted;
- send receipt only as pending/no live adapter;
- access own attendance/leave/shift-swap utilities;
- logout.

### Waiter cannot do in MVP

- open/edit another waiter's occupied order;
- create reservation;
- confirm reservation;
- cancel reservation;
- handle deposits;
- assign reservation tables;
- manage events/ticketing;
- combine/uncombine tables;
- transfer table/server;
- move items between orders;
- split bill/items;
- merge orders;
- mark in-kitchen;
- mark ready;
- void order;
- close order/payment unless explicitly allowed in future;
- run mobile-money public diner payment execution;
- manage devices/printers/terminals;
- see accounting/reporting/payroll/admin views.

---

## 3. Lifecycle overview

### Main happy path

1. Waiter logs in with Quick PIN.
2. App resolves context.
3. App checks shift.
4. Waiter lands on Floor.
5. Waiter taps Available table.
6. System creates dine-in order.
7. Waiter selects menu items.
8. Waiter adds modifiers and item notes.
9. Waiter sends order to kitchen/bar.
10. Table becomes Occupied.
11. Waiter may add more items later.
12. Guest asks for bill.
13. Waiter requests bill.
14. Cashier/payment flow handles payment/close.
15. Waiter can view/reprint receipt if available.
16. Closed order appears under Closed Today.
17. Table releases when backend sees no active dine-in order.

---

## 4. Login lifecycle

### 4.1 Quick PIN login

Trigger:

- waiter arrives at shared terminal.

Actions:

1. Select Quick PIN mode if not already selected.
2. Enter PIN.
3. Submit.
4. Backend authenticates.
5. App stores access/session token.
6. App calls `GET /api/auth/me`.

Expected outcome:

- waiter context is resolved;
- role is Waiter;
- org/branch context is known.

Failure cases:

| Failure | UI response |
|---|---|
| Wrong PIN | Show inline error; keep PIN pad. |
| No branch context | Show blocked context error. |
| Network error | Show retry and offline/degraded state. |
| Session invalid | Return to login. |

### 4.2 Email + Password login

Used mainly by:

- owner;
- manager;
- accountant;
- backoffice roles.

Waiter may still use it if the backend account supports it, but Quick PIN is default.

---

## 5. Shift readiness lifecycle

### 5.1 Shift check

After login:

1. app checks active shift;
2. if shift open, waiter can operate;
3. if shift not open, show shift banner.

### 5.2 Shift not open

UI state:

```txt
Shift not started — service actions disabled.
```

Allowed:

- view safe read-only content;
- open Me tab;
- start shift if allowed;
- logout.

Blocked:

- create order;
- add item;
- send;
- request bill;
- reservation seat if backend classifies it as operational write.

Backend may return:

```txt
SHIFT_NOT_OPEN
```

### 5.3 Start shift

Trigger:

- waiter taps Start Shift.

Outcome:

- shift is open;
- banner disappears;
- operational actions unlock.

### 5.4 End shift

Usually from Me tab.

Before ending shift, UI should consider whether there are:

- active orders;
- open bill requests;
- unsent order items;
- unresolved service tasks.

If backend blocks closing shift, show exact reason.

---

## 6. Floor lifecycle

### 6.1 Load floor

The Floor screen loads:

- service area;
- table grid;
- table status;
- linked reservation/order context;
- table capacity.

Only show statuses:

- Available;
- Occupied;
- Reserved.

### 6.2 Search and filter

Search supports:

- table number/name;
- guest name;
- order number.

Filters:

- All;
- Available;
- Occupied;
- Reserved;
- Mine.

### 6.3 Table card data rules

Every table card should show:

- table name;
- status;
- capacity.

Additional data depends on status:

| Status | Extra data |
|---|---|
| Available | simple ready state. |
| Reserved | guest name, reservation time. |
| Occupied | assigned waiter as `FirstName L.`, separate `Mine` badge when owned, guest name if useful. |

Order numbers and order-status details belong in the selected-table workspace, never on table cards.

---

## 7. Available table lifecycle

### 7.1 Tap Available table

Trigger:

- waiter taps Available table.

System should:

1. verify shift is open;
2. create dine-in order;
3. assign waiter as order owner;
4. open Order Builder/Menu.

No table notes.

### 7.2 Create order

Backend result:

- order is created;
- status may begin as NEW/OPEN depending backend terminology;
- table may remain Available until order is sent if backend uses send as occupancy trigger.

UI result:

- order context bar shows table and order number;
- menu opens.

### 7.3 Add first item

Waiter chooses item.

Possible item configuration:

- serving format;
- modifiers;
- quantity;
- item note.

Examples:

- Coca Cola, with ice, add lemon.
- Burger, no cheese.
- Steak, medium rare.
- Pizza, extra cheese.

### 7.4 Edit before send

Before sending, waiter may:

- increase quantity;
- decrease quantity;
- remove item;
- edit modifier;
- edit item note;
- add another item.

If backend denies a change because item/order state changed, show blocked state.

### 7.5 Send

Waiter taps:

```txt
Send to kitchen/bar
```

Backend should:

- transition order to SENT;
- create KDS/bar workflow;
- mark dine-in table Occupied.

UI should:

- show success;
- return to order/service summary;
- update table card to Occupied.

---

## 8. Reserved table lifecycle

### 8.1 Tap Reserved table

Trigger:

- waiter taps Reserved table.

UI opens reservation detail.

Show:

- guest name;
- reservation time;
- assigned table;
- status.

### 8.2 Seat guest

Any waiter may seat a reserved guest if the backend permits it.

When waiter taps Seat:

Backend should:

- mark reservation seated;
- optionally create linked dine-in order;
- mark table Occupied;
- assign created order to current waiter.

UI should:

- show success:
  `Guest seated.`
- open order flow for the linked order.

### 8.3 Reservation blocked states

Blocked reasons:

- reservation already seated;
- table conflict;
- reservation cancelled/no-show;
- waiter lacks permission;
- shift not open;
- backend validation issue.

UI must show the backend reason where possible.

---

## 9. Occupied own table lifecycle

### 9.1 Tap own Occupied table

UI opens Active Order Summary.

Show:

- table name;
- order number;
- elapsed time;
- items;
- status;
- total;
- bill state.

Actions:

- add items;
- edit allowed item details;
- send additions;
- mark served if waiter-safe and allowed;
- request bill;
- open receipt if available.

### 9.2 Add to existing order

Trigger:

- guest orders another item.

Flow:

1. waiter taps Add items;
2. menu opens;
3. waiter selects item;
4. waiter adds modifiers/notes;
5. waiter sends additional items.

Backend must treat ownership and shift rules the same as original order.

### 9.3 Editing after send

Safe edits depend on backend order state.

Allowed if backend permits:

- add new unsent items;
- edit new unsent items;
- update item note before send;
- remove unsent item.

Usually not waiter-safe:

- void sent item;
- void full order;
- manager-level discounts/voids;
- forced kitchen state changes.

If denied:

- show blocked reason;
- hide action in normal UI if never waiter-permitted.

---

## 10. Occupied table owned by another waiter

### 10.1 Tap other waiter's table

UI must not open editable order flow.

Show blocked/info panel:

- assigned waiter;
- table;
- order state;
- message:
  `This table belongs to another waiter.`

Backend protection:

- if UI accidentally calls the order, backend returns:
  `ORDER_NOT_OWNED_BY_WAITER`.

UI response:

- show blocked panel;
- do not retry as admin;
- do not expose edit actions.

---

## 11. Order item lifecycle

### 11.1 Add item

Inputs:

- menu item;
- quantity;
- serving format;
- modifiers;
- note.

Output:

- item appears in order panel.

### 11.2 Update item

Possible updates:

- quantity;
- modifiers;
- note.

Restrictions:

- sent/locked items may not be editable;
- backend state controls what is allowed.

### 11.3 Remove item

Possible only when backend allows.

If item was already sent, removal may be restricted or require manager/cashier flow.

### 11.4 Notes

Notes are item-level only.

Do not create table note UI.

### 11.5 Modifiers

Modifiers should follow backend payload shape.

Do not invent a new frontend modifier contract.

---

## 12. Send/KDS lifecycle

### 12.1 Send order

Waiter sends order.

Backend:

- validates shift;
- validates waiter ownership;
- validates transition;
- transitions to SENT;
- creates kitchen/bar flow;
- marks table Occupied.

### 12.2 Waiter visibility after send

Waiter sees service status only.

Do not expose:

- KDS station config;
- mark in-kitchen;
- mark ready;
- kitchen admin controls.

### 12.3 Ready/served

If backend allows waiter to mark served, show it only in appropriate state.

If backend denies Ready/In Kitchen, hide those actions.

---

## 13. Floor-centered order lookup and legacy route lifecycle

### 13.1 Internal order data

The UI may use waiter self filters internally:

```txt
GET /api/pos/orders?userId=me&excludeStatus=NEW
```

### 13.2 No visible order queue

There is no visible Orders tab or standalone queue workspace. The waiter selects the linked table on Floor.

Retained queue-component filters are not navigation:

- Active;
- Sent;
- Ready;
- Served;
- Closed Today.

### 13.3 Order card

Show:

- table;
- guest;
- order number;
- time;
- status;
- total;
- bill state.

### 13.4 Legacy URL handling

- order list URLs redirect to Floor;
- new-order URLs preserve `tableId`;
- order-detail URLs resolve the linked table and preserve `orderId`;
- other-waiter orders remain blocked by `ORDER_NOT_OWNED_BY_WAITER`;
- orders without an accessible table show a truthful fallback.

---

## 14. Request bill lifecycle

### 14.1 Guest asks for bill

Waiter taps:

```txt
Request bill
```

Backend:

- records `ORDER_BILL_REQUESTED`;
- does not capture payment;
- does not close order.

UI:

- show success:
  `Bill requested.`
- update bill state.

### 14.2 Why request bill exists

It separates:

- waiter service action;
- cashier/payment action;
- final order close.

This prevents the waiter UI from pretending to handle money if the role should not.

---

## 15. Payment and close lifecycle

### 15.1 Waiter MVP payment rule

Waiter does not perform full payment/close unless product explicitly changes waiter permissions later.

Current waiter path:

1. request bill;
2. cashier/payment role handles payment;
3. order transitions to closed through permitted flow;
4. waiter can see Closed Today;
5. table auto-releases if no active dine-in order remains.

### 15.2 Mobile money pending

Public diner mobile-money execution remains:

```txt
CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION
```

Do not add live mobile-money capture to waiter MVP.

### 15.3 Close visibility

When order is closed by cashier/authorized role:

- waiter may see it in Closed Today;
- receipt may become available;
- table may return Available if backend auto-release conditions are met.

---

## 16. Receipt lifecycle

### 16.1 Open receipt

Entry points:

- bill requested and receipt available;
- order paid/closed;
- receipt action in order detail.

### 16.2 View receipt

Show:

- receipt/order number;
- table;
- waiter;
- item lines;
- subtotal;
- tax;
- discount;
- total;
- paid;
- outstanding;
- payment summary.

### 16.3 Reprint receipt

Allowed if permission exists.

Show progress:

```txt
Reprinting receipt...
```

Success:

```txt
Receipt reprint requested.
```

### 16.4 Send receipt

Backend returns pending/no live adapter.

UI must label:

```txt
PENDING — no live email/SMS/WhatsApp adapter
```

Do not show a fake sent state.

---

## 17. Reservation tab lifecycle

### 17.1 Load reservations

Show:

- today;
- upcoming;
- guest;
- time;
- table;
- status.

### 17.2 Open reservation

Show detail:

- guest;
- time;
- table;
- status;
- seat action if allowed.

### 17.3 Seat guest

Same as Reserved table flow.

### 17.4 Denied reservation admin

Waiter must not see:

- create;
- confirm;
- cancel;
- deposits;
- assign table;
- event admin.

If a route is hit accidentally, backend returns 403.

---

## 18. Me tab lifecycle

### 18.1 View identity/session

Show:

- name;
- role;
- email or username when available;
- branch;
- assigned service area only when verified;
- shift state;
- attendance status.

If no profile photo exists, use concise identity initials. Do not fabricate an avatar or expose raw IDs.

When the employee relationship is missing, show one primary `Employee profile required` notice. It explains that attendance, leave, and employee-linked shift swaps are unavailable, that an administrator must link the account to an employee, and that shift/session controls may still work. Dependent sections show only compact unavailable states. The notice disappears as soon as verified employee linkage exists.

### 18.2 Attendance

Allowed self-service:

- clock action;
- view own attendance with `?mine=true`.

Do not show other staff attendance.

Do not issue the attendance request when the session has no linked employee.

### 18.3 Leave request

Allowed if backend permits.

Show:

- create leave request;
- list own leave with `?mine=true`.

The request form is disclosed only when employee linkage and permission support submission. Do not render a large disabled form.

### 18.4 Shift swap

Allowed if backend permits.

Show:

- create shift swap;
- list own shift swaps with `?mine=true`.

Distinguish incoming and outgoing requests when returned. Creation remains unavailable until a safe target selector exists.

### 18.5 Shift status

The shift card is the only shift-control surface on Me. It shows the current state, start time, elapsed duration, branch, note, and one primary action. An open shift older than 16 hours or one without a valid start time is a `Shift issue`; show a review warning and never close or repair it automatically.

### 18.6 Logout

Waiter taps Logout.

Confirm lightly:

```txt
Log out of this terminal?
```

Then:

- clear session;
- return to login.

---

## 19. Idle lifecycle

If no activity for configured timeout:

1. clear waiter session;
2. return to login;
3. show branch/time;
4. require PIN/password again.

No switch-user.

No lock-screen mode.

---

## 20. Denied action matrix

| Action | Waiter MVP behavior |
|---|---|
| Open another waiter's occupied order | Blocked. |
| Create reservation | Hidden/403. |
| Confirm reservation | Hidden/403. |
| Cancel reservation | Hidden/403. |
| Reservation deposit | Hidden/403. |
| Assign reservation table | Hidden/403. |
| Transfer server/table | Hidden/403. |
| Move items | Hidden/403. |
| Split bill/items | Hidden/403. |
| Merge order | Hidden/403. |
| Mark in-kitchen | Hidden/403. |
| Mark ready | Hidden/403. |
| Void order | Hidden/403. |
| Close order/payment | Not waiter MVP unless explicitly changed. |
| Combine/uncombine table | Not built in MVP. |
| Mobile money execution | Pending provider. |

---

## 21. State and error handling

### `ORDER_NOT_OWNED_BY_WAITER`

Copy:

```txt
This order belongs to another waiter.
```

Action:

- close panel;
- return to Floor/Orders.

### `ORDER_TRANSITION_NOT_WAITER_SAFE`

Copy:

```txt
This action is not available for waiter role.
```

Action:

- hide the action in future render;
- show support/debug detail if needed.

### `SHIFT_NOT_OPEN`

Copy:

```txt
Shift not started — service actions disabled.
```

Action:

- start shift;
- go to Me;
- logout.

### Receipt send pending

Copy:

```txt
Receipt delivery is not live yet. This action is recorded as pending.
```

### Mobile money pending

Copy:

```txt
Mobile-money payment execution is pending MTN/Airtel provider confirmation.
```

---

## 22. Complete waiter service examples

### Example A — Walk-in guest

1. Waiter logs in.
2. Opens shift.
3. Taps Table 04 Available.
4. Creates dine-in order.
5. Adds food and drink.
6. Adds item note: `No onions`.
7. Sends order.
8. Table becomes Occupied.
9. Guest orders another drink.
10. Waiter opens own occupied table.
11. Adds drink.
12. Sends addition.
13. Guest asks for bill.
14. Waiter requests bill.
15. Cashier/payment flow closes order.
16. Waiter sees receipt.
17. Table releases when closed and idle.

### Example B — Reservation arrival

1. Waiter opens Reservations or taps Reserved table.
2. Opens reservation detail.
3. Seats guest.
4. Backend marks table Occupied.
5. Linked dine-in order opens.
6. Waiter adds items and sends.
7. Flow continues as normal order.

### Example C — Other waiter’s table

1. Waiter taps Occupied table owned by Sarah.
2. UI opens blocked panel.
3. If API is called, backend returns `ORDER_NOT_OWNED_BY_WAITER`.
4. UI explains and provides no edit actions.

### Example D — Receipt reprint

1. Guest asks for receipt copy.
2. Waiter opens order/receipt drawer.
3. Taps Reprint.
4. UI shows progress.
5. Backend records reprint.
6. UI shows success.

### Example E — Pending receipt send

1. Guest asks for digital receipt.
2. Waiter taps Send receipt.
3. UI shows pending caveat.
4. Backend records pending delivery.
5. UI does not claim message was delivered.

---

## 22A. Canonical full-screen order entry

All table-order entry paths converge on the same workspace and URL context:

1. Available table: list waiter-owned active orders for the table, resume `NEW` when present, otherwise create one dine-in order.
2. Waiter-owned Occupied table: load its existing order.
3. Seated reservation: use the linked `seatedOrderId` returned by the seat endpoint.
4. Browser refresh/Back: preserve `tableId` and `orderId`; never create merely because the page refreshed.

The mounted workspace count must remain one. Responsive CSS must not mount hidden duplicate lifecycle components because both instances could race list-first/create behavior.

Menu browsing uses `/api/menu/navigation` as the manager taxonomy and `/api/menu/catalog` as the item source. Sections, groups, subgroups, active flags, assignments, and sort order are respected. Internal categories, tax categories, stations, and browse IDs are not waiter-facing labels.

Draft lines can be added, updated, or deleted through the verified POS item endpoints. A simple item adds immediately. A configurable item uses the full-height configurator for quantity, serving, ordered modifier groups, min/max validation, charged options, and item notes. Existing-line serving remains read-only because PATCH does not accept `menuItemServingId`.

After send, item mutation remains blocked. The current backend has no per-line sent/unsent dispatch state, so Nimbus must not resend historical lines to dispatch an addition.

## 23. Final implementation checklist

Before building waiter UI, confirm:

- dedicated waiter Postman collection passes;
- colors/tokens are loaded into theme;
- Phosphor icons are installed;
- login supports Quick PIN and password;
- idle timeout configured;
- waiter `userId=me` list path works;
- `excludeStatus=NEW` path works;
- reservation seat path works;
- request-bill path works;
- receipt caveats are visible;
- no denied waiter action appears as live;
- navigation is exactly Floor, Reservations, Me;
- bill and receipt access begin from the selected table on Floor;
- payment collection and close remain outside waiter scope;
- sent-order additions remain blocked until the backend can distinguish and dispatch unsent lines safely.
