# WAITER-MVP Final QA / API Coverage / Polish / Regression Report

Date: 2026-07-01  
Repo: `C:\Users\arman\Desktop\nimbus-pos`  
Scope: Final waiter workflow compliance, API coverage, UX polish, regression, and demo readiness pass. This was not a new feature milestone.

## Context Snapshot

- API: `http://localhost:3001/api`
- Web: `http://localhost:3000`
- Demo waiter: `waiter@nimbus.demo`
- Demo password: `Demo1234!`
- Demo Quick PIN: `246810`
- Expected branch: Tapas Downtown
- Expected waiter landing route: `/waiter/floor`
- Active waiter shift: `DEMO-WAITER-OPEN`
- Source-of-truth waiter docs read from `Front End/waiter-ui-docs/waiter-ui-docs/`.
- WAITER-MVP Postman collection read: `postman/collections/WAITER-MVP-Role-Workflow.postman_collection.json`.

## Local Demo Fixtures Created During QA

The existing demo import had no safe empty available Tapas table for a full order-create walk-through after prior demo actions. The following local-only demo rows were created through existing guarded APIs:

- `QA-OPEN-01`: available table used for create/add/send/request-bill QA; now occupied by `ORD-000003`.
- `QA-OPEN-02`: available table used for update/delete-before-send QA; now occupied by `ORD-000004`.
- `QA-OPEN-03` and `QA-OPEN-04`: available tables left for demo script use.
- `QA-RES-01`: reserved table with confirmed synthetic reservation `Demo Guest QA Reserved`.
- `QA-PRE-BILL-01`: table/order used to verify the pre-send Request Bill block.

All fixture data is synthetic and local. No Prisma schema, migration, seed, or Postman collection was changed.

## Waiter Workflow Compliance Matrix

| Area | Required behavior | Result |
|---|---|---|
| Login | Quick PIN primary, email/password supported, routes waiter to `/waiter/floor` through auth context | Pass. Quick PIN and email login both reached `/waiter/floor`; `/api/auth/me` resolved Brian Kisekka / Tapas Downtown. |
| Shell/nav | Bottom nav is Floor, Orders, Reservations, Me only; no Menu tab | Pass. Browser verified no Menu bottom-nav tab. |
| Header | Branch/service area, current time, waiter identity, logout preserved | Pass. Header showed Tapas Downtown, service-area placeholder, current time, Brian Kisekka, logout. |
| Shift gating | Reads work; writes require active shift; primary demo waiter has active shift | Pass. Active shift banner showed `DEMO-WAITER-OPEN`; no incorrect Start Shift blocker after hydration. |
| Floor | Only Available, Occupied, Reserved states shown; filters All/Available/Occupied/Reserved/Mine | Pass. Browser verified all filters and states; no Blocked/Cleaning labels. |
| Floor actions | Available starts order, reserved hands to reservations, own occupied opens order, other-waiter occupied read-only | Pass. Browser/API verified available/order flow, reserved data, own order detail, and other-waiter read-only copy. |
| Order builder | Menu only inside order flow; add/update/delete item through real API; item notes allowed | Pass. API verified create/add/update/delete with item notes. UI showed menu inside order detail/new flow only. |
| Send order | Uses real send endpoint and table auto-occupies after send | Pass. `POST /api/pos/orders/:id/send` returned `SENT`; table refetch returned `OCCUPIED`. |
| Orders queue | Shows waiter-owned operational orders; filters Active/Sent/Ready/Served/Closed Today; no Draft/NEW filter | Pass. Browser verified filter labels and seeded orders. Closed Today API returned 200. |
| Request bill | UI blocks before send with exact copy; sent order uses backend endpoint | Pass. UI showed `Send order before requesting bill.` and disabled button on NEW order. Sent order request-bill API returned 200. Note: backend currently accepts NEW request-bill; UI enforces MVP policy. |
| Receipts | View/history/reprint/send use real endpoints; reprint metadata only; send pending/no adapter | Pass. API and fresh browser drawer verified preview, history, reprint metadata, and pending/no-adapter send. No delivered claim. |
| Reservations | List/detail/seat only; seat uses real endpoint; no create/confirm/cancel/no-show/deposit admin actions | Pass. API seated a confirmed reservation and refetched table/orders/reservations; browser showed no admin controls. |
| Me tab | Identity, branch, active shift, self-scope attendance/leave/shift swaps, logout | Pass. Browser verified profile, branch, active shift, self-service read surfaces, disabled unavailable writes, and logout. |
| Exclusions | No payment collection, mobile-money, printer driver, terminal/acquirer traffic, manager/admin waiter actions | Pass. No excluded actions were added or exposed. |

