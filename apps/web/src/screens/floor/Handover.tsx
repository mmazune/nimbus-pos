/**
 * Hand-overs (T2 E3; drawings Handover-Offer and Handover-Accept).
 *   HandoverOfferSheet  "Hand over your tables": every open table of mine to one colleague, who accepts.
 *   useIncomingHandover the colleague's Floor asks every few seconds whether a hand-over waits for them,
 *                       and shows it: "Amina K. offers you 6 tables", Say no or Accept.
 * Colleagues are the people holding tables now (a waiter can read the open orders, not a staff list);
 * someone on shift with no table yet is not offered (listed in the T5 report).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button, OptionTile, Row, RowGroup, Sheet, Text } from "@/components/kit";
import { apiRequest } from "@/lib/api/client";
import { formatMoney, groupShillings, toMinor } from "@/screens/order/data/money";
import { answerHandover, colleaguesOnFloor, listHandovers, offerHandover, type Handover } from "@/screens/order/data/seating";

type Ctx = { token: string; branchId: string };

type MyTable = { tableId: string; label: string; openMinor: number };

async function myOpenTables(ctx: Ctx, meId: string): Promise<MyTable[]> {
  type Row = { userId?: string | null; tableId?: string | null; total?: string | number | null; table?: { label?: string | null } | null };
  const res = await apiRequest<{ data?: Row[] }>("/api/pos/orders?excludeStatus=CLOSED,VOIDED&pageSize=500", ctx);
  const by = new Map<string, MyTable>();
  for (const o of res.data ?? []) {
    if (o.userId !== meId || !o.tableId) continue;
    const t = by.get(o.tableId) ?? { tableId: o.tableId, label: (o.table?.label ?? "").trim() || "Table", openMinor: 0 };
    t.openMinor += toMinor(o.total) ?? 0;
    by.set(o.tableId, t);
  }
  return [...by.values()].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

export function HandoverOfferSheet({ ctx, meId, meName, phone, onClose, onOffered }: { ctx: Ctx; meId: string; meName: string; phone: boolean; onClose: () => void; onOffered: (to: string) => void }) {
  const [to, setTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mineQ = useQuery({ queryKey: ["handover", "mine", ctx.branchId, meId], queryFn: () => myOpenTables(ctx, meId), staleTime: 5_000 });
  const othersQ = useQuery({ queryKey: ["handover", "colleagues", ctx.branchId, meId], queryFn: () => colleaguesOnFloor(ctx, meId), staleTime: 5_000 });
  const mine = mineQ.data ?? [];
  const sum = mine.reduce((s, t) => s + t.openMinor, 0);
  const chosen = othersQ.data?.find((c) => c.userId === to);
  return (
    <Sheet
      placement={phone ? "bottom" : "middle"}
      title="Hand over your tables"
      summary={`End of shift · ${meName}`}
      onClose={onClose}
      footer={
        <>
          <Button tone="text" onClick={onClose}>Cancel</Button>
          <span className="flex-1" />
          <Button
            tone="filled"
            disabled={!chosen || !mine.length || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await offerHandover(ctx, to as string, { all: true });
                onOffered(chosen?.name ?? "your colleague");
              } catch (e) {
                setError(e instanceof Error ? e.message : "The offer did not go through. Nothing changed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            {chosen ? `Offer ${mine.length === 1 ? "1 table" : `${mine.length} tables`} to ${chosen.name}` : "Choose who"}
          </Button>
        </>
      }
    >
      <Text variant="row">{`Tables · ${mine.length} · ${formatMoney(sum)} open`}</Text>
      <RowGroup>
        {mine.map((t) => (
          <Row key={t.tableId} size="settings" title={/^\d+$/.test(t.label) ? `Table ${t.label}` : t.label} trailing={<Text variant="sup">{groupShillings(t.openMinor)}</Text>} />
        ))}
      </RowGroup>
      <Text variant="row">To</Text>
      <div className="grid grid-cols-2 gap-kit-8" data-handover-to>
        {(othersQ.data ?? []).map((c) => (
          <OptionTile key={c.userId} label={c.name} second={`${c.tables === 1 ? "1 table" : `${c.tables} tables`} · ${groupShillings(c.openMinor)} open`} current={to === c.userId} onClick={() => setTo(c.userId)} />
        ))}
      </div>
      {othersQ.data && othersQ.data.length === 0 ? <Text variant="sup" tone="muted">No colleague has a table on the floor right now.</Text> : null}
      <Text variant="sup" tone="muted">{`${chosen?.name ?? "They"} must accept on their screen. Your shift ends when every table is taken. Your sales so far stay yours.`}</Text>
      {error ? <Text variant="sup" tone="red">{error}</Text> : null}
    </Sheet>
  );
}

/** The colleague's side: a waiting hand-over shows on their Floor until they answer. */
export function IncomingHandover({ ctx, phone, onAnswered }: { ctx: Ctx; phone: boolean; onAnswered: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["handover", "incoming", ctx.branchId], queryFn: () => listHandovers(ctx), refetchInterval: 5_000, staleTime: 2_000 });
  const h: Handover | undefined = q.data?.incoming.find((x) => x.id !== hidden);
  if (!h) return null;
  const n = h.tables.length;
  const answer = async (a: "accept" | "decline") => {
    setBusy(true);
    setError(null);
    try {
      await answerHandover(ctx, h.id, a);
      setHidden(h.id);
      await qc.invalidateQueries({ queryKey: ["handover"] });
      onAnswered();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That did not go through. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      placement={phone ? "bottom" : "middle"}
      title={`${h.fromName} offers you ${n === 1 ? "1 table" : `${n} tables`}`}
      summary={`${h.fromName} is ending the shift. ${n === 1 ? "It becomes yours" : "They become yours"} when you accept.`}
      onClose={() => setHidden(h.id)}
      footer={
        <>
          <Button tone="text" disabled={busy} onClick={() => answer("decline")}>Say no</Button>
          <span className="flex-1" />
          <Button tone="filled" disabled={busy} onClick={() => answer("accept")}>{`Accept ${n === 1 ? "1 table" : `${n} tables`}`}</Button>
        </>
      }
    >
      <RowGroup>
        {h.tables.map((t) => (
          <Row key={t.id} size="settings" title={/^\d+$/.test(t.label) ? `Table ${t.label}` : t.label} />
        ))}
      </RowGroup>
      {error ? <Text variant="sup" tone="red">{error}</Text> : null}
    </Sheet>
  );
}
