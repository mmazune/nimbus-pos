# Waiter UI Demo Script

Use repo: `C:\Users\arman\Desktop\nimbus-pos`

Demo URLs:

- API: `http://localhost:3001/api`
- Web: `http://localhost:3000`

Demo waiter:

- Email: `waiter@nimbus.demo`
- Password: `Demo1234!`
- Quick PIN: `246810`
- Branch: Tapas Downtown

## Script

1. Open `http://localhost:3000/login`.
2. Keep Quick PIN mode selected.
3. Confirm branch context shows Tapas Downtown. If the branch field is empty, use `cb27be401a2c35dfc0d4e610`.
4. Enter PIN `246810`.
5. Click `Enter`.
6. Confirm the app routes to `/waiter/floor`, shows Brian Kisekka, Tapas Downtown, bottom nav, and active shift `DEMO-WAITER-OPEN`.
7. On Floor, show filters: All, Available, Occupied, Reserved, Mine.
8. Open an available table. Use `QA-OPEN-04` if present, otherwise use any Available table.
9. Start/create the dine-in order and confirm the menu opens inside the table/order flow, not as a bottom-nav tab.
10. Add one menu item.
11. Add an item/kitchen note.
12. Show that Request bill is blocked before send with: `Send order before requesting bill.`
13. Send the order to kitchen/bar.
14. Confirm the table/order refreshes to sent/occupied state.
15. Request bill on the sent order.
16. Open a closed demo order from Orders, such as `ORD-TAPAS_DOWNTOWN-01171`, and click `View receipt`.
17. Show the receipt drawer: branch, table, server, line items, totals, paid/outstanding.
18. Show receipt history.
19. Click Reprint and call out that it records metadata only; no physical printer driver fires.
20. Enter a synthetic recipient such as `demo-recipient@nimbus.test`.
21. Click Send receipt and show pending/no-adapter copy. Do not claim email/SMS/WhatsApp delivery succeeded.
22. Open Reservations.
23. Show the reservation list and filters.
24. Open confirmed reservation `Demo Guest QA Reserved` on `QA-RES-01` if present, otherwise another confirmed assigned reservation.
25. Click Seat Guest only on a confirmed, assigned, safe demo reservation.
26. Confirm success refetches reservations/floor/orders and table state becomes occupied when the backend returns it.
27. Open Me.
28. Show identity, branch/service area, active shift, attendance, leave, and shift-swap self-service cards.
29. Confirm HR/admin manager actions are not exposed; unsafe self-service writes are disabled when employee/target context is missing.
30. Click Logout and confirm the terminal returns to `/login`.

## Demo Safety Callouts

- Public diner mobile-money remains excluded and pending provider confirmation.
- PesaPal is owner SaaS billing only.
- Receipt send is pending because no live email/SMS/WhatsApp adapter is connected.
- Reprint is metadata only; no printer driver is invoked.
- Card terminal/acquirer traffic is not part of this waiter demo.
- Do not use real guest PII or provider credentials.
