import { PaperPlaneTilt, Printer } from "@phosphor-icons/react";
import { useMemo, useState } from "react";

import { Button, Input, StatusMessage } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

import type { ReceiptSendChannel } from "@/lib/waiter/receipt-api";
import type { WaiterReceiptViewModel } from "@/lib/waiter/receipt-model";

type WaiterReceiptActionBarProps = {
  receipt: WaiterReceiptViewModel;
  isReprinting: boolean;
  isSending: boolean;
  onReprint: () => void;
  onSend: (payload: { channel: ReceiptSendChannel; recipient: string }) => void;
};

const channels: Array<{ id: ReceiptSendChannel; label: string }> = [
  { id: "email", label: "Email" },
  { id: "sms", label: "SMS" },
  { id: "whatsapp", label: "WhatsApp" },
];

export function WaiterReceiptActionBar({
  receipt,
  isReprinting,
  isSending,
  onReprint,
  onSend,
}: WaiterReceiptActionBarProps) {
  const [channel, setChannel] = useState<ReceiptSendChannel>("email");
  const [recipient, setRecipient] = useState("");
  const recipientReady = recipient.trim().length >= 3;
  const recipientType = channel === "email" ? "email" : "tel";
  const recipientPlaceholder = channel === "email" ? "guest@example.com..." : "+256700000000...";
  const sendDisabledReason = useMemo(() => {
    if (!receipt.actionState.canSend) return receipt.actionState.sendReason;
    if (!recipientReady) return "Enter a guest email or phone before recording a pending send.";
    return undefined;
  }, [receipt.actionState.canSend, receipt.actionState.sendReason, recipientReady]);

  return (
    <div className="grid gap-4 border-t border-border-subtle bg-surface-raised p-5">
      <StatusMessage tone="warning" title="PENDING - no live adapter">
        {receipt.actionState.pendingAdapterCopy}
      </StatusMessage>

      <div className="grid gap-2">
        <p className="text-sm font-bold text-text-primary">Send receipt</p>
        <div className="grid grid-cols-3 gap-2">
          {channels.map((entry) => {
            const active = channel === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                className={cn(
                  "min-h-10 rounded-md px-3 text-sm font-semibold",
                  "transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky-500 focus-visible:ring-offset-2",
                  active
                    ? "bg-brand-navy-900 text-text-inverse"
                    : "bg-surface-muted text-text-secondary hover:bg-surface",
                )}
                disabled={!receipt.actionState.canSend || isSending}
                onClick={() => setChannel(entry.id)}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
        <Input
          value={recipient}
          name="receiptRecipient"
          type={recipientType}
          inputMode={channel === "email" ? "email" : "tel"}
          autoComplete="off"
          spellCheck={false}
          placeholder={recipientPlaceholder}
          disabled={!receipt.actionState.canSend || isSending}
          aria-label="Receipt recipient"
          onChange={(event) => setRecipient(event.target.value)}
        />
        {sendDisabledReason ? (
          <p className="text-sm font-semibold text-text-muted">{sendDisabledReason}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          disabled={!receipt.actionState.canReprint || isReprinting}
          leadingIcon={<Printer size={18} weight="bold" aria-hidden />}
          onClick={onReprint}
        >
          {isReprinting ? "Recording" : "Reprint"}
        </Button>
        <Button
          disabled={Boolean(sendDisabledReason) || isSending}
          leadingIcon={<PaperPlaneTilt size={18} weight="bold" aria-hidden />}
          onClick={() => onSend({ channel, recipient: recipient.trim() })}
        >
          {isSending ? "Recording" : "Send receipt"}
        </Button>
      </div>
    </div>
  );
}
