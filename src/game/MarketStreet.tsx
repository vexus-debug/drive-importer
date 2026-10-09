import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { DIAGONALS, HALF_ROAD, LINES, distToMarina, type World } from "./world";

/** True when a point (with radius) would intrude on any carriageway: grid streets, Marina curve or angled old-town streets. */
function onRoad(x: number, z: number, r = 1.2) {
  const lim = HALF_ROAD + r + 0.4;
  for (const L of LINES) {
    if (Math.abs(x - L) < lim && z > -262 && z < 212) return true;
    if (Math.abs(z - L) < lim && x > -212 && x < 212) return true;
  }
  if (z < -190 && distToMarina(x, z) < lim) return true;
  for (const d of DIAGONALS)
    for (let i = 0; i < d.pts.length - 1; i++) {
      const a = d.pts[i], b = d.pts[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)) < lim) return true;
    }
  return false;
}
const SKIN = ["#3b2416", "#4a2c1a", "#5c3920", "#2e1c11", "#6b4428"];
const CLOTH = ["#e63946", "#f4a261", "#2a9d8f", "#e9c46a", "#7b2cbf", "#1d3557", "#ff006e", "#06d6a0", "#fb8500", "#ffffff", "#264653", "#b5179e"];

/** Phase 2: street-level Lagos clutter — sidewalk stalls, brand umbrellas, crates, caged generators, POS kiosks, painted signs, sagging NEPA wires. Visual only. */

