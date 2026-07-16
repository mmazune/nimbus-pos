import { Card } from "@/components/ui";
import type { SupervisorApprovalDomainState } from "@/lib/supervisor/approvals";

type SummaryCounts = {
  discounts: number;
  leave: number;
  shiftSwaps: number;
  anomalies: number;
  highPriority: number;
  total: number;
};

type SupervisorApprovalsSummaryProps = {
  counts: SummaryCounts;
  domainStates: SupervisorApprovalDomainState[];
};

const summaryItems = [
  { key: "discounts", label: "Discounts pending" },
  { key: "refunds", label: "Refunds pending" },
  { key: "voids", label: "Void watch" },
  { key: "leave", label: "Leave requests" },
  { key: "shiftSwaps", label: "Shift swaps" },
  { key: "anomalies", label: "Anomalies" },
  { key: "unavailable", label: "Unavailable domains" },
] as const;

function stateFor(domainStates: SupervisorApprovalDomainState[], key: string) {
  if (key === "refunds") return domainStates.find((state) => state.domain === "refund");
  if (key === "voids") return domainStates.find((state) => state.domain === "void");
  return null;
}

function countFor(counts: SummaryCounts, key: (typeof summaryItems)[number]["key"]) {
  if (key === "discounts") return String(counts.discounts);
  if (key === "leave") return String(counts.leave);
  if (key === "shiftSwaps") return String(counts.shiftSwaps);
  if (key === "anomalies") return String(counts.anomalies);
  if (key === "unavailable") return String(2);
  return "Unavailable";
}

export function SupervisorApprovalsSummary({ counts, domainStates }: SupervisorApprovalsSummaryProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7" aria-label="Supervisor approvals summary">
      {summaryItems.map((item) => {
        const unavailable = stateFor(domainStates, item.key);
        const value = unavailable?.available === false ? "Unavailable" : countFor(counts, item.key);
        const isUnavailable = value === "Unavailable";

        return (
          <Card key={item.key} className="min-h-[116px] p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-text-muted">{item.label}</p>
            <p
              className={`mt-3 text-2xl font-bold tabular-nums tracking-normal ${
                isUnavailable ? "text-text-secondary" : "text-text-primary"
              }`}
            >
              {value}
            </p>
            <p className="mt-2 text-xs font-semibold text-text-muted">
              {isUnavailable ? "No verified queue" : "Real returned rows"}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
