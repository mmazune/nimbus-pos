# Decisions for the rebuild (26 Nov 2026)

Owner: Moses. On 26 Nov 2026 he saw the 35 drawings and said: "now we're going to start building." The drawings are approved as the target. These decisions sit above older entries in `docs/DECISIONS.md` where they differ; nothing older is deleted.

| ID | Decision | Replaces |
|---|---|---|
| R1 | One tap on a table opens the same full-screen order screen for every role. Rights change the buttons, not the screen. | The docked sheet for cashier and supervisor and the inline card for manager |
| R2 | A free table tapped saves nothing. The order exists from the first Send. | Draft order created on tap |
| R3 | The menu is two levels above the item: Food or Drinks, then a group. "Popular" and "Offers" are the first two groups. Measures are buttons on the item row. Search covers the whole menu. | Flat categories, chips that scroll sideways |
| R4 | Lines are sent, not orders. A waiter adds to a table at any time until it is paid; each Send sends only the unsent lines, and the kitchen or bar gets a ticket every time. | Only the first send reached the kitchen |
| R5 | The filled button follows state and role: Send when there are unsent lines; otherwise Print bill (waiter, supervisor) or Take payment (cashier, manager). | — |
| R6 | A sent line is never deleted. It is voided, with who, when, why, and whether it was made. Voiding a sent line needs `pos:order:item:void` (owner, manager, supervisor). | Whole-order void only |
| R7 | Payment closes the order through one door. That door frees the table and completes a linked reservation. Cash given may be more than the bill; the change is recorded. | Table stayed occupied after payment; cash had to equal the bill |
| R8 | Touch roles keep the navy bottom bar: 76 px, equal sections 56 px high, icon beside label, the current one a white block. | D-NAV sections (see R9); D-DENSITY sizes for new screens |
| R9 | Sections: waiter Floor, Reservations, Ready, Me. Cashier Floor, Receipts, Till, Me. Supervisor Floor, Reservations, Approvals, Team, Me. Kitchen or bar screen Tickets, Done, Sold out, Store. Store keeper Requests, Stock, Receive, Count, Me. No Orders, no Menu. | D-NAV: waiter 3, cashier 3, supervisor 4 |
| R10 | New screens use the px sizes in `design/screens/kit.css`. The viewport-scaled root font size (D-DENSITY) stays only until the last old screen is replaced, then goes. | D-DENSITY for new work |
| R11 | Floor: one area at a time; roomy tiles when they fit, compact when not, then scroll down, never sideways. A "Tabs" area holds tabs for standing guests. | Auto-fill grid of 152 px cards |
| R12 | Stock leaves the store when a line is sent. An item is sold as bought, as a measure, from a recipe, or not tracked. Units are count, weight or volume. | A sale did not touch stock |
| R13 | One link for every device. Every screen is drawn and built for a phone and for its main device. Manager, owner and accountant keep a top bar on a laptop and get a bottom bar on a phone. | — |
| R14 | Manager has full access (owner, 21 Aug 2026) except `pos:hr:compensation:read`. Waiter, cashier and supervisor never get accounting or procurement rights. Unchanged. | — |

## Waiting for the owner (the default is built until he says otherwise)

1. A waiter may seat a booking at another free table when the booked one is still in use. Default: yes.
2. A supervisor takes payment. Default: no.
3. After payment a table goes straight to Free. A "Cleaning" step is a venue setting, off by default. (The life-of-a-table drawing shows it on.)
4. On a phone the supervisor's bar says "Bookings", not "Reservations", so five sections fit. Default: yes.
