import { Badge } from "@/components/ui";
import type { OperationalTone } from "@/lib/profile/profile-model";

type OperationalStatusBadgeProps = {
  label: string;
  tone: OperationalTone;
  className?: string;
};

export function OperationalStatusBadge({ label, tone, className }: OperationalStatusBadgeProps) {
  return (
    <Badge className={className} variant={tone}>
      <span className="mr-2 h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </Badge>
  );
}

