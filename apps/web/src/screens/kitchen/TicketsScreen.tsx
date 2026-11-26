/**
 * Tickets (drawings Kitchen and Bar): the station's open tickets, oldest first, each coloured by
 * its age against the station's own limits (green, amber, red), allergies in red at the top,
 * voided lines struck through with "do not make", and Ready. Beside them, what to make now across
 * every open ticket, and what is sold out today.
 * At 1920 × 1080 eight tickets fit without scrolling (four across, two down).
 * Left out (listed): the waiter's name on a ticket (the queue carries only the waiter's id, and a
 * chef cannot read the staff list), and the drawing's "Low in the store" (stock is E6/E7).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { Button, Card, Chip, Pill, Text } from "@/components/kit";
import { ticketsKey, useStations } from "@/components/kitchen/KitchenShell";
import { useTouchHeader } from "@/components/pos-shell/TouchShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isBartender } from "@/lib/auth/role";
import { loadMenu } from "@/screens/order/data/menu";

import { stationWord } from "../ready/ReadyScreen";
import { errorWords } from "../shared/words";
import { ageOf, hhmm, loadTickets, markReady, tableWord, toMakeNow, type KitchenTicket } from "./kitchen-data";

export const kitchenMenuKey = (branchId: string | null | undefined) => ["kitchen", "menu", branchId] as const;

function TicketCard({ t, now, busy, onReady, showStation }: { t: KitchenTicket; now: number; busy: boolean; onReady: () => void; showStation: boolean }) {
  const age = ageOf(t, now);
  const flags = [...new Set([...t.allergies.map((a) => `${a} allergy`), ...t.lines.filter((l) => l.allergy && !l.voided).map((l) => `${l.allergy} allergy`)])].map((a) => a.charAt(0).toUpperCase() + a.slice(1));
  const takeaway = t.lines.some((l) => l.takeaway && !l.voided);
  return (
    <div className="flex [&>section]:flex [&>section]:flex-1 [&>section]:flex-col">
    <Card padding="regular" label={`${tableWord(t.table, t.serviceType)}, ${age.minutes} min`}>
      <div className="flex flex-1 flex-col gap-kit-8" data-kitchen-ticket={t.id} data-age={age.tone}>
        <div className="flex items-center gap-kit-8">
          <Text variant="h">{tableWord(t.table, t.serviceType)}</Text>
          <span className="flex-1" />
          <Pill tone={age.tone}>{`${age.minutes} min`}</Pill>
        </div>
        <Text variant="sup" tone="muted">{`${showStation ? `${stationWord(t.station)} · ` : ""}sent ${hhmm(t.startedAt)}${t.recalledAt ? " · brought back" : ""}`}</Text>
        {flags.length || takeaway ? (
          <div className="flex flex-wrap gap-kit-6" data-kitchen-flags>
            {flags.map((f) => <Pill key={f} tone="red">{f}</Pill>)}
            {takeaway ? <Pill tone="neutral">Takeaway</Pill> : null}
          </div>
        ) : null}
        <div className="flex flex-1 flex-col gap-kit-4">
          {t.lines.map((l) => (
            <div key={l.id} className="flex flex-col" data-kitchen-line={l.voided ? "voided" : "live"}>
              <span className={["text-kit-row", l.voided ? "text-kit-muted line-through" : "text-kit-text"].join(" ")}>
                <strong>{l.quantity}</strong> {l.name}
              </span>
              {[l.serving, l.notes, l.allergy && !l.voided ? `${l.allergy} allergy` : null].filter(Boolean).length ? (
                <span className={["text-kit-small", l.allergy && !l.voided ? "text-kit-red" : "text-kit-muted"].join(" ")}>
                  {[l.serving, l.notes, l.allergy && !l.voided ? `${l.allergy} allergy` : null].filter(Boolean).join(" · ")}
                </span>
              ) : null}
              {l.voided ? <span className="text-kit-small text-kit-red">{`Voided ${hhmm(l.voidedAt)}, do not make`}</span> : null}
            </div>
          ))}
        </div>
        <div className="flex flex-none">
          <Button tone="tonal" fill disabled={busy} onClick={onReady}>
            {busy ? "Saving…" : "Ready"}
          </Button>
        </div>
      </div>
    </Card>
    </div>
  );
}

export function TicketsScreen() {
  const { accessToken, branchId, user } = useAuth();
  const qc = useQueryClient();
  const stations = useStations();
  const bar = isBartender(user);
  const [station, setStation] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(t);
  }, []);
  const ctx = accessToken && branchId ? { token: accessToken, branchId } : null;
  const q = useQuery({
    queryKey: ticketsKey(branchId, stations),
    enabled: Boolean(ctx),
    queryFn: () => loadTickets(ctx!, stations),
    refetchInterval: 5_000,
    staleTime: 2_000,
  });
  const menuQ = useQuery({ queryKey: kitchenMenuKey(branchId), enabled: Boolean(ctx), queryFn: () => loadMenu(ctx!.token, ctx!.branchId), refetchInterval: 15_000 });
  const open = useMemo(() => (q.data ?? []).filter((t) => t.status !== "READY"), [q.data]);
  const shown = station ? open.filter((t) => t.station === station) : open;
  const oldest = open[0] ? ageOf(open[0], now).minutes : null;
  const soldOut = Object.values(menuQ.data?.items ?? {}).filter((i) => i.availability.state === "soldOut" && stations.includes(i.station ?? ""));
  const makeNow = toMakeNow(shown);

  useTouchHeader({
    title: bar ? "Bar" : "Kitchen",
    summary: q.data ? `${open.length === 1 ? "1 order" : `${open.length} orders`}${oldest !== null ? ` · oldest ${oldest} min` : ""}` : undefined,
    asAt: q.dataUpdatedAt || undefined,
  });

  async function ready(t: KitchenTicket) {
    if (!ctx) return;
    setBusy(t.id);
    setFailure(null);
    try {
      await markReady(ctx, t.id);
      await qc.invalidateQueries({ queryKey: ["kitchen", "tickets", branchId] });
    } catch (e) {
      setFailure(errorWords(e, "That did not go through. Try again."));
    } finally {
      setBusy(null);
    }
  }

  const perStation = stations.map((s) => ({ s, n: open.filter((t) => t.station === s).length })).filter((x) => x.n > 0 || stations.length === 1);
  return (
    <div className="flex min-h-0 flex-1 gap-kit-16 px-kit-16 pb-kit-16 pt-kit-14 sm:px-kit-32 sm:pt-kit-16" data-kitchen-screen>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-kit-12">
        {stations.length > 1 ? (
          <div className="flex flex-wrap items-center gap-kit-8" role="group" aria-label="Stations">
            <Chip label="All stations" count={open.length} current={station === null} onClick={() => setStation(null)} />
            {perStation.map(({ s, n }) => <Chip key={s} label={stationWord(s)} count={n} current={station === s} onClick={() => setStation(s)} />)}
          </div>
        ) : null}
        <Text variant="sup" tone="muted">
          {`Oldest first. Green under ${Math.round((open[0]?.amberAt ?? 600) / 60)} minutes, amber under ${Math.round((open[0]?.redAt ?? 1200) / 60)}, red after.`}
        </Text>
        {failure ? <Text variant="body" tone="red">{failure}</Text> : null}
        {q.isError ? (
          <Card padding="roomy" label="Tickets did not load">
            <div className="flex flex-col items-start gap-kit-12">
              <Text variant="h">Tickets did not load</Text>
              <Text variant="body" tone="muted">{errorWords(q.error, "Try again when the connection is stable.")}</Text>
              <Button tone="tonal" onClick={() => void q.refetch()}>Try again</Button>
            </div>
          </Card>
        ) : !q.data ? (
          <Text variant="body" tone="muted">Reading the tickets…</Text>
        ) : shown.length === 0 ? (
          <Card padding="roomy" label="No tickets">
            <div className="flex flex-col gap-kit-8">
              <Text variant="h">No tickets waiting</Text>
              <Text variant="body" tone="muted">A ticket shows here the moment a waiter sends to this station.</Text>
            </div>
          </Card>
        ) : (
          <div className="grid min-h-0 grid-cols-1 content-start gap-kit-12 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" data-kitchen-tickets>
            {shown.map((t) => <TicketCard key={t.id} t={t} now={now} busy={busy === t.id} onReady={() => void ready(t)} showStation={stations.length > 1 && station === null} />)}
          </div>
        )}
      </div>
      <aside className="hidden w-kit-sheet-wide-gap flex-none flex-col gap-kit-12 overflow-y-auto lg:flex" aria-label="To make now" data-kitchen-side>
        <Card padding="regular" label={bar ? "To pour now" : "To make now"}>
          <div className="flex flex-col gap-kit-6">
            <Text variant="row">{bar ? "To pour now, all orders" : "To make now, all orders"}</Text>
            {makeNow.length ? (
              makeNow.map((m) => (
                <div key={m.name} className="flex items-baseline gap-kit-8" data-make-now>
                  <Text variant="body" strong>{String(m.quantity)}</Text>
                  <Text variant="body">{m.name}</Text>
                </div>
              ))
            ) : (
              <Text variant="sup" tone="muted">Nothing to make.</Text>
            )}
          </div>
        </Card>
        <Card padding="regular" label="Sold out today">
          <div className="flex flex-col gap-kit-6" data-kitchen-soldout>
            <Text variant="row">Sold out today</Text>
            {soldOut.length ? soldOut.map((i) => <Text key={i.id} variant="body">{i.name}</Text>) : <Text variant="sup" tone="muted">Nothing is sold out.</Text>}
            <Text variant="sup" tone="muted">Waiters see it greyed out on the menu.</Text>
          </div>
        </Card>
      </aside>
    </div>
  );
}
