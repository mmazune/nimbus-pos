# A1 — The owner's vision and lifecycles, recovered from the documents

Scope: read-only document audit of `/home/claude/pos-scan/repo` (snapshot, no git history), the project docs attached to the "Nimbus POS" Project, and the earlier owner/architect conversation. Not covered: auditing code (other agents), outside benchmarks.

Marking: **[V]** = I read it, `file:line`. **UNKNOWN** = not found in any document. Where I say "schema check" I ran one grep on `packages/db/prisma/schema.prisma` only to test a document's claim; that is not a code audit.

Paths are relative to the repo root unless they start with `conversation:` or `project:`.
Abbreviations: ROADMAP = `ROADMAP.md`; DEC = `docs/DECISIONS.md`; RJ = `docs/ROLE_JOURNEYS.md`; RCM = `docs/ROLE_CAPABILITY_MATRIX.md`; KL = `docs/KNOWN_LIMITATIONS.md`; WLC = `docs/waiter-ui-docs/WAITER_LIFECYCLE.md` (current, canonical 2026-08-20); WLC-v1 = `Front End/waiter-ui-docs/waiter-ui-docs/WAITER_LIFECYCLE.md` (pre-build draft 2026-06-16, 1,065 lines); CLC = `docs/cashier-ui-docs/CASHIER_LIFECYCLE.md`; ARCH = `docs/ARCHITECTURE.md`.

## 0. How I handled the conversation file (limits)

The JSONL (441 lines) holds only 29 user-role entries that are not tool results. Almost all are pasted agent completion reports or skill text. The owner's own words survive in exactly three places:

1. `conversation:L1` (2026-08-21T19:34Z): a compaction summary that lists the owner's requests (paraphrase, with a few verbatim quotes). The raw August messages are not in the file.
2. `conversation:L81` (2026-08-22T16:34Z), verbatim: "i see somthing anpput me runnong something myself in terminal cahnge that i want a prompt to do evrthing".
3. `conversation:L370` (2026-11-25T23:58Z): the long dictated brief that started this audit. All quotes dated "25 Nov" below come from it. It is dictated speech; "table 5.2" at the start is likely a transcription slip, and "Microsoft Symphony" means Oracle Micros Simphony (the repo never mentions it; see section 12).

The Project docs (`project:claude/*`) carry the owner decisions of 20-23 Aug and the event pivot of 21 Nov.

---

## 1. THE ONE THING

There is no sentence in the docs that is explicitly labelled "the one thing". The closest statements of purpose, strongest first:

- "Nimbus POS exists to give owners back a sense of control over that chaos." [V] `docs/BRAND_IDENTITY.md:43-44` (rationale for the steering-wheel logomark; essence "control, confidence, calm, and stability" at `docs/BRAND_IDENTITY.md:20`; repeated at `PRODUCT.md:21`).
- "Nimbus POS is a full-depth hospitality operations platform. It connects table service, orders, kitchen and bar dispatch, inventory, reservations, workforce, accounting, reporting, franchise operations, and commercial administration while preserving strict role boundaries and auditable operational truth." [V] `PRODUCT.md:13`.
- "The waiter is often standing, working under time pressure, and needs to move from table context to accurate order entry with minimal steps and low error risk." [V] `PRODUCT.md:9`.
- Design principle 1: "Keep the operator in context and make the next valid action obvious." [V] `PRODUCT.md:29`. Principle 4: "Reduce steps for common actions while keeping consequential actions deliberate." [V] `PRODUCT.md:32`.
- "The whole system is centered around the tables" (owner, 25 Nov, `conversation:L370`). The docs say the same in structure: "Table-centric" (`docs/ROLE_JOURNEYS.md:41`), "Rationale: table-centric workflow; avoid a parallel order-list surface" (`docs/DECISIONS.md:258-262`).
- The owner's distinctive claim in the README is "True COGS from Recipes, Not Estimates" [V] `README.md:30`.

My reading, for the redesign: the docs hold two "ones". The brand one is control. The product one is table to order to kitchen to bill to payment with true cost of goods. Neither is written as one sentence for the whole product. Writing that sentence is an open task, not something I may infer.

---

## 2. LIFECYCLE BY ROLE (as the documents intended it)

Nav, per role, locked: Waiter Floor · Reservations · Me; Cashier Floor · Till · Me; Supervisor Floor · Reservations · Approvals · Me; Manager top bar Overview · Operations · Staff · Reports · (Accounting) · Settings · Me. [V] `docs/DECISIONS.md:241-257`. Frontline roles keep the bottom nav [V] `docs/DECISIONS.md:166`.

**Only four roles have any front end.** The login page opens waiter, cashier, supervisor and manager only; owner and accountant "can authenticate" but get no workspace [V] `docs/DECISIONS.md:309-312`. The page folder contains no kitchen, bar, stock, accountant or owner route (directory listing of `apps/web/src/pages`).

### 2.1 Waiter

Sources: `docs/waiter-ui-docs/WAITER_LIFECYCLE.md` (current) and `Front End/.../WAITER_LIFECYCLE.md` (intent).

1. Login: Quick PIN is primary (6 or 8 digits, exactly), email+password is fallback; branch must be known before the PIN; the branch is remembered so the next shift is one PIN entry. [V] WLC:26-42.
2. Shift check. Reading Floor/Reservations/Me works off shift; every service write needs the waiter's own open shift. Banner states: loading, **Off shift** ("Service actions are unavailable."), **Shift issue** ("Shift review needed. Open Me for details."), **On shift** + shift number. [V] WLC:63-80. Intent text: "Shift not started — service actions disabled." [V] `Front End/.../waiter_design.md:609`.
3. Land on Floor. No dashboard. [V] `Front End/.../waiter_design.md:36-37`. Search by table number/name, guest name, order number; filters All / Available / Occupied / Reserved / Mine. [V] WLC-v1:246-260. (The current build removed guest names and order numbers from search and cards: `ai/WAITER_PREMIUM_MENU_ORDER_ENTRY_COMPLETION_REPORT.md:101`.)
4. Tap an Available table. The full-screen menu opens instantly; the draft order is created in the background; early item taps are queued and replayed; double-tap cannot create two orders. [V] WLC:122-128, `docs/waiter-ui-docs/README.md:63-66`, `ai/WAITER_INSTANT_TABLE_MENU_FLOW_COMPLETION_REPORT.md:10-18`. The menu is prefetched while the Floor loads. [V] WLC:90-92.
5. Browse the manager-configured taxonomy, tap a tile. Simple item adds at once; configurable item opens a full-height side sheet with quantity 1-99, serving, ordered modifier groups with Required/Optional, min/max guidance, price deltas, and an item comment. [V] `ai/WAITER_PREMIUM_MENU_ORDER_ENTRY_COMPLETION_REPORT.md:82-88`.
6. Edit before send: change quantity, remove, change modifier or note, add another item. [V] WLC-v1:330-341.
7. Send to kitchen/bar (`NEW to SENT`). The table becomes Occupied; KDS tickets are created. A refresh failure after send is a warning, not a failed send. [V] WLC:145-149, `docs/waiter-ui-docs/WAITER_LIFECYCLE.md:94-95`.
8. Tap the same (own) Occupied table again: order summary (table, order number, elapsed time, items, status, total, bill state) with Add items, edit allowed details, Request bill, receipt. [V] WLC-v1:416-439. **Conflict with the owner's expectation:** he says "when they press that table again, they can edit the orders" (25 Nov); the build blocks all item changes after send (see 2.1a).
9. Guest asks for the bill: **Request bill**. This writes an audit row `ORDER_BILL_REQUESTED` and changes nothing else; the order status is untouched; "the cashier picks the signal up from the audit timeline". [V] WLC:177-180. Panel states: Blocked / Not sent / Available / Requested / Receipt. [V] WLC:181-190.
10. Receipts: view; reprint and send only on CLOSED or VOIDED orders; send is permanently "PENDING - no live adapter". [V] WLC:195-205.
11. Reservations: **Seat guest** is the only reservation action a waiter has; it creates the linked dine-in order and opens it in place. Also available by tapping a Reserved table on Floor. [V] WLC:223-233.
12. Me: shift start/end, clock in/out, leave request; shift swaps read-only. [V] WLC:240-266.
13. Logout, or 15-minute idle logout. [V] WLC:285-294.

Cannot do: open another waiter's order; create/confirm/cancel reservations or take deposits; combine tables; transfer table/server; move items; split bill/items; merge; mark in-kitchen/ready; void; close or take payment. [V] WLC-v1:69-89, 889-908.

**2.1a Where the documents block what the owner now asks.**
- Post-send additions blocked: "After send, item mutation remains blocked. The current backend has no per-line sent/unsent dispatch state, so Nimbus must not resend historical lines" [V] WLC-v1:1045; also KL:252 (WKL-010), RCM:74, WLC:56.
- Serving cannot be changed on an existing line [V] KL:253 (WKL-012), WLC:160-163.
- "Even a waiter can print a bill": the docs split this in two. (a) The backend grants the Waiter `pos:receipt:read`, `:reprint`, `:send` [V] `ai/BG4_COMPLETION_REPORT.md:85-90` and `ROADMAP.md:2788-2790`. (b) The UI limits reprint to CLOSED/VOIDED orders and has no pre-payment bill print [V] WLC:195-198; `docs/cashier-ui-docs/CASHIER_ROLE_BEHAVIOUR_MATRIX.md:51` lists "Receipt print/reprint: Waiter No, Cashier Yes". So the owner's request overturns a documented UI rule and matches a documented backend grant. A pre-payment print ("pro-forma") is UNKNOWN in all docs.

