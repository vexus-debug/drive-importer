import type { GameAudio } from "./audio";
import { SPECS, type Car, type CarType, type GameState, type Input, type P } from "./types";
import { FLYOVER_Z, LIGHTS, LINES, deckY, inWorld, lightPhase, surfaceY, randomSidewalkPoint, type Box, type World } from "./world";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const SEDAN_COLORS = ["#c0392b", "#2e86de", "#ecf0f1", "#2d3436", "#27ae60", "#8e44ad", "#d35400", "#7f8c8d"];
const PED_COLORS = ["#e63946", "#2a9d8f", "#f4a261", "#457b9d", "#ffb703", "#8338ec", "#06d6a0", "#fb5607"];
export const SPAWN = { x: 10, z: 20 };

export function pushOut(e: { x: number; z: number }, r: number, boxes: Box[]) {
  let hit = false;
  for (const b of boxes) {
    if (e.x + r < b.minX || e.x - r > b.maxX || e.z + r < b.minZ || e.z - r > b.maxZ) continue;
    const cx = clamp(e.x, b.minX, b.maxX), cz = clamp(e.z, b.minZ, b.maxZ);
    const dx = e.x - cx, dz = e.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      e.x += (dx / d) * (r - d);
      e.z += (dz / d) * (r - d);
    } else {
      const l = e.x - b.minX, rr = b.maxX - e.x, t = e.z - b.minZ, bt = b.maxZ - e.z;
      const m = Math.min(l, rr, t, bt);
      if (m === l) e.x = b.minX - r;
      else if (m === rr) e.x = b.maxX + r;
      else if (m === t) e.z = b.minZ - r;
      else e.z = b.maxZ + r;
    }
    hit = true;
  }
  return hit;
}

function makeCar(id: number, type: CarType, route: P[], ai: Car["ai"]): Car {
  return {
    id, type, route, ai, idx: 0, x: 0, z: 0, h: 0, vx: 0, vz: 0, speed: 0, active: true, stun: 0, blocked: 0, hitCd: 0,
    color: type === "sedan" ? SEDAN_COLORS[Math.floor(Math.random() * SEDAN_COLORS.length)]! : "",
    obj: null, lights: [],
  };
}

export function createState(W: World): GameState {
  const cars: Car[] = [];
  let id = 0;
  for (let k = 0; k < 40; k++) {
    const route = W.routes[k % W.routes.length];
    const roll = Math.random();
    const type: CarType = roll < 0.3 ? "danfo" : roll < 0.47 ? "keke" : roll < 0.62 ? "okada" : roll < 0.7 ? "brt" : "sedan";
    const c = makeCar(id++, type, route, "traffic");
    const idx = Math.floor(Math.random() * route.length);
    const a = route[idx], b = route[(idx + 1) % route.length];
    const f = Math.random() * 0.8 + 0.1;
    c.x = a.x + (b.x - a.x) * f;
    c.z = a.z + (b.z - a.z) * f;
    c.idx = (idx + 1) % route.length;
    c.h = Math.atan2(b.x - a.x, b.z - a.z);
    c.speed = SPECS[type].max * 0.5;
    cars.push(c);
  }
  const parkedTypes: CarType[] = ["sedan", "danfo", "keke", "okada", "danfo"];
  parkedTypes.forEach((t, k) => {
    const c = makeCar(id++, t, [], "parked");
    c.x = 6.6;
    c.z = 30 + k * 10;
    cars.push(c);
  });
  for (let k = 0; k < 8; k++) {
    const c = makeCar(id++, "police", [], "police");
    c.active = false;
    cars.push(c);
  }
  const peds = Array.from({ length: 56 }, (_, i) => {
    const route = W.sidewalks[Math.floor(Math.random() * W.sidewalks.length)];
    const idx = Math.floor(Math.random() * 4);
    const a = route[idx], b = route[(idx + 1) % 4];
    const f = Math.random();
    return {
      id: i, route, idx: (idx + 1) % 4, dir: 1 as const, x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, y: 0, h: 0,
      vx: 0, vy: 0, vz: 0, pitch: 0, roll: 0, spinX: 0, spinZ: 0, rollTarget: 0,
      avoidance: 0, stumble: 0, hitCooldown: 0,
      speed: 1.1 + Math.random() * 0.7, dead: 0, color: PED_COLORS[i % PED_COLORS.length],
      wrap: Math.random() < 0.35 ? PED_COLORS[(i * 3 + 2) % PED_COLORS.length] : null, obj: null, phase: Math.random() * 6,
    };
  });
  return {
    player: { x: SPAWN.x, y: 0, z: SPAWN.z, yaw: Math.PI / 2, pitch: 0, vy: 0, onGround: true, health: 100, stamina: 100, bob: 0, moving: false },
    car: null, cash: 500, heat: 0, cars, peds,
    offers: { courier: { x: 10, z: 60 }, taxi: randomSidewalkPoint(W) },
    mission: null, msgs: [], prompt: "", camMode: 0, wasted: 0, locked: false, spawnCd: 0, time: 0,
    markers: { courier: null, taxi: null, drop: null },
  };
}

