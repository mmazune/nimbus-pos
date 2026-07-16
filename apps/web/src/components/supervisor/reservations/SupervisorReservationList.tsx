import { CalendarCheck } from "@phosphor-icons/react";

import { Skeleton } from "@/components/ui";
import { SupervisorEmptyState } from "@/components/supervisor/states";
import { SupervisorReservationCard } from "@/components/supervisor/reservations/SupervisorReservationCard";
import type { SupervisorReservationViewModel } from "@/lib/supervisor/reservations";

type SupervisorReservationListProps = {
  reservations: SupervisorReservationViewModel[];
  selectedReservationId?: string | null;
  isLoading?: boolean;
  onSelectReservation: (reservation: SupervisorReservationViewModel) => void;
};

export function SupervisorReservationList({
  isLoading,
  onSelectReservation,
  reservations,
  selectedReservationId,
}: SupervisorReservationListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4" aria-label="Loading reservations">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-[176px]" />
        ))}
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <SupervisorEmptyState
        icon={<CalendarCheck size={28} weight="duotone" aria-hidden />}
        title="No reservations match this view."
        description="The backend returned no matching reservations for the selected filter, table, and search."
        note="No fake guest, table, deposit, or availability rows are rendered."
      />
    );
  }

  return (
    <div className="grid gap-4" aria-label="Supervisor reservation results">
      {reservations.map((reservation) => (
        <SupervisorReservationCard
          key={reservation.id}
          reservation={reservation}
          selected={reservation.id === selectedReservationId}
          onSelect={onSelectReservation}
        />
      ))}
    </div>
  );
}

