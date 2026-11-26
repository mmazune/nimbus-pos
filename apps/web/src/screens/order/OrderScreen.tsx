/**
 * The one order screen (R1): one tap on a table opens it, full screen, for every
 * role. Rights change the buttons, not the screen. Drawings: Order-Empty,
 * Order-Terminal, Order-Other, Order-Laptop, Supervisor-Table, Supervisor-Void,
 * Cashier-Pay, and the phone set (Order-Phone, -Check, -Item).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ActionTile, Banner, Button, Card, KitIcon, OrderHeader, Pill, Sheet, SquareAction, Text } from "@/components/kit";
import { useAuth } from "@/lib/auth/AuthProvider";

import { loadItemChoices, type MenuChoiceGroup, type MenuItem, type MenuServing } from "./data/menu";
import { useMenu } from "./data/useMenu";
import { formatMoney } from "./data/money";
import { hasOpenTill, sentRounds, takeOverWithSupervisorPin, type LineChoice, type OrderLineModel } from "./data/order";
import { TakeOverSheet } from "./parts/TakeOverSheet";
import { filledAction, rightsFor, type OrderRole } from "./data/rights";
import { unitPriceOf, useOrderSession } from "./data/useOrderSession";
import { ItemSheet, type ItemSheetResult } from "./parts/ItemSheet";
import { firstNav, MenuPane, type MenuNav, type MixerOffer } from "./parts/MenuPane";
import { OrderPanel, sendLabel } from "./parts/OrderPanel";
import { TableActionsSheet, type Step as ActionStep } from "./parts/TableActionsSheet";
import { VoidSheet } from "./parts/VoidSheet";
import { PayPane } from "./parts/PayPane";
import { PhoneOrderScreen } from "./phone/PhoneOrderScreen";
import { useIsPhone } from "./useIsPhone";

export type OrderScreenProps = {
  role: OrderRole;
  /** null for a takeaway or tableless order opened by id. */
  tableId: string | null;
  tableLabel: string | null;
  /** Open this order (Find bill, Find order, `?orderId=`). */
  orderId?: string | null;
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
  | { kind: "actions"; step?: ActionStep }
  | { kind: "bill" }
  | { kind: "orders" }
  | { kind: "takeover" }
  | null;

