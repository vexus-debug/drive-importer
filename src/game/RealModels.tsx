import { useFrame, useLoader } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SPECS, type Car, type Ped } from "./types";

const CAR_URL = (n: string) => `/models/cars/${n}.glb`;
const SEDANS = ["sedan", "sedan-sports", "suv", "hatchback-sports", "taxi"];

/** Kenney cars face -Z; the game drives along +Z, so the model is turned around. */
const CAR_YAW = Math.PI;

function fitCar(src: THREE.Object3D, len: number, tint?: string) {
  const o = src.clone(true);
  o.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    if (tint) {
      const mt = (mesh.material as THREE.MeshStandardMaterial).clone();
      mt.color.set(tint);
      mesh.material = mt;
    }
  });
  const box = new THREE.Box3().setFromObject(o);
  const size = box.getSize(new THREE.Vector3());
  const s = len / Math.max(size.x, size.z);
  const g = new THREE.Group();
  o.scale.setScalar(s);
  o.position.set(-((box.min.x + box.max.x) / 2) * s, -box.min.y * s, -((box.min.z + box.max.z) / 2) * s);
  const pivot = new THREE.Group();
  pivot.rotation.y = CAR_YAW;
  pivot.add(o);
  g.add(pivot);
  return g;
}

export function RealCar({ car }: { car: Car }) {
  const name = car.type === "danfo" ? "van" : car.type === "police" ? "police" : SEDANS[car.id % SEDANS.length];
  const gltf = useLoader(GLTFLoader, CAR_URL(name));
  const ref = useRef<THREE.Group>(null);
  const obj = useMemo(
    () => fitCar(gltf.scene, SPECS[car.type].len, car.type === "danfo" ? "#ffd21f" : undefined),
    [gltf, car.type],
  );
  const red = useMemo(() => new THREE.MeshLambertMaterial({ color: "#ff2030", emissive: "#ff0010", emissiveIntensity: 0.1 }), []);
  const blue = useMemo(() => new THREE.MeshLambertMaterial({ color: "#2050ff", emissive: "#0030ff", emissiveIntensity: 0.1 }), []);
  useLayoutEffect(() => {
    car.obj = ref.current;
    car.lights = [red, blue];
  }, [car, red, blue]);
  return (
    <group ref={ref} visible={car.active}>
      <primitive object={obj} />
      {car.type === "police" && (
        <>
          <mesh position={[-0.3, 1.75, -0.2]} material={red}><boxGeometry args={[0.5, 0.15, 0.3]} /></mesh>
          <mesh position={[0.3, 1.75, -0.2]} material={blue}><boxGeometry args={[0.5, 0.15, 0.3]} /></mesh>
        </>
      )}
    </group>
  );
}

const skinShades = ["#694331", "#81533c", "#573526", "#925f43", "#754833"];
const hairShades = ["#171410", "#28201b", "#3a261c"];
const clothPalettes = [
  ["#c93732", "#f0bd48", "#183c3a"],
  ["#16806d", "#f2cf5a", "#d83d3d"],
  ["#285a9b", "#edb943", "#f3e7ca"],
  ["#693b77", "#ea8a45", "#194b46"],
];
const fabricTextures: THREE.CanvasTexture[] = [];

