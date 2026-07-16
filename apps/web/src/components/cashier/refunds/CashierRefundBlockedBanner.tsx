import { WarningCircle } from "@phosphor-icons/react";

type CashierRefundBlockedBannerProps = {
  reason?: string | null;
};

export function CashierRefundBlockedBanner({ reason }: CashierRefundBlockedBannerProps) {
  if (!reason) return null;

  return (
    <div className="rounded-lg bg-status-warning-surface p-4 text-status-warning" role="status">
      <div className="flex items-start gap-3">
        <WarningCircle size={22} weight="bold" className="shrink-0" aria-hidden />
        <div>
          <p className="font-bold">Refund creation blocked</p>
          <p className="mt-1 text-sm font-semibold leading-6">{reason}</p>
        </div>
      </div>
    </div>
  );
}
