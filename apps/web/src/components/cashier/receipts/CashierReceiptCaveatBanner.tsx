import { EnvelopeSimple, Printer } from "@phosphor-icons/react";

type CashierReceiptCaveatBannerProps = {
  type: "print" | "send";
};

export function CashierReceiptCaveatBanner({ type }: CashierReceiptCaveatBannerProps) {
  const Icon = type === "print" ? Printer : EnvelopeSimple;
  const title =
    type === "print"
      ? "Metadata only — no print-driver invocation"
      : "PENDING — no live email/SMS/WhatsApp adapter";
  const body =
    type === "print"
      ? "Reprint records an audit request only. It does not claim a physical printer completed anything."
      : "Digital send records a pending request only. It does not claim email, SMS, or WhatsApp delivery.";

  return (
    <div className="rounded-lg bg-status-warning-surface p-4 text-status-warning" role="status">
      <div className="flex items-start gap-3">
        <Icon size={22} weight="bold" aria-hidden />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-6">{body}</p>
        </div>
      </div>
    </div>
  );
}
