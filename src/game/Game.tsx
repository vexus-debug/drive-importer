import { LagosVehicle } from "./Vehicles";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { RealCar, RealPed } from "./RealModels";
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { GameAudio } from "./audio";
import { HUD } from "./HUD";
import { Markers, WorldMesh } from "./Models";
import { LagosDetails, LagosHeritage } from "./Lagos";
import { MarketStreet } from "./MarketStreet";
import { createState, step } from "./sim";
import { SPECS, type GameState, type Input } from "./types";
import { buildWorld, type World } from "./world";
import { TouchControls } from "./TouchControls";
import { GrassTufts, PowerLines, RoofClutter } from "./Streetscape";

function Sim({ S, W, input, audio }: { S: GameState; W: World; input: React.RefObject<Input>; audio: GameAudio }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const { camera, scene, gl } = useThree();
  const sky = useMemo(() => {
    const s = new Sky();
    s.scale.setScalar(600);
    const u = s.material.uniforms;
    u["turbidity"]!.value = 6;
    u["rayleigh"]!.value = 1.6;
    u["mieCoefficient"]!.value = 0.006;
    u["mieDirectionalG"]!.value = 0.85;
    u["sunPosition"]!.value.set(50, 30, 35).normalize();
    (s.material as THREE.ShaderMaterial).fog = false;
    return s;
  }, []);
  useEffect(() => {
    camera.rotation.order = "YXZ";
    if (sun.current) scene.add(sun.current.target);
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 0.9;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [camera, scene, gl]);
  useFrame(() => sky.position.copy(camera.position));

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.05);
    const I = input.current;
    if (S.locked) step(S, W, I, dt, audio);
    I.pressed.clear();
    I.mdx = 0;
    I.mdy = 0;

    for (const c of S.cars) {
      if (!c.obj) continue;
      c.obj.visible = c.active;
      c.obj.position.set(c.x, c.y ?? 0, c.z);
      c.obj.rotation.y = c.h;
    }
    for (const p of S.peds) {
      if (!p.obj) continue;
      p.obj.position.set(p.x, 0, p.z);
      p.obj.rotation.set(0, p.h, 0);
    }
    const mk = S.markers;
    const bob = Math.sin(S.time * 3) * 0.3;
    if (mk.courier) { mk.courier.visible = !S.mission; mk.courier.position.set(S.offers.courier.x, bob, S.offers.courier.z); }
    if (mk.taxi) { mk.taxi.visible = !S.mission; mk.taxi.position.set(S.offers.taxi.x, bob, S.offers.taxi.z); }
    if (mk.drop) { mk.drop.visible = !!S.mission; if (S.mission) mk.drop.position.set(S.mission.drop.x, bob, S.mission.drop.z); }

    const cam = camera as THREE.PerspectiveCamera;
    const p = S.player;
    let fov = 75;
    if (S.car) {
      const c = S.car;
      const sp = SPECS[c.type];
      const fx = Math.sin(c.h), fz = Math.cos(c.h);
      if (S.camMode === 0) {
        const back = sp.len * 1.3 + 3;
        const k = 1 - Math.exp(-9 * dt);
        const cy = c.y ?? 0;
        cam.position.lerp(new THREE.Vector3(c.x - fx * back, cy + 2.2 + sp.len * 0.35, c.z - fz * back), k);
        cam.lookAt(c.x + fx * 4, cy + 1.2, c.z + fz * 4);
      } else {
        const head = c.type === "brt" ? 2.6 : c.type === "danfo" ? 2.0 : c.type === "keke" || c.type === "okada" ? 1.6 : 1.25;
        cam.position.set(c.x + fx * sp.len * 0.12 + Math.cos(c.h) * 0.35, head + (c.y ?? 0), c.z + fz * sp.len * 0.12 - Math.sin(c.h) * 0.35);
        cam.rotation.set(-0.06, c.h + Math.PI, 0);
      }
      fov = 72 + Math.abs(c.speed) * 0.35;
    } else {
      cam.position.set(p.x + Math.cos(p.bob * 0.5) * 0.03, p.y + 1.65 + Math.sin(p.bob) * 0.055, p.z);
      cam.rotation.set(p.pitch, p.yaw, 0);
    }
    if (Math.abs(cam.fov - fov) > 0.1) { cam.fov += (fov - cam.fov) * 0.1; cam.updateProjectionMatrix(); }

    const pp = S.car ?? p;
    if (sun.current) {
      sun.current.position.set(pp.x + 50, 90, pp.z + 35);
      sun.current.target.position.set(pp.x, 0, pp.z);
      sun.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <primitive object={sky} />
      <fog attach="fog" args={["#e9d8bd", 90, 420]} />
      <hemisphereLight args={["#cfe3f5", "#9c7c55", 0.9]} />
      <directionalLight
        ref={sun}
        color="#ffe6c0"
        intensity={2.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-far={250}
        shadow-bias={-0.0005}
      />
    </>
  );
}

export function Game() {
  const W = useMemo(buildWorld, []);
  const S = useMemo(() => createState(W), [W]);
  const audio = useMemo(() => new GameAudio(), []);
  const input = useRef<Input>({ keys: new Set(), pressed: new Set(), mdx: 0, mdy: 0 });
  const wrap = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (!input.current.keys.has(e.code)) input.current.pressed.add(e.code);
      input.current.keys.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
    };
    const ku = (e: KeyboardEvent) => input.current.keys.delete(e.code);
    const mm = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      input.current.mdx += e.movementX;
      input.current.mdy += e.movementY;
    };
    const lc = () => {
      const l = !!document.pointerLockElement;
      S.locked = l;
      setLocked(l);
      if (!l) input.current.keys.clear();
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("mousemove", mm);
    document.addEventListener("pointerlockchange", lc);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("mousemove", mm);
      document.removeEventListener("pointerlockchange", lc);
    };
  }, [S]);

  const [touch, setTouch] = useState(false);
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window);
    const mq = window.matchMedia("(orientation: portrait)");
    const upd = () => setPortrait(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  const play = () => {
    audio.init();
    setStarted(true);
    if (touch) {
      const el = document.documentElement;
      const go = el.requestFullscreen ? el.requestFullscreen() : Promise.resolve();
      go.then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> }).lock?.("landscape"))
        .catch(() => {});
      S.locked = true;
      setLocked(true);
      return;
    }
    void wrap.current?.requestPointerLock();
  };
  const pause = () => {
    S.locked = false;
    setLocked(false);
    input.current.keys.clear();
  };

  return (
    <div ref={wrap} className="fixed inset-0 bg-background" onClick={() => !touch && started && !locked && play()}>
      <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 75, near: 0.1, far: 700, position: [10, 1.65, 20] }}>
        <WorldMesh W={W} />
        <LagosDetails W={W} />
        <PowerLines W={W} />
        <RoofClutter W={W} />
        <GrassTufts W={W} />
        <LagosHeritage W={W} />
        <MarketStreet W={W} />
        <Suspense fallback={null}>
          {S.cars.map((c) => (c.type === "sedan" || c.type === "police" ? <RealCar key={c.id} car={c} /> : <LagosVehicle key={c.id} car={c} />))}
          {S.peds.map((p) => <RealPed key={p.id} ped={p} />)}
        </Suspense>
        <Markers S={S} />
        <Sim S={S} W={W} input={input} audio={audio} />
      </Canvas>
      <HUD S={S} audio={audio} />
      {touch && locked && <TouchControls input={input} onPause={pause} />}
      {touch && portrait && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-hud-overlay px-8 text-center font-hud text-hud-ink">
          <div className="text-6xl">⟳</div>
          <div className="font-display text-2xl text-hud-star">ROTATE YOUR PHONE</div>
          <div className="text-sm opacity-80">Eko Run plays sideways. Turn your phone to landscape (and switch off rotation lock).</div>
        </div>
      )}
      {!locked && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-hud-overlay">
          <div className="max-w-lg px-6 text-center font-hud text-hud-ink">
            <div className="font-display text-6xl leading-none text-hud-star drop-shadow-[0_5px_0_var(--hud-shadow)]">EKO RUN</div>
            <div className="mt-2 text-sm uppercase tracking-[0.3em] opacity-80">Lagos · Open World</div>
            {started ? (
              <p className="mt-6 text-lg">Paused</p>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1 text-left text-sm">
                <span>Mouse · look</span><span>WASD · move / drive</span>
                <span>Shift · sprint</span><span>Space · jump / handbrake</span>
                <span>E / F · enter or hijack</span><span>C · cockpit / chase cam</span>
                <span>H · horn</span><span>R / T · radio / station</span>
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); play(); }}
              className="mt-8 rounded bg-hud-star px-8 py-3 font-display text-xl text-hud-shadow shadow-[0_5px_0_var(--hud-shadow)] transition-transform hover:-translate-y-0.5"
            >
              {started ? "RESUME" : "CLICK TO PLAY"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
