import { Info, WarningCircle } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { CashierEmptyState } from "@/components/cashier/states";
import { Badge, PageShell, StatusMessage } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useCashierContext } from "@/lib/cashier/context";
import { formatCashierMoney } from "@/lib/cashier/formatters";
import { buildCashierIdempotencyKey } from "@/lib/cashier/idempotency";
import { useCashierReadiness } from "@/lib/cashier/readiness";
import { mapTillApiError, normalizeCashierTill } from "@/lib/cashier/till-state";
import type {
  CashierOpenTillInput,
  CashierReconcileTillInput,
  CashierSafeDropInput,
  CashierTillApi,
  CashierTillViewModel,
} from "@/lib/cashier/till-types";
import {
  getCashierTill,
  getCashierTillSummary,
  openCashierTill,
  reconcileCashierTill,
  recordCashierSafeDrop,
} from "@/lib/cashier/tills";

import { CashierDeferredCashMovements } from "./CashierDeferredCashMovements";
import { CashierOpenTillPanel } from "./CashierOpenTillPanel";
import { CashierReconcilePanel } from "./CashierReconcilePanel";
import { CashierSafeDropPanel } from "./CashierSafeDropPanel";
import { CashierTillBlockedBanner } from "./CashierTillBlockedBanner";
import { CashierTillConfirmDialog } from "./CashierTillConfirmDialog";
import { CashierTillOverview } from "./CashierTillOverview";
import { CashierTillResultNotice } from "./CashierTillResultNotice";
import { CashierTillSummaryCards } from "./CashierTillSummaryCards";
import { CashierTillToolbar } from "./CashierTillToolbar";

type ActionMessage = {
  tone: "success" | "danger";
  title: string;
  detail?: string;
};

type PendingAction =
  | { type: "open"; input: CashierOpenTillInput }
  | { type: "safe-drop"; input: CashierSafeDropInput }
  | { type: "reconcile"; input: CashierReconcileTillInput };

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message || fallback;
  return error instanceof Error ? error.message : fallback;
}

function isOpenStatus(status?: string | null) {
  return String(status || "").toUpperCase() === "OPEN";
}

function activeTillIdFrom(data: unknown) {
  const till = data as CashierTillApi;
  return till?.id || null;
}

function confirmationCopy(action: PendingAction | null, till: CashierTillViewModel | null) {
  if (!action) return null;

  if (action.type === "open") {
    return {
      title: "Open till with this opening float?",
      label: "Open Till",
      body: `Till ${action.input.tillCode} will open with ${formatCashierMoney(action.input.openingFloat, till?.currencyCode)}.`,
    };
  }

  if (action.type === "safe-drop") {
    return {
      title: "Record safe drop?",
      label: "Record Safe Drop",
      body: `Record ${formatCashierMoney(action.input.amount, till?.currencyCode)} against ${till?.tillCode || "this till"}.`,
    };
  }

  return {
    title: "Reconcile and close this till?",
    label: "Reconcile Till",
    body: `Counted cash is ${formatCashierMoney(action.input.countedCash, till?.currencyCode)}. This closes the active till if accepted by the backend.`,
  };
}

function baseWriteBlocks({
  accessToken,
  branchId,
  authLoading,
  isCashier,
  mutationInFlight,
}: {
  accessToken: string | null;
  branchId: string | null;
  authLoading: boolean;
  isCashier: boolean;
  mutationInFlight: boolean;
}) {
  const reasons: string[] = [];
  if (authLoading) reasons.push("Session is still loading.");
  if (!accessToken) reasons.push("Session is required.");
  if (!isCashier) reasons.push("Cashier access is required.");
  if (!branchId) reasons.push("Branch context is required.");
  if (mutationInFlight) reasons.push("Another till request is processing.");
  return reasons;
}

