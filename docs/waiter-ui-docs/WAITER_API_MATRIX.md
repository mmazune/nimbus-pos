# Waiter API Matrix

Status: **Canonical (waiter)** — first API matrix for the Waiter role. Derived from the
implemented client (`apps/web/src/lib/waiter/*.ts`, `apps/web/src/components/waiter/**`,
`apps/web/src/lib/auth/auth-api.ts`) and the NestJS controllers in `apps/api/src/modules/**`.
Date: 2026-08-20.

> **Live verification (2026-08-20, isolated local stack).** Every row below was checked against
> a disposable local stack — API `http://localhost:3001` (global prefix `api`), local seeded
> Postgres, waiter `waiter@nimbus.demo` at branch `cb27be401a2c35dfc0d4e610`. `POST /api/auth/login`
> returned **201**. Every **GET** the Waiter UI issues was executed with
> `Authorization: Bearer <token>` + `X-Branch-Id` and its observed HTTP code recorded. Mutations
> were **not** executed unless they were (a) against rows this pass created and tagged
> `WAITER-DOCS-QA`, or (b) rejected-by-design probes that change no state; every other write is
> marked *not exercised (mutation)* and confirmed by controller route registration
> (`@Post/@Patch/@Delete` + `@Permissions` decorators, cited per row).
>
> **RESOLVED (same day):** two live 500s were initially observed — `GET /api/receipts/:id` and
> `POST /api/pos/orders/:id/items`, both `[DecimalError] Invalid argument`. Root cause was the
> **QA harness itself**, not the product: this isolated stack runs Prisma through a WASM
> query-engine + pg driver-adapter shim (the sandbox cannot download native Prisma engines),
> and the shim's Decimal class was not identity-unified with the runtime the compiled API
> imports. After unifying the Decimal class in the QA shim, both endpoints were **re-verified
> live: `POST …/items` → 201, `GET /api/receipts/:id` → 200** (populated receipt renders in
> the drawer). The rows below record the final verified status. Original observations
> thrown from the compiled `apps/api/dist/**` money paths. See §7 *Live defects*.

## Rules

- Effective base URL is `{{baseUrl}}/api/...` with `baseUrl = http://localhost:3001`
  (`apps/web/src/lib/api/client.ts` strips a trailing `/api` from `NEXT_PUBLIC_API_BASE_URL`).
- Every protected waiter call carries `Authorization: Bearer <accessToken>` **and**
  `X-Branch-Id`. Verified live: missing `X-Branch-Id` → **400** `X-Branch-Id header is required`;
  missing token → **401**.
- Every waiter request also carries `Accept: application/json` and a generated `X-Request-Id`;
  the client applies a 30 s `AbortController` timeout (`apiRequest`).
- All money is UGX, Decimal strings end-to-end; the UI formats zero-fraction (D-CURRENCY).
- Visible waiter nav is **Floor · Reservations · Me** (`lib/waiter/routes.ts`). There is **no
  Orders tab** (D-NOORDERS); order work is reached from Floor after table selection.
- The Waiter UI calls **no** payment, close, till, void, refund, discount, KDS-state, or
  reservation-admin endpoint. Where the seeded role nevertheless *holds* the permission, that is
  called out in §6.

### Verified-status legend

| Value | Meaning |
| --- | --- |
| `200` / `201` / `400` / `403` / `409` / `500` | HTTP code observed live on 2026-08-20 against the isolated stack. |
| `not exercised (mutation)` | Deliberately not executed; existence + guard confirmed from the controller decorator cited in the row. |

---

## 1. Auth / session

Client: `apps/web/src/lib/auth/auth-api.ts`, `apps/web/src/lib/auth/AuthProvider.tsx`,
`apps/web/src/pages/login.tsx`.
Backend: `apps/api/src/modules/auth/auth.controller.ts`.

