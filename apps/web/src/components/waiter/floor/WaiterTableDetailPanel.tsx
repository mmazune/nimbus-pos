import { ArrowRight, CalendarCheck, X } from "@phosphor-icons/react";

import { Button, Card, StatusMessage } from "@/components/ui";
import { WaiterOwnershipBlockedPanel } from "@/components/waiter/floor/WaiterOwnershipBlockedPanel";
import type { WaiterTableAction, WaiterTableViewModel } from "@/lib/waiter/floor-model";

type WaiterTableDetailPanelProps = {
  action: WaiterTableAction | null;
  shiftIsOpen: boolean;
  onStartOrder?: (table: WaiterTableViewModel) => void;
  onOpenOrder?: (table: WaiterTableViewModel) => void;
  onOpenReservation?: (table: WaiterTableViewModel) => void;
  onClose: () => void;
};

function DetailRows({ action }: { action: WaiterTableAction }) {
  const { table } = action;

  return (
    <dl className="mt-5 grid gap-3 text-sm">
      <div className="flex items-center justify-between gap-4 rounded-md bg-surface-muted px-3 py-2">
        <dt className="font-semibold text-text-secondary">Table</dt>
        <dd className="font-bold text-text-primary">{table.name}</dd>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-md bg-surface-muted px-3 py-2">
        <dt className="font-semibold text-text-secondary">Status</dt>
        <dd className="font-bold capitalize text-text-primary">{table.status}</dd>
      </div>
      {table.guestName ? (
        <div className="flex items-center justify-between gap-4 rounded-md bg-surface-muted px-3 py-2">
          <dt className="font-semibold text-text-secondary">Guest</dt>
          <dd className="font-bold text-text-primary">{table.guestName}</dd>
        </div>
      ) : null}
      {table.orderNumber ? (
        <div className="flex items-center justify-between gap-4 rounded-md bg-surface-muted px-3 py-2">
          <dt className="font-semibold text-text-secondary">Order</dt>
          <dd className="font-bold text-text-primary">{table.orderNumber}</dd>
        </div>
      ) : null}
      {table.reservationTime ? (
        <div className="flex items-center justify-between gap-4 rounded-md bg-surface-muted px-3 py-2">
          <dt className="font-semibold text-text-secondary">Reservation</dt>
          <dd className="font-bold text-text-primary">{table.reservationTime}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function WaiterTableDetailPanel({
  action,
  shiftIsOpen,
  onStartOrder,
  onOpenOrder,
  onOpenReservation,
  onClose,
}: WaiterTableDetailPanelProps) {
  if (!action) {
    return (
      <Card className="min-h-[360px] bg-surface-muted">
        <p className="text-lg font-bold tracking-normal text-text-primary">Select a table</p>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Table actions and blocked states appear here.
        </p>
      </Card>
    );
  }

  if (action.intent === "ownership-blocked") {
    return <WaiterOwnershipBlockedPanel table={action.table} onClose={onClose} />;
  }

  const isDisabled = action.intent === "disabled";

  return (
    <Card className="min-h-[360px]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold tracking-normal text-text-primary">{action.title}</p>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{action.message}</p>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md bg-surface-muted text-text-secondary transition-[background-color,color,transform] duration-150 ease-out hover:bg-brand-white hover:text-text-primary active:scale-[0.96]"
          aria-label="Close table panel"
          onClick={onClose}
        >
          <X size={18} weight="bold" aria-hidden />
        </button>
      </div>

      <DetailRows action={action} />

      {isDisabled ? (
        <StatusMessage tone="warning" title="Shift not started">
          Start shift before taking orders or seating guests.
        </StatusMessage>
      ) : null}

      {action.intent === "start-order" ? (
        <Button
          className="mt-5 w-full"
          size="pos"
          disabled={!shiftIsOpen}
          leadingIcon={<ArrowRight size={22} weight="bold" aria-hidden />}
          onClick={() => onStartOrder?.(action.table)}
        >
          Start order
        </Button>
      ) : null}

      {action.intent === "reservation-detail" ? (
        <Button
          className="mt-5 w-full"
          size="pos"
          variant="secondary"
          disabled={!action.table.reservationId}
          leadingIcon={<CalendarCheck size={22} weight="bold" aria-hidden />}
          onClick={() => onOpenReservation?.(action.table)}
        >
          Open reservation
        </Button>
      ) : null}

      {action.intent === "own-order" ? (
        <Button
          className="mt-5 w-full"
          size="pos"
          variant="secondary"
          disabled={!action.table.orderId}
          onClick={() => onOpenOrder?.(action.table)}
        >
          Open order
        </Button>
      ) : null}
    </Card>
  );
}
