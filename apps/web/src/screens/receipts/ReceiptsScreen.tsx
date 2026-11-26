import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useMemo, useState, type ReactNode } from "react";

import { Banner, Button, Card, Field, OptionTile, Row, RowGroup, Segmented, Sheet, Text } from "@/components/kit";
import { ListTable } from "@/components/kit/ListTable";
import { useTouchHeader } from "@/components/pos-shell/TouchShell";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildCashierIdempotencyKey } from "@/lib/cashier/idempotency";
import { getCashierOrderPayments } from "@/lib/cashier/orders";
import { getCashierReceipt } from "@/lib/cashier/receipts";
import { deriveRefundableAmount, deriveRefundStatus } from "@/lib/cashier/refund-state";
import { validateRefundInput } from "@/lib/cashier/refund-validation";
import { createCashierRefund, listCashierOrderRefunds } from "@/lib/cashier/refunds";
import { apiRequest } from "@/lib/api/client";

import { groupCents, shortName, toCents } from "../floor/floor-model";
import { useAttemptKey } from "../shared/attempt-key";
import { useWide } from "../floor/useWide";
import { errorWords } from "../shared/words";

/**
 * Receipts (T1 phase 4, drawing Cashier-Receipts): today's and earlier paid
 * bills, one bill beside the list, and a refund request.
 *
 * Paid bills are CLOSED orders (a receipt is read by its order id). The list has
 * no date filter on the server and no close time, so bills are split by the day
 * they were opened (createdAt never moves; updatedAt does — a large refund writes
 * a flag onto the order). Today: the newest 500 closed bills, kept if opened
 * today. Earlier: read only when opened, 50 a page, paged by the server.
 * Refund reuses the cashier refund rules as they are (refundable amount,
 * validation, idempotency key, create). Left out: "Print again" (the reprint
 * route only records a reprint; nothing prints yet) and the list's "How"
 * column (the order list carries no payment method; the bill shows it).
 */
type Order = {
  id: string;
  orderNumber?: string | null;
  status?: string | null;
  total?: string | number | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  table?: { id?: string; label?: string | null } | null;
  user?: { firstName?: string | null; lastName?: string | null; displayName?: string | null } | null;
};

const KEY = ["t1", "receipts"] as const;
const TODAY_READ = 500;
const EARLIER_PAGE = 50;
const METHOD: Record<string, string> = { CASH: "Cash", CARD: "Card", MOMO: "Mobile money", MOBILE_MONEY: "Mobile money", BANK_TRANSFER: "Bank transfer" };

function method(m?: string | null) {
  const k = String(m ?? "").toUpperCase();
  return METHOD[k] ?? (k ? k.charAt(0) + k.slice(1).toLowerCase().replace(/_/g, " ") : "");
}

