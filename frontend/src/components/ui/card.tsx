import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal professional uslub: standart holatda soya emas, 1px chegara —
 * ma'lumotga to'la jadval/ro'yxat sahifalari tinch ko'rinishi uchun.
 *
 * `interactive` — bosiladigan/havolali kartalar uchun: hoverda yumshoq
 * ko'tariladi, chegarasi quyuqlashadi va nozik soya paydo bo'ladi.
 */
export function Card({
  className,
  interactive = false,
  ...props
}: React.ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[12px] border border-border bg-surface",
        interactive && "lift hover:border-border-strong",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 px-5 pt-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return <h3 className={cn("text-base font-semibold text-fg", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-sm text-fg-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2 border-t border-border px-5 py-3", className)}
      {...props}
    />
  );
}