| Method | Path | Purpose (waiter) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/quick-pin-login` | **Primary** frontline login on a shared terminal. | `auth.controller.ts` `@Post('quick-pin-login')` | Public (no `@UseGuards`) | `{ branchId, pin, platform: "POS_DESKTOP" }`; branch id comes from `localStorage` station key / `NEXT_PUBLIC_DEFAULT_BRANCH_ID`. PIN must be **exactly 6 or 8 digits** (`QuickPinLoginDto` `/^\d{6}(\d{2})?$/`); the PIN pad enforces the same rule (`pinIsValid`). | Same `LoginResponse` shape as password login (`accessToken`, user, roles, permissions). | Inline "wrong PIN" (401), blocked-context error when no branch id, network/offline retry. | `400` (format probe), `401` (credential probe). **Success path not exercised** — no Quick PIN is seeded for `waiter@nimbus.demo` on this branch (`packages/db/prisma/seed.ts` seeds PINs only for `*@demo.local`). |
| POST | `/api/auth/login` | Email + password fallback login. | `auth.controller.ts` `@Post('login')` | Public | `{ email, password, platform: "POS_DESKTOP" }` | `201` + `{ accessToken, ... }`; JWT carries `roles[]` and `permissions[]` (D-PERF). | Inline credential error; "waiter/cashier/supervisor workspaces only" block for other roles. | **201** |
| GET | `/api/auth/me` | Canonical identity, roles, permissions, branch and **employee** context after login and on session restore. | `auth.controller.ts` `@Get('me')` | `JwtAuthGuard` only (no `@Permissions`) | Bearer token; no branch header required. | `id`, `displayName`, `email`, `roles[]`, `permissions[]`, `employee { id, employeeCode, branchId, jobRole, … }`. `employee.id` gates the Me self-service panels (`resolveLinkedEmployeeId`). | 401 → `clearSession()` → `/login?reason=session_required`. | **200** |
| POST | `/api/auth/logout` | Sign out from Me and from the idle handler. | `auth.controller.ts` `@Post('logout')` | `JwtAuthGuard` | Bearer token, no body. | `{ message }`. | Logout is best-effort; the client clears local session and hard-navigates to `/login?reason=logged_out` (or `?reason=idle_timeout`) regardless. | not exercised (mutation) — would invalidate the verification token. |

> `POST /api/auth/refresh` and `/api/auth/logout-all` exist on the controller but **no waiter
> surface calls them**; they are excluded from this matrix.
>
> ⚠️ `docs/supervisor-ui-docs/SUPERVISOR_API_MATRIX.md` documents `POST /api/auth/quick-pin/login`.
> That path **does not exist** — verified live: **404** `Cannot POST /api/auth/quick-pin/login`.
> The real path is `quick-pin-login` (no slash). See §7.

---

## 2. Shift readiness

Client: `lib/waiter/me-api.ts`, `lib/waiter/useActiveShift.ts`, `components/waiter/shell/WaiterShiftBanner.tsx`.
Backend: `apps/api/src/modules/shifts/shifts.controller.ts` (`@Controller('shifts')`,
`JwtAuthGuard, PermissionGuard, BranchContextGuard` + `@RequireBranchContext()`).

| Method | Path | Purpose (waiter) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/shifts/active` | The single readiness source: drives the shift banner, every shift-gated action, and the Me shift card. Polled via React Query (`staleTime 30 s`, enabled only when `isWaiter`). | `shifts.controller.ts` `@Get('active')` | `pos:shift:read` | Bearer + `X-Branch-Id`. | The shift **opened by this user in this branch** (`openedById: userId`) or `null`. `shiftNumber`, `openedAt`, `status`, `notes`, `tillSessions[]`. | `null` → "Off shift. Service actions are unavailable." banner. 401 → `clearSession()`. Any other error → red banner with the API message. | **200** |
| POST | `/api/shifts/open` | Start shift from Me. | `shifts.controller.ts` `@Post('open')` | `pos:shift:open` | `{ notes? }` (≤500 chars, empty values stripped by `compactBody`). BG3-wrapped, `Idempotency-Key` optional (the waiter client does **not** send one). | The created shift. | **409** "User already has an active shift in this branch" → mapped to "A shift is already open for this branch. Refresh the page before trying again." | **409** (conflict probe against the already-open demo shift; no state changed). |
| POST | `/api/shifts/:id/close` | End shift from Me. | `shifts.controller.ts` `@Post(':id/close')` | `pos:shift:close` | Path id from `GET /shifts/active`; `{ notes? }`. BG3-wrapped. | Closed shift (+ `summary`). | 409 "Shift is not open"; unmatched/expired ids surface the API message. | not exercised (mutation) — would close the seeded demo shift. |

