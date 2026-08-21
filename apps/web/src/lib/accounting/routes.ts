/**
 * Accounting module routing — Track B5.1 + B5.2.
 *
 * B5.1 shipped exactly ONE real surface, the dashboard, so the module root
 * redirects to it — the same module-with-redirect pattern `/manager/operations`
 * (B3), `/manager/staff` (B3) and `/manager/reports` (B4) already use.
 *
 * B5.2 adds the Customers (AR) and Vendors (AP) list/detail surfaces plus the
 * two Reporting aging views. The paths for everything still gated (Bank,
 * Journals, Closing, Configuration, the rest of Reporting) are deliberately
 * NOT declared here — a route constant is a promise that something answers at
 * that URL, and the menu tree names those surfaces as honest not-yet rows
 * instead (see `menu.ts`).
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
} as const;

export const ACCOUNTING_LANDING = ACCOUNTING_ROUTES.dashboard;

export function isAccountingRoute(pathname: string) {
  return pathname.startsWith(ACCOUNTING_ROOT);
}
