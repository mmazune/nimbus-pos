# Scenarios of a real day, and the rule for each

The owner, 26 Nov 2026: "The system should not be rigid. It should be flexible… come up with all scenarios of a restaurant and make sure to include them." The full register of 121 scenarios with what other products do is `research/E_scenarios_and_small_features.md`. This file is the ruling for each kind: what Nimbus does, and the milestone that builds it (see `06-roadmap.md`). Flexible means the staff can always carry on; controlled means it is always written down with a name and a reason.

## Opening
| Scenario | Rule | In |
|---|---|---|
| Yesterday was not closed | Today opens. A banner asks the manager to close yesterday; its loose ends are listed. | E11 |
| Chef arrives | Sees yesterday's sold-out list: "still sold out?" One tap each. | E2 |
| A delivery came before the store keeper | Anyone with the right receives it; it can be received with no order. | E7 |
| Staff start work | PIN, then "Start my shift". Reading works off shift; selling needs a shift. | U1 |

## Seating
| Scenario | Rule | In |
|---|---|---|
| Walk-in | Tap a free table. Nothing is saved until Send. | U2 |
| Booking arrives, table still in use | Seat at another free table that fits, or wait; the booking moves with them. | U4 |
| Guests move | Move table: the order goes with them. | E3, U3 |
| Two tables become one party | Join: one bill. Can be split again later. | E3, U3 |
| Standing guests, busy night | A tab in the Tabs area, numbered by itself, with a note ("red cap at the bar"). | E3, U1 |
| Extra tables put out mid-service | Supervisor or manager adds tables in bulk; they appear at once. | E3, U7 |

## Ordering
| Scenario | Rule | In |
|---|---|---|
| Allergy | A flag on the line, in red at the top of the ticket, kept for later rounds on that table. | E5, U2 |
| Special request | A note on the line. | exists |
| Not on the menu | Open item with a name and a price: waiter up to the venue's cap, above it a supervisor's PIN. Listed under Exceptions. | E13 |
| Same again | Repeat round: one tap re-adds the last sent drinks. | U2 |
| Six of one thing | Tap 6, then the item. | U2 |
| Starters now, mains later | Hold a line; Fire sends it. Three seconds to undo a fire. | E5, U2 |
| Who had what | Seat number on a line (optional per venue); bills split by seat. | E13 |
| Wrong table | Move the line to the right table; no void. | E3 |
| Changed mind before Send | Remove; nothing recorded. | exists |
| Changed mind after Send | Void with a reason and "was it made?". | E1 |
| Dish runs out mid-service | `02-life-cycles.md` section 5. | E2, E10 |
| Happy hour | A price that applies between set hours on set days. | E13 |
| Takeaway from a table | A flag on the line; the ticket says "Takeaway". | E5 |

## Kitchen and bar
| Scenario | Rule | In |
|---|---|---|
| Rush | Oldest first, colour by age, "to make now" totals across all tickets. | U5 |
| Dish burnt or dropped | Remake: stock out again, reason kitchen error. | E6 |
| Ticket bumped by mistake | Bring it back from Done. | E5 |
| Printer or screen fails | `02-life-cycles.md` section 12. | E12 |
| Bottle finished at the bar | Bar store drops by measure; below minimum the request is suggested. | E6, E7 |

## Money
| Scenario | Rule | In |
|---|---|---|
| Split by guest, item or amount; split evenly | All four. Evenly is "tap 4". | E3, U3 |
| One guest pays part | Part payment; the table shows what is left. | exists, U3 |
| Deposit from a booking | Shown on the bill and taken off. | U3 |
| Discount | Named discounts for waiters; a free percentage needs a PIN; a cap per role. | E9 |
| On the house, staff meal | Their own actions with a reason and for whom; never a 100% discount. | E13 |
| Service charge, tip | A venue setting: a percentage added, or a tip line at payment. | E13 |
| Mobile money sent, no confirmation yet | Payment is "Pending"; the tile says "Paying"; the cashier enters the reference or changes the method. Left pending at close: on the close list. | E13 |
| Card declined | Nothing is recorded; choose another method. | U3 |
| Cash more than the bill | Change is shown and recorded. | E1 |
| Bill printed, then more ordered | Tile "Bill changed"; the payment screen shows the printed total and the new one. | E4, E10 |
| Refund after close | Same day: supervisor. Later: manager. Always tied to the bill. | E9 |
| Wrong method recorded | Before the till is counted: supervisor PIN. After: a correction entry by the manager. | E13 |
| Walk-out | Manager closes the table as a walk-out with a reason; its own total. | E13 |
| Drawer opened with no sale | Needs a reason; counted on the till report. | E13 |

## Stock
| Scenario | Rule | In |
|---|---|---|
| Delivery short, over, or dearer | Recorded line by line at receiving. | E7 |
| Spoiled, expired, broken, missing | Take out of stock with a reason. | E6 |
| Count during service | Allowed; each line is compared at its own minute. | E7 |
| Books say zero, shelf says ten | We have it, then a count. | E10 |

## People
| Scenario | Rule | In |
|---|---|---|
| Waiter goes home with open tables | Hand over one table or all, to a named colleague who accepts. End of shift is blocked until done. | E3, U4 |
| Forgot PIN | A manager sends a reset; nobody ever sets or sees another person's PIN. | exists |
| Shared terminal | Locks after 15 minutes idle; Lock is one tap; the next person is in with a PIN. | U1 |
| Supervisor not on the floor | The request reaches every supervisor on shift, then the manager's phone. | E9, U7 |

## Closing
| Scenario | Rule | In |
|---|---|---|
| Till over or short | Small difference passes; above the limit the supervisor signs. Blind count is a venue setting. | U3, E11 |
| Tables open at close, guests past midnight | `02-life-cycles.md` section 11. | E11 |
| The owner wants the numbers | The day report reaches Today on their phone the moment the day is closed. | E11, U9 |

## Sensitive actions: flexible, but never silent
| Action | Who alone | With a PIN | Always recorded |
|---|---|---|---|
| Change a price on a line | — | Supervisor | Old and new price, reason |
| Open item | Waiter, to the cap | Supervisor above it | Name, price |
| Discount | Named ones, to the role's cap | Supervisor for more | Reason |
| On the house | Supervisor, manager | — | Reason, for whom |
| Void a sent line | Supervisor, manager | Waiter asks | Reason, made or not |
| Refund | Supervisor same day | Manager later | The bill it belongs to |
| Reopen a paid bill | — | Supervisor same day | Reason |
| Open the drawer, no sale | Cashier | — | Reason |
| Delete a tab | Anyone if empty | Never if it has sent lines | — |
| Change payment method | — | Supervisor before the count | Old and new method |

## Decided against, for now
Guest-facing QR ordering, loyalty points, delivery-app links, table-side card readers wired to the till, kiosk ordering, tip pooling, dynamic pricing, kitchen video, voice ordering, and batch or expiry-date tracking. None helps a first Ugandan table-service venue open, and each can be added after go-live.
