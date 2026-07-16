import { Card } from "@/components/ui";
import type { SupervisorFloorCounts } from "@/lib/supervisor/floor-model";

const summaryItems: Array<{ key: keyof SupervisorFloorCounts; label: string; detail: string }> = [
  { key: "total", label: "Total tables", detail: "Returned for this branch" },
  { key: "available", label: "Available", detail: "Ready for seating" },
  { key: "occupied", label: "Occupied", detail: "In active use" },
  { key: "reserved", label: "Reserved", detail: "Held by table status" },
  { key: "blocked", label: "Blocked", detail: "Cleaning or reset" },
  { key: "other", label: "Other", detail: "Unknown status" },
];

export function SupervisorFloorSummary({ counts }: { counts: SupervisorFloorCounts }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" aria-label="Floor table summary">
      {summaryItems.map((item) => (
        <Card key={item.key} className="min-h-[112px] p-4">
          <p className="text-sm font-semibold text-text-secondary">{item.label}</p>
          <p className="mt-3 text-3xl font-bold tabular-nums tracking-normal text-text-primary">
            {counts[item.key]}
          </p>
          <p className="mt-1 text-xs font-semibold text-text-muted">{item.detail}</p>
        </Card>
      ))}
    </div>
  );
}
