/**
 * Take payment (drawing Cashier-Pay, R7, E1's close route). Cash may be more than
 * the bill: the change shows before the payment and again, as the server recorded
 * it, after. Card and mobile money take the exact amount (the API refuses more).
 * Split is left out (listed): the API takes several payments in one close, but no
 * drawing shows how the parts are entered.
 */
import { useState } from "react";

import { Button, Key, OptionTile, Text } from "@/components/kit";

import { formatMoney, groupShillings, shillingsToMinor, type Minor } from "../data/money";
import type { PayMethod, PayResult } from "../data/order";

type Props = {
  title: string;
  totalMinor: Minor;
  busy: boolean;
  error: string | null;
  onPay: (payments: Array<{ method: PayMethod; amountMinor: Minor }>) => Promise<PayResult | null>;
  onDone: () => void;
};

/** "Exact", then the next round notes up: 98,000 → 100,000, 150,000, 200,000. */
export function quickAmounts(dueMinor: Minor): Minor[] {
  const step = 1_000_000; // 10,000 shillings
  const big = 5_000_000; // 50,000 shillings
  const out: Minor[] = [];
  let next = Math.ceil(dueMinor / step) * step;
  if (next === dueMinor) next += step;
  out.push(next);
  let up = Math.ceil((next + 1) / big) * big;
  while (out.length < 3) {
    out.push(up);
    up += big;
  }
  return out;
}

const METHODS: Array<{ key: PayMethod; label: string; second: string; icon: "revenue" | "workstation" | "cashierTill" }> = [
  { key: "CASH", label: "Cash", second: "Notes and coins", icon: "revenue" },
  { key: "MOMO", label: "Mobile money", second: "On their phone", icon: "workstation" },
  { key: "CARD", label: "Card", second: "Card machine", icon: "cashierTill" },
];

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "back"];

export function PayPane({ title, totalMinor, busy, error, onPay, onDone }: Props) {
  const [method, setMethod] = useState<PayMethod>("CASH");
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<{ changeMinor: Minor; method: PayMethod; givenMinor: Minor } | null>(null);
  const due = totalMinor;
  const given = typed ? shillingsToMinor(typed) : 0;
  const change = method === "CASH" && given > due ? given - due : 0;
  const short = method === "CASH" && typed !== "" && given < due;
  const amounts = quickAmounts(due);

  const press = (k: string) => {
    if (k === "back") setTyped((t) => t.slice(0, -1));
    else setTyped((t) => (t + k).replace(/^0+(?=\d)/, "").slice(0, 10));
  };

  const take = async () => {
    const amount = method === "CASH" ? (typed ? given : due) : due;
    const res = await onPay([{ method, amountMinor: amount }]);
    if (res) setResult({ changeMinor: res.changeMinor ?? 0, method, givenMinor: amount });
  };

  if (result) {
    return (
      <div className="flex min-w-kit-0 flex-1 flex-col items-center justify-center gap-kit-16 p-kit-24 text-center" data-order-paid>
        <Text variant="cap" tone="muted">Paid</Text>
        <span className="text-kit-big text-kit-text">{formatMoney(due)}</span>
        {result.method === "CASH" ? (
          <div className="flex flex-col items-center gap-kit-4 rounded-kit-card bg-kit-green-t px-kit-32 py-kit-20" data-order-change-after>
            <Text variant="row" tone="green">{result.changeMinor > 0 ? "Give this change" : "No change to give"}</Text>
            <span className="text-kit-big text-kit-green">{formatMoney(result.changeMinor)}</span>
            <Text variant="sup" tone="green">{`Cash given ${formatMoney(result.givenMinor)}, as the till recorded it`}</Text>
          </div>
        ) : (
          <Text variant="body">{`Taken by ${result.method === "CARD" ? "card" : "mobile money"}.`}</Text>
        )}
        <Text variant="sup" tone="muted">{`${title} is free again.`}</Text>
        <div className="w-kit-sheet-side">
          <Button tone="filled" fill onClick={onDone}>
            Back to the floor
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-kit-0 min-w-kit-0 flex-1 flex-col gap-kit-16 overflow-y-auto p-kit-24" data-order-pay>
      <div className="flex flex-1 flex-wrap gap-kit-24">
        <div className="flex min-w-kit-0 flex-1 flex-col gap-kit-16">
          <div className="flex flex-col gap-kit-2">
            <Text variant="cap" tone="muted">To pay</Text>
            <span className="text-kit-big text-kit-text" data-order-to-pay>{formatMoney(due)}</span>
          </div>
          <Text variant="sup" strong>How are they paying?</Text>
          <div className="grid grid-cols-3 gap-kit-8">
            {METHODS.map((m) => (
              <OptionTile key={m.key} label={m.label} second={m.second} icon={m.icon} current={method === m.key} onClick={() => { setMethod(m.key); setTyped(""); }} />
            ))}
          </div>
          {method === "CASH" ? (
            <>
              <Text variant="sup" strong>Cash given</Text>
              <div className="grid grid-cols-4 gap-kit-8" data-order-quick>
                <OptionTile label="Exact" current={typed !== "" && given === due} onClick={() => setTyped(String(Math.trunc(due / 100)))} />
                {amounts.map((a) => (
                  <OptionTile key={a} label={groupShillings(a)} current={given === a} onClick={() => setTyped(String(Math.trunc(a / 100)))} />
                ))}
              </div>
              <div className={["flex items-center justify-between rounded-kit-card px-kit-20 py-kit-20", change > 0 ? "bg-kit-green-t" : "bg-kit-neutral-t"].join(" ")} data-order-change-before>
                <Text variant="row" tone={change > 0 ? "green" : "muted"}>{short ? "Not enough yet" : "Change to give"}</Text>
                <span className={["text-kit-big", change > 0 ? "text-kit-green" : "text-kit-muted"].join(" ")}>{short ? formatMoney(due - given) : formatMoney(change)}</span>
              </div>
            </>
          ) : (
            <Text variant="sup" tone="muted">{`Take exactly ${formatMoney(due)} on the ${method === "CARD" ? "card machine" : "guest’s phone"}, then confirm here.`}</Text>
          )}
        </div>
        {method === "CASH" ? (
          <div className="flex w-kit-sheet-wide-gap flex-none flex-col gap-kit-8" data-order-keypad>
            <div className="flex h-kit-row items-center justify-end rounded-kit-control bg-kit-field px-kit-20">
              <span className="text-kit-key text-kit-text" aria-live="polite">{typed ? groupShillings(given) : "0"}</span>
            </div>
            <div className="grid grid-cols-3 gap-kit-8">
              {KEYS.map((k) => (
                <Key key={k} label={k === "back" ? "⌫" : k} name={k === "back" ? "Delete one digit" : undefined} onPress={() => press(k)} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-kit-8">
        {error ? <Text variant="sup" tone="red">{error}</Text> : null}
        <Button tone="filled" fill disabled={busy || short} onClick={take}>
          {busy ? "Taking payment…" : `Take ${formatMoney(due)} ${method === "CASH" ? "in cash" : method === "CARD" ? "by card" : "by mobile money"}`}
        </Button>
        <Text variant="small" tone="muted" align="center">{`The till records it and ${title} becomes free. The receipt is under Receipts.`}</Text>
      </div>
    </div>
  );
}
