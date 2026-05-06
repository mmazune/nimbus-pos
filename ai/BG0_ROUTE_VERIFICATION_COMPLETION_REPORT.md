# Completion Report — BG0: Route Verification + Contract Cleanup

## Context Snapshot

- Current task: **BG0 — Route Verification + Contract Cleanup** (pre-frontend gate)
- Previous completed milestone: **M42 — Feature Flags + Maintenance Windows + Training Mode**
- Next: **BG1 — Invitation Acceptance + Password Lifecycle + Frontline Staff Onboarding**
- Backend coverage M0–M42 is feature-complete; BG0 unblocks frontend assignment by classifying every unresolved API row.

## Summary

- Performed a code-first route verification pass against all unresolved rows from `ai/nimbus_route_verification_checklist_m0_m42.csv` (42 report-only rows).
- Inventoried all 46 NestJS controllers under [apps/api/src/modules](apps/api/src/modules) and resolved the full prefix-aware path for each handler.
- Identified Postman-only candidates by extracting all `/api/*` paths from the 48 Postman collections (363 unique normalized paths) and matching against code; classified the diagnostic / legacy / pending-provider / owner-SaaS rows that surface as Postman-only against report sources.
- Updated the checklist CSV with the mandatory classification (`VERIFIED_IN_CODE`, `MISSING_IMPLEMENT`, `INTENTIONALLY_REMOVED_OR_SUPERSEDED`, `DEV_OR_INTERNAL_ONLY`, `BLOCKED_PENDING_PROVIDER`) plus controller, decorator line, guards, branch/org context, replacement route, and `ready_for_frontend` flag.
- Confirmed canonical context route is `GET /api/auth/me`; legacy `GET /api/me` is left in code (tenancy.controller.ts) for backwards compatibility but flagged not for new frontend assignment.
- Confirmed `/api/public/payments/*` are scaffold-only and pending MTN/Airtel provider confirmation; the controller doc-comment already enforces this, so no code change was needed.
- Confirmed `/api/billing/pesapal/*` is the LIVE owner SaaS subscription billing channel — distinct from the public-diner mobile-money scaffold.

## Verification Method

Source-of-truth order followed:

1. **NestJS source** — every `@Controller('prefix')` plus every `@Get/@Post/@Patch/@Put/@Delete/@Sse` decorator was read from disk.
2. **Compiled module registrations** — `app.module.ts` confirms `setGlobalPrefix('api')` and module wiring.
3. **Postman collections** — all 48 collections in [postman/collections/](postman/collections/) were string-scanned for `/api/...` paths.
4. **Completion reports** — used to anchor each report-only row to its origin milestone.
5. **Final audit/reconciliation files** — the prompt referenced `nimbus_final_master_audit_m0_m42.md`, `nimbus_final_endpoint_register_verified_m0_m42.csv`, `nimbus_final_report_vs_postman_reconciliation_m0_m42.csv`, and `nimbus_final_missing_endpoint_recommendations_m0_m42.csv`. **None of those four files exist in the workspace** (verified via `file_search`). The pre-existing `ai/nimbus_route_verification_checklist_m0_m42.csv` enumerates the 42 report-only rows directly, so verification proceeded against that file plus the live code/Postman.

If docs and code disagreed, code won (per source-of-truth rule). Discrepancies are recorded in the `notes` column of the checklist.

## Route Classification Summary

Total rows classified: **53**

| Bucket | Count | Notes |
|---|---|---|
| `VERIFIED_IN_CODE` | **31** | 27 report-only rows confirmed live; 4 Postman-only PesaPal owner-SaaS billing rows confirmed live. |
| `INTENTIONALLY_REMOVED_OR_SUPERSEDED` | **15** | 14 report-only shorthand/typo rows (e.g. `/api/runs/*` → `/api/payroll/runs/*`); 1 Postman-only legacy `/api/me` (canonical is `/api/auth/me`). |
| `MISSING_IMPLEMENT` | **1** | `GET /api/accounting/ap/suppliers/:id` — list exists, single-supplier read missing. Defer to M34 follow-up only if the AP UI requires a supplier-detail drawer. |
| `DEV_OR_INTERNAL_ONLY` | **2** | `GET /api/auth/_perm-test`, `GET /api/branch-test`. |
| `BLOCKED_PENDING_PROVIDER` | **5** | All `/api/public/payments/*` routes — scaffold returns `{status:'PENDING_INTEGRATION'}`. |

Of the 42 ROADMAP-tracked report-only rows: **27 verified**, **14 superseded with replacement route documented**, **1 truly missing**.

