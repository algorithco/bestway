"use client";

import * as React from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import GooeyNav from "@/components/ui/gooey-nav";
import { SpecularButton } from "@/components/ui/specular-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { hash: "courses", key: "navCourses" },
  { hash: "teachers", key: "navTeachers" },
  { hash: "why", key: "navWhy" },
  { hash: "news", key: "navNews" },
  { hash: "contact", key: "navContact" },
] as const;

export function SiteHeader() {
  const t = useTranslations("marketing");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-300",
        scrolled
          ? "border-b border-border bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/70"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Best Way" className="transition-transform hover:scale-[1.03]">
          <Brand size="md" />
        </Link>

        {/* Desktop navigatsiya — GooeyNav (React Bits) */}
        <div className="hidden lg:flex">
          <GooeyNav
            items={SECTIONS.map((s) => ({ label: t(s.key), href: `#${s.hash}` }))}
            particleCount={15}
            particleDistances={[90, 10]}
            particleR={100}
            initialActiveIndex={0}
            animationTime={600}
            timeVariance={300}
            colors={[1, 2, 3, 1, 2, 3, 1, 4]}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <div className="hidden items-center gap-1.5 sm:flex">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <SpecularButton
            size="sm"
            radius={12}
            tint="#ffffff"
            tintOpacity={0}
            textColor="var(--fg-muted)"
            lineColor="#128139"
            baseColor="#e5e7eb"
            intensity={1}
            shineSize={10}
            shineFade={40}
            thickness={1.2}
            onClick={() => router.push("/login")}
            className="hidden sm:inline-flex"
          >
            {t("login")}
          </SpecularButton>
          <SpecularButton
            size="sm"
            radius={12}
            tint="#128139"
            tintOpacity={1}
            textColor="#ffffff"
            lineColor="#ffffff"
            baseColor="#0d6a2d"
            intensity={1.2}
            shineSize={10}
            shineFade={40}
            thickness={1.2}
            onClick={() => router.push("/register")}
            className="hidden shadow-sm sm:inline-flex"
          >
            {t("heroCta")}
          </SpecularButton>

          {/* Mobil menyu tugmasi */}
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {/* Mobil ochiladigan panel */}
      {open && (
        <div className="anim-fade border-t border-border bg-bg/95 backdrop-blur-md lg:hidden" data-state="open">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6">
            {SECTIONS.map((s) => (
              <Link
                key={s.hash}
                href={`/#${s.hash}`}
                onClick={() => setOpen(false)}
                className="rounded-[10px] px-3 py-2.5 text-sm font-medium text-fg-muted hover:bg-surface-hover hover:text-fg"
              >
                {t(s.key)}
              </Link>
            ))}
            <div className="my-2 h-px bg-border" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
              <div className="flex items-center gap-2">
                <SpecularButton
                  size="sm"
                  radius={12}
                  tint="#ffffff"
                  tintOpacity={0}
                  textColor="var(--fg)"
                  lineColor="#128139"
                  baseColor="#d1d5db"
                  intensity={1}
                  shineSize={10}
                  shineFade={40}
                  thickness={1.2}
                  onClick={() => {
                    setOpen(false);
                    router.push("/login");
                  }}
                >
                  {t("login")}
                </SpecularButton>
                <SpecularButton
                  size="sm"
                  radius={12}
                  tint="#128139"
                  tintOpacity={1}
                  textColor="#ffffff"
                  lineColor="#ffffff"
                  baseColor="#0d6a2d"
                  intensity={1.2}
                  shineSize={10}
                  shineFade={40}
                  thickness={1.2}
                  onClick={() => {
                    setOpen(false);
                    router.push("/register");
                  }}
                >
                  {t("heroCta")}
                </SpecularButton>
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
