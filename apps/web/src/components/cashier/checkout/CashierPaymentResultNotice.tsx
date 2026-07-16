import { CheckCircle, XCircle } from "@phosphor-icons/react";

import { cn } from "@/lib/utils/cn";

type CashierPaymentResultNoticeProps = {
  tone: "success" | "danger";
  title: string;
  detail?: string;
};

const toneClasses = {
  success: "bg-status-success-surface text-status-success",
  danger: "bg-status-danger-surface text-status-danger",
};

export function CashierPaymentResultNotice({ tone, title, detail }: CashierPaymentResultNoticeProps) {
  const Icon = tone === "success" ? CheckCircle : XCircle;

  return (
    <div className={cn("rounded-md p-4", toneClasses[tone])} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <Icon size={22} weight="bold" aria-hidden />
        <div>
          <p className="font-semibold">{title}</p>
          {detail ? <p className="mt-1 text-sm font-medium">{detail}</p> : null}
        </div>
      </div>
    </div>
  );
}
