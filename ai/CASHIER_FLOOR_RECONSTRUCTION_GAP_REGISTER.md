# Cashier Floor Reconstruction Gap Register

**Update (2026-07-31): Prompt C2 COMPLETE.** All C1-phase rows remain RESOLVED, and the C2-phase
rows are now RESOLVED — table→bill resolution (CASH-FR-005), the bounded multiple-bill selector with
no silent first-pick (CASH-FR-006), the honest no-bill state (CASH-FR-007), and the canonical
`tableId`/`orderId` URL model (CASH-FR-NAV-02). The read-only settlement workspace, fail-closed
payment-state classification, Find bill foundation, and query-key model are in place. C3+ rows
(payment/close/receipt/refund **execution**, Queue/Receipts retirement, CASH-FR-032 transfer-panel
retirement decision) remain Open/Verify. **Prompt C1 (superseded):** default route, visible
navigation, shared `OperationalFloor` consumption, thin-shell verification, table-selection URL
foundation, icon-registry usage, and the test-harness bootstrap were resolved in C1.
Note on `CashierTransferTablePanel`: confirmed still referenced by the current Queue-era
`CashierAdvancedResolutionPanel` (a scope violation for the new architecture but a live dependency),
so it was **not** deleted in C1 and is **not** imported by any C1 Floor file; scheduled retirement
alongside the Queue/checkout migration in **C5**.

**Status:** **Prompt C0 verification complete (2026-07-31).** Every row below was checked against
the actual local dirty worktree (frontend `apps/web/src/{lib,components}/cashier/**`, backend
`apps/api/src/modules/{floor,orders,payments,pos-handoff,receipts,tills,refunds}/**`, RBAC seed
`packages/db/prisma/seed.ts`) by five parallel audits. Full evidence lives in the companion C0
reports (`ai/CASHIER_FLOOR_RECONSTRUCTION_{ROUTE_AND_NAV_AUDIT,COMPONENT_AUDIT,
CAPABILITY_MIGRATION_MATRIX,PERMISSION_AND_API_MATRIX,TEST_INVENTORY}.md`) — this register carries
only the verified status + a short evidence pointer per row. **Section A** is the original
architecture-register rows (CASH-FR-001..031) with verified status. **Section B** is new rows the
C0 audits discovered that were not anticipated by the initial register.

