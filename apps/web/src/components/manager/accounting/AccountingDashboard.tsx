import { AccountingBankCard } from "@/components/manager/accounting/cards/AccountingBankCard";
import { AccountingLedgerCard } from "@/components/manager/accounting/cards/AccountingLedgerCard";
import { AccountingPayableCard } from "@/components/manager/accounting/cards/AccountingPayableCard";
import { AccountingPeriodCard } from "@/components/manager/accounting/cards/AccountingPeriodCard";
import { AccountingReceivableCard } from "@/components/manager/accounting/cards/AccountingReceivableCard";
import { AccountingDeniedWritesPanel } from "@/components/manager/accounting/shared";
import { ManagerContentShell, ManagerControlPanel } from "@/components/manager/chrome";
import { Badge, EmptyState } from "@/components/ui";
import { ACCOUNTING_POLL_MS, useAccountingDashboard } from "@/lib/manager/accounting-context";

/**
 * Accounting dashboard — Track B5.1, the module's landing surface.
 *
 * Composition is the Odoo Accounting Dashboard (`02-accounting-dashboard.jpg`,
 * `16-zoom-kpi-card-palette.png`): the B1 control-panel row, then a grid of
 * cards with a coloured left accent bar, each carrying a money or status
 * headline, two or three secondary rows, and either a bar mark or nothing.
 * Nimbus reuses the **B2 card shell unforked** — `ManagerDashboardCard` — rather
 * than growing a second card component, and supplies its own registry-bound
 * figure primitives so the accounting module keeps its own KPI contract (OD-2).
 *
 * ── WHAT ODOO SHOWS AND THIS DOES NOT ────────────────────────────────────────
 *
 * Odoo's six cards are Sales, Purchases, Bank, Petty Cash, Tax Returns and
 * Salaries, each with `New` / `Upload` / `Transactions` buttons. Nimbus ships
 * **five** cards and **zero buttons**:
 *
 * - **Salaries** — payroll is a locked exclusion; compensation is neither
 *   fetched nor rendered (FU-1 revoked `pos:hr:compensation:read` from Manager).
 * - **Petty Cash** — no petty-cash ledger exists.
 * - **Budget vs actuals** — the owner's brief listed it as a candidate. It is
 *   OMITTED: `GET /api/finance/budgets` returns `[]` on a fully seeded and
 *   demo-imported database in **both** probed branches, so no figure on it could
 *   be verified live. The route is verified reachable and carries a B5.6 menu
 *   row; a card would have been an empty box implying a capability nobody could
 *   confirm. Same reasoning retired a demand-calendar card.
 * - **Every write button** — Manager holds 15 accounting read strings and zero
 *   writes (PC-01/PC-02, re-verified live: 5/5 representative writes → 403).
 *   Per the owner's ruling no write affordance renders, not even disabled; the
 *   panel at the foot names each action instead.
 *
 * **Polled, never streamed** — there is no SSE reader in this app (MP0-07 /
 * NG-14 → Track C-04) — and deliberately slower than Overview's 60s, because
 * accounting balances move on a document cadence rather than a service one.
 */
export function AccountingDashboard() {
  const snapshot = useAccountingDashboard();
  const pollMinutes = Math.round(ACCOUNTING_POLL_MS / 60_000);

  return (
    <ManagerContentShell>
      <ManagerControlPanel
        title="Accounting"
        badge={<Badge variant="neutral">Branch: {snapshot.branchName}</Badge>}
      />

      <div
        className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary"
        data-accounting-dashboard-status
      >
        <span>
          Read-only accounting overview for{" "}
          <span className="font-semibold text-text-primary">{snapshot.branchName}</span>.
        </span>
        <span>Refreshes every {pollMinutes} minutes while this page is open.</span>
        <span data-accounting-stream-state="degraded">
          Live stream unavailable — showing the latest fetched data.
        </span>
      </div>

      {!snapshot.isEnabled ? (
        <EmptyState
          title="Select a branch to load the accounting overview"
          description="Receivable, payable, ledger and bank figures are scoped to one branch. Choose one in the top bar and the cards will load for it. Fiscal periods stay organisation-wide."
        />
      ) : (
        <div
          className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          data-accounting-dashboard-grid
        >
          <AccountingReceivableCard snapshot={snapshot} />
          <AccountingPayableCard snapshot={snapshot} />
          <AccountingLedgerCard snapshot={snapshot} />
          <AccountingBankCard snapshot={snapshot} />
          <AccountingPeriodCard snapshot={snapshot} />
        </div>
      )}

      <AccountingDeniedWritesPanel />
    </ManagerContentShell>
  );
}
