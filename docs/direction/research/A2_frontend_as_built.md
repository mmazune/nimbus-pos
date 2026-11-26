# A2 — Front end as built (apps/web), read-only audit

Scope: `/home/claude/pos-scan/repo/apps/web` (src, tailwind.config.ts, e2e, scripts, package.json). Code reading only; the app was not run. Snapshot has no git, no node_modules, images removed. No `.env` file was opened.

Conventions
- All paths are relative to `apps/web/`.
- `[V]` = verified by reading the cited file:line. `UNKNOWN` = cannot be established from this snapshot.
- Pixel sizes: the app scales its root font with viewport height (section 11). Unless stated, rem sizes are quoted at the 16 px ceiling (viewport height 1080 or more). At 1440 x 900 the root is 14.88 px, so multiply every rem figure by 0.93.
- Size of the code base: 554 `.ts/.tsx` files, 71,103 lines under `src` (`cat $(find src -name '*.ts' -o -name '*.tsx') | wc -l`).

Headline findings
1. Only the waiter gets a full screen after tapping a table, and only when the table is free or is the waiter's own. Every other case, and every other role, opens a right-docked sheet 1180 px wide between the header and the bottom nav. The manager gets an inline card in a side column. [V] section 2.
2. The four roles use different titles, different words and different back controls for the same table. [V] section 2.4.
3. A waiter cannot add items to an order after it has been sent. The screen says so in developer language. [V] `src/components/waiter/orders/WaiterOrderBuilderScreen.tsx:1120`.
4. Nobody can void a single item after send. The supervisor can only void the whole order. [V] section 4.
5. There is no print anywhere in the web app: no `window.print`, no print stylesheet. "Reprint" records a request only. [V] section 5.
6. The waiter order screen has fixed side columns (160 + 360 px, or 180 + 400 px) and no layout below that. It cannot work at 390 px. [V] section 3.1, 11.
7. 79.5% of all font-size utilities are 14 px or smaller; 31 distinct text styles exist against a rule of seven. [V] section 7.
8. 3,018 lines in 35 files are unreachable from any page; a further 4,412 lines are reachable only by typing a hidden cashier URL. [V] section 9.

---

## 1. ROUTE MAP

67 files under `src/pages` (1,982 lines). Every page uses `getServerSideProps`. There is no `_document.tsx`. [V] `find src/pages -type f | xargs wc -l`

### Entry
| Route | What it is |
|---|---|
| `/` | Server redirect to `/login`. [V] `src/pages/index.tsx:3-8` |
| `/login` | 442-line page: Quick PIN or Email sign-in, then routes by role. [V] `src/pages/login.tsx` |

### Waiter (shell: `WaiterShell`)
| Route | What it is |
|---|---|
| `/waiter` | Redirect to `/waiter/floor`. [V] `src/pages/waiter/index.tsx:3-8` |
| `/waiter/floor` | Home. Shared floor grid; table tap opens the order screen. [V] `src/pages/waiter/floor.tsx:10-16` |
| `/waiter/orders` | Redirect to `/waiter/floor`. [V] `src/pages/waiter/orders/index.tsx:3-8` |
| `/waiter/orders/new` | Redirect to `/waiter/floor?tableId=`. [V] `src/pages/waiter/orders/new.tsx:3-13` |
| `/waiter/orders/[orderId]` | Client-side redirect into Floor via `WaiterLegacyOrderRedirect`. [V] `src/pages/waiter/orders/[orderId].tsx:18-19` |
| `/waiter/reservations` | Reservation list plus "Seat guest". [V] `src/pages/waiter/reservations.tsx` |
| `/waiter/me` | Profile, shift start/end, attendance, leave. [V] `src/pages/waiter/me.tsx` |

Navigation as built (bottom bar): **"Floor"**, **"Reservations"**, **"Me"**. [V] `src/lib/waiter/routes.ts:4-23`

### Cashier (shell: `CashierShell`)
| Route | What it is |
|---|---|
| `/cashier` | Redirect to `/cashier/floor`. [V] `src/pages/cashier/index.tsx` |
| `/cashier/floor` | Home. Shared floor; table tap opens bill / payment sheet. [V] `src/pages/cashier/floor.tsx` |
| `/cashier/till` | Open till, safe drop, reconcile. [V] `src/pages/cashier/till.tsx` |
| `/cashier/me` | Profile and shift. [V] `src/pages/cashier/me.tsx` |
| `/cashier/queue` | HIDDEN. Not in navigation, reachable by URL only. Old order queue with checkout. [V] `src/lib/cashier/floor-route.ts:26-29`, `src/lib/cashier/routes.ts:11-15` |
| `/cashier/receipts` | HIDDEN. Receipt list, reprint, send, refund. [V] same |

Navigation as built: **"Floor"**, **"Till"**, **"Me"**. [V] `src/lib/cashier/routes.ts:17-36`

### Supervisor (shell: `SupervisorShell`)
| Route | What it is |
|---|---|
| `/supervisor/floor` | Home. Shared floor; table tap opens table-control sheet. [V] `src/pages/supervisor/floor.tsx` |
| `/supervisor/orders` | Client-side redirect into Floor. [V] `src/pages/supervisor/orders.tsx:3-7` |
| `/supervisor/reservations` | Reservation workspace. The page file itself is 520 lines of screen logic. [V] `src/pages/supervisor/reservations.tsx` |
| `/supervisor/approvals` | Discount, leave, shift-swap, anomaly decisions. [V] `src/pages/supervisor/approvals.tsx:17-18` |
| `/supervisor/me` | Profile and leave request. [V] `src/pages/supervisor/me.tsx` |

Navigation as built: **"Floor"**, **"Reservations"**, **"Approvals"**, **"Me"**. [V] `src/lib/supervisor/routes.ts:4-29`

### Manager (shell: `ManagerShell`, top bar with dropdowns)
Top bar: **"Overview"**, **"Operations"**, **"Staff"**, **"Reports"**, **"Accounting"**, **"Settings"**, **"Me"**. [V] `src/lib/manager/routes.ts:25-72`

| Route | What it is |
|---|---|
| `/manager` | Redirect to `/manager/overview`. [V] `src/pages/manager/index.tsx` |
| `/manager/overview` | Eight-card dashboard. |
| `/manager/operations` | Redirect to the first sub-page. [V] `src/pages/manager/operations/index.tsx:9` |
| `/manager/operations/orders` | Order list plus read-only detail. Dropdown label **"Orders"**. [V] `src/lib/manager/top-nav.ts:68` |
| `/manager/operations/tables` | Shared floor plus read-only side card. Label **"Tables"**. [V] `top-nav.ts:74` |
| `/manager/operations/reservations` | Read-only list. Label **"Reservations"**. [V] `top-nav.ts:80` |
| (no route) | **"Exceptions"** shown as a disabled menu row. [V] `top-nav.ts:91` |
| `/manager/staff` | Redirect. [V] `src/pages/manager/staff/index.tsx:9` |
| `/manager/staff/{directory,onboarding,invitations,quick-pin,leave,shift-swaps}` | Labels **"Directory"**, **"Onboard frontline staff"**, **"Invitations"**, **"Quick PIN administration"**, **"Leave requests"**, **"Shift swaps"**; **"Attendance"** is a disabled row. [V] `top-nav.ts:101-148` |
| `/manager/reports` | Redirect. `/manager/reports/{catalog,runs}`: **"Catalog"**, **"Report runs"**. [V] `top-nav.ts:157-168` |
| `/manager/accounting` | Redirect to dashboard. 26 pages under `customers/ vendors/ bank/ closing/ review/ reporting/ configuration/` plus `journals` and `dashboard` (28 in all). Labels in `src/lib/accounting/menu.ts:117-359`. |
| `/manager/settings` | **"Settings dashboard"**; disabled rows **"Branch profile"**, **"Devices"**, **"Printers"**, **"Terminals"**, **"Alerts"**, **"Sync"**, each tagged "B6.6". [V] `top-nav.ts:182-211` |
| `/manager/me` | Profile. |

Counts: 10 pages are server redirects only (145 lines); 2 more redirect on the client. [V] grep `destination` in `src/pages`.

No route exists for a kitchen or bar display, a bill print view, an owner, or an accountant. [V] `ls src/pages` shows only `cashier login manager supervisor waiter`.

---

## 2. WHAT HAPPENS WHEN A TABLE IS TAPPED, PER ROLE

### 2.1 The shared part (same for all four)
- The table tile is one shared component: a `<button>` 13 rem minimum wide, 9.5 rem minimum tall, in an auto-fill grid. [V] `src/components/floor/OperationalTableCard.tsx:69-86`, `src/components/floor/OperationalTableGrid.tsx:59`
- The tile shows: shortened table label, status badge, one middle line ("Ready for seating" / "Reservation" + time / waiter name + "Mine"), and "N seats". It shows no total, no elapsed time, no bill-requested mark, no item count. [V] `OperationalTableCard.tsx:20-55, 88-104`
- Tiles are sorted by status first (occupied, reserved, blocked, available), then label. A table changes position when its status changes; there is no fixed floor map. [V] `src/components/floor/formatters.ts:225-231`
- The sheet that three roles open is one shared frame:

```tsx
// src/components/floor/OperationalTableWorkspaceFrame.tsx:15-30
<div className="fixed inset-0 z-[60]" data-operational-workspace>
  <button type="button" className="absolute inset-0 bg-brand-navy-950/30"
          aria-label="Close selected table workspace" onClick={onClose} />
  <aside className={cn(
      "absolute bottom-20 right-0 top-[120px] w-[min(1180px,calc(100vw-32px))] rounded-l-xl border-l border-border-subtle bg-page shadow-overlay",
      immersive ? "overflow-visible" : "overflow-y-auto p-5")}
    aria-label="Selected table workspace">
```

Geometry as coded: docked right; top fixed at 120 px (raw px, does not follow the rem scaling); bottom 5 rem; width the smaller of 1180 px and viewport minus 32 px. At 1440 x 900 that is 1180 x about 706 px, which is 82% of the width and 78% of the height. At 1024 wide it is 992 px. A dimmed strip of floor stays visible on the left and closes the sheet when tapped.

### 2.2 Side by side

