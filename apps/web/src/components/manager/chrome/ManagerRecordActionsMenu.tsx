import { OperationalTopNavDropdown } from "@/components/pos-shell/OperationalTopNavDropdown";
import { operationalIcons, operationalIconSizes, operationalIconWeights } from "@/components/pos-shell/role-icons";
import { cn } from "@/lib/utils/cn";

/**
 * The Odoo **C13 record-cog actions menu** (Track B3, reference screenshot
 * `11-user-actions-cog-password.jpg`) — the ⚙ beside a record title that opens
 * the actions available on that record.
 *
 * **Only actions that exist may be passed.** Odoo's cog on a user record offers
 * `Change Password`, `Send Password Reset Instructions`, `Archive`, `Duplicate`.
 * Nimbus has none of those for frontline staff (NG-08: no password concept, no
 * invite/reset flow, no archive route, no duplicate), so the Staff cog carries
 * exactly the Quick-PIN actions the backend backs — and this component renders
 * **nothing at all** when the caller has no action to offer, rather than a cog
 * that opens an empty menu.
 */
export type ManagerRecordAction = {
  key: string;
  label: string;
  description?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  /** Shown in place of the description when `disabled` — always say WHY. */
  disabledReason?: string;
  onSelect: () => void;
};

type ManagerRecordActionsMenuProps = {
  actions: readonly ManagerRecordAction[];
  ariaLabel?: string;
};

export function ManagerRecordActionsMenu({
  actions,
  ariaLabel = "Record actions",
}: ManagerRecordActionsMenuProps) {
  const CogIcon = operationalIcons.settings;
  if (!actions.length) return null;

  return (
    <OperationalTopNavDropdown
      id="manager-record-actions"
      align="left"
      panelClassName="w-72"
      renderTrigger={({ buttonProps, open }) => (
        <button
          {...buttonProps}
          type="button"
          aria-label={ariaLabel}
          data-manager-record-cog
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted outline-none hover:bg-surface-muted focus-visible:shadow-focus",
            open && "bg-surface-muted text-text-primary",
          )}
        >
          <CogIcon
            size={operationalIconSizes.compactAction}
            weight={operationalIconWeights.default}
            aria-hidden
          />
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col p-1">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={action.disabled}
              data-manager-record-action={action.key}
              onClick={() => {
                if (action.disabled) return;
                close();
                action.onSelect();
              }}
              className={cn(
                "flex flex-col gap-0.5 rounded-md px-2 py-2 text-left outline-none hover:bg-surface-muted focus-visible:bg-surface-muted disabled:pointer-events-none disabled:opacity-60",
                action.tone === "danger" ? "text-status-danger" : "text-text-primary",
              )}
            >
              <span className="text-sm font-semibold">{action.label}</span>
              {action.disabled && action.disabledReason ? (
                <span className="text-xs leading-5 text-text-muted">{action.disabledReason}</span>
              ) : action.description ? (
                <span className="text-xs leading-5 text-text-muted">{action.description}</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </OperationalTopNavDropdown>
  );
}
