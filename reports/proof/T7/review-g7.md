# Review G7: stores and stock (1280 terminal, 1440 laptop, phone)

Reviewer: fresh reviewer. I built none of these drawings, and I opened and looked at every PNG. References: Main.png and Supervisor-Void.png, plus the approved Store-Requests.png (the store keeper terminal) and Manager-Item.png (the manager laptop top bar). Rule checked throughout: stock may go below zero on purpose. A sale is never blocked; the system asks for a count instead.

| Drawing | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | Total | Findings (short) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Store-Stock | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 2 | 22 | Close match to Store-Requests. Shows 9 rows for "Main store · 64" with no "55 more" line or pager. Side text "One alert per crossing, not one per sale" is system talk. The red "Below zero · count it" chip is right. |
| Store-Stock-Phone | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 1 | 2 | 2 | 2 | 21 | The Lager line wraps badly ("fill to / 240"). Shows 7 of 64 with no "more" line, and about 100 px is empty below the card, where Tonic (below minimum) should be. |
| Store-Receive | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | **0** | 1 | 2 | 19 | **The money does not add up.** At the prices in the table the lines come to 481,800 ordered and 474,600 invoiced, but the panel says 499,200 and 492,600. The header says "2 deliveries expected" but only one is shown, with no way to pick the other. Big empty area under the table. Side note is long. |
| Store-Receive-Phone | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 2 | **0** | 2 | 2 | 20 | Same wrong invoice total (492,600; should be 474,600). The Tomatoes line wraps ("· / 4,600 a kg"). The invoice number looks like plain text, not a field you can fill. The "tap a line to change" hint is missing. |
| Store-Count | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 2 | 1 | 2 | 21 | "2 of 10 done" but only 7 rows, with no "3 more" line. Empty space under the keypad and the list. "Compared at the minute you save it" is abstract wording. There is no way to stop or finish the count early. |
| Store-Count-Phone | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 2 | 2 | 2 | 21 | Two "back" controls: the header arrow, and a "Back" button that could mean the previous item or leaving. Name it "Previous item". About 190 px empty under the keypad. |
| Take-Out-Terminal | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 22 | Good sheet with the background dimmed. 3 kg × 4,600 = 13,800 is right. "We found more" is an odd reason on a "Take out" sheet. The stock list behind it has a different layout from Store-Stock (no side panel, search moved). |
| Take-Out-Terminal-Phone | 2 | 2 | 1 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 20 | "Burnt, dropped, broken" text touches its chip edges. The dimmed backdrop is blank, with no list behind it. "Left after this: 1 kg, below minimum" is dropped. The "Why" label is missing. |
| Request-Received-Short | **0** | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 21 | **Hidden submit.** The PIN pad has no named button, so Ruth never sees "Receive 36 of 48" before it commits (the phone does have "Receive with my PIN"). The left half below the table is empty. |
| Request-Received-Short-Phone | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 22 | Clear, with one action. "Stay against this trip" is not plain. There is no hint for how to change what arrived. The lower half is empty. |
| To-Buy | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 1 | 1 | 2 | 2 | 2 | 20 | The "Green Valley Farms · 3" tab is selected but the table shows all 5 rows, including City Drinks Depot. Totals check out (67,200 + 87,400 + 22,500 = 177,100). Lager −3 is not red here, though it is on Stock. The bottom bar lights Stock, but there is no way back to Stock and no title link to it. "Feeding store" is jargon. |
| To-Buy-Phone | 2 | 2 | 1 | 2 | 2 | 1 | 1 | **0** | 1 | 2 | 2 | 2 | 18 | **Dead end:** no back arrow and no bottom bar. "Make an order" does not say which supplier. Rows wrap ragged ("7 / packs", "4 / crates", "11 / crates"). Not grouped by supplier. Lager −3 is not red. |
| Stores-Setup | 2 | 1 | 2 | 2 | 2 | 1 | 1 | 2 | 2 | 2 | **0** | 2 | 19 | **Breaks the stock rule:** "When stock says zero" offers **Block**, but the sale must never be blocked. Kitchen store is being edited, yet Main store is the card that looks selected in the flow. The info card is developer and ledger talk ("valid set-up", "never a rebuild", "the books", "a row in one ledger"). "Point" / "Secondary" are system terms. Ticked and unticked station chips look alike. Lower half is empty. Top bar and breadcrumb match Manager-Item. |
| Stores-Setup-Phone | 1 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 21 | Also offers **Block** (same rule break). "Point · fed by Main" is a system term. No Save, and nothing says whether the zero setting saves when tapped. Bottom bar and back arrow are right. |

