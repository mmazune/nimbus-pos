/**
 * Wire types for the accounting reads the B5.1 dashboard consumes.
 *
 * These mirror what the API **actually returned** on the 2026-08-21 isolated
 * probe, not what a DTO or a doc says it returns. Money crosses the wire as a
 * Prisma `Decimal` serialised to a STRING, so every amount is typed as
 * `AccountingDecimal` and parsed through `toAccountingAmount`, which fails
 * closed to `null` rather than coercing a missing value to `0`.
 */
export type AccountingDecimal = string | number | null | undefined;

/** `{data, total, skip, take}` — the envelope most AP/AR/ledger lists use. */
export type AccountingListEnvelope<T> = {
  data?: T[];
  total?: number;
  skip?: number;
  take?: number;
};

// ── GET /api/accounting/ap/aging ────────────────────────────────────────────
export type ApAgingBuckets = {
  current?: AccountingDecimal;
  days1to30?: AccountingDecimal;
  days31to60?: AccountingDecimal;
  days61to90?: AccountingDecimal;
  days90plus?: AccountingDecimal;
  total?: AccountingDecimal;
};

export type ApAgingSupplierRow = {
  supplierId: string;
  supplierName: string;
  total?: AccountingDecimal;
} & Partial<ApAgingBuckets>;

export type ApAgingResponse = {
  asOf?: string;
  buckets?: ApAgingBuckets;
  bySupplier?: ApAgingSupplierRow[];
  /** Count of OPEN bills the aggregate covers. The endpoint is UNPAGED, so this is the branch total. */
  billCount?: number;
};

// ── GET /api/accounting/ar/aging ────────────────────────────────────────────
export type ArAgingSummary = {
  current?: AccountingDecimal;
  bucket_1_30?: AccountingDecimal;
  bucket_31_60?: AccountingDecimal;
  bucket_61_90?: AccountingDecimal;
  bucket_90_plus?: AccountingDecimal;
  totalOutstanding?: AccountingDecimal;
};

export type ArAgingAccountRow = {
  customerAccountId: string;
  customerAccountName: string;
  customerAccountCode?: string | null;
  totalOutstanding?: AccountingDecimal;
  invoices?: Array<{ invoiceId: string; outstandingBalance?: AccountingDecimal }>;
};

export type ArAgingResponse = {
  asOf?: string;
  /** Count of OPEN INVOICES matching the whole `where` — not the account count. */
  total?: number;
  skip?: number;
  take?: number;
  /** ⚠️ B5-F1: aggregated over the RETURNED PAGE only. See `isArAgingComplete`. */
  summary?: ArAgingSummary;
  accounts?: ArAgingAccountRow[];
};

// ── Bank ────────────────────────────────────────────────────────────────────
export type BankAccountRow = {
  id: string;
  name?: string | null;
  accountNumber?: string | null;
  currencyCode?: string | null;
  currentBalance?: AccountingDecimal;
};

export type BankReconciliationRow = {
  id: string;
  status?: string | null;
  statementBalance?: AccountingDecimal;
  matchedTotal?: AccountingDecimal;
  difference?: AccountingDecimal;
};

// ── Fiscal periods ──────────────────────────────────────────────────────────
export type FiscalPeriodStatus = "DRAFT" | "OPEN" | "CLOSED" | "LOCKED";

export type FiscalPeriodRow = {
  id: string;
  name: string;
  startsAt?: string | null;
  endsAt?: string | null;
  status?: string | null;
};

export type PeriodCloseRunRow = {
  id: string;
  status?: string | null;
  closedAt?: string | null;
  fiscalPeriod?: { id: string; name?: string | null } | null;
};

// ── Ledger ──────────────────────────────────────────────────────────────────
export type JournalRow = {
  id: string;
  journalNumber?: string | null;
  status?: string | null;
  totalDebit?: AccountingDecimal;
  totalCredit?: AccountingDecimal;
};
