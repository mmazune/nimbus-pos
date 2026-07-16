import { UserSwitch } from "@phosphor-icons/react";

import { Badge } from "@/components/ui";

export function CashierTransferServerPanel() {
  return (
    <section className="rounded-md bg-surface p-3 shadow-subtle" aria-labelledby="cashier-transfer-server-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserSwitch size={20} weight="bold" className="text-brand-navy-900" aria-hidden />
          <h5 id="cashier-transfer-server-title" className="font-bold text-text-primary">
            Transfer server
          </h5>
        </div>
        <Badge variant="warning">Deferred</Badge>
      </div>
      <p className="mt-2 text-sm font-medium text-text-secondary">
        Transfer server requires a verified cashier-safe staff selector. No safe staff-list endpoint is exposed for this
        surface, so the action is intentionally disabled.
      </p>
    </section>
  );
}
