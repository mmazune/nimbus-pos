Independent review, 26 Nov 2026: a fresh reviewer that built nothing and was given no guidance on what to set aside.

Source: `reports/proof/T3/compare-<Name>.png` (drawing left, build right). For Cashier-Pay the compare image shrinks the build, so I also looked at the full-size `evening-1-4-cashier-pay-before.png` and `evening-1-5-cashier-paid.png`. I did not mark down names, tables, prices or how many menu items there are, because the build uses test data.

Points: 1 one obvious action · 2 controls told apart · 3 nothing cut or squeezed · 4 type · 5 surfaces and depth · 6 colour with meaning · 7 spacing and edges · 8 navigation · 9 lists and rows · 10 numbers · 11 few words · 12 brand finish and fidelity to the drawing. Pass means 20 of 24 or more, with no zero.

| Screen | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | Total | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Order-Empty | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 21 | Pass |
| Order-Terminal | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 21 | Pass |
| Order-Other | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 2 | 2 | 0 | 20 | **Fail** (a zero) |
| Order-Laptop | 2 | 2 | 2 | 1 | 2 | 2 | 1 | 1 | 2 | 2 | 1 | 1 | 19 | **Fail** |
| Order-Phone | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 1 | 1 | 20 | Pass (just) |
| Order-Phone-Check | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 23 | Pass |
| Order-Phone-Item | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 22 | Pass |
| Supervisor-Table | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 22 | Pass |
| Supervisor-Void | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 23 | Pass |
| Cashier-Pay | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 23 | Pass |

## Differences, worst first

**Order-Empty**
1. Some category chips wrap onto two lines ("Popular food", "Small Plates"). In the drawing every chip label sits on one line.
2. A "How many 2 3 4 5 6" row has been added beside the Food/Drinks tabs. It is not in the drawing, and it makes the top of the menu busier.
3. The back arrow and the chip grid's rhythm differ from the drawing: chips are a fixed width with uneven gaps, where the drawing has an even 8-column grid.

**Order-Terminal**
1. The footer has no "…" (more) button. The drawing has three controls: …, Print bill, Send. The build shows only Print bill and Send.
2. The "Add a mixer" row (Cola, Soda water, Tonic, …) under the drinks list is missing.
3. The chips wrap onto two lines ("Coffee & Tea", "Zero-Proof Bar"), and the same extra "How many" row as Order-Empty appears here.

**Order-Other**
1. The drawing's two choices, "Ask Brian O." and "Take it over (needs a supervisor PIN)", are gone. A single filled "Back to the floor" button replaces them, so the screen no longer offers a way to take the table.
2. The order panel lists no lines, only the words "Only the waiter on this table sees its lines". There is also no Print bill button, although the drawing shows the lines and Print bill as the main action.
3. The lock card is stretched to about twice the drawing's width. Its button runs the full width of the card, and a large empty space is left around it.

**Order-Laptop**
1. The top bar is the Manager module bar (Overview, Operations, Staff, Reports, Accounting, Settings, Me), with a clock, a branch picker and a user block. The drawing's bar reads Floor, Menu, Stock, Staff, More, with a search box and a bell. The breadcrumb also loses "Main hall".
2. The menu search is a labelled form field: the heading "Search the whole menu" over the placeholder "Name or first letters". The drawing has one compact search pill with an icon, so the build says the same thing twice and floats the field away from the tabs.
3. The tiny "MANAGER" role label in the top bar looks smaller than the 12 px floor. A "Same again" link has also been added to the order header.

**Order-Phone**
1. The header has no "…" button on the right, so actions on the table are not reachable from this screen the way the drawing intends.
2. The search is a label ("Search the whole menu") plus a placeholder ("Name or initials"), with no search icon. The drawing has one search pill with an icon.
3. The chips run 3 to a row instead of 4, "Zero-Proof Bar" wraps onto two lines, and the drawing's "More · 9" overflow chip is missing.

**Order-Phone-Check**
1. The divider line above Total is missing, so the total does not read as a separate footer.
2. The sheet starts lower than in the drawing and leaves less room for the list, so more of the screen behind it shows.
3. Otherwise it is faithful: the section labels, quantity badges, bold not-sent lines and buttons all match.

**Order-Phone-Item**
1. The quantity "1" between the − and + buttons is regular weight and small. In the drawing it is a bold, larger number.
2. The hints are wordier than the drawing. "Leave out" carries the hint "up to 3, if they want", copied from Extras, which reads oddly for leaving things out. The note field has a label above its placeholder, where the drawing has a placeholder only.
3. The sheet fills nearly the whole height with tighter gaps. The drawing leaves air above the footer.

**Supervisor-Table**
1. The action set is different. "Send to kitchen again" has become "Same again", and "Table status" has been added. That makes nine tiles, so one sits alone with an empty slot beside it.
2. The sheet is much larger than the drawing's. It covers the order panel almost entirely and uses different icons, for example a pin for Join tables.
3. Behind the scrim, the chips wrap onto two lines ("Popular food") and the extra "How many" row shows.

**Supervisor-Void**
1. The screen behind the sheet repeats the chip wrapping ("Popular food", "Small Plates").
2. A "Same again" link has been added to the order panel behind the sheet.
3. The sheet itself matches the drawing closely: segment, reasons, the "1 of 1" stepper, the note, the audit line, and "Keep the item" next to the one filled Void button.

**Cashier-Pay**
1. The fourth payment method, "Split (Two ways or more)", is missing. The build offers only Cash, Mobile money and Card.
2. The header subtitle drops the guest count: "Table 12 · served by Brian K." against the drawing's "Table 12 · 3 guests · served by …".
3. On the paid screen, the Bill column still offers "Print bill" and shows nothing to say the bill is paid. The footer note is also longer than the drawing's: "Your till counts the cash … The receipt is under Receipts."
