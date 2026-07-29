# Supervisor Reconstruction — Prompt 3A Completion Report

**Action-Resolution Contracts, Security/Idle Parity, Action Availability, Safe
Selectors, Confirmation Infrastructure, Idempotency, and Service Actions**

- **Author:** Claude (Opus 4.8, 1M context) via Claude Code — model directive was
  Fable 5 (high) / Opus 4.8 (xhigh) fallback; model selection is user-controlled,
  so this ran on Opus 4.8.
- **Date:** 2026-07-27
- **Scope:** Prompt 3A only. **Prompt 3B NOT started.**
- **Commit/push:** ⛔ None. Dirty worktree preserved.

---

## 1. Repository path
`C:\Users\arman\Desktop\nimbus-pos` (canonical). The stale `NIMBUS\nimbus-pos`
path was not touched.

## 2. Initial branch & worktree
Branch `main`, HEAD `174a787`. At start: 98 modified, 12 deleted, 81 untracked
(the prior onboarding + reconstruction work). No node processes; ports 3000/3001
free.

## 3. Pre-existing deletions (verified intentional, not caused by this prompt)
The 12 deletions are the role-specific Floor components removed in Prompt 2
(`WaiterTable*`, `Waiter…Floor` bits, `SupervisorTable*`/`SupervisorFloor*`, and
`waiter/shell/CurrentTime.tsx`). They remain intentional; Prompt 3A added none.

## 4. Documents read
Root `CLAUDE.md`, `PROGRESS.md`, `ARCHITECTURE.md`; `docs/DOCUMENT_INDEX`,
`REPOSITORY_MAP`, `UI_SYSTEM`, `ROLE_JOURNEYS`, `ROLE_CAPABILITY_MATRIX`,
`DECISIONS`, `TESTING_AND_QA`, `KNOWN_LIMITATIONS`; `ai/AI_STATUS`,
`ai/CLAUDE_REPOSITORY_ONBOARDING_AND_UI_VERIFICATION_REPORT`,
`ai/SUPERVISOR_RECONSTRUCTION_*` (roadmap, repo verification, gap register, defer
matrix, Prompt 1/2 reports); `docs/supervisor-ui-docs/*`.

## 5. Frontend files inspected
Supervisor shell/floor (`SupervisorShell`, `SupervisorFloorScreen`,
`SupervisorTableControlWorkspace`, `SupervisorLegacyOrdersRedirect`),
`lib/supervisor/{orders,floor,floor-model,legacy-orders-route,context}.ts`;
shared shell (`OperationalShell/Header/BottomNav/IdleLogoutHandler`, `role-*`),
`lib/waiter/idle`, waiter/cashier idle wrappers; `components/ui/*`,
`providers/ToastProvider`, `lib/api/client`, `lib/cashier/idempotency`;
`apps/web/scripts/*-assertions.ts`.

## 6. Backend files inspected
`orders.controller.ts` + `orders.service.ts` (+ dto), `pos-handoff.controller/service`,
`discounts`, `payments`, `refunds` controllers/services, `floor.controller`,
`common/decorators/permissions`, `common/guards/permission.guard` +
`branch-context.guard`, `common/auth/waiter-scope`, `reliability/idempotency.service`
+ `bg3-reliability.service`, `tenancy`/`hr` controllers (selector sources),
`main.ts`, `seed.ts` (Supervisor role permissions).

## 7. Postman collections inspected
All 56. Order-action requests live in `M10-POS-Orders`, `BG4B-Pos-Order-Handoff`,
`WAITER-MVP-Role-Workflow`, `M12-Discounts-Approval-Workflow`, `M14-Refunds-Voids`.
request-bill has no body/Content-Type; mark-served body `{}`; only BG4B split-items
sends `Idempotency-Key`. **Postman left unchanged** (no contract change).

