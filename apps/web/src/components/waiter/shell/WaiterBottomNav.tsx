import Link from "next/link";
import { useRouter } from "next/router";

import { waiterRoutes } from "@/lib/waiter/routes";
import { cn } from "@/lib/utils/cn";

export function WaiterBottomNav() {
  const router = useRouter();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-brand-navy-950">
      <div className="mx-auto grid h-20 min-w-[1280px] max-w-[1600px] grid-cols-4 gap-2 px-8 py-2">
        {waiterRoutes.map((route) => {
          const Icon = route.icon;
          const active = router.pathname === route.href;
          const iconSize = "iconSize" in route ? route.iconSize : 24;

          return (
            <Link
              key={route.href}
              href={route.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-16 items-center justify-center gap-3 rounded-md px-4 text-base font-semibold",
                "transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98]",
                active
                  ? "bg-brand-white text-brand-navy-900"
                  : "text-text-inverse hover:bg-brand-navy-800",
              )}
            >
              <Icon size={iconSize} weight={active ? "fill" : "bold"} />
              <span>{route.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
