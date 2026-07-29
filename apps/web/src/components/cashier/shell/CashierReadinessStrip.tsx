import { ClockClockwise, Plugs, Wallet } from "@phosphor-icons/react";

import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import type { CashierReadinessItem, CashierReadinessTone } from "@/lib/cashier/state";
import { defaultCashierReadiness } from "@/lib/cashier/state";

const toneClasses: Record<CashierReadinessTone, string> = {
  neutral: "bg-status-neutral-surface text-status-neutral",
  success: "bg-status-success-surface text-status-success",
  warning: "bg-status-warning-surface text-status-warning",
  danger: "bg-status-danger-surface text-status-danger",
  info: "bg-status-info-surface text-status-info",
};

const icons = {
  shift: ClockClockwise,
  till: Wallet,
  providers: Plugs,
};

export function CashierReadinessStrip({ items = defaultCashierReadiness }: { items?: CashierReadinessItem[] }) {
  return (
    <div className="h-11 border-b border-border-subtle bg-surface">
      <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-between gap-3 overflow-hidden px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {items.map((item) => {
            const Icon = icons[item.key as keyof typeof icons] || Plugs;
            return (
              <div
                key={item.key}
                className={cn(
                  "flex min-h-8 min-w-0 items-center gap-2 rounded-full px-3 text-xs font-semibold",
                  toneClasses[item.tone],
                )}
              >
                <Icon size={16} weight="bold" aria-hidden />
                <span className="truncate">
                  {item.label}: {item.value}
                </span>
              </div>
            );
          })}
        </div>
        <span className="hidden shrink-0 xl:inline-flex">
          <Badge variant="neutral">Read-only readiness</Badge>
        </span>
      </div>
    </div>
  );
}
