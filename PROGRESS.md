# PROGRESS.md — Nimbus POS

> Concise canonical progress index. The detailed live tracker is
> **`ai/AI_STATUS.md`** (its top-of-file "Current State" is authoritative).
> This file summarises where the project stands and links to the evidence.

**Status date:** 2026-07-28
**Branch:** `main` — **dirty worktree carries the newest, authoritative work.**
**Commit/push status:** ⛔ No commit or push. Recent frontend waves are all
uncommitted by design; treat the worktree as source of truth.

---

## Role completion state

| Role | Nav (locked) | State |
| --- | --- | --- |
| **Waiter** | Floor · Reservations · Me | ✅ Complete & visually locked |
| **Cashier** | Queue · Receipts · Till · Me | ✅ Complete / demo-ready |
| **Supervisor** | Floor · Reservations · Approvals · Me | ✅ Reconstruction Prompt 0–3 complete (3D demo-ready); **Prompt 4A backend lifecycle complete**; **Prompt 4B Reservations UI = COMPLETE WITH KNOWN LIMITATIONS**. The read-only triple-query Reservations page is replaced by a premium master-detail workspace on the 4A `scope=active/history` contracts — **Arriving/Seated/Attention/History** views (one bounded active query + lazy history; no triple-fetch/merge; no all-history load), reservation **creation**, and the full verified **lifecycle** (confirm/assign/change-table/seat/cancel/no-show/manual-complete) — **all already permitted for Supervisor, so zero permission/backend change**. Attention = overdue + structural SEATED issues (individual actions, **no bulk**). Cross-role Waiter visibility via narrow invalidation; URL-persisted state; responsive/accessible. Validated: web typecheck/lint/build + reservations+orders Jest 67/67 + Playwright suite (72 tests × 4 viewports) compiles. ✅ **Prompt 4C shared-Neon cutover COMPLETE (2026-07-29):** migration `20260518000000_prompt4a_reservation_completed_event` (`ReservationEventType.COMPLETED`) **deployed + verified on the shared `production` branch** via `db:migrate:deploy` (checksum match; counts unchanged), and `db:seed` applied the authorized `pos:order:transfer` Supervisor mapping — so **manual-complete + order-close auto-completion + Transfer table now all work on shared Neon** (the 4B + 3D shared residuals are closed). Pre-migration **recovery branch retained**. During the optional live-QA phase an isolated API accidentally hit production (inherited shell `DATABASE_URL` overrode the swapped `.env`) and created one marked QA reservation, immediately deleted (user-authorized) → production restored to 126/12. Closed at **B** per user decision; the live authenticated browser/4-viewport/API matrix remains the outstanding gate (lifecycle proven by Jest 67/67 + compiled Playwright). Full Approvals reconstruction not started. |
| **Manager** | — | ⬜ Planning only (Prompt 0 verification); UI not started |

## Completed milestones / workstreams

- **Backend M0–M42 + BG0–BG7** — 100% complete (BG7 HMS Integration, 2026-05-08).
  ~65 migrations, 53 API modules, 56 Postman collections, ~420+ endpoints.
- **Waiter UI** — complete: premium menu/order entry, instant table→menu flow,
  manager-configured FOOD/DRINKS taxonomy, UGX zero-fraction totals, receipts,
  reservations + seat, shared-profile Me. (2026-07-16 → 07-18)
- **Application-wide performance hardening** — complete (2026-07-18): JWT reuses
  claims, `/auth/me` parallelised, branch guard caches/dedupes, Quick PIN trimmed,
  API client bounded 30s timeout + AbortController + request IDs, cashier/
  supervisor list N+1 fan-outs removed (cashier startup ~101 → ~9 requests).
  Residual local/Neon latency remains and is documented (not a frontend deadlock).
- **Shared profile** — complete (2026-07-18): Waiter/Cashier/Supervisor reuse the
  `components/profile/*` primitives; employee-link handling consolidated; long
  shifts presented truthfully.
