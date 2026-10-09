import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { roofRise } from "./OldTown";
import type { World } from "./world";

/** Mid-poly street dressing: sagging NEPA wire web with crossarms/insulators/transformers, wall AC units, DStv dishes, grass tufts. */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const ARM_Y = 8.4;

export function PowerLines({ W }: { W: World }) {
  const arm = useRef<THREE.InstancedMesh>(null);
  const ins = useRef<THREE.InstancedMesh>(null);
  const tx = useRef<THREE.InstancedMesh>(null);

  const data = useMemo(() => {
    const P = W.poles;
    const dir = P.map(() => new THREE.Vector2(1, 0));
    const pairs: [number, number][] = [];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d > 4 && d < 36) pairs.push([i, i + 1]);
    }
    for (const [i, j] of pairs) {
      const v = new THREE.Vector2(P[j].x - P[i].x, P[j].z - P[i].z).normalize();
      dir[i] = v; dir[j] = v;
    }
    const pts: number[] = [];
    const seg = 14;
    const strand = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, sag: number) => {
      for (let k = 0; k < seg; k++) {
        const t0 = k / seg, t1 = (k + 1) / seg;
        const y = (t: number) => ay + (by - ay) * t - sag * 4 * t * (1 - t);
        pts.push(ax + (bx - ax) * t0, y(t0), az + (bz - az) * t0, ax + (bx - ax) * t1, y(t1), az + (bz - az) * t1);
      }
    };
    const r = rng(77);
    for (const [i, j] of pairs) {
      const a = P[i], b = P[j];
      const pa = new THREE.Vector2(-dir[i].y, dir[i].x), pb = new THREE.Vector2(-dir[j].y, dir[j].x);
      for (const o of [-0.8, -0.27, 0.27, 0.8]) strand(a.x + pa.x * o, ARM_Y + 0.12, a.z + pa.y * o, b.x + pb.x * o, ARM_Y + 0.12, b.z + pb.y * o, 0.55 + r() * 0.35);
      // low telecom / cable TV bundle, sloppier sag
      strand(a.x, 6.3, a.z, b.x, 6.3, b.z, 1.1 + r() * 0.8);
      if (r() < 0.5) strand(a.x + 0.15, 6.1, a.z, b.x + 0.15, 6.0, b.z, 1.6 + r());
    }
    // service drops toward nearby facades
    for (let i = 0; i < P.length; i++) {
      if (r() > 0.55) continue;
      const p = P[i];
      let best: { x: number; z: number; d: number } | null = null;
      for (const bd of W.buildings) {
        if (bd.h > 40) continue;
        const cx = Math.max(bd.minX, Math.min(p.x, bd.maxX)), cz = Math.max(bd.minZ, Math.min(p.z, bd.maxZ));
        const d = Math.hypot(cx - p.x, cz - p.z);
        if (d < 14 && (!best || d < best.d)) best = { x: cx, z: cz, d };
      }
      if (best) strand(p.x, 7.0, p.z, best.x + (r() - 0.5) * 3, 4.6 + r() * 1.5, best.z + (r() - 0.5) * 3, 0.5 + r() * 0.5);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const txIdx = P.map((_, i) => i).filter((i) => i % 4 === 1);
    return { dir, geo: g, txIdx };
  }, [W]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3(), e = new THREE.Euler();
    let n = 0;
    W.poles.forEach((p, i) => {
      const d = data.dir[i];
      const yaw = Math.atan2(d.x, d.y); // arm runs perpendicular to the wire
      q.setFromEuler(e.set(0, yaw + Math.PI / 2, 0));
      arm.current!.setMatrixAt(i, m.compose(v.set(p.x, ARM_Y, p.z), q, s));
      for (const o of [-0.8, -0.27, 0.27, 0.8]) {
        ins.current!.setMatrixAt(n++, m.compose(v.set(p.x - d.y * o, ARM_Y + 0.12, p.z + d.x * o), q.identity(), s));
      }
    });
    data.txIdx.forEach((i, k) => {
      const p = W.poles[i];
      tx.current!.setMatrixAt(k, m.compose(v.set(p.x + 0.45, 6.9, p.z), q.identity(), s));
    });
    for (const r of [arm, ins, tx]) r.current!.instanceMatrix.needsUpdate = true;
  }, [W, data]);

  const N = W.poles.length;
  return (
    <group>
      <lineSegments geometry={data.geo}>
        <lineBasicMaterial color="#111111" />
      </lineSegments>
      <instancedMesh ref={arm} args={[undefined, undefined, Math.max(1, N)]} castShadow>
        <boxGeometry args={[2.0, 0.14, 0.14]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={ins} args={[undefined, undefined, Math.max(1, N * 4)]}>
        <cylinderGeometry args={[0.05, 0.08, 0.22, 10]} />
        <meshStandardMaterial color="#e8e2d0" roughness={0.3} />
      </instancedMesh>
      <instancedMesh ref={tx} args={[undefined, undefined, Math.max(1, data.txIdx.length)]} castShadow>
        <cylinderGeometry args={[0.38, 0.38, 1.1, 16]} />
        <meshStandardMaterial color="#6f7a73" metalness={0.5} roughness={0.5} />
      </instancedMesh>
    </group>
  );
}