## Waiter API Coverage Matrix

| Waiter action | UI route/component | Backend endpoint | Method | Request shape | Success behavior | Blocked/error behavior | Verification |
|---|---|---|---|---|---|---|---|
| Quick PIN login | `/login` | `/api/auth/quick-pin-login` | POST | `{ branchId, pin }` | Stores session and routes to `/waiter/floor` | Disabled until branch/PIN valid; auth errors stay on login | Browser pass |
| Email login | `/login` | `/api/auth/login` | POST | `{ email, password }` | 201, session stored, routes to `/waiter/floor` | Invalid/forbidden copy handled | Browser/API pass |
| Auth context | shell/session guard | `/api/auth/me` | GET | Bearer token | Resolves branch/org/role/permissions | Auth failure clears session | API/browser pass |
| Logout | shell/Me tab | `/api/auth/logout` | POST | Bearer token | Clears local session and returns to login | Local clear still happens safely | Browser pass |
| Active shift | shell/Me tab | `/api/shifts/active` | GET | branch header | Shows `DEMO-WAITER-OPEN` | Missing shift shows Start Shift state | API/browser pass |
| Start shift | Me tab | `/api/shifts/open` | POST | `{ notes? }` | Starts shift if allowed and none open | Disabled while active shift exists | Code/API contract checked |
| End shift | Me tab | `/api/shifts/:id/close` | POST | `{ notes? }` | Ends active shift if clicked | Not clicked to preserve demo active shift | UI/API contract checked |
| Floor table list | `/waiter/floor` | `/api/tables` | GET | branch header | 28 local tables after QA fixtures | Error state if unavailable | API/browser pass |
| Table detail | floor/detail panel | `/api/tables/:id` | GET | table id | Detail/refetch after send/seat | Read-only blocked state for other waiter | API/browser pass |
| Create order | `/waiter/orders/new`, available table | `/api/pos/orders` | POST | `{ serviceType:"DINE_IN", tableId, notes? }` | Created `ORD-000003`, `ORD-000004`, etc. | Requires active shift | API pass |
| Order detail | `/waiter/orders/[orderId]` | `/api/pos/orders/:id` | GET | order id | Detail, items, totals, bill state render | Other-waiter ownership blocked by backend | API/browser pass |
| Add item | order builder | `/api/pos/orders/:id/items` | POST | `{ menuItemId, menuItemServingId?, quantity, notes? }` | Item added with kitchen note | Disabled without active shift / unsafe state | API pass |
| Update item | order builder | `/api/pos/orders/:id/items/:itemId` | PATCH | `{ quantity?, notes?, metadata? }` | Quantity/note updated before send | Disabled after send/closed | API pass |
| Delete item | order builder | `/api/pos/orders/:id/items/:itemId` | DELETE | item id | Unsent line removed | Disabled after send/closed | API pass |
| Send order | order builder | `/api/pos/orders/:id/send` | POST | `{ reason? }` | Order became `SENT`; table became `OCCUPIED` | Unsafe waiter transitions not exposed | API/browser pass |
| Request bill | bill panel | `/api/pos/orders/:id/request-bill` | POST | order id | Sent order returned bill requested | NEW order blocked in UI with exact copy | API/browser pass |
| Receipt view | receipt drawer | `/api/receipts/:id` | GET | receipt/order id | Closed order preview loaded | Unavailable receipt shows calm error | API/browser pass |
| Receipt history | receipt drawer | `/api/receipts/:id/history` | GET | receipt/order id | History showed viewed/reprint/send events | History error isolated | API/browser pass |
| Reprint | receipt drawer | `/api/receipts/:id/reprint` | POST | `{ reason, copies }` | Records `RECEIPT_REPRINTED`; no driver | No physical printer claim | API/browser pass |
| Send receipt | receipt drawer | `/api/receipts/:id/send` | POST | `{ channel:"email"|"sms"|"whatsapp", recipient, locale?, note? }` | 202 `PENDING`, `supported:false`, `NO_LIVE_DELIVERY_ADAPTER` | Disabled until recipient entered; no delivered claim | API/browser pass |
| Orders list | `/waiter/orders` | `/api/pos/orders?userId=me...` | GET | status/exclude filters | Waiter-owned operational orders render | Closed Today did not crash | API/browser pass |
| Menu catalog | order builder | `/api/menu/catalog` | GET | branch header | Categories/items render | Menu errors isolated | API/browser pass |
| Menu item detail | order builder details | `/api/menu/items/:id` | GET | menu item id | Used by item configuration | Unavailable options fall back safely | Code/API contract checked |
| Servings | order builder details | `/api/menu/items/:id/servings` | GET | menu item id | Supports serving selection | Fallback to catalog servings | Code/API contract checked |
| Modifier groups | order builder details | `/api/menu/items/:id/modifier-groups` | GET | menu item id | Supports item configuration metadata | Optional; not required for basic add | Code/API contract checked |
| Modifier options | order builder details | `/api/menu/modifier-groups/:id/options` | GET | group id | Supports modifier option metadata | Optional; not required for basic add | Code/API contract checked |
| Reservations list | `/waiter/reservations` | `/api/reservations/upcoming`, `/api/reservations` | GET | branch header | Upcoming list rendered | Empty/error states present | API/browser pass |
| Reservation detail | reservations/detail | `/api/reservations/:id` | GET | reservation id | Detail panel data verified | Missing reservation handled | API/browser pass |
| Seat guest | reservations/detail | `/api/reservations/:id/seat` | PATCH | `{ tableId?, createOrder:true, orderNotes? }` | Reservation became `SEATED`; table `OCCUPIED`; order created | Requires active shift and seatable state | API/browser pass |
| Attendance mine | Me tab | `/api/hr/attendance?mine=true` | GET | self scope | Self-scope card rendered | Missing employee link disables writes | API/browser pass |
| Leave mine | Me tab | `/api/hr/leave?mine=true` | GET | self scope | Self-scope card rendered | Create disabled without employee id | API/browser pass |
| Shift swaps mine | Me tab | `/api/hr/shift-swaps?mine=true` | GET | self scope | Self-scope card rendered | Create not exposed without target selector | API/browser pass |

