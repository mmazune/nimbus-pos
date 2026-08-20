# Cashier API Matrix

Status: **Canonical (cashier)** — first API matrix inside the canonical Cashier directory.
Derived from the implemented client (`apps/web/src/lib/cashier/*.ts`,
`apps/web/src/components/cashier/**`, `apps/web/src/pages/cashier/*`,
`apps/web/src/lib/auth/auth-api.ts`) and the NestJS controllers in `apps/api/src/modules/**`.
Date: 2026-08-20.

Supersedes `Front End/cashier_ui_docs_pack/docs/cashier-ui-docs/CASHIER_API_MATRIX.md`
(Verified v1, 2026-07-01 — pre-reconstruction, Queue-first, no verified-status column) and
subsumes the endpoint half of `ai/CASHIER_FLOOR_RECONSTRUCTION_PERMISSION_AND_API_MATRIX.md`
(the C0 audit, which remains valid as the permission-migration record).

> **Live verification (2026-08-20, isolated local QA stack).** Every row below was checked
> against a disposable local stack — API `http://localhost:3001` (global prefix `api`), local
> seeded Postgres, cashier `cashier@nimbus.demo` at branch `cb27be401a2c35dfc0d4e610`.
> `POST /api/auth/login` returned **201**. Every **GET** the Cashier UI issues was executed with
> `Authorization: Bearer <token>` + `X-Branch-Id` and its observed HTTP code recorded.
> Mutations were **not** executed except as **rejected-by-design probes that change no state**
> (till-open with no personal shift, receipt reprint/send on a non-CLOSED order, refund on a
> non-CLOSED order, permission probes). Every other write is marked *not exercised (mutation)*
> and confirmed from its controller decorator, cited per row. **No rows were created** on this
> stack — every write attempt was correctly rejected before persistence, so no
> `CASHIER-DOCS-QA` data was left behind. Receipt reads are audit-logged server-side
> (`RECEIPT_VIEWED`), so the verification pass did append audit rows for the CLOSED demo order
> `ORD-TAPAS_DOWNTOWN-01171`; those are not taggable through the API.
>
> **Addendum (2026-08-20, later the same day — owner-approved UI addition).** §2a
> (`POST /api/shifts/open`, `POST /api/shifts/:id/close`) **was** exercised for real on the same
> disposable stack, because the feature it documents could not be verified any other way: a
> cashier shift was opened from the new Me control and then closed again, at both 1440×900 and
> 1024×768. Shifts `SHF-000001`…`SHF-000004` were created and all were closed; `GET
> /api/shifts/active` returns empty at rest. The accompanying `POST /api/tills/open` gate probe
> reused the **existing** till code, so it was rejected (409) before writing.
>
> **Addendum 2 (2026-08-20, Prompt C3 — settlement execution).** §5b was added and its four write
> rows **were executed for real** on the same disposable local stack, because payment/close cannot
> be verified any other way: bills were paid in full with cash, part-paid by reference and then
> closed, split into allocation groups, and split into a child order. Order numbers, amounts and
> resulting states are recorded per row and in
> `ai/CASHIER_FLOOR_RECONSTRUCTION_C3_QA_EVIDENCE_INDEX.md`. Shared Neon was never reachable from
> this environment.

## Rules

- Effective base URL is `{{baseUrl}}/api/...` with `baseUrl = http://localhost:3001`
  (`apps/web/src/lib/api/client.ts` strips a trailing `/api` from `NEXT_PUBLIC_API_BASE_URL`).
- Every protected cashier call carries `Authorization: Bearer <accessToken>` **and**
  `X-Branch-Id`. Verified live: missing `X-Branch-Id` → **400** `X-Branch-Id header is required`;
  missing token → **401** `Unauthorized`.
- Every cashier request also carries `Accept: application/json` and a generated `X-Request-Id`;
  the client applies a 30 s `AbortController` timeout (`apiRequest`).
- Every cashier **mutation** helper takes an `idempotencyKey` and sends it as `Idempotency-Key`
  (`buildCashierIdempotencyKey`, `lib/cashier/idempotency.ts`). All the corresponding backend
  routes run through `Bg3ReliabilityService.guard` with `idempotencyMode: 'optional'`.
- All money is UGX, Decimal strings end-to-end; the UI formats zero-fraction.
- Visible cashier nav is **Floor · Till · Me** (`lib/cashier/routes.ts`), default `/cashier/floor`
  (`/cashier` 302s there). There is **no visible Queue tab and no visible Receipts tab**.
- The Cashier UI issues **no** order-write, void, KDS-state, discount, menu, or
  reservation-admin call. Cashier holds `pos:orders:write` and `pos:kds:write` but no cashier
  surface uses them (§8).

### Verified-status legend

| Value | Meaning |
| --- | --- |
| `200` / `201` / `400` / `401` / `403` / `404` / `409` | HTTP code observed live on 2026-08-20 against the isolated stack. |
| `not exercised (mutation)` | Deliberately not executed; existence + guard confirmed from the controller decorator cited in the row. |

### Surface legend

| Marker | Meaning |
| --- | --- |
| **C2 primary** | Reachable from the visible Floor · Till · Me navigation (read path, C2). |
| **C3 primary** | Settlement **write** reachable from the visible Floor path since Prompt C3 (§5b). |
| **compat** | Reachable **only by typing `/cashier/queue` or `/cashier/receipts` directly** — hidden compatibility routes, off the nav, scheduled for retirement (Receipts → C4, Queue → C5). See §7. |

---

## 0. Floor-path write boundary — updated 2026-08-20 (Prompt C3)

**C3 wired settlement onto the Floor path.** `CashierSettlementWorkspace` mounts
`CashierSettlementActions`, which composes the existing `CashierPaymentPanel` and
`CashierResolutionPanel variant="split-only"`. The following are now **live on the primary Floor
path** (rows promoted out of the compat-only §7.2/§7.3 and specified in **§5b**):

- `POST /api/pos/orders/:id/close` — cash settlement **and** close, one call.
- `POST /api/payments/manual-reference` — card / MTN / Airtel / bank reference, partial or final.
- `POST /api/pos/orders/:id/split-bill` — cashier allocation groups (metadata only).
- `POST /api/pos/orders/:id/split-items` — split items to a child order.

Still **not wired by design** on the Floor path after C3 (not missing, not broken):

| Endpoint | Why not | Lands |
| --- | --- | --- |
| `POST /api/payments/intents` | Mobile money is manual-reference only in the shipped build; the helper still has no caller (**M3**). | C5 or deletion |
| `POST /api/pos/orders/:id/move-items` · `POST /api/pos/orders/merge` | Order handoff, not cashier settlement. | not planned for Cashier |
| `POST /api/pos/orders/:id/transfer-table` · `/transfer-server` | Supervisor-owned. | never on Cashier |
| `POST /api/pos/orders/:id/refunds` | Refund execution. | C4 |
| `POST /api/receipts/:id/reprint` · `/send` | Receipt actions + receipt search. | C4 |

