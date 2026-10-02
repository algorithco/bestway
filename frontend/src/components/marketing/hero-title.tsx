"use client";

import { useSyncExternalStore } from "react";
import TextType from "@/components/ui/text-type";

type HeroTitleProps = {
  text: string;
  className?: string;
};

/**
 * Hero H1 visual — typewriter animation via TextType.
 * - Keeps the full title in an `sr-only` span so SEO / screen readers
 *   never see the empty-first-frame typing state.
 * - Respects `prefers-reduced-motion` by rendering static text.
 * - `key={text}` restarts typing when the locale (and thus text) changes
 *   without a full remount.
 * - `loop` replays the typing after a 10s hold on the full headline.
 */
export function HeroTitle({ text, className = "" }: HeroTitleProps) {
  // SSR-safe: server snapshot is `false` (animation), client syncs with the
  // OS setting without a cascading setState-in-effect render.
  const reduceMotion = useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className={className}>
        {reduceMotion ? (
          text
        ) : (
          <TextType
            key={text}
            as="span"
            text={text}
            typingSpeed={55}
            variableSpeed={{ min: 40, max: 75 }}
            initialDelay={350}
            pauseDuration={10000}
            deletingSpeed={30}
            loop
            showCursor
            cursorCharacter="|"
            cursorClassName="text-brand"
          />
        )}
      </span>
    </>
  );
}
