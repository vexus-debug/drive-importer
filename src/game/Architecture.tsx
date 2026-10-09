import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Building, World } from "./world";
import { signTexture } from "./textures";

/**
 * Typology-specific structure layered on building bodies:
 * banks = granite podium + brand-banded glass tower + portico; residential = balconies or verandas;
 * restaurants/cafes = brand hipped roof, glass dining front, canopy, pylon sign, patio umbrellas.
 */

export const BANK_PODIUM = 7;
export const BANK_INSET = 1.4;

type V3 = [number, number, number];
type Part = { p: V3; s: V3; c: string; ry?: number };
type Groups = Record<"solid" | "glass" | "glow" | "metal" | "cyl" | "roof" | "umb", Part[]>;

const hash = (b: Building, k = 0) => {
  const n = Math.sin(b.minX * 12.9898 + b.minZ * 78.233 + k * 37.1) * 43758.5453;
  return n - Math.floor(n);
};
const brandCol = (b: Building) => (!b.brand ? "#c33" : b.brand.bg.toLowerCase() === "#ffffff" ? b.brand.fg : b.brand.bg);
const brandAlt = (b: Building) => (!b.brand ? "#fc0" : b.brand.accent.toLowerCase() === "#ffffff" ? b.brand.fg : b.brand.accent);
const LAUNDRY = ["#e63946", "#f1faee", "#457b9d", "#f4a261", "#2a9d8f", "#ffd60a"];

