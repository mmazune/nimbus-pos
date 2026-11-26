/**
 * "Take it over" (drawing Order-Other): a supervisor types their own PIN on this
 * device. The digits stay in this component's state, are shown only as dots, and
 * are cleared after every try. Nothing is stored or logged.
 */
import { useState } from "react";

import { Button, Key, Sheet, Text, type SheetPlacement } from "@/components/kit";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

type Props = {
  placement: SheetPlacement;
  title: string;
  fromName: string | null;
  onTakeOver: (pin: string) => Promise<void>;
  onClose: () => void;
};

export function TakeOverSheet({ placement, title, fromName, onTakeOver, onClose }: Props) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const press = (k: string) => {
    setError(null);
    if (k === "back") setPin((p) => p.slice(0, -1));
    else if (k === "clear") setPin("");
    else setPin((p) => (p.length < 8 ? p + k : p));
  };

  const submit = async () => {
    setBusy(true);
    try {
      await onTakeOver(pin);
    } catch {
      setError("That PIN cannot hand over tables. Nothing changed.");
    } finally {
      setPin("");
      setBusy(false);
    }
  };

  return (
    <Sheet
      placement={placement}
      title={`Take over ${title}`}
      summary={`From ${fromName ?? "another waiter"}. A supervisor enters their PIN.`}
      onClose={onClose}
      footer={
        <>
          <Button tone="text" onClick={onClose}>
            Cancel
          </Button>
          <span className="flex-1" />
          <Button tone="filled" disabled={busy || (pin.length !== 6 && pin.length !== 8)} onClick={submit}>
            {busy ? "Checking…" : "Take it over"}
          </Button>
        </>
      }
    >
      <div className="flex h-kit-row items-center justify-center rounded-kit-control bg-kit-field" aria-live="polite" data-order-pin>
        <span className="text-kit-key text-kit-text">{pin ? "•".repeat(pin.length) : "Supervisor PIN"}</span>
      </div>
      <div className="grid grid-cols-3 gap-kit-8">
        {KEYS.map((k) => (
          <Key key={k} label={k === "back" ? "⌫" : k === "clear" ? "Clear" : k} name={k === "back" ? "Delete one digit" : k === "clear" ? "Clear the PIN" : undefined} onPress={() => press(k)} />
        ))}
      </div>
      {error ? <Text variant="sup" tone="red">{error}</Text> : null}
    </Sheet>
  );
}
