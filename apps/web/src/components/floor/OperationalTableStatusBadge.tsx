import { StatusBadge } from "@/components/ui";

import { operationalTableStatusLabels } from "./formatters";
import type { OperationalTableStatus } from "./types";

export function OperationalTableStatusBadge({ status }: { status: OperationalTableStatus }) {
  return <StatusBadge status={status}>{operationalTableStatusLabels[status]}</StatusBadge>;
}
