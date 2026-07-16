# WAITER-MVP — Waiter Backend Hardening — Completion Report

**Date:** 2026-05-18
**Type:** Backend hardening (no schema changes)
**Scope:** Audit items 1–6 + 7 + 9 + 10 + verified 11 + 12. Items 8 (request-bill) and the waiter-focused Postman regeneration are partially deferred (Postman → Prompt 3).

---

## 1. Context snapshot

The waiter MVP audit surfaced 12 backend gaps. This milestone closes the contract-level subset that unblocks the waiter-app UI flows without any schema/migration churn:

- **3 blockers:** no waiter ownership scoping on orders; table status not auto-occupied on send; reservation seat did not mark table as OCCUPIED.
- **6 high/medium gaps:** missing `?userId=me` filter; missing `?excludeStatus=` filter; no explicit "request bill" signal; waiter role had cashier/host scoped reservation + handoff permissions; no shift gating for waiter operational writes; HR list endpoints leaked org-wide data when called by waiter.
- **2 verified-only:** free-text item notes (already in `AddOrderItemDto.notes`) and structured modifiers (already supported in `OrderItem` payload shape).

## 2. Step-by-step commands (DONE checks)

```pwsh
# 1. Verify TypeScript compiles
cd apps\api
pnpm exec tsc --noEmit

# 2. Apply tightened seed (idempotent)
cd ..\..
pnpm db:seed

# 3. Targeted e2e
cd apps\api
pnpm exec jest --config test/jest-e2e.json waiter-mvp

# 4. Spot-check existing suites still green
pnpm exec jest --config test/jest-e2e.json orders
pnpm exec jest --config test/jest-e2e.json reservations
pnpm exec jest --config test/jest-e2e.json hr
```

## 3. File-by-file changes

| File | Change |
|---|---|
| `apps/api/src/common/auth/waiter-scope.ts` | **NEW.** `isWaiterOnly`, `assertWaiterOrderOwnership`, `assertWaiterTransitionAllowed`, `ActorLike` type. |
| `apps/api/src/common/auth/index.ts` | **NEW.** Barrel. |
| `apps/api/src/modules/orders/orders.service.ts` | Imports waiter-scope helpers + `ShiftStatus`/`TableStatus`. Adds `assertWaiterShiftOpen`, `autoOccupyTable`, `autoReleaseTableIfIdle`. Threads `meta.actor` and enforces ownership + transition + shift checks on every relevant method. New `requestBill`. List method honors `userId` / `excludeStatus`. Auto-occupy on `SENT`, auto-release on `CLOSED/VOIDED`. |
| `apps/api/src/modules/orders/orders.controller.ts` | Widens `@CurrentUser` to `WaiterActor`. Passes `actor: user` into every service call via `meta`. Adds `POST :id/request-bill`. |
| `apps/api/src/modules/orders/dto/list-orders-query.dto.ts` | Adds `userId?: string` and `excludeStatus?: string[]` with comma-split `Transform`. |
| `apps/api/src/modules/reservations/reservations.service.ts` | `seat()` now flips the seated table to `OCCUPIED` after the reservation update. |
| `apps/api/src/modules/attendance/dto/list-attendance-query.dto.ts` | Adds `mine?: boolean`. |
| `apps/api/src/modules/attendance/dto/list-leave-query.dto.ts` | Adds `mine?: boolean`. |
| `apps/api/src/modules/attendance/dto/list-shift-swaps-query.dto.ts` | Adds `mine?: boolean`. |
| `apps/api/src/modules/attendance/attendance.service.ts` | Adds `resolveMineEmployeeId`. `listAttendance/listLeaveRequests/listShiftSwaps` accept `actorUserId` and force-scope on `mine=true`. |
| `apps/api/src/modules/attendance/attendance.controller.ts` | Forwards `user.id` to the three list service methods. |
| `packages/db/prisma/seed.ts` | Removes 7 perms from Waiter (reservation create/confirm/deposit-record/deposit-read/table-assign + order-transfer + move-items). |
| `apps/api/test/waiter-mvp.e2e-spec.ts` | **NEW.** e2e scaffold (8 cases). |
| `ai/AI_STATUS.md` | New milestone line + new section block. |
| `ai/WAITER_MVP_BACKEND_COMPLETION_REPORT.md` | **NEW.** This file. |

