import {
  ArrowSquareOut,
  ClipboardText,
  Prohibit,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";

import { Badge, Button, Card, Skeleton, StatusMessage } from "@/components/ui";
import {
  formatSupervisorApprovalDate,
  getSupervisorApprovalSeverityTone,
  getSupervisorApprovalStatusTone,
  type SupervisorAnomaly,
  type SupervisorApprovalItem,
  type SupervisorPendingDiscount,
} from "@/lib/supervisor/approvals";

type SupervisorApprovalDetailPanelProps = {
  item: SupervisorApprovalItem | null;
  discountDetail?: SupervisorPendingDiscount | null;
  anomalyDetail?: SupervisorAnomaly | null;
  isLoading?: boolean;
  detailError?: string | null;
  onClose: () => void;
};

function displayValue(value: string | number | null | undefined, fallback = "Unavailable") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-surface-muted px-3 py-2 text-sm">
      <dt className="font-semibold text-text-secondary">{label}</dt>
      <dd className="min-w-0 truncate text-right font-bold text-text-primary" title={value}>
        {value}
      </dd>
    </div>
  );
}

function DeferredAction({ label }: { label: string }) {
  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <div className="flex items-center gap-2">
        <Prohibit size={20} weight="bold" className="text-text-secondary" aria-hidden />
        <p className="font-bold text-text-primary">{label}</p>
      </div>
      <p className="mt-1 text-sm leading-6 text-text-secondary">
        Decision actions require a separate verified approval workflow.
      </p>
      <Button className="mt-3 w-full" variant="secondary" size="compact" disabled>
        Read-only
      </Button>
    </div>
  );
}

function actionsFor(domain: SupervisorApprovalItem["domain"]) {
  if (domain === "discount") return ["Approve discount", "Reject discount"];
  if (domain === "refund") return ["Approve refund", "Reject refund"];
  if (domain === "void") return ["Execute post-close void"];
  if (domain === "leave") return ["Review leave"];
  if (domain === "shift-swap") return ["Approve shift swap", "Reject shift swap"];
  return ["Acknowledge anomaly", "Resolve anomaly"];
}