| | Waiter | Cashier | Supervisor | Manager |
|---|---|---|---|---|
| Tap handler | `src/components/waiter/floor/WaiterFloorScreen.tsx:125` `handleSelectTable` | `src/components/cashier/floor/CashierFloorScreen.tsx:117` | `src/components/supervisor/floor/SupervisorFloorScreen.tsx:112` | `src/components/manager/operations/ManagerTablesScreen.tsx:99` (`selectTable`, :44-53) |
| URL after tap | `/waiter/floor?tableId=` then `&orderId=` | `/cashier/floor?tableId=` then `&orderId=` | `/supervisor/floor?tableId=&orderId=` | `/manager/operations/tables?tableId=` |
| What opens | **Free or own table: full screen** (`fixed inset-0 z-[80]`). **Reserved, another waiter's, or shift not started: the right-docked sheet.** | Right-docked sheet | Right-docked sheet | Inline card in a right-hand column; no overlay |
| Size as coded | Full viewport. Columns 160 / flex / 360 px; from 1280 px wide 180 / flex / 400 px. `WaiterOrderBuilderScreen.tsx:1426, 1457` | 1180 px max wide, top 120 px, bottom 5 rem, one scrolling column, padding 1.25 rem | Same sheet | `xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.5fr)]`: about two thirds floor, one third card. Below 1280 px the card drops under the floor. `ManagerTablesScreen.tsx:81` |
| Title shown | Table label, e.g. "T-05" (h1) | **Order number** (h2), not the table. `CashierSettlementWorkspace.tsx:219-226` | Table label (h2) or "Order context" | Table label (h2) |
| Sub-title | "{order number} · Assigned to {name}" (`:1440-1442`) | none | Waiter name or "Assigned waiter unavailable" (`SupervisorTableControlWorkspace.tsx:197-199`) | none |
| Badges at top | Order status in title case ("New", "Sent"), "Mine" (always shown, `:1438`) | Order status badge + "Awaiting payment" / "Partially paid" / "Settled — awaiting close" / "Not ready for checkout" / "State unavailable" (`src/lib/cashier/bill-resolution.ts:151-157`) | Table status badge ("Available", "Occupied", "Reserved") or "No table" | "Occupied" / "Reserved" / "Available" in title case |
| Back control | Button "Back to Floor" (top left) | Text button "Back to Floor" or "Back to bills" | Text button "Back to Floor" plus an X button | none; tap another table |
| Main action | "Send to kitchen/bar" | "Close with cash payment" / "Record {MTN, Card, ...} reference" | none filled; 9 secondary actions | Link "Open the order record" |
| Empty table | Creates an order at once and opens the menu | "No bill is available for this table." | "No active order" | "Open order: None" |

### 2.3 Detail per role

**Waiter.** The tap resolves to one of five intents. [V] `src/lib/waiter/floor-model.ts:166-243`

```ts
// src/components/waiter/floor/WaiterFloorScreen.tsx:119-123
const opensOrderWorkspace = Boolean(
  requestedOrderId ||
    selectedAction?.intent === "start-order" ||
    selectedAction?.intent === "own-order",
);
```
```tsx
// WaiterFloorScreen.tsx:210-219
{selectedAction ? (
  <OperationalTableWorkspaceFrame immersive={opensOrderWorkspace} onClose={handleCloseWorkspace}>
    <WaiterTableWorkspace action={selectedAction} ... />
```

| Table state | Result | Labels and actions |
|---|---|---|
| Free, shift open | Full-screen order screen. The order is created on the server as soon as the screen mounts: `POST /api/pos/orders {serviceType:"DINE_IN", tableId}`. [V] `WaiterTableWorkspace.tsx:246-255`, `WaiterOrderBuilderScreen.tsx:900-903`, `src/lib/waiter/order-api.ts:211-217` | Toast "Order started — {table} is ready for item entry." See section 3. |
| Own open order | Full-screen order screen with that order. [V] `WaiterTableWorkspace.tsx:230-239` | Section 3. |
| Another waiter's order | Sheet with a red card. [V] `src/components/waiter/floor/WaiterOwnershipBlockedPanel.tsx:13-44` | "This table belongs to another waiter." / "You can view the service state, but editable order actions stay blocked." / waiter name / order number / raw status text such as `SENT / ...` (`:36-37`) / button "Close panel" |
| Reserved | Sheet. [V] `WaiterTableWorkspace.tsx:177-217` | Table label, status badge, "Mine", "N seats", X; guest name; date and time; rows "Party", "Table", "Arrival"; warning "Seat guest unavailable"; filled button "Seat guest" → `POST seat`, then opens the linked order |
| Free, shift not started | Sheet with a warning only. [V] `floor-model.ts:197-205`, `WaiterTableWorkspace.tsx:269-276` | "Shift not started" / "Start shift before taking orders." No button to start the shift here; the waiter must go to Me. |

Closing the full screen without adding anything leaves the created order in place; no cancel call exists. [V] `WaiterOrderBuilderScreen.tsx:1345-1348`. A table whose order is still `NEW` keeps the "Available" status on the floor. [V] `floor-model.ts:122-130`

**Cashier.** Sheet content, top to bottom. [V] `src/components/cashier/floor/CashierBillResolutionPanel.tsx`, `CashierSettlementWorkspace.tsx:185-405`
1. One query lists the table's orders. Zero payable: "No bill is available for this table." / "Nothing here can be settled right now. Use Find bill for takeaway, tableless, or closed bills." Several payable: "Multiple bills on this table" / "N payable bills are open. Choose one to continue." Exactly one: opens it with no extra tap.
2. Bill view, with upper-case section headings: "BILL" ("Table / service", "Service", "Server", "Opened", "Items", "N lines"), "TOTALS" ("Subtotal", "Tax", "Discount", "Total", "Paid", "Outstanding"), "PAYMENT STATE", "SETTLEMENT READINESS" (link "Open Till"; "Payment entry needs an active shift; cash settlement also needs an active till owned by this cashier. Settlement stays blocked until both read green."), "SETTLEMENT", "HISTORY & CONTEXT".
3. Inside "SETTLEMENT": "Checkout" / "Payment entry"; "Total", "Paid", "Remaining"; "Payment method" tiles "Cash" ("Final cash close"), "Card", "MTN", "Airtel", "Bank" ("Split tender"); "Amount"; "Cash note"; "After this payment, remaining balance will be ..."; "Checkout action blocked" list; submit button; "Payment history"; "Close order" box with badge "Blocked" or "Refresh". [V] `src/components/cashier/checkout/CashierPaymentPanel.tsx:174-271`, `CashierCloseOrderPanel.tsx:28-45`
4. Then "Split and resolve" (badge "Ready" / "Blocked"), "Split bill allocation" (badge "Metadata only", button "Save split"), "Split items" (badge "Child order NEW", warning "KDS boundary"). [V] `src/components/cashier/resolution/CashierResolutionPanel.tsx:82-93`, `CashierSplitBillPanel.tsx:117-124`, `CashierSplitItemsPanel.tsx:127-131`
5. Actions and what they call: cash → `closeCashierOrder` (`POST /pos/orders/:id/close`); other methods → `createCashierManualReferencePayment`; split → split mutations. [V] `CashierPaymentPanel.tsx:105-148`

**Supervisor.** Sheet content, top to bottom. [V] `src/components/supervisor/floor/SupervisorTableControlWorkspace.tsx:479-838`
1. Four stat cards: "ORDER STATUS", "ITEMS", "RUNNING TOTAL", "ORDER AGE".
2. Four detail cards: "Table and service" ("Table", "Capacity", "Floor plan", "Assigned waiter", "Attention"); "Order and bill" ("Order", "Status", "Bill state", "Subtotal", "Total"); "Reservation" ("Guest", "Status", "Party", "Reservation time"); "Payment state" ("Order total", "Paid", "Remaining", "Payment rows"; "Payment collection and order close remain in Cashier.").
3. "Order items" with badge "Read only" ("Qty N").
4. "Discounts" with badge "Read only" yet with "Approve" / "Reject" buttons on pending rows.
5. "Table status": a select "New status" → "Review status change" → "Change {table} to {status}?" → "Cancel" / "Confirm change". Calls `updateSupervisorTableStatus`.
6. "Order actions" with badge "Floor exceptions": group "SERVICE" ("Request bill", "Mark served"); group "HANDOFF" ("Split bill", "Split items", "Move items", "Merge order", "Transfer table"); group "ADJUSTMENTS" ("Discount", "Complimentary", "Void order"). Each opens a centred dialog. [V] `:700-832`
7. A permanent info box: "Additional order controls are not available in this version." / "Transfer server, refund, post-close void, payment collection, and order close are intentionally not shown here." [V] `:836-838`

**Manager.** Card content. [V] `ManagerTablesScreen.tsx:104-188`
- Rows "Seats", "Area", "Server", "Open order", "Next reservation"; link "Open the order record"; note "Read-only. Seating a guest, changing a table's status, assigning a server and every order action stay with the roles that own them."
- Before a tap: "Select a table" / "Choosing a table shows its seats, area, server, open order and next reservation. No guest name is ever shown on a floor card."
- A permanent warning card "WHAT THIS FLOOR CANNOT SHOW" naming `GET /api/tills` and `GET /api/shifts`.

### 2.4 Different words for the same thing

| Thing | Waiter | Cashier | Supervisor | Manager |
|---|---|---|---|---|
| The order on the table | "Current order" | "bill" ("No bill is available", "Multiple bills", "Find bill") but also "Order closed.", "Close order" | "Order and bill", "Find order", "Order context" | "Open order", "the order record" |
| Amount owed | "Running total" (top), "Total" (bottom) | "Total", "Remaining", "Outstanding", "remaining balance" (four words, one sheet) | "Running total", "Total", "Order total", "Remaining" | not shown |
| The waiter | "Assigned to {name}"; receipt says "Server" | "Server" | "Assigned waiter" | "Server" |
| Seats | "N seats" | "N seats" on tile only | "Capacity: N seats" | "Seats" |
| Floor area | "Floor plan" (toolbar) | "Floor plan" | "Floor plan" | "Area" |
| Item count | "N items" (sum of quantities) | "N lines" (count of lines) | "Items" (count of lines), "Qty N" | not shown |
| Quantity on a line | "2×" | "2x Name" | "Qty 2" | — |
| Shift badge on the shared floor header | "Shift open" / "Shift not started" (`WaiterFloorScreen.tsx:200`) | "Shift active" / "No active shift" (`src/lib/cashier/readiness.ts:102-111`) | "Shift active" / "No active shift" (`src/lib/supervisor/context.ts:206-216`) | "Oversight" (`ManagerTablesScreen.tsx:85`) |
| Shift strip under the header | "On shift" / "Off shift. Service actions are unavailable." | "Shift: ...", "Till: ...", "Provider mode: Manual/stub only", "Read-only readiness" | "Shift: ...", "Floor: Floor check pending", "Approvals: Approvals check pending", "Session context ready" | branch / report / device chips |
| Close the view | "Back to Floor"; "Close panel"; X "Close {table} workspace" | "Back to Floor"; "Back to bills" | "Back to Floor"; X "Close Supervisor table workspace" | none |
| Ask for the bill | "Request bill" (filled, small) | — | "Request bill" (outline) | — |
| See the bill | "View bill or receipt" → drawer titled "Receipt" | "Receipt can be viewed from Receipts." (a route that is not in the menu) | — | — |
| Split | — | "Split bill allocation" → "Save split" | "Split bill" → "Record split" | — |
| Not allowed | "Draft editing unavailable", "Bill action blocked" | "Checkout action blocked", "Blocked" | "Read only", "...unavailable" | "Read-only oversight" |
| Empty table | (menu opens) "Select an item from the menu to begin this order." | "No bill is available for this table." | "No active order" | "None" |

The name of the surface itself differs in code and in screen-reader labels: "Selected table workspace" (shared frame), "Bill settlement workspace" (cashier), "Supervisor table workspace" (supervisor), "table panel" (manager data attribute).

---

## 3. THE WAITER ORDER SCREEN IN DETAIL

File: `src/components/waiter/orders/WaiterOrderBuilderScreen.tsx` (1,608 lines; one file holds the stepper, the item options drawer, the menu rail, the tile, the cart and 9 mutations).

### 3.1 Layout as coded

