// RELATIVE imports on purpose: this module is executed directly by
// `scripts/manager-b5-assertions.ts` under `tsx`, which does not resolve the
// Next.js `@/` alias at runtime. Same precedent as `lib/manager/dashboard-model.ts`.
import { formatWaiterMoney } from "../waiter/formatters";

import { getAccountingRoute } from "./route-registry";
import type {
  AccountingDecimal,
  ApAgingResponse,
  ArAgingResponse,
  BankReconciliationRow,
  FiscalPeriodRow,
  FiscalPeriodStatus,
} from "./types";

/**
 * Accounting pure model — Track B5.1.
 *
 * No React, no network, no aliased imports: every function here is plain so the
 * assertion script can exercise it directly, the same split B2 used for
 * `dashboard-model.ts`.
 *
 * The governing rule for all of it is **fail closed**. On a money surface a
 * fabricated zero is worse than a gap, so nothing here coerces a missing value
 * to `0`, back-fills a bucket, or derives a total from a page length.
 */

// ── Money ───────────────────────────────────────────────────────────────────

/** Parse a wire Decimal. Returns `null` — never `0` — when it is absent or unparseable. */
export function toAccountingAmount(value: AccountingDecimal): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * UGX renders with zero fraction digits.
 *
 * Deliberately the SHARED formatter named in the locked decision
 * (`lib/waiter/formatters.ts`) rather than a fifth per-module money formatter —
 * it already owns the zero-fraction currency set and the `currencyDisplay: "code"`
 * convention that Waiter, Cashier, Supervisor and Manager all render through.
 */
export function formatAccountingMoney(
  value: AccountingDecimal,
  currencyCode?: string | null,
  fallback = "Unavailable",
) {
  return formatWaiterMoney(toAccountingAmount(value), currencyCode, fallback);
}

/** Whole-number counts. Fails closed to `null`, never to `0`. */
export function toAccountingCount(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isFinite(value) ? value : null;
}

export function formatAccountingCount(value: number | null | undefined, fallback = "Unavailable") {
  const count = toAccountingCount(value);
  return count === null ? fallback : new Intl.NumberFormat("en-US").format(count);
}

// ── Aging buckets ───────────────────────────────────────────────────────────

export type AccountingAgingBucketKey = "current" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";

export type AccountingAgingBucket = {
  key: AccountingAgingBucketKey;
  label: string;
  /** Screen-reader wording — status is never colour alone (docs/UI_SYSTEM.md §7). */
  description: string;
  amount: number | null;
  tone: "neutral" | "info" | "warning" | "danger";
};

const BUCKET_META: ReadonlyArray<{
  key: AccountingAgingBucketKey;
  label: string;
  description: string;
  tone: AccountingAgingBucket["tone"];
}> = [
  { key: "current", label: "Current", description: "Not yet due", tone: "neutral" },
  { key: "d1_30", label: "1–30", description: "Overdue by 1 to 30 days", tone: "info" },
  { key: "d31_60", label: "31–60", description: "Overdue by 31 to 60 days", tone: "warning" },
  { key: "d61_90", label: "61–90", description: "Overdue by 61 to 90 days", tone: "warning" },
  { key: "d90_plus", label: "90+", description: "Overdue by more than 90 days", tone: "danger" },
];

/**
 * The two aging endpoints use DIFFERENT field names for the same five buckets
 * (`days1to30` on AP, `bucket_1_30` on AR). Mapping them here — once — is what
 * lets one bucket component serve both cards without either side guessing.
 */
export function toApAgingBuckets(response: ApAgingResponse | undefined): AccountingAgingBucket[] {
  const buckets = response?.buckets;
  const source: Record<AccountingAgingBucketKey, AccountingDecimal> = {
    current: buckets?.current,
    d1_30: buckets?.days1to30,
    d31_60: buckets?.days31to60,
    d61_90: buckets?.days61to90,
    d90_plus: buckets?.days90plus,
  };
  return BUCKET_META.map((meta) => ({ ...meta, amount: toAccountingAmount(source[meta.key]) }));
}

export function toArAgingBuckets(response: ArAgingResponse | undefined): AccountingAgingBucket[] {
  const summary = response?.summary;
  const source: Record<AccountingAgingBucketKey, AccountingDecimal> = {
    current: summary?.current,
    d1_30: summary?.bucket_1_30,
    d31_60: summary?.bucket_31_60,
    d61_90: summary?.bucket_61_90,
    d90_plus: summary?.bucket_90_plus,
  };
  return BUCKET_META.map((meta) => ({ ...meta, amount: toAccountingAmount(source[meta.key]) }));
}