> **Shift semantics that matter.** `getActiveShift` and the backend write-guard
> `assertWaiterShiftOpen` (`apps/api/src/modules/orders/orders.service.ts`) both key on
> `openedById = actor.id`. The banner therefore reflects **this waiter's own** shift, not a
> branch-wide one — UI and backend agree, no mismatch.

---

## 3. Floor

Client: `lib/waiter/floor-api.ts` (`loadWaiterFloorData` fans out three calls in parallel),
`components/waiter/floor/WaiterFloorScreen.tsx`.
Backend: `apps/api/src/modules/floor/floor.controller.ts`,
`apps/api/src/modules/orders/orders.controller.ts`,
`apps/api/src/modules/reservations/reservations.controller.ts`.

| Method | Path | Purpose (waiter) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/tables` | The table grid. Branch-scoped list, normalized into `WaiterTableViewModel` (`normalizeWaiterTables`). | `floor.controller.ts` `@Get('tables')` | `pos:table:read` | Bearer + `X-Branch-Id`. | Bare array: `id`, `label`, `capacity`, `status`, `floorPlan`, `metadata`. | 403 → "Floor access blocked"; 401 → session expired + `clearSession()`; anything else → "Could not load floor" + retry. | **200** (22 tables) |
| GET | `/api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=100` | Active orders overlaid onto tables to derive Occupied / Mine / assigned-server. | `orders.controller.ts` `@Get()` | `pos:orders:read` | `excludeStatus` accepts comma-joined or repeated params (`ListOrdersQueryDto`); `pageSize` is `@IsInt() @Min(1)` with no max. | `{ data[], total, page, pageSize }`; each row carries `tableId`, `userId`, `status`, `total`, `user`, `items[]`. | Same floor error copy. | **200** |
| GET | `/api/reservations?pageSize=200` | Reservation overlay so a table can render **Reserved** and open the seat workspace. | `reservations.controller.ts` `@Get()` | `pos:reservation:read` | `pageSize` coerced + clamped server-side. | `{ data[], … }` with `tableId`, `status`, `reservationAt`, `partySize`, `seatedOrderId`. | Same floor error copy. | **200** |
| GET | `/api/tables/:id` | Single-table detail. | `floor.controller.ts` `@Get('tables/:id')` | `pos:table:read` | Path id. | One table. | Errors mapped by the calling screen. | **200** — but see §7: the **only** caller is `WaiterNewOrderScreen`, which is not mounted by any page. |

> **Floor status is derived, not read.** `normalizeWaiterTables` computes `available` /
> `occupied` / `reserved` and `isMine` from the three responses plus `user.id`; a `NEW` (draft)
> order does not make a table Occupied. The waiter UI never calls `PATCH /api/tables/:id/status`
> (`pos:table:write`, which the waiter role does not hold).
>
> `GET /api/floor-plans*` and `GET /api/floor/availability` exist under `pos:floor:read` (which
> the waiter holds) but **no waiter surface calls them** — excluded.

---

## 4. Order builder (Floor-contained)

Client: `lib/waiter/order-api.ts`, `components/waiter/orders/WaiterOrderBuilderScreen.tsx`
(mounted inside `WaiterTableWorkspace` → `OperationalTableWorkspaceFrame`).
Backend: `apps/api/src/modules/orders/orders.controller.ts` (`@Controller('pos/orders')`),
`apps/api/src/modules/menu/menu.controller.ts` (`@Controller('menu')`).

### 4.1 Order

| Method | Path | Purpose (waiter) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/pos/orders` | Create the dine-in draft **in the background** the moment an Available table is selected (`beginOrderCreation`). | `orders.controller.ts` `@Post()` | `pos:orders:write` | `{ serviceType: "DINE_IN", tableId }`. `CreateOrderDto` also accepts `notes` (≤500) + `metadata`; the waiter client sends neither. | `201` + the order (`id`, `orderNumber`, `status: "NEW"`). | `SHIFT_NOT_OPEN` (409) → "Start your shift before continuing service."; otherwise a danger toast "Order creation failed" with a retry affordance. | **201** — created `WAITER-DOCS-QA` order `ORD-000001` on table `TD-08` (left in place). |
| GET | `/api/pos/orders/:id` | Canonical order refresh after every write (`refreshCanonicalOrder`), and the legacy `/waiter/orders/[orderId]` → Floor resolver. | `orders.controller.ts` `@Get(':id')` | `pos:orders:read` | Path id. | Full order incl. `items[]`, `table`, `user`, totals. | **403 `ORDER_NOT_OWNED_BY_WAITER`** → ownership-blocked panel; 401 → `clearSession()`. | **200** (own order) and **403 `ORDER_NOT_OWNED_BY_WAITER`** (another waiter's order) — both observed. |
| POST | `/api/pos/orders/:id/items` | Add a configured line (serving + modifiers + note + qty). | `orders.controller.ts` `@Post(':id/items')` | `pos:orders:write` | `{ menuItemId, menuItemServingId?, quantity?, notes?, metadata { selectedModifiers[], servingLabel } }`. Early taps are queued and replayed once the draft id resolves. | The created `OrderItem`. | `SHIFT_NOT_OPEN`, `ORDER_NOT_OWNED_BY_WAITER`, generic write-error toast + auto-retry of the queued add. | **201** (re-verified after the QA-harness Decimal fix; initial 500 was a harness artifact — see §7). |
| PATCH | `/api/pos/orders/:id/items/:itemId` | Edit quantity / note / modifier metadata on an existing line. | `orders.controller.ts` `@Patch(':id/items/:itemId')` | `pos:orders:write` | `{ quantity?, notes?, metadata? }`. **`UpdateOrderItemDto` has no `menuItemServingId`** → serving cannot be changed after add (WKL-012). | The updated `OrderItem`. | Same write-error toasts. | not exercised (mutation) — route + guard confirmed via controller decorator. |
| DELETE | `/api/pos/orders/:id/items/:itemId` | Remove a line from the configurator. | `orders.controller.ts` `@Delete(':id/items/:itemId')` | `pos:orders:write` | Path ids only. | `{ deleted: true }`. | Same write-error toasts. | not exercised (mutation) — blocked by L2. |
| POST | `/api/pos/orders/:id/send` | Send the order to kitchen/bar (`NEW → SENT`); auto-occupies the table server-side. | `orders.controller.ts` `@Post(':id/send')` `@HttpCode(200)` | `pos:orders:write` | Client sends `{}`; `TransitionOrderDto.reason` is accepted but unused by the waiter UI. | The transitioned order (`status: "SENT"`). | `SHIFT_NOT_OPEN`, `ORDER_NOT_OWNED_BY_WAITER`, `ORDER_TRANSITION_NOT_WAITER_SAFE`; a follow-up refresh failure degrades to a warning toast, not an error. | **200** — on the `WAITER-DOCS-QA` order. |

> **Waiter-only tightening (`apps/api/src/common/auth/waiter-scope.ts`).** For an actor whose
> *every* role is `WAITER`: `assertWaiterOrderOwnership` → 403 `ORDER_NOT_OWNED_BY_WAITER`;
> `assertWaiterTransitionAllowed` allows only `SENT` and `SERVED` → 403
> `ORDER_TRANSITION_NOT_WAITER_SAFE`; `assertWaiterShiftOpen` → 409 `SHIFT_NOT_OPEN`. All three
> codes are first-class in `apps/web/src/lib/api/client.ts` and rendered as specific copy.
> Verified live: `in-kitchen` **403 ORDER_TRANSITION_NOT_WAITER_SAFE`**, `ready` **403 same**.
>
> `POST /api/pos/orders/:id/mark-served` is waiter-*safe* at the backend (`SERVED` is in
> `WAITER_SAFE_TRANSITIONS`; probed live → **409** "Invalid transition from SENT to SERVED"),
> but **no waiter surface calls it** — the waiter never marks served. Excluded from the
> consumed set.

### 4.2 Menu (read-only)

All rows: `menu.controller.ts`, guards `JwtAuthGuard, PermissionGuard, BranchContextGuard`,
permission **`pos:menu:read`**.

| Method | Path | Purpose (waiter) | Controller | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/menu/navigation?activeOnly=true` | Manager-configured browse taxonomy (FOOD / DRINKS → groups → subgroups). Prefetched on Floor mount so the workspace opens instantly. | `@Get('navigation')` | `activeOnly` coerced from `'true'`. | `[{ section, groups[{ id, name, sortOrder, isActive, subgroups[] }] }]`. | Empty navigation renders an honest "manager configuration" state — **never** hard-coded fallback categories (D-TAXONOMY). | **200** |
| GET | `/api/menu/catalog` | Priced item catalog joined to the taxonomy. Prefetched with navigation (`loadWaiterMenuWorkspace`, `staleTime` 5 min). | `@Get('catalog')` | — | `{ categories[{ items[{ price, servings, modifierGroups, browseGroup, taxCategory }] }], taxCategories[] }`. | Menu-load failure blocks item entry with an error state, not a silent empty menu. | **200** |
| GET | `/api/menu/items/:id` | Item detail when the configurator opens. | `@Get('items/:id')` | Path id. | One item. | "Could not load item options" toast. | **200** |
| GET | `/api/menu/items/:id/servings` | Serving/format options + prices for the configurator. | `@Get('items/:id/servings')` | Path id. | `[{ id, format, label, price, isDefault, sortOrder }]`. | Same toast. | **200** |
| GET | `/api/menu/items/:id/modifier-groups` | Modifier groups (min/max/required) for the configurator. | `@Get('items/:id/modifier-groups')` | Path id. | `[{ id, name, min, max, required, options[] }]`. | Same toast. | **200** |
| GET | `/api/menu/modifier-groups/:id/options` | Lazy per-group option fetch — issued **only** when the group came back without inlined `options`. | `@Get('modifier-groups/:id/options')` | Path id. | `[{ id, name, priceDelta, sortOrder }]`. | Same toast. | **200** |

---

## 5. Bill & receipts

Client: `lib/waiter/receipt-api.ts`, `lib/waiter/receipt-model.ts`,
`components/waiter/receipts/**`, driven from `WaiterOrderBuilderScreen`.
Backend: `apps/api/src/modules/orders/orders.controller.ts`,
`apps/api/src/modules/receipts/receipts.controller.ts`.

> **Identity rule.** `receipts.controller.ts` documents *"Receipt id == orderId (closed Orders
> are the receipt)"*, and `ReceiptsService.loadOrderForReceipt` looks the id up in `order`. The
> UI therefore passes `resolvedOrderId` into `getReceipt` / `getReceiptHistory` /
> `reprintReceipt` / `sendReceipt`. **This is correct by design, not a bug** — verified live
> (an unknown id returns `404 Receipt not found`, an existing order id reaches view-building).

