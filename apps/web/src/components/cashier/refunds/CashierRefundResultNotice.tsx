import { StatusMessage } from "@/components/ui";

type CashierRefundResultNoticeProps = {
  result?: {
    tone: "success" | "info" | "warning" | "danger";
    title: string;
    body?: string;
  } | null;
};

export function CashierRefundResultNotice({ result }: CashierRefundResultNoticeProps) {
  if (!result) return null;

  return (
    <StatusMessage tone={result.tone} title={result.title}>
      {result.body}
    </StatusMessage>
  );
}
