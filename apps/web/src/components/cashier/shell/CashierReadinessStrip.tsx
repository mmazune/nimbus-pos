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
    <div className="fixed inset-x-0 top-20 z-30 border-b border-border-subtle bg-surface">
      <div className="mx-auto flex h-11 min-w-[1280px] max-w-[1600px] items-center justify-between gap-4 px-8">
        <div className="flex min-w-0 items-center gap-3">
          {items.map((item) => {
            const Icon = icons[item.key as keyof typeof icons] || Plugs;
            return (
              <div
                key={item.key}
                className={cn(
                  "flex min-h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold",
                  toneClasses[item.tone],
                )}
              >
                <Icon size={16} weight="bold" aria-hidden />
                <span>
                  {item.label}: {item.value}
                </span>
              </div>
            );
          })}
        </div>
        <Badge variant="neutral">Read-only readiness</Badge>
      </div>
    </div>
  );
}
