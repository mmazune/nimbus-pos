/**
 * Sold out (drawings Kitchen-Sold-Out and Kitchen-Set-Number): the station's items that are out or
 * counted down, and every item when asked. Mark sold out, Back on, and Set a number — each one is
 * T2's availability route, so every waiter's menu greys out or shows "N left" within seconds.
 * Left out (listed): who marked it (the answer carries only an id) and the stock warnings
 * ("Check stock", "We have it"), which wait for the stock engine (E6/E7).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button, Card, Field, OptionTile, Pill, Row, RowGroup, Segmented, Sheet, Text } from "@/components/kit";
import { useStations } from "@/components/kitchen/KitchenShell";
import { useTouchHeader } from "@/components/pos-shell/TouchShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isBartender } from "@/lib/auth/role";
import { loadMenu, soldSince, type MenuItem } from "@/screens/order/data/menu";

import { useWide } from "../floor/useWide";
import { errorWords } from "../shared/words";
import { markAvailable, markSoldOut, setLeft } from "./kitchen-data";
import { kitchenMenuKey } from "./TicketsScreen";

const QUICK = [5, 10, 12, 20];

export function SoldOutScreen() {
  const { accessToken, branchId, user } = useAuth();
  const qc = useQueryClient();
  const wide = useWide();
  const stations = useStations();
  const ctx = accessToken && branchId ? { token: accessToken, branchId } : null;
  const [view, setView] = useState<"out" | "all">("out");
  const [find, setFind] = useState("");
  const [setting, setSetting] = useState<MenuItem | null>(null);
  const [count, setCount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const q = useQuery({ queryKey: kitchenMenuKey(branchId), enabled: Boolean(ctx), queryFn: () => loadMenu(ctx!.token, ctx!.branchId), refetchInterval: 10_000 });
  const groupName = useMemo(() => {
    const m = new Map<string, string>();
    for (const sec of q.data?.sections ?? []) for (const g of sec.groups) if (g.kind === "plain") for (const id of g.itemIds) if (!m.has(id)) m.set(id, g.name);
    return m;
  }, [q.data]);
  const mine = Object.values(q.data?.items ?? {}).filter((i) => stations.includes(i.station ?? ""));
  const outOrLow = mine.filter((i) => i.availability.state !== "available");
  const needle = find.trim().toLowerCase();
  const listed = (view === "out" ? outOrLow : mine)
    .filter((i) => !needle || i.name.toLowerCase().includes(needle) || i.initials.startsWith(needle))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, view === "all" && !needle ? 60 : 200);

  useTouchHeader({ title: isBartender(user) ? "Bar" : "Kitchen", summary: q.data ? `Sold out and low · ${outOrLow.length}` : undefined, asAt: q.dataUpdatedAt || undefined });

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setFailure(null);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: kitchenMenuKey(branchId) });
      void qc.invalidateQueries({ queryKey: ["kitchen", "tickets", branchId] });
    } catch (e) {
      setFailure(errorWords(e, "That did not go through. Try again."));
    } finally {
      setBusy(null);
    }
  }

  const n = Number(count.replace(/\D/g, ""));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-kit-14 px-kit-16 pb-kit-16 pt-kit-14 sm:px-kit-32 sm:pt-kit-16" data-kitchen-soldout-screen>
      <div className="flex flex-wrap items-end gap-kit-12">
        <Segmented
          label="Which items"
          value={view}
          onChange={(k) => setView(k as "out" | "all")}
          options={[
            { key: "out", label: `Out or low · ${outOrLow.length}` },
            { key: "all", label: `All ${mine.length} items` },
          ]}
        />
        <div className="min-w-kit-0 flex-1">
          <Field label="Find an item" value={find} placeholder="Name or first letters" onChange={setFind} />
        </div>
      </div>
      {failure ? <Text variant="body" tone="red">{failure}</Text> : null}
      {!q.data ? (
        <Text variant="body" tone="muted">Reading the menu…</Text>
      ) : listed.length === 0 ? (
        <Card padding="roomy" label="Nothing out">
          <Text variant="body" tone="muted">{view === "out" ? "Nothing is sold out or counted down. Choose All items to mark one." : "No item matches."}</Text>
        </Card>
      ) : (
        <Card padding="none" label="Items">
          <RowGroup>
            {listed.map((i) => {
              const a = i.availability;
              const now = a.state === "soldOut" ? <Pill tone="red">Sold out</Pill> : a.state === "low" ? <Pill tone="amber">{`${a.left} left`}</Pill> : <Pill tone="green">On</Pill>;
              const why = a.state === "soldOut" ? (soldSince(i) ? `Marked at ${soldSince(i)}` : "Marked sold out") : a.state === "low" ? "Number set, counts down with each send" : groupName.get(i.id) ?? "";
              return (
                <div key={i.id} className="flex items-center gap-kit-8 pr-kit-16" data-soldout-row={i.name}>
                  <div className="min-w-kit-0 flex-1">
                    <Row title={i.name} line={[groupName.get(i.id), why].filter(Boolean).filter((v, k, arr) => arr.indexOf(v) === k).join(" · ")} trailing={now} />
                  </div>
                  <Button tone="tonal" size="laptop" disabled={busy !== null} onClick={() => { setSetting(i); setCount(a.state === "low" ? String(a.left) : ""); }}>
                    Set a number
                  </Button>
                  {a.state === "soldOut" ? (
                    <Button tone="tonal" size="laptop" disabled={busy !== null} onClick={() => void act(i.id, () => markAvailable(ctx!, i.id))}>Back on</Button>
                  ) : (
                    <Button tone="tonal" size="laptop" disabled={busy !== null} onClick={() => void act(i.id, () => markSoldOut(ctx!, i.id))}>Mark sold out</Button>
                  )}
                </div>
              );
            })}
          </RowGroup>
        </Card>
      )}
      <Text variant="sup" tone="muted">Sold out greys the item for every waiter at once. A number counts down with each send; at 0 it is sold out. Marks and numbers clear when the day closes.</Text>
      {setting ? (
        <Sheet
          placement={wide.phone ? "bottom" : "middle"}
          title={`How many ${setting.name} are left now?`}
          summary={setting.availability.state === "low" ? `Now ${setting.availability.left} left` : "Counted by hand"}
          onClose={() => setSetting(null)}
          footer={
            <>
              <Button tone="text" onClick={() => setSetting(null)}>Cancel</Button>
              <span className="flex-1" />
              <Button tone="filled" disabled={!count || busy !== null} onClick={() => void act(setting.id, () => setLeft(ctx!, setting.id, n)).then(() => setSetting(null))}>
                {count ? `Set ${n} left` : "Type a number"}
              </Button>
            </>
          }
        >
          <Field label="Left now" value={count} inputMode="numeric" placeholder="For example 12" onChange={(v) => setCount(v.replace(/\D/g, "").slice(0, 3))} />
          <div className="grid grid-cols-4 gap-kit-8">
            {QUICK.map((k) => <OptionTile key={k} label={String(k)} current={n === k && count !== ""} onClick={() => setCount(String(k))} />)}
          </div>
          <Text variant="sup" tone="muted">{`Each send of ${setting.name} takes one. Waiters see “N left”; at 0 it greys out.`}</Text>
        </Sheet>
      ) : null}
    </div>
  );
}
