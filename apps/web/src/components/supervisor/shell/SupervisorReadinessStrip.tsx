import { ClockClockwise, GridFour, ShieldCheck } from "@phosphor-icons/react";

import { Badge } from "@/components/ui";
import type { SupervisorReadinessItem, SupervisorReadinessTone } from "@/lib/supervisor/state";
import { defaultSupervisorReadiness } from "@/lib/supervisor/state";
import { cn } from "@/lib/utils/cn";

const toneClasses: Record<SupervisorReadinessTone, string> = {
  neutral: "bg-status-neutral-surface text-status-neutral",
  success: "bg-status-success-surface text-status-success",
  warning: "bg-status-warning-surface text-status-warning",
  danger: "bg-status-danger-surface text-status-danger",
  info: "bg-status-info-surface text-status-info",
};

const icons = {
  shift: ClockClockwise,
  floor: GridFour,
  approvals: ShieldCheck,
};

export function SupervisorReadinessStrip({
  items = defaultSupervisorReadiness,
}: {
  items?: SupervisorReadinessItem[];
}) {
  return (
    <div className="fixed inset-x-0 top-20 z-30 border-b border-border-subtle bg-surface">
      <div className="mx-auto flex h-11 w-full max-w-[1600px] items-center justify-between gap-3 overflow-x-auto px-4 sm:px-6 xl:px-8">
        <div className="flex min-w-max items-center gap-2 sm:gap-3">
          {items.map((item) => {
            const Icon = icons[item.key as keyof typeof icons] || ShieldCheck;
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
        <span className="hidden shrink-0 md:inline-flex">
          <Badge variant="info">Session context ready</Badge>
        </span>
      </div>
    </div>
  );
}
