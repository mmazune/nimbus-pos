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

Premium menu taxonomy QA:

- Use the documented Tapas Downtown waiter above.
- `GET /api/menu/navigation?activeOnly=true` should return FOOD and DRINKS with imported browse groups/subgroups.
- Menu item, serving, and charged modifier prices come from the demo CSV/importer source and should display as whole UGX amounts such as `UGX 18,000`, `UGX 22,000`, and `UGX 40,000`.
- If Tapas Downtown shows "Menu navigation unavailable", treat it as a regression unless the API request is still loading or has failed.

## Script

1. Open `http://localhost:3000/login`.
2. Keep Quick PIN mode selected.
3. Confirm branch context shows Tapas Downtown. If the branch field is empty, use `cb27be401a2c35dfc0d4e610`.
4. Enter PIN `246810`.
5. Click `Enter`.
6. Confirm the app routes to `/waiter/floor`, shows Brian Kisekka, Tapas Downtown, the exact bottom nav `Floor`, `Reservations`, `Me`, and active shift `DEMO-WAITER-OPEN`.
7. On Floor, show filters: All, Available, Occupied, Reserved, Mine.
8. Confirm Floor cards contain no guest names; Reserved cards show Reservation/time only.
9. For premium menu QA, stay signed in as `waiter@nimbus.demo` on Tapas Downtown and choose a safe Available row.
10. Confirm one tap resumes an existing waiter-owned `NEW` draft or creates one order and immediately opens the full-screen workspace. Leave and reopen the same table; confirm the URL keeps the same `orderId`.
11. Confirm FOOD/DRINKS, group order, and subgroup order match `GET /api/menu/navigation`; search the full menu and clear search to restore the prior browse position.
12. Tap a simple item such as Bruschetta and confirm it adds immediately.
13. Open Cola and verify alternate serving selection. Open Beef Burger and verify required Size/Cooking Temp groups, optional charged Extra Toppings, quantity, and the item comment field.
14. Add the configured item, select the line to edit quantity/comment, then remove it from the focused editor.
15. Show that Request bill is blocked before send with: `Send the draft before requesting its bill.` Then use the text action `Send to kitchen/bar` and confirm sent state plus the safe post-send edit block.
16. Request bill on the sent order from Floor and confirm receipt access opens from the selected table.
16. For closed-order reprint QA, open the known legacy order URL for `ORD-TAPAS_DOWNTOWN-01171` and confirm it safely redirects into `/waiter/floor?tableId=...&orderId=...` before clicking `View receipt`.
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

## Visual Checks

- Table cards show full table identifiers, status, and seats without a Users icon.
- Occupied cards show `FirstName L.` and a separate `Mine` badge where applicable.
- Table cards do not show order numbers, `ORDER`, order status, or nested order panels.
- At 1366x768, 1440x900, and 1920x1080, order entry covers the normal Floor content with a full-screen context bar, taxonomy rail, item grid, and persistent right order panel.
- Menu tiles show only name and price/starting price. Primary send, bill, receipt, and reprint actions are text-first.

## Demo Safety Callouts

- Prompt 4 browser QA created normal demo records with labels prefixed `QA-P4-*`. They are not importer-authored canonical fixtures; use the `metadata.source = browser-qa` marker and table label prefix to distinguish them from CSV/import records.
- Earlier browser QA also left normal waiter draft/sent orders such as `ORD-000008` on `QA-OPEN-04` and later Prompt 4 QA orders on `QA-P4-*` tables. Do not silently delete them; use a documented cleanup query only when a later QA pass intentionally needs disposable tables.
- Public diner mobile-money remains excluded and pending provider confirmation.
- PesaPal is owner SaaS billing only.
- Receipt send is pending because no live email/SMS/WhatsApp adapter is connected.
- Reprint is metadata only; no printer driver is invoked.
- Card terminal/acquirer traffic is not part of this waiter demo.
- Sent-order additions cannot be safely dispatched to KDS until the backend exposes per-line sent state or a dedicated additions-send contract. Do not claim that flow is complete.
- Do not use real guest PII or provider credentials.
