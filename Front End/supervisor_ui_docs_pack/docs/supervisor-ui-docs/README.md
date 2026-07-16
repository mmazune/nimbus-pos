# Nimbus POS Supervisor UI Docs

Status: Draft v1  
Date: 2026-07-03

This folder contains the Supervisor UI research and design documentation pack.

## Files

| File | Purpose |
|---|---|
| `AGENTS.md` | Agent contract and implementation boundaries |
| `DESIGN.md` | Supervisor-specific design extension |
| `supervisor_design.md` | Product design decisions and role thesis |
| `supervisorui.md` | Screen-by-screen blueprint |
| `SUPERVISOR_LIFECYCLE.md` | End-to-end Supervisor lifecycle |
| `SUPERVISOR_API_MATRIX.md` | Initial API matrix requiring live repo verification |
| `SUPERVISOR_GAP_REGISTER.md` | Open gaps, caveats, and verification checklist |

## Approved nav

```txt
Floor · Orders · Reservations · Approvals · Me
```

## Recommended next step

Run the live repo verification prompt before coding UI. The first implementation prompt must not start until exact Supervisor credentials, permissions, DTOs, and demo fixtures are verified.

## Locked caveats

- MTN/Airtel live diner checkout remains pending provider confirmation.
- PesaPal is owner SaaS billing only.
- Printer routes are metadata-only.
- Card terminal pairing/acquirer traffic is stub-only.
- Receipt send is pending/no live adapter.
- Supervisor is not Manager, Cashier, Waiter, Chef, or Accountant by default.
