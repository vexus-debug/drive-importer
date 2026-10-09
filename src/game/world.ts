import type { P } from "./types";

export interface Box { minX: number; maxX: number; minZ: number; maxZ: number }
export type BKind = "bank" | "office" | "hotel" | "residential" | "cafe" | "restaurant" | "shop" | "heritage";
export interface Building extends Box { h: number; color: string; heritage?: boolean; kind?: BKind; sign?: string; brand?: Brand }

export interface Brand { name: string; bg: string; fg: string; accent: string; mark: string; markFg: string }
const br = (name: string, bg: string, fg: string, accent: string, mark: string, markFg = fg): Brand => ({ name, bg, fg, accent, mark, markFg });
/** Real Lagos brands with their house colours; the logo badge is a stylised initial in brand colours. */
const BANKS = [
  br("ZENITH BANK", "#ffffff", "#e30613", "#e30613", "Z", "#ffffff"),
  br("GTCO", "#e35205", "#ffffff", "#ffffff", "GT", "#e35205"),
  br("FIRSTBANK", "#002f6c", "#ffffff", "#d4a017", "1", "#002f6c"),
  br("ACCESS BANK", "#ffffff", "#003b75", "#f68b1f", "A", "#ffffff"),
  br("UBA", "#d71920", "#ffffff", "#ffffff", "UBA", "#d71920"),
  br("STANBIC IBTC", "#0033a1", "#ffffff", "#ffffff", "S", "#0033a1"),
  br("FIDELITY BANK", "#002d72", "#ffffff", "#7ab800", "F", "#ffffff"),
  br("WEMA BANK", "#8a1c7c", "#ffffff", "#ffffff", "W", "#8a1c7c"),
  br("ECOBANK", "#004b87", "#ffffff", "#00a3ad", "e", "#ffffff"),
  br("STERLING", "#ffffff", "#d0021b", "#d0021b", "S", "#ffffff"),
];
const CAFES = [
  br("CAFE NEO", "#111111", "#ffffff", "#ffffff", "N", "#111111"),
  br("ART CAFE", "#2b1d14", "#f2d7a6", "#f2d7a6", "A", "#2b1d14"),
  br("COLD STONE", "#4b2e83", "#ffffff", "#e4a11b", "CS", "#4b2e83"),
  br("KRISPY KREME", "#00704a", "#ffffff", "#e2231a", "KK", "#ffffff"),
];
const FOOD = [
  br("CHICKEN REPUBLIC", "#e31b23", "#ffffff", "#ffd200", "CR", "#e31b23"),
  br("MR BIGGS", "#e2001a", "#ffde00", "#ffde00", "B", "#e2001a"),
  br("SWEET SENSATION", "#ffffff", "#c8102e", "#c8102e", "S", "#ffffff"),
  br("KILIMANJARO", "#d4111b", "#ffffff", "#ffc20e", "K", "#d4111b"),
  br("TANTALIZERS", "#00843d", "#ffffff", "#f7941d", "T", "#ffffff"),
  br("DOMINO'S PIZZA", "#006491", "#ffffff", "#e31837", "D", "#ffffff"),
  br("KFC", "#a3080c", "#ffffff", "#ffffff", "KFC", "#a3080c"),
  br("BUKKA HUT", "#1a1a1a", "#f6a01a", "#f6a01a", "BH", "#1a1a1a"),
  br("MAMA CASS", "#c8102e", "#ffffff", "#ffffff", "MC", "#c8102e"),
];
const HOTELS = [
  br("EKO HOTELS & SUITES", "#0b2341", "#d9b26f", "#d9b26f", "E", "#0b2341"),
  br("FEDERAL PALACE", "#1d1d1b", "#c9a227", "#c9a227", "FP", "#1d1d1b"),
  br("RADISSON BLU", "#ffffff", "#0b2341", "#0b2341", "R", "#ffffff"),
  br("LAGOS CONTINENTAL", "#14213d", "#ffffff", "#e5b25d", "LC", "#14213d"),
  br("THE ORIENTAL HOTEL", "#7a0e1a", "#f3d27a", "#f3d27a", "O", "#7a0e1a"),
  br("FOUR POINTS SHERATON", "#ffffff", "#5b2d82", "#5b2d82", "4P", "#ffffff"),
];
const RES = ["#f2e3c6", "#e8c39e", "#d9a07a", "#bfe0c8", "#f4d9a0", "#e6e1d3", "#c9dde8", "#f0c2b0"];

