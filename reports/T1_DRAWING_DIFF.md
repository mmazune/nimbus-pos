# Drawing vs built: Me, Receipts, Till, Approvals (1280x800)

Drawings are design/screens/html/<Name>.html with kit.css. Built screens are the PNGs in reports/proof/T1 and the source in apps/web/src/screens.
Data values (names, amounts, times) are ignored.

Classes:
- (a) cosmetic, fixable in the screen file
- (a-kit) cosmetic, but the fix belongs in a shared kit or shell file, not the screen file. Not counted as (a).
- (b) needs data or a route that does not exist
- (c) deliberate wording or omission, stated in a source comment

## Shared to all four (shell and kit, not the screen files)

- S1 (a-kit) Header, right side. The drawing says "Sarah M. · Cashier · **Till 1**" or "Grace N. · Supervisor · **Front desk**". Built always says "· **Terminal 01**", the station label from the shell, not a till.
- S2 (a-kit) Icons differ from the drawing's line set:
  - lock: the built lock has a keyhole dot
  - Me: built uses a person in a circle; the drawing has a bare person
  - Receipts and Till use different glyphs
- S3 (c) Missing nav tabs: Waiter "Ready" and Supervisor "Team". See components/pos-shell/touch-sections.ts:9-10: "Ready waits for E5 / U4", "Team waits for U4".
- S4 (a) Right panel width. The drawing aside is 420 px (inline `width:420px`). Built uses `w-kit-sheet-side` = 440 px (kit-tokens.css:127).
  - Receipts :376, Till :379, Approvals :559.
  - No 420 token exists, so a fix needs a new token or must reuse one.

## 1 Waiter-Me (MeScreen.tsx; also cashier and supervisor Me)

LAYOUT
- M1 (a) Column widths. The drawing's 3 flex columns render 411 / 410 / 371 px. Built `grid-cols-3` gives 397 / 397 / 397 (:397). Minor.
- M2 (c) Built adds an attendance row under the shift ("Attendance · not clocked in yet" + "Clock in" text button, :256-273). It is not in the drawing. Header comment :29 lists "clock in or out".
- M3 (b/c) "Items voided" fact is missing. Comment :33: no per-person void count.
- M4 (c) "Ask to swap" button is missing (:34). "Change my PIN" button is missing (:35, no endpoint).
- M5 (c) Cashier and supervisor do not get "Sales so far" (:304, `role === "waiter"`). The drawing is waiter only.

SIZES
- M6 (a) My shift stack gap. Drawing `.g12` = 12 px between heading, big number and started line. Built `gap-kit-8` (:231).
- M7 (a) My day gap. Drawing `.g12` between rows. Built `gap-kit-4` (:292).
- M8 (a) My day row height. Drawing min-height 40. Built `min-h-kit-chip` = 44 (:101).
- M9 (a) My day value type. Drawing `t-body b` = 16/22 bold. Built `Text variant="row"` = 17/24 bold (:105).
- M10 (a) "MY REQUESTS" caption padding. Drawing 16 16 8. Built pt-16 / pb-4 (:319-320).
- M11 (a) Request rows. Drawing `row s` = min-height 56. Built `Row` default = 64 (:218, :225). Pass size="settings".
- M12 (a) "Ask for leave" button.
  - Height: drawing `btn sm` = 44. Built default 52 (:335). Use size="laptop".
  - Padding: drawing 12 16 16. Built p-16 (:334).

WORDS
- M13 (a) Shift pill. Drawing "On shift". Built "Shift open" (:235). Built also has "Needs a review" and "Off shift", which the drawing does not show.
- M14 (a) Leave date range. Drawing "Leave, 12 to 14 Dec" (the month is written once). Built "Leave, 17 Sept to 18 Sept" (:216, repeats the month).
- M15 (b) Swap line. Drawing "Sat 28 Nov, evening". Built "28 Nov" only (:225). The swap has only `shiftDate`; there is no shift part. The weekday alone would be (a).

## 2 Cashier-Receipts (ReceiptsScreen.tsx)

LAYOUT
- R1 (a) Search field.
  - Drawing: no label, a search icon inside the field, field top-aligned with the segmented control.
  - Built: a visible label "Find a bill" (:267). The row aligns `sm:items-end` (:265), so the table starts at y=174, not 148.
  - Field has no hide-label or icon prop, so part of this fix is (a-kit).
- R2 (b) "How" column is missing (comment :34-35: the order list has no payment method).
- R3 (b) "Paid" column became "Opened" (:247, :257). The list has no close time (comment :28-31).
- R4 (b) "Print again" button is missing (comment :33-34: the reprint route records only).
- R5 (a) Column widths. Drawing: auto table layout. Built: fixed spans 2/3/3/2/2 (:243-249). With the How column gone, Waiter and Opened are wider.
- R6 Built additions not in the drawing:
  - an Earlier pager: "Newer" / "Page n of m · finding looks at this page" / "Older" (:281-293)
  - "The newest 500 paid bills are shown." (:295)
  - refund lines under the items, and "Kept after refunds given back" (:207-234)

SIZES
- R7 (a) Bill item lines.
  - Drawing `.line`: min-height 52, padding 10/16, qty box 28x28 radius 8, name 16/600, price 15/600.
  - Built (:192-203): rows at gap 8, no min-height (about 28 px apart); qty `h-kit-badge` 24 px; name `body` 16/400; price `body strong` 16/700.
