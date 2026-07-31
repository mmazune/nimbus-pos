# Supervisor Approvals UI — QA Evidence Index (Prompt 5B1 + 5B2)

> **Prompt 5B2 closure (2026-07-31).** Disposable branch `br-hidden-king-a4rbwvj0` (deleted). Isolation
> verified via the fail-closed launcher (sentinel `P5B2-QA-20260731`; `/api/health` ok). **Live API
> matrix 11/11** (shift-swap reject/dup/bound + anomaly ack/resolve/dup/stale) + **roster integrity 0
> assignments touched** (Outcome C truthful). **Full Playwright suite (15 files × 4 viewports = 120
> tests) executed — all pass, 2 flaky recovered on retry, exit 0.** Shared `production` verified
> untouched (0 P5B2-QA rows, sentinel absent). Static gates: typecheck ✓, lint ✓, build ✓ (`/supervisor/
> approvals` 16.8 kB), API 126/126 + reservations 39/39. Details in the 5B2 + Prompt 5 final reports.

---

# Supervisor Approvals UI — QA Evidence Index (Prompt 5B1)

Date: 2026-07-30 · Isolated disposable-branch QA · shared `production` read-only

> No employee/guest PII is recorded here. Identities are referenced by redacted id only.
> Screenshots/traces are git-ignored under `apps/web/e2e/.evidence/` and
> `apps/web/playwright-report/`.

## 1. Isolation

| Item | Value |
| --- | --- |
| Disposable Neon branch | `br-aged-resonance-a47lmtt5` (`prompt5b1-approvals-ui-qa-20260730`), forked from `production` `br-holy-darkness-a4fg93r2` |
| Disposable endpoint | `ep-tiny-king-a44a10es` (pooled, `pgbouncer=true`, `connect_timeout=20`) |
| Fail-closed sentinel | `_p4d_qa_sentinel` marker `P5B1-QA-20260730` = branch id (disposable only; 0 on production) |
| Isolated API | `:4002` via `tools/qa/run-isolated-api.mjs` — preflight PASS (denylist / prisma / sentinel / migration / `COMPLETED` enum / demo branch), `/api/health` → `{status:ok, db:ok}` |
| Isolated web | `next dev -p 3101`, `NEXT_PUBLIC_API_BASE_URL=:4002`, API CORS `:3101` |
| Keep-warm | health pinger every 4s (the scale-to-zero compute cold-starts on idle; pooled endpoint + pinger stabilise it) |
| Login | `supervisor@nimbus.demo` / Tapas Downtown `cb27be401a2c35dfc0d4e610` |

## 2. Static gates (pre-browser)

| Gate | Result |
| --- | --- |
| `@nimbus-pos/web` typecheck | PASS |
| `@nimbus-pos/web` lint | PASS (0 errors) |
| `@nimbus-pos/web` build | PASS (`/supervisor/approvals` 16 kB) |
| API jest (attendance/discounts/analytics/DTOs) | 126/126 |
| API jest reservations regression | 39/39 |
| `nest build` | PASS |
| `git diff --check` | clean (one pre-existing 5A doc whitespace, cleaned) |

## 3. Backend spot-checks (isolated API)

- `POST /auth/login` (supervisor) → 201; `/auth/me` → 200.
- `POST /pos/discounts/:id/approve` (seeded PENDING, unpaid order) → 200 APPROVED; `:id/reject` (already REJECTED) → 409 (concurrency guard).
- `PATCH /hr/leave/:id/review` APPROVED/REJECTED → 200.
- Note: `POST /pos/orders` returns 500 on this heavily-populated fork — a **pre-existing** order-number generation collision (`unique(branch_id, order_number)`), unrelated to Prompt 5B1 (tracked separately). QA discounts were therefore seeded via SQL on existing unpaid, discountable orders rather than created through the order API.

## 4. Browser suite — `apps/web/e2e/supervisor-approvals/` (10 files, 4 viewports)

**80 passed / 0 failed (43.2m)** — all four viewport projects (1024×768, 1366×768, 1440×900,
1920×1080), Chromium via Playwright, `--retries=2` (transient first-hit login latency on the
scale-to-zero compute; no test failed on its final attempt).

Specs (each × 4 viewports): navigation-and-default-queue · filters-pagination-routing ·
discount-approve-reject · discount-self-approval · leave-approve-reject · resolved-history ·
identity-and-privacy · responsive · prompt3-prompt4-regression · smoke (5A).

Verified live: discount approve/reject + self-approval notice + payment gate; leave approve/reject
+ truthful no-payroll/roster copy; shift-swap + anomaly read-only; scope/domain/counts; discount
omitted from Resolved/History + order-scoped notice; URL state + refresh persistence; identity/privacy
(no raw-UUID titles, no PII in rows); responsive no-overflow; Prompt 3/4 regression + no Orders tab.

Two pre-final single-viewport failures were diagnosed as non-defects and resolved: a wrong `goBack`
test assertion (replace-routing), and the discount fixture hitting the pre-existing order-number
collision (SUP-RG-040) → QA discounts seeded via SQL. Evidence (git-ignored): HTML report +
per-failure traces/screenshots under `apps/web/playwright-report/` and `apps/web/e2e/.evidence/`.

## 5. Shared-Neon protection — untouched

Post-QA recheck of `production` matches baseline exactly: 58 migrations / 836 role_permissions /
126 reservations / 1223 orders / 750 payments / 19 users; pending counts identical; **0 P5B1-QA
rows; sentinel absent**. No shared write.

## 6. Teardown

Isolated API (:4002) + web (:3101) + keep-warm pinger stopped; ports free; no orphan process;
secret env removed; **disposable branch `br-aged-resonance-a47lmtt5` deleted**; Prompt 4C recovery
branch retained.
