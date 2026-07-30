# CLAUDE.md — Nimbus POS

> Primary onboarding file for Claude Code (and any AI agent) working in this
> repository. Read this **first**, then inspect the local worktree before making
> any assumption. When this file and the code disagree, **the code and the local
> dirty worktree win** — update the docs to match reality, never the reverse.

---

## 1. Project purpose

Nimbus POS is a full-depth restaurant/hospitality operating system: POS, KDS,
inventory, procurement, reservations, events, HR/workforce, payroll, accounting,
franchise, billing, developer portal, reporting, alerts, offline reliability, and
(late-wave) hardware. It is built from scratch under a strict milestone system.

- **Backend:** 100% complete through milestone **BG7** (M0–M42 + BG0–BG7).
- **Frontend:** the active phase. Operational role UIs (Waiter, Cashier,
  Supervisor) are being built on a **shared operational UI system**.

## 2. Repository path

- **Canonical (use only this):** `C:\Users\arman\Desktop\nimbus-pos`
- **Forbidden / stale (never use):** `C:\Users\arman\Desktop\NIMBUS\nimbus-pos`

## 3. Package manager

- **pnpm `8.15.0`**, pinned via `packageManager` in `package.json`.
- Always invoke through **`corepack pnpm@8.15.0`** (Node ≥ 22, Turborepo monorepo).

## 4. Important commands

```bash
# Web app (apps/web, package @nimbus-pos/web) — run from repo root
corepack pnpm@8.15.0 --filter @nimbus-pos/web typecheck   # tsc --noEmit
corepack pnpm@8.15.0 --filter @nimbus-pos/web lint         # next lint
corepack pnpm@8.15.0 --filter @nimbus-pos/web build        # next build
corepack pnpm@8.15.0 --filter @nimbus-pos/web dev          # next dev -p 3000

# API (apps/api, package @nimbus-pos/api)
corepack pnpm@8.15.0 dev:api                               # nest dev (turbo)
# Recommended for a quiet/reliable boot: build once, then run dist
#   (from apps/api)  node dist/main.js       # API on :3001, prefix /api

# Health
#   GET http://localhost:3001/api/health  -> { status: "ok", ... }

# DB / seed (DO NOT run in this onboarding pass)
corepack pnpm@8.15.0 db:generate | db:migrate | db:seed
```

- API base: **`http://localhost:3001`**, global prefix **`/api`** → routes are
  `http://localhost:3001/api/<route>`. Web dev server runs on **`:3000`**.
- The web app has **no automated tests yet** (`test` script is a stub).

## 5. Repository structure (high level)

```
apps/web        Next.js 14 Pages Router + React Query + Tailwind (the UI)
apps/api        NestJS API (53 modules) — source of truth for business state
packages/db     Prisma schema, ~65 migrations, seed.ts, demo-import.ts
ai/             Governance docs, AI_STATUS, milestone & UI completion reports
docs/           Canonical architecture / conventions / role UI docs
Front End/      Legacy role UI design packs (waiter/cashier/supervisor/manager)
postman/        58 Postman collections (one per milestone/feature)
demo-data/      CSV demo dataset + credentials (source for demo-import.ts)
```

See `docs/REPOSITORY_MAP.md` for directory ownership and `docs/DOCUMENT_INDEX.md`
for the full document catalog with provenance.

## 6. Source-of-truth documents

