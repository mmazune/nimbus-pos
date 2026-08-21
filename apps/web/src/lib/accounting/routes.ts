/**
 * Accounting module routing — Track B5.1 + B5.2.
 *
 * B5.1 shipped exactly ONE real surface, the dashboard, so the module root
 * redirects to it — the same module-with-redirect pattern `/manager/operations`
 * (B3), `/manager/staff` (B3) and `/manager/reports` (B4) already use.
 *
 * B5.2 adds the Customers (AR) and Vendors (AP) list/detail surfaces plus the
 * two Reporting aging views. B5.3 adds the Bank group (accounts, statements,
 * reconciliation). B5.4 adds Journal entries (the "Accounting" heading) plus
 * the Review group (Posting runs, Posting errors, Audit trail). The paths for
 * everything still gated (Closing, Configuration, the rest of Reporting) are
 * deliberately NOT declared here — a route constant is a promise that
 * something answers at that URL, and the menu tree names those surfaces as
 * honest not-yet rows instead (see `menu.ts`).
 */
export const ACCOUNTING_ROOT = "/manager/accounting";

export const ACCOUNTING_ROUTES = {
  dashboard: "/manager/accounting/dashboard",

  // Customers (AR) — Track B5.2
  customerInvoices: "/manager/accounting/customers/invoices",
  customerAccounts: "/manager/accounting/customers/accounts",
  customerCreditNotes: "/manager/accounting/customers/credit-notes",

  // Vendors (AP) — Track B5.2
  vendorBills: "/manager/accounting/vendors/bills",
  vendorSuppliers: "/manager/accounting/vendors/suppliers",
  vendorCreditNotes: "/manager/accounting/vendors/credit-notes",
  vendorPayments: "/manager/accounting/vendors/payments",
  vendorRecurringProfiles: "/manager/accounting/vendors/recurring",
  vendorReminders: "/manager/accounting/vendors/reminders",

  // Reporting — Track B5.2 (Odoo's own placement for these two; see menu.ts)
  agedReceivable: "/manager/accounting/reporting/aged-receivable",
  agedPayable: "/manager/accounting/reporting/aged-payable",

  // Bank — Track B5.3
  bankAccounts: "/manager/accounting/bank/accounts",
  bankStatements: "/manager/accounting/bank/statements",
  bankReconciliation: "/manager/accounting/bank/reconciliation",

  // Accounting core + Review — Track B5.4
  journals: "/manager/accounting/journals",
  postingRuns: "/manager/accounting/review/posting-runs",
  postingErrors: "/manager/accounting/review/posting-errors",
  auditTrail: "/manager/accounting/review/audit-trail",

  // Closing — Track B5.5. Both are list-only: `accounting.controller.ts` /
  // `bank-rec.controller.ts` declare no `GET .../:id` for either entity, the
  // same shape B5.4 found for Posting runs, so there is no detail route to
  // promise here.
  fiscalPeriods: "/manager/accounting/closing/fiscal-periods",
  periodCloseRuns: "/manager/accounting/closing/period-close-runs",
} as const;

export const ACCOUNTING_LANDING = ACCOUNTING_ROUTES.dashboard;

export function isAccountingRoute(pathname: string) {
  return pathname.startsWith(ACCOUNTING_ROOT);
}
