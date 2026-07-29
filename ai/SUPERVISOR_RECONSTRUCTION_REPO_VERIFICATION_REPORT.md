# Supervisor Reconstruction Repo Verification Report

Status: Prompt 0 research and planning complete  
Date: 2026-07-18  
Scope: documentation only. No runtime code, API, Prisma, migration, seed, Postman, permission, routing, React Query, cache, or shared component behavior changed.

## 1. Source Of Truth

This report uses the local worktree as source of truth, including uncommitted Waiter, Cashier, performance, and Supervisor changes present on `main`. Earlier Supervisor docs described the old visible nav as Floor, Orders, Reservations, Approvals, Me. The new product decision supersedes that: visible Supervisor nav must be exactly Floor, Reservations, Approvals, Me.

## 2. Mandatory Context Read

Read before documentation changes: `ROADMAP.md`, `repo file tree.txt`, `ai/AI_CONTEXT.md`, `ai/AI_STATUS.md`, `ai/AI_ERROR_PROTOCOL.md`, `ai/AI_COMPLETION_REPORT_TEMPLATE.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/API_CONVENTIONS.md`, `docs/POSTMAN_ENDPOINT_GUIDE.md`, and the existing Postman collection inventory.

## 3. Product Decision

Supervisor must not have an Orders bottom-nav tab. Order work enters from Floor after a table selection. Exception order lookup is still required for takeaway, tableless, closed, direct-reference, and post-close review cases, but it must live inside the Floor-order workspace, not as a fifth primary tab.

## 4. Current Supervisor Nav Evidence

`apps/web/src/lib/supervisor/routes.ts` currently registers Floor, Orders, Reservations, Approvals, Me. `SupervisorBottomNav.tsx` renders five columns from that registry. This conflicts with the new four-tab nav decision.

## 5. Current Supervisor Route Surface

Verified route files exist for `/supervisor/floor`, `/supervisor/orders`, `/supervisor/reservations`, `/supervisor/approvals`, and `/supervisor/me`. The current Orders route is a read-only order oversight page, but its existence as primary navigation is now a reconstruction gap.

## 6. Waiter Floor Baseline

The newest Waiter Floor uses URL-backed table selection, a shared-feeling table grid, stable table cards, search, status filters, cached menu prefetch, and a full-screen table workspace. Cards show table name, status, capacity, reservation timing, waiter ownership, and active order state without guest-name exposure. This is the visual and interaction baseline Supervisor Floor must share.

## 7. Supervisor Floor Evidence

Current Supervisor Floor reads `/api/floor-plans`, `/api/tables`, `/api/floor/availability`, selected floor plan, selected table, and can patch table status. It renders a distinct Supervisor card/grid/detail-panel system with larger table cards, floor-plan filters, metadata fields, and handoff links to Orders and Reservations.

## 8. Floor Divergence

Supervisor Floor and Waiter Floor duplicate equivalent concepts with different card dimensions, icons, filters, empty states, selection behavior, and typography. Reconstruction should extract a shared operational floor presentation layer, then let Waiter and Supervisor provide role-specific adapters and post-selection workspaces.

## 9. Shared Shell Evidence

Cashier and Supervisor shells are structurally close: fixed 80px header, fixed 44px readiness strip, `max-w-[1600px]`, `pt-40`, bottom nav, branch/workstation header context, clock, role identity, and sign-out icon. Waiter differs with its shift banner, page container, three-tab nav, and idle handler.

## 10. Shell Gap

There is no shared frontline shell contract across Waiter, Cashier, and Supervisor. The reconstruction should introduce shared shell primitives for header layout, readiness strip, bottom nav, identity block, clock, sign out, and page container while preserving each role's route guard and business logic.

## 11. Icon Evidence

Equivalent concepts use different Phosphor icons. Example: Waiter Floor uses `SquaresFour`; Supervisor Floor uses `GridFour`; refresh appears as `ArrowClockwise` or `ArrowsClockwise`; warning appears as `WarningCircle`, `WarningDiamond`, and `ShieldWarning`.

## 12. Icon Gap

There is no shared icon registry. Reconstruction should define one source for role nav icons and repeated operational concepts: Floor, Reservations, Approvals, Me, Search, Back, Close, Refresh, Table, Warning, Success, Logout, Money, Transfer, Split, Merge, Void, Refund, Seat, Confirm, Cancel, No-show, Leave, Shift Swap, and Anomaly.

## 13. Orders Entry Model

Backend order contracts are strong enough for Supervisor exception workflows: list/detail, order item reads/writes, status transitions, void, handoff split/merge/move/transfer, discounts, payments reads, refunds, and post-close void. UI should expose only supervisor-appropriate exceptions after table or order selection.

## 14. Current Orders Route Evidence

`/supervisor/orders` lists active orders through `GET /api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=100`, supports optional `tableId`, and only fetches payment/refund/discount details for the selected order after performance hardening. It is read-only.

## 15. Orders Reconstruction Gap

The route can be reused internally, but not as visible bottom nav. The route should become either an internal detail target or be replaced by a Floor-contained order workspace and exception lookup panel.

## 16. Order Handoff Contracts

