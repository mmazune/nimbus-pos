import { useMemo, useState } from "react";

import { ManagerBreadcrumbs, ManagerListTable, ManagerStatusPipeline, type ManagerListColumn } from "@/components/manager/chrome";
import { Badge, Card, ErrorState, LoadingState } from "@/components/ui";
import type { ManagerOrdersSnapshot } from "@/lib/manager/operations-context";
import {
  MANAGER_ORDER_PIPELINE,
  formatManagerDateTime,
  formatManagerOperationsMoney,
  managerOrderPipelineIndex,
  managerOrderStatusTone,
  titleCaseManagerStatus,
} from "@/lib/manager/operations-model";
import { MANAGER_OPERATIONS_ROUTES } from "@/lib/manager/operations-route";
import type { ManagerOrderLine, ManagerOrderRow } from "@/lib/manager/operations-types";
import { cn } from "@/lib/utils/cn";

/**
 * Operations → Orders → one order (Track B3). The Odoo **C5 form view**
 * (`06-invoice-form-view-chatter.jpg`) rebuilt natively: breadcrumb + record
 * pager, a statusbar pipeline on the right, the record title, a two-column field
 * block, inner notebook tabs over the line grid, and a totals block.
 *
 * Three deliberate departures from the reference, each because the capability
 * does not exist here rather than because it was skipped:
 *
 * - **No statusbar ACTION buttons** (Odoo's `Send`, `Print`, `Credit Note`,
 *   `Reset to Draft`). Operations is read-only oversight; the owner decision
 *   locks Manager out of order writes, and payment/close is Cashier-owned.
 * - **No smart-button strip.** Odoo's `Payments 1` button opens a related-record
 *   list. Nimbus has `GET /pos/orders/:id/refunds` but no branch-wide payments
 *   read for Manager, so a strip would be one real button beside empty space.
 * - **No chatter rail.** It is backed by `GET /api/audit/timeline`, whose shape
 *   and permission are gated on **B0**, which has not run. Building the rail
 *   against an unverified endpoint is exactly what the roadmap forbids.
 */
type ManagerOrderDetailPanelProps = {
  snapshot: ManagerOrdersSnapshot;
  /** The current list page — the record pager walks it, exactly like Odoo's. */
  pageRows: readonly ManagerOrderRow[];
  onClose: () => void;
  onSelectOrder: (orderId: string) => void;
};

type ManagerOrderTab = "lines" | "context";

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle/60 py-2 last:border-b-0">
      <dt className="text-xs font-bold uppercase tracking-[0.08em] text-text-muted">{label}</dt>
      <dd className="min-w-0 text-sm font-semibold text-text-primary">{children}</dd>
    </div>
  );
}

