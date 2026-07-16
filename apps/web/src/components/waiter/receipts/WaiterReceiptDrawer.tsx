import { X } from "@phosphor-icons/react";

import { Button, ErrorState, Skeleton, StatusMessage } from "@/components/ui";
import { WaiterReceiptActionBar } from "@/components/waiter/receipts/WaiterReceiptActionBar";
import { WaiterReceiptHistoryTimeline } from "@/components/waiter/receipts/WaiterReceiptHistoryTimeline";
import { WaiterReceiptPreview } from "@/components/waiter/receipts/WaiterReceiptPreview";
import { WaiterReceiptStatusBadge } from "@/components/waiter/receipts/WaiterReceiptStatusBadge";

import type { ReceiptSendChannel } from "@/lib/waiter/receipt-api";
import type {
  WaiterReceiptHistoryEventViewModel,
  WaiterReceiptViewModel,
} from "@/lib/waiter/receipt-model";

type WaiterReceiptDrawerProps = {
  open: boolean;
  receipt?: WaiterReceiptViewModel;
  history: WaiterReceiptHistoryEventViewModel[];
  isLoadingReceipt?: boolean;
  isLoadingHistory?: boolean;
  receiptError?: string;
  historyError?: string;
  actionMessage?: { tone: "success" | "info" | "warning" | "danger"; title: string; body?: string } | null;
  isReprinting: boolean;
  isSending: boolean;
  onClose: () => void;
  onReprint: () => void;
  onSend: (payload: { channel: ReceiptSendChannel; recipient: string }) => void;
};

export function WaiterReceiptDrawer({
  open,
  receipt,
  history,
  isLoadingReceipt,
  isLoadingHistory,
  receiptError,
  historyError,
  actionMessage,
  isReprinting,
  isSending,
  onClose,
  onReprint,
  onSend,
}: WaiterReceiptDrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        aria-label="Close receipt overlay"
        className="absolute inset-0 bg-brand-navy-950/30"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="waiter-receipt-title"
        className="absolute right-0 top-0 flex h-full w-[500px] flex-col overscroll-contain bg-page shadow-overlay"
      >
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-border-subtle bg-surface px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p id="waiter-receipt-title" className="text-xl font-bold tracking-normal text-text-primary">
                Receipt
              </p>
              {receipt ? (
                <WaiterReceiptStatusBadge tone="info">{receipt.status}</WaiterReceiptStatusBadge>
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm font-semibold tabular-nums text-text-secondary">
              {receipt?.receiptNumber || "Receipt unavailable"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close receipt"
            className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-muted text-text-secondary transition-[background-color,transform] duration-150 ease-out hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky-500 focus-visible:ring-offset-2 active:scale-[0.96]"
            onClick={onClose}
          >
            <X size={20} weight="bold" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-4">
            {actionMessage ? (
              <StatusMessage tone={actionMessage.tone} title={actionMessage.title}>
                {actionMessage.body}
              </StatusMessage>
            ) : null}

            {isLoadingReceipt ? (
              <div className="rounded-lg bg-surface p-5 shadow-subtle">
                <Skeleton className="mx-auto h-11 w-11" />
                <Skeleton className="mx-auto mt-4 h-5 w-48" />
                <Skeleton className="mt-5 h-24 w-full" />
                <Skeleton className="mt-5 h-52 w-full" />
              </div>
            ) : receiptError ? (
              <ErrorState title="Receipt unavailable" description={receiptError} />
            ) : receipt ? (
              <>
                <WaiterReceiptPreview receipt={receipt} />
                <WaiterReceiptHistoryTimeline
                  events={history}
                  isLoading={isLoadingHistory}
                  error={historyError}
                />
              </>
            ) : (
              <ErrorState
                title="Receipt unavailable"
                description="Receipt unavailable for this order."
              />
            )}
          </div>
        </div>

        {receipt ? (
          <WaiterReceiptActionBar
            receipt={receipt}
            isReprinting={isReprinting}
            isSending={isSending}
            onReprint={onReprint}
            onSend={onSend}
          />
        ) : (
          <div className="border-t border-border-subtle bg-surface p-5">
            <Button className="w-full" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