export function msg(S: GameState, text: string, t = 3.5) {
  S.msgs.push({ text, t });
  if (S.msgs.length > 4) S.msgs.shift();
}

const stars = (S: GameState) => Math.min(5, Math.floor(S.heat));
const pos = (S: GameState) => (S.car ? S.car : S.player);

export function step(S: GameState, W: World, I: Input, dt: number, A: GameAudio) {
  S.time += dt;
  for (const m of S.msgs) m.t -= dt;
  S.msgs = S.msgs.filter((m) => m.t > 0);
  if (S.wasted > 0) {
    S.wasted -= dt;
    A.setEngine(false, 0);
    A.setSiren(0);
    if (S.wasted <= 0) respawn(S);
    return;
  }
  const pr = (c: string) => I.pressed.has(c);
  if (pr("KeyC")) S.camMode = S.camMode ? 0 : 1;
  if (pr("KeyH")) A.horn();
  if (pr("KeyR")) { A.toggleRadio(); msg(S, A.radioOn ? A.stationName : "Radio off"); }
  if (pr("KeyT")) { A.nextStation(); msg(S, A.stationName); }
  if (pr("KeyE") || pr("KeyF")) toggleCar(S, W, A);

  if (S.car) drive(S, W, I, dt, A);
  else walk(S, W, I, dt);
  traffic(S, W, dt, A);
  police(S, W, dt, A);
  peds(S, dt, A);
  missions(S, W, dt, A);

  // heat
  const pp = pos(S);
  const seen = S.cars.some((c) => c.ai === "police" && c.active && Math.hypot(c.x - pp.x, c.z - pp.z) < 55);
  if (!seen && S.heat > 0) S.heat = Math.max(0, S.heat - dt * 0.07);
  if (seen && S.car && Math.abs(S.car.speed) > 30 && S.heat < 1) S.heat += dt * 0.35;
  S.heat = Math.min(S.heat, 5.99);
  if (S.heat < 1) S.player.health = Math.min(100, S.player.health + dt * 2);

  A.setEngine(!!S.car, S.car ? Math.abs(S.car.speed) / SPECS[S.car.type].max : 0);
  let nearest = 999;
  for (const c of S.cars) if (c.ai === "police" && c.active && stars(S) > 0) nearest = Math.min(nearest, Math.hypot(c.x - pp.x, c.z - pp.z));
  A.setSiren(clamp(1 - nearest / 160, 0, 1));

  // prompt
  S.prompt = "";
  if (!S.car) {
    const c = nearestCar(S);
    if (c) S.prompt = `Press E to ${c.ai === "parked" ? "enter" : "hijack"} ${SPECS[c.type].name}`;
  }
  if (S.player.health <= 0) {
    S.player.health = 0;
    S.wasted = 4;
    if (S.car) { S.car.ai = "parked"; S.car = null; }
  }
}

