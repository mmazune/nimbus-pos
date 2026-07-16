# Demo Data QA, Login, And UI Verification Report

Date: 2026-06-30

Repo path: `C:\Users\arman\Desktop\nimbus-pos`

## Summary

Enterprise demo login QA is complete for the local database. Imported users now have the `UserRole` relationships expected by the existing auth code, so `/api/auth/me` returns flattened roles and permissions. The primary waiter demo account, `waiter@nimbus.demo`, works with email/password and Quick PIN, has an active Tapas Downtown shift, and can access protected waiter endpoints.

## Diagnosis

The imported CSV pack created memberships, but imported users did not have matching `UserRole` rows. Existing auth and tenancy code derive flattened roles and permissions from `user.userRoles`, not from memberships alone. This made `waiter@nimbus.demo` authenticate but return empty `roles` and `permissions` from `/api/auth/me`, which caused protected waiter endpoints to return 403.

No guard weakening, auth bypass, Prisma schema change, migration, or Postman change was required.

## Repair

- Added importer repair logic to create matching `UserRole` rows while importing memberships.
- Added deterministic demo Quick PIN reset logic for imported frontline users.
- Added an idempotent primary waiter active shift for `waiter@nimbus.demo` at Tapas Downtown:
  - Shift number: `DEMO-WAITER-OPEN`
  - Shift ID: `cdc18b7193198ec85c4f241c`
  - Branch ID: `cb27be401a2c35dfc0d4e610`

## Auth Smoke

All required accounts authenticated by email/password and returned non-empty permissions:

| Email | Role | Permissions | Default branch |
| ----- | ---- | ----------- | -------------- |
| owner@nimbus.demo | Owner | 235 | cb27be401a2c35dfc0d4e610 |
| manager@nimbus.demo | Manager | 214 | cb27be401a2c35dfc0d4e610 |
| accountant@nimbus.demo | Accountant | 76 | cb27be401a2c35dfc0d4e610 |
| supervisor@nimbus.demo | Supervisor | 129 | cb27be401a2c35dfc0d4e610 |
| cashier@nimbus.demo | Cashier | 62 | cb27be401a2c35dfc0d4e610 |
| waiter@nimbus.demo | Waiter | 51 | cb27be401a2c35dfc0d4e610 |
| chef@nimbus.demo | Chef | 19 | cb27be401a2c35dfc0d4e610 |
| bartender@nimbus.demo | Bartender | 17 | c1f953ca4a21f8e0ba97abdd |
| stockmanager@nimbus.demo | Stock Manager | 7 | cb27be401a2c35dfc0d4e610 |
| waiter@demo.local | Waiter | 51 | cmqlcjlo700umwp6lodyywf56 |
| manager@demo.local | Manager | 214 | cmqlcjlo700umwp6lodyywf56 |
| owner@demo.local | Owner | 235 | cmqlcjlo700umwp6lodyywf56 |
| cashier@demo.local | Cashier | 62 | cmqlcjlo700umwp6lodyywf56 |
| chef@demo.local | Chef | 19 | cmqlcjlo700umwp6lodyywf56 |

Quick PIN smoke passed for:

- `waiter@nimbus.demo` / `246810`
- `cashier@nimbus.demo` / `135790`
- `manager@nimbus.demo` / `11223344`
- `bartender@nimbus.demo` / `468024`

## Waiter UI And API Smoke

Verified local waiter demo flow with `waiter@nimbus.demo`:

- `/api/auth/login` and `/api/auth/quick-pin-login` return valid sessions.
- `/api/auth/me` returns role `Waiter` and 51 permissions.
- `/api/tables` returns seeded Tapas Downtown tables.
- `/api/pos/orders` returns seeded orders.
- `/api/reservations` returns seeded reservations.
- `/api/shifts/active` returns active shift `DEMO-WAITER-OPEN`.
- Created one clearly marked local smoke order, added a menu item with note, sent it to kitchen/bar workflow, and requested bill.
- Opened receipt data for a valid closed demo order, reprinted metadata, and confirmed send receipt returns `PENDING` / `NO_LIVE_DELIVERY_ADAPTER`.
- Seated one confirmed assigned demo reservation with active shift.
- Web routes returned HTTP 200 for `/login`, `/waiter/floor`, `/waiter/orders`, `/waiter/reservations`, and `/waiter/me`.

Browser automation was not available because Playwright is not installed in the web package, and the in-app Browser setup returned oversized/truncated documentation output. Verification used API smoke, route smoke, and login code-path inspection.

## Enterprise DB/API Verification

Current local counts include:

- Branches: 6
- Employees: 40
- Tables: 83
- Menu items: 119
- Inventory items: 204
- Recipe lines: 171
- Stock batches: 309
- Orders: 1200, including local smoke records
- Payments: 750
- Reservations: 125
- Events: 11
- Accounts: 16
- Journal entries: 42
- Vendor bills: 24
- AR invoices: 18
- Franchise consolidations: 1
- Franchise KPI snapshots: 3
- Franchise rankings: 4
- Branch performance scorecards: 12
- Devices: 16
- Printer routes: 12
- Report runs: 25
- Export artifacts: 25
- Anomaly events: 21
- Alert rules: 12
- Feature flags: 13
- Maintenance windows: 3
- Training sessions: 9

Safety checks:

- Journal entries balanced: yes
- Negative stock batches: 0
- Payment intents with provider transaction IDs: 0
- Payment terminal rows are `PAYMENT_TERMINAL_STUB`: 4
- Printer routes remain metadata only: 12
- MoMo payment rows remain pending/unverified with non-live demo metadata and provider-gated labels.

Franchise branches and scorecard/ranking rows exist. The requested backoffice/franchise/accounting/inventory UI routes were not built in this prompt; data was verified through DB/API where available.

## Validation Commands

- `corepack pnpm@8.15.0 --version`: passed, `8.15.0`
- `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:demo:validate`: passed, dry-run, 63 CSV files, 9,243 rows, zero DB writes
- `corepack pnpm@8.15.0 --filter @nimbus-pos/db db:generate`: passed after temporarily stopping the running API process that held the Prisma DLL, then restarting API
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck`: passed
- `corepack pnpm@8.15.0 --filter @nimbus-pos/web lint`: passed
- `GET http://localhost:3001/api/health`: passed

## Known Limitations

- Full importer write mode was slow and timed out in this environment; the critical auth/PIN/shift/franchise repairs were applied locally and the importer now contains idempotent logic for future runs.
- `/api/pos/orders?status=CLOSED&pageSize=5` returned 500 during one waiter smoke check; receipt verification used a known valid closed order directly.
- Role-specific non-waiter frontend workspaces are not implemented yet.
- Browser click automation was not available; UI routing was verified by route smoke and code path.

## Safety Preserved

- No Prisma schema changes.
- No migrations.
- No Postman changes.
- No live mobile-money enablement.
- No receipt delivery adapter faked.
- No print driver invoked.
- No terminal/acquirer traffic invoked.
- No fake provider credentials.
- No real PII added.
