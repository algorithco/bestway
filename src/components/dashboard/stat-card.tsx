import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

type Tone = "brand" | "success" | "danger" | "warning" | "info" | "neutral";

const toneClass: Record<Tone, string> = {
  brand: "bg-brand-subtle text-brand-subtle-fg",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  info: "bg-info-bg text-info",
  neutral: "bg-bg-subtle text-fg-muted",
};

/** Burchakdagi nozik rangli yog'du — kartaga chuqurlik va "jonlilik" beradi */
const toneGlow: Record<Tone, string> = {
  brand: "bg-brand/25",
  success: "bg-success/25",
  danger: "bg-danger/25",
  warning: "bg-warning/30",
  info: "bg-info/25",
  neutral: "bg-fg/10",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  hint?: string;
  className?: string;
}) {
  return (
    <Card
      interactive
      className={cn("group relative overflow-hidden p-5", className)}
    >
      {/* burchakdagi rangli yog'du */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-8 -right-8 size-24 rounded-full opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100",
          toneGlow[tone],
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-fg-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-fg tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}
        </div>
        {Icon && (
          <span
            className={cn(
              "inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3",
              toneClass[tone],
            )}
          >
            <Icon className="size-5" />
          </span>
        )}
      </div>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
    </Card>
  );
}