/** Total overdue = everything except `current`. `null` when any bucket is unreadable. */
export function overdueTotal(buckets: readonly AccountingAgingBucket[]): number | null {
  let sum = 0;
  for (const bucket of buckets) {
    if (bucket.key === "current") continue;
    if (bucket.amount === null) return null;
    sum += bucket.amount;
  }
  return sum;
}

// ── B5-F1: the AR aging summary is PAGE-scoped ──────────────────────────────

/**
 * The page size the AR aging card requests.
 *
 * Manager always sends its own bound (the M-P1 precedent, MP0-11) — the server
 * default is 50 and this pass measured NO server-side maximum (`take=5000`
 * returned 200), so an unbounded read is the caller's responsibility to prevent.
 */
export const AR_AGING_PAGE_SIZE = 100;

/**
 * ✅ B5-F1 FIXED (backend gap batch 3, 2026-08-21). `GET /ar/aging` used to
 * compute `summary` over the RETURNED PAGE, not over the whole `where` clause
 * — live on 2026-08-21, `?take=1` reported `total: 5` alongside
 * `summary.totalOutstanding: 599,800`, where the true branch figure was
 * `9,106,400`. The backend now reduces `summary` from a SEPARATE, unpaginated
 * query over the identical `where` (`accounts-receivable.service.ts`,
 * `getAgingSummary`), so `summary` is correct regardless of `skip`/`take` —
 * proven by a unit test that asserts identical totals at `take=1`, `take=3`
 * and unpaginated. `accounts[]` (the per-customer display breakdown) is still
 * genuinely page-limited; only the grand `summary` totals were ever wrong.
 *
 * This function is kept only as a well-formed-response guard (a malformed or
 * missing response still withholds the headline) — it no longer encodes a
 * page-completeness requirement, because there is nothing left for the page
 * to be incomplete *about* as far as the money is concerned.
 */
export function isArAgingComplete(response: ArAgingResponse | undefined): boolean {
  if (!response) return false;
  if (toAccountingCount(response.total) === null) return false;
  if (!response.summary) return false;
  if (!Array.isArray(response.accounts)) return false;
  return true;
}

// ── Fiscal periods (PC-07: four states, LOCKED terminal, no unlock) ──────────

export const FISCAL_PERIOD_STATUSES: readonly FiscalPeriodStatus[] = [
  "DRAFT",
  "OPEN",
  "CLOSED",
  "LOCKED",
];

export const FISCAL_PERIOD_STATUS_META: Record<
  FiscalPeriodStatus,
  { label: string; tone: "neutral" | "info" | "success" | "warning"; description: string }
> = {
  DRAFT: {
    label: "Draft",
    tone: "neutral",
    description: "Created but not opened. Periods are created DRAFT, not OPEN.",
  },
  OPEN: { label: "Open", tone: "success", description: "Accepting postings." },
  CLOSED: { label: "Closed", tone: "warning", description: "Closed to postings; can still be locked." },
  LOCKED: {
    label: "Locked",
    tone: "info",
    description: "Terminal. This backend has no unlock route.",
  },
};

export function toFiscalPeriodStatus(value: string | null | undefined): FiscalPeriodStatus | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return (FISCAL_PERIOD_STATUSES as readonly string[]).includes(upper)
    ? (upper as FiscalPeriodStatus)
    : null;
}

/**
 * The period whose window contains `now`.
 *
 * Deliberately NOT "the first OPEN one" and NOT "the newest row": the demo
 * dataset carries three simultaneously-OPEN periods (a quarter and two months),
 * so either shortcut would show a period that is not the current one. A row with
 * an unreadable window is skipped rather than guessed into range, and when
 * several windows contain `now` the SHORTEST wins — a month is a more specific
 * answer than the quarter that contains it.
 */
export function currentFiscalPeriod(
  periods: readonly FiscalPeriodRow[] | undefined,
  now: number,
): FiscalPeriodRow | null {
  if (!periods?.length) return null;

  let best: FiscalPeriodRow | null = null;
  let bestSpan = Number.POSITIVE_INFINITY;

  for (const period of periods) {
    const start = period.startsAt ? new Date(period.startsAt).getTime() : NaN;
    const end = period.endsAt ? new Date(period.endsAt).getTime() : NaN;
    if (Number.isNaN(start) || Number.isNaN(end)) continue;
    if (now < start || now > end) continue;
    const span = end - start;
    if (span < bestSpan) {
      bestSpan = span;
      best = period;
    }
  }

  return best;
}