- R8 Table header 44 and rows 56 match. No difference.

WORDS
- R9 (a) Search placeholder. Drawing "Find a bill by number, table or amount". Built label "Find a bill" plus placeholder "Bill number, table or amount" (:267).
- R10 (c) Refund button. Drawing "Refund · needs a supervisor". Built "Refund" (:237).
  - Source :498 says only a refund "above the approval limit waits for approval".
  - :443 says no screen lists refunds waiting for approval yet, so the words promise no one.
- R11 (b) Header right "Till 1": see S1.

## 3 Cashier-Till (TillScreen.tsx)

LAYOUT
- T1 (b) Cash / Mobile money / Card tile row is missing. Comment :27-28: the summary has no per-method totals.
- T2 (b) "Mobile money to match" and "Card slips to match" lines are missing from the close panel, for the same reason.
- T3 (b) Action buttons "Pay out" (no route, :28) and "Open the drawer" (hardware, :29) are missing.
- T4 (a) Action row layout. Drawing: three equal tonal buttons spanning the full width. Built: one button in `grid sm:grid-cols-3`, so it takes 1/3 width at the left (:229).
- T5 Built additions in the close panel: a variance banner "Short/Over by UGX …" and a "Why it does not match" field (:268-273). They are not drawn; they replace the supervisor sign-off.

SIZES
- T6 (a) Drawer card padding. Drawing 8 20 16, with the caption padded 12 0 4. Built `padding="roomy"` = 20 on all sides (:203).
- T7 (a) Drawer line height. Drawing min-height 40. Built `min-h-kit-target` = 44 (:70).
- T8 (a-kit) "Cash counted" field. Drawing: height 64, font 22. Built: Field default 52 / 16 (:267). Field has no 64 size.

WORDS
- T9 (b) Header. Drawing "Till 1 · opened 16:00 by Sarah M. · **96 bills** · as at". Built has no bill count (:139). Comment :29: no count per till.
- T10 (b/c) Line label. Drawing "Cash sales". Built "Cash payments in the branch, less refunds" (:215). Comment :130-131: the server's figure is branch cash payments less refunds, not this till's sales.
- T11 (b) Close-panel instruction. Drawing "… A supervisor signs any difference." Built "… Write why if it does not match." (:265). The reconcile input takes only a varianceReason (:198); there is no supervisor sign-off route.
- T12 (a) Field label. Drawing "Cash counted". Built "Cash counted, UGX" (:267).

## 4 Supervisor-Approvals (ApprovalsScreen.tsx)

LAYOUT
- A1 (b) Void, Refund and Take over rows are missing (comment :46: no route lists them). Built has Discount, Leave, Shift swap and Alert rows instead.
- A2 (b/c) Footnote is missing: "A waiter can also hand you the terminal: you type your PIN on their screen and it is approved on the spot." Comment :46-47: no second-person approval exists.
- A3 Built additions:
  - a third segment, "History" (:475), and its pager (:479-490)
  - a status pill in the detail header (:388) and on Done rows (:446). The drawing has no pill in the panel.
- A4 (a) The detail-header pill: drop it or keep it as a deliberate addition (:388).

SIZES
- A5 (a) Queue rows. Drawing min-height 76. Built Row default 64 (:435-450). Pass `size="tall"`.
- A6 (a-kit) Row title. Drawing `t-row` = 17/24 bold. Built Row title is fixed `text-kit-body` 16 bold (kit/Row.tsx:52).
- A7 (a) Detail facts.
  - Row height: drawing min-height 40, built `min-h-kit-target` 44 (:132).
  - Gap: drawing `.g8` plus margin-top 8 before the facts; built `gap-kit-12` (:378).

WORDS
- A8 (b) Discount row title. Drawing "Discount · Table 19". Built "Discount · bill 000060" (:115). The discount's `order` has no table (lib/supervisor/approvals.ts:81-86).
- A9 (a) Discount row line. Drawing "10% · UGX 6,600 · David S.". Built shows "10% · …" with no money for a percentage discount (:114). `order.subtotal` is on the record.
- A10 (a) Detail heading. Drawing names the action: "Void 1 Chicken wings". Built repeats the row title "Discount · bill 000060" (:381-382).
- A11 (b) Detail sub-line. Drawing "… · bill becomes UGX 74,000". Built has no "bill becomes". No route returns the post-approval total, and the project rule forbids client-computed final totals.
- A12 (b) Void-only facts are missing: "Was it made?", "Sent to the kitchen", "Amina K. today · 2 voids · UGX 31,000".
- A13 Primary button: drawing "Approve the void", built "Approve the discount" / "Approve the leave". Same pattern, different domain. No difference.
- A14 (c) The swap shows "Decline the swap" as its primary button with no Approve (:42, Outcome C).

## Count of (a) items, screen file only

| Screen | (a) items | Count |
|---|---|---|
| Waiter-Me | M1, M6, M7, M8, M9, M10, M11, M12, M13, M14 | 10 |
| Cashier-Receipts | R1, R5, R7, R9, S4 | 5 |
| Cashier-Till | T4, T6, T7, T12, S4 | 5 |
| Supervisor-Approvals | A4, A5, A7, A9, A10, S4 | 6 |

R1 is partly (a-kit), because the hidden label and the search icon need Field changes.

Not counted (a-kit): S1, S2, R1 part, T8, A6.