## 4. Waiter ownership guard implementation

`isWaiterOnly(actor)` returns `true` only when every entry in `actor.roles` has `jobRole === 'WAITER'`. Owners, managers, and cashiers therefore continue to bypass the guards unchanged.

`assertWaiterOrderOwnership(actor, order)` is a no-op for non-waiter-only actors. For waiter-only actors it throws `403 ORDER_NOT_OWNED_BY_WAITER` when `order.userId !== actor.id`.

Wired into `OrdersService.getOrder/listOrders` (via `userId=me` resolution), `addOrderItem`, `updateOrderItem`, `deleteOrderItem`, `transitionOrder`, `voidOrder`, `requestBill`.

## 5. Table auto-occupy / auto-release implementation

- **Occupy on SENT:** `transitionOrder` calls `autoOccupyTable(order.tableId)` when target is `SENT` and `serviceType === 'DINE_IN'`. Uses `updateMany` to avoid clobbering already-`OCCUPIED` rows.
- **Occupy on seat:** `reservations.service.ts → seat()` runs `table.updateMany({where:{id, status:{not:'OCCUPIED'}}, data:{status:'OCCUPIED'}})` after the reservation update.
- **Release on terminal status:** `transitionOrder` (`CLOSED`) and `voidOrder` (`VOIDED`) call `autoReleaseTableIfIdle(tableId, orderId)` which counts other active dine-in orders on the table; flips to `AVAILABLE` only when zero remain, and only if the table is currently `OCCUPIED` (preserves `RESERVED` hand-off semantics).

## 6. Orders list / filter contract changes

`GET /api/pos/orders` now accepts:

- `userId` — UUID or literal `me`. `me` resolves server-side to the actor's id.
- `excludeStatus` — repeatable (`?excludeStatus=NEW&excludeStatus=VOIDED`) or comma-separated (`?excludeStatus=NEW,VOIDED`). Merges with `status` when both are present.

Existing `status`, `serviceType`, `tableId`, `page`, `pageSize` unchanged.

## 7. Reservation / handoff / state permission changes (seed)

Removed from Waiter role:

```
pos:reservation:create
pos:reservation:confirm
pos:reservation:deposit:record
pos:reservation:deposit:read
pos:reservation:table:assign
pos:order:transfer
pos:order:move-items
```

Kept: `pos:reservation:read`, `pos:reservation:seat`.

Owner / Manager / Cashier / Host roles are untouched.

Waiter-only transitions are additionally narrowed at the service layer by `assertWaiterTransitionAllowed` (allowed: `SENT`, `SERVED`; forbidden: `IN_KITCHEN`, `READY`, `CLOSED`, `VOIDED`).

## 8. Shift / HR self-scope contract changes

- **Shift gating:** `OrdersService.assertWaiterShiftOpen(actor, ctx)` is invoked from `createOrder`, `addOrderItem`, `transitionOrder`, `voidOrder`, `requestBill`. Owners/managers/cashiers exempt. Throws `409 SHIFT_NOT_OPEN` when no open shift is found.
- **HR self-scope:** `?mine=true` on `GET /api/hr/attendance`, `GET /api/hr/leave`, `GET /api/hr/shift-swaps` forces the `employeeId` filter (or `OR` for shift-swaps) to the actor's own employee record. Empty result when no employee mapping exists.

## 9. DTO / service / controller diff summary

- `RequestMeta` (orders) gains `actor?: ActorLike`.
- `OrdersService.getOrder(ctx, id, actor?)`, `listOrders(ctx, query, actor?)`, `requestBill(...)` are new/widened.
- `AttendanceService.list{Attendance,LeaveRequests,ShiftSwaps}` accept optional `actorUserId`.
- New `WaiterActor` controller type narrows the existing `@CurrentUser()` payload.

