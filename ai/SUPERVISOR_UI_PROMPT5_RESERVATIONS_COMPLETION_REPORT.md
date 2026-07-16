# Supervisor UI Prompt 5 - Reservations Read & Seating Oversight Completion Report

## 1. Context Snapshot

Starting state from `ai/AI_STATUS.md`: Supervisor Prompt 4 Orders was complete, and reservations build was pending. The worktree already contained many unrelated modified/untracked files; this pass preserved them and only added the requested Supervisor Reservations UI scope.

## 2. Repo Path Confirmed

Work was performed only in `C:\Users\arman\Desktop\nimbus-pos`.

## 3. Codex Skills Read

Read and applied: `emil-design-eng`, `frontend-design`, `make-interfaces-feel-better`, `impeccable`, `web-design-guidelines`, and `browser:control-in-app-browser` for the attempted browser verification.

## 4. Mandatory Governance Files Read

Read before edits: `ROADMAP.md`, `repo file tree.txt`, `ai/AI_CONTEXT.md`, `ai/AI_STATUS.md`, `ai/AI_ERROR_PROTOCOL.md`, `ai/AI_COMPLETION_REPORT_TEMPLATE.md`, `docs/ARCHITECTURE.md`, `docs/API_CONVENTIONS.md`, `docs/POSTMAN_ENDPOINT_GUIDE.md`, and all existing `postman/collections/` metadata.

## 5. Existing Supervisor Context Reviewed

Reviewed Supervisor shell, session guard, Prompt 1-4 reports, Floor and Orders implementations, Supervisor state/caveat utilities, and Waiter reservation normalization patterns.

## 6. Backend Contract Reviewed

Verified existing read routes only: `GET /api/reservations`, `GET /api/reservations/upcoming`, `GET /api/reservations/:id`, `GET /api/reservations/:id/deposits`, and `GET /api/reservations/:id/events`.

## 7. Scope Implemented

Implemented Supervisor Reservations as a read-only front-door oversight surface for reservation rows, today/upcoming counts, seating readiness, table assignment visibility, deposit summaries, and event history.

## 8. Out-of-Scope Preserved

No create/edit, confirm, assign-table, seat, cancel, no-show, or deposit write calls were added. No backend business logic, Prisma schema, migrations, seed/demo imports, package files, or Postman collections were changed.

## 9. API Client Changes

Added `apps/web/src/lib/supervisor/reservations.ts` with typed fetch helpers, normalization, status/seating/deposit labels, exception tags, search/filter/sort helpers, summary counts, and Decimal-safe display parsing for returned money strings.

## 10. Components Added

Added `apps/web/src/components/supervisor/reservations/` with status badge, summary, toolbar, card, list, detail panel, and barrel export components.

## 11. Page Changes

Replaced `apps/web/src/pages/supervisor/reservations.tsx` placeholder with the live read-only page using React Query, auth/branch gating, session-expiry handling, table query filtering, refresh, empty states, partial-detail warnings, and disabled future-action surfaces.

## 12. Floor Integration

Updated `apps/web/src/components/supervisor/floor/SupervisorTableDetailPanel.tsx` and `apps/web/src/pages/supervisor/floor.tsx` to add `View table reservations` handoff to `/supervisor/reservations?tableId=<id>` and route-query table selection for reciprocal links.

## 13. No Fake Data Confirmation

The UI renders only returned API data, derived labels, loading skeletons, empty states, and explicit unavailable fallbacks. It does not synthesize fake guests, tables, deposits, availability, or events.

## 14. Privacy / Contact Handling

Guest contact fields are not searchable or shown in list cards. Phone/email appear only in the selected detail panel when the backend returns them.

## 15. Deferred Controls

Future mutation actions are shown as disabled/deferred cards with explanatory copy. They do not have mutation handlers.

## 16. Postman Status

Postman was read per governance but intentionally unchanged. No Newman run was performed because this was a frontend-only Supervisor UI prompt.

## 17. Seed / Migration Status

No database migrations, Prisma schema edits, seed edits, demo imports, or seed runs were performed.

## 18. Validation Commands

Passed:

```pwsh
corepack pnpm@8.15.0 --version
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint
corepack pnpm@8.15.0 --filter @nimbus-pos/web build
corepack pnpm@8.15.0 --filter @nimbus-pos/api build
```

## 19. HTTP / Browser QA

HTTP smoke passed against a temporary compiled web server:

```pwsh
GET http://localhost:3000/supervisor/reservations?tableId=smoke-table
GET http://localhost:3000/supervisor/floor?tableId=smoke-table
```

Both returned HTTP 200 with Next data. In-app browser QA was attempted twice but blocked by browser webview attach timeout. The temporary web listener was stopped and temporary logs were removed.

## 20. Error Protocol Notes

`@nimbus-pos/api build` first hit the 120-second command timeout. Hypotheses were slow cold Nest build, dirty-worktree compile overhead, hung postbuild, or unrelated backend compile churn. The same command was rerun once with a longer timeout and passed. Browser verification failed at the harness attach layer after documented reconnect recovery.

## 21. File-by-File Changes

- `apps/web/src/lib/supervisor/reservations.ts`: new reservation read client, types, normalization, filters, sorting, and summary helpers.
- `apps/web/src/components/supervisor/reservations/*`: new read-only Supervisor Reservations UI components.
- `apps/web/src/pages/supervisor/reservations.tsx`: real reservation oversight page.
- `apps/web/src/components/supervisor/floor/SupervisorTableDetailPanel.tsx`: added reservations table handoff link.
- `apps/web/src/pages/supervisor/floor.tsx`: added `tableId` query selection and reservations handoff.
- `ai/AI_STATUS.md`: updated current state.
- `repo file tree.txt`: documented Prompt 5 additions.
- `ai/SUPERVISOR_UI_PROMPT5_RESERVATIONS_COMPLETION_REPORT.md`: this report.

## 22. DONE Checks

DONE: frontend-only Prompt 5 scope complete. DONE: read APIs only. DONE: disabled deferred mutation controls. DONE: Floor <-> Reservations table handoff. DONE: typecheck, lint, web build, API build, and HTTP route smoke passed. DONE: Postman, seed, migrations, backend business logic, and package files left unchanged.
