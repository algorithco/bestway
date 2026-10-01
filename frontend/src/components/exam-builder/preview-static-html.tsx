"use client";

import parse from "html-react-parser";
import { cn } from "@/lib/utils";

/**
 * Inert rich-markup renderer for gap-free preview documents.
 * The HTML must already be sanitized (see splitPreviewDocument); this renders
 * static content only — never inputs, radios, or question controls.
 */
export function PreviewStaticHtml({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn(
        "min-w-0 break-words text-sm leading-relaxed text-fg",
        "[&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:mb-2 [&_h4]:font-semibold",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_table]:w-full",
        "[&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border",
        "[&_th]:border-border [&_th]:bg-bg-subtle [&_th]:p-2 [&_th]:text-left [&_ul]:my-2",
        "[&_ul]:list-disc [&_ul]:pl-6",
        className,
      )}
    >
      {parse(html)}
    </div>
  );
}
