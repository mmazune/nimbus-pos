import { ACCOUNTING_ROUTES } from "./routes";
import { getAccountingRoute } from "./route-registry";

/**
 * The Accounting menu tree — Track B5.1.
 *
 * Odoo's Accounting module carries **58 leaf items** across
 * `Dashboard · Customers · Vendors · Accounting · Review · Reporting ·
 * Configuration` (`ai/ODOO_REFERENCE_RESEARCH.md` §1.4, screenshots 02/03/04).
 * Nimbus can honestly back a **subset**, and the rule the roadmap sets is
 * absolute: *items Nimbus cannot back are ABSENT, not greyed out.*
 *
 * So there are exactly three states a row can be in, and no fourth:
 *
 * 1. **Available** — a real link to a shipped surface. B5.1 has exactly one:
 *    the dashboard.
 * 2. **Not yet** — Nimbus has a live-verified endpoint for it and a named
 *    sub-phase will build the surface. Rendered inert with the phase tag, the
 *    same honest pattern B1 used for Operations/Staff/Reports/Settings.
 * 3. **Absent** — no backing endpoint, or the endpoint exists but Manager is
 *    403 on it. These are recorded in `ACCOUNTING_OMITTED_ITEMS` with the
 *    reason, so the omission is auditable rather than merely invisible.
 *
 * Every row in states 1 and 2 cites `routeKeys` into
 * `ACCOUNTING_ROUTE_REGISTRY`, and `assertAccountingMenuIsBacked()` below fails
 * loudly if a key is unknown or is a route Manager cannot read. That is the
 * roadmap's B5 acceptance gate — *"every menu item resolves to a verified
 * endpoint; no menu item exists without one"* — made executable.
 */

/**
 * ⚠️ SUB-PHASE RENUMBER, recorded here because the tags below depend on it.
 *
 * `ai/ENTERPRISE_UI_ROADMAP.md` originally scheduled the dashboard LAST
 * (B5.6, "depends on B5.1–B5.5") and the Customers/Vendors lists first. The
 * owner's 2026-08-21 B5.1 brief inverts that: the module shell, menu tree and
 * dashboard ship first so the module has a landing page and a menu before any
 * list exists. Everything else shifts by one:
 *
 * | Tag  | Scope                                    | Was (roadmap) |
 * | B5.1 | module shell + menu tree + dashboard      | B5.6          |
 * | B5.2 | Customers + Vendors lists                 | B5.1          |
 * | B5.3 | Bank reconciliation workbench             | B5.2          |
 * | B5.4 | Accounting core + Review                  | B5.3          |
 * | B5.5 | Closing (fiscal periods)                  | B5.4          |
 * | B5.6 | Reporting + Configuration                 | B5.5          |
 *
 * B5.2 (2026-08-21) also pulled the two Reporting → "Aged receivable" / "Aged
 * payable" rows forward out of B5.6: they cite the SAME `ar.aging`/`ap.aging`
 * routes the B5.1 dashboard cards already read, and the B5.2 brief explicitly
 * scopes "the AR aging view" / "the AP aging view" as deliverables. They stay
 * in the Reporting group (Odoo's own placement) rather than moving under
 * Customers/Vendors. The rest of Reporting (Budgets, Demand calendar,
 * Forecast) is still B5.6.
 *
 * B5.3 (2026-08-21) turns the three Bank rows live — Bank accounts (list-only:
 * the registry has no `bank.account` detail key, matching how B5.2 shipped
 * Credit notes list-only), Bank statements (list + detail, statement header +
 * lines), and Reconciliation (list + detail, the match/skip/complete
 * workbench rendered READ-ONLY — Manager holds no `reconciliation:match`/
 * `:create`, PC-01).
 *
 * B5.4 (2026-08-21) turns FOUR more rows live, and ONLY these four — the exact
 * set `ACCOUNTING_SUBPHASES` already tagged "B5.4" since B5.1: Journal entries
 * (under "Accounting"), and Posting runs / Posting errors / Audit trail (under
 * "Review"). Fiscal periods and Period close runs stay tagged B5.5 (Closing);
 * Chart of accounts, Cost centres, Posting source maps and Tax configuration
 * stay tagged B5.6 (Configuration) — both untouched by this phase. (An
 * operator brief for this phase described fiscal periods/posting-source-maps/
 * tax-config as B5.4 deliverables; this file's own tags, unchanged since
 * B5.1, say otherwise, and the roadmap's own B5.4/B5.5 table rows agree with
 * the tags, not the brief — so the tags win, per CLAUDE.md §19.)
 */
