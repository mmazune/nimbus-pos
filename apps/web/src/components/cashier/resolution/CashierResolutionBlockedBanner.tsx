import { WarningCircle } from "@phosphor-icons/react";

type CashierResolutionBlockedBannerProps = {
  reasons: string[];
};

export function CashierResolutionBlockedBanner({ reasons }: CashierResolutionBlockedBannerProps) {
  if (!reasons.length) return null;

  return (
    <div className="rounded-md bg-status-warning-surface p-4 text-status-warning" role="status">
      <div className="flex items-start gap-3">
        <WarningCircle size={22} weight="bold" aria-hidden />
        <div>
          <p className="font-semibold">Resolution actions are blocked.</p>
          <ul className="mt-2 space-y-1 text-sm font-medium">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
