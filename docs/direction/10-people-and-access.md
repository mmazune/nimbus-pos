# 10 — People and access (26 Nov 2026, track T4)

How each person gets into Nimbus, what they may do, and where today's seed differs from the rules.
No code was changed for this file. The machine-readable twin is `rights-matrix.json` (314 keys: who
holds each today, and the proposed holders for a later seed).
Sources: `01-decisions.md` (R14), `07-scenarios-and-rules.md` (People, Money, Sensitive actions),
`03-stock-stores-availability.md` section 11; today's state read from a database seeded by
`packages/db/prisma/seed.ts` at E1 (`19e1eee`) and from the API source. Grades: **[live]** run here,
**[code]** read in the source.

## 1. How each person is created

| Role | How the person is created today | Signs in with |
|---|---|---|
| Owner | Made when the organisation is made: `POST /api/orgs` gives the person who creates it a membership with the Owner role (`tenancy.service.ts:139-143`); the client onboarding wizard (`/api/onboarding/…`, `onboarding:write`) completes the set-up. The seed makes demo owners. [code] | email + password (no PIN: `EXCLUDED_FROM_QUICK_PIN`, `quick-pin.constants.ts:40`) |
| Manager, Accountant | Invited by email: `POST /api/onboarding/invitations` (`onboarding:invitation:write`, Owner and Manager); the person accepts with a token, `POST /api/auth/invitations/accept`, and sets their own password. Only these two roles can be invited (`client-onboarding.service.ts:30`). [code] | email + password; Manager also an 8-digit PIN; Accountant no PIN |
| Supervisor | `POST /api/hr/frontline-staff/onboard` with `roleName: "Supervisor"` (`hr:frontline-staff:create`, Owner and Manager). The route takes any active role by name (`frontline-staff-onboarding.service.ts:59-63`) and refuses a PIN only for a role not eligible for one (`:88-95`); a supervisor's 8-digit PIN is issued by a manager. [code] | 8-digit PIN on the POS, or email + password |
| Cashier, Waiter, Bartender, Chef, Store keeper (role "Stock Manager") | `POST /api/hr/frontline-staff/onboard`: one call makes the user, the employee, the membership and, for these PIN-first roles (`FRONTLINE_PIN_FIRST_ROLES`), a 6-digit PIN. [code] | 6-digit PIN on `POS_DESKTOP` (`quick-pin-login`) |

Every person is a `User` (sign-in) plus an `Employee` (the HR record) plus one `Membership` per branch
(role, default branch). There is **no separate store-keeper role**: "store keeper" is the seeded
role *Stock Manager* (`JobRole.STOCK_MANAGER`).

## 2. How a PIN is issued and reset

**The rule** (`07-scenarios-and-rules.md`, People; R18 of the long-run rules): "A manager sends a
reset; nobody ever sets or sees another person's PIN." The prompt adds: **by token only**.

**Today it is not by token** [code]:
- Onboarding returns the new person's PIN **to the manager who onboarded them**, once
  (`frontline-staff-onboarding.service.ts:273-282`, `:364`).
- `POST /api/hr/frontline-staff/:id/quick-pin/reset` and `POST /api/auth/users/:id/reset-quick-pin`
  and `issue-quick-pin` return a fresh PIN **to the caller**, once (`frontline-staff-quick-pin.service.ts:26`, `:231`;
  `quick-pin.service.ts` `issueQuickPin` returns `pin`). The manager sees the PIN and hands it over.
- Passwords already work the right way: `forgot-password` / manager credential reset
  (`POST /api/hr/employees/:id/credential-reset`) make a one-time `prt_…` token; the person sets
  their own password with `reset-password`. `07` marks PIN reset "exists"; for PINs that is wrong.

