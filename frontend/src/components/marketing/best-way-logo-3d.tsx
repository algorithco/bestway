"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import LOGO from "./bestway-logo-data.json";

/**
 * Best Way — animated 3D logo (vector shapes extruded with three.js).
 * Plain three.js with a manual render loop (no react-three-fiber: its types
 * merge into the global JSX namespace and break ElementType-based components
 * elsewhere in the app). Behavior matches the original BestWayLogo3D.jsx.
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

const PARTICLE_COUNT = 220;

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
  const mountRef = useRef<HTMLDivElement>(null);
  const optsRef = useRef({ interactive, glow, particles });

  useEffect(() => {
    optsRef.current = { interactive, glow, particles };
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.5));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 60);
    camera.position.set(0, 0, 9);

    scene.add(new THREE.AmbientLight(0xffffff, 2.05));
    const dir = new THREE.DirectionalLight(0xffffff, 1.7);
    dir.position.set(2, 3, 8);
    scene.add(dir);
    const rim = new THREE.PointLight(0xc8ff9a, 2.2, 30, 0);
    rim.position.set(0, 0, 4);
    scene.add(rim);

    const root = new THREE.Group();
    scene.add(root);
    const pieces: Record<string, THREE.Group> = {};
    for (const part of buildParts()) {
      const g = new THREE.Group();
      g.position.set(part.px, part.py, 0);
      g.userData.home = part.px;
      const inner = new THREE.Group();
      inner.scale.setScalar(S);
      for (const m of part.meshes) {
        const mesh = new THREE.Mesh(m.geo, m.mat);
        mesh.position.z = m.z;
        inner.add(mesh);
      }
      g.add(inner);
      root.add(g);
      pieces[part.id] = g;
    }

    const disposables: { dispose: () => void }[] = [];
    let glowMesh: THREE.Mesh | null = null;
    if (optsRef.current.glow) {
      const glowTex = makeGlowTexture();
      disposables.push(glowTex);
      glowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(8.4, 8.4),
        new THREE.MeshBasicMaterial({
          map: glowTex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      glowMesh.position.set(0, 0, -1.5);
      scene.add(glowMesh);
      disposables.push(glowMesh.geometry, glowMesh.material as THREE.Material);
    }

    let points: THREE.Points | null = null;
    let speeds = new Float32Array(0);
    // visible view bounds (same width-fit formula as the camera): spawn + wrap
    // the particle field as fractions of it so dots never touch the canvas edge
    const viewOf = (w: number, h: number) => {
      const aspect = w / h;
      const z = Math.max(8, 2.65 / (0.3153 * aspect * 0.99));
      const halfH = 0.3153 * z;
      return { halfH, halfW: halfH * aspect };
    };
    if (optsRef.current.particles) {
      const rect = mount.getBoundingClientRect();
      const view = viewOf(Math.max(1, rect.width), Math.max(1, rect.height));
      const positions = new Float32Array(PARTICLE_COUNT * 3);
      speeds = new Float32Array(PARTICLE_COUNT);
      for (let i = 0; i < PARTICLE_COUNT; i++) {
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
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const dotTex = makeDotTexture();
      disposables.push(dotTex);
      const mat = new THREE.PointsMaterial({
        size: 0.07,
        map: dotTex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        color: "#b8f08a",
        blending: THREE.AdditiveBlending,
      });
      points = new THREE.Points(geo, mat);
      scene.add(points);
      disposables.push(geo, mat);
    }

    const pointer = { x: 0, y: 0 };
    const tilt = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    };
    renderer.domElement.addEventListener("pointermove", onPointerMove);

    const resize = () => {
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const clock = new THREE.Clock();
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const t = clock.getElapsedTime();
      const it = (a: number, d: number) => ease(clamp((t - a) / d, 0, 1));

      // frame the LOGO: fit its measured half-width (2.65 units) at 99% of the
      // viewport width (height never binds: 5.30 wide but only 1.80 tall)
      const w = Math.max(1, mount.clientWidth);
      const h = Math.max(1, mount.clientHeight);
      const aspect = w / h;
      camera.position.z = Math.max(8, 2.65 / (0.3153 * aspect * 0.99));
      const viewHalfH = 0.3153 * camera.position.z;

      const px = optsRef.current.interactive ? pointer.x : 0;
      const py = optsRef.current.interactive ? pointer.y : 0;
      tilt.x += (px - tilt.x) * 0.05;
      tilt.y += (py - tilt.y) * 0.05;
      root.rotation.y = tilt.x * 0.38 + Math.sin(t * 0.5) * 0.2;
      root.rotation.x = tilt.y * 0.18;
      root.position.y = Math.sin(t * 1.1) * 0.07;
      rim.position.set(Math.cos(t * 0.8) * 5, Math.sin(t * 0.6) * 3, 4);
      // fit the glow fade (complete at 2.52 plane units) inside 80% of the view
      // half-height, so it can never reach the canvas edge on any aspect ratio
      if (glowMesh) glowMesh.scale.setScalar(((viewHalfH * 0.8) / 2.52) * (1 + Math.sin(t * 1.3) * 0.06));

      const p = pieces;
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
      for (const sd of ["L", "R"]) {
        for (let k = 1; k <= 3; k++) {
          const wing = p[sd + k];
          if (!wing) continue;
          const wingDir = sd === "L" ? 1 : -1;
          const s = it(1 + k * 0.18, 1.6);
          const ph = t * 1.6 - k * 0.5;
          const home = wing.userData.home as number;
          wing.rotation.z = wingDir * (Math.sin(ph) * (0.04 + 0.015 * k) + (1 - s) * (k === 1 ? 0.3 : -0.3));
          wing.rotation.y = wingDir * (1 - s) * 1.4;
          wing.position.x = home - wingDir * (1 - s) * 3;
          wing.scale.setScalar(0.4 + 0.6 * s);
          wing.visible = s > 0.005;
        }
      }

      if (points) {
        const a = points.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          let y = a.getY(i) + speeds[i] * 0.006;
          if (y > viewHalfH * 0.55) y = -viewHalfH * 0.55;
          a.setY(i, y);
        }
        a.needsUpdate = true;
        points.rotation.y = t * 0.02;
      }

      renderer.render(scene, camera);
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else if (material) material.dispose();
      });
      for (const d of disposables) d.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [interactive, glow, particles]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: "100%", height: "100%", background: "transparent", overflow: "visible", ...style }}
    />
  );
}
