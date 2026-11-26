import { RoundAction } from "./Button";
import type { KitDemo } from "./states";

export type StepperProps = {
  /** The shown value, with its unit when it has one: "8", "1.5 kg". */
  value: string;
  /** What is being counted, for the buttons' names: "seats". */
  noun: string;
  onDecrease?: () => void;
  onIncrease?: () => void;
  /** Gallery only: force a look on the minus button. */
  demo?: KitDemo;
};

/** − value + with two 44 px round tonal buttons. A number is tapped, never typed into a spinner. */
export function Stepper({ value, noun, onDecrease, onIncrease, demo }: StepperProps) {
  return (
    <div className="flex items-center gap-kit-8 font-kit">
      <RoundAction icon="minus" label={`Fewer ${noun}`} size="small" tone="tonal" onClick={onDecrease} disabled={!onDecrease} demo={demo} />
      <b aria-live="polite" className="min-w-kit-stepper-value text-center text-kit-row text-kit-text">
        {value}
      </b>
      <RoundAction icon="plus" label={`More ${noun}`} size="small" tone="tonal" onClick={onIncrease} disabled={!onIncrease} />
    </div>
  );
}
