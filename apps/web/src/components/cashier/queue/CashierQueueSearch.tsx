import { SearchInput } from "@/components/ui";

type CashierQueueSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export function CashierQueueSearch({ value, onChange }: CashierQueueSearchProps) {
  return (
    <div className="min-w-[320px]">
      <label htmlFor="cashier-queue-search" className="mb-2 block text-sm font-semibold text-text-secondary">
        Search queue
      </label>
      <SearchInput
        id="cashier-queue-search"
        value={value}
        aria-label="Search cashier queue"
        placeholder="Order, table, server, status"
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
