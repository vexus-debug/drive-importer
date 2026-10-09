import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildNetwork, isFootpath, type BuiltRoad } from "./road-network";

const GROUND_Y = 0.06;
const DECK_T = 1.3; // box-girder depth under the deck
const PILLAR_STEP = 25;

/** Asphalt with baked lane paint: white edge lines + dashed centre (two-way) — u spans the carriageway width. */
function laneTexture(twoWay: boolean, paving = false) {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = paving ? "#b7ad9c" : "#45454b";
  g.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 2500; i++) {
    const v = paving ? 150 + Math.random() * 60 : 35 + Math.random() * 50;
    g.fillStyle = `rgba(${v},${v},${v + 3},${0.2 + Math.random() * 0.4})`;
    g.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
  }
  if (!paving) {
    g.fillStyle = "#e9e6dc";
    g.fillRect(3, 0, 3, 256);
    g.fillRect(122, 0, 3, 256);
    if (twoWay) { g.fillStyle = "#f2c230"; for (let y = 0; y < 256; y += 64) g.fillRect(62, y, 4, 34); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Ribbon along a centreline with mitred joins; v advances 1 per 12 m so dashes keep real spacing. */
function ribbon(b: BuiltRoad, pos: number[], uv: number[], idx: number[], yOff: number, ground: boolean) {
  const p = b.road.path, hw = b.width / 2, base = pos.length / 3;
  let v = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[Math.max(0, i - 1)]!, c = p[Math.min(p.length - 1, i + 1)]!;
    let dx = c[0] - a[0], dz = c[1] - a[1];
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    let nx = -dz, nz = dx, s = 1;
    if (i > 0 && i < p.length - 1) {
      const ix = p[i]![0] - a[0], iz = p[i]![1] - a[1], il = Math.hypot(ix, iz) || 1;
      const cos = (-(iz / il) * nx + (ix / il) * nz);
      s = Math.min(2.5, 1 / Math.max(0.4, Math.abs(cos)));
      nx = -iz / il; nz = ix / il;
      const ox = -dz, oz = dx; nx = (nx + ox) / 2; nz = (nz + oz) / 2; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
    }
    if (i > 0) v += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]) / 12;
    const y = ground ? GROUND_Y : b.heights[i]! + yOff;
    pos.push(p[i]![0] + nx * hw * s, y, p[i]![1] + nz * hw * s, p[i]![0] - nx * hw * s, y, p[i]![1] - nz * hw * s);
    uv.push(0, v, 1, v);
    if (i > 0) { const k = base + (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
}

function geom(pos: number[], uv: number[], idx: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Real Lagos road network from OSM: merged ground ribbons, elevated decks with girders, parapets and pillars. */
export function Roads() {
  const pillars = useRef<THREE.InstancedMesh>(null);
  const built = useMemo(() => {
    const net = buildNetwork();
    const buckets = { two: [[], [], []], one: [[], [], []], foot: [[], [], []], deck2: [[], [], []], deck1: [[], [], []] } as Record<string, [number[], number[], number[]]>;
    const side: number[] = [], sideIdx: number[] = [];
    const piers: { x: number; z: number; h: number; w: number; a: number }[] = [];
    // Draw minor roads first so major ones sit on top at junctions
    const order = [...net].sort((a, b) => a.width - b.width);
    for (const b of order) {
      const elevated = b.road.bridge && b.heights.some((h) => h > 0.5);
      if (!elevated) {
        const k = isFootpath(b.road) ? "foot" : b.road.oneway === 0 ? "two" : "one";
        ribbon(b, ...buckets[k]!, 0, true);
        continue;
      }
      ribbon(b, ...buckets[b.road.oneway === 0 ? "deck2" : "deck1"]!, 0.05, false);
      // girder skirts + parapets on both edges
      const p = b.road.path, hw = b.width / 2;
      for (let i = 1; i < p.length; i++) {
        const [ax, az] = p[i - 1]!, [bx, bz] = p[i]!;
        const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
        const ha = b.heights[i - 1]!, hb = b.heights[i]!;
        for (const sd of [1, -1]) {
          const x0 = ax + nx * hw * sd, z0 = az + nz * hw * sd, x1 = bx + nx * hw * sd, z1 = bz + nz * hw * sd;
          const k = side.length / 3;
          side.push(x0, ha - DECK_T, z0, x1, hb - DECK_T, z1, x0, ha + 1.0, z0, x1, hb + 1.0, z1);
          sideIdx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
        // pillars every PILLAR_STEP metres wherever the deck is high enough
        for (let s = 0; s < l; s += PILLAR_STEP) {
          const t = s / l, h = ha + (hb - ha) * t;
          if (h > 3) piers.push({ x: ax + dx * t, z: az + dz * t, h: h - DECK_T, w: Math.min(b.width * 0.6, 10), a: Math.atan2(dx, dz) });
        }
      }
    }
    return {
      two: geom(...buckets.two!), one: geom(...buckets.one!), foot: geom(...buckets.foot!),
      deck2: geom(...buckets.deck2!), deck1: geom(...buckets.deck1!),
      side: geom(side, side.map(() => 0).slice(0, (side.length / 3) * 2), sideIdx), piers,
    };
  }, []);

  const mats = useMemo(() => {
    const mk = (t: THREE.Texture, off: number) => new THREE.MeshLambertMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: off, polygonOffsetUnits: off });
    return {
      two: mk(laneTexture(true), -2), one: mk(laneTexture(false), -2), foot: mk(laneTexture(false, true), -1),
      deck2: new THREE.MeshLambertMaterial({ map: laneTexture(true) }), deck1: new THREE.MeshLambertMaterial({ map: laneTexture(false) }),
      concrete: new THREE.MeshLambertMaterial({ color: "#a39d92", side: THREE.DoubleSide }),
    };
  }, []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), e = new THREE.Euler();
    built.piers.forEach((p, i) => pillars.current!.setMatrixAt(i, m.compose(v.set(p.x, p.h / 2, p.z), q.setFromEuler(e.set(0, p.a, 0)), s.set(p.w, p.h, 1.4))));
    pillars.current!.instanceMatrix.needsUpdate = true;
  }, [built]);

  return (
    <group>
      <mesh geometry={built.foot} material={mats.foot} receiveShadow />
      <mesh geometry={built.one} material={mats.one} receiveShadow />
      <mesh geometry={built.two} material={mats.two} receiveShadow />
      <mesh geometry={built.deck1} material={mats.deck1} receiveShadow castShadow />
      <mesh geometry={built.deck2} material={mats.deck2} receiveShadow castShadow />
      <mesh geometry={built.side} material={mats.concrete} castShadow />
      <instancedMesh ref={pillars} args={[undefined, undefined, Math.max(1, built.piers.length)]} material={mats.concrete} castShadow>
        <boxGeometry args={[1, 1, 1]} />
      </instancedMesh>
    </group>
  );
}