| ID | Area | Current/expected evidence | Target | Severity | Phase | Backend/permission dependency | QA requirement | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CASH-FR-001 | Default route | Cashier historically lands on Queue | `/cashier/floor` | High | C1 | None expected | auth redirect + Back/Forward/refresh | Resolved (C1) |
| CASH-FR-002 | Visible navigation | Queue/Receipts/Till/Me | Floor/Till/Me only | High | C1 | None | all viewports + role boundary | Resolved (C1) |
| CASH-FR-003 | Shared Floor | Cashier not yet verified as `OperationalFloor` consumer | Third shared consumer | High | C1 | Floor-read permission audit | three-role visual/structural parity | Resolved (C1) |
| CASH-FR-004 | Cashier shell | Existing Cashier adapter may duplicate shared primitives | Thin adapter over shared shell | Medium | C1 | None | shell assertions + request counts | Resolved (C1) |
| CASH-FR-005 | Table selection | No canonical table-to-settlement path confirmed | selected table opens settlement workspace | Critical | C2 | order/payment read contracts | zero/one/multiple order matrix | Resolved (C2) — `CashierBillResolutionPanel` opens the read-only `CashierSettlementWorkspace` |
| CASH-FR-006 | Multiple payable orders | Risk of silently choosing one order | bounded explicit order selector | Critical | C2 | bounded table-order query | live and browser cases | Resolved (C2) — `CashierBillSelector`, no silent first-pick (asserted) |
| CASH-FR-007 | No payable order | Table selection may assume a bill | honest no-bill state | Medium | C2 | None | empty-table test | Resolved (C2) — "No bill is available for this table." |
| CASH-FR-008 | Settlement workspace | Existing payment UI tied to Queue | canonical table/order workspace | Critical | C2–C3 | existing payment/order contracts | live payment matrix | Open |
| CASH-FR-009 | Till/readiness preflight | Existing behaviour must be mapped into new workspace | fail-closed preflight | Critical | C2–C3 | Till/shift/readiness contracts | missing/foreign/no-Till cases | Verify |
| CASH-FR-010 | Split settlement | Existing split UI may be page-specific | reused inside workspace | High | C3 | existing split contracts | split/partial/idempotency | Open |
| CASH-FR-011 | Partial payment | Existing Queue flow must remain canonical | workspace partial settlement | Critical | C3 | payment contract | balance and retry matrix | Open |
| CASH-FR-012 | Close order | Existing close path tied to Queue/payment page | close from workspace | Critical | C3 | close permission/eligibility | paid/unpaid/pending/duplicate | Open |
| CASH-FR-013 | Cross-role Floor sync | Payment/close must update all role Floors | narrow canonical updates | High | C3 | shared Floor query keys | Waiter/Supervisor regression | Open |
| CASH-FR-014 | Receipt initial print | Existing Receipts surface may own action | selected receipt panel | High | C4 | receipt/print contract | close→receipt→print | Open |
| CASH-FR-015 | Receipt reprint | Existing standalone Receipts lookup | selected closed order/Find bill | High | C4 | receipt lookup/reprint | known order + reference cases | Open |
| CASH-FR-016 | Receipt delivery | Existing channels must be verified | only supported actions in panel | Medium | C4 | endpoint/permission audit | supported/unsupported channel | Verify |
| CASH-FR-017 | Refund entry | Existing refund route may be standalone | selected receipt/order context | High | C4 | refund permissions/contracts | eligibility/duplicate/state | Open |
| CASH-FR-018 | Receipts route retirement | Standalone page currently exists | redirect then remove | High | C4 | None | reference search + legacy redirects | Open |
| CASH-FR-019 | Tableless orders | Queue currently likely supplies access | Floor Find bill | Critical | C2/C5 | bounded order lookup | tableless/takeaway cases | Open |
| CASH-FR-020 | Takeaway orders | No physical table | Floor Find bill | Critical | C2/C5 | service-type filtering | live/browser | Open |
| CASH-FR-021 | Partially paid/failed/pending lookup | Queue likely exposes these states | Find bill + selected workspace | High | C5 | payment-state filters | all payment-state cases | Open |
| CASH-FR-022 | Queue route retirement | Standalone Queue remains | redirect then remove | High | C5 | None | reference search + redirects | Open |
| CASH-FR-023 | Find bill performance | Risk of recreating unbounded Queue | bounded/paginated lookup | High | C2/C5 | server filter audit | request counts/max page | Open |
| CASH-FR-024 | Table-card bill signal | Cashier may need bill requested/outstanding signal | shared-safe optional indicator only | Medium | C1/C2 | efficient summary availability | no N+1/per-table payment calls | Verify |
| CASH-FR-025 | Guest/payment privacy | New Floor/lookup could expose excess data | minimum operational data | Critical | all | branch scope | privacy/browser/log review | Open |
| CASH-FR-026 | Legacy deep links | Queue/Receipts links may exist in docs/code | context-preserving redirects | Medium | C1/C4/C5 | None | no loops/no mutations | Open |
| CASH-FR-027 | Performance baseline | Prior Cashier startup hardening must survive | no duplicate startup/query storm | High | all | None | cold/warm request counts | Open |
| CASH-FR-028 | Test harness | Existing Cashier E2E may target old nav/pages | new shared Floor/settlement suite | High | C1–C6 | isolated QA tooling | actual four-viewport execution | Resolved (C1) |
| CASH-FR-029 | Documentation conflicts | Root/legacy docs still describe Queue/Receipts nav | canonical Floor-first docs reconciled locally | Medium | C0 and each phase | None | document audit | Open |
| CASH-FR-030 | Demo data | Existing walkthrough built around Queue/Receipts | Floor/settlement/Find bill data | Medium | C6 | disposable/safe fixtures | full demo rehearsal | Open |
| CASH-FR-031 | Manager dependency | Manager track ready to begin after Supervisor | must wait for Cashier C6 | High | governance | None | final closure classification | Locked |

## Section A — verified status against the C0 audits (2026-07-31)

