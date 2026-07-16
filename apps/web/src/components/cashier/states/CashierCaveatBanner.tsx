import {
  EnvelopeSimple,
  Plugs,
  Printer,
  Prohibit,
  WarningCircle,
} from "@phosphor-icons/react";
import { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type CashierCaveatTone = "warning" | "danger" | "neutral" | "info";

type CashierCaveatBannerProps = {
  title: string;
  description?: string;
  tone?: CashierCaveatTone;
  icon?: "receipt" | "printer" | "terminal" | "mobile-money" | "excluded";
};

const toneClasses: Record<CashierCaveatTone, string> = {
  warning: "bg-status-warning-surface text-status-warning",
  danger: "bg-status-danger-surface text-status-danger",
  neutral: "bg-status-neutral-surface text-status-neutral",
  info: "bg-status-info-surface text-status-info",
};

const iconMap: Record<NonNullable<CashierCaveatBannerProps["icon"]>, ReactNode> = {
  receipt: <EnvelopeSimple size={22} weight="bold" aria-hidden />,
  printer: <Printer size={22} weight="bold" aria-hidden />,
  terminal: <Plugs size={22} weight="bold" aria-hidden />,
  "mobile-money": <WarningCircle size={22} weight="bold" aria-hidden />,
  excluded: <Prohibit size={22} weight="bold" aria-hidden />,
};

export function CashierCaveatBanner({
  description,
  icon = "terminal",
  title,
  tone = "warning",
}: CashierCaveatBannerProps) {
  return (
    <div className={cn("rounded-lg p-4", toneClasses[tone])} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        {iconMap[icon]}
        <div>
          <p className="font-semibold">{title}</p>
          {description ? <p className="mt-1 text-sm">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}