- **Supervisor Reconstruction:**
  - **Prompt 0** ✅ — repo re-verification, shared-component mapping, lifecycle
    audit, phased roadmap, gap register, MVP include/defer matrix (docs only).
  - **Prompt 1** ✅ — shared operational shell/header/clock/logout/bottom-nav +
    canonical icon registry; Supervisor nav reduced to Floor/Reservations/
    Approvals/Me; Orders removed from visible nav; `/supervisor/orders` legacy
    redirect into Floor.
  - **Prompt 2** ✅ — Waiter + Supervisor share one `OperationalFloor`; Supervisor
    table selection opens a read-first table-control workspace; URL-backed
    selection + legacy Orders routing.
  - **Prompt 3A** ✅ (2026-07-27) — action foundation + safe service actions:
    Supervisor idle-session parity (shared idle handler); central order
    action-availability module; canonical selected-order wiring; shared
    confirmation dialog + idempotency-intent foundation; **live Request bill and
    Mark served** (verified against the backend, permission `pos:orders:write`);
    payment stays read-only. High-impact actions remain prepared but hidden.
  - **Prompt 3B1** ✅ (2026-07-27) — Supervisor **Split bill, Split items, Move
    items, Merge** live inside the Floor workspace (BG3 idempotency, bounded
    branch-scoped target selector, shared line selector, EQUAL/CUSTOM allocation
    validators). Required an authorized RBAC grant (Supervisor → `pos:order:split`
    / `merge` / `move-items` via seed mapping). Payment read-only; no Orders nav.
  - **Prompt 3B2** ✅ (2026-07-28) — Supervisor **Transfer table** live inside the
    Floor workspace (bounded branch-scoped target selector, BG3 idempotency,
    canonical source/target Floor cache reassignment, post-transfer URL re-anchor)
    + **Find order** compact Floor lookup (bounded/paginated, status/service
    filters, exact-ID fallback) opening takeaway/tableless/closed/voided/exception
    orders in the canonical workspace; tableless truthful, terminal read-only,
    legacy `/supervisor/orders` redirect verified. Required an authorized RBAC
    grant (Supervisor → `pos:order:transfer` via seed mapping); ⚠️ that single
    permission also makes the UNUSED `transfer-server` endpoint API-reachable.
    Payment read-only; no Orders nav. Live/browser QA pending (no API/DB/browser
    automation in this environment).
  - **Prompt 3B2 transfer-server** ⬜ Deferred (Outcome B) — no safe branch-scoped
    server selector exists; endpoint stays UI-hidden/blocked. See `docs/DECISIONS.md`.
  - **Prompt 3B3A** ✅ (2026-07-28) — Supervisor **active-order Void**
    (`pos:orders:void`) and **order-level Discount request** (`pos:discount:request`)
    live inside the Floor workspace, in a new **Adjustments** group, with a read-only
    Discounts panel. Void is separated from refund/complimentary/post-close void;
    discount basis = subtotal, backend threshold decides APPROVED vs PENDING (UI shows
    an estimate, no optimistic total). A documented UI-only payment safety gate blocks
    both when money is present. No permission/backend change (perms pre-existed).
    Narrow discount-domain-only Approvals invalidation. Live/browser QA pending.
  - **Prompt 3B3B** ✅ (2026-07-28) — Supervisor **discount Approve/Reject** (inline on
    PENDING discount rows, `pos:discount:approve`) and **Complimentary** (whole-order
    100% discount via `pos:discount:request`, Outcome B — metadata round-trips) in the
    Adjustments group. Approve recalcs totals (payment-gated); reject leaves totals
    unchanged; complimentary may return PENDING above the org threshold. Self-approval is
    backend-permitted (UI matches + flags it; backend guard recommended). Narrow
    discount-domain invalidation; Approvals page not redesigned. No permission/backend
    change. Live/browser QA pending.
  - **Prompt 3C** 🟡 (2026-07-28) — **consolidated live-QA / closure = IMPLEMENTED /
    QA BLOCKED.** Verification-only (no code/backend/seed/Postman change; no DB mutation).
    Passed: worktree safety, web typecheck/lint/build, `git diff --check`, 53/56 Postman
    JSON (3 pre-existing BOM), fresh API boot + **`/api/health` db ok**, API
    `orders.service` Jest **26/26**, and **read-only runtime permission verification**
    (Supervisor login 201; `/auth/me` 132 perms; guard-boundary probes return non-403 for
    all 13 in-scope actions → each permission GRANTED with zero mutation). Re-verified in
    code: no Orders tab, legacy redirect, no transfer-server UI, shared-Floor reuse,
    payment safety gates, no forbidden actions. **Blocked (not fabricated):** destructive
    live-mutation QA (shared live Neon DB + classifier write-block, no isolated DB) and
    browser + 4-viewport QA (no Playwright/Puppeteer/Cypress). **⚠️ Runtime gap:**
    Supervisor lacks `pos:order:transfer` on the active DB (confirmed via `/auth/me` +
    `role_permissions` read + a live **403** on transfer-table) → **Transfer table 403s
    until the authorised additive seed mapping is applied** (`db:seed` or insert the single
    roleId `cmqlcft890006wp6loken0xub` × `pos:order:transfer` row; no schema/migration).
    Reports: `ai/SUPERVISOR_RECONSTRUCTION_PROMPT3_CONSOLIDATED_LIVE_QA_COMPLETION_REPORT.md`,
    `ai/SUPERVISOR_PROMPT3_QA_RECORD_REGISTER.md`.
  - **Prompt 3D** ✅ (2026-07-28) — **isolated destructive QA + browser matrix = COMPLETE
    WITH KNOWN LIMITATIONS.** Stood up a disposable Docker Postgres 16 (`nimbus_prompt3_qa`,
    :55432) + API :4001 + web :3100 (shared Neon untouched); migrations + `db:seed` +
    `db:demo:import`; installed Playwright + Chromium. **API mutation matrix (41 checks):
    all in-scope actions + rejections + idempotency replays pass; totals never negative.**
    **Playwright 64/64 across 1024×768/1366×768/1440×900/1920×1080.** **Defect fixed:**
    discounts-list `?pageSize` 400 → added `@Type(() => Number)` to `ListOrderDiscountsQueryDto`
    (+6-test Jest spec); the Supervisor Discounts panel read now works and complimentary
    metadata round-trips. Postman/schema/permissions unchanged. Harness kept
    (`apps/web/playwright.config.ts`, `e2e/supervisor-prompt3/*`). Reports:
    `ai/SUPERVISOR_RECONSTRUCTION_PROMPT3D_ISOLATED_QA_COMPLETION_REPORT.md`.
  - **Prompt 4A** ✅ (2026-07-28) — **Neon reservation-lifecycle completion + active/history
    query repair + order-close sync = COMPLETE WITH KNOWN LIMITATIONS / READY FOR PROMPT 4B.** Backend fix for
    indefinite reservation pile-up (not a frontend filter): new `POST /reservations/:id/complete`
    (SEATED→COMPLETED, gated by the already-seeded, already-Supervisor `pos:reservation:update`
    — **no new permission, no seed change**); **auto-completion on order close** at the single
    canonical `OrdersService.transitionOrder` CLOSED choke point (explicit `seatedOrderId`
    linkage, retry-safe, failure-logged-not-swallowed); **concurrency-safe guarded transitions**
    (conditional `updateMany` compare-and-set); **`scope=active|history` split** + `from`/`to`
    range + **pageSize default 25 / max 100 clamp** + deterministic sort + server-derived
    `overdue` (never auto-NO_SHOW). Only schema change = `COMPLETED` added to `ReservationEventType`
    enum + migration `20260518000000_prompt4a_reservation_completed_event` (**NOT deployed to
    shared Neon this pass**). FE = contract helpers only (no Reservations UI redesign — that is
    Prompt 4B). **Static validation all pass** (API typecheck for changed modules, web
    typecheck/lint/build, **reservations+orders Jest 67/67**, 56 Postman collections parse).
    **Isolated Neon QA EXECUTED** (via Neon MCP on a disposable fork of the live `production`
    branch): migration audit (no drift; only the 4A migration unapplied on shared, intended),
    migration applied + `COMPLETED` enum verified on the branch, Supervisor `pos:reservation:update`
    confirmed by live SQL, shared read-only data audit (126 res; 6 order-less SEATED + 55 overdue =
    repair candidates, not auto-resolved), live manual + order-close auto-completion + idempotency +
    active/history split, query plans (no index needed), and **zero writes to shared Neon** (identical
    before/after counts). **Not run (non-blocking):** HTTP-layer API boot / `/api/health` / Playwright
    smoke (stack unit-tested 67/67, DB contract proven live). Reports:
    `ai/SUPERVISOR_RECONSTRUCTION_PROMPT4A_NEON_RESERVATION_LIFECYCLE_COMPLETION_REPORT.md`,
    `ai/SUPERVISOR_RESERVATION_QA_RECORD_REGISTER.md`,
    `ai/SUPERVISOR_RESERVATION_SHARED_NEON_DATA_AUDIT.md`.
  - **Deferred (out of Supervisor reconstruction scope):** transfer **server** (no safe
    selector), refund creation/approval, post-close void, payment collection, order close,
    Reservations UI reconstruction (Prompt 4B).