| ID | Verified status | Evidence pointer |
| --- | --- | --- |
| CASH-FR-001 | **Confirmed Open.** `getCashierLandingPath()` returns `/cashier/queue` (`lib/auth/role.ts:54-56`), 2 call sites in `login.tsx`. | ROUTE_AND_NAV_AUDIT §1.4 |
| CASH-FR-002 | **Confirmed Open.** `cashierRoutes` = Queue/Receipts/Till/Me (`lib/cashier/routes.ts:4-29`). `CashierBottomNav` itself needs no change — pure reuse of `OperationalBottomNav`. | ROUTE_AND_NAV_AUDIT §1.1, §2.2 |
| CASH-FR-003 | **Confirmed Open, zero partial progress.** Grep-confirmed: no file under `components/cashier/**` imports `OperationalFloor`. Only `SupervisorFloorScreen.tsx`/`WaiterFloorScreen.tsx` do. | COMPONENT_AUDIT Part 1.6 |
| CASH-FR-004 | **Downgraded — verified low risk.** `CashierShell`/`CashierBottomNav`/`CashierHeader` are already thin adapters, structurally byte-for-byte identical to `SupervisorShell.tsx`. No rework needed for C1. | ROUTE_AND_NAV_AUDIT §2.1-2.3, §2.6 |
| CASH-FR-005 | **Confirmed Critical, but backend contract already exists.** No current Cashier code path resolves table→order (no Floor page). `GET /api/pos/orders?tableId=` already exists, branch-scoped, gated on `pos:orders:read` (already held); frontend type `CashierOrdersListQuery.tableId` already wired but never passed. **No API/DTO/permission change needed.** | CAPABILITY_MIGRATION_MATRIX Domain 4, Critical finding (a) |
| CASH-FR-006 | **Confirmed Critical — active anti-pattern exists to avoid.** Queue's current selection is a silent `visibleOrders[0]` auto-pick (`CashierQueueScreen.tsx:89-93`) — must NOT be reused. Waiter's `orderByTable` reduction (`floor-model.ts:89-98`) also silently keeps only the first order per table — must NOT be copied verbatim for Cashier's multi-order case. | CAPABILITY_MIGRATION_MATRIX Domain 1 + Domain 4 |
| CASH-FR-007 | Open, no code exists yet; scenario contract confirmed (empty-table state is a client responsibility, not a backend gap). | CAPABILITY_MIGRATION_MATRIX Domain 4 scenario table |
| CASH-FR-008 | **Verified: `CashierCheckoutPreview.tsx` is already, in effect, the whole settlement workspace** (bill review + payment summary + receipt link + refund entry + embeds `CashierPaymentPanel`/`CashierResolutionPanel`) wired to a list-selected order. C2/C3 is primarily a **relocation of entry point**, not a rewrite. | CAPABILITY_MIGRATION_MATRIX Domain 1 |
| CASH-FR-009 | **Verified — fail-closed behavior is real, confirmed in code** (not aspirational): unknown payment state never returns `"unpaid"`; Till scoped server-side to `operatorUserId`; missing branch blocks entire route tree before any query fires. | CAPABILITY_MIGRATION_MATRIX Domain 5 (full quoted evidence) |
| CASH-FR-010 | **Confirmed functional today, not a stub.** Cashier already holds `pos:order:split` (seed.ts BG4.B block); `CashierSplitBillPanel`/`splitCashierBill` fully working, metadata-only allocation. | CAPABILITY_MIGRATION_MATRIX Domain 3 |
| CASH-FR-011 | **Verified: cash payment IS the close action** (no partial cash by design — `payment-validation.ts:157-159`); non-cash methods support partial, backend alone decides auto-settlement via `autoSettled`. | CAPABILITY_MIGRATION_MATRIX Domain 3 |
| CASH-FR-012 | **Verified functional** (`closeCashierOrder` → `POST /pos/orders/:id/close`), but a **real UX gap found**: `CashierCloseOrderPanel`'s "Refresh" control is a static `Badge`, not an actionable button, when a non-cash payment settles the balance but the backend doesn't auto-close (see new row CASH-FR-041). | CAPABILITY_MIGRATION_MATRIX Domain 3 |
| CASH-FR-013 | **Confirmed Open — real gap, not yet started.** Zero Floor-key invalidation exists anywhere in `lib/cashier`/`components/cashier` today (Cashier has no Floor to sync with yet). Supervisor's proven 2-key pattern (`["supervisor","floor",branchId]` + `["waiter","floor",branchId]` on every mutation) is the template to copy for C3, adding a third `["cashier","floor",branchId]` key. | CAPABILITY_MIGRATION_MATRIX Domain 3 (quoted Supervisor evidence) |
| CASH-FR-014 | Verified: no separate "initial print" contract distinct from reprint exists — "Print" in `CashierReceiptDrawer` footer already just calls the reprint action. C4 should not invent a separate initial-print contract. | CAPABILITY_MIGRATION_MATRIX Domain 2 |
| CASH-FR-015 | Verified reusable as-is: `CashierReceiptDrawer.tsx` is already, in effect, the target `CashierReceiptPanel`. | COMPONENT_AUDIT §2.6 |
| CASH-FR-016 | Verified: reprint/send are honestly labeled metadata-only/no-live-adapter today; no channel invention needed, carry the honesty forward. | CAPABILITY_MIGRATION_MATRIX Domain 2; PERMISSION_AND_API_MATRIX §2.6 |
| CASH-FR-017 | Verified reusable as-is: `CashierRefundPanel.tsx` already architecturally correct, already dual-reachable from Queue and Receipts — just re-point callers. | COMPONENT_AUDIT §2.8 |
| CASH-FR-018 | Confirmed — standalone Receipts page/route classified **Obsolete after migration**; legacy-redirect pattern to reuse verbatim exists at `pages/supervisor/orders.tsx`. | COMPONENT_AUDIT §2.6; ROUTE_AND_NAV_AUDIT §3 |
| CASH-FR-019 | **Confirmed — no explicit tableless boolean filter exists** server-side; must derive from `tableId == null` client-side. | PERMISSION_AND_API_MATRIX §4.4 |
| CASH-FR-020 | **Confirmed — `serviceType=TAKEAWAY` filter already exists and works** server-side (`list-orders-query.dto.ts:19-21`); the plumbing is real, just currently unused by any Cashier screen. | CAPABILITY_MIGRATION_MATRIX Domain 1 |
| CASH-FR-021 | **Confirmed Critical, genuinely blocked (classification F).** No `paymentStatus`/`isPaid`/`hasBalance` filter exists on `GET /api/pos/orders`. Today's "Partially paid" Queue chip is provably **dead code** (a `useMemo` that never populates — always returns zero rows), not a working precedent to reuse. | CAPABILITY_MIGRATION_MATRIX Domain 1 + Critical finding (b)(2); PERMISSION_AND_API_MATRIX §4.3 |
| CASH-FR-022 | Confirmed — standalone Queue page/route classified **Obsolete after migration**; same reusable redirect pattern applies. | COMPONENT_AUDIT §2.3; ROUTE_AND_NAV_AUDIT §3 |
| CASH-FR-023 | **Confirmed — no backend-enforced bound today.** `ListOrdersQueryDto.pageSize` has `@Min(1)` but no `@Max()` (unlike `ReceiptHistoryQueryDto`'s `@Max(200)`). Boundedness is a frontend discipline only. Supervisor's `SupervisorFindOrderDialog` (`FIND_PAGE_SIZE=25`) is the reusable template. | PERMISSION_AND_API_MATRIX §4.6, §2.9 |
| CASH-FR-024 | **Feasibility confirmed, not yet backed by a documented contract.** Both Waiter's `billState` and Cashier's own `billRequestedLabel` already derive a bill-state string client-side from `order.metadata`, off data the Floor query already fetches (no N+1). But this is a client-side convention today, not a documented/trustworthy backend field — Cashier's own Queue page carries a live caveat admitting it's "audit-derived." Surfacing on the shared card = a shared-component change requiring full 3-role regression. | COMPONENT_AUDIT §1.2 |
| CASH-FR-025 | Verified no violation exists today: no guest names on any table card; Queue's guest-name display is Queue-list-specific and explicitly must NOT be ported to any Floor-adjacent surface. | COMPONENT_AUDIT §1.2, §2.3 |
| CASH-FR-026 | **Resolved — reusable reference implementation confirmed to exist**, but the CLAUDE.md claim of an equivalent `/waiter/orders` redirect is **stale** (no such file exists in the worktree). Only `pages/supervisor/orders.tsx` + `SupervisorLegacyOrdersRedirect.tsx` + `lib/supervisor/legacy-orders-route.ts` is real and verified — model Cashier's redirects on this. | ROUTE_AND_NAV_AUDIT §3 (full quoted implementation) |
| CASH-FR-027 | Verified consistent with (not contradicting) CLAUDE.md's "~9 requests" figure: ≈6 Cashier-specific requests on cold Queue mount (2 readiness + 1 list + 2 detail/payments) + `/auth/me` + shell bootstrap. Not independently measured live (read-only audit). | TEST_INVENTORY Part 3.1 |
| CASH-FR-028 | **Confirmed — zero Cashier Playwright specs exist.** Only incidental Cashier presence-checks inside 3 Supervisor suites, all asserting the **current Queue-first nav** — these will need updating (not just extending) once C1 ships. Login plumbing (`uiLogin(page,"cashier")`, `PW_CASHIER_EMAIL/PASSWORD`) already exists and is reusable. Viewport matrix in `playwright.config.ts` already matches the target exactly — no config change needed. | TEST_INVENTORY Part 1.2, 1.7 |
| CASH-FR-029 | This gap register + the local doc reconciliation performed in C0 (CLAUDE.md, PROGRESS.md, docs/DOCUMENT_INDEX.md, docs/UI_SYSTEM.md, docs/ROLE_JOURNEYS.md, docs/ROLE_CAPABILITY_MATRIX.md, docs/DECISIONS.md, docs/TESTING_AND_QA.md, docs/KNOWN_LIMITATIONS.md, docs/REPOSITORY_MAP.md, ai/AI_STATUS.md) close this row for C0's scope. | C0_REPO_VERIFICATION_REPORT §"Local documentation updates" |
| CASH-FR-030 | Not yet addressed — correctly scoped to C6, no C0 action needed. | — |
| CASH-FR-031 | **Locked, unchanged.** Manager reconstruction remains blocked until Cashier C6 closes; re-confirmed in this C0 pass. | CLAUDE.md §10 |

## Section B — new findings from the Prompt C0 audits (not in the original register)

| ID | Area | Evidence | Severity | Phase |
| --- | --- | --- | --- | --- |
| CASH-FR-NAV-01 | Bare `/cashier` route | No `pages/cashier/index.tsx` or `pages/cashier.tsx` exists → 404s today (unlike `pages/waiter/index.tsx`, which server-side-redirects to `/waiter/floor`). | High | C1 |
| CASH-FR-NAV-02 | Selected-order URL param inconsistency | Queue uses plain `useState` (no URL persistence — loses selection on refresh); Receipts uses `router.query.receiptId` + `router.replace({shallow:true})` (survives refresh). The new settlement workspace must standardize on the Receipts pattern for `tableId`/`orderId`/`receiptId`. | Critical | C2 | Resolved (C2) — `buildCashierBillQuery`/`clearCashierBillQuery` + `router.replace/push {shallow:true}`; refresh/Back/Forward asserted |
| CASH-FR-NAV-03 | Idle-handler indirection | `CashierIdleLogoutHandler`→`WaiterIdleLogoutHandler`→`OperationalIdleLogoutHandler` (2 pass-through layers); Supervisor imports the shared primitive directly with no wrapper. Functionally identical today — cosmetic cleanup only, not a blocker. | Low | Optional, C1 |
| CASH-FR-NAV-04 | Icon-registry violations | 56 files under `components/cashier/**` import `@phosphor-icons/react` directly (incl. shell files `CashierSessionGuard.tsx`, `CashierReadinessStrip.tsx`), violating CLAUDE.md §13. Pre-existing, pervasive, out of scope to bulk-fix in a nav-only C1. New C1 files (Floor screen, Find bill control) must use the registry correctly from creation; registry needs new `cashierFloor`/`cashierFindBill` keys. | Medium | C1 (new files only) |
| CASH-FR-032 | **Cashier-side transfer-table/transfer-server scope violation (pre-existing, predates this reconstruction)** | `CashierTransferTablePanel.tsx` is **live and reachable today** (Queue → select order → Advanced resolution) and performs a real `POST /pos/orders/:id/transfer-table` mutation — a capability `CASHIER_ROLE_BEHAVIOUR_MATRIX.md` explicitly reserves for Supervisor ("Move/merge/transfer: No" for Cashier). `CashierMergeOrdersPanel`/`CashierMoveItemsPanel` are the same violation for merge/move. `CashierTransferServerPanel.tsx` is a static inert "Deferred" notice with no basis in any canonical Cashier doc; its backing `transferCashierOrderServer()` (`lib/cashier/resolution.ts:133-153`) is dead code (defined, never called). All four classified **Obsolete after migration** by the component audit — **do not carry forward without an explicit authorization decision**, per CLAUDE.md's "do not implement out-of-scope order-resolution actions" rule. | Critical | Decision needed before C3 |
| CASH-FR-033 | `CashierSplitItemsPanel` scope ambiguity | Creates a real **child order** (`POST /pos/orders/:id/split-items`) — `CASHIER_ARCHITECTURE.md` says "reuse existing verified... split-bill resolution"; `CASHIER_ROLE_BEHAVIOUR_MATRIX.md` says Cashier may only "resolve existing payable allocations; do not duplicate Supervisor split logic." Genuinely ambiguous — not resolved by this audit, flagged for an explicit decision. | High | Decision needed before C3 |
| CASH-FR-034 | Duplicate selected-order fetch (pre-existing perf violation) | `CashierRefundPanel.tsx:67-81` fetches order-detail/order-payments under keys tagged `"refund"`, different from `CashierQueueScreen.tsx`'s keys for the same order — causes two independent fetches of the same data. Violates `CASHIER_ARCHITECTURE.md`'s explicit "no duplicate selected-order detail" rule. Pre-existing, not introduced by C0. | Medium | C4 (unify keys when relocating) |
| CASH-FR-035 | Dead/misleading list-level filters (pre-existing) | Queue's "Partially paid" chip always returns zero rows (dead `useMemo` map, never populated). Receipts' "today" filter is client-side over a fixed 20-row page with no date parameter — can silently miss real results once >20 closed orders exist. Neither is a working precedent Find bill can reuse. | Medium | C5 design input |
| CASH-FR-036 | Missing backend Jest coverage | Zero `.spec.ts` files exist in `apps/api/src/modules/receipts/` and `apps/api/src/modules/pos-handoff/` (the split/merge/move/transfer-table backend). Both are load-bearing for the settlement workspace and receipt panel. | High | Land before/alongside C4 |
| CASH-FR-037 | Payment-intent cancel unwired (frontend-only fix, not backend-blocked) | `POST /payments/intents/:id/cancel` exists and `pos:payment:cancel` is already granted to Cashier, but no frontend function or button calls it. Pending/failed intents are read-only today and simply block new submissions. Closeable in C3 without new authorization. | Medium | C3 |
| CASH-FR-038 | No backend Find-bill search/date-range/payment-state contract (consolidates 019/021/023 findings with exact DTO gaps) | `ListOrdersQueryDto` has no `orderNumber`, `search`/`q`, `dateFrom`/`dateTo`, or `paymentStatus` fields, and no upper `@Max()` on `pageSize`. Today's only workaround (proven, reusable) is Supervisor's client-side-page + exact-cuid2-fallback pattern (`SupervisorFindOrderDialog.tsx`). Find bill inherits the same workaround unless a backend addition is explicitly authorized. | High | C2/C5, needs authorization if full search is required |
| CASH-FR-039 | Cross-role Floor cache sync not wired for Cashier | Zero Floor-key invalidation exists anywhere in `lib/cashier`/`components/cashier` today (no Floor exists yet to sync with). Supervisor's 7 mutation dialogs each invalidate both `["supervisor","floor",branchId]` and `["waiter","floor",branchId]` narrowly on success — this exact pattern (plus a third `["cashier","floor",branchId]` key) must be added new in C3, it is not a relocation of existing code. | High | C3 |
| CASH-FR-040 | Safe-drop idempotency no-op server-side (pre-existing, unrelated to nav) | `TillsController.safeDrop` is the one Till mutation not wrapped in `bg3.guard(...)` — the frontend already sends an `Idempotency-Key` header that the backend does not consume. Pre-existing; relevant only if Floor-first work re-touches Till idempotency. | Low | Out of scope unless Till is touched |
| CASH-FR-041 | `CashierCloseOrderPanel` "Refresh" is not actionable | When a non-cash payment settles the balance but the backend doesn't auto-close, the panel shows a static `Badge` labeled "Refresh" with no `onClick`. Real UX gap the settlement workspace inherits; should be fixed while relocating in C3, not merely preserved. | Medium | C3 |

## Classification rules

- **Critical:** payment/data integrity, wrong-order selection, cross-branch leakage, role leakage, or loss of required access.
- **High:** primary workflow, navigation, shared-component, or operational-completeness gap.
- **Medium:** usability, compatibility, documentation, or non-blocking support concern.

Prompt C0 must add exact file paths, endpoints, permissions, query keys, and test references to every verified row.