function build(W: World) {
  const G: Groups = { solid: [], glass: [], glow: [], metal: [], cyl: [], roof: [], umb: [] };
  const pylons: { b: Building; p: V3 }[] = [];
  for (const b of W.buildings) {
    const w = b.maxX - b.minX, d = b.maxZ - b.minZ, cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
    if (b.kind === "bank") {
      const col = brandCol(b), alt = brandAlt(b);
      const tw = w - BANK_INSET * 2, td = d - BANK_INSET * 2;
      G.solid.push({ p: [cx, 0.3, cz], s: [w + 0.6, 0.6, d + 0.6], c: "#3b3b3b" });
      G.solid.push({ p: [cx, BANK_PODIUM / 2, cz], s: [w, BANK_PODIUM, d], c: "#e4dfd3" });
      G.solid.push({ p: [cx, BANK_PODIUM - 0.6, cz], s: [w + 0.15, 1.2, d + 0.15], c: col });
      for (let y = BANK_PODIUM + 4; y < b.h - 2; y += 7) G.solid.push({ p: [cx, y, cz], s: [tw + 0.25, 0.55, td + 0.25], c: col });
      G.solid.push({ p: [cx, b.h + 0.7, cz], s: [tw + 0.4, 1.4, td + 0.4], c: col });
      G.solid.push({ p: [cx, b.h + 1.6, cz], s: [tw * 0.4, 1.0, td * 0.4], c: "#9a9a9a" });
      G.cyl.push({ p: [cx + tw * 0.3, b.h + 5, cz], s: [0.25, 8, 0.25], c: "#cfcfcf" });
      // vertical brand fins on the tower corners
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]])
        G.solid.push({ p: [cx + (sx * tw) / 2, (BANK_PODIUM + b.h) / 2, cz + (sz * td) / 2], s: [0.6, b.h - BANK_PODIUM, 0.6], c: alt });
      // double-height glass entrance, portico canopy + columns
      G.glass.push({ p: [cx, 2.6, b.maxZ + 0.05], s: [w * 0.45, 4.6, 0.1], c: "#8fc3d9" });
      G.solid.push({ p: [cx, 5.3, b.maxZ + 1.6], s: [w * 0.55, 0.45, 3.2], c: "#f0ede6" });
      G.solid.push({ p: [cx, 5.6, b.maxZ + 3.15], s: [w * 0.55, 0.3, 0.12], c: col });
      for (let k = 0; k < 4; k++) G.cyl.push({ p: [cx - w * 0.24 + (k * w * 0.48) / 3, 2.55, b.maxZ + 2.9], s: [0.32, 5.1, 0.32], c: "#f4f1ea" });
      G.solid.push({ p: [cx, 0.15, b.maxZ + 1.6], s: [w * 0.55, 0.3, 3.2], c: "#bdb7aa" });
      // security booth + bollards
      G.solid.push({ p: [b.minX + 1.2, 1.2, b.maxZ + 2.4], s: [1.6, 2.4, 1.6], c: "#e9e6de" });
      G.glass.push({ p: [b.minX + 1.2, 1.5, b.maxZ + 3.21], s: [1.2, 0.9, 0.04], c: "#8fc3d9" });
      for (let k = 0; k < 6; k++) G.cyl.push({ p: [cx - w * 0.4 + (k * w * 0.8) / 5, 0.45, b.maxZ + 4.0], s: [0.14, 0.9, 0.14], c: "#222" });
    } else if (b.kind === "residential" || b.kind === "hotel") {
      const floors = Math.floor((b.h - 1) / 3.2);
      const veranda = b.kind === "residential" && hash(b, 1) < 0.4;
      const rail = hash(b, 2) < 0.5 ? "#f2efe8" : "#2a2a2a";
      for (let f = 1; f < floors; f++) {
        const y = f * 3.2;
        for (const sg of [1, -1]) {
          const fz = sg > 0 ? b.maxZ : b.minZ;
          if (veranda || b.kind === "hotel") {
            G.solid.push({ p: [cx, y, fz + sg * 0.9], s: [w + 0.3, 0.24, 1.8], c: "#d8d3c8" });
            G.solid.push({ p: [cx, y + 0.55, fz + sg * 1.76], s: [w + 0.3, 0.9, 0.08], c: rail });
          } else {
            const n = Math.max(1, Math.floor(w / 5.5));
            for (let k = 0; k < n; k++) {
              if (hash(b, f * 13 + k + (sg > 0 ? 0 : 50)) < 0.2) continue;
              const x = b.minX + (w / n) * (k + 0.5);
              G.solid.push({ p: [x, y, fz + sg * 0.65], s: [3.2, 0.22, 1.3], c: "#d8d3c8" });
              G.solid.push({ p: [x, y + 0.55, fz + sg * 1.28], s: [3.2, 0.9, 0.07], c: rail });
              G.solid.push({ p: [x - 1.58, y + 0.55, fz + sg * 0.65], s: [0.07, 0.9, 1.3], c: rail });
              G.solid.push({ p: [x + 1.58, y + 0.55, fz + sg * 0.65], s: [0.07, 0.9, 1.3], c: rail });
              if (hash(b, f * 7 + k) < 0.35)
                G.solid.push({ p: [x + (hash(b, k) - 0.5) * 2, y + 0.7, fz + sg * 1.36], s: [0.7, 0.6, 0.03], c: LAUNDRY[Math.floor(hash(b, f + k * 3) * LAUNDRY.length)] });
            }
          }
        }
      }
      if (veranda) for (let x = b.minX; x <= b.maxX + 0.01; x += Math.max(2.5, w / Math.ceil(w / 3.5)))
        for (const sg of [1, -1]) G.cyl.push({ p: [x, 1.6, (sg > 0 ? b.maxZ : b.minZ) + sg * 1.6], s: [0.18, 3.2, 0.18], c: "#ebe6da" });
      // external stair tower on flats
      if (!veranda && b.kind === "residential" && floors > 2) G.solid.push({ p: [b.maxX + 1.2, b.h / 2, cz], s: [2.4, b.h, 3.2], c: "#cfc8b8" });
      // compound gate posts
      if (b.kind === "residential") for (const x of [cx - 2, cx + 2]) G.solid.push({ p: [x, 1.1, b.maxZ + 2.6], s: [0.5, 2.2, 0.5], c: "#e6e0d2" });
      if (b.kind === "residential") G.metal.push({ p: [cx, 1.0, b.maxZ + 2.6], s: [3.5, 1.8, 0.06], c: "#1a1a1a" });
    } else if (b.kind === "restaurant" || b.kind === "cafe") {
      const col = brandCol(b), alt = brandAlt(b);
      const rest = b.kind === "restaurant";
      G.roof.push({ p: [cx, b.h + 1.1, cz], s: [(w + 1.4) * 0.7071, 2.2, (d + 1.4) * 0.7071], c: col });
      G.solid.push({ p: [cx, b.h - 0.4, cz], s: [w + 0.2, 0.8, d + 0.2], c: alt });
      G.solid.push({ p: [cx, 0.5, cz], s: [w + 0.1, 1.0, d + 0.1], c: rest ? col : "#3a2a20" });
      G.glow.push({ p: [cx, 2.1, b.maxZ + 0.06], s: [w * 0.85, 2.2, 0.08], c: "#ffd9a0" });
      G.glow.push({ p: [b.maxX + 0.06, 2.1, cz], s: [0.08, 2.2, d * 0.7], c: "#ffd9a0" });
      for (let k = 0; k <= 4; k++) G.metal.push({ p: [b.minX + w * 0.075 + (k * w * 0.85) / 4, 2.1, b.maxZ + 0.1], s: [0.1, 2.3, 0.05], c: "#222" });
      G.solid.push({ p: [cx, 3.5, b.maxZ + 1.2], s: [Math.min(5, w * 0.5), 0.3, 2.4], c: alt });
      if (rest) {
        const pp: V3 = [b.maxX + 1.5, 0, b.maxZ + 2.5];
        G.cyl.push({ p: [pp[0], 4, pp[2]], s: [0.22, 8, 0.22], c: "#8a8a8a" });
        pylons.push({ b, p: [pp[0], 8.6, pp[2]] });
      }
      for (const sx of [-0.28, 0.08]) {
        const x = cx + sx * w, z = b.maxZ + 3.0;
        G.cyl.push({ p: [x, 1.2, z], s: [0.05, 2.4, 0.05], c: "#ddd" });
        G.umb.push({ p: [x, 2.45, z], s: [1.3, 0.55, 1.3], c: hash(b, sx * 10) < 0.5 ? col : alt });
        G.cyl.push({ p: [x, 0.75, z], s: [0.55, 0.06, 0.55], c: "#f2f2f2" });
        for (const o of [-0.85, 0.85]) G.solid.push({ p: [x + o, 0.45, z], s: [0.4, 0.9, 0.4], c: "#333" });
      }
      G.solid.push({ p: [b.minX + 0.8, 0.4, b.maxZ + 0.6], s: [1.2, 0.8, 0.6], c: "#6b4a2a" });
    }
  }
  return { G, pylons };
}

