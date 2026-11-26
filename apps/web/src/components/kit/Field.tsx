import { useId } from "react";

import { FOCUS_FORCED, type KitDemo } from "./states";

export type FieldProps = {
  label: string;
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  /** 52 on touch, 44 on a laptop. */
  size?: "touch" | "laptop";
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "search";
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  demo?: "focus";
};

/** Filled field, no outline at rest, a 2 px focus ring; the label above at 14 px semi-bold. */
export function Field({ label, value, placeholder, onChange, size = "touch", inputMode = "text", hint, error, required, disabled, demo }: FieldProps & { demo?: KitDemo }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col font-kit">
      <label htmlFor={id} className="mb-kit-6 block text-kit-label text-kit-text">
        {label}
        {required ? <span className="text-kit-muted"> · Required</span> : null}
      </label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={!onChange}
        inputMode={inputMode}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={[
          "w-full rounded-kit-control bg-kit-field px-kit-14 text-kit-body text-kit-text outline-none placeholder:text-kit-muted focus-visible:shadow-kit-focus focus:shadow-kit-focus",
          size === "touch" ? "h-kit-field" : "h-kit-field-sm",
          disabled ? "cursor-not-allowed text-kit-muted" : "",
          error ? "shadow-kit-error" : "",
          demo === "focus" ? FOCUS_FORCED : "",
        ].join(" ")}
      />
      {hint ? (
        <p id={hintId} className="mt-kit-6 text-kit-small text-kit-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-kit-6 text-kit-small text-kit-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
