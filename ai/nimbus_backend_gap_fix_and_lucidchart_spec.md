# Nimbus Backend Gap-Fix Plan + Lucidchart Specification (Pre-M43/M44)

This document uses the final M0-M42 audit outputs as the planning source of truth before frontend implementation begins.

## 1. Executive gate

- Backend coverage M0-M42 is broad, but the audit still shows 526 unique method/path rows, 473 verified in both Postman and reports, 42 report-only rows needing route verification, and 11 Postman-only route/actions.

- Frontend work should not begin in earnest until the missing or unclear backend surfaces are implemented, explicitly deferred, or marked internal/pending.

- `/api/public/payments/*` remains **CRITICAL — PENDING MTN/AIRTEL PROVIDER CONFIRMATION**. Keep visible in maps as placeholder only.


## 2. Backend mini-milestones

### BG0 — Route Verification + Contract Cleanup
- Verify the 42 report-only rows and reconcile the 11 Postman-only rows before frontend tickets are finalized.

### BG1 — Invitation Acceptance + Password Lifecycle + Frontline Staff Onboarding
- Close the onboarding/access lifecycle gap and add one-call frontline staff setup for managers.

### BG2 — Unified Approvals Inbox + Global Audit Timeline
- Create one approvals feed across domains and one reusable audit read API.

### BG3 — Reliability Rollout (Idempotency + Maintenance/Training Adoption)
- Apply M41/M42 primitives across risky writes and write-surface controls beyond inventory.

### BG4 — Receipts + POS Order Handoff Operations
- Add receipt retrieval/send/history plus split/merge/transfer/handoff flows and partial-close support verification.

### BG5 — Device / Printer / Terminal Registry
- Add operational device registration/routing/pairing needed for KDS/POS deployment, while keeping advanced hardware deferred.

### BG6 — Export / Download Consistency
- Standardize export/download surface so frontend can use one export and download pattern across domains.


## 3. Lucidchart deliverables
Use the 15-map set agreed in chat, but start Lucidchart production only after BG0-BG6 are either implemented or explicitly deferred.
