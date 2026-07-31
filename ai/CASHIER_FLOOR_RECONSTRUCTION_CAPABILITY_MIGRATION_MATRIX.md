# Cashier Floor Reconstruction — Capability Migration Matrix

**Status:** Prompt C0 deliverable. Audit-only, no runtime code changed. Read against the local
dirty worktree on 2026-07-31, cross-referenced with the backend (`apps/api`) and the target
architecture in `docs/cashier-ui-docs/`. This is the evidence-backed detail behind the summary
table in `docs/cashier-ui-docs/CASHIER_COMPONENT_REUSE_MAP.md` and the "current/expected
evidence" column of `ai/CASHIER_FLOOR_RECONSTRUCTION_GAP_REGISTER.md` (rows CASH-FR-005..023).

Classification legend used in every table below:

- **A** — shared Floor responsibility
- **B** — settlement-workspace responsibility
- **C** — Find bill responsibility
- **D** — Till responsibility
- **E** — obsolete after migration
- **F** — blocked by a missing backend/permission contract (missing piece named explicitly)

Confirmed up front: **Cashier currently has no Floor page.** `apps/web/src/pages/cashier/`
contains only `me.tsx`, `queue.tsx`, `receipts.tsx`, `till.tsx` — no `floor.tsx`. Visible nav is
still Queue/Receipts/Till/Me (`apps/web/src/lib/cashier/routes.ts:4-29`).

---

## Domain 1 — Queue capabilities

### What the code does today

`apps/web/src/pages/cashier/queue.tsx` renders `CashierShell` + `CashierQueueScreen`
(`apps/web/src/components/cashier/queue/CashierQueueScreen.tsx`). On mount it:

1. Fires `ordersQuery` — `GET /api/pos/orders` via `listCashierOrders`
   (`apps/web/src/lib/cashier/orders.ts:30-39`) with `excludeStatus=NEW,CLOSED,VOIDED&pageSize=100`
   (or `status=CLOSED&pageSize=100` for the "Closed orders" filter chip) — one branch-wide,
   **fixed-page-1, no-pagination-UI** read (`CashierQueueScreen.tsx:42-57`).
2. Auto-selects `visibleOrders[0]` the first time the list resolves
   (`CashierQueueScreen.tsx:89-93`) — this is a **silent first-pick**, not an explicit
   selector.
3. That auto-selection fires two more requests: `detailQuery` (`GET /api/pos/orders/:id`) and
   `selectedPaymentsQuery` (`GET /api/pos/orders/:id/payments`) (`CashierQueueScreen.tsx:103-117`).
4. `useCashierReadiness()` (`apps/web/src/lib/cashier/readiness.ts:53-71`) fires two more:
   `GET /api/shifts/active` and `GET /api/tills/active`.

