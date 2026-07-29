# Supervisor Reconstruction Prompt 2 — Shared Floor Completion Report

Date: 2026-07-18  
Repository: `C:\Users\arman\Desktop\nimbus-pos`  
Status: Complete

## Repository and initial safety result

- Exact repository path confirmed; `C:\Users\arman\Desktop\NIMBUS\nimbus-pos` was not used.
- Initial branch: `main`.
- The worktree was materially dirty before Prompt 2. Existing modified and untracked work covered Waiter, Cashier, Supervisor, shared shell/profile/toast, auth/performance, API order behavior, Prisma seed/demo import, documentation, and completion reports.
- Existing changes were treated as user-owned. No reset, restore, stash, clean, discard, commit, push, migration, seed run, unrelated process kill, or Postman edit was performed. The exact verified Nimbus `next start` listener was stopped/restarted around production builds, and two orphaned headless Playwright roots created by timed-out QA probes were cleaned up by exact PID.
- Prompt 1 shell assets identified under `apps/web/src/components/pos-shell/`, the role shell adapters, role route registries, `SupervisorLegacyOrdersRedirect`, and `legacy-orders-route.ts`.
- Completed Waiter Floor assets identified under `apps/web/src/components/waiter/floor/` plus `lib/waiter/floor-api.ts`, `floor-model.ts`, `formatters.ts`, order/reservation models, and URL-backed selection in `WaiterFloorScreen`.
- Old Supervisor Floor assets identified under `apps/web/src/components/supervisor/floor/`, `pages/supervisor/floor.tsx`, `lib/supervisor/floor.ts`, and `floor-model.ts`.
- Every Postman collection was read and parsed during the initial audit. Initial Postman status/diff was empty.

## Original Floor differences recorded before extraction

| Concern | Waiter baseline | Supervisor before Prompt 2 |
|---|---|---|
| Page heading | Shared-style `PageShell` with `Floor`, branch subtitle, shift/table badges | Supervisor-only eyebrow, `Floor Control`, management description, three readiness badges, refresh action |
| Summary blocks | None | Six-card table summary plus explanatory banners and floor-plan information card |
| Query ownership | One parallel Floor query for tables, active orders, reservations; separate menu prefetch | Separate floor-plan, table, availability, selected-plan-detail, and selected-table-detail queries |
| Table normalization | Order and reservation overlays derive Available/Occupied/Reserved, ownership, assigned waiter, and active order | Table/metadata only; backend status, zone, server metadata, order-count metadata, and last-update formatting |
| Status derivation | Active order and reservation truth override raw table state; cleaning/blocked/inactive rows hidden | Raw table status maps to Available/Occupied/Reserved/Blocked/Other |
| Order overlay | Active order list is indexed by table; `NEW` is retained for instant resume but does not force Occupied | No authoritative active-order overlay; metadata order count only |
| Reservation overlay | Active PENDING/CONFIRMED reservations indexed by table | No reservation read; raw Reserved status only |
| Card fields | Full table label, status, assigned waiter, separate Mine, capacity; reserved timing | Floor plan, raw service state panel, order-count summary, capacity, zone, server, last update |
| Card height | 176px | 268px rendered baseline (224px minimum plus content) |
| Card width | Auto-fill, minimum 220px | Fixed responsive columns inside a narrower Floor/detail split |
| Grid columns | `repeat(auto-fill,minmax(220px,1fr))` | 2/3/4 breakpoint grid plus fixed 420px detail column |
| Selected state | Navy border and panel shadow; URL selection appears immediately | White background/shadow only; click selection is local state |
| Filters | All, Available, Occupied, Reserved, Mine | All, Available, Occupied, Reserved, Blocked, Other |
| Search | Table, assigned waiter, and internal order reference matching; card never exposes guest | Table, backend status, capacity, plan, zone, metadata server |
| Floor-plan filtering | No visible selector in current baseline | Dedicated always-visible floor-plan selector and detail card |
| Card click | Immediate local selection override plus shallow URL push/replace | Local state only; URL unchanged; selected table detail request starts after click |
| Empty state | Shared `EmptyState` with Waiter filter copy | Separate Supervisor empty state plus no-plan and no-table explanations |
| Error state | Shared `ErrorState` with role-specific adapter copy | Shared primitive wrapped by Supervisor page-specific warnings and API path copy |
| Loading skeletons | 176px auto-fill card skeletons | 224px multi-field skeletons in breakpoint columns |
| URL query | `tableId` and `orderId` preserved; selection push/replace | Reads initial `tableId`; click does not update URL; `orderId` is only shown as a banner |
| Browser Back | First selection pushes history and Back closes workspace | Click selection has no history entry and browser Back does not close detail |
| Responsive workspace | One fixed overlay workspace; one mounted lifecycle tree | Persistent narrow right detail column on wide screens and stacked detail below the grid on narrow screens |
| Fixed shell clearance | Shared operational shell offsets and bottom-nav clearance | Same shell after Prompt 1, but long Supervisor dashboard pushes the first table below the fold |
| Baseline first-card position at 1440x900 | y=400, 262.4x176 | y=872, 300x268 |
| Baseline request count | Login/Floor 9; selection 0 additional API reads from Floor cache | Login/Floor 7; selection 1 table-detail request |
| Duplicate API calls | No duplicate Floor/detail request observed | No duplicate detail request, but plan/availability/detail queries represent a separate Supervisor-only data path |

