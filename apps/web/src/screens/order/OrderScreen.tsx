/**
 * The one order screen (R1): one tap on a table opens it, full screen, for every
 * role. Rights change the buttons, not the screen. Drawings: Order-Empty,
 * Order-Terminal, Order-Other, Order-Laptop, Supervisor-Table, Supervisor-Void,
 * Cashier-Pay, and the phone set (Order-Phone, -Check, -Item).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Banner, Button, Card, KitIcon, OrderHeader, Sheet, Text } from "@/components/kit";
import { useAuth } from "@/lib/auth/AuthProvider";

import { loadItemChoices, loadMenu, type MenuChoiceGroup, type MenuItem, type MenuServing } from "./data/menu";
import { formatMoney } from "./data/money";
import { sentRounds, type LineChoice, type OrderLineModel } from "./data/order";
import { filledAction, rightsFor, type OrderRole } from "./data/rights";
import { unitPriceOf, useOrderSession } from "./data/useOrderSession";
import { ItemSheet, type ItemSheetResult } from "./parts/ItemSheet";
import { firstNav, MenuPane, type MenuNav, type MixerOffer } from "./parts/MenuPane";
import { OrderPanel, sendLabel } from "./parts/OrderPanel";
import { TableActionsSheet } from "./parts/TableActionsSheet";
import { VoidSheet } from "./parts/VoidSheet";
import { PayPane } from "./parts/PayPane";
import { PhoneOrderScreen } from "./phone/PhoneOrderScreen";
import { useIsPhone } from "./useIsPhone";

export type OrderScreenProps = {
  role: OrderRole;
  tableId: string;
  tableLabel: string;
  seats?: number | null;
  /** "touch": full screen over the shell. "laptop": under the manager's top bar (Order-Laptop). */
  frame?: "touch" | "laptop";
  /** Where the laptop breadcrumb starts, e.g. "Floor › Main hall". */
  trail?: string;
  onClose: () => void;
  /** The floor should re-read after a send, void or payment. */
  onChanged?: () => void;
  /** A booking on a table with no order: seat them here first (Table-Life, "Reserved"). */
  reservation?: { title: string; detail: string; onSeat: () => Promise<boolean> } | null;
  /** Why this person cannot order right now (a waiter whose shift is not open). */
  orderingBlocked?: { title: string; detail: string } | null;
};

const MIXER = /mixer/i;
const DRINKS = (l: OrderLineModel, item: MenuItem | undefined) => item?.sectionKey === "DRINKS" || l.station === "BAR";

export function tableTitle(label: string) {
  return /^\d+$/.test(label.trim()) ? `Table ${label.trim()}` : label.trim();
}

function openFor(iso: string | null, now: number) {
  if (!iso) return null;
  const mins = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `open ${mins} min`;
  return `open ${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, "0")}`;
}

export type SheetState =
  | { kind: "item"; item: MenuItem; groups: MenuChoiceGroup[]; initial: ItemSheetResult; mode: "add" | "edit"; lineKey?: string }
  | { kind: "leave" }
  | { kind: "void"; line: OrderLineModel }
  | { kind: "actions" }
  | { kind: "bill" }
  | { kind: "orders" }
  | null;

