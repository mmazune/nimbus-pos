import { apiRequest } from "@/lib/api/client";

import { getAccountingRoute, getAccountingWriteRoute } from "./route-registry";
import type {
  BankReconciliationDetail,
  BudgetRow,
  ChartAccountRow,
  CostCenterRow,
  DemandCalendarEntryRow,
  FiscalPeriodRow,
  ForecastRunRow,
  JournalDetail,
  PostingErrorDetail,
  PostingSourceMapRow,
  TaxLedgerConfigRow,
} from "./types";

/**
 * Accounting WRITE request layer — Track B5.6 (2026-08-22).
 *
 * ⚠️ This is the one file in the whole `lib/accounting` tree permitted to issue
 * a write. `api.ts`'s docblock bans POST/PATCH/PUT/DELETE for the B5.1–B5.5
 * surfaces it serves — that ban stays true for `api.ts` itself, unchanged. This
 * module exists BECAUSE PERMS-2 (2026-08-21) resolved PC-01/PC-02: Manager now
 * holds the full accounting read+write permission set, and B5.6 is the first
 * phase authorised to build a UI on top of it. Every write below cites its
 * route through `getAccountingWriteRoute`/`getAccountingRoute` so a call can
 * never target an unverified endpoint — the same discipline `api.ts` already
 * established for reads.
 *
 * Every write here is scoped to exactly the seven B5.6 surfaces
 * (Budgets, Demand calendar, Forecast, Chart of accounts, Cost centres,
 * Posting source maps, Tax configuration) — no B5.1–B5.5 surface (AR/AP,
 * Bank, Journals, Fiscal periods, …) gains a write function here or anywhere
 * else; `scripts/manager-b5-assertions.ts` still bans a write method in every
 * other accounting file.
 */

function readPath(key: string) {
  return getAccountingRoute(key).path;
}

function writePath(key: string) {
  return getAccountingWriteRoute(key).path.replace(/\?.*$/, "");
}

// ── Budgets ──────────────────────────────────────────────────────────────────

export type ListBudgetsParams = {
  status?: string;
  budgetType?: string;
  fiscalPeriodId?: string;
};