## Baseline visual and request evidence

- Browser plugin classification: not installed; Playwright fallback used with bundled Playwright and system Chrome.
- Viewports captured: 1024x768, 1366x768, 1440x900, and 1920x1080 for both roles.
- Both roles had zero horizontal overflow and no console errors.
- Waiter selection URL became `/waiter/floor?tableId=...`; Supervisor selection URL remained `/supervisor/floor`.
- Baseline screenshots and `baseline-floor-qa.json` are stored outside the repository under `C:\Users\arman\.codex\visualizations\2026\07\18\019f753b-0851-7e33-af15-5256720b7ad3`.

## Shared Floor architecture and view model

- Added `apps/web/src/components/floor/` as the single presentation foundation: `OperationalFloor`, toolbar, grid, card, status badge, error/state handling, responsive workspace frame, types, and formatters.
- `OperationalTableViewModel` carries presentation-safe table/floor-plan/capacity/status/staff/Mine/order/reservation/attention context. It exposes no role-specific card fields, guest name, order number, raw user ID, or internal-only status copy.
- Shared staff formatting normalizes whitespace, preserves the first name, and reduces the final surname to an initial (`Peter M.`, `Sarah N.`, `Brian K.`); a single name remains safe and missing identity stays unavailable.
- Shared cards retain the Waiter baseline: 176px height, `repeat(auto-fill,minmax(220px,1fr))`, full breakable identifiers, textual status, assigned staff, separate Mine, capacity, keyboard focus, and `aria-pressed` selected state.

## Role adapters and migrations

- Waiter: `WaiterFloorScreen` now renders the shared Floor/frame. `lib/waiter/floor-model.ts` maps the existing table, active-order, reservation, and ownership truth into the shared model. Menu navigation/catalog prefetch, active-order cache handoff, background draft creation, queued early selection, reserved seating, other-waiter blocking, URL history, and the existing `WaiterTableWorkspace` remain role-owned and behaviorally unchanged.
- Supervisor: `SupervisorFloorScreen` now renders the same shared Floor/frame. `loadSupervisorFloorData` uses verified floor-plan, table, active-order-summary, and reservation reads in one parallel role-owned query; `normalizeSupervisorFloorTables` applies the same operational overlays and staff formatter while truthfully setting `isMine: false`.
- The narrow frontend normalization correction hides inactive/cleaning/blocked/out-of-service rows to match the verified Waiter operational Floor and derives Occupied/Reserved from active order/reservation truth. No API contract or fabricated operational state was added.
- Old Waiter and Supervisor card/grid/toolbar/status/detail presentation files were removed only after import checks passed. Supervisor order-resolution/legacy redirect components were retained.

## Supervisor table-control workspace

- The workspace opens from immediate URL-backed selection and keeps cached table context visible while localized table/order/payment/reservation reads resolve.
- It presents table/service context, assigned waiter, attention, order status/age/lines/item count/subtotal/total, bill state, linked reservation context, and read-only payment summary.
- The previously live, permission-checked table-status mutation is preserved behind Review/Confirm, prevents duplicate submission, updates the canonical table cache, invalidates only Supervisor/Waiter Floor keys, and emits one toast. Browser QA exercised Review/Cancel without issuing a PATCH.
- Split, merge, move, transfer, void, discount, complimentary, refund, payment collection, and close are not rendered as actions. One product-facing capability note explains that additional controls are unavailable in this version. Prompt 3 was not started.

## URL, legacy, responsive, and accessibility behavior

