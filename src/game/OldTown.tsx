import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Building, World } from "./world";
import { corrugatedZinc } from "./textures";

/** Deterministic per-building hash so roofs/attachments are stable across reloads. */
const hash = (b: Building) => {
  const n = Math.sin(b.minX * 12.9898 + b.minZ * 78.233 + b.h * 3.17) * 43758.5453;
  return n - Math.floor(n);
};

/** Low-rise old-town buildings get a pitched corrugated roof. */
export const hasRoof = (b: Building) =>
  b.h <= 22 && (b.heritage || !b.kind || b.kind === "residential" || b.kind === "shop");

export const roofRise = (b: Building) => (hasRoof(b) ? Math.min(b.maxX - b.minX, b.maxZ - b.minZ) * (0.22 + hash(b) * 0.1) : 0);

const ROOF_COLORS = ["#8a4a2c", "#9c5a34", "#7d7f80", "#a9acaa", "#6e3b26", "#8f8a7c", "#b0642f"];

function gableGeometry() {
  // Unit triangular prism: base 1x1 at y=0, ridge along X at y=1.
  const g = new THREE.BufferGeometry();
  const p = [
    // left slope (-z side)
    -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, 0, -0.5, 0, -0.5, 0.5, 1, 0, -0.5, 1, 0,
    // right slope (+z side)
    0.5, 0, 0.5, -0.5, 0, 0.5, -0.5, 1, 0, 0.5, 0, 0.5, -0.5, 1, 0, 0.5, 1, 0,
    // gable ends
    -0.5, 0, 0.5, -0.5, 0, -0.5, -0.5, 1, 0, 0.5, 0, -0.5, 0.5, 0, 0.5, 0.5, 1, 0,
  ];
  const uv = [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0.5, 0.5, 0, 0, 1, 0, 0.5, 0.5];
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function hipGeometry() {
  const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1, true);
  g.rotateY(Math.PI / 4);
  g.translate(0, 0.5, 0);
  return g;
}

type Inst = { p: THREE.Vector3; s: THREE.Vector3; ry: number; c?: string };