## 8. Supervisor idle-session finding and fix
**Finding (SUP-RG-020):** `SupervisorShell` did not inject an `idleHandler`; Waiter
and Cashier did → supervisor sessions never idle-logged-out. The shared
`OperationalIdleLogoutHandler` existed but consumed **waiter-namespaced** constants
(`WAITER_ACTIVITY_EVENTS`/`WAITER_IDLE_TIMEOUT_MS`).
**Fix:** created `components/pos-shell/idle.ts` with `OPERATIONAL_IDLE_TIMEOUT_MS`
(15 min preserved) + `OPERATIONAL_ACTIVITY_EVENTS`; repointed the shared handler at
them; `lib/waiter/idle.ts` now re-exports those under deprecated `WAITER_*` aliases
(only the shared handler imported them). `SupervisorShell` now injects
`<OperationalIdleLogoutHandler />` — the shared mechanism, no third implementation,
one timer per shell, no duplicate logout or `/auth/me`. Timeout/warning behaviour
and the `/login?reason=idle_timeout` redirect are identical across all three roles.

## 9. Contract matrix (verified from source; Idem = honors Idempotency-Key)
| Action | Path (POST unless noted) | Perm | Body | Allowed source | Idem | Audit | 3A |
|---|---|---|---|---|---|---|---|
| Request bill | `/api/pos/orders/:id/request-bill` | `pos:orders:write` | none | any except CLOSED/VOIDED | No | `ORDER_BILL_REQUESTED` | **LIVE** |
| Mark served | `/api/pos/orders/:id/mark-served` | `pos:orders:write` | `{reason?}` | READY only | No | `ORDER_SERVED` | **LIVE** |
| Void | `/api/pos/orders/:id/void` | `pos:orders:void` | `{reason?}`* | NEW/SENT/IN_KITCHEN/READY | No | `ORDER_VOIDED` | 3B |
| Merge | `/api/pos/orders/merge` | `pos:order:merge` | src/target/reason? | open | Yes | `ORDER_MERGED` | 3B |
| Split bill | `/api/pos/orders/:id/split-bill` | `pos:order:split` | mode/count/groups | open | Yes | `ORDER_SPLIT_BILL` | 3B |
| Split items | `/api/pos/orders/:id/split-items` | `pos:order:split` | items[] | open | Yes | `ORDER_SPLIT_ITEMS` | 3B |
| Transfer table | `/api/pos/orders/:id/transfer-table` | `pos:order:transfer` | targetTableId | open | Yes | `ORDER_TRANSFERRED_TABLE` | 3B |
| Transfer server | `/api/pos/orders/:id/transfer-server` | `pos:order:transfer` | targetUserId | open | Yes | `ORDER_TRANSFERRED_SERVER` | **Blocked** |
| Move items | `/api/pos/orders/:id/move-items` | `pos:order:move-items` | targetOrderId/items | open | Yes | `ORDER_ITEMS_MOVED` | 3B |
| Order payments (GET) | `/api/pos/orders/:id/payments` | `pos:payment:read` | — | — | — | — | read-only |
| Discount request | `/api/pos/orders/:id/discounts` | `pos:discount:request` | type/value/reason! | NEW/SENT/IN_KITCHEN/READY | No | `DISCOUNT_*` | 3B |
| Discount approve/reject | `/api/pos/discounts/:id/{approve,reject}` | `pos:discount:approve` | pin?/reason! | PENDING | No | `DISCOUNT_APPROVED/REJECTED` | 3B |
| Post-close void | `/api/pos/orders/:id/post-close-void` | `pos:void:postclose` | reason!+managerPin! | CLOSED ≤15min | No | `ORDER_POST_CLOSE_VOIDED` | 3B |

*void reason required when IN_KITCHEN/READY. **Supervisor is NOT waiter-only, so it
is exempt from waiter ownership/open-shift/transition restrictions.** Supervisor
role has `pos:orders:write`, `pos:table:write`, and payment/refund read perms
(verified in seed + live `/auth/me`). No controller/Postman conflict required a
contract correction.

## 10. Action-availability architecture
`lib/supervisor/order-actions.ts` — the single source of truth. `SupervisorOrderAction`
(13 actions), `SupervisorActionAvailability` (visible/enabled/reason +
requiresConfirmation/requiresReason/requiresManagerPin/requiresIdempotencyKey), and
`getSupervisorOrderActionAvailability(action, ctx)` deriving state from permission,
order presence/error, order status vs per-action allowed statuses, mutation state,
and hard blockers. `SUPERVISOR_LIVE_ORDER_ACTIONS = ["request-bill","mark-served"]`
gates visibility; all other actions are hidden foundation carrying their real
requirement flags for Prompt 3B. Pure + assertion-tested.