export const ACCOUNTING_SUBPHASES = ["B5.2", "B5.3", "B5.4", "B5.5", "B5.6"] as const;
export type AccountingSubphase = (typeof ACCOUNTING_SUBPHASES)[number];

export type AccountingMenuItem = {
  key: string;
  label: string;
  /** Registry keys backing this item. Never empty. */
  routeKeys: readonly string[];
} & (
  | { available: true; href: string }
  | { available: false; subphase: AccountingSubphase }
);

export type AccountingMenuGroup = {
  heading?: string;
  items: readonly AccountingMenuItem[];
};

export const ACCOUNTING_MENU: readonly AccountingMenuGroup[] = [
  {
    items: [
      {
        key: "accounting-dashboard",
        label: "Dashboard",
        href: ACCOUNTING_ROUTES.dashboard,
        available: true,
        routeKeys: [
          "ar.aging",
          "ap.aging",
          "accounting.journals",
          "accounting.postingRuns",
          "accounting.postingErrors",
          "bank.accounts",
          "bank.reconciliations",
          "accounting.periods",
          "accounting.periodCloseRuns",
        ],
      },
    ],
  },
  {
    heading: "Customers",
    items: [
      {
        key: "accounting-ar-invoices",
        label: "Invoices",
        available: true,
        href: ACCOUNTING_ROUTES.customerInvoices,
        routeKeys: ["ar.invoices", "ar.invoice"],
      },
      {
        key: "accounting-ar-accounts",
        label: "Customer accounts",
        available: true,
        href: ACCOUNTING_ROUTES.customerAccounts,
        routeKeys: ["ar.accounts", "ar.account"],
      },
      {
        key: "accounting-ar-credit-notes",
        label: "Credit notes",
        available: true,
        href: ACCOUNTING_ROUTES.customerCreditNotes,
        routeKeys: ["ar.creditNotes"],
      },
    ],
  },
  {
    heading: "Vendors",
    items: [
      {
        key: "accounting-ap-bills",
        label: "Bills",
        available: true,
        href: ACCOUNTING_ROUTES.vendorBills,
        routeKeys: ["ap.bills", "ap.bill"],
      },
      {
        key: "accounting-ap-payments",
        label: "Payments",
        available: true,
        href: ACCOUNTING_ROUTES.vendorPayments,
        routeKeys: ["ap.payments"],
      },
      {
        key: "accounting-ap-credit-notes",
        label: "Credit notes",
        available: true,
        href: ACCOUNTING_ROUTES.vendorCreditNotes,
        routeKeys: ["ap.creditNotes"],
      },
      {
        key: "accounting-ap-suppliers",
        label: "Suppliers",
        available: true,
        href: ACCOUNTING_ROUTES.vendorSuppliers,
        routeKeys: ["ap.suppliers"],
      },
      {
        key: "accounting-ap-recurring",
        label: "Recurring profiles",
        available: true,
        href: ACCOUNTING_ROUTES.vendorRecurringProfiles,
        routeKeys: ["ap.recurringProfiles"],
      },
      {
        key: "accounting-ap-reminders",
        label: "Payment reminders",
        available: true,
        href: ACCOUNTING_ROUTES.vendorReminders,
        routeKeys: ["ap.reminders"],
      },
    ],
  },
  {
    /**
     * Odoo files reconciliation under `Accounting → Closing`. Nimbus's bank-rec
     * module is 15 routes with its own statement-import and match/skip/complete
     * workbench, which is large enough to deserve its own group — a deliberate
     * adaptation, recorded in the roadmap's own menu table.
     */
    heading: "Bank",
    items: [
      {
        key: "accounting-bank-accounts",
        label: "Bank accounts",
        available: true,
        href: ACCOUNTING_ROUTES.bankAccounts,
        routeKeys: ["bank.accounts"],
      },
      {
        key: "accounting-bank-statements",
        label: "Bank statements",
        available: true,
        href: ACCOUNTING_ROUTES.bankStatements,
        routeKeys: ["bank.statements", "bank.statement"],
      },
      {
        key: "accounting-bank-reconciliation",
        label: "Reconciliation",
        available: true,
        href: ACCOUNTING_ROUTES.bankReconciliation,
        routeKeys: ["bank.reconciliations", "bank.reconciliation"],
      },
    ],
  },
  {
    heading: "Accounting",
    items: [
      {
        key: "accounting-journals",
        label: "Journal entries",
        available: true,
        href: ACCOUNTING_ROUTES.journals,
        routeKeys: ["accounting.journals", "accounting.journal"],
      },
      {
        key: "accounting-periods",
        label: "Fiscal periods",
        available: false,
        subphase: "B5.5",
        routeKeys: ["accounting.periods"],
      },
      {
        key: "accounting-period-close-runs",
        label: "Period close runs",
        available: false,
        subphase: "B5.5",
        routeKeys: ["accounting.periodCloseRuns"],
      },
    ],
  },
  {
    heading: "Review",
    items: [
      {
        key: "accounting-posting-runs",
        label: "Posting runs",
        available: true,
        href: ACCOUNTING_ROUTES.postingRuns,
        routeKeys: ["accounting.postingRuns"],
      },
      {
        key: "accounting-posting-errors",
        label: "Posting errors",
        available: true,
        href: ACCOUNTING_ROUTES.postingErrors,
        routeKeys: ["accounting.postingErrors", "accounting.postingError"],
      },
      {
        key: "accounting-audit-trail",
        label: "Audit trail",
        available: true,
        href: ACCOUNTING_ROUTES.auditTrail,
        routeKeys: ["audit.timeline"],
      },
    ],
  },
  {
    heading: "Reporting",
    items: [
      {
        key: "accounting-aged-receivable",
        label: "Aged receivable",
        available: true,
        href: ACCOUNTING_ROUTES.agedReceivable,
        routeKeys: ["ar.aging"],
      },
      {
        key: "accounting-aged-payable",
        label: "Aged payable",
        available: true,
        href: ACCOUNTING_ROUTES.agedPayable,
        routeKeys: ["ap.aging"],
      },
      {
        key: "accounting-budgets",
        label: "Budgets vs actuals",
        available: false,
        subphase: "B5.6",
        routeKeys: ["finance.budgets"],
      },
      {
        key: "accounting-demand-calendar",
        label: "Demand calendar",
        available: false,
        subphase: "B5.6",
        routeKeys: ["finance.demandCalendar"],
      },
      {
        key: "accounting-forecast",
        label: "Forecast",
        available: false,
        subphase: "B5.6",
        routeKeys: ["franchise.forecast"],
      },
    ],
  },
  {
    heading: "Configuration",
    items: [
      {
        key: "accounting-chart-of-accounts",
        label: "Chart of accounts",
        available: false,
        subphase: "B5.6",
        routeKeys: ["accounting.chartOfAccounts"],
      },
      {
        key: "accounting-cost-centres",
        label: "Cost centres",
        available: false,
        subphase: "B5.6",
        routeKeys: ["accounting.costCenters"],
      },
      {
        key: "accounting-posting-source-maps",
        label: "Posting source maps",
        available: false,
        subphase: "B5.6",
        routeKeys: ["accounting.postingSourceMaps"],
      },
      {
        key: "accounting-tax-config",
        label: "Tax configuration",
        available: false,
        subphase: "B5.6",
        routeKeys: ["accounting.taxConfig"],
      },
    ],
  },
];

