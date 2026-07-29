# waiter_design.md — Nimbus POS Waiter Workspace Design Contract

Status: Draft v2 for Waiter MVP frontend build  
Date: 2026-06-16  
Extends: `DESIGN.md`  
Primary surface: fullscreen desktop POS terminal  
Role: Waiter

---

## 1. Purpose

This file defines the role-specific design contract for the Nimbus waiter workspace.

It translates the waiter MVP product rules into:

- shell layout;
- screen layout;
- component rules;
- state rules;
- icon registry;
- density rules;
- interaction rules;
- acceptance criteria.

This file does not replace `DESIGN.md`. It extends it.

---

## 2. Locked waiter decisions

1. Desktop-first only.
2. Waiter uses shared login shell with Quick PIN.
3. Email + Password remains in login shell for backoffice users.
4. After login, call `GET /api/auth/me`.
5. Waiter routes directly to Floor / Tables.
6. No waiter dashboard.
7. Fixed header.
8. Fixed bottom nav.
9. Bottom nav: Floor, Reservations, Me.
10. Orders is not a visible navigation destination. Order work is contextual from Floor.
11. No Menu bottom-nav item. Menu opens only inside order flow.
12. Header: logo area, branch, service area, current time, waiter avatar/name, logout.
13. Idle timeout logs waiter out.
14. No switch user.

15. The default Floor presentation is shared with Supervisor. Role-specific behavior begins after table selection; Waiter opens its existing menu/order-entry workspace.
16. Shared Floor cards show only full table identifier, textual operational status, formatted assigned staff, optional Mine, and capacity. Guest names and order numbers never appear on Floor cards.
15. No separate lock screen.
16. Table statuses shown: Available, Occupied, Reserved.
17. Do not show Cleaning or Blocked as table statuses in waiter MVP.
18. No table notes.
19. Notes are item-level only.
20. Reservations are operational only: read/list/detail/seat.
21. No waiter reservation admin.
22. No combine/uncombine table UI.
23. Another waiter's occupied order is blocked.
24. Receipt send is pending/no live adapter.

---

## 3. Waiter design mood

The waiter workspace should feel:

- premium enterprise;
- fast;
- stable;
- touch-friendly;
- uncluttered;
- readable;
- calm under pressure.

It should not feel:

- managerial;
- report-heavy;
- decorative;
- mobile-first;
- playful;
- image-heavy;
- overly animated.

---

## 4. Waiter palette usage

Use global tokens from `DESIGN.md`.

### Waiter primary usage

| UI area | Token |
|---|---|
| Header background | `--color-brand-navy-950` |
| Active bottom nav | `--color-brand-navy-900` |
| Primary action | `--color-brand-navy-900` |
| Table/menu card surface | `--color-surface` |
| Page background | `--color-page-bg` |
| Secondary chips/buttons | `--color-surface-muted` + graphite text |
| Available badge | success tokens |
| Occupied badge | info/navy tokens |
| Reserved badge | warning/amber tokens |
| Blocked/error | danger tokens |
| Receipt pending | warning tokens |

### Complementary premium treatment

- Use navy for trust and active operational controls.
- Use white surfaces for clean scanning.
- Use silver/graphite for quiet metadata.
- Use amber sparingly for reserved/pending states.
- Use success/danger only for genuine outcomes.

---

## 5. Waiter typography

Use Inter.

### Key rules

- Table number: `text-lg` or `numeric-lg`, 700.
- Order number: `text-sm` or `numeric-md`, 600.
- Price/total: numeric, tabular, 600/700.
- Current time: numeric, tabular.
- Status badges: `text-xs`, 600.
- Buttons: 14–16px, 600.
- Avoid thin text in POS screens.

---

## 6. Workspace sizing

| Element | Size |
|---|---:|
| Header height | 64px |
| Bottom nav height | 76–84px |
| Main side padding | 20–24px |
| Toolbar height | 56–64px |
| Table card preferred | 168×124px minimum |
| Table card large | 220×148px |
| Order row/card height | 64–76px |
| Menu item card | 220×144px or responsive |
| Right order panel | 380–420px |
| Receipt drawer | 420–560px |
| Reservation detail sheet | 520–640px |

---

## 7. Waiter shell

### 7.1 Header

Persistent across all waiter screens.

#### Left

- Placeholder/logo slot.
- Branch name.
- Service area.

#### Center

- Current time.

#### Right

- waiter avatar;
- waiter name;
- Logout button.

### 7.2 Header behavior

- Fixed to top.
- Dark navy background.
- Inverse text.
- No heavy shadow.
- Current time uses tabular numbers.
- Logout is always visible.
- Logout must not look destructive until clicked/confirmed.

### 7.3 Bottom nav

Final items:

