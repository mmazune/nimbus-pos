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