function respawn(S: GameState) {
  const p = S.player;
  Object.assign(p, { x: SPAWN.x, y: 0, z: SPAWN.z, health: 100, stamina: 100, vy: 0, yaw: Math.PI / 2, pitch: 0 });
  const fee = Math.floor(S.cash * 0.1);
  S.cash -= fee;
  S.heat = 0;
  S.mission = null;
  for (const c of S.cars) if (c.ai === "police") c.active = false;
  msg(S, `Hospital bill: -₦${fee}`);
}

function nearestCar(S: GameState) {
  let best: Car | null = null, bd = 1e9;
  for (const c of S.cars) {
    if (!c.active || c.ai === "player") continue;
    const d = Math.hypot(c.x - S.player.x, c.z - S.player.z) - SPECS[c.type].r;
    if (d < 2.6 && d < bd) { bd = d; best = c; }
  }
  return best;
}

function toggleCar(S: GameState, W: World, A: GameAudio) {
  const p = S.player;
  if (S.car) {
    const c = S.car;
    const sp = SPECS[c.type];
    for (const side of [1, -1]) {
      const rx = -Math.cos(c.h) * side, rz = Math.sin(c.h) * side;
      const t = { x: c.x + rx * (sp.wid / 2 + 1), z: c.z + rz * (sp.wid / 2 + 1) };
      if (inWorld(t.x, t.z)) { p.x = t.x; p.z = t.z; break; }
    }
    pushOut(p, 0.4, W.colliders);
    c.ai = "parked";
    S.car = null;
    p.y = c.y ?? 0;
    p.yaw = c.h + Math.PI;
    p.pitch = 0;
    return;
  }
  const c = nearestCar(S);
  if (!c) return;
  if (c.ai === "traffic") { S.heat += 0.8; msg(S, `Carjacked a ${SPECS[c.type].name}!`); A.horn(0.6); }
  if (c.ai === "police") { S.heat += 1.5; msg(S, "You stole a police cruiser!"); }
  c.vx = Math.sin(c.h) * c.speed;
  c.vz = Math.cos(c.h) * c.speed;
  c.ai = "player";
  c.stun = 0;
  S.car = c;
}

function walk(S: GameState, W: World, I: Input, dt: number) {
  const p = S.player;
  p.yaw -= I.mdx * 0.0022;
  p.pitch = clamp(p.pitch - I.mdy * 0.0022, -1.4, 1.4);
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  let mx = 0, mz = 0;
  const k = I.keys;
  if (k.has("KeyW")) { mx += fx; mz += fz; }
  if (k.has("KeyS")) { mx -= fx; mz -= fz; }
  if (k.has("KeyD")) { mx += rx; mz += rz; }
  if (k.has("KeyA")) { mx -= rx; mz -= rz; }
  const len = Math.hypot(mx, mz);
  p.moving = len > 0;
  const sprint = p.moving && (k.has("ShiftLeft") || k.has("ShiftRight")) && p.stamina > 1;
  p.stamina = clamp(p.stamina + (sprint ? -28 : 16) * dt, 0, 100);
  const speed = sprint ? 9.5 : 4.6;
  const px = p.x, pz = p.z;
  if (len > 0) { p.x += (mx / len) * speed * dt; p.z += (mz / len) * speed * dt; }
  const elevW = deckY(p.x, p.z) > 1 && p.y > 1;
  if (elevW) p.z = clamp(p.z, FLYOVER_Z - 5.6, FLYOVER_Z + 5.6);
  else pushOut(p, 0.4, W.colliders);
  for (const c of S.cars) {
    if (!c.active || Math.abs((c.y ?? 0) - p.y) > 2) continue;
    const r = SPECS[c.type].r + 0.4;
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
    if (d < r && d > 0.001) { p.x = c.x + (dx / d) * r; p.z = c.z + (dz / d) * r; }
  }
  if (!inWorld(p.x, p.z)) { p.x = px; p.z = pz; }
  if (k.has("Space") && p.onGround) { p.vy = 6.5; p.onGround = false; }
  p.vy -= 20 * dt;
  p.y += p.vy * dt;
  const gY = surfaceY(p.y + 0.5, p.x, p.z);
  if (p.y <= gY) { p.y = gY; p.vy = 0; p.onGround = true; }
  if (p.moving && p.onGround) p.bob += dt * (sprint ? 15 : 9);
}

