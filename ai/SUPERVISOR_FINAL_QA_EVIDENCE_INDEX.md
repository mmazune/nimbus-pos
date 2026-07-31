# Supervisor Final QA Evidence Index

Date: 2026-07-31 · Companion to `ai/SUPERVISOR_RECONSTRUCTION_FINAL_COMPLETION_REPORT.md`

> Enumerates every executable check run in the final closure pass, its exact command/scope, and
> its result. "Executed" means the command actually ran to completion in this environment — see
> `ai/AI_ERROR_PROTOCOL.md`'s evidence-bundle requirement. Nothing here is fabricated or
> compiled-only unless explicitly labeled.

## 1. Static gates

| Check | Command | Result |
| --- | --- | --- |
| pnpm version | `corepack pnpm@8.15.0 --version` | `8.15.0` |
| Web typecheck | `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck` | pass, 0 errors (run twice: before and after e2e/config fixes) |
| Web lint | `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint` | pass, 0 warnings (run twice) |
| Web build | `corepack pnpm@8.15.0 --filter @nimbus-pos/web build` | pass — `/supervisor/floor` 26.3 kB, `/supervisor/approvals` 16.8 kB, `/supervisor/reservations` 21.4 kB, `/supervisor/me` 7.59 kB (run twice: default target and again with `NEXT_PUBLIC_API_BASE_URL` pointed at the isolated API) |
| API build | `corepack pnpm@8.15.0 --filter @nimbus-pos/api build` (`nest build`) | pass |
| Postman JSON | custom Node script parsing all 56 files in `postman/collections/` (BOM-stripped) | **56/56 parse**; 3 carry a legacy UTF-8 BOM (tolerated) |
| `git diff --check` | `git diff --check` | clean (only CRLF-normalization notices) |

## 2. API Jest (batched `--maxWorkers=2` to avoid a full-parallel OOM on this Windows host)

| Batch (spec files) | Suites | Tests | Result |
| --- | --- | --- | --- |
| `reservations, orders, discounts (+dto), attendance (+2 dto), analytics (+dto), auth/me-membership-context` | 10 | 198 | 198/198 pass |
| `auth, quick-pin, settings, floor, menu, recipes, kds, inventory, shifts, tills, hr, workforce` | 12 | 227 | 227/227 pass |
| `payments, refunds, payroll, accounting, ledger, accounts-payable, bank-rec, budget, forecast, demand-calendar, accounts-receivable` | 11 | 255 executed | 10/11 suites pass, 255/255 executed tests pass; `accounts-receivable.service.spec.ts` fails to **compile** (pre-existing, confirmed via `git log`/`git diff` unrelated to this session) |
| `franchise, franchise-analytics, ops-portal, public-commerce-payments, merchant-payments, tenancy, billing, client-onboarding, public-commerce (+m393)` | 10 | 166 | 9/10 suites pass; `client-onboarding.service.spec.ts` 4/166 fail (pre-existing, confirmed via `git log`/`git diff` unrelated) |
| `alerts, owner-live, digest, dashboards, documents, events, feedback, reports, staff-insights` | 9 | 160 | 160/160 pass |
| `billing-pesapal` (isolated — OOM'd inside the full parallel run) | 1 | 18 | 18/18 pass |
| **Total** | **53** | **1024 executed** | **1020 passed / 4 failed (both pre-existing, out of Supervisor scope)** |

## 3. Live API mutation matrices (disposable Neon branch `br-curly-wind-a47576qd`, isolated API
`:4002`, isolation proven fail-closed via `tools/qa/run-isolated-api.mjs`)

