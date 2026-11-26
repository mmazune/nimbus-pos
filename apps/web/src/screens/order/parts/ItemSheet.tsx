/**
 * An item with choices, or an unsent line being changed (drawing Order-Phone-Item):
 * pick one, extras, leave out, a note for the kitchen, how many. One filled button
 * that says the price. Removing an unsent line is a red text button here.
 */
import { useMemo, useState } from "react";

import { Button, Field, OptionTile, Pill, Sheet, Stepper, Text, type SheetPlacement } from "@/components/kit";

import type { MenuChoiceGroup, MenuItem, MenuServing } from "../data/menu";
import { formatMoney, groupShillings } from "../data/money";
import type { LineChoice } from "../data/order";
import { unitPriceOf } from "../data/useOrderSession";

export type ItemSheetResult = {
  serving: MenuServing | null;
  choices: LineChoice[];
  note: string;
  quantity: number;
  /** T5 (drawing Order-Line-Allergy): an allergy the kitchen sees in red; takeaway; hold for later; the guest. */
  allergy?: string | null;
  takeaway?: boolean;
  hold?: boolean;
  guest?: number | null;
};

const ALLERGIES = ["Nuts", "Gluten", "Dairy", "Eggs", "Shellfish"];
const GUESTS = [1, 2, 3, 4, 5, 6];

type Props = {
  placement: SheetPlacement;
  item: MenuItem;
  groups: MenuChoiceGroup[];
  initial: ItemSheetResult;
  mode: "add" | "edit";
  onDone: (result: ItemSheetResult) => void;
  onRemove?: () => void;
  onClose: () => void;
};

function guide(g: MenuChoiceGroup): { pill?: string; muted?: string } {
  if (g.max === 1 && g.required) return { pill: "Pick one" };
  if (g.max === 1) return { muted: "one, if they want" };
  if (g.required && g.min > 0) return { pill: `Pick at least ${g.min}` };
  return { muted: g.max ? `up to ${g.max}, if they want` : "if they want" };
}