## 11. Canonical selected-order architecture
The workspace derives header/status/lines/count/subtotal/total/bill/payment/table
context and action availability from one canonical order — the
`["supervisor","order-detail",branchId,orderId]` React Query entry (shared by the
floor screen and legacy redirect). `table.activeOrder` is only placeholder data.
Mark served updates **that** entry (optimistic `setQueryData` merge → SERVED, then
narrow invalidate) plus the floor summary; no separate authoritative order copies.

## 12. Action-panel architecture
A compact "Order actions" Card inside the existing read-first workspace (no redesign),
rendered only when a canonical order exists and at least one live action is visible.
Exposes only Request bill and Mark served with concise operational reasons when
disabled. No disabled buttons for 3B actions; the existing "Additional order controls
are not available in this version." notice remains the capability notice. No prompt
numbers/endpoints in user copy.

## 13. Confirmation infrastructure
`components/pos-shell/ActionConfirmDialog.tsx` — shared, composable, controlled
dialog: title, consequence, context, optional amount, optional reason, optional
manager PIN, validation (confirm gated on required fields), pending state, inline
`role="alert"` error, `role="dialog"`/`aria-modal`/`aria-labelledby`/`aria-describedby`,
initial focus, Escape-to-cancel (blocked while pending), backdrop cancel, and focus
return on close. No `window.confirm`. No action-specific mutation logic. Mark served
uses it (optional reason); Prompt 3B reuses it with reason/PIN as needed.

## 14. Idempotency infrastructure
`lib/pos-shell/idempotency.ts` — `buildOperationalIdempotencyKey`,
`createIdempotencyIntent` (pure: `current`/`begin`/`reset` — generate on first submit
intent, reuse on retry, clear on success/cancel/change), and `useIdempotencyIntent`
hook. **Foundation for Prompt 3B only.** Deliberately NOT attached to
request-bill/mark-served because those endpoints are not BG3-wrapped and do not honor
`Idempotency-Key` (per §7/§9). Lifecycle asserted in `prompt3a-assertions.ts`.

## 15. Table selector findings
`GET /api/tables` + `GET /api/tables/:id` + `GET /api/floor/availability`
(`pos:table:read`/`pos:floor:read`) give same-branch tables with status/capacity and
active-order linkage — sufficient for a Prompt 3B transfer-table selector via the
existing `fetchSupervisorTables`/`fetchSupervisorFloorAvailability` helpers. No new
read helper shipped in 3A (would be dead code until 3B).

## 16. Order selector findings
`GET /api/pos/orders` supports `status`, `serviceType`, `tableId`, `userId`,
`excludeStatus`, `page`, `pageSize` — sufficient for Prompt 3B merge/move-items target
selection via the existing `fetchSupervisorOrders`. No new helper shipped in 3A.

## 17. Server selector findings — transfer-server BLOCKED
There is **no** safe narrow, branch-scoped, operational-role server selector. The
only branch-scoped user list is tenancy memberships
(`GET /api/orgs/:o/branches/:b/memberships`, `tenancy:membership:manage` — admin
perm Supervisor lacks; also unfiltered by ACTIVE/role). `GET /api/employees` is an
org-wide HR directory, not a POS user picker. The backend enforces target = ACTIVE
branch membership server-side. **transfer-server stays deferred/blocked** until a
purpose-built selector exists — encoded as a hard `blockedReason` in the availability
module.

## 18. Request bill implementation
`requestSupervisorOrderBill` → `POST /request-bill` (no body). Visible with
`pos:orders:write`; enabled for any order not CLOSED/VOIDED; duplicate clicks blocked
via mutation-pending; one request; success toast + a **session-scoped truthful
acknowledgment** ("Bill requested • HH:MM") from the server's own `requestedAt`.
Because the backend is audit-only (no persisted bill state — verified in
`orders.service.ts:863-907`), no cache is invalidated and no persisted bill state is
manufactured. Handles already-open/closed/permission/timeout/network via toasts.