export function countPeriodsByStatus(
  periods: readonly FiscalPeriodRow[] | undefined,
  status: FiscalPeriodStatus,
) {
  if (!periods) return null;
  return periods.filter((period) => toFiscalPeriodStatus(period.status) === status).length;
}

// ── Bank reconciliation ─────────────────────────────────────────────────────

/** `OPEN` and `IN_PROGRESS` are the two live-verified "still being worked" states. */
export const ACTIVE_RECONCILIATION_STATUSES = ["OPEN", "IN_PROGRESS"] as const;

export function countActiveReconciliations(rows: readonly BankReconciliationRow[] | undefined) {
  if (!rows) return null;
  return rows.filter((row) =>
    (ACTIVE_RECONCILIATION_STATUSES as readonly string[]).includes((row.status || "").toUpperCase()),
  ).length;
}

// ── PC-06: bare-array lists have no server total ────────────────────────────

/**
 * The truthful label for a bare-array read.
 *
 * PC-06: ten accounting list routes return a bare JSON array with **no `total`
 * and no server-side pagination**. The array IS the complete result set, so its
 * length is an exact count — but it is a CLIENT count, and B4-D1's rule stands:
 * never present a page length as a server total. This wording is the compromise
 * the owner ruled on: fetch it all, count it honestly, say which kind of count
 * it is.
 */
export function unpaginatedCountLabel(count: number | null, noun: string) {
  if (count === null) return `${noun} unavailable`;
  return `Showing all ${new Intl.NumberFormat("en-US").format(count)} ${noun}`;
}

// ── KPI → verified field → drill-in registry ────────────────────────────────

/**
 * The B5 analogue of `MANAGER_KPI_BINDINGS` (B2).
 *
 * Every figure rendered anywhere in the Accounting module must be declared here
 * with the registry route it comes from, the exact response field, and a
 * drill-in target. `getAccountingKpi` THROWS on an unregistered key, so a figure
 * with no verified backing cannot reach the screen even by accident.
 *
 * `drillIn: null` is permitted only with a `noDrillInReason`. In B5.1 that is
 * every KPI, and the reason is always the same shape: the owning list surface
 * has not shipped yet, and a link to a route that does not exist would be a
 * fake affordance. Those become real links as each sub-phase lands.
 */
export type AccountingKpiBinding = {
  key: string;
  label: string;
  /** Key into `ACCOUNTING_ROUTE_REGISTRY`. */
  routeKey: string;
  field: string;
  drillIn: string | null;
  noDrillInReason?: string;
  note?: string;
};

const NOT_YET = (subphase: string, surface: string) =>
  `${surface} has not shipped yet — it arrives in ${subphase}. A link to a route that does not exist would be a fake affordance.`;