function budgetsQueryString(params: ListBudgetsParams) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.budgetType) search.set("budgetType", params.budgetType);
  if (params.fiscalPeriodId) search.set("fiscalPeriodId", params.fiscalPeriodId);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** `GET /finance/budgets` — a PC-06 bare array (`budget.service.ts`'s `listBudgets` is a plain `findMany`). */
export function listBudgetsRequest(token: string, branchId: string, params: ListBudgetsParams = {}) {
  return apiRequest<BudgetRow[]>(`${readPath("finance.budgets")}${budgetsQueryString(params)}`, {
    token,
    branchId,
  });
}

export function getBudgetRequest(token: string, branchId: string, id: string) {
  return apiRequest<BudgetRow>(`${readPath("finance.budget").replace(":id", id)}`, { token, branchId });
}

export type CreateBudgetLinePayload = {
  category: string;
  dimension?: string;
  accountId?: string;
  costCenterId?: string;
  budgetAmount: number;
};

export type CreateBudgetPayload = {
  name: string;
  periodStart: string;
  periodEnd: string;
  budgetType?: "OPERATIONAL" | "FINANCIAL";
  fiscalPeriodId?: string;
  version?: number;
  notes?: string;
  lines: CreateBudgetLinePayload[];
};

/** `POST /finance/budgets` — 201, `finance:budget:write`. Uniqueness on (orgId, branchId, fiscalPeriodId, budgetType, version) — a repeat 409s. */
export function createBudgetRequest(token: string, branchId: string, payload: CreateBudgetPayload) {
  return apiRequest<BudgetRow>(writePath("finance.budgets.create"), {
    method: "POST",
    body: payload,
    token,
    branchId,
  });
}

export type RefreshBudgetActualsPayload = {
  windowStart?: string;
  windowEnd?: string;
  notes?: string;
};

/** `POST /finance/budgets/:id/update-actuals` — 200, `finance:budget:update-actuals`. 400 if the budget is ARCHIVED. */
export function refreshBudgetActualsRequest(
  token: string,
  branchId: string,
  budgetId: string,
  payload: RefreshBudgetActualsPayload = {},
) {
  return apiRequest<BudgetRow>(
    getAccountingWriteRoute("finance.budget.updateActuals").path.replace(":id", budgetId),
    { method: "POST", body: payload, token, branchId },
  );
}

// ── Demand calendar ──────────────────────────────────────────────────────────

export type ListDemandCalendarParams = {
  calendarType?: string;
  daypart?: string;
  dateStart?: string;
  dateEnd?: string;
  isActive?: string;
};

function demandCalendarQueryString(params: ListDemandCalendarParams) {
  const search = new URLSearchParams();
  if (params.calendarType) search.set("calendarType", params.calendarType);
  if (params.daypart) search.set("daypart", params.daypart);
  if (params.dateStart) search.set("dateStart", params.dateStart);
  if (params.dateEnd) search.set("dateEnd", params.dateEnd);
  if (params.isActive) search.set("isActive", params.isActive);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** `GET /finance/demand-calendar` — a PC-06 bare array. */
export function listDemandCalendarRequest(
  token: string,
  branchId: string,
  params: ListDemandCalendarParams = {},
) {
  return apiRequest<DemandCalendarEntryRow[]>(
    `${readPath("finance.demandCalendar")}${demandCalendarQueryString(params)}`,
    { token, branchId },
  );
}

export function getDemandCalendarEntryRequest(token: string, branchId: string, id: string) {
  return apiRequest<DemandCalendarEntryRow>(readPath("finance.demandCalendarEntry").replace(":id", id), {
    token,
    branchId,
  });
}

export type CreateDemandCalendarEntryPayload = {
  calendarType: string;
  daypart?: string;
  title: string;
  dateStart: string;
  dateEnd: string;
  expectedCovers?: number;
  demandMultiplier?: number;
  revenueUpliftPct?: number;
  itemNotes?: string;
  notes?: string;
  eventId?: string;
};

/** `POST /finance/demand-calendar` — 201, `finance:demand-calendar:write`. 400 if dateEnd < dateStart or eventId does not resolve in this org+branch. */
export function createDemandCalendarEntryRequest(
  token: string,
  branchId: string,
  payload: CreateDemandCalendarEntryPayload,
) {
  return apiRequest<DemandCalendarEntryRow>(writePath("finance.demandCalendar.create"), {
    method: "POST",
    body: payload,
    token,
    branchId,
  });
}

export type UpdateDemandCalendarEntryPayload = Partial<CreateDemandCalendarEntryPayload> & {
  isActive?: boolean;
};

/**
 * `PATCH /finance/demand-calendar/:id` — 200, `finance:demand-calendar:write`.
 * Also the Archive action: pass `{ isActive: false }`. There is no separate
 * archive route, and this module deliberately never calls the hard `DELETE` —
 * a deleted entry can leave a dangling id inside a persisted ForecastRun's
 * `assumptions.calendarEntriesUsed` JSON (a real footgun, documented in the
 * B5.6 completion report), so Archive is the only destructive affordance.
 */
export function updateDemandCalendarEntryRequest(
  token: string,
  branchId: string,
  id: string,
  payload: UpdateDemandCalendarEntryPayload,
) {
  return apiRequest<DemandCalendarEntryRow>(
    getAccountingWriteRoute("finance.demandCalendarEntry.update").path.replace(":id", id),
    { method: "PATCH", body: payload, token, branchId },
  );
}

// ── Forecast ─────────────────────────────────────────────────────────────────

export type ForecastParams = {
  forecastType?: string;
  fiscalPeriodId?: string;
  sourceWindowStart?: string;
  sourceWindowEnd?: string;
  horizon?: string;
};

function forecastQueryString(params: ForecastParams, refresh: boolean) {
  const search = new URLSearchParams();
  if (params.forecastType) search.set("forecastType", params.forecastType);
  if (params.fiscalPeriodId) search.set("fiscalPeriodId", params.fiscalPeriodId);
  if (params.sourceWindowStart) search.set("sourceWindowStart", params.sourceWindowStart);
  if (params.sourceWindowEnd) search.set("sourceWindowEnd", params.sourceWindowEnd);
  if (params.horizon) search.set("horizon", params.horizon);
  if (refresh) search.set("refresh", "true");
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** `GET /franchise/forecast` — returns the latest cached COMPLETED run, or a truthful 404-shaped empty state if none exists yet. */
export function getForecastRequest(token: string, branchId: string, params: ForecastParams = {}) {
  return apiRequest<ForecastRunRow>(`${readPath("franchise.forecast")}${forecastQueryString(params, false)}`, {
    token,
    branchId,
  });
}

/**
 * `GET /franchise/forecast?refresh=true` — a READ that PERSISTS a new
 * ForecastRun + ProcurementSuggestion rows as a side effect
 * (`franchise.forecast.refresh` in the write registry, `sideEffect: true`).
 * There is no POST anywhere for this — the "Refresh forecast" button in the UI
 * re-issues this same GET.
 */
export function refreshForecastRequest(token: string, branchId: string, params: ForecastParams = {}) {
  return apiRequest<ForecastRunRow>(`${readPath("franchise.forecast")}${forecastQueryString(params, true)}`, {
    token,
    branchId,
  });
}

// ── Chart of accounts ────────────────────────────────────────────────────────

export type ListChartOfAccountsParams = {
  accountType?: string;
  status?: string;
  parentAccountId?: string;
  skip?: number;
  take?: number;
};

function chartOfAccountsQueryString(params: ListChartOfAccountsParams) {
  const search = new URLSearchParams();
  if (params.accountType) search.set("accountType", params.accountType);
  if (params.status) search.set("status", params.status);
  if (params.parentAccountId) search.set("parentAccountId", params.parentAccountId);
  search.set("skip", String(params.skip ?? 0));
  search.set("take", String(Math.min(Math.max(params.take ?? 100, 1), 100)));
  return `?${search.toString()}`;
}

/** `GET /accounting/accounts` — `{data, total}`, a real server total (data-total-unpaged). ORGANISATION data. */
export function listChartOfAccountsRequest(
  token: string,
  branchId: string,
  params: ListChartOfAccountsParams = {},
) {
  return apiRequest<{ data?: ChartAccountRow[]; total?: number }>(
    `${readPath("accounting.chartOfAccounts")}${chartOfAccountsQueryString(params)}`,
    { token, branchId },
  );
}

export type CreateAccountPayload = {
  code: string;
  name: string;
  accountType: string;
  parentAccountId?: string;
  systemManaged?: boolean;
  allowManualPosting?: boolean;
  taxRelevant?: boolean;
  notes?: string;
};

/** `POST /accounting/accounts` — 201, `pos:accounting:accounts:create`. Unique (orgId, code) — a repeat 409s. No edit/archive route exists. */
export function createAccountRequest(token: string, branchId: string, payload: CreateAccountPayload) {
  return apiRequest<ChartAccountRow>(writePath("accounting.accounts.create"), {
    method: "POST",
    body: payload,
    token,
    branchId,
  });
}

// ── Cost centres ─────────────────────────────────────────────────────────────

/** `GET /accounting/cost-centers` — a PC-06 bare array, `where: {active: true}` only, no filter/pagination params exist. ORGANISATION data. */
export function listCostCentersRequest(token: string, branchId: string) {
  return apiRequest<CostCenterRow[]>(readPath("accounting.costCenters"), { token, branchId });
}

export type CreateCostCenterPayload = {
  code: string;
  name: string;
  description?: string;
};

/** `POST /accounting/cost-centers` — 201, `pos:accounting:cost-centers:create`. Unique (orgId, code) — a repeat 409s. No edit/deactivate route exists. */
export function createCostCenterRequest(token: string, branchId: string, payload: CreateCostCenterPayload) {
  return apiRequest<CostCenterRow>(writePath("accounting.costCenters.create"), {
    method: "POST",
    body: payload,
    token,
    branchId,
  });
}

// ── Posting source maps ──────────────────────────────────────────────────────

/** `GET /accounting/posting-source-maps` — a PC-06 bare array. ORGANISATION data. No create route — rows are seed/system-created. */
export function listPostingSourceMapsRequest(token: string, branchId: string) {
  return apiRequest<PostingSourceMapRow[]>(readPath("accounting.postingSourceMaps"), { token, branchId });
}

export type UpdatePostingSourceMapPayload = {
  debitAccountId?: string;
  creditAccountId?: string;
  costCenterRequired: boolean;
  active: boolean;
  notes?: string;
};

/**
 * `PATCH /accounting/posting-source-maps/:id` — 200,
 * `pos:accounting:posting-source-maps:update`. `costCenterRequired` and
 * `active` are ALWAYS sent explicitly (never omitted) — the service treats an
 * omitted boolean as Prisma `undefined` ("don't touch this field"), so an
 * omission would silently fail to deactivate a row the form displays as
 * unchecked.
 */
export function updatePostingSourceMapRequest(
  token: string,
  branchId: string,
  id: string,
  payload: UpdatePostingSourceMapPayload,
) {
  return apiRequest<PostingSourceMapRow>(
    getAccountingWriteRoute("accounting.postingSourceMaps.update").path.replace(":id", id),
    { method: "PATCH", body: payload, token, branchId },
  );
}

// ── Tax configuration ────────────────────────────────────────────────────────

/** `GET /accounting/tax-config` — a SINGLETON object; 404 if none configured yet (never an empty array). ORGANISATION data. */
export function getTaxConfigRequest(token: string, branchId: string) {
  return apiRequest<TaxLedgerConfigRow>(readPath("accounting.taxConfig"), { token, branchId });
}

export type UpdateTaxConfigPayload = {
  outputTaxAccountId?: string;
  inputTaxAccountId?: string;
  discountAccountId?: string;
  depositLiabilityAccountId?: string;
  payrollPayableAccountId?: string;
  active: boolean;
};

/**
 * `PATCH /accounting/tax-config` — 200, `pos:accounting:tax-config:update`.
 * Upserts (updates the existing active row, or creates one if none exists).
 * `active` is ALWAYS sent explicitly — omitting it makes the service default
 * to `true` (`dto.active ?? true`), so an omitted field would silently
 * re-activate a config the form is trying to leave inactive.
 */
export function updateTaxConfigRequest(token: string, branchId: string, payload: UpdateTaxConfigPayload) {
  return apiRequest<TaxLedgerConfigRow>(writePath("accounting.taxConfig.update"), {
    method: "PATCH",
    body: payload,
    token,
    branchId,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Track B5.7 (2026-08-22) — retrofit writes over B5.1–B5.5's surfaces.
// Same discipline as the B5.6 block above: every call cites its route through
// `getAccountingWriteRoute`, so it can never target an unverified endpoint.
// ═══════════════════════════════════════════════════════════════════════════

// ── Posting errors (B5.4) ────────────────────────────────────────────────────

export type ResolvePostingErrorPayload = { resolutionNotes?: string };

/** `PATCH /accounting/posting-errors/:id/resolve` — 200, `pos:accounting:posting-errors:resolve`. OPEN → RESOLVED; a repeat 409s. */
export function resolvePostingErrorRequest(
  token: string,
  branchId: string,
  id: string,
  payload: ResolvePostingErrorPayload = {},
) {
  return apiRequest<PostingErrorDetail>(
    getAccountingWriteRoute("accounting.postingError.resolve").path.replace(":id", id),
    { method: "PATCH", body: payload, token, branchId },
  );
}

export type DismissPostingErrorPayload = { resolutionNotes?: string };

/** `PATCH /accounting/posting-errors/:id/dismiss` — 200, `pos:accounting:posting-errors:resolve`. OPEN → DISMISSED; a repeat 409s. */
export function dismissPostingErrorRequest(
  token: string,
  branchId: string,
  id: string,
  payload: DismissPostingErrorPayload = {},
) {
  return apiRequest<PostingErrorDetail>(
    getAccountingWriteRoute("accounting.postingError.dismiss").path.replace(":id", id),
    { method: "PATCH", body: payload, token, branchId },
  );
}

// ── Fiscal periods (B5.5) ────────────────────────────────────────────────────

export type CreateFiscalPeriodPayload = { name: string; startsAt: string; endsAt: string };

/** `POST /accounting/periods` — 201, `pos:accounting:periods:create` (the C-27 grant). Creates a DRAFT period. */
export function createFiscalPeriodRequest(token: string, branchId: string, payload: CreateFiscalPeriodPayload) {
  return apiRequest<FiscalPeriodRow>(writePath("accounting.periods.create"), {
    method: "POST",
    body: payload,
    token,
    branchId,
  });
}

/** `PATCH /accounting/periods/:id/open` — 200, `pos:accounting:periods:open`. DRAFT → OPEN. */
export function openFiscalPeriodRequest(token: string, branchId: string, id: string) {
  return apiRequest<FiscalPeriodRow>(
    getAccountingWriteRoute("accounting.periods.open").path.replace(":id", id),
    { method: "PATCH", token, branchId },
  );
}

export type CloseFiscalPeriodPayload = { notes?: string; retainedEarningsAccountId?: string };

/** `PATCH /accounting/periods/:id/close` — 200, `pos:accounting:periods:close`. OPEN → CLOSED, creates a PeriodCloseRun. */
export function closeFiscalPeriodRequest(
  token: string,
  branchId: string,
  id: string,
  payload: CloseFiscalPeriodPayload = {},
) {
  return apiRequest<FiscalPeriodRow>(
    getAccountingWriteRoute("accounting.periods.close").path.replace(":id", id),
    { method: "PATCH", body: payload, token, branchId },
  );
}

/** `PATCH /accounting/periods/:id/lock` — 200, `pos:accounting:periods:lock`. CLOSED → LOCKED, terminal (PC-07: no unlock route). */
export function lockFiscalPeriodRequest(token: string, branchId: string, id: string) {
  return apiRequest<FiscalPeriodRow>(
    getAccountingWriteRoute("accounting.periods.lock").path.replace(":id", id),
    { method: "PATCH", token, branchId },
  );
}

// ── Bank reconciliation (B5.3) ───────────────────────────────────────────────

export type MatchReconciliationLinePayload = {
  bankStatementLineId: string;
  journalLineId?: string;
  manualEntryId?: string;
  notes?: string;
};

/** `PATCH /accounting/reconciliation/:id/match` — 200, `pos:accounting:reconciliation:match`. An UNMATCHED line → MATCHED. */
export function matchReconciliationLineRequest(
  token: string,
  branchId: string,
  id: string,
  payload: MatchReconciliationLinePayload,
) {
  return apiRequest<BankReconciliationDetail>(
    getAccountingWriteRoute("accounting.reconciliation.match").path.replace(":id", id),
    { method: "PATCH", body: payload, token, branchId },
  );
}

export type SkipReconciliationLinePayload = { bankStatementLineId: string; notes?: string };

/** `PATCH /accounting/reconciliation/:id/skip` — 200, `pos:accounting:reconciliation:match`. An UNMATCHED line → SKIPPED. */
export function skipReconciliationLineRequest(
  token: string,
  branchId: string,
  id: string,
  payload: SkipReconciliationLinePayload,
) {
  return apiRequest<BankReconciliationDetail>(
    getAccountingWriteRoute("accounting.reconciliation.skip").path.replace(":id", id),
    { method: "PATCH", body: payload, token, branchId },
  );
}

/** `POST /accounting/reconciliation/:id/complete` — 200 if balanced, 400 if a non-zero difference remains (by design). `pos:accounting:reconciliation:create`. */
export function completeReconciliationRequest(token: string, branchId: string, id: string) {
  return apiRequest<BankReconciliationDetail>(
    getAccountingWriteRoute("accounting.reconciliation.complete").path.replace(":id", id),
    { method: "POST", token, branchId },
  );
}

// ── Journals (B5.4 core) ─────────────────────────────────────────────────────

export type ReverseJournalPayload = { reason?: string };

/** `POST /accounting/journals/:id/reverse` — 201, `pos:accounting:journals:reverse`. POSTED → REVERSED, creates a mirrored new journal. A repeat 409s. */
export function reverseJournalRequest(
  token: string,
  branchId: string,
  id: string,
  payload: ReverseJournalPayload = {},
) {
  return apiRequest<JournalDetail>(
    getAccountingWriteRoute("accounting.journal.reverse").path.replace(":id", id),
    { method: "POST", body: payload, token, branchId },
  );
}
