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

// ── Bank — Track B5.3 ───────────────────────────────────────────────────────
// Live-verified against `bank-rec.service.ts` (raw Prisma `BankAccount` /
// `BankStatement` / `BankStatementLine` / `BankReconciliation` models — none
// of these routes apply a Prisma `select`, so every scalar column on the
// model is on the wire). B5.1's `BankAccountRow` carried a `currentBalance`
// field that does not exist anywhere in the schema — it was never rendered
// (the card showed only a count), so the drift went unnoticed; corrected here
// now that this pass actually reads the row.

/** `BankStatementStatus` (Prisma enum). */
export const BANK_STATEMENT_STATUSES = ["PENDING", "IMPORTED", "RECONCILED", "VOIDED"] as const;
export type BankStatementStatus = (typeof BANK_STATEMENT_STATUSES)[number];

/** `BankReconciliationStatus` (Prisma enum). */
export const BANK_RECONCILIATION_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "DISPUTED"] as const;
export type BankReconciliationStatus = (typeof BANK_RECONCILIATION_STATUSES)[number];

/** `BankStatementLineStatus` (Prisma enum). */
export const BANK_STATEMENT_LINE_STATUSES = ["UNMATCHED", "MATCHED", "SKIPPED"] as const;
export type BankStatementLineStatus = (typeof BANK_STATEMENT_LINE_STATUSES)[number];

/** `JournalLineDirection` (Prisma enum) — reused for statement-line direction. */
export const BANK_LINE_DIRECTIONS = ["DEBIT", "CREDIT"] as const;
export type BankLineDirection = (typeof BANK_LINE_DIRECTIONS)[number];

/** `GET /accounting/bank-accounts` row — raw `BankAccount`, no `include`. */
export type BankAccountRow = {
  id: string;
  name: string;
  accountCode?: string | null;
  bankName?: string | null;
  currencyCode?: string | null;
  glAccountId?: string | null;
  isActive?: boolean | null;
  notes?: string | null;
};

export type BankStatementLineRow = {
  id: string;
  txDate?: string | null;
  description?: string | null;
  amount?: AccountingDecimal;
  direction?: string | null;
  reference?: string | null;
  status?: string | null;
  matchedJournalLineId?: string | null;
  matchedManualEntryId?: string | null;
  matchedAt?: string | null;
  matchedById?: string | null;
};

/** `GET /bank-statements` row — `include: { bankAccount, importedBy, _count.lines }`. */
export type BankStatementRow = {
  id: string;
  statementDate?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  openingBalance?: AccountingDecimal;
  closingBalance?: AccountingDecimal;
  status?: string | null;
  reference?: string | null;
  notes?: string | null;
  bankAccountId?: string | null;
  bankAccount?: { id: string; name: string; accountCode?: string | null } | null;
  importedBy?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  _count?: { lines?: number };
};

/** `GET /bank-statements/:id` — the list include plus the full `lines[]`. */
export type BankStatementDetail = BankStatementRow & {
  lines?: BankStatementLineRow[];
};

/**
 * `GET /reconciliation` row — `include: { bankAccount, bankStatement (narrow),
 * fiscalPeriod, startedBy, completedBy }`. The list route does NOT compute
 * `difference` (only `getReconciliation` does); a list row's own
 * `statementBalance`/`matchedTotal` are still real, just not pre-subtracted.
 */
export type BankReconciliationRow = {
  id: string;
  status?: string | null;
  statementBalance?: AccountingDecimal;
  matchedTotal?: AccountingDecimal;
  unmatchedCount?: number | null;
  matchedCount?: number | null;
  notes?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  bankAccount?: { id: string; name: string; accountCode?: string | null } | null;
  bankStatement?: { id: string; reference?: string | null; closingBalance?: AccountingDecimal } | null;
  fiscalPeriod?: { id: string; name?: string | null; startsAt?: string | null; endsAt?: string | null } | null;
  startedBy?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  completedBy?: { id: string; firstName?: string | null; lastName?: string | null } | null;
};

