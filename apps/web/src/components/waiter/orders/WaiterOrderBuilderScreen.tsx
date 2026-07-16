import {
  ArrowLeft,
  CheckCircle,
  Minus,
  NotePencil,
  PaperPlaneTilt,
  Plus,
  Receipt,
  Sliders,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  BlockedState,
  Button,
  Card,
  EmptyState,
  ErrorState,
  SearchInput,
  Skeleton,
  StatusMessage,
} from "@/components/ui";
import { WaiterBillActionPanel, WaiterReceiptDrawer } from "@/components/waiter/receipts";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils/cn";
import {
  addOrderItem,
  deleteOrderItem,
  getMenuCatalog,
  getMenuItemConfiguration,
  getOrder,
  sendOrder,
  updateOrderItem,
} from "@/lib/waiter/order-api";
import {
  buildAddItemPayload,
  buildUpdateItemPayload,
  formatMoney,
  modifierSelectionIsValid,
  normalizeMenuCatalog,
  normalizeMenuItemConfiguration,
  normalizeWaiterOrder,
  type WaiterMenuCategoryViewModel,
  type WaiterMenuItemConfigurationViewModel,
  type WaiterMenuItemViewModel,
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
  orderId: string;
};

type ConfigSheetState = {
  item: WaiterMenuItemConfigurationViewModel;
  quantity: number;
  note: string;
  servingId?: string;
  selectedOptionIds: string[];
};

type LineEditState = {
  line: WaiterOrderLineViewModel;
  quantity: number;
  note: string;
};

function getOrderErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "ORDER_NOT_OWNED_BY_WAITER") {
      return {
        title: "This order belongs to another waiter.",
        description: "Editable order actions are blocked.",
        blocked: true,
      };
    }

    if (error.code === "SHIFT_NOT_OPEN") {
      return {
        title: "Shift not started",
        description: "Start shift before taking service actions.",
        blocked: false,
      };
    }

    if (error.isForbidden) {
      return {
        title: "Order access blocked",
        description: "This waiter account does not have permission to open this order.",
        blocked: true,
      };
    }

    return {
      title: "Could not load order",
      description: error.message,
      blocked: false,
    };
  }

  return {
    title: "Could not load order",
    description: error instanceof Error ? error.message : "Try again when the connection is stable.",
    blocked: false,
  };
}

function getWriteErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "SHIFT_NOT_OPEN") return "Shift not started: service actions disabled.";
    if (error.code === "ORDER_NOT_OWNED_BY_WAITER") return "This order belongs to another waiter.";
    if (error.code === "ORDER_TRANSITION_NOT_WAITER_SAFE") {
      return "This action is not available for waiter role.";
    }
    return error.message;
  }

  return error instanceof Error ? error.message : "Action failed.";
}

function statusTone(status: string): "neutral" | "success" | "warning" | "danger" | "info" {
  if (status === "NEW") return "neutral";
  if (status === "SENT" || status === "IN_KITCHEN" || status === "READY") return "info";
  if (status === "SERVED") return "success";
  if (status === "VOIDED" || status === "CLOSED") return "danger";
  return "neutral";
}

function titleCaseStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase());
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
      description: "Order remains readable, but bill actions need an open shift.",
      canRequestBill: false,
      requestDisabledReason: "Shift not started: service actions disabled.",
      canViewReceipt: order.status !== "NEW",
      receiptId: order.id,
    };
  }

  if (order.status === "NEW") {
    return {
      label: "Not sent",
      tone: "neutral",
      description: "Send the order before asking cashier/payment flow for the bill.",
      canRequestBill: false,
      requestDisabledReason: "Send order before requesting bill.",
      canViewReceipt: false,
      receiptId: order.id,
    };
  }

  if (order.status === "CLOSED" || order.status === "VOIDED") {
    return {
      label: "Receipt exists",
      tone: "success",
      description: "Receipt preview and history are available for this completed order.",
      canRequestBill: false,
      requestDisabledReason: "This order is already completed.",
      canViewReceipt: true,
      receiptId: order.id,
    };
  }

  if (billRequested) {
    return {
      label: "Bill requested",
      tone: "warning",
      description: "Bill requested. Payment collection remains outside the waiter MVP.",
      canRequestBill: true,
      canViewReceipt: true,
      receiptId: order.id,
    };
  }

  return {
    label: "Ready",
    tone: "info",
    description: "Request bill records the waiter-safe bill signal. No payment is collected here.",
    canRequestBill: true,
    canViewReceipt: true,
    receiptId: order.id,
  };
}

function MenuSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 9 }).map((_, index) => (
        <div key={index} className="min-h-[154px] rounded-lg bg-surface p-5 shadow-subtle">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <div className="mt-6 flex items-center justify-between">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryChips({
  categories,
  activeCategoryId,
  onChange,
}: {
  categories: WaiterMenuCategoryViewModel[];
  activeCategoryId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className={cn(
          "min-h-11 rounded-full px-4 text-sm font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
          activeCategoryId === "all"
            ? "bg-brand-navy-900 text-text-inverse"
            : "bg-surface-muted text-text-secondary hover:bg-surface",
        )}
        onClick={() => onChange("all")}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          className={cn(
            "min-h-11 rounded-full px-4 text-sm font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
            activeCategoryId === category.id
              ? "bg-brand-navy-900 text-text-inverse"
              : "bg-surface-muted text-text-secondary hover:bg-surface",
          )}
          onClick={() => onChange(category.id)}
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}

function MenuItemCard({
  item,
  disabled,
  onAdd,
  onDetails,
}: {
  item: WaiterMenuItemViewModel;
  disabled: boolean;
  onAdd: () => void;
  onDetails: () => void;
}) {
  return (
    <Card padded={false} className="flex min-h-[154px] flex-col justify-between p-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-bold tracking-normal text-text-primary">{item.name}</p>
            {item.categoryName ? (
              <p className="mt-1 text-sm font-medium text-text-muted">{item.categoryName}</p>
            ) : null}
          </div>
          <Badge variant={item.available ? "success" : "warning"}>
            {item.available ? "Available" : "Unavailable"}
          </Badge>
        </div>
        {item.description ? (
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-text-secondary">
            {item.description}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="tabular-nums text-base font-bold text-text-primary">
          {formatMoney(item.price)}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="compact"
            staticPress
            leadingIcon={<Sliders size={18} weight="bold" aria-hidden />}
            disabled={disabled || !item.available}
            onClick={onDetails}
          >
            Details
          </Button>
          <Button
            size="compact"
            leadingIcon={<Plus size={18} weight="bold" aria-hidden />}
            disabled={disabled || !item.available}
            onClick={onAdd}
          >
            Add
          </Button>
        </div>
      </div>
    </Card>
  );
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
    <div className="inline-flex items-center overflow-hidden rounded-md bg-surface shadow-subtle">
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center text-text-secondary transition-[background-color,transform] duration-150 ease-out hover:bg-surface-muted active:scale-[0.96] disabled:text-text-muted"
        disabled={disabled || value <= 1}
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <Minus size={16} weight="bold" aria-hidden />
      </button>
      <span className="min-w-10 px-2 text-center text-sm font-bold tabular-nums text-text-primary">
        {value}
      </span>
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center text-text-secondary transition-[background-color,transform] duration-150 ease-out hover:bg-surface-muted active:scale-[0.96] disabled:text-text-muted"
        disabled={disabled}
        aria-label="Increase quantity"
        onClick={() => onChange(value + 1)}
      >
        <Plus size={16} weight="bold" aria-hidden />
      </button>
    </div>
  );
}

function ItemConfigurationSheet({
  state,
  isSaving,
  onClose,
  onChange,
  onSubmit,
}: {
  state: ConfigSheetState;
  isSaving: boolean;
  onClose: () => void;
  onChange: (state: ConfigSheetState) => void;
  onSubmit: () => void;
}) {
  const serving =
    state.item.servings.find((entry) => entry.id === state.servingId) ||
    state.item.servings.find((entry) => entry.isDefault) ||
    state.item.servings[0];
  const valid = modifierSelectionIsValid(state.item.modifierGroups, state.selectedOptionIds);

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
    <Card className="fixed bottom-28 right-8 z-50 max-h-[calc(100vh-180px)] w-[420px] overflow-y-auto shadow-overlay">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-bold tracking-normal text-text-primary">{state.item.name}</p>
          <p className="mt-1 text-sm text-text-secondary">Modifiers and notes apply to this item only.</p>
        </div>
        <button
          type="button"
          aria-label="Close item options"
          className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-muted text-text-secondary transition-[background-color,transform] duration-150 ease-out hover:bg-surface active:scale-[0.96]"
          onClick={onClose}
        >
          <X size={18} weight="bold" aria-hidden />
        </button>
      </div>

      <div className="mt-5 grid gap-5">
        <div>
          <p className="mb-2 text-sm font-bold text-text-primary">Quantity</p>
          <QuantityStepper
            value={state.quantity}
            disabled={isSaving}
            onChange={(quantity) => onChange({ ...state, quantity })}
          />
        </div>

        {state.item.servings.length > 0 ? (
          <div>
            <p className="mb-2 text-sm font-bold text-text-primary">Serving</p>
            <div className="grid gap-2">
              {state.item.servings.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={cn(
                    "flex min-h-11 items-center justify-between gap-3 rounded-md px-3 text-left text-sm font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
                    serving?.id === entry.id
                      ? "bg-brand-navy-900 text-text-inverse"
                      : "bg-surface-muted text-text-secondary hover:bg-surface",
                  )}
                  onClick={() => onChange({ ...state, servingId: entry.id })}
                >
                  <span>{entry.label}</span>
                  <span className="tabular-nums">{formatMoney(entry.price)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {state.item.modifierGroups.map((group) => (
          <div key={group.id}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-text-primary">{group.name}</p>
              <Badge variant={group.required ? "warning" : "neutral"}>
                {group.required ? "Required" : "Optional"}
              </Badge>
            </div>
            <div className="grid gap-2">
              {group.options.map((option) => {
                const selected = state.selectedOptionIds.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={cn(
                      "flex min-h-11 items-center justify-between gap-3 rounded-md px-3 text-left text-sm font-semibold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
                      selected
                        ? "bg-brand-navy-900 text-text-inverse"
                        : "bg-surface-muted text-text-secondary hover:bg-surface",
                    )}
                    onClick={() => toggleOption(group.id, option.id)}
                  >
                    <span>{option.name}</span>
                    <span className="tabular-nums">
                      {option.priceDelta ? `+${formatMoney(option.priceDelta)}` : "Included"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-text-primary">Item note</span>
          <textarea
            className="min-h-24 w-full resize-none rounded-md bg-surface px-4 py-3 text-base text-text-primary shadow-subtle transition-[background-color,box-shadow] duration-150 ease-out placeholder:text-text-muted disabled:bg-surface-muted"
            maxLength={500}
            value={state.note}
            disabled={isSaving}
            placeholder="No onions, extra ice, medium rare"
            onChange={(event) => onChange({ ...state, note: event.target.value })}
          />
        </label>
      </div>

      {!valid ? (
        <p className="mt-4 rounded-md bg-status-warning-surface px-3 py-2 text-sm font-semibold text-status-warning">
          Complete required modifier choices before adding this item.
        </p>
      ) : null}

      <Button
        className="mt-5 w-full"
        size="pos"
        disabled={isSaving || !valid}
        leadingIcon={<Plus size={22} weight="bold" aria-hidden />}
        onClick={onSubmit}
      >
        {isSaving ? "Adding item" : "Add item"}
      </Button>
    </Card>
  );
}

function OrderContextBar({ order }: { order: WaiterOrderViewModel }) {
  const router = useRouter();

  return (
    <Card className="flex min-h-20 items-center justify-between gap-6">
      <div className="flex min-w-0 items-center gap-4">
        <Button
          variant="secondary"
          leadingIcon={<ArrowLeft size={18} weight="bold" />}
          onClick={() => void router.push("/waiter/floor")}
        >
          Back to Floor
        </Button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xl font-bold tracking-normal text-text-primary">
              {order.tableName || "Dine-in order"}
            </p>
            <Badge variant={statusTone(order.status)}>{titleCaseStatus(order.status)}</Badge>
          </div>
          <p className="mt-1 text-sm font-semibold text-text-secondary">
            {order.orderNumber}
            {order.elapsedLabel ? ` / ${order.elapsedLabel}` : ""}
            {order.billState ? ` / ${order.billState}` : ""}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold text-text-muted">Running total</p>
        <p className="text-xl font-bold tabular-nums text-text-primary">{formatMoney(order.total)}</p>
      </div>
    </Card>
  );
}

function OrderPanel({
  order,
  writeDisabledReason,
  bill,
  isSending,
  isRequestingBill,
  onSend,
  onRequestBill,
  onViewReceipt,
  onEditLine,
  onDeleteLine,
}: {
  order: WaiterOrderViewModel;
  writeDisabledReason?: string;
  bill: WaiterBillStateViewModel;
  isSending: boolean;
  isRequestingBill: boolean;
  onSend: () => void;
  onRequestBill: () => void;
  onViewReceipt: () => void;
  onEditLine: (line: WaiterOrderLineViewModel) => void;
  onDeleteLine: (line: WaiterOrderLineViewModel) => void;
}) {
  const canSend = !writeDisabledReason && order.canSend && order.items.length > 0;

  return (
    <Card className="min-h-[620px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-bold tracking-normal text-text-primary">Order</p>
          <p className="mt-1 text-sm text-text-secondary">{order.items.length} items</p>
        </div>
        <Receipt size={24} weight="duotone" className="text-text-muted" aria-hidden />
      </div>

      {writeDisabledReason ? (
        <StatusMessage tone="warning" title="Service actions disabled">
          {writeDisabledReason}
        </StatusMessage>
      ) : null}

      <div className="mt-5 grid gap-3">
        {order.items.length === 0 ? (
          <div className="rounded-md bg-surface-muted p-4 text-sm font-medium text-text-secondary">
            No items yet. Add from the menu before sending.
          </div>
        ) : (
          order.items.map((line) => (
            <div key={line.id} className="rounded-md bg-surface-muted p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-text-primary">{line.name}</p>
                  <p className="mt-1 text-sm text-text-secondary">
                    Qty <span className="tabular-nums">{line.quantity}</span>
                    {line.servingLabel ? ` / ${line.servingLabel}` : ""}
                  </p>
                  {line.modifierSummary ? (
                    <p className="mt-1 text-sm text-text-secondary">{line.modifierSummary}</p>
                  ) : null}
                  {line.note ? (
                    <p className="mt-2 rounded-md bg-surface px-2 py-1 text-sm text-text-secondary">
                      {line.note}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums text-text-primary">
                  {formatMoney(line.lineTotal)}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                {line.locked ? (
                  <span className="text-xs font-semibold text-text-muted">{line.lockedReason}</span>
                ) : (
                  <span className="text-xs font-semibold text-text-muted">Item-level note only</span>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    size="compact"
                    variant="secondary"
                    leadingIcon={<NotePencil size={16} weight="bold" aria-hidden />}
                    disabled={Boolean(writeDisabledReason) || line.locked}
                    onClick={() => onEditLine(line)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="compact"
                    variant="danger"
                    leadingIcon={<Trash size={16} weight="bold" aria-hidden />}
                    disabled={Boolean(writeDisabledReason) || line.locked}
                    onClick={() => onDeleteLine(line)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 border-t border-border-subtle pt-5">
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>Subtotal</span>
          <span className="font-bold tabular-nums text-text-primary">{formatMoney(order.subtotal)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-base">
          <span className="font-bold text-text-primary">Total</span>
          <span className="text-xl font-bold tabular-nums text-text-primary">
            {formatMoney(order.total)}
          </span>
        </div>
      </div>

      <Button
        className="mt-6 w-full"
        size="pos"
        disabled={!canSend || isSending}
        leadingIcon={<PaperPlaneTilt size={22} weight="bold" aria-hidden />}
        onClick={onSend}
      >
        {isSending ? "Sending order" : "Send to kitchen/bar"}
      </Button>

      <WaiterBillActionPanel
        bill={bill}
        isRequesting={isRequestingBill}
        onRequestBill={onRequestBill}
        onViewReceipt={onViewReceipt}
      />
    </Card>
  );
}

function LineEditPanel({
  state,
  isSaving,
  onChange,
  onClose,
  onSave,
}: {
  state: LineEditState;
  isSaving: boolean;
  onChange: (state: LineEditState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Card className="fixed bottom-28 right-8 z-50 w-[420px] shadow-overlay">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-bold tracking-normal text-text-primary">{state.line.name}</p>
          <p className="mt-1 text-sm text-text-secondary">Update quantity and item-level note.</p>
        </div>
        <button
          type="button"
          aria-label="Close item editor"
          className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-muted text-text-secondary transition-[background-color,transform] duration-150 ease-out hover:bg-surface active:scale-[0.96]"
          onClick={onClose}
        >
          <X size={18} weight="bold" aria-hidden />
        </button>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-sm font-bold text-text-primary">Quantity</p>
        <QuantityStepper
          value={state.quantity}
          disabled={isSaving}
          onChange={(quantity) => onChange({ ...state, quantity })}
        />
      </div>

      <label className="mt-5 block">
        <span className="mb-2 block text-sm font-bold text-text-primary">Item note</span>
        <textarea
          className="min-h-24 w-full resize-none rounded-md bg-surface px-4 py-3 text-base text-text-primary shadow-subtle transition-[background-color,box-shadow] duration-150 ease-out placeholder:text-text-muted disabled:bg-surface-muted"
          maxLength={500}
          value={state.note}
          disabled={isSaving}
          placeholder="No onions, extra ice, medium rare"
          onChange={(event) => onChange({ ...state, note: event.target.value })}
        />
      </label>

      <Button
        className="mt-5 w-full"
        size="pos"
        disabled={isSaving}
        leadingIcon={<CheckCircle size={22} weight="bold" aria-hidden />}
        onClick={onSave}
      >
        {isSaving ? "Saving item" : "Save item"}
      </Button>
    </Card>
  );
}

export function WaiterOrderBuilderScreen({ orderId }: WaiterOrderBuilderScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, branchId, clearSession } = useAuth();
  const activeShift = useActiveShift();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [configState, setConfigState] = useState<ConfigSheetState | null>(null);
  const [lineEdit, setLineEdit] = useState<LineEditState | null>(null);
  const [receiptDrawerOpen, setReceiptDrawerOpen] = useState(false);
  const [billRequestedAt, setBillRequestedAt] = useState<string | null>(null);
  const [receiptActionMessage, setReceiptActionMessage] = useState<{
    tone: "success" | "info" | "warning" | "danger";
    title: string;
    body?: string;
  } | null>(null);

  const orderQuery = useQuery({
    queryKey: ["waiter", "order", branchId, orderId],
    enabled: Boolean(accessToken && branchId && orderId),
    queryFn: () => getOrder(accessToken as string, branchId as string, orderId),
    retry: 1,
  });

  const catalogQuery = useQuery({
    queryKey: ["waiter", "menu-catalog", branchId],
    enabled: Boolean(accessToken && branchId),
    queryFn: () => getMenuCatalog(accessToken as string, branchId as string),
    retry: 1,
    staleTime: 60_000,
  });

  const receiptQuery = useQuery({
    queryKey: ["waiter", "receipt", branchId, orderId],
    enabled: Boolean(accessToken && branchId && orderId && receiptDrawerOpen),
    queryFn: () => getReceipt(accessToken as string, branchId as string, orderId),
    retry: 1,
  });

  const receiptHistoryQuery = useQuery({
    queryKey: ["waiter", "receipt-history", branchId, orderId],
    enabled: Boolean(accessToken && branchId && orderId && receiptDrawerOpen && receiptQuery.data),
    queryFn: () => getReceiptHistory(accessToken as string, branchId as string, orderId),
    retry: 1,
  });

  useEffect(() => {
    if (orderQuery.error instanceof ApiError && orderQuery.error.isAuthError) {
      clearSession();
    }
    if (receiptQuery.error instanceof ApiError && receiptQuery.error.isAuthError) {
      clearSession();
    }
  }, [clearSession, orderQuery.error, receiptQuery.error]);

  const order = useMemo(
    () => (orderQuery.data ? normalizeWaiterOrder(orderQuery.data) : null),
    [orderQuery.data],
  );
  const receipt = useMemo(
    () => (receiptQuery.data ? normalizeWaiterReceipt(receiptQuery.data) : undefined),
    [receiptQuery.data],
  );
  const receiptHistory = useMemo(
    () => normalizeReceiptHistory(receiptHistoryQuery.data),
    [receiptHistoryQuery.data],
  );
  const categories = useMemo(
    () => normalizeMenuCatalog(catalogQuery.data || {}),
    [catalogQuery.data],
  );

  const menuItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories
      .flatMap((category) => category.items)
      .filter((item) => categoryId === "all" || item.categoryId === categoryId)
      .filter((item) => {
        if (!q) return true;
        return [item.name, item.description, item.categoryName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      });
  }, [categories, categoryId, search]);

  const shiftIsOpen = Boolean(activeShift.data);
  const writeDisabledReason = !shiftIsOpen
    ? "Shift not started: service actions disabled."
    : order && !order.canEditItems
      ? "This order has already been sent. This frontend only edits unsent order items until the backend exposes per-line sent state."
      : undefined;
  const bill = order
    ? buildBillState({ order, shiftIsOpen, billRequested: Boolean(billRequestedAt) })
    : undefined;

  const invalidateOrder = async () => {
    await queryClient.invalidateQueries({ queryKey: ["waiter", "order", branchId, orderId] });
  };

  const addMutation = useMutation({
    mutationFn: (payload: ReturnType<typeof buildAddItemPayload>) =>
      addOrderItem(accessToken as string, branchId as string, orderId, payload),
    onSuccess: async () => {
      setConfigState(null);
      setSuccessMessage("Items added.");
      setWriteError(null);
      await invalidateOrder();
    },
    onError: (error) => setWriteError(getWriteErrorCopy(error)),
  });

  const configureMutation = useMutation({
    mutationFn: (item: WaiterMenuItemViewModel) =>
      getMenuItemConfiguration(accessToken as string, branchId as string, item.id),
    onSuccess: async (item) => {
      const normalized = normalizeMenuItemConfiguration(item);
      const defaultServing =
        normalized.servings.find((serving) => serving.isDefault) || normalized.servings[0];
      const simple = normalized.servings.length <= 1 && normalized.modifierGroups.length === 0;

      if (simple) {
        await addMutation.mutateAsync(
          buildAddItemPayload({
            item: normalized,
            serving: defaultServing,
            quantity: 1,
            note: "",
            selectedOptionIds: [],
          }),
        );
        return;
      }

      setConfigState({
        item: normalized,
        quantity: 1,
        note: "",
        servingId: defaultServing?.id,
        selectedOptionIds: [],
      });
      setSuccessMessage(null);
      setWriteError(null);
    },
    onError: (error) => {
      setWriteError(getWriteErrorCopy(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ line, payload }: { line: WaiterOrderLineViewModel; payload: ReturnType<typeof buildUpdateItemPayload> }) =>
      updateOrderItem(accessToken as string, branchId as string, orderId, line.id, payload),
    onSuccess: async () => {
      setLineEdit(null);
      setSuccessMessage("Item updated.");
      setWriteError(null);
      await invalidateOrder();
    },
    onError: (error) => setWriteError(getWriteErrorCopy(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (line: WaiterOrderLineViewModel) =>
      deleteOrderItem(accessToken as string, branchId as string, orderId, line.id),
    onSuccess: async () => {
      setSuccessMessage("Item removed.");
      setWriteError(null);
      await invalidateOrder();
    },
    onError: (error) => setWriteError(getWriteErrorCopy(error)),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendOrder(accessToken as string, branchId as string, orderId, {}),
    onSuccess: async () => {
      setSuccessMessage("Order sent to kitchen/bar.");
      setWriteError(null);
      await Promise.all([
        invalidateOrder(),
        queryClient.invalidateQueries({ queryKey: ["waiter", "floor"] }),
        order?.tableId
          ? queryClient.invalidateQueries({ queryKey: ["waiter", "table", branchId, order.tableId] })
          : Promise.resolve(),
      ]);
    },
    onError: (error) => setWriteError(getWriteErrorCopy(error)),
  });

  const requestBillMutation = useMutation({
    mutationFn: () => requestOrderBill(accessToken as string, branchId as string, orderId),
    onSuccess: async (result) => {
      const normalized = normalizeRequestBillResult(result);
      setBillRequestedAt(normalized.requestedAt || new Date().toISOString());
      setSuccessMessage("Bill requested.");
      setWriteError(null);
      setReceiptActionMessage({
        tone: "success",
        title: "Bill requested",
        body: "Payment collection remains outside the waiter MVP.",
      });
      await invalidateOrder();
      setReceiptDrawerOpen(true);
    },
    onError: (error) => setWriteError(getWriteErrorCopy(error)),
  });

  const reprintMutation = useMutation({
    mutationFn: () => reprintReceipt(accessToken as string, branchId as string, orderId),
    onSuccess: async () => {
      setReceiptActionMessage({
        tone: "success",
        title: "Reprint request recorded.",
        body: "No print driver was invoked by this frontend.",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["waiter", "receipt", branchId, orderId] }),
        queryClient.invalidateQueries({ queryKey: ["waiter", "receipt-history", branchId, orderId] }),
      ]);
    },
    onError: (error) => {
      setReceiptActionMessage({
        tone: "danger",
        title: "Reprint failed",
        body: getWriteErrorCopy(error),
      });
    },
  });

  const sendReceiptMutation = useMutation({
    mutationFn: (payload: { channel: ReceiptSendChannel; recipient: string }) =>
      sendReceipt(accessToken as string, branchId as string, orderId, {
        channel: payload.channel,
        recipient: payload.recipient,
        locale: "en",
        note: "Recorded from waiter receipt drawer.",
      }),
    onSuccess: async (result) => {
      const normalized = normalizeSendReceiptResult(result);
      setReceiptActionMessage({
        tone: normalized?.status === "PENDING" ? "warning" : "info",
        title: normalized?.status === "PENDING" ? "Receipt send pending" : "Receipt send recorded",
        body: normalized?.copy,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["waiter", "receipt", branchId, orderId] }),
        queryClient.invalidateQueries({ queryKey: ["waiter", "receipt-history", branchId, orderId] }),
      ]);
    },
    onError: (error) => {
      setReceiptActionMessage({
        tone: "danger",
        title: "Send receipt failed",
        body: getWriteErrorCopy(error),
      });
    },
  });

  function openItemDetails(item: WaiterMenuItemViewModel) {
    setWriteError(null);
    configureMutation.mutate(item);
  }

  function handleAddConfiguredItem() {
    if (!configState) return;
    const serving = configState.item.servings.find((entry) => entry.id === configState.servingId);
    addMutation.mutate(
      buildAddItemPayload({
        item: configState.item,
        serving,
        quantity: configState.quantity,
        note: configState.note,
        selectedOptionIds: configState.selectedOptionIds,
      }),
    );
  }

  if (orderQuery.isLoading) {
    return <SkeletonOrderBuilder />;
  }

  if (orderQuery.isError) {
    const copy = getOrderErrorCopy(orderQuery.error);
    if (copy.blocked) {
      return (
        <BlockedState
          title={copy.title}
          description={copy.description}
          action={
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={() => void router.push("/waiter/floor")}>
                Back to Floor
              </Button>
              <Button variant="secondary" onClick={() => void router.push("/waiter/orders")}>
                Back to Orders
              </Button>
            </div>
          }
        />
      );
    }

    return <ErrorState title={copy.title} description={copy.description} />;
  }

  if (!order) {
    return (
      <EmptyState
        icon={<Receipt size={32} weight="duotone" />}
        title="Order unavailable"
        description="Back to Floor and choose the table again."
      />
    );
  }

  return (
    <div className="grid gap-5">
      <OrderContextBar order={order} />

      {!shiftIsOpen && !activeShift.isLoading ? (
        <StatusMessage tone="warning" title="Shift not started">
          You can read this order, but create, item edit, removal, and send actions are disabled.
        </StatusMessage>
      ) : null}

      {successMessage ? (
        <StatusMessage tone="success" title={successMessage} />
      ) : null}

      {writeError ? (
        <StatusMessage tone="danger" title="Order action failed">
          {writeError}
        </StatusMessage>
      ) : null}

      {configureMutation.isPending ? (
        <StatusMessage tone="info" title="Loading item options">
          Checking servings and modifiers before adding the item.
        </StatusMessage>
      ) : null}

      <div className="grid grid-cols-[1fr_400px] items-start gap-6">
        <section className="grid gap-4">
          <Card className="grid gap-4">
            <div className="grid grid-cols-[1fr_320px] items-center gap-4">
              <CategoryChips
                categories={categories}
                activeCategoryId={categoryId}
                onChange={setCategoryId}
              />
              <SearchInput
                value={search}
                aria-label="Search menu"
                placeholder="Search menu"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </Card>

          {catalogQuery.isLoading ? (
            <MenuSkeleton />
          ) : catalogQuery.isError ? (
            <ErrorState
              title="Could not load menu"
              description={
                catalogQuery.error instanceof Error
                  ? catalogQuery.error.message
                  : "Ask a manager to check menu availability."
              }
            />
          ) : categories.length === 0 ? (
            <EmptyState
              icon={<WarningCircle size={32} weight="duotone" />}
              title="No menu items available."
              description="Ask a manager to check menu availability."
            />
          ) : menuItems.length === 0 ? (
            <EmptyState
              icon={<WarningCircle size={32} weight="duotone" />}
              title="No menu items match this search"
              description="Try another category or search term."
            />
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {menuItems.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  disabled={Boolean(writeDisabledReason) || addMutation.isPending}
                  onAdd={() => openItemDetails(item)}
                  onDetails={() => {
                    setConfigState(null);
                    configureMutation.mutate(item);
                  }}
                />
              ))}
            </div>
          )}
        </section>

        <div className="sticky top-36">
          {bill ? (
            <OrderPanel
              order={order}
              writeDisabledReason={writeDisabledReason}
              bill={bill}
              isSending={sendMutation.isPending}
              isRequestingBill={requestBillMutation.isPending}
              onSend={() => sendMutation.mutate()}
              onRequestBill={() => requestBillMutation.mutate()}
              onViewReceipt={() => {
                setReceiptActionMessage(null);
                setReceiptDrawerOpen(true);
              }}
              onEditLine={(line) =>
                setLineEdit({ line, quantity: line.quantity, note: line.note || "" })
              }
              onDeleteLine={(line) => deleteMutation.mutate(line)}
            />
          ) : null}
        </div>
      </div>

      {configState ? (
        <ItemConfigurationSheet
          state={configState}
          isSaving={addMutation.isPending}
          onClose={() => setConfigState(null)}
          onChange={setConfigState}
          onSubmit={handleAddConfiguredItem}
        />
      ) : null}

      {lineEdit ? (
        <LineEditPanel
          state={lineEdit}
          isSaving={updateMutation.isPending}
          onChange={setLineEdit}
          onClose={() => setLineEdit(null)}
          onSave={() =>
            updateMutation.mutate({
              line: lineEdit.line,
              payload: buildUpdateItemPayload({
                quantity: lineEdit.quantity,
                note: lineEdit.note,
                existingMetadata: lineEdit.line.metadata,
              }),
            })
          }
        />
      ) : null}

      <WaiterReceiptDrawer
        open={receiptDrawerOpen}
        receipt={receipt}
        history={receiptHistory}
        isLoadingReceipt={receiptQuery.isLoading}
        isLoadingHistory={receiptHistoryQuery.isLoading}
        receiptError={
          receiptQuery.error instanceof Error
            ? receiptQuery.error.message
            : receiptQuery.isError
              ? "Receipt unavailable."
              : undefined
        }
        historyError={
          receiptHistoryQuery.error instanceof Error
            ? receiptHistoryQuery.error.message
            : receiptHistoryQuery.isError
              ? "History unavailable."
              : undefined
        }
        actionMessage={receiptActionMessage}
        isReprinting={reprintMutation.isPending}
        isSending={sendReceiptMutation.isPending}
        onClose={() => setReceiptDrawerOpen(false)}
        onReprint={() => reprintMutation.mutate()}
        onSend={(payload) => sendReceiptMutation.mutate(payload)}
      />
    </div>
  );
}

function SkeletonOrderBuilder() {
  return (
    <div className="grid gap-5">
      <Card className="flex min-h-20 items-center justify-between">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-8 w-32" />
      </Card>
      <div className="grid grid-cols-[1fr_400px] gap-6">
        <div className="grid gap-4">
          <Card>
            <Skeleton className="h-12 w-full" />
          </Card>
          <MenuSkeleton />
        </div>
        <Card className="min-h-[620px]">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="mt-5 h-24 w-full" />
          <Skeleton className="mt-3 h-24 w-full" />
          <Skeleton className="mt-8 h-12 w-full" />
        </Card>
      </div>
    </div>
  );
}