/**
 * What Odoo offers that Nimbus deliberately does NOT — with the reason.
 *
 * The roadmap requires every phase to state *"what was deliberately not cloned
 * from the Odoo reference, and why"*. Keeping it as data rather than prose means
 * the completion report's table is generated from the same list the assertion
 * script checks, so the two cannot drift.
 */
export const ACCOUNTING_OMITTED_ITEMS: readonly {
  odooItem: string;
  reason: string;
}[] = [
  {
    odooItem: "Balance Sheet · Profit and Loss · Cash Flow Statement · Trial Balance · General Ledger · Partner Ledger · Tax Report · Fiscal Report · Invoice Analysis · Analytic Report · Executive Summary",
    reason:
      "No financial-statement endpoint exists anywhere in the API — not one of the 112 routes B0 reconciled against the Nest route map produces a statement. NG-07 → Track C-11. A menu row would advertise eleven reports Nimbus cannot generate.",
  },
  {
    odooItem: "Customers → Receipts",
    reason:
      "`/api/accounting/ar/receipts` is **POST-only** — there is no GET, so there is nothing to list. (Manager could not post one either: `accounting:ar:receipt:write` is not held.) The roadmap's own menu table listed Receipts; that was a static-scan artefact and is corrected here.",
  },
  {
    odooItem: "Bank → Manual entries",
    reason: "`/api/accounting/manual-bank-entries` is POST-only; no GET exists to back a list.",
  },
  {
    odooItem: "Reporting → Procurement suggestions",
    reason:
      "Live-verified 403 for Manager. PC-02: `procurement:advisory:read` gates the read AND the mutation `PATCH /procurement-suggestions/:id/review`, so the cutover deliberately granted Manager neither. A not-yet row would promise a surface this role cannot open.",
  },
  {
    odooItem: "Configuration → Currencies · Rounding · Tax matrix · Exchange rates",
    reason:
      "These are `/api/settings/*` organisation settings owned by Track **B6 (Settings)**, and B0 §10 found all seven settings reads are org-scoped and readable by Supervisor too. Listing them inside Accounting would claim a navigation placement B5.1 has no authority to decide.",
  },
  {
    odooItem: "Configuration → Journals-as-config · Fiscal Positions · Multi-Ledger · Checks · Asset Models · Payment Terms · Follow-up Levels · Payment Providers · Payment Methods",
    reason: "No backing model or endpoint exists. NG-17 / NG-19 — deferred backend gaps.",
  },
  {
    odooItem: "Accounting → Assets · Loans · Tax Returns",
    reason: "No asset, loan or tax-return document exists in the schema. NG-17 / NG-19.",
  },
  {
    odooItem: "Review → Working Files · Inventory Valuation · Depreciation Schedule · Loans Analysis · Unrealized Currencies · Deferred Revenues/Expenses · Bill To Receive / Billed Not Received",
    reason: "No backing endpoint. Recorded by the roadmap's own gap table.",
  },
  {
    odooItem: "Dashboard → Salaries card",
    reason: "Payroll is a LOCKED exclusion from the Manager MVP; compensation is not fetched and not rendered (NG-02 / FU-1 — `pos:hr:compensation:read` was revoked from Manager on 2026-08-20).",
  },
  {
    odooItem: "Dashboard → Petty Cash card",
    reason: "Nimbus has no petty-cash ledger. Till floats are a Cashier concept on a different model and would be a different claim.",
  },
  {
    odooItem: "Dashboard → per-journal bar/line charts over time",
    reason:
      "No endpoint returns a bucketed time series (NG-05). The AP/AR aging cards DO carry a bar mark because the aging buckets are a real categorical series the endpoint itself computes — a time trend would have to be invented, so none is drawn.",
  },
  {
    odooItem: "Every New / Upload / Post / Approve / Match / Validate button on the dashboard cards",
    reason:
      "Manager holds 15 accounting read strings and ZERO writes (PC-01/PC-02, re-verified live: 5/5 representative writes → 403). The owner's B5.1 ruling is that no write affordance renders — not even a disabled one. `ACCOUNTING_DENIED_WRITES` names each action in prose instead.",
  },
];