function drive(S: GameState, W: World, I: Input, dt: number, A: GameAudio) {
  const c = S.car!;
  const sp = SPECS[c.type];
  const k = I.keys;
  const sh = Math.sin(c.h), ch = Math.cos(c.h);
  let f = c.vx * sh + c.vz * ch;
  let l = c.vx * ch - c.vz * sh;
  const hand = k.has("Space");
  const thr = k.has("KeyW") || k.has("ArrowUp");
  const brk = k.has("KeyS") || k.has("ArrowDown");
  if (thr) f += sp.accel * dt * (f < 0 ? 2 : 1);
  if (brk) f -= (f > 0.5 ? sp.accel * 2.2 : sp.accel * 0.6) * dt;
  f *= Math.exp(-(thr || brk ? 0.25 : 0.7) * dt);
  f = clamp(f, -9, sp.max);
  let steer = 0;
  if (k.has("KeyA") || k.has("ArrowLeft")) steer += 1;
  if (k.has("KeyD") || k.has("ArrowRight")) steer -= 1;
  const sf = clamp(f / 7, -1, 1) * (1 - Math.min(Math.abs(f) / sp.max, 1) * 0.35);
  c.h += steer * sp.turn * (hand ? 1.6 : 1) * sf * dt;
  l *= Math.exp(-(hand ? 1.4 : 9) * dt);
  if (hand) f *= Math.exp(-1.0 * dt);
  const nh = Math.sin(c.h), nc = Math.cos(c.h);
  c.vx = nh * f + nc * l;
  c.vz = nc * f - nh * l;
  const px = c.x, pz = c.z;
  c.x += c.vx * dt;
  c.z += c.vz * dt;
  const before = Math.hypot(c.vx, c.vz);
  c.y = surfaceY(c.y ?? 0, c.x, c.z);
  if (c.y! > 1) {
    const lo = FLYOVER_Z - 5.6 + sp.wid / 2, hi = FLYOVER_Z + 5.6 - sp.wid / 2;
    if (c.z < lo || c.z > hi) { c.z = clamp(c.z, lo, hi); c.vz *= -0.2; }
  } else if (pushOut(c, sp.r, W.colliders)) {
    c.vx = ((c.x - px) / dt) * 0.85;
    c.vz = ((c.z - pz) / dt) * 0.85;
    const after = Math.hypot(c.vx, c.vz);
    if (before - after > 10 && c.hitCd <= 0) { A.crash(); S.player.health -= (before - after) * 0.6; c.hitCd = 0.6; }
  }
  if (!inWorld(c.x, c.z)) { c.x = px; c.z = pz; c.vx *= -0.3; c.vz *= -0.3; }
  if (c.hitCd > 0) c.hitCd -= dt;
  c.speed = c.vx * nh + c.vz * nc;

  for (const o of S.cars) {
    if (o === c || !o.active || Math.abs((o.y ?? 0) - (c.y ?? 0)) > 2) continue;
    const rr = sp.r + SPECS[o.type].r;
    const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz);
    if (d >= rr || d < 0.001) continue;
    const nx = dx / d, nz = dz / d, ov = rr - d;
    c.x -= nx * ov * 0.4; c.z -= nz * ov * 0.4;
    o.x += nx * ov * 0.6; o.z += nz * ov * 0.6;
    const ovx = o.ai === "traffic" ? Math.sin(o.h) * o.speed : o.vx;
    const ovz = o.ai === "traffic" ? Math.cos(o.h) * o.speed : o.vz;
    const rel = (c.vx - ovx) * nx + (c.vz - ovz) * nz;
    if (rel > 6 && o.hitCd <= 0) {
      A.crash();
      o.hitCd = 1;
      if (o.ai === "traffic" || o.ai === "parked") {
        S.heat += 0.35;
        if (o.ai === "traffic") { o.stun = 2.5; o.speed = 0; }
        o.vx = c.vx * 0.6 + nx * 4; o.vz = c.vz * 0.6 + nz * 4;
      } else if (o.ai === "police") S.heat += 0.6;
      if (rel > 16) S.player.health -= (rel - 16) * 1.2;
      c.vx *= 0.5; c.vz *= 0.5;
    }
  }
}

