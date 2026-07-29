# Supervisor Reconstruction — Prompt 3B1 Completion Report

**Split Bill, Split Items, Move Items, and Merge Orders**

- **Author:** Claude (Opus 4.8, 1M context) via Claude Code — requested model Opus
  4.8 at highest reasoning effort (model/effort are user-controlled; ran on Opus 4.8).
- **Date:** 2026-07-27
- **Scope:** Prompt 3B1 only. **Prompt 3B2 and 3B3 NOT started.**
- **Commit/push:** ⛔ None. Dirty worktree preserved.
- **Browser/viewport QA:** not run (no browser automation in this environment) —
  reported honestly as "implementation and technical validation complete;
  authenticated visual QA pending."

---

## 1. Repository path
`C:\Users\arman\Desktop\nimbus-pos` (canonical). Stale `NIMBUS\nimbus-pos` untouched.

## 2. Initial branch & git status
Branch `main`, HEAD `174a787`. At start: 100 modified, 12 deleted, 88 untracked
(prior onboarding + 3A work). No node processes; ports 3000/3001 free.

## 3. Pre-existing deletions
The 12 deletions are the Prompt 2 role-specific Floor components (verified intact,
not caused here). No deleted Floor presentation component returned.

## 4. Documents read
Root `CLAUDE.md`, `PROGRESS.md`, `ARCHITECTURE.md`, all `docs/*` canonical docs,
`ai/AI_STATUS.md`, the onboarding report, and the Supervisor reconstruction set
(repo verification, roadmap, gap register, defer matrix, Prompt 1/2/3A reports),
`docs/supervisor-ui-docs/*`.

## 5. Frontend files inspected
`SupervisorTableControlWorkspace`, `SupervisorFloorScreen`, `lib/supervisor/{orders,
floor,floor-model}.ts`, `order-actions.ts` (3A), `pos-shell/ActionConfirmDialog`,
`lib/pos-shell/idempotency`, `lib/cashier/idempotency`, `components/ui/*`, `ToastProvider`,
`lib/api/client`, the assertion scripts.

## 6. Backend files inspected
`pos-handoff.controller.ts` + `pos-handoff.service.ts` (splitBill/splitItems/moveItems/
mergeOrders, `HANDOFF_OPEN_STATUSES`, `SPLIT_BILL_OPEN_STATUSES`, `MERGE_SOURCE_HAS_PAYMENTS`,
allocation/rounding), the four DTOs, `permissions.decorator` + `permission.guard` +
`branch-context.guard`, `bg3-reliability.service` (Idempotency-Key handling), and
`seed.ts` role→permission mappings.

## 7. Postman collections inspected
`BG4B-Pos-Order-Handoff` (split-bill/split-items/merge/transfer/move-items),
`M10-POS-Orders`, `M12`/`M14`. Bodies/headers cross-checked against the DTOs. Postman
left **unchanged** (HTTP contracts unchanged).

## 8. Contract verification (source-authoritative)

| Action | Method + path | Perm | Body | Source statuses | Payment rule | Idem-Key | Response |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Split bill | POST `/api/pos/orders/:id/split-bill` | `pos:order:split` | `{mode:EQUAL\|CUSTOM, count?(2..20), groups?[{label?,amount}], reason?}` | NEW/SENT/IN_KITCHEN/READY/SERVED | none (non-physical) | honored | `{splitGroups[], amountAllocated, amountRemaining, totals, note}` |
| Split items | POST `/api/pos/orders/:id/split-items` | `pos:order:split` | `{items[{orderItemId,quantity≥1}], targetTableId?, reason?, notes?}` | open | none | honored | `{sourceOrder, childOrder(NEW,+items), movedItems[]}` |
| Move items | POST `/api/pos/orders/:id/move-items` | `pos:order:move-items` | `{targetOrderId, items[{orderItemId,quantity≥1}], reason?}` | both open | none | honored | `{sourceOrder(+items), targetOrder(+items), movedItems[]}` |
| Merge | POST `/api/pos/orders/merge` | `pos:order:merge` | `{sourceOrderId, targetOrderId, reason?}` | both open | source must have no COMPLETED/PENDING payments (409 `MERGE_SOURCE_HAS_PAYMENTS`) | honored | `{sourceOrder(VOIDED, mergedIntoOrderId), targetOrder(+items), moved{}}` |

