import { useEffect, useRef, useState } from "react";
import type { GameAudio } from "./audio";
import { SPECS, type GameState } from "./types";
import { CANAL, DIAGONALS, IKOYI, LINES, MARINA_CURVE } from "./world";

function drawRadar(cv: HTMLCanvasElement, S: GameState, R: number, RANGE: number) {
  const g = cv.getContext("2d")!;
  const p = S.car ?? S.player;
  const fx = S.car ? Math.sin(S.car.h) : -Math.sin(S.player.yaw);
  const fz = S.car ? Math.cos(S.car.h) : -Math.cos(S.player.yaw);
  const rx = -fz, rz = fx, sc = R / RANGE;
  const T = (x: number, z: number): [number, number] => {
    const dx = x - p.x, dz = z - p.z;
    return [R + (dx * rx + dz * rz) * sc, R - (dx * fx + dz * fz) * sc];
  };
  g.clearRect(0, 0, R * 2, R * 2);
  g.save();
  g.beginPath();
  g.arc(R, R, R - 2, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = "#2a8fa3";
  g.fillRect(0, 0, R * 2, R * 2);
  const poly = (pts: [number, number][], color: string) => {
    g.fillStyle = color;
    g.beginPath();
    pts.forEach(([x, z], i) => { const [a, b] = T(x, z); if (i) g.lineTo(a, b); else g.moveTo(a, b); });
    g.fill();
  };
  poly([[-215, -215], [215, -215], [215, 215], [-215, 215]], "#6f8a5a");
  poly([[-60, 418], [60, 418], [60, 517], [-60, 517]], "#6f8a5a");
  poly([[IKOYI.x0, IKOYI.z0], [IKOYI.x1, IKOYI.z0], [IKOYI.x1, IKOYI.z1], [IKOYI.x0, IKOYI.z1]], "#6f8a5a");
  poly([[IKOYI.x0, CANAL.z0], [IKOYI.x1, CANAL.z0], [IKOYI.x1, CANAL.z1], [IKOYI.x0, CANAL.z1]], "#2a8fa3");
  g.strokeStyle = "#d9d9d9";
  g.lineWidth = 16 * sc;
  const line = (a: [number, number], b: [number, number]) => {
    const [x1, y1] = T(...a), [x2, y2] = T(...b);
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  };
  for (const v of LINES) { line([-208, v], [208, v]); line([v, -208], [v, 208]); }
  for (let i = 0; i < MARINA_CURVE.length - 1; i++) line([MARINA_CURVE[i].x, MARINA_CURVE[i].z], [MARINA_CURVE[i + 1].x, MARINA_CURVE[i + 1].z]);
  line([0, 200], [0, 480]);
  line([200, 0], [406, 0]);
  for (const z of [-108, 108]) line([254, z], [406, z]);
  for (const x of [254, 330, 406]) line([x, -108], [x, 108]);
  line([-46, 428], [46, 428]); line([46, 428], [46, 507]); line([46, 507], [-46, 507]); line([-46, 507], [-46, 428]);
  for (const d of DIAGONALS) for (let i = 0; i < d.pts.length - 1; i++) line([d.pts[i].x, d.pts[i].z], [d.pts[i + 1].x, d.pts[i + 1].z]);
  const dot = (x: number, z: number, color: string, size: number, clampEdge = false) => {
    let [a, b] = T(x, z);
    if (clampEdge) {
      const dx = a - R, dy = b - R, d = Math.hypot(dx, dy);
      if (d > R - 8) { a = R + (dx / d) * (R - 8); b = R + (dy / d) * (R - 8); }
    }
    g.fillStyle = color;
    g.strokeStyle = "#000";
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(a, b, size, 0, Math.PI * 2); g.fill(); g.stroke();
  };
  for (const c of S.cars) if (c.ai === "police" && c.active) dot(c.x, c.z, Math.floor(S.time * 4) % 2 ? "#ff3040" : "#3060ff", 3.5);
  if (S.mission) dot(S.mission.drop.x, S.mission.drop.z, "#ff4fa3", 6, true);
  else {
    dot(S.offers.courier.x, S.offers.courier.z, "#3ddc5a", 5, true);
    dot(S.offers.taxi.x, S.offers.taxi.z, "#ffd60a", 5, true);
  }
  g.restore();
  g.fillStyle = "#fff";
  g.strokeStyle = "#000";
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(R, R - 8); g.lineTo(R + 6, R + 6); g.lineTo(R, R + 3); g.lineTo(R - 6, R + 6); g.closePath(); g.fill(); g.stroke();
  g.lineWidth = 4;
  g.strokeStyle = "#111";
  g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.stroke();
}

export function HUD({ S, audio }: { S: GameState; audio: GameAudio }) {
  const [, setTick] = useState(0);
  const radar = useRef<HTMLCanvasElement>(null);
  const [big, setBig] = useState(false);
  const R = big ? 300 : 82;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === "KeyM") setBig((b) => !b); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (radar.current) drawRadar(radar.current, S, R, big ? 520 : 160);
    }, 100);
    return () => clearInterval(id);
  }, [S, R, big]);
  const p = S.player;
  const stars = Math.min(5, Math.floor(S.heat));
  const kmh = S.car ? Math.round(Math.abs(S.car.speed) * 3.6) : 0;
  const m = S.mission;
  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none font-hud text-hud-ink">
      {/* reticle */}
      {!S.car && <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-hud-ink shadow-[0_0_0_2px_var(--hud-shadow)]" />}
      {S.prompt && (
        <div className="absolute left-1/2 top-[56%] -translate-x-1/2 rounded bg-hud-panel px-3 py-1.5 text-sm font-semibold tracking-wide">{S.prompt}</div>
      )}
      {/* top right */}
      <div className="absolute right-5 top-4 flex w-64 flex-col items-end gap-1.5">
        <div className="flex gap-1 text-2xl">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i < stars ? "text-hud-star drop-shadow-[0_2px_0_var(--hud-shadow)]" : "text-hud-ink/25"}>★</span>
          ))}
        </div>
        <div className="font-display text-4xl text-hud-cash drop-shadow-[0_3px_0_var(--hud-shadow)]">₦{S.cash.toLocaleString()}</div>
        <Bar value={p.health} className="bg-hud-health" label="HEALTH" />
        <Bar value={p.stamina} className="bg-hud-stamina" label="STAMINA" />
        {S.car && (
          <div className="mt-1 text-right">
            <div className="font-display text-3xl drop-shadow-[0_3px_0_var(--hud-shadow)]">{kmh}<span className="ml-1 text-sm">KM/H</span></div>
            <div className="text-xs uppercase tracking-widest opacity-80">{SPECS[S.car.type].name} · C: camera · Space: drift</div>
          </div>
        )}
      </div>
      {/* mission */}
      {m && (
        <div className="absolute left-5 top-4 max-w-xs rounded bg-hud-panel px-3 py-2">
          <div className="font-display text-sm text-hud-mission">{m.kind === "taxi" ? "TAXI FARE" : "COURIER RUN"}</div>
          <div className="text-sm">Reach the pink marker · ₦{m.reward}</div>
          <div className="font-display text-xl">{Math.max(0, Math.ceil(m.time))}s</div>
        </div>
      )}
      {!m && (
        <div className="absolute left-5 top-4 max-w-xs rounded bg-hud-panel px-3 py-2 text-xs leading-relaxed">
          <span className="text-hud-cash">● Green</span>: courier job · <span className="text-hud-star">● Yellow</span>: taxi fare (needs a vehicle)
          <div className="opacity-70">R radio · T station · H horn</div>
        </div>
      )}
      {/* messages */}
      <div className="absolute left-1/2 top-[22%] flex -translate-x-1/2 flex-col items-center gap-1">
        {S.msgs.map((x, i) => (
          <div key={i} className="font-display text-xl drop-shadow-[0_2px_0_var(--hud-shadow)]" style={{ opacity: Math.min(1, x.t) }}>{x.text}</div>
        ))}
      </div>
      {/* radar */}
      <canvas
        ref={radar}
        width={R * 2}
        height={R * 2}
        onPointerDown={(e) => { e.stopPropagation(); setBig((b) => !b); }}
        className={big ? "pointer-events-auto absolute left-1/2 top-1/2 max-h-[90vmin] max-w-[90vmin] -translate-x-1/2 -translate-y-1/2 cursor-pointer" : "pointer-events-auto absolute bottom-5 left-5 cursor-pointer"}
        title="Map (M)"
      />
      {audio.radioOn && <div className="absolute bottom-6 left-52 text-xs uppercase tracking-widest opacity-80">♪ {audio.stationName}</div>}
      {S.wasted > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-hud-wasted">
          <div className="font-display text-7xl text-hud-health drop-shadow-[0_4px_0_var(--hud-shadow)]">WASTED</div>
        </div>
      )}
    </div>
  );
}

function Bar({ value, className, label }: { value: number; className: string; label: string }) {
  return (
    <div className="w-full">
      <div className="h-3 w-full overflow-hidden rounded-sm border-2 border-hud-shadow bg-hud-panel">
        <div className={`h-full ${className}`} style={{ width: `${Math.max(0, value)}%` }} />
      </div>
      <div className="text-right text-[10px] tracking-widest opacity-70">{label}</div>
    </div>
  );
}
