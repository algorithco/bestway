"use client";

import * as React from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarCheck,
  Mic,
  PenLine,
  Play,
  Route,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { TiltCard } from "@/components/ui/tilt-card";
import { CountUp } from "@/components/marketing/count-up";
import { cn } from "@/lib/utils";

const OVERALL = 72;

const SKILLS = [
  {
    key: "heroProgressSpeaking",
    value: 78,
    Icon: Mic,
    tile: "bg-brand-subtle text-brand-subtle-fg",
  },
  {
    key: "heroProgressGrammar",
    value: 65,
    Icon: PenLine,
    tile: "bg-accent-subtle text-brand",
  },
  {
    key: "heroProgressVocabulary",
    value: 82,
    Icon: BookOpen,
    tile: "bg-orange-subtle text-orange",
  },
] as const;

const RING = { size: 64, radius: 26 };
const RING_C = 2 * Math.PI * RING.radius;

/**
 * Hero visual — compact "Learning path" card.
 * Communicates measurable student progress (the "results" from the headline)
 * while staying secondary to it. Reuses existing tokens, TiltCard and CountUp.
 */
export function HeroShowcase() {
  const t = useTranslations("marketing");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(false);

  // Animate ring + bars once when the card enters the viewport.
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const ringOffset = RING_C * (1 - (active ? OVERALL : 0) / 100);

  return (
    <div ref={rootRef} className="perspective relative mx-auto w-full max-w-[380px]">
      {/* soft restrained glow behind the card */}
      <div
        aria-hidden
        className="absolute inset-8 -z-10 rounded-[28px] bg-brand/15 blur-3xl dark:bg-brand/20"
      />

      <TiltCard
        maxTilt={6}
        className="relative rounded-[20px] border border-border bg-surface elevated-lg sm:rotate-[1.25deg]"
      >
        {/* hairline accent — echoes FancyCard, always visible but faint */}
        <span
          aria-hidden
          className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand/60 to-transparent"
        />

        <div className="p-5 sm:p-6">
          {/* ── Header: path + overall ring ─────────────────────────── */}
          <div className="flex items-center gap-3">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand-subtle-fg">
              <Route className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fg">{t("heroProgressTitle")}</p>
              <p className="mt-0.5 truncate text-xs text-fg-muted">{t("heroProgressSubtitle")}</p>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={OVERALL}
              aria-label={t("heroProgressTitle")}
              className="relative size-16 shrink-0"
            >
              <svg viewBox="0 0 64 64" aria-hidden className="size-16 -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r={RING.radius}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="6"
                />
                <circle
                  cx="32"
                  cy="32"
                  r={RING.radius}
                  fill="none"
                  stroke="var(--brand)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={ringOffset}
                  className="transition-[stroke-dashoffset] duration-[1200ms] ease-out motion-reduce:transition-none"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-fg tabular-nums">
                {active ? <CountUp end={OVERALL} suffix="%" /> : "0%"}
              </span>
            </div>
          </div>

          {/* ── Skills ──────────────────────────────────────────────── */}
          <ul className="mt-5 space-y-4">
            {SKILLS.map(({ key, value, Icon, tile }) => (
              <li key={key}>
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "inline-flex size-7 shrink-0 items-center justify-center rounded-lg",
                      tile,
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="flex-1 text-[13px] font-medium text-fg">{t(key)}</span>
                  <span className="text-xs font-semibold text-fg-muted tabular-nums">
                    {value}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={value}
                  aria-label={t(key)}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-border/70"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-[width] delay-150 duration-1000 ease-out motion-reduce:transition-none"
                    style={{ width: active ? `${value}%` : "0%" }}
                  />
                </div>
              </li>
            ))}
          </ul>

          {/* ── Next lesson ─────────────────────────────────────────── */}
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-bg-subtle px-3.5 py-3">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-fg">
              <Play className="size-3.5 fill-current" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium tracking-wide text-fg-subtle uppercase">
                {t("heroProgressNext")}
              </p>
              <p className="truncate text-sm font-semibold text-fg">
                {t("heroProgressNextTopic")}
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
          </div>
        </div>

        {/* ── Floating badges — overlap card edges, drift subtly ───── */}
        <FloatBadge
          className="-top-4 left-4 sm:-left-4"
          tile="bg-brand-subtle text-brand-subtle-fg"
          icon={<Award className="size-3.5" aria-hidden />}
          delay="0s"
        >
          CEFR C1
        </FloatBadge>
        <FloatBadge
          className="top-[42%] -right-2 sm:-right-5"
          tile="bg-accent-subtle text-brand"
          icon={<CalendarCheck className="size-3.5" aria-hidden />}
          delay="1.8s"
        >
          {t("heroProgressAttendance")}
        </FloatBadge>
        <FloatBadge
          className="-bottom-4 right-5 sm:right-8"
          tile="bg-orange-subtle text-orange"
          icon={<Users className="size-3.5" aria-hidden />}
          delay="3.4s"
        >
          20+ {t("statsTeachers")}
        </FloatBadge>
      </TiltCard>
    </div>
  );
}

function FloatBadge({
  children,
  className,
  tile,
  icon,
  delay,
}: {
  children: React.ReactNode;
  className?: string;
  tile: string;
  icon: React.ReactNode;
  delay: string;
}) {
  return (
    <div className={cn("absolute z-10", className)}>
      <span
        className="anim-float-soft elevated flex items-center gap-2 rounded-xl border border-border bg-surface/95 py-1.5 pr-3 pl-1.5 text-xs font-semibold whitespace-nowrap text-fg backdrop-blur"
        style={{ animationDelay: delay }}
      >
        <span className={cn("inline-flex size-6 items-center justify-center rounded-lg", tile)}>
          {icon}
        </span>
        {children}
      </span>
    </div>
  );
}
