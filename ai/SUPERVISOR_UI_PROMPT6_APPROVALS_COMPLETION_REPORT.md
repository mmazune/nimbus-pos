# Supervisor UI Prompt 6 - Domain Approvals Read Surface Completion Report

## 1. Context snapshot

Starting state from `ai/AI_STATUS.md`: `SUPERVISOR_UI_PROMPT5_RESERVATIONS complete / approvals build pending`. Prompt 6 was implemented as a frontend-only, read-only Supervisor domain approvals surface.

## 2. Repo path confirmed

Work was performed only in `C:\Users\arman\Desktop\nimbus-pos`. The legacy `C:\Users\arman\Desktop\NIMBUS\nimbus-pos` path was not used.

## 3. Codex skills read

Read and applied: `emil-design-eng`, `frontend-design`, `make-interfaces-feel-better` plus typography/surfaces/animations/performance references, `impeccable` product guidance, `web-design-guidelines`, and `browser:control-in-app-browser` before HTTP/browser QA planning.

## 4. Files read

Read required governance files, all 56 Postman collections by JSON metadata, Supervisor Prompt 1-5 reports, Supervisor repo verification/gap/research/roadmap docs, root Supervisor API/gap docs, fallback Supervisor docs pack, Supervisor Floor/Orders/Reservations/Me implementations, Cashier/Waiter references, backend discounts/refunds/attendance/analytics/unified-approvals controllers and DTOs, relevant service return shapes, Prisma schema models, seed Supervisor permissions, demo credentials, and package scripts.

## 5. Files changed

- `apps/web/src/lib/supervisor/approvals.ts`
- `apps/web/src/components/supervisor/approvals/*`
- `apps/web/src/pages/supervisor/approvals.tsx`
- `ai/AI_STATUS.md`
- `repo file tree.txt`
- `ai/SUPERVISOR_UI_PROMPT6_APPROVALS_COMPLETION_REPORT.md`

## 6. Domain approval API contract verification

Used read endpoints:

| Domain | Method/path | Query/body | Permission | Shape | Scope/caveat |
|---|---|---|---|---|---|
| Discounts | `GET /api/pos/discounts/pending` | none | `pos:discount:approve` | `Discount[]` with `createdBy`, `order` | branch/org scoped, read-only queue |
| Discounts | `GET /api/pos/discounts/:id` | id | `pos:discount:read` | discount detail with order/users | detail only |
| Leave | `GET /api/hr/leave` | `status=PENDING&take=50` | `pos:hr:leave:read` | `{ data, total }` | branch/org scoped |
| Shift swaps | `GET /api/hr/shift-swaps` | `status=PENDING&take=50` | `pos:hr:shift-swaps:read` | `{ data, total }` | branch/org scoped |
| Anomalies | `GET /api/analytics/anomalies` | `status=OPEN&limit=50` | `pos:analytics:anomalies:read` | `{ data, total, limit, offset }` | branch/org scoped |
| Anomalies | `GET /api/analytics/anomalies/:id` | id | `pos:analytics:anomalies:read` | anomaly detail | detail only |

Verified but not used for queues: `GET /api/pos/refunds/:id`, `GET /api/pos/orders/:id/refunds`, and `POST /api/pos/orders/:id/post-close-void`. No pending refund queue or read-only post-close void candidate route exists.

Excluded: `GET /api/approvals`, `GET /api/approvals/:id`, `POST /api/approvals/:id/decide`; these require `approvals:read` / `approvals:decide`, which Supervisor does not have.

## 7. Approvals API/client implementation

Added typed fetch helpers, domain-state metadata, normalization, labels, severity handling, exception tags, search/filter/sort helpers, and count helpers in `apps/web/src/lib/supervisor/approvals.ts`.

## 8. Approvals page implementation

Replaced the placeholder `/supervisor/approvals` page with a real React Query surface using only verified domain reads. The page shows title/subtitle, branch and shift chips, refresh, the global approvals boundary, summary, domain cards, queue list, and detail panel.

## 9. Domain cards implementation

Domain cards show endpoint source, permission, count/unavailable state, loading/error status, and exact caveat. Refunds and post-close voids are unavailable by design rather than counted as zero.

## 10. Summary/filter/search implementation

