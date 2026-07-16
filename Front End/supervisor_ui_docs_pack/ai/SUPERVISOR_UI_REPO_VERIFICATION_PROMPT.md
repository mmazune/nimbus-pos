# SUPERVISOR_UI_REPO_VERIFICATION_PROMPT.md

Paste this into Codex before building any Supervisor UI.

```txt
You are ChatGPT GPT-5.5 Thinking working in Codex on the Nimbus POS / ChefCloud repo.

REPO SCOPE

Use only:

C:\Users\arman\Desktop\nimbus-pos

Do not use:

C:\Users\arman\Desktop\NIMBUS\nimbus-pos

PACKAGE MANAGER

Use:

corepack pnpm@8.15.0

TASK TYPE

Supervisor UI deep research and repository verification only.

Do not build Supervisor UI yet.
Do not modify backend.
Do not modify frontend.
Do not modify Prisma schema.
Do not create migrations.
Do not modify Postman.
Do not import demo data.
Do not write demo database changes.
Do not start duplicate API/web servers.

GOAL

Perform thorough codebase research to confirm Supervisor credentials, role enum, permissions, endpoint access, DTOs, lifecycle, nav validity, reservation scope, order-resolution scope, approval scope, punch/workforce scope, receipts/audit scope, device/hardware caveats, and demo-data readiness.

APPROVED SUPERVISOR NAV

Floor · Orders · Reservations · Approvals · Me

READ FIRST

1. ai/AI_STATUS.md
2. ai/SUPERVISOR_UI_RESEARCH_REPORT.md
3. docs/supervisor-ui-docs/AGENTS.md
4. docs/supervisor-ui-docs/DESIGN.md
5. docs/supervisor-ui-docs/supervisor_design.md
6. docs/supervisor-ui-docs/supervisorui.md
7. docs/supervisor-ui-docs/SUPERVISOR_LIFECYCLE.md
8. docs/supervisor-ui-docs/SUPERVISOR_API_MATRIX.md
9. docs/supervisor-ui-docs/SUPERVISOR_GAP_REGISTER.md
10. docs/supervisor-ui-docs/README.md
11. ai/SUPERVISOR_UI_IMPLEMENTATION_ROADMAP.md
12. Waiter docs as structural reference only
13. Cashier docs and reports as process reference only
14. README.md
15. ROADMAP.md
16. demo-data/DEMO_LOGIN_CREDENTIALS.md

SEARCH SOURCE AREAS

1. packages/db/prisma/schema.prisma
2. packages/db/prisma/seed.ts
3. packages/db/prisma/demo-import.ts
4. demo-data/
5. apps/api/src/modules/auth/**/*
6. apps/api/src/modules/floor/**/*
7. apps/api/src/modules/tables/**/*
8. apps/api/src/modules/orders/**/*
9. apps/api/src/modules/pos-orders/**/*
10. apps/api/src/modules/pos-handoff/**/*
11. apps/api/src/modules/payments/**/*
12. apps/api/src/modules/refunds/**/*
13. apps/api/src/modules/discounts/**/*
14. apps/api/src/modules/reservations/**/*
15. apps/api/src/modules/receipts/**/*
16. apps/api/src/modules/shifts/**/*
17. apps/api/src/modules/tills/**/*
18. apps/api/src/modules/hr/**/*
19. apps/api/src/modules/attendance/**/*
20. apps/api/src/modules/leave/**/*
21. apps/api/src/modules/shift-swaps/**/*
22. apps/api/src/modules/kds/**/*
23. apps/api/src/modules/analytics/**/*
24. apps/api/src/modules/approvals/**/*
25. apps/api/src/modules/devices/**/*
26. apps/api/src/modules/reports/**/*
27. apps/api/src/modules/accounting/**/*
28. apps/api/src/**/*.controller.ts
29. apps/api/src/**/*.service.ts
30. apps/api/src/**/*.dto.ts
31. apps/web/src/pages/login.tsx
32. apps/web/src/lib/auth/**/*
33. apps/web/src/lib/waiter/**/*
34. apps/web/src/lib/cashier/**/*
35. apps/web/src/components/waiter/**/*
36. apps/web/src/components/cashier/**/*
37. apps/web/src/pages/waiter/**/*
38. apps/web/src/pages/cashier/**/*
39. apps/web/src/components/ui/**/*
40. apps/web/src/styles/globals.css
41. apps/web/tailwind.config.ts
42. apps/web/package.json
43. postman/collections/*
44. postman/environments/*

SEARCH TERMS

Supervisor
SUPERVISOR
supervisor
JobRole
role permissions
pos:orders
pos:order:split
pos:order:merge
pos:order:transfer
pos:order:move-items
pos:void
post-close-void
refund approve
pos:refund
pos:discount
approve discount
reservations
reservation deposit
seat reservation
assign table
table status
floor availability
floor plan
attendance
clock
punch
leave
shift swap
approvals
anomalies
kds
mark-ready
receipt reprint
receipt send
devices
printer routes
terminal pair
reports
accounting
payroll
franchise
PesaPal
MTN
Airtel
provider confirmation
metadata only
stub

RESEARCH QUESTIONS

A. Identity/auth
1. What exact Supervisor enum/name exists?
2. What demo Supervisor users exist?
3. What Quick PIN/password credentials exist?
4. Is Supervisor PIN-first?
5. What does /api/auth/me return for Supervisor?
6. What branch/org/workspace context is seeded?
7. What frontend login role-routing changes are needed?

B. Permissions
1. List exact Supervisor permissions from seed.
2. Which permissions are inherited vs direct?
3. Can Supervisor read floor/tables?
4. Can Supervisor write table status?
5. Can Supervisor view all branch orders?
6. Can Supervisor create/edit/send orders?
7. Can Supervisor split/merge/move/transfer orders?
8. Can Supervisor settle/close payments?
9. Can Supervisor void orders?
10. Can Supervisor approve refunds?
11. Can Supervisor approve discounts?
12. Can Supervisor execute post-close void?
13. Can Supervisor manage reservations/deposits?
14. Can Supervisor punch/clock?
15. Can Supervisor approve leave/shift swaps?
16. Can Supervisor use KDS writes?
17. Can Supervisor access global approvals?
18. Can Supervisor access reports/accounting/payroll/franchise?
19. Can Supervisor read/manage devices?

C. DTOs/endpoints
For every permitted endpoint, document exact method, path, DTO fields, response shape, required permission, idempotency behavior, and caveats.

D. Navigation/lifecycle
1. Confirm approved nav is safe: Floor, Orders, Reservations, Approvals, Me.
2. Confirm landing route: /supervisor/floor.
3. Confirm if Reservations deserves a first-class tab.
4. Confirm if Approvals should be global or domain-specific.
5. Confirm punch belongs under Me.

E. Demo readiness
1. Are Supervisor demo credentials seeded?
2. Are floor/table fixtures seeded?
3. Are reservation fixtures seeded?
4. Are approval/discount/refund fixtures seeded?
5. Are shift/punch fixtures seeded?
6. Does db:demo:validate pass?

F. Safety/deferred surfaces
Confirm exact evidence for:
1. MTN/Airtel pending provider confirmation.
2. PesaPal SaaS billing only.
3. Printer metadata-only.
4. Terminal stub-only.
5. Receipt send pending/no adapter.
6. Accounting/reports/payroll/franchise excluded unless permission proves otherwise.
7. KDS writes excluded unless permission proves otherwise.

REQUIRED OUTPUT FILES

Create:

1. ai/SUPERVISOR_UI_REPO_VERIFICATION_REPORT.md
2. ai/SUPERVISOR_UI_GAP_CONFIRMATION_MATRIX.md

Update only with evidence:

3. docs/supervisor-ui-docs/SUPERVISOR_API_MATRIX.md
4. docs/supervisor-ui-docs/SUPERVISOR_GAP_REGISTER.md
5. ai/SUPERVISOR_UI_IMPLEMENTATION_ROADMAP.md

VALIDATION

Run:

corepack pnpm@8.15.0 --version

If safe:

corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate

Do not run migrations.
Do not run seed.
Do not import demo data.
Do not start duplicate servers.

FINAL RESPONSE FORMAT

Return exactly:

1. Context snapshot
2. Repo path confirmed
3. Search depth summary
4. Supervisor identity/auth findings
5. Supervisor permission findings
6. Floor/table findings
7. Orders/resolution findings
8. Reservations findings
9. Approvals/refund/discount/void findings
10. Punch/workforce findings
11. Receipts/device/caveat findings
12. Demo-data readiness
13. Docs updated
14. Validation performed
15. Go/no-go recommendation
16. Recommended next prompt
17. DONE checks
```