### 2.2 Bartender

UNKNOWN as a lifecycle. No document describes a bartender screen or journey. Facts that exist:
1. Bartender is a Quick-PIN role (6 digits) [V] `README.md:129`, `docs/event/research/G1_backend_build_spec.md:196`.
2. Drinks route to a BAR station and a bar KDS screen; "a burger ticket goes to the grill station and a cocktail ticket goes to the bar screen simultaneously" [V] `README.md:256`. Separate kitchen/bar routing is a rule [V] `ROADMAP.md:1020`.
3. Bartender holds no accounting, HR or payroll access [V] `docs/HR_CORE_GUIDE.md:85`, `docs/PAYROLL_PAYRUNS_PAYSLIPS_GUIDE.md:84`; no receipt, split, merge or transfer grant [V] `ai/BG4_COMPLETION_REPORT.md:85-90, 336-341`.
4. Smart pour spouts are the planned bar hardware (section 11).

### 2.3 Cashier

Source: CLC (target + C3 status), `docs/cashier-ui-docs/CASHIER_ROLE_BEHAVIOUR_MATRIX.md`.
1. Login, land on `/cashier/floor`; nav Floor · Till · Me; never Queue or Receipts. [V] CLC:25-34.
2. Same shared Floor as Waiter/Supervisor; cards show no guest, payment or receipt data. [V] CLC:36-52; RJ:65-70.
3. Open a Till; cash cannot be taken without an active shift and an active till. [V] CLC:105-119, `ROADMAP.md:1119`. A cashier with no shift can start one from Me. [V] CLC:121-130.
4. Tap a table: zero payable bills shows "No bill is available for this table."; one bill opens the settlement workspace; several show an explicit selector, never a silent first pick. [V] CLC:54-83; `docs/DECISIONS.md:84-98`.
5. Bill review: lines, quantities, subtotal, tax, service charge "where supported", discounts, total, split allocations, payments, outstanding, status, bill-requested. Front-end maths is preview only. [V] CLC:85-103.
6. Payment: cash, card reference, mobile-money reference, bank, partial, split allocation or split items. One visible pending state, duplicate submit blocked, idempotency key, "never claim success before canonical success". [V] CLC:147-181, 345-346; status header CLC:3-12.
7. Close: a full cash payment is the close and is valid only on a SERVED bill; a final manual-reference payment auto-settles. [V] CLC:5-9. After close: table releases, linked SEATED reservation auto-completes, receipt context loads. [V] CLC:196-203.
8. Receipt: print, reprint, delivery, refund entry from the selected order; no standalone Receipts page; "do not fabricate printer success". [V] CLC:205-244. Planned in C4 (not started). [V] `docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md:120-133`.
9. Find bill for takeaway, tableless, reference, partially paid, failed payment, closed. [V] CLC:246-269. C5 retires Queue. [V] `docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md:135-150`.
10. Till: open, safe-drop, reconcile; paid-in/out deferred. [V] CLC:271-283; RJ:82-83.
11. Idle logout 15 min; Me has shift start/end. [V] CLC:285-294.

