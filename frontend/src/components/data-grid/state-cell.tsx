"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type CellTone = "success" | "danger" | "warning" | "info" | "neutral";

const toneClass: Record<CellTone, string> = {
  success: "bg-success-bg text-success hover:brightness-[0.97]",
  danger: "bg-danger-bg text-danger hover:brightness-[0.97]",
  warning: "bg-warning-bg text-warning hover:brightness-[0.97]",
  info: "bg-info-bg text-info hover:brightness-[0.97]",
  neutral: "text-fg-subtle hover:bg-surface-hover",
};

interface StateCellProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone: CellTone;
  /** Saqlanayotganda yumshoq pulslash */
  pending?: boolean;
}

/** Jadval katagi — bosilganda holat almashadi (davomat / to'lov). */
export const StateCell = React.forwardRef<HTMLButtonElement, StateCellProps>(function StateCell(
  { tone, pending, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      data-grid-cell
      type="button"
      className={cn(
        "flex h-10 w-full items-center justify-center gap-1 text-xs font-medium outline-none transition-[background-color,color,transform] duration-150 active:scale-[0.88]",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/50",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:transition-transform",
        toneClass[tone],
        pending && "animate-pulse",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
