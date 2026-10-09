import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { BKind, Building, World } from "./world";
import { BANK_PODIUM } from "./Architecture";
import { facade, glassFacade, hotelFacade, residentialFacade, signTexture, worldUVFacade } from "./textures";

type Family = "bank" | "office" | "hotel" | "residential" | "street";
const familyOf = (k: BKind | undefined): Family =>
  k === "bank" || k === "office" || k === "hotel" || k === "residential" ? k : "street";

const AWNING: Partial<Record<BKind, string>> = { cafe: "#7a4b2a", restaurant: "#d62828", shop: "#1d4ed8", bank: "#0b3d2e" };

function BSet({ list, mat }: { list: Building[]; mat: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Color();
    list.forEach((b, i) => {
      v.set((b.minX + b.maxX) / 2, b.h / 2, (b.minZ + b.maxZ) / 2);
      s.set(b.maxX - b.minX, b.h, b.maxZ - b.minZ);
      ref.current!.setMatrixAt(i, m.compose(v, q.identity(), s));
      const fam = familyOf(b.kind);
      ref.current!.setColorAt(i, c.set(fam === "street" || fam === "residential" ? b.color : "#ffffff"));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true;
  }, [list]);
  if (!list.length) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, list.length]} castShadow receiveShadow>
      <boxGeometry />
      <primitive object={mat} attach="material" />
    </instancedMesh>
  );
}

