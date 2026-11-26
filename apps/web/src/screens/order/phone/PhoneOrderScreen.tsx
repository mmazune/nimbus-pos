/**
 * The order screen on a phone (drawings Order-Phone, Order-Phone-Check,
 * Order-Phone-Item, 390 × 844): menu first, the order as a sheet, the item as a
 * sheet. Groups show seven at a time with "More · N"; nothing scrolls sideways.
 */
import { useState, type ReactNode } from "react";

import { Button, Chip, Field, ItemTile, MeasureRow, OptionTile, OrderLine, RoundAction, Segmented, Sheet, Text } from "@/components/kit";

import type { MenuItem, MenuServing, MenuWorkspace } from "../data/menu";
import { searchMenu } from "../data/menu";
import { formatMoney, groupShillings } from "../data/money";
import { choicesText, sentRounds, type OrderLineModel } from "../data/order";
import type { FilledAction, OrderRights } from "../data/rights";
import type { OrderSession } from "../data/useOrderSession";
import { firstNav, type MenuNav, type MixerOffer } from "../parts/MenuPane";
import { sendLabel, timeOf } from "../parts/OrderPanel";

type Props = {
  title: string;
  context: string;
  menu: MenuWorkspace | undefined;
  menuStatus: "pending" | "error" | "success";
  nav: MenuNav | null;
  onNav: (nav: MenuNav) => void;
  session: OrderSession;
  rights: OrderRights;
  readOnly: boolean;
  othersName: string | null;
  filled: FilledAction;
  armedQty: number | null;
  onArm: (q: number | null) => void;
  onPick: (item: MenuItem, serving: MenuServing | null) => void;
  mixer: MixerOffer | null;
  onMixer: (optionId: string) => void;
  onLine: (line: OrderLineModel) => void;
  onBack: () => void;
  onSend: () => void;
  onPrintBill: () => void;
  onTakePayment: () => void;
  onMore: () => void;
  showMore: boolean;
  onSameAgain: () => void;
  canSameAgain: boolean;
  /** The payment view replaces the menu when the cashier or manager takes payment. */
  payPane: ReactNode | null;
  sheets: ReactNode;
  notices: ReactNode;
};