export function RoofClutter({ W }: { W: World }) {
  const ac = useRef<THREE.InstancedMesh>(null);
  const fan = useRef<THREE.InstancedMesh>(null);
  const dish = useRef<THREE.InstancedMesh>(null);
  const mast = useRef<THREE.InstancedMesh>(null);

  const data = useMemo(() => {
    const r = rng(311);
    const acs: { x: number; y: number; z: number; ry: number }[] = [];
    const dishes: { x: number; y: number; z: number; ry: number }[] = [];
    for (const b of W.buildings) {
      if (b.heritage || b.h > 60) continue;
      const floors = Math.max(1, Math.floor((b.h - 4) / 3.4));
      for (let f = 0; f < floors; f++) {
        const y = 5 + f * 3.4;
        if (r() < 0.45) acs.push({ x: b.minX + 1 + r() * (b.maxX - b.minX - 2), y, z: b.maxZ + 0.3, ry: 0 });
        if (r() < 0.45) acs.push({ x: b.minX + 1 + r() * (b.maxX - b.minX - 2), y, z: b.minZ - 0.3, ry: Math.PI });
        if (r() < 0.3) acs.push({ x: b.maxX + 0.3, y, z: b.minZ + 1 + r() * (b.maxZ - b.minZ - 2), ry: Math.PI / 2 });
      }
      const top = b.h + roofRise(b);
      const nd = 1 + Math.floor(r() * 3);
      for (let k = 0; k < nd; k++)
        dishes.push({ x: b.minX + 1 + r() * (b.maxX - b.minX - 2), y: top, z: b.minZ + 1 + r() * (b.maxZ - b.minZ - 2), ry: r() * Math.PI * 2 });
    }
    return { acs, dishes };
  }, [W]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3(), e = new THREE.Euler(), off = new THREE.Vector3();
    data.acs.forEach((a, i) => {
      q.setFromEuler(e.set(0, a.ry, 0));
      ac.current!.setMatrixAt(i, m.compose(v.set(a.x, a.y, a.z), q, s));
      off.set(0.12, 0, 0.27).applyQuaternion(q);
      fan.current!.setMatrixAt(i, m.compose(v.set(a.x + off.x, a.y, a.z + off.z), new THREE.Quaternion().setFromEuler(e.set(Math.PI / 2, a.ry, 0, "YXZ")), s));
    });
    data.dishes.forEach((d, i) => {
      q.setFromEuler(e.set(-0.7, d.ry, 0, "YXZ"));
      dish.current!.setMatrixAt(i, m.compose(v.set(d.x, d.y + 1.0, d.z), q, s));
      mast.current!.setMatrixAt(i, m.compose(v.set(d.x, d.y + 0.5, d.z), q.identity(), s));
    });
    for (const r of [ac, fan, dish, mast]) r.current!.instanceMatrix.needsUpdate = true;
  }, [data]);

  return (
    <group>
      <instancedMesh ref={ac} args={[undefined, undefined, Math.max(1, data.acs.length)]} castShadow>
        <boxGeometry args={[0.9, 0.62, 0.5]} />
        <meshStandardMaterial color="#dcdad2" roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={fan} args={[undefined, undefined, Math.max(1, data.acs.length)]}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 20]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={dish} args={[undefined, undefined, Math.max(1, data.dishes.length)]} castShadow>
        <sphereGeometry args={[0.55, 20, 8, 0, Math.PI * 2, 0, 0.6]} />
        <meshStandardMaterial color="#e9e9e4" roughness={0.5} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={mast} args={[undefined, undefined, Math.max(1, data.dishes.length)]}>
        <cylinderGeometry args={[0.04, 0.04, 1.0, 8]} />
        <meshStandardMaterial color="#777" metalness={0.7} roughness={0.4} />
      </instancedMesh>
    </group>
  );
}