**Disagreements:** (a) the matrix says the Cashier only "resolves existing allocations; do not duplicate Supervisor split logic" [V] `CASHIER_ROLE_BEHAVIOUR_MATRIX.md:43`, but CLC:5-8 (C3, later) says the cashier records split allocations and splits items, and the backend grant is Owner/Manager/Cashier [V] `ROADMAP.md:2827`. (b) KL:268 says "Partial cash tender blocked" while CLC:6 and CLC:172-181 say partial payment works after C3; C3 is later, so KL is stale for that row. (c) Void: matrix row says Cashier void only "if existing Cashier refund/void contract explicitly permits; otherwise No" [V] `CASHIER_ROLE_BEHAVIOUR_MATRIX.md:45].

### 2.4 Supervisor

Source: `docs/supervisor-ui-docs/SUPERVISOR_LIFECYCLE.md`, RJ:95-182, DEC:451-591.
1. Login (Quick PIN 8 digits tier), Floor.
2. Tap any table: a read-first table-control workspace: order lines/totals, bill state, read-only payment, reservation, table context. [V] `SUPERVISOR_LIFECYCLE.md:141-151`.
3. Live actions behind the table (hidden without the permission): table status (Review/Confirm), **Request bill**, **Mark served** (READY to SERVED), **Split bill** (EQUAL/CUSTOM allocation for the cashier), **Split items**, **Move items**, **Merge orders**, **Transfer table**, **Void active order** (reason required; NEW/SENT/IN_KITCHEN/READY; SERVED can only close), **Discount request**, inline **Approve/Reject** of PENDING discounts, **Complimentary**. [V] RJ:101-176.
4. Find order control above the Floor for tableless/takeaway/closed/voided orders; no Orders tab. [V] RJ:127-137.
5. Reservations workspace: Arriving / Seated / Attention / History; create, confirm, assign table, seat, cancel, no-show, manual complete. [V] RJ:184-218.
6. Approvals: domain queues, not the generic inbox; discount and leave approve/reject, anomaly acknowledge/resolve, shift-swap reject only. [V] RJ:3-24, DEC:7-25.
7. Never: payment collection, order close, refund, post-close void, menu entry, KDS, receipt controls, transfer-server. [V] RJ:178-182, 300-306, `ROLE_CAPABILITY_MATRIX.md:142-145`.

Notable: the Supervisor holds no receipt permission, so cannot print a bill (`docs/supervisor-ui-docs/SUPERVISOR_GAP_REGISTER.md` SUP-GAP-020). The owner's list for the supervisor ("void, split bills... they live on like the table menu in some sort of way") matches 2.4 item 3 closely.

### 2.5 Manager

Source: RJ:244-298, `Front End/manager_ui_full_docs_pack/manager-ui-docs/MANAGER_APPROVAL_DECISIONS.md`.
1. Sign in; branch is resolved; land on `/manager/overview`. Branch switcher in the header drives every read through `X-Branch-Id`. [V] RJ:251-260.
2. Overview: eight KPI cards (sales on both tax bases, orders, payment mix, open orders and aging, low stock, items needing a decision, till and shift coverage, readiness); polled, not streamed. [V] RJ:264-267.
3. Operations: read-only orders, tables (same shared Floor), reservations. [V] RJ:268-274; DEC:407-417.
4. Staff, the only place Manager writes: directory, onboard frontline staff (PIN shown once, masked), Quick-PIN admin, leave review, shift-swap reject only. [V] RJ:275-285.
5. Reports (CSV only), Accounting, Settings (7 write sections, staff invitations, credential reset by token). [V] RJ:286-287; `project:claude/session-2026-08-22-manager-accounting-track.md`.
6. Idle logout 15 min. [V] RJ:292-293.

**Owner decisions that changed Manager scope (they conflict across documents):**
- 20 Aug: "No cashier-checkout clone and no waiter-order-entry clone" for Manager. [V] `MANAGER_APPROVAL_DECISIONS.md:26-30, 89-90`; RJ:295-298 ("Never in the manager journey: collecting payment, closing an order, entering menu items, driving KDS...").
- 21 Aug: "let the manager have full access to everything. ideally they are responsible for everything." [V] `conversation:L1` (owner's fourth request, summary) and `project:claude/session-2026-08-22-manager-accounting-track.md` ("Manager has full access to everything (2026-08-21)"). Compensation stays revoked. The older matrix still says Manager accounting is READ-ONLY (15 strings) [V] `docs/ROLE_CAPABILITY_MATRIX.md:14`; the 21 Aug decision overrides it.
- 25 Nov: "A manager, same thing, but does a manager really need this? ... We can give them access to this. Yeah, they do, but then they have like back of house too." (`conversation:L370`). This overturns the 20 Aug "no clone" rule and RJ:295-298 for table work.
- `CLAUDE.md` section 9 lists a seven-item Manager nav including Accounting; RJ:246 and DEC:241-257 list six. CLAUDE.md is later (B5).

### 2.6 Chef / kitchen

UNKNOWN as a screen lifecycle. The documents contain the backend contract and role limits only:
1. Chef is a Quick-PIN role (6 digits) [V] `README.md:129`.
2. KDS tickets are created when an order is sent, one per station per order; the chef marks a ticket READY; can recall; sees an urgency colour. [V] `docs/ARCHITECTURE.md:466-500`; `README.md:256-262`.
3. The chef sees recipe cost only if `showCostToChef` is on; cost fields are removed, not nulled. [V] `README.md:151, 190`; `docs/ARCHITECTURE.md:362-366`.
4. A Chef cannot split, merge, transfer or move items; cannot touch accounting, HR or payroll. [V] `ROADMAP.md:2827`; `docs/HR_CORE_GUIDE.md:85`.
5. The waiter must not see KDS station config or mark-ready controls. [V] WLC-v1:572-590.
6. A KDS screen shell is described as "fullscreen board; large tickets; urgency-first display". [V] `Front End/waiter-ui-docs/waiter-ui-docs/DESIGN.md:343-351`; M44 lists "KDS wallboard". [V] `ROADMAP.md:2417`. No KDS screen design, no chef notification design.
7. Possible block: the platform matrix says KDS_SCREEN is reachable only by L3 and above [V] `docs/ARCHITECTURE.md:128`; Chef is L2 [V] `docs/ROLE_CAPABILITY_MATRIX.md:253`. I did not check whether code still enforces this.

### 2.7 Stock / store manager

UNKNOWN as a lifecycle. Facts:
1. A STOCK_MANAGER job role exists and is a Quick-PIN (6-digit) role. [V] `README.md:133`; `docs/event/research/G1_backend_build_spec.md:196`.
2. Stock-side permissions are planned for it; it is an L3 role [V] `docs/ROLE_CAPABILITY_MATRIX.md:252-253`. It holds no receipt or order-handoff grants [V] `ai/BG4_COMPLETION_REPORT.md:85-90`.
3. Stock mechanics that the docs describe: FIFO batches; receiving; count sessions with variance; wastage; adjustments; negative stock blocked. [V] `README.md:200-226`; `ROADMAP.md:744-939`.
4. Stores or locations (main store, secondary store, sign-outs): see section 5; only a roadmap model name exists.

### 2.8 Accountant

1. Holds the full accounting/finance permission set (as Owner). [V] `docs/ROLE_CAPABILITY_MATRIX.md:10-13`.
2. Backend only. Accounting UI was built under the Manager shell "designed to be remounted" for a future Accountant role. [V] `ai/ENTERPRISE_UI_ROADMAP.md:1233` (OD-2). The login screen opens no accountant workspace. [V] DEC:309-312.
3. Cost assignment by the accountant on menu items and ingredients: UNKNOWN. What exists: recipe cost breakdown returns `totalCogs`, `margin`, `marginPct` and is visible to Manager/Owner and masked for Chef [V] `README.md:186-190`; cost snapshot per order line at add time [V] `docs/ARCHITECTURE.md:430-436`; goods receipt creates an AP vendor bill [V] `README.md:214-216`.

### 2.9 Owner

1. Owner is L5 and holds every accounting string. [V] `docs/ROLE_CAPABILITY_MATRIX.md:10, 252`.
2. B7 "Owner dashboard variant": same shell as Manager, wider scope, explicit org-vs-branch labels; not started. [V] `ai/ENTERPRISE_UI_ROADMAP.md:960-1008`; `project:claude/session-2026-08-22-manager-accounting-track.md` ("Not started: B7").
3. Real-time owner views (`GET /owner/live`) and alert channels/digests were planned at M40. [V] `ROADMAP.md:2225-2260`.
4. Quick PIN is not offered to Owner or Accountant (excluded roles). [V] `docs/event/research/G1_backend_build_spec.md:196` (excerpt of the code rule).

---

## 3. THE TABLE AS THE CENTRE

### 3.1 What the owner said (25 Nov, `conversation:L370`)

- "The whole system is centered around the tables. So when you're creating a table, you are creating something that ... touches very many things in the UI."
- "In the waiter UI, every UI says something different when they select a table."
- "When a waiter clicks a table ... a menu opens up, they place orders on that table. When they press that table again, they can edit the orders."
- "When a waiter taps a table, you should open a full screen ... all the menu buttons are very clear, big enough, well designed, easy to reach."
- "When a supervisor taps the table, what they see should reflect their permissions ... they can void ... split bills."
- "When a cashier clicks at the same table, what do they see? Printing a bill. Even a waiter can print a bill actually."
- Manager: "We can give them access to this."

### 3.2 What the documents already say about it

- One shared Floor for Waiter, Supervisor, Cashier, and Manager (read-only); "Role behaviour diverges only after table selection" (Waiter opens an order builder, Cashier a settlement workspace, Supervisor a table-control workspace, Manager a read-only summary). [V] RJ:311-315; DEC:359-368; `docs/cashier-ui-docs/CASHIER_ROLE_BEHAVIOUR_MATRIX.md:13-22`. So the owner's "each UI says something different" is by design after selection; the docs never define a shared header, shared state vocabulary or shared action names for the selected-table screen.
- Selecting a table is instant, full-screen inside the workspace frame, URL-backed `?tableId=&orderId=` with refresh/Back/Forward stable. [V] RJ:44-48; WLC:98-100; CLC:66.
- Floor cards show: abbreviated label, status badge, status-specific middle, capacity; staff as `First L.`; "Mine" badge; never a guest name; never order number or bill state. [V] `docs/UI_SYSTEM.md:498-506`; DEC:396-399; `Front End/.../waiterui.md:221`.
- Tables are created by `POST /api/tables` with `pos:table:write`; there is no UI for creating tables or floor plans in any document. [V] `ai/M5_COMPLETION_REPORT.md:63-72`. The owner's remark about "when you create a table as a manager or supervisor ... you will see how we'll give these permissions" therefore has no documented UI. The Manager Settings plan has no floor/table editor either (`docs/manager-settings-docs/MANAGER_SETTINGS_API_MATRIX.md` covers settings, devices, staff only).

### 3.3 What each role sees on selecting a table (documented)

| Table state / role | Waiter | Supervisor | Cashier | Manager |
|---|---|---|---|---|
| Available | Full-screen menu; draft created in background (WLC:101-109) | Read-first control workspace (SUPERVISOR_LIFECYCLE:141-151) | "No bill is available for this table." (CLC:56-62) | Read-only summary (RJ:313) |
| Occupied, own order | Order builder on the existing order (WLC:101-109) | Same workspace, with actions (RJ:101-176) | Bill resolution to settlement workspace (CLC:64-83) | Read-only |
| Occupied, other waiter | Blocked panel: "This table belongs to another waiter." (WLC-v1:494) | Not blocked | Not blocked | Read-only |
| Reserved | Reservation detail with Seat guest (WLC:223-233) | Reservations lifecycle (RJ:184-218) | Order-linked read only (matrix:59) | Read-only |
| Off shift (waiter) | "Explanatory disabled state" (WLC:101-109) | n/a | Payment blocked: "No active shift" (CLC:105-119) | n/a |

### 3.4 Table states: every label found

| Concept | Wordings in the documents |
|---|---|
| Backend states | AVAILABLE, OCCUPIED, RESERVED, CLEANING [V] `docs/ARCHITECTURE.md:259`, `docs/API_CONVENTIONS.md:126-131`, schema check `schema.prisma:839-844`. `README.md:159` says "AVAILABLE / OCCUPIED / RESERVED / BLOCKED" and `docs/UI_SYSTEM.md:577` says "available / occupied / reserved / blocked": **BLOCKED does not exist in the schema; CLEANING does.** |
| States the waiter may show | "Available, Occupied, Reserved only"; "Do not show Cleaning or Blocked" [V] `Front End/.../AGENTS.md:75-77` (decisions 14-15); `waiter_design.md:50-51` |
| Derived waiter state | `occupied` only when an active order is not NEW or table status is OCCUPIED; a NEW draft does not occupy a table; `reserved` from reservation overlay; `isMine` from order user [V] WLC:93-99. The old text says the table becomes Occupied when sent [V] WLC-v1:353-361; consistent. |
| Card middle text | "Ready for service" [V] `Front End/.../waiterui.md:192`; "ready / reservation time / assigned staff + Mine / temporarily unavailable" [V] `docs/UI_SYSTEM.md:500-501`; "Available: simple ready state" [V] WLC-v1:274 |
| Status colour | Available: success, calm green, no loud fill; Occupied: info/navy, stronger border if selected; Reserved: warning/amber [V] `Front End/.../waiter_design.md:310-314`. Non-colour status is also required [V] `PRODUCT.md:37` |
| Waiter tap outcome names | `start-order`, `own-order`, `ownership-blocked`, `reservation-detail`, `disabled` [V] WLC:101-109 |
| Cashier bill states | PAYABLE, PAYMENT_IN_PROGRESS, PARTIALLY_PAID, SETTLED, TERMINAL_READ_ONLY, NOT_CASHIER_SETTLEABLE, UNKNOWN_UNSAFE [V] DEC:90-92 (C2 paragraph, lines 84-93 of the decision) |
| Missing/unknown table | "Table unavailable" (not a spinner) [V] WLC:111-112; CLC; DEC (C1/C2 paragraphs) |
| Cashier selected-table copy | "Select a bill to continue." (C1) [V] RJ:75-78; `docs/UI_SYSTEM.md:489-495` |
| Order status | NEW, SENT, IN_KITCHEN, READY, SERVED, CLOSED, VOIDED [V] `README.md:235-237`; the pack draft says "NEW/OPEN depending backend terminology" [V] WLC-v1:305 |
| Bill state (waiter panel) | Blocked / Not sent / Available / Requested / Receipt [V] WLC:181-190 |
| Bill state (cashier) | "bill-requested state" [V] CLC:100 |
| Reservation | PENDING, CONFIRMED, SEATED, COMPLETED, CANCELLED, NO_SHOW; Arriving / Seated / Attention / History are UI views [V] RJ:184-218 |

### 3.5 Action wordings for the same thing

| Concept | Wordings |
|---|---|
| Send to kitchen | "Send to kitchen/bar" [V] `Front End/.../waiter_design.md:397`; toast "Order sent to kitchen/bar." [V] `waiter_design.md:591`; "Send" [V] `docs/waiter-ui-docs/README.md:71-74`; "Send order" [V] `docs/event/research/A2_frontend_audit.md:58` |
| Ask for bill | "Request bill" (waiter, supervisor), "Bill requested." toast, panel "Requested" |
| View bill | "View bill or receipt", "Open receipt if available", "receipt drawer" [V] `Front End/.../waiter_design.md:807`, `waiterui.md:289, 453` |
| Print bill | "Reprint receipt", toast "Receipt reprint requested." / "Reprinting receipt..." [V] `waiter_design.md:594`; WLC-v1:716-724. Cashier: "Print and other supported delivery actions" [V] CLC:217 |
| Mark served | "Mark served" (supervisor) [V] RJ:106-107; waiter: "mark served if waiter-safe and allowed" [V] WLC-v1:437 |
| Start order | "Start order" [V] `docs/event/research/A2_frontend_audit.md:58`; toast "Order started."; "Tap to create order" [V] `waiterui.md:196` |
| Add to occupied | "Add items" (button), "Add to existing order" (flow) |
| Lookup | Cashier "Find bill"; Supervisor "Find order" [V] RJ:79, 128 |
| Void | "Void active order" (supervisor action); "Void order" (matrix); "void sent item" (denied list) |
| Seat | "Seat guest" (waiter), "Seat" (supervisor), "Guest seated." toast |
| Table move | "Transfer table" |
| Navigation | "Back to Floor"; "Floor / Tables" |

---

## 4. MENU

### 4.1 Intended structure

- Two top sections, FOOD and DRINKS (`MenuSection` enum), then a browse group, then an optional subgroup, then items. [V] `ai/M6_1_COMPLETION_REPORT.md:11, 43`; `GET /api/menu/navigation` returns the tree [V] same file:66.
- This is separate from the internal kitchen/reporting `Category` (grouping for cost, tax, station). "Customer browse taxonomy ... is separate from internal routing/reporting categories ... never hard-codes fallback categories; empty navigation shows an honest 'manager configuration' state." [V] DEC:378-383.
- Depth is exactly section, group, subgroup. The owner's example "alcohol further subdivided into whiskeys, gins" fits as DRINKS, group "Alcohol" (or "Spirits"), subgroups "Whiskeys", "Gins". The seed has no alcohol group: DRINKS groups are Cocktails, Beer, Soft Drinks, Hot Beverages; subgroups exist only under food (Cold Starters, Hot Starters, Grills, Pasta, Pizza). [V] `ai/M6_1_COMPLETION_REPORT.md:49`. Only groups have `sortOrder`; the UI honours manager order and active flags. [V] `ai/WAITER_PREMIUM_MENU_ORDER_ENTRY_COMPLETION_REPORT.md:74`.
- Front-of-house display taxonomy examples given by the README: "Happy Hour Drinks", "Chef's Specials" [V] `README.md:168]. These are example group names, not a feature.
- Servings per item: GLASS, BOTTLE, JUG, PINT, HALF_PINT, SHOT, SINGLE, DOUBLE, CARAFE, FLIGHT, CUP, CUSTOM, each with its own price and its own COGS link. [V] `ai/M6_1_COMPLETION_REPORT.md:43`; `README.md:167`. Selling price: explicit serving > default serving > base price [V] `docs/ARCHITECTURE.md:360`. Tile shows "From" price when several servings.
- Modifiers: groups with min/max selection, defaults, option price deltas both positive and negative, Required/Optional; limits "enforced both in API and shared validation contracts". [V] `ROADMAP.md:593-622`; `ai/M7_COMPLETION_REPORT.md:12`. Seed sets: size, doneness, extras, mixers, sweetness/ice. [V] `ROADMAP.md:624-626`. Modifier cost flows into COGS (e.g. "Add bacon") [V] `README.md:171-172`. Selected modifiers persist in `metadata.selectedModifiers`, serving in `metadata.servingLabel`. [V] WLC:130-134.
- Combos: model names planned (`ComboDefinition`, `ComboSlot`) [V] `ROADMAP.md:603-610]; the README says "combo rule contracts". No combo UI or lifecycle in any document; schema check found no `ComboDefinition` model.
- Availability: per-branch enable/disable without deletion [V] `README.md:176]; never hard-delete sold items, use active/archive [V] `ROADMAP.md:570`. Inactive/unavailable items "cannot be selected". [V] `ai/WAITER_PREMIUM_MENU_ORDER_ENTRY_COMPLETION_REPORT.md:82`. Per-branch price override only after the core item exists. [V] `ROADMAP.md:571`.
- Search: "whole-menu search" in the centre column; clearing it restores the previous group/subgroup. [V] `Front End/.../waiterui.md:673-676`; `ai/WAITER_PREMIUM_MENU_ORDER_ENTRY_COMPLETION_REPORT.md:76`. Search spans all assigned active items.
- Item tiles: only name and price/"From" price; the tile is the selection target; badges, categories, descriptions, Details/Add buttons, modifier icons and imagery were deliberately removed. [V] `ai/WAITER_PREMIUM_MENU_ORDER_ENTRY_COMPLETION_REPORT.md:82`. Images: "MVP does not require food images" [V] `Front End/.../waiterui.md:340`; `PRODUCT.md:25` lists "image-heavy restaurant catalog" as an anti-reference.
- Full-screen layout: top bar Back to Floor, full table id, order state, Mine, item count, running total; left API sections + browse-group rail; centre subgroup row, search, item grid; right persistent order lines, totals, Send, bill, receipt. [V] `Front End/.../waiterui.md:668-678`; `ai/WAITER_PREMIUM_MENU_ORDER_ENTRY_COMPLETION_REPORT.md:60-70`.
- Menu is never a nav tab; it exists only inside the table workspace. [V] `Front End/.../waiter_design.md:41-42, 329`.
- Menu entry/editing by a manager: no UI is planned or built. "Never in the manager journey: ... entering menu items" [V] RJ:295-297; the Manager Settings plan has no menu section. Menu admin is API-only today.
- Tap depth today (baseline, not a goal): about 8-10 taps after login for "2 beers" in a 3-column builder. [V] `docs/event/research/A2_frontend_audit.md:58`. House rule for the redesign: everyday task 2-3 taps from role home; lookups 1-2 [V] `conversation:L383` (skill text, section 4.1).

