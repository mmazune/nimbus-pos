# Supervisor Approvals — QA Record Register

> Prompt 5B2 record is at the top, then Prompt 5B1, then the original Prompt 5A record.

---

# Prompt 5B2 — Approvals closure (Anomaly + Shift-swap Outcome C) live QA

Status: mutation QA ran on a **fresh disposable Neon branch**; shared `production` untouched
Date: 2026-07-31

## Isolation environment (Prompt 5B2)

| Field | Value |
| --- | --- |
| Disposable branch | `br-hidden-king-a4rbwvj0` (`prompt5b2-approvals-qa-20260731`), forked from `production` `br-holy-darkness-a4fg93r2` |
| Disposable endpoint | `ep-delicate-leaf-a4dvlw2s` (pooled, `pgbouncer=true`, `connect_timeout=20`) — secret in a git-ignored scratchpad, removed at teardown |
| Fail-closed sentinel | `_p4d_qa_sentinel` marker `P5B2-QA-20260731` = branch id (disposable only) |
| Isolated API | `:4002` via `tools/qa/run-isolated-api.mjs` — preflight PASS (denylist expected `ep-delicate-leaf-a4dvlw2s` / forbidden `ep-empty-paper-a4sogjap`; sentinel; migration; `COMPLETED` enum; demo branch). `/api/health` → `{status:ok, db:ok}`. |
| Isolated web | `next dev -p 3101`, `NEXT_PUBLIC_API_BASE_URL=:4002`, keep-warm pinger |
| Login | `supervisor@nimbus.demo` / Tapas Downtown `cb27be401a2c35dfc0d4e610` |

## Synthetic P5B2-QA records seeded (disposable branch, demo branch cb27…)

| Domain | Rows | ids |
| --- | --- | --- |
| Shift-swap | 14 PENDING | `p5b2qa-swap-01..14` (requester/target round-robin over 3 employees) |
| Anomaly | 8 OPEN + 6 ACKNOWLEDGED | `p5b2qa-anom-open-01..08`, `p5b2qa-anom-ack-01..06` |
| Discount (regression) | 12 PENDING | `p5b2qa-disc-01..12` (on existing unpaid NEW orders) |
| Leave (regression) | 10 PENDING | `p5b2qa-lv-01..10` |

## Live API matrix (curl, disposable branch) → **11/11**

- **Shift-swap:** list PENDING 200 · reject `swap-01` → **200** REJECTED · duplicate reject → **400** · `take=101` → **400** (bound).
- **Anomaly:** list OPEN 200 · acknowledge `open-01` → **200** · resolve-without-note → **400** · resolve (ACK→RESOLVED) → **200** · duplicate resolve → **400** · resolve-from-OPEN (`open-02`) → **400** · duplicate acknowledge (`ack-01`) → **400**.
- **Roster integrity:** after reject, `schedule_assignments` rows touched in the last 10 min = **0** (and no roster-write path exists) → Outcome C is truthful.

## Browser suite — `apps/web/e2e/supervisor-approvals/` (15 files, 4 viewports) → **all pass**

Executed against the isolated stack. **120 unique tests across all four viewport projects
(1024×768 / 1366×768 / 1440×900 / 1920×1080) all pass; 2 flaky (recovered on retry), 0 real
failures; exit 0 (1.7h)** with `--retries=2`. The 2 flaky were transient compute stalls on the
scale-to-zero disposable branch (a cold-start on the first test, and a one-off pooler stall on a
leave-reject) — both passed on retry #1; neither is a UI defect. Coverage exercised live:
- **Anomaly** acknowledge (stays actionable) → resolve (note required) full lifecycle; truthful
  "evidence preserved / underlying record not changed" copy; acknowledge "stays actionable" copy.
- **Shift-swap** detail shows **no Approve control** + truthful "reassignment not supported" notice;
  Reject records the decision with "no schedule changed" copy.
- Consolidated four-domain filters; Resolved omits discounts; cross-role (Cashier/Waiter no Approvals);
  responsive-closure (shift-swap + anomaly detail + dialogs, no overflow) at all four viewports.
