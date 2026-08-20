# Nimbus POS vs Odoo — Manager/Owner Enterprise UI Gap Analysis

**Date:** 2026-08-20
**Odoo side:** `ai/ODOO_REFERENCE_RESEARCH.md` (live read-only scan of MARU CREDIT LIMITED, 2026-08-20).
**Nimbus side:** grounded in the repo — `docs/manager-ui-docs/MANAGER_API_MATRIX.md`, `ai/MANAGER_P0_REPO_VERIFICATION_REPORT.md` (live-verified backend truth), `docs/ACCOUNTING_FOUNDATION_GUIDE.md`, `docs/GL_POSTING_ENGINE_GUIDE.md`, `docs/REPORT_CATALOG_GUIDE.md`, `docs/MODULES.md`, and a direct route scan of `apps/api/src/modules/**/*.controller.ts`.

---

## 0. The headline finding

**Nimbus's accounting backend is far larger than any Nimbus document currently admits.** A route scan of `apps/api/src/modules` found **four registered, wired controllers that `docs/MODULES.md` still lists as "⬜ Planned"** and that `MANAGER_API_MATRIX.md` does not mention at a single row:

| Module | Controller | Prefix | Routes |
|---|---|---|---|
| `accounts-payable` | `accounts-payable.controller.ts` | `accounting/ap` | 20 |
| `accounts-receivable` | `accounts-receivable.controller.ts` | `accounting/ar` | 11 |
| `bank-rec` | `bank-rec.controller.ts` | `accounting` | 16 |
| `budget` | `budget.controller.ts` | `finance` / `franchise` | 12 |

`docs/MODULES.md` row *"Accounting (COA, GL, AP, AR) — M32–M36 — ⬜ Planned"* and *"Budgets / Forecasts — M37 — ⬜ Planned"* are **stale**. The code exists.

**Consequence for this analysis:** most of what the owner admires in Odoo's Accounting module is a **UI gap over an existing API**, not a backend gap. That materially changes the sizing of the whole manager suite.

> ⚠️ These four modules were found by static route scan only. Unlike the 62 rows in `MANAGER_API_MATRIX.md`, they have **not been live-verified** (no runtime probe, no permission check, no payload inspection) as part of this research task. Treat "Nimbus has API" for AP/AR/bank-rec/budget as **claimed-by-code, unverified-at-runtime** until an M-P0-style pass covers them.

---

## 1. Accounting

### 1.1 What Odoo has (feature level)

Invoicing (customer invoices, credit notes, customer payments), vendor bills + expenses + vendor refunds + vendor payments, journal entries and journal items, a reconciliation workbench, tax returns with a guided setup checklist, lock dates, assets & loans registers, deferred revenue/expense regularization, unrealized-currency handling, goods-received-not-billed control reports, a full audit trail, and a Configuration tree of 15 items (Chart of Accounts, Taxes, Journals, Currencies, Fiscal Positions, Multi-Ledger, Checks, Asset Models, Payment Terms, Follow-up Levels, Product Categories, Payment Providers, Payment Methods, Settings).

### 1.2 What Nimbus has (endpoint level)

| Area | Nimbus endpoints | UI today |
|---|---|---|
| Chart of Accounts | `GET/POST /api/accounting/accounts` | none |
| Cost centres | `GET/POST /api/accounting/cost-centers` | none |
| Fiscal periods | `GET/POST /api/accounting/periods`, `PATCH /periods/:id/open`, `PATCH /periods/:id/close`, `PATCH /periods/:id/lock`, `GET /period-close-runs` | none |
| Posting config | `GET /posting-source-maps`, `PATCH /posting-source-maps/:id`, `GET/PATCH /tax-config` | none |
| Journals / GL | `POST/GET /api/accounting/journals`, `GET /journals/:id`, `POST /journals/:id/reverse` | none |
| Posting engine | `POST /posting/replay`, `GET /posting-runs`, `GET /posting-errors`, `GET /posting-errors/:id` | none |
| **AP** | `accounting/ap`: `suppliers` (POST/GET/GET :id), `bills` (POST/GET/GET :id/`:id/approve`), `payments` (POST/GET), `credit-notes` (POST/GET), `aging` (GET), `recurring-profiles` (POST/GET/PATCH/`:id/generate-bill`), `reminders` (`generate`/GET/`:id/dismiss`) | none |
| **AR** | `accounting/ar`: `accounts` (POST/GET/GET :id), `invoices` (POST/GET/GET :id), `receipts` (POST), `aging` (GET), `credit-notes` (POST/GET) | none |
| **Bank rec** | `bank-accounts` (GET/POST), `bank-statements` (GET/GET :id/`import`), `reconciliation` (GET/GET :id/POST/`:id/match`/`:id/skip`/`:id/complete`), `manual-bank-entries` (POST) | none |
| **Budgets** | `finance/budgets` (GET/GET :id/POST/`:id/update-actuals`), `procurement-suggestions` (GET/`:id/review`), `demand-calendar` (CRUD) | none |

