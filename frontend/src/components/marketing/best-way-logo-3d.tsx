"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import LOGO from "./bestway-logo-data.json";

/**
 * Best Way — animated 3D logo (vector shapes extruded with three.js).
 * Converted to TS from the original BestWayLogo3D.jsx; behavior unchanged.
 */

interface LogoShape {
  /** paths: [outer, ...holes], each a flat [x0, y0, x1, y1, ...] array */
  p: number[][];
  /** body mesh (extruded) when truthy, flush inlay otherwise */
  b?: number | boolean;
  /** material color */
  c: string;
}

interface LogoLayer {
  id: string;
  px: number;
  py: number;
  /** extrusion depth */
  D: number;
  /** inlay relief */
  rel: number;
  /** linear color gradient fit, absent when unused */
  gr?: number[][];
  s: LogoShape[];
}

interface BuiltMesh {
  geo: THREE.ExtrudeGeometry;
  mat: THREE.Material;
  z: number;
}

interface BuiltPart {
  id: string;
  px: number;
  py: number;
  meshes: BuiltMesh[];
}

const S = 0.0085; // logo pixel units -> scene units
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 4);
const pts2 = (p: number[]) => {
  const a: THREE.Vector2[] = [];
  for (let i = 0; i < p.length; i += 2) a.push(new THREE.Vector2(p[i], p[i + 1]));
  return a;
};

// Build every logo piece once: solid extruded body + flush inlays (no gaps).
function buildParts(): BuiltPart[] {
  return (LOGO as LogoLayer[]).map((L) => {
    const D = L.D;
    const bt = D * 0.08;
    const front = D / 2 + bt;
    const meshes = L.s.map((s) => {
      const shape = new THREE.Shape(pts2(s.p[0]));
      for (let h = 1; h < s.p.length; h++) shape.holes.push(new THREE.Path(pts2(s.p[h])));

      if (s.b) {
        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: D,
          bevelEnabled: true,
          bevelThickness: bt,
          bevelSize: 0.6,
          bevelSegments: 3,
          curveSegments: 1,
        });
        let mat: THREE.Material;
        if (L.gr) {
          // linear colour gradient fitted to the original logo colours
          const p = geo.attributes.position as THREE.BufferAttribute;
          const col = new Float32Array(p.count * 3);
          const g = L.gr;
          const c = new THREE.Color();
          for (let i = 0; i < p.count; i++) {
            const x = p.getX(i);
            const y = p.getY(i);
            c.setRGB(
              clamp((g[0][0] + g[1][0] * x + g[2][0] * y) / 255, 0, 1),
              clamp((g[0][1] + g[1][1] * x + g[2][1] * y) / 255, 0, 1),
              clamp((g[0][2] + g[1][2] * x + g[2][2] * y) / 255, 0, 1),
              THREE.SRGBColorSpace,
            );
            col.set([c.r, c.g, c.b], i * 3);
          }
          geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
          mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.1 });
        } else {
          mat = new THREE.MeshStandardMaterial({ color: s.c, roughness: 0.45, metalness: 0.08 });
        }
        return { geo, mat, z: -D / 2 };
      }
      // inlay: pressed 1 unit into the body and proud by L.rel -> cannot leave a gap
      const dep = L.rel + bt + 1;
      const geo = new THREE.ExtrudeGeometry(shape, { depth: dep, bevelEnabled: false, curveSegments: 1 });
      const mat = new THREE.MeshStandardMaterial({ color: s.c, roughness: 0.35, metalness: 0.05 });
      return { geo, mat, z: front + L.rel - dep };
    });
    return { id: L.id, px: L.px * S, py: L.py * S, meshes };
  });
}

function makeGlowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d");
  if (!x) throw new Error("2d canvas context unavailable");
  const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(140,220,90,.45)");
  g.addColorStop(0.35, "rgba(60,160,80,.12)");
  g.addColorStop(0.6, "rgba(0,0,0,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

function makeDotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const x = c.getContext("2d");
  if (!x) throw new Error("2d canvas context unavailable");
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, "#fff");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function Scene({
  interactive,
  glow,
  particles,
}: {
  interactive: boolean;
  glow: boolean;
  particles: boolean;
}) {
  const parts = useMemo(() => buildParts(), []);
  const glowTex = useMemo(() => makeGlowTexture(), []);
  const dotTex = useMemo(() => makeDotTexture(), []);
  const N = 220;
  const { size } = useThree();
  // visible view bounds (same width-fit formula as the camera below): spawn + wrap
  // the particle field as fractions of it so dots never touch the canvas edge
  const view = useMemo(() => {
    const aspect = size.width / size.height;
    const z = Math.max(8, 2.65 / (0.3153 * aspect * 0.99));
    const halfH = 0.3153 * z;
    return { halfH, halfW: halfH * aspect };
  }, [size.width, size.height]);
  /* eslint-disable react-hooks/purity -- random particle field, generated once per mount */
  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(N * 3);
    const speeds = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      positions.set(
        [
          (Math.random() - 0.5) * 2 * view.halfW * 0.8,
          (Math.random() - 0.5) * 2 * view.halfH * 0.55,
          (Math.random() - 0.5) * 5 - 2,
        ],
        i * 3,
      );
      speeds[i] = 0.1 + Math.random() * 0.35;
    }
    return { positions, speeds };
  }, [view]);
  /* eslint-enable react-hooks/purity */

  const root = useRef<THREE.Group>(null!);
  const rim = useRef<THREE.PointLight>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const pointsRef = useRef<THREE.Points>(null!);
  const pieces = useRef<Record<string, THREE.Group>>({});
  const tilt = useRef({ x: 0, y: 0 });

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const it = (a: number, d: number) => ease(clamp((t - a) / d, 0, 1));

    // frame the LOGO, not empty space: fit its measured half-width (2.65 units)
    // at 99% of the viewport width, on any aspect ratio (height never binds:
    // the logo is 5.30 wide but only 1.80 tall)
    const aspect = size.width / size.height;
    state.camera.position.z = Math.max(8, 2.65 / (0.3153 * aspect * 0.99));

    const px = interactive ? state.pointer.x : 0;
    const py = interactive ? -state.pointer.y : 0;
    tilt.current.x += (px - tilt.current.x) * 0.05;
    tilt.current.y += (py - tilt.current.y) * 0.05;
    root.current.rotation.y = tilt.current.x * 0.38 + Math.sin(t * 0.5) * 0.2;
    root.current.rotation.x = tilt.current.y * 0.18;
    root.current.position.y = Math.sin(t * 1.1) * 0.07;
    rim.current.position.set(Math.cos(t * 0.8) * 5, Math.sin(t * 0.6) * 3, 4);
    // fit the glow fade (complete at 2.52 plane units) inside 80% of the view
    // half-height, so it can never reach the canvas edge on any aspect ratio
    if (glowRef.current) {
      const viewHalfH = 0.3153 * state.camera.position.z;
      glowRef.current.scale.setScalar(((viewHalfH * 0.8) / 2.52) * (1 + Math.sin(t * 1.3) * 0.06));
    }

    const p = pieces.current;
    if (p.cube) {
      const s = it(0.1, 1.5);
      p.cube.scale.setScalar(0.01 + s * 0.99);
      p.cube.rotation.y = (1 - s) * Math.PI * 2 + Math.sin(t * 0.9) * 0.04;
    }
    if (p.arc) {
      const s = it(0.7, 1.4);
      p.arc.scale.setScalar(0.6 + 0.4 * s);
      p.arc.rotation.z = (1 - s) * -1.2;
      p.arc.visible = s > 0.01;
    }
    ["L", "R"].forEach((sd) =>
      [1, 2, 3].forEach((k) => {
        const w = p[sd + k];
        if (!w) return;
        const dir = sd === "L" ? 1 : -1;
        const s = it(1 + k * 0.18, 1.6);
        const ph = t * 1.6 - k * 0.5;
        const home = w.userData.home as number;
        w.rotation.z = dir * (Math.sin(ph) * (0.04 + 0.015 * k) + (1 - s) * (k === 1 ? 0.3 : -0.3));
        w.rotation.y = dir * (1 - s) * 1.4;
        w.position.x = home - dir * (1 - s) * 3;
        w.scale.setScalar(0.4 + 0.6 * s);
        w.visible = s > 0.005;
      }),
    );

    if (pointsRef.current) {
      const a = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N; i++) {
        let y = a.getY(i) + speeds[i] * 0.006;
        if (y > view.halfH * 0.55) y = -view.halfH * 0.55;
        a.setY(i, y);
      }
      a.needsUpdate = true;
      pointsRef.current.rotation.y = t * 0.02;
    }
  });

  return (
    <>
      <ambientLight intensity={2.05} />
      <directionalLight intensity={1.7} position={[2, 3, 8]} />
      <pointLight ref={rim} color="#c8ff9a" intensity={2.2} distance={30} decay={0} />

      <group ref={root}>
        {parts.map((part) => (
          <group
            key={part.id}
            position={[part.px, part.py, 0]}
            userData={{ home: part.px }}
            ref={(g) => {
              if (g) pieces.current[part.id] = g;
            }}
          >
            <group scale={S}>
              {part.meshes.map((m, i) => (
                <mesh key={i} geometry={m.geo} material={m.mat} position-z={m.z} />
              ))}
            </group>
          </group>
        ))}
      </group>

      {glow && (
        <mesh ref={glowRef} position={[0, 0, -1.5]}>
          <planeGeometry args={[8.4, 8.4]} />
          <meshBasicMaterial map={glowTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      )}

      {particles && (
        <points ref={pointsRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.07}
            map={dotTex}
            transparent
            opacity={0.55}
            depthWrite={false}
            color="#b8f08a"
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}
    </>
  );
}

export default function BestWayLogo3D({
  interactive = true,
  glow = true,
  particles = true,
  className,
  style,
}: {
  interactive?: boolean;
  glow?: boolean;
  particles?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%", background: "transparent", ...style }}
    >
      <Canvas
        flat // no tone mapping: keeps the exact logo colours
        dpr={[1, 2.5]}
        gl={{ antialias: true, alpha: true }}
        camera={{ fov: 35, near: 0.5, far: 60, position: [0, 0, 9] }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        style={{ overflow: "visible", background: "transparent" }}
      >
        <Scene interactive={interactive} glow={glow} particles={particles} />
      </Canvas>
    </div>
  );
}
