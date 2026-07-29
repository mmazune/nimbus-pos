type RoleIdentityProps = {
  displayName: string;
  initials: string;
  roleLabel: string;
};

export function RoleIdentity({ displayName, initials, roleLabel }: RoleIdentityProps) {
  return (
    <div className="flex min-w-0 items-center gap-2 sm:gap-3" aria-label={`${displayName}, ${roleLabel}`}>
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-navy-800 text-sm font-bold tracking-normal text-text-inverse"
        title={`${displayName} · ${roleLabel}`}
        aria-hidden
      >
        {initials}
      </div>
      <div className="hidden min-w-0 max-w-[10rem] text-right md:block xl:max-w-[13rem]">
        <p className="truncate text-sm font-semibold" title={displayName}>{displayName}</p>
        <p className="truncate text-xs font-medium text-brand-silver" title={roleLabel}>{roleLabel}</p>
      </div>
    </div>
  );
}
