/**
 * Branch scoping helpers for the accounting block (backend gap batch 2 — PC-03).
 *
 * ## Why this exists
 *
 * Track B0 (`ai/ACCOUNTING_API_VERIFICATION_REPORT.md` §6) proved live that four
 * accounting reads returned another branch's rows regardless of `X-Branch-Id`,
 * and that several list/detail pairs disagreed about scope. The cause was not a
 * missing feature — every affected Prisma model already carries `branch_id` —
 * it was that the `where` clauses were written with `orgId` alone.
 *
 * The fix is expressed here, once, so that a list and its detail sibling can
 * never drift apart again: both call the same helper with the same context.
 *
 * ## The two rules, and why there are exactly two
 *
 * The rule that applies to a model is decided by that model's schema, not by
 * preference:
 *
 * 1. **`branchId` is NOT NULL** (`BankAccount`, `BankStatement`,
 *    `BankReconciliation`, `ManualBankEntry`) — every row belongs to exactly
 *    one branch and there is no "org-level" row to accommodate. Use
 *    {@link strictBranchScope}.
 *
 * 2. **`branchId` is nullable** (`Supplier`, `VendorBill`, `VendorPayment`,
 *    `CreditNote`, `PayableReminder`, `RecurringBillProfile`,
 *    `CustomerAccount`, `Invoice`, `ArReceipt`, `ArCreditNote`,
 *    `PostingError`, `PeriodCloseRun`) — a row is branch-owned when stamped and
 *    org-level when `NULL`. Use {@link branchOrOrgScope}, which returns the
 *    acting branch's rows **plus** unattributed org-level rows.
 *
 *    Rule 2 is not invented here. It is the repo's established predicate for
 *    nullable-branch models — `OR: [{ branchId }, { branchId: null }]` already
 *    appears in `attendance`, `workforce`, `payroll`, `staff-insights` and
 *    `analytics`. Using strict equality on a nullable column would orphan every
 *    `NULL`-branch row from **every** branch, which is a data-hiding defect
 *    rather than a scoping fix.
 *
 * A model with **no** `branchId` column at all (`FiscalPeriod`,
 * `PostingSourceMap`, `Account`, `TaxLedgerConfig`) is org-level by design.
 * Neither helper applies to it, and no `branchId` may be invented for it — see
 * the per-entity rulings in `ai/BACKEND_GAP_BATCH2_COMPLETION_REPORT.md` §3.
 *
 * ## Fail-closed
 *
 * Both helpers throw when handed an empty branch id rather than silently
 * degrading to an org-wide read. Every consumer sits behind
 * `@RequireBranchContext()`, so `BranchContextGuard` has already rejected a
 * request with no `X-Branch-Id` (400) or a branch the caller is not a member of
 * (403); the throw is a second line of defence, because returning org-wide rows
 * on a missing branch is precisely the failure PC-03 documented.
 */

/** Thrown when a branch-scoped query is built without a resolved branch. */
export class MissingBranchScopeError extends Error {
  constructor(what: string) {
    super(
      `Refusing to build a branch-scoped query for "${what}" without a branch id. ` +
        'This read must not fall back to an organisation-wide result set (PC-03).',
    );
    this.name = 'MissingBranchScopeError';
  }
}

function assertBranchId(branchId: string | null | undefined, what: string): string {
  if (!branchId) throw new MissingBranchScopeError(what);
  return branchId;
}

/**
 * Scope for models whose `branchId` column is **NOT NULL**.
 *
 * Returns rows belonging to the acting branch and nothing else.
 */
export function strictBranchScope(
  branchId: string | null | undefined,
  what = 'branch-owned record',
): { branchId: string } {
  return { branchId: assertBranchId(branchId, what) };
}

/**
 * Scope for models whose `branchId` column is **nullable**.
 *
 * Returns rows belonging to the acting branch, plus org-level rows that are not
 * attributed to any branch (`branchId IS NULL`).
 */
export function branchOrOrgScope(
  branchId: string | null | undefined,
  what = 'branch-scoped record',
): { OR: [{ branchId: string }, { branchId: null }] } {
  const id = assertBranchId(branchId, what);
  return { OR: [{ branchId: id }, { branchId: null }] };
}
