import { StatusMessage } from "@/components/ui";

type CashierResolutionResultNoticeProps = {
  tone: "success" | "info" | "warning" | "danger";
  title: string;
  message?: string;
};

export function CashierResolutionResultNotice({ tone, title, message }: CashierResolutionResultNoticeProps) {
  return (
    <StatusMessage tone={tone} title={title}>
      {message ? <span>{message}</span> : null}
    </StatusMessage>
  );
}