1. Floor.
2. Reservations.
3. Me.

Rules:

- fixed bottom;
- large touch targets;
- Phosphor icon + label;
- active item uses navy fill/pill or inverse state;
- no Orders, Menu, Dashboard, Payments, or More destination;
- no More;
- no hidden nested menu.

---

## 8. Login screen

### 8.1 Modes

- Quick PIN.
- Email + Password.

### 8.2 Layout

Top:

- brand placeholder;
- branch label;
- current time;
- terminal label.

Center:

- login mode segmented control;
- PIN pad or email/password form;
- validation.

Bottom:

- online/offline state;
- app version/build.

### 8.3 Terminal label examples

- Main Dining POS-01.
- Bar Service Terminal.
- Patio Terminal-01.

### 8.4 Idle return

When idle timeout occurs:

- clear session;
- return to login;
- keep branch and time visible;
- do not show switch-user.

---

## 9. Floor / Tables screen

The Floor screen is the default waiter home.

### 9.1 Layout

Use responsive table-card grid.

| Viewport | Columns |
|---|---:|
| 1280px | Responsive cards, minimum 220px width |
| 1440px | Responsive cards, minimum 220px width |
| 1920px | Responsive cards, minimum 220px width |

Gap: 16px.

### 9.2 Toolbar

- Search field.
- Filter chips.
- Optional service-area selector.

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

### 9.3 Table card anatomy

#### All tables

- table name/number;
- status badge;
- capacity/seats.

#### Available

- clean empty state;
- action implied: start order.

#### Reserved

- guest name;
- reservation time.

#### Occupied

- assigned waiter formatted as `FirstName L.`;
- separate `Mine` badge when owned by the current waiter;
- guest name when available and operationally useful.

Table cards do not show order numbers, order labels, order-status text, bill state, or nested order panels.

### 9.4 Table card status treatment

| Status | Badge token | Visual emphasis |
|---|---|---|
| Available | success | calm green surface; no loud fill. |
| Occupied | info/navy | active service; stronger border if selected. |
| Reserved | warning/amber | hospitality reservation emphasis. |

### 9.5 Tapping table behavior

| Table state | Owner | Result |
|---|---|---|
| Available | none | create order → order builder/menu. |
| Reserved | any waiter | reservation detail → seat guest. |
| Occupied | current waiter | active order summary/edit. |
| Occupied | another waiter | blocked/read-only panel. |

---

## 10. Order Builder / Menu

Menu is not a nav destination.

### 10.1 Entry points

- tap available table;
- seat reserved guest;
- tap own occupied order and choose Add items.

### 10.2 Layout at 1440×900

- Top context bar.
- Main menu/content grid.
- Right order panel.

### 10.3 Context bar

Show only:

- back button;
- table name;
- order number;
- elapsed time if useful;
- bill state.

Do not show covers by default.

### 10.4 Menu area

- category chips;
- item search;
- item cards/list;
- serving picker;
- modifier sheet;
- item note field.

### 10.5 Menu item card

Use text-first operational cards. Food images are not required for MVP.

Card fields:

- item name;
- short description if useful;
- price;
- availability;
- category/serving marker;
- Add action.

### 10.6 Item note field

Attached to order item only.

Examples:

- No cheese.
- Add lemon.
- Extra ice.
- Medium rare.

### 10.7 Order panel

Show:

- item lines;
- quantities;
- modifiers/notes indicator;
- running total;
- bill state;
- Send to kitchen/bar;
- Request bill when appropriate.

---

## 11. Legacy Orders route compatibility

### 11.1 Purpose

There is no visible Orders tab or standalone waiter Orders workspace. Reusable queue and builder components may remain in code, but waiter service is entered through Floor.

Legacy `/waiter/orders`, `/waiter/orders/new?tableId=...`, and `/waiter/orders/[orderId]` URLs redirect into Floor while preserving safe table and order context.

### 11.2 Retained queue-component filters (not navigation)

- Active.
- Sent.
- Ready.
- Served.
- Closed Today.

No Draft filter.

### 11.3 Retained queue-component fields

- table name;
- guest name;
- order number;
- time/elapsed time;
- status;
- total;
- bill state.

### 11.4 Legacy order selection

Opens order detail/edit for allowed own order.

Another waiter's order should not appear in `userId=me` list. If it appears through a state mismatch, opening must be blocked by backend and UI.

---

## 12. Receipt workflow

Receipt remains inside the order lifecycle.

### 12.1 Entry points

- request bill;
- payment completed by cashier/payment flow;
- receipt available on order.

### 12.2 Receipt drawer

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
- payment summary;
- footer.

### 12.3 Actions

- view;
- history;
- reprint;
- send receipt.

### 12.4 Caveat

Send receipt must show:

```txt
PENDING — no live email/SMS/WhatsApp adapter
```

Do not style it as successful live delivery.

---

## 13. Reservations tab

### 13.1 Purpose

Operational seating support.

### 13.2 Show

- today/upcoming reservations;
- guest name;
- time;
- assigned table;
- status.

### 13.3 Actions

Allowed:

- open detail;
- seat guest;
- create linked dine-in order through seating bridge.

Not allowed:

- create reservation;
- confirm;
- cancel;
- deposits;
- event admin;
- ticketing.

---

## 14. Me tab

### 14.1 Content

Identity:

- verified waiter name and initials when no avatar exists;
- role-aware accent and explicit operational status;
- email or username when available;
- branch and assigned service area only when returned by the session contract.

Operational sections, in order:

1. profile and current status;
2. one focused shift card with start time, elapsed duration, branch, note, and one primary action;
3. recent self-scoped attendance;
4. current/recent leave with a focused request form when supported;
5. incoming/outgoing self-scoped shift swaps;
6. branch/account context;
7. session and sign out.

### 14.2 Rules

- no payroll details;
- no manager dashboard;
- no staff list;
- no accounting/reporting;
- no unrelated settings.
- do not show raw user, employee, organization, branch, or shift IDs;
- an open shift older than 16 hours, or one without a start time, is a `Shift issue` and requires review;
- never auto-close an abnormal shift;
- when employee linkage is missing, show one capability notice near the hero and compact unavailable states in dependent sections;
- do not render unusable disabled HR forms or repeat the full employee-link explanation;
- shared profile components provide visual structure only; each role page keeps its own requests and permissions.

---

## 15. State design

### Loading

Use skeletons:

- table grid;
- order list;
- menu grid;
- receipt drawer;
- reservation list;
- Me tab.

### Empty copy

Floor:

```txt
No tables available in this service area.
```

Orders:

```txt
No active orders. Start service from Floor.
```

Reservations:

```txt
No reservations for this service window.
```

### Success copy

- `Order started.`
- `Items added.`
- `Order sent to kitchen/bar.`
- `Guest seated.`
- `Bill requested.`
- `Receipt reprint requested.`

### Failure copy

- `Could not load tables.`
- `Could not add item.`
- `Could not send order.`
- `Could not seat guest.`
- `Could not request bill.`

Sent-order additions remain blocked until the backend exposes per-line sent state or a dedicated,
idempotent additions-dispatch contract. Do not reuse the initial `SENT` transition or imply KDS dispatch.

### Blocked copy

- `Shift not started — service actions disabled.`
- `This table belongs to another waiter.`
- `This action is not available for waiter role.`
- `Receipt delivery is pending adapter setup.`

---

## 16. Phosphor icon registry

Use these names as the default approved registry. Adjust only after Figma/design review.

### Shell

| Concept | Phosphor icon | Weight |
|---|---|---|
| Floor | `SquaresFour` | regular / fill active |
| Orders | `Receipt` | regular / fill active |
| Reservations | `CalendarCheck` | regular / fill active |
| Me | `UserCircle` | regular / fill active |
| Logout | `SignOut` | regular |
| Branch | `Storefront` | regular |
| Service area | `MapPinArea` or `MapPin` | regular |
| Time | `Clock` | regular |
| Terminal | `DesktopTower` or `Monitor` | regular |
| Online | `WifiHigh` | regular |
| Offline | `WifiSlash` | regular |

### Tables

| Concept | Phosphor icon | Weight |
|---|---|---|
| Table | `Armchair` or `GridFour` | regular |
| Seats/capacity | `Users` | regular |
| Available | `CheckCircle` | regular |
| Occupied | `UsersThree` | regular |
| Reserved | `CalendarCheck` | regular |
| Mine | `UserFocus` | regular |
| Search | `MagnifyingGlass` | regular |
| Filter | `SlidersHorizontal` | regular |
| Blocked ownership | `LockKey` or `Prohibit` | regular |

### Order builder

| Concept | Phosphor icon | Weight |
|---|---|---|
| Back | `ArrowLeft` | regular |
| Add item | `Plus` | regular/bold |
| Remove item | `Minus` | regular |
| Delete line | `Trash` | regular |
| Quantity up | `PlusCircle` | regular |
| Quantity down | `MinusCircle` | regular |
| Item note | `NotePencil` | regular |
| Modifiers | `Sliders` | regular |
| Serving format | `Stack` | regular |
| Send to kitchen/bar | `PaperPlaneTilt` or `BellRinging` | regular/bold |
| Sent | `CheckCircle` | regular |
| Running total | `Receipt` | regular |

### Orders and bill