const rand = (s: number) => { const n = Math.sin(s * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const BRANDS = ["#ffcb05", "#e40000", "#0a8f3c", "#ffcb05", "#1e5bc6", "#f28c28"]; // MTN, Airtel, Glo, MTN, striped blue, orange canvas
const GOODS = ["#d6336c", "#1971c2", "#f59f00", "#2f9e44", "#e8590c", "#7048e8", "#fab005", "#c92a2a"];
const SIGNS: [string, string, string][] = [
  ["GENERATOR MECHANIC HERE", "#f4e9c8", "#b3120f"],
  ["COLD PURE WATER", "#1d5fb8", "#ffffff"],
  ["VULCANIZER", "#111111", "#ffd43b"],
  ["PHOTOCOPY · LAMINATING", "#ffffff", "#0b5f2a"],
  ["DON'T URINATE HERE!", "#f8f1e0", "#c41a1a"],
  ["NO PARKING", "#ffd43b", "#111111"],
  ["AMALA & EWEDU", "#8a1c12", "#ffe8a3"],
  ["PHONE REPAIRS", "#2b2b2b", "#7cf0ff"],
];

type I = { p: [number, number, number]; s: [number, number, number]; ry?: number; rx?: number; c?: string };

function Inst({ items, geo, mat, cast = true }: { items: I[]; geo: THREE.BufferGeometry; mat: THREE.Material; cast?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), v = new THREE.Vector3(), s = new THREE.Vector3();
    items.forEach((it, i) => {
      ref.current!.setMatrixAt(i, m.compose(v.set(...it.p), q.setFromEuler(e.set(it.rx ?? 0, it.ry ?? 0, 0)), s.set(...it.s)));
      if (it.c) ref.current!.setColorAt(i, c.set(it.c));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow={cast} receiveShadow />;
}

function signTex(text: string, bg: string, fg: string) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = bg; g.fillRect(0, 0, 256, 96);
  g.fillStyle = fg;
  let sz = 40;
  g.font = `bold ${sz}px Impact, sans-serif`;
  while (g.measureText(text).width > 236 && sz > 14) g.font = `bold ${(sz -= 2)}px Impact, sans-serif`;
  g.textAlign = "center"; g.textBaseline = "middle";
  g.save(); g.translate(128, 50); g.rotate(-0.03); g.fillText(text, 0, 0); g.restore();
  // weathering: rust drips + grime
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${90 + Math.random() * 50},55,25,${Math.random() * 0.25})`; g.fillRect(Math.random() * 256, Math.random() * 96, 2 + Math.random() * 3, 4 + Math.random() * 14); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function posTex() {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffcb05"; g.fillRect(0, 0, 256, 128);
  g.fillStyle = "#111"; g.font = "bold 44px Impact, sans-serif"; g.textAlign = "center";
  g.fillText("POS", 128, 50);
  g.font = "bold 20px Impact, sans-serif";
  g.fillText("CASH OUT · TRANSFER · AIRTIME", 128, 92);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function MarketStreet({ W }: { W: World }) {
  const geo = useMemo(() => ({
    box: new THREE.BoxGeometry(),
    umb: new THREE.ConeGeometry(1, 0.5, 8, 1, true).translate(0, 0.25, 0),
    rod: new THREE.CylinderGeometry(0.035, 0.035, 1, 5).translate(0, 0.5, 0),
    cage: new THREE.BoxGeometry(1, 1, 1),
    basin: new THREE.CylinderGeometry(0.42, 0.3, 0.22, 10),
    body: new THREE.CylinderGeometry(0.17, 0.26, 1, 7),
    head: new THREE.SphereGeometry(0.12, 8, 6),
    tie: new THREE.ConeGeometry(0.16, 0.18, 7),
    tray: new THREE.CylinderGeometry(0.3, 0.25, 0.08, 10),
  }), []);
  const mat = useMemo(() => ({
    umb: new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
    wood: new THREE.MeshLambertMaterial({ color: "#7a5532" }),
    crate: new THREE.MeshLambertMaterial(),
    gen: new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.3 }),
    cage: new THREE.MeshLambertMaterial({ color: "#3a3a36", wireframe: true }),
    metal: new THREE.MeshLambertMaterial({ color: "#3d3d3d" }),
    goods: new THREE.MeshLambertMaterial(),
    pipe: new THREE.MeshLambertMaterial({ color: "#e8e6dc" }),
  }), []);
  const signs = useMemo(() => SIGNS.map(([t, b, f]) => new THREE.MeshLambertMaterial({ map: signTex(t, b, f) })), []);
  const posMat = useMemo(() => new THREE.MeshLambertMaterial({ map: posTex() }), []);

  const D = useMemo(() => {
    const umb: I[] = [], rod: I[] = [], table: I[] = [], goods: I[] = [], crate: I[] = [], basin: I[] = [];
    const gen: I[] = [], cage: I[] = [], exhaust: I[] = [], kiosk: I[] = [], kioskTop: I[] = [], pipe: I[] = [];
    const signList: { p: [number, number, number]; ry: number; k: number }[] = [];
    const body: I[] = [], head: I[] = [], tie: I[] = [], tray: I[] = [];
    let seed = 1;
    const person = (x: number, z: number, ry: number, k: number, opt: { tie?: boolean; tray?: boolean; sit?: boolean } = {}) => {
      if (onRoad(x, z, 0.4)) return;
      const h = (opt.sit ? 0.75 : 1) * (0.92 + rand(k) * 0.16);
      body.push({ p: [x, 0.62 * h, z], s: [1, 1.24 * h, 1], ry, c: CLOTH[Math.floor(rand(k * 3.1) * CLOTH.length)] });
      head.push({ p: [x, 1.38 * h + 0.08, z], s: [1, 1, 1], c: SKIN[Math.floor(rand(k * 5.3) * SKIN.length)] });
      if (opt.tie || rand(k * 7.7) < 0.4) tie.push({ p: [x, 1.38 * h + 0.2, z], s: [1, 1, 1], ry, c: CLOTH[Math.floor(rand(k * 9.9) * CLOTH.length)] });
      if (opt.tray) tray.push({ p: [x, 1.38 * h + 0.3, z], s: [1, 1, 1], c: ["#c0c0c0", "#e8590c", "#2f9e44"][k % 3] });
    };
    W.sidewalks.forEach((L, li) => {
      // centre of block to know outward direction
      const cx = (L[0].x + L[2].x) / 2, cz = (L[0].z + L[2].z) / 2;
      for (let e = 0; e < 4; e++) {
        const a = L[e], b = L[(e + 1) % 4];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len;
        // outward normal (toward road)
        let nx = -dz, nz = dx;
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        if ((mx + nx - cx) ** 2 + (mz + nz - cz) ** 2 < (mx - cx) ** 2 + (mz - cz) ** 2) { nx = -nx; nz = -nz; }
        const ry = Math.atan2(nx, nz);
        for (let t = 5; t < len - 5; t += 3.2) {
          const r = rand(seed++);
          const x = a.x + dx * t, z = a.z + dz * t;
          if (Math.abs(((t - 9) % 28)) < 1.6) continue; // keep clear around utility poles
          if (onRoad(x, z) || onRoad(x + nx * 1.2, z + nz * 1.2, 0.6)) continue;
          // general sidewalk crowd — Lagos density
          if (rand(seed * 13.3) < 0.55) person(x + dx * 1.4 - nx * (0.2 + rand(seed * 2.9) * 1.6), z + dz * 1.4 - nz * (0.2 + rand(seed * 2.9) * 1.6), rand(seed * 4.1) * 6.28, seed * 17, { tray: rand(seed * 6.6) < 0.18 });
          if (r < 0.2) {
            // trader table + umbrella + goods
            const ux = x + nx * 0.6, uz = z + nz * 0.6;
            table.push({ p: [x - nx * 0.6, 0.55, z - nz * 0.6], s: [1.8, 0.08, 0.9], ry });
            table.push({ p: [x - nx * 0.6, 0.28, z - nz * 0.6], s: [1.6, 0.5, 0.06], ry });
            for (let k = 0; k < 4; k++) goods.push({ p: [x - nx * 0.6 + dx * (k - 1.5) * 0.4, 0.72, z - nz * 0.6 + dz * (k - 1.5) * 0.4], s: [0.34, 0.26 + rand(seed + k) * 0.2, 0.5], ry, c: GOODS[Math.floor(rand(seed + k * 3) * GOODS.length)] });
            rod.push({ p: [ux, 0.15, uz], s: [1, 2.2, 1] });
            umb.push({ p: [ux, 2.15, uz], s: [1.5, 1, 1.5], ry: r * 6, c: BRANDS[Math.floor(rand(seed * 1.7) * BRANDS.length)] });
            person(x - nx * 1.5, z - nz * 1.5, ry, seed * 19, { tie: true, sit: rand(seed * 3.3) < 0.5 }); // trader
            const nb = 1 + Math.floor(rand(seed * 8.1) * 3);
            for (let k = 0; k < nb; k++) person(x + dx * (k - 1) * 0.7 + nx * 0.25, z + dz * (k - 1) * 0.7 + nz * 0.25, ry + Math.PI, seed * 23 + k); // buyers
          } else if (r < 0.3) {
            // stacked crates / basins
            const h = 1 + Math.floor(rand(seed * 2.3) * 3);
            for (let k = 0; k < h; k++) crate.push({ p: [x - nx * 0.9, 0.3 + k * 0.5, z - nz * 0.9], s: [0.7, 0.48, 0.5], ry: ry + (rand(seed + k) - 0.5) * 0.3, c: ["#c0392b", "#1f6feb", "#f1c40f", "#8a6a43"][Math.floor(rand(seed * 5 + k) * 4)] });
            for (let k = 0; k < 5; k++) basin.push({ p: [x - nx * 0.9 + dx * 0.9, 0.25 + k * 0.12, z - nz * 0.9 + dz * 0.9], s: [1, 1, 1], c: GOODS[(li + k) % GOODS.length] });
          } else if (r < 0.37) {
            // caged "I-pass-my-neighbour" generator
            const gx = x - nx * 1.1, gz = z - nz * 1.1;
            gen.push({ p: [gx, 0.45, gz], s: [0.8, 0.6, 0.55], ry, c: rand(seed * 9) < 0.5 ? "#d62828" : "#f2c230" });
            gen.push({ p: [gx, 0.85, gz], s: [0.5, 0.2, 0.35], ry, c: "#222" });
            cage.push({ p: [gx, 0.65, gz], s: [1.1, 1.3, 0.85], ry });
            exhaust.push({ p: [gx + dx * 0.45, 0.55, gz + dz * 0.45], s: [0.16, 0.12, 0.12], ry });
          } else if (r < 0.41) {
            // POS kiosk under umbrella
            kiosk.push({ p: [x, 0.6, z], s: [1.2, 1.1, 0.8], ry });
            kioskTop.push({ p: [x + nx * 0.41, 0.75, z + nz * 0.41], s: [1.1, 0.55, 1], ry });
            rod.push({ p: [x, 0.15, z], s: [1, 2.3, 1] });
            umb.push({ p: [x, 2.25, z], s: [1.4, 1, 1.4], c: "#ffcb05" });
            person(x - nx * 0.75, z - nz * 0.75, ry, seed * 29, { sit: true }); // POS operator
            for (let k = 0; k < 3; k++) person(x + nx * 0.55 + dx * (k * 0.6 - 0.3) , z + nz * 0.55 + dz * (k * 0.6 - 0.3), ry + Math.PI, seed * 31 + k); // queue
          } else if (r < 0.43) {
            // shopfront trader with customers
            person(x - nx * 1.7, z - nz * 1.7, ry, seed * 37, { tie: true });
            person(x - nx * 1.0, z - nz * 1.0, ry + Math.PI, seed * 41);
          } else if (r < 0.46) {
            signList.push({ p: [x - nx * 1.2, 1.8, z - nz * 1.2], ry, k: Math.floor(rand(seed * 11) * SIGNS.length) });
            rod.push({ p: [x - nx * 1.2 - dx * 0.8, 0, z - nz * 1.2 - dz * 0.8], s: [1, 2.3, 1] });
            rod.push({ p: [x - nx * 1.2 + dx * 0.8, 0, z - nz * 1.2 + dz * 0.8], s: [1, 2.3, 1] });
          }
        }
      }
    });
    // PVC down-pipes from roof tanks on low buildings
    for (const b of W.buildings) {
      if (b.h >= 60 || b.heritage) continue;
      const x = b.maxX + 0.08, z = (b.minZ + b.maxZ) / 2 - (b.maxZ - b.minZ) * 0.25;
      pipe.push({ p: [x, b.h / 2, z], s: [0.12, b.h, 0.12] });
    }
    // sagging NEPA cables between consecutive poles
    const wires: number[] = [];
    const P = W.poles;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1];
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d > 34 || d < 4) continue;
      for (const [off, sag] of [[0, 1.4], [0.5, 1.9], [-0.5, 1.1]] as const) {
        const ox = (b.z - a.z) / d * off, oz = -(b.x - a.x) / d * off;
        let px = a.x + ox, py = 8.4, pz = a.z + oz;
        for (let k = 1; k <= 10; k++) {
          const t = k / 10;
          const x = a.x + (b.x - a.x) * t + ox, z = a.z + (b.z - a.z) * t + oz;
          const y = 8.4 - sag * 4 * t * (1 - t);
          wires.push(px, py, pz, x, y, z);
          px = x; py = y; pz = z;
        }
      }
    }
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute("position", new THREE.Float32BufferAttribute(wires, 3));
    return { body, head, tie, tray, umb, rod, table, goods, crate, basin, gen, cage, exhaust, kiosk, kioskTop, pipe, signList, wireGeo };
  }, [W]);

  const byKind = useMemo(() => SIGNS.map((_, k) => D.signList.filter((s) => s.k === k).map((s) => ({ p: s.p, s: [2, 0.75, 0.05] as [number, number, number], ry: s.ry }))), [D]);

  return (
    <group>
      <Inst items={D.body} geo={geo.body} mat={mat.goods} />
      <Inst items={D.head} geo={geo.head} mat={mat.goods} cast={false} />
      <Inst items={D.tie} geo={geo.tie} mat={mat.goods} cast={false} />
      <Inst items={D.tray} geo={geo.tray} mat={mat.goods} cast={false} />
      <Inst items={D.umb} geo={geo.umb} mat={mat.umb} />
      <Inst items={D.rod} geo={geo.rod} mat={mat.metal} cast={false} />
      <Inst items={D.table} geo={geo.box} mat={mat.wood} />
      <Inst items={D.goods} geo={geo.box} mat={mat.goods} />
      <Inst items={D.crate} geo={geo.box} mat={mat.crate} />
      <Inst items={D.basin} geo={geo.basin} mat={mat.goods} cast={false} />
      <Inst items={D.gen} geo={geo.box} mat={mat.gen} />
      <Inst items={D.cage} geo={geo.cage} mat={mat.cage} cast={false} />
      <Inst items={D.exhaust} geo={geo.box} mat={mat.metal} cast={false} />
      <Inst items={D.kiosk} geo={geo.box} mat={mat.metal} />
      <Inst items={D.kioskTop} geo={geo.box} mat={posMat} cast={false} />
      <Inst items={D.pipe} geo={geo.box} mat={mat.pipe} cast={false} />
      {byKind.map((items, k) => <Inst key={k} items={items} geo={geo.box} mat={signs[k]} />)}
      <lineSegments geometry={D.wireGeo}>
        <lineBasicMaterial color="#111111" />
      </lineSegments>
    </group>
  );
}