| Matrix | Command | Result |
| --- | --- | --- |
| Reservation lifecycle | `PW_API_URL=http://localhost:4002 PW_BRANCH_ID=cb27be401a2c35dfc0d4e610 P4D_MARKER=SUPFINALQA node tools/qa/reservation-live-matrix.mjs` | **53/53 pass** (create/confirm/assign/reassign/seat/cancel/no-show/manual-complete/queries/pagination/overdue/branch-isolation/concurrency); 1 documented non-blocking gap surfaced (SUP-RG-034, concurrent-identical-create 500) |
| Approvals decisions | `PW_API_URL=http://localhost:4002 PW_BRANCH_ID=cb27be401a2c35dfc0d4e610 QA_SUP_EMAIL/PASSWORD ... node tools/qa/approvals-live-matrix.mjs` | **29/29 pass** (all 4 domains' lifecycles, pagination-400, History windows, required-reason, branch-isolation 404, duplicate/concurrency 409/400, identity projection) |

## 4. Browser QA — four-viewport Playwright suite

Stack: local disposable Docker Postgres (`nimbus-supfinal-qa`, port `55433`) → migrated (58/58) →
seeded → demo-imported → isolated API `:4003` → web built against it and served on `:3102`.
Command per viewport:

```
PW_BASE_URL=http://localhost:3102 PW_API_URL=http://localhost:4003 PW_BRANCH_ID=cb27be401a2c35dfc0d4e610 \
  npx playwright test e2e/supervisor-prompt3 e2e/supervisor-reservations e2e/supervisor-approvals \
  --project=vp-<WxH> --retries=1 --reporter=list
```

| Viewport | Discovered | Executed | Passed | Failed | Skipped | Retries | Duration |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1024×768 (initial pass, before defect fixes + data top-up) | 65 | 65 | 60 | 2 (defects 1+2, see report §8) | 3 | 4 | ~5.9m |
| 1024×768 (re-run after both fixes + data top-up; 66 tests after the spec split) | 66 | 66 | 64 | 0 | 2 (graceful, data-exhaustion pre-topup; both independently re-verified passing in isolation) | 0 | ~3.5m |
| 1366×768 | 66 | 66 | **66** | 0 | 0 | 0 | ~3.4m |
| 1440×900 | 66 | 66 | **66** | 0 | 0 | 0 | ~3.4m |
| 1920×1080 | 66 | 66 | **66** | 0 | 0 | 0 | ~3.4m |

**Final totals (post-fix runs): 264 executed, 262 passed, 0 failed, 2 graceful self-skips (both
individually re-verified green).**

Spec files exercised at every viewport: `supervisor-prompt3/{find-lookup,floor,regression,
responsive,role-boundaries,workspace-actions}.spec.ts`; `supervisor-reservations/{arriving-actions,
attention,create-reservation,history-and-pagination,navigation-and-default-view,
privacy-and-boundaries,responsive,seated-and-completion,waiter-visibility}.spec.ts`;
`supervisor-approvals/{all-domains-consolidated,anomaly-acknowledge-resolve,cross-role-visibility,
discount-approve-reject,discount-self-approval,filters-pagination-routing,identity-and-privacy,
leave-approve-reject,navigation-and-default-queue,prompt3-prompt4-regression,resolved-history,
responsive-closure,responsive,shift-swap-reject,smoke}.spec.ts`.

**Prior attempt (superseded, not counted above):** the same suite was first attempted directly
against the disposable Neon branch. Round-trips of 20–27s/test and a Windows Chromium
`STATUS_STACK_BUFFER_OVERRUN` worker-crash cascade after roughly 10–30 tests made that path
non-viable for a full run (see completion report §8, defect 3) — consistent with the
already-documented Prompt 4D finding that Neon-branch latency exceeds the app's client budget
under concurrent query fan-out. The local Docker path is the documented, proven, canonical
browser-QA path and is what §4's totals reflect.

## 5. Shared-Neon before/after (read-only Neon MCP queries)

Identical query run against `br-holy-darkness-a4fg93r2` (`production`) before disposable-branch
creation and again after all QA + cleanup completed:

```sql
SELECT
  (SELECT count(*) FROM _prisma_migrations) AS migration_count,
  (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL) AS failed_migration_count,
  (SELECT count(*) FROM role_permissions) AS role_permission_count,
  (SELECT count(*) FROM reservations) AS reservation_count,
  (SELECT count(*) FROM reservation_events) AS reservation_event_count,
  (SELECT count(*) FROM orders) AS order_count,
  (SELECT count(*) FROM payments) AS payment_count,
  (SELECT count(*) FROM users) AS user_count,
  (SELECT count(*) FROM discounts) AS discount_count,
  (SELECT count(*) FROM leave_requests) AS leave_count,
  (SELECT count(*) FROM shift_swap_requests) AS shift_swap_count,
  (SELECT count(*) FROM anomaly_events) AS anomaly_count;
```

Result both times: `58 / 0 / 836 / 126 / 12 / 1223 / 750 / 19 / 6 / 15 / 12 / 21`. Sentinel-table
check (`to_regclass('_p4d_qa_sentinel')`, `to_regclass('_supervisor_final_qa_sentinel')`) returned
`null` both times — no QA artifact ever touched shared Neon.

## 6. Disposable infrastructure lifecycle

| Resource | Created | Used for | Torn down |
| --- | --- | --- | --- |
| Neon branch `supervisor-final-qa-20260731` (`br-curly-wind-a47576qd`) | forked from `production`, sentinel `_p4d_qa_sentinel` row inserted | Live API matrices (§3) | **Deleted** via `mcp__Neon__delete_branch` after §3 completed |
| Docker container `nimbus-supfinal-qa` (`postgres:16`, port `55433`) | fresh, migrated, seeded, demo-imported | Browser QA (§4) | `docker stop` + `docker rm` |
| Isolated API processes (`:4002` disposable-Neon-backed, `:4003` local-Docker-backed) | spawned per stack | §3, §4 | `taskkill` after use |
| Isolated web processes (`:3101`, `:3102`) | built + `next start` per stack | §4 | `taskkill` after use |
| Scratch secret env files (`qa.env.secret`, `local-qa-db.env`) | written to the session scratchpad (never in the repo) | isolation for Prisma CLI + API launcher | deleted at cleanup |

## 7. Cross-role and privacy checks (embedded in §4's spec list, called out explicitly)

- **Waiter regression:** `regression.spec.ts` ("Waiter Floor loads with the Waiter nav"),
  `role-boundaries.spec.ts` ("Waiter lands on Waiter Floor with no Supervisor Find order/order
  actions", "Waiter cannot reach the Supervisor Floor workspace"), Approvals'
  `cross-role-visibility.spec.ts` ("Waiter has no Approvals and no decision controls") —
  all pass at all 4 viewports.
- **Cashier regression:** `regression.spec.ts` ("Cashier surfaces load: Queue, Receipts, Till"),
  `role-boundaries.spec.ts` ("Cashier lands on Cashier Queue with the Cashier nav"), Approvals'
  `cross-role-visibility.spec.ts` ("Cashier has its own nav and no Approvals") — all pass at all
  4 viewports.
- **Privacy:** `identity-and-privacy.spec.ts` ("row titles are names/types, never raw ids, and no
  PII leaks"), `privacy-and-boundaries.spec.ts` ("rows do not expose full phone/email; detail
  does", "no out-of-scope surfaces [payment, deposit recording, order close]") — all pass at all
  4 viewports.

## 8. Cleanup verification

- Ports `3101`/`3102`/`4002`/`4003`/`55433` confirmed free (`netstat`) after teardown.
- No orphaned `chrome.exe`/`node.exe` processes remained (verified via `tasklist`, terminated
  where Playwright's own cleanup left stragglers after a crash — see completion report §8,
  defect 3).
- `docker ps -a` confirms `nimbus-supfinal-qa` container removed.
- Neon MCP `describe_project` confirms only `production`, the retained Prompt 4C recovery branch,
  and the (unrelated, auto-expiring) Prompt 5A branch remain — the final-QA disposable branch is
  gone.
