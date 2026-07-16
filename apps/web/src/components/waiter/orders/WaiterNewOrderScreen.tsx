import { ArrowLeft, ArrowRight, Armchair, WarningCircle } from "@phosphor-icons/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useMemo } from "react";

import { BlockedState, Button, Card, ErrorState, LoadingState, PageShell, StatusMessage } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getWaiterTable } from "@/lib/waiter/floor-api";
import { createDineInOrder } from "@/lib/waiter/order-api";
import { useActiveShift } from "@/lib/waiter/useActiveShift";

function getQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getCreateErrorCopy(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === "SHIFT_NOT_OPEN") {
      return "Shift not started. Start shift before taking orders.";
    }
    if (error.code === "ORDER_NOT_OWNED_BY_WAITER") {
      return "This order belongs to another waiter.";
    }
    if (error.isForbidden) {
      return "This waiter account cannot create orders on this branch.";
    }
    return error.message;
  }

  return error instanceof Error ? error.message : "Could not start order.";
}

export function WaiterNewOrderScreen() {
  const router = useRouter();
  const tableId = getQueryParam(router.query.tableId);
  const { accessToken, branchId } = useAuth();
  const activeShift = useActiveShift();

  const tableQuery = useQuery({
    queryKey: ["waiter", "table", branchId, tableId],
    enabled: Boolean(accessToken && branchId && tableId),
    queryFn: () => getWaiterTable(accessToken as string, branchId as string, tableId as string),
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createDineInOrder(accessToken as string, branchId as string, tableId as string),
    onSuccess: (order) => {
      void router.replace(`/waiter/orders/${order.id}`);
    },
  });

  const shiftIsOpen = Boolean(activeShift.data);
  const tableName = useMemo(
    () => tableQuery.data?.label || (tableId ? "Selected table" : "No table selected"),
    [tableId, tableQuery.data?.label],
  );

  if (!tableId) {
    return (
      <PageShell title="Start order" subtitle="Choose an available table first.">
        <BlockedState
          title="Table required"
          description="Start a dine-in order from an available table on the Floor screen."
          action={
            <Button
              variant="secondary"
              leadingIcon={<ArrowLeft size={18} weight="bold" />}
              onClick={() => void router.push("/waiter/floor")}
            >
              Go to Floor
            </Button>
          }
        />
      </PageShell>
    );
  }

  if (tableQuery.isLoading || activeShift.isLoading) {
    return (
      <PageShell title="Start order" subtitle="Checking table and shift state.">
        <LoadingState title="Preparing order start" />
      </PageShell>
    );
  }

  if (tableQuery.isError) {
    const message =
      tableQuery.error instanceof Error
        ? tableQuery.error.message
        : "Could not load the selected table.";

    return (
      <PageShell title="Start order" subtitle="The table could not be loaded.">
        <ErrorState title="Could not load table" description={message} />
        <Button
          className="w-fit"
          variant="secondary"
          leadingIcon={<ArrowLeft size={18} weight="bold" />}
          onClick={() => void router.push("/waiter/floor")}
        >
          Back to Floor
        </Button>
      </PageShell>
    );
  }

  if (!shiftIsOpen) {
    return (
      <PageShell title="Start order" subtitle={tableName}>
        <BlockedState
          title="Shift not started"
          description="Shift not started, start shift before taking orders."
          action={
            <Button
              variant="secondary"
              leadingIcon={<ArrowLeft size={18} weight="bold" />}
              onClick={() => void router.push("/waiter/floor")}
            >
              Back to Floor
            </Button>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Start order"
      subtitle="Create one dine-in order for this available table."
    >
      {createMutation.isError ? (
        <StatusMessage tone="danger" title="Could not start order">
          {getCreateErrorCopy(createMutation.error)}
        </StatusMessage>
      ) : null}

      <Card className="max-w-2xl">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-md bg-status-success-surface text-status-success">
            <Armchair size={26} weight="duotone" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold tracking-normal text-text-primary">{tableName}</p>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              The table will remain available until the order is sent to kitchen/bar. Sending the
              dine-in order refreshes the floor state and marks the table occupied.
            </p>

            <div className="mt-5 rounded-md bg-surface-muted p-4 text-sm text-text-secondary">
              <div className="flex items-start gap-2">
                <WarningCircle size={18} weight="bold" className="mt-0.5 text-status-warning" />
                <p>
                  No table notes are created here. Notes belong to individual order items only.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Button
                size="pos"
                leadingIcon={<ArrowRight size={22} weight="bold" />}
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "Starting order" : "Start order"}
              </Button>
              <Button
                size="pos"
                variant="secondary"
                leadingIcon={<ArrowLeft size={22} weight="bold" />}
                disabled={createMutation.isPending}
                onClick={() => void router.push("/waiter/floor")}
              >
                Back to Floor
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </PageShell>
  );
}