/**
 * `GET /reconciliation/:id` — the list include's `bankStatement` widens to the
 * full statement + its `lines[]` (the per-line match state the workbench
 * shows), and the service appends a computed `difference` string
 * (`statementBalance - matchedTotal`, `toFixed(2)`) not present on the raw row.
 */
export type BankReconciliationDetail = BankReconciliationRow & {
  bankStatement?: (BankStatementDetail & { reference?: string | null; closingBalance?: AccountingDecimal }) | null;
  difference?: AccountingDecimal;
};

// ── Fiscal periods — Track B5.5 ─────────────────────────────────────────────
// `AccountingService.listFiscalPeriods()` runs a plain `findMany({ where: { orgId } })`
// with no `select` and no `include` — every scalar column on `FiscalPeriod` is on
// the wire, but the `openedBy`/`closedBy`/`lockedBy` RELATIONS are never included,
// so only the raw `*ById` ids are available, never a display name (live-verified
// 2026-08-21 on the isolated B5.5 QA stack).
export type FiscalPeriodStatus = "DRAFT" | "OPEN" | "CLOSED" | "LOCKED";

export type FiscalPeriodRow = {
  id: string;
  name: string;
  startsAt?: string | null;
  endsAt?: string | null;
  status?: string | null;
  openedAt?: string | null;
  openedById?: string | null;
  closedAt?: string | null;
  closedById?: string | null;
  lockedAt?: string | null;
  lockedById?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

/** `PeriodCloseRunStatus` (Prisma enum). `FAILED` and `PENDING` are unreachable through the live
 * API — see B5.5-F1 in `ai/ENTERPRISE_B5_5_CLOSING_COMPLETION_REPORT.md`: `closeFiscalPeriod()`
 * always creates the run as `COMPLETED` inside its own transaction, or throws BEFORE any run row
 * is created at all — there is no code path that persists `PENDING` or `FAILED`. */
export const PERIOD_CLOSE_RUN_STATUSES = ["PENDING", "COMPLETED", "FAILED"] as const;
export type PeriodCloseRunStatus = (typeof PERIOD_CLOSE_RUN_STATUSES)[number];

export type PeriodCloseRunRow = {
  id: string;
  status?: string | null;
  closedAt?: string | null;
  retainedEarningsAmount?: AccountingDecimal;
  incomeTotal?: AccountingDecimal;
  expenseTotal?: AccountingDecimal;
  failureReason?: string | null;
  notes?: string | null;
  closedBy?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  fiscalPeriod?: { id: string; name?: string | null; startsAt?: string | null; endsAt?: string | null } | null;
};

// ── Ledger — Track B5.4 ──────────────────────────────────────────────────────
// Live-verified against `ledger.service.ts` (raw `JournalEntry` / `JournalLine`
// / `PostingRun` / `PostingError` models — none of these routes apply a Prisma
// `select`, so every scalar column on the model is on the wire, matching the
// Bank precedent in B5.3).

/** `JournalStatus` (Prisma enum). Journals are always created POSTED by this API — DRAFT is a schema default never reached through `createJournal`. */
export const JOURNAL_STATUSES = ["DRAFT", "POSTED", "REVERSED"] as const;
export type JournalStatus = (typeof JOURNAL_STATUSES)[number];

/** `PostingRunStatus` (Prisma enum). */
export const POSTING_RUN_STATUSES = ["PENDING", "SUCCEEDED", "FAILED", "PARTIAL"] as const;
export type PostingRunStatus = (typeof POSTING_RUN_STATUSES)[number];

/** `PostingErrorStatus` (Prisma enum) — batch 3 `@IsEnum` on `posting-errors?status=`. */
export const POSTING_ERROR_STATUSES = ["OPEN", "RESOLVED", "DISMISSED"] as const;
export type PostingErrorStatus = (typeof POSTING_ERROR_STATUSES)[number];

export type JournalLineRow = {
  id: string;
  accountId?: string | null;
  costCenterId?: string | null;
  direction?: string | null;
  amount?: AccountingDecimal;
  description?: string | null;
  account?: { id: string; code?: string | null; name: string; accountType?: string | null } | null;
  costCenter?: { id: string; code?: string | null; name: string } | null;
};

/** `GET /accounting/journals` row — `include: { lines: { account, costCenter } }`. */
export type JournalRow = {
  id: string;
  journalNumber?: string | null;
  journalDate?: string | null;
  status?: string | null;
  sourceKey?: string | null;
  sourceDocumentId?: string | null;
  reference?: string | null;
  description?: string | null;
  fiscalPeriodId?: string | null;
  /**
   * ⚠️ C-25 (found by this pass, NOT in batch 2/3): `getJournal` resolves by
   * `{id, orgId}` alone — no branch predicate at all, unlike every other
   * accounting detail route. `listJournals` DOES filter by `branchId` (though
   * with the BGB3-L3 strict-equality-on-nullable-column defect batch 3
   * recorded and deliberately left unfixed), so a journal id copied from one
   * branch's list is still readable by the SAME id when the active branch
   * header names a different branch. The frontend fails safe: detail
   * rendering compares this field against the active branch and refuses to
   * show a mismatch (`isJournalReadableInBranch` in `model.ts`) rather than
   * relying on the backend to have refused first.
   */
  branchId?: string | null;
  totalDebit?: AccountingDecimal;
  totalCredit?: AccountingDecimal;
  postedAt?: string | null;
  lines?: JournalLineRow[];
};

/**
 * `GET /accounting/journals/:id` — adds the reversal linkage, who posted it,
 * and the fiscal period it landed in.
 */
export type JournalDetail = JournalRow & {
  reversedFrom?: { id: string; journalNumber?: string | null } | null;
  reversalEntry?: { id: string; journalNumber?: string | null } | null;
  postedBy?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  fiscalPeriod?: { id: string; name?: string | null; status?: string | null } | null;
};

/** `GET /accounting/posting-runs` row — `include: { journalEntry }`. No detail route exists. */
export type PostingRunRow = {
  id: string;
  sourceKey?: string | null;
  sourceDocumentId?: string | null;
  status?: string | null;
  runKey?: string | null;
  errorCount?: number | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string | null;
  journalEntry?: { id: string; journalNumber?: string | null; status?: string | null } | null;
};

/** `GET /accounting/posting-errors` row — `include: { postingRun (narrow) }`. */
export type PostingErrorRow = {
  id: string;
  sourceKey?: string | null;
  sourceDocumentId?: string | null;
  status?: string | null;
  code?: string | null;
  message?: string | null;
  createdAt?: string | null;
  postingRun?: { id: string; sourceKey?: string | null; status?: string | null } | null;
};

/** `GET /accounting/posting-errors/:id` — the list include's `postingRun` widens to add `sourceDocumentId`/`runKey`, plus the full `details` JSON. */
export type PostingErrorDetail = PostingErrorRow & {
  details?: unknown;
  postingRun?: {
    id: string;
    sourceKey?: string | null;
    sourceDocumentId?: string | null;
    status?: string | null;
    runKey?: string | null;
  } | null;
};

// ── Review: Audit trail — Track B5.4 ────────────────────────────────────────
// `GET /api/audit/timeline` (BG2, reused). ⚠️ Different envelope shape from
// every other accounting list: `page`/`pageSize`, not `skip`/`take`, and the
// response has no `skip`/`take` fields at all.

export type AuditTimelineItem = {
  id: string;
  timestamp?: string | null;
  action?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  orgId?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  summary?: string | null;
  sourceModule?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadataPreview?: Record<string, unknown>;
};

export type AuditTimelineResponse = {
  data?: AuditTimelineItem[];
  total?: number;
  page?: number;
  pageSize?: number;
};

/**
 * The audit endpoint's `entityType` filter is an unvalidated free string
 * server-side (no `@IsEnum`) — these three are the exact literals
 * `ledger.service.ts` writes (`entityType: 'JournalEntry' | 'PostingRun' |
 * 'PostingError'`), verified by reading the source, not guessed. Offering a
 * filter with any other value would be a hand-typed string with no verified
 * backing — the same B5-F2-shaped risk an unvalidated filter always carries,
 * even where the SERVER itself does not enforce an enum.
 */
export const AUDIT_ENTITY_TYPES = ["JournalEntry", "PostingRun", "PostingError"] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

// ── Customers (AR) — Track B5.2 ─────────────────────────────────────────────
// Live-verified against `accounts-receivable.service.ts` post backend gap
// batch 3 (commit 5bdcce3, 2026-08-21). No contract-shape change in that
// batch, only validation/bounds — these mirror what the service actually
// `include`s and returns.

/** `InvoiceStatus` (Prisma enum) — the ONLY values `?status=` accepts (batch 3 `@IsEnum`). */
export const AR_INVOICE_STATUSES = [
  "DRAFT",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
  "CREDIT_ADJUSTED",
] as const;
export type ArInvoiceStatus = (typeof AR_INVOICE_STATUSES)[number];

/** `ArCreditNoteStatus` (Prisma enum) — batch 3 `@IsEnum` on `ar/credit-notes?status=`. */
export const AR_CREDIT_NOTE_STATUSES = ["OPEN", "PARTIALLY_APPLIED", "FULLY_APPLIED", "VOID"] as const;
export type ArCreditNoteStatus = (typeof AR_CREDIT_NOTE_STATUSES)[number];

export const AR_ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
export type ArAccountStatus = (typeof AR_ACCOUNT_STATUSES)[number];

export const AR_ACCOUNT_TYPES = ["CORPORATE", "HOUSE", "INDIVIDUAL"] as const;
export type ArAccountType = (typeof AR_ACCOUNT_TYPES)[number];

export type ArInvoiceLine = {
  id: string;
  description?: string | null;
  quantity?: AccountingDecimal;
  unitPrice?: AccountingDecimal;
  lineTotal?: AccountingDecimal;
};

/** `GET /ar/invoices` row — `include: { customerAccount, lines, _count.receiptAllocs }`. */
export type ArInvoiceRow = {
  id: string;
  invoiceNumber?: string | null;
  status?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  totalAmount?: AccountingDecimal;
  outstandingBalance?: AccountingDecimal;
  currencyCode?: string | null;
  customerAccount?: { id: string; name: string; code?: string | null; type?: string | null } | null;
  lines?: ArInvoiceLine[];
  _count?: { receiptAllocs?: number };
};

/** `GET /ar/invoices/:id` — the richer detail include (full account + receipt history). */
export type ArInvoiceDetail = ArInvoiceRow & {
  customerAccount?: {
    id: string;
    name: string;
    code?: string | null;
    type?: string | null;
    status?: string | null;
  } | null;
  issuedBy?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  receiptAllocs?: Array<{
    id?: string;
    receipt?: {
      id: string;
      receiptNumber?: string | null;
      receiptDate?: string | null;
      amount?: AccountingDecimal;
      status?: string | null;
      paymentMethod?: string | null;
    } | null;
  }>;
};

/** `GET /ar/accounts` row — `include: { _count.invoices }`. */
export type ArAccountRow = {
  id: string;
  name: string;
  code?: string | null;
  type?: string | null;
  status?: string | null;
  creditLimit?: AccountingDecimal;
  currencyCode?: string | null;
  _count?: { invoices?: number };
};

/** `GET /ar/accounts/:id` — `include: { _count: { invoices, receipts, creditNotes } }`. */
export type ArAccountDetail = ArAccountRow & {
  _count?: { invoices?: number; receipts?: number; creditNotes?: number };
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

/** `GET /ar/credit-notes` row. */
export type ArCreditNoteRow = {
  id: string;
  creditNoteNumber?: string | null;
  status?: string | null;
  issueDate?: string | null;
  amount?: AccountingDecimal;
  remainingAmount?: AccountingDecimal;
  currencyCode?: string | null;
  customerAccount?: { id: string; name: string; code?: string | null } | null;
  invoice?: { id: string; invoiceNumber?: string | null; status?: string | null } | null;
};

// ── Vendors (AP) — Track B5.2 ───────────────────────────────────────────────

/** `BillStatusFilterDto` / `VendorBillStatus` — includes OVERDUE, which AR's InvoiceStatus lacks. */
export const AP_BILL_STATUSES = [
  "DRAFT",
  "APPROVED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;
export type ApBillStatus = (typeof AP_BILL_STATUSES)[number];

/** `VendorPaymentStatus` — batch 3 `@IsEnum` on `ap/payments?status=`. */
export const AP_PAYMENT_STATUSES = ["PENDING", "POSTED", "FAILED", "CANCELLED"] as const;
export type ApPaymentStatus = (typeof AP_PAYMENT_STATUSES)[number];

/** `CreditNoteStatus` (AP-side enum, distinct from AR's `ArCreditNoteStatus`). */
export const AP_CREDIT_NOTE_STATUSES = ["OPEN", "PARTIALLY_APPLIED", "FULLY_APPLIED", "VOID"] as const;
export type ApCreditNoteStatus = (typeof AP_CREDIT_NOTE_STATUSES)[number];

/** `CounterpartyTypeDto` — batch 3 `@IsEnum` on `ap/suppliers?counterpartyType=`. */
export const AP_COUNTERPARTY_TYPES = [
  "INVENTORY_SUPPLIER",
  "SERVICE_PROVIDER",
  "UTILITY_PROVIDER",
  "SUBSCRIPTION_VENDOR",
  "CONTRACTOR",
  "FREELANCER",
  "ENTERTAINER",
  "LANDLORD",
  "OTHER",
] as const;
export type ApCounterpartyType = (typeof AP_COUNTERPARTY_TYPES)[number];

export type ApBillLine = {
  id: string;
  description?: string | null;
  quantity?: AccountingDecimal;
  unitPrice?: AccountingDecimal;
  lineTotal?: AccountingDecimal;
};

/** `GET /ap/bills` row — `include: { supplier, lines, _count.paymentAllocs }`. */
export type ApBillRow = {
  id: string;
  billNumber?: string | null;
  status?: string | null;
  billDate?: string | null;
  dueDate?: string | null;
  totalAmount?: AccountingDecimal;
  outstandingAmount?: AccountingDecimal;
  currencyCode?: string | null;
  sourceType?: string | null;
  supplier?: { id: string; name: string; code?: string | null } | null;
  lines?: ApBillLine[];
  _count?: { paymentAllocs?: number };
};

/** `GET /ap/bills/:id` — the richer detail include (supplier contact + payment history). */
export type ApBillDetail = ApBillRow & {
  supplier?: { id: string; name: string; code?: string | null; email?: string | null; phone?: string | null } | null;
  approvedBy?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  paymentAllocs?: Array<{
    id?: string;
    vendorPayment?: {
      id: string;
      paymentNumber?: string | null;
      paymentDate?: string | null;
      amount?: AccountingDecimal;
      status?: string | null;
    } | null;
  }>;
};

/** `GET /ap/suppliers` row — raw `Supplier`, no `include`. */
export type ApSupplierRow = {
  id: string;
  name: string;
  code?: string | null;
  counterpartyType?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  paymentTermDays?: number | null;
  currencyCode?: string | null;
  isActive?: boolean | null;
};

/** `GET /ap/suppliers/:id` — the richest AP detail: `{supplier, summary, recentBills, recentPayments}`. */
export type ApSupplierDetail = {
  supplier: ApSupplierRow & {
    address?: string | null;
    taxId?: string | null;
    bankName?: string | null;
    bankAccountNo?: string | null;
    notes?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  };
  summary: {
    billCount?: number;
    openBillCount?: number;
    paymentCount?: number;
    outstandingTotal?: AccountingDecimal;
    billedTotal?: AccountingDecimal;
    paidTotal?: AccountingDecimal;
    openCreditNoteCount?: number;
    openCreditNoteRemaining?: AccountingDecimal;
    currencyCode?: string | null;
  };
  recentBills: Array<{
    id: string;
    billNumber?: string | null;
    status?: string | null;
    billDate?: string | null;
    dueDate?: string | null;
    totalAmount?: AccountingDecimal;
    outstandingAmount?: AccountingDecimal;
    currencyCode?: string | null;
  }>;
  recentPayments: Array<{
    id: string;
    paymentNumber?: string | null;
    status?: string | null;
    paymentDate?: string | null;
    amount?: AccountingDecimal;
    remainingAmount?: AccountingDecimal;
    currencyCode?: string | null;
    paymentMethod?: string | null;
  }>;
};

/** `GET /ap/credit-notes` row. */
export type ApCreditNoteRow = {
  id: string;
  creditNoteNumber?: string | null;
  status?: string | null;
  issueDate?: string | null;
  amount?: AccountingDecimal;
  remainingAmount?: AccountingDecimal;
  currencyCode?: string | null;
  supplier?: { id: string; name: string } | null;
};

/** `GET /ap/payments` row. */
export type ApPaymentRow = {
  id: string;
  paymentNumber?: string | null;
  status?: string | null;
  paymentDate?: string | null;
  amount?: AccountingDecimal;
  currencyCode?: string | null;
  paymentMethod?: string | null;
  supplier?: { id: string; name: string } | null;
  allocations?: Array<{ id?: string; vendorBill?: { id: string; billNumber?: string | null } | null }>;
};

/** `GET /ap/recurring-profiles` row. */
export type ApRecurringProfileRow = {
  id: string;
  cadence?: string | null;
  isActive?: boolean | null;
  nextDueDate?: string | null;
  amount?: AccountingDecimal;
  currencyCode?: string | null;
  supplier?: { id: string; name: string; code?: string | null } | null;
};

/** `GET /ap/reminders` row. */
export type ApReminderRow = {
  id: string;
  status?: string | null;
  dueDate?: string | null;
  supplier?: { id: string; name: string } | null;
  vendorBill?: { id: string; billNumber?: string | null; totalAmount?: AccountingDecimal; outstandingAmount?: AccountingDecimal } | null;
};

// ── Configuration + Reporting — Track B5.6 (write-enabled) ──────────────────
// Live-verified against `budget.service.ts` / `demand-calendar.service.ts` /
// `forecast.service.ts` / `accounting.service.ts`. Unlike every B5.1–B5.5
// surface, this module IS permitted to write — PERMS-2 (2026-08-21) granted
// Manager the full 36-string `C21_ACCOUNTING_FINANCE_ALL` set plus the widened
// M28/M29 block, matching Accountant/Owner. See `write-api.ts` for the
// mutations; this file stays reads-only in SHAPE (it declares no method).

export const BUDGET_STATUSES = ["DRAFT", "ACTIVE", "FINALIZED", "ARCHIVED"] as const;
export type BudgetStatus = (typeof BUDGET_STATUSES)[number];

export const BUDGET_TYPES = ["OPERATIONAL", "FINANCIAL"] as const;
export type BudgetType = (typeof BUDGET_TYPES)[number];

export type BudgetLineRow = {
  id: string;
  category: string;
  dimension?: string | null;
  accountId?: string | null;
  costCenterId?: string | null;
  budgetAmount?: AccountingDecimal;
  actualAmount?: AccountingDecimal;
  varianceAmount?: AccountingDecimal;
  variancePct?: AccountingDecimal;
  actualsUpdatedAt?: string | null;
};

/**
 * `GET /finance/budgets` row — a PC-06 bare array (`budget.service.ts`'s
 * `listBudgets` is a plain `findMany`, no `{data,total}` wrapper), `include:
 * {fiscalPeriod, createdBy, lines}`. There is no `GET /finance/budgets/:id`
 * response shape distinct from this — `getBudget` returns the identical
 * include, just for one row.
 */
export type BudgetRow = {
  id: string;
  name: string;
  budgetType?: string | null;
  status?: string | null;
  version?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  totalBudget?: AccountingDecimal;
  notes?: string | null;
  fiscalPeriodId?: string | null;
  fiscalPeriod?: { id: string; name?: string | null; startsAt?: string | null; endsAt?: string | null } | null;
  createdBy?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  lines?: BudgetLineRow[];
};

export const DEMAND_CALENDAR_TYPES = [
  "BRUNCH",
  "SPORTS_NIGHT",
  "DJ_NIGHT",
  "PRIVATE_EVENT",
  "HOLIDAY_RUSH",
  "PROMOTION",
  "LARGE_RESERVATION",
  "CUSTOM",
] as const;
export type DemandCalendarType = (typeof DEMAND_CALENDAR_TYPES)[number];

export const DAYPART_TYPES = ["BREAKFAST", "LUNCH", "AFTERNOON", "DINNER", "LATE_NIGHT", "ALL_DAY"] as const;
export type DaypartType = (typeof DAYPART_TYPES)[number];

/** `GET /finance/demand-calendar` row — a PC-06 bare array, `include: {event, createdBy}`. */
export type DemandCalendarEntryRow = {
  id: string;
  calendarType?: string | null;
  daypart?: string | null;
  title: string;
  dateStart?: string | null;
  dateEnd?: string | null;
  expectedCovers?: number | null;
  demandMultiplier?: AccountingDecimal;
  revenueUpliftPct?: AccountingDecimal;
  itemNotes?: string | null;
  notes?: string | null;
  isActive?: boolean | null;
  eventId?: string | null;
  event?: { id: string; title?: string | null; startsAt?: string | null; endsAt?: string | null } | null;
  createdBy?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  updatedBy?: { id: string; firstName?: string | null; lastName?: string | null } | null;
};

export const FORECAST_TYPES = ["BRANCH", "ROLLUP", "FRANCHISE"] as const;
export type ForecastType = (typeof FORECAST_TYPES)[number];

export const FORECAST_HORIZONS = ["TODAY", "THREE_DAY", "SEVEN_DAY"] as const;
export type ForecastHorizon = (typeof FORECAST_HORIZONS)[number];

/** `ForecastRunStatus` (Prisma enum). */
export const FORECAST_RUN_STATUSES = ["PENDING", "RUNNING", "COMPLETED", "FAILED"] as const;
export type ForecastRunStatus = (typeof FORECAST_RUN_STATUSES)[number];

/** A `ProcurementSuggestion` row embedded on a `ForecastRun` (`take: 50`, `status: PENDING` only). No nested `inventoryItem` include on this path — only the scalar columns are on the wire. */
export type ForecastProcurementSuggestionRow = {
  id: string;
  inventoryItemId?: string | null;
  demandCalendarEntryId?: string | null;
  supplierId?: string | null;
  status?: string | null;
  urgency?: string | null;
  daypart?: string | null;
  suggestedQty?: AccountingDecimal;
  projectedUsage?: AccountingDecimal;
  currentStock?: AccountingDecimal;
  inboundStock?: AccountingDecimal;
  safetyStock?: AccountingDecimal;
  leadTimeDays?: number | null;
  estimatedUnitCost?: AccountingDecimal;
  estimatedTotalCost?: AccountingDecimal;
  priority?: number | null;
  rationale?: string | null;
  suggestedAction?: string | null;
};

/**
 * `GET /franchise/forecast` — a single `ForecastRun` object (never a bare
 * array or `{data,total}`). `assumptions`/`demandSignals`/`daypartSummaries`/
 * `outputs` are free-form `Json` columns the service computes — rendered as a
 * structured but generically-typed dump rather than guessed field-by-field,
 * since no DTO governs their internal shape.
 */
export type ForecastRunRow = {
  id: string;
  orgId?: string | null;
  branchId?: string | null;
  fiscalPeriodId?: string | null;
  forecastType?: string | null;
  status?: string | null;
  forecastHorizonStart?: string | null;
  forecastHorizonEnd?: string | null;
  sourceWindowStart?: string | null;
  sourceWindowEnd?: string | null;
  assumptions?: Record<string, unknown> | null;
  demandSignals?: unknown[] | null;
  daypartSummaries?: unknown[] | null;
  outputs?: Record<string, unknown> | null;
  errorMessage?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  procurementSuggestions?: ForecastProcurementSuggestionRow[];
};

/** `AccountType` (Prisma enum) — the chart of accounts. */
export const CHART_ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;
export type ChartAccountType = (typeof CHART_ACCOUNT_TYPES)[number];

/** `AccountStatus` (Prisma enum). No API route ever transitions this — every account created through `POST /accounting/accounts` is stuck at the DB default `ACTIVE`. */
export const CHART_ACCOUNT_STATUSES = ["ACTIVE", "INACTIVE", "SYSTEM_LOCKED"] as const;
export type ChartAccountStatus = (typeof CHART_ACCOUNT_STATUSES)[number];

/**
 * `GET /accounting/accounts` row — `{data, total}` (`data-total-unpaged`:
 * a real server total, no `skip`/`take` echoed back). ORGANISATION data:
 * `listAccounts` filters on `orgId` alone, though `branchId` is still stamped
 * on create.
 */
export type ChartAccountRow = {
  id: string;
  code: string;
  name: string;
  accountType?: string | null;
  status?: string | null;
  parentAccountId?: string | null;
  systemManaged?: boolean | null;
  allowManualPosting?: boolean | null;
  taxRelevant?: boolean | null;
  notes?: string | null;
};

/** `GET /accounting/cost-centers` row — a PC-06 bare array, `where: {active: true}` only, no pagination. ORGANISATION data. */
export type CostCenterRow = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  active?: boolean | null;
};

/**
 * `GET /accounting/posting-source-maps` row — a PC-06 bare array,
 * `include: {debitAccount, creditAccount}`. ORGANISATION data. `sourceKey`
 * is the immutable identity of the row — never part of the update DTO, and
 * there is no create route at all (rows are seed/system-created).
 */
export type PostingSourceMapRow = {
  id: string;
  sourceKey: string;
  debitAccountId?: string | null;
  creditAccountId?: string | null;
  debitAccount?: { id: string; code?: string | null; name: string } | null;
  creditAccount?: { id: string; code?: string | null; name: string } | null;
  costCenterRequired?: boolean | null;
  active?: boolean | null;
  notes?: string | null;
};

/**
 * `GET /accounting/tax-config` — a SINGLETON object, 404 if none configured
 * yet (never an empty array). `PATCH` upserts: updates the existing
 * `active: true` row if one exists, else creates one. ORGANISATION data.
 */
export type TaxLedgerConfigRow = {
  id: string;
  outputTaxAccountId?: string | null;
  inputTaxAccountId?: string | null;
  discountAccountId?: string | null;
  depositLiabilityAccountId?: string | null;
  payrollPayableAccountId?: string | null;
  active?: boolean | null;
  outputTaxAccount?: { id: string; code?: string | null; name: string } | null;
  inputTaxAccount?: { id: string; code?: string | null; name: string } | null;
  discountAccount?: { id: string; code?: string | null; name: string } | null;
  depositLiabilityAccount?: { id: string; code?: string | null; name: string } | null;
  payrollPayableAccount?: { id: string; code?: string | null; name: string } | null;
};