Of the audit-cited 11 Postman-only rows: this BG0 pass identified and classified **12** Postman-only rows. The original audit total of 11 cannot be reproduced exactly because the source `nimbus_final_report_vs_postman_reconciliation_m0_m42.csv` is not in the workspace; the rows captured here are derived from a direct Postman scan and cover every category called out by the locked business rules (legacy context, dev diagnostics, public-payment scaffold, owner-SaaS PesaPal). One row matches both report and Postman (`/api/maintenance-windows/:id`) and is recorded under report-only with a note that adding it to the M42 collection is a small follow-up.

## File-by-File Changes

| File | Change |
|---|---|
| [ai/nimbus_route_verification_checklist_m0_m42.csv](ai/nimbus_route_verification_checklist_m0_m42.csv) | Replaced. New 12-column schema (`method, path, source_status, classification, module, controller, decorator_evidence, auth_permission_notes, branch_org_context, replacement_route, ready_for_frontend, notes`). 53 rows: 42 report-only + 11 (incl. PesaPal) postman-only. |
| [ai/AI_STATUS.md](ai/AI_STATUS.md) | Added BG0 LIVE entry; classification counts; gate to BG1 explicitly opened. |
| [ai/BG0_ROUTE_VERIFICATION_COMPLETION_REPORT.md](ai/BG0_ROUTE_VERIFICATION_COMPLETION_REPORT.md) | New (this file). |

No code, controller, DTO, or service file was modified in BG0.

No Postman collection JSON file was modified — the locked business rules and existing collection descriptions for `/api/public/payments/*` already match BG0's verdict (the controller doc-comment in [public-commerce-payments.controller.ts](apps/api/src/modules/public-commerce-payments/public-commerce-payments.controller.ts) already says "SCAFFOLD ONLY (NOT LIVE)" and "Do NOT describe these endpoints as live PesaPal").

No new migration. No prisma change. No seed change.

## Updated Route Verification Checklist Summary

The new checklist (53 rows) replaces the placeholder triage with a final disposition for every row. Highlights:

**Report-only rows that were already correct in code (VERIFIED_IN_CODE, 27)**
- All 12 `/api/accounting/*` rows (accounts, cost-centers, periods, posting-source-maps, tax-config) — live under the `accounting` controller, branch-scoped.
- All 3 `/api/alerts/*` rows.
- 2 `/api/analytics/*` rows.
- Both `/api/kds/sla-config/:station` rows.
- `GET /api/maintenance-windows/:id` — live (M42); only missing in the M42 Postman collection.
- `PATCH /api/merchant/events/:id`, `GET /api/orgs`, `GET /api/orgs/:orgId`, `GET /api/payroll/payslips`, `PATCH /api/settings`, `GET /api/stream/kds`, `SSE /api/stream/metrics`, `SSE /api/stream/payments`.

**Report-only rows with documentation typos (SUPERSEDED, 14)**
- `PATCH /api/accounting/ap/bills/:id/approve` → method should be **POST** (M34 report typo).
- `POST /api/adjustments` → `POST /api/payroll/adjustments`.
- `POST /api/ar/receipts` → `POST /api/accounting/ar/receipts`.
- `GET /api/catalog` → either `/api/reports/catalog` (report list) or `/api/menu/catalog` (menu browse).
- `POST /api/components` → `POST /api/payroll/components`.
- `GET /api/payslips`, `GET /api/payslips/:id` → `/api/payroll/payslips[/:id]`.
- `POST /api/reports/discounts|refunds|voids|wastage` → all four are `*-summary` in code.
- `POST /api/runs/build`, `PATCH /api/runs/:id/approve`, `PATCH /api/runs/:id/pay` → all under `/api/payroll/runs/...`.
- `POST /api/:id/run` → `POST /api/alerts/digests/:id/run`.

**Truly missing (MISSING_IMPLEMENT, 1)**
- `GET /api/accounting/ap/suppliers/:id` — only `GET /api/accounting/ap/suppliers` (list) is implemented. Add to a future small AP follow-up only if a frontend supplier-detail drawer is on the roadmap.

**Postman-only / cross-context (12)**
- `GET /api/me` (legacy tenancy) — canonical replacement is `GET /api/auth/me`.
- `GET /api/branch-test`, `GET /api/auth/_perm-test` — dev/QA diagnostics.
- 5 `/api/public/payments/*` rows — scaffold only, pending MTN/Airtel.
- 4 `/api/billing/pesapal/*` rows — LIVE for **owner SaaS subscription billing only**.

## Contract Cleanup Recommendations (Frontend Handoff)

### Truly missing — must move into a future implementation slot (1)
- `GET /api/accounting/ap/suppliers/:id` — small. Could be folded into BG-future or a one-shot M34.x patch. **Not** required for BG1–BG6 sequencing.