Key facts: split-bill EQUAL floors each group and puts the residual on the LAST group
(sum == total exactly); CUSTOM group amounts must sum to total (else 400
`SPLIT_BILL_AMOUNT_MISMATCH`). All four are BG3-wrapped `idempotencyMode:'optional'`
(honor `Idempotency-Key` when present, never required). Source==target → 400. Move-item
quantity > available → 400 `MOVE_QUANTITY_EXCEEDS_SOURCE`. **Runtime + Postman + DTOs
agreed — no contract correction was required.**

**Permission gap found & resolved:** the Supervisor role did **not** have
`pos:order:split`/`merge`/`move-items` (verified live: 403 on all three). This blocks
the entire prompt. Per the user's explicit authorization (overriding §7's
no-permission-change rule), the Supervisor role was mapped to the already-defined
permission rows (see §34).

## 9. Action-availability changes
`lib/supervisor/order-actions.ts`: added split-bill/split-items/move-items/merge to
`SUPERVISOR_LIVE_ORDER_ACTIONS`; extended `SupervisorOrderActionContext` with
`lineCount` and `total`; added `requiresLines` (split-items/move-items) and
`requiresPositiveTotal` (split-bill) gating with concise reasons; merge set
`requiresReason:true`. transfer-table/transfer-server/void/discount/complimentary stay
hidden (3B2/3B3). Still the single source of truth — no per-button conditions.

## 10. Action-panel changes
The workspace "Order actions" card now has two labeled sub-groups: **Service**
(Request bill, Mark served) and **Split & combine** (Split bill, Split items, Move
items, Merge). Only visible/permitted actions render; disabled actions show a concise
operational reason. Buttons open dialogs via a single `activeAction` state. No
oversized permanent grid; no 3B2/3B3 actions exposed. The deferred-capability notice
now lists only transfer/void/discount/complimentary/refund/payment/close.

## 11. Order-target selector
`SupervisorOrderTargetSelector.tsx`: bounded, branch-scoped, `fetchSupervisorOrders`
with `excludeStatus:["CLOSED","VOIDED"]` + `pageSize:25`; excludes the source order;
client search over order number/table/server/service type; minimal operational display
(number, table, status, server, total, item count); empty/loading/error states; a
"refine your search" note when more than the page exists. Never a full-history fetch.

## 12. Line-selector foundation
`SupervisorLineSelector.tsx`: per-line quantity control (0..ordered), item name +
serving + ordered qty + line total, ineligible-line note, labeled numeric inputs
(keyboard accessible), 1024px-safe (stacks). Shared by Split items and Move items.
Not related to Waiter menu-entry components.

## 13. Split-bill contract truth
Confirmed **non-physical** — records `metadata.splitBill` allocation groups for the
cashier; order/items/taxes/KDS untouched; no payment collected. UI copy states this
explicitly ("payable allocation groups for the cashier … no payment is collected").

## 14. Split-bill implementation
`SupervisorSplitBillDialog.tsx`: EQUAL (count 2–20 with a live preview computed in
integer cents mirroring the backend) or CUSTOM (amount rows, add/remove, running
"Allocated X / Total Y"). Reason optional. Confirm disabled until valid. Idempotency-
Key attached; intent reset on any material change. On success invalidates only the
canonical order-detail (metadata changed); toast; closes.

## 15. Split-bill validation
`order-action-forms.ts`: `validateEqualCount` (integer 2..20), `computeEqualSplitPreview`
(floor per group, last absorbs residual, sums exactly), `validateCustomSplit` (≥2
groups, each >0, sum == total to the cent), `parseCustomAmountCents` (`/^\d+(\.\d{1,2})?$/`).
Assertion-tested.

## 16. Split-items contract truth
Confirmed via DTO + service: item-id + quantity (1..ordered), optional `targetTableId`,
optional reason/notes; child order created NEW with `splitFromOrderId`, `orderNumber`
`PARENT-S1`; child must be re-sent to KDS.

