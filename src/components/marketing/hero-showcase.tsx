"use client";

import { Award, GraduationCap, Sparkles, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/brand";
import { TiltCard } from "@/components/ui/tilt-card";
import { cn } from "@/lib/utils";

/**
 * Hero logotip ko'rgazmasi — sichqoncha kuzatib boradigan 3D panel.
 * Yangi vektor emblema (o'z foniga ega) markazda "suzadi", atrofida chuqurlik
 * bilan ko'tarilgan yorliqlar. Rasm emas — cheksiz aniq va jonli.
 */
export function HeroShowcase() {
  const t = useTranslations("marketing");

  return (
    <div className="perspective relative mx-auto w-full max-w-md">
      {/* orqa fon yog'dusi */}
      <div
        aria-hidden
        className="anim-gradient absolute inset-4 -z-10 rounded-full bg-gradient-to-tr from-brand/30 via-accent/25 to-highlight/30 blur-3xl"
      />

      <TiltCard
        maxTilt={12}
        className="anim-float ring-gradient rounded-[2.25rem] p-8 elevated-lg sm:p-12"
      >
        {/* ichki nozik yaltiroq */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[2.25rem] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/5"
        />

        {/* emblema — 3D sirt ustidan ko'tarilib turadi */}
        <div className="tilt-layer flex items-center justify-center">
          <BrandMark
            animated
            className="size-44 drop-shadow-2xl sm:size-56"
          />
        </div>

        {/* chuqurlikda suzuvchi yorliqlar */}
        <Pill
          className="-top-3 -left-3 sm:-top-4 sm:-left-5"
          tone="brand"
          icon={<Award className="size-4" />}
          z={70}
        >
          IELTS 8.5
        </Pill>
        <Pill
          className="-right-2 top-1/3 sm:-right-6"
          tone="orange"
          icon={<GraduationCap className="size-4" />}
          z={90}
        >
          500+ {t("statsStudents")}
        </Pill>
        <Pill
          className="-bottom-3 left-6 sm:-bottom-4"
          tone="accent"
          icon={<Star className="size-4" />}
          z={60}
        >
          CEFR C1
        </Pill>

        <span
          aria-hidden
          className="tilt-layer absolute right-6 -top-2 text-highlight"
          style={{ transform: "translateZ(110px)" }}
        >
          <Sparkles className="size-6 anim-glow" />
        </span>
      </TiltCard>
    </div>
  );
}

function Pill({
  children,
  className,
  tone,
  icon,
  z,
}: {
  children: React.ReactNode;
  className?: string;
  tone: "brand" | "orange" | "accent";
  icon: React.ReactNode;
  z: number;
}) {
  const dot =
    tone === "brand" ? "bg-brand" : tone === "orange" ? "bg-orange" : "bg-accent";
  return (
    <div
      className={cn(
        "tilt-layer absolute flex items-center gap-2 rounded-2xl border border-border bg-surface/95 px-3 py-2 text-xs font-semibold text-fg backdrop-blur elevated sm:text-sm",
        className,
      )}
      style={{ transform: `translateZ(${z}px)` }}
    >
      <span className={cn("inline-flex size-7 items-center justify-center rounded-full text-white", dot)}>
        {icon}
      </span>
      {children}
    </div>
  );
}