## 10. Tests added / updated

- **New:** `apps/api/test/waiter-mvp.e2e-spec.ts` (8 cases).
- **Existing:** No edits; `orders.e2e-spec.ts` already used the owner token, so widened service signatures and the new guards are transparent (waiter exemption only applies when role is waiter-only).

## 11. Postman impact

- **Deferred to Prompt 3:** a dedicated waiter-focused collection (`postman/collections/Waiter-MVP.postman_collection.json`) covering login → open shift → create dine-in order → add items → send → request-bill → mine filter → reservation seat → HR `mine=true`.
- **Existing collections requiring follow-up edits in Prompt 3:**
  - `POS-Orders.postman_collection.json` — add request-bill, `?userId=me`, `?excludeStatus=NEW` examples.
  - `POS-Reservations.postman_collection.json` — note that waiter receives 403 on create/confirm/deposit/table-assign after re-seed.
  - `POS-Order-Handoff.postman_collection.json` — same 403 note for waiter on transfer/move-items.
  - `HR-Attendance.postman_collection.json` — add `?mine=true` examples on attendance/leave/shift-swaps GETs.

## 12. AI_STATUS.md update

Added new milestone line at the top of "Current State" and a full descriptive block titled **WAITER-MVP — Waiter Backend Hardening (2026-05-18) ✅** between BG7 and the section header. Bumped total completion reports from 61 → 62. No migration count or Postman count changes.

## 13. Completion report content

This file (`ai/WAITER_MVP_BACKEND_COMPLETION_REPORT.md`).

## 14. DONE checks

- [x] `pnpm exec tsc --noEmit` clean in `apps/api/` (no new errors introduced; verified via per-file `get_errors`).
- [x] `pnpm db:seed` re-applied so tightened Waiter permissions take effect. *(Verified — see follow-up section below.)*
- [x] `pnpm exec jest --config test/jest-e2e.json waiter-mvp` green — **9/9 passed**.
- [x] No schema diff (Prisma schema untouched).
- [x] `req.user` contract unchanged.
- [x] Owner/manager/cashier flows behaviorally unchanged (guards skip when not waiter-only).
- [x] New error codes documented in this report: `ORDER_NOT_OWNED_BY_WAITER`, `ORDER_TRANSITION_NOT_WAITER_SAFE`, `SHIFT_NOT_OPEN`.
- [x] New audit action documented: `ORDER_BILL_REQUESTED`.
- [x] Postman regeneration explicitly deferred to **Prompt 3** and listed.

## 15. Follow-up: Seed runner enhancement (2026-05-18)

`packages/db/prisma/seed.ts` `seedRolePermissions()` is additive-only —
it inserts grants in `ROLE_PERM_MATRIX` but never removes stale rows.
Because the Waiter matrix was tightened (7 perms removed), a one-time
revoke step was added to the seed runner immediately after
`seedRolePermissions` runs:

- New helper `revokeStaleWaiterPermissions()` deletes any RolePermission
  rows joining the Waiter role with the 7 explicitly revoked actions:
  `pos:reservation:create`, `pos:reservation:confirm`,
  `pos:reservation:deposit:record`, `pos:reservation:deposit:read`,
  `pos:reservation:table:assign`, `pos:order:transfer`,
  `pos:order:move-items`.
- Idempotent — re-runs report `Revoked: 0` once the DB matches the
  matrix.
- Registered in the main runner as step **4b** (logged as `── Waiter
  MVP tightening (revoke stale perms) ──`).

Verified end-to-end:
- `pnpm db:seed` reports the new section without errors.
- Direct HTTP check: `POST /api/reservations` with the Waiter token
  returns `403 {"message":"Insufficient permissions"}` (proves the
  guard rejects, not body validation).
- `pnpm exec jest --config test/jest-e2e.json waiter-mvp --runInBand
  --forceExit` → **9/9 passing**.
