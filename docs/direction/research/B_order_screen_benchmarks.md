# B. Order screen benchmarks: table tap to order screen in restaurant POS

Lane B of the Nimbus POS direction v3 pass. Written 26 Nov 2026. All pages were read on 26 Nov 2026.
Scope: floor -> table -> order screen -> send -> bill, for waiter, bartender, cashier, supervisor, manager.
Not in scope (other lanes): recipes, inventory, stores, costing, kitchen screens, our own code.

## 0. How to read this report

Claim marks, used on every factual line:

- **[V Sx]** I opened the page (source Sx in the table in section 11) and the statement comes from its text.
- **[2H]** A search result title, a review or a summary says so. I did not open a primary page for it.
- **[PK]** From my own memory of the product. Treat as unknown until someone checks it.
- **[P]** My proposal for Nimbus.
- **UNKNOWN** Looked for it, did not find it.

One limit applies to every [V]: my reading tool returns the text of a page, not its pictures. I could read
what vendors wrote, but I could not look at their screenshots or videos. So every tile size, grid count and
exact pixel position below is either stated in text (rare) or marked [PK] / UNKNOWN. No tile size in this
report was measured from a screenshot.

Short answer for the owner's five lines:

| Owner said | What the benchmark says |
|---|---|
| "Tap a table, open a full screen" | Every product I could verify opens a full order screen on a table tap (Toast, Square, Foodics, Odoo). Toast has a setting that puts a details pane in between; its own help text says turn the pane off to open the order screen directly [V S3]. |
| "Half a screen, squeezed, is not nice" | The one product that puts the menu in a quarter of the screen (TouchBistro: four quadrants) is the layout to avoid [V S7, S12]. A university test found a category-first, top-to-bottom layout beat the default NCR Aloha Table Service layout on selection time and key presses [V S17]. |
| "Everything 2-3 taps away" | The norm is exactly three levels: menu -> group -> item [V S2, S19]. Products that reach one or two taps do it with a favourites or recent row, not with a deeper tree [V S10, S13]. |
| "Alcohol subdivided ... you can search" | Toast puts a search bar on top of the menu on terminals and a magnifier on handhelds, matches item names, shows out-of-stock results in grey, and shows recently picked items under the bar [V S10]. |
| "Supervisor, cashier, waiter tap the same table" | Same screen for everyone; rights come from the job. Toast lists numbered rights (1.16 Change Table, 1.17 Change Server, 1.20 Split Checks, 3.1 Discounts, 3.7 Void) and has no right at all for printing a check, so anyone who can open the check can print it [V S24]. |

---

## 1. Products

Read status: **Opened** = I read a vendor help page. **Marketing only** = I read a vendor sales page. **Not reached** = nothing opened; the row is from memory.

| # | Product | Who it is for | Devices | Order screen in one line | Read status |
|---|---|---|---|---|---|
| 1 | Oracle MICROS Simphony | Hotels, chains, large full-service venues | Fixed workstation, tablets [PK] | Pages of touch keys laid out by the site; a "check detail area" shows the open check; menu reached through "Screen Look Up" keys that open a list of item keys [V S6] | Opened (user guide, text only) |
| 2 | Toast, terminal (Flex) | US full-service and quick-service | Android terminal | Check on the left; menus, then groups, then items on the right; search bar on top of the items; Hold / Stay / Send under the check; Print next to Pay [V S2] | Opened |
| 3 | Toast Go (handheld) | Same, server handheld | Android handheld | Menu first; check details stack on top of the menu as items are added; header folds away; Hold / Stay / Send locked to the bottom; Print and Pay always visible [V S2] | Opened |
| 4 | Square for Restaurants | Small and mid full-service | iPad, Square Terminal, Square Register | Tap table, pick covers, add items to the bill; item grid with pages [PK]; cart can be sorted by seat, course, A-Z or time [V S4] | Opened (one article) |
| 5 | Lightspeed Restaurant K-Series (was iKentoo [PK]) | Full-service, Europe, South Africa [PK] | iPad, iPhone/iPod [PK] | Three parts: order summary, keypad, menu. Main menu buttons in the middle open sub-menus on the right [V S19] | Opened |
| 6 | Lightspeed Restaurant L-Series | Older iPad product | iPad | Category row and product grid beside the receipt [PK] | Not reached |
| 7 | TouchBistro | Full-service, iPad only | iPad | Four quadrants: menu top-left, order by seat top-right, table drawing (or quick pay) bottom-left, totals bottom-right [V S7, S12] | Opened |
| 8 | Revel | Multi-site, iPad | iPad | Category column, product grid, order panel [PK] | Not reached |
| 9 | Clover Dining | Small restaurants on Clover hardware | Clover Station, Flex | Floor plan, tap table, guests, item grid by category [PK] | Not reached (search results were sales pages only) |
| 10 | NCR Aloha Table Service | US chains, long-lived | Fixed terminal, handheld | Dense fixed panels of buttons by submenu; used as the "control" layout in a university test [V S17]; rest [PK] | Not reached (seen through S17) |
| 11 | SpotOn Restaurant | US full-service | Terminal, handheld | Check left, menu groups and items right [PK] | Not reached |
| 12 | Odoo Point of Sale, restaurant mode | Small business; the owner's back-office reference | Any browser, tablet, phone | Click a table and the POS screen opens for that table; guest count starts at one [V S8]; order lines and number pad on one side, category row and product cards on the other [PK] | Opened (overview page) |
| 13 | Loyverse | Small shops and cafes; free; common in East Africa [PK] | Phone, tablet | Sale screen of item tiles in custom pages (tablet) or a favourites list (phone); sale becomes a "ticket" that is saved to a table name afterwards [V S13, S14] | Opened |
| 14 | Foodics | Gulf and Egypt restaurants | iPad cashier app, waiter app | Tables screen, pick a table, New order, guest-count prompt, then the order page [V S18] | Opened (one article) |
| 15 | iiko / r_keeper | Russia, CIS, Gulf | Fixed terminal, handheld | Category buttons then dish buttons, order list at the side [PK] | Not reached |
| 16 | Pesapal Sabi + Reserveport (Uganda, Kenya, Rwanda) | Payments terminal plus ordering; sold to Ugandan restaurants | Sabi card and mobile-money terminal (4G, Wi-Fi) | Sales page describes a payment terminal and links to Oracle MICROS; it does not describe an order screen at all [V S15] | Marketing only |
| 17 | Uzapoint, SimbaPOS (Kenya) | Small Kenyan retail and restaurants | Android, web | UNKNOWN. Seen only as titles of comparison posts [2H] | Not reached |
| 18 | Vuga POS, GAAP POS, PilotPOS | Uganda / South Africa | UNKNOWN | UNKNOWN | Not reached |
| 19 | iCHEF (Taiwan, SE Asia) | Small restaurants, iPad | iPad | UNKNOWN (only the support home page loaded) | Not reached |

East and Southern Africa, what I can stand behind:

- **Simphony is sold in Uganda through Pesapal.** Pesapal's Uganda restaurant page names "Oracle Hospitality", Oracle MICROS point of sale and a "Pay@Table Symphony and Res" integration next to its own Sabi terminal, and says the Sabi terminal takes cards and MTN money [V S15]. This matches the owner's plan to scan Simphony first-hand.
- **Pesapal Sabi** on that page is a payment device, not a waiter ordering tool. No table ordering, kitchen printing, split bill or roles are described [V S15]. Every claim on the page is sales copy.
- **Loyverse** is available worldwide and free [PK]; its help pages are the only East-Africa-relevant small-business ones I could read in full [V S13, S14].
- Toast is sold in the US, Canada, UK and Ireland only; Square is not sold in Uganda [PK]. They are here as the best-documented patterns, not as local competitors.

Two products I argue are WRONG for this audience (details in 10d):

1. **NCR Aloha Table Service default layout** (and the same family: dense, site-built key pages). Evidence: a 2016 Arizona State University applied project built a category-first, top-to-bottom ("F-shape") layout and tested it against a control modelled on the default Aloha Table Service; selection time and number of key presses were "significantly reduced" with the new layout [V S17]. Dense fixed panels need training that a high-turnover floor does not have.
2. **Loyverse** for table service. The waiter builds the sale first, taps Save, then picks a table name from a list; table names already in use are hidden from the list [V S14]. That is ticket-first, the reverse of the owner's table-first rule, and it cannot answer "what is on table 12" from a floor view.

