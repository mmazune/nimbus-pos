import { WarningCircle } from "@phosphor-icons/react";

type CapabilityNoticeProps = {
  title?: string;
  unavailableFeatures: string;
};

export function CapabilityNotice({
  title = "Employee profile required",
  unavailableFeatures,
}: CapabilityNoticeProps) {
  return (
    <section className="rounded-lg bg-status-warning-surface p-5 text-text-primary shadow-subtle" aria-labelledby="profile-capability-notice-title">
      <div className="flex items-start gap-4">
        <WarningCircle className="mt-0.5 shrink-0 text-status-warning" size={24} weight="fill" aria-hidden />
        <div className="min-w-0">
          <h2 id="profile-capability-notice-title" className="text-base font-bold">{title}</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-text-secondary">
            {unavailableFeatures} Ask an administrator to link this account to the correct employee record.
            Shift and session features can still remain available.
          </p>
        </div>
      </div>
    </section>
  );
}

