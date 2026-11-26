# Review G6: kitchen and bar (1920x1080 + phone)

Reviewer: fresh reviewer, built none of these. Every PNG was opened and looked at. References: Main.png, Supervisor-Void.png, and the approved Kitchen.png (red under a ticket line = cooking instruction or warning).

| Drawing | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | Total | Findings (short) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Bar | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 23 | Matches Kitchen.png. The Tickets badge says 8 but the header says 6 orders. |
| Bar-Phone | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 1 | 2 | 2 | 21 | Badge 8 against 6 orders. Says "4 more below" but leaves about 70 px empty instead of showing the next card. No Cocktails/Beer filter, no name or lock in the header. |
| Kitchen-Done | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 2 | 1 | 2 | 21 | "Last hour · 23" but only 7 rows, nothing to show more, and half the screen is empty. The side-panel help text is long. |
| Kitchen-Done-Phone | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 2 | 2 | 21 | Shows 6 of 23 with no "more" line. No Last hour/Today switch. The only action is a hint line ("Tap a ticket..."). |
| Kitchen-Sold-Out | 1 | 1 | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 1 | 1 | 2 | 18 | Tab "Out or low · 4" but the list has 8 rows, 4 of them Available. "Sold out" is both a status chip and a button label. Eight same-weight tonal buttons. Big empty lower half. "How it works" panel is wordy. |
| Kitchen-Sold-Out-Phone | 1 | 1 | 2 | 2 | 2 | 1 | 1 | 2 | 1 | 1 | 2 | 2 | 18 | Tab says 4 but shows 5 (Beef burger is Available). No coloured status chips, so sold out is not red. Button widths are uneven (ragged right edge). No way to "Set a number" on the phone. |
| Kitchen-Set-Number | 2 | 1 | 2 | 2 | 1 | 2 | 1 | 2 | 2 | 1 | 2 | 2 | 20 | Sheet sits on top of the bottom bar, and Tickets/Store beside it are barely dimmed. Preset chips 5/10/12/20 repeat the keypad. X and Cancel both close it. Header says 17:05, but rows show Lamb chops marked at 19:20 and Goat stew already "12 left". |
| Kitchen-Set-Number-Phone | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 23 | Clean keypad and one action. The dimmed area behind the sheet is blank (no list behind it). |
| Kitchen-Low-Stock | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 22 | Banner works well. Banner body line is long (three items with minimums in one line). OK for the voided line to be red ("do not make" is a warning). |
| Kitchen-Low-Stock-Phone | 1 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 0 | 2 | 1 | 2 | 19 | Only 1 of 8 tickets drawn, with about 230 px empty below and no "7 more below": the queue looks like one order. "Look" is vague. The banner's navy button outranks Ready. |
| Kitchen-Remake | 2 | 2 | 1 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 21 | "Something else" chip text is tight to its edges. Sheet covers the bottom bar. Help text is two long lines. |
| Kitchen-Remake-Phone | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 22 | No "How many" (desktop has 1 of 2), so 1 of the 2 burgers cannot be chosen. Blank dimmed backdrop. |
| Kitchen-Opening | 2 | 1 | 2 | 2 | 2 | 1 | 1 | 1 | 2 | 2 | 2 | 2 | 20 | The Still out / Back on segments look the same whichever is chosen, with no colour cue. Right third is empty and the toggles are far from the names. The Tickets tab is lit while this is a morning check. |
| Kitchen-Opening-Phone | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 0 | 2 | 2 | 2 | 2 | 20 | Breaks use: no bottom bar and no "Not now", so the only way out is Done. Same toggle cue problem as desktop. |

Lowest: 18 (Kitchen-Sold-Out, Kitchen-Sold-Out-Phone). Under 20: 3 (Kitchen-Sold-Out, Kitchen-Sold-Out-Phone, Kitchen-Low-Stock-Phone). Zeros: Kitchen-Low-Stock-Phone (9), Kitchen-Opening-Phone (8).

Wording: plain throughout. No developer terms or codes found.

## Fix before pass

- **Kitchen-Sold-Out (18):** make "Out or low · 4" show only the 4 out/low rows (Available rows belong under "All 64 items"). Rename the row action to "Mark sold out" so it differs from the status chip. Cut "How it works" to one or two lines.
- **Kitchen-Sold-Out-Phone (18):** show only the 4 out/low items under the "· 4" tab. Use the coloured status chips (red Sold out, amber left/Check stock). Give the row buttons one fixed width. Add a "Set a number" entry.
- **Kitchen-Low-Stock-Phone (19, zero on lists):** draw the next ticket cards under Table 6, or add "7 more below, oldest first" as Bar-Phone does. Rename "Look" to "See request". Keep the oldest ticket's Ready as the one filled button and make the banner button tonal.
- **Kitchen-Opening-Phone (20, zero on navigation):** add a "Not now" way out (or the navy bottom bar). Give the chosen state a clear cue, for example red tint on Still out and green on Back on.
- Should fix (pass now): Bar and Bar-Phone Tickets badge 8 should read 6. On Kitchen-Set-Number, make the screen time match the row times (17:05 against 19:20) and dim the bottom bar fully under the sheet. Kitchen-Done and Kitchen-Done-Phone need a "16 more" line or a pager for 23 tickets. Kitchen-Remake-Phone needs "How many". The phone sheets should show the dimmed list behind them.
