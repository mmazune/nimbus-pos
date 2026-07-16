import { Prohibit } from "@phosphor-icons/react";

const rows = [
  { label: "Paid In", status: "Deferred" },
  { label: "Paid Out", status: "Deferred" },
  { label: "Pickup", status: "Deferred" },
];

export function CashierDeferredCashMovements() {
  return (
    <section className="rounded-lg bg-surface p-5 shadow-subtle" aria-labelledby="cashier-deferred-cash-title">
      <div className="flex items-start gap-3">
        <Prohibit size={22} weight="bold" className="shrink-0 text-status-neutral" aria-hidden />
        <div>
          <h2 id="cashier-deferred-cash-title" className="text-lg font-bold text-text-primary">
            Other Cash Movements
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            No verified API route exists yet. These actions remain hidden from cashier operations.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {rows.map((row) => (
          <div key={row.label} className="rounded-md bg-surface-muted p-4">
            <p className="text-sm font-bold text-text-primary">{row.label}</p>
            <p className="mt-1 text-sm font-semibold text-text-muted">{row.status}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
