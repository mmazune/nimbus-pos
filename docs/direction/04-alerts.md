# Alerts: who is told what, where, and when it stops

An alert is a row with a kind, a subject, an audience and a state (open, seen, cleared). Three rules stop the noise [P; the products read send a daily email at most]:

1. **Once per crossing.** Falling below a line makes one alert. It is not repeated on the next sale.
2. **It clears itself** when the cause is gone (stock back above the line, the request answered). Nobody has to dismiss a solved problem.
3. **It climbs** if nobody acts: the next person up is told after the wait shown.

Where alerts show: a count badge on a bottom-bar section, a one-line banner on the home screen of that role, and the manager's and owner's "Needs you" list. Stage 1 is on screen only. Messages to a phone that is not open (SMS or WhatsApp through Africa's Talking) come after go-live and need the owner's word because each one costs money.

| Kind | Raised when | First told | Climbs to, after | Clears when |
|---|---|---|---|---|
| `ITEM_LOW` | Servings left reach the low mark | Waiters (button), chef (Store badge) | — | Stock back, or sold out |
| `ITEM_SOLD_OUT` | Zero, or marked by hand | Waiters (grey button), manager (Needs you) | — | Back on |
| `LINE_UNSENDABLE` | An unsent line's item went sold out | That waiter, on the order | — | Line removed or item back |
| `STORE_LOW` | A point store item falls below minimum | Chef or bartender | Store keeper when a request is made | Above minimum |
| `REQUEST_WAITING` | A request is not answered | Store keeper | Supervisor and manager, 15 min | Issued or declined |
| `REQUEST_SHORT` | Received less than issued | Store keeper, manager | — | Manager marks it seen |
| `TO_BUY` | A feeding store falls below minimum | Store keeper, manager | Owner's day report | Delivery received |
| `STOCK_MISSING` | Take out of stock, reason missing | Manager | Owner's day report | Count done and noted |
| `STOCK_NEGATIVE` | A store level goes below zero | Store keeper | Manager, next day | Count done |
| `WASTE_OVER_LIMIT` | A waste entry above the venue's value | Supervisor (PIN) | — | Approved or declined |
| `COUNT_VARIANCE` | A count difference above the limit | Manager | Owner's day report | Note written |
| `COST_CHANGED`, `NO_COST` | Delivery price differs; item has no cost | Accountant | Manager, 7 days | Cost set |
| `TICKET_LATE` | A ticket passes the red time | Chef, that waiter (tile "Late") | Supervisor (floor shows it first) | Ready |
| `READY_WAITING` | Ready and not collected for 3 min | That waiter | Supervisor, 6 min | Collected |
| `APPROVAL_WAITING` | A request for approval | Supervisors on shift | Manager's phone, 3 min | Answered |
| `BOOKING_LATE`, `BOOKING_TABLE_BUSY` | 15 min past the time; table still in use | Supervisor (Attention), waiters (tile) | — | Seated, moved, no-show |
| `BILL_CHANGED` | Lines added after a bill was printed | Cashier and waiter (tile "Bill changed") | — | Bill printed again or paid |
| `PAYMENT_PENDING` | Mobile money not confirmed | Cashier | Supervisor, 10 min | Reference entered or method changed |
| `TILL_DIFFERENCE` | A till closes over or short above the limit | Supervisor | Manager, owner's day report | Signed |
| `DAY_NOT_CLOSED` | Business day ended with loose ends | Manager | Owner, next morning | Day closed |
| `DEVICE_DOWN` | Printer, kitchen screen or connection lost | Whoever is at it | Supervisor | Back |

Times and limits are venue settings with these defaults. A builder adds a kind only by adding a row here first.