| Method | Path | Purpose (waiter) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/pos/orders/:id/request-bill` | The waiter's "please bring the bill" signal. **Audit-only** — it does not mutate payment state; the cashier picks it up from the audit timeline. | `orders.controller.ts` `@Post(':id/request-bill')` `@HttpCode(200)` | `pos:orders:write` | No body. Ownership + open shift enforced. | `{ orderId, orderNumber, status, billRequested: true, requestedAt }`. | 409 on a `CLOSED`/`VOIDED` order; `SHIFT_NOT_OPEN`; `ORDER_NOT_OWNED_BY_WAITER`. On success the UI opens the receipt drawer and shows "Payment collection remains outside the waiter workspace." | **200** — on the `WAITER-DOCS-QA` order. |
| GET | `/api/receipts/:id` | Bill/receipt preview inside the drawer (lazy — only fetched while the drawer is open). | `receipts.controller.ts` `@Get(':id')` | `pos:receipt:read` | Path id = **order id**. | Composed view: org/branch, table, server, `totals { subtotal, tax, discount, total, paid, outstanding, currencyCode }`, `items[]`, `payments[]`, `footer`, `history { viewedCount, reprintCount, sentCount }`. Read is audit-logged (`RECEIPT_VIEWED`). | Drawer error state with the API message. | **200** (re-verified after the QA-harness Decimal fix; initial 500 was a harness artifact — see §7). `404` correctly returned for an unknown id. |
| GET | `/api/receipts/:id/history` | Receipt audit timeline (viewed / reprinted / sent + order close/void). | `receipts.controller.ts` `@Get(':id/history')` | `pos:receipt:read` | `page?`, `pageSize?` (≤200) — the waiter client sends neither, so server defaults apply. | `{ data[], total, page, pageSize, receiptId }`. | Separate history error line inside the drawer. | **200** |
| POST | `/api/receipts/:id/reprint` | Record a duplicate-receipt request for the guest. | `receipts.controller.ts` `@Post(':id/reprint')` `@HttpCode(200)` | `pos:receipt:reprint` | `{ reason: "Guest requested a duplicate receipt.", copies: 1 }` + a client-generated `Idempotency-Key` (BG3 `idempotencyMode: 'optional'`). | `{ ok, action, receiptId, copies, reprintedAt, printable }`. | **400** unless the order is `CLOSED` or `VOIDED`; the UI pre-disables the button with the same rule (`PRINTABLE_STATUSES` in `receipt-model.ts`) and toasts "No print-driver completion is guaranteed." | **400** — gate probe on a `SENT` order returned *"…in status SENT cannot be reprinted (must be CLOSED or VOIDED)"*. Success path not exercised (mutation). |
| POST | `/api/receipts/:id/send` | Record a pending email/SMS/WhatsApp receipt delivery. | `receipts.controller.ts` `@Post(':id/send')` `@HttpCode(202)` | `pos:receipt:send` | `{ channel: "email"\|"sms"\|"whatsapp", recipient, locale: "en", note }` + `Idempotency-Key`. | `202` + `{ status: "PENDING", supported: false, reason: "NO_LIVE_DELIVERY_ADAPTER", … }`. | Same `CLOSED`/`VOIDED` **400** gate, mirrored in the UI. The action bar permanently shows "PENDING - no live adapter" — **there is no live delivery adapter**; a success is a recorded intent, not a delivery. | **400** — gate probe on a `SENT` order. Success path not exercised (mutation). |

> ⚠️ **Ownership asymmetry.** `GET /api/pos/orders/:id` applies `assertWaiterOrderOwnership`
> (403 for another waiter's order, verified live). `ReceiptsService.loadOrderForReceipt` applies
> **no** ownership check — it is branch-scoped only. A waiter who knows another waiter's order id
> can therefore read that receipt (`pos:receipt:read`). Verified live: a non-owned order id was
> *not* rejected with 403; it proceeded into view-building and failed with the L1 Decimal error.
> The waiter UI never surfaces such an id (the drawer only ever uses the order it already opened),
> so this is an API-surface gap, not a UI leak.

---

## 6. Me — profile, shift, workforce self-service

Client: `lib/waiter/me-api.ts`, `components/waiter/me/WaiterMeScreen.tsx`.
Backend: `apps/api/src/modules/attendance/attendance.controller.ts` (`@Controller('hr')`,
`JwtAuthGuard, PermissionGuard, BranchContextGuard`, `@RequireBranchContext()`).

Shift open/close/active are in §2; identity comes from `GET /api/auth/me` (§1).

| Method | Path | Purpose (waiter) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/hr/attendance?mine=true&take=8` | Own recent attendance rows on Me. Enabled only when `auth/me` returned a linked `employee.id`. | `attendance.controller.ts` `@Get('attendance')` | `pos:hr:attendance:read` | `mine` is coerced from `'true'`/`'1'` and **overrides** `employeeId`; `skip`/`take` are numeric strings. | `{ data[], total }` with `clockInAt`, `clockOutAt`, `status`, `lateMinutes`, `employee`. | Section-level error message; unlinked employee → `CapabilityNotice` instead of a broken panel. | **200** (`{"data":[],"total":0}` — see the branch note below) |
| POST | `/api/hr/attendance/clock` | Single toggle: clock in, or clock out if today's row is open. | `attendance.controller.ts` `@Post('attendance/clock')` | `pos:hr:attendance:clock` | `{ employeeId, notes? }`. Backend rejects an employee that is not `employee.userId === actor.id` (403) or outside the org (404). | The attendance record. | 409 "already clocked out for today" → "Attendance is already clocked out for today."; 403 → "This action is not available for this account." | **201** — created a `WAITER-DOCS-QA` clock row for the QA employee. |
| GET | `/api/hr/leave?mine=true&take=8` | Own leave requests on Me. | `attendance.controller.ts` `@Get('leave')` | `pos:hr:leave:read` | `mine`, `status?`, `leaveType?`, `skip?`, `take?` (`@Max(100)`). | `{ data[], total }` with `leaveType`, `startsAt`, `endsAt`, `status`, `reviewNotes`. | Section error; empty state. | **200** — `{"data":[],"total":0}` before the QA write, then returned the tagged row after. |
| POST | `/api/hr/leave` | Submit a leave request from the Me form. | `attendance.controller.ts` `@Post('leave')` | `pos:hr:leave:create` | `{ employeeId, leaveType: ANNUAL\|SICK\|UNPAID\|EMERGENCY\|OTHER, startsAt, endsAt, reason? }`; `compactBody` strips empties. | The created `PENDING` request. | 400 `endsAt` before `startsAt`; 409 overlapping PENDING/APPROVED request; 403 wrong employee. The UI states the request stays pending until a manager reviews it. | **201** — created a `WAITER-DOCS-QA` `UNPAID` request (left in place). |
| GET | `/api/hr/shift-swaps?mine=true&take=8` | Own swaps (as requester **or** target), read-only. | `attendance.controller.ts` `@Get('shift-swaps')` | `pos:hr:shift-swaps:read` | `mine`, `skip?`, `take?` (`@Max(100)`). | `{ data[], total }` with `requester`, `target`, `shiftDate`, `status`. | Section error; empty state. | **200** (`{"data":[],"total":0}`) |

