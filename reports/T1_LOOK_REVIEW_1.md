# Look review — T1 built screens vs drawings (rubric §5A.12)

Columns: 1 one obvious action · 2 controls told apart · 3 nothing cut/squeezed · 4 type · 5 surfaces/depth · 6 colour with meaning · 7 spacing/edges · 8 navigation · 9 lists/rows · 10 numbers · 11 few words · 12 brand finish. Pass = 20/24 and no zero. Known left-out parts (no data) were not scored as faults. QA-junk names and "0 min" timers are treated as data.

| # | Screen | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | Total | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Main | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 22 | PASS |
| 2 | Floor-1024 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 23 | PASS |
| 3 | Floor-1920 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 1 | 2 | 2 | 2 | 21 | PASS |
| 4 | Floor-Phone | 2 | 2 | 1 | 1 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 21 | PASS |
| 5 | Reservations-Waiter | 2 | 2 | 1 | 2 | 2 | 2 | 1 | 2 | 1 | 2 | 2 | 2 | 21 | PASS |
| 6 | Reservations-Supervisor | 2 | 2 | 0 | 1 | 2 | 2 | 1 | 1 | 1 | 2 | 2 | 2 | 18 | FAIL (use-breaking) |
| 7 | Waiter-Me (+cashier/supervisor) | 1 | 1 | 2 | 2 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 2 | 20 | PASS (borderline) |
| 8 | Cashier-Receipts | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 1 | 1 | 1 | 2 | 20 | PASS (borderline) |
| 9 | Cashier-Till | 2 | 2 | 1 | 1 | 2 | 1 | 1 | 2 | 2 | 0 | 1 | 1 | 16 | FAIL |
| 10 | Supervisor-Approvals | 1 | 2 | 1 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 1 | 2 | 19 | FAIL |

## 1. Main (Main-1280x800-waiter, Floor-search-1280x800) — 22 PASS
- Area chips are sorted A–Z (Bar, Main hall, Tabs, Terrace, VIP); the drawing leads with Main hall, and Tabs sits mid-row instead of last. The selected chip is no longer the first thing the eye lands on.
- The Find-a-table sheet runs off the bottom edge of the viewport. The result card sits at y≈690–775 with no bottom padding, so the sheet looks cut rather than finished.
- Otherwise a near match: tile grid, mine/others surface split (white vs grey), status chips, header and the bottom nav all hold.

## 2. Floor-1024 (Floor-1024x768-waiter) — 23 PASS
- The page gutter and tile gap are 32/16 against the drawing's 24/12. The grid is slightly tighter inside, and a 7-column row leaves less air at the right.
- Reserved tiles show only "20:00" (the guest count is a known gap). The second line is thin next to the drawing but honest.
- Strong match otherwise.

## 3. Floor-1920 (Floor-1920x1080-supervisor) — 21 PASS
- Tab tiles stack a small "Tab" label above the number ("Tab / 1"), while the drawing has "Tab 1" on one baseline. This breaks the number rhythm of the grid and pushes "2 seats" lower than on every other tile.
- The Approvals nav item has no waiting-count badge, though the drawing has one and the Approvals screen shows 5 waiting. The supervisor loses the cue from the Floor.
- "Find order" replaces the All/Late/Bill segment (known gap), so the right side of the toolbar is one button. That reads fine.

## 4. Floor-Phone (Floor-Phone-390x844-waiter, -tabs) — 21 PASS
- On the Tabs page, each tile crams "Tab" plus "2 seats" on line 1 and a shrunken number on line 2. The number loses its 26px headline weight, and the tile reads as squeezed next to the table tiles.
- The subtitle "Tabs · 0 of 6 tables open" calls tabs tables.
- The rest matches: the YOURS block, the area stepper, and the time/seats corners on the tiles.