/**
 * The B5 acceptance gate, executable. Throws on the first violation.
 *
 * Called by `scripts/manager-b5-assertions.ts` AND at module scope by the menu
 * adapter, so a malformed tree fails the build rather than shipping a dead link.
 */
export function assertAccountingMenuIsBacked() {
  const seenKeys = new Set<string>();

  for (const group of ACCOUNTING_MENU) {
    for (const item of group.items) {
      if (seenKeys.has(item.key)) {
        throw new Error(`Accounting menu key "${item.key}" is duplicated.`);
      }
      seenKeys.add(item.key);

      if (!item.routeKeys.length) {
        throw new Error(
          `Accounting menu item "${item.key}" cites no endpoint — every item must resolve to a verified route.`,
        );
      }

      for (const routeKey of item.routeKeys) {
        // Throws when the key is unknown to the registry.
        const route = getAccountingRoute(routeKey);
        if (route.manager !== "allowed") {
          throw new Error(
            `Accounting menu item "${item.key}" cites "${routeKey}", which a Manager token cannot read (${route.observed}). Such a surface must be ABSENT, not a not-yet row.`,
          );
        }
      }
    }
  }

  return true;
}

export function accountingMenuItems() {
  return ACCOUNTING_MENU.flatMap((group) => group.items);
}