**Ruling (for track T2):** PINs follow the password pattern. The manager's action makes a one-time,
short-lived **PIN-setup token** for that person (shown as a link or a short code to pass on, never the
PIN); the person opens it on the POS and types their own PIN twice; the server checks the tier length
and branch uniqueness (the lookup hash is per branch). The PIN is never in any response, log or audit
row. Onboarding makes the same token instead of a PIN. Until T2 builds it, the demo venue loader
draws PINs at random and shows them once in the terminal (test data only).

## 3. What a profile holds [code]

- **User**: email, names, display name (`First L.` on the floor), avatar, password hash, PIN state
  (hash, per-branch lookup hash, length, tier, enabled, issued at/by, failed attempts, locked until),
  `mustChangePassword`, active flag. Read back by `GET /api/me` / `/api/auth/me`.
- **Employee**: employee code, names, phone, email, date of birth, hire date, status
  (ACTIVE / ON_LEAVE / SUSPENDED / TERMINATED), employment type, position, compensation profile,
  emergency contact, address, notes. The safe list projection (`hr/employee-projection.ts`) hides the
  private fields; `?view=full` needs `pos:hr:compensation:read`.
- **Membership**: branch, role, default branch, status.
- Not held anywhere yet: a person's station or store (needed by section 11's "their station", "their
  store"), and an own-payslip view (see R14 breach 2).

## 4. What starts and ends a shift [code]

- Start: `POST /api/shifts/open` (`pos:shift:open`); one open shift per person per branch
  (`shifts.service.ts:38`). End: `POST /api/shifts/:id/close` (`pos:shift:close`).
- A **waiter** must have an open shift to write orders (`orders.service.ts:109-128`, 409
  `SHIFT_NOT_OPEN`); other roles are not checked. Reading works off shift, as `07` says.
- The till is a separate session inside a shift (`POST /api/tills/…`, `pos:till:open`), counted and
  reconciled at the end (`pos:till:reconcile`).
- **Gap**: Chef, Bartender and Store keeper hold no `pos:shift:open` / `pos:shift:close`, so they
  cannot "Start my shift" (`07`, Opening). Ruled below: grant.
- Not built: end of shift blocked while the waiter still has open tables (`07` People, E3/U4).

## 5. Rights each role holds today, against the rules

Counts are permission keys held in the seeded database [live]; "proposed" applies every ruling in
this file (`rights-matrix.json`).

| Role | today | proposed | where today differs from the rules |
|---|---|---|---|
| Owner | 277 | 304 | Holds every seeded right except the two that are not role rights (section 7); gains the 27 venue keys of section 6. |
| Manager | 261 | 303 | **R14 breach 1**: lacks 15 seeded rights beyond `pos:hr:compensation:read` (section 7). Gains them and the 27 venue keys of section 6. |
| Supervisor | 134 | 120 | **R14 breach 2**: five payroll rights. Takes payment (`pos:orders:close`, `pos:payment:close`, `create`, `intent`, `manual-reference`, `cancel`; `01` waiting point 2 defaults to no; keeps `pos:payment:override` for the 07 method change by PIN). Writes recipes and holds `pos:inventory:write` and `pos:cost:read` (section 11: no). Keeps void of a sent line, discount approve, refund approve, `pos:inventory:adjust` (take out of stock; the PIN-above-a-limit rule is E6). |
| Cashier | 63 | 61 | **R14 breach 2**: `pos:payroll:slips:read` (branch-wide payslips). Can create a refund (`07`: same day supervisor, later manager). |
| Waiter | 51 | 43 | **R14 breach 2**: `pos:payroll:slips:read`. Holds payment and till rights (`pos:payment:create`, `intent`, `manual-reference`, `pos:till:open`, `pos:till:reconcile`, `pos:till:safe-drop`) and `pos:refund:create`; R5/R9 give a waiter Send and Print bill only. Can lower a sent line's quantity on their own order through the item edit (R-E1 B1, probe P22b as a waiter with an open shift [live]), a void without the right. |
| Bartender | 17 | 20 | No shift rights; cannot see recipes (section 11: see). Station-scoped stock actions (sold out, take out, ask the store) have no keys yet (E2, E6, E7). |
| Chef | 19 | 20 | No shift rights; holds `pos:cost:read` (section 11: chefs do not see cost or margin). Same missing station keys as bartender. |
| Store keeper (Stock Manager) | 7 | 9 | No shift rights. Holds inventory read/write/adjust for every store: section 11 says "their store"; store scoping needs a store on the membership (E7). |
| Accountant | 113 | 118 | Cannot see cost or margin (`pos:cost:read`) or recipes; section 11 says yes and see. Gains consolidated franchise finance and merchant payment status. |
| Procurement, Event Manager | 4, 17 | unchanged | Not in this rebuild's role list; left as seeded. |

