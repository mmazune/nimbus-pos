/**
 * The menu side of the order screen (drawings Order-Empty, Order-Terminal, Order-Laptop):
 * Food or Drinks, the groups as a grid, a sub-group as a filter row, then the items —
 * tiles, or rows with one button per measure (R3). Nothing scrolls sideways.
 */
import { Chip, Field, ItemTile, MeasureRow, OptionTile, Segmented, Text } from "@/components/kit";

import type { MenuChoiceGroup, MenuItem, MenuSection, MenuServing, MenuWorkspace } from "../data/menu";
import { searchMenu } from "../data/menu";
import { groupShillings } from "../data/money";
import type { OrderLineModel } from "../data/order";

export type MenuNav = { sectionKey: string; groupId: string | null; subgroupId: string | null };

export type MixerOffer = { line: OrderLineModel; group: MenuChoiceGroup; currentOptionId: string | null };

type Props = {
  menu: MenuWorkspace;
  nav: MenuNav;
  onNav: (nav: MenuNav) => void;
  onPick: (item: MenuItem, serving: MenuServing | null) => void;
  /** Quantity first: the next item is added this many times. */
  armedQty: number | null;
  onArm: (qty: number | null) => void;
  mixer: MixerOffer | null;
  onMixer: (optionId: string) => void;
  searching: boolean;
  query: string;
  onQuery: (q: string) => void;
  onCloseSearch: () => void;
  /** "laptop": no quantity strip in the top row (a laptop has a keyboard: digits arm it). */
  density: "touch" | "laptop";
  /** The laptop drawing has the search field inside the menu, not in the bar. */
  inlineSearch?: boolean;
  disabled?: boolean;
};

const QTY = [2, 3, 4, 5, 6];

export function firstNav(menu: MenuWorkspace, sectionKey?: string): MenuNav {
  const section = menu.sections.find((s) => s.key === sectionKey) ?? menu.sections[0];
  return { sectionKey: section?.key ?? "", groupId: section?.groups[0]?.id ?? null, subgroupId: null };
}

function itemsFor(menu: MenuWorkspace, section: MenuSection | undefined, nav: MenuNav): MenuItem[] {
  const group = section?.groups.find((g) => g.id === nav.groupId) ?? section?.groups[0];
  if (!group) return [];
  const sub = group.subgroups.find((s) => s.id === nav.subgroupId);
  return (sub ? sub.itemIds : group.itemIds).map((id) => menu.items[id]).filter(Boolean);
}