## 5. Reservations-Waiter (1280x800, seated, 390x844) — 21 PASS
- Phone: the name column is about 110px wide. Names break mid-word, and the meta wraps "2 guests · No / table yet" over two lines. There is no truncation, so every row grows to 4 lines. Real names would fit better, but the meta line still wraps.
- Laptop: the list card has no bottom edge. The last row is cut mid-text ("F. booking A") against the nav, with no fade or rounded end.
- Phone segment label "Arriving 10" drops the "·" that the laptop uses ("Arriving · 11"). This is inconsistent.

## 6. Reservations-Supervisor (1280x800, new, 390x844, history-390) — 18 FAIL
- USE-BREAKING: on the phone, the History tab is off-screen (the segment runs past 390px). Choosing it pans the whole page sideways (Reservations-supervisor-history-390x844). The time column, the left of "New reservation", and the list's left edge are all hidden. This is a horizontal page scroll, which the layout rules forbid. Caps the screen at fail.
- Laptop: the list scrolls under the sticky "Today · 11 booked" stepper with no mask. The top row's name shows sliced in half ("P. Overdue 1795…" cut through the middle).
- Phone New-reservation sheet keeps 2 columns at 390px. The Guest's name, Phone and Note inputs truncate their own values and placeholders ("Phone Booking ym", "+256 700 000 000"). It should stack to one column.

## 7. Waiter-Me (+ cashier, supervisor, phone) — 20 PASS (borderline)
- The shift card shows "On shift" beside "Not clocked in today · Clock in" (waiter and cashier). The status contradicts itself, and the card offers two competing actions: a blue text-link "Clock in" and an "End my shift" button. On the supervisor screen, "Start my shift" and "Clock in" sit together with no telling them apart.
- "Clock in"/"Clock out" are the only blue links in the app's ink palette. They read as a different system from the grey and navy buttons.
- The columns hold well. The empty space in the left and middle cards is the drawing's own, so it was not counted as a fault.

## 8. Cashier-Receipts (1280x800, refund, 390x844) — 20 PASS (borderline)
- The table column says "Opened" on a page of paid bills ("Paid bills today"), where the drawing has "Paid". The time shown is the wrong kind of time for a receipt.
- Phone bill sheet: after refunds of −160,000 and −2,000 it still headlines "Paid UGX 210,000", with no net line. The refund amount input shows a raw "2000" with no thousands separator.
- The search field has a separate "Find a bill" label and no search icon, unlike the drawing's icon field. The phone sheet repeats its title ("Bill" then "Bill 000063"), and the phone header subtitle wraps "as at / 12:24".

## 9. Cashier-Till (1280x800, variance, 390x844) — 16 FAIL
- Numbers (0): on the phone, money wraps. "−" sits alone on one line with "151,000" below it, and "UGX / 149,000" breaks across two lines, so a negative can be read as positive. The counted-cash input shows a raw "11124000" with no separators.
- "Short by UGX 11,125,500" shows in warning yellow before anything is typed (the empty count is treated as 0). This alarms with no cause.
- The header shows the raw till id "TILL-TAPAS_DOWNTOWN-020" where the drawing has "Till 1". The phone row label is lowercase "opening float · 1 time". On the laptop, the left column is one short card and a lone button over about 60% empty space.

## 10. Supervisor-Approvals (1280x800, done, 390x844, sheet) — 19 FAIL
- The main action "Approve the discount" is greyed out (disabled) with no visible reason, and Decline stays live. The supervisor cannot tell why approval is blocked or what to do.
- The Approvals bottom-nav item has no waiting-count badge (the drawing has one; 5 are waiting).
- Phone rows wrap names and dates mid-phrase ("Agnes / N.", "Mon / 6 Jul", "Stock / demo anomaly"). The sheet repeats its title ("Shift swap" over "Shift swap · Agnes N."), and the segment tabs crowd the pill edges.

## Summary
Main 22 · Floor-1024 23 · Floor-1920 21 · Floor-Phone 21 · Reservations-Waiter 21 · Reservations-Supervisor 18 FAIL · Waiter-Me 20 · Cashier-Receipts 20 · Cashier-Till 16 FAIL · Supervisor-Approvals 19 FAIL — 7 pass, 3 fail.