## 17. Split-items implementation
`SupervisorSplitItemsDialog.tsx`: line selector + optional target-table select
(populated from `fetchSupervisorTables`, AVAILABLE only, plus "Keep unassigned") +
optional notes/reason. Validates via `validateLineSelections`. Idempotency-Key attached.

## 18. Child-order result
On success invalidates source order-detail + supervisor floor + waiter floor; the
success toast names the returned child order number and states it is NEW (re-send to
KDS if needed). No auto-navigation; the child appears on Floor.

## 19. Move-items contract truth
Confirmed: `targetOrderId` + items[{orderItemId,quantity}]; both orders must be open;
quantity ≤ available; source==target → 400; no payment/bill restriction; response
returns refreshed source + target with items.

## 20. Move-items implementation
`SupervisorMoveItemsDialog.tsx`: order-target selector + line selector + optional
reason. Confirm disabled until a distinct target and a valid line selection. On success
invalidates source + target order-detail + both floors. Source may become empty; its
canonical returned state is shown (no invented void/close). No auto-navigation.

## 21. Merge contract truth
Confirmed: `{sourceOrderId, targetOrderId, reason?}`; both open; source blocked if it
has COMPLETED/PENDING payments (409); source → VOIDED with `mergedIntoOrderId=target`;
target survives with the moved items.

