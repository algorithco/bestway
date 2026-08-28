"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Brand } from "@/components/brand";
import { navForRole, isActive } from "@/lib/nav";
import { CENTER } from "@/lib/config";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AppSidebar({ role }: { role: Role }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const items = navForRole(role);

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
      {/* logo + nozik yashil yog'du */}
      <div className="relative flex h-16 items-center border-b border-border px-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 left-0 h-24 w-40 rounded-full bg-brand/10 blur-2xl"
        />
        <Link href="/" aria-label={CENTER.name} className="relative transition-transform hover:scale-[1.02]">
          <Brand />
        </Link>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-brand-subtle text-brand-subtle-fg"
                  : "text-fg-muted hover:translate-x-0.5 hover:bg-surface-hover hover:text-fg",
              )}
            >
              {/* chapdagi faol ko'rsatkich */}
              <span
                aria-hidden
                className={cn(
                  "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand transition-all duration-200",
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
                )}
              />
              <Icon
                className={cn(
                  "size-[18px] shrink-0 transition-transform duration-200",
                  active ? "text-brand" : "group-hover:scale-110",
                )}
              />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-3">
        <p className="text-xs text-fg-subtle">
          {CENTER.name} · <span className="text-fg-muted">{CENTER.established}</span>
        </p>
      </div>
    </aside>
  );
}
