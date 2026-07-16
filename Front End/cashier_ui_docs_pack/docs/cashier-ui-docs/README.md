# Cashier UI Docs — Nimbus POS

Status: Draft v1  
Date: 2026-07-01

This folder contains Codex-ready documentation for the Nimbus POS Cashier MVP frontend.

## Files

1. `AGENTS.md` — coding-agent contract and guardrails.
2. `DESIGN.md` — cashier extension of the global design system.
3. `cashier_design.md` — cashier role-specific design contract.
4. `cashierui.md` — screen-by-screen UI blueprint.
5. `CASHIER_LIFECYCLE.md` — full cashier payment/settlement/till lifecycle.
6. `CASHIER_API_MATRIX.md` — endpoint matrix and exclusions.
7. `CASHIER_GAP_REGISTER.md` — unresolved gaps and deferred/unsafe surfaces.

## Reading order

1. `AGENTS.md`
2. `DESIGN.md`
3. `cashier_design.md`
4. `cashierui.md`
5. `CASHIER_LIFECYCLE.md`
6. `CASHIER_API_MATRIX.md`
7. `CASHIER_GAP_REGISTER.md`

Then verify source files in `C:\Users\arman\Desktop\nimbus-pos` before coding.

Source basis:
- Uploaded waiter docs were used as the structure template: AGENTS.md, DESIGN.md, waiter_design.md, waiterui.md, WAITER_LIFECYCLE.md.
- Uploaded Nimbus audit/register resources were used for cashier-relevant routes: endpoint register, role endpoint matrix, master audit, gap register, workflow map.
- Live Windows repo path was not mounted in this environment, so exact DTOs/seed permissions must be verified in `C:\Users\arman\Desktop\nimbus-pos` before coding.


## Most important rules

- Cashier lands on Queue.
- Bottom nav: Queue, Receipts, Till, Me.
- No Floor or Menu tab.
- Cashier settles; waiter requests bill.
- Cash, card, MTN, Airtel are payment methods only through backend-supported local/demo-safe flows.
- Cash requires active till.
- MTN/Airtel live execution is pending provider confirmation.
- PesaPal is owner SaaS billing only.
- Receipt send is pending.
- Printer and terminal are metadata/stub only.
- Split bill/items/merge/move/transfer are advanced payment-resolution tools.
- No accounting/admin/KDS/waiter menu surfaces.

## Next implementation phases

1. Repo/docs/API orientation.
2. Cashier shell and design foundation.
3. Auth/session/context routing.
4. Queue/orders.
5. Checkout/payment entry.
6. Split bill/items/split tender/advanced resolution.
7. Receipts.
8. Till/safe drop/reconciliation.
9. Refunds.
10. Me tab.
11. QA/polish/demo readiness.