### 1.3 Verdict

There is **no Nimbus accounting UI at all** — zero of ~90 accounting/finance endpoints are surfaced. This is overwhelmingly a **UI gap over existing API**.

**Genuine backend gaps vs Odoo:** tax *returns* (filing periods + a return document — Nimbus has `tax-config` and tax accounts but no return object), assets & depreciation, loans, deferred revenue/expense schedules, multi-currency unrealized gain/loss revaluation (Nimbus has `settings/exchange-rate(s)` but no revaluation posting), fiscal positions, payment terms and follow-up/dunning levels (partially covered by AP `reminders`), and the statement reports themselves (Balance Sheet / P&L / Cash Flow / Trial Balance / General Ledger / Partner Ledger / Aged Receivable / Aged Payable are **not** among Nimbus's 24 report generators — only AP/AR `aging` endpoints exist).

---

## 2. Dashboards / KPIs

**Odoo:** six per-journal KPI cards in a 3-column kanban grid, each with title, mixed-weight action buttons, right-aligned count→amount stat pairs where the *count is the drill-in link*, a mini bar/line chart, and in one case a setup checklist. The dashboard is a real kanban view — it has the search bar, a `Favorites` filter chip and a pager.

**Nimbus:** `GET /api/dash/owner`, `/dash/manager`, `/dash/today-summary`, `/dash/payment-mix`, `/dash/open-orders`, `/dash/low-stock`, `/dash/snapshots`, `POST /dash/kpi/refresh`, plus `GET /api/stream/metrics` (SSE).

The **data shape is broadly there**; the gaps are presentational and semantic:

- No card-grid component; the manager Overview is still to be built (M-P1/M-P2).
- Odoo's "count is a link, amount is data" pattern requires each Nimbus KPI to carry a drill-in target — `/dash/manager` returns numbers, not targets.
- **MP0-09**: `/dash/open-orders` hard-caps at `take: 50` and returns `count = page length`, contradicting `/dash/manager.openOrders`. Use `/dash/manager` for the number.
- **MP0-10**: `netSales` (`SUM(total)`, inc-tax) exceeds `grossSales` (`SUM(subtotal)`, ex-tax) — inverted vs hospitality convention. Odoo-style bare "Gross/Net" labels would be actively wrong.
- **MP0-07**: SSE needs `Authorization` **and** `X-Branch-Id`; `EventSource` supports neither and no SSE client exists in `apps/web`. Odoo's live-ish dashboard has no equivalent cost because it polls.
- Nimbus has **no charting** on any dashboard endpoint — no bucketed time series equivalent to Odoo's 6-bucket aging bar chart. `/dash/snapshots` is the nearest thing and is untested for this use.

---

## 3. Reporting

**Odoo:** 13 named financial reports under one menu, plus generic **Graph** and **Pivot** views on nearly every model with `Measures ▾`, chart-type toggles, `Insert in Spreadsheet`, pivot expand/flip/download, and **saved searches** (`Favorites → Save current search`).

**Nimbus:** 24 report generators (`GET /api/reports/catalog`, 24 `POST /api/reports/<key>`, `GET /reports`, `GET /reports/:id`, `POST /reports/export`, `GET /reports/exports/:id/download`, plus `GET /api/exports/:id` and `/exports/:id/download`).

Gaps:

- **MP0-03 (critical for trust):** `POST /reports/export` with `format: PDF` produces a **plain-text file stamped `application/pdf`** and reports `status: READY`. A fake success. Odoo's `Print`/`Preview` produce real PDFs. **Nimbus must ship CSV-only** until a real renderer exists; a fake download must never be shipped.
- **MP0-08:** `GET /reports/:id` returns **no rows** — only `summary` + `rowCount`. There is no row payload to feed a pivot or a table. Odoo's pivot is backed by real grouped reads. **A Nimbus pivot/graph clone is a backend gap, not a UI gap.**
- **MP0-16 (positive):** all 24 generator DTOs are `{reportWindow, dateFrom?, dateTo?, parameters?}` (only `top-items` adds `limit?`), so **one generic generate form is DTO-correct** — this shrinks the Reports UI substantially.
- **MP0-12:** `GET /reports/:id` and `POST /reports/export` look up by `orgId` only — cross-branch read verified live. Display each row's own `branchId`.
- **MP0-13:** `POST /reports/export` is gated by a **read** permission (`pos:reports:exports:read`) on a write route. Backend guard defect, no Manager impact.
- **No saved filters / favourites** concept exists anywhere in the Nimbus API.
- **No financial statements** among the 24 (see §1.3).

---

## 4. Staff / HR admin

**Odoo:** invite-by-email → `Invited ▸ Confirmed` statusbar → user sets own password; admin actions `Change Password`, `Send Password Reset Instructions`, `Disable two-factor authentication`, `Archive`, `Privacy Lookup`; a Security tab exposing 2FA, API keys, passkeys and **per-device session revocation**; `Access Rights` as *named permission levels per app domain*; `Create employee` promoting a login into an HR record.

**Nimbus:** `POST /api/hr/frontline-staff/onboard`, `GET /hr/frontline-staff/:id/quick-pin-status`, `POST /:id/quick-pin/reset`, `PATCH /:id/quick-pin/disable`, `PATCH /:id/quick-pin/enable`; `GET/POST/PATCH /hr/employees`, `/hr/contracts`, `/hr/positions`, `/hr/compensation-profiles`; attendance/leave/shift-swaps under `/api/hr/*`; `workforce/*` scheduling; `staff/*` insights; `payroll/*`.

Gaps and constraints:

- **MP0-01 (🔴 Critical — the compensation leak; note this is MP0-01, not MP0-16):** `GET /hr/employees` returns the full `compensationProfile` (`baseAmount`, `salaryBasis`, `allowances`, `deductions`) on **all 40 rows**, and `/hr/employees/:id` adds `contracts[]` with `salaryAmount`. This violates the locked "never fetched" decision. Requires an allow-list projection **at the API-client boundary**; a backend projection is recommended and **not implemented**.
- **MP0-14:** `POST /hr/frontline-staff/onboard` returns a **plaintext** `quickPin.pin` and `issueQuickPin` defaults **true**. Odoo never returns a credential in an API response — it emails a reset link. Nimbus's PIN must be masked, copy-once, never logged, never cached.
- **MP0-15:** the onboard DTO's nested `employee` accepts `contractId` and `compensationProfileId` — the Manager form must never expose or send either.
- **MP0-06:** `GET /hr/employees` is **org-scoped** and rejects `?branchId=` with 400. The branch switcher will look broken on a Staff page unless filtered client-side with an explicit note.
- **No password concept at all** for frontline staff — Nimbus has Quick PIN only. There is **no** `send password reset instructions`, no 2FA admin, no API-key or passkey management, and **no session/device revocation for a user** (`/api/devices` is hardware registry, not user sessions). All are backend gaps.
- **No invite-by-email flow** and no `Invited ▸ Confirmed` lifecycle — Nimbus onboarding is admin-creates-and-hands-over-a-PIN.
- **No self-serve access-rights editor**: role→permission is fixed in `packages/db/prisma/seed.ts` (`ROLE_PERM_MATRIX`). Odoo's per-domain permission-level dropdowns have no Nimbus equivalent, by design.

---

## 5. Settings

**Odoo:** two-pane settings (icon sidebar of per-app scopes + banded section stack + `Save`/`Discard`), company management, document layout, email templates, language management, user invitation.

**Nimbus:** `GET/PATCH /api/settings`, `GET/PUT /settings/currency`, `/settings/tax-matrix`, `/settings/rounding`, `GET/PATCH /thresholds`, `GET/PUT /settings/platform-access`, `POST /settings/exchange-rate`, `GET /settings/exchange-rates`; `devices/*` (activate, kds/register, printers/routes, terminals/pair, terminals/:id/unpair, list, `:id/history`, `:id/status`); `alerts/*` (rules, channels, test, deliveries + retry, digests + run); `sync/*` (replay, jobs, jobs/:id/retry, conflicts, conflicts/:id/resolve, idempotency/inspect); `tenancy` (`orgs`, `branches`, `memberships`, `me`).

Gaps:

- **MP0-04:** `PATCH /api/branches/:id` **does not exist** (404) — no branch-update route of any method. Branch profile must ship **read-only**; Odoo's `Update Info` has no Nimbus counterpart.
- Owner decisions (locked 2026-08-20) already constrain this area: printer routes **metadata-only**, terminal pairing **stub-only**, alert rules **defer-or-read-only**, sync-conflict diff **deferred**.
- Nimbus has **richer** operational settings than Odoo in three places Odoo simply lacks: hardware **device registry with status history**, an **alerts engine** (rules/channels/deliveries/digests/test-send), and a **sync/reliability console**. These are Nimbus differentiators with **no Odoo reference to copy** — they need original design.
- Nimbus has **no** document layout, no email templates, no language management, no multi-company switcher UI (though `tenancy` supports orgs/branches/memberships).

---

## 6. Prioritized gap table

Legend — **Type:** `UI-over-API` = backend exists, only a UI is missing · `Backend` = the capability does not exist server-side · `Mixed`.
**Sizing:** S ≤ 1 surface / few days · M = a page family · L = a module.

| GAP | Area | What Odoo has | What Nimbus has | Type | Recommendation | Size |
|---|---|---|---|---|---|---|
| **NG-01** | Reporting integrity | Real PDF `Print`/`Preview` | `POST /reports/export` PDF emits **plain text stamped `application/pdf`**, `status: READY` (MP0-03) | **Backend** | **Ship CSV-only.** Render PDF unavailable with honest copy. Never ship the fake download. Real renderer is a backend addition. | S (hide) / M (renderer) |
| **NG-02** | Staff privacy | Compensation is not on a user list | `GET /hr/employees` leaks `compensationProfile` on all rows; `:id` adds `contracts[].salaryAmount` (MP0-01) | **Mixed** | Allow-list projection at the API-client boundary **before** any Staff UI ships; request a backend projection. Blocks M-P4. | S (client) / M (backend) |
| **NG-03** | Accounting UI | Full Customers/Vendors/Journals/Reconcile menus | ~90 endpoints across `accounting`, `ledger`, `ap`, `ar`, `bank-rec`, `budget` — **zero UI** | **UI-over-API** | Highest-leverage build. Start with AR invoices + AP bills lists (clone C4 list view) and the reconciliation workbench. **Live-verify these routes first — they were never M-P0'd.** | L |
| **NG-04** | Docs truth | — | `docs/MODULES.md` marks AP/AR/accounting/budgets "⬜ Planned" though controllers exist; `MANAGER_API_MATRIX.md` omits them entirely | **Docs** | Fix `MODULES.md`; matrix Addendum added 2026-08-20. Cheapest fix here, and it unblocks correct planning. | S |
| **NG-05** | Manager Overview | 3-col KPI card grid, count→link + amount, mini charts, checklists | `/dash/manager`, `/dash/owner`, `/dash/today-summary`, `/dash/payment-mix`, SSE `/stream/metrics` | **UI-over-API** | Build the C10 card grid. Give every KPI a drill-in target. Respect MP0-09 (use `/dash/manager` for counts) and MP0-10 (do not label bare Gross/Net). | M |
| **NG-06** | Reporting depth | Pivot/Graph over real grouped rows | `GET /reports/:id` returns **summary only, no rows** (MP0-08) | **Backend** | Render `summary` as a key/value panel. **Do not fabricate a row table** and do not promise a pivot clone until rows exist. | S (now) / L (rows) |
| **NG-07** | Financial statements | Balance Sheet, P&L, Cash Flow, Trial Balance, General Ledger, Partner Ledger, Aged Receivable/Payable | None of the 24 generators are financial statements; only AP/AR `aging` | **Backend** | Defer. Ship AP/AR aging views over the existing `aging` endpoints as the first financial report. | L |
| **NG-08** | Credential admin | Change Password, **Send Password Reset Instructions**, Disable 2FA, per-device `Log out` | Quick PIN reset/disable/enable only; no password, no 2FA, no session revocation | **Backend** | Defer password/2FA. Ship the C12 label+description+button table over the existing Quick-PIN routes so the *shape* matches Odoo now. | S (PIN UI) / L (auth) |
| **NG-09** | Credential handling | Credentials never returned by API | `onboard` returns plaintext `quickPin.pin`; `issueQuickPin` defaults true (MP0-14) | **UI discipline** | Masked, copy-once, expiry copy. Never log, never persist, never place in a query cache. Assert in `manager-p4-assertions.ts`. | S |
| **NG-10** | Control panel shell | `New` + title + chip search + pager + view switcher on one row | Not built | **UI-only** | Build C1 once as the shared manager shell header; every later page is then cheap. Needs the MP0-18 icon-registry additions + optional `OperationalHeader` slot. | M |
| **NG-11** | Saved filters | `Favorites → Save current search` on every view | No saved-view/filter concept in the API | **Backend** | Defer, or implement client-side-only (localStorage) saved filters and say so plainly. | M |
| **NG-12** | Audit presentation | Chatter with `old → new (Field)` tracked-field diffs | `GET /api/audit/timeline` exists; no UI | **UI-over-API** | Build the C6 chatter rail against the timeline. High perceived-quality per unit effort. | M |
| **NG-13** | Branch settings | Company `Update Info` | `PATCH /api/branches/:id` **404** (MP0-04) | **Backend** | Branch profile ships **read-only**. Do not build an edit form. | S |
| **NG-14** | Live data | Polled dashboard | SSE `/stream/metrics` needs `Authorization` + `X-Branch-Id`; `EventSource` supports neither; no client in `apps/web` (MP0-07) | **UI infra** | Build a `fetch` + `ReadableStream` reader with abort-on-branch-change. Budget as new infrastructure, not a KPI feature. | M |
| **NG-15** | Approvals scoping | — | `GET /api/approvals` is **org-scoped**; live `total: 16` across 5 branches while `X-Branch-Id` said Tapas (MP0-05) | **UI discipline** | Filter by `branchId === activeBranchId`; exclude FINANCE rows; label the KPI honestly. Route every **write** through domain endpoints (MANAGER-GAP-007). | S |
| **NG-16** | Ops settings | *(no Odoo equivalent)* | `devices/*`, `alerts/*`, `sync/*` — richer than Odoo | **UI-over-API** | Original design required; use the C11 two-pane settings shell. Honour locked constraints: printers metadata-only, terminals stub-only, alert rules read-only, sync diff deferred. | M |
| **NG-17** | Tax returns | Tax Returns doc + setup checklist + Lock Dates | `tax-config` + `periods/:id/close|lock` + `period-close-runs`; **no return document** | **Mixed** | Ship a **period-close + lock-dates** page over the existing bank-rec routes — that is the closest true analogue. Tax-return document is a backend gap; defer. | M |
| **NG-18** | Branch filtering | — | `/hr/employees` org-scoped, rejects `?branchId=` (400) (MP0-06) | **Backend** (small) | Client-side filter + explicit note, or the branch switcher looks broken on Staff. | S |
| **NG-19** | Assets/Loans/Deferrals | Assets, Loans, Deferred Rev/Exp, Unrealized Currencies | Nothing | **Backend** | **Defer.** Out of scope for a hospitality POS manager suite. | L |
| **NG-20** | Pagination safety | — | Unbounded `pageSize`/`take` on `/pos/orders`, `/reports`, `/hr/employees` — no `@Max`, no clamp (MP0-11) | **Backend** (small) | Always send an explicit bounded page size from the client; register `@Max` as a backend fix. | S |

### Top 10 by priority

1. **NG-01** — kill the fake PDF (trust-destroying, and the owner decision already forbids it).
2. **NG-02** — the compensation leak blocks M-P4 entirely.
3. **NG-04** — fix the stale module docs; they are causing systematic under-scoping of what exists.
4. **NG-10** — the shared control-panel shell; every other surface depends on it.
5. **NG-05** — the Manager Overview KPI grid; this is the screen the owner actually screenshotted.
6. **NG-03** — the accounting UI over ~90 existing endpoints; the single biggest capability unlock.
7. **NG-09** — plaintext PIN handling discipline.
8. **NG-12** — chatter/audit-timeline rail; cheapest large gain in perceived enterprise-ness.
9. **NG-06** — stop promising pivot/graph until `/reports/:id` returns rows.
10. **NG-14** — the SSE client, because the "live" feel depends on it.

---

## 7. UI gap vs backend gap — summary

| | Count | Examples |
|---|---|---|
| **UI gap over existing API** | 7 | NG-03 (accounting, ~90 endpoints), NG-05, NG-10, NG-12, NG-16, plus the AP/AR aging views under NG-07 |
| **Backend gap (capability absent)** | 8 | NG-01 (PDF renderer), NG-06 (report rows), NG-07 (financial statements), NG-08 (password/2FA/sessions), NG-11 (saved filters), NG-13 (branch PATCH), NG-17 (tax return doc), NG-19 (assets/loans/deferrals) |
| **Mixed / discipline / docs** | 5 | NG-02, NG-04, NG-09, NG-15, NG-18, NG-20 |

**The single most important correction to the current plan:** the manager suite has been scoped as if accounting were absent. It is not. Roughly 90 accounting/finance endpoints already exist across four undocumented modules, and the dominant cost there is frontend, not backend — *provided* those routes survive an M-P0-style live verification, which has never been run against them.