/** Building bodies grouped by Lagos typology, plus brand signs, awnings, hotel canopies and bank ATM kiosks. */
export function Buildings({ W }: { W: World }) {
  const groups = useMemo(() => {
    const g: Record<Family, Building[]> = { bank: [], office: [], hotel: [], residential: [], street: [] };
    for (const b of W.buildings) g[familyOf(b.kind)].push(b);
    return g;
  }, [W]);

  const mats = useMemo(() => {
    const mk = (t: THREE.Texture, rough = 0.75, metal = 0.05) => {
      const m = new THREE.MeshStandardMaterial({ map: t, roughness: rough, metalness: metal });
      worldUVFacade(m);
      return m;
    };
    return {
      bank: mk(glassFacade("#7fc9a8", "#1f5a46", "#0c2a20", "#d4d8d4"), 0.2, 0.5),
      office: mk(glassFacade("#a8cde6", "#2d5878", "#12263a"), 0.2, 0.5),
      hotel: mk(hotelFacade(), 0.5, 0.1),
      residential: mk(residentialFacade()),
      street: mk(facade()),
    };
  }, []);

  const signs = useMemo(() => {
    const cache = new Map<string, THREE.Texture>();
    const out: { tex: THREE.Texture; pos: [number, number, number]; rot: number; w: number; h: number }[] = [];
    for (const b of W.buildings) {
      if (!b.brand || !b.kind) continue;
      const B = b.brand;
      const key = B.name;
      if (!cache.has(key)) cache.set(key, signTexture(B.name, B.bg, B.fg, 512, 128, B.accent, B.mark, B.markFg));
      const tex = cache.get(key)!;
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      const wx = b.maxX - b.minX, wz = b.maxZ - b.minZ;

      const y = b.kind === "bank" ? BANK_PODIUM - 0.7 : b.kind === "hotel" ? b.h - 1.6 : b.kind === "restaurant" || b.kind === "cafe" ? b.h - 0.4 : 4.1;
      const sw = Math.min(b.kind === "hotel" ? 12 : b.kind === "bank" ? 5.6 : 7, wx - 1), sh = sw / 4;
      out.push({ tex, pos: [cx, y, b.maxZ + 0.08], rot: 0, w: sw, h: sh });
      out.push({ tex, pos: [cx, y, b.minZ - 0.08], rot: Math.PI, w: sw, h: sh });
      const sw2 = Math.min(b.kind === "hotel" ? 12 : b.kind === "bank" ? 5.6 : 7, wz - 1);
      out.push({ tex, pos: [b.maxX + 0.08, y, cz], rot: Math.PI / 2, w: sw2, h: sw2 / 4 });
      out.push({ tex, pos: [b.minX - 0.08, y, cz], rot: -Math.PI / 2, w: sw2, h: sw2 / 4 });
    }
    return out;
  }, [W]);

  const awnings = useMemo(() => {
    const out: { pos: [number, number, number]; size: [number, number, number]; rotX: number; rotY: number; color: string }[] = [];
    for (const b of W.buildings) {
      const col = b.brand ? (b.brand.bg === "#ffffff" ? b.brand.fg : b.brand.bg) : b.kind ? AWNING[b.kind] : undefined;
      if (!col || b.h > 60 || b.kind === "bank" || b.kind === "restaurant" || b.kind === "cafe") continue;
      const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
      const wx = b.maxX - b.minX, wz = b.maxZ - b.minZ;
      out.push({ pos: [cx, 3.35, b.maxZ + 0.9], size: [wx * 0.9, 0.08, 1.8], rotX: 0.25, rotY: 0, color: col });
      out.push({ pos: [cx, 3.35, b.minZ - 0.9], size: [wx * 0.9, 0.08, 1.8], rotX: -0.25, rotY: 0, color: col });
      out.push({ pos: [b.maxX + 0.9, 3.35, cz], size: [wz * 0.9, 0.08, 1.8], rotX: 0.25, rotY: Math.PI / 2, color: col });
      out.push({ pos: [b.minX - 0.9, 3.35, cz], size: [wz * 0.9, 0.08, 1.8], rotX: -0.25, rotY: Math.PI / 2, color: col });
    }
    return out;
  }, [W]);

  const hotels = useMemo(() => W.buildings.filter((b) => b.kind === "hotel" && b.maxZ - b.minZ > 8), [W]);
  const banks = useMemo(() => W.buildings.filter((b) => b.kind === "bank"), [W]);
  const atm = useMemo(() => signTexture("ATM 24/7", "#0b3d2e", "#f5c518", 256, 96), []);

  return (
    <group>
      {(Object.keys(groups) as Family[]).map((f) => <BSet key={f} list={groups[f]} mat={mats[f]} />)}
      {signs.map((s, i) => (
        <mesh key={i} position={s.pos} rotation-y={s.rot}>
          <planeGeometry args={[s.w, s.h]} />
          <meshBasicMaterial map={s.tex} toneMapped={false} />
        </mesh>
      ))}
      {awnings.map((a, i) => (
        <mesh key={i} position={a.pos} rotation={[a.rotX, a.rotY, 0, "YXZ"]} castShadow>
          <boxGeometry args={a.size} />
          <meshLambertMaterial color={a.color} />
        </mesh>
      ))}
      {hotels.map((b, i) => {
        const cx = (b.minX + b.maxX) / 2;
        return (
          <group key={i} position={[cx, 0, b.maxZ]}>
            <mesh position={[0, 4.2, 2.5]} castShadow><boxGeometry args={[8, 0.5, 5]} /><meshStandardMaterial color="#2b2b2b" metalness={0.6} roughness={0.3} /></mesh>
            <mesh position={[0, 3.9, 2.5]}><boxGeometry args={[7.6, 0.1, 4.6]} /><meshBasicMaterial color="#ffd89a" /></mesh>
            {[-3.6, 3.6].map((x) => (
              <mesh key={x} position={[x, 2, 4.7]} castShadow><cylinderGeometry args={[0.2, 0.2, 4, 8]} /><meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.25} /></mesh>
            ))}
          </group>
        );
      })}
      {banks.map((b, i) => (
        <group key={i} position={[(b.minX + b.maxX) / 2 + 3, 0, b.maxZ + 1.2]}>
          <mesh position={[0, 1.3, 0]} castShadow><boxGeometry args={[1.6, 2.6, 1.2]} /><meshLambertMaterial color="#e8e8e2" /></mesh>
          <mesh position={[0, 2.2, 0.61]}><planeGeometry args={[1.5, 0.55]} /><meshBasicMaterial map={atm} toneMapped={false} /></mesh>
          <mesh position={[0, 1.3, 0.61]}><planeGeometry args={[0.7, 0.5]} /><meshBasicMaterial color="#5ec8ff" /></mesh>
        </group>
      ))}
    </group>
  );
}