export function OrderScreen(props: OrderScreenProps) {
  const { role, tableId, tableLabel, seats, frame = "touch", trail, onClose, onChanged, reservation, orderingBlocked } = props;
  const { accessToken, branchId, user } = useAuth();
  const qc = useQueryClient();
  const ctx = useMemo(() => (accessToken && branchId ? { token: accessToken, branchId } : null), [accessToken, branchId]);
  const rights = useMemo(() => {
    const r = rightsFor(role, user?.permissions ?? []);
    return orderingBlocked ? { ...r, canOrder: false } : r;
  }, [role, user?.permissions, orderingBlocked]);
  const [seating, setSeating] = useState(false);
  const phone = useIsPhone();

  const session = useOrderSession({ ctx, tableId, canReadOthers: rights.canReadOthers, userId: user?.id ?? null, onChanged });
  const menuQ = useQuery({
    queryKey: ["order-screen", "menu", branchId],
    enabled: Boolean(ctx),
    queryFn: () => loadMenu(ctx!.token, ctx!.branchId),
    staleTime: 5 * 60_000,
  });
  const menu = menuQ.data;

  const [nav, setNav] = useState<MenuNav | null>(null);
  const [armedQty, setArmedQty] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<SheetState>(null);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [billAsked, setBillAsked] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (menu && !nav) setNav(firstNav(menu));
  }, [menu, nav]);

  const readOnly = Boolean(session.summary);
  const order = session.order;
  const summary = session.summary;
  const hasSent = session.lines.some((l) => l.state !== "unsent");
  const localUnsent = session.lines.filter((l) => l.state === "unsent" && !l.serverId);
  const filled = filledAction(rights, session.unsentCount, hasSent, readOnly);

  // Quantity first from a keyboard: a digit arms the next item, Esc clears it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (/^[1-9]$/.test(e.key) && !sheet) setArmedQty(Number(e.key));
      if (e.key === "Escape" && !sheet) setArmedQty(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  const choicesOf = useCallback(
    (itemId: string) =>
      qc.fetchQuery({
        queryKey: ["order-screen", "choices", branchId, itemId],
        queryFn: () => loadItemChoices(ctx!.token, ctx!.branchId, itemId),
        staleTime: 10 * 60_000,
      }),
    [branchId, ctx, qc],
  );

  const [choiceError, setChoiceError] = useState<string | null>(null);

  const pick = useCallback(
    async (item: MenuItem, serving: MenuServing | null) => {
      if (readOnly || !rights.canOrder || !ctx) return;
      const quantity = armedQty ?? 1;
      setArmedQty(null);
      let groups: MenuChoiceGroup[] = [];
      try {
        groups = await choicesOf(item.id);
        setChoiceError(null);
      } catch {
        setChoiceError(`The choices for ${item.name} did not load. Try again.`);
        return;
      }
      const sheetGroups = groups.filter((g) => !MIXER.test(g.name));
      const measured = item.servings.length > 1;
      const needsSheet = measured ? sheetGroups.some((g) => g.required) : sheetGroups.length > 0;
      if (needsSheet) {
        setSheet({ kind: "item", item, groups: sheetGroups, initial: { serving, choices: [], note: "", quantity }, mode: "add" });
        return;
      }
      const line = session.add({ item, serving, choices: [], note: "", quantity });
      setLastAddedKey(line.key);
    },
    [armedQty, choicesOf, ctx, readOnly, rights.canOrder, session],
  );

  // "Add a mixer" under a measured drink just added (drawing Order-Terminal).
  const mixerGroupQ = useQuery({
    queryKey: ["order-screen", "choices", branchId, session.lines.find((l) => l.key === lastAddedKey)?.menuItemId ?? "none"],
    enabled: Boolean(ctx && lastAddedKey && session.lines.some((l) => l.key === lastAddedKey)),
    queryFn: () => loadItemChoices(ctx!.token, ctx!.branchId, session.lines.find((l) => l.key === lastAddedKey)!.menuItemId),
    staleTime: 10 * 60_000,
  });
  const lastLine = session.lines.find((l) => l.key === lastAddedKey && l.state === "unsent" && !l.serverId) ?? null;
  const mixerGroup = mixerGroupQ.data?.find((g) => MIXER.test(g.name)) ?? null;
  const mixer: MixerOffer | null =
    lastLine && mixerGroup
      ? { line: lastLine, group: mixerGroup, currentOptionId: lastLine.choices.find((c) => c.groupId === mixerGroup.id)?.optionId ?? null }
      : null;

  const chooseMixer = (optionId: string) => {
    if (!mixer || !menu) return;
    const option = mixer.group.options.find((o) => o.id === optionId);
    const item = menu.items[mixer.line.menuItemId];
    if (!option || !item) return;
    const others = mixer.line.choices.filter((c) => c.groupId !== mixer.group.id);
    const next: LineChoice[] =
      mixer.currentOptionId === optionId
        ? others
        : [...others, { groupId: mixer.group.id, groupName: mixer.group.name, optionId, optionName: option.name, priceDeltaMinor: option.priceDeltaMinor }];
    const serving = item.servings.find((s) => s.id === mixer.line.servingId) ?? null;
    session.setChoices(mixer.line.key, next, unitPriceOf(item, serving, next));
  };

  const openLine = async (line: OrderLineModel) => {
    if (line.state === "sent") {
      if (rights.canVoidLine) setSheet({ kind: "void", line });
      return;
    }
    if (readOnly || !rights.canOrder || !menu) return;
    const item = menu.items[line.menuItemId];
    if (!item) return;
    let groups: MenuChoiceGroup[] = [];
    try {
      groups = (await choicesOf(item.id)).filter((g) => !MIXER.test(g.name));
    } catch {
      groups = [];
    }
    const serving = item.servings.find((s) => s.id === line.servingId) ?? null;
    setSheet({ kind: "item", item, groups, initial: { serving, choices: line.choices, note: line.note, quantity: line.quantity }, mode: "edit", lineKey: line.key });
  };

  const sameAgain = () => {
    if (!menu) return;
    const latest = sentRounds(session.lines)[0];
    if (!latest) return;
    for (const l of latest.lines) {
      const item = menu.items[l.menuItemId];
      if (l.state !== "sent" || !item || !DRINKS(l, item)) continue;
      const serving = item.servings.find((s) => s.id === l.servingId) ?? null;
      session.add({ item, serving, choices: l.choices, note: l.note, quantity: l.quantity });
    }
  };
  const latestRound = sentRounds(session.lines)[0];
  const canSameAgain = Boolean(
    rights.canOrder && !readOnly && menu && latestRound?.lines.some((l) => l.state === "sent" && DRINKS(l, menu.items[l.menuItemId])),
  );

  const back = () => {
    if (paying) {
      setPaying(false);
      return;
    }
    if (localUnsent.length) setSheet({ kind: "leave" });
    else onClose();
  };

  const doSend = async () => {
    await session.send();
  };

  const printBill = async () => {
    const ok = await session.askForBill();
    if (ok) setBillAsked(true);
    setSheet({ kind: "bill" });
  };

  const personName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Signed in";
  const initials = (((user?.firstName ?? "").charAt(0) + (user?.lastName ?? "").charAt(0)) || "·").toUpperCase();
  const waiterName = order?.waiterName ?? summary?.waiterName ?? null;
  const openedAt = order?.openedAt ?? summary?.openedAt ?? null;
  const othersTable = Boolean(waiterName && (order?.waiterId ?? summary?.waiterId) !== user?.id);
  const context = (() => {
    if (!order && !summary) return ["Free", seats ? `${seats} seats` : null].filter(Boolean).join(" · ");
    const who = waiterName ? (othersTable ? `${waiterName}’s table` : waiterName) : null;
    return othersTable ? [who, openFor(openedAt, now)].filter(Boolean).join(" · ") : [openFor(openedAt, now), who].filter(Boolean).join(" · ");
  })();

  const title = tableTitle(tableLabel);
  const sheetPlacement = phone ? "bottom" : "wide";

  const commonSheets = (
    <>
      {sheet?.kind === "item" ? (
        <ItemSheet
          placement={phone ? "bottom" : "wide"}
          item={sheet.item}
          groups={sheet.groups}
          initial={sheet.initial}
          mode={sheet.mode}
          onClose={() => setSheet(null)}
          onRemove={
            sheet.mode === "edit" && sheet.lineKey
              ? () => {
                  session.remove(sheet.lineKey as string);
                  setSheet(null);
                }
              : undefined
          }
          onDone={(r) => {
            if (sheet.mode === "add") {
              const line = session.add({ item: sheet.item, serving: r.serving, choices: r.choices, note: r.note, quantity: r.quantity });
              setLastAddedKey(line.key);
            } else if (sheet.lineKey) {
              session.setChoices(sheet.lineKey, r.choices, unitPriceOf(sheet.item, r.serving, r.choices));
              session.setNote(sheet.lineKey, r.note);
              session.setQuantity(sheet.lineKey, r.quantity);
            }
            setSheet(null);
          }}
        />
      ) : null}
      {sheet?.kind === "leave" ? (
        <Sheet
          placement={phone ? "bottom" : "middle"}
          title={`${localUnsent.reduce((s, l) => s + l.quantity, 0)} items not sent`}
          summary={order ? "They are only on this screen until you send them." : "Nothing is saved until you send. The table stays free if you leave."}
          onClose={() => setSheet(null)}
          footer={
            <>
              <Button
                tone="danger"
                onClick={() => {
                  session.discardUnsent();
                  setSheet(null);
                  onClose();
                }}
              >
                Leave without sending
              </Button>
              <span className="flex-1" />
              <Button
                tone="filled"
                disabled={session.busy !== null}
                onClick={async () => {
                  const ok = await session.send();
                  setSheet(null);
                  if (ok) onClose();
                }}
              >
                {sendLabel(session.unsentCount)}
              </Button>
            </>
          }
        />
      ) : null}
      {sheet?.kind === "void" && order ? (
        <VoidSheet
          placement={phone ? "bottom" : "wide"}
          line={sheet.line}
          tableTitle={title}
          waiterName={waiterName}
          billMinor={session.totalMinor}
          busy={session.busy === "void"}
          error={session.lastError}
          onClose={() => {
            session.clearError();
            setSheet(null);
          }}
          onVoid={async (body) => {
            const ok = await session.voidOne(sheet.line, body);
            if (ok) setSheet(null);
          }}
        />
      ) : null}
      {sheet?.kind === "actions" ? (
        <TableActionsSheet
          placement={phone ? "bottom" : "middle"}
          title={title}
          summary={[waiterName, openFor(openedAt, now), order ? formatMoney(session.totalMinor) : null].filter(Boolean).join(" · ")}
          rights={rights}
          ctx={ctx}
          orderId={order?.id ?? null}
          tableId={tableId}
          canSameAgain={canSameAgain}
          onSameAgain={() => {
            sameAgain();
            setSheet(null);
          }}
          onVoidItem={() => {
            const firstSent = session.lines.find((l) => l.state === "sent");
            setSheet(firstSent ? { kind: "void", line: firstSent } : null);
          }}
          onDone={async (outcome) => {
            setSheet(null);
            setToast(outcome.message);
            await session.refresh();
            onChanged?.();
            if (outcome.leave) onClose();
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet?.kind === "bill" ? (
        <Sheet
          placement={phone ? "bottom" : "middle"}
          title={billAsked ? "Bill asked for" : "Bill not recorded"}
          summary={`${title} · ${formatMoney(session.totalMinor)}`}
          onClose={() => setSheet(null)}
          footer={
            <Button tone="filled" fill onClick={() => setSheet(null)}>
              Done
            </Button>
          }
        >
          <Text variant="sup" tone="muted">
            {billAsked
              ? "The bill request is saved and the cashier sees it. This terminal has no printer connected yet, so nothing printed."
              : session.lastError ?? "The bill request did not go through. Try again."}
          </Text>
        </Sheet>
      ) : null}
      {sheet?.kind === "orders" ? (
        <Sheet placement={sheetPlacement} title={`${session.openOrders.length} open orders on ${title}`} summary="Choose the one to show." onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-kit-8">
            {session.openOrders.map((o, i) => (
              <Button
                key={o.id}
                tone={o.id === order?.id ? "filled" : "tonal"}
                onClick={() => {
                  session.selectOrder(o.id);
                  setSheet(null);
                }}
              >
                {`Order ${i + 1} · ${o.waiterName ?? "no waiter"} · ${formatMoney(o.totalMinor)}`}
              </Button>
            ))}
          </div>
        </Sheet>
      ) : null}
    </>
  );

  const notices = (
    <>
      {toast ? <Banner tone="amber" title={toast} /> : null}
      {orderingBlocked ? <Banner tone="amber" title={orderingBlocked.title} detail={orderingBlocked.detail} /> : null}
      {session.lastError && !sheet ? (
        <Banner tone="red" title="That did not go through" detail={session.lastError} action={{ label: "Close", onClick: session.clearError }} />
      ) : null}
      {choiceError ? <Banner tone="amber" title="Choices not loaded" detail={choiceError} action={{ label: "Close", onClick: () => setChoiceError(null) }} /> : null}
      {session.openOrders.length > 1 ? (
        <Banner tone="amber" title={`${session.openOrders.length} open orders on this table`} detail="This screen shows one at a time." action={{ label: "Choose", onClick: () => setSheet({ kind: "orders" }) }} />
      ) : null}
    </>
  );

  const showActions = rights.canTableActions || canSameAgain;
  const payPane =
    paying && order ? (
      <PayPane
        title={title}
        totalMinor={session.totalMinor}
        busy={session.busy === "pay"}
        error={session.lastError}
        onPay={session.pay}
        onDone={() => {
          setPaying(false);
          onClose();
        }}
      />
    ) : null;

  if (phone && frame === "touch") {
    return (
      <PhoneOrderScreen
        title={title}
        context={context}
        menu={menu}
        menuStatus={menuQ.status}
        nav={nav}
        onNav={setNav}
        session={session}
        rights={rights}
        readOnly={readOnly}
        othersName={othersTable ? waiterName : null}
        filled={filled}
        armedQty={armedQty}
        onArm={setArmedQty}
        onPick={pick}
        mixer={mixer}
        onMixer={chooseMixer}
        onLine={openLine}
        onBack={back}
        onSend={doSend}
        onPrintBill={printBill}
        onTakePayment={() => setPaying(true)}
        onMore={() => setSheet({ kind: "actions" })}
        showMore={showActions && !readOnly}
        onSameAgain={sameAgain}
        canSameAgain={canSameAgain}
        payPane={payPane}
        sheets={commonSheets}
        notices={notices}
      />
    );
  }

  const loading = menuQ.isLoading || session.status === "loading";

  const menuSide = payPane ? (
    payPane
  ) : reservation && !order && !summary && session.status === "ready" ? (
    <div className="flex flex-1 items-center justify-center p-kit-24" data-order-reserved>
      <div className="w-kit-sheet-mid">
        <Card padding="roomy" label={reservation.title}>
          <div className="flex flex-col gap-kit-12">
            <Text variant="h" as="h2">{reservation.title}</Text>
            <Text variant="body" tone="muted">{reservation.detail}</Text>
            <Button
              tone="filled"
              disabled={seating || Boolean(orderingBlocked)}
              onClick={async () => {
                setSeating(true);
                const ok = await reservation.onSeat();
                setSeating(false);
                if (ok) await session.refresh();
              }}
            >
              {seating ? "Seating…" : "Seat them here"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  ) : readOnly ? (
    <div className="flex flex-1 items-center justify-center p-kit-24" data-order-other>
      <div className="w-kit-sheet-mid">
        <Card padding="roomy" label={`This is ${waiterName ?? "another waiter"}’s table`}>
          <div className="flex flex-col gap-kit-12">
            <span className="flex h-kit-bubble w-kit-bubble items-center justify-center rounded-kit-full bg-kit-tonal text-kit-primary" aria-hidden="true">
              <KitIcon name="lock" />
            </span>
            <Text variant="h" as="h2">{`This is ${waiterName ?? "another waiter"}’s table`}</Text>
            <Text variant="body" tone="muted">You can see the order total. To add or change items, the table has to be yours. A supervisor can move it to you.</Text>
          </div>
        </Card>
      </div>
    </div>
  ) : loading || !menu || !nav ? (
    <div className="flex flex-1 items-center justify-center p-kit-24">
      <Text variant="sup" tone="muted">{menuQ.isError || session.status === "error" ? "The menu or the order did not load. Go back and tap the table again." : "Opening the menu…"}</Text>
    </div>
  ) : (
    <div className="flex min-h-kit-0 min-w-kit-0 flex-1 flex-col">
      <div className="flex flex-col gap-kit-8 px-kit-24 pt-kit-16 empty:hidden">{notices}</div>
      <MenuPane
        menu={menu}
        nav={nav}
        onNav={(n) => setNav(n)}
        onPick={pick}
        armedQty={armedQty}
        onArm={setArmedQty}
        mixer={mixer}
        onMixer={chooseMixer}
        searching={searching}
        query={query}
        onQuery={setQuery}
        onCloseSearch={() => {
          setSearching(false);
          setQuery("");
        }}
        density={frame === "laptop" ? "laptop" : "touch"}
        inlineSearch={frame === "laptop" && !searching}
        disabled={!rights.canOrder}
      />
    </div>
  );

  const panel = (
    <OrderPanel
      title={paying ? "Bill" : "Order"}
      lines={session.lines}
      count={session.count}
      totalMinor={readOnly && summary ? summary.totalMinor : session.totalMinor}
      unsentCount={session.unsentCount}
      filled={filled}
      busy={session.busy}
      linesHidden={readOnly}
      onLine={readOnly ? undefined : openLine}
      onSend={doSend}
      onPrintBill={printBill}
      onTakePayment={() => setPaying(true)}
      onMore={showActions && !readOnly && !paying ? () => setSheet({ kind: "actions" }) : undefined}
      onSameAgain={sameAgain}
      canSameAgain={canSameAgain && !paying}
      sentTappable={rights.canVoidLine && !paying}
      billMode={paying}
    />
  );

  return (
    <div
      className={["flex flex-col bg-kit-canvas font-kit", frame === "laptop" ? "fixed inset-x-kit-0 bottom-kit-0 top-kit-app-bar z-40" : "fixed inset-kit-0 z-50"].join(" ")}
      data-order-screen
      data-order-role={role}
      data-order-table={tableId}
    >
      {frame === "laptop" ? (
        <div className="flex h-kit-row flex-none items-center gap-kit-12 bg-kit-card px-kit-32 shadow-kit-panel-bottom" data-order-laptop-bar>
          <Button tone="text" size="laptop" onClick={back}>
            {trail ?? "Floor"}
          </Button>
          <Text variant="row" as="h1">{title}</Text>
          <Text variant="sup" tone="muted">{context}</Text>
          <span className="flex-1" />
          {showActions && !readOnly ? (
            <Button tone="tonal" size="laptop" icon="more" onClick={() => setSheet({ kind: "actions" })}>
              Table actions
            </Button>
          ) : null}
        </div>
      ) : (
        <OrderHeader
          backLabel={paying ? title : "Floor"}
          onBack={back}
          title={paying ? "Take payment" : title}
          context={paying ? [title, waiterName ? `served by ${waiterName}` : null].filter(Boolean).join(" · ") : context}
          searchLabel="Search the whole menu"
          hideSearch={readOnly || paying}
          onSearch={() => setSearching(true)}
          initials={initials}
          personName={personName}
        />
      )}
      <div className="flex min-h-kit-0 flex-1">
        {menuSide}
        {panel}
      </div>
      {commonSheets}
    </div>
  );
}
