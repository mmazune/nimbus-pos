import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";

import { Banner, Button, Card, Field, Sheet, Text } from "@/components/kit";
import { useTouchHeader } from "@/components/pos-shell/TouchShell";
import { ApiError, shouldRetryApiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { buildCashierIdempotencyKey } from "@/lib/cashier/idempotency";
import { useCashierReadiness } from "@/lib/cashier/readiness";
import { openCashierShift } from "@/lib/cashier/shifts";
import { normalizeCashierTill } from "@/lib/cashier/till-state";
import type { CashierTillApi } from "@/lib/cashier/till-types";
import { validateOpenTillInput, validateReconcileInput, validateSafeDropInput } from "@/lib/cashier/till-validation";
import { getCashierTill, getCashierTillSummary, openCashierTill, reconcileCashierTill, recordCashierSafeDrop } from "@/lib/cashier/tills";

import { groupCents, shortName, toCents } from "../floor/floor-model";
import { useAttemptKey } from "../shared/attempt-key";
import { useWide } from "../floor/useWide";
import { errorWords } from "../shared/words";

/**
 * Till (T1 phase 4, drawing Cashier-Till) on the existing till routes, with the
 * cashier's own validation and idempotency keys reused as they are:
 *   open the till (float), drop to the safe, count and close (reconcile).
 * Shown only from what the till summary returns: the float, each cash movement,
 * and the cash the server expects in the drawer.
 * Left out (no source yet): the Cash / Mobile money / Card tiles and the cash
 * sales line (the summary has no per-method totals), "Pay out" (no route),
 * "Open the drawer" (hardware), "96 bills" (no count per till).
 */
type Pending = null | "safeDrop" | "close";

function ugx(value: number | string | null | undefined) {
  return groupCents(toCents(value === null || value === undefined ? "0" : String(value)));
}

function hhmm(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

function errorText(e: unknown): string {
  return errorWords(e);
}

const MOVE_WORD: Record<string, string> = {
  SAFE_DROP: "Dropped to the safe",
  PAID_OUT: "Paid out",
  PAID_IN: "Paid in",
  CASH_PICKUP: "Picked up",
  REFUND_PAYOUT: "Refunds paid out",
};
const OUT = new Set(["SAFE_DROP", "PAID_OUT", "CASH_PICKUP", "REFUND_PAYOUT"]);

function Line({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex min-h-kit-target items-center justify-between gap-kit-12">
      <Text variant={strong ? "row" : "sup"} tone={strong ? "text" : "muted"}>
        {label}
      </Text>
      <Text variant={strong ? "h" : "body"} strong>
        {value}
      </Text>
    </div>
  );
}

export function TillScreen() {
  const qc = useQueryClient();
  const wide = useWide();
  const { accessToken, branchId } = useAuth();
  const token = accessToken as string;
  const branch = branchId as string;
  const readiness = useCashierReadiness();
  const tillId = (readiness.tillQuery.data as { id?: string } | null | undefined)?.id;
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [counted, setCounted] = useState("");
  const [varianceReason, setVarianceReason] = useState("");
  const [tried, setTried] = useState(false);
  const [closed, setClosed] = useState<CashierTillApi>(null);
  const keys = useAttemptKey();

  const summaryQ = useQuery({
    queryKey: ["cashier", "till-summary", branchId, tillId],
    enabled: Boolean(accessToken && branchId && tillId),
    queryFn: () => getCashierTillSummary(token, branch, tillId as string),
    retry: shouldRetryApiRequest,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
  const detailQ = useQuery({
    queryKey: ["cashier", "till-detail", branchId, tillId],
    enabled: Boolean(accessToken && branchId && tillId && summaryQ.isError),
    queryFn: () => getCashierTill(token, branch, tillId as string),
    retry: shouldRetryApiRequest,
  });
  const source = (closed ?? summaryQ.data ?? detailQ.data ?? null) as CashierTillApi;
  const till = useMemo(() => (source ? normalizeCashierTill(source) : null), [source]);

  const movements = useMemo(() => {
    const byType = new Map<string, { total: bigint; count: number }>();
    for (const m of source?.cashMovements ?? []) {
      const t = String(m?.type ?? "").toUpperCase();
      const prev = byType.get(t) ?? { total: 0n, count: 0 };
      byType.set(t, { total: prev.total + toCents(m?.amount ?? 0), count: prev.count + 1 });
    }
    return [...byType.entries()];
  }, [source]);

  const expected = source?.computedExpectedCash ?? source?.expectedCash ?? null;
  // What the server adds beyond the float and the movements: cash payments in the branch
  // since the till opened, less completed refunds (computeExpectedCash). Shown as one line.
  const remainder =
    expected === null
      ? null
      : toCents(expected) - toCents(source?.openingFloat ?? 0) - movements.reduce((acc, [type, m]) => acc + (OUT.has(type) ? -m.total : m.total), 0n);
  const opener = shortName(source?.openedBy ?? source?.operatorUser ?? null);
  useTouchHeader({
    title: "Till",
    summary: source ? [source.tillCode ?? "Till", source.openedAt ? `opened ${hhmm(source.openedAt)}${opener ? ` by ${opener}` : ""}` : ""].filter(Boolean).join(" · ") : undefined,
    asAt: summaryQ.data ? summaryQ.dataUpdatedAt : undefined,
  });

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["cashier", "active-shift", branchId] }),
      qc.invalidateQueries({ queryKey: ["cashier", "active-till", branchId] }),
      qc.invalidateQueries({ queryKey: ["cashier", "till-summary", branchId] }),
    ]);
  }

  async function run(fn: () => Promise<unknown>, done: string) {
    if (busy) return;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    try {
      await fn();
      keys.done();
      setNotice(done);
      setPending(null);
      await refresh();
    } catch (e) {
      setFailure(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  // ── no shift, no till ──
  const shiftStatus = readiness.shift.status;
  if (readiness.shiftQuery.isLoading || readiness.tillQuery.isLoading) {
    return (
      <div className="px-kit-24 py-kit-16">
        <Text variant="body" tone="muted">
          Reading the till…
        </Text>
      </div>
    );
  }
  if (!tillId && !closed) {
    return (
      <div className={wide.phone ? "flex flex-col gap-kit-14 px-kit-16 py-kit-14" : "flex justify-center px-kit-24 py-kit-24"}>
        <div className="flex w-full max-w-screen-sm flex-col gap-kit-16">
          {shiftStatus === "inactive" ? (
            <Banner
              tone="amber"
              title="Your shift has not started."
              detail="A till opens inside a shift."
              action={{ label: busy ? "Starting…" : "Start shift", onClick: () => void run(() => openCashierShift(token, branch), "Your shift has started.") }}
            />
          ) : null}
          <OpenTillCard disabled={shiftStatus !== "active" || busy} busy={busy} failure={failure} notice={notice} onOpen={(input) => void run(() => openCashierTill({ token, branchId: branch, idempotencyKey: keys.for(`open|${input.tillCode}|${input.openingFloat}`, () => buildCashierIdempotencyKey({ operation: "till-open", method: input.tillCode.replace(/\s+/g, "-") })), input }), "The till is open.")} />
        </div>
      </div>
    );
  }

  const reconcile = validateReconcileInput({ countedCash: counted.replace(/,/g, ""), varianceReason, notes: "", expectedCash: till?.expectedCash });
  const variance = reconcile.previewVariance;
  const isOpen = Boolean(till?.isOpen) && !closed;

  const drawer = (
    <Card padding="roomy" label="Cash in the drawer">
      <div className="flex flex-col">
        <Text variant="cap" tone="muted">
          Cash in the drawer
        </Text>
        {summaryQ.isLoading ? (
          <Text variant="body" tone="muted">
            Reading the till…
          </Text>
        ) : (
          <>
            <Line label="Float at the start" value={ugx(source?.openingFloat)} />
            {remainder !== null ? <Line label="Cash payments in the branch, less refunds" value={`${remainder < 0n ? "− " : "+ "}${groupCents(remainder < 0n ? -remainder : remainder)}`} /> : null}
            {movements.map(([type, m]) => (
              <Line key={type} label={`${MOVE_WORD[type] ?? type.toLowerCase().replace(/_/g, " ")} · ${m.count} ${m.count === 1 ? "time" : "times"}`} value={`${OUT.has(type) ? "− " : "+ "}${groupCents(m.total)}`} />
            ))}
            <div className="mt-kit-8 border-t border-kit-line pt-kit-8">
              <Line label="Should be in the drawer" value={expected !== null ? `UGX ${ugx(expected)}` : "Not read yet"} strong />
            </div>
          </>
        )}
      </div>
    </Card>
  );

  const actions = isOpen ? (
    <div className="grid grid-cols-1 gap-kit-12 sm:grid-cols-3">
      <Button tone="tonal" fill onClick={() => { setFailure(null); setPending("safeDrop"); }}>
        Drop to the safe
      </Button>
    </div>
  ) : null;

  const closePanel: ReactNode = closed || !isOpen ? (
    <div className="flex flex-col gap-kit-12">
      <Text variant="h" as="h2">
        The till is closed
      </Text>
      {/* the next till opens from here, without a reload */}
      <Line label="Counted" value={`UGX ${ugx(source?.countedCash)}`} />
      <Line label="Expected" value={`UGX ${ugx(source?.expectedCash ?? expected)}`} />
      <Line label={toCents(source?.variance ?? 0) === 0n ? "No difference" : toCents(source?.variance ?? 0) < 0n ? "Short" : "Over"} value={`UGX ${groupCents(toCents(source?.variance ?? 0) < 0n ? -toCents(source?.variance ?? 0) : toCents(source?.variance ?? 0))}`} strong />
      <Button
        tone="tonal"
        onClick={() => {
          setClosed(null);
          setCounted("");
          setVarianceReason("");
          setTried(false);
          setNotice(null);
          void refresh();
        }}
      >
        Open a new till
      </Button>
    </div>
  ) : (
    <div className="flex min-h-0 flex-1 flex-col gap-kit-12">
      <Text variant="h" as="h2">
        Close the till
      </Text>
      <Text variant="sup" tone="muted">
        Count the notes and coins, then type the total. Write why if it does not match.
      </Text>
      <Field label="Cash counted, UGX" value={counted} onChange={setCounted} inputMode="numeric" placeholder="UGX" error={tried && reconcile.reasons.some((r) => /Counted/.test(r)) ? reconcile.reasons.find((r) => /Counted/.test(r)) : undefined} />
      {variance !== undefined && Math.abs(variance) > 0.01 ? (
        <>
          <Banner tone="amber" title={`${variance < 0 ? "Short" : "Over"} by UGX ${ugx(Math.abs(variance))}`} />
          <Field label="Why it does not match" value={varianceReason} onChange={setVarianceReason} required error={tried && !varianceReason.trim() ? "Write why." : undefined} />
        </>
      ) : null}
      <span className="flex-1" />
      {failure && !pending ? <Banner tone="red" title={failure} /> : null}
      <Button
        tone="filled"
        disabled={busy || summaryQ.isLoading}
        onClick={() => {
          setTried(true);
          if (!reconcile.canSubmit || !reconcile.value || !tillId) return;
          setFailure(null);
          setPending("close");
        }}
      >
        Count and close
      </Button>
    </div>
  );

  const dropSheet =
    pending === "safeDrop" && tillId ? (
      <SafeDropSheet
        place={wide.phone ? "bottom" : "middle"}
        expected={till?.expectedCash}
        busy={busy}
        failure={failure}
        onClose={() => setPending(null)}
        onDrop={(input) => void run(() => recordCashierSafeDrop({ token, branchId: branch, tillId, idempotencyKey: keys.for(`drop|${input.amount}|${input.reason}`, () => buildCashierIdempotencyKey({ operation: "till-safe-drop", orderId: tillId })), input }), `UGX ${ugx(input.amount)} dropped to the safe.`)}
      />
    ) : null;

  const confirmClose =
    pending === "close" && tillId && reconcile.value ? (
      <Sheet
        placement={wide.phone ? "bottom" : "middle"}
        title="Close the till?"
        summary="Closing cannot be undone."
        onClose={() => setPending(null)}
        footer={
          <>
            <Button tone="text" onClick={() => setPending(null)}>
              Keep it open
            </Button>
            <Button
              tone="filled"
              fill
              disabled={busy}
              onClick={() => {
                const value = reconcile.value;
                if (!value) return;
                void run(async () => {
                  const result = await reconcileCashierTill({
                    token,
                    branchId: branch,
                    tillId,
                    idempotencyKey: keys.for(`close|${value.countedCash}|${value.varianceReason ?? ""}`, () => buildCashierIdempotencyKey({ operation: "till-reconcile", orderId: tillId })),
                    input: value,
                  });
                  setClosed(result);
                }, "The till is counted and closed.");
              }}
            >
              Close the till
            </Button>
          </>
        }
      >
        <div className="flex flex-col">
          <Line label="Counted" value={`UGX ${ugx(reconcile.value.countedCash)}`} />
          <Line label="Expected" value={`UGX ${ugx(expected)}`} />
          <Line
            label={variance === undefined || Math.abs(variance) <= 0.01 ? "No difference" : variance < 0 ? "Short" : "Over"}
            value={`UGX ${ugx(Math.abs(variance ?? 0))}`}
            strong
          />
        </div>
        {failure ? <Banner tone="red" title={failure} /> : null}
      </Sheet>
    ) : null;

  const noticeLine = notice ? (
    <Text variant="body" tone="green" strong>
      {notice}
    </Text>
  ) : null;

  if (wide.phone) {
    return (
      <div className="flex flex-col gap-kit-14 px-kit-16 pb-kit-16 pt-kit-14">
        {noticeLine}
        {drawer}
        {actions}
        <Card padding="roomy" label="Close the till">
          {closePanel}
        </Card>
        {dropSheet}
        {confirmClose}
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 gap-kit-20 px-kit-24 py-kit-16">
      <section className="flex min-w-0 flex-1 flex-col gap-kit-16">
        {noticeLine}
        {drawer}
        {actions}
      </section>
      <aside className="flex w-kit-sheet-side flex-none flex-col rounded-kit-card bg-kit-card p-kit-20 shadow-kit-raised" aria-label="Close the till">
        {closePanel}
      </aside>
      {dropSheet}
      {confirmClose}
    </div>
  );
}

function OpenTillCard({ disabled, busy, failure, notice, onOpen }: { disabled: boolean; busy: boolean; failure: string | null; notice: string | null; onOpen: (input: { tillCode: string; openingFloat: number; notes?: string }) => void }) {
  const [code, setCode] = useState("Till 1");
  const [float, setFloat] = useState("");
  const [tried, setTried] = useState(false);
  const check = validateOpenTillInput({ tillCode: code, openingFloat: float.replace(/,/g, ""), notes: "" });
  return (
    <Card padding="roomy" label="Open the till">
      <div className="flex flex-col gap-kit-12">
        <Text variant="h" as="h2">
          Open the till
        </Text>
        <Text variant="sup" tone="muted">
          Count the float into the drawer, then type it.
        </Text>
        <Field label="Till" value={code} onChange={setCode} required />
        <Field label="Float at the start, UGX" value={float} onChange={setFloat} inputMode="numeric" required error={tried && !check.canSubmit ? check.reasons[0] : undefined} />
        {notice ? (
          <Text variant="body" tone="green" strong>
            {notice}
          </Text>
        ) : null}
        {failure ? <Banner tone="red" title={failure} /> : null}
        <Button
          tone="filled"
          disabled={disabled}
          onClick={() => {
            setTried(true);
            if (check.canSubmit && check.value) onOpen(check.value);
          }}
        >
          {busy ? "Opening…" : "Open the till"}
        </Button>
      </div>
    </Card>
  );
}

function SafeDropSheet({ place, expected, busy, failure, onClose, onDrop }: { place: "bottom" | "middle"; expected?: number; busy: boolean; failure: string | null; onClose: () => void; onDrop: (input: { amount: number; reason: string }) => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("Safe drop");
  const [tried, setTried] = useState(false);
  const check = validateSafeDropInput({ amount: amount.replace(/,/g, ""), reason, expectedCash: expected });
  return (
    <Sheet
      placement={place}
      title="Drop to the safe"
      summary={expected !== undefined ? `UGX ${ugx(expected)} should be in the drawer.` : undefined}
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
              if (check.canSubmit && check.value) onDrop(check.value);
            }}
          >
            Record the drop
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-kit-12">
        <Field label="Amount, UGX" value={amount} onChange={setAmount} inputMode="numeric" required error={tried && !check.canSubmit ? check.reasons[0] : undefined} />
        <Field label="Why" value={reason} onChange={setReason} required />
      </div>
      {failure ? <Banner tone="red" title={failure} /> : null}
    </Sheet>
  );
}