function Instances({ items, geo, mat, cast = true }: { items: Inst[]; geo: THREE.BufferGeometry; mat: THREE.Material; cast?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    items.forEach((it, i) => {
      ref.current!.setMatrixAt(i, m.compose(it.p, q.setFromEuler(e.set(0, it.ry, 0)), it.s));
      if (it.c) ref.current!.setColorAt(i, c.set(it.c));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow={cast} receiveShadow />;
}

/** Afro-Brazilian / old-town detailing: zinc roofs with eaves, gable infill, AC condensers, balconies with railings. */
export function OldTown({ W }: { W: World }) {
  const geos = useMemo(() => ({ gable: gableGeometry(), hip: hipGeometry(), box: new THREE.BoxGeometry() }), []);
  const mats = useMemo(() => {
    const zinc = corrugatedZinc();
    return {
      roof: new THREE.MeshStandardMaterial({ map: zinc, roughness: 0.6, metalness: 0.35, side: THREE.DoubleSide }),
      fascia: new THREE.MeshLambertMaterial({ color: "#4a3626" }),
      ac: new THREE.MeshStandardMaterial({ color: "#e6e6e1", roughness: 0.5, metalness: 0.2 }),
      grille: new THREE.MeshStandardMaterial({ color: "#2c2c2c", roughness: 0.6, metalness: 0.5 }),
      slab: new THREE.MeshLambertMaterial({ color: "#cfc6b4" }),
      pipe: new THREE.MeshLambertMaterial({ color: "#d8d8d0" }),
    };
  }, []);

  const data = useMemo(() => {
    const gable: Inst[] = [], hip: Inst[] = [], fascia: Inst[] = [], ac: Inst[] = [], acGrille: Inst[] = [], pipe: Inst[] = [];
    const slab: Inst[] = [], rail: Inst[] = [], post: Inst[] = [];
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    for (const b of W.buildings) {
      if (b.h > 40) continue;
      const r = hash(b);
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      const wx = b.maxX - b.minX, wz = b.maxZ - b.minZ;
      if (hasRoof(b)) {
        const rise = roofRise(b), eave = 0.7;
        const col = ROOF_COLORS[Math.floor(r * ROOF_COLORS.length)];
        const along = wx >= wz ? 0 : Math.PI / 2;
        const L = (wx >= wz ? wx : wz) + eave * 2, D = (wx >= wz ? wz : wx) + eave * 2;
        if (b.heritage || r < 0.55) gable.push({ p: V(cx, b.h, cz), s: V(L, rise, D), ry: along, c: col });
        else hip.push({ p: V(cx, b.h, cz), s: V(wx + eave * 2, rise, wz + eave * 2), ry: 0, c: col });
        // timber fascia band under the eaves
        fascia.push({ p: V(cx, b.h - 0.12, cz), s: V(wx + eave * 2, 0.24, wz + eave * 2), ry: 0 });
      }
      // AC condensers + drain pipes on facades
      const floors = Math.max(1, Math.floor((b.h - 3.5) / 3.5));
      const faces: [number, number, number, number][] = [
        [0, b.maxZ, wx, 0], [Math.PI, b.minZ, wx, 0], [Math.PI / 2, b.maxX, wz, 1], [-Math.PI / 2, b.minX, wz, 1],
      ];
      faces.forEach(([ry, edge, span, axis], fi) => {
        for (let f = 1; f <= floors; f++) {
          const k = Math.sin((r * 97 + f * 13.1 + fi * 7.7) * 3.1) * 0.5 + 0.5;
          if (k > 0.45) continue;
          const off = (k / 0.45 - 0.5) * (span - 2.5);
          const y = 3.5 + f * 3.5 - 1.2;
          const out = 0.35;
          const nx = axis ? Math.sign(Math.sin(ry)) : 0, nz = axis ? 0 : Math.sign(Math.cos(ry));
          const px = axis ? edge + nx * out : cx + off, pz = axis ? cz + off : edge + nz * out;
          ac.push({ p: V(px, y, pz), s: V(0.9, 0.6, 0.6), ry });
          acGrille.push({ p: V(px + nx * 0.31, y, pz + nz * 0.31), s: V(0.5, 0.5, 0.02), ry });
          pipe.push({ p: V(px + nx * -0.2 + (axis ? 0 : 0.5), y - 1.5, pz + nz * -0.2 + (axis ? 0.5 : 0)), s: V(0.05, 3, 0.05), ry });
        }
      });
      // Balconies on residential / heritage / unbranded old houses (front + back faces)
      if ((b.heritage || b.kind === "residential" || (!b.kind && r > 0.4)) && b.h >= 6.5 && wx > 4) {
        for (const side of [1, -1]) {
          const z = side > 0 ? b.maxZ : b.minZ;
          const bw = Math.min(wx * 0.6, 6), y = b.heritage ? 3.6 : 3.5 + (r > 0.7 ? 3.5 : 0);
          if (y > b.h - 2) continue;
          slab.push({ p: V(cx, y, z + side * 0.6), s: V(bw, 0.18, 1.2), ry: 0 });
          rail.push({ p: V(cx, y + 1.0, z + side * 1.18), s: V(bw, 0.06, 0.06), ry: 0 });
          rail.push({ p: V(cx, y + 0.35, z + side * 1.18), s: V(bw, 0.05, 0.05), ry: 0 });
          for (let x = -bw / 2 + 0.15; x <= bw / 2; x += 0.3) post.push({ p: V(cx + x, y + 0.55, z + side * 1.18), s: V(0.04, 0.9, 0.04), ry: 0 });
        }
      }
    }
    return { gable, hip, fascia, ac, acGrille, pipe, slab, rail, post };
  }, [W]);

  return (
    <group>
      <Instances items={data.gable} geo={geos.gable} mat={mats.roof} />
      <Instances items={data.hip} geo={geos.hip} mat={mats.roof} />
      <Instances items={data.fascia} geo={geos.box} mat={mats.fascia} />
      <Instances items={data.ac} geo={geos.box} mat={mats.ac} />
      <Instances items={data.acGrille} geo={geos.box} mat={mats.grille} cast={false} />
      <Instances items={data.pipe} geo={geos.box} mat={mats.pipe} cast={false} />
      <Instances items={data.slab} geo={geos.box} mat={mats.slab} />
      <Instances items={data.rail} geo={geos.box} mat={mats.grille} />
      <Instances items={data.post} geo={geos.box} mat={mats.grille} cast={false} />
    </group>
  );
}
