import { Badge } from "@/components/ui";

type WaiterReceiptStatusBadgeProps = {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  children: string;
};

export function WaiterReceiptStatusBadge({
  tone = "neutral",
  children,
}: WaiterReceiptStatusBadgeProps) {
  return <Badge variant={tone}>{children}</Badge>;
}
