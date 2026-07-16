import { WarningCircle } from "@phosphor-icons/react";

type CashierTillBlockedBannerProps = {
  title?: string;
  reasons: string[];
};

export function CashierTillBlockedBanner({ title = "Till action blocked", reasons }: CashierTillBlockedBannerProps) {
  if (!reasons.length) return null;

  return (
    <div className="rounded-md bg-status-warning-surface p-4 text-status-warning" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <WarningCircle size={22} weight="bold" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
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