function traffic(S: GameState, W: World, dt: number, A: GameAudio) {
  const pp = pos(S);
  for (const c of S.cars) {
    if (!c.active) continue;
    if (c.hitCd > 0 && c.ai !== "player") c.hitCd -= dt;
    if (c.ai === "parked") {
      c.x += c.vx * dt; c.z += c.vz * dt;
      const k = Math.exp(-1.6 * dt);
      c.vx *= k; c.vz *= k;
      if (Math.abs(c.vx) + Math.abs(c.vz) > 0.1) pushOut(c, SPECS[c.type].r, W.colliders);
      continue;
    }
    if (c.ai !== "traffic") continue;
    if (c.stun > 0) {
      c.stun -= dt;
      c.x += c.vx * dt; c.z += c.vz * dt;
      const k = Math.exp(-3 * dt);
      c.vx *= k; c.vz *= k;
      continue;
    }
    const sp = SPECS[c.type];
    const t = c.route[c.idx];
    const dx = t.x - c.x, dz = t.z - c.z;
    if (Math.hypot(dx, dz) < 4) c.idx = (c.idx + 1) % c.route.length;
    const diff = wrapA(Math.atan2(dx, dz) - c.h);
    c.h += clamp(diff, -2.2 * dt, 2.2 * dt);
    let desired = sp.max * 0.55 * (Math.abs(diff) > 0.5 ? 0.4 : 1);
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    const cy = c.y ?? 0;
    if (cy < 1) {
      const ph = lightPhase(S.time);
      const st = Math.abs(fz) > 0.85 ? ph.ns : Math.abs(fx) > 0.85 ? ph.ew : "g";
      if (st !== "g") for (const L of LIGHTS) {
        const rx = L.x - c.x, rz = L.z - c.z;
        const along = rx * fx + rz * fz;
        if (along > 8 && along < 15 && Math.abs(rx * -fz + rz * fx) < 8) { desired = 0; break; }
      }
    }
    let blocked = false;
    const check = (ox: number, oz: number, oy = 0) => {
      if (Math.abs(oy - cy) > 2) return;
      const rx = ox - c.x, rz = oz - c.z;
      const along = rx * fx + rz * fz;
      const lat = Math.abs(rx * -fz + rz * fx);
      if (along > 0 && along < 9 && lat < 2.2) blocked = true;
    };
    for (const o of S.cars) if (o !== c && o.active) check(o.x, o.z, o.y ?? 0);
    check(pp.x, pp.z, S.car ? S.car.y ?? 0 : S.player.y);
    if (blocked) {
      c.blocked += dt;
      if (c.blocked < 5) desired = 0;
      if (c.blocked > 1.5 && Math.random() < dt * 0.3 && Math.hypot(c.x - pp.x, c.z - pp.z) < 25) A.horn(0.25);
    } else c.blocked = 0;
    c.speed += clamp(desired - c.speed, -16 * dt, 6 * dt);
    c.x += fx * c.speed * dt;
    c.z += fz * c.speed * dt;
    c.y = surfaceY(cy, c.x, c.z);
  }
}