/** Zone each building into a Lagos typology: banks on Marina/Broad St, towers mid-island, homes and food spots elsewhere. */
function classifyBuildings(list: Building[]) {
  const r = rng(4242);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  for (const b of list) {
    if (b.heritage) { b.kind = "heritage"; continue; }
    const cz = (b.minZ + b.maxZ) / 2, cx = (b.minX + b.maxX) / 2;
    const finance = cz < -100 && cz > -200;
    if (cz > 400) { b.kind = r() < 0.4 ? "hotel" : "office"; }
    else if (b.h > 60) b.kind = "office";
    else if (b.h > 28) b.kind = finance || r() < 0.3 ? "bank" : r() < 0.4 ? "hotel" : "office";
    else if (b.h > 16) b.kind = finance && r() < 0.5 ? "bank" : r() < 0.25 ? "hotel" : "residential";
    else { const k = r(); b.kind = k < 0.22 ? "cafe" : k < 0.45 ? "restaurant" : k < 0.6 ? "shop" : "residential"; }
    if (Math.abs(cx - NECOM.x) < 1 && Math.abs(cz - NECOM.z) < 1) b.kind = "office";
    if (b.kind === "bank") { b.brand = pick(BANKS); b.sign = b.brand.name; }
    if (b.kind === "cafe") { b.brand = pick(CAFES); b.sign = b.brand.name; }
    if (b.kind === "restaurant") { b.brand = pick(FOOD); b.sign = b.brand.name; }
    if (b.kind === "hotel") { b.brand = pick(HOTELS); b.sign = b.brand.name; }
    if (b.kind === "residential") b.color = pick(RES);
    if (b.kind === "cafe" || b.kind === "restaurant") b.h = r() < 0.5 ? 4.5 : 7.5;
  }
}

/** Irregular street lines echoing Lagos Island: deep blocks between Marina and Broad St, tighter old-town blocks north. */
export const LINES = [-200, -120, 0, 80, 200];
export const FLYOVER_Z = -120;
const OLD = [-200, -100, 0, 100, 200];
/** Re-anchor a hand-placed spot (authored against the old even grid) onto the real street lines. */
function remap(v: number) {
  let k = 0;
  for (let i = 1; i < OLD.length; i++) if (Math.abs(OLD[i] - v) < Math.abs(OLD[k] - v)) k = i;
  return LINES[k] + (v - OLD[k]);
}
export const HALF_ROAD = 8;

/** Curving Marina expressway hugging the lagoon south of the grid; joins the grid corners at (±200, -200). */
export const MARINA_CURVE: P[] = Array.from({ length: 41 }, (_, i) => {
  const x = -200 + i * 10;
  return { x, z: -200 - 48 * Math.sin((Math.PI * (x + 200)) / 400) };
});
export function distToMarina(x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i < MARINA_CURVE.length - 1; i++) {
    const a = MARINA_CURVE[i], b = MARINA_CURVE[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)));
  }
  return best;
}

/** Angled old-town streets of Lagos Island that cut across the blocks at real-world bearings. */
export const DIAGONALS: { name: string; pts: P[] }[] = [
  { name: "Nnamdi Azikiwe St", pts: [{ x: -200, z: 200 }, { x: -150, z: 130 }, { x: -120, z: 80 }, { x: -60, z: 30 }, { x: 0, z: 0 }] },
  { name: "Docemo / Ereko St", pts: [{ x: -120, z: 0 }, { x: -85, z: -50 }, { x: -60, z: -90 }, { x: -30, z: -120 }] },
  { name: "Igbosere Rd", pts: [{ x: 80, z: 0 }, { x: 130, z: -45 }, { x: 165, z: -85 }, { x: 200, z: -120 }] },
  { name: "Tinubu Square Link", pts: [{ x: 0, z: -120 }, { x: 35, z: -70 }, { x: 60, z: -30 }, { x: 80, z: 0 }] },
  { name: "Adeniji Adele Rd", pts: [{ x: 80, z: 200 }, { x: 120, z: 150 }, { x: 160, z: 110 }, { x: 200, z: 80 }] },
];
function nearDiagonal(b: { minX: number; maxX: number; minZ: number; maxZ: number }, pad: number) {
  for (const d of DIAGONALS)
    for (let i = 0; i < d.pts.length - 1; i++) {
      const a = d.pts[i], c = d.pts[i + 1];
      const n = Math.ceil(Math.hypot(c.x - a.x, c.z - a.z) / 2);
      for (let k = 0; k <= n; k++) {
        const x = a.x + ((c.x - a.x) * k) / n, z = a.z + ((c.z - a.z) * k) / n;
        if (x > b.minX - pad && x < b.maxX + pad && z > b.minZ - pad && z < b.maxZ + pad) return true;
      }
    }
  return false;
}

