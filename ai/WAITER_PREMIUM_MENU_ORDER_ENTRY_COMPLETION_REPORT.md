# Nimbus POS — Waiter Premium Menu Order Entry Completion Report

Date: 2026-07-16  
Repository: `C:\Users\arman\Desktop\nimbus-pos`  
Scope: Prompt 2 frontend waiter order-entry redesign  
Status: Complete with documented backend/demo limitations

## 1. Repository findings

- Prompt 1 was present as uncommitted working-tree work and was preserved.
- The waiter shell already had the required Floor, Reservations, Me navigation.
- The previous order builder used a narrow table workspace and large detailed menu cards.
- `NEW` was missing from the Floor active-order set, creating a duplicate-draft risk.
- Floor mounted two responsive `WaiterTableWorkspace` instances and hid one with CSS. Authenticated QA proved both existed, so both could race list-first/create behavior.
- Order items have no per-line sent/unsent dispatch state. Post-send additions remain unsafe.
- `waiter@demo.local` returns the seeded M6/M6.1 FOOD/DRINKS taxonomy. Tapas Downtown for `waiter@nimbus.demo` currently returns an empty navigation array.
- Order-item PATCH does not accept `menuItemServingId`; serving is selectable on add but read-only on edit.

## 2. API and Postman contracts used

Every existing collection under `postman/collections/` was listed, parsed, and skimmed. These requested canonical collections were mapped in detail:

- `M6-Menu-Catalog.postman_collection.json`
- `M6_1-Menu-Taxonomy-Serving-Formats.postman_collection.json`
- `M7-Menu-Modifiers.postman_collection.json`
- `M10-POS-Orders.postman_collection.json`
- `WAITER-MVP-Role-Workflow.postman_collection.json`

Verified reads:

- `GET /api/menu/navigation?activeOnly=true` → ordered section rows with active groups/subgroups.
- `GET /api/menu/catalog` → categories containing items, browse assignments, price, and servings.
- `GET /api/menu/items/:id` → item detail with servings and nested modifier groups/options.
- `GET /api/menu/items/:id/servings` → active/default/sort serving metadata.
- `GET /api/menu/items/:id/modifier-groups` and `GET /api/menu/modifier-groups/:id/options` → required/min/max/sort/price-delta contracts.

Verified writes:

- `POST /api/pos/orders/:id/items` accepts item, optional serving, quantity, notes, and modifier metadata.
- `PATCH /api/pos/orders/:id/items/:itemId` accepts quantity, notes, and metadata only.
- `DELETE /api/pos/orders/:id/items/:itemId` returns `{ deleted: true }`.
- `POST /api/pos/orders/:id/send` performs the safe draft send transition.

No endpoint, DTO, schema, migration, seed row, or Postman collection changed. A new collection was not justified because this milestone only consumes existing contracts.

## 3. UX research findings

Official sources reviewed:

- [Toast modifier-group display order](https://support.toasttab.com/en/article/Editing-Managing-Modifier-Group-Display-Order?lang=en_US)
- [Toast required and optional modifiers](https://doc.toasttab.com/doc/platformguide/adminAddingModifierGroupsAndModifiers.html)
- [Square restaurant menus](https://squareup.com/help/us/en/article/6424-create-menus-with-square-for-restaurants)
- [Square item modifiers](https://squareup.com/help/us/en/article/5119-create-and-manage-item-modifiers)
- [Lightspeed menus and items](https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260804647349-About-menus-and-items)
- [Lightspeed categories](https://resto-support.lightspeedhq.com/hc/en-us/articles/226404428-Creating-categories)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)

Applied conclusions: keep customer browse taxonomy separate from internal routing/reporting categories; honor manager order and active state; use direct tiles; expose ordered modifier constraints and price deltas; keep the active order visible; and use 44px-class or larger operational targets. No competitor branding or exact interface was copied.

## 4. Navigation architecture

The canonical order workspace replaces normal Floor content:

- top: Back to Floor, full table, order state, ownership, order number, waiter, item count, total;
- left: API sections and browse groups;
- centre: subgroups, whole-menu search, minimal item grid;
- right: active order, totals, send, bill, and receipt actions.

Only one table workspace is mounted. URL-backed `tableId` and `orderId` survive refresh and browser Back/Forward.

## 5. Menu hierarchy implementation

- `/api/menu/navigation` is the primary taxonomy.
- Section order is preserved; active groups/subgroups use API `sortOrder` with name only as a tie-break.
- Catalog items are filtered by browse group/subgroup assignment.
- Search spans all assigned active items; clearing it preserves prior category position.
- Internal category, tax, station, key, and ID fields are not rendered.
- Empty navigation shows an honest manager-configuration state, never hardcoded fallback categories.

## 6. Item-tile redesign

Normal tiles show only item name and price/`From` price. The tile is the selection target. Available badges, categories, descriptions, Details/Add buttons, modifier icons, imagery, and excess whitespace were removed. Inactive/unavailable items cannot be selected. Simple items add immediately after verified detail; configurable items open the shared configurator.

## 7. Configurator behavior

The full-height side sheet provides item name, effective configured total, quantity 1–99, serving, sorted modifier groups/options, Required/Optional state, understandable selection guidance, Included/price-delta copy, item comment, Add/Update, and focused Remove.

Required minimums, maximums, single-choice replacement, inactive-option filtering, and valid quantity are enforced. Selected modifiers persist through the existing `metadata.selectedModifiers[]` contract. Priced additions stay modifiers; comments stay free notes. Serving is read-only on edit because PATCH cannot change it.

## 8. Order-panel behavior

- Lines are single edit targets showing quantity, item, serving, modifiers, comment, and subtotal.
- Remove lives in the editor rather than per-line button clutter.
- Footer shows returned subtotal, nonzero tax, nonzero discount, and total.
- The main text action is `Send to kitchen/bar`.
- Successful send refreshes order/Floor queries and shows one success toast; failure never claims receipt by kitchen/bar.
- After send, item mutation is blocked with the truthful per-line dispatch limitation.

## 9. Floor-card changes

Cards show complete table identifier, Available/Occupied/Reserved, assigned waiter for Occupied, separate Mine badge, seat capacity, and reservation time without guest identity. Guest names were removed from card render and search. Consistent minimum height and long-identifier wrapping remain.

## 10. Bill and receipt behavior

The workspace retains Request bill, View bill or receipt, Receipt history, Reprint receipt, and pending receipt send. Primary controls are text-first. There are no payment methods, settlement, or Close Order controls. Request bill records only the backend signal. Reprint is lifecycle-gated and records metadata/audit only; no printer-driver completion is promised. Sending remains pending without a live adapter.

## 11. Files changed

Prompt 2 implementation/doc files:

- `PRODUCT.md`
- `apps/web/src/lib/waiter/order-api.ts`
- `apps/web/src/lib/waiter/order-model.ts`
- `apps/web/src/lib/waiter/floor-model.ts`
- `apps/web/src/components/waiter/floor/WaiterFloorScreen.tsx`
- `apps/web/src/components/waiter/floor/WaiterTableCard.tsx`
- `apps/web/src/components/waiter/floor/WaiterTableWorkspace.tsx`
- `apps/web/src/components/waiter/orders/WaiterOrderBuilderScreen.tsx`
- waiter bill/receipt components
- `apps/web/README.md`
- waiter README/lifecycle/design/blueprint docs
- `demo-data/WAITER_UI_DEMO_SCRIPT.md`
- `ai/WAITER_MVP_KNOWN_LIMITATIONS.md`
- `ai/AI_STATUS.md`
- `repo file tree.txt`
- this report.

Prompt 1 working-tree changes were preserved and not reverted.

## 12. Validation results

Passed:

- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` — no warnings/errors
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web build`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate` — 63 CSVs, 9,243 rows, zero writes
- `GET /api/health` — status/db OK
- waiter emoji and Floor-card guest-name scans
- all 56 collections present at initial audit parsed as valid JSON; repository status tracks 57 total including the waiter workflow collection.

No standalone web test script exists. Authenticated Playwright coverage served as the relevant end-to-end regression.

## 13. Authenticated QA results

Account: `waiter@demo.local`, branch `cmqlcjlo700umwp6lodyywf56`. QA opened shift `cmrnkr5880021ib4vj3njihl2` through the existing shift contract.

Passed: login; Floor render; five live guest names compared with no card leak; Available direct-to-menu; same-order draft resume; FOOD/DRINKS/group/subgroup API order; search restore; Bruschetta quick-add; Cola serving selection; Beef Burger required Size/Cooking Temp plus optional charged Extra Toppings; quantity/comment persistence; exact-line edit/remove; safe send and post-send block; bill/receipt/history permissions; reprint gate; pending-adapter copy; no emoji/payment/close controls; exact receipt close; refresh/Back/Forward restoration; and zero Playwright page errors/failed requests.

QA sent demo orders `cmrnkteph002bib4vnh9eqzrj` and `cmqlcno7c015iwp6lcebw6qu2`; bill request was exercised on the latter. Reservation seating was not repeated because that would consume another live demo reservation. The code path uses returned `seatedOrderId` and the same builder; prior waiter QA covers the real seat endpoint.

## 14. Viewport results

Playwright geometry assertions and visual inspection passed at 1366×768, 1440×900, and 1920×1080. The workspace filled the viewport, right panel remained at least 350px wide, menu tiles retained operational height, and bottom navigation did not reduce the order canvas. Screenshots were written outside the repository to `%TEMP%\nimbus-waiter-qa\`.

## 15. Known limitations

- Post-send additions remain blocked until a per-line dispatch/additions contract exists.
- Existing-line serving cannot change through current PATCH.
- Tapas Downtown has no configured navigation rows; the M6 branch is used for taxonomy QA.
- UI blocks request bill for `NEW` even though backend currently accepts it.
- Waiter cannot collect payment or close orders.
- Reprint is metadata/audit only; receipt send lacks a live adapter.
- Full reprint execution was not performed on newly sent QA orders because only cashier/payment close makes them eligible; the authenticated UI correctly kept it disabled.

## 16. Final status

Prompt 2 is complete. Static validation, authenticated functional QA, and all required viewport checks passed. No commit/push was created. No backend, Prisma, migration, seed, package, or Postman contract changed.