> **Swap creation is deliberately absent.** The waiter role holds `pos:hr:shift-swaps:create`,
> and `POST /api/hr/shift-swaps` exists — but `me-api.ts` exposes **no** create function and the
> Me screen renders swaps read-only. This matches the pack note "creation remains unavailable
> until a safe target selector exists".
>
> ⚠️ **Branch-scoping note (data, not contract).** `listAttendance` / `listLeaveRequests` /
> `listShiftSwaps` filter on `ctx.branchId` (the `X-Branch-Id` header), while the QA waiter's
> `Employee` row lives in a **different** branch (`employee.branchId = c1f953ca…` vs operating
> branch `cb27be40…`). Seeded self-service history therefore reads as **empty** on this stack even
> though the endpoints are healthy. Writes are org-scoped (`employee.orgId === ctx.organizationId`)
> and stamp the *operating* branch, which is why the QA leave request appeared in the list
> immediately. This is a seed/branch alignment issue to be aware of when demoing Me.

---

## 7. Live defects and mismatches observed on 2026-08-20

| # | Finding | Evidence | Impact on the Waiter UI |
| --- | --- | --- | --- |
| **L1** | *(resolved — harness artifact)* `GET /api/receipts/:id` initially returned **500** for every order. | `[DecimalError] Invalid argument` at `ReceiptsService.buildReceiptView` — a Decimal class-identity clash introduced by the QA stack's WASM-engine/driver-adapter shim, not by product code. | After the shim fix: **200** for existing orders (populated drawer verified visually), 404 for unknown ids. No product change was needed or made. |
| **L2** | *(resolved — harness artifact)* `POST /api/pos/orders/:id/items` initially returned **500**. | Same Decimal identity clash at `OrdersService.computeLinePricing`. | After the shim fix: **201**; line pricing computes correctly. No product change was needed or made. |
