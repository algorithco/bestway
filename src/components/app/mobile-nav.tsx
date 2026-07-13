"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { mobileNavForRole, isActive } from "@/lib/nav";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MobileNav({ role }: { role: Role }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = mobileNavForRole(role);

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 backdrop-blur-lg lg:hidden">
      <div className="flex items-stretch justify-around">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors duration-200",
                active ? "text-brand" : "text-fg-muted",
              )}
            >
              {/* yuqoridagi faol chizig'i */}
              <span
                aria-hidden
                className={cn(
                  "absolute top-0 h-0.5 w-8 rounded-full bg-brand transition-all duration-300",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
              <span
                className={cn(
                  "inline-flex items-center justify-center rounded-full px-3 py-0.5 transition-all duration-200",
                  active ? "bg-brand-subtle" : "bg-transparent",
                )}
              >
                <Icon className={cn("size-5 transition-transform duration-200", active && "scale-110")} />
              </span>
              <span className="max-w-full truncate px-1">{t(item.key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
