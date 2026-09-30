"use client";

import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import * as React from "react";
import { useTransition } from "react";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, localeNames, type Locale } from "@/i18n/routing";

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [isPending, startTransition] = useTransition();
  // Controlled + non-modal: a modal menu locks <body> (overflow hidden +
  // padding-right compensation). If locale navigation unmounts the tree while
  // it is open, that cleanup never runs — scrollbar vanishes (~15px right gap,
  // content shifts) and the stuck overlay eats clicks. Non-modal never locks.
  const [open, setOpen] = React.useState(false);

  function switchTo(next: Locale) {
    // Same locale — no navigation (avoids a pointless replace + scroll jump).
    if (next === locale) return;
    // Close first, navigate after: menu state never survives into the
    // locale transition, and scroll position is preserved.
    setOpen(false);
    startTransition(() => {
      // pathname bu yerda tilsiz ko'rinishda ("/dashboard"), params dinamik segmentlarni saqlaydi
      router.replace(
        // @ts-expect-error — dinamik marshrutlar uchun params tipini next-intl aniq bilmaydi
        { pathname, params },
        { locale: next, scroll: false },
      );
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={isPending} className="gap-1.5 px-2">
          <Globe className="size-4" />
          <span className="text-xs font-semibold uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((code) => (
          <DropdownMenuCheckboxItem
            key={code}
            checked={code === locale}
            onCheckedChange={() => switchTo(code)}
          >
            {localeNames[code]}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