export function OrderScreen(props: OrderScreenProps) {
  const { role, tableId, tableLabel, orderId, seats, frame = "touch", trail, onClose, onChanged, reservation, orderingBlocked } = props;
  const { accessToken, branchId, user } = useAuth();
  const qc = useQueryClient();
  const ctx = useMemo(() => (accessToken && branchId ? { token: accessToken, branchId } : null), [accessToken, branchId]);
  const rights = useMemo(() => {
    const r = rightsFor(role, user?.permissions ?? []);
    return orderingBlocked ? { ...r, canOrder: false } : r;
  }, [role, user?.permissions, orderingBlocked]);
  const [seating, setSeating] = useState(false);
  const phone = useIsPhone();

  const session = useOrderSession({
    ctx,
    tableId,
    orderId,
    canReadOthers: rights.canReadOthers,
    canReadPayments: rights.canReadPayments,
    userId: user?.id ?? null,
    onChanged,
  });
  const menuQ = useMenu(ctx);
  const menu = menuQ.data;
  const tillQ = useQuery({
    queryKey: ["order-screen", "till", branchId, user?.id],
    enabled: Boolean(ctx && rights.canPay),
    queryFn: () => hasOpenTill(ctx!),
    staleTime: 30_000,
  });

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
  // A fire in its 3-second undo window (drawing Order-Hold-Fire): names, the server's deadline, Undo.
  const [firing, setFiring] = useState<{ fireId: string; until: number; names: string } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!firing) return;
    const t = window.setInterval(() => {
      setTick((n) => n + 1);
      if (Date.now() > firing.until + 500) {
        setFiring(null);
        void session.refresh();
      }
    }, 250);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firing]);
  const doFire = async () => {
    const names = session.lines.filter((l) => l.state === "unsent" && l.held && l.serverId).map((l) => l.name);
    const r = await session.fire();
    // The window is the server's (undoUntil); a terminal clock a little off still shows about 3 seconds.
    const left = Math.min(3500, Math.max(500, new Date(r?.undoUntil ?? 0).getTime() - Date.now()));
    if (r) setFiring({ fireId: r.fireId, until: Date.now() + left, names: names.join(", ") });
  };
  // Laptop: the frame sits under the manager's top bar, whose height follows the old root scale.
  const [barBottom, setBarBottom] = useState<number | null>(null);
  useEffect(() => {
    if (frame !== "laptop") return;
    const measure = () => {
      const bar = document.querySelector("[data-operational-top-nav]");
      setBarBottom(bar ? Math.round(bar.getBoundingClientRect().height) : null);
    };
    window.scrollTo(0, 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [frame]);

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

  const order = session.order;
  const closed = Boolean(order && (order.status === "CLOSED" || order.status === "VOIDED"));
  const readOnly = Boolean(session.summary) || closed;
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
      // The workspace carries each item's choices; the per-item read is only for an item it did not have.
      menu?.items[itemId]?.choices ? Promise.resolve(menu.items[itemId].choices as MenuChoiceGroup[]) : qc.fetchQuery({
        queryKey: ["order-screen", "choices", branchId, itemId],
        queryFn: () => loadItemChoices(ctx!.token, ctx!.branchId, itemId),
        staleTime: 10 * 60_000,
      }),
    [branchId, ctx, menu, qc],
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
  const lastItemId = session.lines.find((l) => l.key === lastAddedKey)?.menuItemId ?? "none";
  const knownChoices = menu?.items[lastItemId]?.choices ?? null;
  const mixerGroupQ = useQuery({
    queryKey: ["order-screen", "choices", branchId, lastItemId],
    enabled: Boolean(ctx && lastAddedKey && !knownChoices && session.lines.some((l) => l.key === lastAddedKey)),
    queryFn: () => loadItemChoices(ctx!.token, ctx!.branchId, lastItemId),
    staleTime: 10 * 60_000,
  });
  const lastLine = session.lines.find((l) => l.key === lastAddedKey && l.state === "unsent" && !l.serverId) ?? null;
  const mixerGroup = (knownChoices ?? mixerGroupQ.data)?.find((g) => MIXER.test(g.name)) ?? null;
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
    setSheet({ kind: "item", item, groups, initial: { serving, choices: line.choices, note: line.note, quantity: line.quantity, allergy: line.allergy, takeaway: line.takeaway, hold: line.serverId ? undefined : Boolean(line.held), guest: line.guest ?? null }, mode: "edit", lineKey: line.key });
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

  // Print bill: the terminal's own print dialog prints the order as shown. On the waiter's
  // own table the bill request is also recorded; on another waiter's table the API refuses
  // that request to a waiter, so only the print happens (nothing is recorded, and the sheet says so).
  const printBill = async () => {
    if (readOnly) {
      setBillAsked(false);
      setSheet({ kind: "bill" });
      window.setTimeout(() => window.print(), 50);
      return;
    }
    const ok = await session.askForBill();
    if (ok) setBillAsked(true);
    setSheet({ kind: "bill" });
    if (ok) window.setTimeout(() => window.print(), 50);
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

  const title = tableLabel ? tableTitle(tableLabel) : order?.number ? `Order ${order.number}` : "Takeaway";
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
              const line = session.add({ item: sheet.item, serving: r.serving, choices: r.choices, note: r.note, quantity: r.quantity, allergy: r.allergy, takeaway: r.takeaway, hold: r.hold, guest: r.guest });
              setLastAddedKey(line.key);
            } else if (sheet.lineKey) {
              session.setChoices(sheet.lineKey, r.choices, unitPriceOf(sheet.item, r.serving, r.choices));
              session.setNote(sheet.lineKey, r.note);
              session.setQuantity(sheet.lineKey, r.quantity);
              session.setFlags(sheet.lineKey, { allergy: r.allergy ?? null, takeaway: Boolean(r.takeaway), held: Boolean(r.hold), guest: r.guest ?? null });
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
          totalMinor={session.totalMinor}
          canSameAgain={canSameAgain}
          onSameAgain={() => {
            sameAgain();
            setSheet(null);
          }}
          sentLines={rights.canVoidLine ? session.lines.filter((l) => l.state === "sent" && l.serverId) : []}
          onVoidItem={(line) => setSheet({ kind: "void", line })}
          lines={session.lines}
          userId={user?.id ?? null}
          hasPayment={session.paidMinor > 0 || !session.paidKnown}
          initialStep={sheet.step}
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
          title={readOnly ? "Bill sent to print" : billAsked ? "Bill asked for" : "Bill not recorded"}
          summary={`${title} · ${formatMoney(session.totalMinor)}`}
          onClose={() => setSheet(null)}
          footer={
            <Button tone="filled" fill onClick={() => setSheet(null)}>
              Done
            </Button>
          }
        >
          <Text variant="sup" tone="muted">
            {readOnly
              ? `The bill went to this terminal’s print dialog. The bill request stays with ${waiterName ?? "the table’s waiter"}.`
              : billAsked
                ? "The bill request is saved on the order, and the bill went to this terminal’s print dialog."
                : session.lastError ?? "The bill request did not go through. Try again."}
          </Text>
        </Sheet>
      ) : null}
      {sheet?.kind === "takeover" && summary && ctx && user?.id ? (
        <TakeOverSheet
          placement={phone ? "bottom" : "middle"}
          title={title}
          fromName={waiterName}
          onClose={() => setSheet(null)}
          onTakeOver={async (pin) => {
            await takeOverWithSupervisorPin(ctx, summary.id, pin, user.id);
            setSheet(null);
            setToast(`${title} is yours now`);
            await session.refresh();
            onChanged?.();
          }}
        />
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
      {firing ? (
        <Banner
          tone="amber"
          title={`${firing.names} ${firing.names.includes(",") ? "go" : "goes"} to the kitchen in ${Math.max(0, Math.ceil((firing.until - Date.now()) / 1000))} seconds`}
          detail={tick >= 0 ? "Undo keeps it held." : undefined}
          action={{
            label: "Undo",
            onClick: async () => {
              const f = firing;
              setFiring(null);
              const ok = await session.undo(f.fireId);
              setToast(ok ? `${f.names} held again` : "Too late to undo: it has gone to the kitchen");
            },
          }}
        />
      ) : null}
      {session.sendReport ? (
        <Banner
          tone="amber"
          title={`Not sent: ${session.sendReport.skipped.map((k) => `${k.quantity} ${k.name}`).join(", ")}`}
          detail={`${session.sendReport.skipped.some((k) => k.reason === "NOT_ENOUGH_LEFT") ? "Sold out or not enough left." : "Sold out."}${session.sendReport.sent > 0 ? " The rest went to the kitchen." : ""}`}
          action={{ label: "Close", onClick: session.clearSendReport }}
        />
      ) : null}
      {choiceError ? <Banner tone="amber" title="Choices not loaded" detail={choiceError} action={{ label: "Close", onClick: () => setChoiceError(null) }} /> : null}
      {session.openOrders.length > 1 ? (
        <Banner tone="amber" title={`${session.openOrders.length} open orders on this table`} detail="This screen shows one at a time." action={{ label: "Choose", onClick: () => setSheet({ kind: "orders" }) }} />
      ) : null}
    </>
  );

  // The ⋯ shows whenever the table has an order (as drawn); its sheet lists what this role may do.
  const showActions = rights.canTableActions || canSameAgain || Boolean(order);
  const payPane =
    paying && order ? (
      <PayPane
        title={title}
        totalMinor={Math.max(0, session.totalMinor - session.paidMinor)}
        paidMinor={session.paidMinor}
        ready={session.paidKnown}
        tillOpen={tillQ.isSuccess ? tillQ.data : tillQ.isError ? false : null}
        busy={session.busy === "pay"}
        error={session.lastError}
        onPay={session.pay}
        onDone={() => {
          setPaying(false);
          onClose();
        }}
      />
    ) : null;

  // Kitchen tickets carry no prices. Price each line from the menu, and show those prices only
  // when they add up exactly to the order's own total; otherwise they stay blank.
  const pricedLines = useMemo(() => {
    if (!summary || !menu || !session.lines.some((l) => l.priceKnown === false)) return session.lines;
    const priced = session.lines.map((l) => {
      const item = menu.items[l.menuItemId];
      const serving = item?.servings.find((sv) => sv.id === l.servingId);
      const unit = serving ? serving.priceMinor : item?.priceMinor;
      return unit === undefined ? null : { ...l, unitMinor: unit, lineMinor: unit * l.quantity, priceKnown: true };
    });
    if (priced.some((l) => l === null)) return session.lines;
    const sum = priced.reduce((acc, l) => (l && l.state !== "voided" ? acc + l.lineMinor : acc), 0);
    return sum === summary.totalMinor ? (priced as OrderLineModel[]) : session.lines;
  }, [menu, session.lines, summary]);
  // A line not sent whose item has since sold out cannot go: red, with Remove (T5, from the menu poll).
  const shownLines = useMemo(
    () =>
      pricedLines.map((l) =>
        l.state === "unsent" && (l.unsendable || menu?.items[l.menuItemId]?.availability.state === "soldOut") ? { ...l, unsendable: true } : l,
      ),
    [menu, pricedLines],
  );  // What Send can actually send, and the total without lines that cannot go.
  const blocked = shownLines.filter((l) => l.state === "unsent" && l.unsendable);
  const heldOnServer = shownLines.filter((l) => l.state === "unsent" && l.serverId && (l.held || l.fireAt) && !l.unsendable);
  const sendableCount = session.unsentCount - blocked.reduce((n, l) => n + l.quantity, 0) - heldOnServer.reduce((n, l) => n + l.quantity, 0);
  const shownTotal = session.totalMinor - blocked.filter((l) => !l.serverId).reduce((n, l) => n + l.lineMinor, 0);
  const viewSession = useMemo(() => ({ ...session, unsentCount: sendableCount, totalMinor: shownTotal }), [session, sendableCount, shownTotal]);


  if (phone && frame === "touch") {
    return (
      <PhoneOrderScreen
        title={title}
        context={context}
        menu={menu}
        menuStatus={menuQ.status}
        nav={nav}
        onNav={setNav}
        session={viewSession}
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
  ) : closed && order ? (
    <div className="flex flex-1 items-center justify-center p-kit-24" data-order-closed>
      <div className="w-kit-sheet-mid">
        <Card padding="roomy" label={order.status === "CLOSED" ? "Paid" : "Cancelled"}>
          <div className="flex flex-col gap-kit-8">
            <Text variant="h" as="h2">{order.status === "CLOSED" ? "This bill is paid" : "This order was cancelled"}</Text>
            <Text variant="body" tone="muted">{order.status === "CLOSED" ? "Nothing more can be added. Its receipt is under Receipts." : "Nothing more can be added. Who cancelled it and why are saved."}</Text>
          </div>
        </Card>
      </div>
    </div>
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
      <div className="w-kit-sheet-side">
        <Card padding="roomy" label={`This is ${waiterName ?? "another waiter"}’s table`}>
          <div className="flex flex-col gap-kit-12">
            <span className="flex h-kit-bubble w-kit-bubble items-center justify-center rounded-kit-full bg-kit-tonal text-kit-primary" aria-hidden="true">
              <KitIcon name="lock" />
            </span>
            <Text variant="h" as="h2">{`This is ${waiterName ?? "another waiter"}’s table`}</Text>
            <Text variant="body" tone="muted">You can see the order. To add or change items, the table has to be yours.</Text>
            <ActionTile icon="lock" title="Take it over" line="Needs a supervisor PIN" onClick={() => setSheet({ kind: "takeover" })} />
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
      lines={shownLines}
      count={session.count}
      totalMinor={readOnly && summary ? summary.totalMinor : shownTotal}
      discountMinor={order?.discountMinor ?? 0}
      unsentCount={sendableCount}
      filled={filled}
      busy={session.busy}
      linesHidden={readOnly && session.lines.length === 0}
      onLine={readOnly ? undefined : openLine}
      onRemove={readOnly ? undefined : (l) => session.remove(l.key)}
      onFire={readOnly || !rights.canOrder ? undefined : () => void doFire()}
      onSend={doSend}
      onPrintBill={printBill}
      onTakePayment={() => setPaying(true)}
      onMore={showActions && !readOnly && !paying && frame !== "laptop" ? () => setSheet({ kind: "actions" }) : undefined}
      onSameAgain={sameAgain}
      canSameAgain={canSameAgain && !paying}
      sentTappable={rights.canVoidLine && !paying}
      billMode={paying}
    />
  );

  return (
    <div
      className={["flex flex-col bg-kit-canvas font-kit", frame === "laptop" ? "fixed inset-x-kit-0 bottom-kit-0 top-kit-app-bar z-40" : "fixed inset-kit-0 z-50"].join(" ")}
      style={frame === "laptop" && barBottom !== null ? { top: barBottom } : undefined}
      data-order-screen
      data-order-role={role}
      data-order-table={tableId}
    >
      {frame === "laptop" ? (
        <div className="flex h-kit-row flex-none items-center gap-kit-12 bg-kit-card px-kit-32 shadow-kit-panel-bottom" data-order-laptop-bar>
          <Button tone="text" size="laptop" onClick={back}>
            {`${trail ?? "Floor"} ›`}
          </Button>
          <Text variant="row" as="h1">{title}</Text>
          {order && !closed ? <Pill tone="brand">{order.status === "READY" ? "Ready" : "Open"}</Pill> : null}
          <Text variant="sup" tone="muted">{context}</Text>
          <span className="flex-1" />
          {rights.canTableActions && order && !readOnly ? (
            <>
              {tableId ? (
                <Button tone="tonal" size="laptop" onClick={() => setSheet({ kind: "actions", step: "move" })}>
                  Move table
                </Button>
              ) : null}
              <Button tone="tonal" size="laptop" onClick={() => setSheet({ kind: "actions", step: "split" })}>
                Split bill
              </Button>
              {rights.canDiscount && session.paidKnown && session.paidMinor === 0 ? (
                <Button tone="tonal" size="laptop" onClick={() => setSheet({ kind: "actions", step: "discount" })}>
                  Discount
                </Button>
              ) : null}
            </>
          ) : null}
          {showActions && !readOnly ? <SquareAction icon="more" label="More for this table" tone="tonal" onClick={() => setSheet({ kind: "actions" })} /> : null}
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