function Items({ items, onPick }: { items: MenuItem[]; onPick: Props["onPick"] }) {
  const measured = items.filter((i) => i.servings.length > 1);
  const single = items.filter((i) => i.servings.length <= 1);
  return (
    <div className="flex flex-col gap-kit-8">
      {measured.map((item) => (
        <MeasureRow
          key={item.id}
          name={item.name}
          measures={item.servings.map((s) => ({ key: s.id, label: s.label, price: groupShillings(s.priceMinor) }))}
          onPick={(key) => onPick(item, item.servings.find((s) => s.id === key) ?? null)}
        />
      ))}
      {single.length ? (
        <div className="grid grid-cols-2 gap-kit-8">
          {single.map((item) => (
            <ItemTile
              key={item.id}
              name={item.name}
              price={groupShillings(item.servings[0]?.priceMinor ?? item.priceMinor)}
              soldOut={item.availability.state === "soldOut"}
              left={item.availability.state === "low" ? item.availability.left : undefined}
              onClick={() => item.availability.state !== "soldOut" && onPick(item, item.servings[0] ?? null)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PhoneOrderScreen(p: Props) {
  const [orderOpen, setOrderOpen] = useState(false);
  const [moreGroups, setMoreGroups] = useState(false);
  const [query, setQuery] = useState("");
  const { menu, nav, session } = p;
  const section = menu?.sections.find((s) => s.key === nav?.sectionKey) ?? menu?.sections[0];
  const group = section?.groups.find((g) => g.id === nav?.groupId) ?? section?.groups[0];
  const groups = section?.groups ?? [];
  // The group in use stays visible: it takes the last shown place when it is one of the hidden ones.
  // Four across as drawn; three when a group name has a word too long for a quarter of the phone.
  const longWord = groups.some((g) => g.name.split(/\s+/).some((w) => w.length > 8));
  const perRow = longWord ? 3 : 4;
  const shownCount = perRow * 2 - 1;
  const shownGroups = groups.length > shownCount + 1 ? groups.slice(0, shownCount) : groups;
  const hiddenCount = groups.length - shownGroups.length;
  const visible = group && !shownGroups.some((g) => g.id === group.id) ? [...shownGroups.slice(0, shownCount - 1), group] : shownGroups;
  const items = query.trim()
    ? searchMenu(menu as MenuWorkspace, query)
    : group
      ? (nav?.subgroupId ? group.subgroups.find((s) => s.id === nav.subgroupId)?.itemIds ?? group.itemIds : group.itemIds).map((id) => (menu as MenuWorkspace).items[id]).filter(Boolean)
      : [];

  const unsent = session.lines.filter((l) => l.state === "unsent");
  const rounds = sentRounds(session.lines);
  const status = session.order?.status;
  const roundWord = status === "READY" ? "Ready" : status === "IN_KITCHEN" || status === "SENT" ? "In the kitchen" : status === "SERVED" ? "Served" : null;

  const filledButton =
    p.filled === "send" ? (
      <Button tone="filled" fill disabled={session.unsentCount === 0 || session.busy !== null} onClick={p.onSend}>
        {session.busy === "send" ? "Sending…" : sendLabel(session.unsentCount)}
      </Button>
    ) : p.filled === "takePayment" ? (
      <Button tone="filled" fill disabled={session.busy !== null} onClick={p.onTakePayment}>Take payment</Button>
    ) : p.filled === "printBill" ? (
      <Button tone="filled" fill disabled={session.busy !== null} onClick={p.onPrintBill}>Print bill</Button>
    ) : null;

  return (
    <div className="fixed inset-kit-0 z-50 flex flex-col bg-kit-canvas font-kit" data-order-screen data-order-phone>
      <header className="flex flex-none items-center gap-kit-12 bg-kit-primary px-kit-16 pb-kit-16 pt-kit-16 text-kit-on-primary">
        <RoundAction icon="back" label={p.payPane ? "Back to the order" : "Back to the floor"} tone="onPrimary" size="small" onClick={p.onBack} />
        <div className="flex min-w-kit-0 flex-1 flex-col">
          <h1 className="m-kit-0 text-kit-h">{p.payPane ? "Take payment" : p.title}</h1>
          <span className="text-kit-sup text-kit-on-primary-muted">{p.payPane ? p.title : p.context}</span>
        </div>
        {p.showMore && !p.payPane ? <RoundAction icon="more" label="More for this table" tone="onPrimary" size="small" onClick={p.onMore} /> : null}
      </header>

      {p.payPane ? (
        <div className="flex min-h-kit-0 flex-1 flex-col">{p.payPane}</div>
      ) : (
        <div className="flex min-h-kit-0 flex-1 flex-col gap-kit-12 overflow-y-auto px-kit-16 pb-kit-16 pt-kit-16" data-order-menu>
          {p.notices}
          {p.readOnly ? (
            <div className="flex flex-col gap-kit-8 rounded-kit-card bg-kit-card p-kit-20 shadow-kit-raised" data-order-other>
              <Text variant="row">{`This is ${p.othersName ?? "another waiter"}’s table`}</Text>
              <Text variant="sup" tone="muted">{`${session.count} items · ${formatMoney(session.summary?.totalMinor ?? 0)}. To add or change items, the table has to be yours. A supervisor can move it to you.`}</Text>
            </div>
          ) : !menu || !nav ? (
            <Text variant="sup" tone="muted">{p.menuStatus === "error" ? "The menu did not load. Go back and tap the table again." : "Opening the menu…"}</Text>
          ) : (
            <>
              <Field label="Search the whole menu" value={query} placeholder="Name or initials" inputMode="search" onChange={setQuery} />
              {query.trim() ? null : (
                <>
                  <Segmented label="Food or Drinks" fill options={menu.sections.map((s) => ({ key: s.key, label: s.label }))} value={section?.key ?? ""} onChange={(k) => p.onNav(firstNav(menu, k))} />
                  <div className={["grid gap-kit-8", perRow === 3 ? "grid-cols-3" : "grid-cols-4"].join(" ")} data-order-groups>
                    {visible.map((g) => (
                      <OptionTile key={g.id} label={g.name} current={g.id === group?.id} onClick={() => p.onNav({ sectionKey: section!.key, groupId: g.id, subgroupId: null })} />
                    ))}
                    {hiddenCount > 0 ? <OptionTile label={`More · ${hiddenCount}`} onClick={() => setMoreGroups(true)} /> : null}
                  </div>
                  {group && group.subgroups.length > 1 ? (
                    <div className="flex flex-wrap gap-kit-8" data-order-subgroups>
                      <Chip label="All" current={!nav.subgroupId} onClick={() => p.onNav({ ...nav, groupId: group.id, subgroupId: null })} />
                      {group.subgroups.map((s) => (
                        <Chip key={s.id} label={s.name} current={nav.subgroupId === s.id} onClick={() => p.onNav({ ...nav, groupId: group.id, subgroupId: s.id })} />
                      ))}
                    </div>
                  ) : null}
                </>
              )}
              {p.armedQty ? (
                <div className="flex items-center justify-between rounded-kit-control bg-kit-tonal px-kit-16 py-kit-8">
                  <Text variant="sup" tone="primary">{`The next item is added ${p.armedQty} times`}</Text>
                  <Button tone="text" size="laptop" onClick={() => p.onArm(null)}>Cancel</Button>
                </div>
              ) : null}
              <Items items={items} onPick={p.onPick} />
              {query.trim() && items.length === 0 ? <Text variant="sup" tone="muted">{`Nothing on the menu matches “${query.trim()}”.`}</Text> : null}
              {p.mixer ? (
                <div className="flex flex-col gap-kit-8" data-order-mixer>
                  <Text variant="cap" tone="muted">{`Add a ${p.mixer.group.name.toLowerCase().replace(/s$/, "")} · ${p.mixer.line.name}`}</Text>
                  <div className="grid grid-cols-3 gap-kit-8">
                    {p.mixer.group.options.map((o) => (
                      <OptionTile key={o.id} label={o.name} current={p.mixer?.currentOptionId === o.id} onClick={() => p.onMixer(o.id)} />
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {p.payPane ? null : (
        <footer className="flex flex-none items-center gap-kit-12 bg-kit-card px-kit-16 pb-kit-16 pt-kit-12 shadow-kit-foot" data-order-foot>
          <Button tone="tonal" fill onClick={() => setOrderOpen(true)}>{`Order · ${session.count}`}</Button>
          {filledButton}
        </footer>
      )}

      {moreGroups && menu && section ? (
        <Sheet placement="bottom" title={section.label} summary="Every group" onClose={() => setMoreGroups(false)}>
          <div className="grid grid-cols-3 gap-kit-8">
            {groups.map((g) => (
              <OptionTile key={g.id} label={g.name} current={g.id === group?.id} onClick={() => { p.onNav({ sectionKey: section.key, groupId: g.id, subgroupId: null }); setMoreGroups(false); }} />
            ))}
          </div>
        </Sheet>
      ) : null}

      {orderOpen ? (
        <Sheet
          placement="bottom"
          title="Order"
          summary={`${p.title} · ${session.count === 1 ? "1 item" : `${session.count} items`}`}
          onClose={() => setOrderOpen(false)}
          footer={
            <div className="flex w-full flex-col gap-kit-12">
              <div className="flex items-baseline justify-between">
                <Text variant="row">Total</Text>
                <span className="text-kit-h text-kit-text" data-order-total>{formatMoney(p.readOnly ? session.summary?.totalMinor ?? 0 : session.totalMinor)}</span>
              </div>
              <div className="flex gap-kit-8">
                {(p.filled === "send" && rounds.length > 0) || p.filled === "takePayment" ? (
                  <Button tone="tonal" fill onClick={p.onPrintBill}>Print bill</Button>
                ) : null}
                {filledButton}
              </div>
            </div>
          }
        >
          <div className="flex flex-col" data-order-lines>
            {unsent.length ? (
              <section aria-label="Not sent">
                <div className="pb-kit-4 pt-kit-4"><Text variant="cap" tone="muted">Not sent · tap a line to change it</Text></div>
                {unsent.map((l) => (
                  <OrderLine key={l.key} flush quantity={l.quantity} name={l.name} choices={choicesText(l) || undefined} price={groupShillings(l.lineMinor)} state="notSent" onClick={() => { setOrderOpen(false); p.onLine(l); }} />
                ))}
              </section>
            ) : null}
            {rounds.map((r, i) => (
              <section key={r.sentAt} aria-label={`Sent ${timeOf(r.sentAt)}`} className={unsent.length || i > 0 ? "mt-kit-8 shadow-kit-line-top" : ""}>
                <div className="flex items-center justify-between pb-kit-4 pt-kit-12">
                  <Text variant="cap" tone="muted">{[`Sent ${timeOf(r.sentAt)}`, i === rounds.length - 1 && roundWord ? roundWord : null].filter(Boolean).join(" · ")}</Text>
                  {i === 0 && p.canSameAgain ? <Button tone="text" size="laptop" onClick={() => { p.onSameAgain(); setOrderOpen(false); }}>Same again</Button> : null}
                </div>
                <div>
                  {r.lines.map((l) => (
                    <OrderLine key={l.key} flush quantity={l.quantity} name={l.name} choices={[choicesText(l), l.state === "voided" ? "Voided" : ""].filter(Boolean).join(" · ") || undefined} price={groupShillings(l.lineMinor)} state={l.state === "voided" ? "voided" : "sent"} onClick={p.rights.canVoidLine && l.state === "sent" ? () => { setOrderOpen(false); p.onLine(l); } : undefined} />
                  ))}
                </div>
              </section>
            ))}
            {session.lines.length === 0 ? (
              <div className="py-kit-20"><Text variant="sup" tone="muted">{p.readOnly ? "Only the waiter on this table sees its lines." : "Nothing on this table yet. Tap an item to start. The table stays free until you send the order."}</Text></div>
            ) : null}
          </div>
        </Sheet>
      ) : null}

      {p.sheets}
    </div>
  );
}