Every key that changes, with today's and the proposed holders:

| key | today | proposed | why |
|---|---|---|---|
| `alerts:channel:write` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. |
| `flags:audit:read` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. |
| `flags:write` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. |
| `idempotency:inspect` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. |
| `identity:access-matrix:write` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. |
| `maintenance:write` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. |
| `owner:live:read` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. |
| `pos:cost:read` | Owner, Manager, Supervisor, Chef | Owner, Manager, Accountant | 03 section 11: set a cost, see margin: manager (see) and accountant (yes); not chef or supervisor. |
| `pos:dash:owner:read` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. |
| `pos:documents:storage-config:update` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. |
| `pos:hr:attendance-policy:create` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. |
| `pos:hr:attendance-policy:update` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. |
| `pos:hr:compensation:create` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. (Owner-only today; owner to confirm, see the R14 section.) |
| `pos:inventory:write` | Owner, Manager, Supervisor, Stock Manager | Owner, Manager, Stock Manager | 03 section 11: issue, receive, count and set minimums: store keeper and manager; not supervisor. |
| `pos:orders:close` | Owner, Manager, Supervisor, Cashier | Owner, Manager, Cashier | Payment is taken by cashier and manager: R5/R9 give a waiter Send and Print bill; 01-decisions waiting point 2 (a supervisor takes payment) defaults to no. Supervisor keeps pos:payment:override (07: change a payment method by supervisor PIN before the count). |
| `pos:payment:cancel` | Owner, Manager, Supervisor, Cashier | Owner, Manager, Cashier | Payment is taken by cashier and manager: R5/R9 give a waiter Send and Print bill; 01-decisions waiting point 2 (a supervisor takes payment) defaults to no. Supervisor keeps pos:payment:override (07: change a payment method by supervisor PIN before the count). |
| `pos:payment:close` | Owner, Manager, Supervisor, Cashier | Owner, Manager, Cashier | Payment is taken by cashier and manager: R5/R9 give a waiter Send and Print bill; 01-decisions waiting point 2 (a supervisor takes payment) defaults to no. Supervisor keeps pos:payment:override (07: change a payment method by supervisor PIN before the count). |
| `pos:payment:create` | Owner, Manager, Supervisor, Cashier, Waiter | Owner, Manager, Cashier | Payment is taken by cashier and manager: R5/R9 give a waiter Send and Print bill; 01-decisions waiting point 2 (a supervisor takes payment) defaults to no. Supervisor keeps pos:payment:override (07: change a payment method by supervisor PIN before the count). |
| `pos:payment:intent` | Owner, Manager, Supervisor, Cashier, Waiter | Owner, Manager, Cashier | Payment is taken by cashier and manager: R5/R9 give a waiter Send and Print bill; 01-decisions waiting point 2 (a supervisor takes payment) defaults to no. Supervisor keeps pos:payment:override (07: change a payment method by supervisor PIN before the count). |
| `pos:payment:manual-reference` | Owner, Manager, Supervisor, Cashier, Waiter | Owner, Manager, Cashier | Payment is taken by cashier and manager: R5/R9 give a waiter Send and Print bill; 01-decisions waiting point 2 (a supervisor takes payment) defaults to no. Supervisor keeps pos:payment:override (07: change a payment method by supervisor PIN before the count). |
| `pos:payroll:adjustments:create` | Owner, Manager, Supervisor | Owner, Manager | R14: payroll is finance; Supervisor never holds it. |
| `pos:payroll:adjustments:read` | Owner, Manager, Supervisor, Accountant | Owner, Manager, Accountant | R14: payroll is finance; Supervisor never holds it. |
| `pos:payroll:components:read` | Owner, Manager, Supervisor, Accountant | Owner, Manager, Accountant | R14: payroll is finance; Supervisor never holds it. |
| `pos:payroll:runs:pay` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. |
| `pos:payroll:runs:read` | Owner, Manager, Supervisor, Accountant | Owner, Manager, Accountant | R14: payroll is finance; Supervisor never holds it. |
| `pos:payroll:slips:read` | Owner, Manager, Supervisor, Cashier, Waiter, Accountant | Owner, Manager, Accountant | R14 and privacy: the list is branch-wide (payroll.service.ts listPaySlips), so a waiter reads everyone's pay (probe A1, live). Frontline roles get an own-payslip route later instead (T2). |
| `pos:recipe:read` | Owner, Manager, Supervisor, Chef | Owner, Manager, Supervisor, Bartender, Chef, Accountant | 03 section 11: recipes: chef and bartender see, accountant sees, manager yes. |
| `pos:recipe:write` | Owner, Manager, Supervisor | Owner, Manager | 03 section 11: recipes are written by the manager only. |
| `pos:refund:create` | Owner, Manager, Supervisor, Cashier, Waiter | Owner, Manager, Supervisor | 07 Money: refund after close: same day supervisor, later manager. Not waiter or cashier. |
| `pos:shift:close` | Owner, Manager, Supervisor, Cashier, Waiter | Owner, Manager, Supervisor, Cashier, Waiter, Bartender, Chef, Stock Manager | 07 Opening: staff start work with PIN, then 'Start my shift'. Chef, bartender and store keeper cannot today. |
| `pos:shift:open` | Owner, Manager, Supervisor, Cashier, Waiter | Owner, Manager, Supervisor, Cashier, Waiter, Bartender, Chef, Stock Manager | 07 Opening: staff start work with PIN, then 'Start my shift'. Chef, bartender and store keeper cannot today. |
| `pos:staff:weights:update` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. |
| `pos:till:open` | Owner, Manager, Supervisor, Cashier, Waiter | Owner, Manager, Supervisor, Cashier | R5/R9: a waiter sends and prints the bill; payment, refunds and the till belong to cashier, supervisor (refund same day) and manager. |
| `pos:till:reconcile` | Owner, Manager, Supervisor, Cashier, Waiter | Owner, Manager, Supervisor, Cashier | R5/R9: a waiter sends and prints the bill; payment, refunds and the till belong to cashier, supervisor (refund same day) and manager. |
| `pos:till:safe-drop` | Owner, Manager, Supervisor, Cashier, Waiter | Owner, Manager, Supervisor, Cashier | R5/R9: a waiter sends and prints the bill; payment, refunds and the till belong to cashier, supervisor (refund same day) and manager. |
| `tenancy:org:write` | Owner | Owner, Manager | R14: Manager has every right except pos:hr:compensation:read. |