export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = ["#efe0c2", "#ddb27a", "#c9785a", "#8fbfa8", "#e8c66a", "#e3dccb", "#a9c4cf", "#c08a7a", "#e2a46c", "#a8c69b"];
const HERITAGE = ["#e6c27a", "#d98f6a", "#b9d8bf", "#c97c5d", "#efe3c8", "#d6b46a", "#9fc7b0"];
const STALL = ["#e63946", "#f4a261", "#2a9d8f", "#e9c46a", "#457b9d", "#8ac926", "#ff6b9a"];
const SIGNS: [string, string, string][] = [
  ["WELCOME TO LAGOS ISLAND", "#0b6e4f", "#ffffff"],
  ["BALOGUN MARKET", "#d62828", "#fcbf49"],
  ["GO-SLOW? NO WAHALA", "#fcbf49", "#1d3557"],
  ["MAMA PUT - BROAD ST", "#2a9d8f", "#fefae0"],
  ["SUYA SPOT IDUMOTA", "#6a040f", "#ffba08"],
  ["EKO O NI BAJE", "#1d3557", "#f1faee"],
  ["CMS BUS TERMINAL", "#ffd60a", "#000814"],
  ["POS / BUREAU DE CHANGE", "#7b2cbf", "#ffd6ff"],
];
/** Real Lagos Island street names mapped onto the road lines (z = horizontal, x = vertical). */
export const STREET_Z: Record<number, string> = { [-200]: "Marina", [-120]: "Broad Street", 0: "Martins Street", 80: "Nnamdi Azikiwe St", 200: "Ebute Ero / Carter Bridge Rd" };
export const STREET_X: Record<number, string> = { [-200]: "Idumota Rd", [-120]: "Balogun St", 0: "Odunlami St", 80: "Joseph St", 200: "CMS / Bishop Crowther" };
export const NECOM = { x: 50, z: 50, w: 16, h: 95 };
export const GPT_COLORS = ["#1a1a1a", "#2a2a2a", "#1d4ed8", "#111"];

