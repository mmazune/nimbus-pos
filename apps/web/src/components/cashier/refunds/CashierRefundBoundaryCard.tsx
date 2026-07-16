import { ShieldWarning } from "@phosphor-icons/react";

type CashierRefundBoundaryCardProps = {
  title: string;
  children: string;
};

export function CashierRefundBoundaryCard({ title, children }: CashierRefundBoundaryCardProps) {
  const titleId = `refund-boundary-${title.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <section className="rounded-lg bg-surface p-4 shadow-subtle" aria-labelledby={titleId}>
      <div className="flex items-start gap-3">
        <ShieldWarning size={22} weight="bold" className="shrink-0 text-status-warning" aria-hidden />
        <div>
          <h3 id={titleId} className="font-bold text-text-primary">
            {title}
          </h3>
          <p className="mt-1 text-sm font-medium leading-6 text-text-secondary">{children}</p>
        </div>
      </div>
    </section>
  );
}