function ankaraTexture(index: number) {
  const existing = fabricTextures[index];
  if (existing) return existing;
  const colors = clothPalettes[index];
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = colors[0];
  context.fillRect(0, 0, 128, 128);
  context.fillStyle = colors[1];
  for (let y = -32; y < 160; y += 32) {
    for (let x = -32; x < 160; x += 32) {
      context.beginPath();
      context.moveTo(x + 16, y);
      context.lineTo(x + 32, y + 16);
      context.lineTo(x + 16, y + 32);
      context.lineTo(x, y + 16);
      context.closePath();
      context.fill();
      context.fillStyle = colors[2];
      context.beginPath();
      context.arc(x + 16, y + 16, 4, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = colors[1];
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  fabricTextures[index] = texture;
  return texture;
}

export function RealPed({ ped }: { ped: Ped }) {
  const ref = useRef<THREE.Group>(null);
  const figure = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const stride = useRef(0);
  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: skinShades[ped.id % skinShades.length], roughness: 0.88 }), [ped.id]);
  const hair = useMemo(() => new THREE.MeshStandardMaterial({ color: hairShades[ped.id % hairShades.length], roughness: 0.95 }), [ped.id]);
  const cloth = useMemo(() => {
    const texture = ped.id % 3 === 0 ? ankaraTexture(ped.id % clothPalettes.length) : null;
    return new THREE.MeshStandardMaterial({ color: texture ? "#ffffff" : ped.color, map: texture, roughness: 0.92 });
  }, [ped.id, ped.color]);
  const wrapper = useMemo(() => new THREE.MeshStandardMaterial({ color: ped.wrap ?? clothPalettes[ped.id % clothPalettes.length][1], roughness: 0.95 }), [ped.id, ped.wrap]);
  const trousers = useMemo(() => new THREE.MeshStandardMaterial({ color: ["#253b4d", "#29251f", "#47505a", "#384736"][ped.id % 4], roughness: 0.95 }), [ped.id]);
  const shoe = useMemo(() => new THREE.MeshStandardMaterial({ color: "#30251f", roughness: 0.83 }), []);
  const eye = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e9d8c6", roughness: 0.8 }), []);
  const pupil = useMemo(() => new THREE.MeshStandardMaterial({ color: "#211a17", roughness: 0.8 }), []);
  useLayoutEffect(() => {
    ped.obj = ref.current;
  }, [ped]);
  useFrame((_, dt) => {
    const moving = ped.dead <= 0 && ped.stumble <= 0;
    if (moving) {
      stride.current += Math.min(dt, 0.05) * Math.hypot(ped.vx, ped.vz) * 4.8;
      const swing = Math.sin(stride.current) * 0.48;
      if (leftLeg.current) leftLeg.current.rotation.x = swing;
      if (rightLeg.current) rightLeg.current.rotation.x = -swing;
      if (leftArm.current) leftArm.current.rotation.x = -swing * 0.72;
      if (rightArm.current) rightArm.current.rotation.x = swing * 0.72;
    }
    if (figure.current) {
      const fall = ped.dead > 0 ? Math.sin(Math.min(1, ped.dead / 0.36) * Math.PI * 0.5) : 1;
      figure.current.rotation.x = ped.pitch * fall;
      figure.current.rotation.z = ped.roll + (ped.dead > 0 ? (ped.id % 2 === 0 ? 0.2 : -0.2) : 0);
    }
  });
  return (
    <group ref={ref}>
      <group ref={figure}>
        <mesh position={[0, 1.2, 0]} material={cloth} castShadow>
          <capsuleGeometry args={[0.225, 0.42, 8, 20]} />
        </mesh>
        <mesh position={[0, 0.92, 0]} material={wrapper} castShadow>
          <cylinderGeometry args={[0.3, ped.id % 2 === 0 ? 0.34 : 0.29, 0.5, 20, 2]} />
        </mesh>
        <mesh position={[0, 1.505, 0]} material={skin} castShadow>
          <cylinderGeometry args={[0.075, 0.085, 0.13, 8]} />
        </mesh>
        <mesh position={[0, 1.69, 0]} material={skin} castShadow>
          <sphereGeometry args={[0.152, 24, 18]} />
        </mesh>
        <mesh position={[0, 1.79, -0.012]} material={hair} castShadow>
          <sphereGeometry args={[0.154, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.47]} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[side * 0.052, 1.708, 0.14]} material={eye}>
              <sphereGeometry args={[0.019, 7, 5]} />
            </mesh>
            <mesh position={[side * 0.052, 1.708, 0.157]} material={pupil}>
              <sphereGeometry args={[0.009, 6, 4]} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 1.665, 0.15]} material={skin}>
          <sphereGeometry args={[0.021, 6, 5]} />
        </mesh>
        {ped.wrap && (
          <group>
            <mesh position={[0, 1.82, 0]} material={wrapper} castShadow>
              <sphereGeometry args={[0.19, 10, 6]} />
            </mesh>
            <mesh position={[0.14, 1.82, -0.015]} material={wrapper} castShadow>
              <sphereGeometry args={[0.075, 8, 6]} />
            </mesh>
          </group>
        )}
        <group ref={leftArm} position={[-0.27, 1.39, 0]}>
          <mesh position={[0, -0.19, 0]} rotation={[0, 0, -0.12]} material={cloth} castShadow>
            <capsuleGeometry args={[0.09, 0.32, 6, 14]} />
          </mesh>
          <mesh position={[0, -0.48, 0]} material={skin} castShadow>
            <capsuleGeometry args={[0.065, 0.27, 6, 14]} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.27, 1.39, 0]}>
          <mesh position={[0, -0.19, 0]} rotation={[0, 0, 0.12]} material={cloth} castShadow>
            <capsuleGeometry args={[0.09, 0.32, 6, 14]} />
          </mesh>
          <mesh position={[0, -0.48, 0]} material={skin} castShadow>
            <capsuleGeometry args={[0.065, 0.27, 6, 14]} />
          </mesh>
        </group>
        <group ref={leftLeg} position={[-0.12, 0.76, 0]}>
          <mesh position={[0, -0.31, 0]} material={trousers} castShadow>
            <capsuleGeometry args={[0.105, 0.38, 6, 14]} />
          </mesh>
          <mesh position={[0, -0.66, 0.065]} material={shoe} castShadow>
            <capsuleGeometry args={[0.07, 0.12, 6, 14]} />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.12, 0.76, 0]}>
          <mesh position={[0, -0.31, 0]} material={trousers} castShadow>
            <capsuleGeometry args={[0.105, 0.38, 6, 14]} />
          </mesh>
          <mesh position={[0, -0.66, 0.065]} material={shoe} castShadow>
            <capsuleGeometry args={[0.07, 0.12, 6, 14]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