### 4.2 Not found (owner asked for it)

- "Offers of the day" / specials of the day / happy-hour pricing / time-boxed prices: UNKNOWN as a feature in all documents. The only hits are example group names (`README.md:168`), a forecasting enum `DemandCalendarType.PROMOTION` [V] `ai/M37_REFACTOR_COMPLETION_REPORT.md:53], and a discount seed "promo %" [V] `ROADMAP.md:1074]. Schema check found no special/happy/offer fields.
- Favourites, recents, best sellers for the waiter: UNKNOWN. (Odoo "Favorites" is a saved-search idea for managers, not menu favourites [V] `ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md:87]).
- A "sold individually vs has a recipe" flag on a menu item: UNKNOWN; see section 5.

---

## 5. RECIPES, STOCK, STORES, COSTING

### 5.1 What was intended (as written)

- Menu items and stock items are separate things. [V] `ROADMAP.md:722`.
- Recipe = menu item mapped to inventory ingredients. Intended fields per ingredient: `effectiveQty`, `unitOfMeasure`, `yieldFactor`, `wasteAllowancePct`, `unitCost`, `extendedCost`, `isCritical`, `isModifierLinked`. [V] `README.md:184`. Ingredients can be tied to a specific serving or modifier option. [V] `ai/M8_COMPLETION_REPORT.md:109`.
- ROADMAP M8 required: ingredient quantities, "unit conversions, yields, prep-loss %", versioned recipes ("existing sold orders keep old cost references"), "micro-ingredients ... via tiny decimal quantities", models `Recipe`, `RecipeLine`, `RecipeVersion`, `YieldProfile`, `UnitConversion`. [V] `ROADMAP.md:645-672`.
- Recipe set is one atomic replace. [V] `README.md:192`.
- Cost: FIFO batches give each ingredient its unit cost; the COGS snapshot is written on each order line at add time, not estimated later. [V] `README.md:30, 244`; `docs/ARCHITECTURE.md:430-436`. Margin = (subtotal - cost) / subtotal. [V] same.
- Cost masking: Chef sees no cost fields unless `showCostToChef`. [V] `README.md:151, 190`.
- Stock ledger: append-only; every movement (RECEIVING, DEDUCTION, WASTAGE, MANUAL, COUNT) is a row; oldest batch first; negative stock blocked and audited as `NEGATIVE_STOCK_ATTEMPT`. [V] `README.md:200-206`; `docs/API_CONVENTIONS.md:223`; `ROADMAP.md:767-770, 916-919`.
- Reorder point, par level, preferred supplier on each stock item; the procurement advisory reads them. [V] `README.md:204`.
- Purchasing intended: suppliers, PO workflow DRAFT to SUBMITTED to APPROVED to PARTIALLY_RECEIVED/RECEIVED/CANCELLED, approval thresholds; goods receipt creates batches and ledger entries atomically, supports partial receipt, landed cost, over-receipt tolerance needing approval. [V] `ROADMAP.md:791-889`.
- Counts and wastage intended: cycle counts, shift-close counts, wastage reasons, variance preserving before/after evidence, manager overrides. [V] `ROADMAP.md:890-939`. "Close requires cash reconciliation and may depend on stock count completion." [V] `ROADMAP.md:1120`.
- Accounting hooks: POS close (revenue, tax, COGS), goods receipt (inventory/AP), wastage (expense). [V] `ROADMAP.md:224-237`.
- Inventory seed was meant to come from the owner's "uploaded stock workbook" with "warehouse/bar/kitchen locations". [V] `ROADMAP.md:693-697, 727`.

### 5.2 Deduction on sale (the owner's headline ask)

- The owner (25 Nov): "when I place an order, it deducts even items from the inventory"; a burger "uses a bun ... 200 gram ... beef ... how it's measured. If it's a bun, it's a piece. Some things are measured in pieces, others in weight."; "an accountant can see the very same menu items and assign cost on the actual item and then the ingredients, so that we get the true cost of goods."
- Documents on deduction: deduction on order was always deferred. The order module explicitly excluded "stock deduction on order (M13)" [V] `docs/ARCHITECTURE.md:440`; the stock module says its FIFO routine "will be reused by order-close deduction in M10+" [V] `ai/M9_COMPLETION_REPORT.md:83`, `ai/M9_COMPLETION_REPORT.md:78`; the payments report lists "Stock deduction on payment — Not yet integrated with M9 inventory" [V] `ai/M13_COMPLETION_REPORT.md:132`. **No document says it was ever wired.** A grep of `apps/api/src` finds the deduct routine called only by stock adjustments (`inventory.service.ts:226`). This is a code fact I note only to test the documents' claim.
- When to deduct (at add, send, or close): the docs name "order-close" (M9 report) and the owner says "when I place an order". UNKNOWN which; an owner decision is needed.
- Training mode is already honoured by stock adjustments (simulated responses). [V] `README.md:226`.

### 5.3 Units: piece versus weight

- Documents say units and conversions were intended (ROADMAP:645-660; README:184). What exists in the schema is a free-text `unit` string on both inventory items and recipe lines; schema check found no `UnitConversion`, `YieldProfile` or `RecipeVersion` model, and the recipe line has `wastePct` only (the README's `yieldFactor`, `isCritical` do not appear). This is a doc-vs-schema disagreement, flagged not audited.
- Piece vs weight semantics (bun = pieces; beef = grams) and what a bottle item does (a drink sold whole with one stock item): UNKNOWN in all documents.
- Quantity type: tiny decimal quantities (`Decimal(10,3)`) for micro-ingredients. [V] `ai/M9_COMPLETION_REPORT.md:48`; `ROADMAP.md:671`.

### 5.4 Stores and locations

- The owner (25 Nov): two stores, "the major one, the secondary one"; "a store that's closer to the back of office, where things are taken"; "how do different people sign out for different things? ... a chef is picking some meat ... how is he notified in his UI?"; a UI for the store manager; "how do we add a store so that things are subtracted from that store?". He says he saw this in Micros Simphony and will benchmark it later.
- Documents: only `InventoryLocation` appears, as a planned M9 model and "warehouse/bar/kitchen locations" in the seed note. [V] `ROADMAP.md:711, 727]. The M9 report says "Multi-warehouse / inter-branch transfers (future)". [V] `ai/M9_COMPLETION_REPORT.md:86`. Schema check: no `InventoryLocation` model. The only transfer feature built is **inter-branch** stock/equipment transfer (REQUESTED to APPROVED/REJECTED/CANCELLED to IN_TRANSIT to COMPLETED) for HQ. [V] `README.md:644`. It is not an inside-the-branch store-to-kitchen issue.
- Requisitions, sign-outs, issue notes, chef notification: UNKNOWN in every document. The Odoo reference lists "Purchase Requisitions" as an Odoo app [V] `ai/ODOO_REFERENCE_RESEARCH.md:22]; it was never taken into the gap list for stock.
- A store keeper/stock manager UI: UNKNOWN (see 2.7).

### 5.5 Costing details

- Accountant "assigns cost": see 2.8; UNKNOWN as a screen.
- `MENU_ENGINEERING` report is "CONDITIONAL" with no route; its note: M8 recipe-cost data quality. [V] KL:425.
- Procurement advisory suggestions exist (`finance/procurement-suggestions`); one permission string guards both read and review-write (PC-02), so Manager is denied. [V] `docs/ROLE_CAPABILITY_MATRIX.md:17-20`.

### 5.6 Planned for "later" in this area

- Multi-warehouse / inter-branch transfers (M9 report:86).
- Order-close stock deduction (M9 report:83) which the owner now wants at order time.
- Purchasing and stock counts are listed "Planned" in the stale module map [V] `docs/MODULES.md:22-23`; the README describes them as built (`README.md:214-226`). Schema check found no `PurchaseOrder`, `GoodsReceipt`, `StockCount` or `Wastage` model, only `Supplier` (AP), `StockBatch`, `StockAdjustment`. **Documents disagree** (ROADMAP + README claim them; MODULES.md says planned; schema agrees with MODULES.md).

---

## 6. KITCHEN AND BAR

### 6.1 Intended

- Tickets appear only when an order is sent, not when it is drafted. [V] `ROADMAP.md:1019`.
- Kitchen and bar have separate routing paths; demo stations: grill, fryer, salad, dessert, bar. [V] `ROADMAP.md:1020, 1024`. Built stations differ: KITCHEN, BAR, COLD_KITCHEN, DESSERT, NONE (schema `PrepStation`, and `ai/M6_COMPLETION_REPORT.md:49`); the README says KITCHEN, BAR, COLD_PREP, PASTRY [V] `README.md:256`. Three documents, three station lists.
- One ticket per station per order; items with station NONE create no ticket. [V] `docs/ARCHITECTURE.md:472`; `ai/M11_COMPLETION_REPORT.md:65`.
- Ticket states QUEUED, READY, RECALLED. [V] `ai/M11_COMPLETION_REPORT.md:43`. ROADMAP wanted `start` and `ready` ("bump/ready flow"). [V] `ROADMAP.md:995, 1013-1014]. "Bump" as a word appears only there; recall is the built reverse action.
- SLA timers: per station thresholds, default 300 / 600 / 900 seconds; GREEN, AMBER, RED; queue sorted RED first then AMBER then GREEN, oldest first; computed at query time with no ticker. [V] `docs/ARCHITECTURE.md:474, 490-498`; `ai/M11_COMPLETION_REPORT.md:96`.
- Notification: SSE stream `GET /api/stream/kds` with events NEW_TICKET, TICKET_READY, TICKET_RECALLED, filtered by branch and optional station. [V] `docs/ARCHITECTURE.md:502`. It is in-process and not suited to scale-out. [V] `ai/M11_COMPLETION_REPORT.md:102`. The web client has no SSE consumer yet ("SSE auth blocks live dashboard streaming"). [V] `project:claude/session-2026-08-22-manager-accounting-track.md`.
- Split/merge: source tickets are marked SUPERSEDED; destination needs an explicit `/send` ("no ghost tickets"). [V] `ROADMAP.md:2823`; `README.md:350`. Split-items creates a NEW child with no KDS dispatch. [V] KL:266.
- KDS shell: "fullscreen board; large tickets; urgency-first display". [V] `Front End/.../DESIGN.md:343-351`.
- KDS device registration through the device registry. [V] `README.md:258-262, 742`. Printer routing for RECEIPT, KITCHEN, BAR routes; no print engine. [V] `README.md:744`; KL:250.
- Kitchen staff see no costs when masked.