- Full Prompt 5B1 regression (discount approve/reject/self-approval, leave approve/reject,
  identity/privacy, filters/routing, resolved/history, Prompt 3/4 regression).

Anomaly specs deep-link to a seeded id by status (`apiFirstAnomalyId` + `openApprovalDetail`) to avoid
severity-sort queue-order fragility. Evidence (git-ignored): `apps/web/playwright-report/` +
per-flaky traces under `apps/web/e2e/.evidence/`.

## Shared-Neon protection — verified untouched

Post-QA read-only recheck of `production` matches baseline exactly: **58 migrations / 836
role_permissions / 126 reservations / 1223 orders / 750 payments / 19 users**; domain totals unchanged
(discounts 6, leave 15, swap 12, anomaly 21); **0 P5B2-QA rows; `_p4d_qa_sentinel` absent**. No shared
write. **Disposable branch `br-hidden-king-a4rbwvj0` deleted**; Prompt 4C recovery branch retained;
ports free; secret removed.

---

# Prompt 5B1 — Approvals UI (Discount + Leave) live QA

Status: mutation QA ran on a **fresh disposable Neon branch**; shared `production` untouched
Date: 2026-07-30

> No synthetic private contact details are recorded here. Employee/user identities are
> referenced by redacted id only.

## Isolation environment (Prompt 5B1)

| Field | Value |
| --- | --- |
| Disposable branch | `br-aged-resonance-a47lmtt5` (`prompt5b1-approvals-ui-qa-20260730`), forked from `production` `br-holy-darkness-a4fg93r2` |
| Auto-expiry | 2026-07-31T23:00:00Z (also deleted explicitly at teardown) |
| Disposable endpoint | `ep-tiny-king-a44a10es` (pooled, `pgbouncer=true`) — connection string held only in a git-ignored scratchpad secret, removed at teardown. The immediate scale-to-zero compute cold-starts between idle gaps; the pooled endpoint + `connect_timeout=20` rides through cold starts (the direct endpoint returned intermittent "can't reach"). |
| Fail-closed sentinel | table `_p4d_qa_sentinel`, marker `P5B1-QA-20260730`, branch_id `br-aged-resonance-a47lmtt5` (exists ONLY on the disposable branch — 0 rows on production) |
| Isolated API | `node apps/api/dist/main.js` on :4002 via `tools/qa/run-isolated-api.mjs`. Preflight passed: denylist (expected `ep-tiny-king-a44a10es`, forbidden `ep-empty-paper-a4sogjap`), prisma connected, sentinel present, migration + `COMPLETED` enum + demo branch row. `/api/health` → `{status:ok, db:ok}`. |
| Isolated web | `next dev -p 3101`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:4002` (API CORS allowed `http://localhost:3101`) |
| Supervisor login | `supervisor@nimbus.demo` (Tapas Downtown branch `cb27be401a2c35dfc0d4e610`, org `cmqlcjksw00ukwp6lmdl1y0i5`) |

## Synthetic P5B1-QA records seeded on the disposable branch

Leave rows (branch `cb27…`, requested_by supervisor `ca2e4e5cf3c6c2154968387c`, reason prefixed `P5B1-QA`):

| id | status | purpose |
| --- | --- | --- |
| `p5b1qa-leave-approve` | PENDING | approvable target |
| `p5b1qa-leave-reject` | PENDING | rejectable target |
| `p5b1qa-leave-approved` | APPROVED | terminal read-only |
| `p5b1qa-leave-rejected` | REJECTED | terminal read-only |

Discounts: created live during the browser run via `apiCreatePendingDiscount()` on fresh, unpaid
orders (subtotal forced > org threshold → PENDING), requested by the Supervisor so the
self-approval notice shows. Shift-swap (2 PENDING) + anomaly (2 OPEN) rows inherited from the
production fork are exercised **read-only** (no 5B1 decision controls).

## Browser suite — `apps/web/e2e/supervisor-approvals/` (10 files, 4 viewports) → **80/80 PASS**

