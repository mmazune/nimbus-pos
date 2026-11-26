Independent review (round 5), 26 Nov 2026: a fresh reviewer that built nothing, saw no earlier review, and was given no guidance on what to set aside.

Source: `reports/proof/T3/compare-<Name>.png` (drawing left, build right), read against `design/screens/README.md`. Data differences (names, tables, prices, item counts) were not marked down.

Points: 1 one obvious action · 2 controls told apart · 3 nothing cut or squeezed · 4 type · 5 surfaces and depth · 6 colour with meaning · 7 spacing and edges · 8 navigation · 9 lists and rows · 10 numbers · 11 few words · 12 brand finish / fidelity.

| Screen | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | Total | Result |
| --- | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| Order-Empty | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 22 | Pass |
| Order-Terminal | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 22 | Pass |
| Order-Other | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 23 | Pass |
| Order-Laptop | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 1 | 21 | Pass |
| Order-Phone | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 21 | Pass |
| Order-Phone-Check | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 22 | Pass |
| Order-Phone-Item | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 22 | Pass |
| Supervisor-Table | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 2 | 2 | 1 | 21 | Pass |
| Supervisor-Void | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 24 | Pass |
| Cashier-Pay | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 22 | Pass |

## Differences, worst first

### Order-Empty
1. Category chips wrap to two lines ("Popular food", "Small Plates"); the drawing keeps every chip on one line at a fixed height, so the chip row looks squeezed.
2. A "How many 2 3 4 5 6" quick-quantity row sits beside Food/Drinks; it is not in the drawing and adds a second row of controls competing with the categories.
3. Empty-state block sits higher and its body copy is left-aligned rather than centred under the plus icon.

### Order-Terminal
1. Category chips wrap ("Coffee & Tea", "Zero-Proof Bar") in a row the drawing keeps single-line.
2. The same un-drawn "How many" row appears; the drawing has none.
3. The "Add a mixer" strip under the drinks list is absent (may be data-driven, but the slot is not shown).

### Order-Other
1. Only one action ("Take it over"); the drawing's second tile "Ask Brian O. / Sends him a request" is missing, so the card reads half-empty with a single full-width tile.
2. Body copy drops "and print the bill"; the screen still offers Print bill, so the sentence undersells it.
3. Lock icon in the tile is a different, heavier glyph than the header lock.

### Order-Laptop
1. Menu search is a labelled field ("Search the whole menu" above a "Name or first letters" input) instead of the drawing's single icon search pill; the label floats above and breaks the Food/Drinks row alignment.
2. Top bar is the Manager module bar (Overview, Operations, Staff…, branch picker, clock, name) rather than the drawing's Floor/Menu/Stock/Staff/More bar; heavier and busier than drawn.
3. A blue "Same again" text link is added to the order panel header; not in the drawing.

### Order-Phone
1. "Single malt 12" wraps to two lines and "Zero-Proof Bar" chip wraps; the drawing keeps names on one line where they fit.
2. Search has an added label above the input and the magnifier icon is gone; more words, less like the drawing.
3. Chips laid out three per row instead of the drawing's four with a "More · 9" overflow chip.

### Order-Phone-Check
1. Total and the two buttons sit directly under the list with no divider and no pinned footer band; the drawing separates the footer with a rule and white band.
2. The sheet starts lower (more of the menu shows above it), so the list area is shorter than drawn.
3. Minor: header behind the scrim keeps a "…" button the drawing omits on this state.

### Order-Phone-Item
1. Extra qualifier words ("up to 3, if they want" on both Extras and Leave out) and an added "Note for the kitchen" label; the drawing is terser.
2. Sheet is shorter, so the menu chips behind it show through with two-line wrapping ("Popular food", "Small Plates").
3. Subtitle under the dish name is shorter than drawn (no description line); acceptable, but the header feels thinner.

### Supervisor-Table
1. Nine action tiles instead of eight: "Same again" and "Table status" replace "Send to kitchen again", leaving an odd lone tile and an empty cell in the grid.
2. The sheet is wider and taller than drawn, covering most of the order panel and the menu grid.
3. Icon set mixes stand-ins (location pin for Join tables, clipboard for Split bill, coins for Discount) that read less clearly than the drawing's glyphs.

### Supervisor-Void
1. Very close to the drawing. Only visible difference is which reason chip is selected (state, not design).
2. "How many" stepper label sits marginally lower than "Note"; negligible.
3. None further.

### Cashier-Pay
1. The fourth payment method, "Split / Two ways or more", is missing; the row has three tiles, leaving the method grid narrower than drawn.
2. Payment-method icons (cash especially) are different, busier glyphs than the drawing's simple line set.
3. Keypad backspace shows a delete-key glyph where the drawing has an undo arrow; a large empty band remains between the change card and the main button (also in the drawing, but more pronounced here). The paid state (second capture) is clean and consistent.