- `tableId` and `orderId` are preserved through shallow selection, refresh context, Back, and Forward. First selection pushes history; changing context replaces it; Close/Back returns focus to the selected card.
- `/supervisor/orders`, supplied `tableId`, and linked `orderId` resolve into Floor without a loop or mutation. A final probe resolved order `cmr1vjqci002lc0kcgt4njlw5` to table `cmr1v97od0025c0kc7lzfvs4b`, one workspace titled `QA-OPEN-01`, 40 Floor cards, and the matching selected-card ID. Tableless order context remains truthful/read-only; final lookup is deferred.
- Exactly one responsive workspace mounts. At 1024, 1366, 1440, and 1920 widths it measured 992/1180/1180/1180px wide respectively, with zero horizontal overflow and accessible Back/Close controls above the bottom nav.
- Cards are buttons with visible focus, text status, understandable seat copy, announced selected state, keyboard Enter activation, and focus return. Errors use existing live-region primitives; no duplicate desktop/mobile workspace is mounted.

## Request-count comparison

| Flow | Before | After |
|---|---:|---:|
| Waiter login + Floor landing | 9 API responses | 8 API responses in the representative parity pass |
| Waiter table selection | 0 | 0 |
| Waiter Back/Close | 0 | 0 |
| Supervisor login + Floor landing | 7 | 8 (adds active order/reservation truth while removing availability/plan-detail dashboard reads) |
| Supervisor table selection | 1 table-detail | 1 table-detail for the selected occupied table; order context reused from Floor cache |
| Supervisor Back/Close | 0 | 0 |

The comprehensive navigation/legacy run intentionally performed repeated Back/Forward/full-route checks. It recorded no API status >=400, no console warnings/errors, no PATCH, and one mounted workspace. Aborted `_next` route/chunk requests during navigation were classified as browser navigation cancellations, not API failures.

## Files created, modified, removed, and retained

- Created: shared Floor directory; `SupervisorFloorScreen.tsx`; `SupervisorTableControlWorkspace.tsx`; `floor-assertions.ts`; assertion tsconfig; this report.
- Modified: Waiter Floor screen/model/workspace/ownership panel/index; Supervisor Floor page/API/model/index; reconstruction and Waiter documentation; AI status/roadmap/gap register; repo tree.
- Removed after zero-import verification: Waiter-specific table card/grid/toolbar/status/detail presentation files and Supervisor-specific summary/toolbar/card/grid/status/detail presentation files.
- Retained: Waiter menu/order workspace and all Supervisor order helpers/legacy redirect components that Prompt 3 may reuse. Unrelated dirty-worktree files were preserved.

## Executable assertions and validation

- `corepack pnpm@8.15.0 --version` -> `8.15.0`.
- Focused Floor assertions passed: shared dependency graph, card safety/no guest fields, full labels, stable statuses/names, URL query preservation, loop-free legacy redirect, four-tab Supervisor nav without Orders, and one responsive workspace.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` passed.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` passed with no warnings/errors.
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web build` passed; final build ID `4Byzq42e9Skz10VEzqrW5`.
- `GET http://localhost:3001/api/health` returned `status: ok`, `db: ok`.
- Authenticated Playwright QA passed for Waiter and Supervisor Floor, toolbar/search/status filters/floor plans, Mine semantics, keyboard selection, focus return, URL Back/Forward, selected workspaces, safe status review/cancel, legacy order entry, four target viewports, shell/nav clearance, and zero horizontal overflow.
- Default Floor geometry was identical across roles at every viewport: same toolbar rectangle, first-card rectangle, columns, 176px card height, heading, and zero old Supervisor summary/Floor Control content. Raw card text differs only where data is genuinely role-dependent: Waiter Mine badges; Supervisor correctly reports Mine count 0.
- Postman collection diff/status remained empty. No migration or seed/demo-import command ran.
- `git diff --check` and the final scoped diff audit are recorded in the final handoff.

## Remaining limitations and final status

- Prompt 3 remains responsible for final tableless/takeaway/closed/direct-reference lookup and vetted split/merge/move/transfer/void/discount/complimentary/refund action work.
- Payment collection and order close remain Cashier-owned. Reservation and approval mutations remain later-prompt work.
- Local authenticated reads were slow enough that the final legacy probe required a 60-second allowance; the resolved behavior passed and no request storm or duplicate workspace was observed.
- Final status: Prompt 2 complete. No backend/API/DTO/Prisma/migration/seed/permission/auth/Postman contract changed. No commit or push was performed.