```tsx
// :1425-1429
<div className="fixed inset-0 z-[80] flex min-h-0 flex-col bg-page" data-testid="waiter-order-workspace">
  <header className="flex min-h-20 items-center justify-between gap-6 border-b border-border-subtle bg-surface px-5">
// :1457
<div className="grid min-h-0 flex-1 grid-cols-[160px_minmax(0,1fr)_360px] xl:grid-cols-[180px_minmax(0,1fr)_400px]">
```

At 1440 x 900 (root 14.88 px):
```
+----------------------------------------------------------------------------------------------+
| [<- Back to Floor]  T-05  [New] [Mine]                         Items        Running total    |  74 px
|                     ORD-0042 · Assigned to Sarah K.              3            UGX 54,000     |
+-----------+---------------------------------------------------------+------------------------+
| FOOD|DRINKS| (All Spirits)(Whisky)(Gin)(Vodka) ->scrolls sideways  [Search entire menu     ] | sticky
|-----------|---------------------------------------------------------| Current order   54,000 |
| Beer      | +---------+ +---------+ +---------+ +---------+ +-----+ | 3 items                |
| Spirits * | | Name    | | Name    | | Name    | | Name    | |     | |------------------------|
| Wine      | |         | |         | |         | |         | |     | | 2x Nile Special 12,000 |
| Soft      | | UGX ... | | From .. | | UGX ... | | UGX ... | |     | | 1x Burger       30,000 |
| ...       | +---------+ +---------+ +---------+ +---------+ +-----+ |    Cheese, No onion    |
| (scrolls) |   tiles: min 150 px wide, min 112 px tall, gap 11 px    | (scrolls)              |
|           |   (scrolls)                                             |------------------------|
|           |                                                         | Subtotal / Tax / Total |
|           |                                                         | [Send to kitchen/bar ] |
|           |                                                         | Bill [status]          |
|           |                                                         | [Request bill][View..] |
+-----------+---------------------------------------------------------+------------------------+
   180 px                       860 px                                        400 px
   12.5 %                       59.7 %                                        27.8 %
```
- Breakpoints: exactly one, `xl` (1280 px). Below it: 160 / flex / 360. There is no stacked or single-column layout. At 1024 the centre is 504 px (2 tiles per row). At 390 the two fixed columns total 520 px, so the centre column is 0 px and the right column is cut off. [V] `:1457`
- The left rail is navy (`bg-brand-navy-950`); centre is the page tint; right is white with a left border. [V] `:534, :644`
- The cart footer (totals, send button, bill box with its own warning box and two buttons) does not scroll; only the lines list above it does. [V] `:657, :725-759`

### 3.2 Categories, sub-categories and depth
- The tree has three levels and no more: **section → group → sub-group**. [V] `src/lib/waiter/order-model.ts:128-145, 445-470`
  - Sections: buttons in a 2-column grid at the top of the left rail. The label is the server's section code with underscores replaced by spaces, so the screen shows the code itself ("FOOD", "DRINKS"). [V] `:535-552`, `order-model.ts:441-443`
  - Groups: a vertical list under the sections. [V] `:554-573`
  - Sub-groups: pill chips in one row above the tiles, first chip "All {group}". The row scrolls sideways (`overflow-x-auto` with `min-w-max`). [V] `:1476-1512`
- Data comes from two calls: `/api/menu/navigation?activeOnly=true` and `/api/menu/catalog`. [V] `src/lib/waiter/order-api.ts:307-327`
- The catalog's own categories are flattened and never shown. [V] `order-model.ts:435-439`
- An item with no browse group is not shown anywhere, including in search. [V] `:1097`
- If no navigation is configured the screen shows "Menu navigation unavailable — Ask a manager to configure active menu browse groups." [V] `:1539`

### 3.3 Search
- Present. One field at the top right of the centre column, width `min(320px, 32vw)`, placeholder "Search entire menu". [V] `:1517-1523`
- It matches a typed fragment against the item **name and description** only, ignoring case, across every group. Not against group name, code or price. [V] `:1094-1108`
- While a search is typed the chips are replaced by one pill "Search results". [V] `:1478-1481`
- The field is not focused on open. There is no recent, favourite or "top sellers" list. [V] absence in file.

### 3.4 Tile sizes and touch targets
| Element | As coded | At 1440 x 900 | File:line |
|---|---|---|---|
| Menu tile | min 150 wide x min 112 px tall, name `text-base` bold, price `text-sm` bold | about 156 x 112 px; name 14.9 px; price 13 px | `:599-606, :1543` |
| Section button | `min-h-12`, `text-sm` | about 75 x 45 px | `:543` |
| Group button | `min-h-12`, full rail width | 157 x 45 px | `:563` |
| Sub-group chip | `min-h-11` | 41 px tall | `:1488, :1503` |
| Send button | `size="pos"` = `min-h-12` | 45 px tall | `:748`, `src/components/ui/Button.tsx:36` |
| Request bill / View bill | `size="compact"` = `min-h-9` | 33 px tall | `src/components/waiter/receipts/WaiterBillActionPanel.tsx:41, :48` |
| Stepper − / + | 48 x 48 px (raw px) | 48 px | `:236-257` |
| Option buttons | `min-h-14`, 2 columns | 52 px tall | `:391, :438` |
A tile shows the name and a price ("From ..." when there are several servings). No picture, no description, no "sold out" mark other than a greyed tile, no count of how many are already in the cart. [V] `:590-608`

### 3.5 Adding, options, editing, removing
- **Add.** Tapping a tile first fetches that item's details (item, servings, option groups, and each group's options: 3 or more requests). If the item has at most one serving and no option groups it is added straight away with quantity 1. Otherwise a drawer opens. [V] `:1212-1249`, `order-api.ts:355-376`
- While that fetch or the add is in flight **every tile is disabled**. [V] `:1549`
- **Options drawer.** Slides in from the right, `w-[min(720px,calc(100vw-32px))]`, full height, above everything (`z-[100]`). [V] `:318-328`
  - Title: item name; sub-title "Configure this item" or "Update this unsent item".
  - "Quantity" stepper (1 to 99) and "Configured total".
  - "Serving": 2-column buttons with label and price; badge "Choose 1" or "Selected". The default serving is pre-selected.
  - Each option group: name, guidance ("Choose 1", "Choose 1 to 3", "Choose up to 2", "Choose any"), badge "Required" / "Optional", 2-column buttons showing "+ UGX 2,000" or "Included". A group with a maximum of one behaves as single-choice.
  - "Item comment" free text, 500 characters, with the helper "Use configured options for priced additions. Comments remain free kitchen or bar instructions."
  - Footer: filled button "Add to order" / "Update item".
- **Edit.** Each cart line is one large button. Tapping it reloads the item details and opens the same drawer. Quantity, options and comment can change; the serving cannot ("Serving is fixed after the item is added by the current order-line contract."). [V] `:688-695, :372-376, :1566-1570`
- **Remove.** Inside the drawer: "Remove item" → "Remove this item from the draft?" → "Keep item" / "Confirm remove". Three taps. There is no − or bin on the cart line itself. [V] `:479-498`
- **After send, nothing can be edited.** `canEditItems` is true only while the status is `NEW`. [V] `order-model.ts:281`, `:1119-1121`

### 3.6 Sending
- One button, "Send to kitchen/bar", no confirmation. Calls `POST /api/pos/orders/:id/send`. Enabled only when the status is `NEW`, there is at least one item and the shift is open. [V] `:641, :748-750, :1253-1270`
- After sending, the waiter stays on the same screen, now locked, and must tap "Back to Floor". [V] no close call in `sendMutation.onSuccess`, `:1263-1267`
- The floor does not poll. Queries are not refetched on focus and have no refresh interval for waiter screens. [V] `src/components/providers/AppProviders.tsx:17-22`, `WaiterFloorScreen.tsx:70-76`

### 3.7 What the cart shows
- Header: "Current order", "N items", total. [V] `:647-655`
- Line: quantity, name, serving, chosen options, comment (cut to two lines), line total. [V] `:697-718`
- Footer: "Subtotal"; "Tax" and "Discount" only when above zero; "Total"; send button; "Bill" box with a status badge ("Not sent", "Available", "Requested", "Receipt", "Blocked"), a sentence, a warning box, and two buttons. [V] `:726-758`, `:163-224`
- Not shown: which lines have been sent, kitchen progress per line, seat or guest, course, time.

### 3.8 Tap counts from the waiter's home (`/waiter/floor`, shift open)

The first section and its first group are selected by default. [V] `:1081-1090`

**(a) Open table 5 and add one beer**
1. Tap tile "T-05" → full screen opens, order is created in the background.
2. Tap section "DRINKS" (skip if it is the first section).
3. Tap group "Beer" (skip if it is the first group).
4. Tap the beer tile → added if it has one serving and no options.
Total: **4 taps** (2 in the best case). If the beer has more than one serving: +1 "Add to order" (default serving) or +2 when changing the serving, so **5 to 6**.

**(b) Add a whisky under Drinks > Spirits > Whisky**
1. Tile "T-05". 2. "DRINKS". 3. "Spirits". 4. chip "Whisky" (optional; "All Spirits" already lists it). 5. whisky tile. 6. serving (single / double) if not the default. 7. "Add to order".
Total: **5 taps** with no serving choice; **6 to 7** with one. Above the three-tap rule in every case that needs a serving.

**(c) Add a burger with one modifier**
1. Tile "T-05". 2. group "Burgers" (skip if first). 3. burger tile → drawer. 4. the modifier. 5. "Add to order".
Total: **5 taps** (4 if Burgers is the default group).

**(d) Send the order**
With the order open: **1 tap**, "Send to kitchen/bar". From home: 2 (table, then send).

**(e) Add one more item to an open table**
- Order not yet sent: 1 table + up to 2 navigation + 1 tile = **2 to 4 taps**.
- Order already sent: **not possible**. The screen shows "Draft editing unavailable — This order has been sent. Nimbus cannot safely dispatch later additions until the backend exposes per-line sent state." and every tile is disabled. [V] `:674-679, :1120, :1549`. The app's own README lists this as deferred. [V] `README.md:366-368`

**(f) Print or request the bill**
- Request: 1 table, 2 "Request bill" = **2 taps**. Only after the order is sent. Calls `POST /api/pos/orders/:id/request-bill`, then opens the receipt drawer on its own. [V] `:1271-1287`
- View: 1 table, 2 "View bill or receipt" = **2 taps**.
- Print: **not available**. "Reprint receipt" in the drawer is enabled only for closed or voided orders and only records a request; the toast reads "Reprint request recorded — No print-driver completion is guaranteed." [V] `src/lib/waiter/receipt-model.ts:134, 163`, `:1291-1298`
- "Bill requested" is remembered only in the open screen's memory. Closing and reopening the table shows "Available" again. [V] `:792, :1123`

---

## 4. CASHIER, SUPERVISOR AND MANAGER TABLE AND ORDER SURFACES

### 4.1 What each role can do to a table or its order

