import { useEffect, useRef, useState } from "react";
import type { Input } from "./types";

const DIRS = ["KeyW", "KeyA", "KeyS", "KeyD"];

export function TouchControls({ input, onPause }: { input: React.RefObject<Input>; onPause: () => void }) {
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const stick = useRef<{ id: number; ox: number; oy: number } | null>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);

  const setKey = (code: string, on: boolean) => {
    const I = input.current;
    if (on) { if (!I.keys.has(code)) I.pressed.add(code); I.keys.add(code); }
    else I.keys.delete(code);
  };

  useEffect(() => () => DIRS.forEach((d) => input.current.keys.delete(d)), [input]);

  const onStickStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    stick.current = { id: t.identifier, ox: t.clientX, oy: t.clientY };
    setKnob({ x: 0, y: 0 });
  };
  const onStickMove = (e: React.TouchEvent) => {
    const s = stick.current;
    if (!s) return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== s.id) continue;
      let dx = t.clientX - s.ox, dy = t.clientY - s.oy;
      const d = Math.hypot(dx, dy), max = 50;
      if (d > max) { dx = (dx / d) * max; dy = (dy / d) * max; }
      setKnob({ x: dx, y: dy });
      const th = 14;
      setKey("KeyW", dy < -th); setKey("KeyS", dy > th);
      setKey("KeyA", dx < -th); setKey("KeyD", dx > th);
    }
  };
  const onStickEnd = () => { stick.current = null; setKnob(null); DIRS.forEach((d) => setKey(d, false)); };

  const onLookStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    look.current = { id: t.identifier, x: t.clientX, y: t.clientY };
  };
  const onLookMove = (e: React.TouchEvent) => {
    const l = look.current;
    if (!l) return;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== l.id) continue;
      input.current.mdx += (t.clientX - l.x) * 1.6;
      input.current.mdy += (t.clientY - l.y) * 1.6;
      l.x = t.clientX; l.y = t.clientY;
    }
  };

  const Btn = ({ code, label, className = "" }: { code: string; label: string; className?: string }) => (
    <button
      onTouchStart={(e) => { e.stopPropagation(); setKey(code, true); }}
      onTouchEnd={(e) => { e.stopPropagation(); setKey(code, false); }}
      onTouchCancel={() => setKey(code, false)}
      className={`flex h-14 w-14 items-center justify-center rounded-full border-2 border-hud-ink/60 bg-hud-panel font-display text-xs text-hud-ink active:bg-hud-star active:text-hud-shadow ${className}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[15] touch-none select-none">
      {/* look area: right half */}
      <div className="absolute inset-y-0 right-0 w-1/2" onTouchStart={onLookStart} onTouchMove={onLookMove} onTouchEnd={() => (look.current = null)} onTouchCancel={() => (look.current = null)} />
      {/* joystick: left half lower */}
      <div className="absolute bottom-0 left-0 h-3/5 w-1/2" onTouchStart={onStickStart} onTouchMove={onStickMove} onTouchEnd={onStickEnd} onTouchCancel={onStickEnd}>
        <div className="absolute bottom-8 left-[200px] h-28 w-28 rounded-full border-2 border-hud-ink/50 bg-hud-panel/60">
          <div
            className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-hud-star/80"
            style={{ transform: `translate(calc(-50% + ${knob?.x ?? 0}px), calc(-50% + ${knob?.y ?? 0}px))` }}
          />
        </div>
      </div>
      {/* action buttons */}
      <div className="absolute bottom-6 right-6 grid grid-cols-3 gap-2">
        <Btn code="KeyH" label="HORN" />
        <Btn code="KeyC" label="CAM" />
        <Btn code="KeyR" label="RADIO" />
        <Btn code="ShiftLeft" label="RUN" />
        <Btn code="KeyE" label="ENTER" className="bg-hud-cash/40" />
        <Btn code="Space" label="JUMP" />
      </div>
      <button onTouchStart={(e) => { e.stopPropagation(); onPause(); }} className="absolute left-1/2 top-3 -translate-x-1/2 rounded bg-hud-panel px-3 py-1 font-display text-xs text-hud-ink">
        II
      </button>
    </div>
  );
}