export function ItemSheet({ placement, item, groups, initial, mode, onDone, onRemove, onClose }: Props) {
  const [serving, setServing] = useState<MenuServing | null>(initial.serving);
  const [picked, setPicked] = useState<LineChoice[]>(initial.choices);
  const [note, setNote] = useState(initial.note);
  const [quantity, setQuantity] = useState(Math.max(1, initial.quantity));
  const [allergy, setAllergy] = useState<string>(initial.allergy ?? "");
  const [otherAllergy, setOtherAllergy] = useState(Boolean(initial.allergy && !ALLERGIES.includes(initial.allergy)));
  const [takeaway, setTakeaway] = useState(Boolean(initial.takeaway));
  const [hold, setHold] = useState(Boolean(initial.hold));
  const [guest, setGuest] = useState<number | null>(initial.guest ?? null);
  const result = (): ItemSheetResult => ({ serving, choices: picked, note, quantity, allergy: allergy.trim() || null, takeaway, hold, guest });

  const unit = unitPriceOf(item, serving, picked);
  const missing = groups.filter((g) => g.required && picked.filter((p) => p.groupId === g.id).length < Math.max(1, g.min));

  const toggle = (g: MenuChoiceGroup, optionId: string) => {
    const option = g.options.find((o) => o.id === optionId);
    if (!option) return;
    const choice: LineChoice = { groupId: g.id, groupName: g.name, optionId, optionName: option.name, priceDeltaMinor: option.priceDeltaMinor };
    setPicked((cur) => {
      const inGroup = cur.filter((c) => c.groupId === g.id);
      const has = inGroup.some((c) => c.optionId === optionId);
      if (g.max === 1) return has && !g.required ? cur.filter((c) => c.groupId !== g.id) : [...cur.filter((c) => c.groupId !== g.id), choice];
      if (has) return cur.filter((c) => !(c.groupId === g.id && c.optionId === optionId));
      if (g.max !== null && inGroup.length >= g.max) return cur;
      return [...cur, choice];
    });
  };

  const summary = useMemo(() => {
    const base = serving && item.servings.length > 1 ? `${serving.label} · ${formatMoney(serving.priceMinor)}` : formatMoney(serving?.priceMinor ?? item.priceMinor);
    return base;
  }, [item, serving]);

  const stepper = (
    <Stepper
      value={String(quantity)}
      noun="items"
      onDecrease={() => setQuantity((q) => Math.max(1, q - 1))}
      onIncrease={() => setQuantity((q) => Math.min(99, q + 1))}
    />
  );
  const remove = mode === "edit" && onRemove ? (
    <Button tone="danger" onClick={onRemove}>
      Remove
    </Button>
  ) : null;
  const save = (
    <Button tone="filled" fill={placement === "bottom"} disabled={missing.length > 0} onClick={() => onDone(result())}>
      {`${mode === "add" ? "Add" : "Save"} · ${formatMoney(unit * quantity)}`}
    </Button>
  );
  // On a phone the filled button has a row of its own, so it is never cut at 390 (T5 look review).
  const footer =
    placement === "bottom" ? (
      <div className="flex w-full flex-col gap-kit-12">
        <div className="flex items-center gap-kit-12">
          {stepper}
          <span className="flex-1" />
          {remove}
        </div>
        <div className="flex">{save}</div>
      </div>
    ) : (
      <>
        {stepper}
        <span className="flex-1" />
        {remove}
        {save}
      </>
    );

  return (
    <Sheet placement={placement} title={item.name} summary={summary} onClose={onClose} footer={footer}>
      <div className="flex min-h-kit-0 flex-col gap-kit-16 overflow-y-auto" data-order-item-sheet>
        {item.servings.length > 1 ? (
          <div className="flex flex-col gap-kit-8">
            <div className="flex items-center gap-kit-8">
              <Text variant="row">Measure</Text>
              <Pill tone="neutral">Pick one</Pill>
            </div>
            <div className="grid grid-cols-3 gap-kit-8">
              {item.servings.map((s) => (
                <OptionTile key={s.id} label={s.label} second={groupShillings(s.priceMinor)} current={serving?.id === s.id} onClick={() => setServing(s)} />
              ))}
            </div>
          </div>
        ) : null}
        {groups.map((g) => {
          const gd = guide(g);
          const cols = g.options.length === 2 || g.options.some((o) => o.name.length > 14) ? "grid-cols-2" : "grid-cols-3";
          return (
            <div key={g.id} className="flex flex-col gap-kit-8">
              <div className="flex items-center gap-kit-8">
                <Text variant="row">{g.name}</Text>
                {gd.pill ? <Pill tone="neutral">{gd.pill}</Pill> : null}
                {gd.muted ? <Text variant="sup" tone="muted">{gd.muted}</Text> : null}
              </div>
              <div className={["grid gap-kit-8", cols].join(" ")}>
                {g.options.map((o) => (
                  <OptionTile
                    key={o.id}
                    label={o.priceDeltaMinor ? `${o.name} · ${groupShillings(o.priceDeltaMinor)}` : o.name}
                    current={picked.some((p) => p.groupId === g.id && p.optionId === o.id)}
                    onClick={() => toggle(g, o.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
        <div className="flex flex-col gap-kit-8" data-line-allergy>
          <Text variant="row">Allergy</Text>
          <div className="grid grid-cols-3 gap-kit-8">
            {ALLERGIES.map((a) => (
              <OptionTile key={a} label={a} current={!otherAllergy && allergy === a} onClick={() => { setOtherAllergy(false); setAllergy(allergy === a ? "" : a); }} />
            ))}
            <OptionTile label="Other" current={otherAllergy} onClick={() => { setOtherAllergy(!otherAllergy); setAllergy(""); }} />
          </div>
          {otherAllergy ? <Field label="Which allergy" value={allergy} placeholder="For example sesame" onChange={setAllergy} /> : null}
        </div>
        <div className="flex flex-col gap-kit-8">
          <Text variant="row">Where it is eaten</Text>
          <div className="grid grid-cols-2 gap-kit-8">
            <OptionTile label="Here" current={!takeaway} onClick={() => setTakeaway(false)} />
            <OptionTile label="Takeaway" current={takeaway} onClick={() => setTakeaway(true)} />
          </div>
        </div>
        {mode === "add" || initial.hold !== undefined ? (
          <div className="flex flex-col gap-kit-8">
            <Text variant="row">When</Text>
            <div className="grid grid-cols-2 gap-kit-8">
              <OptionTile label="With the next Send" current={!hold} onClick={() => setHold(false)} />
              <OptionTile label="Hold for later" second="Fire it when ready" current={hold} onClick={() => setHold(true)} />
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-kit-8">
          <Text variant="row">For guest</Text>
          <div className="grid grid-cols-4 gap-kit-8 md:grid-cols-7">
            <OptionTile label="All" current={guest === null} onClick={() => setGuest(null)} />
            {GUESTS.map((g) => <OptionTile key={g} label={String(g)} current={guest === g} onClick={() => setGuest(g)} />)}
          </div>
        </div>
        <Field label="Note for the kitchen" value={note} placeholder="Anything the kitchen should know" onChange={setNote} />
        {missing.length ? <Text variant="sup" tone="muted">{`Choose ${missing.map((g) => g.name.toLowerCase()).join(" and ")} first.`}</Text> : null}
      </div>
    </Sheet>
  );
}