export function SupervisorApprovalDetailPanel({
  anomalyDetail,
  detailError,
  discountDetail,
  isLoading,
  item,
  onClose,
}: SupervisorApprovalDetailPanelProps) {
  if (!item) {
    return (
      <Card className="min-h-[640px] bg-surface-muted">
        <p className="text-lg font-bold tracking-normal text-text-primary">Select an approval row</p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Domain identity, context, request details, and unavailable decision boundaries appear here.
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="min-h-[640px]">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="mt-4 h-5 w-80" />
        <div className="mt-6 grid gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  const activeDiscount = discountDetail || (item.domain === "discount" ? item.raw as SupervisorPendingDiscount : null);
  const activeAnomaly = anomalyDetail || (item.domain === "anomaly" ? item.raw as SupervisorAnomaly : null);

  return (
    <Card className="min-h-[640px]" aria-labelledby="supervisor-approval-detail-title">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            <h2
              id="supervisor-approval-detail-title"
              className="truncate text-xl font-bold tracking-normal text-text-primary"
              title={item.reference}
            >
              {item.reference}
            </h2>
            <Badge variant="info">{item.domainLabel}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {detailError || "Read-only approval oversight."}
          </p>
        </div>
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface-muted text-text-secondary transition-[background-color,color,transform] duration-150 ease-out hover:bg-brand-white hover:text-text-primary focus-visible:shadow-focus active:scale-[0.96]"
          aria-label="Close approval detail"
          onClick={onClose}
        >
          <X size={18} weight="bold" aria-hidden />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant={getSupervisorApprovalStatusTone(item.status)}>{item.statusLabel}</Badge>
        {item.severity !== "unavailable" ? (
          <Badge variant={getSupervisorApprovalSeverityTone(item.severity)}>{item.severityLabel}</Badge>
        ) : (
          <Badge variant="neutral">{item.severityLabel}</Badge>
        )}
        {item.tags.map((tag) => (
          <Badge key={tag.key} variant={tag.tone}>
            {tag.label}
          </Badge>
        ))}
      </div>

      <div className="mt-5 rounded-lg bg-surface-muted p-4">
        <div className="flex items-center gap-2">
          <ClipboardText size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
          <h3 className="text-base font-bold tracking-normal text-text-primary">Identity</h3>
        </div>
        <dl className="mt-3 grid gap-3">
          <DetailRow label="Domain" value={item.domainLabel} />
          <DetailRow label="Reference" value={item.reference} />
          <DetailRow label="Status" value={item.statusLabel} />
          <DetailRow label="Created" value={formatSupervisorApprovalDate(item.createdAt)} />
          <DetailRow label="Updated" value={formatSupervisorApprovalDate(item.updatedAt)} />
        </dl>
      </div>

      <div className="mt-5 rounded-lg bg-surface-muted p-4">
        <h3 className="text-base font-bold tracking-normal text-text-primary">Context</h3>
        <dl className="mt-3 grid gap-3">
          <DetailRow label="Requester" value={item.requester} />
          <DetailRow label="Employee" value={displayValue(item.employeeName, "Employee unavailable")} />
          <DetailRow label="Order" value={displayValue(item.orderReference, "Order unavailable")} />
          <DetailRow label="Amount / score" value={item.amountLabel} />
          <DetailRow label="Reason" value={item.reason} />
        </dl>
        <div className="mt-4 grid gap-2">
          {item.orderId ? (
            <Link
              href={`/supervisor/orders?orderId=${encodeURIComponent(item.orderId)}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-surface px-4 text-base font-semibold text-text-primary shadow-subtle transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-brand-white focus-visible:shadow-focus active:scale-[0.96]"
            >
              <ArrowSquareOut size={22} weight="bold" aria-hidden />
              Open related order
            </Link>
          ) : null}
          {activeAnomaly?.relatedReservationId ? (
            <Link
              href={`/supervisor/reservations?reservationId=${encodeURIComponent(activeAnomaly.relatedReservationId)}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-surface px-4 text-base font-semibold text-text-primary shadow-subtle transition-[background-color,box-shadow,transform] duration-150 ease-out hover:bg-brand-white focus-visible:shadow-focus active:scale-[0.96]"
            >
              <ArrowSquareOut size={22} weight="bold" aria-hidden />
              Open related reservation
            </Link>
          ) : null}
        </div>
      </div>

      {activeDiscount ? (
        <div className="mt-5 rounded-lg bg-surface-muted p-4">
          <h3 className="text-base font-bold tracking-normal text-text-primary">Discount detail</h3>
          <dl className="mt-3 grid gap-3">
            <DetailRow label="Type" value={displayValue(activeDiscount.type, "Type unavailable")} />
            <DetailRow label="Value" value={item.amountLabel} />
            <DetailRow label="Order total" value={displayValue(activeDiscount.order?.total, "Total unavailable")} />
            <DetailRow label="Manager PIN" value={activeDiscount.managerPinVerified ? "Verified" : "Not verified"} />
          </dl>
        </div>
      ) : null}

      {activeAnomaly ? (
        <div className="mt-5 rounded-lg bg-surface-muted p-4">
          <h3 className="text-base font-bold tracking-normal text-text-primary">Anomaly detail</h3>
          <dl className="mt-3 grid gap-3">
            <DetailRow label="Type" value={displayValue(activeAnomaly.type, "Type unavailable")} />
            <DetailRow label="Rule" value={displayValue(activeAnomaly.rule?.name || activeAnomaly.rule?.code, "Rule unavailable")} />
            <DetailRow label="Entity" value={displayValue(activeAnomaly.entityType, "Entity unavailable")} />
            <DetailRow label="Entity ID" value={displayValue(activeAnomaly.entityId, "Entity ID unavailable")} />
            <DetailRow label="Related refund" value={displayValue(activeAnomaly.relatedRefundId, "Refund unavailable")} />
          </dl>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Evidence is retained by the API as structured data. This panel shows only returned summary fields.
          </p>
        </div>
      ) : null}

      <div className="mt-5 rounded-lg bg-surface-muted p-4">
        <div className="flex items-center gap-2">
          <WarningCircle size={22} weight="bold" className="text-brand-navy-900" aria-hidden />
          <h3 className="text-base font-bold tracking-normal text-text-primary">Future action boundary</h3>
        </div>
        <StatusMessage tone="info" title="Read-only approval oversight">
          Approval decisions require a separate verified action workflow. No manager PIN or override execution is available here.
        </StatusMessage>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {actionsFor(item.domain).map((action) => (
            <DeferredAction key={action} label={action} />
          ))}
        </div>
      </div>
    </Card>
  );
}
