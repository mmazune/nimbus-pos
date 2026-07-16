# MANAGER_NAV_AND_PAGE_MAP.md — Nimbus POS Manager Navigation and Page Map

Status: Draft v1  
Date: 2026-07-06

## 1. Final recommended navigation

Bottom nav should be exactly:

```txt
Overview · Operations · Staff · Reports · Settings · Me
```

## 2. Route map

| Nav | Route | Purpose | First implementation prompt |
|---|---|---|---|
| Overview | `/manager/overview` | Branch command dashboard | Prompt 1 stub, Prompt 2 live data |
| Operations | `/manager/operations` | Read-only active service control desk | Prompt 1 stub, Prompt 3 live data |
| Staff | `/manager/staff` | Staff roster, onboarding, PIN, attendance, leave/swap reviews | Prompt 1 stub, Prompt 4 live data/actions |
| Reports | `/manager/reports` | Catalog, generation, history, exports | Prompt 1 stub, Prompt 5 live data/actions |
| Settings | `/manager/settings` | Branch profile, devices, printer routes, terminal stubs | Prompt 1 stub, Prompt 6 live data/actions |
| Me | `/manager/me` | Profile, memberships, branch context, logout | Prompt 1 stub, later polish |

## 3. Shell sections

### Header

- Brand;
- workspace label;
- active branch selector;
- organization chip;
- Manager identity;
- logout.

### Readiness strip

- branch selected;
- tills status;
- shifts status;
- pending approvals count;
- report generator health;
- device metadata health.

### Bottom nav

- six items;
- active state;
- icon and label;
- no More tab;
- accessible labels.

## 4. Page breakdown

### Overview

Sections:

1. Today KPI cards.
2. Payment mix.
3. Open orders.
4. Low stock.
5. Pending approvals.
6. Active staff/tills.
7. Live stream status.

### Operations

Sections:

1. Floor/table status.
2. Orders table.
3. Tills table.
4. Shifts table.
5. Reservations snapshot.
6. Operational exceptions.

### Staff

Sections:

1. Staff directory.
2. Staff detail drawer.
3. Frontline onboarding.
4. Quick PIN controls.
5. Attendance.
6. Leave review.
7. Shift swap review.
8. Sensitive-fields exclusion.

### Reports

Sections:

1. Catalog.
2. Generate form.
3. Runs history.
4. Report detail.
5. Export/download.
6. Generator unavailable state.

### Settings

Sections:

1. Branch profile.
2. Device registry.
3. Printer routing metadata.
4. Terminal stub pairing.
5. Alerts deferred/read-only.
6. Sync jobs deferred/read-only.
7. Owner/Admin exclusions.

### Me

Sections:

1. Profile.
2. Session.
3. Branch memberships.
4. Permission summary.
5. Restricted surfaces.
6. Logout.

## 5. Prompt sequence

### Prompt 1 — Shell / Guard / Branch Context Foundation

- Manager role redirect.
- ManagerShell.
- ManagerSessionGuard.
- Branch switcher.
- Context provider.
- Page stubs.
- Nav.

### Prompt 2 — Overview Dashboard

- Manager KPI cards.
- Today summary.
- Payment mix.
- Open orders.
- Low stock.
- Live metrics stream status.

### Prompt 3 — Operations Oversight

- Tables.
- Orders.
- Tills.
- Shifts.
- Reservations.
- Read-only detail panels.

### Prompt 4 — Staff Administration

- Employee roster.
- Onboarding.
- Quick PIN.
- Attendance.
- Leave review.
- Shift swap review.
- Sensitive field filtering.

### Prompt 5 — Reports

- Catalog.
- Generate forms.
- History.
- Detail drawer.
- Export/download states.

### Prompt 6 — Settings & Devices

- Branch profile.
- Devices.
- Printer routes.
- Terminal stubs.
- Alert/sync deferred states.

### Prompt 7 — Approval Action Hardening

- Domain-specific decision writes.
- Confirmations.
- Idempotency/in-flight.
- Audit result displays.

### Prompt 8 — Final QA

- Visual polish.
- Browser screenshots.
- Role boundary QA.
- Known limitations.
- Demo script.
