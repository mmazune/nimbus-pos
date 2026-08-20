import { operationalIcons, operationalIconSizes, operationalIconWeights } from "@/components/pos-shell/role-icons";
import type { OperationalIconName } from "@/components/pos-shell/role-icons";
import { cn } from "@/lib/utils/cn";

/**
 * The control panel's right-hand **view switcher** (Track B3, reference
 * screenshots `05`/`12`: the list / kanban / calendar / graph / pivot button
 * group at the far right).
 *
 * Nimbus advertises **only the views it can actually render from the data it
 * has**. B3 ships list and kanban. Calendar, activity, graph and pivot are NOT
 * greyed-out buttons here: graph and pivot are impossible until `GET
 * /api/reports/:id` returns rows (C-03 / NG-06), and a disabled button for a
 * view that may never exist advertises a roadmap, not a capability.
 */
export type ManagerViewOption<K extends string> = {
  key: K;
  label: string;
  icon: OperationalIconName;
};

type ManagerViewSwitcherProps<K extends string> = {
  options: readonly ManagerViewOption<K>[];
  value: K;
  onChange: (value: K) => void;
  ariaLabel?: string;
};

export function ManagerViewSwitcher<K extends string>({
  ariaLabel = "Switch view",
  onChange,
  options,
  value,
}: ManagerViewSwitcherProps<K>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      data-manager-view-switcher
      className="flex items-center gap-1 rounded-md bg-surface-muted p-0.5"
    >
      {options.map((option) => {
        const Icon = operationalIcons[option.icon];
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            aria-label={option.label}
            title={option.label}
            data-manager-view-option={option.key}
            onClick={() => onChange(option.key)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded outline-none transition-colors duration-150 focus-visible:shadow-focus",
              active ? "bg-surface text-text-primary shadow-subtle" : "text-text-muted hover:text-text-secondary",
            )}
          >
            <Icon
              size={operationalIconSizes.compactAction}
              weight={active ? operationalIconWeights.activeNavigation : operationalIconWeights.default}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
