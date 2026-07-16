import { Badge } from "./Badge";

type StatusBadgeProps = {
  status: "available" | "occupied" | "reserved" | "pending" | "blocked" | "neutral";
  children: string;
};

const statusVariant = {
  available: "success",
  occupied: "info",
  reserved: "warning",
  pending: "warning",
  blocked: "danger",
  neutral: "neutral",
} as const;

export function StatusBadge({ status, children }: StatusBadgeProps) {
  return <Badge variant={statusVariant[status]}>{children}</Badge>;
}
