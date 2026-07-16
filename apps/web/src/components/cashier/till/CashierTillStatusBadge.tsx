import { Badge } from "@/components/ui";

type CashierTillStatusBadgeProps = {
  status?: string | null;
};

export function CashierTillStatusBadge({ status }: CashierTillStatusBadgeProps) {
  const normalized = String(status || "UNKNOWN").toUpperCase();
  const variant =
    normalized === "OPEN"
      ? "success"
      : normalized === "RECONCILED" || normalized === "CLOSED"
        ? "neutral"
        : "warning";

  return <Badge variant={variant}>{normalized.replace(/_/g, " ")}</Badge>;
}