function police(S: GameState, W: World, dt: number, A: GameAudio) {
  const st = stars(S);
  const pp = pos(S);
  const target = st === 0 ? 0 : Math.min(8, st * 2 - 1);
  const pol = S.cars.filter((c) => c.ai === "police");
  let active = pol.filter((c) => c.active).length;
  S.spawnCd -= dt;
  if (active < target && S.spawnCd <= 0) {
    const c = pol.find((x) => !x.active);
    const ang = Math.random() * Math.PI * 2;
    let x = pp.x + Math.cos(ang) * 90, z = pp.z + Math.sin(ang) * 90;
    const nx = LINES.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
    const nz = LINES.reduce((a, b) => (Math.abs(b - z) < Math.abs(a - z) ? b : a));
    if (Math.abs(nx - x) < Math.abs(nz - z)) x = nx + 4; else z = nz + 4;
    x = clamp(x, -205, 205); z = clamp(z, -205, 205);
    if (c && inWorld(x, z)) {
      Object.assign(c, { x, z, active: true, speed: 0, vx: 0, vz: 0, stun: 0, blocked: 0, h: Math.atan2(pp.x - x, pp.z - z) });
      active++;
      S.spawnCd = 2.5;
    }
  }
  const ps = S.car ? SPECS[S.car.type].r : 0.5;
  for (const c of pol) {
    if (!c.active) continue;
    const dx = pp.x - c.x, dz = pp.z - c.z, d = Math.hypot(dx, dz);
    if ((st === 0 && d > 45) || d > 230) { c.active = false; continue; }
    c.lights.forEach((m, i) => (m.emissiveIntensity = st > 0 && Math.floor(S.time * 6 + i) % 2 === 0 ? 2.5 : 0.1));
    const sp = SPECS.police;
    let desired = 0;
    if (c.stun > 0) {
      c.stun -= dt;
      c.speed = -7;
      c.h += 1.6 * dt;
    } else {
      const diff = wrapA(Math.atan2(dx, dz) - c.h);
      c.h += clamp(diff, -2.4 * dt, 2.4 * dt);
      desired = st > 0 ? (d > 14 ? sp.max * 0.8 : 9) : 0;
      if (Math.abs(diff) > 1.2) desired *= 0.5;
      c.speed += clamp(desired - c.speed, -18 * dt, sp.accel * dt);
    }
    const px = c.x, pz = c.z;
    c.x += Math.sin(c.h) * c.speed * dt;
    c.z += Math.cos(c.h) * c.speed * dt;
    pushOut(c, sp.r, W.colliders);
    if (!inWorld(c.x, c.z)) { c.x = px; c.z = pz; }
    const moved = Math.hypot(c.x - px, c.z - pz);
    if (desired > 5 && moved < desired * dt * 0.25) c.blocked += dt; else c.blocked = 0;
    if (c.blocked > 1) { c.stun = 1.2; c.blocked = 0; }
    c.vx = Math.sin(c.h) * c.speed;
    c.vz = Math.cos(c.h) * c.speed;
    // contact
    if (d < sp.r + ps + 0.4 && st > 0) {
      S.player.health -= (S.car ? 6 : 14) * dt;
      if (!S.car && d > 0.01) { S.player.x = c.x + (dx / d) * (sp.r + 0.9); S.player.z = c.z + (dz / d) * (sp.r + 0.9); }
    }
    if (st >= 4 && d < 35) S.player.health -= (st - 3) * 2.5 * dt;
  }
}