| Action | Waiter | Cashier | Supervisor | Manager |
|---|---|---|---|---|
| Add / edit / remove items | Yes, before send only | No | No ("Order items — Read only", `SupervisorTableControlWorkspace.tsx:584-585`) | No |
| Send to kitchen | Yes | No | No | No |
| Mark served | No | No | Yes, only when the kitchen has marked the order ready (`src/lib/supervisor/order-actions.ts:150, 269-270`) | No |
| Request bill | Yes | No | Yes (`:704-712`) | No |
| Pay | No | Yes: cash (full amount only) or a typed reference for card, MTN, Airtel, bank (`CashierPaymentPanel.tsx:105-148`) | No | No |
| Split bill by amount | No | Yes (`CashierSplitBillPanel.tsx`) | Yes (`SupervisorSplitBillDialog.tsx`) | No |
| Split items to a new order | No | Yes (`CashierSplitItemsPanel.tsx`) | Yes (`SupervisorSplitItemsDialog.tsx`) | No |
| Merge orders | No | Only on the hidden `/cashier/queue` route (`CashierResolutionPanel.tsx:103-110`, `CashierSettlementActions.tsx:86-94`) | Yes (`SupervisorMergeOrderDialog.tsx`) | No |
| Move items | No | Hidden route only | Yes (`SupervisorMoveItemsDialog.tsx`) | No |
| Transfer table | No | Hidden route only | Yes (`SupervisorTransferTableDialog.tsx`) | No |
| Transfer to another waiter | No | Card says "Deferred" (`CashierTransferServerPanel.tsx:15`) | No | No |
| Void one item | No | No | **No** | No |
| Void whole order | No | No | Yes, with a typed reason (`SupervisorVoidOrderDialog.tsx:77-104`) | No |
| Discount | No | No | Request, approve, reject, complimentary (`:783-812`, `:143-160`) | No |
| Change table status | No | No | Yes (`:651-690`) | No |
| Print bill | No | No | No | No |
| Reprint / send receipt | Request only, closed orders | Hidden `/cashier/receipts` only; button reads "Reprint metadata" (`src/components/cashier/receipts/CashierReceiptDrawer.tsx:146`) | No | No |
| Refund | No | Hidden `/cashier/receipts` only (`src/components/cashier/refunds/CashierRefundPanel.tsx`) | No | No |
| Close order | No | Only as a side effect of the final payment; there is no close button (`CashierCloseOrderPanel.tsx:28-45`) | No | No |

### 4.2 Tap counts

**Cashier takes cash for table 5** (home `/cashier/floor`)
1. Tap tile "T-05" → sheet; with one open bill it resolves by itself.
2. Scroll past "BILL", "TOTALS", "PAYMENT STATE", "SETTLEMENT READINESS". "Cash" is pre-selected and the amount is pre-filled. Tap "Close with cash payment". No confirmation.
Total: **2 taps plus a scroll.** [V] `CashierPaymentPanel.tsx:49, 60-61, 249-255`
Conditions coded into the validator, each shown as a line under "Checkout action blocked" when unmet: active shift; active till; order status must be Served ("Cash close is available only when the backend order status is Served."); amount must equal the balance exactly ("Partial cash is deferred because cash can only be recorded through final order close."); amount may not exceed the balance. [V] `src/lib/cashier/payment-validation.ts:144-166`
Consequence of the last rule: the cashier cannot key the cash handed over, so the "Change due" message in the success notice can never show a value. [V] `payment-validation.ts:154-155`, `CashierPaymentPanel.tsx:129-131`

**Supervisor voids one item**: **not possible.** No per-item control exists. The nearest action is "Void order": 1 table, scroll to the bottom card, 2 "Void order", type a reason, 3 "Void order" in the dialog = 3 taps plus typing, and it is blocked when any payment exists. [V] `SupervisorTableControlWorkspace.tsx:815-828`, `SupervisorVoidOrderDialog.tsx:95-104`

**Supervisor splits a bill** (home `/supervisor/floor`)
1. Tap the table → sheet.
2. Scroll to "Order actions" (the eighth card down) and tap "Split bill" → dialog, "Equal split" with 2 groups pre-set.
3. Tap "Record split".
Total: **3 taps plus a scroll** for an equal two-way split. A different number of groups means typing in a number field; custom amounts means typing each one. [V] `SupervisorSplitBillDialog.tsx:43, 103-129`
The split does not create separate bills; it records amounts on the same order ("Records payable allocation groups for the cashier to collect from separately."). [V] `:108`

---

## 5. PRINT BILL / RECEIPT

- No print exists in the web app for any role. `grep -rnE "window\.print|@media print|print:" src` returns nothing.
- Bill preview on screen:
  - Waiter: "View bill or receipt" → right drawer, fixed 500 px wide, titled "Receipt". Shows organisation, branch, date, "Receipt", "Order", "Table", "Server", "Guest", items, "Subtotal", "Tax", "Discount", "Service charge", "Total", "Paid", "Outstanding", then "Receipt history". Available once the order is sent. [V] `src/components/waiter/receipts/WaiterReceiptDrawer.tsx:60`, `WaiterReceiptPreview.tsx:23-106`, `WaiterReceiptTotals.tsx`
  - Cashier: only on the hidden `/cashier/receipts` route (`CashierReceiptDrawer.tsx`, 170 lines). The floor sheet says "A receipt exists for this bill. Receipt actions arrive in a later step." [V] `CashierSettlementWorkspace.tsx:383-385`
  - Supervisor and manager: none.
- "Reprint" (waiter and hidden cashier route) posts to `/api/receipts/:id/reprint` and shows a notice that nothing was physically printed. [V] `src/lib/waiter/receipt-api.ts:174-187`, `src/components/cashier/receipts/CashierReceiptCaveatBanner.tsx:11-15`
- "Send receipt" (Email / SMS / WhatsApp) shows the heading "PENDING - no live adapter". [V] `src/components/waiter/receipts/WaiterReceiptActionBar.tsx:43`

---

## 6. DEVELOPER-FACING CLUTTER ON SCREEN

Method: `grep -rnE "STUB|CRITICAL|adapter|[Bb]ackend|endpoint|/api/|contract|[Mm]etadata|\bv1\b|MVP|[Bb]oundary|Deferred|print-driver|session context|[Bb]ranch context|<code>|Provider mode|PesaPal|pos:[a-z]|..."` over each role's components and lib, comment lines removed, then read in context. Text is quoted exactly.

### 6.1 Login (every role sees it)
| File:line | Text on screen |
|---|---|
| `src/pages/login.tsx:224` | Chip "API" / "Local dev" (hard-coded) |
| `src/pages/login.tsx:352-365` | Quick PIN needs a typed "Branch" field whose placeholder is the raw id `cb27be401a2c35dfc0d4e610`; helper "Local demo branch: Tapas Downtown" |
| `src/pages/login.tsx:61` | "Branch context is missing or invalid. Enter the seeded branch ID for this terminal." |
| `src/pages/login.tsx:157` | "This frontend currently supports waiter, cashier, supervisor, and manager workspaces only." |
| `src/pages/login.tsx:192` | "Branch context is required for Quick PIN login." |
| `src/lib/api/client.ts:179` | "Cannot reach Nimbus API at http://localhost:3001. Check that the API is running and that CORS allows {origin}." (shown wherever a screen prints `error.message`) |
| `src/lib/api/client.ts:170` | "Nimbus API did not respond within 30 seconds..." |

### 6.2 Shared shell (waiter, cashier, supervisor)
| File:line | Text |
|---|---|
| `src/lib/auth/role.ts:15-18` → `src/components/pos-shell/RoleIdentity.tsx:19` | Header role line prints the job-role code first (`role.jobRole || role.name`), i.e. "WAITER", "CASHIER" |
| `src/components/pos-shell/station.ts:23` | Header shows the constant "Terminal 01" for every device |
| `src/components/waiter/shell/WaiterHeader.tsx:16` | "Branch context unavailable" |
| `src/components/floor/OperationalFloor.tsx:107` | "No active operational tables were returned for this branch." |
| `src/components/floor/OperationalTableCard.tsx:47-49` | "Assigned waiter unavailable" on a tile |
| `src/components/floor/formatters.ts:19-46` | Table labels over 7 characters are abbreviated by rule ("QA-P4-PASS2-1440" → "QP4P2-1440") |

### 6.3 Waiter
| File:line | Text |
|---|---|
| `WaiterOrderBuilderScreen.tsx:1120` | "This order has been sent. Nimbus cannot safely dispatch later additions until the backend exposes per-line sent state." |
| `:676` | "Draft editing unavailable" |
| `:374` | "Serving is fixed after the item is added by the current order-line contract." |
| `:219` | "Requesting a bill records a waiter-safe signal. It does not collect payment." |
| `:209` | "Cashier payment remains outside the waiter workspace." |
| `:119` | "This action is not available for the waiter role." (for code `ORDER_TRANSITION_NOT_WAITER_SAFE`) |
| `:1297` | Toast "Reprint request recorded — No print-driver completion is guaranteed." |
| `:1279` | Toast "Payment collection remains outside the waiter workspace." |
| `:663` | "Showing cached order while it refreshes." |
| `:1397` | "Order details unavailable" / "Order number pending" in the header |
| `:885, :926` | "Verified table and branch context are required." / "Session and branch context are required to refresh the order." (thrown, shown in toasts) |
| `:104, :121, :1153...` | Raw server message printed (`error.message`): `getWriteErrorCopy` is called 17 times in this file and falls through to the server's own text for any code it does not know |
| `:1437` | Order status is the server code in title case ("In kitchen") |
| `src/lib/waiter/order-model.ts:260` | Order number falls back to the raw order id |
| `src/lib/waiter/order-model.ts:441-443` | Section buttons print the section code |
| `src/components/waiter/floor/WaiterOwnershipBlockedPanel.tsx:36-37` | Raw status code and bill-state value, e.g. "SENT / ..." |
| `src/components/waiter/receipts/WaiterReceiptActionBar.tsx:43` | "PENDING - no live adapter" |
| `src/lib/waiter/receipt-model.ts:172, 257` | "Receipt send is pending. No live email/SMS/WhatsApp adapter is connected yet." |
| `src/lib/waiter/receipt-model.ts:211` | "Pending {channel} receipt request, no live adapter connected." |
| `src/lib/waiter/receipt-model.ts:234` | "Backend receipt event recorded." |
| `src/components/waiter/receipts/WaiterReceiptDrawer.tsx:69` | Badge prints the raw receipt status (`CLOSED`) |
| `src/components/waiter/receipts/WaiterReceiptHistoryTimeline.tsx:50` | Badge prints the raw event status or action code (`RECEIPT_REPRINTED`) |
| `src/lib/waiter/receipt-model.ts:149` | "PENDING" as the send status |
| `src/components/waiter/orders/WaiterLegacyOrderRedirect.tsx:44` | "ORDER_NOT_OWNED_BY_WAITER: editable order access remains blocked." |
| `WaiterLegacyOrderRedirect.tsx:52, 66` | "The legacy order link could not be resolved." / "Orders are contextual from Floor." |
| `src/components/waiter/shell/WaiterSessionGuard.tsx:44` | "This frontend MVP currently supports waiter workspace only." |
| `src/components/waiter/reservations/WaiterReservationsScreen.tsx:74` | "Confirm the backend is running at the configured API URL." |
| `WaiterReservationsScreen.tsx:283` | "{table} was refreshed from the backend." |
| `src/lib/waiter/reservation-model.ts:179` | "Backend state does not allow seating yet." |
| `src/components/waiter/me/WaiterMeScreen.tsx:411` | "A safe eligible-shift and target selector is not available for waiter self-service." |
| `src/components/profile/SessionCard.tsx:67-68` | Rows "Platform" and "Sign-in source" |
| `WaiterFloorScreen.tsx:126-137` | 18 lines of timing instrumentation (`performance.mark`) run on every table tap; not visible, but shipped |

