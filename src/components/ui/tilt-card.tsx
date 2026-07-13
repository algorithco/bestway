"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 3D egiluvchi konteyner — sichqoncha ustida yurganda karta chuqurlik bilan
 * egiladi va yuza bo'ylab yumshoq yorug'lik (glare) suriladi.
 *
 * Faqat CSS transformlar (WebGL yo'q) — yengil va tez. `prefers-reduced-motion`
 * yoqilgan bo'lsa yoki sensorli qurilmada effekt o'chiriladi.
 */
export function TiltCard({
  children,
  className,
  maxTilt = 8,
  glare = true,
  ...props
}: React.ComponentProps<"div"> & {
  /** Maksimal egilish burchagi (daraja) */
  maxTilt?: number;
  /** Yuza bo'ylab yorug'lik dog'i */
  glare?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const enabled = React.useRef(true);
  const frame = React.useRef<number>(0);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    enabled.current = !reduce && !coarse;
  }, []);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!enabled.current) return;
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width; // 0..1
      const py = (e.clientY - r.top) / r.height; // 0..1
      const ry = (px - 0.5) * 2 * maxTilt; // chapga/o'ngga
      const rx = (0.5 - py) * 2 * maxTilt; // yuqoriga/pastga
      el.style.setProperty("--tilt-x", `${rx.toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${ry.toFixed(2)}deg`);
      el.style.setProperty("--glare-x", `${(px * 100).toFixed(1)}%`);
      el.style.setProperty("--glare-y", `${(py * 100).toFixed(1)}%`);
      el.style.setProperty("--glare-o", "1");
    });
  }

  function reset() {
    const el = ref.current;
    if (!el) return;
    cancelAnimationFrame(frame.current);
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
    el.style.setProperty("--glare-o", "0");
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={cn("tilt-3d relative", className)}
      {...props}
    >
      {children}
      {glare && (
        <span
          aria-hidden
          className="tilt-glare pointer-events-none absolute inset-0 rounded-[inherit]"
        />
      )}
    </div>
  );
}