Explicit exclusions:

- Public mobile-money checkout: excluded, still pending provider confirmation.
- Live printer dispatch: excluded, metadata-only reprint path verified.
- Card terminal/acquirer traffic: excluded, terminal pairing remains stub-only.
- PesaPal: owner SaaS billing only, not waiter/diner payment collection.

## Closed Today Filter 500 Diagnosis

Known issue investigated: waiter list query with `status=CLOSED` had previously returned 500.

Reproduced request:

```text
GET /api/pos/orders?userId=me&status=CLOSED&excludeStatus=NEW&pageSize=5
```

Current result:

- Status: 200
- Count: 5
- First closed order: `ORD-TAPAS_DOWNTOWN-01171`
- UI: `/waiter/orders` showed `Closed Today` filter and did not crash.

Diagnosis:

- Frontend query shape is valid.
- Backend DTO/service currently handles `status=CLOSED` plus `excludeStatus=NEW`.
- Branch context and waiter ownership scope are valid.
- No code fix was required. The earlier 500 was most consistent with stale server/token/transient local process state.

## Demo Data Health

Command:

```pwsh
corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate
```

Result:

- 63 CSVs discovered.
- 9,243 rows validated.
- `zeroDatabaseWrites: true`.
- Safety checks passed for mobile-money, PesaPal, receipt, printer, terminal, HMS, order/payment/AP/AR/GL totals.
- Warnings were expected skipped/non-schema CSV notes only.
- Waiter login/API checks confirmed role Waiter and 51 permissions.
- Active waiter shift exists.