| Topic | Canonical document |
| --- | --- |
| This onboarding | `CLAUDE.md` (this file) |
| Progress / status | `PROGRESS.md` → detailed live tracker `ai/AI_STATUS.md` |
| Architecture (index) | `ARCHITECTURE.md` → detail `docs/ARCHITECTURE.md`, `docs/UI_SYSTEM.md` |
| Document catalog | `docs/DOCUMENT_INDEX.md` |
| Repo map | `docs/REPOSITORY_MAP.md` |
| UI/design system | `docs/UI_SYSTEM.md`, `PRODUCT.md` |
| Role journeys | `docs/ROLE_JOURNEYS.md` + per-role lifecycle docs |
| Capability matrix | `docs/ROLE_CAPABILITY_MATRIX.md` |
| Locked decisions | `docs/DECISIONS.md` |
| Testing / QA | `docs/TESTING_AND_QA.md` |
| Known limitations | `docs/KNOWN_LIMITATIONS.md` |
| Process / governance | `AGENTS.md`, `ai/AI_GOVERNANCE_PROMPT_UPDATED.md`, `ai/AI_ERROR_PROTOCOL.md` |
| API/Postman contract | `docs/API_CONVENTIONS.md`, `docs/POSTMAN_ENDPOINT_GUIDE.md` |
| Supervisor reconstruction | `ai/SUPERVISOR_RECONSTRUCTION_ROADMAP.md`, `docs/supervisor-ui-docs/*` |

## 7. Local dirty-worktree safety rules

The worktree carries **extensive uncommitted work** that is the newest, most
authoritative state of the project. GitHub / the last commit are **stale**.

- **Never** `reset`, `restore`, `stash`, `clean`, `checkout --`, discard, or
  overwrite existing worktree changes.
- Do **not** assume the last commit reflects current code.
- Before editing, run `git status` and preserve all unrelated work.
- Prefer additive edits; never blow away another workflow's in-progress files.

## 8. No commit / no push

- **Do not `git commit` or `git push`** unless the user explicitly asks.
- All recent frontend waves end with "No commit or push occurred" by design.

## 9. Roles & boundaries

| Role | Visible nav (LOCKED) | Owns |
| --- | --- | --- |
| **Waiter** | **Floor · Reservations · Me** | Table-centric order entry (order builder behind Floor table selection) |
| **Cashier** | **Queue · Receipts · Till · Me** | Payment collection, receipts, till/close |
| **Supervisor** | **Floor · Reservations · Approvals · Me** | Read-first oversight; table-control workspace behind Floor selection |

- Payment collection / order close / till are **Cashier-owned**. Supervisor may
  only **read** payment/order state. Waiter cannot collect payment or close.
- **There is NO visible Orders tab** for Waiter or Supervisor. Order work is
  reached from Floor **after** a table is selected. Legacy `/waiter/orders` and
  `/supervisor/orders` routes exist only as **redirects** into Floor (preserving
  `tableId`/`orderId`).

## 10. Current implementation milestone

**WAITER complete + SUPERVISOR RECONSTRUCTION through Prompt 4D (Reservations UI
complete with known limitations; order-workspace financial actions feature-complete;
Prompt 4A backend reservation lifecycle complete; Prompt 4C shared-Neon cutover deployed;
Prompt 4D isolated live QA + fail-closed DB isolation tooling — COMPLETE WITH KNOWN
LIMITATIONS / DEMO-READY).** See `PROGRESS.md`.

- **Supervisor Reservations — Prompt 4D COMPLETE WITH KNOWN LIMITATIONS (2026-07-29).** The
  outstanding live-browser/API QA gate is closed. Durable **fail-closed isolation tooling** now
  lives under `tools/qa/` (env-isolation lib + DB-identity preflight using the API's own Prisma
  client + launcher: denylist → preflight → spawn; plus a live reservation mutation-matrix
  runner). It fixes the 4C incident root cause — an inherited shell `DATABASE_URL` overrode a
  swapped `.env` (`dotenv` never overrides an already-set env var), so isolation now constructs
  the child-process env explicitly and strips inherited DB vars, and refuses to start the API
  unless the denylist + sentinel + migration + `COMPLETED` enum + demo-branch identity checks
  pass. **Live reservation mutation matrix 53/53** (create/confirm/assign/reassign/seat/cancel/
  no-show/manual-complete/queries/pagination/overdue/branch-isolation/concurrency); the
  Playwright reservations suite (9 specs × 4 viewports = 72 tests) was **actually executed**
  against an isolated local Docker stack (the disposable Neon branch's EAT↔us-east-1 latency
  exceeds the app's 30s client abort under the reservations page's concurrent fan-out — an
  external limit, not a UI defect). First-execution spec fragilities (loose selectors, hardcoded
  times, a page-local lookup helper) were found and fixed; the product is independently verified
  (create-dialog validation renders correctly; Jest 67/67; matrix 53/53). **Shared Neon verified
  untouched** (126 reservations / 12 events / 0 QA rows; recovery branch `br-dawn-truth-a4zjs1p7`
  retained). **NO backend/DTO/schema/migration/seed/permission/Postman change.** New non-blocking
  gap **SUP-RG-034** (concurrent identical creates can 500 on the reservation-number race —
  recommended backend hardening, out of scope). Do NOT begin Approvals reconstruction.

