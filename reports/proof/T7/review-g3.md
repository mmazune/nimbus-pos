# Review G3 — waiter order screen states (fresh reviewer)

References looked at first: Main.png, Supervisor-Void.png, Order-Terminal.png (approved order screen). Every PNG below was opened and looked at. Pass = 20/24 with no zero.

Points: (1) one obvious action, (2) controls told apart, (3) nothing cut or squeezed, (4) type, (5) surfaces and depth, (6) colour with meaning, (7) spacing and edges, (8) navigation, (9) lists and rows, (10) numbers, (11) few words, (12) brand finish.

| Drawing | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | Total | Findings (short) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Order-Search | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 23 | Matches the approved screen. Result cards are uneven: Club sandwich match text wraps to 2 lines, so its price line sits lower than the others. Bill 98,000 adds up. |
| Order-Search-Phone | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 23 | Clean. Price only appears as small grey text inside each Add button, so prices are hard to scan down the list. |
| Order-Search-None | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 23 | Good empty state, plain words. Three lines of body copy plus a PIN rule line; could be shorter. |
| Order-Search-None-Phone | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 24 | Short, clear, one tonal action. No way to clear other than the x in the field (fine). |
| Order-Line-Sold-Out | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 22 | Red row + grey sold-out card read well; 85,000 and 6 items add up. Table 17 shows 45,000 on the approved Floor drawing, not 85,000 (and only 24,000 is sent) — numbers do not tie. "Ask the kitchen" does not say what happens. |
| Order-Line-Sold-Out-Phone | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 23 | Clear. No total anywhere on the phone order view, so the waiter cannot see the bill change after Remove. |
| Order-Hold-Fire | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 22 | 86,000 matches Table 2 on Floor. Heading "FIRING IN 3 S" (caps unit "S" reads like a code); toast says "fired to the kitchen in 3 s" — past and future at once; say "Grilled tilapia goes to the kitchen in 3 s". |
| Order-Hold-Fire-Phone | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 1 | 1 | 19 | **Fails.** Contradictory state: row still says "Held for later" with a live Fire button while the toast says it was fired — waiter may tap Fire twice (breaks use). "SENT 19:58" label appears twice (outside and inside the card). Held item shows no price; no total. Toast tense same as desktop. |
| Order-Line-Allergy | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 2 | 22 | Sheet and dimming match Supervisor-Void. Sheet says Beef burger "Not sent yet" but the order behind lists the only Beef burger under SENT 19:42 (Medium · No onions) — the edited line does not exist. Allergy has no red cue on the sheet; selected Nuts chip looks the same as any other selection. |
| Order-Line-Allergy-Phone | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 2 | 22 | Same "Not sent yet" vs sent contradiction. Kitchen note field from desktop is missing on phone (desktop has "No sauce on the bun"), so phone cannot do the same job. No red cue for allergy. |
| Order-Same-Again | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 22 | 128,000 / 12 items add up. After the round is already added, the "Same again · 4 more" button is still offered — reads as a second add, risk of double round. Unclear "4 more". |
| Order-Same-Again-Phone | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 22 | Same-again button still offered at top after the round was added; no Undo toast as on desktop. Header says UGX 128,000 but the lists shown add to 60,000 (food round 68,000 not shown). |
| Order-Subgroup | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 22 | Sub-group chip row is clear and counted. Footnote "Beer has sub-groups… same menu tree the manager sets" is a designer's note, not words for a waiter — remove it. |
| Order-Subgroup-Phone | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 23 | "Soft drinks" squeezed to "Soft" to fit the chip. Sub-group counts from desktop dropped (fine). |
| Order-Offers | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 24 | "Was" prices check out (28+8+6 = 42,000; 24+22 = 46,000). Unavailable offers greyed with plain reasons. Drinks offers sit under the Food tab — minor. |
| Order-Offers-Phone | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 24 | Clean. Family platter contents dropped to "4 people" only — waiter cannot tell guests what is in it. |

Global note (not scored down): every phone order state uses a white action bar (Order · n + filled Send) instead of the navy bottom bar; that is consistent across the set and with the approved terminal's order panel, so it is treated as the order-screen convention. Each drawing keeps to one filled navy button; selected chips are navy as on the approved Supervisor-Void.

## Fix before pass

- **Order-Hold-Fire-Phone (19/24):** show the moment consistently — once Fire is tapped, change the tilapia row to "Goes to the kitchen in 3 s" with no Fire button (or show the row before tapping and drop the toast); remove the duplicate "SENT 19:58" label inside the card; show the tilapia price (38,000) and the bill total; reword the toast to "Grilled tilapia goes to the kitchen in 3 s · Undo".

Should fix (passing, but wrong):
- Order-Line-Allergy and -Phone: edit a line that is actually in NOT SENT (or add the new burger to NOT SENT in the order behind); add a red allergy cue on the sheet; add the kitchen-note field to the phone.
- Order-Same-Again and -Phone: hide or disable the Same again button once the round is added (Undo covers it); on phone show the food round or make the header total match what is listed, and add the Undo toast.
- Order-Subgroup: delete the designer footnote.
- Order-Line-Sold-Out: make Table 17's Floor figure and this bill agree.
- Order-Hold-Fire: replace "FIRING IN 3 S" with "Goes to the kitchen in 3 s" and fix toast tense.