### 6.4 Cashier (visible routes)
| File:line | Text |
|---|---|
| `src/lib/cashier/readiness.ts:170-171` → `src/components/cashier/shell/CashierReadinessStrip.tsx:39` | Strip on every page: "Provider mode: Manual/stub only" |
| `CashierReadinessStrip.tsx:46` | Badge "Read-only readiness" |
| `src/components/cashier/checkout/CashierPaymentPanel.tsx:186` | "PesaPal is owner SaaS billing only, excluded from diner checkout." |
| `src/lib/cashier/payment-validation.ts:23` | "STUB - no live acquirer/card-terminal traffic." (shown when Card is chosen) |
| `payment-validation.ts:33, 43` | "CRITICAL - MTN/Airtel diner checkout pending provider confirmation. Record a manual reference only." |
| `payment-validation.ts:14` | "Cash is recorded only as the final settlement through order close." |
| `payment-validation.ts:151` | "A provider intent is pending. Resolve it before adding another payment." |
| `payment-validation.ts:158` | "Partial cash is deferred because cash can only be recorded through final order close." |
| `payment-validation.ts:161` | "Cash close is available only when the backend order status is Served." |
| `payment-validation.ts:110` | "This retry does not match the original payment request." (idempotency) |
| `src/components/cashier/checkout/CashierCloseOrderPanel.tsx:31-32` | "A provider intent is still pending." / "Backend close requires final payment data. Refresh if a manual final payment just auto-settled." |
| `CashierCloseOrderPanel.tsx:21`, `CashierPaymentPanel.tsx:154` | "Receipt can be viewed from Receipts." (no such menu item) |
| `src/components/cashier/checkout/CashierManualReferenceFields.tsx:30, 39` | "Reference ID required" / placeholder "External transaction ID" |
| `src/components/cashier/checkout/CashierPaymentMethodSelector.tsx:67` | "Split tender" / "Final cash close" under each method |
| `src/components/cashier/checkout/CashierPaymentHistory.tsx:76` | "No posted payments or provider intents are attached to this order yet." |
| `src/components/cashier/resolution/CashierSplitBillPanel.tsx:121, 124` | "Split bill creates cashier allocation groups on this order. It does not create separate child orders." / badge "Metadata only" |
| `src/components/cashier/resolution/CashierSplitItemsPanel.tsx:123-134` | Badge "Child order NEW"; warning "KDS boundary": "Split items creates a new child order in NEW status. The child order is not automatically sent to KDS and may not appear in the payable queue until service workflow continues." |
| `src/components/cashier/resolution/CashierResolutionPanel.tsx:52-53, 87` | "Branch context is required." / "Order detail must load before split or resolution actions." / "Table/server transfer and merge stay outside cashier settlement." |
| `src/components/cashier/floor/CashierSettlementActions.tsx:98-99` | "Receipt actions and refunds are not available from this workspace yet. Void, discount, and table/server transfer stay outside the cashier role." |
| `src/components/cashier/floor/CashierSettlementWorkspace.tsx:383-390` | "Receipt actions arrive in a later step." / "Refund eligibility for this closed bill is reviewed in a later step." |
| `CashierSettlementWorkspace.tsx:331` | "Payment state is unavailable — this bill is not shown as paid or unpaid until the summary loads." |
| `src/lib/cashier/bill-resolution.ts:157` | Badge "State unavailable" |
| `src/components/cashier/shell/CashierSessionGuard.tsx:44, 66-67` | "This route requires a cashier role from the authenticated session context." / "The cashier workspace needs a default branch from /api/auth/me before shift and till reads can run." |
| `src/components/cashier/me/CashierMeScreen.tsx:255-260` | "Role boundaries remain enforced by the existing permissions and checkout workflows."; rows "Provider mode: Manual and reference-based where configured", "Manager functions: Not available in cashier profile" |
| `src/components/cashier/till/CashierDeferredCashMovements.tsx:4-6` | "Paid In", "Paid Out", "Pickup" each with the status "Deferred" |
| `src/components/cashier/till/CashierTillScreen.tsx:87` | "This closes the active till if accepted by the backend." |

Cashier, hidden routes (reachable by URL): "Bill-requested is audit-derived. Until a dedicated filter exists, Queue shows active payable branch orders." (`src/components/cashier/queue/CashierQueueScreen.tsx:189`); "Queue reads only GET /api/pos/orders, order detail, and order payment summary endpoints. NEW, CLOSED, and VOIDED orders are excluded from the default read." (`:245-246`); "...after the backend returns SENT, IN_KITCHEN, READY, or SERVED orders." (`CashierOrderList.tsx:78`); "Reprint metadata" (`CashierReceiptDrawer.tsx:146`); "Metadata only — no print-driver invocation" / "PENDING — no live email/SMS/WhatsApp adapter" (`CashierReceiptCaveatBanner.tsx:11-12`); "Merge, move, and transfer actions are available only where backend-safe targets are loaded." (`CashierAdvancedResolutionPanel.tsx:43`); "No safe staff-list endpoint is exposed for this surface, so the action is intentionally disabled." (`CashierTransferServerPanel.tsx:18`).

Cashier, written but never shown (dead files, section 9): a "Cashier Can Do" card that prints each permission key and "{key} not visible in current session" plus "{N} permissions loaded" (`src/components/cashier/me/CashierScopeCard.tsx:10-20, 35, 52`); "Local Demo Credentials" (`CashierDemoHelpCard.tsx:15`); "Known limitations / Deferred Surfaces" (`CashierKnownLimitationsCard.tsx:7-13`); "Role boundary / Restricted Surfaces" (`CashierRestrictedSurfacesCard.tsx:28-30`). This is the "permissions on, off" screen the owner described; it is in the code base but not mounted.

### 6.5 Supervisor
| File:line | Text |
|---|---|
| `src/lib/supervisor/context.ts:240-247` | Strip on every page, never updated: "Floor: Floor check pending", "Approvals: Approvals check pending" |
| `src/components/supervisor/shell/SupervisorReadinessStrip.tsx:51` | Badge "Session context ready" |
| `SupervisorTableControlWorkspace.tsx:836-838` | "Additional order controls are not available in this version." / "Transfer server, refund, post-close void, payment collection, and order close are intentionally not shown here." |
| `:697` | Badge "Floor exceptions" |
| `:573` | Row "Payment rows" |
| `:351, :605, :576` | "No immediate table warning returned." / "No order lines are available for this table context." / "No payment summary is available for this context." |
| `:228` | "The preserved order reference does not match an accessible order." |
| `:794, :810, :826` | "...auto-approved within the branch threshold, else pending" / "Not a refund or void." / "Not a refund, complimentary, or post-close void." |
| `:757` | "Void this order into a surviving order." (hint for Merge) |
| `:854` and four dialogs | "Add a short note for the audit trail" |
| `src/components/supervisor/floor/SupervisorVoidOrderDialog.tsx:81, 92` | "This moves the order to its VOIDED state..." / "Payment: {state} (read-only)" |
| `src/components/supervisor/floor/SupervisorMergeOrderDialog.tsx:105` | "...will be VOIDED and all of its items moved into..." |
| `src/components/supervisor/floor/SupervisorDiscountRequestDialog.tsx:111` | Placeholder "e.g. Prompt 3B3A discount validation" (an internal build-step name) |
| `src/components/supervisor/reservations/SupervisorCreateReservationDialog.tsx:221` | "Adds a PENDING reservation for this branch." |
| `src/components/supervisor/shell/SupervisorSessionGuard.tsx:53, 76, 99` | "This route requires the SUPERVISOR role from the authenticated /api/auth/me context." and two more naming `/api/auth/me` |
| `src/components/supervisor/approvals/workspace/Approval*Detail.tsx:97-98, 136-137, 198-199, 111-112` | "Read-only — You do not have permission to decide ..." |
| `src/lib/supervisor/orders.ts:673` | Unknown status codes printed in lower case with underscores removed |

### 6.6 Manager (for completeness, not exhaustive)
- `<code>GET /api/tills</code>`, `<code>GET /api/shifts</code>` on the tables page. [V] `ManagerTablesScreen.tsx:183-186`
- Permission key in monospace on a screen: `pos:accounting:periods:create`, with "C-27", "Track B5.5", "Track B5.7". [V] `src/components/manager/accounting/closing/FiscalPeriodsScreen.tsx:250-253`
- "Catalog key {key}" and "guarded by {permission}" in monospace. [V] `src/components/manager/reports/ManagerReportCatalogScreen.tsx:161-169`
- "(Track B6)", "(Track B6.7)", "PC-01", "C-26", "B5.5-F1" in body text. [V] `ManagerEmployeeDetailPanel.tsx:124, 131`, `AccountingNotes.tsx:104`, `AuditTrailScreen.tsx:135`, `PeriodCloseRunsScreen.tsx:123`
- Menu rows tagged "B6.6" and "Deferred". [V] `src/lib/manager/top-nav.ts:91-211`

---

## 7. LOOK COUNTS

All commands run from `apps/web/`.

**(1) Brand font**
- Declared: `"Inter Variable", Inter, ui-sans-serif, system-ui, ...` in both `src/styles/globals.css:174-182` and `tailwind.config.ts:74-83`.
- Loaded by `import "@fontsource-variable/inter";` at `src/pages/_app.tsx:13`; dependency `"@fontsource-variable/inter": "^5.3.0"` at `package.json:15`. No `@font-face`, no `next/font`, no Google link (`grep -rn "font-face|fonts.googleapis|next/font" src` → comments only).
- Whether the file is actually served: UNKNOWN (no node_modules, app not run).
- Only one family. Weights used: semibold 561, bold 410, medium 104, normal 9, extrabold 2 (`grep -rhoP "\bfont-(thin|light|normal|medium|semibold|bold|extrabold|black)\b" src | sort | uniq -c`).

**(2) Font sizes**
`grep -rhoP "\btext-(xs|sm|base|lg|xl|[2-6]xl|\[[0-9.]+(px|rem|em)\])(?![a-z-])" src --include=*.tsx --include=*.ts | sort | uniq -c | sort -rn`

| Utility | Size at 16 px root | Uses |
|---|---|---|
| text-sm | 14 px | 692 |
| text-xs | 12 px | 258 |
| text-base | 16 px | 84 |
| text-lg | 18 px | 81 |
| text-xl | 20 px | 47 |
| text-2xl | 24 px | 30 |
| text-[0.625rem] | 10 px | 11 |
| text-3xl | 30 px | 6 |
| text-[0.6875rem] | 11 px | 3 |
| text-4xl | 36 px | 1 |

- 10 distinct sizes, 1,213 uses.
- Share at 12 to 14 px: (692 + 258) / 1,213 = **78.3%**. At 14 px or below including the two arbitrary sizes: 964 / 1,213 = **79.5%**.
- On a 1440 x 900 screen these render at 13.0 px and 11.2 px, because the root is 14.88 px.
- Distinct text styles (size x weight x upper-case, counted per class string by `scratchpad/textstyles.py`): **31** across the app; 15 in waiter plus shared floor. The rule is seven.
- In the waiter order screen file: text-sm 23, text-base 7, text-xl 3, text-xs 2, text-lg 2, text-2xl 2.