Executed against the isolated stack (web :3101 → API :4002 → disposable branch). **80 passed / 0
failed (43.2m)**, all four viewport projects (1024×768, 1366×768, 1440×900, 1920×1080), Chromium via
Playwright. Run with `--retries=2` to absorb transient first-hit login latency on the scale-to-zero
compute — **no test failed on its final attempt**. Coverage exercised live:
- **Discount** approve (toast + APPROVED, order total recalculated) + reject (required reason, totals unchanged) + **self-approval notice** ("You requested this discount"); payment-safety gate on unpaid orders allowed approve.
- **Leave** approve + reject (toast; row leaves Needs action; truthful "does not change payroll/roster" copy).
- **Shift-swap + Anomaly** render read-only (no decision controls) — 5B1 boundary held.
- Needs action / Resolved / History scopes; All + per-domain filters; **Discounts omitted from Resolved/History** + truthful order-scoped notice when forced; History date toolbar → URL params; refresh persists scope+domain.
- Identity/privacy: no raw-UUID row titles, no email/PII in rows.
- Responsive: no horizontal overflow (queue + open detail) at all four viewports.
- Regression: Prompt 3 Floor + Prompt 4 Reservations still load; Waiter has no Approvals; no Orders tab.

Two early single-viewport failures were diagnosed and resolved before the final run: (a) a **test bug**
— the "survive refresh" spec asserted `goBack()` restores a filter state, but filter changes use
`router.replace` (no history entries, matching Reservations), so Back returns to the prior page;
fixed the assertion. (b) The discount fixture's API order-creation hit the pre-existing
`generateOrderNumber` collision (SUP-RG-040) → QA discounts seeded via SQL instead. Neither was an
Approvals-UI defect.

## Shared-Neon protection — verified untouched

Post-QA read-only recheck of `production` `br-holy-darkness-a4fg93r2` matches the pre-QA baseline
exactly: **58 migrations / 836 role_permissions / 126 reservations / 1223 orders / 750 payments /
19 users**; pending counts identical (discounts 6/2, leave 15/9, swap 8, anomaly OPEN 7); **0
P5B1-QA rows**; `_p4d_qa_sentinel` **absent** on production. No write of any kind reached shared Neon.

## Teardown (Prompt 5B1)

Isolated API (:4002) + web (:3101) + keep-warm pinger stopped; both ports free (down); no orphan
process. Git-ignored secret env removed. **Disposable branch `br-aged-resonance-a47lmtt5` deleted.**
Prompt 4C recovery branch `br-dawn-truth-a4zjs1p7` retained (untouched). The Prompt 5A disposable
branch was left to its own auto-expiry (no fresh authorization to delete it explicitly).

<!-- P5B1-SHARED-RECHECK-DONE -->

---

# Supervisor Approvals — QA Record Register (Prompt 5A)

Status: COMPLETE — all mutation QA ran on a **disposable Neon branch**; shared `production` untouched
Date: 2026-07-30

> No synthetic private contact details are recorded here. Employee/user identities are
> referenced by redacted id only.

## Isolation environment

| Field | Value |
| --- | --- |
| Disposable branch | `br-polished-river-a4ep8bn0` (`prompt5a-approvals-qa-20260730`), forked from `production` `br-holy-darkness-a4fg93r2` |
| Auto-expiry | 2026-07-31T18:00:00Z (Neon auto-deletes; may also be deleted explicitly) |
| Disposable endpoint | `ep-little-bread-a4tsyemf` (pooled) — connection string held only in a git-ignored scratchpad secret, now removed |
| Fail-closed sentinel | table `_p4d_qa_sentinel`, marker `P5A-QA-20260730`, branch_id `br-polished-river-a4ep8bn0` (exists ONLY on the disposable branch — verified 0 rows on production) |
| Isolated API | `node apps/api/dist/main.js` on :4002 via `tools/qa/run-isolated-api.mjs` (denylist → DB-identity preflight → spawn). Preflight passed: denylist OK, prisma connected, sentinel present, migration + `COMPLETED` enum + demo branch row verified. `/api/health` → `{status:ok, db:ok}`. |
| Isolated web | `next dev -p 3101`, `NEXT_PUBLIC_API_BASE_URL=http://localhost:4002` (API CORS allowed `http://localhost:3101`) |
| Supervisor login | `supervisor@nimbus.demo` (Tapas Downtown branch `cb27be401a2c35dfc0d4e610`) |

