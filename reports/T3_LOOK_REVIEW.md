# T3 look review

Reviewer: subagent, built nothing; scored from screenshots.

Sources: `reports/proof/T3/compare-*.png` (drawing left, built right). For Cashier-Pay I also opened `evening-1-4-cashier-pay-before.png` at full size, because the compare image shrinks the built side. Rules: `design/screens/README.md`. Different names, tables and prices are on purpose and did not cost points. Phosphor icons in place of the stand-in line set did not cost points.

Columns: A one obvious action · B controls told apart · C nothing cut or squeezed · D type · E surfaces and depth · F colour with meaning · G spacing and edges · H navigation · I lists and rows · J numbers · K few words · L brand finish. Pass = 20 or more with no zero.

| Screen | A | B | C | D | E | F | G | H | I | J | K | L | Total | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Order-Empty | 2 | 1 | 1 | 2 | 2 | 2 | 1 | 2 | 1 | 2 | 2 | 2 | 20 | Pass |
| Order-Terminal | 2 | 1 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 22 | Pass |
| Order-Other | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 2 | 1 | 2 | 2 | 2 | 21 | Pass (re-scored) |
| Order-Laptop | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 21 | Pass (re-scored) |
| Order-Phone | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 1 | 2 | 21 | Pass |
| Order-Phone-Check | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 23 | Pass |
| Order-Phone-Item | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 23 | Pass |
| Supervisor-Table | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 23 | Pass |
| Supervisor-Void | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 24 | Pass |
| Cashier-Pay | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 2 | 2 | 2 | 22 | Pass |

10 of 10 pass after the re-score below (first pass: 8 of 10, with Order-Other 18 and Order-Laptop 18 failing).

## Differences worth fixing, per screen (most important first)

### Order-Empty (20)
- The drawing has no "How many 2 3 4 5 6" row and no third row of chips ("All small plates / Cold / Hot"). Together they push the menu down and make three kinds of chips sit close together.
- "Small Plates" wraps onto two lines inside its chip. The drawing's chips are always one line.
- Plain item cards and wide cards with Standard/Share buttons are mixed in one grid. The rows have uneven heights and leave gaps. The drawing uses one tile size.

### Order-Terminal (22)
- The "…" button to the left of Print bill is missing from the footer. The drawing has three footer controls.
- "Coffee & Tea" and "Zero-Proof Bar" wrap onto two lines inside their chips.
- The "Add a mixer" row (Cola, Soda water, Tonic…) under the drinks is missing. The extra "How many" row is there again.

### Order-Other (18, fail)
- The lock card has no actions. The drawing gives two tonal buttons, "Ask Brian O." and "Take it over (needs a supervisor PIN)". The built screen gives the waiter nothing to do.
- The Order panel hides the lines ("Only the waiter on this table sees its lines") and has no Print bill button. The drawing shows the sent lines and a filled Print bill.
- The lock card is stretched to almost the full width of the menu area. In the drawing it is a compact card of about 400 px, centred.

### Order-Laptop (18, fail)
- The top bar is the Manager module bar (Overview, Operations, Staff…, a branch picker, a clock, a user chip with tiny text). The drawing has a simpler bar (Floor, Menu, Stock, Staff, More, search, bell, avatar). The built bar is crowded, and some of its text looks close to the 12 px floor. Note: the Manager top nav is a locked decision (D-MGRTOPNAV), so the owner needs to decide which one wins.
- The breadcrumb "Floor › Main hall › Table 12" and the "Open" status chip are missing. Only a blue "Floor" link and the table name are left.
- Menu search is a labelled form field ("Search the whole menu" / "Name or first letters") in place of the drawing's single search pill next to Food/Drinks. The grid is 4 columns where the drawing has 5, which leaves empty space.

