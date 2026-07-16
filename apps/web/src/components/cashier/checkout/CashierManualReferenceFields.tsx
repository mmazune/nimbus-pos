import { Input } from "@/components/ui";

type CashierManualReferenceFieldsProps = {
  reference: string;
  onReferenceChange: (value: string) => void;
  payerPhone: string;
  onPayerPhoneChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  showPhone?: boolean;
  disabled?: boolean;
  referenceRequired?: boolean;
};

export function CashierManualReferenceFields({
  reference,
  onReferenceChange,
  payerPhone,
  onPayerPhoneChange,
  note,
  onNoteChange,
  showPhone,
  disabled,
  referenceRequired,
}: CashierManualReferenceFieldsProps) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-sm font-semibold text-text-secondary">
          Reference ID{referenceRequired ? " required" : ""}
        </span>
        <Input
          className="mt-2"
          name="cashierPaymentReference"
          autoComplete="off"
          spellCheck={false}
          value={reference}
          onChange={(event) => onReferenceChange(event.target.value)}
          placeholder="External transaction ID"
          disabled={disabled}
        />
      </label>

      {showPhone ? (
        <label className="block">
          <span className="text-sm font-semibold text-text-secondary">Payer phone</span>
          <Input
            className="mt-2"
            name="cashierPaymentPhone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={payerPhone}
            onChange={(event) => onPayerPhoneChange(event.target.value)}
            placeholder="+256..."
            disabled={disabled}
          />
        </label>
      ) : null}

      <label className="block">
        <span className="text-sm font-semibold text-text-secondary">Note</span>
        <Input
          className="mt-2"
          name="cashierPaymentNote"
          autoComplete="off"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Optional note"
          disabled={disabled}
        />
      </label>
    </div>
  );
}