function tuftGeometry() {
  const pos: number[] = [];
  const r = rng(9);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, h = 0.35 + r() * 0.45, w = 0.05, lean = 0.12 + r() * 0.15;
    const cx = Math.cos(a), cz = Math.sin(a), px = -cz * w, pz = cx * w;
    const bx = cx * 0.06, bz = cz * 0.06;
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, bx + cx * lean, h, bz + cz * lean);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function GrassTufts({ W }: { W: World }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(tuftGeometry, []);
  const spots = useMemo(() => {
    const r = rng(1234);
    const out: { x: number; z: number; s: number; c: number }[] = [];
    for (const b of W.blocks) {
      const edges: [number, number, number, number][] = [
        [b.minX, b.minZ - 0.6, b.maxX, b.minZ - 0.6], [b.minX, b.maxZ + 0.6, b.maxX, b.maxZ + 0.6],
        [b.minX - 0.6, b.minZ, b.minX - 0.6, b.maxZ], [b.maxX + 0.6, b.minZ, b.maxX + 0.6, b.maxZ],
      ];
      for (const [x1, z1, x2, z2] of edges) {
        const len = Math.hypot(x2 - x1, z2 - z1);
        for (let t = 0; t < len; t += 0.9 + r() * 2.2) {
          if (r() < 0.35) continue;
          out.push({ x: x1 + ((x2 - x1) * t) / len + (r() - 0.5) * 0.9, z: z1 + ((z2 - z1) * t) / len + (r() - 0.5) * 0.9, s: 0.7 + r() * 0.9, c: r() });
        }
      }
    }
    for (const p of W.palms) for (let k = 0; k < 5; k++) out.push({ x: p.x + (r() - 0.5) * 1.6, z: p.z + (r() - 0.5) * 1.6, s: 0.8 + r() * 0.6, c: r() });
    return out.slice(0, 9000);
  }, [W]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), e = new THREE.Euler(), c = new THREE.Color();
    const greens = ["#5c8a2e", "#7a9a35", "#4a7428", "#9a9a40"];
    spots.forEach((p, i) => {
      ref.current!.setMatrixAt(i, m.compose(v.set(p.x, 0.03, p.z), q.setFromEuler(e.set(0, p.c * 6.28, 0)), s.setScalar(p.s)));
      ref.current!.setColorAt(i, c.set(greens[Math.floor(p.c * greens.length)]));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [spots]);

  return (
    <instancedMesh ref={ref} args={[geo, undefined, Math.max(1, spots.length)]}>
      <meshLambertMaterial side={THREE.DoubleSide} />
    </instancedMesh>
  );
}
