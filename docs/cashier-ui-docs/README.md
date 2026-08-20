# Cashier UI — Canonical Floor-First Documentation

**Status:** Product decision locked. **Prompt C3 COMPLETE (2026-08-20)** — the settlement workspace
is now a working, fail-closed **payment + close** surface. On top of C1 (shared Cashier Floor,
Floor/Till/Me nav, `/cashier/floor` default) and C2 (table→bill resolution, the canonical settlement
workspace, `?tableId=&orderId=` URL state, bounded Find bill), C3 adds **payment collection**
(cash final-close + card/MTN/Airtel/bank manual-reference), **partial payment with a canonical
remaining balance**, **split settlement** (split-bill allocation + split-items child order), and
**order close at the single verified choke point** — all by mounting the already-verified checkout
primitives, not by rewriting them. See
`ai/CASHIER_FLOOR_RECONSTRUCTION_C3_SETTLEMENT_COMPLETION_REPORT.md`.

**Still not built (C4/C5/C6):** receipt print / reprint / delivery and receipt search, refund
execution, Receipts retirement (C4), Queue retirement (C5), and final integrated closure (C6).
Queue and Receipts remain hidden compatibility routes reachable only by direct URL. Sections below
describe the full locked target; treat receipt/refund behaviour as **target, not yet built** until
the relevant prompt closes.

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
8. [`CASHIER_API_MATRIX.md`](CASHIER_API_MATRIX.md) — **every endpoint the Cashier UI can call
   (34 — 32 at publication + the two shift-mutation rows added 2026-08-20)**, grouped by
   surface (Auth/session, Readiness, Floor & bill resolution, Find bill,
   Settlement workspace, Till) with a clearly separated *Hidden compatibility surfaces
   (Queue/Receipts — retire C4/C5)* section. Columns: method+path, purpose, backend controller,
   permission string from the actual guard, request/response essentials, error modes the UI
   handles, and **live-verified status** (2026-08-20, isolated local stack). Also records the
   C3 prohibitions, the permissions cashier holds but never uses, and the mismatch register.

## Dated notes

**2026-08-20 — Prompt C3 complete: settlement execution is live on the Floor path.** The C2
read-only workspace now executes payment, partial payment, split allocation/item split, and close.
Implementation is a **mount**, not a rewrite: a new thin
`components/cashier/floor/CashierSettlementActions.tsx` composes the existing
`CashierPaymentPanel` (which already owns cash close, manual-reference capture, blocked-banner
validation, payment history and `CashierCloseOrderPanel`) and `CashierResolutionPanel` with the new
additive `variant="split-only"` prop, so the Floor path offers split allocation and item split but
**not** merge / move-items / transfer-table. A new `lib/cashier/settlement-mutations.ts` provides
the only post-mutation refresh: it *awaits* a canonical re-read of `orderDetail` + `orderPayments`
before any result is shown (no optimistic money), and invalidates only the bounded table-bill list,
the Floor snapshot, open Find-bill result sets, and the Waiter/Supervisor Floor keys — all through
the C2 key factories. **Frontend-only: no backend, schema, migration, seed, permission, or Postman
change.** Live-verified on an isolated stack with REAL money mutations; see the completion report
and `ai/CASHIER_FLOOR_RECONSTRUCTION_C3_QA_EVIDENCE_INDEX.md`.

Two truthful boundaries were discovered and documented rather than papered over: (1) there is **no
standalone Close control**, because the backend rejects a zero-payment close (`payments` is
`@ArrayMinSize(1)` and the order must be `SERVED` with the balance covered) — close is reached
through payment and the close panel states the precondition; (2) `POST /payments/manual-reference`
accepts a payment on an already-**CLOSED** order (only `VOIDED` is refused), so the *UI* fails
closed (a terminal bill renders no settlement control at all) while the endpoint stays reachable —
recorded as a backend hardening recommendation, not implemented.

**2026-08-20 — Aug-2026 rebrand landed.** The Nimbus POS brand identity refresh (navy
`#000033`, Light Grey `#B3B4AF`, Dark Grey `#6B6B6B`, steering-wheel logomark) is now shipped
and canonical in [`docs/BRAND_IDENTITY.md`](../BRAND_IDENTITY.md). The cashier shell reads as
navy chrome (header + bottom nav) around a light workspace of white cards. **No cashier
behaviour, route, permission, or endpoint changed** — this is a design-token and asset change
only, and every claim in the documents above stands unmodified. Components must consume the
`--color-brand-*` tokens rather than hard-coding hexes.

**2026-08-20 — API matrix added.** `CASHIER_API_MATRIX.md` closes the gap where the only
cashier API matrix lived in the pre-reconstruction legacy pack
(`Front End/cashier_ui_docs_pack/docs/cashier-ui-docs/CASHIER_API_MATRIX.md`, now marked
historical/superseded). Key finding recorded there: the cashier workspace exposes **no
shift-open control** while `POST /api/tills/open` requires a shift the cashier personally
opened — so a cold-start cashier cannot open a till (matrix §10, **M1**).

**2026-08-20 — cashier shift open/close added to Me (owner-approved; resolves M1(b)).**
`CashierMeScreen` now renders the shared `ShiftStatusCard` with **Start shift** / **End shift**
and an optional shift note, backed by new thin helpers `apps/web/src/lib/cashier/shifts.ts`
(`POST /api/shifts/open`, `POST /api/shifts/:shiftId/close`) — the same affordance Waiter Me
already had, copied per the per-role lib convention (the waiter lib is **not** imported). The
readiness strip's inactive-shift chip now reads *"No active shift · Open Me to start"* so the
remedy is discoverable; the strip itself is otherwise unchanged. Success invalidates only
`["cashier","active-shift",branchId]` + `["cashier","active-till",branchId]`. **Frontend-only:
no backend, schema, seed, permission, or Postman change** — the seeded cashier role already
holds `pos:shift:open` + `pos:shift:close` (verified in `/api/auth/me`). Live-verified
end-to-end at 1440×900 and 1024×768 (open → strip/Till chips flip to *Shift active* →
`/api/tills/open` gate probe moves 400 *"No active shift"* → 409 *"already has an active
session"* → close → strip back to *No active shift*), console clean, typecheck + lint pass.
Scope was **only** `components/cashier/me/`, `lib/cashier/{shifts,api,readiness}.ts` — no
floor/settlement/queue/receipts code was touched, and C3 remains gated. Matrix §2a + §10 M1.

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