function peds(S: GameState, dt: number, A: GameAudio) {
  const playerCar = S.car;
  for (const p of S.peds) {
    p.hitCooldown = Math.max(0, p.hitCooldown - dt);
    if (p.dead > 0) {
      p.dead -= dt;
      p.vy -= 12 * dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.vx *= Math.exp(-2.2 * dt);
      p.vz *= Math.exp(-2.2 * dt);
      p.spinX *= Math.exp(-3.4 * dt);
      p.spinZ *= Math.exp(-3.4 * dt);
      p.pitch += p.spinX * dt;
      p.roll += p.spinZ * dt;
      if (p.y <= 0) {
        p.y = 0;
        if (p.vy < -2) p.vy = -p.vy * 0.16;
        else p.vy = 0;
        p.pitch *= Math.exp(-5 * dt);
        p.roll *= Math.exp(-5 * dt);
      }
      if (p.dead <= 0) {
        const a = p.route[p.idx];
        p.x = a.x; p.z = a.z; p.y = 0; p.vx = 0; p.vy = 0; p.vz = 0;
        p.pitch = 0; p.roll = 0; p.spinX = 0; p.spinZ = 0;
      }
      continue;
    }
    if (p.stumble > 0) {
      p.stumble = Math.max(0, p.stumble - dt);
      p.x += p.vx * dt; p.z += p.vz * dt;
      const damp = Math.exp(-5 * dt);
      p.vx *= damp; p.vz *= damp;
      p.roll += (p.rollTarget - p.roll) * (1 - Math.exp(-8 * dt));
      if (p.stumble === 0) { p.vx = 0; p.vz = 0; p.rollTarget = 0; }
      p.phase += dt * p.speed * 2;
      continue;
    }
    const t = p.route[p.idx];
    const dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.75) p.idx = (p.idx + p.dir + 4) % 4;
    const target = p.route[p.idx];
    const tx = target.x - p.x, tz = target.z - p.z, td = Math.hypot(tx, tz);
    let desiredX = td > 0.001 ? (tx / td) * p.speed : 0;
    let desiredZ = td > 0.001 ? (tz / td) * p.speed : 0;

    // Steer aside from nearby pedestrians instead of letting sidewalk crowds overlap.
    for (const other of S.peds) {
      if (other === p || other.dead > 0) continue;
      const ox = p.x - other.x, oz = p.z - other.z, od = Math.hypot(ox, oz);
      if (od > 0.001 && od < 0.95) {
        const strength = (0.95 - od) * 1.7;
        desiredX += (ox / od) * strength;
        desiredZ += (oz / od) * strength;
      }
    }

    let threatDistance = Infinity;
    let threatCar: Car | null = null;
    for (const car of S.cars) {
      if (!car.active || car.ai === "parked") continue;
      const cx = p.x - car.x, cz = p.z - car.z, cd = Math.hypot(cx, cz);
      const speed = car.ai === "traffic" ? Math.abs(car.speed) : Math.hypot(car.vx, car.vz);
      if (cd > 11 || speed < 2) continue;
      const ch = car.ai === "traffic" ? car.h : Math.atan2(car.vx, car.vz);
      const fx = Math.sin(ch), fz = Math.cos(ch);
      const along = cx * fx + cz * fz;
      const lateral = Math.abs(cx * fz - cz * fx);
      if (along < -1 || along > 10 || lateral > SPECS[car.type].r + 0.85 || cd >= threatDistance) continue;
      threatDistance = cd;
      threatCar = car;
    }

    if (threatCar) {
      const carSpeed = threatCar.ai === "traffic" ? Math.abs(threatCar.speed) : Math.hypot(threatCar.vx, threatCar.vz);
      const carHeading = threatCar.ai === "traffic" ? threatCar.h : Math.atan2(threatCar.vx, threatCar.vz);
      if (threatDistance < SPECS[threatCar.type].r + 1 && playerCar === threatCar && carSpeed > 4 && p.hitCooldown <= 0) {
        const impactX = Math.sin(carHeading), impactZ = Math.cos(carHeading);
        p.dead = 5.5;
        p.vx = impactX * Math.min(9, carSpeed * 0.55);
        p.vz = impactZ * Math.min(9, carSpeed * 0.55);
        p.vy = Math.min(4.8, 1.2 + carSpeed * 0.18);
        p.spinX = 5.5 + carSpeed * 0.18;
        p.spinZ = (p.id % 2 === 0 ? 1 : -1) * (2.5 + carSpeed * 0.12);
        p.hitCooldown = 1;
        S.heat += 1;
        A.thud();
        if (S.heat < 2) msg(S, "You hit a pedestrian! Police alerted.");
        continue;
      }
      if (threatDistance < 3.1) {
        p.avoidance = Math.min(1, p.avoidance + dt * 5);
        const side = p.id % 2 === 0 ? 1 : -1;
        const sideX = Math.cos(carHeading) * side, sideZ = -Math.sin(carHeading) * side;
        desiredX += sideX * (1.8 + p.avoidance * 1.2);
        desiredZ += sideZ * (1.8 + p.avoidance * 1.2);
        if (threatDistance < 1.5 && carSpeed < 4 && playerCar === threatCar) {
          p.stumble = 0.7;
          p.vx = sideX * 1.6;
          p.vz = sideZ * 1.6;
          p.rollTarget = side * -0.22;
        }
      } else if (threatDistance < 6) {
        p.avoidance = Math.min(1, p.avoidance + dt * 2);
        desiredX *= 0.2;
        desiredZ *= 0.2;
      }
    } else {
      p.avoidance = Math.max(0, p.avoidance - dt * 2.5);
    }

    const desiredSpeed = Math.hypot(desiredX, desiredZ);
    if (desiredSpeed > p.speed * 1.7) { desiredX *= (p.speed * 1.7) / desiredSpeed; desiredZ *= (p.speed * 1.7) / desiredSpeed; }
    const response = 1 - Math.exp(-5.5 * dt);
    p.vx += (desiredX - p.vx) * response;
    p.vz += (desiredZ - p.vz) * response;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    const targetHeading = Math.atan2(p.vx, p.vz);
    const turn = wrapA(targetHeading - p.h);
    p.h += clamp(turn, -3.8 * dt, 3.8 * dt);
    p.roll += (p.avoidance * (p.id % 2 === 0 ? -0.09 : 0.09) - p.roll) * (1 - Math.exp(-5 * dt));
    p.phase += dt * Math.hypot(p.vx, p.vz) * 5;
  }
}