function hhmm(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

function dayTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

function billNo(o: { orderNumber?: string | null; id: string }) {
  return (o.orderNumber ?? "").replace(/^ORD-/, "") || o.id.slice(-6);
}

function tableWord(label?: string | null) {
  if (!label) return "Takeaway";
  return /^\d+$/.test(label) ? `Table ${label}` : label;
}

/** When the bill was opened: it never moves (updatedAt does, e.g. a refund flag). */
function openedAt(o: Order) {
  return new Date(o.createdAt ?? 0).getTime();
}

function errorText(e: unknown): string {
  return errorWords(e);
}

export function ReceiptsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const wide = useWide();
  const { accessToken, branchId, user } = useAuth();
  const token = accessToken as string;
  const branch = branchId as string;
  const ready = Boolean(accessToken && branchId);
  const canRefund = Boolean(user?.permissions?.includes("pos:refund:create"));
  const [when, setWhen] = useState<"today" | "earlier">("today");
  const [query, setQuery] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const selectedId = typeof router.query.receiptId === "string" ? router.query.receiptId : undefined;

  const [earlierPage, setEarlierPage] = useState(1);
  const closedQ = useQuery({
    queryKey: [...KEY, "today", branch],
    enabled: ready,
    queryFn: () => apiRequest<{ data?: Order[]; total?: number }>(`/api/pos/orders?status=CLOSED&pageSize=${TODAY_READ}&page=1`, { token, branchId: branch }),
    retry: shouldRetryApiRequest,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const earlierQ = useQuery({
    queryKey: [...KEY, "earlier", branch, earlierPage],
    enabled: ready && when === "earlier",
    queryFn: () => apiRequest<{ data?: Order[]; total?: number }>(`/api/pos/orders?status=CLOSED&pageSize=${EARLIER_PAGE}&page=${earlierPage}`, { token, branchId: branch }),
    retry: shouldRetryApiRequest,
    staleTime: 30_000,
  });
  const billRefundsQ = useQuery({
    queryKey: [...KEY, "refunds", branch, selectedId],
    enabled: ready && Boolean(selectedId),
    queryFn: () => listCashierOrderRefunds(token, branch, selectedId as string),
    retry: shouldRetryApiRequest,
  });
  const detailQ = useQuery({
    queryKey: [...KEY, "receipt", branch, selectedId],
    enabled: ready && Boolean(selectedId),
    queryFn: () => getCashierReceipt(token, branch, selectedId as string),
    retry: shouldRetryApiRequest,
  });

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const newest = useMemo(() => (closedQ.data?.data ?? []).slice().sort((a, b) => openedAt(b) - openedAt(a)), [closedQ.data]);
  const today = newest.filter((o) => openedAt(o) >= since.getTime());
  const todayCut = (closedQ.data?.data?.length ?? 0) >= TODAY_READ && today.length === newest.length;
  const earlier = (earlierQ.data?.data ?? []).filter((o) => openedAt(o) < since.getTime());
  const earlierTotal = earlierQ.data?.total ?? 0;
  const todaySum = today.reduce((acc, o) => acc + toCents(o.total), 0n);

  const q = query.trim().toLowerCase();
  const digits = q.replace(/[^\d]/g, "");
  const match = (o: Order) =>
    !q ||
    billNo(o).toLowerCase().includes(q) ||
    tableWord(o.table?.label).toLowerCase().includes(q) ||
    (digits.length >= 3 && toCents(o.total).toString().startsWith(digits));
  const listed = (when === "today" ? today : earlier).filter(match);

  useTouchHeader({
    title: "Receipts",
    summary: closedQ.data ? `Paid bills today · ${today.length} · UGX ${groupCents(todaySum)}` : undefined,
    asAt: closedQ.data ? closedQ.dataUpdatedAt : undefined,
  });

  function open(id: string) {
    void router.replace({ pathname: router.pathname, query: { receiptId: id } }, undefined, { shallow: true, scroll: false });
    if (wide.phone) setDetailOpen(true);
  }

  const receipt = detailQ.data;
  const paid = receipt?.payments?.filter((p) => String(p.status ?? "").toUpperCase() === "COMPLETED") ?? [];
  // money that has actually gone back (approved or completed), not a refund still waiting
  const givenBack = (billRefundsQ.data ?? [])
    .filter((r) => ["APPROVED", "COMPLETED"].includes(deriveRefundStatus(r.status).status))
    .reduce((n, r) => n + toCents(r.amount ?? 0), 0n);
  const lastPaid = paid.map((p) => p.postedAt).filter(Boolean).sort().pop();

  const panel: ReactNode = !selectedId ? (
    <Text variant="body" tone="muted">
      Choose a bill to see it here.
    </Text>
  ) : detailQ.isLoading ? (
    <Text variant="body" tone="muted">
      Reading the bill…
    </Text>
  ) : detailQ.isError || !receipt ? (
    <Banner tone="red" title={errorText(detailQ.error) || "The bill could not be read."} />
  ) : (
    <div className="flex min-h-0 flex-1 flex-col gap-kit-12" data-receipt={receipt.orderId ?? selectedId}>
      <div>
        <Text variant="h" as="h2">{`Bill ${billNo({ orderNumber: receipt.orderNumber, id: selectedId })}`}</Text>
        <Text variant="sup" tone="muted">
          {[tableWord(receipt.table?.label), receipt.server?.fullName ? shortName({ displayName: receipt.server.fullName }) : "", lastPaid ? `paid ${hhmm(lastPaid)}` : "", [...new Set(paid.map((p) => method(p.method)))].join(" + ")]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </div>
      <Text variant="cap" tone="muted">
        Paid
      </Text>
      <div className="flex min-h-0 flex-col gap-kit-8 overflow-y-auto">
        {(receipt.items ?? []).map((l, i) => (
          <div key={l.id ?? i} className="flex items-start gap-kit-12">
            <span className="flex h-kit-badge min-w-kit-badge flex-none items-center justify-center rounded-kit-qty bg-kit-tonal px-kit-6 text-kit-small font-kit-bold text-kit-primary">
              {String(l.quantity ?? 1)}
            </span>
            <span className="min-w-0 flex-1">
              <Text variant="body">{[l.name, l.serving && l.serving !== "Standard" ? l.serving : ""].filter(Boolean).join(" ")}</Text>
            </span>
            <Text variant="body" strong>
              {groupCents(toCents(l.lineTotal))}
            </Text>
          </div>
        ))}
      </div>
      {(billRefundsQ.data ?? []).length ? (
        <div className="flex flex-col gap-kit-4">
          {(billRefundsQ.data ?? []).map((r) => {
            const st = deriveRefundStatus(r.status);
            return (
              <div key={r.id} className="flex items-center justify-between gap-kit-12">
                <Text variant="sup" tone={st.approvalRequired ? "amber" : "muted"}>
                  {st.approvalRequired ? "Refund waiting for approval" : `Refund ${st.label.toLowerCase()}`}
                </Text>
                <Text variant="body" strong>{`− ${groupCents(toCents(r.amount ?? 0))}`}</Text>
              </div>
            );
          })}
        </div>
      ) : null}
      <span className="flex-1" />
      <div className="flex items-center justify-between border-t border-kit-line pt-kit-16">
        <Text variant="row">Paid</Text>
        <Text variant="h">{`UGX ${groupCents(toCents(receipt.totals?.paid ?? receipt.totals?.total))}`}</Text>
      </div>
      {givenBack > 0n ? (
        <div className="flex items-center justify-between">
          <Text variant="sup" tone="muted">
            Kept after refunds given back
          </Text>
          <Text variant="body" strong>{`UGX ${groupCents(toCents(receipt.totals?.paid ?? receipt.totals?.total) - givenBack)}`}</Text>
        </div>
      ) : null}
      {canRefund ? (
        <Button tone="tonal" icon="lock" onClick={() => setRefunding(true)}>
          Refund
        </Button>
      ) : null}
    </div>
  );

  const columns = [
    { key: "bill", label: "Bill", span: 2 as const },
    { key: "table", label: "Table", span: 3 as const },
    { key: "waiter", label: "Waiter", span: 3 as const },
    { key: "opened", label: "Opened", span: 2 as const },
    { key: "ugx", label: "UGX", span: 2 as const, align: "end" as const },
  ];
  const tableRows = listed.map((o) => ({
    id: o.id,
    label: `Bill ${billNo(o)}, ${tableWord(o.table?.label)}, UGX ${groupCents(toCents(o.total))}`,
    cells: {
      bill: billNo(o),
      table: tableWord(o.table?.label),
      waiter: shortName(o.user) ?? "",
      opened: when === "today" ? hhmm(o.createdAt) : dayTime(o.createdAt),
      ugx: groupCents(toCents(o.total)),
    },
  }));
  const listQ = when === "today" ? closedQ : earlierQ;
  const emptyWords = listQ.isLoading ? "Reading the bills…" : listQ.isError ? errorText(listQ.error) : q ? "No bill matches that." : when === "today" ? "No bill has been paid today yet." : "No earlier bills.";

  const top = (
    <div className="flex flex-col gap-kit-12 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <Field label="Find a bill" value={query} onChange={setQuery} placeholder="Bill number, table or amount" inputMode="search" />
      </div>
      <Segmented
        label="Which bills"
        fill={wide.phone}
        value={when}
        onChange={(k) => setWhen(k as "today" | "earlier")}
        options={[
          { key: "today", label: `Today · ${today.length}` },
          { key: "earlier", label: "Earlier" },
        ]}
      />
    </div>
  );
  const capNote =
    when === "earlier" ? (
      <div className="flex items-center justify-between gap-kit-12">
        <Button tone="tonal" size="laptop" disabled={earlierPage <= 1} onClick={() => setEarlierPage((p) => p - 1)}>
          Newer
        </Button>
        <Text variant="small" tone="muted">
          {`Page ${earlierPage} of ${Math.max(1, Math.ceil(earlierTotal / EARLIER_PAGE))} · finding looks at this page`}
        </Text>
        <Button tone="tonal" size="laptop" disabled={earlierPage * EARLIER_PAGE >= earlierTotal} onClick={() => setEarlierPage((p) => p + 1)}>
          Older
        </Button>
      </div>
    ) : todayCut ? (
      <Text variant="small" tone="muted">{`The newest ${TODAY_READ} paid bills are shown.`}</Text>
    ) : null;

  const refundSheet =
    refunding && selectedId ? (
      <RefundSheet
        key={selectedId}
        orderId={selectedId}
        bill={billNo({ orderNumber: receipt?.orderNumber, id: selectedId })}
        place={wide.phone ? "bottom" : "middle"}
        token={token}
        branch={branch}
        onClose={() => setRefunding(false)}
        onDone={() => {
          void qc.invalidateQueries({ queryKey: KEY });
          void billRefundsQ.refetch();
          void qc.invalidateQueries({ queryKey: ["cashier"] });
        }}
      />
    ) : null;

  if (wide.phone) {
    return (
      <div className="flex flex-col gap-kit-14 px-kit-16 pb-kit-16 pt-kit-14">
        {top}
        <Card label="Bills">
          {listed.length ? (
            <RowGroup>
              {listed.map((o) => (
                <Row
                  key={o.id}
                  title={`Bill ${billNo(o)} · ${tableWord(o.table?.label)}`}
                  line={[shortName(o.user), `opened ${when === "today" ? hhmm(o.createdAt) : dayTime(o.createdAt)}`].filter(Boolean).join(" · ")}
                  trailing={
                    <Text variant="row" align="end">
                      {groupCents(toCents(o.total))}
                    </Text>
                  }
                  chevron
                  onClick={() => open(o.id)}
                />
              ))}
            </RowGroup>
          ) : (
            <div className="p-kit-16">
              <Text variant="body" tone="muted">
                {emptyWords}
              </Text>
            </div>
          )}
        </Card>
        {capNote}
        {detailOpen && selectedId && !refunding ? (
          <Sheet placement="bottom" title="Bill" onClose={() => setDetailOpen(false)}>
            {panel}
          </Sheet>
        ) : null}
        {refundSheet}
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 gap-kit-20 px-kit-24 py-kit-16">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-kit-16">
        {top}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ListTable
            label="Bills"
            columns={columns}
            rows={tableRows}
            currentId={selectedId}
            onOpen={open}
            empty={
              <Text variant="body" tone="muted">
                {emptyWords}
              </Text>
            }
          />
        </div>
        {capNote}
      </section>
      <aside className="flex w-kit-sheet-side flex-none flex-col rounded-kit-card bg-kit-card p-kit-20 shadow-kit-raised" aria-label="Bill">
        {panel}
      </aside>
      {refundSheet}
    </div>
  );
}

function RefundSheet({
  orderId,
  bill,
  place,
  token,
  branch,
  onClose,
  onDone,
}: {
  orderId: string;
  bill: string;
  place: "bottom" | "middle";
  token: string;
  branch: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const paymentsQ = useQuery({
    queryKey: [...KEY, "payments", branch, orderId],
    queryFn: () => getCashierOrderPayments(token, branch, orderId),
    retry: shouldRetryApiRequest,
  });
  const refundsQ = useQuery({
    queryKey: [...KEY, "refunds", branch, orderId],
    queryFn: () => listCashierOrderRefunds(token, branch, orderId),
    retry: shouldRetryApiRequest,
  });
  const summary = useMemo(
    () => deriveRefundableAmount({ payments: paymentsQ.data?.payments, refunds: refundsQ.data, refundsTrusted: !refundsQ.error && Boolean(refundsQ.data) }),
    [paymentsQ.data?.payments, refundsQ.data, refundsQ.error],
  );
  const usable = summary.paymentOptions.filter((p) => !p.disabledReason);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const chosen = usable.find((p) => p.id === paymentId) ?? usable[0];
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const keys = useAttemptKey();
  const check = validateRefundInput({ amount: amount.replace(/,/g, ""), reason, selectedPayment: chosen, remainingRefundable: summary.remainingRefundable });
  const loading = paymentsQ.isLoading || refundsQ.isLoading;
  const blocked = summary.trustBlockedReason ?? (loading ? null : usable.length === 0 ? "Nothing on this bill can be refunded." : null);

  async function send() {
    setTried(true);
    if (!check.valid || !chosen || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      const created = await createCashierRefund({
        token,
        branchId: branch,
        orderId,
        idempotencyKey: keys.for(`${chosen.id}|${amount}|${reason.trim()}`, () => buildCashierIdempotencyKey({ operation: "refund-create", orderId, method: chosen.id })),
        input: { paymentId: chosen.id, amount: Number(amount.replace(/,/g, "")), reason: reason.trim(), metadata: { source: "t1_receipts" } },
      });
      keys.done();
      // No screen lists refunds waiting for approval yet, so the words promise no one.
      setDone(deriveRefundStatus(created.status).approvalRequired ? "Saved. It waits for approval before money goes back." : "Refund recorded.");
      onDone();
    } catch (e) {
      setFailure(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      placement={place}
      title={`Refund · bill ${bill}`}
      summary={summary.remainingRefundable !== undefined ? `Up to UGX ${groupCents(toCents(String(summary.remainingRefundable)))} can be refunded.` : undefined}
      onClose={onClose}
      footer={
        done ? (
          <Button tone="tonal" fill onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button tone="text" onClick={onClose}>
              Cancel
            </Button>
            <Button tone="filled" fill disabled={busy || Boolean(blocked) || loading} onClick={() => void send()}>
              Ask for the refund
            </Button>
          </>
        )
      }
    >
      {done ? (
        <Text variant="body" tone="green" strong>
          {done}
        </Text>
      ) : loading ? (
        <Text variant="body" tone="muted">
          Reading the payments…
        </Text>
      ) : blocked ? (
        <Banner tone="amber" title={blocked} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-kit-8">
            {usable.map((p) => (
              <OptionTile key={p.id} label={method(p.method)} second={`UGX ${groupCents(toCents(String(p.refundableAmount ?? 0)))} left`} current={chosen?.id === p.id} onClick={() => setPaymentId(p.id)} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-kit-12">
            <Field label="Amount, UGX" value={amount} onChange={setAmount} inputMode="numeric" required error={tried ? check.amountError : undefined} />
            <Field label="Why" value={reason} onChange={setReason} required error={tried ? check.reasonError : undefined} placeholder="Dish sent back" />
          </div>
          <Text variant="small" tone="muted">
            A refund above the approval limit waits for approval.
          </Text>
        </>
      )}
      {failure ? <Banner tone="red" title={failure} /> : null}
    </Sheet>
  );
}
