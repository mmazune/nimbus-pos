import type { ReactNode } from "react";

import { Card } from "@/components/ui";
import type { OperationalTone } from "@/lib/profile/profile-model";

import { OperationalStatusBadge } from "./OperationalStatusBadge";

type ShiftStatusCardProps = {
  statusLabel: string;
  statusTone: OperationalTone;
  title: string;
  description: string;
  warning?: ReactNode;
  details: ReactNode;
  controls: ReactNode;
};

export function ShiftStatusCard({
  statusLabel,
  statusTone,
  title,
  description,
  warning,
  details,
  controls,
}: ShiftStatusCardProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 p-5 sm:p-6" aria-labelledby="profile-shift-title">
          <OperationalStatusBadge label={statusLabel} tone={statusTone} />
          <h2 id="profile-shift-title" className="mt-4 text-2xl font-bold tracking-tight text-text-primary">
            {title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">{description}</p>
          {warning ? <div className="mt-5">{warning}</div> : null}
          <div className="mt-6">{details}</div>
        </section>
        <aside className="bg-surface-muted p-5 sm:p-6">{controls}</aside>
      </div>
    </Card>
  );
}

