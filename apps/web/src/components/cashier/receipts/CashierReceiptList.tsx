import { Receipt } from "@phosphor-icons/react";

import { CashierEmptyState } from "@/components/cashier/states";
import { Button, Skeleton, StatusMessage } from "@/components/ui";
import type { CashierReceiptViewModel } from "@/lib/cashier/receipt-types";

import { CashierReceiptCard } from "./CashierReceiptCard";

type CashierReceiptListProps = {
  receipts: CashierReceiptViewModel[];
  selectedReceiptId?: string | null;
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string;
  search: string;
  onSelect: (receiptId: string) => void;
  onRetry: () => void;
};

export function CashierReceiptList({
  receipts,
  selectedReceiptId,
  isLoading,
  isRefreshing,
  error,
  search,
  onSelect,
  onRetry,
}: CashierReceiptListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <StatusMessage tone="danger" title="Could not load receipt candidates.">
        <span>{error}</span>
        <Button className="mt-3" variant="secondary" size="compact" onClick={onRetry}>
          Retry receipts
        </Button>
      </StatusMessage>
    );
  }

  if (receipts.length === 0) {
    return (
      <CashierEmptyState
        icon={<Receipt size={26} weight="duotone" aria-hidden />}
        title={search.trim() ? "No receipts match this search." : "No receipts found for this filter."}
        description="Closed-order receipts appear here when the branch has receipt-eligible orders."
      />
    );
  }

  return (
    <div className="space-y-3">
      {isRefreshing ? (
        <p className="text-sm font-semibold text-text-muted" role="status">
          Refreshing receipt candidates...
        </p>
      ) : null}
      {receipts.map((receipt) => (
        <CashierReceiptCard
          key={receipt.id}
          receipt={receipt}
          selected={selectedReceiptId === receipt.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
