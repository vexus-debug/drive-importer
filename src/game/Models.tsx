import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Car, GameState, Ped } from "./types";
import { CANAL, DIAGONALS, FLYOVER_Z, IKOYI, LINES, MARINA_CURVE, type World } from "./world";
import { Buildings } from "./Buildings";
import { Architecture } from "./Architecture";
import { OldTown } from "./OldTown";
import { asphalt, facade, ground, pavement, worldUVFacade } from "./textures";

const mats = new Map<string, THREE.MeshLambertMaterial>();
function mat(color: string) {
  let m = mats.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    mats.set(color, m);
  }
  return m;
}

function B({ s, p, c, r }: { s: [number, number, number]; p: [number, number, number]; c: string; r?: [number, number, number] }) {
  return (
    <mesh position={p} rotation={r ?? [0, 0, 0]} material={mat(c)} castShadow>
      <boxGeometry args={s} />
    </mesh>
  );
}

function Wheel({ p, rad = 0.42 }: { p: [number, number, number]; rad?: number }) {
  return (
    <mesh position={p} rotation={[0, 0, Math.PI / 2]} material={mat("#1b1b1b")}>
      <cylinderGeometry args={[rad, rad, 0.3, 8]} />
    </mesh>
  );
}

function makeSign(text: string, bg: string, fg: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 192;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 192);
  g.strokeStyle = fg;
  g.lineWidth = 10;
  g.strokeRect(10, 10, 492, 172);
  g.fillStyle = fg;
  let size = 72;
  g.font = `900 ${size}px Bungee, Impact, sans-serif`;
  while (g.measureText(text).width > 460 && size > 20) g.font = `900 ${(size -= 4)}px Bungee, Impact, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 256, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function windowTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = "#6b7a86";
  for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) g.fillRect(6 + x * 15, 8 + y * 15, 8, 9);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function WorldMesh({ W }: { W: World }) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const tableRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const signs = useMemo(() => W.billboards.map((b) => makeSign(b.text, b.bg, b.fg)), [W]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), col = new THREE.Color();
    const e = new THREE.Euler();
    W.palms.forEach((p, i) => {
      const lean = ((i * 37) % 10) / 60;
      trunkRef.current!.setMatrixAt(i, m.compose(v.set(p.x, 3.5, p.z), q.setFromEuler(e.set(lean, i, 0)), s.set(1, 1, 1)));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + i;
        q.setFromEuler(e.set(0.45, a, 0, "YXZ"));
        const off = new THREE.Vector3(0, 0, 1.4).applyQuaternion(q);
        leafRef.current!.setMatrixAt(i * 6 + k, m.compose(v.set(p.x + off.x + lean * 3, 7 + off.y * -0.3, p.z + off.z), q, s.set(1, 1, 1)));
      }
    });
    trunkRef.current!.instanceMatrix.needsUpdate = true;
    leafRef.current!.instanceMatrix.needsUpdate = true;
    W.stalls.forEach((st, i) => {
      tableRef.current!.setMatrixAt(i, m.compose(v.set(st.x, 0.5, st.z), q.identity(), s.set(1, 1, 1)));
      canopyRef.current!.setMatrixAt(i, m.compose(v.set(st.x, 2.4, st.z), q.setFromEuler(e.set(0.15, 0, 0)), s.set(1, 1, 1)));
      canopyRef.current!.setColorAt(i, col.set(st.color));
    });
    tableRef.current!.instanceMatrix.needsUpdate = true;
    canopyRef.current!.instanceMatrix.needsUpdate = true;
    if (canopyRef.current!.instanceColor) canopyRef.current!.instanceColor.needsUpdate = true;
  }, [W]);

  const T = useMemo(() => {
    const roadH = new THREE.MeshLambertMaterial({ map: asphalt(52, 2) });
    const roadV = new THREE.MeshLambertMaterial({ map: asphalt(2, 52) });
    const bridge = new THREE.MeshLambertMaterial({ map: asphalt(2, 26) });
    const walk = new THREE.MeshLambertMaterial({ map: pavement(20, 20) });
    const lot = new THREE.MeshLambertMaterial({ map: ground(10, 10, "#9c9a72", ["#7d8a4f", "#b3a77c", "#6f7a45", "#c2b48a"]) });
    const dirt = new THREE.MeshLambertMaterial({ map: ground(10, 10, "#b98b5e", ["#9a6e45", "#cfa478", "#7f5a38"]) });
    const sand = new THREE.MeshLambertMaterial({ map: ground(40, 40, "#e8d3a0", ["#d4bc86", "#f4e4bc", "#c7ad78"]) });
    const fac = new THREE.MeshStandardMaterial({ map: facade(), roughness: 0.75, metalness: 0.05 });
    worldUVFacade(fac);
    return { roadH, roadV, bridge, walk, lot, dirt, sand, fac };
  }, []);
  return (
    <group>
      {/* water + land */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.3, 0]}>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color="#1f8aa0" roughness={0.12} metalness={0.3} />
      </mesh>
      <mesh position={[0, -1.5, 0]} receiveShadow material={mat("#c9b089")}>
        <boxGeometry args={[430, 3, 430]} />
      </mesh>
      <mesh position={[0, -0.5, 211]} receiveShadow material={T.sand}>
        <boxGeometry args={[430, 1.02, 8]} />
      </mesh>
      <mesh position={[0, -1.5, 467]} receiveShadow material={T.sand}>
        <boxGeometry args={[120, 3, 100]} />
      </mesh>
      <MarinaCurve road={T.roadH} />
      <group position={[0, 0.13, 0]}>{DIAGONALS.map((d) => <MarinaCurve key={d.name} road={T.roadH} pts={d.pts} land={false} />)}</group>
      {/* blocks */}
      {W.blocks.map((b, i) => (
        <group key={i}>
          <mesh position={[(b.minX + b.maxX) / 2, 0.06, (b.minZ + b.maxZ) / 2]} receiveShadow material={T.walk}>
            <boxGeometry args={[b.maxX - b.minX, 0.12, b.maxZ - b.minZ]} />
          </mesh>
          <mesh position={[(b.minX + b.maxX) / 2, 0.08, (b.minZ + b.maxZ) / 2]} receiveShadow material={i === 7 ? T.dirt : T.lot}>
            <boxGeometry args={[b.maxX - b.minX - 8, 0.13, b.maxZ - b.minZ - 8]} />
          </mesh>
        </group>
      ))}
      {/* roads */}
      {LINES.map((v) => (
        <group key={v}>
          <mesh position={[0, 0.02, v]} receiveShadow material={T.roadH}><boxGeometry args={[416, 0.04, 16]} /></mesh>
          <mesh position={[v, 0.021, 0]} receiveShadow material={T.roadV}><boxGeometry args={[16, 0.04, 416]} /></mesh>
          <mesh position={[0, 0.045, v]} material={mat("#f2c230")}><boxGeometry args={[416, 0.01, 0.35]} /></mesh>
          <mesh position={[v, 0.046, 0]} material={mat("#f2c230")}><boxGeometry args={[0.35, 0.01, 416]} /></mesh>
          {[-7.3, 7.3].map((o) => (
            <group key={o}>
              <mesh position={[0, 0.045, v + o]} material={mat("#eeeeee")}><boxGeometry args={[416, 0.01, 0.25]} /></mesh>
              <mesh position={[v + o, 0.045, 0]} material={mat("#eeeeee")}><boxGeometry args={[0.25, 0.01, 416]} /></mesh>
            </group>
          ))}
        </group>
      ))}
      {/* bridge */}
      <mesh position={[0, -0.2, 316]} receiveShadow material={T.bridge}><boxGeometry args={[16, 0.5, 210]} /></mesh>
      <mesh position={[0, 0.06, 316]} material={mat("#f2c230")}><boxGeometry args={[0.35, 0.01, 210]} /></mesh>
      <mesh position={[0, 0.02, 450]} receiveShadow material={T.roadV}><boxGeometry args={[16, 0.04, 64]} /></mesh>
      {[-8.4, 8.4].map((x) => (
        <mesh key={x} position={[x, 0.5, 316]} material={mat("#e6e1d3")} castShadow><boxGeometry args={[0.6, 1, 208]} /></mesh>
      ))}
      {Array.from({ length: 11 }, (_, i) => (
        <mesh key={i} position={[0, -1.4, 220 + i * 20]} material={mat("#bdb5a4")}><boxGeometry args={[12, 2.4, 2]} /></mesh>
      ))}
      {/* Eko Bridge to Ikoyi */}
      <mesh position={[231, -0.2, 0]} receiveShadow material={T.roadH}><boxGeometry args={[40, 0.5, 16]} /></mesh>
      {[-8.4, 8.4].map((z) => (
        <mesh key={z} position={[231, 0.5, z]} material={mat("#e6e1d3")} castShadow><boxGeometry args={[40, 1, 0.6]} /></mesh>
      ))}
      {[218, 231, 244].map((x) => (
        <mesh key={x} position={[x, -1.4, 0]} material={mat("#bdb5a4")}><boxGeometry args={[2, 2.4, 12]} /></mesh>
      ))}
      {/* Ikoyi land split by canal */}
      <mesh position={[(IKOYI.x0 + IKOYI.x1) / 2, -1.5, (IKOYI.z0 + CANAL.z0) / 2]} receiveShadow material={mat("#c9b089")}>
        <boxGeometry args={[IKOYI.x1 - IKOYI.x0, 3, CANAL.z0 - IKOYI.z0]} />
      </mesh>
      <mesh position={[(IKOYI.x0 + IKOYI.x1) / 2, -1.5, (CANAL.z1 + IKOYI.z1) / 2]} receiveShadow material={mat("#c9b089")}>
        <boxGeometry args={[IKOYI.x1 - IKOYI.x0, 3, IKOYI.z1 - CANAL.z1]} />
      </mesh>
      {[CANAL.z0 - 0.3, CANAL.z1 + 0.3].map((z) => (
        <mesh key={z} position={[(IKOYI.x0 + IKOYI.x1) / 2, 0.3, z]} material={mat("#8f8a80")}><boxGeometry args={[IKOYI.x1 - IKOYI.x0, 0.6, 0.6]} /></mesh>
      ))}
      {/* Ikoyi roads */}
      {[-108, 0, 108].map((z) => (
        <mesh key={z} position={[330, 0.02, z]} receiveShadow material={T.roadH}><boxGeometry args={[168, 0.04, 16]} /></mesh>
      ))}
      {[254, 330, 406].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.021, (IKOYI.z0 + CANAL.z0) / 2]} receiveShadow material={T.roadV}><boxGeometry args={[16, 0.04, CANAL.z0 - IKOYI.z0]} /></mesh>
          <mesh position={[x, 0.021, (CANAL.z1 + IKOYI.z1) / 2]} receiveShadow material={T.roadV}><boxGeometry args={[16, 0.04, IKOYI.z1 - CANAL.z1]} /></mesh>
          {/* road bridge over the canal */}
          <mesh position={[x, -0.2, (CANAL.z0 + CANAL.z1) / 2]} receiveShadow material={T.bridge}><boxGeometry args={[16, 0.5, CANAL.z1 - CANAL.z0 + 1]} /></mesh>
          {[-8.4, 8.4].map((o) => (
            <mesh key={o} position={[x + o, 0.5, (CANAL.z0 + CANAL.z1) / 2]} material={mat("#e6e1d3")}><boxGeometry args={[0.6, 1, CANAL.z1 - CANAL.z0 + 1]} /></mesh>
          ))}
          <mesh position={[x, 0.046, 0]} material={mat("#f2c230")}><boxGeometry args={[0.35, 0.01, 232]} /></mesh>
        </group>
      ))}
      {/* Victoria Island ring road */}
      {[428, 507].map((z) => (
        <mesh key={z} position={[0, 0.03, z]} receiveShadow material={T.roadH}><boxGeometry args={[108, 0.04, 12]} /></mesh>
      ))}
      {[-46, 46].map((x) => (
        <mesh key={x} position={[x, 0.031, 467.5]} receiveShadow material={T.roadV}><boxGeometry args={[12, 0.04, 91]} /></mesh>
      ))}
      {/* overpass */}
      <mesh position={[0, 9, FLYOVER_Z]} castShadow receiveShadow material={mat("#9c958a")}><boxGeometry args={[300, 1.2, 13]} /></mesh>
      {[-6.2, 6.2].map((o) => (
        <mesh key={o} position={[0, 10, FLYOVER_Z + o]} material={mat("#d9d2c3")}><boxGeometry args={[300, 0.9, 0.5]} /></mesh>
      ))}
      {[1, -1].map((sx) => (
        <group key={sx} position={[sx * 178, 4.2, FLYOVER_Z]} rotation={[0, 0, -sx * Math.atan(9.6 / 56)]}>
          <mesh castShadow receiveShadow material={mat("#9c958a")}><boxGeometry args={[57, 1.2, 13]} /></mesh>
          {[-6.2, 6.2].map((o) => (
            <mesh key={o} position={[0, 1, o]} material={mat("#d9d2c3")}><boxGeometry args={[57, 0.9, 0.5]} /></mesh>
          ))}
        </group>
      ))}
      {W.pillars.map((p, i) => (
        <mesh key={i} position={[p.x, 4.5, p.z]} castShadow material={mat("#b8b1a3")}><boxGeometry args={[1.4, 9, 1.4]} /></mesh>
      ))}
      {/* buildings */}
      <Buildings W={W} />
      <OldTown W={W} />
      <Architecture W={W} />
      <instancedMesh ref={trunkRef} args={[undefined, undefined, W.palms.length]} castShadow>
        <cylinderGeometry args={[0.18, 0.3, 7, 12, 6]} />
        <meshLambertMaterial color="#8a6a45" flatShading />
      </instancedMesh>
      <instancedMesh ref={leafRef} args={[undefined, undefined, W.palms.length * 6]} castShadow>
        <boxGeometry args={[0.9, 0.08, 3, 3, 1, 8]} />
        <meshLambertMaterial color="#3f9b3a" flatShading />
      </instancedMesh>
      <instancedMesh ref={tableRef} args={[undefined, undefined, W.stalls.length]} castShadow>
        <boxGeometry args={[3, 1, 2]} />
        <meshLambertMaterial color="#8b5a2b" flatShading />
      </instancedMesh>
      <instancedMesh ref={canopyRef} args={[undefined, undefined, W.stalls.length]} castShadow>
        <boxGeometry args={[3.6, 0.12, 2.8]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
      {/* billboards */}
      {W.billboards.map((b, i) => (
        <group key={i} position={[b.x, 0, b.z]} rotation-y={b.rot}>
          <B s={[0.3, 9, 0.3]} p={[-3, 4.5, 0]} c="#555" />
          <B s={[0.3, 9, 0.3]} p={[3, 4.5, 0]} c="#555" />
          <mesh position={[0, 10, 0.05]} rotation-y={Math.PI}>
            <planeGeometry args={[10, 3.75]} />
            <meshBasicMaterial map={signs[i] ?? null} toneMapped={false} />
          </mesh>
          <B s={[10.3, 4, 0.1]} p={[0, 10, 0.12]} c="#333" />
        </group>
      ))}
    </group>
  );
}

export function CarModel({ car }: { car: Car }) {
  const ref = useRef<THREE.Group>(null);
  const red = useMemo(() => new THREE.MeshLambertMaterial({ color: "#ff2030", emissive: "#ff0010", emissiveIntensity: 0.1 }), []);
  const blue = useMemo(() => new THREE.MeshLambertMaterial({ color: "#2050ff", emissive: "#0030ff", emissiveIntensity: 0.1 }), []);
  useLayoutEffect(() => {
    car.obj = ref.current;
    car.lights = [red, blue];
  }, [car, red, blue]);
  const glass = "#24313d";
  let body: React.ReactNode;
  if (car.type === "danfo") {
    body = (
      <>
        <B s={[2.2, 1.9, 5]} p={[0, 1.35, 0]} c="#f6c600" />
        <B s={[2.24, 0.62, 3.4]} p={[0, 1.85, -0.4]} c={glass} />
        <B s={[1.95, 0.7, 0.06]} p={[0, 1.8, 2.5]} c={glass} />
        <B s={[2.25, 0.13, 5.02]} p={[0, 1.1, 0]} c="#111" />
        <B s={[2.25, 0.13, 5.02]} p={[0, 0.82, 0]} c="#111" />
        <B s={[2.0, 0.2, 2.4]} p={[0, 2.4, -0.6]} c="#3a3a3a" />
        <B s={[2.25, 0.3, 0.2]} p={[0, 0.6, 2.55]} c="#999" />
        <Wheel p={[1.05, 0.45, 1.6]} /><Wheel p={[-1.05, 0.45, 1.6]} /><Wheel p={[1.05, 0.45, -1.6]} /><Wheel p={[-1.05, 0.45, -1.6]} />
      </>
    );
  } else if (car.type === "keke") {
    body = (
      <>
        <B s={[1.3, 0.7, 2.0]} p={[0, 0.75, -0.2]} c="#1f9d55" />
        <B s={[0.8, 1.0, 0.7]} p={[0, 0.95, 1.05]} c="#1f9d55" />
        <B s={[0.9, 0.6, 0.05]} p={[0, 1.65, 1.2]} c={glass} />
        <B s={[1.45, 0.12, 2.4]} p={[0, 2.05, 0]} c="#f6c600" />
        <B s={[1.45, 0.9, 0.08]} p={[0, 1.6, -1.15]} c="#f6c600" />
        {([[-0.65, 1.0], [0.65, 1.0], [-0.65, -1.1], [0.65, -1.1]] as const).map(([x, z], i) => (
          <B key={i} s={[0.07, 1.1, 0.07]} p={[x, 1.5, z]} c="#222" />
        ))}
        <B s={[1.1, 0.5, 0.6]} p={[0, 1.25, -0.6]} c="#222" />
        <Wheel p={[0, 0.33, 1.15]} rad={0.32} /><Wheel p={[0.65, 0.33, -0.7]} rad={0.32} /><Wheel p={[-0.65, 0.33, -0.7]} rad={0.32} />
      </>
    );
  } else {
    const pol = car.type === "police";
    body = (
      <>
        <B s={[1.9, 0.7, 4.4]} p={[0, 0.72, 0]} c={pol ? "#f4f4f4" : car.color} />
        <B s={[1.7, 0.62, 2.2]} p={[0, 1.38, -0.25]} c={pol ? "#f4f4f4" : car.color} />
        <B s={[1.72, 0.45, 2.0]} p={[0, 1.4, -0.25]} c={glass} />
        {pol && <B s={[1.94, 0.3, 2.4]} p={[0, 0.75, -0.1]} c="#14213d" />}
        {pol && (
          <>
            <mesh position={[-0.35, 1.78, -0.25]} material={red}><boxGeometry args={[0.6, 0.18, 0.35]} /></mesh>
            <mesh position={[0.35, 1.78, -0.25]} material={blue}><boxGeometry args={[0.6, 0.18, 0.35]} /></mesh>
          </>
        )}
        <B s={[1.5, 0.15, 0.05]} p={[0, 0.8, 2.22]} c="#fff6c0" />
        <B s={[1.5, 0.15, 0.05]} p={[0, 0.8, -2.22]} c="#b0121b" />
        <Wheel p={[0.95, 0.4, 1.4]} /><Wheel p={[-0.95, 0.4, 1.4]} /><Wheel p={[0.95, 0.4, -1.4]} /><Wheel p={[-0.95, 0.4, -1.4]} />
      </>
    );
  }
  return (
    <group ref={ref} visible={car.active}>
      {body}
    </group>
  );
}

export function PedModel({ ped }: { ped: Ped }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    ped.obj = ref.current;
  }, [ped]);
  return (
    <group ref={ref}>
      <B s={[0.36, 0.8, 0.24]} p={[0, 0.4, 0]} c="#2b2d42" />
      <B s={[0.52, 0.72, 0.3]} p={[0, 1.16, 0]} c={ped.color} />
      <B s={[0.28, 0.3, 0.28]} p={[0, 1.68, 0]} c="#6b4226" />
      {ped.wrap && <B s={[0.36, 0.22, 0.36]} p={[0, 1.88, 0]} c={ped.wrap} />}
    </group>
  );
}

function Marker({ color, set }: { color: string; set: (o: THREE.Object3D | null) => void }) {
  return (
    <group ref={set} visible={false}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[3, 3, 3, 16, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 5, 0]} rotation-x={Math.PI}>
        <coneGeometry args={[0.8, 1.6, 4]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

export function Markers({ S }: { S: GameState }) {
  return (
    <>
      <Marker color="#3ddc5a" set={(o) => (S.markers.courier = o)} />
      <Marker color="#ffd60a" set={(o) => (S.markers.taxi = o)} />
      <Marker color="#ff4fa3" set={(o) => (S.markers.drop = o)} />
    </>
  );
}

/** Ribbon geometry along a polyline with half-width w, at height y. */
function ribbon(pts: { x: number; z: number }[], w: number, y: number, off = 0) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let acc = 0;
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    const nx = -dz / L, nz = dx / L;
    if (i > 0) acc += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
    pos.push(p.x + nx * (off - w), y, p.z + nz * (off - w), p.x + nx * (off + w), y, p.z + nz * (off + w));
    uv.push(acc / 8, 0, acc / 8, 1);
    if (i > 0) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Curving Marina expressway on reclaimed land along the lagoon, with a concrete median and black/yellow kerbs. */
function MarinaCurve({ road, pts, land = true }: { road: THREE.Material; pts?: { x: number; z: number }[]; land?: boolean }) {
  const G = useMemo(() => {
    const ext = pts ?? [{ x: -212, z: -200 }, ...MARINA_CURVE, { x: 212, z: -200 }];
    const tex = (road as THREE.MeshLambertMaterial).map!.clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(1, 1); tex.needsUpdate = true;
    return {
      land: ribbon(ext, 20, -0.02, -6),
      road: ribbon(ext, 8, 0.03),
      tex,
      median: ribbon(ext, 0.5, 0.25),
      kerbIn: ribbon(ext, 0.3, 0.14, 8.3),
      kerbOut: ribbon(ext, 0.3, 0.14, -8.3),
      lineL: ribbon(ext, 0.12, 0.05, 7.3),
      lineR: ribbon(ext, 0.12, 0.05, -7.3),
    };
  }, [road, pts]);
  const kerbTex = useMemo(() => {
    const cv = document.createElement("canvas"); cv.width = 64; cv.height = 8;
    const g = cv.getContext("2d")!;
    g.fillStyle = "#181818"; g.fillRect(0, 0, 64, 8); g.fillStyle = "#fec007"; g.fillRect(0, 0, 32, 8);
    const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.repeat.set(8, 1); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <group>
      {land && <mesh geometry={G.land} receiveShadow><meshLambertMaterial color="#c9b089" side={THREE.DoubleSide} /></mesh>}
      <mesh geometry={G.road} receiveShadow><meshLambertMaterial map={G.tex} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={G.median}><meshLambertMaterial color="#d9d2c3" side={THREE.DoubleSide} /></mesh>
      <mesh geometry={G.kerbIn}><meshLambertMaterial map={kerbTex} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={G.kerbOut}><meshLambertMaterial map={kerbTex} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={G.lineL}><meshBasicMaterial color="#eeeeee" side={THREE.DoubleSide} /></mesh>
      <mesh geometry={G.lineR}><meshBasicMaterial color="#eeeeee" side={THREE.DoubleSide} /></mesh>
    </group>
  );
}