## Active milestone

Supervisor Reconstruction — **Prompt 4A COMPLETE WITH KNOWN LIMITATIONS (2026-07-28), isolated
Neon QA executed; ready for Prompt 4B (Reservations UI), which is NOT started.**

## Next approved milestone

- **Supervisor Reconstruction Prompt 3B2/3B3** (recommended next): transfer table,
  void (active + post-close), discount request/approve/reject, complimentary,
  refunds — reusing the action-availability module, shared confirmation dialog, and
  idempotency-intent utility. **transfer-server stays blocked** until a safe narrow
  server selector exists. See `ai/SUPERVISOR_RECONSTRUCTION_ROADMAP.md`.
- Formal roadmap line item: **M43 — Frontend Shell + Role-Based Workspaces**
  (the role UIs are being delivered ahead of / interleaved with this).

## Blocked work (backend contract gaps)

- **Waiter post-send item additions** — blocked: backend lacks per-line sent
  state / idempotent send-additions contract (WKL-010).
- **Supervisor reservation completion** — no verified completion endpoint and no
  `ReservationEventType.COMPLETED` enum (SUP-RG-008/009; needs migration).
- Supervisor **Split bill / Split items / Move items / Merge** are live (Prompt 3B1).
  Remaining high-impact actions (transfer table, void, discount request/approve/
  reject, complimentary, refunds) are deferred to Prompt 3B2/3B3.
