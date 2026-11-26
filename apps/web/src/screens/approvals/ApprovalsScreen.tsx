import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useState, type ReactNode } from "react";

import { Banner, Button, Card, Field, Pill, Row, RowGroup, Segmented, Sheet, Text, type PillTone } from "@/components/kit";
import type { OperationalIconName } from "@/components/pos-shell/role-icons";
import { useTouchHeader } from "@/components/pos-shell/TouchShell";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  approvalKeys,
  mapApprovalErrorToMessage,
  type ApprovalWorkspaceDomain,
} from "@/lib/supervisor/approvals-contract";
import {
  acknowledgeAnomaly,
  approveDiscount,
  decisionErrorStatus,
  fetchDiscountDetail,
  fetchNeedsAction,
  fetchTerminalPage,
  rejectDiscount,
  rejectShiftSwap,
  resolveAnomaly,
  reviewLeave,
  type ApprovalQueueItem,
} from "@/lib/supervisor/approvals-workspace";
import type { SupervisorAnomaly, SupervisorLeaveRequest, SupervisorPendingDiscount, SupervisorShiftSwap } from "@/lib/supervisor/approvals";
import { fetchSupervisorOrderPayments, getPaymentState, type SupervisorOrderUser } from "@/lib/supervisor/orders";

import { formatMinutes, groupCents, shortName, toCents } from "../floor/floor-model";
import { useWide } from "../floor/useWide";
import { errorWords } from "../shared/words";

/**
 * Approvals (T1 phase 5, drawing Supervisor-Approvals) on the approval routes
 * that exist, through the 5A contract (fetchNeedsAction, fetchTerminalPage and
 * each domain's own decision call):
 *   Discount     Approve / Decline (reason); approve is blocked once the order has
 *                taken money, and says so when you asked for it yourself
 *   Leave        Approve / Decline
 *   Shift swap   Decline only — approving cannot change the roster (Outcome C)
 *   Alert        Acknowledge, then Mark resolved (notes)
 * Waiting = what needs a decision now; Done today = decided since midnight (leave,
 * swaps and alerts; discounts have no branch-wide list once decided).
 * Left out: Void, Refund and Take over rows (no route lists them), "Approve on
 * the spot with a PIN" (no second-person approval exists).
 */
type View = "waiting" | "done" | "history";
const HISTORY_PAGE = 25;
const DOMAINS: readonly ApprovalWorkspaceDomain[] = ["discount", "leave", "shift-swap", "anomaly"];
const DONE_DOMAINS: readonly ApprovalWorkspaceDomain[] = ["leave", "shift-swap", "anomaly"];
const WORD: Record<ApprovalWorkspaceDomain, string> = { discount: "Discount", leave: "Leave", "shift-swap": "Shift swap", anomaly: "Alert" };
const ICON: Record<ApprovalWorkspaceDomain, OperationalIconName> = { discount: "revenue", leave: "time", "shift-swap": "staff", anomaly: "warning" };

function hhmm(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

function day(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(d).replace(/ /g, "\u00a0");
}

function person(u?: SupervisorOrderUser | { firstName?: string | null; lastName?: string | null; displayName?: string | null } | null) {
  // "Agnes N." stays together on a narrow row
  return (shortName(u ?? null) ?? "").replace(/ /g, "\u00a0");
}

/** How long it has waited: "9 min", "2 h 06", then whole days. */
function since(iso?: string | null) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const min = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (min < 24 * 60) return formatMinutes(min);
  const days = Math.floor(min / (24 * 60));
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** "LOW_STOCK demo anomaly" → "Low stock demo anomaly": no raw codes on screen. */
function plain(text: string) {
  const out = text.replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\b[A-Z]{4,}\b/g, (code) => code.toLowerCase().replace(/_/g, " "));
  return out.charAt(0).toUpperCase() + out.slice(1);
}

function errorText(e: unknown): string {
  if (e instanceof ApiError && !e.message) return mapApprovalErrorToMessage(decisionErrorStatus(e));
  return errorWords(e);
}

const STATUS: Record<string, { tone: PillTone; word: string }> = {
  PENDING: { tone: "amber", word: "Waiting" },
  OPEN: { tone: "amber", word: "Open" },
  ACKNOWLEDGED: { tone: "brand", word: "Acknowledged" },
  APPROVED: { tone: "green", word: "Approved" },
  RESOLVED: { tone: "green", word: "Resolved" },
  REJECTED: { tone: "red", word: "Declined" },
  CANCELLED: { tone: "neutral", word: "Cancelled" },
  DISMISSED: { tone: "neutral", word: "Dismissed" },
};

