import { operationalIcons } from "@/components/pos-shell/role-icons";
import type { ManagerReadinessItem, ManagerReadinessTone } from "@/lib/manager/state";
import { defaultManagerReadiness } from "@/lib/manager/state";
import { cn } from "@/lib/utils/cn";

const toneClasses: Record<ManagerReadinessTone, string> = {
  neutral: "bg-status-neutral-surface text-status-neutral",
  success: "bg-status-success-surface text-status-success",
  warning: "bg-status-warning-surface text-status-warning",
  danger: "bg-status-danger-surface text-status-danger",
  info: "bg-status-info-surface text-status-info",
};

const icons = {
  branch: operationalIcons.branch,
  reports: operationalIcons.reports,
  devices: operationalIcons.workstation,
};

/**
 * Manager readiness strip (M-P1). Chips only exist for signals M-P0 proved:
 * branch (memberships), report generators (`/reports/catalog`), device registry
 * (`/devices`). Tills / shifts / approvals chips are intentionally absent — see
 * `useManagerReadiness`.
 *
 * ⚠️ **Track B3 removed a global "Read-only oversight" badge from this strip.**
 * It was truthful in M-P1/B1, when every Manager surface was an honest foundation
 * screen that could not write anything. B3 makes it false: Staff onboarding
 * creates real accounts, resets Quick PINs and decides leave requests, so a strip
 * asserting the whole workspace is read-only would sit directly above a **New**
 * button.
 *
 * Read-only is a property of a SURFACE, not of the workspace, so the badge now
 * lives in each read-only surface's own `ManagerControlPanel` (the three
 * Operations screens carry it) and is simply absent where it would be untrue.
 */
export function ManagerReadinessStrip({
  items = defaultManagerReadiness,
}: {
  items?: ManagerReadinessItem[];
}) {
  return (
    <div className="h-11 border-b border-border-subtle bg-surface" data-manager-readiness>
      <div className="mx-auto flex h-full w-full max-w-[1600px] items-center gap-3 overflow-hidden px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {items.map((item) => {
            const Icon = icons[item.key as keyof typeof icons] || operationalIcons.branch;
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
      </div>
    </div>
  );
}
