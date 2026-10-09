import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Car } from "./types";

/** Procedural Lagos public-transport fleet with painted canvas liveries: Danfo, BRT, Keke Napep, Okada. Models face +Z. */

const texCache = new Map<string, THREE.Texture>();
function livery(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}
const text = (g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string) => {
  g.fillStyle = color; g.font = `900 ${size}px Bungee, Impact, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(s, x, y);
};
const ROUTES = ["CMS - OBALENDE", "OSHODI - OYINGBO", "IDUMOTA - MILE 2", "IKEJA - OJOTA", "TBS - LEKKI", "YABA - CMS"];
const QUOTES = ["GOD DEY", "NO CONDITION IS PERMANENT", "EKO O NI BAJE", "ALHAMDULILLAHI", "BLESSED", "ONE CHANCE NO"];

function danfoSide(v: number) {
  return livery("danfo" + v, 512, 192, (g) => {
    g.fillStyle = "#f6c600"; g.fillRect(0, 0, 512, 192);
    g.fillStyle = "#1c2630"; g.fillRect(20, 14, 472, 64);
    g.fillStyle = "#f6c600"; for (const x of [130, 250, 370]) g.fillRect(x, 14, 8, 64);
    g.fillStyle = "rgba(255,255,255,0.15)"; g.fillRect(24, 18, 100, 10);
    g.fillStyle = "#111"; g.fillRect(0, 96, 512, 10); g.fillRect(0, 116, 512, 10);
    g.fillStyle = "#c79e00"; g.fillRect(200, 84, 4, 100);
    text(g, ROUTES[v % ROUTES.length], 256, 152, 26, "#111");
    g.fillStyle = "rgba(120,80,30,0.35)"; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 512, 170 + Math.random() * 22, 6, 3);
  });
}
function danfoBack(v: number) {
  return livery("danfob" + v, 256, 192, (g) => {
    g.fillStyle = "#f6c600"; g.fillRect(0, 0, 256, 192);
    g.fillStyle = "#1c2630"; g.fillRect(30, 14, 196, 60);
    g.fillStyle = "#111"; g.fillRect(0, 96, 256, 10); g.fillRect(0, 116, 256, 10);
    text(g, QUOTES[v % QUOTES.length], 128, 150, 20, "#c1121f");
    g.fillStyle = "#b0121b"; g.fillRect(8, 136, 18, 30); g.fillRect(230, 136, 18, 30);
  });
}
function brtSide(v: number) {
  return livery("brt" + (v % 2), 1024, 192, (g) => {
    const blue = v % 2 ? "#c1121f" : "#1d4ed8";
    g.fillStyle = "#f2f2f2"; g.fillRect(0, 0, 1024, 192);
    g.fillStyle = "#111a22"; g.fillRect(10, 20, 1004, 70);
    g.fillStyle = "#f2f2f2"; for (let x = 120; x < 1000; x += 120) g.fillRect(x, 20, 5, 70);
    g.fillStyle = blue; g.fillRect(0, 96, 1024, 60);
    g.fillStyle = "#ffcc00"; g.fillRect(0, 156, 1024, 8);
    text(g, "LAGBUS · BRT", 400, 126, 38, "#fff");
    text(g, "LAMATA", 820, 126, 28, "#ffcc00");
    g.fillStyle = "#2b2b2b"; g.fillRect(160, 20, 70, 160); g.fillRect(620, 20, 70, 160);
    g.fillStyle = "#4a6070"; g.fillRect(166, 26, 27, 148); g.fillRect(197, 26, 27, 148); g.fillRect(626, 26, 27, 148); g.fillRect(657, 26, 27, 148);
  });
}
function brtFront(v: number) {
  return livery("brtf" + (v % 2), 256, 256, (g) => {
    g.fillStyle = v % 2 ? "#c1121f" : "#1d4ed8"; g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#000"; g.fillRect(10, 6, 236, 28);
    text(g, "BRT  CMS-IKORODU", 128, 21, 16, "#ff9f1c");
    g.fillStyle = "#111a22"; g.fillRect(10, 40, 236, 110);
    g.fillStyle = "#fff8d0"; g.fillRect(16, 196, 40, 18); g.fillRect(200, 196, 40, 18);
    g.fillStyle = "#ddd"; g.fillRect(90, 200, 76, 22);
  });
}
function kekeSide(v: number) {
  return livery("keke" + v, 256, 128, (g) => {
    g.fillStyle = "#1f9d55"; g.fillRect(0, 0, 256, 128);
    g.fillStyle = "#f6c600"; g.fillRect(0, 0, 256, 16); g.fillRect(0, 112, 256, 16);
    text(g, QUOTES[v % QUOTES.length], 128, 64, 20, "#fff");
    text(g, `LAG ${100 + (v * 37) % 899} KK`, 128, 92, 14, "#f6c600");
  });
}

const M = new Map<string, THREE.Material>();
const mat = (c: string, metal = 0, rough = 0.7) => {
  const k = c + metal + rough;
  let m = M.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, metalness: metal, roughness: rough }); M.set(k, m); }
  return m;
};
const tmat = (t: THREE.Texture) => {
  const k = t.uuid;
  let m = M.get(k);
  if (!m) { m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.1 }); M.set(k, m); }
  return m;
};

/** Mid-poly: boxes get bevelled edges (cached RoundedBoxGeometry), wheels get tyre/rim/spokes/hub. */
const G = new Map<string, THREE.BufferGeometry>();
function rbox(s: [number, number, number]) {
  const k = s.join(",");
  let g: THREE.BufferGeometry | undefined = G.get(k);
  if (!g) {
    const min = Math.min(...s);
    g = min < 0.08 ? new THREE.BoxGeometry(...s) : new RoundedBoxGeometry(s[0], s[1], s[2], 3, Math.min(0.12, min * 0.18));
    G.set(k, g);
  }
  return g!;
}
function Bx({ s, p, m, r }: { s: [number, number, number]; p: [number, number, number]; m: THREE.Material; r?: [number, number, number] }) {
  return <mesh position={p} rotation={r ?? [0, 0, 0]} material={m} geometry={rbox(s)} castShadow />;
}
function Pl({ s, p, ry, m }: { s: [number, number]; p: [number, number, number]; ry: number; m: THREE.Material }) {
  return <mesh position={p} rotation-y={ry} material={m}><planeGeometry args={s} /></mesh>;
}
function Wheel({ p, r = 0.42, w = 0.3 }: { p: [number, number, number]; r?: number; w?: number }) {
  const rubber = mat("#151515", 0, 0.9), rim = mat("#b8bcc0", 0.8, 0.3), dark = mat("#3a3d40", 0.6, 0.4);
  return (
    <group position={p}>
      <mesh rotation-z={Math.PI / 2} material={rubber} castShadow><cylinderGeometry args={[r * 0.92, r * 0.92, w, 32]} /></mesh>
      <mesh rotation-y={Math.PI / 2} material={rubber}><torusGeometry args={[r * 0.82, r * 0.18, 10, 32]} /></mesh>
      <mesh rotation-z={Math.PI / 2} material={dark}><cylinderGeometry args={[r * 0.6, r * 0.6, w + 0.01, 24]} /></mesh>
      {[-1, 1].map((sd) => (
        <group key={sd} position={[sd * (w / 2 + 0.01), 0, 0]}>
          <mesh rotation-z={Math.PI / 2} material={rim}><cylinderGeometry args={[r * 0.15, r * 0.15, 0.04, 16]} /></mesh>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} rotation-x={(i / 5) * Math.PI * 2} material={rim}><boxGeometry args={[0.02, r * 0.95, r * 0.12]} /></mesh>
          ))}
          <mesh rotation-y={Math.PI / 2} material={rim}><torusGeometry args={[r * 0.55, r * 0.05, 6, 24]} /></mesh>
        </group>
      ))}
    </group>
  );
}
function Mirror({ p, side }: { p: [number, number, number]; side: 1 | -1 }) {
  return (
    <group position={p}>
      <Bx s={[0.22, 0.03, 0.03]} p={[side * 0.11, 0, 0]} m={mat("#222")} />
      <Bx s={[0.06, 0.22, 0.14]} p={[side * 0.24, 0, 0]} m={mat("#222")} />
      <Bx s={[0.01, 0.18, 0.11]} p={[side * 0.24, 0, -0.075]} m={mat("#cfe3ef", 1, 0.05)} />
    </group>
  );
}
function Seats({ w, z0, rows, y, gap = 0.9, c = "#5a2e1e" }: { w: number; z0: number; rows: number; y: number; gap?: number; c?: string }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <group key={i} position={[0, y, z0 - i * gap]}>
          <Bx s={[w, 0.12, 0.45]} p={[0, 0, 0]} m={mat(c)} />
          <Bx s={[w, 0.5, 0.1]} p={[0, 0.3, -0.2]} m={mat(c)} />
        </group>
      ))}
    </>
  );
}
const GLASS = () => mat("#1c2630", 0.4, 0.15);

function Danfo({ v }: { v: number }) {
  const side = tmat(danfoSide(v)), back = tmat(danfoBack(v));
  const y = mat("#f6c600", 0.1, 0.5);
  return (
    <>
      <Bx s={[2.1, 1.85, 4.9]} p={[0, 1.4, 0]} m={y} />
      <Pl s={[4.9, 1.85]} p={[1.051, 1.4, 0]} ry={Math.PI / 2} m={side} />
      <Pl s={[4.9, 1.85]} p={[-1.051, 1.4, 0]} ry={-Math.PI / 2} m={side} />
      <Pl s={[2.1, 1.85]} p={[0, 1.4, -2.451]} ry={Math.PI} m={back} />
      {/* flat VW T3 nose + windscreen */}
      <Bx s={[1.9, 0.75, 0.05]} p={[0, 1.85, 2.46]} m={GLASS()} />
      <Bx s={[2.12, 0.3, 0.2]} p={[0, 0.6, 2.5]} m={mat("#2a2a2a")} />
      <Bx s={[0.3, 0.18, 0.04]} p={[0.75, 1.0, 2.46]} m={mat("#fff6c0")} />
      <Bx s={[0.3, 0.18, 0.04]} p={[-0.75, 1.0, 2.46]} m={mat("#fff6c0")} />
      {/* roof rack with loads */}
      <Bx s={[1.9, 0.06, 3.4]} p={[0, 2.42, -0.4]} m={mat("#333", 0.6, 0.4)} />
      <Bx s={[0.9, 0.45, 0.9]} p={[-0.4, 2.7, -0.9]} m={mat("#8b5a2b")} />
      <Bx s={[0.7, 0.35, 1.1]} p={[0.45, 2.63, 0.2]} m={mat("#2a9d8f")} />
      {/* open sliding door + conductor */}
      <Bx s={[0.04, 1.4, 1.0]} p={[1.07, 1.25, 0.6]} m={mat("#111")} />
      <Bx s={[0.35, 0.8, 0.3]} p={[1.25, 1.55, 0.6]} m={mat("#e63946")} />
      <Bx s={[0.25, 0.25, 0.25]} p={[1.25, 2.1, 0.6]} m={mat("#6b4226")} />
      <Mirror p={[1.05, 1.9, 2.3]} side={1} /><Mirror p={[-1.05, 1.9, 2.3]} side={-1} />
      <Seats w={1.8} z0={1.6} rows={4} y={0.85} />
      <Bx s={[0.5, 0.4, 0.4]} p={[0.5, 1.15, 2.15]} m={mat("#222")} />
      <mesh position={[0.5, 1.45, 1.95]} rotation-x={-1.1} material={mat("#111")}><torusGeometry args={[0.18, 0.025, 8, 24]} /></mesh>
      <Bx s={[2.15, 0.25, 0.2]} p={[0, 0.55, -2.5]} m={mat("#2a2a2a")} />
      <Wheel p={[1.0, 0.42, 1.55]} /><Wheel p={[-1.0, 0.42, 1.55]} /><Wheel p={[1.0, 0.42, -1.55]} /><Wheel p={[-1.0, 0.42, -1.55]} />
    </>
  );
}

function Brt({ v }: { v: number }) {
  const side = tmat(brtSide(v)), front = tmat(brtFront(v));
  return (
    <>
      <Bx s={[2.55, 3.0, 11.8]} p={[0, 1.85, 0]} m={mat("#f2f2f2", 0.1, 0.4)} />
      <Pl s={[11.8, 3.0]} p={[1.276, 1.85, 0]} ry={Math.PI / 2} m={side} />
      <Pl s={[11.8, 3.0]} p={[-1.276, 1.85, 0]} ry={-Math.PI / 2} m={side} />
      <Pl s={[2.55, 3.0]} p={[0, 1.85, 5.901]} ry={0} m={front} />
      <Pl s={[2.55, 3.0]} p={[0, 1.85, -5.901]} ry={Math.PI} m={front} />
      <Bx s={[1.8, 0.35, 3.0]} p={[0, 3.5, -2]} m={mat("#cfcfcf", 0.4, 0.4)} />
      <Mirror p={[1.28, 2.6, 5.7]} side={1} /><Mirror p={[-1.28, 2.6, 5.7]} side={-1} />
      <Seats w={2.2} z0={4.2} rows={10} y={0.95} gap={0.95} c="#1d3a6b" />
      <Bx s={[2.6, 0.3, 0.25]} p={[0, 0.45, 5.95]} m={mat("#333")} />
      <Bx s={[2.6, 0.3, 0.25]} p={[0, 0.45, -5.95]} m={mat("#333")} />
      {[4.3, -3.6, -4.8].map((z) => [1.15, -1.15].map((x) => <Wheel key={`${x}${z}`} p={[x, 0.5, z]} r={0.5} w={0.35} />))}
    </>
  );
}

function Keke({ v }: { v: number }) {
  const side = tmat(kekeSide(v));
  const g = mat("#1f9d55", 0.1, 0.5), yel = mat("#f6c600", 0.1, 0.5), chrome = mat("#c8cdd2", 0.9, 0.25);
  return (
    <>
      <Bx s={[1.3, 0.6, 1.9]} p={[0, 0.7, -0.25]} m={g} />
      <Pl s={[1.9, 0.6]} p={[0.651, 0.7, -0.25]} ry={Math.PI / 2} m={side} />
      <Pl s={[1.9, 0.6]} p={[-0.651, 0.7, -0.25]} ry={-Math.PI / 2} m={side} />
      <Bx s={[0.85, 1.0, 0.6]} p={[0, 0.95, 1.0]} m={g} />
      <Bx s={[0.95, 0.55, 0.04]} p={[0, 1.7, 1.2]} m={GLASS()} />
      <Bx s={[1.45, 0.1, 2.5]} p={[0, 2.05, 0]} m={yel} />
      <Bx s={[1.45, 0.95, 0.06]} p={[0, 1.55, -1.2]} m={mat("#111")} />
      {([[-0.66, 1.1], [0.66, 1.1], [-0.66, -1.15], [0.66, -1.15], [-0.66, 0], [0.66, 0]] as const).map(([x, z], i) => (
        <Bx key={i} s={[0.05, 1.1, 0.05]} p={[x, 1.5, z]} m={chrome} />
      ))}
      <Bx s={[1.15, 0.45, 0.55]} p={[0, 1.2, -0.65]} m={mat("#2b2b2b")} />
      <Bx s={[0.25, 0.7, 0.3]} p={[0, 1.4, 0.7]} m={mat("#457b9d")} />
      <Bx s={[0.22, 0.22, 0.22]} p={[0, 1.88, 0.7]} m={mat("#6b4226")} />
      <Bx s={[0.6, 0.06, 0.06]} p={[0, 1.35, 1.1]} m={chrome} />
      <Bx s={[0.22, 0.15, 0.04]} p={[0, 1.15, 1.31]} m={mat("#fff6c0")} />
      <Mirror p={[0.35, 1.38, 1.1]} side={1} /><Mirror p={[-0.35, 1.38, 1.1]} side={-1} />
      <Wheel p={[0, 0.3, 1.15]} r={0.3} w={0.15} /><Wheel p={[0.62, 0.3, -0.75]} r={0.3} w={0.18} /><Wheel p={[-0.62, 0.3, -0.75]} r={0.3} w={0.18} />
    </>
  );
}

const VESTS = ["#ff7a00", "#2ecc71", "#f6c600", "#e63946"];
function Okada({ v }: { v: number }) {
  const body = mat(["#c1121f", "#111", "#1d4ed8"][v % 3], 0.3, 0.4), chrome = mat("#c8cdd2", 0.9, 0.25), skin = mat("#5a3a22");
  return (
    <>
      <Bx s={[0.3, 0.35, 0.9]} p={[0, 0.75, 0.05]} m={body} />
      <Bx s={[0.34, 0.12, 0.85]} p={[0, 0.98, -0.25]} m={mat("#1a1a1a")} />
      <Bx s={[0.25, 0.3, 0.4]} p={[0, 0.5, 0.15]} m={mat("#555", 0.6, 0.4)} />
      <Bx s={[0.06, 0.06, 0.6]} p={[0.15, 0.4, -0.45]} m={chrome} />
      <Bx s={[0.05, 0.75, 0.05]} p={[0, 0.85, 0.75]} m={chrome} r={[-0.35, 0, 0]} />
      <Bx s={[0.7, 0.04, 0.04]} p={[0, 1.2, 0.62]} m={chrome} />
      <Bx s={[0.3, 0.25, 0.15]} p={[0, 1.08, 0.82]} m={body} />
      <Bx s={[0.16, 0.12, 0.04]} p={[0, 1.08, 0.9]} m={mat("#fff6c0")} />
      <Bx s={[0.5, 0.04, 0.4]} p={[0, 0.95, -0.85]} m={mat("#333")} />
      {/* rider in reflective vest */}
      <Bx s={[0.42, 0.6, 0.28]} p={[0, 1.45, 0.05]} m={mat(VESTS[v % VESTS.length])} r={[0.25, 0, 0]} />
      <Bx s={[0.26, 0.28, 0.26]} p={[0, 1.9, 0.15]} m={skin} />
      {v % 2 === 0 && <Bx s={[0.3, 0.2, 0.3]} p={[0, 2.08, 0.15]} m={mat("#222", 0.3, 0.3)} />}
      <Bx s={[0.12, 0.12, 0.55]} p={[0.2, 1.4, 0.4]} m={skin} />
      <Bx s={[0.12, 0.12, 0.55]} p={[-0.2, 1.4, 0.4]} m={skin} />
      <Bx s={[0.14, 0.5, 0.14]} p={[0.2, 0.75, 0.25]} m={mat("#2b2d42")} />
      <Bx s={[0.14, 0.5, 0.14]} p={[-0.2, 0.75, 0.25]} m={mat("#2b2d42")} />
      {v % 3 !== 0 && (
        <>
          <Bx s={[0.4, 0.55, 0.26]} p={[0, 1.4, -0.45]} m={mat(["#8338ec", "#2a9d8f", "#fb5607"][v % 3])} />
          <Bx s={[0.24, 0.26, 0.24]} p={[0, 1.82, -0.42]} m={skin} />
        </>
      )}
      <Wheel p={[0, 0.33, 0.72]} r={0.33} w={0.12} /><Wheel p={[0, 0.33, -0.62]} r={0.33} w={0.14} />
    </>
  );
}

export function LagosVehicle({ car }: { car: Car }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    car.obj = ref.current;
    car.lights = [];
  }, [car]);
  const v = car.id;
  const body = useMemo(() => {
    if (car.type === "danfo") return <Danfo v={v} />;
    if (car.type === "brt") return <Brt v={v} />;
    if (car.type === "okada") return <Okada v={v} />;
    return <Keke v={v} />;
  }, [car.type, v]);
  return <group ref={ref} visible={car.active}>{body}</group>;
}