- Supervisor **transfer-server** stays blocked — no safe narrow, branch-scoped,
  operational-role server selector endpoint exists (only admin-gated/unfiltered
  tenancy memberships or an org-wide HR directory).
- **RBAC note (2026-07-27):** the Supervisor role was granted `pos:order:split`,
  `pos:order:merge`, `pos:order:move-items` (user-authorized seed mapping to
  existing permission rows; re-seeded). No schema/migration change.

## Deferred work

Full accounting, payroll admin, franchise, developer portal, owner SaaS billing,
PesaPal diner checkout, live MTN/Airtel diner mobile money, printer drivers,
terminal/acquirer traffic, MSR/badge login, smart spouts. See
`docs/KNOWN_LIMITATIONS.md`.

## Known limitations

Consolidated in `docs/KNOWN_LIMITATIONS.md`, with role detail in
`ai/WAITER_MVP_KNOWN_LIMITATIONS.md`, `ai/CASHIER_UI_KNOWN_LIMITATIONS.md`, and
`ai/SUPERVISOR_RECONSTRUCTION_GAP_REGISTER.md`.

## Validation status (2026-07-26 onboarding pass)

| Gate | Result |
| --- | --- |
| `@nimbus-pos/web` typecheck | ✅ pass |
| `@nimbus-pos/web` lint | ✅ pass (no warnings/errors) |
| `@nimbus-pos/web` build | ✅ pass |
| `GET /api/health` | ✅ `{ status: ok, db: ok }` (HTTP 200) |
| `git diff --check` | ✅ clean (LF→CRLF info warnings only) |
| Postman JSON (56 collections) | ✅ all valid (3 carry a legacy UTF-8 BOM Postman tolerates) |

## Dirty-worktree warning

The worktree has large uncommitted changes (new shared `pos-shell/`, `floor/`,
`profile/` trees; deleted role-specific floor components; auth/orders perf
hardening; new docs). **Do not reset/restore/stash/clean/discard.** GitHub is stale.

## Commit / push status

⛔ **No commit or push** during onboarding/polish passes unless the user asks.
