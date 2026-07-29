import { ArrowLeft, Minus, Plus, WarningCircle, X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/providers/ToastProvider";
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  SearchInput,
  Skeleton,
  StatusMessage,
} from "@/components/ui";
import { WaiterBillActionPanel, WaiterReceiptDrawer } from "@/components/waiter/receipts";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils/cn";
import {
  addOrderItem,
  createDineInOrder,
  deleteOrderItem,
  getMenuItemConfiguration,
  getOrder,
  loadWaiterMenuWorkspace,
  sendOrder,
  updateOrderItem,
  type AddOrderItemPayload,
  type WaiterOrderApi,
  type WaiterOrderItemApi,
} from "@/lib/waiter/order-api";
import {
  buildAddItemPayload,
  buildUpdateItemPayload,
  flattenMenuCatalog,
  formatMoney,
  modifierSelectionIsValid,
  normalizeMenuItemConfiguration,
  normalizeMenuNavigation,
  normalizeWaiterOrder,
  selectedOptionIdsFromMetadata,
  type WaiterMenuGroupViewModel,
  type WaiterMenuItemConfigurationViewModel,
  type WaiterMenuItemViewModel,
  type WaiterMenuSectionViewModel,
  type WaiterMenuServingViewModel,
  type WaiterOrderLineViewModel,
  type WaiterOrderViewModel,
} from "@/lib/waiter/order-model";
import {
  getReceipt,
  getReceiptHistory,
  reprintReceipt,
  requestOrderBill,
  sendReceipt,
  type ReceiptSendChannel,
} from "@/lib/waiter/receipt-api";
import {
  normalizeReceiptHistory,
  normalizeRequestBillResult,
  normalizeSendReceiptResult,
  normalizeWaiterReceipt,
  type WaiterBillStateViewModel,
} from "@/lib/waiter/receipt-model";
import { useActiveShift } from "@/lib/waiter/useActiveShift";

type WaiterOrderBuilderScreenProps = {
  orderId?: string;
  initialOrder?: WaiterOrderApi;
  expectedTableId?: string;
  tableContext?: { id: string; name: string };
  startOrderOnMount?: boolean;
  onClose?: () => void;
  onOrderResolved?: (order: WaiterOrderApi) => void;
};

type ConfiguratorState = {
  mode: "add" | "edit";
  item: WaiterMenuItemConfigurationViewModel;
  line?: WaiterOrderLineViewModel;
  quantity: number;
  note: string;
  servingId?: string;
  selectedOptionIds: string[];
};

function getOrderErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "ORDER_NOT_OWNED_BY_WAITER") {
      return {
        title: "This order belongs to another waiter",
        description: "Editable order actions are blocked.",
        blocked: true,
      };
    }
    if (error.isForbidden) {
      return {
        title: "Order access blocked",
        description: "This waiter account cannot open this order.",
        blocked: true,
      };
    }
    return { title: "Could not load order", description: error.message, blocked: false };
  }

  return {
    title: "Could not load order",
    description: error instanceof Error ? error.message : "Try again when the connection is stable.",
    blocked: false,
  };
}

function getWriteErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "SHIFT_NOT_OPEN") return "Start your shift before continuing service.";
    if (error.code === "ORDER_NOT_OWNED_BY_WAITER") return "This order belongs to another waiter.";
    if (error.code === "ORDER_TRANSITION_NOT_WAITER_SAFE") {
      return "This action is not available for the waiter role.";
    }
    return error.message;
  }
  return error instanceof Error ? error.message : "Action failed.";
}

function moneyNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function moneySnapshot(value: number) {
  return value.toFixed(2);
}

function withLineTotals(order: WaiterOrderApi): WaiterOrderApi {
  const subtotal = (order.items || []).reduce((sum, item) => sum + moneyNumber(item.subtotal), 0);
  const tax = moneyNumber(order.tax);
  const discount = moneyNumber(order.discount);

  return {
    ...order,
    subtotal: moneySnapshot(subtotal),
    total: moneySnapshot(subtotal + tax - discount),
  };
}

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "NEW") return "neutral";
  if (["SENT", "IN_KITCHEN", "READY"].includes(status)) return "info";
  if (status === "SERVED") return "success";
  if (["VOIDED", "CLOSED"].includes(status)) return "danger";
  return "neutral";
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
}

function buildBillState({
  order,
  shiftIsOpen,
  billRequested,
}: {
  order: WaiterOrderViewModel;
  shiftIsOpen: boolean;
  billRequested: boolean;
}): WaiterBillStateViewModel {
  if (!shiftIsOpen) {
    return {
      label: "Blocked",
      tone: "warning",
      description: "Bill actions need an open shift.",
      canRequestBill: false,
      requestDisabledReason: "Start your shift before requesting a bill.",
      canViewReceipt: order.status !== "NEW",
      receiptId: order.id,
    };
  }
  if (order.status === "NEW") {
    return {
      label: "Not sent",
      tone: "neutral",
      description: "Send the draft before requesting its bill.",
      canRequestBill: false,
      requestDisabledReason: "Send the order before requesting a bill.",
      canViewReceipt: false,
      receiptId: order.id,
    };
  }
  if (["CLOSED", "VOIDED"].includes(order.status)) {
    return {
      label: "Receipt",
      tone: "success",
      description: "View the completed receipt and its audit history.",
      canRequestBill: false,
      requestDisabledReason: "This order is already completed.",
      canViewReceipt: true,
      receiptId: order.id,
    };
  }
  if (billRequested) {
    return {
      label: "Requested",
      tone: "warning",
      description: "Cashier payment remains outside the waiter workspace.",
      canRequestBill: false,
      requestDisabledReason: "The bill has already been requested.",
      canViewReceipt: true,
      receiptId: order.id,
    };
  }
  return {
    label: "Available",
    tone: "info",
    description: "Requesting a bill records a waiter-safe signal. It does not collect payment.",
    canRequestBill: true,
    canViewReceipt: true,
    receiptId: order.id,
  };
}