### 6.2 Not found

- Course firing (hold/fire courses): only the phrase "course/station routing metadata" in M14 scope [V] `ROADMAP.md:944]. UNKNOWN beyond that.
- A bump bar, a recall wall, "expo" station, tickets for voided lines, sound alerts, who is notified when a ticket is READY (waiter?): UNKNOWN. The waiter lifecycle says the waiter sees "service status only" after send. [V] WLC-v1:573-582.
- How an order moves to IN_KITCHEN and READY after the chef marks a ticket READY: not stated. The waiter is told kitchen progression "is driven by KDS" [V] WLC:281-283; the KDS docs describe ticket status only. UNKNOWN whether ticket-ready advances the order.
- Chef or bartender notification of a store issue: UNKNOWN.

---

## 7. BILLS AND RECEIPTS

### 7.1 Print bill / receipt

- A receipt is a composed view, not a stored document; receipt id equals order id; footer from `OrgSettings.receiptFooter` read at view time. [V] `README.md:325, 333`; WLC:191-193.
- View, history, reprint (reason optional, copies 1-10, idempotent, audited `RECEIPT_REPRINTED`), send (always 202 PENDING). Reprint and send only for CLOSED/VOIDED. [V] `ROADMAP.md:2780-2787`; WLC:195-205.
- Roles: receipt read/reprint/send for Owner, Manager, Cashier, Waiter. Chef denied. Supervisor has none. [V] `ROADMAP.md:2788-2790`; SUP-GAP-020.
- Printer: metadata only, no driver; "do not fabricate printer success"; "No print-driver completion is guaranteed". [V] KL:250; CLC:217-218; WLC:204-205.
- **Pro-forma / pre-payment bill print:** UNKNOWN in every document. The owner's "printing a bill" for the cashier and "even a waiter can print a bill" (25 Nov) is therefore a new requirement.
- **Request bill** is a signal only (see 2.1 step 9). It is not delivered to the cashier as a live notification in any documented surface. RJ:105-106 says the Supervisor's request "notifies the cashier"; WLC:179-180 says the cashier "picks it up from the audit timeline". Documents disagree on the mechanism; the cashier UI has no bill-requested indicator documented beyond "bill-requested state" in the bill review (CLC:100).

### 7.2 Split, merge, transfer

- Six endpoints: split-bill (N equal shares), split-items (new child order), merge, transfer-table, transfer-server, move-items. Lineage in `Order.splitFromOrderId` / `mergedIntoOrderId`. Permissions `pos:order:split|merge|transfer|move-items` for Owner/Manager/Cashier; Chef denied. [V] `ROADMAP.md:2806-2830`. The Supervisor was later granted them by seed. [V] DEC:476-493 (D-SUP-3B1).
- Merge voids the source into the surviving target. [V] RJ:119-121. Transfer-table only sets `tableId` (no occupancy or capacity check, no status change). [V] RJ:128-130. Transfer-server exists in the API but has no UI (no safe server selector). [V] RJ:178-182.
- "Split bill" is a non-physical allocation (metadata) that the cashier settles. [V] RJ:116-118; KL:265. Combine/uncombine tables: `TableMergeRule` is in the M5 model list [V] `ROADMAP.md:507]; "Not built in MVP" [V] WLC-v1:907; schema check found no such model.