## 6. The keys guards use that the seed never grants

`@Permissions(…)` in `apps/api/src` names **301 keys**; **36** of them are held by no role [live]:
**35 have no permission row at all** (the 35 the prompt names) and `hms:read:*` has a row but no
grant. Every route behind them answers 403 to every role, Owner included; that is the cause of 59 red
e2e tests (`docs/reviews/e2e-baseline.md` F1). Ruling for each:

| # | key | endpoints behind it | ruling: grant to |
|---|---|---|---|
| 1 | `billing:pesapal:checkout` | `POST /api/billing/pesapal/checkout-session`<br>`POST /api/billing/pesapal/reconcile-status` | Owner, Manager — The venue's own Nimbus subscription. Owner, and Manager under R14. |
| 2 | `billing:read` | `GET /api/billing`<br>`GET /api/billing/plans`<br>`GET /api/dev/admins` | Owner, Manager — The venue's own Nimbus subscription. Owner, and Manager under R14. |
| 3 | `billing:subscription:write` | `PATCH /api/billing/subscription` | Owner, Manager — The venue's own Nimbus subscription. Owner, and Manager under R14. |
| 4 | `dev:api-key:read` | `GET /api/dev/api-keys` | Owner, Manager — Developer portal: API keys and webhooks give outside systems the venue's data. Owner, and Manager under R14. Unblocks the bg7 HMS suite, which creates its key with dev:api-key:write. |
| 5 | `dev:api-key:write` | `POST /api/dev/api-keys`<br>`POST /api/dev/api-keys/:id/revoke` | Owner, Manager — Developer portal: API keys and webhooks give outside systems the venue's data. Owner, and Manager under R14. Unblocks the bg7 HMS suite, which creates its key with dev:api-key:write. |
| 6 | `dev:usage:read` | `GET /api/dev/usage` | Owner, Manager — Developer portal: API keys and webhooks give outside systems the venue's data. Owner, and Manager under R14. Unblocks the bg7 HMS suite, which creates its key with dev:api-key:write. |
| 7 | `dev:webhook:read` | `GET /api/dev/webhooks` | Owner, Manager — Developer portal: API keys and webhooks give outside systems the venue's data. Owner, and Manager under R14. Unblocks the bg7 HMS suite, which creates its key with dev:api-key:write. |
| 8 | `dev:webhook:write` | `POST /api/dev/webhooks`<br>`PATCH /api/dev/webhooks/:id` | Owner, Manager — Developer portal: API keys and webhooks give outside systems the venue's data. Owner, and Manager under R14. Unblocks the bg7 HMS suite, which creates its key with dev:api-key:write. |
| 9 | `franchise:analytics:read` | `GET /api/franchise/consolidated-finance`<br>`GET /api/franchise/financial-comparison`<br>`GET /api/franchise/drilldown` | Owner, Manager, Accountant — Consolidated finance across branches: Owner, Manager (R14), and Accountant (accounting). |
| 10 | `franchise:budget:read` | `GET /api/franchise/budgets` | Owner, Manager — Multi-branch view. Owner, and Manager under R14. |
| 11 | `franchise:consolidation:generate` | `POST /api/franchise/consolidated-finance/generate` | Owner, Manager, Accountant — Consolidated finance across branches: Owner, Manager (R14), and Accountant (accounting). |
| 12 | `franchise:digest:read` | `GET /api/franchise/digests` | Owner, Manager — Multi-branch view. Owner, and Manager under R14. |
| 13 | `franchise:digest:write` | `POST /api/franchise/digests`<br>`PATCH /api/franchise/digests/:id` | Owner, Manager — Multi-branch writes. Owner, and Manager under R14. |
| 14 | `franchise:overview:read` | `GET /api/franchise/overview`<br>`GET /api/franchise/procurement-pressure` | Owner, Manager — Multi-branch view. Owner, and Manager under R14. |
| 15 | `franchise:ranking:generate-deep` | `POST /api/franchise/rankings/generate-deep` | Owner, Manager — Multi-branch writes. Owner, and Manager under R14. |
| 16 | `franchise:ranking:read` | `GET /api/franchise/rankings`<br>`POST /api/franchise/rankings/generate` | Owner, Manager — Multi-branch view. Owner, and Manager under R14. |
| 17 | `franchise:scorecard:read` | `GET /api/franchise/scorecards`<br>`POST /api/franchise/scorecards/generate` | Owner, Manager — Multi-branch view. Owner, and Manager under R14. |
| 18 | `franchise:transfer:approve` | `PATCH /api/franchise/transfers/:id/status` | Owner, Manager — Multi-branch writes. Owner, and Manager under R14. |
| 19 | `franchise:transfer:read` | `GET /api/franchise/transfers`<br>`GET /api/franchise/transfers/:id` | Owner, Manager — Multi-branch view. Owner, and Manager under R14. |
| 20 | `franchise:transfer:write` | `POST /api/franchise/transfers` | Owner, Manager — Multi-branch writes. Owner, and Manager under R14. |
| 21 | `franchise:waste-benchmark:read` | `GET /api/franchise/waste-benchmarks`<br>`POST /api/franchise/waste-benchmarks/generate` | Owner, Manager — Multi-branch view. Owner, and Manager under R14. |
| 22 | `hms:read:*` (row, no grant) | `GET /api/hms/whoami`<br>`GET /api/hms/access-logs`<br>`GET /api/hms/organization`<br>`GET /api/hms/branches`<br>`GET /api/hms/orders`<br>`GET /api/hms/orders/:id`<br>`GET /api/hms/payments`<br>`GET /api/hms/refunds`<br>`GET /api/hms/sales/summary`<br>`GET /api/hms/reservations`<br>`GET /api/hms/events`<br>`GET /api/hms/event-bookings`<br>`GET /api/hms/menu`<br>`GET /api/hms/inventory`<br>`GET /api/hms/shifts`<br>`GET /api/hms/accounting/accounts`<br>`GET /api/hms/accounting/invoices`<br>`GET /api/hms/accounting/vendor-bills` | **no role** — undefined |
| 23 | `merchant:events:write` | `POST /api/merchant/events`<br>`PATCH /api/merchant/events/:id`<br>`PATCH /api/merchant/events/:id/publish`<br>`PATCH /api/merchant/events/:id/capacity`<br>`PATCH /api/merchant/events/:id/pricing` | Owner, Manager — The venue's payment-provider link, public page and public events. Owner, and Manager under R14. |
| 24 | `merchant:payment:read` | `GET /api/merchant/payments/status` | Owner, Manager, Accountant — Which payment provider the venue is connected to: Owner, Manager, Accountant (read). |
| 25 | `merchant:payment:write` | `POST /api/merchant/payments/connect`<br>`PATCH /api/merchant/payments/config`<br>`POST /api/merchant/payments/pesapal/connect`<br>`PATCH /api/merchant/payments/pesapal/config` | Owner, Manager — The venue's payment-provider link, public page and public events. Owner, and Manager under R14. |
| 26 | `merchant:public-profile:write` | `PATCH /api/merchant/public-profile`<br>`PATCH /api/merchant/public-profile/publish`<br>`PATCH /api/merchant/booking-settings` | Owner, Manager — The venue's payment-provider link, public page and public events. Owner, and Manager under R14. |
| 27 | `ops:customers:read` | `GET /api/ops/customers`<br>`GET /api/ops/customers/:orgId` | **no role** — Nimbus's own operator portal across ALL customers. No venue role may hold it: granting it to a venue Manager would show every other customer. Remove it from the role permissions model and gate these routes by the platform-operator guard (common/guards/platform-access.guard.ts) instead (track T2). |
| 28 | `ops:merchant-payments:read` | `GET /api/ops/merchant-payments/status` | **no role** — Nimbus's own operator portal across ALL customers. No venue role may hold it: granting it to a venue Manager would show every other customer. Remove it from the role permissions model and gate these routes by the platform-operator guard (common/guards/platform-access.guard.ts) instead (track T2). |
| 29 | `ops:onboarding:read` | `GET /api/ops/onboarding/pipeline` | **no role** — Nimbus's own operator portal across ALL customers. No venue role may hold it: granting it to a venue Manager would show every other customer. Remove it from the role permissions model and gate these routes by the platform-operator guard (common/guards/platform-access.guard.ts) instead (track T2). |
| 30 | `ops:plans:read` | `GET /api/ops/plans`<br>`GET /api/ops/plans/:id/subscribers` | **no role** — Nimbus's own operator portal across ALL customers. No venue role may hold it: granting it to a venue Manager would show every other customer. Remove it from the role permissions model and gate these routes by the platform-operator guard (common/guards/platform-access.guard.ts) instead (track T2). |
| 31 | `ops:plans:write` | `POST /api/ops/plans`<br>`PATCH /api/ops/plans/:id`<br>`PATCH /api/ops/plans/:id/status` | **no role** — Nimbus's own operator portal across ALL customers. No venue role may hold it: granting it to a venue Manager would show every other customer. Remove it from the role permissions model and gate these routes by the platform-operator guard (common/guards/platform-access.guard.ts) instead (track T2). |
| 32 | `ops:subscriptions:read` | `GET /api/ops/subscriptions/due`<br>`GET /api/ops/subscriptions/grace-period` | **no role** — Nimbus's own operator portal across ALL customers. No venue role may hold it: granting it to a venue Manager would show every other customer. Remove it from the role permissions model and gate these routes by the platform-operator guard (common/guards/platform-access.guard.ts) instead (track T2). |
| 33 | `ops:support:read` | `GET /api/ops/support/sessions` | **no role** — Nimbus's own operator portal across ALL customers. No venue role may hold it: granting it to a venue Manager would show every other customer. Remove it from the role permissions model and gate these routes by the platform-operator guard (common/guards/platform-access.guard.ts) instead (track T2). |
| 34 | `ops:support:write` | `POST /api/ops/support/sessions`<br>`PATCH /api/ops/support/sessions/:id/close` | **no role** — Nimbus's own operator portal across ALL customers. No venue role may hold it: granting it to a venue Manager would show every other customer. Remove it from the role permissions model and gate these routes by the platform-operator guard (common/guards/platform-access.guard.ts) instead (track T2). |
| 35 | `support:session:read` | `GET /api/support/sessions` | Owner, Manager — The venue opening or reading a Nimbus support session on its own data. Owner, and Manager under R14. |
| 36 | `support:session:write` | `POST /api/support/sessions`<br>`PATCH /api/support/sessions/:id/close` | Owner, Manager — The venue opening or reading a Nimbus support session on its own data. Owner, and Manager under R14. |