Lowest: 18 (To-Buy-Phone). Under 20: 3 (Store-Receive, Stores-Setup, To-Buy-Phone). Zeros: Store-Receive (10), Store-Receive-Phone (10), Request-Received-Short (1), To-Buy-Phone (8), Stores-Setup (11).

Wording: Stores-Setup has developer and ledger terms. "Point", "feeding store", "one alert per crossing" and "stay against this trip" are not plain. No codes are shown beyond the order and request numbers.

## Fix before pass

- **Store-Receive (19, zero on numbers):** make the panel totals match the lines (ordered UGX 481,800, invoice UGX 474,600), or change the line prices so they add up. Show the second expected delivery (a list or switch at the top). Shorten the side note to one line.
- **Store-Receive-Phone (20, zero on numbers):** fix the invoice total to match the lines (474,600). Draw the invoice number as a field. Keep the Tomatoes price on one line, for example "20 kg · UGX 4,600/kg" on the line below. Add "Tap a line to change what came".
- **Request-Received-Short (21, zero on one obvious action):** add a named filled button under the PIN pad, for example "Receive 36 of 48 buns · 4 lines", as the phone already does. Don't let the fourth digit commit silently.
- **To-Buy-Phone (18, zero on navigation):** add a back arrow to Stock, or the store-keeper bottom bar. Group rows by supplier and name it on the button ("Order from Green Valley Farms · 3 lines"). Keep the "buy" part on one line. Make −3 red.
- **Stores-Setup (19, zero on words):** remove **Block** (offer only "Warn and ask for a count" and "Off"), and change the help to "Still sells; the store is asked to count". Replace the info card with one plain line, for example "You can add a store between Main and the kitchen or bar later." Highlight the Kitchen store card, not Main, while it is being edited. Rename the Kind values to plain words, such as "Takes deliveries" / "In between" / "Kitchen or bar store". Give ticked stations a stronger fill than unticked ones.
- **Stores-Setup-Phone (21, rule break):** remove **Block** to match the rule. Replace "Point" with plain words.
- Should fix (pass now): To-Buy tab filter must match its rows, and Lager −3 should be red. Store-Stock, Store-Stock-Phone and Store-Count need "N more" lines. Store-Count-Phone should rename "Back" to "Previous item". Take-Out-Terminal-Phone needs wider chip padding, a list behind the sheet, and the "Left after this" row. Take-Out-Terminal should drop "We found more" (it adds stock, so it belongs in Count) and use the Store-Stock layout behind the sheet.

# Re-review of group 6

| Drawing | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | Total | Findings (short) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Kitchen-Sold-Out | 1 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 21 | Fixed: the tab shows exactly 4 rows, and "Mark sold out" now differs from the chip. Still four same-weight tonal buttons plus "Set a number". The lower 60% of the 1920 screen is empty. "How it works" is still four lines. |
| Kitchen-Sold-Out-Phone | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 23 | Fixed: 4 rows, coloured chips, equal button widths, "Set a number" added. The "Mark sold out" text sits tight to its button edges. |
| Kitchen-Low-Stock-Phone | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 23 | Fixed: the next ticket is drawn, "6 more below, oldest first" adds up to 8, the banner button is tonal "See request", and Ready is the only filled button. The banner text is squeezed into a narrow column ("Kitchen store low / on 3 items"). The Store badge reads 3 here and 1 on other kitchen screens. |
| Kitchen-Opening-Phone | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 22 | Fixed: "Not now" and the bottom bar are added, so the zero is cleared. Still no colour cue on the chosen segment (Still out and Back on are both just white), and Tickets is lit during a morning check. |

All four now pass (lowest 21, no zeros). Should fix: add red/green tints to the Still out / Back on segments, and trim the "How it works" panel on Kitchen-Sold-Out.