## Records mutated on the disposable branch (marked P5A-QA)

| Domain | Record id (disposable) | Transition driven | Marker field |
| --- | --- | --- | --- |
| Leave | `cmr91u87b0007yp5epz94ujza` | PENDING → APPROVED | reviewNotes `P5A-QA approve` |
| Shift swap | `c6fee1513a6c68e3d1c79050` | PENDING → REJECTED | reviewNotes `P5A-QA reject` |
| Anomaly | `c0c27327d8a551718207bdc8` | OPEN → ACKNOWLEDGED → RESOLVED | resolutionNotes `P5A-QA resolve` |
| Discount | `cms7sb53g000f6f21xqmjj3be` | created (request) → APPROVED (on order `c50b33bd8ba5bff778239777`) | reason `P5A-QA discount request` |

Cross-branch (same-org, other-branch) records used **read-only** to prove branch isolation
(the decision was rejected with 404, so these were NOT mutated):
- shift swap `c0bacf9b9058ca38510d58ea` (branch `c1447054fb9697e3c795cd8c`)
- anomaly `cmqlcpha0019lwp6l7ob8x9gd` (branch `cmqlcjlo700umwp6lodyywf56`)

## Live API mutation matrix — `tools/qa/approvals-live-matrix.mjs` → **29/29 PASS**

| Group | Cases (all passed) |
| --- | --- |
| Auth | supervisor login → **201** + token; `/auth/me` branch context → 200 |
| Leave | pending list 200 (+identity: employee "Peter Mugisha", requester present); `take=101` → **400**; `take=abc` → **400**; History date window → 200; review PENDING→APPROVED → 200; duplicate review → **400** |
| Shift swap | pending list 200 (+requester/target identity); `take=101` → **400**; approve PENDING→REJECTED → 200; duplicate → **400**; **branch isolation** other-branch approve → **404** |
| Anomaly | OPEN list 200 (+`actorUser` projection present); `limit=101` → **400**; History window → 200; resolve-while-OPEN → **400**; acknowledge OPEN→ACKNOWLEDGED → 200; resolve-without-notes → **400**; resolve ACK→RESOLVED → 200; duplicate ack → **400**; **branch isolation** other-branch ack → **404** |
| Discount | pending (branch-scoped) 200; request on discountable order → **201** (PENDING); approve → 200 APPROVED; duplicate approve → **409** (concurrency guard) |

Result JSON: `approvals-matrix.json` (git-ignored scratchpad). Every branch-isolation and
duplicate/concurrency case confirms the Prompt 5A hardening at runtime — the two 404s are
records the pre-fix org-only lookup would have mutated cross-branch; the 409 is the new
atomic conditional claim.

## Browser smoke — `apps/web/e2e/supervisor-approvals/smoke.spec.ts` → **8/8 PASS** (4 viewports × 2 specs)

Viewports 1024×768, 1366×768, 1440×900, 1920×1080:
- Approvals route loads + renders with the hardened response types; four-tab nav intact (**no Orders tab**); no raw-undefined identity; no horizontal overflow; **no console errors**.
- Regression: Prompt 3 Floor + Prompt 4 Reservations still load.

## Shared-Neon protection — verified untouched

Post-QA read-only recheck of `production` `br-holy-darkness-a4fg93r2` matches the pre-QA baseline
exactly: **58 migrations / 0 rolled back / 836 role_permissions / 126 reservations**; approval
pending counts unchanged (leave 9 / swap 8 / anomaly OPEN 7 / discounts 6); `_p4d_qa_sentinel`
**absent on production** (0). No write of any kind reached shared Neon.

## Teardown

- Isolated API (:4002) and web (:3101) stopped; both ports free; no orphan node process.
- Git-ignored secret env file removed from the scratchpad.
- Prompt 4C recovery branch `br-dawn-truth-a4zjs1p7` retained (not touched).
- Disposable branch `br-polished-river-a4ep8bn0` set to auto-expire 2026-07-31T18:00Z (and may be deleted explicitly on request).