So: **27 keys are granted** (Owner and Manager; Accountant also on 3 finance keys), **8 `ops:*` keys
are removed from the role model** and moved behind the platform-operator guard (Nimbus staff, not a
venue), and `hms:read:*` stays an API-key scope. No endpoint is ruled for deletion: every one of them
belongs to a module the roadmap keeps (billing, developer portal, franchise, public commerce).

## 7. R14, line by line, against the seed as it stands [live]

R14: "Manager has full access (owner, 21 Aug 2026) except `pos:hr:compensation:read`. Waiter,
cashier and supervisor never get accounting or procurement rights."

**Line 1 — Manager has every right except `pos:hr:compensation:read`. Breached.** Of 279 seeded
permission rows Manager lacks 18. One is the allowed exception; two are not role rights at all
(`hms:read:*`, an API-key scope; `pos:feedback:public:token:read`, a public no-auth lookup that
nobody holds). The other **15 are breaches**, each held today by Owner only:

| key | held today by |
|---|---|
| `alerts:channel:write` | Owner |
| `flags:audit:read`, `flags:write` | Owner |
| `idempotency:inspect` | Owner |
| `identity:access-matrix:write` | Owner |
| `maintenance:write` | Owner |
| `owner:live:read`, `pos:dash:owner:read` | Owner |
| `pos:documents:storage-config:update` | Owner |
| `pos:hr:attendance-policy:create`, `pos:hr:attendance-policy:update` | Owner |
| `pos:hr:compensation:create` | Owner (⚠ creating pay records without being able to read them is odd; the matrix grants it per R14's letter; the owner should confirm or widen the exception to all of `pos:hr:compensation:*`) |
| `pos:payroll:runs:pay` | Owner |
| `pos:staff:weights:update` | Owner |
| `tenancy:org:write` | Owner |

Also against line 1: the 27 venue keys of section 6 have no row, so Manager (and Owner) cannot hold them.

**Line 2 — Waiter, cashier and supervisor never get accounting or procurement rights. Breached
through payroll.** Checked two ways [live]: by key name (no frontline role holds any `accounting:*`,
`pos:accounting:*`, `finance:*`, `procurement:*`, AP, AR, bank, budget, ledger or supplier key), and by
module: every key that guards a route in `accounting`, `accounts-payable`, `accounts-receivable`,
`bank-rec`, `budget`, `ledger` and `payroll` (65 keys), and every route whose path names a supplier,
purchase, vendor or cost, intersected with the Waiter, Cashier and Supervisor grants. The only hits
are the payroll keys below and Supervisor's `pos:cost:read` (the recipe cost route
`/api/recipes/:menuItemId/cost`; ruled off under section 11). Payroll is finance, and they hold:

| role | payroll keys |
|---|---|
| Supervisor | `pos:payroll:adjustments:create`, `pos:payroll:adjustments:read`, `pos:payroll:components:read`, `pos:payroll:runs:read`, `pos:payroll:slips:read` |
| Cashier | `pos:payroll:slips:read` |
| Waiter | `pos:payroll:slips:read` |

`pos:payroll:slips:read` is the worst: `GET /api/payroll/slips` and `/payslips` are scoped to the
branch, not to the caller (`payroll.service.ts:597-616`), so a waiter or cashier lists **everyone's**
payslips. Probe `A1` in `apps/api/test/e1-review.probes.e2e-spec.ts`: Waiter 200, Cashier 200 (should
be 403) [live].

**Line 2 against procurement suggestions:** `procurement:advisory:read` is held by Accountant,
Manager and Owner only. Holds [live].

## 8. Rights the rules name that have no key yet

These belong to milestones not built; they are not in `rights-matrix.json` because no key exists to
grant. A later seed adds them with the holders shown.

| Right (rule) | Holders | Milestone |
|---|---|---|
| Mark sold out, set a count, "We have it" (section 11) | Chef, bartender (their station), Supervisor, Manager | E2 |
| Take out of stock (section 11) | Chef, bartender, store keeper (their store), Supervisor with PIN above a limit, Manager | E6 |
| Ask the store, receive (section 11) | Chef, bartender (their store), Manager | E7 |
| Change a line's price, reopen a paid bill, change a payment method (07 Sensitive) | Supervisor by PIN | E9, E13 |
| Open item above the cap (07 Ordering) | Supervisor by PIN | E13 |
| On the house / staff meal (07 Money) | Supervisor, Manager | E13 |
| Walk-out (07 Money) | Manager | E13 |
| Open the drawer, no sale (07 Sensitive) | Cashier | E13 |
| Own payslip (replaces branch-wide `pos:payroll:slips:read`) | every employee, own only | T2 |

## 9. For track T2

- PIN setup and reset by token (section 2).
- Gate `/api/ops/*` by the platform-operator guard, not by role keys (section 6).
- `GET /api/payroll/slips`: own slips only for anyone without a payroll-admin key (section 7, A1).
- Store and station on the membership, so "their store" and "their station" can be enforced (E2, E6, E7).
- The seed change itself is a separate, authorised step: apply `rights-matrix.json`'s `proposed`
  holders, add the 27 missing permission rows, and re-run the e2e suite (F1's 59 tests should turn
  green, attendance F2 is unrelated).
