type CompactUnavailableStateProps = {
  title: string;
  description: string;
};

export function CompactUnavailableState({ title, description }: CompactUnavailableStateProps) {
  return (
    <div className="rounded-md bg-status-neutral-surface px-4 py-3" role="note">
      <p className="text-sm font-bold text-text-primary">{title}</p>
      <p className="mt-1 text-sm leading-5 text-text-secondary">{description}</p>
    </div>
  );
}