**(3) Button looks**
- Shared `Button`: 5 variants (primary, secondary, tertiary, inverse, danger) x 3 sizes (compact 2.25 rem, standard 2.5 rem, pos 3 rem) = 15 possible looks; 12 are used. [V] `src/components/ui/Button.tsx:5-37`
- 205 `<Button` uses. 50 of them add their own `className`. Sizes: compact 72, pos 29, standard (default) the rest. Only "pos" reaches 44 px, and only at the 16 px root (`grep -rhoE 'size="(compact|standard|pos)"' src | sort | uniq -c`).
- `<button` elements not using the shared Button: **114** (`grep -rn "<button" src --include=*.tsx | grep -v "components/ui/Button.tsx\|components/ui/IconButton.tsx" | wc -l`). By area: waiter 21, cashier 23, supervisor 27, manager 30, floor 3, pos-shell 5, providers 1, pages 4.
- Those 114 carry **87 distinct class sets** (`scratchpad/buttons.py`). 57 have no height utility at all; 17 set a height under 2.75 rem (h-7 x7, h-8 x1, h-9 x3, h-10 x6).
- The waiter order screen file alone has 12 hand-rolled buttons and 3 filled primary buttons.
- Files with two or more filled primary buttons: 8 of 57 that use the Button.
- The shared `IconButton` exists and is used nowhere. [V] section 9.

**(4) Cut text and sideways scroll** (`grep -rhoP "(?<![a-z-])TOKEN(?![a-z-])" src | wc -l`)
| Token | All | Waiter | Shared floor/shell/ui | Cashier | Supervisor | Manager |
|---|---|---|---|---|---|---|
| truncate | 100 | 9 | 13 | 22 | 25 | 28 |
| whitespace-nowrap | 1 | 0 | 0 | 0 | 0 | 1 |
| overflow-x-auto | 7 | 1 | 0 | 0 | 0 | 6 |
| line-clamp-* | 3 | 1 | 0 | 0 | 2 | 0 |
- Inside controls: bottom-nav label (`OperationalBottomNav.tsx:54`), table tile label and waiter name (`OperationalTableCard.tsx:46, 90`), top-nav label (`OperationalTopNav.tsx:76`).
- The one sideways scroller a waiter meets is the sub-group chip row. [V] `WaiterOrderBuilderScreen.tsx:1476-1477`

**(5) Colours and arbitrary values**
- Hex colours outside the tokens file: **1** (`#000033` in the theme-color meta, `src/pages/_app.tsx:38`). Tokens file holds 38. `grep -rhoE "#[0-9a-fA-F]{6}\b" src --include=*.tsx --include=*.ts`
- `[#...]` arbitrary colours: **0**. Tailwind default palette classes (`bg-red-500` and the like): **0**.
- Arbitrary values containing px: **110** uses, 65 distinct. Containing rem: **46** uses, 25 distinct. All bracket utilities: 328 uses, 136 distinct. `grep -rhoE "[a-z:-]+-\[[^]]*[0-9]px[^]]*\]" src | wc -l`
- Classes that point at tokens that do not exist, so they produce no style: `ring-brand-sky-500` x2 (`WaiterReceiptDrawer.tsx:79`, `WaiterReceiptActionBar.tsx:59`), `border-brand-navy-200` x1 (`SupervisorOrderCard.tsx:47`), `border-border` x2 (`CashierOrderTotals.tsx:33`, `CashierSettlementSummary.tsx:24`). [V] `tailwind.config.ts:8-31`
- Icon sizes typed as numbers: 241 uses over 13 distinct sizes (18 x76, 22 x54, 20 x40, 16 x31, 24 x18, ...) against 35 uses of the size registry. `grep -rhoE "size=\{[0-9]+\}" src | sort | uniq -c`
- z-index: 11 distinct values (10, 30, 40, 50, 60, 70, 80, 85, 90, 95, 100).

**(6) Borders**
- Border utilities: **103** (border-b 34, border 32, border-t 21, border-b-0 7, border-t-0 3, border-l 3, others 3) plus 7 `divide-*`. By area: waiter 33, manager 27, supervisor 22, cashier 13. `grep -rhoP "(?<![a-z-])border(-[trblxy])?(-[0248])?(?![a-z0-9-])" src | wc -l`
- `shadow-subtle` (155 uses) starts with a 1 px ring (`0 0 0 1px`), so every element using it is also outlined. [V] `globals.css:116-119`
- Waiter order screen file: 17 border utilities (7 full boxes, 10 dividers) and 5 `shadow-subtle`. Bordered element inside a bordered element: **5 times** — the stepper's centre cell inside the stepper box (`:246` in `:236`); and inside the left-bordered cart column (`:644`): its header (`:647`), the "Creating the order" notice (`:659`), each cart line (`:694`), its footer (`:725`). Menu tiles carry a border and the ring together (`:599`).
- Box-in-box without borders: cart footer → grey "Bill" box → coloured warning box → two buttons. [V] `WaiterBillActionPanel.tsx:20-37`

**(7) Monospace**: `font-mono` **5** uses, `<code>` 4, `<pre>` 2. All in manager screens; none for waiter, cashier or supervisor.

**(8) Shadows**: 5 named shadows: `shadow-subtle` 155, `shadow-focus` 103, `shadow-panel` 25, `shadow-overlay` 12, `shadow-focus-inverse` 9; plus 1 bare `shadow`. Three are elevation, two are focus rings.

**(9) Horizontal padding on page containers**: 8 different recipes.
| Container | Padding | File:line |
|---|---|---|
| Page content, header, top nav | `px-3 sm:px-4 lg:px-6` | `OperationalShell.tsx:29`, `OperationalHeader.tsx:59` |
| Bottom nav | `px-2 sm:px-4 lg:px-6` | `OperationalBottomNav.tsx:26` |
| Strip under the header (all four roles) | `px-4 sm:px-6 lg:px-8` | `WaiterShiftBanner.tsx:23`, `CashierReadinessStrip.tsx:25` |
| Waiter order screen header, centre, cart header | `px-5` | `WaiterOrderBuilderScreen.tsx:1429, 1473, 647` |
| Waiter cart body and footer | `px-4` | `:657, :725` |
| Item options drawer | `px-6` | `:329, :348, :503` |
| Table sheet | `p-5` | `OperationalTableWorkspaceFrame.tsx:25` |
| Login | `px-4 sm:px-6 lg:px-10` | `login.tsx:256` |
The strip's content edge therefore sits 4 to 8 px inside the header and page edges at every width. Maximum content widths in use: 1600 (x12), 1480 (x2), 1420, 1160 px.

Also measured: the shell reserves 2.25 rem for the strip (`h-9`, `OperationalShell.tsx:26`) but all four strips are 2.75 rem tall (`h-11`), so each strip overlaps 0.5 rem of the gap above the page content.

---

## 8. SHARED KIT VS FORKS

### 8.1 Shared components that exist
| Folder | Files | Lines | Contents |
|---|---|---|---|
| `src/components/ui` | 15 | 418 | Button, IconButton (unused), Card, Badge, StatusBadge, StatusMessage, Input, SearchInput, Skeleton, PageShell, EmptyState, ErrorState, LoadingState, BlockedState |
| `src/components/pos-shell` | 19 | 1,491 | OperationalShell, OperationalHeader, OperationalBottomNav, OperationalTopNav (+Dropdown), ActionConfirmDialog, CurrentTime, RoleIdentity, BranchContextLabel, NimbusLogomark, idle logout, icon registry, station label |
| `src/components/floor` | 10 | 759 | OperationalFloor, toolbar, grid, table card, status badge, error state, workspace frame, formatters |
| `src/components/profile` | 9 | 316 | RoleProfileHero, ProfileSection, ProfileMetaGrid, ShiftStatusCard, SessionCard, CapabilityNotice, CompactUnavailableState, OperationalStatusBadge |
| `src/components/providers` | 2 | 168 | Query client, toasts |
Shared total: 3,152 lines = 4.4% of `src`. Shared lib: `lib/api` 195, `lib/auth` 568, `lib/pos-shell` 79, `lib/profile` 76, `lib/utils` 47.

Missing from the kit (each built by hand per screen): modal or drawer, tabs or segmented control, select, textarea, number stepper, chip, list row, totals block, money text, data table (manager has its own).

### 8.2 Lines per role
| Role | `src/components/<role>` | `src/lib/<role>` | Total |
|---|---|---|---|
| Waiter | 29 files, 4,842 | 14 files, 2,904 | 7,746 |
| Cashier | 108 files, 9,410 | 37 files, 4,091 | 13,501 |
| Supervisor | 63 files, 9,056 (+520 in the reservations page file) | 18 files, 5,481 | 14,537 (15,057) |
| Manager | 103 files, 16,127 | 42 files, 9,014 (+ `lib/accounting` 7 files, 4,079) | 25,141 (29,220) |
`find src/components/<role> -type f | xargs cat | wc -l`

### 8.3 True shared use vs per-role copies of one idea
True shared: the floor grid and tile; the shell, header and bottom nav; the confirm dialog (supervisor only); the profile blocks.

Copies:
| Idea | Copies (lines) |
|---|---|
| Strip under the header | `WaiterShiftBanner.tsx` 88, `CashierReadinessStrip.tsx` 51, `SupervisorReadinessStrip.tsx` 56, `ManagerReadinessStrip.tsx` 67. Cashier and supervisor are near line-for-line the same. |
| Session guard | Waiter 63, Cashier 86, Supervisor 118, Manager 118 |
| What opens after a table tap | `WaiterTableWorkspace.tsx` 277 + `WaiterOwnershipBlockedPanel.tsx` 48; `CashierBillResolutionPanel.tsx` 208 + `CashierSettlementWorkspace.tsx` 406; `SupervisorTableControlWorkspace.tsx` 1,016; manager card inside `ManagerTablesScreen.tsx` 193 |
| Floor data layer | `lib/waiter/floor-api.ts` 105 + `floor-model.ts` 243; `lib/cashier/floor-api.ts` 71 + `floor-model.ts` 108; `lib/supervisor/floor.ts` 124 + `floor-model.ts` 101; manager `operations-*` |
| Order types and normalising | `lib/waiter/order-api.ts` 376 + `order-model.ts` 601; `lib/cashier/order-types.ts` 192 + `order-state.ts` 242 + `orders.ts` 50; `lib/supervisor/orders.ts` 796; `lib/manager/operations-model.ts` |
| Receipt view | waiter: 8 files, 569 lines + lib 473; cashier: 15 files, 1,396 lines + lib 678 |
| Split bill | `CashierSplitBillPanel.tsx` 205 (+ forms 222); `SupervisorSplitBillDialog.tsx` 257 |
| Split items | `CashierSplitItemsPanel.tsx` 237 (+ selector 73); `SupervisorSplitItemsDialog.tsx` 180 (+ selector 85) |
| Merge / move / transfer table | Cashier 159 / 173 / 171; Supervisor 154 / 142 / 169 |
| Find by search | `CashierFindBillDialog.tsx` 290; `SupervisorFindOrderDialog.tsx` 288 |
| Confirm dialog | `pos-shell/ActionConfirmDialog.tsx` 213; `CashierResolutionConfirmDialog.tsx` 56; `CashierTillConfirmDialog.tsx` 56; `CashierRefundConfirmDialog.tsx` 63 |
| Blocked / caveat / empty states | `cashier/states/*` 116; `supervisor/states/*` 117; plus `ui/BlockedState`, `ui/EmptyState` |
| Status badge wrappers over `Badge` | 10: ui/StatusBadge, floor/OperationalTableStatusBadge, profile/OperationalStatusBadge, WaiterReceiptStatusBadge, CashierQueueStatusBadge, CashierReceiptStatusBadge, CashierRefundStatusBadge, CashierTillStatusBadge, CashierVarianceBadge, SupervisorOrderStatusBadge |
| Totals block | waiter cart footer, `WaiterReceiptTotals.tsx` 72, `CashierOrderTotals.tsx` 44, `CashierReceiptTotals.tsx` 38, `CashierSettlementSummary.tsx` 33, supervisor detail rows |
| Reservations screen | `WaiterReservationsScreen.tsx` 713; supervisor page 520 + 8 files 1,767; `ManagerReservationsScreen.tsx` 196 |
| Me screen | Waiter 453, Cashier 265, Supervisor 313, Manager 182 (all on the shared profile blocks) |

