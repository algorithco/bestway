"use client";

import * as React from "react";
import dynamic from "next/dynamic";

const BestWayLogo3D = dynamic(() => import("@/components/marketing/best-way-logo-3d"), {
  ssr: false,
  loading: () => <LogoFallback />,
});

function LogoFallback() {
  return (
    <div aria-hidden className="flex h-full w-full items-center justify-center">
      <div className="size-24 animate-pulse rounded-full bg-brand/20 blur-xl" />
    </div>
  );
}

/**
 * Hero visual — animated 3D Bestway logo.
 * Replaces the old "Learning path" stats card. The canvas is client-only
 * (WebGL) and lazy-loaded so it never blocks first paint or SSR.
 */
export function HeroShowcase() {
  const reduceMotion = React.useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  return (
    <div className="relative mx-auto w-full max-w-[700px] border-0 bg-transparent shadow-none outline-none sm:translate-x-4 lg:translate-x-8">
      <div className="relative h-[440px] overflow-visible bg-transparent sm:h-[500px]">
        <BestWayLogo3D interactive={!reduceMotion} />
      </div>
    </div>
  );
}