### 7.3 Discounts, voids, comps, refunds

- Discount types PERCENTAGE, FIXED (ITEM_LEVEL and ORDER_LEVEL in the README). Auto-approved within `OrgSettings.discountApprovalThreshold` (default 5000, UGX); above it PENDING for approval. The same threshold governs refund auto-complete. [V] `README.md:150, 268-275, 307-312`; RJ:147-153.
- Basis is order subtotal (pre-tax); SERVED orders are not discountable; one PENDING request at a time. [V] RJ:146-153.
- Self-approval is permitted by the backend; the UI shows a note; a maker-checker guard is recommended, not built. [V] RJ:171-173; DEC:592-596.
- Complimentary = whole-order 100% discount with a required reason from a fixed category list; not a void or refund. [V] RJ:161-170.
- Void: reason required (UI always); only before SERVED; sets VOIDED and frees an idle table; it does not touch payments or reservations. [V] RJ:139-147; `README.md:247`. Void and discount are blocked in the UI when payment exists (UI-only safeguard). [V] RJ:150-153.
- Post-close void: 15-minute window from close, manager PIN, audit. [V] `README.md:316-320`. Refund: any closed order up to the paid amount; above threshold needs approval with manager PIN re-entry. [V] `README.md:307-313`. Cashier-owned; out of Supervisor scope. [V] DEC:592-600.
- Staff-meal and manager-only void reasons are seed expectations. [V] `ROADMAP.md:1074`. Anti-theft signals: VOID_SPIKE, DISCOUNT_ABUSE, CASH_VARIANCE, LATE_CLOSE, REFUND_SPIKE. [V] `README.md:398-405`.

### 7.4 Service charge, tax, rounding

- Service charge: a config flag (`service charge config`) [V] `ROADMAP.md:476`; "service charge flags", "rounding policy", "tax category inheritance", "split payment math" are listed under "Do not forget" [V] `ROADMAP.md:3050-3066`; the bill review shows service charge "where supported" [V] CLC:93.
- Tax at item level through `TaxCategory`; seed has VAT Standard 18% and VAT Zero 0%. [V] `README.md:173`; `ai/AI_STATUS.md:2843`. Order totals computation of tax was excluded from the orders milestone (ARCH:440). Manager settings expose default VAT %, tax matrix and rounding. [V] `ai/ENTERPRISE_B6_COMPLETION_REPORT.md:101`.
- UGX shown with zero fractions, one shared formatter. [V] DEC:385-390.
- Supervisor formatters still hard-code UGX (gap SUP-RG-017). [V] DEC:387-390.

### 7.5 EFRIS and fiscal receipts

- EFRIS / URA e-receipts: appears only in the parked event docs and as UNKNOWN: "whether the vendors need URA EFRIS-compliant e-receipts is UNKNOWN, not researched". [V] `docs/event/research/D_event_ops_analytics.md:219, 315`; `docs/event/01_DIRECTION.md:100` (O8). The main product docs never mention EFRIS. UNKNOWN for Nimbus itself.

### 7.6 Who may do what (summary)

| Action | Waiter | Supervisor | Cashier | Manager | Source |
|---|---|---|---|---|---|
| Request bill | yes | yes | read | read | WLC:177; RJ:105; matrix:41 |
| Print/reprint receipt | backend yes, UI closed-only | no permission | yes | yes (backend) | BG4 report:85-90; matrix:51 |
| Void active order | no | yes | no (unless contract) | not in UI | WLC-v1:905; RJ:139; matrix:45 |
| Split / merge / move / transfer | no | yes | yes (allocations) | not in UI | RJ:116; matrix:43-44; ROADMAP:2827 |
| Discount request | no | yes | read | not in UI | RJ:144; matrix:46 |
| Approve discount | no | yes | no | via domain routes only | RJ:157 |
| Take payment, close, till | no | no | yes | no | DEC:391-394 |
| Refund, post-close void | no | no | yes (planned C4) | PIN | README:307-320 |

---

## 8. FORGOTTEN DETAILS (small things a redesign could lose)