- **Supervisor Reservations UI — Prompt 4B COMPLETE WITH KNOWN LIMITATIONS.** The
  read-only triple-query page is replaced by a premium master-detail workspace on the
  Prompt 4A `scope=active|history` contracts: **Arriving / Seated / Attention / History**
  views (one bounded `scope=active` query feeds the three active views + a lazy
  `scope=history` query — no all/today/upcoming triple-fetch, no browser merge, no
  all-history initial load, no pageSize-100 default), reservation **creation**, and the
  full verified lifecycle (**Confirm, Assign/Change table, Seat, Cancel, No-show,
  Manual complete**) plus truthful automatic-completion presentation and an
  Attention workflow (overdue + structural SEATED issues; individual actions, **no bulk
  resolution**). **The Supervisor role already holds every `pos:reservation:*`
  permission — NO permission change and NO backend change.** Action availability mirrors
  backend `VALID_TRANSITIONS` exactly. Cross-role Waiter visibility via narrow
  invalidation; URL-persisted view/date/page/status/from/to/selected. ⚠️ **Shared Neon
  still needs migration `20260518000000_prompt4a_reservation_completed_event`
  (`ReservationEventType.COMPLETED`) before manual-complete + order-close auto-completion
  work there** (all other actions + Attention/overdue work on shared today — verified
  read-only via Neon MCP). Live browser/4-viewport/`/api/health`/disposable-branch
  mutation execution remains the outstanding QA gate (not fabricated).

- **Waiter UI — complete & visually locked** (premium menu/order entry, instant
  table→menu flow, UGX totals, shared profile Me).
- **Application-wide performance hardening — complete** (residual Neon/local
  latency remains, documented, not a frontend deadlock).