Duplicated helpers (grep by function name, section 9 commands):
- Money formatters: **10** (`formatWaiterMoney`, `formatMoney`, `formatReceiptMoney`, `formatCashierMoney`, `formatSupervisorMoney`, `formatSupervisorApprovalMoney`, `formatSupervisorReservationMoney`, `formatManagerMoney`, `formatManagerOperationsMoney`, `formatAccountingMoney`).
- Idempotency-key builders: **3** plus one inline (`lib/pos-shell/idempotency.ts:39`, `lib/cashier/idempotency.ts:9`, `lib/waiter/receipt-api.ts:148`, `lib/manager/reports-api.ts:243`). The cashier and shared files each define their own `randomSuffix`.
- "Read a string from metadata" helpers: **8**. Title-case-a-status helpers: **15**. String-to-number helpers: 4. First-query-value helpers: 4. Error-to-text mappers: 20. Paginated-response types: 4. `Intl.DateTimeFormat` call sites: 44.
- API client: one (`lib/api/client.ts`); every role wraps it with its own fetch functions.

---

## 9. JUNK AND DEAD CODE

### 9.1 Files nothing reaches
Method: import graph walked from every file in `src/pages`, resolving `@/` and relative paths, passing through `index.ts` re-exports by name (`scratchpad/reach.py`). Result: **35 files, 3,018 lines** unreachable.

| Lines | File | Note |
|---|---|---|
| 429 | `src/components/waiter/orders/WaiterOrdersQueueScreen.tsx` | old waiter orders list, kept "reusable" per `README.md:163-166` |
| 189 | `src/components/waiter/orders/WaiterNewOrderScreen.tsx` | old new-order step |
| 9 | `src/components/waiter/shell/WaiterPageContainer.tsx` | returns its children unchanged |
| 14 | `src/lib/waiter/idle.ts` | superseded by `pos-shell/idle.ts` |
| 78 | `src/components/cashier/floor/CashierSelectedTablePanel.tsx` | earlier placeholder for the table sheet |
| 567 | `src/components/cashier/me/` : ProfileCard 110, SessionCard 135, ReadinessSummaryCard 71, ScopeCard 62, WorkflowChecklist 48, RestrictedSurfacesCard 44, KnownLimitationsCard 40, DemoHelpCard 32, LogoutPanel 25 | nine cards, none mounted |
| 82 | `src/components/cashier/states/CashierBlockedState.tsx` 28, `CashierCaveatBanner.tsx` 54 | |
| 553 | `src/components/supervisor/approvals/` : DetailPanel 239, Queue 104, Toolbar 79, Summary 69, DomainCards 62 (+ index 5) | first approvals page, replaced by `workspace/` |
| 713 | `src/components/supervisor/orders/` : OrderDetailPanel 307, OrderCard 117, OrdersToolbar 108, OrdersSummary 96, OrderList 57, OrderStatusBadge 28 (+ index 7) | the removed Orders tab |
| 157 | `src/lib/supervisor/permissions.ts` | |
| 25 | `src/lib/supervisor/formatters.ts` | |
| 127 | `src/components/manager/foundation/ManagerFoundationScreen.tsx` | placeholder screen; still named in 4 assertion scripts |
| 37 | `src/components/ui/IconButton.tsx` | |
| 26 | `src/components/pos-shell/index.ts` 24, `src/components/supervisor/floor/index.ts` 2 | barrels nobody imports |

### 9.2 Exports nothing uses
`scratchpad/deadexports.py`: **115** exported names are referenced nowhere, not even in their own file (about 87 of them sit in files that are otherwise live). By folder: lib/supervisor 37, lib/accounting 22, lib/manager 12, lib/cashier 10, lib/waiter 6, plus components. Examples: `createCashierPaymentIntent`, `transferCashierOrderServer`, `cashierCaveats`, `supervisorCaveats`, `fetchSupervisorOrderRefunds`, `fetchSupervisorFloorPlanDetail`, `filterWaiterTables`, `formatOrderStatus`, `resolveOperationalContextLabel`. Line total for these: UNKNOWN (not measured); functions used only by the dead files above (for example the queue helpers at `src/lib/waiter/order-model.ts:286-379` and `listWaiterOrders` at `order-api.ts:241`) add to it.

### 9.3 Hidden and compatibility routes
- `/cashier/queue` and `/cashier/receipts` are in no menu. Code reachable **only** through them: **46 files, 4,412 lines** (queue 884, receipts 1,396, refunds 934, lib 1,166, pages 32). Measured by re-running the reach script without those two pages. This is the only place reprint, send-receipt and refund exist for the cashier.
- Merge, move-items, transfer-table and transfer-server panels (611 lines) are imported by the live split panel but only drawn on the hidden queue. [V] `CashierResolutionPanel.tsx:103-110`
- Redirect-only pages: 10 server redirects (145 lines) + 2 client redirects (38 lines) + `WaiterLegacyOrderRedirect.tsx` 81 + `SupervisorLegacyOrdersRedirect.tsx` 70 + `lib/supervisor/legacy-orders-route.ts` 23 = **357 lines**.

### 9.4 Comments, markers, leftovers
- TODO / FIXME / HACK in `src`: **0** (`grep -rnE "TODO|FIXME|HACK|XXX" src` → none; 2 hits in `scripts` are test strings).
- Commented-out code blocks: none found.
- `console.*` calls: 0. `eslint-disable` lines: 6. `@ts-ignore`: 0.
- Comment lines: 5,522 of 71,103 (7.8%). Lines naming a build step or finding code ("Prompt 3B1", "M-P1", "B5.4", "MP0-09", "C-27", "owner-approved", "Density pass"): **801**. `grep -rnE "Prompt [0-9A-Z]|\bM-P[0-9]|\bMP0-|Track [ABC]|..." src | wc -l`
- Timing instrumentation in the waiter flow: 18 `performance.*` lines. [V] `WaiterFloorScreen.tsx:126-137`, `WaiterOrderBuilderScreen.tsx:794-804, 1045-1079`
- Demo values in shipped code: branch id and name at `src/pages/login.tsx:32-33`; a demo password literal at `scripts/polish2-qa.mjs:16`.

### 9.5 Scripts and specs
- `scripts/`: **19** assertion scripts (`*-assertions.ts`), **16** matching `tsconfig.*.json` files, 2 `.mjs` screenshot helpers. 37 files, 7,226 lines. Three scripts (b4, b5, b67) have no tsconfig.
- None is wired into `package.json`; `"test"` is `echo "No frontend tests yet"`. [V] `package.json:6-12`
- They work mostly by reading source files and checking that a string is present (449 `.includes(` checks), so they pin current file names and wording. [V] `scripts/floor-assertions.ts:19-31`
- `e2e/`: 99 files, 10,381 lines, 88 spec files. Every route they visit still exists (the old ones as redirects). Specs that exist to exercise the hidden or redirect routes: `e2e/cashier-floor/hidden-legacy-routes.spec.ts`, `legacy-compatibility-regression.spec.ts`, and references to `/supervisor/orders` (3) and `/cashier/queue`, `/cashier/receipts` (5 each).

### 9.6 "Could be deleted" estimate
| Bucket | Files | Lines | Condition |
|---|---|---|---|
| Unreachable source | 35 | 3,018 | none; no behaviour changes |
| Unused exports and code only they use | — | UNKNOWN, 115 names | none |
| Assertion scripts and their tsconfigs | 37 | 7,226 | they would have to be rewritten after any rebuild |
| Hidden cashier queue, receipts, refunds | 46 | 4,412 | after reprint and refund are rebuilt in the main flow |
| Panels drawn only on the hidden queue | 5 | 611 | same |
| Redirect pages and helpers | 15 | 357 | once old links are no longer needed |
| **Total** | **about 138** | **about 15,600** | of which 8,400 are in `src` (11.8% of it) |
Not counted: per-role copies listed in 8.3, which a shared build would collapse.

---

## 10. STATES IN THE WAITER FLOW

| State | Floor | Order screen | Designed? |
|---|---|---|---|
| Loading | 12 skeleton tiles. [V] `OperationalTableGrid.tsx:25-45` | 12 skeleton tiles for the menu (`:1527-1530`); "Creating the order. You can keep browsing and choose an item now." (`:659-661`); receipt skeleton (`WaiterReceiptDrawer.tsx:94-100`) | Yes |
| Empty | "No tables match this view" (`OperationalTableGrid.tsx:47-55`); "No active operational tables were returned for this branch." (`OperationalFloor.tsx:104-109`) | "Select an item from the menu to begin this order." (`:682-684`); "No menu items found" (`:1541`); "Menu navigation unavailable" (`:1539`) | Yes, with developer wording in two of them |
| Error | Red card with "Retry" (`OperationalFloorErrorState.tsx`); copy per code at `WaiterFloorScreen.tsx:20-60` | "Could not load menu" + "Retry menu" (`:1531-1537`); "Order could not be created" + "Retry order creation" (`:665-672`); "Order table mismatch" (`:1384-1392`); toasts for every write | Yes; the description is often the raw server message |
| Offline | none | none | **No.** No connection check, no offline banner, no queued sends. A lost connection shows "Cannot reach Nimbus API at {url}. Check that the API is running and that CORS allows {origin}." `grep -rnE "onLine|offline|serviceWorker" src` → nothing |
| Partial | Stale floor: none; the floor is never refreshed on a timer | Pending line drawn while the add is in flight (`:1140-1148`); an item chosen before the order exists is held and retried (`:1329-1343`); "Showing cached order while it refreshes." (`:663`); toast "Order refresh delayed" | Partly |
| Blocked | Shift banner "Off shift. Service actions are unavailable." (`WaiterShiftBanner.tsx:46-58`); sheet "Shift not started" | "Draft editing unavailable" (`:674-679`); "Bill action blocked" (`WaiterBillActionPanel.tsx:31-37`) | Yes |
| Success | — | Toasts: "Order started", "Item added", "Item updated", "Item removed", "Order sent to kitchen/bar", "Bill requested" | Yes |