All of the deferred rows remain reachable through the hidden compatibility routes (§7) until their
capability is migrated (`AGENTS.md`: *"Do not delete working capabilities before they are reachable
from the new workflow."*).

---

## 1. Auth / session — C2 primary

Client: `apps/web/src/lib/auth/auth-api.ts`, `apps/web/src/lib/auth/AuthProvider.tsx`,
`apps/web/src/pages/login.tsx`, `components/cashier/shell/CashierSessionGuard.tsx`,
`components/cashier/shell/CashierIdleLogoutHandler.tsx`,
`components/cashier/me/CashierLogoutPanel.tsx`.
Backend: `apps/api/src/modules/auth/auth.controller.ts`.

| Method | Path | Purpose (cashier) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/quick-pin-login` | Frontline login on a shared terminal (shared `/login` page; not cashier-specific). | `auth.controller.ts` `@Post('quick-pin-login')` | Public (no `@UseGuards`) | `{ branchId, pin, platform: "POS_DESKTOP" }`. PIN must be **exactly 6 or 8 digits** (`QuickPinLoginDto`); the PIN pad enforces the same rule. | `LoginResponse` — `accessToken`, `refreshToken`, `user`, `session`. | Inline "wrong PIN" (401); blocked-context error when no branch id. | `400` (format probe: *"PIN must be exactly 6 or 8 numeric digits"*), `401` (credential probe). **Success path not exercised** — no Quick PIN is seeded for `cashier@nimbus.demo` (`packages/db/prisma/seed.ts` seeds PINs only for `*@demo.local`). |
| POST | `/api/auth/login` | Email + password fallback login — the path used for this verification pass. | `auth.controller.ts` `@Post('login')` | Public | `{ email, password, platform: "POS_DESKTOP" }` | **201** + `{ accessToken, refreshToken, user, session }`. JWT carries `roles[]` and `permissions[]`. | Inline credential error; role-gate block for non-operational roles. | **201** |
| GET | `/api/auth/me` | Canonical identity, roles, permissions, branch context and linked `employee`. Read once on login and on session restore; the Cashier shell **must not** duplicate it. | `auth.controller.ts` `@Get('me')` | `JwtAuthGuard` only (no `@Permissions`) | Bearer token; **no branch header required**. | `id`, `displayName`, `email`, `roles[]` (`Cashier`, L2, jobRole `CASHIER`), `permissions[]` (**63** on the seeded role), `context.defaultBranchId`, `employee { id, employeeCode, branchId, jobRole, … }`. | 401 → `clearSession()` → `/login?reason=session_required`. Missing `context.defaultBranchId` → `CashierSessionGuard` renders *"The cashier workspace needs a default branch from /api/auth/me before shift and till reads can run."* | **200** |
| POST | `/api/auth/logout` | End cashier session from Me, and from the idle handler. | `auth.controller.ts` `@Post('logout')` | `JwtAuthGuard` | Bearer token, no body. | `{ message }`. | Best-effort; the client clears local session and hard-navigates to `/login` regardless of the response. | not exercised (mutation) — would invalidate the verification token. |

> `POST /api/auth/refresh`, `/api/auth/logout-all` and `GET /api/auth/sessions` exist on the
> controller but **no cashier surface calls them** — excluded.

---

## 2. Readiness (shift + till) — C2 primary, consumed by every surface

Client: `lib/cashier/api.ts`, `lib/cashier/readiness.ts` (`useCashierReadiness`),
`components/cashier/shell/CashierReadinessStrip.tsx`.
Backend: `apps/api/src/modules/shifts/shifts.controller.ts`,
`apps/api/src/modules/tills/tills.controller.ts` (both
`JwtAuthGuard, PermissionGuard, BranchContextGuard` + `@RequireBranchContext()`).

Both queries are `staleTime 30_000`, `retry: 1`, and enabled only when
`accessToken && branchId && isAuthenticated && isCashier`.

| Method | Path | Purpose (cashier) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/shifts/active` | Shift half of the readiness strip. Drives the "Shift active / No active shift" chip and every shift-gated caveat. Also backs the **Me shift card** (`ShiftStatusCard`) added 2026-08-20. | `shifts.controller.ts` `@Get('active')` | `pos:shift:read` | Bearer + `X-Branch-Id`. | The shift **opened by this user in this branch** (`openedById = actor.id`, `status: OPEN`) or `null`. Includes `shiftNumber`, `notes` and `tillSessions[]`. | `null` / non-OPEN → warning chip *"Shift is not active. Open Me to start a shift. Payment actions will stay blocked."* (strip chip reads *"No active shift · Open Me to start"*). Query error → danger chip *"…Retry before checkout."* 401 → `clearSession()`. | **200** — `null` before the Me open, the cashier's own OPEN shift after it (live 2026-08-20). |
| GET | `/api/tills/active` | Till half of the readiness strip; also supplies the `activeTillId` the whole Till screen keys on. | `tills.controller.ts` `@Get('active')` | `pos:till:read` | Bearer + `X-Branch-Id`. | The OPEN till where **`operatorUserId = actor.id`** — `tillCode`, `openingFloat`, `expectedCash`, `countedCash`, `variance`, `varianceStatus`, `shift { id, shiftNumber, status }` — or `null`. | `null` / non-OPEN → *"Cash payments will stay blocked until a till is active."* Error → danger chip. 401 → `clearSession()`. | **200** — returned OPEN till `TILL-TAPAS_DOWNTOWN-020`. |

### 2a. Shift open/close from Cashier **Me** — UI-wired 2026-08-20 (owner-approved)

Client: `lib/cashier/shifts.ts` (`openCashierShift`, `closeCashierShift`),
`components/cashier/me/CashierMeScreen.tsx` (shared `ShiftStatusCard` + optional note textarea,
mirroring the Waiter Me shift affordance; **no** confirmation dialog, matching Waiter).
Backend: `apps/api/src/modules/shifts/shifts.controller.ts`.

| Method | Path | Purpose (cashier) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/shifts/open` | Cold-start shift open from **Me** so a cashier can then open a till unaided (resolves **M1**). | `shifts.controller.ts` `@Post('open')` | `pos:shift:open` (already held by the seeded cashier role — **no permission change**) | Bearer + `X-Branch-Id`; body `{ notes? }` (empty note omitted). No `Idempotency-Key` (mirrors the Waiter helper; the route is not BG3-wrapped). | The created shift — `id`, `shiftNumber`, `status: OPEN`, `openedById = actor.id`, `openedAt`, `notes`. | 409 → *"A shift is already open for this branch. Refresh this page before trying again."* 401 → session-expired copy. 403 → not-available copy. 400 → server message. | **201** live 2026-08-20 — opened `SHF-000001`/`SHF-000002` as `cashier@nimbus.demo`. |
| POST | `/api/shifts/:shiftId/close` | End the cashier's own shift from **Me**. | `shifts.controller.ts` `@Post(':id/close')` | `pos:shift:close` (already held) | Bearer + `X-Branch-Id`; path id from `GET /api/shifts/active`; body `{ notes? }`. | The closed shift (+ `summary` when the backend returns one). | `SHIFT_NOT_OPEN` → *"No open shift was found."* Same 401/403/400 mapping as open. | **201** live 2026-08-20 — `GET /api/shifts/active` returned empty afterwards. |

On success both mutations invalidate exactly two keys —
`["cashier","active-shift",branchId]` and `["cashier","active-till",branchId]` — which is what
refreshes the readiness strip, the Me hero, and the Till screen chips. No broad invalidation.

> **The third readiness item is not an API call.** `useCashierReadiness` hard-codes
> `{ key: "providers", label: "Provider mode", value: "Manual/stub only" }`. There is no
> provider-capability endpoint; the claim is a static honesty marker.

---

## 3. Floor & bill resolution (C2) — C2 primary

Client: `lib/cashier/floor-api.ts` (`loadCashierFloorData` fans out three calls in parallel),
`lib/cashier/orders.ts`, `lib/cashier/resolution.ts` (`listCashierTables` only),
`lib/cashier/bill-resolution.ts` (pure classification — no I/O),
`components/cashier/floor/CashierFloorScreen.tsx`,
`components/cashier/floor/CashierBillResolutionPanel.tsx`.
Backend: `apps/api/src/modules/floor/floor.controller.ts`,
`apps/api/src/modules/orders/orders.controller.ts`,
`apps/api/src/modules/reservations/reservations.controller.ts`.

| Method | Path | Purpose (cashier) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/tables` | The shared table grid. Cashier is the **third** `OperationalFloor` consumer; there is no cashier-specific Floor endpoint. | `floor.controller.ts` `@Get('tables')` | `pos:table:read` | Bearer + `X-Branch-Id`. | Bare array: `id`, `label`, `capacity`, `status`, `floorPlanId`, `metadata`. | Floor error state + retry; 401 → `clearSession()`; 403 → access-blocked panel. | **200** (22 tables) |
| GET | `/api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=100` | Active orders overlaid onto tables to derive Occupied and the bill indicator. Part of the single `loadCashierFloorData` fan-out (`staleTime 15_000`). | `orders.controller.ts` `@Get()` | `pos:orders:read` | `excludeStatus` accepts comma-joined or repeated params; values validated against the `ORDER_STATUSES` enum. `pageSize` is `@IsInt() @Min(1)` with **no max**. | `{ data[], total, page, pageSize }`; each row carries `tableId`, `userId`, `status`, `total`, `metadata`, `items[]`. | Same Floor error copy. | **200** |
| GET | `/api/reservations?pageSize=200` | Reservation overlay so a table can render **Reserved**. Read-only for cashier. | `reservations.controller.ts` `@Get()` | `pos:reservation:read` | `pageSize` coerced + clamped server-side. | `{ data[], … }` with `tableId`, `status`, `reservationAt`, `partySize`. | Same Floor error copy. | **200** |
| GET | `/api/pos/orders?tableId=<id>&pageSize=50` | **The bill-resolution read.** One bounded per-table order list, issued only after a table is selected (`staleTime 8_000`). Feeds `resolveCashierTableBills` → zero / single / multiple. | `orders.controller.ts` `@Get()` | `pos:orders:read` | `tableId` is `@IsOptional() @IsString()` — **not** validated as an existing id. | `{ data[], total, … }`. | Resolution panel error state; the panel **fails closed** — an unclassifiable order is never offered as settleable. | **200** (11 orders on table `cf92496138fe89c6ded7a17f`) |

> **No per-table payment fetch.** `AGENTS.md` forbids N+1 order/payment requests on Floor.
> `bill-resolution.ts` classifies from `order.status` + `order.metadata` only; the payment
> summary (§5) is a **single** read that runs *after* a bill is selected. Verified in code:
> `classifyCashierBillStatus` takes no summary; `classifyCashierBillPayment` is called only from
> `CashierSettlementWorkspace`.
>
> **Fail-closed classification.** `CASHIER_TERMINAL_STATUSES` includes `CANCELLED` / `CANCELED` /
> `REFUNDED`, none of which exist in the backend `ORDER_STATUSES` enum
> (`NEW, SENT, IN_KITCHEN, READY, SERVED, VOIDED, CLOSED`). That is defensive over-coverage on a
> derived field, not a contract mismatch — the UI never sends those values as a filter.
>
> **Multiple bills are never auto-picked.** `resolveCashierTableBills` returns `multiple` and the
> selector forces an explicit choice; only `single` auto-resolves.

---

## 4. Find bill — C2 primary

Client: `components/cashier/floor/CashierFindBillDialog.tsx`, `lib/cashier/orders.ts`.
Backend: `apps/api/src/modules/orders/orders.controller.ts`.

Find bill is a **role-specific sibling control** on the Cashier Floor page, not a fourth tab. It
issues no new endpoint — only additional query shapes of the canonical order list, plus one
exact-id fallback.

| Method | Path | Purpose (cashier) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/pos/orders?{filter}&pageSize=25` | Bounded tableless / takeaway / closed-bill search. `ACTIVE` → `excludeStatus=NEW,CLOSED,VOIDED`; `ALL` → no status param; `READY`/`SERVED`/`CLOSED`/`VOIDED` → `status=<value>`; optional `serviceType=DINE_IN\|TAKEAWAY`. | `orders.controller.ts` `@Get()` | `pos:orders:read` | `ListOrdersQueryDto`: `status` and `excludeStatus[]` are `@IsEnum(ORDER_STATUSES)`; `serviceType` is `@IsEnum(['DINE_IN','TAKEAWAY'])`. Free-text search is **client-side** over the returned page (`view.searchText`) — the API has no `q`/search param. | `{ data[], total, … }`. | When `total > 25` the dialog shows *"Showing the 25 most recent bills for this filter — narrow with status/service or paste an exact bill reference."* | **200** for all six filter shapes: `ACTIVE` (total 87), `ALL` (300), `READY` (34), `SERVED`+`TAKEAWAY` (7), `CLOSED` (191), `VOIDED` (0). |
| GET | `/api/pos/orders/:id` | **Exact-id fallback.** Fires only when the page search returns nothing *and* the term matches `/^[a-z0-9]{20,32}$/i` (`retry: false`). | `orders.controller.ts` `@Get(':id')` | `pos:orders:read` | Path id. | Full order. | 404 → the dialog falls back to "no match" rather than an error; the C2 scope note says receipt-reference lookup is **deferred to C4**. | **200** |

---

## 5. Settlement workspace reads — C2 primary

Client: `components/cashier/floor/CashierSettlementWorkspace.tsx`, `lib/cashier/orders.ts`,
`lib/cashier/bill-query-keys.ts`, `lib/cashier/order-state.ts`.
Backend: `apps/api/src/modules/orders/orders.controller.ts`,
`apps/api/src/modules/payments/payments.controller.ts`.

URL state is canonical `?tableId=&orderId=` (`lib/cashier/floor-route.ts`). Exactly **two**
reads, both keyed per-order so selection changes refetch predictably and nothing invalidates
broadly.

| Method | Path | Purpose (cashier) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/pos/orders/:id` | Canonical bill detail for the selected order — header, table, server, items, totals. Query key `["cashier","order-detail",branchId,orderId]`. | `orders.controller.ts` `@Get(':id')` | `pos:orders:read` | Path id from `?orderId=`. | Full order incl. `items[]`, `table`, `user`, `total`, `status`, `metadata`. | Workspace error state; 401 → `clearSession()`. **No waiter-ownership check applies** — `assertWaiterOrderOwnership` only fires for actors whose *every* role is `WAITER`, so a cashier reads any branch order. | **200** |
| GET | `/api/pos/orders/:id/payments` | Canonical payment summary — the only payment read on the Floor path. Query key `["cashier","order-payments",branchId,orderId,"settlement"]`. | `payments.controller.ts` `@Get('pos/orders/:id/payments')` | `pos:payment:read` | Path id. | `{ payments[], intents[], orderTotal, totalPaid, remainingBalance, isSettled }` — all Decimal strings. | **Fails closed:** if the summary is missing or unclassifiable, `classifyCashierBillPayment` returns `UNKNOWN_UNSAFE` → *"State unavailable"* (danger). Unknown state is **never** rendered as unpaid or zero-due (`AGENTS.md`). | **200** — unpaid SERVED order: `{"payments":[],"intents":[],"orderTotal":"114500","totalPaid":"0.00","remainingBalance":"114500.00","isSettled":false}`; CLOSED order returned a `COMPLETED` `BANK_TRANSFER` / `MANUAL_REFERENCE` payment. |

> The workspace also renders Settlement readiness and History **from data it already has**
> (`useCashierReadiness` + the order/payment payloads). Neither adds a request.

---

## 5b. Settlement workspace writes — C3 primary (new 2026-08-20)

Client: `components/cashier/floor/CashierSettlementActions.tsx` →
`components/cashier/checkout/CashierPaymentPanel.tsx` (+ `CashierCloseOrderPanel`) and
`components/cashier/resolution/CashierResolutionPanel.tsx` (`variant="split-only"`) →
`CashierSplitBillPanel` / `CashierSplitItemsPanel`; API helpers `lib/cashier/payments.ts` and
`lib/cashier/resolution.ts`; validation `lib/cashier/payment-validation.ts` +
`lib/cashier/resolution-validation.ts`; post-mutation refresh `lib/cashier/settlement-mutations.ts`.

These are the **same client helpers the Queue compat path already used** — C3 mounted them, it did
not re-implement them. Every write sends a BG3 `Idempotency-Key` built by
`lib/cashier/idempotency.ts`, and every outcome (success **and** failure) awaits a canonical re-read
of `orderDetail` + `orderPayments` before a result is presented.

| Method | Path | Purpose (cashier) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/pos/orders/:id/close` | **Cash settlement = close.** `method.id === "CASH"` → `closeCashierOrder`. Settles and closes in one call at the single verified choke point. | `payments.controller.ts` `@Post('pos/orders/:id/close')` `@HttpCode(200)` | `pos:orders:close` | `{ payments: [{ method: "CASH", amount, metadata }], reason? }` + `Idempotency-Key`. | `{ order, payments[], orderTotal, totalPaid, changeDue }`. | `validateCashierPaymentInput` blocks first: no active shift, no active till, unresolved summary, terminal order, pending intent, amount ≠ outstanding, or order not `SERVED` (*"Cash close is available only when the backend order status is Served"*). Server-side `mapCashierMutationError` maps `IDEMPOTENCY_IN_FLIGHT`, payload mismatch, maintenance, 403. | **200 live 2026-08-20** — `ORD-TAPAS_DOWNTOWN-00195` closed for `CASH:122700` (paid 122,700 / remaining 0.00 / `isSettled` true); `409 "Cannot close order in CLOSED state. Order must be SERVED."` on a repeat probe. |
| POST | `/api/payments/manual-reference` | **Non-cash settlement, partial or final.** Card / MTN / Airtel / bank. A payment that clears the balance auto-settles the order server-side (`autoSettleIfFullyPaid` → status `CLOSED`). | `payments.controller.ts` `@Post('payments/manual-reference')` | `pos:payment:manual-reference` | `{ orderId, method, provider?, amount, externalTransactionId, payerPhone?, note? }` + `Idempotency-Key`. | `{ payment, remainingBalance, autoSettled }`. | Reference required client-side; amount may not exceed outstanding; same readiness gate as above (shift, summary, terminal, intent). | **201 live 2026-08-20** — partial `CARD:100000` on a 213,600 bill → remaining 113,600, order stays `SERVED`; a duplicate `externalTransactionId` was **deduped** server-side (no second payment). |
| POST | `/api/pos/orders/:id/split-bill` | Cashier allocation groups (equal/custom) on the parent bill — **metadata only**, no child orders, payments still attach to the parent. | `pos-handoff.controller.ts` `@Post(':id/split-bill')` | `pos:order:split` | `{ mode: "EQUAL"\|"CUSTOM", count?/groups[], reason? }` + `Idempotency-Key`. | `{ ok, sourceOrder, splitBill, note }`. | `cashierResolutionOrderReasons` blocks on terminal/settled/non-open status, unresolved summary or inactive shift; custom amounts must equal the order total. | **200 live 2026-08-20** — `ORD-TAPAS_DOWNTOWN-00615` (304,400) split 3 ways; `metadata.splitBill.allocated = "304400.00"`; one group then part-paid via manual reference. |
| POST | `/api/pos/orders/:id/split-items` | Move selected item lines to a **new child order in `NEW` status**. Truthfully labelled: the child is not sent to KDS from cashier and is not cashier-settleable until service continues. | `pos-handoff.controller.ts` `@Post(':id/split-items')` | `pos:order:split` | `{ items[{orderItemId, quantity}], targetTableId?, reason (required), notes? }` + `Idempotency-Key`. | `{ ok, sourceOrder, childOrder }`. | Same gate as split-bill + per-line quantity bounds and a required reason. | **200 live 2026-08-20** — `ORD-TAPAS_DOWNTOWN-00374` (113,300) → child `…-00374-S1` (`NEW`, 28,000), parent reduced to 85,300. |

> **Close has no standalone control, by contract.** `CloseOrderDto.payments` is
> `@ArrayMinSize(1)` and `closeOrderWithPayment` requires `CLOSABLE_STATES = ['SERVED']` plus
> `alreadyPaid + newPaid >= orderTotal`. A zero-payment close is impossible, so
> `CashierCloseOrderPanel` reports the real close state instead of offering an action the API
> would reject.

> **Recorded gap (backend, not fixed here).** `POST /api/payments/manual-reference` refuses only
> `VOIDED` orders — a **CLOSED** order still accepts a payment (**201** verified live), producing an
> overpayment with no matching close. The Cashier UI fails closed (a terminal bill renders no
> settlement control at all), but the endpoint remains reachable to any holder of
> `pos:payment:manual-reference`. Backend hardening recommended; out of scope for a frontend-only
> prompt.

---

## 6. Till — C2 primary

Client: `lib/cashier/tills.ts`, `lib/cashier/till-state.ts`, `lib/cashier/till-validation.ts`,
`components/cashier/till/CashierTillScreen.tsx` and siblings.
Backend: `apps/api/src/modules/tills/tills.controller.ts` (`@Controller('tills')`,
`JwtAuthGuard, PermissionGuard, BranchContextGuard`, `@RequireBranchContext()`).

All three writes run through `Bg3ReliabilityService.guard` with `idempotencyMode: 'optional'`;
the cashier client always sends `Idempotency-Key`.

| Method | Path | Purpose (cashier) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/tills/:id` | Till detail for the overview cards. Enabled only when `/tills/active` yielded an id. | `tills.controller.ts` `@Get(':id')` | `pos:till:read` | Path id. | Full till + `operatorUser`, `openedBy`, `closedBy`, `shift`. | 401 → `clearSession()`; other errors → *"Could not load till detail."* | **200** |
| GET | `/api/tills/:id/summary` | Cash-movement view feeding `CashierDeferredCashMovements` and the summary cards. | `tills.controller.ts` `@Get(':id/summary')` | `pos:till:read` | Path id. | Till detail **plus** `cashMovements[]` and `computedExpectedCash`. | *"Till summary failed. Retry before cash movement writes."* — the screen blocks writes on a failed summary. | **200** (`cashMovements: []`, `computedExpectedCash` present) |
| POST | `/api/tills/open` | Open the operator's till from `CashierOpenTillPanel`. | `tills.controller.ts` `@Post('open')` | `pos:till:open` | `{ tillCode (≤50, required), openingFloat (number, ≥0, ≤2dp), notes? (≤500) }` + `Idempotency-Key`. | The created till + an `OPENING_FLOAT` cash movement + a `TILL_OPENED` audit row. | 409 *"Till … already has an active session in this branch"*; **400 *"No active shift found. Open a shift before opening a till."*** — see **M1**. | **400** — blocked probe (*no active shift*). The success path was **not** reachable on this stack; no state was written. |
| POST | `/api/tills/:id/safe-drop` | Record a safe drop from `CashierSafeDropPanel`. | `tills.controller.ts` `@Post(':id/safe-drop')` `@HttpCode(200)` | `pos:till:safe-drop` | `{ amount (≥0.01, ≤2dp), reason (required, ≤500) }` + `Idempotency-Key`. | The created `CashMovement`. | Validation is mirrored client-side (`till-validation.ts`); API errors surface in `CashierTillResultNotice`. | not exercised (mutation) — would move real cash state on the demo till. |
| POST | `/api/tills/:id/reconcile` | Count and reconcile from `CashierReconcilePanel`; this is the cashier's till-close path. | `tills.controller.ts` `@Post(':id/reconcile')` `@HttpCode(200)` | `pos:till:reconcile` | `{ countedCash (≥0, ≤2dp), varianceReason? (≤500), notes? (≤500) }` + `Idempotency-Key`. | Reconciled till with `countedCash`, `variance`, `varianceStatus`, `reconciledAt`. | Variance rendered by `CashierVarianceBadge`; confirmation gated by `CashierTillConfirmDialog`. | not exercised (mutation) — would terminate the seeded demo till session. |

> **There is no `POST /api/tills/:id/close`.** The tills controller exposes exactly
> `open`, `:id/safe-drop`, `:id/reconcile`, `active`, `:id`, `:id/summary`. Reconcile is the
> terminal action, and the cashier role holds no `pos:till:close` permission.

---

## 7. Hidden compatibility surfaces (Queue / Receipts — retire C4/C5) — **compat**

These pages are **absent from cashier navigation** (`lib/cashier/routes.ts`) and are **not
redirected** (`CASHIER_COMPATIBILITY_ROUTES` in `lib/cashier/floor-route.ts`). They remain
reachable by typing `/cashier/queue` or `/cashier/receipts` in the address bar, and they still
mount the **full legacy payment / resolution / receipt / refund component set**. Every endpoint
in this section is therefore **live-reachable by a cashier today**, and every one of them must
be counted when reasoning about the role's real blast radius — even though none is on the
primary Floor path (§0).

Mount chains verified in code:

- `/cashier/queue` → `CashierQueueScreen` → `CashierCheckoutPreview` → `CashierPaymentPanel`
  (+ `CashierCloseOrderPanel`) and `CashierResolutionPanel` → `CashierAdvancedResolutionPanel`;
  plus `CashierRefundPanel`.
- `/cashier/receipts` → `CashierReceiptsScreen` → `CashierReceiptDrawer`,
  `CashierReceiptReprintDialog`, `CashierReceiptSendDialog`; plus `CashierRefundPanel`.

### 7.1 Queue reads (compat)

| Method | Path | Purpose (cashier) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/pos/orders?…` | The legacy checkout queue list (filter chips + search via `queue-filters.ts`). Same endpoint as §3/§4, different consumer. | `orders.controller.ts` `@Get()` | `pos:orders:read` | As §4. | `{ data[], total, … }`. | Queue error state. | **200** |
| GET | `/api/pos/orders/:id` | Queue row → checkout preview detail. | `orders.controller.ts` `@Get(':id')` | `pos:orders:read` | Path id. | Full order. | Preview error state. | **200** |
| GET | `/api/pos/orders/:id/payments` | Payment history/summary inside the checkout preview. | `payments.controller.ts` `@Get('pos/orders/:id/payments')` | `pos:payment:read` | Path id. | As §5. | Fails closed as in §5. | **200** |

### 7.2 Payment execution (compat) — **also on the Floor path since C3 (see §5b)**

> **Updated 2026-08-20.** `POST /pos/orders/:id/close` and `POST /payments/manual-reference` are no
> longer compat-only: C3 wired both onto the Cashier Floor settlement workspace and exercised them
> live (§5b). The rows below describe the same endpoints as still reachable from the legacy Queue
> checkout preview, which stays mounted until Queue retires at C5. `POST /payments/intents` remains
> unreachable from either path (**M3**).

| Method | Path | Purpose (cashier) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/pos/orders/:id/close` | **Cash settlement path.** `CashierPaymentPanel` routes method `CASH` here (`method.id === "CASH"` → `closeCashierOrder`). Settles and closes in one call. | `payments.controller.ts` `@Post('pos/orders/:id/close')` `@HttpCode(200)` | `pos:orders:close` | `{ payments: [{ method: "CASH"\|"CARD"\|"MOMO"\|"BANK_TRANSFER", amount (≥0.01, ≤2dp), transactionId?, metadata? }] (min 1), reason? (≤500) }` + `Idempotency-Key`. | `{ order, payments[], orderTotal, totalPaid, changeDue }`. | `payment-validation.ts` mirrors amount rules client-side; `CashierPaymentResultNotice` renders change due; `CashierPaymentBlockedBanner` blocks when till/shift readiness is not green. | not exercised (mutation) — would close a seeded order. Route + `@Permissions('pos:orders:close')` confirmed from the decorator. |
| POST | `/api/payments/manual-reference` | **Non-cash settlement path.** Every non-`CASH` method (`CARD_REFERENCE`, `MTN_REFERENCE`, `AIRTEL_REFERENCE`, `BANK_TRANSFER`) is recorded here as an operator-entered external reference. | `payments.controller.ts` `@Post('payments/manual-reference')` | `pos:payment:manual-reference` | `{ orderId, method: "MOMO"\|"CARD"\|"BANK_TRANSFER", provider?, amount (≥0.01, ≤2dp), externalTransactionId (required, ≤200), payerPhone?, postedAt?, note? }` + `Idempotency-Key`. | `{ payment, remainingBalance, autoSettled }`. | Reference field is required and validated client-side; the panel states plainly that no live acquirer/provider traffic occurs. | not exercised (mutation). Route + `@Permissions('pos:payment:manual-reference')` confirmed from the decorator. |
| POST | `/api/payments/intents` | Mobile-money intent creation. **Client helper exists (`createCashierPaymentIntent`) but has no caller** — see **M3**. | `payments.controller.ts` `@Post('payments/intents')` | `pos:payment:intent` | `{ orderId, provider: "MTN"\|"AIRTEL", amount (≥0.01, ≤2dp), currency?, phoneNumber (≤20), idempotencyKey?, metadata? }` + `Idempotency-Key`. | The intent (`id`, `status`, `provider`, `amount`, `failureReason`). | n/a — unreachable from the UI. | not exercised (mutation) — and **unreachable**: no component imports the helper. |

### 7.3 Bill resolution / handoff writes (compat) — **split-bill + split-items also on the Floor path since C3 (see §5b)**

> **Updated 2026-08-20.** `POST /pos/orders/:id/split-bill` and `/split-items` are now wired on the
> Cashier Floor settlement workspace (§5b) and were exercised live. `merge`, `move-items`,
> `transfer-table` and `transfer-server` remain **compat-only and deliberately excluded** from the
> Floor path — the settlement workspace mounts `CashierResolutionPanel` with `variant="split-only"`,
> which does not render `CashierAdvancedResolutionPanel` at all.

All rows: `apps/api/src/modules/pos-handoff/pos-handoff.controller.ts`
(`@Controller('pos/orders')`, `JwtAuthGuard, PermissionGuard, BranchContextGuard`,
`@RequireBranchContext()`, all `@HttpCode(200)`). **Note the controller** — these live in
`pos-handoff`, *not* in `orders.controller.ts`, and their permissions use the singular
`pos:order:*` namespace, not `pos:orders:*`. See **M2**.

| Method | Path | Purpose (cashier) | Controller | Permission guard | Request essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/api/pos/orders/:id/split-bill` | Even/percentage bill split from `CashierSplitBillPanel`. | `pos-handoff.controller.ts` `@Post(':id/split-bill')` | `pos:order:split` | Split spec + `Idempotency-Key`; mirrored by `resolution-validation.ts`. | Panel-level error notice; `CashierRefundBoundaryCard`-style caveats. | not exercised (mutation) — decorator-confirmed. |
| POST | `/api/pos/orders/:id/split-items` | Item-level split from `CashierSplitItemsPanel`. | `pos-handoff.controller.ts` `@Post(':id/split-items')` | `pos:order:split` | Item selection + `Idempotency-Key`. | Same. | not exercised (mutation) — decorator-confirmed. |
| POST | `/api/pos/orders/merge` | Merge two orders from `CashierMergeOrdersPanel`. **Literal path** — no `:id`. | `pos-handoff.controller.ts` `@Post('merge')` | `pos:order:merge` | `{ …merge spec }` + `Idempotency-Key`. | Same. | not exercised (mutation) — decorator-confirmed. |
| POST | `/api/pos/orders/:id/move-items` | Move items between orders from `CashierMoveItemsPanel`. | `pos-handoff.controller.ts` `@Post(':id/move-items')` | `pos:order:move-items` | Item selection + target + `Idempotency-Key`. | Same. | not exercised (mutation) — decorator-confirmed. |
| POST | `/api/pos/orders/:id/transfer-table` | Move an order to another table from `CashierTransferTablePanel`. | `pos-handoff.controller.ts` `@Post(':id/transfer-table')` | `pos:order:transfer` | `{ tableId }` + `Idempotency-Key`. Table options come from `listCashierTables` → `GET /api/tables` (§3). | Same. | not exercised (mutation) — decorator-confirmed. |
| POST | `/api/pos/orders/:id/transfer-server` | Reassign the owning server. **Client helper exists (`transferCashierOrderServer`) but has no panel** — see **M3**. | `pos-handoff.controller.ts` `@Post(':id/transfer-server')` | `pos:order:transfer` | `{ userId }` + `Idempotency-Key`. | n/a — unreachable from the UI. | not exercised (mutation) — and **unreachable**. |

### 7.4 Receipts (compat)

Client: `lib/cashier/receipts.ts`, `lib/cashier/receipt-state.ts`.
Backend: `apps/api/src/modules/receipts/receipts.controller.ts` (`@Controller('receipts')`,
`JwtAuthGuard, PermissionGuard, BranchContextGuard`, `@RequireBranchContext()`).

> **Identity rule.** `receipt id == order id` — closed orders *are* the receipt
> (`ReceiptsService.loadOrderForReceipt` looks the id up in `order`). The cashier client passes
> an order id into every receipt call. Correct by design; verified live (unknown id → **404**
> `Receipt not found`; a CLOSED order id → **200** with a composed view).

| Method | Path | Purpose (cashier) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/receipts/:id` | Receipt preview in `CashierReceiptDrawer`. Read is audit-logged server-side (`RECEIPT_VIEWED`). | `receipts.controller.ts` `@Get(':id')` | `pos:receipt:read` | Path id = **order id**. | `receiptId`, `orderId`, `orderNumber`, `status`, `organization`, `branch`, totals, `items[]`, `payments[]`, `footer`, `history`. | Drawer error state with the API message; **404** for an unknown id. | **200** (CLOSED order `ORD-TAPAS_DOWNTOWN-01171`); **404** for a bogus id. |
| GET | `/api/receipts/:id/history?pageSize=50` | Receipt audit timeline in the drawer. | `receipts.controller.ts` `@Get(':id/history')` | `pos:receipt:read` | `pageSize` is `@Min(1) @Max(200)` — the client sends the literal `50`. | `{ data[], total, page, pageSize, receiptId }` with `action` (`RECEIPT_VIEWED`, …), `actorUserId`, `metadata`. | Separate history error line inside the drawer. | **200** |
| POST | `/api/receipts/:id/reprint` | Record a duplicate-receipt request from `CashierReceiptReprintDialog`. | `receipts.controller.ts` `@Post(':id/reprint')` `@HttpCode(200)` | `pos:receipt:reprint` | `{ reason? (≤280), copies? (int 1–10, default 1) }` + `Idempotency-Key` (BG3 `optional`). | `{ ok, action, receiptId, copies, reprintedAt, printable }`. | **400** unless the order is `CLOSED` or `VOIDED`; `receipt-state.ts` pre-disables the control with the same rule. No print-driver completion is guaranteed. | **400** — gate probe on a `SERVED` order: *"Receipt for order in status SERVED cannot be reprinted (must be CLOSED or VOIDED)."* Success path not exercised (mutation). |
| POST | `/api/receipts/:id/send` | Record a pending email/SMS/WhatsApp delivery from `CashierReceiptSendDialog`. | `receipts.controller.ts` `@Post(':id/send')` `@HttpCode(202)` | `pos:receipt:send` | `{ channel: "email"\|"sms"\|"whatsapp", recipient (≥3), locale?, note? }` + `Idempotency-Key`. | **202** + `{ status: "PENDING", supported: false, reason: "NO_LIVE_DELIVERY_ADAPTER", … }`. | Same `CLOSED`/`VOIDED` **400** gate. **There is no live delivery adapter** — a success is a recorded intent, not a delivery, and the dialog must say so. | **400** — gate probe on a `SERVED` order: *"…cannot be sent (must be CLOSED or VOIDED)."* Success path not exercised (mutation). |

### 7.5 Refunds (compat)

Client: `lib/cashier/refunds.ts`, `lib/cashier/refund-state.ts`,
`components/cashier/refunds/CashierRefundPanel.tsx` (mounted by **both** the Queue and Receipts
screens).
Backend: `apps/api/src/modules/refunds/refunds.controller.ts` (`@Controller('pos')`,
`JwtAuthGuard, PermissionGuard, BranchContextGuard`, `@RequireBranchContext()`).

| Method | Path | Purpose (cashier) | Controller | Permission guard | Request essentials | Response essentials | Error modes the UI handles | Verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/pos/orders/:id/refunds` | Refund history for the selected order (`CashierRefundHistory`). | `refunds.controller.ts` `@Get('orders/:id/refunds')` | `pos:refund:read` | Path id. | Bare array of refunds. | Panel error notice. | **200** (`[]` on the CLOSED demo order) |
| POST | `/api/pos/orders/:id/refunds` | Create a refund against a **COMPLETED** payment on a **CLOSED** order. | `refunds.controller.ts` `@Post('orders/:id/refunds')` | `pos:refund:create` | `{ paymentId, amount (≥0.01, ≤2dp), reason (≤500), provider?, metadata? }` + `Idempotency-Key`. | The created refund (status `PENDING` — cashier **cannot** approve). | `mapRefundApiError` maps: 403 → *"Cashier does not have permission for this refund action."*; 400 `exceeds` → raw message; 404 payment/order; **409 `closed`** → *"Refunds are available after close."*; `IDEMPOTENCY_IN_FLIGHT`; `PAYLOAD_MISMATCH`; **423** maintenance. | **409** — gate probe on a `SERVED` order: *"Refunds can only be issued on CLOSED orders"*, thrown **before** any write. Success path not exercised (mutation). |
| GET | `/api/pos/refunds/:id` | Single-refund detail. **Client helper exists (`getCashierRefund`) but has no caller** — see **M3**. | `refunds.controller.ts` `@Get('refunds/:id')` | `pos:refund:read` | Path id. | One refund. | n/a — unreachable from the UI. | not exercised — **unreachable** from any cashier surface. |

> **Refund approval is out of scope for cashier, and the backend agrees.**
> `POST /api/pos/refunds/:id/approve` requires `pos:refund:approve` and
> `POST /api/pos/orders/:id/post-close-void` requires `pos:void:postclose`; the seeded cashier
> holds **neither**. Verified live: both returned **403 `Insufficient permissions`**. A
> cashier-created refund therefore stays `PENDING` until a supervisor acts —
> `CashierRefundThresholdNotice` / `CashierRefundBoundaryCard` state this in the UI.

---

## 8. Permissions the cashier holds but never uses

`GET /api/auth/me` returned **63** permissions for the seeded `Cashier` (L2) role. The
following are held but exercised by **no** cashier surface — relevant because they define the
role's real blast radius if a future surface is added carelessly:

| Permission | Backend routes it unlocks | Cashier UI usage |
| --- | --- | --- |
| `pos:orders:write` | `POST /api/pos/orders`, `…/items`, `…/send`, `…/mark-served`, `…/request-bill` | **None.** The cashier never creates or edits an order. |
| `pos:kds:write` | KDS state transitions | **None.** |
| `pos:payment:create`, `pos:payment:close`, `pos:payment:cancel` | Legacy payment routes + `POST /api/payments/intents/:id/cancel` | **None.** The Queue compat path uses only `close` + `manual-reference`. |
| `pos:reservation:create` / `:confirm` / `:seat` / `:table:assign` / `:deposit:record` | `reservations.controller.ts` writes | **None.** Cashier reads reservations for the Floor overlay only. |
| `pos:shift:open`, `pos:shift:close` | `POST /api/shifts/open`, `POST /api/shifts/:id/close` | **WIRED 2026-08-20** — Cashier **Me** shift card (`lib/cashier/shifts.ts` → `CashierMeScreen`). Was *"None — and this is the cause of M1"*; see §2a and **M1 (resolved)**. |
| `pos:hr:attendance:*`, `pos:hr:leave:*`, `pos:hr:shift-swaps:*` | `attendance.controller.ts` (`/api/hr/**`) | **None.** Unlike Waiter Me, `CashierMeScreen` renders **no** workforce self-service; the `components/profile/*` pieces it uses are presentational only and issue no requests. |
| `pos:menu:read`, `pos:discount:*`, `pos:inventory:read`, `pos:feedback:*`, `pos:event:*`, `pos:documents:read`, `pos:payroll:slips:read`, `pos:workforce:*`, `pos:tax:read` | various | **None.** |

Permissions the cashier **does not** hold, confirmed live: `pos:refund:approve` (**403**),
`pos:void:postclose` (**403**), `pos:orders:void`, `pos:table:write`, `pos:floor:write`,
`pos:till:close` (no such route).

---

## 9. Counts

| Metric | Count |
| --- | --- |
| Distinct `method + path` endpoints reachable from the Cashier UI | **34** (32 at first publication + `POST /shifts/open` and `POST /shifts/:id/close`, UI-wired 2026-08-20) |
| — on **C2/C3 primary** surfaces (Floor / Find bill / Settlement / Till / Me / Auth) | **22** (18 read/Till/Auth + the 4 settlement writes promoted in C3, §5b) |
| — on **compat** surfaces only (`/cashier/queue`, `/cashier/receipts`) | **12** (was 16; 4 moved to primary in C3) |
| **Live-verified** (an HTTP code observed on 2026-08-20) | **25** (21 + the 4 C3 settlement writes) |
| **Static-only** (not exercised; controller-decorator verified) | **9** |
| Endpoints with a **client helper but no caller** (dead client code) | 3 |

Live-verified rows: `POST /auth/login` 201 · `POST /auth/quick-pin-login` 400/401 ·
`GET /auth/me` 200 · `GET /shifts/active` 200 · `GET /tills/active` 200 · `GET /tables` 200 ·
`GET /pos/orders` 200 (7 query shapes) · `GET /reservations` 200 · `GET /pos/orders/:id` 200 ·
`GET /pos/orders/:id/payments` 200 · `GET /tills/:id` 200 · `GET /tills/:id/summary` 200 ·
`POST /tills/open` 400 (no shift) and 409 (with a Me-opened shift — the M1 resolution probe) ·
`POST /shifts/open` 201 · `POST /shifts/:id/close` 201 · `GET /pos/orders/:id/refunds` 200 · `POST /pos/orders/:id/refunds` 409 ·
`GET /receipts/:id` 200 + 404 · `GET /receipts/:id/history` 200 ·
`POST /receipts/:id/reprint` 400 · `POST /receipts/:id/send` 400.
Live-verified in Prompt C3 (2026-08-20, real mutations on the disposable stack):
`POST /pos/orders/:id/close` **200** (and **409** on a closed bill) ·
`POST /payments/manual-reference` **201** (partial; duplicate reference deduped; **201** even on a
CLOSED order — see §10 **M7**) · `POST /pos/orders/:id/split-bill` **200** ·
`POST /pos/orders/:id/split-items` **200**.
The 9 remaining static-only rows are `POST /auth/logout`, `POST /tills/:id/safe-drop`,
`POST /tills/:id/reconcile`, `POST /payments/intents`, `POST /pos/orders/merge`, `…/move-items`,
`…/transfer-table`, `…/transfer-server`, and `GET /pos/refunds/:id`.
Plus guard probes: missing `X-Branch-Id` **400**, missing token **401**,
`pos:refund:approve` **403**, `pos:void:postclose` **403**.

---

## 10. Mismatches and live findings, 2026-08-20

| # | Finding | Evidence | Impact on the Cashier UI |
| --- | --- | --- | --- |
| **M1** *(resolved 2026-08-20 by owner-approved UI addition — see the note under this table)* | **The cashier can hold an OPEN till while `GET /shifts/active` says there is no shift — and can never open a till from the cashier workspace.** `getActiveShift` filters on `openedById = actor.id`; `getActiveTill` filters on `operatorUserId = actor.id`. On this stack the cashier's OPEN till `TILL-TAPAS_DOWNTOWN-020` belongs to shift `SH-TAPAS_DOWNTOWN-020`, which was **opened by `manager@nimbus.demo`**. | Live: `GET /api/shifts/active` → **200 `null`**; `GET /api/tills/active` → **200** OPEN till; `GET /api/shifts/:id` → `openedById: c6058bbe…` (Daniel Okello, manager). `tills.service.ts:openTill` requires `shift.openedById = userId` and throws **400 *"No active shift found. Open a shift before opening a till."*** — reproduced live. | Two concrete problems. (a) The readiness strip renders a **contradiction**: *"No active shift"* (warning) next to *"Till active TILL-TAPAS_DOWNTOWN-020"* (success), and `CashierPaymentBlockedBanner` blocks settlement on the shift chip. (b) The Cashier UI has **no shift-open control anywhere** — grep for `shifts/open` across `lib/cashier/**` and `components/cashier/**` returns nothing — even though the role holds `pos:shift:open`. A cashier starting cold therefore **cannot open a till without another role opening a shift for them first**. This is a genuine product gap, not a stack artifact; the demo seed merely surfaces it. |
| **M2** | **Bill-resolution routes live in a different controller and a different permission namespace than the canonical docs imply.** `split-bill`, `split-items`, `merge`, `move-items`, `transfer-table`, `transfer-server` are **not** in `orders.controller.ts` — they are in `pos-handoff.controller.ts`, which re-declares `@Controller('pos/orders')`. Their permissions are singular `pos:order:split` / `:merge` / `:transfer` / `:move-items`, while every other order route uses plural `pos:orders:*`. | `apps/api/src/modules/pos-handoff/pos-handoff.controller.ts:39-227`. Cashier holds all four (`pos:order:merge`, `pos:order:move-items`, `pos:order:split`, `pos:order:transfer`). | Paths and guards are **correct** — the client calls resolve. But anyone auditing "which controller owns `/api/pos/orders/*`" from `orders.controller.ts` alone will conclude these routes do not exist, and anyone grepping for `pos:orders:` will miss four cashier-held permissions. Documented here so C3/C5 does not "fix" a non-bug. |
| **M3** | **Three client API helpers have no caller — dead client code.** `createCashierPaymentIntent` (`POST /api/payments/intents`), `transferCashierOrderServer` (`POST /api/pos/orders/:id/transfer-server`), and `getCashierRefund` (`GET /api/pos/refunds/:id`). | Grep across `apps/web/src/components/**` + `pages/**`: zero references to all three. `CashierPaymentPanel` routes `MTN_REFERENCE` / `AIRTEL_REFERENCE` to `createCashierManualReferencePayment`, never to the intent endpoint. | Mobile money is **manual-reference only** in the shipped cashier build — there is no intent creation, and consequently **no intent polling either** (`GET /api/payments/intents/:id/status` is never called, so an intent, if one existed, would never be reconciled by the UI). Server transfer and single-refund lookup are unreachable. These helpers should be either wired in C3/C5 or deleted; they should not be read as evidence of shipped capability. |
| **M4** | **`GET /api/pos/orders/:id/payments` has no ownership or role scoping beyond branch.** Any actor with `pos:payment:read` and the branch header can read any order's payment summary. | `payments.controller.ts:152` — `@Permissions('pos:payment:read')`, branch-scoped service lookup only. Verified live on an order the cashier does not own. | Correct for the cashier role (a cashier must settle other people's orders), and Find bill's exact-id path relies on it. Recorded because it is the same asymmetry flagged for receipts in `docs/waiter-ui-docs/WAITER_API_MATRIX.md` §7 — it is an API-surface property, not a cashier-UI leak. |
| **M5** | **`pageSize` on `GET /api/pos/orders` has no server-side maximum.** `ListOrdersQueryDto.pageSize` is `@IsInt() @Min(1)` with no `@Max`. | `apps/api/src/modules/orders/dto/list-orders-query.dto.ts`. | The cashier client self-bounds (100 Floor / 50 table-bills / 25 Find bill) and Find bill honestly says *"Showing the 25 most recent bills…"*. The protection is client-side only; a crafted request is unbounded. Contrast `receipts` history, which is properly `@Max(200)`. |
| **M6** | **The legacy pack matrix is now materially stale.** `Front End/cashier_ui_docs_pack/docs/cashier-ui-docs/CASHIER_API_MATRIX.md` (2026-07-01) describes the Queue-first build: it has no Floor/bill-resolution rows (`GET /api/tables`, `GET /api/reservations`, the `tableId=` table-bills read, the Find-bill filter shapes), no verified-status column, and presents payment/close/receipt/refund as primary cashier capability. | Comparison with the C2 code in `lib/cashier/**`. | It remains accurate as a record of the **pre-reconstruction** surface, which is exactly what the compat routes still mount — so it is not wrong, it is scoped to §7 of this file. It is now marked historical/superseded in `docs/DOCUMENT_INDEX.md` and carries a supersession banner. |
| **M7** *(new 2026-08-20, Prompt C3)* | **`POST /api/payments/manual-reference` accepts a payment on an already-CLOSED order.** `createManualReferencePayment` refuses only `['VOIDED']`; a CLOSED order still gets a `COMPLETED` payment, producing an overpayment with no corresponding close event. | Live probe on the C3 stack: after closing `ORD-TAPAS_DOWNTOWN-00195` (total 122,700, paid 122,700), a further `CARD:1000` manual reference returned **201** and the payment summary then read `totalPaid 123,700 / remainingBalance 0.00`. The equivalent `POST /pos/orders/:id/close` probe correctly returned **409**. | The Cashier UI **fails closed**: `validateCashierPaymentInput` blocks terminal orders and, from C3, `CashierSettlementActions` renders no settlement form at all for a CLOSED/VOIDED bill — so this is unreachable from the product. It stays reachable to any holder of `pos:payment:manual-reference` via the API. **Backend hardening recommended** (mirror the close guard); not implemented — C3 was frontend-only. |
| **M8** *(new 2026-08-20, Prompt C3 — environment/data)* | **`POST /api/pos/orders` can 500 with a unique-constraint error on a branch whose newest order carries a branch-prefixed number.** `OrdersService.generateOrderNumber` reads the newest order by `createdAt` and parses `/ORD-(\d+)/`. `ORD-TAPAS_DOWNTOWN-00374` does not match, so the sequence resets to `ORD-000001`, which already exists → `Unique constraint failed on the fields: (branch_id, order_number)`. | Live: repeated `POST /api/pos/orders` → **500**; API log shows the Prisma unique-constraint error at `OrdersService.createOrder`. Creation recovered as soon as an `ORD-<digits>`-numbered order became newest again. | No Cashier UI impact (the Cashier never creates orders), but it breaks **QA fixtures** that build their own bills. `e2e/cashier-floor/c3-fixtures.ts` therefore falls back to adopting an existing unpaid payable bill. **Backend hardening recommended** (branch-scoped sequence, or a regex that tolerates the branch-prefixed demo format); not implemented — C3 was frontend-only. |

> **M1 — resolved 2026-08-20 by owner-approved UI addition.** Half (b) of M1 (the Cashier UI had
> no shift-open control anywhere) is closed: `CashierMeScreen` now renders the shared
> `ShiftStatusCard` with **Start shift** / **End shift** and an optional note, over the new
> `lib/cashier/shifts.ts` helpers (§2a). A cold-start cashier opens a shift from **Me** and the
> `/api/tills/open` shift gate is satisfied — verified live 2026-08-20: with no shift the probe
> returned **400 *"No active shift found. Open a shift before opening a till."***; after opening a
> shift from Me the same probe returned **409 *"Till … already has an active session in this
> branch"*** (past the shift check, nothing written). The readiness strip now also points at the
> fix (*"No active shift · Open Me to start"*). **No backend / schema / permission / seed / Postman
> change** — the cashier already held `pos:shift:open` + `pos:shift:close`. Half (a) — the seeded
> contradiction where an OPEN till belongs to a manager-opened shift — remains a **data/seed**
> property of this stack and is unchanged.

### Stale claims found in the existing canonical cashier docs

Checked all eight files in `docs/cashier-ui-docs/` against the code and the live stack:

- **No stale endpoint or permission claims.** The canonical set contains **zero** `/api/` paths
  and zero `pos:*` permission strings — it is written at the workflow level, which is precisely
  why this matrix was needed.
- **No old-brand visual claims.** `CASHIER_LIFECYCLE.md` (and the rest of the directory)
  contains no hex values, no "Storefront icon" reference, and no palette table, so the Aug-2026
  rebrand required **no edits** to it. Brand language is owned by `docs/BRAND_IDENTITY.md`.
- **One nuance worth knowing when reading `CASHIER_LIFECYCLE.md`:** §§ 5–13 describe payment,
  split, close, receipt and refund steps as the **locked target**. Its own banner says so, but
  the body reads as present tense. On the primary Floor path those steps are **not built** (§0);
  the only place they exist today is the compat routes (§7).
- **`README.md` doc index was incomplete** — it listed seven documents and no API matrix. Fixed
  in this pass.

---

## 11. Visual language note (Aug-2026 rebrand)

Canonical source: `docs/BRAND_IDENTITY.md` (2026-08-20). The cashier shell follows the same
**dark chrome around a light workspace** pattern as Waiter and Supervisor: navy `#000033`
header and bottom nav, white cards on a light workspace, Light Grey `#B3B4AF` for dividers and
muted surfaces, Dark Grey `#6B6B6B` for secondary text. The steering-wheel logomark replaces
the earlier placeholder mark. Never hard-code a hex in a cashier component — consume the
`--color-brand-*` tokens.

**The rebrand changed no cashier behaviour and no endpoint in this matrix.** It is a token and
asset change only.

---

## 12. Source map

| Concern | File |
| --- | --- |
| HTTP client, error codes, headers, timeout | `apps/web/src/lib/api/client.ts` |
| Auth calls + session | `apps/web/src/lib/auth/auth-api.ts`, `lib/auth/AuthProvider.tsx` |
| Readiness (shift + till) | `apps/web/src/lib/cashier/api.ts`, `lib/cashier/readiness.ts` |
| Floor fan-out | `apps/web/src/lib/cashier/floor-api.ts` |
| Order reads + query builder | `apps/web/src/lib/cashier/orders.ts` |
| Bill classification (pure) | `apps/web/src/lib/cashier/bill-resolution.ts`, `lib/cashier/order-state.ts` |
| Query keys | `apps/web/src/lib/cashier/bill-query-keys.ts` |
| URL state + compat routes | `apps/web/src/lib/cashier/floor-route.ts` |
| Nav | `apps/web/src/lib/cashier/routes.ts` |
| Till calls | `apps/web/src/lib/cashier/tills.ts` |
| Payment calls (compat) | `apps/web/src/lib/cashier/payments.ts` |
| Handoff/resolution calls (compat) | `apps/web/src/lib/cashier/resolution.ts` |
| Receipt calls (compat) | `apps/web/src/lib/cashier/receipts.ts` |
| Refund calls (compat) | `apps/web/src/lib/cashier/refunds.ts` |
| Idempotency keys | `apps/web/src/lib/cashier/idempotency.ts` |
| Backend controllers | `apps/api/src/modules/{auth,shifts,tills,floor,orders,reservations,payments,pos-handoff,receipts,refunds}/*.controller.ts` |