---

## 2. The table tap

| Product | What opens on a tap | Guest count / seat prompt | Occupied table versus free table | Source |
|---|---|---|---|---|
| Toast | With the Table Details pane hidden: "select any table to open its order screen directly". With the pane visible: a Check Details view first, then Update to reach the order screen. | A setting, "Party size": "Always ask before creating a new order" or "Never ask". Seat numbers need the first value. | Occupied tile shows guest count, a timer for how long the check has been open, table number and service area, total spend across all checks, and server initials in a coloured badge with the table border in the server's colour. Free table look: not described. Press and hold a table to move a check. | [V S3, S20] |
| Square for Restaurants | "From the floor plan view, tap the desired table", then "Choose the number of covers seated at the table", then add items to the bill. | Covers prompt on every new table, per the article. | UNKNOWN from the page. | [V S4] |
| Foodics | Tables -> select the table -> New order -> guest prompt -> order page. Second route: start an order, choose Dine-in, pick the table, Confirm, guest count. | Yes, both routes: "A prompt will appear asking you the number of guest." | UNKNOWN from the page. | [V S18] |
| Odoo POS | Click a table: the POS screen opens for that table. "Change table" returns to the floor. "Release table" frees a table picked by mistake. | No prompt. Guest count is set to one automatically. | UNKNOWN from this page. Occupied tables show an order count badge [PK]. | [V S8] |
| Simphony | Two routes. (a) A "Begin Check by Table" function key (number 401), by table number or ID, "typically" used by servers with a section. (b) On the dining-room screen, a **long press** on a table lists its functions. On a free table: Quick Seat, Begin Check, Assign Section, Select Employee, Set as Clean / Dirty, Close Table, Reserve Table, Merge Table, Change Table Capacity. On an occupied table: Begin Check (adds a second check), Pickup Table (Check #), Unseat Table, and the same housekeeping functions. | "Adding the Guest Count to a Check" is its own topic; whether it is forced is a site setting [PK]. | Table shows section colour, a "decorator" (Clean, Dirty, Closed, Reserved) and an employee colour. Picking up a table moves ownership of the check to the employee who picked it up. | [V S1, S5, S21] |
| Lightspeed K-Series | The Register screen is the default landing screen (older navigation). A "Tables" key on the keypad assigns the order to a table number typed on the keypad. A Floor Plan screen also exists. | UNKNOWN. A "Covers" button on the order splits the check evenly by covers. | UNKNOWN (the floor plan article link was broken on the page I read). | [V S9, S19] |
| TouchBistro | Order screen with the four quadrants, including a drawing of the table and its chairs. | UNKNOWN from the pages read. Party-size prompt on tap [PK]. | UNKNOWN. | [V S7] |
| Loyverse | There is no table tap. Add items, tap Save, choose a table name. To come back: Open Tickets -> pick the ticket. | None. | Used table names are hidden from the pick list; nothing else. | [V S14] |
| Clover Dining, Revel, SpotOn, Aloha, iiko, r_keeper | Tap table -> guests -> full order screen [PK] | [PK] | [PK] | Not reached |

What the sources disagree on:

- **Guest count.** Square and Foodics ask every time [V S4, S18]. Toast makes it a setting [V S20]. Odoo skips it and writes "1" [V S8]. There is no industry agreement, so this is a real choice for Nimbus (see 10a rule 3).
- **Tap versus long press.** Toast and Odoo use a plain tap to open the order [V S3, S8]. Simphony's dining-room screen documents the long press, and Oracle's own text says it "recommends that you do not begin a guest check from this function" because such checks miss the table-management reports [V S21]. So in Simphony the table screen and the order screen are two systems joined together. That is the single biggest thing for the first-hand scan to look at.
- **A pane in between.** Toast offers both: a details pane before the order screen, or straight in [V S3]. The owner asked for straight in.

---

## 3. Order screen anatomy (six best-documented products)

Frames are redrawn from vendor text. Each part is marked. Sizes are not to scale; no vendor states tile sizes or grid counts in the pages I read (UNKNOWN for all six).

### 3.1 Toast (terminal) and Toast Go (handheld)

```
TERMINAL (landscape)                                             source: S2, S10
+---------------------------+--------------------------------------------------+
| Table 12  Tab  Server     | [ Search menu items ...........]  [Open Item]    |  search bar above items [V]
| Svc chg  Split  Disc  4g  |--------------------------------------------------|
|---------------------------| MENUS:   Food | Drinks | Happy hour               |  menu -> group -> item [V]
| 2 Nile Special            | GROUPS:  Appetizers | Mains | Beer | Whisky ...   |  row position [PK]
| 1 JW Black                |--------------------------------------------------|
|    Double, Coke           | [item] [item] [item] [item] [item]               |
|   "Sent 19:42"            | [item] [item] [item] [item] [item]               |  grid count UNKNOWN
|                           | [item] [item] [item] [item] [item]               |
|---------------------------|--------------------------------------------------|
| [Hold] [Stay] [Send]      | modifiers for the picked item appear at the      |  [V]
| [Print]          [Pay]    | bottom of the screen                             |
+---------------------------+--------------------------------------------------+
  check on the LEFT [V]; overflow (three dots) top right of the check [V]

HANDHELD (Toast Go)                         source: S2, S10
+--------------------------+
| <  T12        [All Checks] :|  action bar, overflow dots [V]
|--------------------------|
| check lines stack here,  |  "check details stack on top of the menu
| header folds as you add  |   as you build the order" [V]
|--------------------------|
| (magnifier)  menu  v     |  magnifier at top of menu [V]; menu can be
| [group] [group] [group]  |  expanded or collapsed [V]
| [item ] [item ] [item ]  |
| [item ] [item ] [item ]  |  columns UNKNOWN
|--------------------------|
| [Print]           [Pay]  |  always visible [V]
| [Hold] [Stay] [ Send ]   |  locked to bottom [V]
+--------------------------+
```

- Send fires the highlighted items and returns to the table screen. Stay fires and keeps you on the order. Hold keeps items back; if you send only some, the rest are held automatically [V S2].
- Handheld moves Service charge, Split and Discount into the overflow menu; on the terminal they sit in the check header [V S2].
- Overflow menu holds: Switch user, All checks, Split, Discount, Guest count, Server, Transfer to table, Change customer, Service charge, Tax exempt, Reprint kitchen tickets, Lookup check, Void order [V S2].

### 3.2 Lightspeed Restaurant K-Series

```
TERMINAL / iPad (landscape)                                      source: S19
+--------------------------+----------------------+-------------------------+
| ORDER SUMMARY            | MAIN MENU BUTTONS    | SUB-MENU / ITEMS        |
| items, seat, course,     | [Food    ]           | [Whisky] [Gin] [Vodka]  |  "main menu buttons sit in the
| order tags               | [Drinks  ]           | [item] [item] [item]    |   middle ... expand into
| [Actions][Display mode]  | [Wine    ]           | [item] [item] [item]    |   sub-menus on the right" [V]
| [Covers][Order profile]  | [Offers  ]           | sub-screens can open    |
| [Allergens][Notes]       |                      | deeper menus or items   |
|--------------------------|                      | and modifiers [V]       |
| KEYPAD  7 8 9            |                      |                         |
|  C      4 5 6  [Tables]  |                      |                         |  tap a number, then the item,
|  [Tab]  1 2 3  [Quickpay]|                      |                         |  to set quantity [V]
|  [Edit]   0   [Collapse] |                      |                         |
+--------------------------+----------------------+-------------------------+
  Send / Pay / Print position: UNKNOWN from the page.

HANDHELD: not described in the pages I read. UNKNOWN.
  From memory [PK]: one view at a time, menu buttons full width, order behind a tab.
```

### 3.3 TouchBistro (iPad only)

```
iPad (landscape)                                                 source: S7, S12
+--------------------------------------+-----------------------------------+
| MENU  [Dinner v]                     | CURRENT ORDER                     |
| Starters | Mains | Beer | Whisky ... | == Seat 1 (colour bar) ==         |  categories across the top
| [item] [item] [item]                 |   1 Nile Special                  |  of the menu quadrant [V]
| [item] [item] [item]                 | == Seat 2 ==                      |  seats colour-coded [V]
| view: list / picture grid / text grid| == Shared order for table ==      |  shared bar for the table [V]
|--------------------------------------|-----------------------------------|
| TABLE AND CHAIRS drawing             | ORDER SUMMARY                     |
|   (tap a chair to pick the seat;     | total, split by sales category    |
|    + adds a seat)                    | (food versus alcohol), taxes      |  [V]
|   or QUICK PAY buttons in register   | up/down arrow = simple total      |
+--------------------------------------+-----------------------------------+
  "Right Hand Mode" in the staff profile flips the menu to the right [V].
  Send icon sends to kitchen / bar [V]; exact position UNKNOWN.

HANDHELD: no phone product [PK]. UNKNOWN.
```

The menu gets about a quarter of the screen. This is the "half a screen, squeezed" pattern the owner rejected.

### 3.4 Odoo POS, restaurant mode

```
TABLET / LAPTOP                                 source: S8 for the table tap; layout is [PK]
+----------------------------+-------------------------------------------------+
| ORDER LINES   Table 12     | [Food] [Drinks] [Offers] ...        [ Search ]  |  category row, search [PK]
|  2 Nile Special   12,000   | [Beer] [Wine] [Whisky] [Gin] ...                |  child categories appear
|  1 JW Black tot    8,000   |-------------------------------------------------|  when a parent is picked [PK]
|----------------------------| [product card] [product card] [product card]    |
| [Note] [Course] [Guests]   | [product card] [product card] [product card]    |
| [Split] [Bill] [Transfer]  |                                                 |
|----------------------------|                                                 |
| 1 2 3  Qty                 |                                                 |  number pad always on screen [PK]
| 4 5 6  %                   |                                                 |
| 7 8 9  Price               |                                                 |
| [ Order ]     [ Payment ]  |                                                 |
+----------------------------+-------------------------------------------------+
  "Change table" returns to the floor plan [V]. Guest count starts at 1 [V].

PHONE [PK]: one view at a time. Product list with a bottom bar that switches to the cart; cart has Pay.
```

### 3.5 Loyverse

```
TABLET                                        source: S13 (pages), S14 (tickets); positions [PK]
+----------------------------------------------+---------------------------+
| [item] [item] [item] [item] [item]           | TICKET              [...] |
| [item] [category] [item] [discount] [ + ]    |  2 Nile Special           |
| [item] [item] [item] [item] [item]           |  1 JW Black               |
|                                              |                           |
|----------------------------------------------| [ SAVE ]     [ CHARGE ]   |
| (grid icon = all items A-Z) | Page 1 | Page 2 | + Add page |             |
+----------------------------------------------+---------------------------+
  Custom pages: press and hold an empty square, pick an item, a category or a discount for it;
  drag to rearrange; layouts sync to other tablets in the store [V].

PHONE
  No custom pages. A "Favorites" list of frequently used items instead [V].
  Rest of the phone layout: UNKNOWN from the page. From memory [PK]: item list, ticket bar on top.
```

### 3.6 Oracle MICROS Simphony

```
WORKSTATION                                   source: S1, S5, S6 for the parts named; layout is [PK]
+----------------------------+-------------------------------------------------+
| CHECK DETAIL AREA          | page of touch keys laid out by the site         |  "check detail area" [V]
|  Tbl 12  Chk 4031  Gst 4   | [Beer SLU] [Liquor SLU] [Wine SLU] [Food SLU]   |  SLU = a key that opens a
|  2 Nile Special            |-------------------------------------------------|  list of item keys [V]
|  1 JW Black                | [item key] [item key] [item key] [item key]     |
|     DBL / COKE             | [item key] [item key] [item key] [item key]     |  paging or scrolling: UNKNOWN
|----------------------------| [  <  ]                              [  >  ]    |  arrows [PK]
| function keys: Hold, Fire, |-------------------------------------------------|
| Send, Print, Pay, Transfer | condiment (modifier) pop-up when an item needs  |  "Popup Condiment Orderer" [V title]
|                            | one                                             |
+----------------------------+-------------------------------------------------+
HANDHELD / TABLET: the guide has battery-warning and offline-mode topics for mobile devices [V S5 titles].
  Layout UNKNOWN. This is for the first-hand scan.
```

The user guide tells an operator which function to press, not where it is, because each site designs its own pages. No public page fixes the layout. Everything about position and size in Simphony has to come from the owner's login.

### 3.7 Square for Restaurants (text only, not one of the six)

Tap table -> covers -> add items -> Checkout [V S4]. "Actions" on a check has "Sort Cart" by Seat, by Course, A-Z or by Time Added, with "Make Default" [V S4]. Grid of tiles with pages along the edge, check at the side [PK]. The Square Terminal handheld has table maps and coursing; the lesson page is a three-minute video I could not read [V S16, title only].

---

## 4. Menu depth and reach

### 4.1 How each handles Drinks > Spirits > Whisky

| Product | Levels the staff taps through | Paging or scrolling | Favourites / popular / quick keys | Search | Timed menus, out-of-stock |
|---|---|---|---|---|---|
| Toast | Menu -> group -> item: "Select a menu to show its groups, then select a group to show its items" [V S2]. Sub-groups inside a group exist [PK]. | Scroll [PK] | "Recently selected items will appear under the search bar for quick and easy re-order" [V S10]. No named favourites page found. | Bar at the top of the menu (terminal), magnifier (handheld). Matches item name. Results show the item's location in the menu, its POS name and SKU if turned on. Out-of-stock results shown in grey. Spelling must be right. No barcode match stated. Can be switched off in settings [V S10]. | "Quick Edit" on the POS can mark an item out of stock; rights 5.1 (full) and 5.2 "Inventory & Quantity" control who [V S2, S24]. Item countdown [PK]. Timed menus [PK]. |
| Lightspeed K | Main button -> sub-menu on the right -> deeper sub-screens or items and modifiers [V S19]. Depth is free. | UNKNOWN | UNKNOWN. A "Quickpay" key exists for payment, not items [V S19]. | Not on the register page. The orders list has filters by type, user, channel, status, floor [V S9]. Item search UNKNOWN. | UNKNOWN |
| TouchBistro | Menu (drop-down or tabs) -> category across the top -> item [V S7, S12]. | UNKNOWN | UNKNOWN | UNKNOWN | Several menus (Breakfast, Lunch, Dinner) can be on offer at once [V S12]. Countdown [PK]. |
| Odoo | Parent category -> child category -> product [PK] | Scroll [PK] | None built in [PK] | Search box top right; name and barcode [PK] | UNKNOWN |
| Loyverse | Tablet: custom page -> item, or page -> category tile -> item. Phone: Favorites or category list [V S13]. | Pages as tabs; scroll inside [PK] | Custom pages (tablet) and Favorites (phone) are the main way to sell [V S13]. | Search and barcode [PK] | UNKNOWN |
| Simphony | Page -> Menu Item SLU key -> item key: "Press the SLU item key that you want to ... add to the check" [V S6]. Also "Number Look Up" by item number [V S5 title]. | UNKNOWN (arrows [PK]) | Sites build fast pages by hand [PK] | No search topic anywhere in the POS user guide contents [V S5]. Number look-up only. | No availability or countdown topic in the user guide contents [V S5]. Exists in the product [PK]. |
| Square | Page (display group) -> item, or page -> category -> item [PK] | Pages [PK] | Pages are hand-built quick keys [PK] | Search [PK] | 86 from the POS [PK] |
| Foodics | Category -> product [PK] | Scroll [PK] | UNKNOWN | UNKNOWN | UNKNOWN |

Pattern: nobody shows "Drinks > Spirits > Whisky" as three taps before items. Toast and TouchBistro have a hard shape of two levels above the item [V S2, S7]. Where a venue wants a third level, the common answer is to promote "Whisky", "Gin", "Vodka" to groups next to "Beer" and drop "Spirits" as a tap [PK for how venues set it up; the two-level shape itself is V].

### 4.2 Tap counts

Starting point for every row: the table's order screen is already open, and a different part of the menu is showing. Count stops when the line is on the order. Sending is one more tap everywhere. Counts are worked out from the documented structure (marked V) or from memory of the screen (marked PK). None was timed on a live system.

**(a) One beer**

| Product | Taps | Each tap | Basis |
|---|---|---|---|
| Toast | 3 | Drinks (menu) -> Beer (group) -> Nile Special | [V S2] structure |
| Toast, via recent | 2 | Search bar -> Nile Special in "recently selected" | [V S10] |
| Lightspeed K | 3 | Drinks (main button) -> Beer (sub-menu) -> Nile Special | [V S19] structure |
| TouchBistro | 2 | Beer (category across the top) -> Nile Special. 3 if the drinks menu must be picked first; +1 if a seat is picked first | [V S7] structure |
| Simphony | 2 | Beer SLU key -> Nile Special key. 3 if the SLU key is on another page | [V S6] structure, page layout [PK] |
| Loyverse | 1 | Nile Special on a custom page. 2 through a category tile. Then +2 to attach a table (Save -> table name) | [V S13, S14] |
| Odoo | 3 | Drinks -> Beer -> Nile Special | [PK] |
| Square | 2 | Page tab -> Nile Special | [PK] |

**(b) One double whisky with a mixer**

| Product | Taps | Each tap | Basis |
|---|---|---|---|
| Toast | 5 to 6 | Drinks -> Whisky -> JW Black -> "Double" (required modifier, shown at the bottom) -> "Coke" (mixer modifier) -> Done if the group needs closing | Structure and modifiers-at-bottom [V S2]; the Done tap [PK] |
| Lightspeed K | 6 to 7 | Drinks -> Spirits -> Whisky -> JW Black -> Double -> Coke -> confirm | Free-depth sub-screens with modifiers [V S19]; exact pop-up [PK] |
| TouchBistro | 5 | Whisky (category) -> JW Black -> Double -> Coke -> Done | Categories [V S7]; modifier pop-up [PK] |
| Simphony | 5 | Liquor SLU -> JW Black -> measure in the condiment pop-up -> Coke -> Done | SLU [V S6], pop-up exists [V S5 title]; steps [PK] |
| Loyverse | 4 (+2 for the table) | JW Black -> Double -> Coke -> Save in the modifier window; then Save -> table name | Pages and tickets [V S13, S14]; modifier window [PK] |
| Odoo | 6 to 8 | Drinks -> Spirits -> Whisky -> JW Black -> size in a variant pop-up -> back to Soft -> Coke | [PK]; Odoo has no bar-style measure and mixer built in [PK] |

Reading: the beer is 2-3 taps everywhere. The whisky is 5-7 taps everywhere, and all of the extra taps are the measure, the mixer and a closing "Done". That is where Nimbus can be better than the field (10b).

---

## 5. Modifiers, servings, courses, seats

| Topic | What products do | Source |
|---|---|---|
| Forced versus optional modifiers | Toast: modifiers show at the bottom of the screen once an item is picked; "some may be required before the item can be sent". A setting chooses how modifier groups are drawn (Vertical, Horizontal, Legacy). Another setting hides default modifiers and shows only removals as "NO". | [V S2, S20] |
| | Simphony calls modifiers "condiments" and has a "Popup Condiment Orderer". | [V S5 titles] |
| | Lightspeed K: sub-screens "display items and modifiers"; modifiers, allergens and notes can also be added from the order summary. | [V S19] |
| Measure (tot, double, bottle) | No vendor page I read documents a bar measure as its own thing. It is done as a required modifier group (Toast, TouchBistro, Square), as separate items, or in Simphony with "menu levels" that re-price the same item by size. | [PK] for all; UNKNOWN in public text. First-hand scan item. |
| Courses | Toast: coursing can be Required, Optional or Off, separately for quick order and table service; course buttons can be added to the order screen; courses are defined in kitchen pacing settings. | [V S2, S20] |
| | Lightspeed K: "Display mode" shows the order by course or by seat; the keypad shows when ordering by course. | [V S19] |
| | Square: cart can be sorted by course. | [V S4] |
| Hold and fire | Toast: Hold / Stay / Send; a partial send holds the rest. "Show item sent time" writes "Sent HH:MM" under the items. | [V S2, S20] |
| | Simphony: separate functions for firing items, sending while staying on the check, re-firing, holding items, holding "for a preset time", and ending the round with items on hold. | [V S5 titles] |
| Seats | Toast: seat number is an optional add-on to each item; can be made required; needs the party-size prompt switched on. Turning seat numbers on stops identical items from being merged into one line. | [V S20] |
| | TouchBistro: seats first. Tap a seat's colour bar, then items. A "Shared Order" bar holds things for the whole table. | [V S7] |
| | Simphony: filter a check by seat, change the seat of items, print a "memo check" per seat. | [V S5 titles] |
| Notes to kitchen | Toast: "special request" on an item, with an optional price. Lightspeed K: order-wide notes and allergens that show on the kitchen screen and printed dockets. | [V S2, S20, S19] |
| Repeat | Toast: "repeat" is one of the actions on a tapped order line. Simphony: "Repeating Menu Items", with some items marked non-repeatable. | [V S2; S5 titles] |
| Quantity | Toast: change quantity from the tapped line; identical items can be merged into one line with a count. Lightspeed K: tap a number on the keypad first, then the item. | [V S2, S20, S19] |
| Refill | Simphony has "Menu Item Refills" as a named function. | [V S5 title] |

---

## 6. The same table for different roles

### 6.1 How rights are decided

| Product | Mechanism | Source |
|---|---|---|
| Toast | Numbered rights attached to a job. Relevant ones: 1.8 View Other Employees' Orders, 1.9 Edit Other Employees' Orders, 1.16 Change Table, 1.17 Change Server, 1.20 Split Checks, 3.1 Discounts ("manager-level" discounts; discounts set to "any user" need no right), 3.7 Void Items / Orders, 3.8 Void / Refund Payments, 3.32 the same limited to the same day, 3.10 Edit Sent Items, 3.23 Find Checks (includes closed), 3.4-3.6 bulk transfer / void / close, 1.13 No Sale, 5.x Quick Edit (86, price, button names). There is no single "manager" switch. | [V S24] |
| | A setting, "Edit other employees' checks confirmation", decides whether a lead sees a prompt before changing someone else's check. | [V S20] |
| | A further option limits a person's rights to the job they clocked in as. | [2H, title of a Toast help article] |
| Simphony | Rights sit on roles and employee classes [PK]. Picking up a table "transfers" ownership "to the employee performing the pickup"; assigning a table to another server keeps existing checks with the first server. Named functions exist for transfer inside and across revenue centres, combine checks, reopen, adjust, void and reprint a closed check. | [V S21, S5 titles] |
| Lightspeed K, Square, TouchBistro, Odoo, Loyverse, Foodics | Role or user-group rights set in the back office; staff identified by PIN [PK]. | Not verified |

### 6.2 How it is shown: hidden button or approval prompt

This is the weakest-documented part of the whole study. Toast's rights reference lists the rights but "doesn't say what the POS shows when a permission is missing" [V S24]. The Simphony user guide has no authorisation topic in its contents [V S5]. So:

- Toast: an action without the right raises a manager approval prompt (passcode or card) [PK].
- Simphony: an "authorisation" prompt where a manager enters an ID or swipes a card; keys are usually still on the page [PK].
- Square, Lightspeed: buttons the role cannot use are greyed or absent; some raise a passcode box [PK].

UNKNOWN in public text for every product. This must be watched on the Simphony login.

### 6.3 Action by action

| Action | What I could verify | Source |
|---|---|---|
| Void | Toast right 3.7 covers items and whole orders; "Void order" sits in the order overflow menu. Simphony has "Voiding a Closed Check" as its own function. | [V S24, S2, S5] |
| Discount | Toast right 3.1 for manager-level discounts; Discount sits in the check header (terminal) or the overflow (handheld). Simphony: "Applying a Discount Manually", a Discount SLU. | [V S24, S2, S5, S6] |
| Split | Toast right 1.20; Split in the header or overflow; split is also offered on a single line. Simphony: "Splitting Off Items" and "Dividing a Check Into Equal Partial Payments". Lightspeed K: "Covers" splits evenly. Square: by seat [PK]. | [V S24, S2, S5, S19] |
| Merge | Toast: no merge button. Moving a check onto a table that already has one asks: merge, or keep separate. Simphony: "Combining Checks" inside or across revenue centres; "Merge Table" joins tables. | [V S3, S5, S21] |
| Transfer table | Toast right 1.16; press and hold the table tile, pick the check, "Move", pick the target; or tap the table number in check details. Odoo: move to another table. Loyverse: "Move ticket". | [V S3, S24, S8, S14] |
| Transfer to another server | Toast right 1.17; tap the server name on the check. Simphony: Pickup Table moves ownership; team checks let several servers share one check. | [V S3, S24, S21, S5] |
| Print check | Toast: Print button on the check whenever a printer is connected; no right is listed for it. | [V S2, S24] |
| Reprint | Toast: "Reprint kitchen tickets" in the overflow. Simphony: "Reprinting a Closed Check". | [V S2, S5] |
| Reopen | Simphony: "Reopening a Closed Check", "Adjusting a Closed Check". Toast: Find Checks (3.23) reaches closed checks; reopening not stated. | [V S5, S24] |

---

## 7. The bill

| Question | Finding | Source |
|---|---|---|
| Who can print the guest check before payment | Toast: anyone on the check. Print shows on the terminal "when a printer is connected" and is "always visible" on the handheld. No right exists for it. A setting decides whether the order screen closes after printing. This matches the owner: "Even a waiter can print a bill." | [V S2, S20, S24] |
| Pro-forma / memo | Simphony prints a "memo check" for a seat filter, a bill for part of the table that does not close the check. | [V S5 title] |
| Table state after printing | Simphony shows table status through decorators; "check printed" as a table state is not in the public page. Toast tile shows time and total, not a printed flag. | [V S21, S3]; UNKNOWN for a printed flag |
| Split checks | By item (Simphony split off items; Toast split on a line), by equal parts (Simphony; Lightspeed Covers), by seat (TouchBistro seats, Square) | [V S5, S2, S19, S7]; Square [PK] |
| Pay at table | Simphony has pay-at-the-table with one or several cards, pay by QR code and "Consumer Self Pay". In Uganda, Pesapal sells a "Pay@Table Symphony and Res" link to its Sabi terminal, which takes cards and MTN money. Toast Go takes swipe, dip and tap at the table; one flow enters the order on a fixed terminal and takes payment on the handheld. | [V S5 titles, S15, S11] |
| Food versus alcohol on the bill | TouchBistro's summary splits the total by sales category. | [V S12] |

---

## 8. Handheld-specific patterns

| Pattern | Who | Source |
|---|---|---|
| Menu first, order grows on top of it; header folds away as items are added; the menu can be collapsed | Toast Go | [V S2] |
| Send controls pinned to the bottom edge; Print and Pay never hidden | Toast Go | [V S2] |
| Secondary actions (service charge, split, discount) move from the header into one overflow menu on the small screen | Toast Go | [V S2] |
| Search becomes an icon, not a field | Toast Go | [V S10] |
| No custom grid on a phone; a favourites list instead | Loyverse | [V S13] |
| One view at a time with a cart bar or a toggle | Odoo, Loyverse, Square Terminal | [PK] |
| Order on a fixed terminal, take payment on the handheld | Toast (bar flow) | [V S11] |
| Device chooses its first screen (order entry or payment list) | Toast Go | [V S11] |
| Unsent-order warnings and offline mode are named topics for mobile workstations | Simphony | [V S5 titles] |

No product I could verify uses a bottom sheet for the order on a phone; that part of the Nimbus design is our own rule, not a copied pattern.

---

## 9. Speed evidence

Hard numbers are almost absent in public. What exists:

| Evidence | What it says | Conditions | Kind |
|---|---|---|---|
| Wang, C. C. (2016), "Restaurant Point-of-Sale Interfaces: Comparisons in Menu Organization and User Efficiency", Arizona State University, Human Systems Engineering applied project, 54 pages | A layout using category grouping and an F-shape (top-to-bottom, left-to-right) arrangement, tested against a control modelled on the default NCR Aloha Table Service. Selection time and number of key presses were "significantly reduced". It also watched novice and expert order-takers and suggests teaching experts' strategies to novices. | Lab test. Participant count and the exact seconds are in the PDF, which returned empty to my tool. UNKNOWN until someone opens the PDF. | Independent research [V S17, abstract only] |
| Toast help, search | Recently selected items appear under the search bar "for quick and easy re-order". | No number. | Vendor help [V S10] |
| Toast help, bar handheld | Handheld-only bar service is called "the gold standard"; quick order is "designed for rapid, high-volume transactions". Hardware: 24+ hours battery, 1.5 m drop. | No service-time numbers. | Marketing wording inside a help page [V S11] |
| Pesapal Uganda | "Enjoy same day setup", "4G and WiFi enabled for faster payments". | No conditions given. | Marketing [V S15] |
| NielsenIQ (2010), "Determining Measures of Success in Point of Sale Interface Design"; IBM retail POS benchmark; a 1995 Human Factors paper comparing five POS input devices; a Medium "16 UX factors of POS" guide | Exist. Not opened. | UNKNOWN | [2H, titles only] |
| Touch target guidance | Nielsen Norman Group: about 1 cm by 1 cm. Apple: 44 pt. Google Material: 48 dp. | General touch guidance, not POS-specific. | [PK] |
| Vendor claims that handhelds raise table turns or cut order time | Common in sales pages. I opened none with stated conditions. | UNKNOWN | Treat as marketing |

I found no Nielsen Norman Group or Baymard study on restaurant POS order entry. The house rule of 44 px is at the bottom of the published range; for item tiles used at arm's length on a shared terminal, 64 px or more is the safer floor [P].

Since nobody publishes times, Nimbus should make its own: log time from table tap to Send and taps per line, per role, from the first pilot [P].

---

## 10. Synthesis for Nimbus

### 10a. What every good order screen does (14 rules)

1. **A table tap opens the full order screen, nothing in between.** Toast's own advice for speed is to hide the pane [V S3]. Odoo does the same [V S8].
2. **One screen, the same for every role.** Rights change which actions are live, not where things are [V S24 for rights on jobs] [P for the rest].
3. **Do not force a guest-count prompt.** Vendors disagree (Square and Foodics ask, Toast lets the venue choose, Odoo writes 1) [V S4, S18, S20, S8]. Show the count in the header with a default; one tap to change [P].
4. **Never more than two levels above the item.** Menu -> group -> item is the common shape [V S2, S7, S19]. "Spirits" is a label over Whisky, Gin, Vodka, Rum, Tequila, not a tap [P].
5. **Categories on top, items below, order at the side or behind a bar.** Category-first, top-to-bottom layout beat a dense panel layout in the one independent test [V S17].
6. **The groups of the current menu stay visible while items show**, so moving from Beer to Whisky is one tap, not back-then-forward [V S19 for Lightspeed's persistent main buttons] [P].
7. **A landing shelf of popular and recent items makes the common order one tap** [V S10 recent items; V S13 favourites and pages].
8. **Search is always visible on the order screen**, matches names, and shows unavailable items in grey instead of hiding them [V S10].
9. **Send is the single loudest button and is pinned to the bottom edge on a phone** [V S2].
10. **Unsent and sent lines look different, and sent lines carry their time** [V S2, S20].
11. **Print bill and Pay are always reachable from the order**, never buried in a menu [V S2].
12. **Tapping an order line opens everything about that line:** quantity, repeat, note, course, seat, split, discount, delete [V S2].
13. **Seats and courses are optional layers.** A waiter can ignore them; a table-wide "shared" bucket is the default [V S7 shared order; V S20 optional seat and course].
14. **The table tile on the floor answers the questions before the tap:** who, how long, how much, how many [V S3].

### 10b. Two layout options

Shared by both options [P]:

- Four fixed tabs: **Popular | Offers | Food | Drinks**. The screen opens on Popular (the 12 to 24 items this device sells most, plus the last items sent to this table). A bar device remembers Drinks.
- Groups under Drinks: Soft, Beer, Wine, Cider, Whisky, Gin, Vodka, Rum, Tequila, Cocktails, Hot. No "Spirits" tap.
- Spirit items are drawn as rows with the measure on the row: **[Tot] [Dbl] [Btl]**. Tapping a measure adds the line. A "Mixer" strip of the four most-used mixers then shows above the order bar for a few seconds; one tap adds the mixer as a child line; ignoring it costs nothing.
- Exactly one filled button: **Send** while there are unsent lines. When nothing is unsent, the filled button becomes **Print bill** for a waiter and **Take payment** for a cashier, supervisor or manager.
- Text tiles, coloured edge by menu; no pictures (weak network, more names per screen).
- Nothing scrolls sideways. Group buttons wrap into rows. Items scroll down.

#### Option A: "Drill-down tiles" (the grid replaces itself)

The area under the tabs shows big group tiles. Tapping a group replaces the tiles with that group's items and a "Drinks > Beer" line to go back. Closest to Toast Go and to Simphony's look-up keys [V S2, S6].

```
PHONE 390 x 844                         after tapping "Beer"
+------------------------------------+  +------------------------------------+
| <  Table 12 . 4 guests . Sarah  :  |  | <  Table 12 . 4 guests . Sarah  :  |  56
| [ Search the menu ............ ]   |  | [ Search the menu ............ ]   |  48
| Popular | Offers | Food | Drinks   |  | Popular | Offers | Food | Drinks   |  48
|------------------------------------|  |------------------------------------|
| [   Soft      ] [   Beer      ]    |  | < Drinks  >  Beer                  |  44
| [   Wine      ] [   Cider     ]    |  | [Nile Special 6,000][Club 6,000]   |
| [   Whisky    ] [   Gin       ]    |  | [Bell 6,000       ][Tusker 7,000]  |  tiles 175 x 64, 2 columns
| [   Vodka     ] [   Rum       ]    |  | [Guinness 7,000   ][Castle 7,000]  |
| [   Tequila   ] [  Cocktails  ]    |  | ...                                |
|   group tiles 175 x 88             |  |                                    |
|------------------------------------|  |------------------------------------|
| 3 items . 24,000       [ Send 3 ]  |  | 4 items . 30,000       [ Send 4 ]  |  72, pinned
+------------------------------------+  +------------------------------------+

TABLET / TERMINAL 1280 x 800
+----------------------------------------------------------------+---------------------------+
| < Floor   Table 12 . 4 guests . Sarah . 0:42   [ Search .... ] | ORDER  Table 12        :  |  56
| Popular | Offers of the day | Food | Drinks                    |---------------------------|  56
|----------------------------------------------------------------| NOT SENT                  |
| [  Soft  ] [  Beer  ] [  Wine  ] [ Cider  ]                    |  2 Nile Special   12,000  |
| [ Whisky ] [  Gin   ] [ Vodka  ] [  Rum   ]                    | SENT 19:42                |
| [Tequila ] [Cocktail] [  Hot   ]                               |  1 Goat muchomo   25,000  |
|   group tiles 214 x 120, 4 columns; replaced by a              |                           |
|   5 x 6 item grid after a tap                                  | Total            37,000   |
|                                                                | [Print bill]  [Pay]       |
|                                                                | [ Send to kitchen (2) ]   |
+----------------------------------------------------------------+---------------------------+
   menu area 920 wide                                              order panel 360 wide

LAPTOP 1440 x 900: same as the terminal; menu area 1040, order panel 400, group tiles 5 columns,
item grid 6 x 7 after a tap.
```

Taps, Option A:

- Beer: Drinks -> Beer -> Nile Special = **3**. From Popular = **1**.
- Double whisky with mixer: Drinks -> Whisky -> [Dbl] on JW Black -> Coke on the mixer strip = **4**.
- Then one more for Send.
- Moving from Beer to Whisky inside one order: back line -> Whisky = 2 before the item.

#### Option B: "Fixed shelf" (tabs, a shelf of groups, items, all on screen together)

The groups of the chosen tab stay on screen as a wrapped shelf of buttons. Items for the chosen group sit under it. Closest to Toast terminal, Lightspeed K and TouchBistro's category row, but with the menu given the full screen [V S2, S19, S7].

```
PHONE 390 x 844
+------------------------------------+
| <  Table 12 . 4 guests . Sarah  :  |  56   back, table, guests (tap to change), actions
| [ Search the menu ............ ]   |  48
| Popular | Offers | Food | Drinks   |  48   four equal tabs
|------------------------------------|
| [Soft] [Beer*] [Wine] [Cider]      |  48   shelf: 4 per row, wraps, 2 rows shown,
| [Whisky] [Gin] [Vodka] [More 4]    |  48   "More" opens the rest; folds to one line on scroll
|------------------------------------|
| [Nile Special 6,000][Club 6,000 ]  |       item tiles 175 x 64, 2 columns, scroll down
| [Bell 6,000       ][Tusker 7,000]  |       about 12 tiles visible
| [Guinness 7,000   ][Castle 7,000]  |
| [Heineken 8,000   ][Savanna 9,000] |
| ...                                |
|------------------------------------|
| Mixer?  [Coke] [Soda] [Tonic] [x]  |  48   only after a spirit is added, then goes away
|------------------------------------|
| 3 items . 24,000       [ Send 3 ]  |  72   pinned. Left part opens the order as a bottom sheet
+------------------------------------+

Whisky group on the phone: full-width rows instead of tiles
| JW Black            [Tot] [Dbl] [Btl]  |   each measure button 64 x 48
| Jameson             [Tot] [Dbl] [Btl]  |

TABLET / TERMINAL 1280 x 800
+----------------------------------------------------------------+---------------------------+
| < Floor   Table 12 . 4 guests . Sarah . 0:42   [ Search .... ] | ORDER  Table 12        :  |  56
| Popular | Offers of the day | Food | Drinks                    |---------------------------|  56
| [Soft][Beer*][Wine][Cider][Whisky][Gin][Vodka][Rum][Tequila].. | NOT SENT                  |  56 shelf, one row,
|----------------------------------------------------------------|  2 Nile Special   12,000  |     wraps to two
| [Nile Special] [Club      ] [Bell     ] [Tusker   ] [Guinness] |  1 JW Black dbl   15,000  |
| [Castle      ] [Heineken  ] [Savanna  ] [Smirnoff ] [Tusker L] |     + Coke         3,000  |
| [ ...        ]                                                 | SENT 19:42                |
|   item tiles 168 x 88, 5 columns x 6 rows = 30 on screen,      |  1 Goat muchomo   25,000  |
|   scroll down for more                                         |                           |
|                                                                | Total            55,000   |
|                                                                | [Print bill]  [Pay]       |
|                                                                | [ Send to kitchen (3) ]   |
+----------------------------------------------------------------+---------------------------+
   menu area 920 wide (72 percent)                                 order panel 360 wide

LAPTOP 1440 x 900
+--------------------------------------------------------------------------+---------------------------+
| < Floor   Table 12 . 4 guests . Sarah . 0:42          [ Search ....... ] | ORDER  Table 12        :  |
| Popular | Offers of the day | Food | Drinks                              |  lines, as above          |
| [Soft][Beer*][Wine][Cider][Whisky][Gin][Vodka][Rum][Tequila][Cocktails]  |                           |
|--------------------------------------------------------------------------|                           |
|   item tiles 158 x 88, 6 columns x 7 rows = 42 on screen                 | Total                     |
|                                                                          | [Print bill] [Pay]        |
|                                                                          | [ Send to kitchen (3) ]   |
+--------------------------------------------------------------------------+---------------------------+
   menu area 1040 wide                                                       order panel 400 wide
   A supervisor or manager sees the same frame; their extra actions are in the ":" sheet (10c).
```

Taps, Option B:

- Beer: Drinks -> Beer -> Nile Special = **3**. From Popular = **1**. On a bar device that reopens on Drinks > Beer = **1**.
- Double whisky with mixer: Drinks -> Whisky -> [Dbl] on JW Black -> Coke = **4**. From Popular = **2** ([Dbl], Coke).
- Then one more for Send.
- Moving from Beer to Whisky inside one order: Whisky = 1 before the item.

A round of four different things (beer, double whisky and Coke, a soda, a grill), counted from the open table on the Popular tab, with none of the four on Popular:

| | Option A | Option B |
|---|---|---|
| Tab taps | 2 (Drinks, Food) | 2 (Drinks, Food) |
| Group taps | 4 (Beer, Whisky, Soft, Grills) | 4 |
| Back taps | 2 (out of Beer, out of Whisky) | 0 |
| Item taps | 5 (four items and the mixer) | 5 |
| Send | 1 | 1 |
| Total | 14 | 12 |

The gap grows by one tap for every extra group visited inside the same tab.

#### Recommendation: Option B, the fixed shelf

1. **Fewer taps on real orders.** A table order crosses groups; B never needs a back tap (12 against 14 above, and the gap widens with each extra group).
2. **A new waiter sees the whole menu shape at once.** Nothing is behind a tile. Recognition, not memory. The only independent test found category-first, top-to-bottom layouts faster and with fewer presses [V S17].
3. **One model on every device.** Tabs, shelf, items, order. The phone folds the shelf and puts the order in a bottom sheet; the terminal shows the order at the right. Option A wastes a terminal: a 920-pixel area holding eleven tiles.
4. **It fits the house rules as written.** No left sidebar (the order panel is on the right and is content, not navigation). Nothing scrolls sideways (the shelf wraps). One filled button. The shelf is navigation, not filter chips, and it is drawn as a wrapped block of buttons so it cannot turn into a sideways chip row.
5. **It is what the best-documented terminals already do** with categories across the top and items below [V S2, S7, S19], minus the quadrant squeeze.

Cost to accept: on a phone the shelf takes up to 104 px. It folds to one line ("Drinks > Beer") once the waiter scrolls the items, the way Toast Go folds its header [V S2].

### 10c. Role-specific actions on the same table

Recommendation [P]: **same screen, three states for every action: live, needs approval, or not there.**

- **Live**: the role has the right. Plain button.
- **Needs approval**: the role may ask for it. The button is visible with a small lock and the words "Supervisor PIN". Tapping it asks for a reason, then a PIN pad rises from the bottom; a supervisor types their PIN on the same device; the action is logged with both names, the reason and the time. No walking to another terminal.
- **Not there**: the action has nothing to do with the role (back office, reopening a closed day). Hidden.

Never grey a button without saying why. A new waiter must be able to see that a void is possible and who can do it.

Where the actions live:

- **Order panel, always**: Send, Print bill, Pay.
- **":" on the header, "Table actions" sheet**: Split bill, Move table, Merge tables, Change waiter, Discount on bill, Reprint, Void whole order, Guests.
- **Tap on an order line, "Line actions" sheet**: Quantity, Repeat, Note, Seat, Course, Hold, Discount on line, Void line.

Starting matrix (to be confirmed by the owner; he said "you will see how we'll give these permissions"):

| Action | Waiter / bartender | Cashier | Supervisor | Manager |
|---|---|---|---|---|
| Add, note, repeat, send, hold | Live | Live | Live | Live |
| Remove a line not yet sent | Live | Live | Live | Live |
| Void a sent line | Needs approval | Needs approval | Live, reason required | Live, reason required |
| Print bill | Live (owner: "Even a waiter can print a bill") | Live | Live | Live |
| Reprint bill | Needs approval after the first print | Live | Live | Live |
| Take payment | Venue setting | Live | Live | Live |
| Split bill (seat, item, amount) | Needs approval | Live | Live | Live |
| Discount | Needs approval | Needs approval | Live within a limit | Live |
| Move table / merge | Needs approval | Needs approval | Live | Live |
| Change waiter | Not there | Not there | Live | Live |
| Open another waiter's table | View only | Live for bill and payment | Live, with a "this is Sarah's table" line | Live |
| Reopen a paid bill | Not there | Needs approval | Needs approval | Live |
| Mark item unavailable | Not there | Not there | Live | Live |
| Back office | Not there | Not there | Not there | Link in the header |

What each role lands on when tapping the same occupied table [P]:

- Waiter and bartender: menu showing, order beside it or behind the bar.
- Cashier: same screen with the order opened (on a phone the bottom sheet is already up), filled button "Take payment". Table -> Take payment -> Cash is three taps.
- Supervisor and manager: as the waiter, plus the live actions above.

Basis: rights on the job rather than on the screen [V S24]; a confirmation line when a lead touches someone else's check [V S20]; ownership moves when a table is picked up [V S21]. The lock-and-PIN presentation is our own choice because no vendor documents theirs in public (6.2).

### 10d. Mechanisms rejected for this audience

| Rejected | Seen in | Why |
|---|---|---|
| Order panel or pane that opens over part of the floor | Toast with the Table Details pane on [V S3] | Owner's rule. An extra tap ("Update") before ordering. |
| Menu in a quarter of the screen with a drawing of the table | TouchBistro [V S7] | The drawing takes space the menu needs; pretty, slow. |
| Seat first, then item, as the required order | TouchBistro [V S7] | Bars and shared platters in Kampala are table-wide. Seats stay optional. |
| Forced guest-count box on every table | Square, Foodics [V S4, S18] | One more stop before the first item; staff type anything to get past it. |
| Dense key pages built by each site, with paging arrows | Aloha [V S17], Simphony [PK] | Needs training; the tested alternative was faster. |
| Item numbers / PLU look-up as a main route | Simphony "Number Look Up" [V S5] | Nobody new knows the numbers. Name search replaces it. |
| Long press as the only way to reach table functions | Simphony dining room [V S21], Toast move check [V S3] | Invisible. A new waiter never finds it. Use a visible ":" button. |
| Build the sale, then attach a table | Loyverse [V S14] | Ticket-first; the floor cannot show what a table holds. |
| Two send buttons ("Send" and "Stay") | Toast [V S2] | A choice on every order. One Send; whether it returns to the floor is a setting per role. |
| A number pad always on screen | Lightspeed K, Odoo [V S19; PK] | Takes a fifth of the screen for a rare action. Quantity lives on the line. |
| Hand-built pages of quick keys | Loyverse, Square [V S13; PK] | Someone must maintain them. The Popular tab builds itself from sales. |
| Pictures on item tiles | TouchBistro picture grid [V S7] | Fewer items per screen, slow on a weak network, no help for names staff already say out loud. |
| Sideways-scrolling category row | Common in phone POS [PK] | House rule; hides groups off-screen. |
| Greyed buttons with no reason | Common [PK] | Leaves staff guessing. Use the lock and the words. |

### 10e. Twelve small features to steal, ranked

| # | Feature | From | Why it matters here |
|---|---|---|---|
| 1 | Recently picked items shown right under the search bar | Toast [V S10] | The second round is one tap. Basis for the Popular tab. |
| 2 | Floor tile shows guests, time open, total, waiter initials in the waiter's colour | Toast [V S3] | Supervisor reads the room without opening tables. |
| 3 | Search shows unavailable items in grey, with where they live in the menu | Toast [V S10] | The waiter can say "finished" at the table instead of hunting. |
| 4 | Sending part of an order holds the rest automatically; sent lines show "Sent 19:42" | Toast [V S2, S20] | Starters now, mains later, with no course setup. |
| 5 | Warning when a device has orders that have not reached the kitchen; named offline mode | Simphony [V S5 titles] | Poor network: the waiter must know before walking away. |
| 6 | Moving a bill onto a table that has one asks "merge or keep separate" | Toast [V S3] | Merge and move become one flow. |
| 7 | "Shared for the table" as the default bucket, seats only if wanted | TouchBistro [V S7] | Matches how Kampala tables order. |
| 8 | Identical lines merge into one with a count; a tap on the line gives quantity, repeat, note, delete | Toast [V S2, S20] | Short order list on a phone. |
| 9 | Picking up a table moves ownership to the person who picked it up, on the record | Simphony [V S21] | Shift change and "whose table is this" disputes. |
| 10 | A prompt before a lead edits another person's bill | Toast [V S20] | Keeps supervisors from changing the wrong table. |
| 11 | Mark an item finished from the POS with its own right; count left | Toast Quick Edit, rights 5.1 and 5.2 [V S2, S24] | The supervisor does it on the floor, not in the back office. |
| 12 | Right-hand mode per staff member (menu and order swap sides) | TouchBistro [V S12] | Cheap; shared terminals with left-handed staff. |

Next in line: order-wide notes and allergy flags that print on every docket (Lightspeed K [V S19]); hold for a set time (Simphony [V S5 title]); cart sorted by seat, course or time with "make default" (Square [V S4]); auto sign-out after Send on shared terminals (Toast "Auto switch user" [V S20]); the bill total split into food and alcohol (TouchBistro [V S12]).

---

## 11. Method and limits

### 11.1 What I did

36 tool calls: 12 searches and 24 page reads. This is over the "about 25" target; I went on because the reading tool returned thin summaries and each product needed a second page. 22 of the 24 reads returned usable content.

Search tool results gave titles and links only, never text, so nothing in this report rests on a search snippet except where marked [2H].

### 11.2 Sources opened (all read 26 Nov 2026)

| ID | Page | URL |
|---|---|---|
| S1 | Oracle Simphony POS User Guide, Beginning and Closing a Check | https://docs.oracle.com/en/industries/food-beverage/simphony/sipou/t_checks_begin_close_check.htm |
| S2 | Toast, Manage Orders With Toast POS | https://support.toasttab.com/en/article/New-POS-Experience-Ordering-Screens |
| S3 | Toast, Manage Tables With Toast POS | https://support.toasttab.com/en/article/New-POS-Managing-Tables |
| S4 | Square, Take orders at point of sale with Square for Restaurants | https://squareup.com/help/article/8151-take-orders-at-point-of-sale-with-square-for-restaurants |
| S5 | Oracle Simphony 19.7 POS User Guide, table of contents | https://docs.oracle.com/en/industries/food-beverage/simphony/19.7/sipou/toc.htm |
| S6 | Oracle Simphony 19.7, Adding Menu Items Using Screen Look Up | https://docs.oracle.com/en/industries/food-beverage/simphony/19.7/sipou/t_menu_items_using_slu.htm |
| S7 | TouchBistro, Taking Orders | https://cdn.touchbistro.com/help/articles/taking-orders |
| S8 | Odoo 18 documentation, Restaurant features | https://www.odoo.com/documentation/18.0/applications/sales/point_of_sale/restaurant.html |
| S9 | Lightspeed K-Series, Understanding the Order management screen | https://k-series-support.lightspeedhq.com/hc/en-us/articles/360050328594 |
| S10 | Toast, Menu Item Search | https://support.toasttab.com/en/article/Menu-Item-Search |
| S11 | Toast, Use Toast Go 3 Handheld at the Bar or Pub | https://support.toasttab.com/en/article/Optimising-Your-Bar-Workflow-Using-Toast-Flex-and-TG3-Together |
| S12 | TouchBistro, The Register Screen | https://cdn.touchbistro.com/help/articles/the-register-screen |
| S13 | Loyverse, How to Arrange Sale Screen | https://help.loyverse.com/help/how-arrange-sale-screen-loyverse |
| S14 | Loyverse, How to use predefined open tickets | https://help.loyverse.com/help/how-use-predefined-open-tickets |
| S15 | Pesapal Uganda, restaurants sector page (sales page) | https://www.pesapal.com/ug/business/sector/restaurants |
| S16 | Square University, Square Terminal table maps and coursing (title and summary line only; the content is a video) | https://squareup.com/us/en/square-university/restaurants/square-terminal-table-maps-coursing |
| S17 | Arizona State University repository, Wang 2016, record and abstract | https://keep.lib.asu.edu/items/141019/metadata |
| S18 | Foodics, How to start a Table order on Foodics Black Cashier | https://help.foodics.com/hc/en-us/articles/21580774902556-How-to-start-a-Table-order-on-Foodics-Black-Cashier |
| S19 | Lightspeed K-Series, Understanding the Register screen | https://k-series-support.lightspeedhq.com/hc/articles/360050328394 |
| S20 | Toast platform guide, UI options settings | https://doc.toasttab.com/doc/platformguide/adminUiOptionsReference.html |
| S21 | Oracle Simphony 19.7, Enhanced Table Status and Functions | https://docs.oracle.com/en/industries/food-beverage/simphony/19.7/sipou/c_tms_table_status.htm |
| S24 | Toast, Permissions Reference Guide | https://support.toasttab.com/en/article/Access-Permissions-Reference |

Opened but empty or wrong page (S22, S23, not cited anywhere): the Wang 2016 PDF (https://keep.lib.asu.edu/system/files/c265/WangC_201605_HSE_RestaurantPOSInterfacesMenuOrganizationEfficiency.pdf, returned no text); iCHEF ordering page (https://support.ichefpos.com/user-interface-ordering-page/?lang=en, returned the support home page).

### 11.3 Seen in search results only [2H]

Uzapoint and SimbaPOS (titles of comparison blog posts on dev.to and hashnode); Clover Dining (sales pages listed, none opened); Toast "Limit POS Permissions to the Clocked-in Job" (title); NielsenIQ 2010 POS interface measures; IBM retail POS benchmark PDF; the 1995 five-device comparison; Medium "16 UX factors of the point of sale".

### 11.4 Products not reached

Revel, Clover Dining, NCR Aloha (only through the ASU abstract), SpotOn, iiko, r_keeper, Lightspeed L-Series, Uzapoint, SimbaPOS, Vuga POS, GAAP POS, PilotPOS, iCHEF. Rows for these in section 1 are memory only.

Thinly reached: Square for Restaurants (one article; its layout is [PK]); Odoo (overview page; its layout is [PK]); Foodics (table start only); Pesapal (sales page; no ordering UI described).

### 11.5 Things to hold loosely

- Every ASCII frame in section 3 is redrawn from words. Positions marked [PK] may be wrong.
- No tile size, grid count or font size is verified for any product.
- All tap counts in 4.2 are worked out from structure, not performed.
- The reading tool summarises pages with a small model. One line looked garbled: TouchBistro's register page was reported as saying coursing "is typically not done through the POS" [V S12, low confidence].
- How a missing right is shown (hidden, grey, prompt) is unverified for every product (6.2).
- How any product handles tot / double / bottle is unverified (section 5).
- Which of these products are really in use in Kampala venues, beyond Simphony through Pesapal [V S15], is unverified.

### 11.6 What the Simphony first-hand scan must confirm

1. **Table tap.** What a plain tap on a table does versus a long press. Is guest count asked. Taps from sign-in to the first item on a new table, and on an occupied one.
2. **Is the dining-room screen joined to ordering**, or does the server use "Begin Check by Table" with a typed table number. Oracle's text warns against beginning a check from the table pop-up [V S21].
3. **Page layout, measured.** Share of the screen given to the check area. Key grid columns and rows. Key size in pixels. Paging arrows or scrolling. How many keys per page.
4. **Menu depth.** How Spirits > Whisky is laid out. How many items sit behind one look-up key.
5. **Measure.** How tot, double and bottle are chosen: menu levels, condiments, or separate items. How a mixer is attached. Count the taps for the two test cases and time them.
6. **Search.** Is there any search by name, or number look-up only. The user guide has no search topic [V S5].
7. **Rights on screen.** Sign in as a server and as a manager on the same table; screenshot both. Which keys are missing, which are present but prompt. The exact wording of the authorisation prompt; PIN, card or both; whether a reason is required for a void.
8. **Bill.** Which key prints the guest check, who can, how reprints are limited, whether the table changes look after printing.
9. **Hold, fire, courses.** How many taps to hold mains and fire them later.
10. **Transfer and pickup.** What the second server sees; what the record shows.
11. **Offline.** What appears when the network drops; what the "unsent checks" warning says [V S5 titles].
12. **Unavailable items.** How an item is marked finished and how it looks on the key.
13. **Handheld or tablet client**, if the site has one: how the check and the menu share the screen.
