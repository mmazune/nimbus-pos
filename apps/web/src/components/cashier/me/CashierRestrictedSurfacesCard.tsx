import { LockKey } from "@phosphor-icons/react";

import { Card } from "@/components/ui";

const restrictedItems = [
  "Manager refund approval",
  "Post-close void execution",
  "Discount approval",
  "Accounting",
  "Reports",
  "Franchise dashboards",
  "Payroll",
  "Staff list",
  "Manager settings",
  "KDS/kitchen state changes",
  "Waiter menu editing",
  "Printer/terminal/device admin",
];

export function CashierRestrictedSurfacesCard() {
  return (
    <Card aria-labelledby="cashier-restricted-title">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-status-warning-surface text-status-warning">
          <LockKey size={22} weight="duotone" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">Role boundary</p>
          <h2 id="cashier-restricted-title" className="text-lg font-bold tracking-normal text-text-primary">
            Restricted Surfaces
          </h2>
        </div>
      </div>
      <ul className="mt-5 grid gap-2">
        {restrictedItems.map((item) => (
          <li key={item} className="flex items-center gap-2 rounded-md bg-surface-muted px-3 py-2 text-sm font-semibold text-text-primary">
            <span className="h-2 w-2 shrink-0 rounded-full bg-status-warning" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}
