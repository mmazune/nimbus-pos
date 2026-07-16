import Link from "next/link";
import { useRouter } from "next/router";

import { supervisorRoutes } from "@/lib/supervisor/routes";
import { cn } from "@/lib/utils/cn";

export function SupervisorBottomNav() {
  const router = useRouter();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-brand-navy-950">
      <div className="mx-auto grid h-20 w-full max-w-[1600px] grid-cols-5 gap-1 px-2 py-2 sm:gap-2 sm:px-6 xl:px-8">
        {supervisorRoutes.map((route) => {
          const Icon = route.icon;
          const active = router.pathname === route.href;

          return (
            <Link
              key={route.href}
              href={route.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-16 min-w-0 items-center justify-center gap-2 rounded-md px-2 text-xs font-semibold sm:gap-3 sm:px-4 sm:text-base",
                "transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96]",
                active
                  ? "bg-brand-white text-brand-navy-900"
                  : "text-text-inverse hover:bg-brand-navy-800",
              )}
            >
              <Icon size={24} weight={active ? "fill" : "bold"} aria-hidden />
              <span className="truncate">{route.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
