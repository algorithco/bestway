import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

const COLORS = ["#38c765", "#4cc9f0", "#ffffff", "#a3e635"];

/**
 * CursorTrail — cursor animation companion to ClickSpark.
 * - A soft glow dot follows the cursor (GPU transform, no layout thrash).
 * - Tiny sparks trail behind fast movement and fade out.
 * - Fixed fullscreen canvas, pointer-events:none, hidden on touch devices.
 */
export default function CursorTrail({ sparkColor = "#38c765" }: { sparkColor?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const particles = useRef<Particle[]>([]);
  const pos = useRef({ x: -100, y: -100 });
  const last = useRef({ x: -100, y: -100, t: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (window.matchMedia?.("(pointer: coarse)").matches) return;

    const resize = () => {
      canvas.width = Math.floor(window.innerWidth);
      canvas.height = Math.floor(window.innerHeight);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let lastEmit = 0;

    const onMove = (e: PointerEvent) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (glowRef.current) {
        glowRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
      }
      const now = performance.now();
      const dx = e.clientX - last.current.x;
      const dy = e.clientY - last.current.y;
      const speed = Math.hypot(dx, dy);
      // Emit more particles on fast moves, throttled to ~60/s.
      if (now - lastEmit > 16 && speed > 2 && particles.current.length < 120) {
        lastEmit = now;
        const n = speed > 24 ? 3 : 1;
        for (let i = 0; i < n; i++) {
          particles.current.push({
            x: e.clientX + (Math.random() - 0.5) * 6,
            y: e.clientY + (Math.random() - 0.5) * 6,
            vx: -dx * 0.02 + (Math.random() - 0.5) * 0.6,
            vy: -dy * 0.02 + (Math.random() - 0.5) * 0.6 - 0.2,
            life: 0,
            maxLife: 380 + Math.random() * 320,
            size: 1 + Math.random() * 2.2,
            color: Math.random() < 0.6 ? sparkColor : COLORS[(Math.random() * COLORS.length) | 0],
          });
        }
      }
      last.current = { x: e.clientX, y: e.clientY, t: now };
    };

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.current = particles.current.filter((p) => {
        p.life += 16;
        if (p.life >= p.maxLife) return false;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.008;
        const k = 1 - p.life / p.maxLife;
        ctx.globalAlpha = Math.max(0, k);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * k + 0.4, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, [sparkColor]);

  return (
    <>
      <div
        ref={glowRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[60] h-10 w-10 rounded-full opacity-40 blur-xl"
        style={{ background: "radial-gradient(circle, #38c765 0%, transparent 70%)" }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[59]"
        style={{ width: "100vw", height: "100vh" }}
      />
    </>
  );
}