1. Quick PIN is exactly 6 or 8 digits, and the branch must be resolved before the PIN; the branch is remembered so the next login is one PIN entry. WLC:26-42.
2. PIN tier is bound to role: 6 digits for operational roles, 8 for elevated. `README.md:129`.
3. A new staff Quick PIN is shown once, masked until deliberately revealed, never retrievable, never cached. RJ:280-282; `docs/KNOWN_LIMITATIONS.md:438`.
4. Credential reset is token-only, no manager-set PIN or password (2026-08-22). `project:claude/session-2026-08-22-manager-accounting-track.md`.
5. 15-minute idle logout for every operational role, hard navigation to `/login?reason=idle_timeout` even if the server call fails. WLC:289-294.
6. No "switch user" and no separate lock-screen mode (waiter decisions 15 and 26-27). `Front End/.../AGENTS.md:79-81`; `waiter_design.md:46, 49`.
7. Lock screen is a true `h-screen` with no page scroll, brand lockup, no role-marketing copy. DEC:296-318.
8. Header shows a station label "Terminal 01" (stored per terminal) because no workstation or service-area API exists. DEC:319-337. The old "service area" slot in the waiter header was never backed by data (WLC:53-56).
9. Floor-code short labels: labels of 7 characters or fewer stay; longer ones are abbreviated (QA-P4-PASS2-1440 becomes QP4P2-1440); full label stays in title and aria-label; examples "TD-01", "T-12", "BAR-3". DEC:338-358; `docs/UI_SYSTEM.md:520-532`. The owner asked for "TD-" style codes per section (`conversation:L1`).
10. Staff names on cards as `First L.`, a separate "Mine" badge; guest names never on a Floor card; guest contact only inside the selected reservation workspace. DEC:396-399; RJ:219-221.
11. A NEW draft does not make a table Occupied; a table is Occupied only after send. WLC:93-96.
12. The table auto-releases when no active dine-in order remains; void auto-releases an idle dine-in table. WLC-v1:113; RJ:142-147.
13. Waiter owns the order: another waiter's table is blocked with "This table belongs to another waiter." (`ORDER_NOT_OWNED_BY_WAITER`); anyone may still seat a reserved guest. `Front End/.../AGENTS.md:67-77`.
14. Every waiter write is shift-gated; an open shift older than about 16 hours or with a bad start is a "Shift issue" that is never auto-closed. WLC:77-80.
15. Item notes only; "No table notes." `waiterui.md:249, 372`; `waiter_design.md:52-53`.
16. "Do not show covers by default" in the order bar (no guest-count prompt exists in any document; reservations carry `partySize`). `Front End/.../waiter_design.md:353`.
17. Required modifier minimums, maximums and single-choice replacement are enforced in API and UI; inactive options are filtered; quantity 1-99. `ai/WAITER_PREMIUM_MENU_ORDER_ENTRY_COMPLETION_REPORT.md:88-90`.
18. The browser never recomputes totals; every write re-reads the canonical order; returned discount is shown when non-zero so subtotal reconciles to total. WLC:140-143; `waiter_design.md:809`.
19. Waiter action labels carry no decorative icons or emoji: "Send to kitchen/bar", "Request bill", "View bill or receipt", "Reprint receipt" are text-first. `waiter_design.md:807-808`.
20. Every blocked action must show a reason (waiter agents rule 6) and unsupported actions are hidden or disabled-with-reason. `Front End/.../AGENTS.md:178`; `waiterui.md:664`.
21. Touch targets: 44 px minimum, 48 px preferred, WCAG 2.2 AA, visible keyboard focus, non-colour status, reduced-motion support. `PRODUCT.md:37`; `Front End/.../DESIGN.md:315-318`.
22. Density: root font size `clamp(13.5px, calc(0.625vh + 9.25px), 16px)`; cards `min-h-[9.5rem]`; header 64 px; bottom nav 64 px. The older 176 px is superseded, but `CLAUDE.md:1540` still says 176px. DEC:264-295.
23. Tokens only: no raw hex; alpha via `-ch` channel triplets; Inter only; navy `#000033`, light grey `#B3B4AF`, dark grey `#6B6B6B`. `PRODUCT.md:21`; `docs/BRAND_IDENTITY.md`.
24. Menu items are never hard-deleted once sold; archive instead. `ROADMAP.md:570`.
25. Recipe changes must not alter the cost of orders already sold (versioning). `ROADMAP.md:671`.
26. Chef cost masking removes fields entirely so null patterns reveal nothing. `README.md:190`.
27. SERVED is required before CLOSE; kitchen states IN_KITCHEN and READY are not waiter-safe; waiter-safe transitions are only SENT and SERVED. WLC:145-149, 281-283.
28. Request bill is allowed by the backend on NEW but the UI blocks it until the order is sent (WKL-001). KL:246.
29. Receipt reprint/send carry a client idempotency key; reprint copies 1-10 with optional reason. `README.md:329`; WLC:198.
30. No cash without a till; no till without a shift; close requires cash reconciliation and may require a stock count. `ROADMAP.md:1119-1120`; CLC:105-119.
31. Fail closed: if payment state is unknown it is never shown as unpaid or zero-due; multiple bills on a table are never silently picked (first-pick is a named anti-pattern). `docs/DECISIONS.md:96-98`; `ai/CASHIER_FLOOR_RECONSTRUCTION_GAP_REGISTER.md:70`.
32. Reservation overdue grace is 15 minutes, only PENDING/CONFIRMED; no-show is never offered for SEATED and never automatic; bulk resolution excluded. RJ:207-216.
33. Seating a reservation creates the linked dine-in order, flips the table to OCCUPIED and opens it in place; order close auto-completes the reservation. WLC:223-233; CLC:196-203.
34. Order numbers are per branch; document numbers carry prefix and zero padding; receipt numbering and rounding policy are called out as easy to forget. `README.md:246, 150`; `ROADMAP.md:3048-3072`.
35. Training mode and maintenance windows must block or simulate writes (423 during BLOCK_WRITES). `README.md:707-715`; `ROADMAP.md:3070-3071`.
36. Offline conflict rule: server truth wins with an auditable diff; offline queue replay is deduplicated by client mutation id. `ROADMAP.md:2282-2283`; `README.md:699-701`.
37. Plain-language honesty: no fake success states, no fabricated printer, no fake KPIs; an unbacked KPI is omitted, not estimated. `docs/DECISIONS.md:224-236`; `PRODUCT.md:25`.
38. Floor plan coordinates were meant to be simple JSON in v1 (a drawn floor map); service areas and a floor selector exist; the build is a card grid. `ROADMAP.md:520`; CLC:42. Optional service-area switcher for waiters with several areas. `Front End/.../waiterui.md:174-176`.
39. Waiters: search by "table number/name"; filter "Mine". `waiterui.md:160-172`.
40. Owner (25 Nov): hide developer-facing clutter: "some systems show like permissions on, off, different sections of code that are not necessary, that are for the developer." Related: Manager "restricted surfaces" disclosure and caveat badges are developer-facing text in the current UI (`docs/ROLE_JOURNEYS.md:288-291`; caveat tags `Front End/.../DESIGN.md:604`).
41. Tests and QA only on disposable databases; agents never push; shared Neon is read-only. `project:claude/session-2026-08-23-*` standing rules; `docs/TESTING_AND_QA.md`.
42. The owner works through delegated agents: "i want a prompt to do evrthing" (`conversation:L81`) and "your goal is to be senior engineer, delegate work to Claude CLI, write prompts" (`conversation:L1`).

---

## 9. STANDING DECISIONS

A new plan must respect each of these or overturn it explicitly. Dates from the source.

| # | Decision | Date | Source | Status vs owner's 25 Nov brief |
|---|---|---|---|---|
| 1 | Stack: Node 22, NestJS, Prisma, Neon Postgres, Next.js Pages Router, React Query, Tailwind, cuid2, pnpm 8.15 | 2026-05 | `ROADMAP.md:55-70`; `AGENTS.md:44-57`; DEC:131-144 | Respect |
| 2 | Build order DB, service, controller, tests, seed, Postman, docs, status, report | 2026-05 | `ROADMAP.md:73-84` | Respect (heavy for UI work) |
| 3 | Per-role nav locked; frontline bottom nav; Manager top nav | 2026-07-18 / 2026-08-20 | DEC:241-257, 148-198 | Respect; Owner nav undefined |
| 4 | No visible Orders tab; order work only from Floor | 2026-07-18 | DEC:258-262 | Matches the owner |
| 5 | One shared `OperationalFloor` for four roles; divergence only after selection | 2026-07-18 / 2026-07-31 | DEC:359-368 | Matches; the owner wants the post-selection screens aligned too |
| 6 | Waiter cannot collect payment or close; Cashier owns payment, receipts, till; Supervisor reads payment | 2026-07 | DEC:391-394; WLC:171-175 | **Partly overturned** by "even a waiter can print a bill" |
| 7 | Waiter statuses limited to Available / Occupied / Reserved | MVP | `Front End/.../AGENTS.md:75-77` | Respect unless the owner wants Cleaning |
| 8 | Manager-configured FOOD/DRINKS taxonomy; no hard-coded categories | 2026-07 | DEC:378-383 | Respect; owner's alcohol subdivision is configuration |
| 9 | No guest names on Floor cards | 2026-07 | DEC:396-399 | Respect |
| 10 | UGX, zero-fraction, Decimal strings | 2026-07 | DEC:385-390 | Respect |
| 11 | Floor card height `min-h-[9.5rem]`; density clamp; header 64 px | 2026-08-20 (owner-approved) | DEC:264-295 | Respect or re-set; owner wants "big" menu buttons, not necessarily big cards |
| 12 | Lock screen: fullscreen, no scroll, no role marketing | 2026-08-20 (owner-approved) | DEC:296-318 | Respect |
| 13 | Terminal label "Terminal 01" | 2026-08-20 (owner-approved) | DEC:319-337 | Respect |
| 14 | Table label abbreviation rule | 2026-08-20 (owner-approved) | DEC:338-358 | Respect |
| 15 | Manager top nav; branch switcher; `X-Branch-Id` | 2026-08-20 (owner-approved) | DEC:148-198 | Respect |
| 16 | Enterprise direction: Odoo-grade management suite; accounting UI over existing endpoints; unbacked KPI omitted | 2026-08-20 (owner-approved) | DEC:199-240 | Respect; owner now wants simpler, hidden clutter |
| 17 | Manager: no cashier clone, no waiter order-entry clone, no menu entry | 2026-08-20 (owner-approved) | `MANAGER_APPROVAL_DECISIONS.md:89-90` | **Overturned 25 Nov** for table work |
| 18 | Manager full access to everything, except compensation, contracts, payroll | 2026-08-21 | `project:claude/session-2026-08-22-manager-accounting-track.md` | Respect |
| 19 | Manager shift-swap review reject only; Supervisor same | 2026-08-20 / 2026-07-31 | DEC:419-427 | Respect |
| 20 | Credential reset token-only; no manager-set PIN | 2026-08-22 | `project:claude/session-2026-08-22-manager-accounting-track.md` | Respect |
| 21 | Supervisor approvals through domain routes, not `/api/approvals` | 2026-07-30 | DEC:7-19 | Respect |
| 22 | Cashier Floor-first target; Queue/Receipts retire in C4/C5 | 2026-07-31 | DEC:42-64 | Respect; C4-C6 not started |
| 23 | Receipt send is PENDING; printer metadata only; card terminal stub; MTN/Airtel not live; PesaPal not for diners | 2026-07/08 | `MANAGER_APPROVAL_DECISIONS.md:129-136`; KL:465-470 | Respect (these are "Locked") |
| 24 | MSR/badge and smart spouts are a late hardware wave (M46) | 2026-03 | `ROADMAP.md:43-53, 2505-2538` | Respect, note live supplier outreach |
| 25 | Code wins over documents when they conflict | 2026 | `CLAUDE.md:2082-2090` | Respect; many docs below are stale |
| 26 | Event-till slice (concert, 28 Nov) parked; owner said "this POS gig is not going to work out. We're going to go back on our original build." | 2026-11-25 | `conversation:L370`; `project:claude/event-till-2026-11-28.md` | Event docs, branch `concert/event-till--moses`, and `POST /pos/quick-sale` are parked, not deleted |
| 27 | Never `pkill -f`, never lint `--fix`, no `next build` beside a dev server, QA only on isolated DBs, shared Neon off-limits, never push | 2026-08 | `project:claude/session-2026-08-22-manager-accounting-track.md` | Respect |
| 28 | The 41 failing Playwright specs must be fixed before new phases or any deploy | 2026-08-23 | same project doc | Open; blocks "know what we break" |
| 29 | Desktop-first only; "No mobile app" for waiter MVP | MVP | `Front End/.../AGENTS.md:57-58` | **Tension:** the owner's house skill says phone-first (360-390 px, 52 px targets); PRODUCT.md:9 says shared desktop terminals. Needs an explicit decision |
| 30 | Deploy landmine: deploying the Aug chain changes branch scoping and AR totals; needs a deliberate window | 2026-08-23 | same project doc | Respect |

