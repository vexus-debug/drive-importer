/** Pure road-network logic built from the baked OSM dataset: widths, bridge deck profiles, deck height lookup. */
import data from "./data/lagos-island.json";
import { ROAD_TYPES, type LagosDataset, type OsmRoad, type XZ } from "./osm-types";

export const DATASET = data as unknown as LagosDataset;

/** Per-lane width (m) by OSM class; footways/pedestrian are narrow paved strips. */
const LANE_W: Record<string, number> = {
  motorway: 3.65, motorway_link: 3.5, trunk: 3.65, trunk_link: 3.5, primary: 3.5, primary_link: 3.3,
  secondary: 3.3, secondary_link: 3.2, tertiary: 3.2, tertiary_link: 3.1, residential: 3, unclassified: 3,
  service: 2.8, living_street: 2.8, pedestrian: 2.5, footway: 1.5, other: 2.8,
};
/** Default lane counts when OSM has no `lanes` tag (lanes field is 0 then). */
const DEFAULT_LANES: Record<string, number> = {
  motorway: 6, motorway_link: 1, trunk: 4, trunk_link: 1, primary: 4, primary_link: 1,
  secondary: 2, secondary_link: 1, tertiary: 2, tertiary_link: 1, residential: 2, unclassified: 2,
  service: 1, living_street: 1, pedestrian: 1, footway: 1, other: 1,
};

export function roadClass(r: Pick<OsmRoad, "type">) { return ROAD_TYPES[r.type] ?? "other"; }

/** Carriageway width in metres: real lane count × class lane width; one-way links keep at least one lane. */
export function roadWidth(r: Pick<OsmRoad, "type" | "lanes" | "oneway">) {
  const c = roadClass(r);
  let lanes = r.lanes > 0 ? r.lanes : DEFAULT_LANES[c]!;
  if (r.lanes <= 0 && r.oneway !== 0 && lanes > 1 && !c.endsWith("_link")) lanes = Math.max(1, Math.round(lanes / 2));
  return +(lanes * LANE_W[c]!).toFixed(2);
}

/** Pedestrian-only ways render as paving, not asphalt. */
export function isFootpath(r: Pick<OsmRoad, "type">) { const c = roadClass(r); return c === "footway" || c === "pedestrian"; }

/** Deck clearance by OSM layer (OSM has no height tag on these bridges): layer 1 ≈ 8.5 m, layer 2 stacks above at 14 m. */
export function deckHeight(layer: number) { return layer >= 2 ? 14 : 8.5; }
/** Ramp length used where a bridge way meets a ground road. */
export const RAMP_LEN = 70;

const key = (p: XZ) => `${p[0]},${p[1]}`;

/** Endpoint → highest elevated layer touching it, so bridges chained together stay up and only ground joins ramp. */
function endpointLayers(roads: OsmRoad[]) {
  const m = new Map<string, { ground: boolean; up: number }>();
  for (const r of roads) {
    for (const p of [r.path[0]!, r.path[r.path.length - 1]!]) {
      const e = m.get(key(p)) ?? { ground: false, up: 0 };
      if (r.bridge) e.up = Math.max(e.up, r.layer); else e.ground = true;
      m.set(key(p), e);
    }
  }
  return m;
}

/** Height of every vertex along a road: 0 on ground, deck height on bridges with smoothstep ramps at ground joins. */
export function elevationProfile(r: OsmRoad, ends: Map<string, { ground: boolean; up: number }>): number[] {
  if (!r.bridge || r.layer < 1) return r.path.map(() => 0);
  const H = deckHeight(r.layer);
  const d: number[] = [0];
  for (let i = 1; i < r.path.length; i++) d.push(d[i - 1]! + Math.hypot(r.path[i]![0] - r.path[i - 1]![0], r.path[i]![1] - r.path[i - 1]![1]));
  const L = d[d.length - 1]!;
  const endH = (p: XZ) => { const e = ends.get(key(p)); return !e || e.up >= r.layer ? H : e.up > 0 ? deckHeight(e.up) : 0; };
  const h0 = endH(r.path[0]!), h1 = endH(r.path[r.path.length - 1]!);
  const ramp = Math.min(RAMP_LEN, L / 2);
  const ss = (t: number) => t * t * (3 - 2 * t);
  return d.map((s) => {
    let h = H;
    if (h0 < H && s < ramp) h = h0 + (H - h0) * ss(s / ramp);
    if (h1 < H && L - s < ramp) h = Math.min(h, h1 + (H - h1) * ss((L - s) / ramp));
    return h;
  });
}

export interface BuiltRoad { road: OsmRoad; width: number; heights: number[] }

export function buildNetwork(roads: OsmRoad[] = DATASET.roads): BuiltRoad[] {
  const ends = endpointLayers(roads);
  return roads.filter((r) => r.path.length >= 2 && !r.tunnel).map((road) => ({ road, width: roadWidth(road), heights: elevationProfile(road, ends) }));
}

/** Spatial grid of elevated segments for O(1) deck-height queries by the driving sim. */
const CELL = 40;
type Seg = { ax: number; az: number; bx: number; bz: number; ha: number; hb: number; hw: number };
let grid: Map<string, Seg[]> | null = null;
function deckGrid() {
  if (grid) return grid;
  grid = new Map();
  for (const b of buildNetwork()) {
    if (!b.road.bridge) continue;
    const p = b.road.path;
    for (let i = 1; i < p.length; i++) {
      const s: Seg = { ax: p[i - 1]![0], az: p[i - 1]![1], bx: p[i]![0], bz: p[i]![1], ha: b.heights[i - 1]!, hb: b.heights[i]!, hw: b.width / 2 };
      const x0 = Math.floor((Math.min(s.ax, s.bx) - s.hw) / CELL), x1 = Math.floor((Math.max(s.ax, s.bx) + s.hw) / CELL);
      const z0 = Math.floor((Math.min(s.az, s.bz) - s.hw) / CELL), z1 = Math.floor((Math.max(s.az, s.bz) + s.hw) / CELL);
      for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
        const k = `${gx},${gz}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(s);
      }
    }
  }
  return grid;
}

/** All real-bridge deck heights covering (x,z); empty when not over a bridge. */
export function realDeckHeights(x: number, z: number): number[] {
  const out: number[] = [];
  for (const s of deckGrid().get(`${Math.floor(x / CELL)},${Math.floor(z / CELL)}`) ?? []) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
    if (Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t)) <= s.hw + 0.3) out.push(s.ha + (s.hb - s.ha) * t);
  }
  return out;
}