---

## 11. THE VIEWPORT MECHANISM

- The root font size follows viewport **height**: `font-size: clamp(13.5px, calc(0.625vh + 9.25px), 16px)`. [V] `src/styles/globals.css:166`. Spacing tokens are rem, so everything shrinks together. Values: 680 px tall → 13.5; 768 → 14.05; 844 (phone) → 14.53; 900 → 14.88; 1080 → 16.
- Effect on touch targets: a 2.75 rem control is 44 px only at 1080 tall; 40.9 px at 900; 38.6 px at 768. The largest shared button (3 rem) is 42.2 px at 768. Width and touch input play no part in the formula.
- Radii, icon sizes and about 110 px-based arbitrary values do not scale. [V] `globals.css:107-112`, `src/components/pos-shell/role-icon-config.ts:48-52`
- The stated assumption is "a fullscreen terminal: it must FIT the viewport, not scroll it". [V] `globals.css:139-161`. The login page is `h-screen overflow-hidden`. [V] `login.tsx:256`
- The table sheet's top offset is a raw 120 px while the header and strip above it are rem. [V] `OperationalTableWorkspaceFrame.tsx:24`

Screen by screen at 390 px wide (by reading classes; not rendered):
| Screen | Works at 390? | Why |
|---|---|---|
| Shell header and bottom nav | Yes | responsive classes; labels truncate. `OperationalHeader.tsx:59`, `OperationalBottomNav.tsx:39` |
| Floor | Yes, as one column of tiles | `minmax(13rem,1fr)`. `OperationalTableGrid.tsx:59` |
| Table sheet (cashier, supervisor, waiter side cases) | Usable | width becomes 358 px; inner grids collapse (`md:grid-cols-2 xl:grid-cols-4`) |
| **Waiter order screen** | **No** | fixed 160 + 360 px columns, no breakpoint below 1280. `:1457` |
| Waiter receipt drawer | No | fixed `w-[500px]`. `WaiterReceiptDrawer.tsx:60` |
| Item options drawer | Yes | `min(720px, 100vw - 32px)` |
| Waiter reservations | No | `grid-cols-[1fr_360px]`, `grid-cols-[1fr_420px]`. `WaiterReservationsScreen.tsx:591, 616` |
| Login | Stacks; whether it fits 844 px tall is UNKNOWN | `lg:grid-cols-[minmax(0,1fr)_26rem]` |
| Manager | Collapses to a "Menu" button below 1280 | `OperationalTopNav.tsx:206` |

Responsive prefixes used in waiter components: sm 13, md 1, lg 6, xl 3. In the order screen file: 1. `hidden`-at-size patterns across the app: 5 (clock icon and station label hidden below `sm`; two table columns hidden below `lg`; manager menu swap at `xl`). Nothing a phone user needs is hidden this way; the phone problem is fixed widths, not hidden parts.

No test targets a phone: the four Playwright projects are 1024 x 768, 1366 x 768, 1440 x 900, 1920 x 1080, all "Desktop Chrome". [V] `playwright.config.ts:62-67`

---

## 12. TESTS AND GATES AS THEY EXIST

| Gate | State | Evidence |
|---|---|---|
| `lint` | `next lint` with `next/core-web-vitals` only | `package.json:9`, `.eslintrc.json` |
| `typecheck` | `tsc --noEmit`, strict | `package.json:10`, `tsconfig.json:7` |
| `build` | `next build` | `package.json:8` |
| `test` | `echo "No frontend tests yet"` | `package.json:11` |
| Unit test runner | none (no jest or vitest in devDependencies) | `package.json:22-31` |
| Playwright | config present, no npm script; 4 desktop viewports, 1 worker, 0 retries; expects a separate stack on ports 3100 / 4001 | `playwright.config.ts` |
| Assertion scripts | 19, run by hand; how they are compiled and run is not documented in this folder | `scripts/`, `README.md:14-21` |
| Visual comparison, accessibility checker, component gallery, token or class lint, formatter config | none | `package.json`, folder listing |
| CI definition | UNKNOWN (outside this folder) |

Playwright coverage (`grep -c "test(" per folder`): 88 spec files, about 536 tests.
| Folder | Specs | Tests |
|---|---|---|
| cashier-floor | 25 | 73 |
| manager-accounting | 12 | 182 |
| manager-staff | 5 | 66 |
| manager-reports | 3 | 45 |
| supervisor-approvals | 15 | 40 |
| manager-operations | 4 | 36 |
| manager-shell | 5 | 36 |
| manager-dashboard | 4 | 23 |
| supervisor-reservations | 9 | 19 |
| supervisor-prompt3 | 6 | 16 |
| **waiter** | **0** | **0** |
The waiter appears in two specs only: a role-boundary check and one reservations visibility check. [V] `e2e/manager-shell/role-boundaries.spec.ts:50`, `e2e/supervisor-reservations/waiter-visibility.spec.ts:25`. The order screen's `data-testid` hooks (`waiter-order-workspace`, `waiter-menu-item`, ...) are used by no spec or script. [V] `grep -rln "waiter-order-workspace" e2e scripts` → nothing

---

## 13. GAPS NOTICED (facts only)

Ordering and tables
1. A sent order cannot receive more items from the waiter screen. `src/components/waiter/orders/WaiterOrderBuilderScreen.tsx:1119-1121`, `src/lib/waiter/order-model.ts:281`
2. No role can remove or void one item after send. `src/components/supervisor/floor/SupervisorTableControlWorkspace.tsx:582-607, 815-828`
3. Tapping a free table creates an order on the server immediately; backing out does not cancel it. `WaiterOrderBuilderScreen.tsx:900-903, 1345-1348`
4. A table with an unsent order still reads "Available". `src/lib/waiter/floor-model.ts:122-130`
5. No web page moves an order through the kitchen (no kitchen or bar screen in `src/pages`). The only "served" control is the supervisor's, and it needs the order to be "ready" first. `src/lib/supervisor/order-actions.ts:150`
6. Cash payment needs the order to be "Served". `src/lib/cashier/payment-validation.ts:160-162`
7. Cash must equal the bill exactly; cash handed over cannot be entered. `payment-validation.ts:154-159`
8. "Bill requested" is not kept once the waiter closes the table. `WaiterOrderBuilderScreen.tsx:792`
9. The floor is not refreshed on a timer or on focus for waiter, cashier or supervisor. `src/components/providers/AppProviders.tsx:17-22`
10. Tiles reorder by status; there is no floor plan view. `src/components/floor/formatters.ts:225-231`
11. A waiter whose shift is not started gets a warning with no button to start it. `src/components/waiter/floor/WaiterTableWorkspace.tsx:269-276`
12. Menu items without a browse group never appear, even in search. `WaiterOrderBuilderScreen.tsx:1097`
13. Every menu tile locks while one item is being added. `WaiterOrderBuilderScreen.tsx:1549`
14. Each tile tap makes at least three requests before adding. `src/lib/waiter/order-api.ts:355-376`
15. Removing a cart line takes three taps; changing a quantity takes three. `WaiterOrderBuilderScreen.tsx:479-498`

Bill and print
16. No print function anywhere. Section 5.
17. The cashier's reprint, send-receipt and refund screens exist only on a route with no menu entry; the visible sheet tells the cashier to look in "Receipts". `src/lib/cashier/floor-route.ts:26-29`, `src/components/cashier/checkout/CashierCloseOrderPanel.tsx:21`
18. Splitting a bill records amounts on one order; it does not make separate bills. `src/components/supervisor/floor/SupervisorSplitBillDialog.tsx:108`, `src/components/cashier/resolution/CashierSplitBillPanel.tsx:121`

Consistency
19. The same table opens four different surfaces with four titles. Section 2.2.
20. The cashier's sheet is titled with the order number, not the table. `src/components/cashier/floor/CashierSettlementWorkspace.tsx:219-226`
21. The supervisor's strip shows "check pending" for Floor and Approvals permanently. `src/lib/supervisor/context.ts:240-247`
22. The waiter header always shows the "Mine" badge. `WaiterOrderBuilderScreen.tsx:1438`
23. Two filled primary buttons sit in the waiter cart ("Send to kitchen/bar", "Request bill"). `WaiterOrderBuilderScreen.tsx:748`, `src/components/waiter/receipts/WaiterBillActionPanel.tsx:40-46`

Look and layout
24. The waiter order screen has no layout under 1280 px other than narrower fixed columns. `WaiterOrderBuilderScreen.tsx:1457`
25. The sub-group row scrolls sideways. `WaiterOrderBuilderScreen.tsx:1476-1477`
26. Touch targets shrink with screen height; "Request bill" is 33 px tall at 1440 x 900. `src/styles/globals.css:166`, `src/components/ui/Button.tsx:34`
27. Five class names refer to tokens that do not exist. Section 7 (5).
28. The strip under the header is taller than the space the shell reserves for it. `src/components/pos-shell/OperationalShell.tsx:26`, `src/components/waiter/shell/WaiterShiftBanner.tsx:22`
29. There is no type-size token; sizes are Tailwind defaults chosen per element. `tailwind.config.ts` (no `fontSize`)
30. Icon sizes are typed as numbers in 241 places against 35 uses of the size registry. Section 7 (5).

Sign-in and device
31. Quick PIN sign-in asks the user to type a branch id. `src/pages/login.tsx:352-365`
32. "API: Local dev" is hard-coded on the login screen. `src/pages/login.tsx:224`
33. Every terminal is labelled "Terminal 01" unless a browser storage key is set by hand. `src/components/pos-shell/station.ts:22-36`
34. `_app.tsx` links icon and share images (`/brand/favicon-32.png`, `apple-touch-icon.png`, `og-image.png`) and the manifest lists three more; presence UNKNOWN (images removed from the snapshot). `src/pages/_app.tsx:22-30`, `public/brand/manifest.webmanifest`

Code and tests
35. One 1,608-line file holds the whole waiter order screen. `WaiterOrderBuilderScreen.tsx`
36. A 520-line page file holds the supervisor reservations screen. `src/pages/supervisor/reservations.tsx`
37. No test covers the waiter order flow. Section 12.
38. No test runs at a phone size. `playwright.config.ts:62-67`
39. The assertion scripts are not part of any npm script. `package.json:6-12`
40. Raw server messages can reach staff from 27 places in waiter components (63 across waiter, cashier, supervisor and shared floor). `grep -rn "error\.message" src/components/waiter | wc -l`

---

Working files used for the counts (not part of the repo):
`/tmp/claude-0/-home-claude/21ef40cd-9273-5759-a18e-804582ed6c1a/scratchpad/reach.py`, `/tmp/claude-0/-home-claude/21ef40cd-9273-5759-a18e-804582ed6c1a/scratchpad/reach2.py`, `/tmp/claude-0/-home-claude/21ef40cd-9273-5759-a18e-804582ed6c1a/scratchpad/deadexports.py`, `/tmp/claude-0/-home-claude/21ef40cd-9273-5759-a18e-804582ed6c1a/scratchpad/buttons.py`, `/tmp/claude-0/-home-claude/21ef40cd-9273-5759-a18e-804582ed6c1a/scratchpad/textstyles.py`.