function statusPill(s: string) {
  return STATUS[s.toUpperCase()] ?? { tone: "neutral" as PillTone, word: s.charAt(0) + s.slice(1).toLowerCase() };
}

/** The row's title and line, in plain words. */
function describe(item: ApprovalQueueItem): { title: string; line: string; heading?: string } {
  if (item.domain === "discount") {
    const d = item.raw as SupervisorPendingDiscount;
    const pct = String(d.type ?? "").toUpperCase() === "PERCENTAGE";
    // a percentage also shows what it comes to on the bill before (whole cents, BigInt)
    const off = pct
      ? d.order?.subtotal !== undefined && d.order?.subtotal !== null
        ? (toCents(d.order.subtotal) * toCents(d.value ?? 0)) / 10000n
        : null
      : toCents(d.value ?? 0);
    const kind = [pct ? `${Number(d.value ?? 0)}%` : "", off !== null ? `UGX ${groupCents(off)}` : ""].filter(Boolean).join(" · ");
    const bill = (d.order?.orderNumber ?? "").replace(/^ORD-/, "");
    return {
      title: `Discount · bill ${bill}`,
      line: [kind, person(d.createdBy)].filter(Boolean).join(" · "),
      heading: `${off !== null ? `UGX ${groupCents(off)}` : `${Number(d.value ?? 0)}%`} off bill ${bill}`,
    };
  }
  if (item.domain === "leave") {
    const l = item.raw as SupervisorLeaveRequest;
    const span = l.startsAt ? `${day(l.startsAt)}${l.endsAt && day(l.endsAt) !== day(l.startsAt) ? ` to ${day(l.endsAt)}` : ""}` : "";
    return { title: `Leave · ${person(l.employee) || item.title}`, line: [span, l.leaveType ? l.leaveType.charAt(0) + l.leaveType.slice(1).toLowerCase() : ""].filter(Boolean).join(" · ") };
  }
  if (item.domain === "shift-swap") {
    const s = item.raw as SupervisorShiftSwap;
    return { title: `Shift swap · ${person(s.requester) || item.title}`, line: [person(s.target) ? `with ${person(s.target)}` : "", day(s.shiftDate)].filter(Boolean).join(" · ") };
  }
  const a = item.raw as SupervisorAnomaly;
  return { title: `Alert · ${plain(a.title || a.rule?.name || "Something to check")}`, line: [item.severityLabel ?? "", person(a.actorUser)].filter(Boolean).join(" · ") };
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex py-kit-9 items-center justify-between gap-kit-12">
      <Text variant="sup" tone="muted">
        {label}
      </Text>
      <Text variant="body" strong align="end">
        {value}
      </Text>
    </div>
  );
}