export function CashierTillScreen() {
  const queryClient = useQueryClient();
  const { accessToken, branchId, clearSession, isCashier, isLoading } = useAuth();
  const cashierContext = useCashierContext();
  const readiness = useCashierReadiness();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [safeDropError, setSafeDropError] = useState<string | null>(null);
  const [reconcileError, setReconcileError] = useState<string | null>(null);
  const [mutationType, setMutationType] = useState<PendingAction["type"] | null>(null);

  const activeTillId = activeTillIdFrom(readiness.tillQuery.data);
  const canReadTill = Boolean(accessToken && branchId && activeTillId);

  const tillDetailQuery = useQuery({
    queryKey: ["cashier", "till-detail", branchId, activeTillId],
    enabled: canReadTill,
    queryFn: () => getCashierTill(accessToken as string, branchId as string, activeTillId as string),
    retry: 1,
    staleTime: 10_000,
  });

  const tillSummaryQuery = useQuery({
    queryKey: ["cashier", "till-summary", branchId, activeTillId],
    enabled: canReadTill,
    queryFn: () => getCashierTillSummary(accessToken as string, branchId as string, activeTillId as string),
    retry: 1,
    staleTime: 10_000,
  });

  useEffect(() => {
    const error = tillDetailQuery.error || tillSummaryQuery.error;
    if (error instanceof ApiError && error.isAuthError) {
      clearSession();
    }
  }, [clearSession, tillDetailQuery.error, tillSummaryQuery.error]);

  const till = useMemo(
    () =>
      normalizeCashierTill(
        (tillSummaryQuery.data || tillDetailQuery.data || readiness.tillQuery.data) as CashierTillApi,
      ),
    [readiness.tillQuery.data, tillDetailQuery.data, tillSummaryQuery.data],
  );

  const isMutating = Boolean(mutationType);
  const isRefreshing =
    readiness.shiftQuery.isFetching ||
    readiness.tillQuery.isFetching ||
    tillDetailQuery.isFetching ||
    tillSummaryQuery.isFetching;
  const activeTillLoading = readiness.tillQuery.isLoading || (activeTillId ? tillDetailQuery.isLoading : false);
  const summaryLoading = Boolean(activeTillId && tillSummaryQuery.isLoading);
  const tillReadError = readiness.tillQuery.error
    ? errorMessage(readiness.tillQuery.error, "Could not load active till.")
    : tillDetailQuery.error
      ? errorMessage(tillDetailQuery.error, "Could not load till detail.")
      : undefined;
  const summaryError = tillSummaryQuery.error
    ? errorMessage(tillSummaryQuery.error, "Could not load till summary.")
    : undefined;

  const commonBlocks = baseWriteBlocks({
    accessToken,
    branchId,
    authLoading: isLoading,
    isCashier,
    mutationInFlight: isMutating,
  });

  const openTillBlocks = [
    ...commonBlocks,
    readiness.shift.status === "loading" ? "Active shift is still loading." : "",
    readiness.shift.status === "failed" ? "Active shift check failed." : "",
    readiness.shift.status === "inactive" ? "No active shift. Open or resume a shift before till operations." : "",
    readiness.till.status === "loading" ? "Active till check is still loading." : "",
    readiness.till.status === "active" ? "A till is already active." : "",
  ].filter(Boolean);

  const activeTillActionBlocks = [
    ...commonBlocks,
    readiness.shift.status === "inactive" ? "No active shift. Open or resume a shift before till operations." : "",
    readiness.till.status === "loading" ? "Active till is still loading." : "",
    readiness.till.status === "failed" ? "Active till check failed." : "",
    !activeTillId ? "Active till is required." : "",
    tillDetailQuery.isLoading ? "Till detail is still loading." : "",
    tillSummaryQuery.isLoading ? "Till summary is still loading." : "",
    tillSummaryQuery.isError ? "Till summary failed. Retry before cash movement writes." : "",
    till && !till.isOpen ? "Till is already reconciled or closed." : "",
  ].filter(Boolean);

  async function refreshTillState() {
    await queryClient.invalidateQueries({ queryKey: ["cashier", "active-shift", branchId] });
    await queryClient.invalidateQueries({ queryKey: ["cashier", "active-till", branchId] });
    await queryClient.invalidateQueries({ queryKey: ["cashier", "till-detail", branchId] });
    await queryClient.invalidateQueries({ queryKey: ["cashier", "till-summary", branchId] });
    await Promise.all([
      readiness.shiftQuery.refetch(),
      readiness.tillQuery.refetch(),
      activeTillId ? tillDetailQuery.refetch() : Promise.resolve(),
      activeTillId ? tillSummaryQuery.refetch() : Promise.resolve(),
    ]);
  }

  async function runPendingAction() {
    if (!pendingAction || !accessToken || !branchId) return;

    setMutationType(pendingAction.type);
    setActionMessage(null);
    setOpenError(null);
    setSafeDropError(null);
    setReconcileError(null);

    try {
      if (pendingAction.type === "open") {
        await openCashierTill({
          token: accessToken,
          branchId,
          idempotencyKey: buildCashierIdempotencyKey({
            operation: "till-open",
            method: pendingAction.input.tillCode,
          }),
          input: pendingAction.input,
        });
        setActionMessage({ tone: "success", title: "Till opened." });
      } else if (pendingAction.type === "safe-drop" && activeTillId) {
        await recordCashierSafeDrop({
          token: accessToken,
          branchId,
          tillId: activeTillId,
          idempotencyKey: buildCashierIdempotencyKey({
            operation: "till-safe-drop",
            orderId: activeTillId,
          }),
          input: pendingAction.input,
        });
        setActionMessage({ tone: "success", title: "Safe drop recorded." });
      } else if (pendingAction.type === "reconcile" && activeTillId) {
        await reconcileCashierTill({
          token: accessToken,
          branchId,
          tillId: activeTillId,
          idempotencyKey: buildCashierIdempotencyKey({
            operation: "till-reconcile",
            orderId: activeTillId,
          }),
          input: pendingAction.input,
        });
        setActionMessage({ tone: "success", title: "Till reconciled." });
      }

      setPendingAction(null);
      await refreshTillState();
    } catch (error) {
      const message = mapTillApiError(error, "Till request failed.");
      if (pendingAction.type === "open") setOpenError(message);
      if (pendingAction.type === "safe-drop") setSafeDropError(message);
      if (pendingAction.type === "reconcile") setReconcileError(message);
      setActionMessage({ tone: "danger", title: "Till request failed.", detail: message });
    } finally {
      setMutationType(null);
    }
  }

  const confirmation = confirmationCopy(pendingAction, till);

  return (
    <PageShell
      title="Till"
      subtitle="Open till, review cash position, safe drop, and reconcile."
      actions={
        <div className="flex items-center gap-2">
          <Badge variant={readiness.till.status === "active" ? "success" : "warning"}>{readiness.till.label}</Badge>
          <Badge variant="info">Cash drawer</Badge>
        </div>
      }
    >
      <div className="space-y-5">
        <CashierTillToolbar
          branchName={cashierContext.branchName}
          workstationLabel={cashierContext.workstationLabel}
          readiness={readiness}
          isRefreshing={isRefreshing}
          onRefresh={() => void refreshTillState()}
        />

        {actionMessage ? (
          <CashierTillResultNotice
            tone={actionMessage.tone}
            title={actionMessage.title}
            detail={actionMessage.detail}
          />
        ) : null}

        {readiness.shift.status === "inactive" ? (
          <StatusMessage tone="warning" title="No active shift">
            No active shift. Open or resume a shift before till operations.
          </StatusMessage>
        ) : null}

        {summaryError && till ? (
          <StatusMessage tone="warning" title="Till summary failed">
            {summaryError} Overview stays visible, but safe drop and reconciliation are blocked until retry succeeds.
          </StatusMessage>
        ) : null}

        {tillReadError ? (
          <div className="rounded-lg bg-status-danger-surface p-5 text-status-danger">
            <div className="flex items-start gap-3">
              <WarningCircle size={24} weight="bold" aria-hidden />
              <div>
                <p className="font-bold">Till read failed</p>
                <p className="mt-1 text-sm font-medium">{tillReadError}</p>
                <button
                  type="button"
                  className="mt-3 min-h-11 rounded-md bg-surface px-4 text-sm font-bold text-text-primary shadow-subtle transition-[background-color,transform] duration-150 ease-out hover:bg-surface-muted active:scale-[0.96]"
                  onClick={() => void refreshTillState()}
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activeTillLoading ? (
          <StatusMessage tone="info" title="Loading till state">
            Active shift, active till, and summary checks are loading.
          </StatusMessage>
        ) : null}

        <div className="grid grid-cols-[minmax(0,1fr)_420px] items-start gap-6">
          <div className="min-w-0 space-y-5">
            {till ? (
              <>
                <CashierTillOverview till={till} />
                <CashierTillSummaryCards till={till} />
                {summaryLoading ? (
                  <StatusMessage tone="info" title="Loading cash summary">
                    Cash position is refreshing before till writes unlock.
                  </StatusMessage>
                ) : null}
              </>
            ) : (
              <CashierEmptyState
                icon={<Info size={26} weight="duotone" aria-hidden />}
                title={readiness.shift.status === "inactive" ? "No active shift" : "No active till session"}
                description={
                  readiness.shift.status === "inactive"
                    ? "No active shift. Open or resume a shift before till operations."
                    : "Cash checkout stays blocked until a till is active."
                }
              />
            )}

            <CashierDeferredCashMovements />
          </div>

          <aside className="sticky top-40 space-y-5">
            {!till ? (
              <CashierOpenTillPanel
                disabledReasons={openTillBlocks}
                isSubmitting={mutationType === "open"}
                error={openError}
                onConfirm={(input) => setPendingAction({ type: "open", input })}
              />
            ) : (
              <>
                <CashierSafeDropPanel
                  till={till}
                  disabledReasons={activeTillActionBlocks}
                  isSubmitting={mutationType === "safe-drop"}
                  error={safeDropError}
                  onConfirm={(input) => setPendingAction({ type: "safe-drop", input })}
                />
                <CashierReconcilePanel
                  till={till}
                  disabledReasons={activeTillActionBlocks}
                  isSubmitting={mutationType === "reconcile"}
                  error={reconcileError}
                  onConfirm={(input) => setPendingAction({ type: "reconcile", input })}
                />
              </>
            )}

            <CashierTillBlockedBanner
              title="Cash Checkout Gate"
              reasons={
                readiness.till.status === "active"
                  ? ["Cash checkout can detect an active till."]
                  : ["Cash checkout remains blocked until an active till is confirmed."]
              }
            />
          </aside>
        </div>
      </div>

      {confirmation ? (
        <CashierTillConfirmDialog
          open={Boolean(pendingAction)}
          title={confirmation.title}
          confirmLabel={confirmation.label}
          isSubmitting={Boolean(mutationType)}
          onConfirm={() => void runPendingAction()}
          onCancel={() => setPendingAction(null)}
        >
          {confirmation.body}
        </CashierTillConfirmDialog>
      ) : null}
    </PageShell>
  );
}