export function ManagerOrderDetailPanel({
  onClose,
  onSelectOrder,
  pageRows,
  snapshot,
}: ManagerOrderDetailPanelProps) {
  const { currencyCode, detailQuery, selectedOrderId } = snapshot;
  const [tab, setTab] = useState<ManagerOrderTab>("lines");
  const order = detailQuery.data;

  const position = useMemo(
    () => pageRows.findIndex((row) => row.id === selectedOrderId),
    [pageRows, selectedOrderId],
  );

  const lineColumns: ManagerListColumn<ManagerOrderLine>[] = useMemo(
    () => [
      { key: "name", header: "Item", render: (line) => line.name },
      {
        key: "serving",
        header: "Serving",
        optional: true,
        hideBelowLarge: true,
        render: (line) => line.servingName || <span className="text-text-muted">—</span>,
      },
      {
        key: "status",
        header: "Line status",
        optional: true,
        hideBelowLarge: true,
        render: (line) =>
          line.status ? titleCaseManagerStatus(line.status) : <span className="text-text-muted">—</span>,
      },
      {
        key: "quantity",
        header: "Qty",
        numeric: true,
        render: (line) => (line.quantity === null ? "—" : line.quantity),
      },
      {
        key: "unitPrice",
        header: "Unit",
        numeric: true,
        render: (line) => formatManagerOperationsMoney(line.unitPrice, currencyCode),
      },
      {
        key: "lineTotal",
        header: "Line total",
        numeric: true,
        render: (line) => formatManagerOperationsMoney(line.lineTotal, currencyCode),
      },
    ],
    [currencyCode],
  );

  const pipelineIndex = order ? managerOrderPipelineIndex(order.status) : -1;

  return (
    <>
      <ManagerBreadcrumbs
        parent={{ label: "Orders", href: MANAGER_OPERATIONS_ROUTES.orders }}
        recordLabel={order?.orderNumber || "Order"}
        pager={
          position >= 0
            ? {
                position: position + 1,
                total: pageRows.length,
                hasPrevious: position > 0,
                hasNext: position < pageRows.length - 1,
                onPrevious: () => onSelectOrder(pageRows[position - 1].id),
                onNext: () => onSelectOrder(pageRows[position + 1].id),
              }
            : undefined
        }
      />

      {detailQuery.isLoading ? (
        <LoadingState title="Loading order…" />
      ) : detailQuery.isError || !order ? (
        <div className="flex flex-col items-start gap-3">
          <ErrorState
            title="Order unavailable"
            description="This order could not be read for the selected branch. It may belong to another branch, or the request failed."
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm font-semibold text-brand-navy-900 outline-none hover:bg-surface-muted focus-visible:shadow-focus"
          >
            Back to orders
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge variant={managerOrderStatusTone(order.status)}>
              {titleCaseManagerStatus(order.status)}
            </Badge>
            <ManagerStatusPipeline
              ariaLabel="Order lifecycle"
              stages={MANAGER_ORDER_PIPELINE.map(titleCaseManagerStatus)}
              currentIndex={pipelineIndex}
              exitLabel={`${titleCaseManagerStatus(order.status)} — left the service pipeline`}
            />
          </div>

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.5fr)]">
            <Card className="min-w-0">
              <h2 className="text-2xl font-bold tracking-tight text-text-primary">{order.orderNumber}</h2>

              <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
                <FieldRow label="Table">{order.tableLabel || "Takeaway / no table"}</FieldRow>
                <FieldRow label="Service">{titleCaseManagerStatus(order.serviceType)}</FieldRow>
                <FieldRow label="Server">{order.serverName || "Unassigned"}</FieldRow>
                <FieldRow label="Opened">{formatManagerDateTime(order.createdAt)}</FieldRow>
                <FieldRow label="Last updated">{formatManagerDateTime(order.updatedAt)}</FieldRow>
                <FieldRow label="Lines">{order.itemCount ?? "—"}</FieldRow>
              </dl>

              <div className="mt-6 flex gap-1 border-b border-border-subtle" role="tablist" aria-label="Order detail sections">
                {(
                  [
                    { key: "lines", label: `Order lines${order.lines.length ? ` (${order.lines.length})` : ""}` },
                    { key: "context", label: "Related orders" },
                  ] as const
                ).map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === entry.key}
                    data-manager-order-tab={entry.key}
                    onClick={() => setTab(entry.key)}
                    className={cn(
                      "-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-semibold outline-none focus-visible:shadow-focus",
                      tab === entry.key
                        ? "border-brand-navy-900 text-text-primary"
                        : "border-transparent text-text-muted hover:text-text-secondary",
                    )}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>

              <div className="mt-4">
                {tab === "lines" ? (
                  <ManagerListTable
                    caption="Order lines"
                    columns={lineColumns}
                    rows={order.lines}
                    getRowId={(line) => line.id}
                    emptyTitle="No lines"
                    emptyMessage="This order has no lines recorded."
                  />
                ) : (
                  <dl className="grid gap-x-8 sm:grid-cols-2">
                    <FieldRow label="Split from">
                      {order.splitFromOrderId ? (
                        <button
                          type="button"
                          onClick={() => onSelectOrder(order.splitFromOrderId as string)}
                          className="rounded-sm text-brand-navy-900 underline outline-none focus-visible:shadow-focus"
                        >
                          Open source order
                        </button>
                      ) : (
                        "Not a split"
                      )}
                    </FieldRow>
                    <FieldRow label="Merged into">
                      {order.mergedIntoOrderId ? (
                        <button
                          type="button"
                          onClick={() => onSelectOrder(order.mergedIntoOrderId as string)}
                          className="rounded-sm text-brand-navy-900 underline outline-none focus-visible:shadow-focus"
                        >
                          Open target order
                        </button>
                      ) : (
                        "Not merged"
                      )}
                    </FieldRow>
                  </dl>
                )}
              </div>
            </Card>

            <div className="flex min-w-0 flex-col gap-5">
              <Card className="min-w-0">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-text-muted">Totals</h3>
                <dl className="mt-3">
                  <FieldRow label="Subtotal (ex-tax)">
                    {formatManagerOperationsMoney(order.subtotal, currencyCode)}
                  </FieldRow>
                  <FieldRow label="Tax">{formatManagerOperationsMoney(order.tax, currencyCode)}</FieldRow>
                  <FieldRow label="Discount">
                    {formatManagerOperationsMoney(order.discount, currencyCode)}
                  </FieldRow>
                  <FieldRow label="Total (tax-inclusive)">
                    <span className="text-lg">{formatManagerOperationsMoney(order.total, currencyCode)}</span>
                  </FieldRow>
                </dl>
                <p className="mt-3 text-xs leading-5 text-text-muted">
                  Total = subtotal + tax − discount, so it is tax-inclusive. Payment state is not shown
                  here: collecting and settling payment is cashier-owned, and this surface is oversight
                  only.
                </p>
              </Card>

              <Card className="min-w-0 bg-status-info-surface">
                <h3 className="text-xs font-bold uppercase tracking-[0.1em] text-status-info">
                  This record is read-only
                </h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  Manager oversight does not change an order. Sending, serving, splitting, voiding,
                  discounting, collecting payment and closing all belong to the roles that own them —
                  waiter, supervisor and cashier — and none of those controls are offered here.
                </p>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
