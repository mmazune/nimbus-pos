# Demo Login Credentials

Local demo endpoints:

- API: `http://localhost:3001`
- Web: `http://localhost:3000`
- Login screen: `http://localhost:3000/login`

All accounts below are synthetic and local-demo only. Passwords and PINs are demo values, not provider credentials.

| Role | Display name | Email | Password | Quick PIN | PIN tier | Branch | Branch code | Branch ID | Expected route | Notes |
| ---- | ------------ | ----- | -------- | --------- | -------- | ------ | ----------- | --------- | -------------- | ----- |
| Owner | Amina Kato | owner@nimbus.demo | Demo1234! | Not enabled | HIGH_8 | Tapas Downtown | TAPAS_DOWNTOWN | cb27be401a2c35dfc0d4e610 | API auth context only | Owner workspace UI is not implemented in this MVP. |
| Manager | Daniel Okello | manager@nimbus.demo | Demo1234! | 11223344 | HIGH_8, 8 digits | Tapas Downtown | TAPAS_DOWNTOWN | cb27be401a2c35dfc0d4e610 | API auth context only | Quick PIN validates; manager workspace UI is not implemented in this MVP. |
| Accountant | Grace Nabirye | accountant@nimbus.demo | Demo1234! | Not enabled | HIGH_8 | Tapas Downtown | TAPAS_DOWNTOWN | cb27be401a2c35dfc0d4e610 | API auth context only | Accounting data is verified through DB/API. |
| Supervisor | Peter Mugisha | supervisor@nimbus.demo | Demo1234! | 22334455 | HIGH_8, 8 digits | Tapas Downtown | TAPAS_DOWNTOWN | cb27be401a2c35dfc0d4e610 | /supervisor/floor | Quick PIN validates; supervisor workspace (Floor / Reservations / Approvals / Me) is implemented. |
| Cashier | Sarah Namutebi | cashier@nimbus.demo | Demo1234! | 135790 | LOW_6, 6 digits | Tapas Downtown | TAPAS_DOWNTOWN | cb27be401a2c35dfc0d4e610 | /cashier/floor | Quick PIN validates; cashier workspace (Floor / Till / Me) is implemented — read-only settlement through Prompt C2. |
| Waiter | Brian Kisekka | waiter@nimbus.demo | Demo1234! | 246810 | LOW_6, 6 digits | Tapas Downtown | TAPAS_DOWNTOWN | cb27be401a2c35dfc0d4e610 | /waiter/floor | Recommended primary waiter demo account. Active shift `DEMO-WAITER-OPEN`. |
| Chef | Moses Kigozi | chef@nimbus.demo | Demo1234! | 357913 | LOW_6, 6 digits | Tapas Downtown | TAPAS_DOWNTOWN | cb27be401a2c35dfc0d4e610 | API auth context only | Kitchen workspace UI is not implemented in this MVP. |
| Bartender | Irene Akello | bartender@nimbus.demo | Demo1234! | 468024 | LOW_6, 6 digits | Rooftop Bar | ROOFTOP_BAR | c1f953ca4a21f8e0ba97abdd | API auth context only | Quick PIN validates for Rooftop Bar. |
| Stock Manager | David Muwanga | stockmanager@nimbus.demo | Demo1234! | 579135 | LOW_6, 6 digits | Tapas Downtown | TAPAS_DOWNTOWN | cb27be401a2c35dfc0d4e610 | API auth context only | Inventory data is verified through DB/API. |
| Seed Owner | Demo Owner | owner@demo.local | Owner#123 | Not enabled | Not enabled | Main Branch | MAIN | cmqlcjlo700umwp6lodyywf56 | API auth context only | Original seed account preserved. |
| Seed Manager | Demo Manager | manager@demo.local | Manager#123 | 12345678 | HIGH_8, 8 digits | Main Branch | MAIN | cmqlcjlo700umwp6lodyywf56 | API auth context only | Original seed account preserved. |
| Seed Cashier | Demo Cashier | cashier@demo.local | Cashier#123 | 654321 | LOW_6, 6 digits | Main Branch | MAIN | cmqlcjlo700umwp6lodyywf56 | API auth context only | Original seed account preserved. |
| Seed Waiter | Demo Waiter | waiter@demo.local | Waiter#123 | 123456 | LOW_6, 6 digits | Main Branch | MAIN | cmqlcjlo700umwp6lodyywf56 | /waiter/floor | Original seed fallback waiter preserved. |
| Seed Chef | Demo Chef | chef@demo.local | Chef#123 | Not enabled | Not enabled | Main Branch | MAIN | cmqlcjlo700umwp6lodyywf56 | API auth context only | Original seed account preserved. |

## Recommended Waiter Demo

1. Open `http://localhost:3000/login`.
2. Select Quick PIN mode.
3. Use branch `Tapas Downtown`.
4. Enter PIN `246810`.
5. Click **Enter**.
6. Expected landing route: `/waiter/floor`.

Email/password fallback:

1. Open `http://localhost:3000/login`.
2. Select email/password mode.
3. Sign in with `waiter@nimbus.demo` / `Demo1234!`.
4. Expected landing route: `/waiter/floor`.

## Known Limitations

- Waiter, Cashier, and Supervisor each have an implemented operational workspace and land on their own Floor route.
- Owner, Manager, Accountant, Chef, Bartender, and Stock Manager authenticate and return roles/permissions from `/api/auth/me`, but their role-specific workspaces are not implemented yet.
- Printer routes are metadata only and do not invoke print drivers.
- Payment terminal devices are stubs only and do not invoke acquirer/card-terminal traffic.
- Receipt send remains pending/no-adapter and does not deliver email, SMS, or WhatsApp.
- Public diner mobile-money remains `CRITICAL - PENDING MTN/AIRTEL PROVIDER CONFIRMATION`.

## Reset And Safety

Demo actions write only to the local demo database configured for this repo. To reset local demo state, rerun the normal seed/import flow after confirming the database URL is local/demo-safe. Do not point the importer, seed, API, or web app at a production database.