### Already present — frontend can map immediately (47)
- All 27 verified report-only routes.
- All 14 superseded routes — frontend should bind to the **canonical replacement** path documented in the checklist.
- All 4 owner-SaaS `/api/billing/pesapal/*` routes — for owner subscription billing screens only.
- `GET /api/auth/me` — canonical context resolver for every authenticated frontend shell.
- `GET /api/maintenance-windows/:id` — already live; frontend may bind it; Postman addition is a non-blocking polish item.

### Stale or shorthand — should be removed/normalized in docs (15 SUPERSEDED rows)
- The 14 report shorthand entries: replace any references in completion reports / `nimbus_*` planning docs / Postman item names with the canonical replacement path. **Code is correct already** — only doc text drifted.
- `/api/me` (legacy): keep the route in code but document that no new frontend screen should bind to it.

### Internal-only — must NOT be assigned to frontend screens (2)
- `GET /api/auth/_perm-test`
- `GET /api/branch-test`

### Pending provider — must NOT be assigned to live execution flows (5)
- All `/api/public/payments/*` routes. Frontend may render a "Pay with mobile money — coming soon" placeholder gated on a feature flag, but must not invoke them as a real checkout path.

### Canonical context route note (frontend-shell rule)
- **Use `GET /api/auth/me` everywhere** for the post-login session/identity bootstrap.
- `GET /api/me` is legacy and is to be considered superseded for all new frontend code.

## AI_STATUS.md Updated Content

See diff in [ai/AI_STATUS.md](ai/AI_STATUS.md). Key changes:
- New section: **BG0 — Route Verification + Contract Cleanup (LIVE, 2026-04-29)** placed after the M42 entry.
- Total Postman collections: still 48 (no collection added/removed).
- Total completion reports: 53 (was 52; +1 for BG0).
- "Backend safe for frontend assignment" gate: **OPEN for BG1**, with the single MISSING_IMPLEMENT row noted.

## DONE Checks

- `pnpm lint` — not run (no code changed).
- `pnpm test` — not run (no code changed).
- `pnpm db:migrate` — not run (no schema change).
- `pnpm db:seed` — not run (no seed change).
- Route verification by source inspection: ✅ 42/42 report-only rows + 11/11 postman-only rows classified with file + line evidence.
- Postman descriptions: ✅ unchanged; locked language for `/api/public/payments/*` already correct in [public-commerce-payments.controller.ts](apps/api/src/modules/public-commerce-payments/public-commerce-payments.controller.ts) doc-comment.
- AI_STATUS update: ✅.
- New completion report: ✅ this file.

## Decisions / Deviations

- **No code changes.** BG0 is a verification + classification pass per the prompt; the only code-level discrepancy detected (`PATCH` vs `POST` on `/api/accounting/ap/bills/:id/approve`) is a doc typo in M34's completion report — the **code is correct**, so the doc/checklist was updated rather than the controller.
- **No Postman collection JSON edits.** Re-running every collection with new descriptions risks breaking standalone-resilience guarantees in the AI_POSTMAN_WORKING_PATTERNS.md rule book. The classification CSV is the authoritative cleanup register; per-collection text changes (if any) belong in BG1+ where the same collections are touched anyway.
- **Postman-only count of 12 vs audit's 11.** The four `/api/billing/pesapal/*` rows might have been counted by the original audit as a single grouping; either way the classifications are unambiguous and the locked business rules are honoured.
- **Final-audit source CSVs absent.** `nimbus_final_master_audit_m0_m42.md`, `nimbus_final_endpoint_register_verified_m0_m42.csv`, `nimbus_final_report_vs_postman_reconciliation_m0_m42.csv`, and `nimbus_final_missing_endpoint_recommendations_m0_m42.csv` are not present in the workspace. BG0 used the in-workspace `ai/nimbus_route_verification_checklist_m0_m42.csv` as the authoritative starting list (it already enumerates the 42 report-only rows). This is documented here so BG-future tasks can re-import the upstream files if/when they land in the repo.

## Known Issues

- 1 row remains MISSING_IMPLEMENT (`GET /api/accounting/ap/suppliers/:id`). Non-blocking for frontend assignment; bind any AP detail drawer to a list+filter pattern until implemented.

## Next Step

- Open **BG1 — Invitation Acceptance + Password Lifecycle + Frontline Staff Onboarding** per `ai/nimbus_backend_gap_fix_prompts.md`. Frontend assignment may now begin against the 47 frontend-ready rows; the 5 pending-provider rows and 2 dev-only rows must be excluded from any component-to-API mapping.