## 22. Merge implementation
`SupervisorMergeOrderDialog.tsx`: order-target selector + **required** reason;
`tone:"danger"`; strong copy ("… will be VOIDED and all its items moved into … This
cannot be undone"); confirm label "Merge and void source". Clearly identifies source
(voided) and surviving target by order number + table (never UUID). Maps
`MERGE_SOURCE_HAS_PAYMENTS` to a concise message. On success invalidates source +
target + both floors, then navigates the workspace to the surviving target via
`onNavigateToOrder`.

## 23. Confirmation behaviour
All four dialogs reuse the extended shared `ActionConfirmDialog` (composable
`children` body slot, `confirmDisabled` override, `size` md/lg) — inheriting focus
management, Escape-to-cancel (blocked while pending), backdrop cancel, focus return,
`role="dialog"`/`aria-modal`/labelled+described, inline `role="alert"` errors, and
required-field validation. No `window.confirm`.

## 24. Idempotency behaviour
These endpoints ARE BG3-wrapped, so each dialog uses `useIdempotencyIntent` +
`buildOperationalIdempotencyKey`: the key is generated on first submit, reused on
retry, and reset on any material change (mode/count/amounts/target/lines). Verified
live: split-bill and split-items replays with the same key returned the same result /
same child order.

## 25. Canonical cache handling
Mutations update the canonical `["supervisor","order-detail",branchId,orderId]` entry
(and target/child where relevant) and the `["supervisor","floor",branchId]` summary;
merge navigates selection to the surviving order. No separate authoritative order
copies are kept.

## 26. Targeted invalidation
Only the affected resources are invalidated: source order-detail, target/child
order-detail, supervisor floor, waiter floor. Never menu, auth, Me/profile, active
shift, reservations, all approval domains, or every Supervisor query. Settlement does
not await unrelated invalidations.

## 27. Performance measurements
Action buttons open dialogs synchronously (no fetch). The target selector fetches one
bounded page (≤25). Live API mutations returned promptly against Neon during QA;
`/api/health` sub-second. No permanent pending state; duplicate writes prevented by
mutation-pending + idempotency. Detailed browser timings pending browser QA. Residual
Neon/local latency remains external.

## 28. Responsive findings
Dialogs use `size="lg"` for list-bearing flows with `max-h-[calc(100vh-2rem)]` +
`overflow-y-auto`; the line selector and target list stack at 1024px; number inputs
and selects are full-height touch targets. Verified structurally + via build. Live
viewport QA pending.

## 29. Accessibility findings
Dialog focus/Escape/return + labelled/described (shared component); target selector is
a `radiogroup` with `role="radio"` rows; line inputs have accessible labels;
required-reason marked and validated; destructive merge uses danger tone + explicit
confirm; status conveyed by text + tone. Announcement/reduced-motion inherited from
the shared dialog. Full AT sweep pending browser QA.

## 30. Files created
- `apps/web/src/lib/supervisor/order-action-forms.ts`
- `apps/web/src/components/supervisor/floor/SupervisorLineSelector.tsx`
- `apps/web/src/components/supervisor/floor/SupervisorOrderTargetSelector.tsx`
- `apps/web/src/components/supervisor/floor/SupervisorSplitBillDialog.tsx`
- `apps/web/src/components/supervisor/floor/SupervisorSplitItemsDialog.tsx`
- `apps/web/src/components/supervisor/floor/SupervisorMoveItemsDialog.tsx`
- `apps/web/src/components/supervisor/floor/SupervisorMergeOrderDialog.tsx`
- `apps/web/scripts/prompt3b1-assertions.ts` + `apps/web/scripts/tsconfig.prompt3b1-assertions.json`
- `ai/SUPERVISOR_RECONSTRUCTION_PROMPT3B1_SPLIT_MOVE_MERGE_COMPLETION_REPORT.md`

## 31. Files modified (code)
- `packages/db/prisma/seed.ts` (RBAC: Supervisor → `pos:order:split`/`merge`/`move-items`)
- `apps/web/src/lib/supervisor/orders.ts` (four mutation fetchers + types)
- `apps/web/src/lib/supervisor/order-actions.ts` (live set + line/total gating)
- `apps/web/src/components/pos-shell/ActionConfirmDialog.tsx` (`children`/`confirmDisabled`/`size`)
- `apps/web/src/components/supervisor/floor/SupervisorTableControlWorkspace.tsx` (panel + dialog mounts + `permissions`/`onNavigateToOrder`)
- `apps/web/src/components/supervisor/floor/SupervisorFloorScreen.tsx` (`permissions`, `onNavigateToOrder`)
- `apps/web/scripts/prompt3a-assertions.ts` (updated stale live-set/hidden checks for the new live actions)

## 32. Files removed
None.

## 33. Docs modified
`CLAUDE.md`, `PROGRESS.md`, `ARCHITECTURE.md`,
`docs/{ROLE_CAPABILITY_MATRIX,ROLE_JOURNEYS,DECISIONS,KNOWN_LIMITATIONS,TESTING_AND_QA}.md`,
`docs/supervisor-ui-docs/{SUPERVISOR_API_MATRIX,SUPERVISOR_LIFECYCLE,README}.md`,
`ai/{AI_STATUS,SUPERVISOR_RECONSTRUCTION_ROADMAP,SUPERVISOR_RECONSTRUCTION_GAP_REGISTER,SUPERVISOR_MVP_INCLUSION_DEFER_MATRIX}.md`.

## 34. Backend changes
**One, user-authorized:** `packages/db/prisma/seed.ts` maps the Supervisor role to the
existing `pos:order:split`, `pos:order:merge`, `pos:order:move-items` permission rows.
No Prisma schema, migration, or new permission definition; no auth-semantics change.
Re-seeded idempotently (`corepack pnpm@8.15.0 db:seed`) — log shows exactly three new
`RolePermission "Supervisor" → …` rows added; verified live (`/auth/me` now lists the
perms; endpoints return 400 validation instead of 403). `pos:order:transfer` was NOT
granted (transfer stays deferred).

## 35. Postman changes
**None.** No HTTP contract changed (only a role→permission mapping). All 56 collection
JSON files remain valid.

## 36. Assertions and tests
New `prompt3b1-assertions.ts` (all pass): live-set includes the four actions while
3B2/3B3 stay hidden; permission/status/line/total gating; idempotency-requirement
metadata + intent reuse/renewal; EQUAL allocation (floor + residual-on-last, sums to
total) and clean split; CUSTOM sum-must-equal + rejections; line-selection validation
(bounds, dedupe, unknown, empty) + body builders; structural wiring (dialogs mounted,
central availability used, payment read-only, deferred notice trimmed, target selector
excludes source + CLOSED/VOIDED + paginated, merge maps the payments-block error, no
Orders nav). `prompt3a-assertions.ts` updated for the new live set and re-passed.
`floor`/`shell`/`profile` assertions still pass (no regression).

## 37–39. Typecheck / Lint / Build
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` → **pass**.
- `… lint` → **pass** (no warnings/errors).
- `… build` → **pass**.
- `corepack pnpm@8.15.0 --version` → `8.15.0`.

## 40. API health
`GET /api/health` → `{status:"ok", db:"ok"}` HTTP 200.

## 41. Authenticated Supervisor QA (live endpoints)
`supervisor@nimbus.demo` (now holds the three handoff perms):
- **Split bill** EQUAL count=3 on a 67,000 order → 200, 3 groups, allocated `67000.00`,
  remaining `0.00`; same-key replay → 200; CUSTOM groups not summing → 400
  `SPLIT_BILL_AMOUNT_MISMATCH`.
- **Split items** → 200, child `ORD-000012-S1` status NEW, moved 1; same-key replay →
  **same child id**.
- **Move items** → 200 (source items 1→0, target 0→1); same source/target → 400.
- **Merge** → 200 (source `VOIDED`, `mergedIntoOrderId` = target, moved 1); self-merge
  → 400.

## 42. Waiter regression
Login 201 + `/auth/me` 200. No Waiter code changed except the shared `ActionConfirmDialog`
(additive/optional props) and the shared availability module (Waiter does not consume
the Supervisor order actions). Floor/shell/profile assertions pass.

## 43. Cashier regression
Login 201 + `/auth/me` 200. Payment/till ownership untouched. No Supervisor split/merge/
move controls exist for Cashier.

## 44. Viewport/browser QA
**Not executed** (no browser automation in this environment). Reported honestly.
Recommend running the documented 1024/1366/1440/1920 matrix (and AT sweep) before demo.

## 45. QA-created data
- Split-bill allocation metadata on order `cmrpyvluf006x6fm9qkt8ychn`.
- Child split order `cms2qfbh1000kttv6ffmeem4h` (`ORD-000012-S1`, NEW) from
  `cmrpyb6p4004p6fm9ldc9z47v`.
- One line moved from `cmrpy433h003h6fm9i1fbujx8` → `cmrpyp67m00696fm9w4z7wrq0`.
- Merge: `cmrpxzumg00296fm9fqpq643y` VOIDED into surviving `cmrpyoi50005z6fm9hq5rqylp`.
All via documented API paths; no seed/demo-import change; no records silently deleted
(merge/void are audited state transitions).

## 46. Remaining limitations
- Browser/viewport + AT QA pending (no automation here).
- transfer-server blocked (no safe narrow server selector).
- Split bill acknowledgment reflects backend allocation (non-physical); no payment is
  collected.
- Reservation-completion contract still missing (SUP-RG-008/009).

## 47. Prompt 3B2 prerequisites
Reuse the availability module + shared dialog + idempotency-intent for: transfer-table
(target-table selector — buildable from `fetchSupervisorTables`), active-order void
(`pos:orders:void`, reason required post-kitchen), discount request/approve/reject
(`pos:discount:*`). transfer-server needs a purpose-built safe server selector first.

## 48. Prompt 3B3 prerequisites
Post-close void (`pos:void:postclose`, requires reason + manager PIN + a candidate
queue) and refunds (`pos:refund:*`, needs a pending-refund queue). Both need
candidate-list read endpoints that do not yet exist for Supervisor.

## 49. Final status
**Prompt 3B1 COMPLETE (implementation + technical validation); authenticated visual QA
pending.** Split bill, Split items, Move items, and Merge are live inside the Floor
workspace, permission-gated, confirmed, idempotent, and cache-correct; payment stays
read-only; no Orders nav; shared Floor parity intact; Waiter/Cashier unaffected.
**Prompt 3B2 and 3B3 NOT started.**

## 50. No commit / no push
⛔ No `git commit` or `git push`. Worktree preserved; no reset/restore/stash/clean.
The seed edit + re-seed were the only authorized, deliberate state changes.
