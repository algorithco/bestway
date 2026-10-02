"use client";

import dynamic from "next/dynamic";

const CenterMap = dynamic(() => import("./center-map").then((m) => m.CenterMap), {
  ssr: false,
  loading: () => (
    <div aria-hidden className="flex h-full min-h-[380px] w-full items-center justify-center bg-[#0c1206]">
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 animate-pulse rounded-full bg-brand/25 blur-md" />
        <div className="h-3 w-40 animate-pulse rounded-full bg-border/50" />
      </div>
    </div>
  ),
});

export default CenterMap;
