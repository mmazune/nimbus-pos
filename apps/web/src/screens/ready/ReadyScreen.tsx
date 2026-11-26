/**
 * Ready (drawing Waiter-Ready): what the kitchen and bar have put on the pass for this waiter,
 * oldest first, each with Collected. Reads T2 `GET /api/kds/ready?scope=mine` every few seconds;
 * Collected is `POST /api/kds/tickets/:id/collected`. The same "Ready" shows on the Floor tile.
 *
 * Left out (listed in the T5 report): the drawing's "Collected in the last hour" list — the ready
 * route returns only what is still waiting, and no route lists collected tickets.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button, Card, Pill, Text } from "@/components/kit";
import { useTouchHeader } from "@/components/pos-shell/TouchShell";
import { apiRequest } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthProvider";

import { formatMinutes } from "../floor/floor-model";
import { errorWords } from "../shared/words";

export type ReadyTicket = {
  id: string;
  station: string;
  orderId: string;
  tableId: string | null;
  tableLabel: string | null;
  waiter?: string | null;
  readyAt: string | null;
  items: Array<{ name: string; quantity: number; allergy?: string | null; takeaway?: boolean | null }>;
};

const STATION: Record<string, string> = {
  KITCHEN: "Kitchen",
  HOT_KITCHEN: "Hot kitchen",
  COLD_KITCHEN: "Cold kitchen",
  GRILL: "Grill",
  DESSERT: "Desserts",
  BAR: "Bar",
};
export const stationWord = (s: string) => STATION[s] ?? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

export const readyKey = (branchId: string | null | undefined) => ["ready", "mine", branchId] as const;

export async function loadReady(token: string, branchId: string): Promise<ReadyTicket[]> {
  const res = await apiRequest<{ tickets?: ReadyTicket[] }>("/api/kds/ready?scope=mine", { token, branchId });
  return res.tickets ?? [];
}

/** The waiter's ready count, for the bar badge (one shared query with the Ready screen). */
export function useReadyCount(enabled: boolean) {
  const { accessToken, branchId } = useAuth();
  const q = useQuery({
    queryKey: readyKey(branchId),
    enabled: enabled && Boolean(accessToken && branchId),
    queryFn: () => loadReady(accessToken as string, branchId as string),
    refetchInterval: 8_000,
    staleTime: 3_000,
  });
  return q.data?.length ?? 0;
}

const tableWord = (label: string | null) => (!label ? "No table" : /^\d+$/.test(label) ? `Table ${label}` : label);

export function ReadyScreen() {
  const { accessToken, branchId } = useAuth();
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const q = useQuery({
    queryKey: readyKey(branchId),
    enabled: Boolean(accessToken && branchId),
    queryFn: () => loadReady(accessToken as string, branchId as string),
    refetchInterval: 5_000,
    staleTime: 2_000,
  });
  const tickets = q.data ?? [];
  useTouchHeader({
    title: "Ready",
    summary: q.data ? (tickets.length ? `${tickets.length === 1 ? "1 order" : `${tickets.length} orders`} waiting to be collected` : "Nothing waiting at the pass") : undefined,
    asAt: q.dataUpdatedAt || undefined,
  });

  async function collect(t: ReadyTicket) {
    if (!accessToken || !branchId) return;
    setBusy(t.id);
    setFailure(null);
    try {
      await apiRequest(`/api/kds/tickets/${t.id}/collected`, { token: accessToken, branchId, method: "POST", body: {} });
      await qc.invalidateQueries({ queryKey: readyKey(branchId) });
      void qc.invalidateQueries({ queryKey: ["waiter", "floor", branchId] });
    } catch (e) {
      setFailure(errorWords(e, "That did not go through. Try again."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-kit-14 px-kit-16 pb-kit-16 pt-kit-14 sm:px-kit-32 sm:pt-kit-16" data-ready-screen>
      {failure ? <Text variant="body" tone="red">{failure}</Text> : null}
      {q.isError ? (
        <Card padding="roomy" label="Ready did not load">
          <div className="flex flex-col items-start gap-kit-12">
            <Text variant="h">Ready did not load</Text>
            <Text variant="body" tone="muted">{errorWords(q.error, "Try again when the connection is stable.")}</Text>
            <Button tone="tonal" onClick={() => void q.refetch()}>Try again</Button>
          </div>
        </Card>
      ) : !q.data ? (
        <Text variant="body" tone="muted">Reading the pass…</Text>
      ) : tickets.length === 0 ? (
        <Card padding="roomy" label="Nothing ready">
          <div className="flex flex-col gap-kit-8">
            <Text variant="h">Nothing is waiting for you</Text>
            <Text variant="body" tone="muted">When the kitchen or the bar taps Ready, the order shows here and its table shows “Ready” on the Floor.</Text>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-kit-14 md:grid-cols-2 xl:grid-cols-3" data-ready-list>
          {tickets.map((t) => {
            const waited = t.readyAt ? Math.max(0, Math.floor((now - new Date(t.readyAt).getTime()) / 60000)) : 0;
            const mins = t.readyAt ? formatMinutes(Math.max(0, Math.floor((now - new Date(t.readyAt).getTime()) / 60000))) : null;
            return (
              <div key={t.id} className="flex [&>section]:flex [&>section]:flex-1 [&>section]:flex-col">
              <Card padding="roomy" label={`${tableWord(t.tableLabel)} ready`}>
                <div className="flex flex-1 flex-col gap-kit-12" data-ready-ticket={t.id}>
                  <div className="flex items-center gap-kit-8">
                    <Text variant="h">{tableWord(t.tableLabel)}</Text>
                    <span className="flex-1" />
                    {/* Waiting at the pass: green while fresh, amber after 5 minutes, red after 10. */}
                    <Pill tone={waited < 5 ? "green" : waited < 10 ? "amber" : "red"}>{mins ? `Ready ${mins}` : "Ready"}</Pill>
                  </div>
                  <Text variant="sup" tone="muted">{`${stationWord(t.station)} · on the pass`}</Text>
                  <div className="flex flex-1 flex-col gap-kit-4">
                    {t.items.map((it, i) => (
                      <Text key={`${it.name}-${i}`} variant="body">
                        {`${it.quantity} ${it.name}`}
                        {it.allergy ? <span className="text-kit-red">{` · ${it.allergy} allergy`}</span> : null}
                        {it.takeaway ? " · Takeaway" : ""}
                      </Text>
                    ))}
                  </div>
                  <div className="flex">
                    <Button tone="tonal" fill disabled={busy !== null} onClick={() => void collect(t)}>
                      {busy === t.id ? "Saving…" : "Collected"}
                    </Button>
                  </div>
                </div>
              </Card>
              </div>
            );
          })}
        </div>
      )}
      <Text variant="sup" tone="muted">A table also shows “Ready” on the Floor. This list is the same thing in the order it came out.</Text>
    </div>
  );
}
