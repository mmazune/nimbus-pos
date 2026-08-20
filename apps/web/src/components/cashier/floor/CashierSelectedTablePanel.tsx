import { OperationalTableStatusBadge } from "@/components/floor/OperationalTableStatusBadge";
import { formatOperationalTableLabel, operationalTableStatusLabels } from "@/components/floor/formatters";
import { operationalIconSizes, operationalIcons } from "@/components/pos-shell/role-icons";
import type { CashierFloorTableViewModel } from "@/lib/cashier/floor-model";

/**
 * Cashier selected-table boundary (Prompt C1).
 *
 * This is the architectural MOUNT POINT that C2 replaces with the canonical
 * settlement / payment / close / receipt workspace. In C1 it is deliberately
 * read-only and truthful:
 *  - it shows the verified table identity and canonical operational status;
 *  - it exposes NO payment, close, split, refund, or receipt action;
 *  - it makes NO claim that a bill was resolved, that the table has no payable
 *    order, or that any balance is zero;
 *  - it uses neutral copy only, never milestone or developer terminology.
 *
 * Privacy: only shared-safe table identity is shown — never guest names,
 * contact details, payment references, or receipt references.
 */

const BackIcon = operationalIcons.back;

export function CashierSelectedTablePanel({
  table,
  onClose,
}: {
  table: CashierFloorTableViewModel;
  onClose: () => void;
}) {
  const statusLabel = operationalTableStatusLabels[table.status];
  const capacityLabel = table.capacity ? `${table.capacity} seats` : "Seat capacity unavailable";

  return (
    <section
      className="grid gap-6"
      aria-label={`Selected table ${table.label} settlement workspace`}
    >
      <button
        type="button"
        className="inline-flex w-fit items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-muted focus-visible:shadow-focus"
        onClick={onClose}
      >
        <BackIcon size={operationalIconSizes.compactAction} weight="bold" aria-hidden />
        Back to Floor
      </button>

      <header className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-normal text-text-primary" title={table.label}>
            {formatOperationalTableLabel(table.label) || table.label}
          </h2>
          <OperationalTableStatusBadge status={table.status} />
        </div>
        <dl className="grid gap-1 text-sm font-semibold text-text-secondary">
          <div className="flex items-center gap-2">
            <dt className="text-text-muted">Status</dt>
            <dd className="tabular-nums text-text-primary">{statusLabel}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-text-muted">Capacity</dt>
            <dd className="tabular-nums text-text-primary">{capacityLabel}</dd>
          </div>
        </dl>
      </header>

      <div
        className="rounded-lg border border-border-subtle bg-surface-muted p-6 text-center"
        role="status"
      >
        <p className="text-base font-semibold text-text-primary">Select a bill to continue.</p>
        <p className="mt-2 text-sm font-medium text-text-secondary">
          Bill settlement, payment, and receipts for this table open here.
        </p>
      </div>
    </section>
  );
}