export function buildWorld() {
  const r = rng(1337);
  const buildings: Building[] = [];
  const colliders: Box[] = [];
  const palms: P[] = [];
  const stalls: { x: number; z: number; color: string }[] = [];
  const billboards: { x: number; z: number; rot: number; text: string; bg: string; fg: string }[] = [];
  const sidewalks: P[][] = [];
  const blocks: Box[] = [];
  const routes: P[][] = [];

  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const a = LINES[i], b = LINES[i + 1], c = LINES[j], d = LINES[j + 1];
      blocks.push({ minX: a + 8, maxX: b - 8, minZ: c + 8, maxZ: d - 8 });
      sidewalks.push([{ x: a + 10, z: c + 10 }, { x: b - 10, z: c + 10 }, { x: b - 10, z: d - 10 }, { x: a + 10, z: d - 10 }]);
      const market = i === 1 && j === 3;
      if (market) {
        for (let gx = 0; gx < 6; gx++)
          for (let gz = 0; gz < 5; gz++) {
            const x = a + 20 + gx * 12, z = c + 20 + gz * 14;
            stalls.push({ x, z, color: STALL[Math.floor(r() * STALL.length)] });
            colliders.push({ minX: x - 1.6, maxX: x + 1.6, minZ: z - 1.2, maxZ: z + 1.2 });
          }
      } else {
        const cell = (b - a - 24) / 3;
        for (let cx = 0; cx < 3; cx++)
          for (let cz = 0; cz < 3; cz++) {
            if (r() > 0.85) continue;
            const w = Math.min(12 + r() * 10, cell - 1.5), dp = Math.min(12 + r() * 10, cell - 1.5);
            const h = 6 + r() * r() * 45;
            const mx = a + 12 + cell * (cx + 0.5) + (r() - 0.5) * (cell - w) * 0.8;
            const mz = c + 12 + cell * (cz + 0.5) + (r() - 0.5) * (cell - dp) * 0.8;
            const bd = { minX: mx - w / 2, maxX: mx + w / 2, minZ: mz - dp / 2, maxZ: mz + dp / 2 };
            // Brazilian Quarter (Campos / Popo Aguda): low Afro-Brazilian heritage houses in the west blocks
            const heritage = i === 0 && j < 3 && r() < 0.7;
            if (heritage) buildings.push({ ...bd, h: 7 + r() * 2, color: HERITAGE[Math.floor(r() * HERITAGE.length)], heritage: true });
            else buildings.push({ ...bd, h, color: PALETTE[Math.floor(r() * PALETTE.length)] });
            colliders.push(bd);
          }
      }
      // palms along sidewalks
      for (let t = a + 18; t < b - 14; t += 16) {
        if (r() < 0.55) palms.push({ x: t, z: c + 11.2 });
        if (r() < 0.55) palms.push({ x: t, z: d - 11.2 });
      }
      for (let t = c + 18; t < d - 14; t += 16) {
        if (r() < 0.4) palms.push({ x: a + 11.2, z: t });
        if (r() < 0.4) palms.push({ x: b - 11.2, z: t });
      }
    }
  for (const p of palms) colliders.push({ minX: p.x - 0.3, maxX: p.x + 0.3, minZ: p.z - 0.3, maxZ: p.z + 0.3 });

  // billboards
  const spots: [number, number, number][] = [
    [30, -89, 0], [-60, 11, Math.PI], [150, 111, Math.PI], [-150, -11, 0], [60, 189, 0], [-30, -111, 0], [111, 50, -Math.PI / 2], [-89, 140, Math.PI / 2],
  ];
  spots.forEach(([x, z, rot], k) => billboards.push({ x: remap(x), z: remap(z), rot, text: SIGNS[k][0], bg: SIGNS[k][1], fg: SIGNS[k][2] }));

  // NECOM House landmark: clear its plot, then add the tower
  {
    const n = { minX: NECOM.x - NECOM.w / 2, maxX: NECOM.x + NECOM.w / 2, minZ: NECOM.z - NECOM.w / 2, maxZ: NECOM.z + NECOM.w / 2 };
    const hit = (b: Box) => b.maxX > n.minX - 4 && b.minX < n.maxX + 4 && b.maxZ > n.minZ - 4 && b.minZ < n.maxZ + 4;
    for (let k = buildings.length - 1; k >= 0; k--) if (hit(buildings[k])) buildings.splice(k, 1);
    for (let k = colliders.length - 1; k >= 0; k--) if (hit(colliders[k])) colliders.splice(k, 1);
    buildings.push({ ...n, h: NECOM.h, color: "#d8d4cc" });
    colliders.push(n);
  }

  // Danfo bus stops (yellow shelters) on sidewalks
  const busStops: { x: number; z: number; rot: number; name: string }[] = [];
  const stopNames = ["CMS", "OBALENDE", "MARINA", "BROAD ST", "IDUMOTA", "TBS", "OYINGBO", "LEKKI"];
  const stopSpots: [number, number, number][] = [[40, 11, 0], [-150, -89, Math.PI], [140, 189, Math.PI], [-60, 111, 0], [11, -150, Math.PI / 2], [-111, 60, Math.PI / 2], [160, -11, Math.PI], [-170, 189, Math.PI]];
  stopSpots.forEach(([x, z, rot], k) => {
    busStops.push({ x: remap(x), z: remap(z), rot, name: stopNames[k] });
  });

  // concrete utility poles along sidewalks
  const poles: P[] = [];
  for (const L of sidewalks)
    for (let e = 0; e < 4; e++) {
      const a = L[e], b = L[(e + 1) % 4];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      for (let t = 9; t < len - 5; t += 28) {
        const x = a.x + ((b.x - a.x) * t) / len, z = a.z + ((b.z - a.z) * t) / len;
        // push slightly toward road
        const ox = Math.abs(b.x - a.x) > 1 ? 0 : x > (L[0].x + L[1].x) / 2 ? 1 : -1;
        const oz = Math.abs(b.z - a.z) > 1 ? 0 : z > (L[1].z + L[2].z) / 2 ? 1 : -1;
        const p = { x: x + ox * 0.9, z: z + oz * 0.9 };
        poles.push(p);
        colliders.push({ minX: p.x - 0.2, maxX: p.x + 0.2, minZ: p.z - 0.2, maxZ: p.z + 0.2 });
      }
    }

  // island towers (Victoria Island / Eko Atlantic)
  const isl: [number, number, number][] = [[-35, 445, 70], [35, 450, 55], [-38, 495, 42], [36, 497, 80], [0, 505, 30]];
  for (const [x, z, h] of isl) {
    const bd = { minX: x - 9, maxX: x + 9, minZ: z - 9, maxZ: z + 9 };
    buildings.push({ ...bd, h, color: "#8fb8de" });
    colliders.push(bd);
  }

  // overpass pillars (Marina expressway) along z=-100
  const pillars: P[] = [];
  for (let x = -150; x <= 150; x += 25) {
    pillars.push({ x, z: FLYOVER_Z });
    colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: FLYOVER_Z - 0.7, maxZ: FLYOVER_Z + 0.7 });
  }
  // bridge rails
  colliders.push({ minX: -9, maxX: -7.8, minZ: 214, maxZ: 418 });
  colliders.push({ minX: 7.8, maxX: 9, minZ: 214, maxZ: 418 });

  // clear corridors for the angled streets
  const pad = 10;
  const keep = <T extends Box>(arr: T[]) => { for (let k = arr.length - 1; k >= 0; k--) if (nearDiagonal(arr[k], pad)) arr.splice(k, 1); };
  keep(buildings); keep(colliders);
  const ptBox = (p: P) => ({ minX: p.x, maxX: p.x, minZ: p.z, maxZ: p.z });
  for (const arr of [stalls, palms, poles, busStops, billboards] as P[][]) for (let k = arr.length - 1; k >= 0; k--) if (nearDiagonal(ptBox(arr[k]), pad)) arr.splice(k, 1);
  for (const d of DIAGONALS) {
    const off = (s: number) => d.pts.map((p, i) => {
      const a = d.pts[Math.max(0, i - 1)], b = d.pts[Math.min(d.pts.length - 1, i + 1)];
      const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      return { x: p.x - ((b.z - a.z) / L) * s, z: p.z + ((b.x - a.x) / L) * s };
    });
    routes.push([...off(-4), ...off(4).reverse()]);
  }

  // traffic routes: rectangles on the road grid, both directions
  const rects: [number, number, number, number][] = [];
  for (let k = 0; k < 10; k++) {
    let i1 = Math.floor(r() * 4), i2 = i1 + 1 + Math.floor(r() * (4 - i1));
    let j1 = Math.floor(r() * 4), j2 = j1 + 1 + Math.floor(r() * (4 - j1));
    if (i2 > 4) i2 = 4;
    if (j2 > 4) j2 = 4;
    rects.push([LINES[i1], LINES[i2], LINES[j1], LINES[j2]]);
  }
  rects.push([-200, 200, -200, 200]);
  for (const [x1, x2, z1, z2] of rects) {
    routes.push([{ x: x1 + 4, z: z1 + 4 }, { x: x2 - 4, z: z1 + 4 }, { x: x2 - 4, z: z2 - 4 }, { x: x1 + 4, z: z2 - 4 }]);
    routes.push([{ x: x1 - 4, z: z1 - 4 }, { x: x1 - 4, z: z2 + 4 }, { x: x2 + 4, z: z2 + 4 }, { x: x2 + 4, z: z1 - 4 }]);
  }
  // Marina lagoon curve, both directions (joins grid at its south corners)
  routes.push([...MARINA_CURVE.map((p) => ({ x: p.x, z: p.z - 4 })), { x: 196, z: -196 }, { x: -196, z: -196 }]);
  routes.push([...[...MARINA_CURVE].reverse().map((p) => ({ x: p.x, z: p.z + 4 })), { x: -204, z: -204 }]);
  // Third Mainland-style bridge loop
  routes.push([{ x: 4, z: 196 }, { x: 4, z: 472 }, { x: -4, z: 472 }, { x: -4, z: 196 }]);

  // yellow steel-truss pedestrian footbridges over the Marina expressway (z=-100)
  const footbridges: P[] = [-160, -60, 40, 140].map((x) => ({ x: x + 12, z: FLYOVER_Z }));

  // Ikoyi district east across Eko Bridge, with a canal cut through it
  for (const [x0, x1] of IKOYI_BX) for (const [z0, z1] of IKOYI_BZ) {
    blocks.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1 });
    const n = 2;
    for (let k = 0; k < n; k++) {
      const cx = x0 + ((x1 - x0) * (k + 0.5)) / n, cz = (z0 + z1) / 2;
      const w = Math.min(16, (x1 - x0) / n - 6), dp = Math.min(18, z1 - z0 - 10);
      const bd = { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - dp / 2, maxZ: cz + dp / 2 };
      buildings.push({ ...bd, h: 10 + r() * 50, color: PALETTE[Math.floor(r() * PALETTE.length)] });
      colliders.push(bd);
    }
  }
  // canal banks block cars except at the road bridges
  for (const [a, b] of [[266, 322], [338, 394]]) colliders.push({ minX: a, maxX: b, minZ: CANAL.z0, maxZ: CANAL.z1 });
  // Eko Bridge rails
  colliders.push({ minX: 213, maxX: 250, minZ: -9, maxZ: -7.8 }, { minX: 213, maxX: 250, minZ: 7.8, maxZ: 9 });
  const IK = (s: number) => [{ x: 196, z: 4 * s }, { x: 254 + 4 * -s, z: 4 * s }];
  routes.push([...IK(1), { x: 250, z: 108 }, { x: 406, z: 108 }, { x: 406, z: -108 }, { x: 250, z: -108 }, ...IK(-1).reverse()]);
  routes.push([{ x: 334, z: -112 }, { x: 334, z: 112 }, { x: 326, z: 112 }, { x: 326, z: -112 }]);
  // Victoria Island ring
  routes.push([{ x: -46, z: 428 }, { x: 46, z: 428 }, { x: 46, z: 507 }, { x: -46, z: 507 }]);

  classifyBuildings(buildings);
  return { footbridges, buildings, colliders, palms, stalls, billboards, sidewalks, blocks, routes, pillars, busStops, poles };
}

