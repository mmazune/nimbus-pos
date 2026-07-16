import { ArrowCounterClockwise, EnvelopeSimple, Printer, X } from "@phosphor-icons/react";

import { Button, ErrorState, Skeleton, StatusMessage } from "@/components/ui";
import type {
  CashierReceiptHistoryEventViewModel,
  CashierReceiptViewModel,
} from "@/lib/cashier/receipt-types";

import { CashierReceiptDetail } from "./CashierReceiptDetail";
import { CashierReceiptHistory } from "./CashierReceiptHistory";
import { CashierReceiptStatusBadge } from "./CashierReceiptStatusBadge";

type CashierReceiptDrawerProps = {
  open: boolean;
  receipt?: CashierReceiptViewModel | null;
  history: CashierReceiptHistoryEventViewModel[];
  isLoadingReceipt?: boolean;
  isLoadingHistory?: boolean;
  receiptError?: string;
  historyError?: string;
  actionMessage?: { tone: "success" | "info" | "warning" | "danger"; title: string; body?: string } | null;
  isReprinting?: boolean;
  isSending?: boolean;
  isRefunding?: boolean;
  onClose: () => void;
  onOpenReprint: () => void;
  onOpenSend: () => void;
  onOpenRefund: () => void;
};

export function CashierReceiptDrawer({
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
  isRefunding,
  onClose,
  onOpenReprint,
  onOpenSend,
  onOpenRefund,
}: CashierReceiptDrawerProps) {
  if (!open) return null;

  const actionBlocked = receipt?.unavailableReason;
  const refundBlocked =
    receipt && receipt.status !== "CLOSED"
      ? "Refunds are available after close."
      : receipt && receipt.outstanding !== undefined && receipt.outstanding > 0
        ? "Refunds require a fully paid receipt."
        : undefined;

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
        aria-labelledby="cashier-receipt-title"
        className="absolute right-0 top-0 flex h-full w-[520px] flex-col overscroll-contain bg-page shadow-overlay"
      >
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-border-subtle bg-surface px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="cashier-receipt-title" className="text-xl font-bold tracking-normal text-text-primary">
                Receipt
              </h2>
              {receipt ? (
                <CashierReceiptStatusBadge label={receipt.receiptStatusLabel} tone={receipt.receiptStatusTone} />
              ) : null}
            </div>
            <p className="mt-1 truncate text-sm font-semibold tabular-nums text-text-secondary">
              {receipt?.receiptNumber || "Receipt unavailable"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close receipt"
            className="flex h-11 w-11 items-center justify-center rounded-md bg-surface-muted text-text-secondary transition-[background-color,transform] duration-150 ease-out hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy-900 active:scale-[0.96]"
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
                <Skeleton className="h-5 w-44" />
                <Skeleton className="mt-4 h-24 w-full" />
                <Skeleton className="mt-4 h-44 w-full" />
              </div>
            ) : receiptError ? (
              <ErrorState title="Receipt unavailable" description={receiptError} />
            ) : receipt ? (
              <>
                <CashierReceiptDetail receipt={receipt} />
                <CashierReceiptHistory
                  events={history}
                  isLoading={isLoadingHistory}
                  error={historyError}
                />
              </>
            ) : (
              <ErrorState title="No receipt available" description="Select a closed-order receipt." />
            )}
          </div>
        </div>

        <footer className="border-t border-border-subtle bg-surface p-5">
          {actionBlocked ? (
            <p className="mb-3 rounded-md bg-status-warning-surface p-3 text-sm font-semibold text-status-warning">
              {actionBlocked}
            </p>
          ) : null}
          {refundBlocked ? (
            <p className="mb-3 rounded-md bg-status-warning-surface p-3 text-sm font-semibold text-status-warning">
              {refundBlocked}
            </p>
          ) : null}
          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="secondary"
              size="pos"
              leadingIcon={<Printer size={20} weight="bold" aria-hidden />}
              onClick={onOpenReprint}
              disabled={!receipt || Boolean(actionBlocked) || isReprinting || isSending || isRefunding}
            >
              Reprint metadata
            </Button>
            <Button
              variant="secondary"
              size="pos"
              leadingIcon={<EnvelopeSimple size={20} weight="bold" aria-hidden />}
              onClick={onOpenSend}
              disabled={!receipt || Boolean(actionBlocked) || isReprinting || isSending || isRefunding}
            >
              Send pending
            </Button>
            <Button
              size="pos"
              leadingIcon={<ArrowCounterClockwise size={20} weight="bold" aria-hidden />}
              onClick={onOpenRefund}
              disabled={!receipt || Boolean(actionBlocked) || Boolean(refundBlocked) || isReprinting || isSending || isRefunding}
            >
              Refund
            </Button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
