import Link from "next/link";
import { useRouter } from "next/router";
import { KeyboardEvent, ReactNode, useRef, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils/cn";

import { NimbusLogomark } from "./NimbusLogomark";
import { CurrentTime } from "./CurrentTime";
import { OperationalTopNavDropdown } from "./OperationalTopNavDropdown";
import { operationalIcons, operationalIconSizes, operationalIconWeights } from "./role-icons";

/**
 * Module top-bar (Track B1, D-MGRTOPNAV) — the additive top-nav variant of the
 * shared operational shell. See `docs/UI_SYSTEM.md` §3b and
 * `ai/ENTERPRISE_UI_ROADMAP.md` B1. Odoo's module bar
 * (`ai/ODOO_REFERENCE_RESEARCH.md` §1.2/§1.3, screenshots 03/04/17) is the
 * LAYOUT reference only — colours stay Nimbus navy/silver/graphite tokens.
 *
 * This component is shared (not Manager-scoped) so a later Owner variant (B7)
 * can reuse it unforked, per OD-1/OD-5. Manager is its only consumer today.
 */
export type OperationalTopNavLink = {
  key: string;
  label: string;
  href: string;
  /** false = an honest "not yet" row: the item is named but not clickable. */
  available: boolean;
  /** Shown on a not-yet row, e.g. "Ships in B3". */
  notYetNote?: string;
};

export type OperationalTopNavGroup = {
  heading?: string;
  items: readonly OperationalTopNavLink[];
};

export type OperationalTopNavMenu = {
  key: string;
  label: string;
  /** Direct-action menu (no dropdown) — e.g. Overview. */
  href?: string;
  match?: (pathname: string) => boolean;
  groups?: readonly OperationalTopNavGroup[];
};

type OperationalTopNavProps = {
  ariaLabel: string;
  brandHref: string;
  workspaceLabel: string;
  menus: readonly OperationalTopNavMenu[];
  branchSwitcher?: ReactNode;
  displayName: string;
  initials: string;
  roleLabel: string;
  profileHref: string;
};

function isMenuActive(menu: OperationalTopNavMenu, pathname: string) {
  if (menu.match) return menu.match(pathname);
  if (menu.href) return pathname === menu.href;
  return (menu.groups || []).some((group) =>
    group.items.some((item) => item.available && pathname === item.href),
  );
}

function MenuItemRow({ item, onNavigate }: { item: OperationalTopNavLink; onNavigate: () => void }) {
  if (!item.available) {
    return (
      <div
        role="menuitem"
        aria-disabled="true"
        tabIndex={-1}
        className="flex cursor-default items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-text-muted"
      >
        <span className="truncate">{item.label}</span>
        {item.notYetNote ? (
          <span className="shrink-0 rounded-full bg-status-neutral-surface px-2 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-status-neutral">
            {item.notYetNote}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      role="menuitem"
      tabIndex={-1}
      onClick={onNavigate}
      className="block rounded-md px-3 py-2 text-sm font-semibold text-text-primary outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
    >
      {item.label}
    </Link>
  );
}

function MenuDropdownPanel({ menu, close }: { menu: OperationalTopNavMenu; close: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      {(menu.groups || []).map((group, index) => (
        <div key={group.heading || index}>
          {group.heading ? (
            <p className="px-3 pb-1 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-text-muted">
              {group.heading}
            </p>
          ) : null}
          <div className="flex flex-col">
            {group.items.map((item) => (
              <MenuItemRow key={item.key} item={item} onNavigate={close} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function OperationalTopNav({
  ariaLabel,
  branchSwitcher,
  brandHref,
  displayName,
  initials,
  menus,
  profileHref,
  roleLabel,
  workspaceLabel,
}: OperationalTopNavProps) {
  const router = useRouter();
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const triggerRefs = useRef<Array<HTMLElement | null>>([]);
  const TimeIcon = operationalIcons.time;
  const LogoutIcon = operationalIcons.logout;
  const CaretIcon = operationalIcons.caretDown;
  const MeIcon = operationalIcons.me;

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await logout();
    if (typeof window !== "undefined") {
      window.location.replace("/login?reason=logged_out");
      return;
    }
    void router.replace("/login?reason=logged_out");
  }

  function focusTrigger(nextIndex: number) {
    const items = triggerRefs.current.filter(Boolean) as HTMLElement[];
    if (!items.length) return;
    const target = items[(nextIndex + items.length) % items.length];
    target.focus();
  }

  function onMenubarKeyDown(event: KeyboardEvent<HTMLElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTrigger(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTrigger(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTrigger(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTrigger(menus.length - 1);
    }
  }

  const clock = (
    <div
      className="hidden h-8 shrink-0 items-center gap-2 rounded-md bg-brand-navy-800 px-2 text-xs font-semibold sm:flex sm:px-2.5 sm:text-sm"
      aria-label="Current time"
    >
      <TimeIcon size={operationalIconSizes.compactAction} weight={operationalIconWeights.default} aria-hidden />
      <CurrentTime />
    </div>
  );

  return (
    <header className="bg-brand-navy-950 text-text-inverse shadow-panel" data-operational-top-nav aria-label={ariaLabel}>
      <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:gap-4 lg:px-6">
        {/* Left: brand/home control */}
        <Link
          href={brandHref}
          className="flex shrink-0 items-center gap-2 rounded-md py-1 pr-2 outline-none focus-visible:shadow-focus-inverse sm:gap-2.5"
          aria-label={`${workspaceLabel} — go to overview`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-white text-brand-navy-900 shadow-subtle">
            <NimbusLogomark size={operationalIconSizes.bottomNavigation} aria-hidden />
          </span>
          <span className="hidden truncate text-sm font-bold tracking-tight sm:block lg:text-base">
            {workspaceLabel}
          </span>
        </Link>

        {/* Sub-desktop collapse (OD-4): a single menu control replaces the module bar below
            1280px (`xl:`). The full bar's brand lockup + six menus + branch switcher + clock +
            identity cluster does not reliably fit at the tightest supported project (1024×768),
            so that viewport gets the collapsed control too — never the frontline bottom nav. */}
        <div className="xl:hidden">
          <OperationalTopNavDropdown
            id="operational-top-nav-mobile"
            open={mobileMenuOpen}
            onOpenChange={setMobileMenuOpen}
            panelClassName="w-[min(20rem,90vw)]"
            renderTrigger={({ buttonProps, open }) => (
              // A raw <button>, not the shared `Button` (not a forwardRef
              // component) — the dropdown needs a real DOM ref for focus
              // management (Escape-return, open-focus-first-item).
              <button
                {...buttonProps}
                type="button"
                aria-label="Open navigation menu"
                className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-md bg-transparent px-2.5 text-sm font-semibold text-text-inverse outline-none transition-colors duration-150 hover:bg-brand-navy-800 focus-visible:shadow-focus-inverse"
              >
                <span>Menu</span>
                <CaretIcon
                  size={operationalIconSizes.compactAction}
                  weight={operationalIconWeights.default}
                  className={cn("transition-transform duration-150", open && "rotate-180")}
                  aria-hidden
                />
              </button>
            )}
          >
            {(close) => (
              <nav aria-label={`${ariaLabel} (collapsed)`} className="flex flex-col gap-1">
                {menus.map((menu) =>
                  menu.href ? (
                    <Link
                      key={menu.key}
                      href={menu.href}
                      role="menuitem"
                      tabIndex={-1}
                      onClick={close}
                      className={cn(
                        "rounded-md px-3 py-2 text-sm font-semibold outline-none hover:bg-surface-muted focus-visible:bg-surface-muted",
                        isMenuActive(menu, router.pathname) ? "text-brand-navy-900" : "text-text-primary",
                      )}
                    >
                      {menu.label}
                    </Link>
                  ) : (
                    <div key={menu.key} className="rounded-md">
                      <p className="px-3 pb-1 pt-2 text-[0.625rem] font-bold uppercase tracking-[0.1em] text-text-muted">
                        {menu.label}
                      </p>
                      <MenuDropdownPanel menu={menu} close={close} />
                    </div>
                  ),
                )}
              </nav>
            )}
          </OperationalTopNavDropdown>
        </div>

        {/* Desktop module bar: role="menubar" with roving tabindex + click-to-open dropdowns. */}
        <div role="menubar" aria-label={ariaLabel} className="hidden min-w-0 flex-1 items-center gap-1 xl:flex">
          {menus.map((menu, index) => {
            const active = isMenuActive(menu, router.pathname);
            const roving = index === 0 ? 0 : -1;

            if (menu.href) {
              return (
                <Link
                  key={menu.key}
                  href={menu.href}
                  role="menuitem"
                  ref={(element) => {
                    triggerRefs.current[index] = element;
                  }}
                  tabIndex={roving}
                  aria-current={active ? "page" : undefined}
                  onKeyDown={(event) => onMenubarKeyDown(event, index)}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold outline-none transition-colors duration-150 focus-visible:shadow-focus-inverse",
                    active ? "bg-brand-white text-brand-navy-900" : "text-text-inverse hover:bg-brand-navy-800",
                  )}
                >
                  {menu.label}
                </Link>
              );
            }

            return (
              <OperationalTopNavDropdown
                key={menu.key}
                id={`operational-top-nav-${menu.key}`}
                renderTrigger={({ buttonProps, open }) => (
                  <button
                    {...buttonProps}
                    ref={(element) => {
                      buttonProps.ref.current = element;
                      triggerRefs.current[index] = element;
                    }}
                    role="menuitem"
                    tabIndex={roving}
                    aria-current={active ? "page" : undefined}
                    onKeyDown={(event) => {
                      buttonProps.onKeyDown(event);
                      onMenubarKeyDown(event, index);
                    }}
                    className={cn(
                      "shrink-0 rounded-md px-3 py-1.5 text-sm font-semibold outline-none transition-colors duration-150 focus-visible:shadow-focus-inverse",
                      active || open ? "bg-brand-white text-brand-navy-900" : "text-text-inverse hover:bg-brand-navy-800",
                    )}
                  >
                    {menu.label}
                  </button>
                )}
              >
                {(close) => <MenuDropdownPanel menu={menu} close={close} />}
              </OperationalTopNavDropdown>
            );
          })}
        </div>

        {/* Right: branch switcher, clock, identity/logout */}
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          {branchSwitcher}
          {clock}
          <OperationalTopNavDropdown
            id="operational-top-nav-identity"
            align="right"
            renderTrigger={({ buttonProps, open }) => (
              <button
                {...buttonProps}
                aria-label={`${displayName}, ${roleLabel} — account menu`}
                className={cn(
                  "flex h-9 min-w-0 shrink-0 items-center gap-2 rounded-md px-1.5 outline-none transition-colors duration-150 focus-visible:shadow-focus-inverse sm:px-2",
                  open ? "bg-brand-navy-800" : "hover:bg-brand-navy-800",
                )}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-navy-800 text-xs font-bold tracking-normal text-text-inverse"
                  aria-hidden
                >
                  {initials}
                </span>
                <span className="hidden min-w-0 max-w-[10rem] text-left md:block xl:max-w-[13rem]">
                  <span className="block truncate text-xs font-semibold sm:text-sm">{displayName}</span>
                  <span className="block truncate text-[0.625rem] font-medium text-brand-silver sm:text-xs">
                    {roleLabel}
                  </span>
                </span>
                <CaretIcon
                  className="hidden shrink-0 text-brand-silver sm:block"
                  size={operationalIconSizes.compactAction}
                  weight={operationalIconWeights.default}
                  aria-hidden
                />
              </button>
            )}
          >
            {(close) => (
              <div className="flex flex-col gap-1">
                <Link
                  href={profileHref}
                  role="menuitem"
                  tabIndex={-1}
                  onClick={close}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-text-primary outline-none hover:bg-surface-muted focus-visible:bg-surface-muted"
                >
                  <MeIcon size={operationalIconSizes.compactAction} weight={operationalIconWeights.default} aria-hidden />
                  My profile
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={isLoggingOut}
                  aria-busy={isLoggingOut}
                  onClick={() => {
                    close();
                    void handleLogout();
                  }}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-status-danger outline-none hover:bg-status-danger-surface focus-visible:bg-status-danger-surface disabled:opacity-60"
                >
                  <LogoutIcon size={operationalIconSizes.compactAction} weight={operationalIconWeights.default} aria-hidden />
                  {isLoggingOut ? "Logging out" : "Logout"}
                </button>
              </div>
            )}
          </OperationalTopNavDropdown>
        </div>
      </div>
    </header>
  );
}
