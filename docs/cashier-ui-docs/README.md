# Cashier UI — Canonical Floor-First Documentation

**Status:** Product decision locked. **Prompt C2 COMPLETE (2026-07-31)** — on top of C1 (shared
Cashier Floor, Floor/Till/Me nav, `/cashier/floor` default), C2 adds **table→bill resolution**
(zero/one/multiple, fail-closed, no silent first-pick), the **canonical read-only settlement
workspace foundation** (Bill/Totals/Payment state/Settlement readiness/History — reusing the
existing checkout primitives), canonical `?tableId=&orderId=` URL state, and a **bounded Cashier-only
Find bill** sibling (tableless/takeaway + exact-id; receipt-ref deferred to C4). See
`ai/CASHIER_FLOOR_RECONSTRUCTION_C2_BILL_RESOLUTION_COMPLETION_REPORT.md`. **C3 not started** —
payment/partial/split **execution**, order **close**, receipts, and refunds remain future prompts
(C3–C6); Queue and Receipts remain hidden compatibility routes (retire C4/C5). Sections below
describe the full locked target; treat payment/close/receipt behaviour as **target, not yet built**
until the relevant prompt closes.

This directory is the canonical specification for the next Cashier reconstruction wave.
It supersedes the earlier Queue-first Cashier design documents under
`Front End/cashier_ui_docs_pack/` wherever they conflict.

Historical completion reports under `ai/CASHIER_UI_*` remain valid records of what was
previously built and tested. They are not the target architecture for this reconstruction.

## Locked product decision

Cashier visible navigation is exactly:

- **Floor**
- **Till**
- **Me**

There is no visible Queue tab and no visible Receipts tab.

The shared Floor is the default Cashier surface. A physical table selection opens the
Cashier settlement workspace for that table/order. Payment, split settlement, close,
receipt printing/reprinting, receipt delivery, and eligible refund actions live inside
that selected order context.

Tableless, takeaway, closed-order, and receipt-reference cases are reached through a
compact **Find bill** control on the Cashier Floor page. Find bill is a role-specific
sibling control outside the shared `OperationalFloor`; it is not a fourth navigation tab
and must not fork the shared Floor.

## Canonical documents

1. [`AGENTS.md`](AGENTS.md) — implementation instructions and prohibited changes.
2. [`CASHIER_ARCHITECTURE.md`](CASHIER_ARCHITECTURE.md) — three-tab product and component architecture.
3. [`CASHIER_LIFECYCLE.md`](CASHIER_LIFECYCLE.md) — end-to-end Cashier lifecycle.
4. [`CASHIER_ROLE_BEHAVIOUR_MATRIX.md`](CASHIER_ROLE_BEHAVIOUR_MATRIX.md) — Waiter/Supervisor/Cashier parity and role differences.
5. [`CASHIER_COMPONENT_REUSE_MAP.md`](CASHIER_COMPONENT_REUSE_MAP.md) — required shared-component reuse.
6. [`CASHIER_RECONSTRUCTION_ROADMAP.md`](CASHIER_RECONSTRUCTION_ROADMAP.md) — seven-prompt implementation plan.
7. [`CASHIER_TEST_PLAN.md`](CASHIER_TEST_PLAN.md) — executable QA and closure requirements.

## Source-of-truth order

For Cashier reconstruction work, use this precedence:

1. local dirty worktree code and verified runtime contracts;
2. this canonical directory;
3. root canonical architecture/governance docs;
4. historical Cashier completion reports;
5. legacy Cashier design pack.

When current code conflicts with these documents, do not silently force the code to match.
Audit the conflict, record it, and implement only through the defined reconstruction phase.

## Preservation rule

The previous Cashier rebuild contains working payment, split, receipt, Till, refund,
session, profile, and performance logic. The reconstruction is a navigation and workflow
recomposition around the shared Floor. It is not permission to rewrite working financial
logic from scratch.