Verified endpoints include `POST /api/pos/orders/merge`, `POST /api/pos/orders/:id/split-bill`, `POST /api/pos/orders/:id/split-items`, `POST /api/pos/orders/:id/transfer-table`, `POST /api/pos/orders/:id/transfer-server`, and `POST /api/pos/orders/:id/move-items`. BG3 idempotency is used where wrapped.

## 17. Payment And Cashier Boundary

Supervisor may read payment state for exception resolution, but payment collection remains Cashier-owned. `POST /api/pos/orders/:id/close`, payment intents, manual reference payments, till open/drop/reconcile, receipts, printers, and device workflows must not become Supervisor primary workflows.

## 18. Reservation Current UI Evidence

Supervisor Reservations currently merges all reservations, today reservations, and upcoming reservations in the browser. It requests up to 100 rows per source and defaults to an `all` filter. This creates a dense pile-up, especially with demo data containing many current and historical reservations.

## 19. Reservation Backend Lifecycle

Reservation statuses are `PENDING`, `CONFIRMED`, `SEATED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`. Service transitions allow PENDING to CONFIRMED/CANCELLED/NO_SHOW, CONFIRMED to SEATED/CANCELLED/NO_SHOW, and SEATED to COMPLETED. Verified controller endpoints expose create, list, upcoming, detail, confirm, seat, cancel, no-show, deposits, events, and assign-table.

## 20. Reservation Completion Gap

The schema contains `completedAt`, and service transition rules mention SEATED to COMPLETED, but no verified controller endpoint exposes completion. `ReservationEventType` also lacks a COMPLETED event value. The UI cannot truthfully resolve seated reservations into history without a verified completion mechanism.

## 21. Reservation Pile-Up Root Cause

The pile-up is not just visual density. It is lifecycle ambiguity: active, upcoming, seated, terminal, historical, deposit-watch, assigned, and awaiting-table records are merged into one queue. The reconstruction must split active operations from history and add explicit lifecycle exits.

## 22. Reservation Proposed Model

Use an active board for `PENDING`, `CONFIRMED`, and `SEATED`; a separate History view for `COMPLETED`, `CANCELLED`, and `NO_SHOW`; and a Deposit watch filter for active deposits. Seat actions remain high-impact and should invalidate Floor, Reservations, Orders, and table queries.

## 23. Approval Current UI Evidence

Supervisor Approvals reads domain-specific queues only: pending discounts, pending leave, pending shift swaps, and open anomalies. It explicitly excludes global `/api/approvals`. Refund and post-close void domains are displayed as unavailable because no verified pending refund queue or void-candidate read endpoint exists.

## 24. Approval Backend Lifecycle

Verified action endpoints exist for discount approve/reject, leave review, shift-swap approve/reject, anomaly acknowledge/resolve, refund approve, and post-close void execution. The current UI intentionally has no mutation handlers for these decisions.

## 25. Approval Pile-Up Root Cause

The current page places different lifecycle domains in one mixed list without a shared decision state model. Some domains have action endpoints; others lack queue endpoints. The reconstruction must define one approval item model with domain, source id, priority, status, age, required permission, available actions, risk copy, and completion behavior.

## 26. Identity Projection Evidence

Supervisor order and approval formatters often fall back to raw IDs when user, employee, table, or order display fields are absent. Waiter profile work recently improved shared presentation primitives, but the underlying list projections remain uneven.

## 27. Identity Gap

Supervisor needs consistent display identity in lists: user display name, employee display name/code, table label, order number, reservation reference, and fallback rules. Raw IDs should remain available in detail metadata, not dominate cards.

## 28. Postman Evidence

Relevant Postman collections verify the underlying contracts: `M10-POS-Orders`, `BG4B-Pos-Order-Handoff`, `M12-Discounts-Approval-Workflow`, `M13-Payments-Cash-Card-MOMO`, `M14-Refunds-Voids`, `M16-Reservations-Deposits-Seating`, `M24-Attendance-Leave-Shift-Swaps`, `BG2-Unified-Approvals-And-Audit-Timeline`, and `WAITER-MVP-Role-Workflow`.

## 29. Postman Rule For Future Phases

Prompt 0 changed docs only, so no Postman collection was edited. Any future phase that changes API contracts or adds Supervisor action flows must update or create the canonical collection, preserve base URL `http://localhost:3001`, use `/api`, dual-scope runtime variables, and standalone folder rules.

## 30. Regression Risk

The main risks are breaking Waiter Floor while extracting shared floor UI, introducing a Cashier clone inside Supervisor, exposing backend permissions too broadly, and adding fake decision rows for queues that lack verified list endpoints. Each future implementation prompt must test Waiter, Cashier, and Supervisor routes together.

## 31. Reconstruction Recommendation

Proceed in small prompts: shared shell/icon foundations, shared operational floor, Floor-contained Supervisor order workspace and lookup, reservation lifecycle split, approval lifecycle actions, Me/profile alignment, and final QA/Postman/docs. Do not start by deleting the Orders route until the Floor-contained replacement and fallback lookup are ready.

## 32. Prompt 0 Completion

Prompt 0 is complete as a research, verification, and roadmap pass only. Implementation phases remain pending. No code, database schema, migration, seed, Postman, permission, auth, or route behavior was changed.