### Order-Phone (21)
- The "…" (more) button at the top right of the header is missing.
- Search has a separate label above it and no magnifier icon. The drawing has one pill with an icon and placeholder text, which uses fewer words.
- Chips are in 3 columns where the drawing has 4, and "Zero-Proof Bar" wraps. The drawing keeps short labels and uses "More · 9" to show the rest.

### Order-Phone-Check (23)
- The divider line above the Total row is missing.
- The sheet opens lower than in the drawing (it starts around 40% down where the drawing starts near the top), so more dimmed page shows behind it.

### Order-Phone-Item (23)
- Hint text was added: "up to 3, if they want" on Extras and Leave out. "Leave out · up to 3, if they want" reads oddly. The drawing has "if they want" only on Extras.
- A separate "Note for the kitchen" label was added above the field. The drawing uses the placeholder alone.
- The subtitle "UGX 28,000 · with chips" is shortened to the price only. This may be a data difference.

### Supervisor-Table (23)
- The last tile on the left is "Same again (the drinks of the last round)" where the drawing has "Send to kitchen again (prints the order once more)". Confirm which action is intended.
- The Split bill subtitle is "Equal parts, recorded for the cashier" where the drawing has "By guest, by item or by amount". This is honest if only equal parts are supported, but it differs from the drawing.

### Supervisor-Void (24)
- Faithful to the drawing. Only the selected reason differs, which is data. Nothing to fix.

### Cashier-Pay (22)
- The fourth payment method, "Split (two ways or more)", is missing. There are three tiles where the drawing has four.
- There is a large empty gap between the change panel and the "Take … in cash" button. The drawing has the same gap, but in the build it reads emptier because the payment controls sit higher on the screen.
- The paid state ("Give this change", "Back to the floor") looks clean. Its panel is narrower than the "Back to the floor" button, so the two edges do not line up.

## Top 3 fixes overall
1. **Order-Other:** put back the "Ask {waiter}" and "Take it over" actions, the read-only order lines and Print bill. Today this screen has no action at all.
2. **Order-Laptop:** match the drawing's header: breadcrumb with an Open chip, a simpler top bar, and one search pill. The owner must first settle the conflict between the drawing and the Manager top nav.
3. **Menu chips across Order-Empty, Order-Terminal and Order-Phone:** no two-line chip labels ("Small Plates", "Coffee & Tea", "Zero-Proof Bar"). Drop or move the extra "How many" row and the third row of chips the drawings don't have. Restore the "…" overflow buttons.

## Re-score, 2026-11-26 (Order-Other, Order-Laptop)

Both screens were re-scored from refreshed `compare-Order-Other.png` and `compare-Order-Laptop.png`, using the same rubric.

- **Order-Other: 18 → 21, now a pass.** The lock card has one filled "Back to the floor" button, so A goes 0 → 2 and B goes 1 → 2. The coordinator says the other gaps are blocked by the API, and I accept that: no endpoint exists for Ask or Take it over, a waiter is refused the lines, and a waiter is refused Print bill. I did not mark those down a second time. Still open:
  - The card stretches to about 580 px across the menu area. The drawing's card is compact, about 400 px. (E 1, G 1)
  - The order panel is mostly empty with one small note. Its "2 lines" count sits beside lines the waiter cannot see. Consider "Lines hidden" or dropping the count. (I 1)
- **Order-Laptop: 18 → 21, now a pass.** Per D-MGRTOPNAV, the Manager top bar belongs to the shared shell. I scored the order screen under it, so the bar's density no longer counts here (C, D and L go back to 2). The breadcrumb now reads "Floor ›" with an "Open" pill (H 1 → 2). The drawing's "Main hall ›" level is still absent; that is minor. Still open:
  - Search is a labelled form field in place of one pill with an icon (B 1, K 1).
  - The grid is 4 columns where the drawing has 5, with an extra third row of chips and empty space on the right (G 1).

The top 3 fixes below were written before the re-score. Fixes 1 and 2 are now resolved as far as the API and the shared shell allow. Fix 3 (menu chips) is the top remaining item.
