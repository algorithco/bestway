"use client";

import dynamic from "next/dynamic";

const FoldText = dynamic(() => import("./fold-text"), {
  ssr: false,
  loading: () => <span className="inline-block h-[1em] w-full animate-pulse bg-bg-subtle" />,
});

export default FoldText;
