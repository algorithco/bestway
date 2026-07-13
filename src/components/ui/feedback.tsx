import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("shimmer rounded-[8px] bg-border/50", className)}
      aria-hidden
      {...props}
    />
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin text-fg-muted", className)} aria-hidden />;
}

/** Sahifa/blok bo'sh bo'lganda — nima qilish kerakligini aytadi, shunchaki "bo'sh" demaydi */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="rounded-full bg-bg-subtle p-3">
          <Icon className="size-5 text-fg-subtle" aria-hidden />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium text-fg">{title}</p>
        {description && <p className="max-w-sm text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** So'rov muvaffaqiyatsiz bo'lganda — sabab va "qayta urinish" tugmasi */
export function ErrorState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[12px] border border-danger-border bg-danger-bg/40 px-6 py-10 text-center",
        className,
      )}
      role="alert"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium text-danger">{title}</p>
        {description && <p className="max-w-sm text-sm text-fg-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
