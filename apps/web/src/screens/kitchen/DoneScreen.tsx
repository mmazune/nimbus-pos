/**
 * Done (drawing Kitchen-Done): tickets marked Ready, newest first, with how long each took and
 * whether the waiter has collected it. Tapping one opens it with "Bring back to Tickets" — for a
 * plate bumped by mistake: it returns to Tickets with its first time kept and the waiter's Ready
 * line is taken down (T2 recall).
 * Left out (listed): the waiter's name (the queue carries only an id).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button, Card, Pill, Row, RowGroup, Segmented, Sheet, Text } from "@/components/kit";
import { useStations } from "@/components/kitchen/KitchenShell";
import { useTouchHeader } from "@/components/pos-shell/TouchShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isBartender } from "@/lib/auth/role";

import { useWide } from "../floor/useWide";
import { errorWords } from "../shared/words";
import { bringBack, hhmm, loadTickets, tableWord, type KitchenTicket } from "./kitchen-data";

export function DoneScreen() {
  const { accessToken, branchId, user } = useAuth();
  const qc = useQueryClient();
  const wide = useWide();
  const stations = useStations();
  const [span, setSpan] = useState<"hour" | "today">("hour");
  const [open, setOpen] = useState<KitchenTicket | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const ctx = accessToken && branchId ? { token: accessToken, branchId } : null;
  const q = useQuery({
    queryKey: ["kitchen", "done", branchId, stations.join(",")],
    enabled: Boolean(ctx),
    queryFn: () => loadTickets(ctx!, stations, "READY"),
    refetchInterval: 8_000,
  });
  const since = span === "hour" ? Date.now() - 3600_000 : new Date().setHours(0, 0, 0, 0);
  const done = (q.data ?? [])
    .filter((t) => t.readyAt && new Date(t.readyAt).getTime() >= since)
    .sort((a, b) => String(b.readyAt).localeCompare(String(a.readyAt)));
  useTouchHeader({
    title: isBartender(user) ? "Bar" : "Kitchen",
    summary: q.data ? `${span === "hour" ? "Done in the last hour" : "Done today"} · ${done.length === 1 ? "1 ticket" : `${done.length} tickets`}` : undefined,
    asAt: q.dataUpdatedAt || undefined,
  });
  const took = (t: KitchenTicket) => (t.readyAt ? `${Math.max(1, Math.round((new Date(t.readyAt).getTime() - new Date(t.startedAt).getTime()) / 60000))} min` : "");

  async function back(t: KitchenTicket) {
    if (!ctx) return;
    setBusy(true);
    setFailure(null);
    try {
      await bringBack(ctx, t.id);
      setOpen(null);
      await qc.invalidateQueries({ queryKey: ["kitchen"] });
    } catch (e) {
      setFailure(errorWords(e, "That did not go through. Try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-kit-14 px-kit-16 pb-kit-16 pt-kit-14 sm:px-kit-32 sm:pt-kit-16" data-kitchen-done>
      <Segmented
        label="When"
        value={span}
        onChange={(k) => setSpan(k as "hour" | "today")}
        options={[
          { key: "hour", label: "Last hour" },
          { key: "today", label: "Today" },
        ]}
      />
      <Text variant="sup" tone="muted">Newest first. Tap a ticket to bring it back.</Text>
      {!q.data ? (
        <Text variant="body" tone="muted">Reading what is done…</Text>
      ) : done.length === 0 ? (
        <Card padding="roomy" label="Nothing done">
          <Text variant="body" tone="muted">Nothing marked Ready in this time.</Text>
        </Card>
      ) : (
        <Card padding="none" label="Done tickets">
          <RowGroup>
            {done.map((t) => (
              <Row
                key={t.id}
                title={tableWord(t.table, t.serviceType)}
                line={`Done ${hhmm(t.readyAt)} · took ${took(t)}`}
                trailing={t.collectedAt ? <Pill tone="neutral">{`Collected ${hhmm(t.collectedAt)}`}</Pill> : <Pill tone="green">Ready</Pill>}
                onClick={() => setOpen(t)}
              />
            ))}
          </RowGroup>
        </Card>
      )}
      {open ? (
        <Sheet
          placement={wide.phone ? "bottom" : "middle"}
          title={tableWord(open.table, open.serviceType)}
          summary={`Sent ${hhmm(open.startedAt)} · done ${hhmm(open.readyAt)} · ${open.collectedAt ? `collected ${hhmm(open.collectedAt)}` : "ready, not collected"}`}
          onClose={() => setOpen(null)}
          footer={
            <>
              <Button tone="text" onClick={() => setOpen(null)}>Close</Button>
              <span className="flex-1" />
              <Button tone="filled" disabled={busy} onClick={() => void back(open)}>Bring back to Tickets</Button>
            </>
          }
        >
          <div className="flex flex-col gap-kit-4">
            {open.lines.map((l) => (
              <Text key={l.id} variant="body">{`${l.quantity} ${l.name}${l.voided ? " (voided)" : ""}`}</Text>
            ))}
          </div>
          <Text variant="sup" tone="muted">Bumped by mistake, or the plate went to the wrong table? Bring it back: it goes to the top of Tickets with its first time kept, and the waiter’s Ready line is taken down.</Text>
          {failure ? <Text variant="sup" tone="red">{failure}</Text> : null}
        </Sheet>
      ) : null}
    </div>
  );
}
