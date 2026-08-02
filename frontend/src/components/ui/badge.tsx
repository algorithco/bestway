import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium [&_svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "bg-bg-subtle text-fg-muted border border-border",
        brand: "bg-brand-subtle text-brand-subtle-fg",
        success: "bg-success-bg text-success",
        danger: "bg-danger-bg text-danger",
        warning: "bg-warning-bg text-warning",
        info: "bg-info-bg text-info",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
