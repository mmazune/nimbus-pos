import Link from "next/link";
import { useRouter } from "next/router";

import { cn } from "@/lib/utils/cn";

import { isOperationalRouteActive } from "./role-navigation";
import { operationalIcons, operationalIconSizes, operationalIconWeights } from "./role-icons";
import type { OperationalNavItem } from "./types";

type OperationalBottomNavProps = {
  ariaLabel: string;
  items: readonly OperationalNavItem[];
};

export function OperationalBottomNav({ ariaLabel, items }: OperationalBottomNavProps) {
  const router = useRouter();

  return (
    <nav
      className="border-t border-border-subtle bg-brand-navy-950 pb-[env(safe-area-inset-bottom)]"
      aria-label={ariaLabel}
      data-operational-bottom-nav
    >
      {/* Density pass 2026-08-20: 5rem -> 4rem tall (64px at the 16px root ceiling). */}
      <div
        className="mx-auto grid h-16 w-full max-w-[1600px] gap-1 px-2 py-2 sm:gap-2 sm:px-4 lg:px-6"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const Icon = operationalIcons[item.icon];
          const active = isOperationalRouteActive(item, router.pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-full min-w-0 items-center justify-center gap-2 rounded-md px-2 text-xs font-semibold sm:gap-2 sm:px-3 sm:text-sm",
                "transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98] focus-visible:relative focus-visible:z-10",
                // The bar is brand navy, so the default navy focus ring is invisible here.
                "focus-visible:shadow-focus-inverse",
                active
                  ? "bg-brand-white text-brand-navy-900"
                  : "text-text-inverse hover:bg-brand-navy-800",
              )}
            >
              <Icon
                className="shrink-0"
                size={operationalIconSizes.bottomNavigation}
                weight={active ? operationalIconWeights.activeNavigation : operationalIconWeights.inactiveNavigation}
                aria-hidden
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
