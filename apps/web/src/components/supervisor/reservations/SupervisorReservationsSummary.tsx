import { Armchair, CalendarCheck, Clock, CurrencyCircleDollar, Users, WarningCircle } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

import { Card } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

type SummaryCounts = {
  today: number;
  upcoming: number;
  confirmed: number;
  seated: number;
  awaitingTable: number;
  terminal: number;
  depositWatch: number;
};

type SummaryItem = {
  key: keyof SummaryCounts;
  label: string;
  detail: string;
  icon: Icon;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
};

const items: SummaryItem[] = [
  {
    key: "today",
    label: "Today",
    detail: "Reservation date is today.",
    icon: CalendarCheck,
    tone: "info",
  },
  {
    key: "upcoming",
    label: "Upcoming",
    detail: "Scheduled from now forward.",
    icon: Clock,
  },
  {
    key: "confirmed",
    label: "Confirmed",
    detail: "Confirmed by reservation status.",
    icon: CalendarCheck,
    tone: "success",
  },
  {
    key: "seated",
    label: "Seated",
    detail: "Guests already seated.",
    icon: Armchair,
    tone: "success",
  },
  {
    key: "awaitingTable",
    label: "Awaiting table",
    detail: "Pending or confirmed with no table.",
    icon: Users,
    tone: "warning",
  },
  {
    key: "terminal",
    label: "No-show / cancelled",
    detail: "Terminal exception states.",
    icon: WarningCircle,
    tone: "danger",
  },
  {
    key: "depositWatch",
    label: "Deposit watch",
    detail: "Derived from returned deposits.",
    icon: CurrencyCircleDollar,
    tone: "warning",
  },
];

const toneClasses = {
  neutral: "bg-surface text-brand-navy-900",
  success: "bg-status-success-surface text-status-success",
  warning: "bg-status-warning-surface text-status-warning",
  danger: "bg-status-danger-surface text-status-danger",
  info: "bg-status-info-surface text-status-info",
};

export function SupervisorReservationsSummary({ counts }: { counts: SummaryCounts }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7" aria-label="Reservation oversight summary">
      {items.map((item) => {
        const Icon = item.icon;
        const tone = item.tone || "neutral";

        return (
          <Card key={item.key} className="min-h-[128px] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text-secondary">{item.label}</p>
                <p className="mt-3 text-3xl font-bold tabular-nums tracking-normal text-text-primary">
                  {counts[item.key]}
                </p>
              </div>
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-md", toneClasses[tone])}>
                <Icon size={22} weight="bold" aria-hidden />
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold leading-5 text-text-muted">{item.detail}</p>
          </Card>
        );
      })}
    </div>
  );
}