Stale or conflicting documents the redesign should not obey blindly: `CLAUDE.md:1540` (176 px card), `docs/UI_SYSTEM.md` and `README.md:159` (BLOCKED), `docs/MODULES.md` (status column), `docs/ROLE_CAPABILITY_MATRIX.md` Cashier and Manager rows, KL:268 (partial cash), the pre-build waiter pack (`Front End/waiter-ui-docs`), `docs/ARCHITECTURE.md:118-120` (role names differ from the schema), and README's "Ksh" examples at `README.md:171` (currency is UGX).

---

## 10. DOCUMENTED BUT NOT BUILT, AND BUILT BUT NOT DOCUMENTED

### 10.1 Documented, not built (as the documents themselves admit)

- Post-send item additions (WKL-010) and serving edit (WKL-012). KL:252-253.
- Receipt send adapters, printer driver, terminal pairing (stub), live MTN/Airtel, card acquirer. KL:249-251, 260-262; `README.md:1080-1087`.
- Cashier C4 (receipt/print/refund in workspace), C5 (Queue retirement), C6 (QA). `docs/cashier-ui-docs/CASHIER_RECONSTRUCTION_ROADMAP.md:120-170`.
- Transfer-server UI (no selector); shift-swap approve (no roster service); backend maker-checker for discounts. DEC:592-600; RJ:178-182.
- Paid-in/out/pickup for tills; safe-drop idempotency incomplete. KL:263-264.
- Split items sends no KDS ticket. KL:266.
- Manager B6.5 (AR/AP writes, journal create), B6.6 (branch profile, devices, printers, terminals, alerts, sync), B7 Owner. `project:claude/session-2026-08-22-manager-accounting-track.md`.
- Graph/pivot reports (no rows endpoint), real PDF export (the export is plain text stamped as PDF; later returns 501), SSE client. `docs/KNOWN_LIMITATIONS.md:465` region; DEC:199-240.
- Order-close stock deduction, multi-warehouse, inter-store transfers. M9 report:83-86.
- Airtel Money native (M13.2), HMS write-back, BullMQ workers. `README.md:1080-1089`.
- A KDS screen, a chef or bartender screen, stock/store UI, menu admin UI, recipe UI, purchasing UI, accountant UI, owner UI: no document plans them as built; M44 names "KDS wallboard, inventory, finance". `ROADMAP.md:2417`.
- Per the schema check: `InventoryLocation`, `UnitConversion`, `YieldProfile`, `RecipeVersion`, `PurchaseOrder`, `GoodsReceipt`, `StockCount`, `Wastage`, `TableMergeRule`, `ComboDefinition` are named in ROADMAP but are not in `schema.prisma`; README describes some as present.

### 10.2 Built, not documented (or documented wrongly)

- `docs/MODULES.md` lists Purchasing, Stock Counts, Franchise, Billing and Alerts as "Planned" though other documents report them done (`docs/MODULES.md:22-23, 49-53`).
- The e-sale slice: `POST /api/pos/quick-sale`, till codes, `clientSaleId`, per-branch order number lock: built on the event branch only, documented in `docs/event/` and `PROGRESS.md`, not in the main docs. `project:claude/event-till-2026-11-28.md`.
- `docs/PRE_EXISTING_ISSUES.md` records an `orders.e2e` close failure; not in KL. (`project:claude/event-till-2026-11-28.md`, correction 4.)
- The waiter pack's pre-build draft still describes the Queue component and order card; they were never mounted. WLC:296-315.
- Role names in ARCH:118-120 (GENERAL_MANAGER, BRANCH_MANAGER, HEAD_CHEF...) differ from README and schema (OWNER, MANAGER, STOCK_MANAGER...).

---

## 11. THE "LATER" LIST

| Item | Where deferred | Source |
|---|---|---|
| Smart spouts / pour telemetry (`SpoutDevice`, `PourEvent`, calibrations) | M46, "explicitly deferred", not before software is green in production-like envs | `ROADMAP.md:43-53, 2505-2538`; owner is already sourcing hardware: `project:claude/smart-pour-spout-supplier-outreach.md` (requires Nimbus to own firmware, hardware design and moulds; 500 pilot units then 1,000-5,000/yr) |
| MSR / badge login | M46 | same |
| Printer drivers, receipt delivery adapters, card terminal | "metadata only", "STUB", "no live adapter" | KL:465-470; `README.md:1080-1087` |
| Live MTN MoMo (code complete, external delivery pending), Airtel Money (not started), PesaPal for owner SaaS only | M13.1 / M13.2 | `ROADMAP.md:149-150`; `README.md:292-305` |
| EFRIS / URA e-receipts | Never planned for Nimbus; event docs call it UNKNOWN | `docs/event/01_DIRECTION.md:100` |
| Offline | "aggressive offline sync beyond initial contracts" deferred; M44 "touch-first and offline-aware"; the event till had its own offline queue design | `ROADMAP.md:51, 2434`; `docs/event/04_FRONTEND_SPEC.md:47-50` |
| Mobile app | Waiter MVP "No mobile app"; README lists a "Mobile Companion" client surface | `Front End/.../AGENTS.md:57-58`; `README.md:93` |
| Passkeys, MFA, SSO/SCIM | M45 | `ROADMAP.md:2456-2503` |
| POS desktop shell | M44 deferred in README | `README.md:1084` |
| HMS write-back | BG7 is read-only | `README.md:1081` |
| Combine/uncombine tables | "Not in waiter MVP" | WLC-v1:907 |
| Branch settings: devices, printers, terminals, alerts, sync | B6.6 | `ai/ENTERPRISE_UI_ROADMAP.md:925-958` |
| Simphony (Oracle Micros) benchmark, second store, store manager UI, sign-outs, kitchen screen notifications | Owner, 25 Nov: "I don't know if you can find code about we're going to do this much later. Let's first make these core improvements right now. Then later on, my brother will give me login details for Microsoft Symphony." | `conversation:L370` |
| Multi-warehouse and inter-store transfer | "future" | `ai/M9_COMPLETION_REPORT.md:86` |
| Roster-mutating shift swap, saved filters/favourites, real PDF | deferred backend features | DEC:419-427; `ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md:142` |
| Franchise analytics, SaaS billing UI, developer portal | out of operational UI scope | KL:465-470 |

---

## 12. WHAT I COULD NOT FIND

1. A single sentence stating the product's one purpose (closest in section 1).
2. Any feature spec for "offers of the day", specials, happy-hour pricing, time-based availability, favourites, or best sellers.
3. Any spec for a bottle sold as one stock item versus a dish with a recipe (a "sold individually" flag), or for piece versus weight units. Units are a free-text field.
4. When stock should deduct (on add, send, or close). Docs say "order-close deduction (M10+)"; the owner says "when I place an order".
5. Any design for a second store, store manager, requisition, sign-out, or "chef is notified" flow. Only a roadmap model name and an inter-branch transfer exist.
6. Any KDS screen design beyond one design-system line, any bartender or chef journey, any bump bar, course firing, sound alert, or ready-notification to the waiter.
7. Whether a KDS ticket marked READY advances the order to READY.
8. Any pre-payment "print bill" (pro-forma) design for waiter or cashier, or a bill-requested notification to the cashier beyond an audit signal.
9. A guest-count (covers) prompt. The docs say do not show covers by default; reservations have party size; orders have no covers field.
10. A UI for creating tables, floor plans, service areas, or for assigning a waiter to a section. Header "service area" has no backing data.
11. Menu, recipe, inventory, purchasing, accountant, owner and stock UIs: no design or lifecycle document.
12. Any mention of Simphony, Symphony, or Micros in the repo (owner's 25 Nov message is the only source). Odoo is the only documented benchmark (`ai/ODOO_REFERENCE_RESEARCH.md`).
13. EFRIS for Nimbus itself, pro-forma invoices, service-charge percentage rules, or tip handling.
14. The owner's own wording before 21 Aug. The JSONL holds summaries, not his raw messages. Several "owner" statements are in agent-written docs ("OWNER-APPROVED"), and I cannot tell his wording from the agent's.
15. A phone/tablet layout for the waiter: docs say desktop-first only; the house skill says phone first. Which applies to a waiter holding a device is not decided.
16. How the Brand Identity PDF (project file) looks: I did not open it; its contents are mirrored in `docs/BRAND_IDENTITY.md`.
17. Real seed demo credentials appear in `docs/TESTING_AND_QA.md:218-221`; not copied.
