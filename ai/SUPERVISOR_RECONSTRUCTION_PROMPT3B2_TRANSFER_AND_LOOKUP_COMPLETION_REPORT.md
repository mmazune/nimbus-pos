# Supervisor Reconstruction — Prompt 3B2 Completion Report
## Transfer Table, Find Order, Tableless/Terminal/Legacy Lookup, Transfer-Server Decision

**Date:** 2026-07-28
**Author:** Claude Code (Opus 4.8, 1M context)
**Status:** Implementation + technical (static/executable) validation complete;
authenticated live/browser/viewport QA **pending** (no API/DB/browser automation
in this environment). No commit, no push.

---

### 1. Repository path
`C:\Users\arman\Desktop\nimbus-pos` (canonical). The forbidden stale tree
`C:\Users\arman\Desktop\NIMBUS\nimbus-pos` was not touched.

### 2. Initial branch and git status
Branch `main`, heavily dirty worktree (170 entries) — the authoritative newest
state. All pre-existing modifications preserved; no reset/restore/stash/clean/
checkout/discard performed.

### 3. Pre-existing deletions (verified intentional, left deleted)
Twelve deleted role-specific Floor/shell files: 6 Supervisor
(`SupervisorFloorStatusBadge/FloorSummary/FloorToolbar/TableCard/TableDetailPanel/
TableGrid.tsx`), 5 Waiter (`WaiterTableCard/TableDetailPanel/TableGrid/
TableStatusBadge/TableToolbar.tsx`), and `waiter/shell/CurrentTime.tsx`. These are
the intentional consolidation into the shared `components/floor/` +
`components/pos-shell/` system. Not attributed to 3B2.

### 4. Documents read
Root `CLAUDE.md`, `.claude/CLAUDE.md`, `PROGRESS.md`, `ai/AI_STATUS.md`,
Prompt 3A/3B1 completion reports, `order-actions.ts`, `order-action-forms.ts`,
`orders.ts`, `floor.ts`, `floor-model.ts`, `context.ts`, `routes.ts`,
`legacy-orders-route.ts`, the shared `ActionConfirmDialog`, the idempotency
utility, `OperationalFloor`, `PageShell`, `SupervisorTableControlWorkspace`,
`SupervisorOrderTargetSelector`, `SupervisorMoveItemsDialog`,
`SupervisorFloorScreen`, `SupervisorLegacyOrdersRedirect`, and the existing
assertion scripts. Backend + permission mapping audited via subagents.

### 5. Frontend files inspected
See §32–33. Key: the central availability module, the 3B1 dialogs/selectors/forms,
the Floor screen selection/URL model, the legacy redirect, and the shared confirm
dialog + idempotency intent.

### 6. Backend files inspected (read-only; no backend logic changed)
`apps/api/src/modules/pos-handoff/pos-handoff.controller.ts` +
`pos-handoff.service.ts` + `dto/transfer-table.dto.ts` + `dto/transfer-server.dto.ts`;
`orders/orders.controller.ts` + `orders.service.ts` + `dto/list-orders-query.dto.ts`;
`floor/floor.controller.ts` + `floor.service.ts`; `payments/payments.controller.ts`;
`packages/db/prisma/seed.ts`; `schema.prisma` (Table model + TableStatus enum).

