import { WarningDiamond } from "@phosphor-icons/react";

import { Card } from "@/components/ui";

const limitations = [
  "MTN/Airtel live diner checkout pending provider confirmation.",
  "PesaPal excluded from diner checkout; owner SaaS billing only.",
  "Card terminal is manual-reference/stub only.",
  "Printer routes are metadata-only; no print-driver invocation.",
  "Digital receipt send is pending; no live email/SMS/WhatsApp adapter.",
  "Paid-in, paid-out, and pickup cash movement flows are deferred.",
  "Transfer server deferred until cashier-safe staff selector is verified.",
  "Bill-requested filter is audit-derived; Queue uses active payable orders.",
  "Browser/manual authenticated QA still pending if not yet completed.",
];

export function CashierKnownLimitationsCard() {
  return (
    <Card aria-labelledby="cashier-limitations-title">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-status-warning-surface text-status-warning">
          <WarningDiamond size={22} weight="duotone" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-text-muted">Known limitations</p>
          <h2 id="cashier-limitations-title" className="text-lg font-bold tracking-normal text-text-primary">
            Deferred Surfaces
          </h2>
        </div>
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-3">
        {limitations.map((item) => (
          <li key={item} className="rounded-md bg-surface-muted p-3 text-sm font-semibold leading-6 text-text-primary">
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}