function ItemGrid({ items, onPick, disabled }: { items: MenuItem[]; onPick: Props["onPick"]; disabled?: boolean }) {
  const measured = items.filter((i) => i.servings.length > 1);
  const single = items.filter((i) => i.servings.length <= 1);
  return (
    <div className="flex flex-col gap-kit-8">
      {measured.length ? (
        <div className="grid grid-cols-1 gap-kit-8 xl:grid-cols-2" data-order-measures>
          {measured.map((item) => (
            <MeasureRow
              key={item.id}
              name={item.name}
              measures={item.servings.map((s) => ({ key: s.id, label: s.label, price: groupShillings(s.priceMinor) }))}
              onPick={(key) => {
                if (disabled) return;
                onPick(item, item.servings.find((s) => s.id === key) ?? null);
              }}
            />
          ))}
        </div>
      ) : null}
      {single.length ? (
        <div className="grid grid-cols-2 gap-kit-8 md:grid-cols-3 xl:grid-cols-4" data-order-items>
          {single.map((item) => (
            <ItemTile
              key={item.id}
              name={item.name}
              price={groupShillings(item.servings[0]?.priceMinor ?? item.priceMinor)}
              soldOut={item.availability.state === "soldOut"}
              left={item.availability.state === "low" ? item.availability.left : undefined}
              onClick={() => {
                if (disabled || item.availability.state === "soldOut") return;
                onPick(item, item.servings[0] ?? null);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MenuPane(props: Props) {
  const { menu, nav, onNav, onPick, armedQty, onArm, mixer, onMixer, searching, query, onQuery, onCloseSearch, density, inlineSearch, disabled } = props;
  const section = menu.sections.find((s) => s.key === nav.sectionKey) ?? menu.sections[0];
  const group = section?.groups.find((g) => g.id === nav.groupId) ?? section?.groups[0];
  const results = searching ? searchMenu(menu, query) : [];

  const searchField = (
    <Field
      label="Search the whole menu"
      value={query}
      placeholder="Name or initials, e.g. bs for Blended Scotch"
      inputMode="search"
      size={density === "laptop" ? "laptop" : "touch"}
      onChange={onQuery}
    />
  );

  if (!menu.sections.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-kit-8 p-kit-24 text-center">
        <Text variant="row">No menu to show</Text>
        <Text variant="sup" tone="muted">A manager sets up the menu groups. Nothing can be added until then.</Text>
      </div>
    );
  }

  return (
    <div className="flex min-h-kit-0 min-w-kit-0 flex-1 flex-col gap-kit-12 overflow-y-auto p-kit-24" data-order-menu>
      {searching ? (
        <div className="flex flex-col gap-kit-12" data-order-search>
          <div className="flex items-end gap-kit-12">
            <div className="min-w-kit-0 flex-1">{searchField}</div>
            <Chip label="Back to the menu" onClick={onCloseSearch} />
          </div>
          {query.trim().length === 0 ? (
            <Text variant="sup" tone="muted">Type a name, part of a name, or the first letters of each word.</Text>
          ) : results.length === 0 ? (
            <Text variant="sup" tone="muted">{`Nothing on the menu matches “${query.trim()}”.`}</Text>
          ) : (
            <ItemGrid items={results} onPick={onPick} disabled={disabled} />
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-kit-12">
            <Segmented
              label="Food or Drinks"
              options={menu.sections.map((s) => ({ key: s.key, label: s.label }))}
              value={section?.key ?? ""}
              onChange={(key) => onNav(firstNav(menu, key))}
            />
            {inlineSearch ? <div className="w-kit-search-w-lg">{searchField}</div> : null}
            {density === "touch" ? (
              <div className="flex items-center gap-kit-8" data-order-qty>
                <Text variant="sup" tone="muted">How many</Text>
                {QTY.map((q) => (
                  <div key={q} className="w-kit-target">
                    <OptionTile label={String(q)} current={armedQty === q} onClick={() => onArm(armedQty === q ? null : q)} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          {armedQty && density === "laptop" ? (
            <Text variant="sup" tone="muted">{`The next item is added ${armedQty} times. Press Esc to cancel.`}</Text>
          ) : null}

          <div className="grid grid-cols-4 gap-kit-8 lg:grid-cols-5 xl:grid-cols-8" data-order-groups>
            {(section?.groups ?? []).map((g) => (
              <OptionTile key={g.id} label={g.name} current={g.id === group?.id} onClick={() => onNav({ sectionKey: section.key, groupId: g.id, subgroupId: null })} />
            ))}
          </div>

          {group && group.subgroups.length > 1 ? (
            <div className="flex flex-wrap gap-kit-8" data-order-subgroups>
              <Chip label={`All ${group.name.toLowerCase()}`} current={!nav.subgroupId} onClick={() => onNav({ ...nav, groupId: group.id, subgroupId: null })} />
              {group.subgroups.map((s) => (
                <Chip key={s.id} label={s.name} current={nav.subgroupId === s.id} onClick={() => onNav({ ...nav, groupId: group.id, subgroupId: s.id })} />
              ))}
            </div>
          ) : null}

          <ItemGrid items={itemsFor(menu, section, nav)} onPick={onPick} disabled={disabled} />

          {mixer ? (
            <div className="flex flex-col gap-kit-8" data-order-mixer>
              <Text variant="cap" tone="muted">{`Add a ${mixer.group.name.toLowerCase().replace(/s$/, "")} · ${mixer.line.name}`}</Text>
              <div className="grid grid-cols-3 gap-kit-8 xl:grid-cols-6">
                {mixer.group.options.map((o) => (
                  <OptionTile key={o.id} label={o.priceDeltaMinor ? `${o.name} · ${groupShillings(o.priceDeltaMinor)}` : o.name} current={mixer.currentOptionId === o.id} onClick={() => onMixer(o.id)} />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