function QuantityStepper({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="inline-grid grid-cols-[48px_56px_48px] overflow-hidden rounded-md border border-border-subtle bg-surface">
      <button
        type="button"
        className="flex h-12 items-center justify-center text-text-secondary hover:bg-surface-muted disabled:text-text-muted"
        aria-label="Decrease quantity"
        disabled={disabled || value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <Minus size={18} weight="bold" aria-hidden />
      </button>
      <span className="flex h-12 items-center justify-center border-x border-border-subtle text-base font-bold tabular-nums text-text-primary">
        {value}
      </span>
      <button
        type="button"
        className="flex h-12 items-center justify-center text-text-secondary hover:bg-surface-muted disabled:text-text-muted"
        aria-label="Increase quantity"
        disabled={disabled || value >= 99}
        onClick={() => onChange(Math.min(99, value + 1))}
      >
        <Plus size={18} weight="bold" aria-hidden />
      </button>
    </div>
  );
}

function selectionGuidance(min: number, max: number, required: boolean) {
  const effectiveMin = required ? Math.max(1, min) : min;
  if (effectiveMin > 0 && max > effectiveMin) return `Choose ${effectiveMin} to ${max}`;
  if (effectiveMin > 0) return `Choose ${effectiveMin}`;
  if (max > 0) return `Choose up to ${max}`;
  return "Choose any";
}

function ItemConfigurator({
  state,
  currencyCode,
  isSaving,
  isRemoving,
  onChange,
  onClose,
  onSubmit,
  onRemove,
}: {
  state: ConfiguratorState;
  currencyCode?: string | null;
  isSaving: boolean;
  isRemoving: boolean;
  onChange: (next: ConfiguratorState) => void;
  onClose: () => void;
  onSubmit: () => void;
  onRemove: () => void;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const serving =
    state.item.servings.find((entry) => entry.id === state.servingId) ||
    state.item.servings.find((entry) => entry.isDefault) ||
    state.item.servings[0];
  const valid =
    state.quantity >= 1 &&
    modifierSelectionIsValid(state.item.modifierGroups, state.selectedOptionIds);
  const modifierDelta = state.item.modifierGroups
    .flatMap((group) => group.options)
    .filter((option) => state.selectedOptionIds.includes(option.id))
    .reduce((sum, option) => sum + option.priceDelta, 0);
  const effectiveUnitPrice = (serving?.price ?? state.item.price ?? 0) + modifierDelta;

  function toggleOption(groupId: string, optionId: string) {
    const group = state.item.modifierGroups.find((entry) => entry.id === groupId);
    const selected = state.selectedOptionIds.includes(optionId);
    let next = selected
      ? state.selectedOptionIds.filter((id) => id !== optionId)
      : [...state.selectedOptionIds, optionId];

    if (!selected && group?.max === 1) {
      const groupOptionIds = new Set(group.options.map((option) => option.id));
      next = next.filter((id) => !groupOptionIds.has(id) || id === optionId);
    }
    onChange({ ...state, selectedOptionIds: next });
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-brand-navy-950/30"
      data-testid="waiter-item-configurator"
    >
      <button type="button" className="absolute inset-0" aria-label="Close item configurator" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="waiter-item-configurator-title"
        className="absolute inset-y-0 right-0 flex w-[min(720px,calc(100vw-32px))] flex-col bg-page shadow-overlay"
      >
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-border-subtle bg-surface px-6">
          <div className="min-w-0">
            <p id="waiter-item-configurator-title" className="truncate text-2xl font-bold text-text-primary">
              {state.item.name}
            </p>
            <p className="mt-1 text-sm font-semibold text-text-secondary">
              {state.mode === "edit" ? "Update this unsent item" : "Configure this item"}
            </p>
          </div>
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-muted text-text-secondary hover:bg-surface"
            aria-label="Close item configurator"
            onClick={onClose}
          >
            <X size={20} weight="bold" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="grid gap-7">
            <section className="flex flex-wrap items-end justify-between gap-5 rounded-lg bg-surface p-5 shadow-subtle">
              <div>
                <p className="mb-2 text-sm font-bold text-text-primary">Quantity</p>
                <QuantityStepper
                  value={state.quantity}
                  disabled={isSaving || isRemoving}
                  onChange={(quantity) => onChange({ ...state, quantity })}
                />
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-text-muted">Configured total</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-text-primary">
                  {formatMoney(effectiveUnitPrice * state.quantity, currencyCode || "UGX")}
                </p>
              </div>
            </section>

            {state.item.servings.length > 0 ? (
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-text-primary">Serving</h3>
                    {state.mode === "edit" ? (
                      <p className="mt-1 text-sm text-text-muted">
                        Serving is fixed after the item is added by the current order-line contract.
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={state.item.servings.length > 1 ? "warning" : "neutral"}>
                    {state.item.servings.length > 1 ? "Choose 1" : "Selected"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {state.item.servings.map((entry) => {
                    const selected = serving?.id === entry.id;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        aria-pressed={selected}
                        className={cn(
                          "flex min-h-14 items-center justify-between gap-3 rounded-md border px-4 text-left text-sm font-semibold",
                          selected
                            ? "border-brand-navy-900 bg-brand-navy-900 text-text-inverse"
                            : "border-border-subtle bg-surface text-text-secondary hover:border-border-strong",
                        )}
                        disabled={state.mode === "edit" || isSaving || isRemoving}
                        onClick={() => onChange({ ...state, servingId: entry.id })}
                      >
                        <span>{entry.label}</span>
                        <span className="tabular-nums">{formatMoney(entry.price, currencyCode || "UGX")}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {state.item.modifierGroups.map((group) => {
              const selectedCount = group.options.filter((option) =>
                state.selectedOptionIds.includes(option.id),
              ).length;
              const effectiveMin = group.required ? Math.max(group.min, 1) : group.min;
              const groupValid =
                selectedCount >= effectiveMin && (group.max === 0 || selectedCount <= group.max);
              return (
                <section key={group.id}>
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-text-primary">{group.name}</h3>
                      <p className="mt-1 text-sm font-medium text-text-muted">
                        {selectionGuidance(group.min, group.max, group.required)}
                      </p>
                    </div>
                    <Badge variant={group.required ? (groupValid ? "success" : "warning") : "neutral"}>
                      {group.required ? "Required" : "Optional"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {group.options.map((option) => {
                      const selected = state.selectedOptionIds.includes(option.id);
                      const maxReached = group.max > 0 && selectedCount >= group.max && !selected;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          className={cn(
                            "flex min-h-14 items-center justify-between gap-3 rounded-md border px-4 text-left text-sm font-semibold",
                            selected
                              ? "border-brand-navy-900 bg-brand-navy-900 text-text-inverse"
                              : "border-border-subtle bg-surface text-text-secondary hover:border-border-strong",
                          )}
                          disabled={isSaving || isRemoving || maxReached}
                          onClick={() => toggleOption(group.id, option.id)}
                        >
                          <span>{option.name}</span>
                          <span className="shrink-0 tabular-nums">
                            {option.priceDelta > 0 ? `+ ${formatMoney(option.priceDelta, currencyCode || "UGX")}` : "Included"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            <label className="block">
              <span className="mb-2 block text-base font-bold text-text-primary">Item comment</span>
              <textarea
                className="min-h-28 w-full resize-none rounded-md border border-border-subtle bg-surface px-4 py-3 text-base text-text-primary shadow-subtle placeholder:text-text-muted"
                maxLength={500}
                value={state.note}
                disabled={isSaving || isRemoving}
                placeholder="No salt, sauce on the side, medium rare, extra ice"
                onChange={(event) => onChange({ ...state, note: event.target.value })}
              />
              <p className="mt-2 text-sm text-text-muted">
                Use configured options for priced additions. Comments remain free kitchen or bar instructions.
              </p>
            </label>

            {!valid ? (
              <StatusMessage tone="warning" title="Complete required choices">
                Check each required group before adding or updating this item.
              </StatusMessage>
            ) : null}

            {state.mode === "edit" ? (
              <section className="border-t border-border-subtle pt-6">
                {!confirmRemove ? (
                  <Button variant="danger" disabled={isSaving || isRemoving} onClick={() => setConfirmRemove(true)}>
                    Remove item
                  </Button>
                ) : (
                  <div className="rounded-lg bg-status-danger-surface p-4">
                    <p className="font-bold text-status-danger">Remove this item from the draft?</p>
                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" disabled={isRemoving} onClick={() => setConfirmRemove(false)}>
                        Keep item
                      </Button>
                      <Button variant="danger" disabled={isRemoving} onClick={onRemove}>
                        {isRemoving ? "Removing item" : "Confirm remove"}
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            ) : null}
          </div>
        </div>

        <footer className="border-t border-border-subtle bg-surface px-6 py-4">
          <Button className="w-full" size="pos" disabled={!valid || isSaving || isRemoving} onClick={onSubmit}>
            {isSaving
              ? state.mode === "edit"
                ? "Updating item"
                : "Adding item"
              : state.mode === "edit"
                ? "Update item"
                : "Add to order"}
          </Button>
        </footer>
      </aside>
    </div>
  );
}

function MenuNavigation({
  sections,
  activeSectionId,
  activeGroupId,
  onSectionChange,
  onGroupChange,
}: {
  sections: WaiterMenuSectionViewModel[];
  activeSectionId?: string;
  activeGroupId?: string;
  onSectionChange: (section: WaiterMenuSectionViewModel) => void;
  onGroupChange: (group: WaiterMenuGroupViewModel) => void;
}) {
  const activeSection = sections.find((section) => section.id === activeSectionId);
  return (
    <nav aria-label="Menu navigation" className="flex min-h-0 flex-col bg-brand-navy-950 text-text-inverse">
      <div className="grid grid-cols-2 gap-2 border-b border-brand-navy-800 p-3">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            data-testid="waiter-menu-section"
            aria-pressed={section.id === activeSectionId}
            className={cn(
              "min-h-12 rounded-md px-2 text-sm font-bold",
              section.id === activeSectionId
                ? "bg-brand-white text-brand-navy-900"
                : "bg-brand-navy-800 text-text-inverse hover:bg-brand-navy-900",
            )}
            onClick={() => onSectionChange(section)}
          >
            {section.name}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid gap-2">
          {(activeSection?.groups || []).map((group) => (
            <button
              key={group.id}
              type="button"
              data-testid="waiter-menu-group"
              aria-current={group.id === activeGroupId ? "page" : undefined}
              className={cn(
                "min-h-12 rounded-md px-3 text-left text-sm font-semibold",
                group.id === activeGroupId
                  ? "bg-brand-white text-brand-navy-900"
                  : "text-text-inverse hover:bg-brand-navy-800",
              )}
              onClick={() => onGroupChange(group)}
            >
              {group.name}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}

function MenuItemTile({
  item,
  currencyCode,
  disabled,
  onSelect,
}: {
  item: WaiterMenuItemViewModel;
  currencyCode?: string | null;
  disabled: boolean;
  onSelect: () => void;
}) {
  const servingPrices = item.servings
    .map((serving) => serving.price)
    .filter((price): price is number => price !== undefined);
  const startingPrice = servingPrices.length ? Math.min(...servingPrices) : item.price;
  return (
    <button
      type="button"
      data-testid="waiter-menu-item"
      disabled={disabled || !item.available}
      className="flex min-h-[112px] flex-col justify-between rounded-lg border border-border-subtle bg-surface p-4 text-left shadow-subtle transition-[border-color,background-color,transform] duration-150 ease-out hover:border-border-strong hover:bg-brand-white active:scale-[0.98] disabled:bg-surface-muted disabled:text-text-muted"
      onClick={onSelect}
    >
      <span className="text-base font-bold leading-5 text-text-primary">{item.name}</span>
      <span className="mt-4 text-sm font-bold tabular-nums text-text-primary">
        {item.servings.length > 1 ? "From " : ""}
        {formatMoney(startingPrice, currencyCode || "UGX")}
      </span>
    </button>
  );
}

function OrderPanel({
  order,
  currencyCode,
  bill,
  orderState,
  orderStateMessage,
  writeDisabledReason,
  isSending,
  isRequestingBill,
  onEditLine,
  onSend,
  onRequestBill,
  onViewReceipt,
  onRetryOrder,
}: {
  order: WaiterOrderViewModel;
  currencyCode?: string | null;
  bill?: WaiterBillStateViewModel;
  orderState: "pending" | "refreshing" | "ready" | "error";
  orderStateMessage?: string;
  writeDisabledReason?: string;
  isSending: boolean;
  isRequestingBill: boolean;
  onEditLine: (line: WaiterOrderLineViewModel) => void;
  onSend: () => void;
  onRequestBill: () => void;
  onViewReceipt: () => void;
  onRetryOrder: () => void;
}) {
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const canSend = !writeDisabledReason && order.canSend && itemCount > 0;
  return (
    <aside
      className="flex min-h-0 flex-col border-l border-border-subtle bg-surface"
      data-testid="waiter-order-panel"
    >
      <header className="flex min-h-[68px] items-center justify-between gap-3 border-b border-border-subtle px-5">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Current order</h2>
          <p className="mt-1 text-sm font-semibold tabular-nums text-text-muted">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
        </div>
        <p className="text-lg font-bold tabular-nums text-text-primary">{formatMoney(order.total, currencyCode || "UGX")}</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {orderState === "pending" ? (
          <div className="mb-4 rounded-lg border border-border-subtle bg-surface-muted p-3 text-sm font-semibold text-text-secondary" data-testid="waiter-order-pending">
            Creating the order. You can keep browsing and choose an item now.
          </div>
        ) : orderState === "refreshing" ? (
          <p className="mb-4 text-sm font-semibold text-text-muted">Showing cached order while it refreshes.</p>
        ) : orderState === "error" ? (
          <div className="mb-4 grid gap-3" data-testid="waiter-order-create-error">
            <StatusMessage tone="danger" title="Order could not be created">
              {orderStateMessage || "Your menu selection is still available. Retry when the connection is stable."}
            </StatusMessage>
            <Button variant="secondary" className="w-full" onClick={onRetryOrder}>
              Retry order creation
            </Button>
          </div>
        ) : null}
        {writeDisabledReason && orderState !== "error" ? (
          <div className="mb-4">
            <StatusMessage tone="warning" title="Draft editing unavailable">
              {writeDisabledReason}
            </StatusMessage>
          </div>
        ) : null}
        {order.items.length === 0 ? (
          <div className="rounded-lg bg-surface-muted p-4 text-sm font-medium text-text-secondary">
            Select an item from the menu to begin this order.
          </div>
        ) : (
          <div className="grid gap-2">
            {order.items.map((line) => (
              <button
                key={line.id}
                type="button"
                data-testid="waiter-order-line"
                data-order-line-id={line.id}
                disabled={Boolean(writeDisabledReason) || line.locked}
                className="w-full rounded-lg border border-transparent bg-surface-muted p-3 text-left hover:border-border-strong hover:bg-surface disabled:cursor-default"
                onClick={() => onEditLine(line)}
              >
                <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-2">
                  <span className="font-bold tabular-nums text-text-primary">{line.quantity}×</span>
                  <span className="min-w-0">
                    <span className="block font-bold text-text-primary">{line.name}</span>
                    {line.servingLabel ? (
                      <span className="mt-1 block text-sm text-text-secondary">{line.servingLabel}</span>
                    ) : null}
                    {line.modifierSummary ? (
                      <span className="mt-1 block text-sm leading-5 text-text-secondary">
                        {line.modifierSummary}
                      </span>
                    ) : null}
                    {line.note ? (
                      <span className="mt-1 block line-clamp-2 text-sm italic text-text-secondary">
                        {line.note}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-bold tabular-nums text-text-primary">
                    {formatMoney(line.lineTotal, currencyCode || "UGX")}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <footer className="border-t border-border-subtle bg-surface px-4 py-4">
        <dl className="grid gap-2 text-sm">
          <div className="flex items-center justify-between gap-4 text-text-secondary">
            <dt>Subtotal</dt>
            <dd className="font-bold tabular-nums text-text-primary">{formatMoney(order.subtotal, currencyCode || "UGX")}</dd>
          </div>
          {order.tax && order.tax > 0 ? (
            <div className="flex items-center justify-between gap-4 text-text-secondary">
              <dt>Tax</dt>
              <dd className="font-bold tabular-nums text-text-primary">{formatMoney(order.tax, currencyCode || "UGX")}</dd>
            </div>
          ) : null}
          {order.discount && order.discount > 0 ? (
            <div className="flex items-center justify-between gap-4 text-text-secondary">
              <dt>Discount</dt>
              <dd className="font-bold tabular-nums text-text-primary">− {formatMoney(order.discount, currencyCode || "UGX")}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 pt-1 text-base">
            <dt className="font-bold text-text-primary">Total</dt>
            <dd className="text-xl font-bold tabular-nums text-text-primary">{formatMoney(order.total, currencyCode || "UGX")}</dd>
          </div>
        </dl>
        <Button className="mt-4 w-full" size="pos" disabled={!canSend || isSending} onClick={onSend}>
          {isSending ? "Sending order" : "Send to kitchen/bar"}
        </Button>
        {bill ? (
          <WaiterBillActionPanel
            bill={bill}
            isRequesting={isRequestingBill}
            onRequestBill={onRequestBill}
            onViewReceipt={onViewReceipt}
          />
        ) : null}
      </footer>
    </aside>
  );
}

export function WaiterOrderBuilderScreen({
  orderId,
  initialOrder,
  expectedTableId,
  tableContext,
  startOrderOnMount = false,
  onClose,
  onOrderResolved,
}: WaiterOrderBuilderScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, branchId, clearSession, currencyCode } = useAuth();
  const { showToast } = useToast();
  const activeShift = useActiveShift();
  const [resolvedOrderId, setResolvedOrderId] = useState(orderId);
  const [resolvedOrder, setResolvedOrder] = useState<WaiterOrderApi | undefined>(initialOrder);
  const [queuedAddPayload, setQueuedAddPayload] = useState<AddOrderItemPayload | null>(null);
  const createStartedRef = useRef(false);
  const pendingItemCounterRef = useRef(0);
  const orderReadyPromiseRef = useRef<Promise<string> | null>(
    orderId ? Promise.resolve(orderId) : null,
  );
  const [search, setSearch] = useState("");
  const [sectionId, setSectionId] = useState<string>();
  const [groupId, setGroupId] = useState<string>();
  const [subgroupId, setSubgroupId] = useState("all");
  const [configurator, setConfigurator] = useState<ConfiguratorState | null>(null);
  const [receiptDrawerOpen, setReceiptDrawerOpen] = useState(false);
  const [billRequestedAt, setBillRequestedAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof performance === "undefined") return;
    performance.mark("waiter-menu-shell-visible");
    if (performance.getEntriesByName("waiter-table-click", "mark").length > 0) {
      performance.measure(
        "waiter-table-click-to-shell",
        "waiter-table-click",
        "waiter-menu-shell-visible",
      );
    }
  }, []);

  useEffect(() => {
    if (!orderId) return;
    setResolvedOrderId(orderId);
    orderReadyPromiseRef.current = Promise.resolve(orderId);
  }, [orderId]);

  useEffect(() => {
    if (initialOrder) setResolvedOrder(initialOrder);
  }, [initialOrder]);

  const orderQuery = useQuery({
    queryKey: ["waiter", "order", branchId, resolvedOrderId],
    enabled: Boolean(accessToken && branchId && resolvedOrderId),
    queryFn: () => getOrder(accessToken as string, branchId as string, resolvedOrderId as string),
    placeholderData: resolvedOrder,
    refetchOnMount: false,
    retry: shouldRetryApiRequest,
    staleTime: 15_000,
  });
  const menuQuery = useQuery({
    queryKey: ["waiter", "menu-workspace", branchId],
    enabled: Boolean(accessToken && branchId),
    queryFn: () => loadWaiterMenuWorkspace(accessToken as string, branchId as string),
    retry: shouldRetryApiRequest,
    staleTime: 5 * 60_000,
  });
  const receiptQuery = useQuery({
    queryKey: ["waiter", "receipt", branchId, resolvedOrderId],
    enabled: Boolean(accessToken && branchId && resolvedOrderId && receiptDrawerOpen),
    queryFn: () => getReceipt(accessToken as string, branchId as string, resolvedOrderId as string),
    retry: shouldRetryApiRequest,
  });
  const receiptHistoryQuery = useQuery({
    queryKey: ["waiter", "receipt-history", branchId, resolvedOrderId],
    enabled: Boolean(accessToken && branchId && resolvedOrderId && receiptDrawerOpen && receiptQuery.data),
    queryFn: () => getReceiptHistory(accessToken as string, branchId as string, resolvedOrderId as string),
    retry: shouldRetryApiRequest,
  });

  useEffect(() => {
    const errors = [orderQuery.error, menuQuery.error, receiptQuery.error];
    if (errors.some((error) => error instanceof ApiError && error.isAuthError)) clearSession();
  }, [clearSession, menuQuery.error, orderQuery.error, receiptQuery.error]);

  const createOrderMutation = useMutation({
    mutationFn: () =>
      createDineInOrder(
        accessToken as string,
        branchId as string,
        tableContext?.id as string,
      ),
    onSuccess: (createdOrder) => {
      queryClient.setQueryData(["waiter", "order", branchId, createdOrder.id], createdOrder);
      setResolvedOrderId(createdOrder.id);
      setResolvedOrder(createdOrder);
      orderReadyPromiseRef.current = Promise.resolve(createdOrder.id);
      onOrderResolved?.(createdOrder);
      showToast({
        tone: "success",
        title: "Order started",
        description: `${tableContext?.name || "Table"} is ready for item entry.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "floor"] });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "orders-queue"] });
    },
    onError: (error) => {
      showToast({
        tone: "danger",
        title: "Order creation failed",
        description: getWriteErrorCopy(error),
      });
    },
  });
  const createOrder = createOrderMutation.mutateAsync;

  const beginOrderCreation = useCallback(() => {
    if (resolvedOrderId) return Promise.resolve(resolvedOrderId);
    if (orderReadyPromiseRef.current) return orderReadyPromiseRef.current;
    if (!accessToken || !branchId || !tableContext?.id) {
      return Promise.reject(new Error("Verified table and branch context are required."));
    }

    createStartedRef.current = true;
    const promise = createOrder().then((createdOrder) => createdOrder.id);
    orderReadyPromiseRef.current = promise;
    return promise;
  }, [
    accessToken,
    branchId,
    createOrder,
    resolvedOrderId,
    tableContext?.id,
  ]);

  useEffect(() => {
    if (!startOrderOnMount || resolvedOrderId || createStartedRef.current) return;
    void beginOrderCreation().catch(() => undefined);
  }, [beginOrderCreation, resolvedOrderId, startOrderOnMount]);

  async function getVerifiedOrderId() {
    if (resolvedOrderId) return resolvedOrderId;
    return beginOrderCreation();
  }

  const writeCanonicalOrder = useCallback(
    (canonicalOrder: WaiterOrderApi) => {
      if (!branchId) return canonicalOrder;
      queryClient.setQueryData(["waiter", "order", branchId, canonicalOrder.id], canonicalOrder);
      setResolvedOrderId(canonicalOrder.id);
      setResolvedOrder(canonicalOrder);
      orderReadyPromiseRef.current = Promise.resolve(canonicalOrder.id);
      onOrderResolved?.(canonicalOrder);
      return canonicalOrder;
    },
    [branchId, onOrderResolved, queryClient],
  );

  const refreshCanonicalOrder = useCallback(
    async (orderIdToRefresh: string) => {
      if (!accessToken || !branchId) {
        throw new Error("Session and branch context are required to refresh the order.");
      }

      const queryKey = ["waiter", "order", branchId, orderIdToRefresh];
      await queryClient.cancelQueries({ queryKey });
      const canonicalOrder = await getOrder(accessToken, branchId, orderIdToRefresh);
      return writeCanonicalOrder(canonicalOrder);
    },
    [accessToken, branchId, queryClient, writeCanonicalOrder],
  );

  const mergeOrderSnapshot = useCallback(
    (orderSnapshot: WaiterOrderApi) => {
      if (!branchId) return orderSnapshot;
      const queryKey = ["waiter", "order", branchId, orderSnapshot.id];
      const current =
        queryClient.getQueryData<WaiterOrderApi>(queryKey) ||
        (resolvedOrder?.id === orderSnapshot.id ? resolvedOrder : undefined);

      return {
        ...(current || {}),
        ...orderSnapshot,
        items: orderSnapshot.items || current?.items,
        table: orderSnapshot.table || current?.table,
        user: orderSnapshot.user || current?.user,
      };
    },
    [branchId, queryClient, resolvedOrder],
  );

  const order = useMemo(() => {
    const source = orderQuery.data || resolvedOrder;
    if (!source) return null;
    const normalized = normalizeWaiterOrder(source);
    return {
      ...normalized,
      tableId: normalized.tableId || tableContext?.id,
      tableName: normalized.tableName || tableContext?.name,
    };
  }, [orderQuery.data, resolvedOrder, tableContext?.id, tableContext?.name]);
  const sections = useMemo(
    () => normalizeMenuNavigation(menuQuery.data?.navigation || []),
    [menuQuery.data?.navigation],
  );
  const allMenuItems = useMemo(
    () => flattenMenuCatalog(menuQuery.data?.catalog || {}),
    [menuQuery.data?.catalog],
  );
  const readOrderSnapshot = useCallback(
    (orderIdToRead: string) => {
      if (!branchId) return resolvedOrder?.id === orderIdToRead ? resolvedOrder : undefined;
      return (
        queryClient.getQueryData<WaiterOrderApi>(["waiter", "order", branchId, orderIdToRead]) ||
        (resolvedOrder?.id === orderIdToRead ? resolvedOrder : undefined)
      );
    },
    [branchId, queryClient, resolvedOrder],
  );
  const writeOrderItemSnapshot = useCallback(
    (orderIdToWrite: string, item: WaiterOrderItemApi, mode: "add" | "update" | "delete") => {
      const current = readOrderSnapshot(orderIdToWrite);
      if (!current) return;

      const menuItem = allMenuItems.find((entry) => entry.id === (item.menuItemId || item.menuItem?.id));
      const serving = menuItem?.servings.find((entry) => entry.id === item.menuItemServingId);
      const itemSnapshot: WaiterOrderItemApi = {
        ...item,
        menuItem: item.menuItem || (menuItem ? { id: menuItem.id, name: menuItem.name, station: menuItem.station } : undefined),
        menuItemServing:
          item.menuItemServing ||
          (serving ? { id: serving.id, label: serving.label, format: serving.label } : undefined),
      };

      const existingItems = current.items || [];
      const items =
        mode === "delete"
          ? existingItems.filter((entry) => entry.id !== item.id)
          : mode === "update"
            ? existingItems.map((entry) => (entry.id === item.id ? itemSnapshot : entry))
            : [...existingItems.filter((entry) => entry.id !== item.id), itemSnapshot];

      writeCanonicalOrder(withLineTotals({ ...current, items }));
    },
    [allMenuItems, readOrderSnapshot, writeCanonicalOrder],
  );
  const buildPendingOrderItemSnapshot = useCallback(
    (payload: AddOrderItemPayload, pendingId: string): WaiterOrderItemApi | null => {
      const menuItem = allMenuItems.find((entry) => entry.id === payload.menuItemId);
      if (!menuItem) return null;

      const serving = menuItem.servings.find((entry) => entry.id === payload.menuItemServingId);
      const modifierDelta = (payload.metadata?.selectedModifiers || []).reduce(
        (sum, modifier) => sum + moneyNumber(modifier.priceDelta),
        0,
      );
      const unitPrice = (serving?.price ?? menuItem.price ?? 0) + modifierDelta;
      const quantity = payload.quantity || 1;

      return {
        id: pendingId,
        orderId: resolvedOrderId,
        menuItemId: payload.menuItemId,
        menuItemServingId: payload.menuItemServingId,
        quantity,
        price: moneySnapshot(unitPrice),
        subtotal: moneySnapshot(unitPrice * quantity),
        notes: payload.notes,
        metadata: payload.metadata,
        menuItem: { id: menuItem.id, name: menuItem.name, station: menuItem.station },
        menuItemServing: serving ? { id: serving.id, label: serving.label, format: serving.label } : undefined,
      };
    },
    [allMenuItems, resolvedOrderId],
  );
  const activeGroupIds = useMemo(
    () => new Set(sections.flatMap((section) => section.groups.map((group) => group.id))),
    [sections],
  );

  useEffect(() => {
    if (!menuQuery.data || typeof performance === "undefined") return;
    performance.mark("waiter-menu-content-visible");
    if (performance.getEntriesByName("waiter-table-click", "mark").length > 0) {
      performance.measure(
        "waiter-table-click-to-menu-content",
        "waiter-table-click",
        "waiter-menu-content-visible",
      );
    }
  }, [menuQuery.data]);

  useEffect(() => {
    if (!initialOrder || typeof performance === "undefined") return;
    performance.mark("waiter-cached-order-visible");
    if (performance.getEntriesByName("waiter-table-click", "mark").length > 0) {
      performance.measure(
        "waiter-table-click-to-cached-order",
        "waiter-table-click",
        "waiter-cached-order-visible",
      );
    }
  }, [initialOrder]);

  useEffect(() => {
    if (!startOrderOnMount || resolvedOrderId || typeof performance === "undefined") return;
    performance.mark("waiter-order-pending-visible");
    if (performance.getEntriesByName("waiter-table-click", "mark").length > 0) {
      performance.measure(
        "waiter-table-click-to-order-pending",
        "waiter-table-click",
        "waiter-order-pending-visible",
      );
    }
  }, [resolvedOrderId, startOrderOnMount]);

  useEffect(() => {
    if (sections.length === 0) return;
    const currentSection = sections.find((section) => section.id === sectionId) || sections[0];
    const currentGroup = currentSection.groups.find((group) => group.id === groupId) || currentSection.groups[0];
    if (currentSection.id !== sectionId) setSectionId(currentSection.id);
    if (currentGroup?.id !== groupId) {
      setGroupId(currentGroup?.id);
      setSubgroupId("all");
    }
  }, [groupId, sectionId, sections]);

  const activeSection = sections.find((section) => section.id === sectionId);
  const activeGroup = activeSection?.groups.find((group) => group.id === groupId);
  const menuItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMenuItems
      .filter((item) => item.browseGroupId && activeGroupIds.has(item.browseGroupId))
      .filter((item) => {
        if (q) {
          return [item.name, item.description]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q));
        }
        if (item.browseGroupId !== groupId) return false;
        if (subgroupId === "all") return true;
        return item.browseSubgroupId === subgroupId;
      });
  }, [activeGroupIds, allMenuItems, groupId, search, subgroupId]);
  const menuIsInitialLoading = menuQuery.isPending && !menuQuery.data;
  const menuLoadFailed = menuQuery.isError && !menuQuery.data;
  const menuConfigurationEmpty = menuQuery.isSuccess && !menuQuery.isFetching && sections.length === 0;

  const shiftIsOpen = Boolean(activeShift.data);
  const orderCreationFailed = startOrderOnMount && createOrderMutation.isError && !resolvedOrderId;
  const writeDisabledReason = !shiftIsOpen
    ? "Start your shift before changing this order."
    : orderCreationFailed
      ? "Order creation failed. Your pending item choice will be kept until you retry."
    : order && !order.canEditItems
      ? "This order has been sent. Nimbus cannot safely dispatch later additions until the backend exposes per-line sent state."
      : undefined;
  const bill = order
    ? buildBillState({ order, shiftIsOpen, billRequested: Boolean(billRequestedAt) })
    : undefined;
  const receipt = useMemo(
    () => (receiptQuery.data ? normalizeWaiterReceipt(receiptQuery.data) : undefined),
    [receiptQuery.data],
  );
  const receiptHistory = useMemo(
    () => normalizeReceiptHistory(receiptHistoryQuery.data),
    [receiptHistoryQuery.data],
  );

  const addMutation = useMutation({
    mutationFn: async (payload: AddOrderItemPayload) => {
      const verifiedOrderId = await getVerifiedOrderId();
      const addedItem = await addOrderItem(accessToken as string, branchId as string, verifiedOrderId, payload);
      return { addedItem, orderId: verifiedOrderId };
    },
    onMutate: (payload) => {
      if (!resolvedOrderId) return undefined;
      const pendingId = `pending-${Date.now()}-${pendingItemCounterRef.current++}`;
      const pendingItem = buildPendingOrderItemSnapshot(payload, pendingId);
      if (!pendingItem) return undefined;
      writeOrderItemSnapshot(resolvedOrderId, pendingItem, "add");
      setConfigurator(null);
      return { orderId: resolvedOrderId, pendingItem };
    },
    onSuccess: ({ addedItem, orderId }, _payload, context) => {
      if (context?.pendingItem) writeOrderItemSnapshot(context.orderId, context.pendingItem, "delete");
      writeOrderItemSnapshot(orderId, addedItem, "add");
      void refreshCanonicalOrder(orderId).catch((error) => {
        showToast({ tone: "warning", title: "Order refresh delayed", description: getWriteErrorCopy(error) });
      });
      setQueuedAddPayload(null);
      setConfigurator(null);
      showToast({ tone: "success", title: "Item added" });
    },
    onError: (error, _payload, context) => {
      if (context?.pendingItem) writeOrderItemSnapshot(context.orderId, context.pendingItem, "delete");
      if (resolvedOrderId) setQueuedAddPayload(null);
      showToast({ tone: "danger", title: "Could not add item", description: getWriteErrorCopy(error) });
    },
  });
  const updateMutation = useMutation({
    mutationFn: async ({ line, payload }: { line: WaiterOrderLineViewModel; payload: ReturnType<typeof buildUpdateItemPayload> }) => {
      if (!resolvedOrderId) throw new Error("Order must be loaded before updating an item.");
      const updatedItem = await updateOrderItem(accessToken as string, branchId as string, resolvedOrderId, line.id, payload);
      writeOrderItemSnapshot(resolvedOrderId, updatedItem, "update");
      void refreshCanonicalOrder(resolvedOrderId).catch((error) => {
        showToast({ tone: "warning", title: "Order refresh delayed", description: getWriteErrorCopy(error) });
      });
      return updatedItem;
    },
    onSuccess: () => {
      setConfigurator(null);
      showToast({ tone: "success", title: "Item updated" });
    },
    onError: (error) =>
      showToast({ tone: "danger", title: "Could not update item", description: getWriteErrorCopy(error) }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (line: WaiterOrderLineViewModel) => {
      if (!resolvedOrderId) throw new Error("Order must be loaded before removing an item.");
      await deleteOrderItem(accessToken as string, branchId as string, resolvedOrderId, line.id);
      writeOrderItemSnapshot(
        resolvedOrderId,
        {
          id: line.id,
          orderId: resolvedOrderId,
          menuItemId: line.menuItemId,
          menuItemServingId: line.menuItemServingId,
          quantity: line.quantity,
          price: line.unitPrice,
          subtotal: line.lineTotal,
          notes: line.note,
          metadata: line.metadata,
        },
        "delete",
      );
      void refreshCanonicalOrder(resolvedOrderId).catch((error) => {
        showToast({ tone: "warning", title: "Order refresh delayed", description: getWriteErrorCopy(error) });
      });
    },
    onSuccess: () => {
      setConfigurator(null);
      showToast({ tone: "success", title: "Item removed" });
    },
    onError: (error) =>
      showToast({ tone: "danger", title: "Could not remove item", description: getWriteErrorCopy(error) }),
  });
  const configureMutation = useMutation({
    mutationFn: ({ item, line }: { item: WaiterMenuItemViewModel; line?: WaiterOrderLineViewModel }) =>
      queryClient
        .fetchQuery({
          queryKey: ["waiter", "menu-item-config", branchId, item.id],
          queryFn: () => getMenuItemConfiguration(accessToken as string, branchId as string, item.id),
          staleTime: 5 * 60_000,
        })
        .then((data) => ({ data, line })),
    onSuccess: async ({ data, line }) => {
      const item = normalizeMenuItemConfiguration(data);
      if (!item.available) {
        showToast({ tone: "warning", title: "Item unavailable" });
        return;
      }
      const defaultServing = item.servings.find((serving) => serving.isDefault) || item.servings[0];
      if (!line && item.servings.length <= 1 && item.modifierGroups.length === 0) {
        const payload = buildAddItemPayload({
          item,
          serving: defaultServing,
          quantity: 1,
          note: "",
          selectedOptionIds: [],
        });
        setQueuedAddPayload(payload);
        addMutation.mutate(payload);
        return;
      }
      setConfigurator({
        mode: line ? "edit" : "add",
        item,
        line,
        quantity: line?.quantity || 1,
        note: line?.note || "",
        servingId: line?.menuItemServingId || defaultServing?.id,
        selectedOptionIds: selectedOptionIdsFromMetadata(line?.metadata),
      });
    },
    onError: (error) =>
      showToast({ tone: "danger", title: "Could not load item options", description: getWriteErrorCopy(error) }),
  });
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!resolvedOrderId) throw new Error("Order must be loaded before sending.");
      const sentOrder = await sendOrder(accessToken as string, branchId as string, resolvedOrderId, {});
      writeCanonicalOrder(mergeOrderSnapshot(sentOrder));
      void refreshCanonicalOrder(resolvedOrderId).catch((error) => {
        showToast({ tone: "warning", title: "Order refresh delayed", description: getWriteErrorCopy(error) });
      });
      return sentOrder;
    },
    onSuccess: () => {
      showToast({ tone: "success", title: "Order sent to kitchen/bar" });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "floor"] });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "orders-queue"] });
    },
    onError: (error) =>
      showToast({ tone: "danger", title: "Could not send order", description: getWriteErrorCopy(error) }),
  });
  const requestBillMutation = useMutation({
    mutationFn: () => requestOrderBill(accessToken as string, branchId as string, resolvedOrderId as string),
    onSuccess: async (result) => {
      const normalized = normalizeRequestBillResult(result);
      setBillRequestedAt(normalized.requestedAt || new Date().toISOString());
      showToast({
        tone: "success",
        title: "Bill requested",
        description: "Payment collection remains outside the waiter workspace.",
      });
      if (resolvedOrderId) {
        void refreshCanonicalOrder(resolvedOrderId).catch((error) => {
          showToast({ tone: "warning", title: "Order refresh delayed", description: getWriteErrorCopy(error) });
        });
      }
      setReceiptDrawerOpen(true);
    },
    onError: (error) =>
      showToast({ tone: "danger", title: "Could not request bill", description: getWriteErrorCopy(error) }),
  });
  const reprintMutation = useMutation({
    mutationFn: () => reprintReceipt(accessToken as string, branchId as string, resolvedOrderId as string),
    onSuccess: () => {
      showToast({
        tone: "success",
        title: "Reprint request recorded",
        description: "No print-driver completion is guaranteed.",
      });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "receipt-history", branchId, resolvedOrderId] });
    },
    onError: (error) =>
      showToast({ tone: "danger", title: "Reprint failed", description: getWriteErrorCopy(error) }),
  });
  const sendReceiptMutation = useMutation({
    mutationFn: (payload: { channel: ReceiptSendChannel; recipient: string }) =>
      sendReceipt(accessToken as string, branchId as string, resolvedOrderId as string, {
        ...payload,
        locale: "en",
        note: "Recorded from waiter receipt drawer.",
      }),
    onSuccess: (result) => {
      const normalized = normalizeSendReceiptResult(result);
      showToast({
        tone: normalized?.status === "PENDING" ? "warning" : "info",
        title: normalized?.status === "PENDING" ? "Receipt send pending" : "Receipt send recorded",
        description: normalized?.copy,
      });
      void queryClient.invalidateQueries({ queryKey: ["waiter", "receipt-history", branchId, resolvedOrderId] });
    },
    onError: (error) =>
      showToast({ tone: "danger", title: "Send receipt failed", description: getWriteErrorCopy(error) }),
  });

  const queuedAddIsError = addMutation.isError;
  const queuedAddIsPending = addMutation.isPending;
  const retryQueuedAdd = addMutation.mutate;
  const resetQueuedAdd = addMutation.reset;

  useEffect(() => {
    if (!resolvedOrderId || !queuedAddPayload || queuedAddIsPending || !queuedAddIsError) {
      return;
    }

    resetQueuedAdd();
    retryQueuedAdd(queuedAddPayload);
  }, [
    queuedAddPayload,
    queuedAddIsError,
    queuedAddIsPending,
    resolvedOrderId,
    resetQueuedAdd,
    retryQueuedAdd,
  ]);

  function closeWorkspace() {
    if (onClose) onClose();
    else void router.push("/waiter/floor");
  }

  function retryOrderCreation() {
    createOrderMutation.reset();
    createStartedRef.current = false;
    orderReadyPromiseRef.current = null;
    void beginOrderCreation().catch(() => undefined);
  }

  function submitConfigurator() {
    if (!configurator) return;
    const serving = configurator.item.servings.find((entry) => entry.id === configurator.servingId);
    if (configurator.mode === "edit" && configurator.line) {
      updateMutation.mutate({
        line: configurator.line,
        payload: buildUpdateItemPayload({
          item: configurator.item,
          serving,
          quantity: configurator.quantity,
          note: configurator.note,
          selectedOptionIds: configurator.selectedOptionIds,
        }),
      });
      return;
    }
    const payload = buildAddItemPayload({
      item: configurator.item,
      serving,
      quantity: configurator.quantity,
      note: configurator.note,
      selectedOptionIds: configurator.selectedOptionIds,
    });
    setQueuedAddPayload(payload);
    addMutation.mutate(payload);
  }

  if (expectedTableId && orderQuery.data?.tableId && orderQuery.data.tableId !== expectedTableId) {
    return (
      <div className="fixed inset-0 z-[80] grid place-items-center bg-page p-6">
        <div className="grid gap-4">
          <ErrorState title="Order table mismatch" description="This order belongs to a different table." />
          <Button onClick={closeWorkspace}>Back to Floor</Button>
        </div>
      </div>
    );
  }

  const workspaceOrder: WaiterOrderViewModel = order || {
    id: resolvedOrderId || `pending-${tableContext?.id || "table"}`,
    orderNumber: resolvedOrderId ? "Order details unavailable" : "Order number pending",
    tableId: tableContext?.id,
    tableName: tableContext?.name || "Dine-in order",
    status: "NEW",
    subtotal: 0,
    tax: 0,
    discount: 0,
    total: 0,
    items: [],
    canEditItems: false,
    canSend: false,
  };
  const orderState: "pending" | "refreshing" | "ready" | "error" = orderCreationFailed
    ? "error"
    : !resolvedOrderId
      ? "pending"
      : orderQuery.isFetching
        ? "refreshing"
        : orderQuery.isError
          ? "error"
          : "ready";
  const orderStateMessage = orderCreationFailed
    ? getWriteErrorCopy(createOrderMutation.error)
    : orderQuery.isError
      ? getOrderErrorCopy(orderQuery.error).description
      : undefined;
  const itemCount = workspaceOrder.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <div
      className="fixed inset-0 z-[80] flex min-h-0 flex-col bg-page"
      data-testid="waiter-order-workspace"
    >
      <header className="flex min-h-20 items-center justify-between gap-6 border-b border-border-subtle bg-surface px-5">
        <div className="flex min-w-0 items-center gap-4">
          <Button variant="secondary" leadingIcon={<ArrowLeft size={18} weight="bold" aria-hidden />} onClick={closeWorkspace}>
            Back to Floor
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold text-text-primary">{workspaceOrder.tableName || "Dine-in order"}</h1>
              <Badge variant={statusTone(workspaceOrder.status)}>{titleCase(workspaceOrder.status)}</Badge>
              <Badge variant="info">Mine</Badge>
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-text-secondary">
              {workspaceOrder.orderNumber} · Assigned to {workspaceOrder.waiterName || "current waiter"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-6 text-right">
          <div>
            <p className="text-xs font-semibold text-text-muted">Items</p>
            <p className="mt-1 font-bold tabular-nums text-text-primary">{itemCount}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-text-muted">Running total</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-text-primary">{formatMoney(workspaceOrder.total, currencyCode || "UGX")}</p>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[160px_minmax(0,1fr)_360px] xl:grid-cols-[180px_minmax(0,1fr)_400px]">
        <MenuNavigation
          sections={sections}
          activeSectionId={sectionId}
          activeGroupId={groupId}
          onSectionChange={(section) => {
            setSectionId(section.id);
            setGroupId(section.groups[0]?.id);
            setSubgroupId("all");
          }}
          onGroupChange={(group) => {
            setGroupId(group.id);
            setSubgroupId("all");
          }}
        />

        <main className="min-h-0 overflow-y-auto px-5 py-5">
          <div className="sticky top-0 z-10 -mx-5 -mt-5 border-b border-border-subtle bg-page px-5 py-4">
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1 overflow-x-auto">
                <div className="flex min-w-max gap-2">
                  {search ? (
                    <span className="flex min-h-11 items-center rounded-full bg-brand-navy-900 px-4 text-sm font-semibold text-text-inverse">
                      Search results
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        data-testid="waiter-menu-subgroup-all"
                        className={cn(
                          "min-h-11 rounded-full px-4 text-sm font-semibold",
                          subgroupId === "all"
                            ? "bg-brand-navy-900 text-text-inverse"
                            : "bg-surface text-text-secondary shadow-subtle",
                        )}
                        onClick={() => setSubgroupId("all")}
                      >
                        All {activeGroup?.name || "items"}
                      </button>
                      {(activeGroup?.subgroups || []).map((subgroup) => (
                        <button
                          key={subgroup.id}
                          type="button"
                          data-testid="waiter-menu-subgroup"
                          className={cn(
                            "min-h-11 rounded-full px-4 text-sm font-semibold",
                            subgroupId === subgroup.id
                              ? "bg-brand-navy-900 text-text-inverse"
                              : "bg-surface text-text-secondary shadow-subtle",
                          )}
                          onClick={() => setSubgroupId(subgroup.id)}
                        >
                          {subgroup.name}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
              <SearchInput
                value={search}
                className="w-[min(320px,32vw)] shrink-0"
                aria-label="Search entire menu"
                placeholder="Search entire menu"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          {menuIsInitialLoading ? (
            <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {Array.from({ length: 12 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)}
            </div>
          ) : menuLoadFailed ? (
            <div className="mt-5 grid gap-3">
              <ErrorState title="Could not load menu" description={getWriteErrorCopy(menuQuery.error)} />
              <Button variant="secondary" onClick={() => void menuQuery.refetch()}>
                Retry menu
              </Button>
            </div>
          ) : menuConfigurationEmpty ? (
            <div className="mt-5"><EmptyState icon={<WarningCircle size={32} weight="duotone" />} title="Menu navigation unavailable" description="Ask a manager to configure active menu browse groups." /></div>
          ) : menuItems.length === 0 ? (
            <div className="mt-5"><EmptyState icon={<WarningCircle size={32} weight="duotone" />} title="No menu items found" description={search ? "Clear the search or try another item name." : "This browse location has no assigned active items."} /></div>
          ) : (
            <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
              {menuItems.map((item) => (
                <MenuItemTile
                  key={item.id}
                  item={item}
                  currencyCode={currencyCode}
                  disabled={Boolean(writeDisabledReason) || configureMutation.isPending || addMutation.isPending}
                  onSelect={() => configureMutation.mutate({ item })}
                />
              ))}
            </div>
          )}
        </main>

        <OrderPanel
          order={workspaceOrder}
          currencyCode={currencyCode}
          bill={bill}
          orderState={orderState}
          orderStateMessage={orderStateMessage}
          writeDisabledReason={writeDisabledReason}
          isSending={sendMutation.isPending}
          isRequestingBill={requestBillMutation.isPending}
          onEditLine={(line) => {
            const item = allMenuItems.find((entry) => entry.id === line.menuItemId);
            if (item) configureMutation.mutate({ item, line });
            else showToast({ tone: "danger", title: "Item configuration unavailable" });
          }}
          onSend={() => sendMutation.mutate()}
          onRequestBill={() => requestBillMutation.mutate()}
          onViewReceipt={() => setReceiptDrawerOpen(true)}
          onRetryOrder={retryOrderCreation}
        />
      </div>

      {configurator ? (
        <ItemConfigurator
          state={configurator}
          currencyCode={currencyCode}
          isSaving={addMutation.isPending || updateMutation.isPending}
          isRemoving={deleteMutation.isPending}
          onChange={setConfigurator}
          onClose={() => setConfigurator(null)}
          onSubmit={submitConfigurator}
          onRemove={() => configurator.line && deleteMutation.mutate(configurator.line)}
        />
      ) : null}

      <WaiterReceiptDrawer
        open={receiptDrawerOpen}
        receipt={receipt}
        history={receiptHistory}
        isLoadingReceipt={receiptQuery.isLoading}
        isLoadingHistory={receiptHistoryQuery.isLoading}
        receiptError={receiptQuery.error instanceof Error ? receiptQuery.error.message : undefined}
        historyError={receiptHistoryQuery.error instanceof Error ? receiptHistoryQuery.error.message : undefined}
        actionMessage={null}
        isReprinting={reprintMutation.isPending}
        isSending={sendReceiptMutation.isPending}
        onClose={() => setReceiptDrawerOpen(false)}
        onReprint={() => reprintMutation.mutate()}
        onSend={(payload) => sendReceiptMutation.mutate(payload)}
      />
    </div>
  );
}
