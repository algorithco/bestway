"use client";

import * as React from "react";
import { Camera, Geometry, Mesh, Program, Renderer } from "ogl";
import { cn } from "@/lib/utils";

/**
 * BestWay particle backdrop — OGL point-sprite field tuned to the brand.
 *
 * Palette is weighted toward the lime family (`--brand #89F336`,
 * `--brand-subtle-fg #B9FF83`) with rare warm accents (`--accent #FFED29`,
 * `--orange #FF991C`) and a whisper of white, so it reads as ambient
 * fireflies over the deep forest base — never neon confetti.
 *
 * Performance guards:
 * - client-only (mounted via `next/dynamic ssr:false`), DPR capped
 *   (1.5 on mobile, 2 on desktop), reduced particle count on small screens
 * - renders nothing when `prefers-reduced-motion` is set
 * - pauses the RAF loop when offscreen or the tab is hidden
 */
const BESTWAY_PALETTE = [
  "#89F336",
  "#89F336",
  "#89F336",
  "#B9FF83",
  "#B9FF83",
  "#FFED29",
  "#FF991C",
  "#ffffff",
];

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const int = parseInt(h.slice(0, 6), 16);
  return [((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
}

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec4 random;
  attribute vec3 color;

  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uSpread;
  uniform float uBaseSize;
  uniform float uSizeRandomness;

  varying vec4 vRandom;
  varying vec3 vColor;

  void main() {
    vRandom = random;
    vColor = color;

    vec3 pos = position * uSpread;
    pos.z *= 10.0;

    vec4 mPos = modelMatrix * vec4(pos, 1.0);
    float t = uTime;
    mPos.x += sin(t * random.z + 6.28 * random.w) * mix(0.1, 1.5, random.x);
    mPos.y += sin(t * random.y + 6.28 * random.x) * mix(0.1, 1.5, random.w);
    mPos.z += sin(t * random.w + 6.28 * random.y) * mix(0.1, 1.5, random.z);

    vec4 mvPos = viewMatrix * mPos;

    if (uSizeRandomness == 0.0) {
      gl_PointSize = uBaseSize;
    } else {
      gl_PointSize = (uBaseSize * (1.0 + uSizeRandomness * (random.x - 0.5))) / length(mvPos.xyz);
    }

    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragment = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uAlphaParticles;
  varying vec4 vRandom;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord.xy;
    float d = length(uv - vec2(0.5));

    if(uAlphaParticles < 0.5) {
      if(d > 0.5) {
        discard;
      }
      gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), 1.0);
    } else {
      float circle = smoothstep(0.5, 0.4, d) * 0.8;
      gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), circle);
    }
  }
`;

export default function ParticleBackdrop({ className }: { className?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  // Mounted via ssr:false, so window access in render is safe.
  const reduceMotion = React.useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    const canHover =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    const count = isMobile ? 100 : 280;

    const renderer = new Renderer({ dpr: pixelRatio, depth: false, alpha: true });
    const gl = renderer.gl;
    container.appendChild(gl.canvas);
    gl.clearColor(0, 0, 0, 0);

    const camera = new Camera(gl, { fov: 15 });
    camera.position.set(0, 0, 22);

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height);
      camera.perspective({ aspect: gl.canvas.width / gl.canvas.height });
    };
    window.addEventListener("resize", resize, false);
    resize();

    const mouse = { x: 0, y: 0 };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };
    if (canHover) container.addEventListener("mousemove", handleMouseMove);

    const positions = new Float32Array(count * 3);
    const randoms = new Float32Array(count * 4);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      let z = 0;
      let len = 0;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        len = x * x + y * y + z * z;
      } while (len > 1 || len === 0);
      const r = Math.cbrt(Math.random());
      positions.set([x * r, y * r, z * r], i * 3);
      randoms.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
      colors.set(
        hexToRgb(BESTWAY_PALETTE[Math.floor(Math.random() * BESTWAY_PALETTE.length)]),
        i * 3,
      );
    }

    const geometry = new Geometry(gl, {
      position: { size: 3, data: positions },
      random: { size: 4, data: randoms },
      color: { size: 3, data: colors },
    });

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uSpread: { value: 12 },
        uBaseSize: { value: 110 * pixelRatio },
        uSizeRandomness: { value: 1 },
        uAlphaParticles: { value: 1 },
      },
      transparent: true,
      depthTest: false,
    });

    const points = new Mesh(gl, { mode: gl.POINTS, geometry, program });

    let raf = 0;
    let lastTime = performance.now();
    let elapsed = 0;
    let running = true;

    const update = (t: number) => {
      raf = requestAnimationFrame(update);
      if (!running) {
        lastTime = t;
        return;
      }
      const delta = t - lastTime;
      lastTime = t;
      elapsed += delta * 0.3;

      program.uniforms.uTime.value = elapsed * 0.001;

      if (canHover) {
        points.position.x += (-mouse.x * 0.35 - points.position.x) * 0.03;
        points.position.y += (-mouse.y * 0.35 - points.position.y) * 0.03;
      }

      points.rotation.x = Math.sin(elapsed * 0.0002) * 0.1;
      points.rotation.y = Math.cos(elapsed * 0.0005) * 0.15;

      renderer.render({ scene: points, camera });
    };
    raf = requestAnimationFrame(update);

    const io = new IntersectionObserver(
      ([entry]) => {
        running = entry.isIntersecting && document.visibilityState === "visible";
      },
      { threshold: 0 },
    );
    io.observe(container);
    const onVisibility = () => {
      running =
        document.visibilityState === "visible" &&
        container.getBoundingClientRect().bottom > 0;
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
      if (canHover) container.removeEventListener("mousemove", handleMouseMove);
      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // Self-contained ambient layer: no reactive inputs.
  }, []);

  if (reduceMotion) return null;
  return <div ref={containerRef} className={cn("particles-container", className)} />;
}
