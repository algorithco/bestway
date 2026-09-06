"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { TeacherProfile, TeacherProfileCard } from "@/components/marketing/teacher-card";
import { cn } from "@/lib/utils";

/**
 * Horizontal teacher carousel — manual navigation only (no autoplay).
 * Mobile shows one card with a peek of the next; desktop shows 2→3→4.
 * Scroll-snap track = native swipe + keyboard support, no extra dependency.
 */
export function TeachersCarousel({ teachers }: { teachers: TeacherProfile[] }) {
  const t = useTranslations("marketing");
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [active, setActive] = React.useState(0);
  const [canPrev, setCanPrev] = React.useState(false);
  const [canNext, setCanNext] = React.useState(false);

  const reduceMotion = React.useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const updateEdges = React.useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  // Most-visible card drives dots + subtle active emphasis.
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track || teachers.length === 0) return;
    const cells = Array.from(track.querySelectorAll<HTMLElement>("[data-cell]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(Number((entry.target as HTMLElement).dataset.index));
          }
        }
      },
      { root: track, threshold: 0.6 },
    );
    cells.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [teachers.length]);

  React.useEffect(() => {
    updateEdges();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [updateEdges, teachers.length]);

  const scrollToIndex = React.useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const clamped = Math.max(0, Math.min(index, teachers.length - 1));
      const cell = track.querySelector<HTMLElement>(`[data-index="${clamped}"]`);
      cell?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        inline: "start",
        block: "nearest",
      });
    },
    [teachers.length, reduceMotion],
  );

  if (teachers.length === 0) {
    return <p className="py-8 text-center text-sm text-fg-muted">{t("teachersEmpty")}</p>;
  }

  return (
    <div>
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={t("teachersTitle")}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-1 py-5 [scrollbar-width:none] motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden"
      >
        {teachers.map((teacher, i) => (
          <div
            key={teacher.id}
            data-cell=""
            data-index={i}
            className="w-[84%] shrink-0 snap-start sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)] xl:w-[calc(25%-15px)]"
          >
            <TeacherProfileCard teacher={teacher} active={i === active} />
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => scrollToIndex(active - 1)}
          disabled={!canPrev}
          aria-label={t("teachersPrev")}
          className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface text-fg transition-all duration-200 hover:scale-105 hover:border-border-strong active:scale-95 disabled:cursor-default disabled:opacity-35 disabled:hover:scale-100"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {teachers.map((teacher, i) => (
            <button
              key={teacher.id}
              type="button"
              aria-label={t("teachersSlide", { index: i + 1, name: teacher.name })}
              aria-current={i === active ? "true" : undefined}
              onClick={() => scrollToIndex(i)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === active ? "w-6 bg-brand" : "w-2 bg-border-strong hover:bg-fg-subtle",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => scrollToIndex(active + 1)}
          disabled={!canNext}
          aria-label={t("teachersNext")}
          className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface text-fg transition-all duration-200 hover:scale-105 hover:border-border-strong active:scale-95 disabled:cursor-default disabled:opacity-35 disabled:hover:scale-100"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