- **Shared profile — complete** (Waiter/Cashier/Supervisor reuse profile primitives).
- **Supervisor Reconstruction — Prompt 0, 1, 2, 3A, 3B1, 3B2, 3B3A, 3B3B complete.**
  Prompt 3A added idle parity, the central order action-availability module,
  canonical selected-order wiring, a shared confirmation dialog + idempotency-intent
  utility, and the service actions (**Request bill**, **Mark served**). Prompt 3B1
  added the handoff actions inside the Floor workspace: **Split bill, Split items,
  Move items, Merge** (`pos:order:split`/`merge`/`move-items`, BG3 idempotency).
  Prompt 3B2 added **Transfer table** (`pos:order:transfer`, BG3 optional
  idempotency; bounded branch-scoped target selector; canonical source/target Floor
  reassignment; post-transfer URL re-anchor) and a compact **Find order** Floor
  lookup (bounded/paginated; status/service filters; exact-ID fallback) that opens
  takeaway/tableless/closed/voided/exception orders in the canonical workspace.
  Payment stays read-only. ⚠️ The authorized `pos:order:transfer` grant is a single
  backend gate for BOTH transfer-table and transfer-server; **transfer-server has
  no UI (Outcome B — deferred)** but its endpoint is now API-reachable. Prompt 3B3A
  added **active-order Void** (`pos:orders:void`) and **order-level Discount request**
  (`pos:discount:request`) in a new **Adjustments** group, plus a read-only Discounts
  panel. Void is separated from refund/complimentary/post-close void; discount basis
  is the subtotal and the backend threshold (default 5000) decides APPROVED vs PENDING
  (UI shows an estimate, never an optimistic final total). A **documented UI-only
  payment safety gate** blocks void + discount when money is present (the backend does
  not itself check payment). Prompt 3B3B added **discount Approve/Reject** (inline on
  PENDING discount rows, `pos:discount:approve` — one permission gates both) and
  **Complimentary** (whole-order 100% discount via `pos:discount:request`, Outcome B —
  `Discount.metadata` round-trips). Approve recalcs totals (payment-gated); reject leaves
  totals unchanged; complimentary may return PENDING above the org threshold. **Self-
  approval is backend-permitted** — the UI matches it and flags it ("You requested
  this"); a backend self-approval/maker-checker guard is recommended. No permission or
  backend change in 3B3A/3B3B (perms pre-existed).
- **Supervisor order-workspace financial actions are feature-complete for the
  reconstruction scope.** Do NOT wire out-of-scope actions (transfer **server**, refund
  creation/approval, post-close void, payment collection, order close). **Reservations
  Prompt 4A (backend) and Prompt 4B (UI) are now complete** — do NOT start the full
  Approvals-page reconstruction unless explicitly approved, and do NOT extend Reservations
  beyond the 4B scope (no reservation deposit capture / payment, no bulk resolution) without
  approval.
- **Pending QA:** consolidated authenticated live/browser/viewport QA and `/api/health`
  verification for Prompts 3B1–3B3B **and Prompt 4B** remain outstanding (no API/DB/browser
  automation in the current environment; Prompt 4B static gates + Neon MCP read-only
  verification passed). Do not claim demo-ready on shared Neon until the Prompt 4A
  `COMPLETED` migration is deployed there and live QA is run.

## 11. Locked decisions (do not change without explicit approval)

**Waiter:** nav = Floor/Reservations/Me; no Orders tab; instant table→menu; full-
screen menu/order workspace; manager-configured FOOD/DRINKS taxonomy (never
hard-code fallback categories — show an honest "manager configuration" empty
state); UGX with zero-fraction rendering via the shared waiter currency formatter;
guest names never shown on Floor cards.

**Shared shell:** one `OperationalShell` + `OperationalHeader` + shared
`CurrentTime` + shared logout + `OperationalBottomNav` + canonical icon registry
serve all three roles via thin per-role adapters.

**Shared Floor:** Waiter and Supervisor render **one** `OperationalFloor`
presentation (same toolbar, grid, cards, status labels, staff formatting
`First L.`, breakpoints, 176px card height). **Role behaviour differs only AFTER
table selection** — Waiter opens its menu/order workspace; Supervisor opens a
read-first table-control workspace. Changes to shared Floor cards/toolbar/status/
spacing/breakpoints propagate to **every** consuming role by design.

**Supervisor:** nav = Floor/Reservations/Approvals/Me; no visible Orders tab;
legacy Orders routes redirect into Floor. Live Floor-workspace mutations: table
status (Review/Confirm); **Request bill** + **Mark served** (`pos:orders:write`,
Prompt 3A); **Split bill / Split items / Move items / Merge** (`pos:order:*`,
Prompt 3B1, BG3 idempotency); and **Transfer table** (`pos:order:transfer`,
Prompt 3B2, BG3 optional idempotency); **Void** active order + **Discount** request
(`pos:orders:void` / `pos:discount:request`, Prompt 3B3A); and **Discount Approve/Reject**
+ **Complimentary** (`pos:discount:approve` gates both approve+reject; complimentary uses
`pos:discount:request`, Prompt 3B3B) — the financial actions live in an **Adjustments**
group and none are BG3-wrapped. A compact **Find order** control on Floor (Supervisor-only
sibling above the shared `OperationalFloor`, never a forked Floor or an Orders tab)
opens takeaway/tableless/closed/voided/exception orders in the canonical workspace. A
read-only **Discounts** panel lists existing discounts with **inline Approve/Reject on
PENDING rows** (shown only with `pos:discount:approve`). No menu entry, no payment
collection, no order close, no KDS, no receipt controls.
**Void/Discount/Approve/Complimentary are UI-gated off orders with payment (a documented
UI-only safety boundary — the backend does not itself check payment); reject is NOT
payment-gated (non-mutating). Discount basis = subtotal; the backend threshold (default
5000) decides APPROVED vs PENDING — never inferred client-side; approve recalcs totals,
reject leaves them unchanged; no optimistic totals.** **Complimentary = Outcome B**: a
whole-order 100% discount + persisted `metadata {complimentary,category}` + reason
(whole-order only; may return PENDING) — NOT a void and NOT a refund. **Self-approval is
backend-permitted; the UI matches it and flags it** (a backend guard is recommended).
Void is NOT a refund/complimentary/post-close void. **transfer-server is deferred (Outcome
B — no safe server selector); `pos:order:transfer` is a single backend gate for BOTH
transfer-table and transfer-server, so the transfer-server endpoint is API-reachable
for Supervisor but has NO UI.** Out-of-scope (never wire without approval): transfer
server, refund, post-close void, payment collection, order close. All three roles share
one idle-logout mechanism (`pos-shell/idle`).

**Reservation lifecycle (Prompt 4A — COMPLETE WITH KNOWN LIMITATIONS, isolated Neon QA executed):**
`SEATED → COMPLETED` is exposed via `POST /api/reservations/:id/complete`
(`pos:reservation:update`, already on Supervisor/Owner/Manager — do NOT add a new
permission) and **auto-fires on order close** at the single `OrdersService.transitionOrder`
CLOSED choke point (explicit `seatedOrderId` linkage, retry-safe, never in Cashier FE).
All reservation transitions use guarded conditional updates (concurrency-safe). Lists are
bounded server-side: `scope=active|history`, `pageSize` default 25 / **max 100**, derived
`overdue` (never auto-NO_SHOW). Only schema change is the `ReservationEventType.COMPLETED`
enum + migration `20260518000000_...`, **not yet deployed to shared Neon**. **Testing
rule:** destructive reservation QA runs ONLY on a disposable Neon branch; the shared
dev/demo branch is read-only for QA; no mass shared-Neon data repair without approval.

**Reservations UI (Prompt 4B — COMPLETE WITH KNOWN LIMITATIONS):** premium master-detail
workspace over the 4A scope contracts. **Views = Arriving / Seated / Attention / History**
(UI groupings, never persisted statuses). **One bounded `scope=active` query** feeds the
three active views (client derivation — no browser merge, no triple-fetch); **History** is a
separate lazy `scope=history` query (server-paginated, default 25/max 100). Default =
Arriving + today + page 1; **never** default to All / all-dates / all-statuses / full history
/ pageSize 100. Lifecycle actions expose already-verified endpoints (all already permitted for
Supervisor — **do NOT add a permission, do NOT change the backend**): Create / Confirm /
Assign-table / Seat / Cancel / No-show / Manual-complete; **action availability mirrors backend
`VALID_TRANSITIONS` exactly** (never offer an action the service would 409); No-show is **never**
offered for SEATED and **never** automatic; Seat fabricates **no** order. **Attention** = server
overdue (grace 15m, PENDING/CONFIRMED) + structural SEATED issues (no linked order / linked-order
closed / no table); **individual actions only — NO bulk resolution**; the 6 order-less SEATED +
55 overdue shared records surface individually (no mass repair without approval). Guest privacy:
names in rows, contact only in the workspace/create form. Deposit stays read-only (create accepts
optional `depositRequired` amount; no payment/deposit capture). Cross-role invalidation is narrow
(Supervisor active/history/detail/events + Supervisor Floor overlay + Waiter reservations/floor
only — never menu/profile/auth/shift/approvals/all-orders/cashier). ⚠️ **Manual-complete +
order-close auto-completion require migration `20260518000000_prompt4a_reservation_completed_event`
on shared Neon** (see `ai/SUPERVISOR_RESERVATIONS_SHARED_NEON_DEPLOYMENT_READINESS.md`); all other
actions + Attention/overdue work on shared today.

Full list with rationale/dates: `docs/DECISIONS.md`.

## 12. Do NOT (prohibited)

- Do not implement out-of-scope order-resolution actions: refund creation/approval,
  post-close void, transfer **server**, payment collection, order close. Reservations
  Prompt 4A (backend) + 4B (UI) are complete — do not start the full Approvals-page
  reconstruction, and do not extend Reservations beyond the 4B scope (no reservation
  deposit capture / payment, no bulk resolution, no new reservation status). (Prompt 3A's
  Request bill + Mark served, 3B1's Split bill/Split items/Move items/Merge, 3B2's
  **Transfer table** + **Find order**, 3B3A's active-order **Void** + **Discount
  request**, and 3B3B's discount **Approve/Reject** + **Complimentary** are already live
  and in-scope; do not extend beyond them without approval. transfer-server stays
  UI-blocked pending a safe server selector even though `pos:order:transfer` makes its
  endpoint reachable. Do not add a backend self-approval guard, refund, or post-close
  void UI without approval.)
- Do not reintroduce an Orders navigation tab (Waiter or Supervisor).
- Do not recreate role-specific Floor components (the old `WaiterTable*` /
  `SupervisorTable*`/`SupervisorFloor*` files were intentionally deleted).
- Do not redesign the completed Waiter experience.
- Do not alter API contracts, DTOs, Prisma schema, migrations, seed/demo import,
  permissions, auth semantics, or branch isolation.
- Do not edit Postman collections unless an actual contract change requires it.
- Do not build the Manager UI (planning only exists).
- Do not broadly refactor React Query or the performance architecture.
- Do not hide known limitations or fabricate QA results.

If an issue needs a future feature phase, **document it — do not implement it.**

## 13. Shared-component reuse rules

- Equivalent UI concepts across roles **must** consume the shared assets in
  `apps/web/src/components/pos-shell/`, `.../components/floor/`, and
  `.../components/profile/` — never fork a per-role copy.
- When you change a shared component, verify **every** consuming role.
- Icons come **only** from the canonical registry
  (`pos-shell/role-icon-config.ts` + `role-icons.ts`); reference by name, never
  import Phosphor directly in routes/screens. Sizes/weights use the registry
  tokens (bottomNav 24 / compactAction 18 / pageState 32; active nav `fill`,
  inactive `bold`).

## 14. Database & migration rules

- Prisma + Neon Postgres. Schema at `packages/db/prisma/schema.prisma`;
  migrations committed under `packages/db/prisma/migrations/`.
- Never edit a shared/applied migration. New migration or (local-only) reset.
- Seed (`seed.ts`) is idempotent and must stay so. Money is Decimal-safe
  end-to-end; stock must not go negative without a controlled override.
- **In an onboarding/polish pass, do not run migrations or seed and do not change
  seed/demo data.**
- **Shared/production Neon deploys use `db:migrate:deploy` (`prisma migrate deploy`)
  ONLY — never `db:migrate`, which is `prisma migrate dev` (shadow DB / drift-reset,
  unsafe on shared). Prisma migrations need a DIRECT (non-pooled) Neon connection —
  strip `-pooler` from the endpoint host.** Any shared-Neon migration/seed requires an
  explicit per-cutover authorization gate (read-only preflight + a retained
  pre-migration recovery branch first); Postgres enum values cannot be dropped, so
  recovery = branch restore / forward-fix, never enum-value removal. The Prompt 4A
  `COMPLETED` enum migration + the `pos:order:transfer` seed mapping were deployed to
  `production` in Prompt 4C (2026-07-29) under such a gate.
- **Isolation for disposable-branch QA:** swapping `apps/api/.env` alone does NOT
  isolate a Node process — an inherited shell/profile `DATABASE_URL` overrides it
  (`dotenv` never overrides an already-set env var). To target a disposable branch,
  unset that env, point BOTH `apps/api/.env` and `packages/db/.env` at it, and verify
  isolation with a READ before any write. Destructive/mutation QA never runs against
  `production`.

## 15. Performance-preservation rules

Recent hardening must not regress. Avoid reintroducing: duplicate `/api/auth/me`
or shell/readiness queries, duplicate timers, Floor/reservation request storms,
responsive double-mounts, broad query invalidation, blocked mutation settlement,
or full-page loading for ordinary actions. The API client has a bounded 30s
timeout + AbortController + request IDs; secondary invalidations are non-blocking.
Cashier startup was reduced from ~101 → ~9 requests — keep it that way.

## 16. Validation & completion expectations

Before claiming any phase complete, run **executable** validation:

- `typecheck`, `lint`, `build` for `@nimbus-pos/web` (all must pass).
- `GET /api/health` returns `ok`.
- `git diff --check` clean; every Postman collection JSON still parses; Postman
  contract diff empty unless a real contract change was required.
- Authenticated QA across the viewport matrix (1024×768, 1366×768, 1440×900,
  1920×1080) — see `docs/TESTING_AND_QA.md`.
- **Browser/E2E QA:** a Playwright harness exists at `apps/web/playwright.config.ts`
  + `apps/web/e2e/supervisor-prompt3/` (4 viewport projects, env-driven creds, no
  hard-coded secrets; artifacts git-ignored). Reuse/extend it — don't fork a new one.
- **Destructive/mutation QA uses an ISOLATED disposable database (never shared
  Neon).** Stand up a local Docker `postgres:16` (unique DB name + non-conflicting
  port), `migrate deploy` + `db:seed` (+ `db:demo:import` for a Supervisor login),
  run against an isolated API/web on non-default ports, then tear it all down. Full
  recipe in `docs/TESTING_AND_QA.md`.
- **Never claim a phase complete without executable validation.** Report failures
  honestly with the command + exact output (see `ai/AI_ERROR_PROTOCOL.md`).
- Update `ai/AI_STATUS.md`, `PROGRESS.md`, `repo file tree.txt` (if structure
  changed), and write a completion report from
  `ai/AI_COMPLETION_REPORT_TEMPLATE.md`.

## 17. Known high-risk areas

- Neon/local Prisma connection-pool pressure & cold-start latency (external, not
  a frontend bug). Only one API process on `:3001` at a time.
- Backend gaps that block frontend features (e.g. no per-line sent-order state →
  post-send item additions blocked; no verified reservation-completion contract).
- Legacy documentation that still describes a 5-tab Supervisor with an Orders
  page — treat as **superseded** (see `docs/DOCUMENT_INDEX.md`).

## 18. Deferred features

Full accounting, payroll admin, franchise, developer portal, owner SaaS billing,
PesaPal diner checkout, live mobile-money (MTN/Airtel) diner payments, printer
drivers, terminal/acquirer traffic, MSR/badge login, and smart spouts. Details in
`docs/KNOWN_LIMITATIONS.md`.

## 19. When documentation conflicts with code

1. Trust the **local worktree code** and the top-of-file "Current State" in
   `ai/AI_STATUS.md`.
2. Verify against the route registry, navigation, and permissions in code.
3. Update the stale doc (or add a supersession notice) — do **not** change code
   to match stale docs, and do **not** rewrite historical completion reports as
   if they were current specifications.
