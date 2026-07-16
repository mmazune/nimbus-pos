import { Badge } from "@/components/ui";
import type { SupervisorReservationTone } from "@/lib/supervisor/reservations";

export function SupervisorReservationStatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: SupervisorReservationTone;
}) {
  return <Badge variant={tone}>{label}</Badge>;
}