export function ApprovalsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const wide = useWide();
  const { accessToken, branchId, user } = useAuth();
  const token = accessToken as string;
  const branch = branchId as string;
  const ready = Boolean(accessToken && branchId);
  const view: View = router.query.view === "done" ? "done" : router.query.view === "history" ? "history" : "waiting";
  // ?id=leave:abc, or the older ?selDomain=leave&selId=abc links
  const selectedKey =
    typeof router.query.id === "string"
      ? router.query.id
      : typeof router.query.selDomain === "string" && typeof router.query.selId === "string"
        ? `${router.query.selDomain}:${router.query.selId}`
        : undefined;
  const [historyPage, setHistoryPage] = useState(1);
  const [sheet, setSheet] = useState<null | "decline" | "resolve" | "detail">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const waitingQs = useQueries({
    queries: DOMAINS.map((d) => ({
      queryKey: approvalKeys.queue(branch, d, "needs-action"),
      enabled: ready,
      queryFn: () => fetchNeedsAction(d, token, branch),
      retry: shouldRetryApiRequest,
      staleTime: 15_000,
      refetchInterval: 30_000,
    })),
  });
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const dayFrom = midnight.toISOString();
  const doneQs = useQueries({
    queries: DONE_DOMAINS.map((d) => ({
      queryKey: approvalKeys.queue(branch, d, "resolved", { scope: "resolved", page: 1, dateFrom: dayFrom } as never),
      enabled: ready,
      queryFn: () => fetchTerminalPage(d, token, branch, { scope: "resolved", page: 1, dateFrom: dayFrom }),
      retry: shouldRetryApiRequest,
      staleTime: 30_000,
    })),
  });

  const historyQs = useQueries({
    queries: DONE_DOMAINS.map((d) => ({
      queryKey: approvalKeys.queue(branch, d, "history", { scope: "history", page: historyPage } as never),
      enabled: ready && view === "history",
      queryFn: () => fetchTerminalPage(d, token, branch, { scope: "history", page: historyPage }),
      retry: shouldRetryApiRequest,
      staleTime: 30_000,
    })),
  });
  const history = historyQs.flatMap((q) => q.data?.items ?? []).sort((a, b) => b.sortTimeMs - a.sortTimeMs);
  const historyMore = historyQs.some((q) => (q.data?.total ?? 0) > historyPage * HISTORY_PAGE);

  const waiting = waitingQs.flatMap((q) => q.data?.items ?? []).sort((a, b) => a.sortTimeMs - b.sortTimeMs);
  const done = doneQs
    .flatMap((q) => q.data?.items ?? [])
    .filter((i) => i.sortTimeMs >= midnight.getTime())
    .sort((a, b) => b.sortTimeMs - a.sortTimeMs);
  const rows = view === "waiting" ? waiting : view === "done" ? done : history;
  const key = (i: ApprovalQueueItem) => `${i.domain}:${i.id}`;
  const [kept, setKept] = useState<ApprovalQueueItem | undefined>();
  const selected = rows.find((i) => key(i) === selectedKey) ?? (kept && key(kept) === selectedKey ? kept : undefined);
  const viewQs = view === "waiting" ? waitingQs : view === "done" ? doneQs : historyQs;
  const loading = viewQs.some((q) => q.isLoading);
  const loadError = viewQs.find((q) => q.isError)?.error;
  const oldest = waiting.length ? since(waiting[0].actionableAtIso) : "";
  const readAt = Math.min(...waitingQs.map((q) => q.dataUpdatedAt || Number.MAX_SAFE_INTEGER));

  useTouchHeader({
    title: "Approvals",
    summary: waitingQs.every((q) => q.data) ? (waiting.length ? `${waiting.length} waiting · oldest ${oldest}` : "Nothing waiting") : undefined,
    asAt: Number.isFinite(readAt) && readAt < Number.MAX_SAFE_INTEGER ? readAt : undefined,
  });

  // discount: its own detail and the order's payments (approve is blocked once money is taken)
  const discountId = selected?.domain === "discount" ? selected.id : undefined;
  const discountQ = useQuery({
    queryKey: approvalKeys.detail(branch, "discount", discountId ?? "none"),
    enabled: ready && Boolean(discountId),
    queryFn: () => fetchDiscountDetail(token, branch, discountId as string),
    retry: shouldRetryApiRequest,
  });
  const orderId = (discountQ.data as SupervisorPendingDiscount | undefined)?.orderId ?? (selected?.raw as SupervisorPendingDiscount | undefined)?.orderId ?? undefined;
  const paymentsQ = useQuery({
    queryKey: ["supervisor", "approval-order-payments", branch, orderId],
    enabled: ready && Boolean(discountId && orderId),
    queryFn: () => fetchSupervisorOrderPayments(token, branch, orderId as string),
    retry: shouldRetryApiRequest,
  });

  function go(next: { view?: View; id?: string | null }) {
    const q: Record<string, string> = {};
    const v = next.view ?? view;
    if (v !== "waiting") q.view = v;
    const id = next.id === undefined ? selectedKey : next.id;
    if (id) q.id = id;
    void router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true, scroll: false });
  }

  async function decide(fn: () => Promise<unknown>, words: string) {
    if (busy || !selected) return;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      await fn();
      setKept(selected);
      setNotice(words);
      setSheet(wide.phone ? "detail" : null);
      await qc.invalidateQueries({ queryKey: ["supervisor", "approvals"] });
      await Promise.all([...waitingQs, ...doneQs].map((q) => q.refetch()));
    } catch (e) {
      setFailure(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function panel(item: ApprovalQueueItem): ReactNode {
    const { title, line, heading } = describe(item);
    const status = String(item.status).toUpperCase();
    const facts: Array<[string, string]> = [];
    let primary: ReactNode = null;
    let decline: ReactNode = null;
    let note: ReactNode = null;
    if (item.domain === "discount") {
      const d = (discountQ.data as SupervisorPendingDiscount | undefined) ?? (item.raw as SupervisorPendingDiscount);
      facts.push(["Asked by", [person(d.createdBy), hhmm(d.createdAt)].filter(Boolean).join(" · ")]);
      if (d.reason) facts.push(["Reason", d.reason]);
      if (d.order?.subtotal !== undefined && d.order?.subtotal !== null) facts.push(["Bill before", `UGX ${groupCents(toCents(d.order.subtotal))}`]);
      if (d.approvedBy || d.approvedAt) facts.push(["Approved by", [person(d.approvedBy), hhmm(d.approvedAt)].filter(Boolean).join(" · ")]);
      if (d.rejectedBy || d.rejectedAt) facts.push(["Declined by", [person(d.rejectedBy), hhmm(d.rejectedAt)].filter(Boolean).join(" · ")]);
      if (status === "PENDING") {
        const paymentState = getPaymentState(paymentsQ.data ?? null);
        const moneyTaken = ["settled", "partially-paid", "refunded"].includes(paymentState);
        const mine = Boolean(user?.id && d.createdBy?.id === user.id);
        const unread = paymentsQ.isError;
        note = paymentsQ.isLoading ? (
          <Text variant="sup" tone="muted">
            Checking whether this bill has taken money…
          </Text>
        ) : unread ? (
          <Banner tone="amber" title="The bill's payments could not be read." detail="Approve waits until they can be checked; decline still works." />
        ) : moneyTaken ? (
          <Banner tone="amber" title="This bill has taken money." detail="The discount cannot be approved now; it can be declined." />
        ) : mine ? (
          <Text variant="sup" tone="muted">
            You asked for this discount yourself.
          </Text>
        ) : null;
        decline = (
          <Button tone="danger" onClick={() => setSheet("decline")}>
            Decline
          </Button>
        );
        primary = (
          <Button tone="filled" disabled={busy || moneyTaken || paymentsQ.isLoading || unread} onClick={() => void decide(() => approveDiscount(token, branch, item.id), "Discount approved.")}>
            Approve the discount
          </Button>
        );
      }
    } else if (item.domain === "leave") {
      const l = item.raw as SupervisorLeaveRequest;
      facts.push(["Asked by", [person(l.requestedBy) || person(l.employee), hhmm(l.createdAt)].filter(Boolean).join(" · ")]);
      if (l.startsAt) facts.push(["Days", `${day(l.startsAt)}${l.endsAt && day(l.endsAt) !== day(l.startsAt) ? ` to ${day(l.endsAt)}` : ""}`]);
      if (l.reason) facts.push(["Reason", l.reason]);
      if (l.reviewedBy || l.reviewedAt) facts.push([status === "REJECTED" ? "Declined by" : "Decided by", [person(l.reviewedBy), hhmm(l.reviewedAt)].filter(Boolean).join(" · ")]);
      if (status === "PENDING") {
        note = (
          <Text variant="sup" tone="muted">
            Approving or declining leave does not change payroll or the roster.
          </Text>
        );
        decline = (
          <Button tone="danger" onClick={() => setSheet("decline")}>
            Decline
          </Button>
        );
        primary = (
          <Button tone="filled" disabled={busy} onClick={() => void decide(() => reviewLeave(token, branch, item.id, "APPROVED"), "Leave approved.")}>
            Approve the leave
          </Button>
        );
      }
    } else if (item.domain === "shift-swap") {
      const s = item.raw as SupervisorShiftSwap;
      facts.push(["Asked by", [person(s.requester), hhmm(s.createdAt)].filter(Boolean).join(" · ")]);
      if (s.target) facts.push(["Swap with", person(s.target)]);
      if (s.shiftDate) facts.push(["Shift", day(s.shiftDate)]);
      if (s.reason) facts.push(["Reason", s.reason]);
      if (s.approvedBy || s.approvedAt) facts.push([status === "REJECTED" ? "Declined by" : "Decided by", [person(s.approvedBy), hhmm(s.approvedAt)].filter(Boolean).join(" · ")]);
      if (status === "PENDING") {
        note = (
          <Text variant="sup" tone="muted">
            A swap cannot be approved here: the roster cannot be changed yet. It can be declined.
          </Text>
        );
        primary = (
          <Button tone="filled" disabled={busy} onClick={() => setSheet("decline")}>
            Decline the swap
          </Button>
        );
      }
    } else {
      const a = item.raw as SupervisorAnomaly;
      if (a.description) facts.push(["What happened", plain(a.description)]);
      facts.push(["Raised", [hhmm(a.createdAt), day(a.createdAt)].filter(Boolean).join(" · ")]);
      if (a.actorUser) facts.push(["Who", person(a.actorUser)]);
      if (a.acknowledgedBy || a.acknowledgedAt) facts.push(["Acknowledged by", [person(a.acknowledgedBy), hhmm(a.acknowledgedAt)].filter(Boolean).join(" · ")]);
      if (a.resolutionNotes) facts.push(["Notes", a.resolutionNotes]);
      if (status === "OPEN") {
        note = (
          <Text variant="sup" tone="muted">
            Acknowledging keeps it here until it is resolved.
          </Text>
        );
        primary = (
          <Button tone="filled" disabled={busy} onClick={() => void decide(() => acknowledgeAnomaly(token, branch, item.id), "Alert acknowledged.")}>
            Acknowledge
          </Button>
        );
      } else if (status === "ACKNOWLEDGED") {
        primary = (
          <Button tone="filled" disabled={busy} onClick={() => setSheet("resolve")}>
            Mark resolved
          </Button>
        );
      }
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-kit-12" data-approval={key(item)}>
        <div className="flex items-start gap-kit-12">
          <div className="min-w-0 flex-1">
            <Text variant="h" as="h2">
              {heading ?? title}
            </Text>
            <Text variant="sup" tone="muted">
              {line}
            </Text>
          </div>
        </div>
        {notice ? (
          <Text variant="body" tone="green" strong>
            {notice}
          </Text>
        ) : null}
        {failure && !sheet ? <Banner tone="red" title={failure} /> : null}
        <div className="flex flex-col">
          {facts.map(([l, v]) => (
            <Fact key={l} label={l} value={v} />
          ))}
        </div>
        {note}
        <span className="flex-1" />
        {decline ? <div className="flex justify-center">{decline}</div> : null}
        {primary}
      </div>
    );
  }

  const list = (
    <Card label={view === "waiting" ? "Waiting" : view === "done" ? "Done today" : "History"}>
      {loading ? (
        <div className="p-kit-16">
          <Text variant="body" tone="muted">
            Reading the requests…
          </Text>
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-start gap-kit-12 p-kit-16">
          <Text variant="body">{errorText(loadError)}</Text>
          <Button tone="tonal" onClick={() => void qc.invalidateQueries({ queryKey: ["supervisor", "approvals"] })}>
            Try again
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="p-kit-16">
          <Text variant="body" tone="muted">
            {view === "waiting" ? "Nothing is waiting for you." : view === "done" ? "Nothing decided today yet." : "No decisions on this page."}
          </Text>
        </div>
      ) : (
        <RowGroup>
          {rows.map((i) => {
            const d = describe(i);
            return (
              <Row
                size="tall"
                key={key(i)}
                icon={ICON[i.domain]}
                title={d.title}
                line={d.line}
                trailing={
                  view === "waiting" ? (
                    <Text variant="sup" tone="muted">
                      {since(i.actionableAtIso)}
                    </Text>
                  ) : (
                    <Pill tone={statusPill(String(i.status)).tone}>{statusPill(String(i.status)).word}</Pill>
                  )
                }
                chevron
                current={key(i) === selectedKey}
                onClick={() => {
                  setNotice(null);
                  setFailure(null);
                  go({ id: key(i) });
                  if (wide.phone) setSheet("detail");
                }}
              />
            );
          })}
        </RowGroup>
      )}
    </Card>
  );

  const segmented = (
    <Segmented
      label="Requests"
      fill={wide.phone}
      value={view}
      onChange={(k) => go({ view: k as View, id: null })}
      options={[
        // a count shows only once every list is read, so "0" never means "not read yet"
        { key: "waiting", label: waitingQs.every((q) => q.data) ? `Waiting · ${waiting.length}` : "Waiting" },
        { key: "done", label: doneQs.every((q) => q.data) ? `Done today · ${done.length}` : "Done today" },
        { key: "history", label: "History" },
      ]}
    />
  );
  const historyPager =
    view === "history" ? (
      <div className="flex items-center justify-between gap-kit-12">
        <Button tone="tonal" size="laptop" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => p - 1)}>
          Newer
        </Button>
        <Text variant="small" tone="muted">{`Page ${historyPage} · leave, swaps and alerts`}</Text>
        <Button tone="tonal" size="laptop" disabled={!historyMore} onClick={() => setHistoryPage((p) => p + 1)}>
          Older
        </Button>
      </div>
    ) : null;

  const place = wide.phone ? "bottom" : "middle";
  let sheetNode: ReactNode = null;
  if (sheet === "detail" && selected && wide.phone) {
    sheetNode = (
      <Sheet placement="bottom" title={WORD[selected.domain]} onClose={() => setSheet(null)}>
        {panel(selected)}
      </Sheet>
    );
  } else if (sheet === "decline" && selected) {
    sheetNode = (
      <ReasonSheet
        place={place}
        title={selected.domain === "shift-swap" ? "Decline the swap" : `Decline the ${WORD[selected.domain].toLowerCase()}`}
        summary={selected.domain === "shift-swap" ? "No schedule or shift assignment is changed." : selected.domain === "leave" ? "Payroll and the roster are not changed." : undefined}
        label="Why"
        required={selected.domain === "discount"}
        busy={busy}
        failure={failure}
        action={selected.domain === "shift-swap" ? "Decline the swap" : "Decline"}
        onClose={() => setSheet(wide.phone ? "detail" : null)}
        onSend={(why) =>
          void decide(
            () =>
              selected.domain === "discount"
                ? rejectDiscount(token, branch, selected.id, why)
                : selected.domain === "leave"
                  ? reviewLeave(token, branch, selected.id, "REJECTED", why)
                  : rejectShiftSwap(token, branch, selected.id, why),
            `${WORD[selected.domain]} declined.`,
          )
        }
      />
    );
  } else if (sheet === "resolve" && selected) {
    sheetNode = (
      <ReasonSheet
        place={place}
        title="Mark resolved"
        summary="The original evidence is kept; the record it points to is not changed by this action."
        label="What was done"
        required
        busy={busy}
        failure={failure}
        action="Mark resolved"
        onClose={() => setSheet(wide.phone ? "detail" : null)}
        onSend={(why) => void decide(() => resolveAnomaly(token, branch, selected.id, why), "Alert resolved.")}
      />
    );
  }

  if (wide.phone) {
    return (
      <div className="flex flex-col gap-kit-14 px-kit-16 pb-kit-16 pt-kit-14">
        {segmented}
        {list}
        {historyPager}
        {sheetNode}
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 gap-kit-20 px-kit-24 py-kit-16">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-kit-16">
        <div className="flex">{segmented}</div>
        <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
        {historyPager}
      </section>
      <aside className="flex w-kit-sheet-side flex-none flex-col rounded-kit-card bg-kit-card p-kit-20 shadow-kit-raised" aria-label="Request">
        {selected ? (
          panel(selected)
        ) : (
          <Text variant="body" tone="muted">
            Choose a request to see it here.
          </Text>
        )}
      </aside>
      {sheetNode}
    </div>
  );
}

function ReasonSheet({
  place,
  title,
  summary,
  label,
  required,
  busy,
  failure,
  action,
  onClose,
  onSend,
}: {
  place: "bottom" | "middle";
  title: string;
  summary?: string;
  label: string;
  required: boolean;
  busy: boolean;
  failure: string | null;
  action: string;
  onClose: () => void;
  onSend: (why: string) => void;
}) {
  const [why, setWhy] = useState("");
  const [tried, setTried] = useState(false);
  return (
    <Sheet
      placement={place}
      title={title}
      summary={summary}
      onClose={onClose}
      footer={
        <>
          <Button tone="text" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="filled"
            fill
            disabled={busy}
            onClick={() => {
              setTried(true);
              if (required && !why.trim()) return;
              onSend(why.trim());
            }}
          >
            {action}
          </Button>
        </>
      }
    >
      <Field label={label} value={why} onChange={setWhy} required={required} error={tried && required && !why.trim() ? "Write why." : undefined} />
      {failure ? <Banner tone="red" title={failure} /> : null}
    </Sheet>
  );
}