So a cold Queue mount is **list (1) → auto-select → detail + payments (2) → readiness (2) = 5
requests**, not the 1 the page's own help text implies ("Queue reads only `GET
/api/pos/orders`, order detail, and order payment summary endpoints" —
`CashierQueueScreen.tsx:242-248`).

**Confirmed dead filter:** `paymentState` in `CashierQueueScreen.tsx:66-69` is a `useMemo` that
constructs one empty `Map`/`Set` **once**, with no setter ever called anywhere in the file. Every
list-row's `paymentSummary` passed into `normalizeCashierOrder` is therefore always `undefined`
(`CashierQueueScreen.tsx:71-82`), so `deriveCashierPaymentState` always returns `state:"unknown"`
for list rows (`apps/web/src/lib/cashier/order-state.ts:107-116`). Consequently the **"Partially
paid" queue filter chip always returns zero rows** — `filterCashierQueueOrders(..., "partially-paid")`
tests `order.payment.state === "partially-paid"`, which can never be true for a list row
(`apps/web/src/lib/cashier/queue-filters.ts:63-65`). Only the single selected order gets a real
payment summary, via `selectedPaymentsQuery`. This is a genuine, currently-shipping product gap,
not a hypothetical — Find bill cannot simply "reuse" this filter; it needs a real design for
payment-state filtering (see Critical findings).

The "checkout preview" side panel (`CashierCheckoutPreview.tsx`) is, in effect, **already the
whole settlement workspace** wired to a list-selected order instead of a Floor-selected one: it
renders bill review (items/totals), payment summary, a receipt link, a refund entry point, and
embeds `CashierPaymentPanel` and `CashierResolutionPanel` directly
(`CashierCheckoutPreview.tsx:271-289`). This is the strongest evidence that C2/C3 is primarily a
**relocation of an entry point**, not a rewrite of settlement logic.

No sort control and no pagination control exist anywhere in Domain 1 (only `pageSize=100` fixed
fetch + client-side search/filter over that one page).

### Table

| Capability | Current implementation evidence | Backend contract relied on | Classification | Target location | Notes |
| --- | --- | --- | --- | --- | --- |
| Table-linked (dine-in) order listing | `listCashierOrders` w/ `excludeStatus` (`orders.ts:30-39`, `CashierQueueScreen.tsx:42-57`) | `GET /api/pos/orders` (`orders.controller.ts:51-60`, `pos:orders:read`) | A / B | Floor table selection (A) resolves the single order; branch-wide active-order fetch pattern reused by the Floor adapter | See Domain 4 |
| Tableless orders | Same list, `order.tableId` null → `tableName="Table unavailable"` (`order-state.ts:183-185`) | Same endpoint, no `tableId` filter | C | Find bill | No dedicated "tableless" server filter exists; must be derived client-side from `tableId == null` |
| Takeaway orders | `serviceType=TAKEAWAY` branch of same normalizer (`order-state.ts:184-185`) | `serviceType` query param (`list-orders-query.dto.ts:19-21`) | C | Find bill | Server-side `serviceType` filter already exists and works |
| Bill-requested orders | **Not implemented.** `CashierQueueScreen.tsx:188-190` shows a permanent `StatusMessage` admitting "Bill-requested is audit-derived... Queue shows active payable branch orders" instead | None — no bill-requested field/endpoint | F | Settlement workspace header (read) | Missing backend signal; Supervisor's "Request bill" (Prompt 3A, `pos:orders:write`) writes to audit/metadata only, no queryable "bill requested" flag on Order exists today |
| Partially-paid orders (list-level) | Filter chip exists but is **non-functional** — see dead-map finding above (`CashierQueueScreen.tsx:66-69`, `queue-filters.ts:63-65`) | Would need `GET /api/pos/orders/:id/payments` per row (N+1) | F (list-level) / B (selected-order level works) | Find bill / selected workspace | No bounded/bulk payment-summary endpoint exists; per-row payment fetch would violate the "no per-table/per-row payment fetch" performance rule |
| Pending/failed payments | Only visible via `hasPendingCashierPaymentIntent` on the **selected** order (`payment-validation.ts:85-90`), never list-wide | `order.payment.intents[].status` from `GET /pos/orders/:id/payments` | B (selected order) / F (list-wide) | Settlement workspace read + Find bill | Same N+1 constraint as above |
| Direct order lookup | **Not implemented in Queue.** Supervisor has an equivalent (`SupervisorFindOrderDialog.tsx`) | `GET /api/pos/orders/:id` (id-only) | C | Find bill | Reuse the Supervisor "Find order" pattern verbatim (see Domain 4) |
| Order selection mechanism | Client `useState<string|null>` + **auto-pick first visible order** (`CashierQueueScreen.tsx:37,89-99`) | n/a | E | Replaced by explicit table selection (A) / explicit Find-bill result selection (C) | Auto-pick-first must NOT be reused — it is exactly the anti-pattern CASH-FR-006 forbids for multiple payable orders |
| Status filters | `CASHIER_QUEUE_FILTERS` (`queue-filters.ts:23-49`): active-payable / ready-served / in-progress / partially-paid / closed-today, all client-side over the one fetched page | none (client-only) | C (closed/partially-paid/lookup use cases) / E (active-payable/ready-served/in-progress — folded into Floor card status) | Find bill filter set + shared Floor status | |
| Service-type filter | Not present in Queue UI (query type supports it, unused) | `serviceType` query param | C | Find bill | Plumbing exists (`CashierOrdersListQuery.serviceType`), unused today |
| Payment-state filter | Client `payment.state` only on selected order; **not usable as a list filter today** (see finding) | none server-side | F | Find bill | Needs either a new bounded server filter or an accepted N+1-free design; flag for C5 |
| Search | `searchCashierQueueOrders` — client substring match over `searchText` (order#, id, table, server, guest, status, payment label, service type) (`queue-filters.ts:74-78`, `order-state.ts:189-202`) | none (client-only, over the already-fetched 100-row page) | C | Find bill | Same client-search shape reusable for Find bill's bounded page |
| Pagination | **Not implemented.** Fixed `pageSize=100`, no `page` control in UI (`CashierQueueScreen.tsx:47-54`) despite `page`/`pageSize`/`total` being in the API contract (`CashierPaginatedOrdersResponse`, `order-types.ts:83-88`) | `GET /api/pos/orders?page=&pageSize=` | C | Find bill | Find bill must add real pagination UI; Supervisor's Find-order dialog already does this correctly at `FIND_PAGE_SIZE=25` |
| Sorting | **Not implemented** anywhere in Cashier | Backend always sorts `createdAt desc` (`orders.service.ts:261`) | E | n/a | No sort capability exists to migrate |
| Selected-order mechanism (detail+payments) | `detailQuery` + `selectedPaymentsQuery` (`CashierQueueScreen.tsx:103-117`) | `GET /api/pos/orders/:id`, `GET /api/pos/orders/:id/payments` | B | Settlement workspace | Directly reusable; this is the same pair the target workspace needs |
| Startup/performance pattern | 5 requests on cold mount incl. 2 that fire *only because of silent auto-select* (see above) | n/a | — | — | C2 must not reproduce the auto-select-driven double read; Floor table selection makes the "which order" decision explicit and user-driven instead |

---

## Domain 2 — Receipts capabilities

### What the code does today

`apps/web/src/pages/cashier/receipts.tsx` → `CashierReceiptsScreen.tsx`. Key fact, stated in the
page's own help text: **"Receipt ID equals order ID"** (`CashierReceiptsScreen.tsx:296-299`).
There is no `GET /api/receipts` list endpoint — confirmed by reading
`apps/api/src/modules/receipts/receipts.controller.ts` (only `:id`, `:id/history`,
`:id/reprint`, `:id/send` — all keyed by `orderId`/`receiptId` interchangeably). The "Receipts
list" the page shows is therefore **not a real receipts list** — it is
`GET /api/pos/orders?status=CLOSED&pageSize=20` (`CashierReceiptsScreen.tsx:77-87`) with each row
turned into a receipt-shaped view-model client-side via `normalizeReceiptCandidate`
(`receipt-state.ts:159-218`), only becoming a *real* receipt (with lines/payments/footer) once
selected and `GET /api/receipts/:id` resolves.

**Fake "today" filter:** the "today" filter chip (`filterCashierReceipts`, default active filter,
`receipt-state.ts:304-321`) filters **client-side** over the fixed 20-row `pageSize=20` candidate
page fetched with no date parameter at all. If more than 20 closed orders exist since the last
order created today, today's closed orders can silently fall outside the fetched page and never
appear — the filter looks correct but is bounded by an unrelated page-size cap, not a real
date-scoped query. This is the same category of gap as the Domain-1 dead payment filter.

Reprint and Send are explicitly **metadata-only / no live adapter** — `requestCashierReceiptReprint`
/ `requestCashierReceiptSend` (`receipts.ts:29-71`) call the real endpoints, but the UI copy is
honest that reprint records "Metadata only" and send is always "recorded as pending"
(`CashierReceiptsScreen.tsx:194-198,225-231`; confirmed server-side event kinds
`RECEIPT_REPRINTED`/`RECEIPT_SENT` with reason `NO_LIVE_DELIVERY_ADAPTER` handled explicitly in
`receipt-state.ts:237-264`).

### Table

| Capability | Current implementation evidence | Backend contract relied on | Classification | Target location | Notes |
| --- | --- | --- | --- | --- | --- |
| Receipt preview/detail | `CashierReceiptDetail` inside `CashierReceiptDrawer.tsx:104-124`, data from `getCashierReceipt` (`receipts.ts:15-20`) | `GET /api/receipts/:id` (`pos:receipt:read`, `receipts.controller.ts:40-56`) | B | Selected receipt panel in settlement workspace | Directly reusable |
| Print | No live print/driver call anywhere; "Print" in the drawer footer is actually the **Reprint metadata** action (`CashierReceiptDrawer.tsx:139-147`) | Same as reprint | B | Receipt panel | There is no separate "initial print" contract distinct from reprint; C4 should not invent one |
| Reprint | `requestCashierReceiptReprint` (`receipts.ts:29-49`), idempotency-keyed, copies 1–10 (`receipt-validation.ts:13-25`) | `POST /api/receipts/:id/reprint` (`pos:receipt:reprint`) | B | Receipt panel | Metadata-only by design (documented, not hidden) |
| Delivery / send | `requestCashierReceiptSend`, channels email/sms/whatsapp (`receipt-validation.ts:7-11,27-41`) | `POST /api/receipts/:id/send` (`pos:receipt:send`) | B | Receipt panel | Always `PENDING`, "no live adapter" — must stay honestly labeled per architecture doc §10.3 |
| Search | `searchCashierReceipts` client substring over candidate rows (`receipt-state.ts:324-328`) | none (client-only) | C | Find bill | Same bounded-page-then-filter shape as Queue |
| Date filtering | "today" filter — **broken/misleading**, see finding above | none server-side; no `dateFrom`/`dateTo` on `GET /api/pos/orders` | F | Find bill | `ListOrdersQueryDto` has no date range fields (`list-orders-query.dto.ts`) — Find bill's date-range filter (mentioned in `CASHIER_ARCHITECTURE.md` "Find bill architecture") is **not currently backed by any endpoint parameter** and needs either a scoped client design (fetch bounded + warn) or a backend addition (requires authorization per CLAUDE.md §14) |
| Order lookup (for receipt) | Implicit: receipt id === order id, so any order lookup is a receipt lookup | `GET /api/pos/orders/:id` | C | Find bill | |
| Receipt lookup (by receipt/order number) | Not implemented — no order-number search exists server-side (same gap as Domain 1/4) | none | F | Find bill | Exact-ID fallback pattern (Supervisor's `looksLikeOrderId` regex + direct `GET /pos/orders/:id`) is the only proven workaround |
| Refund entry point | "Refund" button in drawer footer, gated by `receipt.status==="CLOSED"` and `outstanding<=0` (`CashierReceiptDrawer.tsx:50-56,157-164`), opens `CashierRefundPanel` | `GET/POST /api/pos/orders/:id/refunds` (`pos:refund:create`/`pos:refund:read`, `refunds.controller.ts:29,81,88`) | B | Receipt panel / selected closed-order context | Reuse as-is |
| Receipt history | `CashierReceiptHistory`, `getCashierReceiptHistory` pageSize 50 fixed (`receipts.ts:22-27`) | `GET /api/receipts/:id/history` (`pos:receipt:read`) | B | Receipt panel | |
| Terminal (closed) order access | Candidate list is literally built from `status=CLOSED` orders only (`CashierReceiptsScreen.tsx:80-84`) | `GET /api/pos/orders?status=CLOSED` | C | Find bill ("closed order lookup") | |
| Standalone Receipts page/route | `pages/cashier/receipts.tsx` | n/a | E | Legacy redirect only (`/cashier/receipts` → Floor/receipt context, `CASHIER_ARCHITECTURE.md` "Legacy route policy") | Retire per CASH-FR-018 once Find bill + receipt panel cover all paths |

---

## Domain 3 — Payment/settlement capabilities

### What the code does today

`CashierPaymentPanel.tsx` is a single form covering both cash and non-cash methods, branching
entirely on `method.id === "CASH"`:

- **Cash is not a standalone "add payment" action.** It calls `closeCashierOrder` directly
  (`POST /api/pos/orders/:id/close`) with a single `payments:[{method:"CASH", amount, metadata}]`
  entry (`CashierPaymentPanel.tsx:104-132`). `validateCashierPaymentInput` enforces this: cash
  amount must equal the full outstanding balance (no partial cash — "Partial cash is deferred
  because cash can only be recorded through final order close",
  `payment-validation.ts:157-159`), and cash is only offered when `order.status === "SERVED"`
  (`payment-validation.ts:160-162`). **Cash payment *is* the close action.**
- Non-cash methods (`CARD_REFERENCE`, `MTN_REFERENCE`, `AIRTEL_REFERENCE`, `BANK_TRANSFER`) call
  `createCashierManualReferencePayment` (`POST /api/payments/manual-reference`), all
  `supportsPartial:true` (`payment-types.ts` config in `payment-validation.ts:6-54`). The response
  carries `autoSettled?: boolean` — the **backend**, not the frontend, decides whether the order
  closes after a manual-reference payment brings the balance to zero
  (`payment-types.ts:53-57`, consumed at `CashierPaymentPanel.tsx:150-156`).
- `CashierCloseOrderPanel.tsx` is **purely informational** — when `settled===true` and the order
  isn't `CLOSED` yet, it shows a `Badge variant="warning"` labeled "Refresh" that is **not a
  button** and has no `onClick` (`CashierCloseOrderPanel.tsx:28-46`). There is no explicit
  "click to close" action for the case where a manual-reference payment settles the balance but
  the backend does not auto-close. This is a real UX gap the settlement workspace inherits and
  should resolve (see Critical findings).
- `pos:payment:cancel` is a granted Cashier permission (seed.ts:1265) and a real endpoint
  (`POST /api/payments/intents/:intentId/cancel`, `payments.controller.ts:133-149`,
  `pos:payment:cancel`), but **no frontend function or UI button calls it anywhere in
  `apps/web/src/lib/cashier` or `apps/web/src/components/cashier`.** Pending/failed intents are
  shown read-only in `CashierPaymentHistory.tsx` (`IntentHistoryRow`, lines 48-63) and simply
  **block** new payment submission until resolved (`hasPendingCashierPaymentIntent`,
  `payment-validation.ts:85-90,150-152`) — there is no in-product way to actually cancel a stuck
  intent today.

**Idempotency pattern (quoted verbatim):**

```ts
// apps/web/src/lib/cashier/idempotency.ts
export function buildCashierIdempotencyKey({ operation, orderId, method }) {
  return ["cashier", operation, orderId, method, randomSuffix()]
    .filter(Boolean)
    .join(":");
}
```

Every mutating cashier request (`payments.ts`, `receipts.ts`, `refunds.ts`, `resolution.ts`,
`tills.ts`) sends this as an `Idempotency-Key` header
(`{operation}Headers → idempotencyHeaders`). **Important nuance:** `randomSuffix()` is generated
fresh on *every call*, including a manual retry the user triggers by clicking the button again
after a failure. This means the idempotency key is **not deterministic across retries of the same
logical submission** — duplicate-submit protection in the UI actually comes from
`isSubmitting`/`disabled={!canSubmit}` gating the button during the in-flight request, not from
the client reusing a stable key. The idempotency key mainly protects against double-firing the
*same* React event (e.g. double network resend), not against a user-initiated second click after
a visible failure. `mapCashierMutationError` does map `IDEMPOTENCY_IN_FLIGHT` and
`IDEMPOTENCY_KEY_PAYLOAD_MISMATCH` from the backend (`payment-validation.ts:104-120`), so the
backend-side idempotency guard is real; the frontend key-freshness behavior is the nuance worth
carrying into C3 documentation.

**Cache invalidation (grepped verbatim across `apps/web/src/components/cashier` and
`apps/web/src/lib/cashier`):**

```
CashierQueueScreen.tsx:159   invalidateQueries({ queryKey: ["cashier","order-payments",branchId] })
CashierQueueScreen.tsx:160   invalidateQueries({ queryKey: ["cashier","orders",branchId] })
CashierTillScreen.tsx:206-209 invalidateQueries × 4 (active-shift/active-till/till-detail/till-summary, all branchId-scoped)
CashierRefundPanel.tsx:161-167 invalidateQueries × 6 (order-refunds/order-detail/order-payments/receipt/receipt-history/receipt-candidate-orders/orders, all branchId+orderId-scoped)
CashierReceiptsScreen.tsx:168-171 invalidateQueries × 4 (receipt/receipt-history/receipt-candidate-orders/order-payments, all branchId(+id)-scoped)
```

**No broad `invalidateQueries()` call (no-argument or bare-prefix) exists anywhere in Cashier
code.** Every invalidation is scoped to `["cashier", <domain>, branchId, ...]`. `lib/cashier/*`
itself contains zero `invalidateQueries`/`setQueryData` calls — payment/split/resolution panels
(`CashierPaymentPanel`, `CashierSplitBillPanel`, `CashierAdvancedResolutionPanel`, etc.) never
invalidate directly; they call an `onRefresh: () => Promise<void>` prop that bubbles up to the
page-level `refreshCheckoutState`/`refreshReceiptState`/`refreshTillState` functions that do the
actual narrow invalidation. This is a clean, already-correct pattern for C3 to keep.

**Real gap found (relevant to CASH-FR-013):** none of these invalidation lists touch any Floor
query key, because Cashier has no Floor today. By contrast, every Supervisor Floor mutation
dialog explicitly invalidates **both** its own Floor key and Waiter's:

```
apps/web/src/components/supervisor/floor/SupervisorVoidOrderDialog.tsx:60-62
  invalidateQueries({ queryKey: ["supervisor","order-detail",branchId,order.id] })
  invalidateQueries({ queryKey: ["supervisor","floor",branchId] })
  invalidateQueries({ queryKey: ["waiter","floor",branchId] })
```

(Same two-role invalidation pair repeats in `SupervisorMoveItemsDialog.tsx:65`,
`SupervisorSplitItemsDialog.tsx:73`, `SupervisorTransferTableDialog.tsx:95`,
`SupervisorMergeOrderDialog.tsx:71`, `SupervisorComplimentaryDialog.tsx:62`,
`SupervisorDiscountRequestDialog.tsx:76`, `SupervisorApproveDiscountDialog.tsx:39`.) This is the
established, narrow, proven cross-role invalidation pattern in this codebase. Cashier's future
settlement workspace mutations (payment, close, split, merge, move, transfer-table) currently
invalidate **none** of `["waiter","floor",branchId]` / `["supervisor","floor",branchId]` /
a future `["cashier","floor",branchId]` — that wiring does not exist yet anywhere in
`lib/cashier` and must be added in C3, following the exact same narrow multi-key pattern already
proven by Supervisor.

### Split/resolution sub-domain (already functional, not a stub)

Confirmed via `packages/db/prisma/seed.ts:1310-1314` — the Cashier role is explicitly granted
`pos:order:split`, `pos:order:merge`, `pos:order:transfer`, `pos:order:move-items` (comment:
`"BG4.B: POS Order Handoff (Cashier: split + merge + transfer + move-items)"`, a milestone that
predates the Supervisor reconstruction). This is **real, working, permission-backed
functionality today** — not dead code:

- `splitCashierBill` → `POST /pos/orders/:id/split-bill` — **metadata-only allocation on the
  parent order** ("does not create separate child orders", `CashierSplitBillPanel.tsx:120-122`).
- `splitCashierItems` → `POST /pos/orders/:id/split-items` — **physically creates a child order**
  (`pos-handoff.service.ts:81-82,407-413`); the child order's `tableId` defaults to the source
  order's table unless a `targetTableId` is given (`pos-handoff.service.ts:410`).
- `mergeCashierOrders` → `POST /pos/orders/merge`.
- `moveCashierOrderItems` → `POST /pos/orders/:id/move-items`.
- `transferCashierOrderTable` → `POST /pos/orders/:id/transfer-table` — updates `Order.tableId`
  directly (`pos-handoff.service.ts:746-754`).
- `transferCashierOrderServer` → endpoint exists and is permission-reachable
  (same `pos:order:transfer` grant covers both transfer-table and transfer-server, per the
  module-level doc comment `pos-handoff.service.ts:84-85`), but the **UI is an intentional stub**:
  `CashierTransferServerPanel.tsx` renders a "Deferred" badge and explains "No safe staff-list
  endpoint is exposed for this surface, so the action is intentionally disabled" — mirrors the
  identical Supervisor deferral for the same reason (CLAUDE.md §11 "transfer-server is deferred").

### Table

| Capability | Current implementation evidence | Backend contract relied on | Classification | Target location | Notes |
| --- | --- | --- | --- | --- | --- |
| Payment entry (form/UI) | `CashierPaymentPanel.tsx` full form | n/a (UI only) | B | Settlement workspace | Reuse verbatim |
| Cash payment | `CashierPaymentPanel.tsx:104-132` → `closeCashierOrder` | `POST /pos/orders/:id/close` (`pos:orders:close`, `payments.controller.ts:43`) | B | Settlement workspace | Cash = close; full outstanding only, `SERVED` status only |
| Card/reference payment | `createCashierManualReferencePayment` | `POST /payments/manual-reference` (`pos:payment:manual-reference`) | B | Settlement workspace | Partial supported |
| MTN/Airtel manual reference | Same function, `provider` set | Same endpoint | B | Settlement workspace | Manual reference only — no live provider traffic (CLAUDE.md §18) |
| Bank transfer reference | Same function | Same endpoint | B | Settlement workspace | |
| MTN/Airtel payment intent | `createCashierPaymentIntent` (`payments.ts:35-53`) | `POST /payments/intents` (`pos:payment:intent`) | B | Settlement workspace | Present in lib but **no UI component calls it** in the current Cashier component tree — confirm intended use before C3 wires it |
| Partial payment | `supportsPartial:true` per non-cash method (`payment-validation.ts:6-54`); `validateCashierPaymentInput` caps at outstanding balance | Same manual-reference / intent endpoints | B | Settlement workspace | Cash explicitly excluded from partial |
| Duplicate-submit prevention | `isSubmitting` state + `disabled={!canSubmit}` (`CashierPaymentPanel.tsx:84,249`); idempotency key is regenerated per submit attempt (see nuance above) | Backend `IDEMPOTENCY_IN_FLIGHT`/`PAYLOAD_MISMATCH` codes | B | Settlement workspace | Document the non-deterministic-retry-key nuance in C3 |
| Failed/pending payment recovery | Read-only display only (`CashierPaymentHistory.tsx` intents); **cancel is unwired** | `POST /payments/intents/:id/cancel` exists (`pos:payment:cancel`, granted) but **no frontend caller** | F (recovery action) / B (read) | Settlement workspace | Missing piece = frontend wiring only, not a backend/permission gap — safe to close in C3 without new authorization |
| Outstanding-balance calc | `getCashierOutstandingAmount` (`payment-validation.ts:92-94`), `expectedRemaining` preview (`CashierPaymentPanel.tsx:82-83`) | `payment.outstanding` from `GET /pos/orders/:id/payments` | B | Settlement workspace | Frontend value is explicitly a preview; canonical value always re-read after mutation |
| Close-order gating | `CashierCloseOrderPanel.tsx` — **read-only**, no actionable "Close" button for the non-cash-auto-settled case (see finding) | `POST /pos/orders/:id/close`, gated on `pos:orders:close` | B | Settlement workspace | Real UX gap to resolve in C3, not just relocate |
| Till preflight tie-in | `readiness.till.status !== "active"` blocks cash method (`payment-validation.ts:145-147`) and disables the Cash radio (`CashierPaymentMethodSelector` `cashBlocked` prop, `CashierPaymentPanel.tsx:196`) | `GET /tills/active` | B (consumes) / D (owns) | Settlement workspace reads; Till tab owns | |
| Split-bill (metadata allocation) | `CashierSplitBillPanel.tsx`, `splitCashierBill` | `POST /pos/orders/:id/split-bill` (`pos:order:split`) | B | Settlement workspace | Fully functional today, permission-granted |
| Split-items (physical child order) | `CashierSplitItemsPanel.tsx`, `splitCashierItems` | `POST /pos/orders/:id/split-items` (`pos:order:split`) | B | Settlement workspace | Same |
| Merge orders | `CashierMergeOrdersPanel.tsx`, `mergeCashierOrders` | `POST /pos/orders/merge` (`pos:order:merge`) | B | Settlement workspace (Advanced resolution) | Same |
| Move items | `CashierMoveItemsPanel.tsx`, `moveCashierOrderItems` | `POST /pos/orders/:id/move-items` (`pos:order:move-items`) | B | Settlement workspace (Advanced resolution) | Same |
| Transfer table | `CashierTransferTablePanel.tsx`, `transferCashierOrderTable`, `listCashierTables` for target selector | `POST /pos/orders/:id/transfer-table`, `GET /tables` (`pos:order:transfer`) | B | Settlement workspace (Advanced resolution) | Same |
| Transfer server | `CashierTransferServerPanel.tsx` — **intentional UI stub**, "Deferred" badge | `POST /pos/orders/:id/transfer-server` reachable but no safe staff selector | E (stays out of scope) | n/a | Mirrors Supervisor's identical deferral; do not build without a safe staff-list endpoint |
| Idempotency mechanism | `buildCashierIdempotencyKey` (`idempotency.ts`) | `Idempotency-Key` header, backend-enforced | B | Settlement workspace | Reuse; document retry-key nuance |
| Cross-role cache sync after payment/close | **Does not exist today** — zero Floor-key invalidation anywhere in `lib/cashier`/`components/cashier` | Would reuse `["waiter","floor",branchId]` / `["supervisor","floor",branchId]` / future `["cashier","floor",branchId]` | B (new wiring required) | Settlement workspace mutation success handlers | Must be added in C3 following the proven Supervisor pattern (see quoted evidence above) — this is new work, not a relocation |

---

## Domain 4 — Table-to-order resolution

### Confirmed: no current Cashier code path resolves a physical table to an order

`apps/web/src/lib/cashier/resolution.ts` / `resolution-types.ts` / `resolution-validation.ts` are
entirely about **order handoff** (split/merge/move/transfer — Domain 3's advanced-resolution
sub-domain), not physical table→order lookup. There is no `floor.ts`, no `tables.ts` consumer in
`lib/cashier` beyond `listCashierTables` (used only to populate the transfer-table **target**
selector, not to resolve a *source* table's order). This is confirmed by the absence of any
`floor.tsx` page and by `cashierRoutes` still listing Queue/Receipts/Till/Me
(`apps/web/src/lib/cashier/routes.ts:4-29`).

### The backend contract already exists — no new endpoint required

`GET /api/pos/orders` already accepts `tableId` as a first-class filter:

```ts
// apps/api/src/modules/orders/dto/list-orders-query.dto.ts:23-25
@IsOptional() @IsString() tableId?: string;

// apps/api/src/modules/orders/orders.service.ts:231-237
const where: Prisma.OrderWhereInput = { branchId: ctx.branchId, orgId: ctx.organizationId };
...
if (query.tableId) where.tableId = query.tableId;
```

It is branch+org scoped via `BranchContextGuard`/`ctx`, gated on `pos:orders:read`
(`orders.controller.ts:51-60`), which Cashier already holds and already exercises (Domain 1's
Queue). The frontend type even already has the field —
`CashierOrdersListQuery.tableId` (`order-types.ts:77`) is wired through
`buildOrdersQueryString` (`orders.ts:9-28`) — it is simply **never passed** by any current screen.
**This means C2's "given a branchId + tableId, list payable orders" requirement is a filter on
the existing general list-orders endpoint that the Cashier frontend already has typed plumbing
for. No API/DTO change, and no new permission, is needed.** A scoped call such as
`listCashierOrders(token, branchId, { tableId, excludeStatus: ["NEW","CLOSED","VOIDED"] })`
followed by client-side filtering to `CASHIER_PAYABLE_STATUSES` (`order-state.ts:17`) is
sufficient, or the Floor adapter can reuse the branch-wide active-orders payload it already loads
(see below) and filter it by `tableId` client-side — either is a bounded, existing-contract
approach.

`tableId` remains the single source of truth even after handoff actions:
- **transfer-table** explicitly writes `Order.tableId` (`pos-handoff.service.ts:746-754`).
- **split-items** child orders inherit `source.tableId` unless a different `targetTableId` is
  given (`pos-handoff.service.ts:410`) — so a same-table split child still resolves correctly via
  `tableId` filtering, and would correctly surface as a **second** payable order at that table
  (exercising the "multiple payable orders" case).
- **merge** voids the source order (absorbed into target) — a merged-away order naturally drops
  out of any `excludeStatus`-filtered payable query.

### Waiter's existing table→order pattern — reusable in shape, NOT reusable as-is

`WaiterFloorScreen.tsx` + `lib/waiter/floor-api.ts` + `lib/waiter/floor-model.ts` load the whole
Floor in one `Promise.all` of 3 branch-wide bounded calls
(`loadWaiterFloorData`, `floor-api.ts:97-105`): `GET /api/tables`,
`GET /api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=100`,
`GET /api/reservations?pageSize=200`. Supervisor's `loadSupervisorFloorData`
(`lib/supervisor/floor.ts:110-124`) uses the **identical** convention
(`excludeStatus:["CLOSED","VOIDED"], pageSize:100`). This is the proven "shared Floor data
loading" contract Cashier's future Floor adapter should follow for consistency (CASH-FR-003/004).

**However**, Waiter's table→order derivation is unsafe to copy verbatim for Cashier:

```ts
// apps/web/src/lib/waiter/floor-model.ts:89-98
const orderByTable = new Map<string, WaiterOrderApi>();
for (const order of activeOrders) {
  if (!order.tableId || !ACTIVE_ORDER_STATUSES.has(...)) continue;
  if (!orderByTable.has(order.tableId)) {
    orderByTable.set(order.tableId, order);   // <-- keeps only the FIRST match per table
  }
}
```

This silently keeps only one order per table (the first encountered in `createdAt desc` order,
i.e. the most recent) and **has no concept of "multiple payable orders at one table."** It is the
exact anti-pattern CASH-FR-006 forbids ("never pick the first order silently"). Cashier's C2 table
selection handler must NOT reuse this reduction; it must count matches for the selected table and
render `CashierPayableOrderSelector` whenever more than one order in `CASHIER_PAYABLE_STATUSES`
shares that `tableId`.

### Reusable "Find bill" architectural template already exists

`apps/web/src/components/supervisor/floor/SupervisorFindOrderDialog.tsx` is a complete, working
template for Cashier's Find bill: one bounded page (`FIND_PAGE_SIZE=25`) via
`fetchSupervisorOrders`, status/service filters, client-side search over that page, and an
exact-order-ID fallback (`looksLikeOrderId` regex + direct `GET /pos/orders/:id`) for when the
bounded page doesn't contain the target — the file's own comment states plainly: **"The backend
has no order-number search, so exact-number matching is done locally"**
(`SupervisorFindOrderDialog.tsx:23-27`). This same limitation will apply to Cashier's Find bill.

### Scenario coverage (backend-verified)

| Scenario | Backend contract state | Notes |
| --- | --- | --- |
| Zero payable orders | `tableId`-filtered query returns rows outside `CASHIER_PAYABLE_STATUSES` only, or empty | Show honest no-bill state (CASH-FR-007) |
| One payable order | Single match | Open settlement workspace directly |
| Multiple payable orders | Real scenario — e.g. two independent dine-in orders opened at the same table across visits, or a same-table split-items child | Must show explicit selector; **Waiter's pattern must not be copied** |
| Split child orders | Child inherits or gets new `tableId` (`pos-handoff.service.ts:410`) | Resolves correctly via `tableId` filter |
| Merged orders | Source order status becomes `VOIDED` w/ `mergedIntoOrderId` (per permission description, `seed.ts:452`) | Naturally excluded by `excludeStatus` |
| Transferred orders | `Order.tableId` updated directly (`pos-handoff.service.ts:753`) | Resolves correctly at the **new** table, not the old one |
| Partially-paid order | Visible via `GET /pos/orders/:id/payments` after order is resolved | Requires the per-order payment fetch already used in Domain 1/3 |
| Pending/failed payment | Same, via `payment.intents` | Same |
| Closed order | `status=CLOSED`, excluded from payable filter | CASH-FR-007's "only terminal orders" case — recent-receipt access only via explicit action |
| Reservation without order | No Cashier reservation lib exists at all (`lib/cashier` has no `reservations.ts`) | Genuine unbuilt surface — target docs scope this to "order-linked read context only," so likely out of C2 scope, but flag: zero reservation-read plumbing currently exists in Cashier |
| Tableless order | `order.tableId === null` | Never reachable via Floor table selection; Find bill only |
| Takeaway order | `serviceType === "TAKEAWAY"`, `tableId` must be null (enforced server-side: `orders.service.ts:155-157` throws `BadRequestException` if both are set) | Find bill only |
| Cross-branch protection | `where.branchId = ctx.branchId` on every order query (`orders.service.ts:232`), enforced by `BranchContextGuard` + `RequireBranchContext()` decorator at the controller | Already enforced by existing infrastructure; no new work needed |

---

## Domain 5 — Till and readiness preflight

### What the code does today

`useCashierReadiness()` (`apps/web/src/lib/cashier/readiness.ts`) is the single source of truth,
already consumed by Queue, Till, and (transitively, via `CashierCheckoutPreview` →
`CashierPaymentPanel`) the embedded settlement UI. It runs two independent queries:

```ts
// readiness.ts:57-71
shiftQuery: GET /api/shifts/active   (staleTime 30_000)
tillQuery:  GET /api/tills/active    (staleTime 30_000)
```

**Fail-closed behavior is real, not aspirational — verified in code, not just documentation:**

- No active shift / no active till → `status:"inactive"`, tone `"warning"`, and every dependent
  action is blocked via an explicit `reasons[]` array, never an implicit default-allow
  (`readiness.ts:80-152`).
- Query error (network/5xx) → `status:"failed"`, tone `"danger"`, distinct from `"inactive"` —
  explicitly *not* treated as "no shift/no till exists", just "state unknown, blocked"
  (`readiness.ts:91-98,128-135`).
- Session/role/branch missing (before the queries can even run) → `status:"unavailable"`, tone
  `"neutral"` (`readiness.ts:81-89,118-126`) — but this state is unreachable in practice because
  `CashierSessionGuard.tsx` already blocks entry to any Cashier route with a `BlockedState` when
  `!isCashier` or `!branchId`, and redirects to `/login` when unauthenticated
  (`CashierSessionGuard.tsx:16-83`) — defense in depth, not a single point of failure.
- **Unknown payment state is never treated as unpaid**, quoted verbatim:

  ```ts
  // apps/web/src/lib/cashier/order-state.ts:103-116
  export function deriveCashierPaymentState(summary, failedReason) {
    if (!summary) {
      return { state: "unknown", label: "Unknown", tone: "neutral", ... };
    }
    ...
  }
  ```

  There is no code path where a missing/failed payment summary produces `state:"unpaid"`. This is
  the literal implementation of the target architecture's "unknown payment state is not unpaid"
  security rule (`CASHIER_ARCHITECTURE.md` §"Security and data integrity").

- **Till belongs to another user** — verified server-side, not just client-assumed:

  ```ts
  // apps/api/src/modules/tills/tills.service.ts:284-297
  async getActiveTill(userId: string, ctx: BranchContext) {
    const till = await this.prisma.tillSession.findFirst({
      where: { branchId: ctx.branchId, operatorUserId: userId, status: TillSessionStatus.OPEN },
      ...
    });
    return till;
  }
  ```

  `GET /api/tills/active` (`tills.controller.ts:104-109`, `pos:till:read`) is scoped to
  `operatorUserId: userId` — a till opened by a different cashier in the same branch is **not**
  returned to this cashier. The frontend correctly reports "No active till" in that case
  (fail-closed), never silently exposing or reusing another operator's till.
- **Cash payment requires Till** — enforced in `validateCashierPaymentInput`
  (`payment-validation.ts:145-147`): `if (method.id === "CASH" && readiness.till.status !== "active")`
  blocks submission; the Cash radio option itself is also visually disabled via `cashBlocked`
  (`CashierPaymentPanel.tsx:196`).
- **Non-cash policy**: no till requirement — manual-reference/card/MoMo/bank payments are allowed
  regardless of till state (only shift-active is required for any payment,
  `payment-validation.ts:144`).
- **Branch context absent**: `CashierSessionGuard.tsx:62-83` blocks the entire route tree with
  `BlockedState` before any shift/till/order query can even fire — the guard, not the readiness
  hook, is the first line of defense.
- **Payment state fails to load**: `paymentSummaryBlocked` is threaded explicitly into both
  `validateCashierPaymentInput` (`payment-validation.ts:148`) and
  `cashierResolutionOrderReasons` (`resolution-validation.ts:60-72`) — a failed payment-summary
  read blocks *both* new payment submission and all split/merge/move/transfer actions, not just
  the payment form.
- **Session expires**: every screen (`CashierQueueScreen`, `CashierReceiptsScreen`,
  `CashierTillScreen`) has an identical `useEffect` pattern —
  `if (error instanceof ApiError && error.isAuthError) clearSession();` — consistently applied
  across all readiness/detail/payment/history queries.

### Table

| Capability | Current implementation evidence | Backend contract relied on | Classification | Target location | Notes |
| --- | --- | --- | --- | --- | --- |
| No active shift/readiness | `readiness.shift.status==="inactive"` blocks all payment actions (`payment-validation.ts:144`) | `GET /api/shifts/active` | D (owns state) / B (consumes) | Till tab / settlement preflight | Fail-closed confirmed |
| No active Till session | `readiness.till.status==="inactive"` blocks cash only | `GET /api/tills/active` | D / B | Till tab / settlement preflight | Fail-closed confirmed |
| Till belongs to another user | Server-side `operatorUserId` scoping (`tills.service.ts:284-297`) | `GET /api/tills/active` | D | Till tab | Verified server-enforced, not client-assumed |
| Cash requires Till | `payment-validation.ts:145-147`, `CashierPaymentPanel.tsx:196` | Client-side rule; no server-side till-required check found in `payments.controller.ts`/`tills` beyond the client gate | B (consumes) | Settlement workspace | Note: this is a **UI-only** safety gate — same category as Supervisor's documented "payment safety gate" in CLAUDE.md §11; worth documenting explicitly the same way |
| Non-cash policy (no till needed) | Absence of till check for non-cash in `validateCashierPaymentInput` | n/a | B | Settlement workspace | |
| Branch context absent | `CashierSessionGuard.tsx:62-83` | `/api/auth/me` (upstream) | A (shell-level guard) | Shared shell / session guard | Blocks before any Cashier-specific query fires |
| Payment state fails to load | `paymentSummaryBlocked` threaded into payment + resolution validation (`payment-validation.ts:148`, `resolution-validation.ts:60-72`) | `GET /pos/orders/:id/payments` | B | Settlement workspace | Blocks both payment entry and split/merge/move/transfer, confirmed fail-closed |
| Session expires | Consistent `isAuthError → clearSession()` pattern, all screens | JWT auth guard | A (shared session lifecycle) | Shared shell | |
| Unknown payment state ≠ unpaid | `deriveCashierPaymentState` — `state:"unknown"` on missing summary, never `"unpaid"` | n/a (client derivation contract) | B | Settlement workspace | Directly satisfies the target architecture's security rule; quoted above |
| Open Till / session | `CashierOpenTillPanel.tsx`, `openCashierTill` | `POST /tills/open` (`pos:till:open`) | D | Till tab | |
| Cash movements (safe drop) | `CashierSafeDropPanel.tsx`, `recordCashierSafeDrop` | `POST /tills/:id/safe-drop` (`pos:till:safe-drop`) | D | Till tab | |
| Reconcile/close Till | `CashierReconcilePanel.tsx`, `reconcileCashierTill` | `POST /tills/:id/reconcile` (`pos:till:reconcile`) | D | Till tab | |
| Till history | `CashierDeferredCashMovements.tsx` (explicitly deferred UI — name says so) | n/a confirmed further | D | Till tab | Component name signals this is already a known-deferred sub-feature; verify scope before C6 if raised |
| Till summary/expected cash | `getCashierTillSummary`, `normalizeCashierTill` metrics (`till-state.ts:80-135`) | `GET /tills/:id/summary` (`pos:till:read`) | D | Till tab | |

---

## Critical findings

### (a) Table-to-order resolution — full existing contract, zero backend gap

`GET /api/pos/orders?tableId=<id>` already exists, is branch/org-scoped via the standard
`BranchContextGuard`, and is gated on `pos:orders:read` — a permission Cashier already holds and
already uses today. The frontend type contract (`CashierOrdersListQuery.tableId`) is already
wired through `buildOrdersQueryString`; it is simply unused by any current screen. **C2 requires
no new endpoint, no new DTO field, and no new permission** — it requires (1) a Floor page that
doesn't exist yet, and (2) a table-selection handler that queries this existing filter (or derives
from the already-loaded branch-wide active-orders payload) and, critically, **counts matches
instead of taking the first one** — unlike Waiter's existing `orderByTable` reduction, which must
not be copied verbatim into Cashier because it silently drops all but the most-recent order per
table.

### (b) Genuinely blocked / missing-contract capabilities (classification F)

1. **Bill-requested signal** — no queryable field or endpoint exists anywhere in the backend for
   "this order has an outstanding bill-request." The current Queue page admits this openly
   (`CashierQueueScreen.tsx:188-190`). Any settlement-workspace header badge for "bill requested"
   remains unbuildable without a backend addition (would require explicit authorization per
   CLAUDE.md §14/§12).
2. **List-level / Find-bill payment-state filtering** (partially-paid, pending, failed) — no
   bounded/bulk payment-summary endpoint exists; the only way to know an order's payment state is
   the per-order `GET /pos/orders/:id/payments` call, which cannot be fanned out across a result
   page without violating the "no per-row payment fetch" performance rule in
   `CASHIER_ARCHITECTURE.md`. The current "Partially paid" Queue filter is not a working precedent
   to reuse — it is dead code today (see Domain 1). This needs either a new bounded backend
   contract (author-authorized) or an accepted design tradeoff for C5.
3. **Receipt/order-number search and date-range filtering** — `ListOrdersQueryDto` has no
   `orderNumber`, `receiptNumber`, `dateFrom`, or `dateTo` fields. Both Supervisor's Find-order
   dialog and Cashier's current Receipts "today" filter work around this with client-side
   filtering over one bounded page plus an exact-ID fallback; Find bill's documented "order
   number," "receipt number," and "date range" lookup fields (`CASHIER_ARCHITECTURE.md` "Find bill
   architecture") are **not fully backed by the current API** and will inherit the same
   workaround, or need backend authorization to add real filters.
4. **Payment-intent cancel is unwired, not backend-blocked** — `POST
   /payments/intents/:id/cancel` exists and `pos:payment:cancel` is already granted to Cashier,
   but no frontend function or button calls it. This is closeable in C3 without new authorization
   — flagged separately from the true F items above because the fix is frontend-only.

### (c) Broad-invalidation / N+1 patterns found

**No broad invalidation exists** — every `invalidateQueries()` call across Cashier code (Queue,
Till, Refund panel, Receipts screen) is scoped to `["cashier", <domain>, branchId, ...]`, matching
the architecture's "no broad invalidation storm" rule. Payment/split/resolution leaf components
never call `invalidateQueries` themselves; they funnel through an `onRefresh` prop to page-level
narrow-refresh functions — a pattern worth preserving structurally in the new settlement
workspace.

The one real gap is the **absence** of cross-role Floor invalidation: Cashier currently
invalidates none of `["waiter","floor",branchId]` / `["supervisor","floor",branchId]` /
a future `["cashier","floor",branchId]` after any mutation, because it has no Floor to sync with
yet. This is not a violation of the performance rules today (there's nothing to invalidate), but
it is a real gap C3 must fill using the exact proven pattern already shipping in every Supervisor
Floor mutation dialog (`SupervisorVoidOrderDialog.tsx:60-62` and seven sibling dialogs), which
invalidate their own Floor key **and** Waiter's Floor key together, narrowly, on every mutation
success.

No N+1 per-table or per-row payment-fetch pattern exists in the *shipped* code (the dead
`paymentState` map in Queue never actually fires per-row fetches — it just silently never
populates). The risk flagged above under (b)(2) is about a *future* temptation to fan out payment
reads across a Find-bill result page to make payment-state filtering "work" — that would violate
the performance rule and must be avoided; the correct fix is a backend contract change or an
accepted scope reduction, not a client-side fan-out.

### Additional observations worth carrying into later prompts (not required by C0's five domains, flagged for completeness)

- Cashier is already granted `pos:discount:request` and `pos:discount:read` (`seed.ts:1257-1258`),
  matching the target role-behaviour matrix row "Discount request/decision → Read canonical
  result." No discount UI exists anywhere in `components/cashier` today — this permission is
  currently unused by the frontend. Flag for whoever scopes the settlement workspace's bill-review
  section (which is documented to include "discounts" as a line item) to confirm whether a
  read-only discount display belongs in C3.
- `CashierCloseOrderPanel.tsx`'s "Refresh" control is a static `Badge`, not an actionable button —
  there is no click handler to manually trigger a refetch when a non-cash payment settles the
  balance but the backend doesn't auto-close. C3 should treat this as a real UX defect to fix
  while relocating, not merely preserve as-is.