## 19. Mark served implementation
`markSupervisorOrderServed` → `POST /mark-served` (`{reason?}`). Visible with
`pos:orders:write`; **enabled only when status === READY** (matches the backend
state machine); explicit confirmation via `ActionConfirmDialog` with optional reason;
duplicate-blocked; on success merges SERVED into the canonical order-detail cache +
floor summary, then narrowly invalidates supervisor order-detail/floor and waiter
floor; success toast. Errors keep the dialog open with an inline message. Not
item-level; no fake KDS completion; hidden in invalid states.

## 20. Payment-state boundary
Payment context stays **read-only** (unpaid/partial/paid/pending/failed + totals).
No Take payment / Add payment / Close / Refund / Till / Receipt controls were added.
Payment-read failure does not block non-financial order context (independent query
with its own retry/error surface).

## 21. Tableless order handling
Order actions are gated on the canonical order, not the table, so a direct/legacy
`orderId` without a table still shows order number/service/state/totals/bill/payment
and the valid actions, with Back to Floor, refresh, and history preserved. No Orders
nav restored; no broad order-search page added.

## 22. Cache behaviour
Request bill: no cache mutation (audit-only). Mark served: optimistic `setQueryData`
on the canonical order-detail + floor summary, then targeted `invalidateQueries` for
supervisor order-detail, supervisor floor, and waiter floor only. No menu/reservations/
approvals/Me/shift/auth invalidation; no broad prefix wipes; mirrors the existing
table-status mutation pattern.

## 23. Performance results
No new duplicate `/auth/me`, shell/readiness queries, timers, or double-mounts. One
timer per shell (idle). Live API measurements this pass: `/api/health` ~sub-second;
login 201 + `/auth/me` 200 for all roles; order-action responses returned promptly
against Neon. Residual Neon/local latency remains external and unchanged.

## 24. Accessibility results
Dialog is a labelled `aria-modal` dialog with initial focus, Escape, focus return,
`role="alert"` errors, and required-field markers. Action buttons use the shared
`Button` (visible focus). Status conveyed by text + tone, not colour alone. Full
authenticated multi-viewport **browser** QA was not run in this environment (no
browser automation) — reported honestly; static/behavioral assertions + build cover
structure. Recommend running the documented viewport matrix before demo.

## 25. Files created
- `apps/web/src/components/pos-shell/idle.ts`
- `apps/web/src/components/pos-shell/ActionConfirmDialog.tsx`
- `apps/web/src/lib/pos-shell/idempotency.ts`
- `apps/web/src/lib/supervisor/order-actions.ts`
- `apps/web/scripts/prompt3a-assertions.ts` + `apps/web/scripts/tsconfig.prompt3a-assertions.json`
- `ai/SUPERVISOR_RECONSTRUCTION_PROMPT3A_ACTION_FOUNDATION_COMPLETION_REPORT.md`

## 26. Files modified (code)
- `apps/web/src/components/pos-shell/OperationalIdleLogoutHandler.tsx` (shared constants)
- `apps/web/src/lib/waiter/idle.ts` (re-export shared constants; deprecated aliases)
- `apps/web/src/components/supervisor/shell/SupervisorShell.tsx` (inject idle handler)
- `apps/web/src/lib/supervisor/orders.ts` (request-bill + mark-served fetchers + types)
- `apps/web/src/components/supervisor/floor/SupervisorTableControlWorkspace.tsx` (action panel, mutations, dialog, canonical wiring, `canManageOrders`)
- `apps/web/src/components/supervisor/floor/SupervisorFloorScreen.tsx` (`canManageOrders` prop)

Docs modified: `CLAUDE.md`, `PROGRESS.md`, `ARCHITECTURE.md`,
`docs/{ROLE_CAPABILITY_MATRIX,ROLE_JOURNEYS,DECISIONS,KNOWN_LIMITATIONS,TESTING_AND_QA}.md`,
`docs/supervisor-ui-docs/{SUPERVISOR_API_MATRIX,SUPERVISOR_LIFECYCLE,README}.md`,
`ai/{AI_STATUS,SUPERVISOR_RECONSTRUCTION_ROADMAP,SUPERVISOR_RECONSTRUCTION_GAP_REGISTER,SUPERVISOR_MVP_INCLUSION_DEFER_MATRIX}.md`.

