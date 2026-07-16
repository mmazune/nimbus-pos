# CASHIER_UI_RESEARCH_REPORT.md — Nimbus POS Cashier UI Research Report

Status: Draft v1  
Date: 2026-07-01  
Milestone: Cashier UI research + documentation pack  
Implementation state: UI implementation pending

## 1. Context snapshot

Waiter MVP is complete and demo-ready. Cashier is the next frontline role. This pass created the cashier research/docs package and did not implement UI.

## 2. Files/resources scanned

Uploaded waiter docs:
- `AGENTS.md`, `DESIGN.md`, `README.md`, `waiter_design.md`, `waiterui.md`, `WAITER_LIFECYCLE.md`.

Uploaded backend/audit resources:
- `README.md`, `ROADMAP.md`
- `nimbus_updated_master_audit_bg0_bg6.md`
- `nimbus_updated_endpoint_register_m0_m42_bg0_bg6.csv`
- `nimbus_updated_role_endpoint_matrix_bg0_bg6.csv`
- `nimbus_updated_frontend_workflow_map_bg0_bg6.csv`
- `nimbus_updated_reusable_component_map_bg0_bg6.csv`
- `nimbus_updated_gap_status_bg0_bg6.csv`
- `nimbus_bg0_bg6_gap_fix_register.csv`
- `nimbus_updated_route_verification_summary_bg0_bg6.csv`

Limitation: live Windows repo path was not mounted; exact code/DTO/seed verification remains open.

## 3. Waiter lifecycle comparison

Waiter is service-first:
```txt
login → context → shift readiness → floor/table → order creation → send → service → request bill → receipt visibility → logout
```

Cashier is payment-first:
```txt
login → context → shift readiness → till readiness → queue → checkout → payment method selection → settlement → split/merge if needed → close order → receipt/reprint/send-pending → refund if needed → till movement/reconcile → logout
```

## 4. Cashier role/permission findings

- Cashier is a PIN-first frontline role.
- `/api/auth/me` is canonical context resolver.
- Cashier appears on payment, till, receipt, refund, and POS handoff surfaces.
- Receipt read/reprint/send permissions include Cashier.
- POS handoff split/merge/transfer/move endpoints include Cashier.
- Device writes are not cashier MVP; Cashier is read-only where relevant.
- Approvals are manager-facing unless seed proves otherwise.
- Broad role matrix rows listing Cashier on accounting/reporting should not be used to build cashier UI.

## 5. Endpoint findings

Key endpoint groups:
- Auth/context: `/api/auth/login`, `/api/auth/quick-pin-login`, `/api/auth/me`, `/api/auth/logout`.
- Shifts/tills: `/api/shifts/active`, `/api/shifts/open`, `/api/tills/active`, `/api/tills/open`, `/api/tills/:id/summary`, safe-drop, reconcile.
- Orders: `/api/pos/orders`, order detail, order payments, close.
- Payments: `/api/payments/intents`, intent status/cancel, manual-reference.
- Split/handoff: split-bill, split-items, merge, move-items, transfer-table, transfer-server.
- Receipts: view, history, reprint, send.
- Refunds: list/create/detail; approve hidden unless verified.
- Devices: read metadata; printer routes metadata-only; terminals stub-only.

## 6. Payment/till/receipt findings

- Cash is safe only with active till.
- Card is manual/stub/reference only.
- MTN/Airtel live public diner execution is pending provider confirmation.
- MTN/Airtel may be manual-reference-only if backend DTO supports it.
- PesaPal is owner SaaS billing only.
- Receipt reprint is metadata/request only.
- Receipt send is pending/no adapter.
- Till open/reconcile are risky writes and should use idempotency where supported.

## 7. Proposed navigation

Final nav:
```txt
Queue · Receipts · Till · Me
```

No Floor, Menu, or Payments tab. Payment is an order-level checkout panel.

## 8. Proposed screens

1. Shared login
2. Cashier shell
3. Queue
4. Checkout/payment panel
5. Payment method selector
6. Split bill
7. Split items
8. Advanced merge/move/transfer
9. Receipt drawer
10. Receipts screen
11. Refund drawer
12. Till
13. Safe drop
14. Reconciliation
15. Me

## 9. Gaps

Open gaps include exact cashier credentials, seed permissions, payment enum/DTOs, split DTOs, bill-requested filter, split tender support, cash movement types beyond safe drop, refund/discount approval behavior, and cashier-safe demo fixtures.

## 10. Implementation recommendation

Implement docs → repo verification → shell → queue → checkout/payment → split flows → receipts → till → refunds → Me → QA. Keep MTN/Airtel provider-gated, PesaPal excluded, card terminal stub-only, printer metadata-only, and receipt send pending.

Locked safety boundaries:
- Public diner MTN/Airtel mobile-money execution remains `CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION`.
- MTN/Airtel may appear only as provider-gated or manual-reference-only if the backend DTO supports safe local manual reference capture.
- PesaPal is owner SaaS subscription billing only; it must never appear as diner checkout.
- Receipt send remains `PENDING — no live email/SMS/WhatsApp adapter`.
- Printer routes/reprint are metadata/request only: `Metadata only — no print-driver invocation`.
- Card terminal pairing is `STUB — no live hardware traffic`; no acquirer/card-terminal traffic.
- No fake provider credentials, no fake live delivery, no fake printed/terminal approved states.