function Inst({ items, geo, mat }: { items: Part[]; geo: THREE.BufferGeometry; mat: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
    items.forEach((it, i) => {
      ref.current!.setMatrixAt(i, m.compose(v.set(...it.p), q.setFromEuler(e.set(0, it.ry ?? 0, 0)), s.set(...it.s)));
      ref.current!.setColorAt(i, c.set(it.c));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow receiveShadow />;
}

export function Architecture({ W }: { W: World }) {
  const { G, pylons } = useMemo(() => build(W), [W]);
  const geo = useMemo(() => {
    const roof = new THREE.ConeGeometry(1, 1, 4);
    roof.rotateY(Math.PI / 4);
    return { box: new THREE.BoxGeometry(), cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 16), roof, umb: new THREE.ConeGeometry(1, 1, 16, 1, true) };
  }, []);
  const mats = useMemo(() => ({
    solid: new THREE.MeshStandardMaterial({ roughness: 0.75 }),
    glass: new THREE.MeshStandardMaterial({ roughness: 0.08, metalness: 0.7 }),
    glow: new THREE.MeshBasicMaterial({ toneMapped: false }),
    metal: new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.8 }),
    cyl: new THREE.MeshStandardMaterial({ roughness: 0.55 }),
    roof: new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true }),
    umb: new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }),
  }), []);
  const pylonTex = useMemo(() => {
    const cache = new Map<string, THREE.Texture>();
    return pylons.map(({ b }) => {
      const B = b.brand!;
      if (!cache.has(B.name)) cache.set(B.name, signTexture(B.name, B.bg, B.fg, 512, 128, B.accent, B.mark, B.markFg));
      return cache.get(B.name)!;
    });
  }, [pylons]);

  return (
    <group>
      <Inst items={G.solid} geo={geo.box} mat={mats.solid} />
      <Inst items={G.glass} geo={geo.box} mat={mats.glass} />
      <Inst items={G.glow} geo={geo.box} mat={mats.glow} />
      <Inst items={G.metal} geo={geo.box} mat={mats.metal} />
      <Inst items={G.cyl} geo={geo.cyl} mat={mats.cyl} />
      <Inst items={G.roof} geo={geo.roof} mat={mats.roof} />
      <Inst items={G.umb} geo={geo.umb} mat={mats.umb} />
      {pylons.map((py, i) => (
        <group key={i} position={py.p} rotation-y={Math.PI / 4}>
          <mesh castShadow><boxGeometry args={[3.6, 1.2, 0.3]} /><meshStandardMaterial color="#222" /></mesh>
          <mesh position={[0, 0, 0.16]}><planeGeometry args={[3.4, 0.95]} /><meshBasicMaterial map={pylonTex[i]} toneMapped={false} /></mesh>
          <mesh position={[0, 0, -0.16]} rotation-y={Math.PI}><planeGeometry args={[3.4, 0.95]} /><meshBasicMaterial map={pylonTex[i]} toneMapped={false} /></mesh>
        </group>
      ))}
    </group>
  );
}
