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
- **Brand (2026-08-20):** the **Aug-2026 Nimbus POS Brand Identity** (designer
  Andimashimwe Rhoda) has **fully landed** in the frontend — navy/silver/graphite
  tokens, an alpha-channel token system, true-vector steering-wheel logo assets in
  `apps/web/public/brand/`, and the `NimbusLogomark` brand mark. Canonical
  reference: **`docs/BRAND_IDENTITY.md`**. Do not reintroduce pre-Aug-2026 palette
  values from the `Front End/` doc packs.

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
| Codex onboarding | `CODEX.md` |
| Progress / status | `PROGRESS.md` → detailed live tracker `ai/AI_STATUS.md` |
| Architecture (index) | `ARCHITECTURE.md` → detail `docs/ARCHITECTURE.md`, `docs/UI_SYSTEM.md` |
| Document catalog | `docs/DOCUMENT_INDEX.md` |
| Repo map | `docs/REPOSITORY_MAP.md` |
| UI/design system | `docs/UI_SYSTEM.md`, `PRODUCT.md` |
| Brand identity (palette/logo/type) | `docs/BRAND_IDENTITY.md` (canonical, Aug-2026 rebrand — supersedes every `Front End/` palette table) |
| Waiter role UI | `docs/waiter-ui-docs/{README,WAITER_API_MATRIX,WAITER_LIFECYCLE}.md` (canonical, new 2026-08-20) |
| Cashier API contract | `docs/cashier-ui-docs/CASHIER_API_MATRIX.md` (canonical, new 2026-08-20 — supersedes the legacy `Front End/cashier_ui_docs_pack` matrix) |
| Role journeys | `docs/ROLE_JOURNEYS.md` + per-role lifecycle docs |
| Capability matrix | `docs/ROLE_CAPABILITY_MATRIX.md` |
| **Enterprise UI plan (canonical)** | **`ai/ENTERPRISE_UI_ROADMAP.md`** (new 2026-08-20; Tracks A/B/C — **supersedes `ai/MANAGER_RECONSTRUCTION_ROADMAP.md` from M-P2 onward**) |
| Manager Operations + Staff (Track B3) | `ai/ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md` (canonical B3 record, 2026-08-20) + `ai/ENTERPRISE_B3_QA_EVIDENCE_INDEX.md` |
| **Manager Accounting (Track B5.1/B5.2/B5.3)** | **`ai/ENTERPRISE_B5_1_ACCOUNTING_SHELL_COMPLETION_REPORT.md`** (canonical B5.1 record, 2026-08-21) + **`ai/ENTERPRISE_B5_2_CUSTOMERS_VENDORS_COMPLETION_REPORT.md`** (canonical B5.2 record, 2026-08-21) + **`ai/ENTERPRISE_B5_3_BANK_RECONCILIATION_COMPLETION_REPORT.md`** (canonical B5.3 record, 2026-08-21) — the frontend accounting contract is the executable registry `apps/web/src/lib/accounting/route-registry.ts` |
| Manager dashboard (Track B2) | `ai/ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md` (canonical B2 record, 2026-08-20) — shell record: `ai/ENTERPRISE_B1_TOPNAV_COMPLETION_REPORT.md` |
| Odoo reference + gap analysis | `ai/ODOO_REFERENCE_RESEARCH.md` (+ `ai/odoo-reference-screenshots/`), `ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md` |
| Track C backend gap batch 1 (C-02/MP0-10/MP0-09/C-01) | `ai/BACKEND_GAP_BATCH1_COMPLETION_REPORT.md` (canonical record, 2026-08-20) |
| **Backend gap batch 2 (PC-03 · PC-04)** | **`ai/BACKEND_GAP_BATCH2_COMPLETION_REPORT.md`** (canonical record, 2026-08-21) |
| **Permissions cutover (C-21 · FU-1 · B3-F1)** | **`ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md`** (canonical record, 2026-08-20) |
| **Accounting/finance API verification (Track B0)** | **`ai/ACCOUNTING_API_VERIFICATION_REPORT.md`** (canonical B0 record + the B5 go/no-go, 2026-08-20) |
| Locked decisions | `docs/DECISIONS.md` |
| Testing / QA | `docs/TESTING_AND_QA.md` |
| Known limitations | `docs/KNOWN_LIMITATIONS.md` |
| Process / governance | `AGENTS.md`, `ai/AI_GOVERNANCE_PROMPT_UPDATED.md`, `ai/AI_ERROR_PROTOCOL.md` |
| API/Postman contract | `docs/API_CONVENTIONS.md`, `docs/POSTMAN_ENDPOINT_GUIDE.md` |
| Supervisor reconstruction | `ai/SUPERVISOR_RECONSTRUCTION_ROADMAP.md`, `docs/supervisor-ui-docs/*` |
| Cashier reconstruction | `docs/cashier-ui-docs/*`, `ai/CASHIER_FLOOR_RECONSTRUCTION_*.md` (**C3 complete 2026-08-20**; C4 not started) |

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
| **Cashier** | **Floor · Till · Me** (Prompt C1–C3, default `/cashier/floor`; Queue/Receipts are hidden compatibility routes reachable by direct URL only, retire C4/C5) | Payment collection, receipts, till/close (C2 delivered table→bill resolution + the canonical settlement workspace + Find bill; **C3 delivered payment / partial / split / close execution inside that workspace**; receipts + refunds arrive C4) |
| **Supervisor** | **Floor · Reservations · Approvals · Me** | Read-first oversight; table-control workspace behind Floor selection |
| **Manager** | **Overview · Operations · Staff · Reports · Accounting · Settings · Me** as an Odoo-style TOP NAV BAR module bar (Track B1, 2026-08-20; landing `/manager/overview`; owner-approved `docs/DECISIONS.md` D-MGRTOPNAV — supersedes the M-P1 bottom-nav presentation). ⚠️ **SEVEN, not six, since 2026-08-21** — **OD-3 approved** and Accounting was inserted before Settings in Track B5.1; the "exactly six tabs" lock governed the BOTTOM-NAV presentation D-MGRTOPNAV superseded, never the number of modules. Overview/Me are direct links; **Operations, Staff, Reports and Accounting are MODULES** whose root redirects into real sub-routes (`/operations/{orders,tables,reservations}`, `/staff/{directory,onboarding,quick-pin,leave,shift-swaps}`, `/reports/{catalog,runs}`, `/accounting/dashboard`); only Settings still hosts one real link + an honest not-yet tree. | Branch-level oversight. M-P1 shipped shell/nav/guard/**branch switcher** + a real Me; B1 the top-nav shell + chrome primitives; **B2 the live Overview dashboard**; **B3 the eight Operations + Staff surfaces — Operations strictly READ-ONLY, Staff writing only onboarding / Quick-PIN / leave review / shift-swap REJECTION (Outcome C, no Approve control)**; **B4 the two Reports surfaces**; **B5.1 the Accounting module — a 28-row grouped menu tree and a five-card dashboard**; **B5.2 turned 12 of those 28 rows live — Customers (Invoices, Customer accounts, Credit notes) and Vendors (Bills, Suppliers, Credit notes, Payments, Recurring profiles, Payment reminders) list/detail surfaces plus Reporting → Aged receivable/payable — all READ-ONLY BY PERMISSION with no write affordance anywhere, not even disabled**; **B5.3 turned 3 more live — Bank accounts (list-only), Bank statements and Reconciliation (list+detail) — same read-only guarantee, no Match/Skip/Complete control anywhere, for 15 of 28 rows live total**. Settings (B6) data is **NOT started** |

⚠️ **Cashier Floor-First reconstruction (locked target, C3 complete / C4 not started, 2026-08-20):**
Cashier's Queue-first navigation above is **historically complete and demo-ready but superseded** as
the target architecture. The locked target nav is **Floor · Till · Me** (default route
`/cashier/floor`), landing on the same shared `OperationalFloor` as Waiter/Supervisor. C2 delivered
table-to-bill resolution plus the canonical settlement workspace and a bounded **Find bill** sibling;
**C3 (2026-08-20) delivered payment / partial / split / close execution inside that workspace** by
mounting the existing verified checkout primitives. Queue and Receipts are removed
as standalone navigation/pages **only after** their capabilities are migrated (a 7-prompt C0-C6
reconstruction).
Canonical docs: `docs/cashier-ui-docs/*`, `ai/CASHIER_FLOOR_RECONSTRUCTION_DECISION.md`,
`ai/CASHIER_FLOOR_RECONSTRUCTION_GAP_REGISTER.md`, `ai/CASHIER_FLOOR_RECONSTRUCTION_ROADMAP.md`
(roadmap), plus the C0 audit set under `ai/CASHIER_FLOOR_RECONSTRUCTION_C0_*`/`ai/CASHIER_FLOOR_
RECONSTRUCTION_{COMPONENT,ROUTE_AND_NAV,CAPABILITY_MIGRATION,PERMISSION_AND_API,TEST_INVENTORY}*.md`.
**Do not begin C4 implementation (receipt print/reprint/deliver, receipt search, refund execution),
remove or redirect Queue/Receipts, or fork the shared Floor for Cashier without explicit
authorization to proceed past C3.** The previously completed Cashier payment, split,
receipt, Till, refund, session, profile, and performance logic is **preserved and reused**, not
rewritten — see `docs/cashier-ui-docs/AGENTS.md`.

- Payment collection / order close / till are **Cashier-owned**. Supervisor may
  only **read** payment/order state. Waiter cannot collect payment or close.
- **There is NO visible Orders tab** for Waiter or Supervisor. Order work is
  reached from Floor **after** a table is selected. Legacy `/waiter/orders` and
  `/supervisor/orders` routes exist only as **redirects** into Floor (preserving
  `tableId`/`orderId`).

## 10. Current implementation milestone

**ENTERPRISE UI TRACK B5.3 COMPLETE — Manager Accounting Bank reconciliation surfaces (2026-08-21) —
A: B5.3 COMPLETE / B5.4…B5.6 GATED.** Frontend + docs only; **no backend / schema / migration /
seed / permission / DTO / Postman change**. The three Bank menu rows B5.1 shipped as honest not-yet
placeholders — Bank accounts, Bank statements, Reconciliation — are now real surfaces. **The
Accounting menu goes from 12 live rows to 15** (of 28 total). Manager accounting stays **read-only by
permission** — same 15 read strings, zero writes (PC-01, re-verified live: 5/5 representative bank
writes → 403); the no-write-affordance guard was extended over the new tree, never relaxed —
Reconciliation is Odoo's most action-heavy accounting surface (Match/Skip/Reconcile/Validate) and
NONE of those controls exist here, not even disabled; `AccountingReadOnlyCard` names the denied
actions instead.
**Bank accounts** is list-only (the registry has no `bank.account` detail key, matching how B5.2
shipped Credit notes list-only). **Bank statements** is list+detail (statement header + its full
line-level table — date, description, direction, amount, match state). **Reconciliation** is
list+detail (a three-stage `OPEN → IN_PROGRESS → COMPLETED` `ManagerStatusPipeline`, `DISPUTED` as an
exit chip rather than a fourth stage, the statement balance/matched total/**difference** figures, and
per-line match evidence naming journal-line vs. manual-entry). All three routes are **PC-06 bare
arrays** (no envelope, no server total, no server-side status filter beyond an optional
`?bankAccountId=`) — the status filter on Bank statements/Reconciliation runs entirely CLIENT-side
over the already-fetched complete array and is proven, by a Playwright spec, never to reach the
server as an unsupported query parameter. No pager binds to any of the three lists.
The B5.1 Bank dashboard card — a permanent empty state since B5.1, because the demo dataset carried
zero bank rows — is now wired for real: `bank.accounts`, `bank.reconciliations` and
`bank.activeReconciliations` all gained a real `drillIn` in `ACCOUNTING_KPI_BINDINGS`, replacing
their `noDrillInReason` placeholders.
**Fixtures created live via the API (Owner token — Manager holds no accounting write) on the
isolated stack**, since the demo dataset carries zero bank accounts/statements/reconciliations by
default: 2 bank accounts (one active, one inactive — proving the Active/Inactive badge), 2 statements
(a 5-line mixed CREDIT/DEBIT batch and a 1-line batch), 2 manual bank entries to match against, and 2
reconciliations — one **IN_PROGRESS** with 2 lines MATCHED, 1 SKIPPED, 2 UNMATCHED and a live-proven
**UGX 6,350,000 non-zero difference** (`POST .../complete` correctly returned **400** — "the endpoint
working as designed, not a defect," matching `ai/ACCOUNTING_API_VERIFICATION_REPORT.md`'s own
documented behaviour), and one **COMPLETED** with a matched, zero difference (`POST .../complete`
returned **200**). Rooftop Bar was re-verified to carry zero bank rows throughout, proving the empty
branch state exercised in QA is a real read outcome.
🔴 **One stale B5.1 type field found and fixed in this phase**: `BankAccountRow` carried a
`currentBalance` field that does **not exist anywhere** on the `BankAccount` Prisma model (confirmed
by reading `packages/db/prisma/schema.prisma` directly) — B5.1 never caught this because the Bank
card only ever rendered a count, never the field itself. Removed; `manager-b5-assertions.ts` §13 now
pins its absence.
**Validated on an isolated local Docker stack** — Postgres `:55450` (`nimbus_b53_qa`), API `:4061`,
web `:3150`; **shared Neon was never connected to or written** (the isolated API held exactly one
established TCP connection, to its own local Postgres, verified via `lsof` against its own PID); both
`.env` files were **never edited on disk** — the isolated DB target was supplied by an explicitly
exported `DATABASE_URL` (per `tools/qa/README.md`'s documented isolation rule: "dotenv never
overrides an already-set `process.env` variable"), so SHA-256 is identical before and after by
construction. Web typecheck + lint (no `--fix`) + production build all pass (3 new pages); **17/17**
assertion scripts (`manager-b5-assertions.ts` extended with a new §13 of B5.3-specific checks — no
fabricated list pager on any bare-array Bank route, enum-only client-side status filters, no
match/skip/complete function called anywhere in the tree, all three bank KPIs now link somewhere
real); `e2e/manager-accounting/bank.spec.ts` (new, 16 specs) **64/64 across 4 viewports**;
`e2e/manager-accounting/menu-and-read-only.spec.ts` (updated for 12→15 rows) **29 passed / 3 skipped**
across 4 viewports (the skips are the pre-existing "desktop dropdown only at `xl`" reason B5.1/B5.2's
own menu specs already carry, not a B5.3 gap); full `e2e/manager-accounting/` regression **66/66** at
`vp-1440x900`; `e2e/manager-shell/` regression **34/34** (includes the cross-role boundary suite);
live manual QA toured all 6 new/changed pages across both Tapas Downtown (populated) and Rooftop Bar
(genuinely empty); zero console errors; reconciliation-detail load measured at 5 real GETs + 5 OPTIONS
preflights, all GET/OPTIONS, zero writes; `/api/health` → ok throughout; `git diff --check` clean. See
`ai/ENTERPRISE_B5_3_BANK_RECONCILIATION_COMPLETION_REPORT.md`. **B5.4 (Accounting core + Review), B5.5
(Closing) and the remainder of B5.6 are NOT started — do not begin any of them without explicit owner
authorisation.** ⚠️ Note for B5.4: **C-23** — the M33 GL Postman collection cannot run (a pre-existing
defect, proven pre-existing by backend gap batch 2), so the journals surface will ship without Postman
verification.

**Prior milestone record (superseded above) — ENTERPRISE UI TRACK B5.2 COMPLETE — Manager Accounting Customers + Vendors surfaces (2026-08-21) — A: B5.2 COMPLETE / B5.3…B5.6 GATED.** Frontend + docs only; **no backend / schema / migration /
seed / permission / DTO / Postman change**. Nine of B5.1's not-yet Customers/Vendors menu rows are
now real surfaces, plus the two Reporting → Aged receivable/payable views pulled forward from B5.6
(same `ar.aging`/`ap.aging` routes the B5.1 dashboard cards already read). **The Accounting menu
goes from 1 live row to 12** (of 28 total — B5.1's prose said 24, a miscount this pass corrected by
direct inspection of `ACCOUNTING_MENU`). Manager accounting stays **read-only by permission** — same
15 read strings, zero writes; the B5.1 no-write-affordance guard was extended over the entire new
tree, never relaxed — every interactive element (row click, pagination, filtering) is a callback
PROP into an already-built chrome component, so the literal `onClick=`/`<Button` ban the assertion
script enforces over `components/manager/accounting/**` still holds with zero exceptions.
**Customers (AR):** Invoices (list+detail), Customer accounts (list+detail), Credit notes
(list-only). **Vendors (AP):** Bills (list+detail), Suppliers (list+detail — the one non-flat
`{supplier,summary,recentBills,recentPayments}` detail shape in the module), Credit notes, Payments,
Recurring profiles, Payment reminders (list-only). **Reporting:** Aged receivable, Aged payable —
full-page unpaginated branch reports. All ten AR/AP dashboard KPIs whose "arrives in B5.x"
placeholder pointed at one of these now link there for real.
🔴 **One live-QA-caught frontend bug, found and fixed in this phase**: the shared `detailRequest()`
helper in `lib/accounting/api.ts` blindly appended `/${id}` to every detail route's registry path.
Three entries (`ar.invoice`, `ar.account`, `ap.bill`) already carry a path with a literal `:id`
placeholder, so the result was a malformed double-id URL that 404'd — every invoice/account/bill
detail rendered an honest-looking but WRONG "unavailable" screen for a perfectly valid id,
undetected by typecheck/lint/build/assertions (all passed with the bug present). Caught only by
opening a real record in the browser against the isolated stack and cross-checking the same id with
a direct `curl` (200). Fixed by having `detailRequest()` replace a literal `:id` in the path when
present, re-verified live for all four detail-bearing surfaces.
⚠️ **A second, smaller defect found and fixed**: `scripts/manager-b3-assertions.ts`'s HR-employee-
PII sweep (written pre-Accounting, banning `taxId`/`bankAccount` anywhere in the Manager tree)
collided with the Vendors Supplier record's own, unrelated, non-PII `taxId`/`bankName` fields — the
sweep now excludes the accounting subtree (which has its own separate read-only guard) with a
written reason; the sweep's real target, employee PII, is unaffected everywhere else.
**Validated on an isolated local Docker stack** — Postgres `:55440` (`nimbus_b52_qa`), API `:4051`,
web `:3140`; **shared Neon was never connected to or written**; `apps/api/.env` and
`packages/db/.env` SHA-256 **identical before and after**; every process this pass started was
tracked by PID/container name and stopped individually at teardown, no other host process touched.
Web typecheck + lint (no `--fix`) + production build all pass (13 new/changed accounting pages);
**17/17** assertion scripts (`manager-b5-assertions.ts` extended with a new §12 of B5.2-specific
checks — enum-only filters, clamp-aware paging, per-file pager eligibility, real `drillIn` on every
AR/AP KPI; `manager-b3-assertions.ts` fixed for the cross-domain false positive above); **live manual
QA toured all 11 new pages** on the isolated stack (Manager demo login) — menu tree confirmed
exactly 12 live rows, dashboard KPI links confirmed clickable and correctly routed, status filter
confirmed to narrow results/tag the URL/never send an invalid value, branch switch confirmed to
re-scope Aged receivable, zero console errors and GET-only bounded (2–4 requests/page) network
traffic throughout; `e2e/manager-accounting/` (new customers/vendors/reporting specs + updated
menu-and-read-only + the full existing suite) **190 passed / 10 skipped / 0 failed** across **4
viewports** (the 10 skips are the pre-existing 1280×680-only evidence pair, unrelated to B5.2);
`e2e/manager-shell/` regression **34/34** at `vp-1440x900` (includes the cross-role boundary suite —
waiter/cashier/supervisor cannot open Manager, Manager cannot open their workspaces); aging
cross-check (Tapas Downtown → Rooftop Bar) confirmed the dashboard card and the new Aged report
agree exactly for the same branch and change together on a branch switch; `/api/health` → `ok`
throughout; `git diff --check` clean. See
`ai/ENTERPRISE_B5_2_CUSTOMERS_VENDORS_COMPLETION_REPORT.md`. **B5.3 (Bank reconciliation workbench),
B5.4, B5.5 and the remainder of B5.6 are NOT started — do not begin any of them without explicit
owner authorisation.**

**Prior milestone record (superseded above) — BACKEND GAP BATCH 3 COMPLETE — accounting read-integrity fixes B5-F1…F4 (2026-08-21) — A: COMPLETE / B5.2 UNBLOCKED ON READ INTEGRITY / NOT STARTED / SHARED-NEON DEPLOY STILL GATED.** Track B5.1
surfaced four read-integrity findings once the dashboard actually consumed these routes; this batch
(Track C **C-24**, owner-authorized) fixes all four at the source and sweeps every sibling route
with the same defect class. Backend source + tests + docs, plus a minimal explicitly-authorized
frontend follow-through; **no Prisma schema change, no migration, no seed change, no permission
change, no DTO contract-shape change.** Validated on an isolated local Docker stack; **shared Neon
was never connected to or written.**
🔴 **B5-F1 FIXED — `ar/aging.summary` now aggregates the full `where`, not the returned page.**
`AccountsReceivableService.getAgingSummary()` used to reduce `summary.*` from the same paginated
`findMany` page that backs the `accounts[]` display breakdown, while `total` came from a separate
unpaginated `count()` — the two numbers were computed over different result sets. Fixed by adding a
third query, unpaginated and minimal-column, over the identical `where`, and reducing `summary` from
that instead. **Unit-proven page-size independence**: a synthetic five-invoice dataset (UGX
9,106,400, the historical repro figure) returns the identical `summary.totalOutstanding` at
`take=1`, `take=3`, and unpaginated, while `accounts[]` still varies with the page. **Live-proven on
a real dataset exceeding the page size**: 120 additional invoices were created via the live API on
the isolated stack's Tapas Downtown branch (125 open invoices total, SQL ground truth UGX
10,306,400); the live endpoint returns the identical 10,306,400 at `take=1`/`3`/`100` — where the
**pre-fix formula would have shown just UGX 10,000** (the single invoice on a `take=1` page), a
~99.9% understatement. The Manager dashboard's Receivable card, live-screenshotted against this
125-invoice branch, renders the full 10,306,400 with zero console errors.
🔴 **B5-F2 FIXED — unvalidated `status`/`type` filters swept across seven endpoints.**
`GET /ar/invoices?status=<invalid>` took `status` as a raw `@Query()` string handed straight to
Prisma, so an `InvoiceStatus` value that doesn't exist (e.g. `OVERDUE`, real on `VendorBillStatus`)
threw and surfaced as a 500. The same raw-string-to-Prisma pattern was swept and fixed on six sibling
fields: `ap/payments.status`, `ap/credit-notes.status`, `ar/credit-notes.status`,
`ap/suppliers.counterpartyType`, `posting-errors.status`, and
`finance/procurement-suggestions.{status,urgency}` — all now validate with `@IsEnum` DTOs (five new
DTO files), matching the pattern `ap/bills` already used. New DTO-level spec files assert invalid →
400, every real enum value → 200, omitted → 200 unfiltered.
⚠️ **B5-F3 FIXED — a real server-side page-size maximum on all fourteen paginated accounting/finance
list routes.** B0's original "pagination bound" probe combined `take`+`pageSize`+`limit` in one
request; the unrecognised extra keys 400'd and every route was misread as bounded. Re-probed with
`take` alone, `ap/bills`/`ar/invoices`/`journals`/`ar/aging` all returned 200 at `take=5000` — no
real maximum existed. A shared `MAX_ACCOUNTING_LIST_PAGE_SIZE = 100` + `clampTake()` helper
(`apps/api/src/common/pagination/`, mirroring the pre-existing `MAX_LEAVE_PAGE_SIZE` precedent in
`attendance.service.ts`) now bounds `ar/invoices`, `ar/aging`, `ar/credit-notes`, `ar/accounts`,
`ap/bills`, `ap/suppliers`, `ap/payments`, `ap/credit-notes`, `ap/recurring-profiles`,
`ap/reminders`, `accounting/accounts`, `journals`, `posting-runs`, and `posting-errors` — a DTO-level
`@Max(100)` plus a service-side clamp backstop. `ap/aging` (intentionally unpaged) and the ten
PC-06 bare-array routes (no `take` parameter) are unaffected by design. ⚠️ This surfaced a
**regression this same fix caused, and fixed**: batch 2's `accounting-branch-scoping.e2e-spec.ts`
used `take=500` in fourteen places for its tiny fixtures — now correctly 400s; updated to `take=100`
(still "all of it" for 1–3-row fixtures) with a documenting comment, no assertion weakened.
⚠️ **B5-F4 FIXED — `GET /api/audit/timeline` now honours `X-Branch-Id`.** It previously scoped a
branch only via the optional `?branchId=` query param and ignored the header entirely, so the
default read mixed every branch in the org together. It now unconditionally ANDs the acting branch
from `X-Branch-Id` (mirroring the AR/AP "header scopes it; the query param narrows within that
scope" precedent from batch 2); a disagreeing `?branchId=` ANDs both clauses and correctly returns
nothing rather than leaking. No consumer exists yet (the B5.4 audit rail is not mounted), so nothing
depended on the old behaviour.
**Frontend follow-through (minimal, required by the brief).** `isArAgingComplete()` in
`lib/accounting/model.ts` used to withhold the Receivable card's money whenever the returned page
didn't cover every matching invoice — the UI-side mitigation for B5-F1. Now that the backend
guarantees `summary` correctness unconditionally, that gate would have **incorrectly withheld a
now-correct balance** on any branch with more than 100 open invoices (the frontend's own page size)
— proven by the 125-invoice live test above, which is exactly such a branch. Simplified to a
well-formed-response guard (response present; `total`, `summary` readable; `accounts` is an array);
the withheld-state markup is **kept** as a malformed-response fallback, not removed. Card docblock
and footnote copy updated to describe the fixed contract. `manager-b5-assertions.ts` had two B5-F1
assertions **inverted, not deleted**, each naming the date and the reason.
⚠️ **One new finding recorded, not implemented: BGB3-L3** — `LedgerService.listJournals`/
`listPostingRuns` still use strict `where.branchId = branchId` on **nullable**
`JournalEntry.branchId`/`PostingRun.branchId` columns, the same PC-03 defect class fixed elsewhere
in batch 2 (`listPostingErrors` already got this fix). Out of this batch's authorised scope
(B5-F1…F4 only) — a future pass should apply `branchOrOrgScope` here too. **PC-01/PC-02/PC-06/C-23
remain open and unaffected by this batch.**
**Validated on an isolated local Docker stack** — primary Postgres `:55436`, API `:4041`, web
`:3130`; a second isolated Postgres `:55437`, API `:4042`, web `:3131` for the multi-page dataset
proof only (kept separate so the synthetic B0-QA invoices never touched the regression-comparison
dataset). `apps/api/.env` and `packages/db/.env` SHA-256 **identical before and after**. Touched/new
unit suites **237/237**; full API unit suite **1165/1161/4** (after) vs **1104/1100/4** (`6e284e9`
baseline, throwaway worktree, same node_modules) — **identical 4 pre-existing `client-onboarding`
failures, zero new failures**; AP/AR/branch-scoping e2e **122/122**; full API e2e suite **1043
tests, 922 passed, 121 failed** both before and after, with a **byte-identical failing test-name
set** (zero regressions, zero incidental fixes) on equally clean isolated databases; newman **M32
17/34 0 failed, M34 23/46 0 failed, M35 21/45 0 failed, M36 18/24 0 failed, M37 24/44 0 failed, BG2
22/48 0 failed**, **M33 20 assertions failed — pre-existing C-23, unaffected**; web typecheck + lint
+ build all pass (`/manager/accounting/dashboard` 7.57 kB); **17/17** assertion scripts;
`e2e/manager-accounting` Playwright **25/25** at `vp-1440x900` against the pristine isolated stack
(one spec inverted per the fixed contract, matching the pattern above); `e2e/manager-dashboard`
regression **21/21** at `vp-1440x900` — B2 untouched; `/api/health` → `ok`
throughout; all five pre-existing dev servers (`:3000/:3001/:3003/:3008/:3009`) verified healthy
before and after; `git diff --check` clean.
⚠️ **Self-inflicted incident, caught and fully reverted before any test relied on it:** the first
`pnpm lint` invocation used the package's own `--fix` script, which reformatted **193 unrelated,
untouched files** across the API tree (a pre-existing repo-wide prettier drift this batch did not
introduce and was not authorised to fix). Caught immediately via `git status`; every collateral file
was reverted to `HEAD` with `git checkout HEAD --`, verified by diffing the modified-file list
against the batch's own 23-file change list until they matched exactly. All subsequent lint checks
in this report ran targeted `eslint` (no `--fix`) against only the files this batch touches.
**No commit occurred as part of the fix work itself** — see the commit note at the end of this
entry. **B5.2 (Customers + Vendors lists) is unblocked on read integrity but remains NOT started —
do not begin it, or any later B5 sub-phase, without explicit owner authorisation.** See
`ai/BACKEND_GAP_BATCH3_COMPLETION_REPORT.md`.

**Prior milestone record (superseded above) — ENTERPRISE UI TRACK B5.1 COMPLETE — Manager ACCOUNTING module shell, menu tree and dashboard
(2026-08-21) — A: B5.1 COMPLETE / B5.2…B5.6 GATED.** Frontend + docs only; **no backend / schema /
migration / seed / permission / DTO / Postman change**. Accounting becomes the **seventh Manager
module** (**OD-3 approved**), inserted before Settings, shipped as one more `MANAGER_MENU_GROUPS`
entry over the shared `OperationalTopNav` — **never a fork**. New role-agnostic `lib/accounting/*`
(OD-2: an Accountant role can later mount the same module) with exactly ONE Manager-shaped adapter,
`lib/manager/accounting-context.ts`.
**MANAGER ACCOUNTING IS READ-ONLY BY PERMISSION, not by product preference.** Manager holds 15
accounting read strings and **zero writes** (PC-01/PC-02 — re-verified live: 5/5 representative
writes → **403**), so **no write affordance renders anywhere, not even a disabled one**; the
assertion script bans a write `method:`, `useMutation`, `<Button`, `onClick=` and `<form>` in the
whole accounting tree, and the e2e proves zero non-GET requests and zero disabled buttons. Where an
Odoo user would reach for `New` / `Upload` / `Post` / `Approve` / `Match`, a panel names the action
and the route, and says an Owner or Accountant performs it.
**MENU TREE: 24 rows, 1 live link, 23 honest phase-tagged not-yet rows**, grouped under Odoo's own
headings (Customers · Vendors · Bank · Accounting · Review · Reporting · Configuration). Every row
cites a live-verified endpoint in the new 38-route `ACCOUNTING_ROUTE_REGISTRY`, and
`assertAccountingMenuIsBacked()` runs **at module scope** — a row citing an unknown endpoint, or one
Manager cannot read, **fails the build**. Eleven Odoo item groups are **ABSENT with written
reasons**, including the **eleven financial statements** (no endpoint exists — NG-07 → C-11),
**Receipts** and **Manual entries** (⚠️ both **POST-only**; the roadmap's own menu table listed
Receipts — corrected here) and **Procurement suggestions** (403 for Manager, PC-02).
**FIVE CARDS, every figure registry-bound** through the 19-entry `ACCOUNTING_KPI_BINDINGS` (an
unregistered key **throws**): Customers—receivable · Vendors—payable · General ledger · Bank ·
Fiscal period. Live Tapas Downtown: **UGX 9,106,400** receivable / 5 open invoices, **UGX 1,282,400**
payable / 3 open bills, **5** journals, **0** posting errors, **FY2026-Q3 Open**. Switching to
Rooftop Bar re-scopes every branch figure (**2,454,600 / 3,263,500 / 8**) while the
**organisation-level** fiscal period stays put — the visible proof batch 2's PC-03 fix reached the
UI. **Budget-vs-actuals was OMITTED** though the brief listed it: `/finance/budgets` returns `[]` in
**both** branches on a fully seeded + demo-imported database, so no figure could be verified live
(same for demand calendar). **No charting dependency** — one hand-rolled SVG bucket-bar mark, honest
because the aging buckets are a real categorical series the backend itself computes; no time trend
exists (NG-05) so none is drawn. **PC-06 bare arrays ship as-is**, client-counted and labelled
*"Showing all N … not a server total"*; no pager is bound and `.length` is never assigned to a
`total`.
⚠️ **SUB-PHASES RENUMBERED**: the dashboard moved from B5.6 to **B5.1** and everything else shifted
by one — **B5.2** Customers+Vendors, **B5.3** Bank, **B5.4** Core+Review, **B5.5** Closing, **B5.6**
Reporting+Configuration. The renumber lives in `lib/accounting/menu.ts`, so the on-screen phase tags
and the roadmap agree.
🔴 **TWO NEW BACKEND FINDINGS, recorded not implemented. B5-F1: `ar/aging.summary` aggregates the
RETURNED PAGE, not the whole `where`** — live `?take=1` reported `total: 5` beside
`summary.totalOutstanding: 599,800` where the branch figure is **9,106,400**, so a *bounded* read
(which every Manager discipline rule demands) would have printed an understated receivable balance.
B0 missed it because its probe used the default page size on a five-invoice dataset. The card now
**withholds the balance** unless `Σ accounts[].invoices.length >= total`. **B5-F2:
`GET /ar/invoices?status=<invalid>` returns 500**, not 400 — the status query is an unvalidated raw
string. Also recorded: **B5-F3** B0's "pagination bound" column is an artefact of a combined
`take`+`pageSize`+`limit` probe (there is **no** server maximum), **B5-F4** `/api/audit/timeline`
ignores `X-Branch-Id` and pages with `pageSize`, **B5-F5** `ap/aging` is unbounded by design,
**B5-F6** the 24-row dropdown is long.
⚠️ **Two defects found and fixed IN this phase: B5-D1** a `<p>` nested inside the card footnote's
`<p>` produced 64 React warnings per load (caught by the zero-console-error gate); **B5-D2** the
receivable card explained a **failed read** with the *partial page* wording — specific, confident and
wrong — **caught by viewing the error-state screenshot, not by a test**; both are now pinned by
assertions. ⚠️ **Five assertions that pinned Accounting's ABSENCE were INVERTED, not deleted**, each
naming OD-3 and the date; the "exactly six" nav guards became "exactly seven" — still exact lists,
never relaxed.
**Validated on an isolated local Docker stack (Postgres `:55435`, API `:4031`, web `:3120`) —
shared Neon was never connected to or written** (the QA API held exactly one non-listening TCP
connection, to `[::1]:55435`) and **neither `.env` was modified** (SHA-256 identical before and
after): web typecheck / lint / production build pass; **17/17** assertion scripts incl. the new
`manager-b5-assertions.ts`; Playwright `e2e/manager-accounting/` **90 passed / 10 skipped** across
four viewports; regressions `manager-shell` **125 passed / 11 skipped** (matching the B1/B2 baseline
exactly), `manager-dashboard` **84/84**, cashier cross-role **12/12**; **9** accounting requests and
**≤14** total per dashboard load, all GET, all branch-scoped; **zero console errors**; 19 screenshots
captured and **6 viewed** at 1440×900 + 1280×680; `/api/health` → ok; `git diff --check` clean; all
five pre-existing dev servers verified healthy before and after, and the container removed.
**B5.2 (Customers + Vendors lists) and every later B5 sub-phase, plus B6 and B7, are NOT started —
do not begin any of them without explicit owner authorisation.** See
`ai/ENTERPRISE_B5_1_ACCOUNTING_SHELL_COMPLETION_REPORT.md`.

**Prior milestone record (superseded above) — BACKEND GAP BATCH 2 COMPLETE — PC-03 · PC-04 (2026-08-21) — A: COMPLETE / B5 GATE NOW 🟢 GO /
SHARED-NEON DEPLOY STILL GATED.** The second owner-authorized Track C batch clears the **two 🔴
blocking conditions** on the B5 gate. Backend source + tests + docs only; **no Prisma schema change,
no migration, no seed change, no permission change, no `demo-import.ts` change, no Postman collection
edited, no frontend file touched.** Validated on an isolated local Docker Postgres stack (`:55433`,
API `:4021`, web `:3100`) with a second container (`:55434`, API `:4022`) carrying a `bcbabd9`
worktree for the before-measurements — **shared Neon was never connected to or written**, and
**neither `.env` was modified** (SHA-256 identical before and after).
**PC-03 — the leak was wider than recorded, and each entity was ruled on from SCHEMA TRUTH, not
preference.** Three categories, not two: **NOT NULL `branchId`** (`BankAccount`, `BankStatement`,
`BankReconciliation`, `ManualBankEntry`) → **strict** equality; **nullable `branchId`** (suppliers,
bills, payments, AP/AR credit notes, invoices, customer accounts, reminders, recurring profiles,
posting errors) → *acting branch **OR** `branchId IS NULL`* — the repo's existing predicate in
`attendance`/`workforce`/`payroll`/`analytics`, because strict equality on a nullable column would
orphan every org-level row from **every** branch at once; and **no `branchId` column at all**
(`FiscalPeriod`, `PostingSourceMap`, `TaxLedgerConfig`) plus `PeriodCloseRun` (nullable, never
stamped by the close path) → **org-level BY DESIGN, documented and downgraded, no column invented.**
Both rules live once in `apps/api/src/common/scope/branch-scope.ts`, so a list and its detail cannot
drift apart again. ⚠️ **B0 undercounted and got one fact backwards:** beyond the four named reads,
**eleven further instances of the same class** were found — including **three cross-branch WRITES**
(`POST /ap/bills/:id/approve`, reconciliation `match`/`skip`), **both aging aggregates** (org-wide
money under a single-branch list), and `GET /ar/accounts`, which honoured only the optional
`?branchId=` query param and **ignored `X-Branch-Id` entirely**. And `getBankStatement` was **also**
org-scoped — the detail leaked rather than 404ing as B0 claimed. Cross-branch targets return **404,
never 403** (the B3-F1 precedent); the helpers **throw** rather than degrade to an org-wide read.
**Before → after on the same 31-case suite: 19 failed / 12 passed at `bcbabd9` → 31 passed / 0
failed.**
**PC-04 — the dead guard is fixed with two checks, because repairing the comparison alone cannot
work.** After a generation the profile points at the *next* cycle, so a "cycle already billed" check
finds nothing; it is paired with a **cadence-elapsed** check measured from `lastGeneratedAt`.
Measured before → after, three clicks of one MONTHLY 150,000 profile: **`200/200/200` → 3 bills,
450,000 billed** versus **`200/409/409` → 1 bill, 150,000**. The deliberately-red e2e is **green**,
with its "do not relax this to 200" warning retained, plus a test proving the **legitimate
next-period bill still returns 200** (count goes 1 → 2, not 1 → 3).
**PC-05 closed as a precondition:** the stale `totals.grand*` names meant `accounts-receivable.service.spec.ts`
**could not compile**, so the entire AR unit suite was dead — repaired (test-only) before the new AR
scoping tests could exist.
**PC-01 / PC-02 / PC-06 / PC-07 remain open by design** — B0 raised them as *decisions B5 must make*,
not defects, and all four are carried as explicit roadmap entries. **Do not grant Manager an
accounting write, and do not fabricate a server `total` from `array.length`.**
🔴 **New finding C-23: the M33 GL Postman collection cannot run** — it sends a literal
`{{accountId}}`, so journal creation returns **400**, cascading into 20 failed assertions over 18
requests. **Proven pre-existing** (identical failure set at `bcbabd9` on a from-scratch DB); B0 never
ran M33, so **B5.3's journals surface has no Postman verification**. **C-22** (37 unseeded
deferred-module permissions) was promoted from a passing mention to a proper Track C register row
with the **B7-must-budget** note.
**Validation:** AP+AR e2e **91 passed / 0 failed** (baseline at `bcbabd9` on a from-scratch DB: **1
failed / 88 passed**, that one being the deliberately-red test); new cross-branch e2e **31/31**;
full API e2e **98 failed / 1043** vs **99 failed / 1010** at HEAD from equally clean databases, with
the failing **test-name sets diffed** — the only difference is the PC-04 test going green, so **zero
regressions** (the 98 are pre-existing cross-suite interference in billing/HMS/quick-pin/franchise/
attendance/tenancy — **none in accounting**; B0's "272/273" was a subset run); touched unit suites
**148/148**; full API unit **1100 passed / 4 failed** with the 4 **proven pre-existing** at `bcbabd9`
(`client-onboarding`); API typecheck **0 errors**; newman **M34 23 req/46 assert 0 failed**, **M35 21/45
0 failed**, M32 17/34 0 failed, M36 18/24 0 failed, **M33 20 assertions failed — pre-existing, C-23**;
**56/56** collections parse; web typecheck + lint + production build pass; **16/16** assertion
scripts; Playwright `manager-operations` **40/40**; `/api/health` → ok.
⚠️ **Disclosed:** the first QA API launch used `PORT=4021` but `main.ts` reads **`API_PORT`**, so it
defaulted to 3001 and exited with `EADDRINUSE` — it **failed rather than taking the port**, and the
pre-existing dev API was verified healthy immediately after. The QA browser run initially failed at
login because `API_CORS_ORIGINS` defaults to `:3000` only; it was restarted with `:3100` allowed.
**Both pre-existing dev servers (`:3001`, `:3003`) were left running and verified afterwards; no
shared-Neon write occurred.**
🔴 **Shared-Neon deploy is STILL GATED and is now behaviour-visible in one more way:** accounting
reads will return **fewer** rows (one branch's, not the org's), **AP and AR aging figures will change
value**, and cross-branch AP approvals / reconciliation matches will stop working. **B5, B6 and B7
are NOT started — do not begin any of them without explicit owner authorisation.** See
`ai/BACKEND_GAP_BATCH2_COMPLETION_REPORT.md`.

**Prior milestone record (superseded above) — PERMISSIONS CUTOVER COMPLETE — C-21 · FU-1 · B3-F1 + Track B0 (2026-08-20) — A: COMPLETE / B5
CONDITIONAL GO / SHARED-NEON DEPLOY GATED.** Backend + **seed data** only; **no Prisma schema
change, no migration, no `demo-import.ts` change, no frontend file touched**. Validated on an
isolated local Docker Postgres stack (`:55432`, API `:4011`, web `:3111`) — **shared Neon was never
connected to or written**, and **neither `.env` was modified** (SHA-256 identical before and after;
isolation achieved by constructing the child-process environment explicitly).
**C-21 — the gap was 36 permission strings over 56 routes, not the 23 previously recorded.** The
earlier count was a **prefix** check, not a string check: `bank-rec` references **11**
`pos:accounting:*` strings that share the prefix with the seeded M28/M29 rows but are themselves
absent, and `budget` references two strings outside the `finance:` prefix. Measured live before the
change, **all 6 bank-rec GET routes returned 403 to Owner** — the prior claim that "`accounting`,
`ledger` and `bank-rec` are fine" was wrong. All 36 are now seeded with route-accurate descriptions.
**OD-9 is resolved with the owner's stated default, and the reasoning is recorded in the seed:**
OD-9 conditioned Manager's writes on "B0 proving the permission is held", which is unsatisfiable —
B0 can only observe what the seed grants. Grants are therefore **Owner FULL (36) · Accountant FULL
(36) · Manager READ-ONLY (15) · nobody else**. Verified live: Manager 200 on 25 of 26 accounting
GETs, **403 on all 16 write attempts**; Supervisor 403 on all 36. ⚠️ **`procurement:advisory:read`
is deliberately withheld from Manager** — that one string gates both a read **and** the mutation
`PATCH /finance/procurement-suggestions/:id/review` (**PC-02**), so granting the read would have
granted a write.
**Seed idempotence proven three ways:** run twice (36/87/1 → **0/0/0**, identical content hashes);
a **greenfield** seed converging on the identical `c2b602ce…` hash at **273 permissions / 922
grants**; and a repair run recreating exactly 56 deliberately-deleted rows.
**FU-1 — `pos:hr:compensation:read` REVOKED from Manager** (Owner + Accountant keep it), enforcing
the locked "compensation excluded from the Manager MVP" decision **at the wire** instead of relying
on the frontend not to ask. Live before → after: Manager `?view=full` **200 → 403** (list *and*
detail), `/hr/compensation-profiles` **200 → 403**; the default safe read is unchanged. Because
`seedRolePermissions` only inserts, `revokeStaleWaiterPermissions` was generalised into a
declarative `REVOKED_ROLE_PERMISSIONS` table + `revokeStaleRolePermissions()`.
**B3-F1 — Quick-PIN admin routes are now branch-guarded.** `loadEmployeeForOrg` →
`loadEmployeeForBranch` (org **and** branch, mirroring shift-swap approve), failing **closed** twice
over: a cross-branch target returns **404** (never a 403 that would confirm the id exists
elsewhere), and a **NULL-branch** employee is refused too. Live before → after: cross-branch
status/disable/enable **200 → 404**. ⚠️ **A second escape not in the original write-up was found and
closed:** `reset()` accepted `body.branchId` and fed it straight into the Quick PIN lookup hash, so
a caller could mint a PIN scoped to a branch they are not acting in — now **400**. **Onboarding does
NOT share the gap** (checked: it takes the branch from `ctx.branchId` only).
⚠️ **A hollow test was found and fixed:** the first B3-F1 e2e *looked for* a second-branch employee
and self-skipped when the dataset had none — the suite went green while proving nothing. The fixture
is now **created** through the public onboarding API, and the re-run is **19/19 with 0 skips**,
including a control proving the same id resolves 200 once `X-Branch-Id` names its own branch.
**B0 folded in and COMPLETE → `ai/ACCOUNTING_API_VERIFICATION_REPORT.md`.** 112 routes extracted and
**reconciled against the API's own `RouterExplorer` boot log** (0 unmapped, 0 missed — which is how
a parser defect was caught: `budget.controller.ts` declares **three** `@Controller` classes and the
forecast route is **`/api/franchise/forecast`**). The 75-route accounting block was verified live
across four roles with **25 live writes**, including a bank reconciliation taken to `COMPLETED` and
a fiscal period taken `DRAFT → OPEN → CLOSED → LOCKED` (**PC-07** — four states, no unlock route).
The clearest measure of what C-21 unblocked: the AP+AR e2e suites went from **69 failed / 20 passed**
in the pre-cutover permission state to **1 failed / 88 passed** after.
🔴 **B5 is 🟡 CONDITIONAL GO**, blocking on **PC-03** — `ap/suppliers`, `ap/credit-notes`,
`ar/credit-notes` and `bank-statements` return **another branch's rows** regardless of
`X-Branch-Id` (9 of 34 list/get methods filter on `orgId` only; `bank-statements` and
`posting-errors` are list/detail-inconsistent) — and **PC-04** — AP recurring-bill duplicate
prevention is **dead code** (the guard compares `lastBill.dueDate === profile.nextDueDate` but the
same transaction advances `nextDueDate`), so a second call issues a **second bill for the same
supplier**. Its e2e test is **deliberately left red** to document the correct contract; do not
"fix" it to expect 200. Also **PC-06** (ten list routes return a bare array with no server `total`,
which the C4 pager contract cannot bind to) and **PC-01** (Manager holds no accounting write).
🔴 **New finding C-22: 37 further guard permissions still have no seeded row** — `franchise:*` (12),
`ops:*` (8), `dev:*` (5), `merchant:*` (4), `billing:*` (3), `onboarding:*` (2), `support:*` (2) —
so franchise, ops-portal, developer-portal and owner-SaaS-billing are 403 for every role exactly as
accounting was. **Deliberately not seeded** (all deferred modules); **B7 must budget the same
cutover.**
**Postman:** three stale collections were repaired — M34 sent `paymentTermsDays` (the DTO field is
`paymentTermDays`; the whitelist 400'd and cascaded into 10 downstream 404s), M35 asserted the
renamed `totals.grand*` instead of `summary.*` (**PC-05**), and M37's two procurement-review requests
now carry **R11 honest-skip guards** so an empty dataset can never read as a verified route. On a
from-scratch database: **85 requests, 0 request failures; 166/168 assertions pass**, the 2 being
those deliberate skip markers. **56/56 collections parse** (3 carry a pre-existing BOM).
**Validation:** API unit **1057 passed / 4 failed** — the 4 **proven pre-existing** by re-running the
same two suites at `30c67aa` in a throwaway worktree (identical failures, identical test names);
API e2e **272/273** (the 1 is PC-04); web typecheck + lint + build pass; **16/16** assertion scripts;
Playwright `manager-shell` **125/11 skipped** and `manager-dashboard` **84/84** — both matching their
B1/B2 baselines exactly — plus `manager-staff` **106 passed / 26 skipped**, `manager-reports` **151 passed / 1
skipped** and `manager-operations` **160/160**; `/api/health` → ok; `git diff --check` clean.
⚠️ **Disclosed:** three Playwright runs were invalidated by the isolated web server being OOM-killed
(reported, not discarded, and re-run at `--workers=2`); a too-broad `pkill` killed the pre-existing
shared-Neon dev API on `:3001`; and the pre-existing web dev server on `:3003` was lost to
background-task process-group cleanup. **Both dev servers were restarted and verified** (`:3001`
`/api/health` ok on the external Neon host, `:3003` `/login` 200) — **no shared-Neon write
occurred.**
**Shared-Neon deploy is STILL GATED** and is behaviour-visible: 56 routes change from 403 to
reachable, a Manager token **loses** compensation access, and cross-branch Quick-PIN administration
stops working. **B5, B6 and B7 are NOT started — do not begin any of them without explicit owner
authorisation.** See `ai/PERMISSIONS_CUTOVER_COMPLETION_REPORT.md`.

**Prior milestone record (superseded above) — ENTERPRISE UI TRACK B4 COMPLETE — Manager REPORTS (2026-08-20) — A: B4 COMPLETE / B5 · B6 · B0 ·
PERMISSIONS-CUTOVER GATED.** Frontend + docs only; **no backend / schema / migration / seed /
permission / Postman change**. `/manager/reports` becomes a **module** (the root now redirects)
carrying two live surfaces — **`/reports/catalog`** and **`/reports/runs`** — built on the B1/B3
chrome with no new shared primitive. The B1 menu tree's two `B4`-tagged placeholder rows are now
real links.
⚠️ **The B4 precondition failed and was repaired first:** Track B3 was **not committed**, its
Playwright run had been **cut off at 245/292**, and its report §10 + evidence §5/§7 were
placeholders. The interrupted run was recovered (**292 passed, 37.5m, 0 failed**), the evidence was
filled in with real numbers, and **B3 was committed as `c34d12e`** before B4 began.
**CATALOG** lists all **37** entries and **drives availability from the API's own `status` field**
(`IMPLEMENTED` 24 / `CONDITIONAL` 1 / `PENDING_LATER` 12 — the exact 24-of-37 split M-P0 verified),
so the UI cannot drift from what the backend can run. The 13 non-implemented entries have
`generatorPath: null` — **structurally uncallable**, no form and no disabled button, each naming the
milestone the API itself cites (e.g. *"needs M30 — Payroll Engine + Pay Runs + Payslips"*). An
unknown status **fails closed**.
**GENERATE** is ONE shared form, because **MP0-16 was re-verified live on all 24 routes** (all
returned **201**): every DTO is `{reportWindow!, dateFrom?, dateTo?, parameters?}` and `top-items`
alone adds `limit?`. `CUSTOM` requires both dates (the API 400s otherwise) and the form says so
rather than letting the request fail. `parameters` is accepted by every DTO but **read by none**, so
no free-form editor ships (B4-F6).
**HISTORY is genuinely persisted** — verified before it was built, because the brief required an
honest session-only fallback otherwise: `GET /api/reports` is a real server-paginated branch-scoped
read fed by the endpoint's own `total`.
**EXPORT IS CSV-ONLY AND THE FORMAT IS HARD-CODED** — there is no format parameter, so no caller can
request a PDF; `format: PDF` → **501** re-verified live, and a legacy pre-2026-08-20 PDF artifact's
download → **404**. Those artifacts are **disclosed in prose and never offered as a control**. The
download streams the server's bytes via `response.blob()`; **`new Blob(` appears nowhere in the
Manager tree.**
🔴 **Graph and pivot are NOT built and NOT advertised** (gated on **C-03**); `ManagerViewSwitcher` is
deliberately unmounted and no menu row hints at them.
⚠️ **Defect found and fixed (B4-D1):** the first implementation added a second query key for
`/api/reports/catalog`, which the M-P1 readiness strip already fetches on every Manager page — the
catalog page issued **`2x GET /api/reports/catalog`** per load. Reports now **shares the readiness
strip's key and fetcher** and projects with `select`: one endpoint, one cache entry, two consumers.
⚠️ **Defect caught before shipping (B4-F2):** `grossSales` is **tax-inclusive** at summary level but
**ex-tax** inside `topItems[]`/`categories[]` — the same field name with two tax bases. A generic
"render every key" breakdown mislabelled per-item ex-tax money as tax-inclusive, so **each report now
declares its own columns, mirroring its CSV header**. Money uses **fail-safe classification**: an
unrecognised key renders as text, never guessed into currency. `rowCount` is labelled **"Records
aggregated"** (219 for SALES_BY_HOUR, whose export is 24 rows) and no table may derive from it.
**Cross-branch reads fail safe at the API-client boundary** (MP0-12 re-verified live: another
branch's run returns **200**).
**Live money cross-check:** DAILY_SALES, `/dash/today-summary` and `/dash/manager` agree exactly —
gross **33,014,100** = net **27,978,300** + tax **5,035,800**, subtotal **28,107,000**.
Validated on the same isolated local Docker stack B3 used (**never shared Neon**): web typecheck /
lint / build pass; **16/16** assertion scripts incl. the new `manager-b4-assertions`; Playwright
`e2e/manager-reports/` **152/152 across four viewports** (38 each, 0 skipped) with **CSV file
contents asserted**, not just status; 10 screenshots at 1440×900 + 1280×680 viewed; per-surface
budgets **≤4 requests**; zero console errors; `/api/health` → ok. Six findings recorded and **none
implemented** (B4-F1…F6). See `ai/ENTERPRISE_B4_REPORTS_COMPLETION_REPORT.md`. **B5 (Accounting),
B6 (Settings), B0 and the C-21 permissions cutover are NOT started — do not begin any of them
without explicit authorization.**

**Prior milestone record (superseded above) — ENTERPRISE UI TRACK B3 COMPLETE — Manager OPERATIONS + STAFF (2026-08-20) — A: B3 COMPLETE / B4
GATED.** Frontend + docs only; **no backend / schema / migration / seed / permission / Postman
change**. Operations and Staff become **modules** (`/manager/operations` and `/manager/staff` now
redirect) carrying **eight live surfaces**, built on the B1 chrome primitives — B3 is the first phase
to MOUNT `ManagerSearchFilterMenu` and `ManagerBreadcrumbs` — plus four new shared ones:
`ManagerListTable` (Odoo **C4**), `ManagerStatusPipeline` (**C14**), `ManagerViewSwitcher`,
`ManagerRecordActionsMenu` (**C13**).
**OPERATIONS IS STRICTLY READ-ONLY** (zero mutations, zero `useMutation` hooks — asserted):
`/operations/orders` is the C4 list (server pagination fed by the endpoint's own `total` = **298**,
status/service filters as removable chips, optional-column gear, a totals row labelled *This page*
because `/pos/orders` returns no aggregate) opening a read-only **C5** record (breadcrumb + record
pager, statusbar pipeline, notebook tabs, totals block, **no action control of any kind**);
`/operations/tables` renders the **shared `OperationalFloor` unforked** (proven in e2e via its own
`data-operational-*` attributes) with a read-only selection panel; `/operations/reservations` is
read-only over the same bounded `scope=active|history` contract Supervisor 4A/4B established.
**STAFF WRITES EXACTLY FOUR THINGS** — frontline onboarding (3-step, `ActionConfirmDialog`, PIN
**masked → revealed once → copy-once**, never cached/logged/stored/URL-encoded); Quick-PIN
reset/disable/enable (Odoo **C12** with only the rows Nimbus can back; password/2FA/API-keys/
passkeys/session-revocation **omitted, not greyed out** — NG-08); leave review (**no payroll or
roster claim**; the org-scoped decision is disclosed); and shift-swap **rejection only**.
🔴 **Shift swaps are Outcome C, proven not asserted:** a real rejection changed **0 of 3**
`schedule_assignment` rows and left `/workforce/roster` byte-identical. **There is no Approve
control and must not be one.**
**Privacy:** `lib/manager/staff-projection.ts` is an **ALLOW-LIST** (14 safe fields) applied at the
**API-client boundary** — necessary because `/hr/leave` and `/hr/shift-swaps` still embed full
employee `dateOfBirth`/`address`/`emergencyContact*`/`notes` (re-verified live). `?view=full` is
never sent (⚠️ confirmed live it *would* return compensation to a Manager token — **FU-1 is real**);
`GET /hr/employees/:id` is never called; the directory narrows to the branch **in the browser** and
says so, because `/hr/employees` is org-scoped and 400s on `?branchId=` (MP0-06/C-09 — the payload
spans 5 branches).
⚠️ **Defect found and fixed (B3-D1):** backend gap batch 1 **inverted** `grossSales`/`netSales`, so
the B2 Overview rendered the **ex-tax** figure under the label *"Sales today (tax-inclusive)"*. FU-3
called this merely stale notes; it was a live mislabel of the dashboard's headline money. Bindings
re-pointed and pinned by assertion. A second B3-caused untruth was removed too: the M-P1 global
*"Read-only oversight"* badge in the readiness strip, false the moment Staff shipped a **New**
button — read-only is now a per-surface claim.
**Deferred with written reasons:** Operations **Exceptions** and Staff **Attendance** (outside the
owner's enumerated scope; tagged `Deferred`, never an invented phase number); the **chatter rail**
(gated on **B0**); and **every escalation write and the escalation list** — the roadmap's own
precondition (a verified domain DTO) was unmet and `/api/approvals` is only partly branch-scoped
(MP0-05). **New findings recorded, none implemented: B3-F1** Quick-PIN admin routes are org-scoped,
not branch-guarded; **B3-F2** FU-1 confirmed live; **B3-F3** leave/shift-swap creation is
self-service only (403 for a manager acting on behalf).
Validated on an isolated local Docker Postgres stack (**never shared Neon**; both `.env` files
restored byte-for-byte, SHA-256 verified): web typecheck / lint / build pass; **15/15** assertion
scripts; a live API matrix of **39/39**; Playwright `e2e/manager-operations/` + `e2e/manager-staff/`
across four viewports; 9 screenshots per viewport; per-surface request budgets measured;
`/api/health` → ok. See `ai/ENTERPRISE_B3_OPS_STAFF_COMPLETION_REPORT.md` and
`ai/ENTERPRISE_B3_QA_EVIDENCE_INDEX.md`. **B4 (Reporting) NOT started — do not begin it, or any
later Track B phase, without explicit authorization.**

**Prior milestone record (superseded above) — BACKEND GAP BATCH 1 COMPLETE — Track C: C-02 · MP0-10 · MP0-09 · C-01 (2026-08-20) — A: BATCH
COMPLETE / B3 UNBLOCKED ON C-02 / SHARED-NEON DEPLOY STILL GATED.** The first owner-authorized Track
C batch fixes four backend defects. **No schema / migration / seed / permission change, no frontend
file touched, local dev DB only.**
**C-02 (NG-02/MP0-01)** — new `apps/api/src/modules/hr/employee-projection.ts`. The **default**
payload on `GET /hr/employees`, `GET /hr/employees/:id`, the POST/PATCH echoes and the employee
embedded in `/hr/contracts` never *selects* `compensationProfile`, `dateOfBirth`, `address`,
`emergencyContact*`, private `notes` or `metadata` from Postgres; `/:id` returns contracts with no
salary field. `?view=full` restores the historical payload behind the **pre-existing**
`pos:hr:compensation:read` (403 without it; unknown `view` → 400). Live: 40 manager rows, zero
forbidden keys. ⚠️ The seeded matrix grants that permission to Owner, **Manager** and Accountant, so a
Manager can still opt in explicitly — narrowing it is a seed change, **not authorized** (FU-1). **B3's
Staff directory is unblocked.**
**MP0-10** — the gross/net inversion was a labelling defect: `Order.total = subtotal + tax − discount`,
so `total` is tax-inclusive. Now **`grossSales = SUM(order.total)`**, **`netSales = gross − taxTotal`**,
with the old ex-tax figure kept **additively** as **`subtotalSales`**; `gross = net + tax` ⇒
`gross ≥ net`. Live: gross **28,107,000 → 33,014,100**, net **33,014,100 → 27,978,300**. Applied to
`/dash/{today-summary,owner,manager}`, `/stream/metrics`, `kpi/refresh` **and** the SHIFT_END /
DAILY_SALES report summaries (one `salesFigures()` helper) so dashboard and export cannot disagree.
**MP0-09** — `/dash/open-orders` gains **`total`** (uncapped) + `limit` + `truncated` from the *same*
`where` the dashboards count with; `count` deliberately keeps its page-length meaning so B2 keeps
working. Live: `total 107` == `/dash/manager.openOrders 107` (was 50 vs 107). **Use `total` for any
number shown to a user.**
**C-01 (NG-01/MP0-03)** — `format: PDF` now returns **501** before any artifact row is created;
`generateTextPdf` is deleted; all 37 catalog entries advertise `['CSV']`; the BG6 `/api/exports`
facade 501s too. **No PDF renderer was added — OD-10 stays open.** Pre-2026-08-20 PDF artifacts keep
their fake mime type.
Validated on an isolated local Docker Postgres stack (never shared Neon; both `.env` files restored
byte-for-byte): API unit **1057/1061** (4 pre-existing failures, proven at `HEAD` in a throwaway
worktree); `hr` e2e 25/25, `dashboards`+`reports` e2e 53/53; web typecheck pass, **14/14** assertion
scripts, Playwright `manager-dashboard` **84/84**, `manager-shell` 125 passed/11 skipped, cross-role
36/36 — **the B2 dashboard is untouched and still passes**; newman M19 55/55, M20 40/40, M23 39/39,
BG6 46 with 7 pre-existing AP failures; 56/56 collections parse; `/api/health` → ok.
🔴 **New finding → Track C `C-21`: 38 accounting routes are 403 for EVERY role, including Owner** —
AP (19), AR (10) and Budget (9) are guarded by 23 permission strings (`accounting:ap:*`,
`accounting:ar:*`, `finance:*`) with **zero rows** in the permissions table. `pos:accounting:*` (17
rows) is seeded, so `accounting`/`ledger`/`bank-rec` are fine. **B5 must budget a permission/seed
cutover before any AP/AR/Budget UI.**
**Deploying these fixes to shared Neon is still gated on the cutover authorization. B3 and every
other Track B phase remain NOT started.** See `ai/BACKEND_GAP_BATCH1_COMPLETION_REPORT.md`.

**Prior milestone record (superseded above) — ENTERPRISE UI TRACK B2 COMPLETE — Manager Overview dashboard (2026-08-20) — A: B2 COMPLETE /
GATED FOR B3.** Frontend-only; no backend/schema/migration/seed/permission/Postman change.
`/manager/overview` graduates from the B1 honest-foundation screen to a real branch dashboard: the
Odoo **C10** journal-card pattern rebuilt natively as a 3-column grid of **eight** cards with a
coloured left accent bar — Sales today · Orders today · Payment mix · Open orders · Low stock · Needs
a decision · Shift & till coverage · Branch readiness — composed through the B1 chrome
(`ManagerControlPanel` + `ManagerContentShell`; `ManagerSearchFilterMenu`/`ManagerBreadcrumbs` stay
unmounted — Overview has no record list). New `components/manager/dashboard/*` and
`lib/manager/dashboard-{types,model,api,context}.ts`. **Every rendered figure resolves through the
26-entry `MANAGER_KPI_BINDINGS` registry** binding it to a verified endpoint field AND a drill-in
target — an unregistered KPI **throws** rather than renders, and only the two till/shift KPIs may
lack a drill-in (each with a written reason, MP0-02). Boundaries reproduced live: the open count uses
`/dash/manager.openOrders` (**107**) not `/dash/open-orders.count` (**50** = capped page length,
MP0-09, disclosed in card copy); `netSales` **33,014,100** > `grossSales` **28,107,000** (MP0-10) so
both labels state the tax basis and **no bare Gross/Net exists**; approval counts come from the four
canonical **branch-scoped domain endpoints**, never the partly org-scoped `/api/approvals` inbox
(MP0-05), bounded to `take=1`/`limit=1` and **projected to count-only at the API-client boundary** so
the leave/shift-swap PII payload never reaches state or cache (MP0-01); tills/shifts are counts with
no list and no drill-in. Overview **decides nothing** — counts link into the owning surface.
**Polled, not streamed** (60 s) with a permanent worded degraded state; there is **no SSE code** and
the assertion script fails if any appears (C-04/NG-14 still open). `POST /dash/kpi/refresh` sits
behind the shared `ActionConfirmDialog` + an in-flight lock, then narrowly re-reads the **nine**
dashboard keys. **No charting dependency was added** — three hand-rolled token-driven SVG marks, each
`role="img"` with `<title>`/`<desc>`; new `chart-series-1…4`/`chart-track` tokens and two new
canonical icon names (`revenue`, `inventory`). **Defect found by this phase's own e2e and fixed:**
M-P1's branch-switch `invalidateQueries` refetched the OUTGOING branch's keys (9 wasted requests per
switch) — now `refetchType: "none"`. Foundation `liveFrom` badges re-tagged M-P* → Track B (B3/B3/B4/
B6). Validated 2026-08-20: typecheck/lint/build pass; **14/14** assertion scripts; Playwright on an
isolated local Docker Postgres stack (never shared Neon) — `e2e/manager-dashboard/` **84/84**,
`e2e/manager-shell/` **125 passed / 11 deliberately skipped**, `e2e/supervisor-prompt3/` **64/64**,
`e2e/cashier-floor` cross-role **48/48**; **12 requests** measured for one Overview load (1
`/auth/me` + 2 shell + 9 dashboard); 5 screenshots at 1440×900 + 1280×680 viewed; zero console
errors; `/api/health` → `ok`; stack torn down and both `.env` files restored byte-for-byte. See
`ai/ENTERPRISE_B2_DASHBOARD_COMPLETION_REPORT.md`. **NEXT = B3 (Operations + Staff) and B0 (API
verification, docs-only, parallel). Neither is started — do not begin B3 or any later Track B phase
without an explicit owner go.**

**Prior milestone record (superseded above) — ENTERPRISE UI TRACK B1 COMPLETE — Manager top-nav shell conversion (2026-08-20) — A: B1 COMPLETE /
GATED FOR B0+B2.** Frontend-only; no backend/schema/migration/seed/permission/Postman change; no
commit/push. Manager's presentation converts from the M-P1 fixed bottom nav to an Odoo-style top
module bar, shipped as an **additive `OperationalShell` variant** (`navigation="top" | "bottom"`,
default `"bottom"`) — never a Manager shell fork; the three frontline roles were verified live to
render byte-identically. New shared `components/pos-shell/OperationalTopNav.tsx` +
`OperationalTopNavDropdown.tsx` (click-to-open, full keyboard operation: roving-tabindex menubar,
Escape/outside-click/route-change close) are consumed by a thin `ManagerTopNav` adapter; the retired
M-P1 `ManagerHeader.tsx`/`ManagerBottomNav.tsx` were deleted. The six locked M-P1 surfaces survive
unchanged as the menu tree — Overview/Me stay direct links; Operations/Staff/Reports/Settings host
dropdowns, each with ONE real link to today's foundation page plus an honest, inert not-yet tree
tagged by phase (e.g. "Orders — B3"); Accounting is **not** a seventh menu (OD-3 stays open, gated on
B5). New reusable Manager chrome primitives (`components/manager/chrome/`: `ManagerControlPanel`,
`ManagerBreadcrumbs`, `ManagerContentShell`, `ManagerSearchFilterMenu`) — B1 mounts only
`ManagerControlPanel`/`ManagerContentShell`, title-only, since no B1 surface has data to back a
create action, search, pager, or view switcher; `ManagerSearchFilterMenu`/`ManagerBreadcrumbs` ship
built but deliberately unmounted (first consumed from B3). **OD-4 answered with a recorded
deviation:** the collapse breakpoint is `xl` (1280px), not the roadmap-suggested `lg` (1024px) — the
full bar does not reliably fit at 1024×768, so that project gets the collapsed "Menu" control too,
never falling back to the frontline bottom nav. **OD-5 needed no fallback** — the shared shell
absorbed the variant with one additive prop. Validated: typecheck/lint/build pass; 13 static
assertion scripts pass; Playwright executed live on an isolated local Docker Postgres stack (never
shared Neon) — `e2e/manager-shell/` **125/136 passed, 11 deliberately skipped** (desktop-only
mechanics at the collapsed viewport, proven separately), `e2e/supervisor-prompt3/` **64/64**,
`e2e/cashier-floor` cross-role regression **48/48**; 8 screenshots at 1440×900 + 1280×680, zero
console errors; isolated stack fully torn down, `.env` files restored byte-for-byte. See
`ai/ENTERPRISE_B1_TOPNAV_COMPLETION_REPORT.md`. *(B2 has since shipped — see the entry above.)*

**Prior milestone record (superseded above) — ENTERPRISE UI RESEARCH COMPLETE; NEW CANONICAL ROADMAP
ADOPTED (2026-08-20) — documentation only.** The owner's live Odoo instance was explored read-only (17 screenshots, no record created or
edited) → `ai/ODOO_REFERENCE_RESEARCH.md`, and compared against this repo →
`ai/NIMBUS_VS_ODOO_GAP_ANALYSIS.md` (20 typed gaps **NG-01…NG-20**). **Headline finding:
~90 accounting/finance endpoints already exist with zero UI** — `accounts-payable`,
`accounts-receivable`, `bank-rec` and `budget` are registered and wired while `docs/MODULES.md`
still marks them "⬜ Planned"; ⚠️ they were found by **static scan only** and are
*claimed-by-code, unverified-at-runtime*. The new canonical plan is
**`ai/ENTERPRISE_UI_ROADMAP.md`** — three tracks: **A** experience polish (A0 shipped; A1 = the
shared floor-toolbar wrap at 1024×768), **B** the management suite (**B0** API verification → **B1**
top-nav shell → **B2** Overview → **B3** Operations+Staff → **B4** Reporting → **B5** Accounting
suite → **B6** Settings → **B7** Owner), **C** the true backend gaps **C-01…C-20** plus **C-P**
carrying Cashier C4→C6 forward unchanged.
⚠️ **Owner decision (`docs/DECISIONS.md` D-MGRTOPNAV): management navigation switches to an
Odoo-style TOP NAV BAR — module bar + click-to-open dropdown submenus, a control-panel row (`New` +
title + chip search + server pager + view switcher) and breadcrumb + record pager. This SUPERSEDES
the M-P1 bottom-nav decision for Manager. Waiter, Cashier and Supervisor KEEP bottom nav** and must
render byte-identically. **Only the navigation presentation is superseded** — M-P1's shell, session
guard, branch switcher, surface allow-list, honest pages and Manager Me carry forward, and M-P0's
MP0-01…MP0-18 remain in force. `ai/MANAGER_RECONSTRUCTION_ROADMAP.md` is **superseded from M-P2
onward** (M-P0/M-P1 history intact). **No code, no backend/schema/seed/permission/Postman change, no
commit/push. Nothing in Track B is implemented — do not begin B1 (or any Track B phase) without an
explicit owner go.** Eleven open owner decisions **OD-1…OD-11** are recorded with recommendations;
**OD-4** (sub-desktop collapse — never fall back to the frontline bottom nav) and **OD-5** (additive
`OperationalShell` variant vs a separate management shell) must be answered at the start of B1.

**MANAGER RECONSTRUCTION — PROMPT M-P1 COMPLETE (2026-08-20) — A: M-P1 COMPLETE / READY FOR M-P2.**
The Manager workspace foundation is live and Manager is the **fourth consumer** of the shared
operational UI system — never a fork. Shipped (frontend + docs only): `"manager"` in
`OperationalRole` + `role-navigation.ts`; the **locked six-tab nav Overview · Operations · Staff ·
Reports · Settings · Me** (no More tab, no Approvals tab), landing `/manager/overview`, `/manager`
redirecting there; six new canonical icon-registry names; `components/manager/shell/*` as thin
adapters over `OperationalShell`/`OperationalHeader`/`OperationalBottomNav` + the shared idle
handler; `ManagerSessionGuard` (non-managers → `/login?reason=manager_only`); and the **branch
switcher** in a new **optional** `OperationalHeaderContext.branchSwitcher` slot (so the other three
headers render byte-identically) sourced from `me.memberships` with **zero extra requests**,
persisted at `nimbus.managerBranchId` (deliberately NOT the station key), driving `X-Branch-Id`
through the existing `apiRequest({ branchId })` parameter — **no API-client change** — and
invalidating **only** the `["manager", …]` query namespace. `lib/manager/permissions.ts` is a
**surface allow-list, NOT a permission check** (the manager JWT holds 214 permissions incl.
compensation/contracts/`approvals:decide`, which the approved MVP forbids). Six honest foundation
pages with **no fabricated data**, plus a real Manager **Me** built solely from the already-fetched
`/api/auth/me`. Readiness ships **three verified chips only** (Branch, report generators, devices);
**tills/shifts/approval chips are omitted, not faked.** Fourth navy-family role accent
`--color-role-manager` `oklch(0.36 0.06 324)` (white-on-solid 11.18:1). Validated: typecheck + lint
pass (`next build` deliberately not run in the dev QA sandbox); `manager-p1-assertions.ts` +
**11/11** existing assertion scripts; Playwright `e2e/manager-shell/` **92/92** across four
viewports; cross-role regression **68/68**; live manager browse with a captured `X-Branch-Id` change
and persistence across reload; Waiter/Cashier/Supervisor re-verified live and unchanged. **No
backend / schema / migration / seed / permission / Postman change; no commit/push. M-P2 (Overview
dashboard) NOT started — do not start it, or any later Manager phase, without explicit
authorization.** See `ai/MANAGER_P1_SHELL_COMPLETION_REPORT.md` and
`ai/MANAGER_RECONSTRUCTION_ROADMAP.md`.

**Cashier Floor-First reconstruction — Prompt C3 COMPLETE (2026-08-20) — A: C3 COMPLETE / READY FOR
C4.** The C2 read-only settlement workspace is now a working, **fail-closed payment + close**
surface — built as a **mount, not a rewrite**. New `components/cashier/floor/CashierSettlementActions.tsx`
composes the already-verified primitives (`CashierPaymentPanel` incl. `CashierCloseOrderPanel`, and
`CashierResolutionPanel` with the additive `variant="split-only"` → split-bill + split-items; the
merge/move-items/transfer-table group is deliberately not mounted), and new
`lib/cashier/settlement-mutations.ts` owns the only post-mutation refresh — it **awaits** a canonical
re-read of `orderDetail` + `orderPayments` before showing any result (no optimistic money), then
narrowly invalidates `tableBills` / `floor` / the `find-bills` prefix / the Waiter+Supervisor Floor
keys through the C2 key factories (no broad sweep; **9 requests** measured after a close). Live:
cash settles **and** closes in one call at the single verified choke point
`POST /pos/orders/:id/close`; card/MTN/Airtel/bank post manual references (a final one auto-settles);
partial payment shows a canonical remaining balance; split-bill records allocation metadata and
split-items creates a `NEW` child order (correctly not payable); a CLOSED/VOIDED bill renders **no**
settlement control. **Documented deviation: there is no standalone Close button** — the backend has
no zero-payment close (`CloseOrderDto.payments` is `@ArrayMinSize(1)`; order must be `SERVED` with
the balance covered), so close is reached through payment and the close panel states the real
precondition. **Frontend-only — no backend/schema/migration/seed/permission/Postman change; no
commit/push.** Validated 2026-08-20: web typecheck + lint pass (`next build` deliberately not run in
the QA sandbox); shell/floor/profile/C1/C2/**C3** assertions pass; Playwright `e2e/cashier-floor/`
**192/192** (48 × 4 viewports) + cross-role regression **20/20**, executed with REAL payments/closes
on an isolated disposable local Postgres; console/network clean; 36 screenshots at 1440×900 +
1024×768. Six findings recorded and **none implemented** (manual-reference accepts a payment on a
CLOSED order; reservation auto-completion does not fire on the cashier close path;
`generateOrderNumber` can 500 on branch-prefixed demo numbers; cashier idempotency keys are not
reused across retries; sub-unit UGX split amounts; an ambiguous readiness-strip badge). **C4 NOT
started — do not implement receipt print/reprint/deliver, receipt search, or refund execution, and
do not retire Queue/Receipts.** See `ai/CASHIER_FLOOR_RECONSTRUCTION_C3_SETTLEMENT_COMPLETION_REPORT.md`
and `ai/CASHIER_FLOOR_RECONSTRUCTION_C3_QA_EVIDENCE_INDEX.md`.

**REBRAND + ROLE UI QA WAVE COMPLETE (2026-08-20).** The Aug-2026 Nimbus POS Brand Identity
(designer Andimashimwe Rhoda) is fully landed in `apps/web` — navy/silver/graphite tokens
(navy-900 `#000033` canonical), a **new alpha-channel token system** that fixed a pre-existing
app-wide defect where every `token/alpha` utility (all modal scrims) rendered transparent,
true-vector steering-wheel assets in `apps/web/public/brand/`, the non-registry `NimbusLogomark`
in the operational header + login hero, PWA/OG metadata, and new canonical `docs/BRAND_IDENTITY.md`.
Shared-component accessibility fixes landed (Button `inverse` variant, header logout 2.71→20.48:1,
disabled 3.62→8.51:1, a visible `focus-inverse` ring on navy surfaces, navy scrims, two
invisible-label fixes). Waiter, Cashier (within the C2 boundary — nothing gated implemented), and
Supervisor each got a full live QA pass at 1440×900 + 1024×768 on an isolated local Postgres 16 +
WASM-Prisma stack (shared Neon untouched), producing new canonical `docs/waiter-ui-docs/*` and
`docs/cashier-ui-docs/CASHIER_API_MATRIX.md` and a live-verified `SUPERVISOR_API_MATRIX.md`.
Frontend + docs only — **no backend/schema/migration/seed/permission/Postman change; no
commit/push.** Validated 2026-08-20: web typecheck + lint + production build all pass; ~180 QA
screenshots. Nine open findings are recorded for the owner and **none were implemented**. **Cashier
C3 and Manager reconstruction both remain gated.** See `ai/REBRAND_AND_ROLE_QA_COMPLETION_REPORT.md`.

**SUPERVISOR RECONSTRUCTION FINAL CLOSURE COMPLETE (2026-07-31) — B: COMPLETE WITH KNOWN
LIMITATIONS / DEMO-READY.** An integrated final QA pass executed the full Supervisor experience
live (Floor/order-workspace, Reservations, Approvals, Me), cross-role Waiter/Cashier regression,
and role/privacy boundaries across all four viewports on an isolated stack (disposable Neon branch
for API matrices, local Docker Postgres for the four-viewport Playwright browser suite — 262/264
executed passed, 0 unresolved failures). Two test-harness defects were found and fixed (a
multi-role-login race in the shared `uiLogin` fixture; a reservation-create test asserting
nonexistent validation copy / conflating native-date-constraint blocking with app-level
validation); zero product-code defects were found. Shared Neon `production` verified
byte-for-byte unchanged before/after. See `ai/SUPERVISOR_RECONSTRUCTION_FINAL_COMPLETION_REPORT.md`
(canonical closure record), `ai/SUPERVISOR_FINAL_QA_EVIDENCE_INDEX.md`,
`ai/SUPERVISOR_FINAL_KNOWN_LIMITATIONS.md`, `ai/SUPERVISOR_FINAL_DEMO_SCRIPT.md`, and
`ai/SUPERVISOR_FINAL_DEMO_DATA_REGISTER.md`. **Manager reconstruction NOT started — it remains
blocked until Cashier reconstruction (below) closes at C6.** See `PROGRESS.md`.

**Cashier Floor-First reconstruction — Prompt C2 COMPLETE (2026-07-31) — A: C2 COMPLETE / READY FOR
C3.** C2 replaces C1's neutral selected-table boundary with the **table→bill resolution + canonical
read-only settlement-workspace foundation** (frontend-only; **no backend/schema/migration/seed/
permission/Postman change**). Selecting a table runs ONE bounded, branch-scoped
`GET /pos/orders?tableId=` query and classifies results through a central fail-closed helper
(`lib/cashier/bill-resolution.ts`): **zero** payable → truthful "No bill is available for this table."
(+ read-only closed-bill list when present); **one** → auto-resolve into the workspace (URL gains
`orderId`, no visible selector); **multiple** → an explicit bounded selector (**never** a silent
first-pick). Canonical URL state is `?tableId=&orderId=` (or `?orderId=` for tableless/takeaway/Find
bill) — refresh/Back/Forward safe; invalid/cross-branch orderId fails safe. The one canonical
`CashierSettlementWorkspace` is **read-only** (Bill / Totals / Payment state / Settlement readiness /
History) and **reuses** the existing checkout primitives (`CashierOrderTotals`,
`CashierPaymentSummary`, `normalizeCashierOrder`) — it exposes **no** payment/split/close/receipt/
refund control (those are C3/C4). Payment state **fails closed** (unavailable is never shown as
unpaid). A compact Cashier-only **Find bill** dialog (sibling above the shared Floor, never a fork;
bounded/branch-scoped; tableless+takeaway; exact-id fallback) routes results into the same workspace;
receipt-reference search is deferred to C4. Queue/Receipts remain hidden compatibility routes (not
deleted, not redirected, not mounted on Floor). New: `lib/cashier/bill-resolution.ts`,
`lib/cashier/bill-query-keys.ts`, `components/cashier/floor/{CashierBillResolutionPanel,
CashierBillSelector,CashierSettlementWorkspace,CashierFindBillDialog}.tsx`,
`scripts/cashier-c2-assertions.ts`, and the `e2e/cashier-floor/` C2 specs. Validated: web
typecheck/lint/build; C1+C2+shell+floor assertions; Playwright `e2e/cashier-floor/` executed on an
**isolated local Docker Postgres** stack (never shared Neon); no commit/push. **C3 (payment/close
execution) NOT started** — do not implement payment/split/close/receipt/refund, retire
Queue/Receipts, fork the shared Floor, or change any Cashier permission without explicit
authorization to proceed past C2. See `ai/CASHIER_FLOOR_RECONSTRUCTION_C2_BILL_RESOLUTION_COMPLETION_REPORT.md`,
`ai/CASHIER_FLOOR_RECONSTRUCTION_C2_QA_EVIDENCE_INDEX.md`, and
`ai/CASHIER_FLOOR_RECONSTRUCTION_PROMPT_C3.md`.

**Prior milestone record (superseded by C2 above, kept for history) — Cashier Floor-First
reconstruction Prompt C1 COMPLETE (2026-07-31).** The locked Floor-first
target (nav **Floor · Till · Me**, default route `/cashier/floor`, Cashier as the third
`OperationalFloor` consumer alongside Waiter/Supervisor, a settlement workspace behind table
selection, and a compact **Find bill** sibling control) is now **implemented for C1**, on top of
the C0 audit. C1 delivered (frontend-only; **no backend/schema/migration/seed/permission/Postman
change**): Cashier nav changed to Floor/Till/Me; `/cashier/floor` page + `/cashier` → `/cashier/floor`
redirect; `getCashierLandingPath()` → `/cashier/floor`; the new `CashierFloorScreen` renders the
shared `OperationalFloor` (no forked card/grid/toolbar) with a Cashier data layer
(`lib/cashier/floor-{api,model,route}.ts`) over `pos:table:read`/`pos:orders:read`/`pos:reservation:read`
(already held); canonical `?tableId=` selection URL state (refresh/Back/Forward safe; invalid table
fails safe); and a **read-only, truthful settlement boundary** (`CashierSelectedTablePanel`, "Select a
bill to continue.") that exposes **no** payment/close/split/refund/receipt action — the mount point
C2 replaces. **Queue and Receipts are NOT deleted and NOT redirected** — they remain hidden
compatibility routes reachable only by direct URL (retire Receipts→C4, Queue→C5). Till/Me unchanged.
Validated: web typecheck/lint/build; shell/floor/cashier-c1 assertion scripts; Playwright
`e2e/cashier-floor/` **88/88** (22 × 4 viewports) + cross-role regression **40/40**, executed on an
**isolated local Docker Postgres** stack (never shared Neon); `git diff --check` clean; no commit/push.
See `ai/CASHIER_FLOOR_RECONSTRUCTION_C1_SHARED_FLOOR_COMPLETION_REPORT.md` (canonical C1 record),
`ai/CASHIER_FLOOR_RECONSTRUCTION_C1_QA_EVIDENCE_INDEX.md`, and `ai/CASHIER_FLOOR_RECONSTRUCTION_PROMPT_C2.md`
(next-prompt spec). **C2 (table→order resolution + settlement workspace foundation + Find bill
foundation) has NOT started.** Do not implement payment/split/close, remove or redirect
Queue/Receipts, fork the shared Floor for Cashier, or change any Cashier permission without explicit
authorization to proceed past C1. Manager reconstruction remains paused until Cashier C6 closes.

**Prior milestone record (superseded by the final closure above, kept for history):**
WAITER complete + SUPERVISOR RECONSTRUCTION through Prompt 5B2 — SUPERVISOR APPROVALS CLOSED
(Reservations UI complete with known limitations; order-workspace financial actions feature-complete;
Prompt 4A–4D reservation lifecycle + isolated live QA + fail-closed DB isolation tooling; Prompt 5A
Approvals backend/contract/QA foundation; Prompt 5B1 Discount + Leave decisions; Prompt 5B2 Anomaly
acknowledge/resolve + Shift-swap Outcome C reject-only — PROMPT 5 CLOSED AT B / DEMO-READY WITH KNOWN
LIMITATIONS).

- **Supervisor Approvals — Prompt 5B2 PROMPT 5 CLOSED (2026-07-31).** Completes the four-domain
  Approvals workspace. **Anomaly** Acknowledge (OPEN→ACKNOWLEDGED, note optional; the row **stays** in
  Needs action until resolved) + Resolve (ACKNOWLEDGED→RESOLVED, note **required**) are live via the
  `pos:analytics:anomalies:acknowledge`-gated endpoints; evidence is preserved and the underlying
  order/till/payment/attendance/shift record is **not** mutated. **Shift-swap = Outcome C
  (user-authorized): Reject only, NO Approve control.** A truthful atomic roster swap is unsupported —
  `ScheduleAssignment` is **read-only across the entire API** (no roster-mutation service; assignments
  are only seeded), the request references only a `shiftDate` (no specific-shift FK), and
  `pos:hr:shift-swaps:approve` has never mutated the roster (SUP-RG-036/042). The UI says so honestly
  ("schedule reassignment is not supported"); Reject writes status + audit and changes **0** roster
  rows (verified). **Do NOT add a shift-swap Approve/roster-mutation control, a roster-write service,
  or a schedule permission without explicit authorization.** Frontend-only: **no backend / schema /
  migration / seed / permission / Postman change; no commit/push.** Validated: web typecheck/lint/build;
  API 126/126 + reservations 39/39; isolated live QA on disposable branch `br-hidden-king-a4rbwvj0`
  (API matrix — shift-swap reject/dup/bound + anomaly ack/resolve/dup/stale = **11/11**; roster
  integrity 0 assignments touched; full Playwright Approvals suite × 4 viewports executed); shared
  `production` untouched; branch deleted. **Prompt 5 (Supervisor Approvals) is CLOSED at B — COMPLETE
  WITH KNOWN LIMITATIONS / DEMO-READY.** Next major track: **Manager reconstruction (not started)**.

- **Supervisor Approvals — Prompt 5B1 (2026-07-30).** The read-only Approvals
  page is replaced by a premium `SupervisorApprovalsWorkspace` on the 5A `approvals-contract.ts`:
  **Needs action / Resolved / History** scope tabs, All + per-domain filters, server-`total` counts,
  one identity-safe queue row shell, responsive master-detail (desktop split / mobile stack — one
  detail workspace), URL-persisted `scope`/`domain`/`page`/`from`/`to`/`selDomain`/`selId` (default
  Needs action / All / page 1; **never** History; filter changes use `router.replace`). **Discount +
  Leave are fully actionable** — Discount reuses the Prompt 3 `/pos/discounts/:id/approve|reject` +
  financials with the **UI-only payment-safety gate** + truthful **self-approval notice**; Leave uses
  `PATCH /hr/leave/:id/review` with **no payroll/roster claim**; terminal records are read-only.
  **Shift-swap + Anomaly render READ-ONLY** (their decisions land in Prompt 5B2 — do NOT add
  Acknowledge/Resolve/Approve controls). **Discounts are omitted from Resolved/History** (no
  branch-wide endpoint, SUP-RG-035; a truthful "available from the related order" notice shows if
  forced). New files: `apps/web/src/lib/supervisor/approvals-workspace.ts`,
  `apps/web/src/components/supervisor/approvals/workspace/*`, `apps/web/e2e/supervisor-approvals/*`
  (the old read-only `components/supervisor/approvals/*` remain but are unused). **No permission,
  schema, migration, seed, backend, or Postman change; no commit/push.** Validated: web
  typecheck/lint/build; API 126/126 + reservations 39/39; isolated live browser QA on disposable Neon
  branch (Playwright Approvals suite × 4 viewports executed); shared `production` untouched. Do NOT
  begin Prompt 5B2, add a generic approvals decide endpoint, or add a permission without approval.

- **Supervisor Approvals — Prompt 5A COMPLETE / READY FOR PROMPT 5B (2026-07-30).** Backend +
  contract + isolated-live-QA foundation for the premium Approvals UI (Prompt 5B). **No new
  permission, schema, migration, seed, or Postman change; no commit/push.** The four approval
  domains (Discount, Leave, Shift-swap, Anomaly) already had working decision lifecycles (pass
  Jest); 5A **audited** them against real code + live Neon and applied **backward-compatible
  hardening** — bounded leave/shift-swap list pagination (coerced `@Type`+`@Max(100)`+service
  clamp), **branch isolation** on shift-swap approve + anomaly acknowledge/resolve (leave stays
  **org-scoped** by design — nullable branch), **concurrency-safe** status-guarded conditional
  `updateMany` claims on all four decisions (duplicate/raced → 409 discount / 400–409 others, no
  double mutation or audit), optional `dateFrom`/`dateTo` History filters on leave/swap/anomaly
  lists, and a minimal `actorUser` identity projection on the anomaly **list**. **Architecture is
  domain-specific (Option B):** Supervisor does **not** hold `approvals:read`/`approvals:decide`,
  so the generic `unified-approvals` inbox (`POST /api/approvals/:id/decide`) is NOT the Supervisor
  path — every decision uses its canonical domain endpoint (`/pos/discounts/:id/approve|reject`,
  `/hr/leave/:id/review`, `/hr/shift-swaps/:id/approve`, `/analytics/anomalies/:id/acknowledge|resolve`).
  Leave + shift-swap live in the **attendance** module; anomalies in **analytics**. Added the
  additive `apps/web/src/lib/supervisor/approvals-contract.ts` (Needs-action/Resolved/History
  scopes over real statuses, canonical endpoints, bounded per-domain query builder, minimal
  identity resolvers, query-key factory, counts-from-`total`, narrow decision invalidation, error
  mapping); the read-only Approvals **page is visually unchanged**. **Isolated live QA executed** on
  a disposable Neon branch (Prompt 4D fail-closed launcher): API decision matrix **29/29** (incl.
  branch-isolation 404, duplicate 409/400, required-reason, identity names) + Playwright Approvals
  smoke **8/8** (4 viewports); shared `production` verified untouched (58/0/836/126). **Documented
  gap (SUP-RG-035):** discounts have no branch-wide list endpoint (only `/pending` + per-order) →
  no branch-wide discount Resolved/History without a new endpoint. Do NOT begin the Prompt 5B UI,
  add a generic approval decide endpoint, or add a permission without approval.

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
- Manager reconstruction **M-P1, Track B1 (top-nav shell), Track B2 (Overview dashboard), Track B3
  (Operations + Staff) and Track B4 (Reports) are COMPLETE** (shell, nav, session guard, branch
  switcher, Manager Me, the Odoo-style top module bar + chrome primitives, the live eight-card
  Overview dashboard, the eight Operations/Staff surfaces, and the two Reports surfaces).
  **Only Settings still renders the honest foundation screen.** Do not add an approval **decision** control to Overview, render a KPI that is not in
  `MANAGER_KPI_BINDINGS`, add an SSE/`EventSource` client (gated on C-04), add a charting dependency,
  fabricate a revenue trend (no bucketed series exists and `/dash/snapshots` needs
  `pos:dash:owner:read`, which Manager does not hold), take the open-order count from
  `/dash/open-orders.count`, or read approval counts from the generic `/api/approvals` inbox.
  ⚠️ **B3-D1:** backend gap batch 1 *inverted* `grossSales`/`netSales` (`grossSales` is now
  tax-INCLUSIVE, `netSales = gross − tax`); B3 re-pointed the two sales KPI bindings and pinned them
  by assertion — **do not "fix" them back**.
  ~~**B5…B7 (and B0, B5's sub-phases) are NOT started**~~ — **B0, the permissions cutover, and B5.1 +
  B5.2 + B5.3 (Accounting) are now COMPLETE**, plan any further sub-phase from
  `ai/ENTERPRISE_UI_ROADMAP.md` Track B, not from `ai/MANAGER_RECONSTRUCTION_ROADMAP.md`. **B5.4,
  B5.5, B5.6, B6 (Settings) and B7 remain NOT started — do not begin any of them without explicit
  authorization.**
  Do not add a Manager More/Approvals tab, change the `/manager/overview` landing, turn
  `lib/manager/permissions.ts` into a
  `hasPermission()` check, add tills/shifts chips or lists (those routes do not exist), offer a PDF
  report export (the backend 501s on `format: PDF`), build a branch-profile edit form
  (`PATCH /branches/:id` does not exist), fork any shared shell/floor/profile component for Manager,
  or add an EIGHTH top-nav module. ~~or add Accounting as a seventh top-nav menu (OD-3 stays open, gated on B5)~~ — **OD-3 was approved and Accounting shipped as the seventh module in Track B5.1 on 2026-08-21.**
- **Track B4 boundaries — do not cross without explicit authorization.** **No PDF affordance
  anywhere** — `format: PDF` returns **501** and there is no renderer (OD-10 open); prose that
  discloses the absence is allowed, a control is not, and the assertion targets code
  (`format: "PDF"`, `application/pdf`, `.pdf`) precisely so the disclosure may stay. **No graph or
  pivot view, and none advertised** — gated on **C-03**; `ManagerViewSwitcher` is deliberately not
  mounted on Reports. Do not render a row table derived from `rowCount` (it counts SOURCE records —
  219 for SALES_BY_HOUR, whose export is 24 rows — and is labelled *"Records aggregated"*). Do not
  relabel `grossSales`/`netSales` as a bare "Gross"/"Net", and ⚠️ **do not reuse the summary-level
  label for the per-item one: `grossSales` is tax-INCLUSIVE at summary level but EX-TAX inside
  `topItems[]`/`categories[]` (B4-F2)** — each report declares its own breakdown columns, mirroring
  its CSV header. Do not add a second fetcher or query key for `/api/reports/catalog` — it is shared
  with the M-P1 readiness strip on purpose (**B4-D1**: a second key made the page fetch it twice).
  Do not build a CSV in the browser (`new Blob(` appears nowhere in the Manager tree — the download
  streams the server's bytes). Do not open a run whose own `branchId` is not the active branch
  (**MP0-12** — `/reports/:id` resolves by `orgId` alone; the client rejects it at the API boundary).
  Do not add a delete, edit or rename control to run history. Do not offer a free-form `parameters`
  editor (all 24 DTOs accept it; **none reads it** — B4-F6).
- **Track B3 boundaries — do not cross without explicit authorization.** **Operations is strictly
  read-only**: do not add any mutation, `useMutation` hook, checkout/tender/order-builder control,
  order close/void/discount, or table-status write to `components/manager/operations`. **Staff writes
  exactly four things** — frontline onboarding, Quick-PIN reset/disable/enable, leave review, and
  shift-swap **rejection**; the assertion script counts **7** allow-listed Manager mutations
  repo-wide and fails on an eighth. **Shift swaps are Outcome C — there is NO Approve control** and
  must not be one: `scheduleAssignment` has no write path anywhere in the API, so approving would
  mutate zero roster rows (proven live: 3 rows before a real rejection, 3 after). Never send
  `?view=full`, never call `GET /hr/employees/:id`, never widen `lib/manager/staff-projection.ts`
  (an ALLOW-LIST — `/hr/leave` and `/hr/shift-swaps` still embed full employee PII on the wire, so
  projection must stay at the API-client boundary, not at render). Never persist, log, cache or
  URL-encode a one-time PIN. Do not claim a leave decision affects payroll or the roster. Do not
  build an escalation write without first verifying the domain DTO, or an escalation list from the
  partly org-scoped `/api/approvals` (MP0-05). Do not build the chatter rail (gated on **B0**) or a
  graph/pivot view (gated on **C-03**). Do not reinstate a workspace-wide "Read-only oversight"
  badge in the readiness strip — it is false over Staff; read-only is a per-surface claim.
- **Track B5.1/B5.2/B5.3 boundaries — do not cross without explicit authorization.** **Manager accounting
  is READ-ONLY BY PERMISSION** — 15 read strings, **zero writes** (PC-01/PC-02, re-verified live: 5/5
  representative writes → 403, still true after B5.2 and B5.3). **Do not add any write affordance to the
  accounting tree, not even a disabled one**: the assertion script bans a write `method:`,
  `useMutation`, `<Button`, `onClick=` and `<form>` under `lib/accounting`,
  `components/manager/accounting`, `lib/manager/accounting-context.ts`,
  `lib/manager/accounting-surface-queries.ts`, `lib/manager/accounting-route.ts` and
  `pages/manager/accounting`, and it also fails if any mutation anywhere in the Manager tree names an
  accounting path. **B5.2 achieves real interactivity (row click, pagination, filtering) without
  ever writing a literal `onClick=`/`<Button` in the accounting tree** — every affordance is a
  callback PROP into an already-built chrome component (`ManagerListTable`, `ManagerControlPanel`,
  `ManagerSearchFilterMenu`); replicate that pattern, do not add a raw `onClick=` to make a future
  surface interactive. Do not add a menu row that cites an endpoint not in
  `ACCOUNTING_ROUTE_REGISTRY`, or one Manager is 403 on — such a surface is **ABSENT**, not a not-yet
  row (that is why **Procurement suggestions** has no row: PC-02). Do not offer any **financial
  statement** (balance sheet, P&L, cash flow, trial balance, general/partner ledger, tax or fiscal
  report) — **no endpoint exists** (NG-07 → C-11). Do not add a **Receipts** or **Manual entries**
  row — both endpoints are **POST-only**, there is nothing to list. Do not render a figure that is
  not in `ACCOUNTING_KPI_BINDINGS` (it throws) — **B5.2 wired all ten AR/AP KPIs that used to carry a
  `noDrillInReason` into a real `drillIn`; do not reintroduce a placeholder reason for one of those
  ten now that the surface it names actually exists.** ~~⚠️ Do not treat `ar/aging.summary` as a
  branch total without the completeness check — B5-F1: it aggregates only the RETURNED PAGE~~ —
  **B5-F1 FIXED (backend gap batch 3, 2026-08-21)**: `summary` now aggregates a separate unpaginated
  query, so it is a true branch total regardless of page size; the completeness check is no longer
  required for correctness (`isArAgingComplete()` is a well-formed-response guard only — do not
  re-widen it into a page-completeness check). ~~Do not filter `ar/invoices` by a status outside
  `DRAFT|ISSUED|PARTIALLY_PAID|PAID|CANCELLED|CREDIT_ADJUSTED` — an invalid value returns 500
  (B5-F2)~~ — **B5-F2 FIXED (batch 3)**: an invalid `status` now returns 400 via `@IsEnum`
  validation, on `ar/invoices` and six sibling routes — **and B5.2's own filter menus never forward
  an invalid value client-side either**, via `readManagerEnum()` in `lib/manager/accounting-route.ts`
  (a hand-edited `?status=NOT_REAL` resolves to "no filter"); any new filterable field must go
  through that same helper, never a raw `router.query.*` string. Do not relabel `periods`,
  `period-close-runs`, `posting-source-maps` or `tax-config` as branch data — they are
  **organisation-level by design**. Do not bind a pager to, or fabricate a server `total` from, the
  bare-array (PC-06) routes — label them *"Showing all N"*; **the nine B5.2 list routes are
  genuinely `data-total`/`serverTotal:true` and their pagers are legitimate — do not confuse the
  two classes.** `detailRequest()` in `lib/accounting/api.ts` replaces a literal `:id` in a
  registry path rather than blindly appending `/${id}` — **do not revert this**; it was a real
  live-QA-caught bug (a malformed double-id URL 404ing every invoice/account/bill detail) that no
  static check caught. `scripts/manager-b3-assertions.ts`'s HR-employee-PII sweep excludes
  `components/manager/accounting/` and `pages/manager/accounting/` — **do not remove that
  exclusion or widen the accounting tree's own field vocabulary to reintroduce the collision**; a
  Supplier's `taxId`/`bankName` are legitimate non-PII business fields, not an employee-data leak.
  Do not add a charting dependency or draw a time trend (no bucketed series exists — NG-05); the
  aging bucket bars are honest because the backend computes that series itself. **B5.1, B5.2 and B5.3
  are COMPLETE. B5.4, B5.5, B5.6, B6 and B7 are NOT started — do not begin any of them without
  explicit owner authorisation.**
- **Track B5.3 boundaries — do not cross without explicit authorization.** **Reconciliation is
  READ-ONLY**: do not add a Match, Skip, Reconcile, Validate or Complete control anywhere, not even
  disabled — `pos:accounting:reconciliation:match`/`:create` and `pos:accounting:bank-accounts:create`/
  `bank-statements:import`/`bank-entry:create` are all held ONLY by Owner/Accountant, re-verified live
  at 403 for Manager. `manager-b5-assertions.ts` §13 greps the whole Bank tree for
  `matchLine`/`skipLine`/`completeReconciliation` and fails if any appears. Do not bind a server-total
  pager to `bank.accounts`, `bank.statements` or `bank.reconciliations` — all three are **PC-06 bare
  arrays with no `total` field**; `toAccountingPager(` must never appear in
  `components/manager/accounting/bank/`. The status filter on Bank statements/Reconciliation is
  CLIENT-side only (the backend accepts no `?status=` on either route) — do not add a request param
  for it; a hand-edited `?status=NOT_REAL` must resolve to "no filter" via `readManagerEnum()`, same
  as every other accounting filter. Do not reintroduce `BankAccountRow.currentBalance` — the
  `BankAccount` Prisma model has no such column (B5.3-D1, confirmed against the schema directly). Do
  not add a "cash position" or "bank balance" aggregate across accounts — no endpoint computes one.
  The `PAGER_ELIGIBLE_FILES` guard in `manager-b5-assertions.ts` was extended to include
  `BankStatementsScreen.tsx` and `ReconciliationScreen.tsx` for their `ManagerBreadcrumbs` RECORD
  pager only (`pageRows.length`, never a server total) — do not read that inclusion as license to add
  a LIST pager to either file. **B5.1, B5.2 and B5.3 are COMPLETE. B5.4 (Accounting core + Review),
  B5.5 (Closing) and the remainder of B5.6 are NOT started — do not begin any of them without explicit
  owner authorisation.** Note for whoever starts B5.4: **C-23** — the M33 GL Postman collection
  cannot run (pre-existing, proven by backend gap batch 2), so the journals surface will ship without
  Postman verification; do not silently "fix" the collection as part of B5.4 without separate
  authorisation.
- Cashier reconstruction Prompt **C3 is COMPLETE** (nav Floor/Till/Me, `/cashier/floor` default,
  shared-Floor consumer, table→bill resolution with zero/one/multiple handling, canonical
  `?tableId=&orderId=` URL state, ONE `CashierSettlementWorkspace` reusing the checkout primitives,
  a bounded Cashier-only **Find bill** sibling, and — new in C3 — **payment collection, partial
  payment, split settlement and order close executing inside that workspace**). **Do not begin
  Prompt C4 (or any prompt past C3)** — do not implement receipt print/reprint/deliver, receipt
  search, or refund execution; do not delete or redirect Cashier's Queue/Receipts pages (hidden
  compatibility routes until C4/C5); do not fork the shared Floor for Cashier; do not mount the
  merge / move-items / transfer-table handoff group on the Cashier Floor path (it is intentionally
  excluded via `CashierResolutionPanel variant="split-only"`); do not add a synthetic standalone
  Close control (the backend has no zero-payment close); do not change any Cashier permission —
  without explicit authorization to proceed past C3. See §10,
  `ai/CASHIER_FLOOR_RECONSTRUCTION_ROADMAP.md`, and
  `ai/CASHIER_FLOOR_RECONSTRUCTION_C3_SETTLEMENT_COMPLETION_REPORT.md`.
- Backend gap batch 1 is **complete and must not be undone**: do not reintroduce a PDF export path
  (`format: PDF` returns 501; there is no renderer — OD-10 is still open) or re-advertise PDF in the
  report catalog; do not widen the employee safe projection or add `compensationProfile`,
  `dateOfBirth`, `address`, `emergencyContact*`, `notes` or `metadata` to a default `/hr/employees`
  payload; do not take an open-order **count** from `/dash/open-orders.count` (that is the page
  length — use `total`); and do not reintroduce `grossSales = SUM(subtotal)` /
  `netSales = SUM(total)`. ~~Do not seed the missing `accounting:*` / `finance:*` permissions
  (C-21), change the Manager role's `pos:hr:compensation:read` grant (FU-1)~~ — **both were done
  under owner authorisation on 2026-08-20 (permissions cutover).** **Do not deploy batch 1 or the
  cutover to shared Neon without the cutover gate.**
- **The permissions cutover is complete and must not be undone.** Do not remove any of the **36**
  seeded `accounting:ap:*` / `accounting:ar:*` / `pos:accounting:*` (bank-rec) / `finance:*` /
  `franchise:forecast:read` / `procurement:advisory:read` rows, and do not re-derive the gap with a
  **prefix** match — that is exactly how the original count missed bank-rec's 11 strings and
  under-reported 36 as 23. **Do not grant Manager any accounting WRITE** (the OD-9 resolution is
  Owner FULL / Accountant FULL / **Manager READ-ONLY, 15 strings**); B5 must request the five OD-9
  writes explicitly (**PC-01**). **Do not grant Manager `procurement:advisory:read`** — it also
  gates the mutation `PATCH /finance/procurement-suggestions/:id/review` (**PC-02**), so it would
  hand Manager a write. **Do not restore `pos:hr:compensation:read` to Manager** (FU-1) — Owner and
  Accountant keep it. **Do not relax the Quick-PIN branch guard** (B3-F1: cross-branch → **404**,
  foreign `body.branchId` on reset → **400**), and do not change the 404 to a 403 (a 403 would
  confirm the id exists in another branch). **Do not seed the 37 `franchise:*` / `ops:*` / `dev:*` /
  `merchant:*` / `billing:*` / `onboarding:*` / `support:*` strings (C-22)** — those modules are
  deferred, and B7 must budget its own cutover.
- **Backend gap batch 2 is complete and must not be undone.** Do not widen any accounting `where`
  clause back to `orgId` alone — use `branchOrOrgScope` / `strictBranchScope` from
  `apps/api/src/common/scope/`, and make a list and its detail sibling call the **same** helper.
  Do not make those helpers fail **open** when no branch is resolved (the throw is the point — an
  org-wide fallback is exactly the PC-03 defect). Do not turn a cross-branch **404 into a 403** — a
  403 confirms the id exists in another branch (the B3-F1 precedent). Do not use **strict** equality
  on a **nullable** `branchId` — it orphans org-level rows from every branch at once; the repo's
  predicate is `OR: [{ branchId }, { branchId: null }]`. **Do not invent a `branchId`** for
  `FiscalPeriod`, `PostingSourceMap`, `TaxLedgerConfig` or `PeriodCloseRun` — those are **org-level
  by design** (the first three have no `branch_id` column at all; the fourth is never stamped by the
  close path) and B5 must **label** them as organisation data rather than "fix" them. Do not relax
  the **PC-04** guard: a repeat generation must 409 while the legitimate next-period bill still
  returns 200.
- **Backend gap batch 3 is complete and must not be undone.** Do not revert `ar/aging.summary` to
  reducing from the paginated `openInvoices` fetch — it must keep computing from the separate
  unpaginated query (`allOpenInvoicesForSummary` in `accounts-receivable.service.ts`), or B5-F1's
  understated-balance defect returns. Do not remove the `@IsEnum` validation added to `ar/invoices`,
  `ap/payments`, `ap/credit-notes`, `ar/credit-notes`, `ap/suppliers.counterpartyType`,
  `posting-errors`, or `finance/procurement-suggestions.{status,urgency}` — that is B5-F2. Do not
  remove or raise `MAX_ACCOUNTING_LIST_PAGE_SIZE` (`apps/api/src/common/pagination/list-bounds.ts`)
  above 100 without a fresh authorization, and do not remove the `clampTake()` service-side backstop
  from any of the fourteen routes it was added to — that is B5-F3. Do not revert `audit/timeline` to
  ignoring `X-Branch-Id` — that is B5-F4. Do not re-widen `isArAgingComplete()`
  (`lib/accounting/model.ts`) into a page-completeness check — the backend fix makes that check
  unnecessary, and reintroducing it would incorrectly withhold correct money on any branch with more
  than 100 open invoices. **`ap/aging` stays intentionally unpaged** (do not add `take`/`skip` to
  it) and **the ten PC-06 bare-array routes stay unpaginated** (do not bind a pager to a fabricated
  total) — batch 3 deliberately did not touch either.
- **The formerly-red AP test now PASSES — keep it that way.**
  `accounts-payable.e2e-spec.ts` → *"should return 409 when generating duplicate for same cycle"*
  was left failing on purpose by B0 to document the correct contract; **backend gap batch 2 fixed
  the source and the test is green.** Relaxing the expectation to 200 would encode a
  duplicate-billing bug as the contract. Its two sibling cases — the next-period bill still
  returning 200, and a rewound `nextDueDate` returning 409 — guard the two halves of the guard, and
  must not be deleted.
- **B5 boundaries set by B0 (`ai/ACCOUNTING_API_VERIFICATION_REPORT.md`, verdict upgraded to 🟢
  **GO** on 2026-08-21).** ~~Do not present `ap/suppliers`, `ap/credit-notes`, `ar/credit-notes`,
  `bank-statements` as branch-scoped~~ — **PC-03 is FIXED**; they, and eleven further routes of the
  same class, are now genuinely branch-scoped. ⚠️ But **do** label `accounting/periods`,
  `accounting/posting-source-maps`, `accounting/tax-config` and `accounting/period-close-runs` as
  **organisation** data — they are org-level by design. Do not bind a C4 pager to a fabricated total
  on the **ten** list routes that return a bare array with no server `total` (**PC-06**, still
  open) — ship them as explicitly unpaginated instead. Do not call `/api/finance/forecast` — the
  route is **`/api/franchise/forecast`**. Do not read the AR aging totals from `totals.grand*` —
  they are under **`summary`** (**PC-05**; the endpoint shape is unchanged). Model fiscal periods as
  **`DRAFT → OPEN → CLOSED → LOCKED`** with no unlock route (**PC-07**). Ship journals **read-only**
  for Manager — the guides are live-verified correct (`journals:create` / `reverse` /
  `posting:replay` → 403); ⚠️ note **C-23**, the M33 collection cannot run, so that surface has no
  Postman verification. **Manager still holds NO accounting write** (**PC-01**) and is deliberately
  denied `procurement:advisory:read` (**PC-02**) — B5 must request those explicitly.
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
- **Brand-mark exception (2026-08-20):** `pos-shell/NimbusLogomark.tsx` is the
  Nimbus steering-wheel **brand mark**, not a UI icon, so it is deliberately
  **NOT** in the icon registry. It renders inline SVG in `currentColor` and is
  mounted in `BranchContextLabel` (44px header tile) and `login.tsx` (56px hero
  tile). This is the **only** documented exception — it is not a licence to import
  glyphs directly. Raster/vector brand files live in `apps/web/public/brand/`; see
  `docs/BRAND_IDENTITY.md`.

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

## 20. Claude + Codex synchronization rule

`CLAUDE.md` and `CODEX.md` are paired agent onboarding files. Whenever durable
project guidance changes in either file — status summaries, locked decisions,
paths, commands, role boundaries, validation expectations, governance rules, or
handoff notes — update the other file in the same change with the same facts,
adapted only for tool-specific wording. If a change intentionally applies to
only one agent, say why in the changed file so the other agent does not treat the
omission as drift.