export const ACCOUNTING_KPI_BINDINGS: readonly AccountingKpiBinding[] = [
  // Customers (AR)
  {
    key: "ar.outstanding",
    label: "Owed by customers",
    routeKey: "ar.aging",
    field: "summary.totalOutstanding",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.6", "Aged receivable"),
    note: "Withheld entirely when `isArAgingComplete()` is false — B5-F1: the summary covers the returned page, not the branch.",
  },
  {
    key: "ar.openInvoices",
    label: "Open invoices",
    routeKey: "ar.aging",
    field: "total",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.2", "Customer invoices"),
    note: "The endpoint's own count of ISSUED/PARTIALLY_PAID invoices with a positive balance — a server total, not a page length.",
  },
  {
    key: "ar.customers",
    label: "Customers with a balance",
    routeKey: "ar.aging",
    field: "accounts[].length",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.2", "Customer accounts"),
    note: "A grouping of the returned page, so it is only shown when the page is complete.",
  },
  {
    key: "ar.overdue",
    label: "Overdue",
    routeKey: "ar.aging",
    field: "summary.bucket_1_30 + bucket_31_60 + bucket_61_90 + bucket_90_plus",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.6", "Aged receivable"),
  },
  {
    key: "ar.buckets",
    label: "Receivable aging",
    routeKey: "ar.aging",
    field: "summary.current / bucket_1_30 / bucket_31_60 / bucket_61_90 / bucket_90_plus",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.6", "Aged receivable"),
    note: "A real categorical series the endpoint itself computes — the one honest chart on this dashboard.",
  },

  // Vendors (AP)
  {
    key: "ap.outstanding",
    label: "Owed to suppliers",
    routeKey: "ap.aging",
    field: "buckets.total",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.6", "Aged payable"),
    note: "UNPAGED endpoint, so this is the branch total with no completeness caveat — unlike AR (B5-F1).",
  },
  {
    key: "ap.openBills",
    label: "Open bills",
    routeKey: "ap.aging",
    field: "billCount",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.2", "Vendor bills"),
  },
  {
    key: "ap.overdue",
    label: "Overdue",
    routeKey: "ap.aging",
    field: "buckets.days1to30 + days31to60 + days61to90 + days90plus",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.6", "Aged payable"),
  },
  {
    key: "ap.topSupplier",
    label: "Largest supplier balance",
    routeKey: "ap.aging",
    field: "bySupplier[0].supplierName / bySupplier[0].total",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.2", "Suppliers"),
  },
  {
    key: "ap.buckets",
    label: "Payable aging",
    routeKey: "ap.aging",
    field: "buckets.current / days1to30 / days31to60 / days61to90 / days90plus",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.6", "Aged payable"),
  },

  // Ledger
  {
    key: "ledger.journals",
    label: "Journal entries in this branch",
    routeKey: "accounting.journals",
    field: "total",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.4", "Journal entries"),
    note: "Read-only for Manager: journals:create / reverse and posting:replay are 403 (B0 §3.4).",
  },
  {
    key: "ledger.postingRuns",
    label: "Posting runs recorded",
    routeKey: "accounting.postingRuns",
    field: "total",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.4", "Posting runs"),
  },
  {
    key: "ledger.postingErrors",
    label: "Posting errors outstanding",
    routeKey: "accounting.postingErrors",
    field: "total",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.4", "Posting errors"),
  },

  // Bank
  {
    key: "bank.activeReconciliations",
    label: "Reconciliations in progress",
    routeKey: "bank.reconciliations",
    field: "[].status in (OPEN, IN_PROGRESS)",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.3", "The reconciliation workbench"),
    note: "PC-06: a bare array with no server total, so this is an exact CLIENT count of the complete result set, labelled as such.",
  },
  {
    key: "bank.reconciliations",
    label: "Reconciliations on file",
    routeKey: "bank.reconciliations",
    field: "[].length",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.3", "The reconciliation workbench"),
  },
  {
    key: "bank.accounts",
    label: "Bank accounts on file",
    routeKey: "bank.accounts",
    field: "[].length",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.3", "Bank accounts"),
  },

  // Closing
  {
    key: "period.current",
    label: "Current fiscal period",
    routeKey: "accounting.periods",
    field: "[] where startsAt <= now <= endsAt (narrowest window)",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.5", "Fiscal periods"),
    note: "ORGANISATION data — FiscalPeriod has no branch_id column (batch 2). PC-07: DRAFT → OPEN → CLOSED → LOCKED, LOCKED terminal.",
  },
  {
    key: "period.open",
    label: "Periods open",
    routeKey: "accounting.periods",
    field: "[].status === OPEN",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.5", "Fiscal periods"),
  },
  {
    key: "period.closeRuns",
    label: "Period close runs recorded",
    routeKey: "accounting.periodCloseRuns",
    field: "[].length",
    drillIn: null,
    noDrillInReason: NOT_YET("B5.5", "Period close runs"),
    note: "ORGANISATION data — PeriodCloseRun.branchId is nullable and the close path never stamps it (batch 2).",
  },
];

const kpiByKey = new Map(ACCOUNTING_KPI_BINDINGS.map((binding) => [binding.key, binding]));

export function getAccountingKpi(key: string): AccountingKpiBinding {
  const binding = kpiByKey.get(key);
  if (!binding) {
    throw new Error(
      `Accounting KPI "${key}" is not registered in ACCOUNTING_KPI_BINDINGS — every rendered figure must declare its verified endpoint field and drill-in target.`,
    );
  }
  return binding;
}

/** Resolves a KPI's backing route entry — throws if the routeKey is not in the registry. */
export function getAccountingKpiRoute(key: string) {
  return getAccountingRoute(getAccountingKpi(key).routeKey);
}
