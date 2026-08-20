type RoleIdentityProps = {
  displayName: string;
  initials: string;
  roleLabel: string;
};

export function RoleIdentity({ displayName, initials, roleLabel }: RoleIdentityProps) {
  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3" aria-label={`${displayName}, ${roleLabel}`}>
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-navy-800 text-xs font-bold tracking-normal text-text-inverse"
        title={`${displayName} · ${roleLabel}`}
        aria-hidden
      >
        {initials}
      </div>
      <div className="hidden min-w-0 max-w-[10rem] text-right md:block xl:max-w-[13rem]">
        <p className="truncate text-xs font-semibold sm:text-sm" title={displayName}>{displayName}</p>
        <p className="truncate text-[0.625rem] font-medium text-brand-silver sm:text-xs" title={roleLabel}>{roleLabel}</p>
      </div>
    </div>
  );
}