export type World = ReturnType<typeof buildWorld>;

export function randomSidewalkPoint(W: World): P {
  const loop = W.sidewalks[Math.floor(Math.random() * W.sidewalks.length)];
  const i = Math.floor(Math.random() * 4);
  const a = loop[i], b = loop[(i + 1) % 4];
  const f = 0.15 + Math.random() * 0.7;
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f };
}

/** Ikoyi: land x 250..410, z -120..120; ring roads at x 254/406, z ±108, spine x=330, canal z -56..-44. */
export const IKOYI = { x0: 246, x1: 414, z0: -120, z1: 120 };
export const CANAL = { z0: -56, z1: -44 };
export const IKOYI_BX: [number, number][] = [[264, 322], [338, 398]];
export const IKOYI_BZ: [number, number][] = [[-100, -60], [-40, -8], [8, 100]];
export function inWorld(x: number, z: number) {
  return (
    (Math.abs(x) <= 213 && Math.abs(z) <= 213) ||
    (Math.abs(z) <= 7.6 && x >= 200 && x <= 250) ||
    (x >= IKOYI.x0 && x <= IKOYI.x1 && z >= IKOYI.z0 && z <= IKOYI.z1) ||
    (Math.abs(x) <= 7.6 && z >= 200 && z <= 422) ||
    (Math.abs(x) <= 58 && z >= 418 && z <= 515) ||
    (z < -195 && z > -262 && Math.abs(x) <= 212 && distToMarina(x, z) <= 9.5)
  );
}

export const DECK_Y = 9.6;
/** Flyover deck height at (x,z); flat for |x|<=150, ramps down to ground at |x|=206; -1 when off the deck. */
export function deckY(x: number, z: number) {
  if (Math.abs(z - FLYOVER_Z) > 6.2) return -1;
  const ax = Math.abs(x);
  if (ax <= 150) return DECK_Y;
  if (ax >= 206) return -1;
  return (DECK_Y * (206 - ax)) / 56;
}
/** Stay on the deck/ramp only if already near its height; otherwise ground. */
export function surfaceY(prevY: number, x: number, z: number) {
  const d = deckY(x, z);
  return d >= 0 && Math.abs(d - prevY) < 1.6 ? d : 0;
}
export const LIGHTS: P[] = [];
for (const x of LINES) for (const z of LINES) LIGHTS.push({ x, z });
export function lightPhase(t: number): { ns: "g" | "y" | "r"; ew: "g" | "y" | "r" } {
  const k = t % 18;
  if (k < 7) return { ns: "g", ew: "r" };
  if (k < 9) return { ns: "y", ew: "r" };
  if (k < 16) return { ns: "r", ew: "g" };
  return { ns: "r", ew: "y" };
}