function missions(S: GameState, W: World, dt: number, A: GameAudio) {
  const pp = pos(S);
  const speed = S.car ? Math.abs(S.car.speed) : 0;
  const far = () => {
    let p = randomSidewalkPoint(W);
    for (let i = 0; i < 20 && Math.hypot(p.x - pp.x, p.z - pp.z) < 120; i++) p = randomSidewalkPoint(W);
    return p;
  };
  const m = S.mission;
  if (!m) {
    if (Math.hypot(pp.x - S.offers.courier.x, pp.z - S.offers.courier.z) < 4) {
      const drop = far();
      const dist = Math.hypot(drop.x - pp.x, drop.z - pp.z);
      S.mission = { kind: "courier", drop, reward: Math.round(dist * 5 + 150), time: dist / 8 + 30 };
      msg(S, "Courier job: deliver the package to the pink marker!", 5);
    } else if (Math.hypot(pp.x - S.offers.taxi.x, pp.z - S.offers.taxi.z) < 6) {
      if (!S.car) S.prompt = "Taxi fares need a vehicle";
      else if (speed < 6) {
        const drop = far();
        const dist = Math.hypot(drop.x - pp.x, drop.z - pp.z);
        S.mission = { kind: "taxi", drop, reward: Math.round(dist * 8 + 200), time: dist / 12 + 30 };
        msg(S, "Passenger aboard! Drive to the pink marker.", 5);
      }
    }
    return;
  }
  m.time -= dt;
  const near = Math.hypot(pp.x - m.drop.x, pp.z - m.drop.z) < 6;
  if (m.kind === "taxi" && !S.car) { S.mission = null; msg(S, "Your passenger walked off. Fare lost."); return; }
  if (near && (m.kind === "courier" || speed < 5)) {
    S.cash += m.reward;
    A.cash();
    msg(S, `${m.kind === "taxi" ? "Fare paid" : "Delivered"}! +₦${m.reward}`, 4);
    S.mission = null;
    if (m.kind === "courier") S.offers.courier = randomSidewalkPoint(W);
    else S.offers.taxi = randomSidewalkPoint(W);
  } else if (m.time <= 0) {
    S.mission = null;
    msg(S, "Too slow! Job failed.");
  }
}