| Concept | Phosphor icon | Weight |
|---|---|---|
| Active | `Activity` | regular |
| Ready | `Bell` | regular |
| Served | `CheckSquare` | regular |
| Closed Today | `ReceiptX` or `Receipt` | regular |
| Request bill | `Receipt` | regular |
| Receipt history | `ClockCounterClockwise` | regular |
| Reprint | `Printer` | regular |
| Send receipt | `EnvelopeSimple` or `PaperPlaneTilt` | regular |
| Pending send | `WarningCircle` | regular |

### Reservations

| Concept | Phosphor icon | Weight |
|---|---|---|
| Reservation | `CalendarCheck` | regular |
| Guest | `User` | regular |
| Time | `Clock` | regular |
| Assigned table | `Armchair` | regular |
| Seat guest | `CheckCircle` or `Armchair` | regular |
| Table conflict | `WarningDiamond` | regular |

### Me

| Concept | Phosphor icon | Weight |
|---|---|---|
| Profile | `UserCircle` | regular |
| Role | `IdentificationBadge` | regular |
| Shift | `ClockClockwise` | regular |
| Start shift | `PlayCircle` | regular |
| End shift | `StopCircle` | regular |
| Attendance | `CalendarCheck` | regular |
| Shift swap | `ArrowsLeftRight` | regular |
| Leave | `CalendarPlus` | regular |

---

## 17. Component inventory

### Shell

- `WaiterShell`
- `WaiterHeader`
- `WaiterBottomNav`
- `WaiterSessionGuard`
- `WaiterIdleLogoutHandler`
- `WaiterShiftBanner`

### Floor

- `WaiterFloorScreen`
- `WaiterTableToolbar`
- `WaiterTableGrid`
- `WaiterTableCard`
- `WaiterTableStatusBadge`
- `WaiterOwnershipBlockedPanel`

### Order

- `WaiterOrderBuilder`
- `WaiterOrderContextBar`
- `WaiterMenuCategoryChips`
- `WaiterMenuSearch`
- `WaiterMenuItemCard`
- `WaiterModifierSheet`
- `WaiterItemNoteField`
- `WaiterOrderPanel`
- `WaiterOrderLineRow`
- `WaiterQuantityStepper`
- `WaiterSendOrderButton`
- `WaiterRequestBillButton`

### Orders

- `WaiterOrdersScreen`
- `WaiterOrderFilterChips`
- `WaiterOrderList`
- `WaiterOrderCard`
- `WaiterOrderDetailPanel`

### Receipt

- `WaiterReceiptDrawer`
- `WaiterReceiptLineRow`
- `WaiterReceiptTotals`
- `WaiterReceiptHistoryList`
- `WaiterReceiptPendingSendBanner`

### Reservations

- `WaiterReservationsScreen`
- `WaiterReservationList`
- `WaiterReservationCard`
- `WaiterReservationDetailSheet`
- `WaiterSeatGuestButton`

### Me

- `WaiterMeScreen`
- `WaiterProfileCard`
- `WaiterShiftStatusCard`
- `WaiterAttendanceCard`
- `WaiterLeaveRequestSheet`
- `WaiterShiftSwapSheet`

---

## 18. Acceptance criteria

The waiter workspace design is acceptable when:

1. PIN login routes to Floor/Tables.
2. Header and bottom nav match this contract.
3. Table cards show only Available, Occupied, Reserved.
4. Available table starts order flow.
5. Reserved table opens reservation detail and seat flow.
6. Occupied own table opens order flow.
7. Occupied other-waiter table blocks edit.
8. Menu exists only inside ordering.
9. Item notes are item-level only.
10. No separate Orders tab is visible; legacy Orders routes redirect safely into Floor.
11. Receipt send is visibly pending.
12. Me tab contains session/self-service only.
13. No unsupported waiter action is shown as live.
14. All screens have loading/empty/failure/blocked states.
15. All colors/icons/spacing follow `DESIGN.md`.

---

## 19. Premium full-screen menu workspace

- The order workspace covers the normal Floor canvas and keeps one unmistakable `Back to Floor` action.
- Wide desktop layout is context bar plus taxonomy rail, menu canvas, and persistent order panel.
- FOOD/DRINKS and all manager-created labels come from `/api/menu/navigation`; item assignment comes from the catalog contract.
- Normal item tiles contain only name, price/starting price, and a serving cue when needed. The tile is the selection target.
- Configurable items open a spacious side sheet with 48px-class controls, quantity, serving, sorted modifier groups, selection guidance, price deltas, and item comment.
- Order lines are single edit targets. Removal lives in the focused editor.
- `Send to kitchen/bar`, `Request bill`, `View bill or receipt`, and `Reprint receipt` are text-first controls without decorative action icons.
- No emoji appears in waiter order entry.
- Returned discount is shown when nonzero so subtotal reconciles truthfully to total.
