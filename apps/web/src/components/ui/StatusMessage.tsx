import { CheckCircle, Info, WarningCircle, XCircle } from "@phosphor-icons/react";
import { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type StatusMessageTone = "success" | "info" | "warning" | "danger";

type StatusMessageProps = {
  tone?: StatusMessageTone;
  title: string;
  children?: ReactNode;
};

const toneClasses: Record<StatusMessageTone, string> = {
  success: "bg-status-success-surface text-status-success",
  info: "bg-status-info-surface text-status-info",
  warning: "bg-status-warning-surface text-status-warning",
  danger: "bg-status-danger-surface text-status-danger",
};

const toneIcon = {
  success: CheckCircle,
  info: Info,
  warning: WarningCircle,
  danger: XCircle,
};

export function StatusMessage({ tone = "info", title, children }: StatusMessageProps) {
  const Icon = toneIcon[tone];

  return (
    <div className={cn("rounded-lg p-4", toneClasses[tone])} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <Icon size={22} aria-hidden />
        <div>
          <p className="font-semibold">{title}</p>
          {children ? <div className="mt-1 text-sm">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
