# Nimbus POS: back to the original build. Screens and navigation (state at 26 Nov 2026)

Supersedes `claude/event-till-2026-11-28.md`: the concert Event Till was **cancelled by the owner on 25 Nov 2026**. Prompts H3 and H2a never ran. The quick-sale engine (H0 to H1F2) sits unpushed on branch `concert/event-till--moses` in `~/Code/nimbus-pos-event` (HEAD `938c013`), which is also the newest code and the base that was scanned.

## What the owner asked for (25 and 26 Nov, his words)
- "We're going to go back on our original build." Stricter rules, better UI, "break it down and reconstruct it", everything 2 to 3 taps away.
- The system is centred on tables. "In the waiter UI, every UI says something different when they select a table." A table tap opens a **full screen** with big menu buttons, categories and sub-categories, search; the same table for supervisor, cashier, manager with their rights.
- Drawings first, pixel-level, per role and per monitor, so code "looks exactly the same as those pictures". Venues with 60 tables plus tabs for standing guests.
- Touch roles use a **bottom navigation**, navy, like the previous build, "premium", 3 to 5 sections per role, no duplicates ("we do not need orders… we do not need menu for waiters"). Reservations must be there; waiter and supervisor differ.
- Phones: keep phone layouts for everyone on one link; also draw phone screens for manager, owner, accountant. "You're going to have to design hundreds of screens… go ahead."
- Recipes with units, stock deducted by sales, main and secondary stores, requisitions, kitchen screen, accountant costs; hide developer clutter; remove junk code; redo the roadmap to deployment.

## Research done (files in the session workspace `pos-direction/research/`, not yet in the repo)
A1 vision and documents, A2 front end as built, A3 back end as built, B order-screen benchmarks, C recipes, stock, stores, kitchen. Headline facts, all verified in code at `938c013`:
- A table tap gives four different results today (waiter full screen, cashier and supervisor a docked sheet, manager an inline card).
- A waiter cannot add items after Send; no role can void one item; nothing prints; cash must equal the bill exactly; payment does not free the table.
- A sale does not deduct stock; there is no store, requisition, purchase or count model; no kitchen screen in the web app; the accountant holds no menu or cost permission.
- About 15,600 lines of front-end code are unreachable or unwired; 10 back-end modules are junk candidates.

## Decisions taken in the drawings (to become ADRs; owner can overturn any)
1. One tap on a table opens the same full-screen order screen for every role. Rights change the buttons, not the screen.
2. Nothing is saved when a free table is tapped; the order exists from the first Send.
3. Menu is two levels above the item: Food | Drinks, then a group. "Popular" and "Offers" are the first two groups. Measures (tot, double, bottle) are buttons on the item row.
4. The filled button follows state and role: Send when there are unsent lines; else Print bill (waiter, supervisor) or Take payment (cashier, manager).
5. Touch roles: slim navy header, navy bottom bar 76 px, sections 56 px high and equal width, 28 px icon beside a 17 px label, the current section a white block. On an open table the bar steps aside for the order's own buttons.
6. Bottom bar per role: Waiter Floor · Reservations · Ready · Me. Cashier Floor · Receipts · Till · Me. Supervisor Floor · Reservations · Approvals · Team · Me. Kitchen or bar screen Tickets · Done · Sold out · Store. Store keeper Requests · Stock · Receive · Count · Me. Manager on a phone Today · Floor · Approvals · Reports · More; owner Today · Branches · Reports · Alerts · More; accountant Today · Costs · Purchases · Reports · More. Manager and accountant keep the top bar on a laptop.
7. Floor: one area at a time, roomy tiles when they fit, compact when not, then scroll down, never sideways. Capacity with no scroll: 1024×768 24 roomy / 35 compact; 1280×800 32 / 54; 1440×900 45 / 70; 1920×1080 84 / 117. A "Tabs" area holds numbered tabs for standing guests.
8. Void after Send asks "Was it made?" (waste, or back to stock) and a reason. Stock leaves the store when the line is sent.
9. Item set-up asks "How is it sold?": as bought, a measure, made from a recipe, not tracked. Units are count, weight or volume.

## Needs the owner's answer (default in brackets)
- New sections "Ready" (waiter) and "Team" (supervisor) [keep both].
- A waiter may seat a booking at another free table when the booked one is still in use [yes].
- Cashier "Receipts" comes back as a section, because a paid bill leaves the Floor [yes].
- Supervisor takes payment [no; the older documents say read-only].
- Supervisor on a phone has five sections and "Reservations" does not fit at 390 px [shorten to "Bookings" on phones].
- Which device each role really uses per venue (terminal, tablet, phone).

## Drawings
Canvas artifact "Nimbus POS — new screens" (version 10, 35 boards, private to the owner). Sources, kit CSS, generator scripts and PNGs: `design/screens-draft/nimbus-pos-screens-v10-source.zip` in `~/Desktop/Nimbus/POS`. Every board was rendered and measured: no clipped text, nothing outside the board, no target under 44 px, no text under 12 px, at most one filled button.

Drawn (35): floor at 1280, 1024, 1920 and phone; table tile states; bottom bar per role; life of a table; order screen for a free table, a table with an order, another waiter's table; reservations (waiter, supervisor); waiter Ready and Me; phone order, order sheet, item choices, bill; supervisor table actions, void, approvals; cashier pay, receipts, till; kitchen screen; store requests; chef ask-the-store (phone); manager order on a laptop, menu item with recipe, floor set-up; accountant costs; phones for manager (today, approve), owner (all branches), accountant (no cost yet).

Still to draw (roughly 120 to 150 boards): PIN login and lock; start and end of shift; new tab; move, join, split and discount sheets; mobile money, card and split payment; paid and receipt states; supervisor Team and Me; cashier floor and Me; bar screen; kitchen Done and Sold out; store Stock, Receive, Count; new, edit, cancel and no-show reservation; history. Manager laptop: Today, menu list, stock, staff, reports, settings (printers, devices, areas). Owner and accountant laptop screens. Phone versions of all of these. Empty, loading, error and offline states for every screen.

## Not done yet
Direction document set (structure, clean-up plan, stock model, roles matrix), the roadmap to deployment, the first build prompt (foundations: font, tokens, the kit, checks). First-hand scan of Oracle MICROS Simphony waits for the login from the owner's brother.