## Browser Verification Summary

- `/login` rendered without framework overlay.
- Quick PIN mode accepted Tapas Downtown branch and PIN `246810`.
- `Enter waiter workspace` enabled and submitted once.
- Quick PIN login restored session, called auth context, and routed to `/waiter/floor`.
- Email/password login for `waiter@nimbus.demo` / `Demo1234!` routed to `/waiter/floor`.
- Browser verified waiter floor, orders, order detail, closed receipt drawer, reservations, and Me tab at 1440x900.
- Long-lived browser sessions can show transient `Restoring waiter session` or cached receipt-unavailable states; fresh login resolved these and drawer preview/history loaded correctly.

## UI Polish

Minimal polish fix:

- `apps/web/src/components/waiter/floor/WaiterTableCard.tsx`: long order numbers on table cards now use `break-all leading-5` to avoid awkward overflow/wrapping in dense table cards.

Observed UX notes:

- Receipt action buttons may require scrolling the order page/right panel on 1440x900 when the order has enough menu content. The final fresh-session verification confirmed the drawer opens and actions work.
- The Me tab correctly shows the employee-link gap and disables HR writes that require an employee record.

## Validation Commands

```pwsh
corepack pnpm@8.15.0 --version
corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint
corepack pnpm@8.15.0 --filter @nimbus-pos/web build
```

Results:

- pnpm version: `8.15.0`
- Demo validation: pass.
- Web typecheck: pass.
- Web lint: pass, no warnings/errors.
- Web build: pass on second run with longer timeout. First run exceeded 240s without source error; second run completed successfully in about 272s.

Route/health smoke:

- `GET http://localhost:3001/api/health`: 200, db ok.
- `GET http://localhost:3000/login`: 200.
- `GET http://localhost:3000/waiter/floor`: 200.
- `GET http://localhost:3000/waiter/orders`: 200.
- `GET http://localhost:3000/waiter/orders/c24804b0a8e6aa5adad14cd5`: 200.
- `GET http://localhost:3000/waiter/reservations`: 200.
- `GET http://localhost:3000/waiter/me`: 200 on longer retry; first 25s request timed out in dev SSR smoke.

## Safety Verification

- Demo actions wrote only to the local database.
- Receipt send remains pending/no adapter.
- Reprint remains metadata/audit only.
- No print-driver invocation.
- No terminal/acquirer/card traffic.
- No public diner mobile-money checkout.
- No PesaPal diner flow.
- No fake provider credentials.
- No real PII; QA fixture data uses synthetic `Demo Guest` names and `nimbus.test` email addresses.
- No Prisma schema changes.
- No migrations created.
- No Postman changes.
- No backend guard weakening.

## Known Limitations

- Backend `POST /api/pos/orders/:id/request-bill` currently accepts a NEW order; the waiter UI correctly blocks that path before send with `Send order before requesting bill.`.
- The Me tab cannot perform attendance clock/leave create because `GET /api/auth/me` does not return a safe linked employee id for this waiter. Reads remain self-scoped and safe.
- Shift swap creation remains read-only because the existing create contract requires a target employee selector that is not waiter-safe in this MVP.
- Local QA fixtures were created after demo import; a future DB reset/import will remove them unless equivalent demo fixtures are added intentionally.

## Completion

WAITER_MVP_FINAL_QA complete / demo-ready.