## 27. Backend changes
**None.** No controller/service/DTO/Prisma/migration/seed/permission changes.

## 28. Postman changes
**None.** No API contract changed. 56/56 collection JSON valid (3 legacy UTF-8 BOM
tolerated by Postman).

## 29. Assertions / tests
New `prompt3a-assertions.ts` (all pass): idle timeout/events preserved; shared handler
no longer uses waiter constants; SupervisorShell injects idle; Waiter/Cashier keep
idle; request-bill hidden without perm / visible+enabled on open order / disabled on
CLOSED+VOIDED; mark-served enabled+requiresConfirmation only when READY, disabled with
reason otherwise; no-order/errored/mutating disable; all 3B actions hidden even with
perms; live set is exactly 2; idempotency requirement flags (false for 3A actions,
true for handoff); idempotency-intent stability + renewal; canonical order-detail
cache targeting; duplicate-prevention; central-module usage; read-only payment
boundary copy; tableless gating; dialog a11y; no Orders nav. Existing floor/shell/
profile assertions still pass (no regression).

## 30–32. Typecheck / Lint / Build
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` → **pass**.
- `… lint` → **pass** ("No ESLint warnings or errors").
- `… build` → **pass** (compiled + static pages generated).
- `corepack pnpm@8.15.0 --version` → `8.15.0`.

## 33. API health
`GET /api/health` → `{status:"ok", db:"ok"}` HTTP 200.

## 34. Supervisor QA (authenticated, live endpoints)
`supervisor@nimbus.demo` (has `pos:orders:write` + `pos:table:write`):
- Request bill on NEW order → **200, billRequested true, requestedAt set**;
  duplicate → **200** (idempotent-safe); on CLOSED → **409 "Cannot request bill on a
  CLOSED order"**.
- Mark served on NEW → **409 "Invalid transition from NEW to SERVED"**; on READY →
  **200, status SERVED**, verified by `GET /pos/orders/:id` → SERVED.
Order inventory observed: NEW 14, SENT 11, READY 10, SERVED 12, CLOSED 53 (total 315).

## 35. Waiter regression
Login **201** + `/auth/me` **200**. Idle handler unchanged (still injected); shell
assertions confirm. No API change.

## 36. Cashier regression
Login **201** + `/auth/me` **200**. Payment workflow untouched (Cashier-owned); idle
handler unchanged. No API change.

## 37. Viewport QA
Not executed via browser automation in this environment (honest limitation). Geometry/
structure covered by shell/floor assertions + production build; the confirmation
dialog is responsive (`max-w-lg`, `max-h-[calc(100vh-2rem)]`, `overflow-y-auto`, `p-4`
backdrop). Recommend the documented 1024/1366/1440/1920 matrix before demo.

## 38. QA-created data
One demo order (`c3f211543108da1cba5692f0`) transitioned READY→SERVED during
mark-served happy-path QA. Several audit-only `ORDER_BILL_REQUESTED` events on a NEW
order. No destructive mutations (no void/refund/payment/close/split/merge).

## 39. Known limitations
- Request bill is audit-only (acknowledgment is session-scoped, resets on refresh —
  truthful, not a bug).
- transfer-server blocked (no safe server selector).
- High-impact actions deferred to Prompt 3B (foundation ready).
- Reservation completion contract still missing (SUP-RG-008/009).
- Browser viewport QA not run here.

## 40. Prompt 3B prerequisites
Foundation ready: availability module (flags encoded), shared confirmation dialog,
idempotency-intent utility, canonical order state, verified handoff/discount/void
contracts. Still needed before/within 3B: a safe narrow server selector (for
transfer-server); target selectors for table/order (design ready, helpers to build);
and manager-PIN UX for post-close-void.

## 41. Final status
**Prompt 3A COMPLETE.** Idle parity fixed; central availability + canonical order +
shared confirmation + idempotency foundation in place; Request bill and Mark served
live and verified; payment read-only; no Orders nav; shared Floor parity intact;
Waiter/Cashier unaffected. **Prompt 3B NOT started.**

## 42. No commit / no push
⛔ No `git commit` or `git push` occurred. Worktree preserved; no reset/restore/
stash/clean.