### 7. Postman collections inspected
`BG4B-Pos-Order-Handoff.postman_collection.json` (canonical — has "E. Transfer
Table" `POST /:id/transfer-table — 200` + a Chef→403 negative, and "F. Transfer
Server"), `M10-POS-Orders`, `M5-Floor-Plans-Tables`, `WAITER-MVP-Role-Workflow`.
No Postman file was edited (no HTTP contract changed).

### 8. Permission verification
Static audit of `seed.ts` `ROLE_PERM_MATRIX` (Supervisor block, ~lines 1090–1236):
Supervisor holds `pos:orders:read/write/close/void`, `pos:order:split/merge/
move-items` (Prompt 3B1), `pos:table:read/write`, `pos:floor:read`,
`pos:payment:read` — **but did NOT hold `pos:order:transfer`** (deliberately
omitted in 3B1). Confirmed `pos:order:transfer` is a **single backend gate** for
BOTH `POST /pos/orders/:id/transfer-table` (`pos-handoff.controller.ts:157`) and
`.../transfer-server` (`:192`). A live 403 check was not possible (API not
running / no DB in this environment); the gap was confirmed statically.

### 9. Permission changes / stop decision
Per the prompt's Section 7 stop condition, I did **not** silently grant the
permission. I surfaced the decision to the user via AskUserQuestion, explaining
that one permission unlocks both endpoints and that transfer-server has no safe
selector. **The user chose "Grant + enable transfer-table."** I therefore added
`'pos:order:transfer'` to the Supervisor array in `seed.ts` with a comment
documenting the transfer-server API-exposure implication. No new permission was
invented; no schema/migration change. Re-seed (`pnpm db:seed`, idempotent) is
required to apply the grant to the live DB.

### 10. Transfer-table contract (verified, unchanged)
`POST /api/pos/orders/:id/transfer-table` → **HTTP 200**; BG3 `idempotencyMode:
'optional'` (honors `Idempotency-Key`). Body `{ targetTableId: string (required),
reason?: string (≤200) }`. Valid source statuses: NEW/SENT/IN_KITCHEN/READY/SERVED
(CLOSED/VOIDED → 409). Target must be an active table in the same branch+org (else
404). Same-table → 400. **The backend only sets `order.tableId`** — it does NOT
validate target occupancy/reservation/capacity and does NOT change table status or
move any reservation. Response: `{ ok, action, orderId, previousTableId,
newTableId, newTableLabel, reason }`.

### 11. Target-table selector
`SupervisorTableTargetSelector.tsx` — reuses the Supervisor Floor query
(`["supervisor","floor",branchId]` → cache hit, no request storm), derives
candidates via the pure `buildTransferTableTargets` (excludes the current table;
cleaning/blocked tables are already filtered upstream). Bounded to branch Floor
data; searchable by label; shows label, status badge, capacity, and a concise
warning. No cross-branch/historical fetch, no guest PII.

### 12. Reservation/occupancy conflict findings
The backend performs **no** occupancy/reservation/capacity validation on transfer.
The UI therefore surfaces **honest, non-blocking warnings** ("Occupied — …",
"Reserved for 7:30 PM — …") rather than a false guarantee, and does not
frontend-block a transfer the API will accept. This limitation is documented in
`docs/KNOWN_LIMITATIONS.md` and `docs/DECISIONS.md`.

### 13. Transfer-table UI
`SupervisorTransferTableDialog.tsx` reuses the shared `ActionConfirmDialog` (focus/
Escape/pending/error/focus-return): fixed source order + table, target selector,
source→target context line, occupied/reserved warning, optional reason, explicit
confirm, single submission. Surfaced in the workspace "Handoff" group only when
`getSupervisorOrderActionAvailability("transfer-table")` is visible+enabled.

### 14. Idempotency behavior
Uses the Prompt 3A `useIdempotencyIntent` + `buildOperationalIdempotencyKey`
(`operation: "supervisor:transfer-table"`). Key generated on first submit, reused
on retry, reset on target change / success / error — so duplicate clicks reuse one
key and a materially changed target generates a fresh one.

### 15. Transfer submission
Re-validates a distinct non-source target at submit; one request with the
`Idempotency-Key`; immediate pending via mutation state; no manufactured local
success (state changes only on the backend response).

### 16. Canonical cache update
On success, `setQueryData` reassigns the order to the returned table in
`["supervisor","order-detail",…]` and in the Supervisor Floor `activeOrders`
(source card frees, target card fills via the normalizer), then a narrow
invalidate of Supervisor + Waiter Floor. No broad/unrelated invalidation; profile/
menu/auth/shift caches untouched.

### 17. Source and target Floor updates
Because the normalized Floor derives occupancy from each active order's `tableId`,
reassigning that one field moves the order from the source card to the target card
on both Supervisor and Waiter Floor.

### 18. URL and browser-history behavior
Post-transfer the workspace calls `onNavigateToOrder({ orderId, tableId:
newTableId })` → `router.replace` with `{ tableId: newTableId, orderId }` (shallow,
no scroll). Stays in the same order workspace re-anchored to the returned table;
`orderId` preserved; no redirect loop; no extra history entry; refresh restores the
transferred context.

### 19. Find-order contract
`GET /api/pos/orders` supports status, serviceType, tableId, userId, excludeStatus,
page, pageSize — **no order-number search, no date range, no free-text** — and
`GET /pos/orders/:id` is **id-only** (no orderNumber). Documented gap.

### 20. Find-order UI
`SupervisorFindOrderDialog.tsx` — a focused, accessible modal (Escape, focus
return, autofocus search). ONE bounded/paginated branch page (`FIND_PAGE_SIZE =
25`), status filter (Active [excludeStatus CLOSED,VOIDED] / All recent / Ready /
Served / Closed / Voided), service filter, client-side text filter, and an
exact-order-ID fallback (`looksLikeOrderId` → direct `GET /pos/orders/:id`). Rows
show order number, status badge, table label or "Takeaway", server, total, item
count, and updated time. Payment state is intentionally omitted from list rows to
avoid an N-row payment fan-out (performance preservation). Selecting a row opens
the canonical workspace.

### 21. Bounded query behavior
Never fetches full history or cross-branch data; one page per filter; text
matching is local over the bounded page; exact-ID resolution is a single
authoritative detail read. A bounded-note is shown when `total > pageSize`.

### 22. Tableless order workspace
Selecting a takeaway/tableless order navigates with `orderId` only (no `tableId`,
no fabricated table). The existing workspace already renders truthfully with
`table = null` ("Order context", no table card); transfer-table is still offered
(backend allows assigning a tableless order to a table). Back/refresh/history
preserved.

### 23. Terminal (closed/voided) order workspace
Terminal orders load read-only; handoff/service actions resolve to
visible-but-disabled with a concise reason (e.g. "Bill actions are unavailable on a
closed or voided order"), so terminal orders never look actionable. No split/move/
merge/request-bill/mark-served/transfer is enabled; post-close void is NOT added.

### 24. Legacy route behavior (verified complete)
`SupervisorLegacyOrdersRedirect` handles all four paths: `/supervisor/orders`,
`?tableId=`, `?orderId=` (resolves order→table, or tableless if none), and
`?tableId=&orderId=` (no fetch). Redirects into Floor preserving context; not-found
→ Floor workspace surfaces "Order context was not found"; inaccessible → forbidden
copy. No visible Orders nav, no redirect loop, no duplicate order-detail request
(shared query key `["supervisor","order-detail",…]`). Left as-is; verified.

### 25. Transfer-server selector research
Evaluated tenancy memberships (needs admin `tenancy:membership:manage` — Supervisor
lacks it), HR employees (`pos:hr:employees:read` — org-scoped, leaks compensation/
DOB/address/emergency contacts, nullable `userId`), workforce roster
(`pos:workforce:schedules:read` — leaks Employee PII, published-schedule-only),
active shift (caller-only), and table assigned-staff (no such model/endpoint).

### 26. Transfer-server final decision — **Outcome B (deferred)**
No safe branch-scoped server selector exists that a Supervisor can call. The
minimum secure contract would be a new endpoint returning only
`{ userId, name, roleName, active }` from active `Membership` rows in the current
branch, gated by a Supervisor-holdable permission. transfer-server stays UI-hidden
(not in the live-action set) and hard-blocked (`blockedReason`). ⚠️ Because
`pos:order:transfer` gates both endpoints, the transfer-server API is now reachable
for Supervisor (audit-logged, active-same-branch-membership required) even though no
UI exposes it — recorded in DECISIONS/KNOWN_LIMITATIONS.

### 27. Error handling
`transferTableErrorCopy` maps backend failures to operational copy (same-table,
target-not-found/stale, not-open-for-handoff) without raw endpoint noise; the intent
is reset on error so a corrected target yields a fresh key; recoverable form state
is preserved; one toast/one dialog error per failure. Find order handles list error
(retry), empty, and exact-ID 404 truthfully.

### 28. Cache/invalidation
Narrow only: order-detail + Supervisor/Waiter Floor for transfer; a bounded lookup
query for Find order (keyed by filter). No menu/auth/profile/shift/all-reservations/
all-approvals invalidation; direct canonical mutation response used; action settles
without waiting on unrelated invalidations.

### 29. Performance measurements
Static/architectural (no runtime env): target selector and Find order reuse/derive
from already-cached Floor data (selector) or one bounded page (Find), so the
"command open" and "cached selector" paths avoid new round-trips; click-to-pending
is mutation-state driven; no per-row fan-out. Wall-clock numbers require a running
API/DB — **pending** (Neon/local latency to be reported separately when available).

### 30. Responsive findings
Dialogs use `max-w-2xl` + `max-h-[calc(100vh-2rem)]` overflow-y-auto; result/target
lists cap height and scroll; the Find order control is a right-aligned compact
button above the shared Floor. No horizontal overflow introduced; the shared
`OperationalFloor` is unchanged so its four-viewport geometry is unaffected. Visual
four-viewport QA (1024×768/1366×768/1440×900/1920×1080) is **pending** browser
tooling.

### 31. Accessibility
Both new dialogs: `role="dialog"`, `aria-modal`, labelled, Escape-to-close, focus
return; target/results are keyboard-operable buttons with a `radiogroup` (target
selector); status is conveyed by label text + badge, not colour alone; warnings are
text. Find order search/filters are labelled.

### 32. Files created
- `apps/web/src/lib/supervisor/transfer-table.ts` (pure helpers)
- `apps/web/src/components/supervisor/floor/SupervisorTableTargetSelector.tsx`
- `apps/web/src/components/supervisor/floor/SupervisorTransferTableDialog.tsx`
- `apps/web/src/components/supervisor/floor/SupervisorFindOrderDialog.tsx`
- `apps/web/scripts/prompt3b2-assertions.ts`
- `apps/web/scripts/tsconfig.prompt3b2-assertions.json`
- `ai/SUPERVISOR_RECONSTRUCTION_PROMPT3B2_TRANSFER_AND_LOOKUP_COMPLETION_REPORT.md`

### 33. Files modified
- `packages/db/prisma/seed.ts` (authorized Supervisor `pos:order:transfer` grant)
- `apps/web/src/lib/supervisor/orders.ts` (transfer-table API + types)
- `apps/web/src/lib/supervisor/order-actions.ts` (transfer-table → live set)
- `apps/web/src/components/supervisor/floor/SupervisorTableControlWorkspace.tsx`
  (transfer button + dialog + nav; deferred-notice copy)
- `apps/web/src/components/supervisor/floor/SupervisorFloorScreen.tsx`
  (Find order control + dialog + navigation)
- `apps/web/scripts/prompt3b1-assertions.ts` and
  `apps/web/scripts/prompt3a-assertions.ts` (transfer-table left the "stays hidden"
  set in both — now asserted live in 3B2; all six assertion suites pass)
- Docs: `CLAUDE.md`, `PROGRESS.md`, `ai/AI_STATUS.md`, `docs/DECISIONS.md`,
  `docs/ROLE_CAPABILITY_MATRIX.md`, `docs/ROLE_JOURNEYS.md`,
  `docs/KNOWN_LIMITATIONS.md`, `docs/TESTING_AND_QA.md`,
  `ai/SUPERVISOR_RECONSTRUCTION_ROADMAP.md`,
  `ai/SUPERVISOR_RECONSTRUCTION_GAP_REGISTER.md`,
  `ai/SUPERVISOR_MVP_INCLUSION_DEFER_MATRIX.md`,
  `docs/supervisor-ui-docs/SUPERVISOR_API_MATRIX.md`,
  `docs/supervisor-ui-docs/SUPERVISOR_LIFECYCLE.md`,
  `docs/supervisor-ui-docs/README.md`, `repo file tree.txt`.

### 34. Files removed
None.

### 35. Backend changes
None to controllers/services/DTOs/schema/migrations. Only `seed.ts` role mapping
(one authorized permission string).

### 36. Seed / permission changes
`seed.ts` Supervisor role: added `'pos:order:transfer'` (authorized). Idempotent;
requires `pnpm db:seed` to apply. No demo-data change.

### 37. Postman changes
None. Transfer HTTP contract unchanged; `BG4B-Pos-Order-Handoff` already covers
transfer-table (200) + a role 403 negative.

### 38. Tests and assertions
`prompt3b2-assertions.ts` (transfer-table live + permission/status gating +
idempotency metadata; transfer-server stays hidden; target derivation/warnings;
submission validity; error-copy mapping; idempotency lifecycle; structural wiring —
workspace mounts the dialog, Floor mounts Find order, shared `OperationalFloor`
unforked, no Orders nav, bounded Find order, seed grant). `prompt3b1-assertions.ts`
updated and still passes. Backend transfer logic unchanged → existing BG4B Postman
coverage stands; no new Jest spec added (no backend code changed, and the API
suite needs a DB not available here).

### 39. typecheck
`corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` → **pass** (clean).

### 40. lint
`corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` → **pass** (no warnings/errors).

### 41. build
`corepack pnpm@8.15.0 --filter @nimbus-pos/web build` → **pass** (`/supervisor/
floor` 25.5 kB / 148 kB First Load).

### 42. API health
**Pending** — API not listening on `:3001` and no DB available in this environment;
`GET /api/health` could not be run. Not fabricated.

### 43. Supervisor authenticated QA
**Pending** — requires a running API/DB. The transfer/lookup flows are covered
statically by the assertion suite; live endpoint QA (transfer 200 + idempotent
replay + same-table 400 + not-found 404; Find order exact/recent/tableless/closed/
voided/missing; legacy routes) is outstanding.

### 44. Waiter regression
Shared `OperationalFloor` is byte-unchanged (asserted). Waiter has no Find order
control and no Supervisor transfer controls. Static: typecheck/lint/build pass.
Authenticated Waiter regression **pending** browser/API.

### 45. Cashier regression
No Cashier file changed; payment collection remains Cashier-owned. Static gates
pass. Authenticated Cashier regression **pending**.

### 46. Browser and viewport QA
**Pending** — no browser automation available. Per Section 33, reported honestly;
no screenshots fabricated.

### 47. QA-created data
None (no live mutations were executed in this environment).

### 48. Remaining limitations
- transfer-server deferred (no safe selector); its endpoint is API-reachable for
  Supervisor via the shared permission but has no UI.
- transfer-table has no backend occupancy/reservation/capacity guard — UI warns,
  cannot guarantee.
- No server-side order-number/date/free-text search; Find order is a bounded
  recent list + exact-ID fallback.
- Live/browser/viewport QA and `/api/health` outstanding.
- Prompt 3B1 browser QA also still pending.

### 49. Prompt 3B3 prerequisites
A safe branch-scoped server selector endpoint (for transfer-server); verified void
(active + post-close) contracts and a manager-PIN/approval path; discount request/
approve/reject and complimentary contracts; refund execution path. None started.

### 50. Final status
**Prompt 3B2 implementation and technical validation complete; authenticated visual
QA pending.**

### 51. No-commit / no-push confirmation
No `git commit` and no `git push` were performed. The dirty worktree is preserved.