Summary counts are derived only from returned rows. Filters cover all available, discounts, refunds, void watch, leave, shift swaps, anomalies, unavailable, and high priority. Search covers ids, order references, employee/requester names, amounts/scores, statuses, reasons, and related references. Sort covers newest, oldest, amount, domain, status, and severity.

## 11. Detail panel implementation

The detail panel shows identity, context, request details, discount-specific detail, anomaly-specific detail, related order/reservation links only when ids are returned, and disabled future action tiles.

## 12. Read-only domain handling

Discount, leave, shift swap, and anomaly rows are read-only. Refund and post-close void domains render honest unavailable cards due missing read queue contracts. No fake approval rows, pending counts, severity, requester, reasons, amounts, or anomaly findings were introduced.

## 13. Deferred decision boundaries

Disabled actions include approve discount, reject discount, approve refund, reject refund, execute post-close void, review leave, approve/reject shift swap, acknowledge anomaly, and resolve anomaly. No mutation handlers, manager PIN, or override execution were added.

## 14. Global approvals exclusion

The web client does not call `/api/approvals`. A scan found only explanatory copy, not a route call.

## 15. Error/empty/blocked states

Handled loading, partial domain failure, all-domain failure, no available rows, no filter results, unavailable domains, auth expiry, forbidden/domain errors, selected detail loading, selected detail failure, and missing row selection.

## 16. Browser/HTTP QA result

HTTP smoke passed with a temporary web dev server:

- `/login` -> 200
- `/supervisor/approvals` -> 200
- `/supervisor/floor` -> 200
- `/supervisor/orders` -> 200
- `/supervisor/reservations` -> 200
- `/supervisor/me` -> 200

Browser visual QA was not completed through the in-app browser. The temporary web listener and child Next process were stopped; port 3000 was clear afterward.

## 17. Waiter/Cashier regression status

No Waiter or Cashier source files were changed. Web typecheck and lint passed across the web workspace.

## 18. Role boundaries preserved

Supervisor remains floor-control and exception-resolution focused. No waiter order-entry, cashier settlement, receipt/device/admin/accounting/billing/franchise/developer, global audit, report dashboard, or manager backoffice surface was added.

## 19. Deferred surfaces preserved

No live MTN/Airtel checkout, PesaPal diner checkout, fake printer driver, fake terminal/acquirer, backend business logic, Prisma schema, migrations, seed/demo import, Postman, or package-file changes were made.

## 20. Validation performed

Passed:

```pwsh
corepack pnpm@8.15.0 --version
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint
corepack pnpm@8.15.0 --filter @nimbus-pos/api build
```

Initial web typecheck failed because the pending discount type omitted raw `orderId`; the service proved the field exists, the type was updated, and typecheck passed on rerun.

## 21. Issues/blockers

Authenticated browser visual QA remains limited by prior in-app browser attach reliability. Refund approval queue and post-close void candidate queue are blocked by missing read-only list endpoints.

## 22. Recommended next prompt

Supervisor UI Prompt 7: Me and punch/workforce self-service, using verified attendance/leave/shift-swap reads and preserving approval decision mutations for a later action prompt.

## 23. DONE checks

- DONE: used only `C:\Users\arman\Desktop\nimbus-pos`
- DONE: protected unrelated worktree changes
- DONE: read Supervisor Prompt 1-5 reports
- DONE: read Supervisor verification report and docs/fallback docs
- DONE: read required Codex skills
- DONE: verified exact domain approval endpoints
- DONE: confirmed `/api/approvals` exclusion
- DONE: implemented Supervisor approvals API client
- DONE: implemented `/supervisor/approvals` domain read surface
- DONE: no global `/api/approvals` call
- DONE: no fake approval data, counts, or severity
- DONE: filters, search, and detail panel implemented
- DONE: discount approvals read-only
- DONE: refund approvals honestly unavailable as a queue
- DONE: post-close void queue deferred
- DONE: leave, shift swaps, and anomalies read-only where endpoints exist
- DONE: approve/reject/decide actions disabled
- DONE: no manager PIN or override execution
- DONE: no receipt, device, accounting, billing, franchise, developer, provider, printer, terminal, or hardware UI added
- DONE: no backend business logic, Prisma schema, migrations, Postman, seed, demo import, package changes, or demo database writes
- DONE: HTTP QA passed; browser visual QA not completed
- DONE: typecheck, lint, and API build passed
- DONE: `ai/AI_STATUS.md` updated
- DONE: `repo file tree.txt` updated
