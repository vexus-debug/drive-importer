/**
 * Phase 1 extractor: downloads real OpenStreetMap data for Lagos Island + bridge landings,
 * projects to local metres (origin Marina/CMS), applies zoning height fallbacks only where
 * OSM has no levels/height, simplifies and writes src/game/data/lagos-island.json.
 *   bun run scripts/extract-osm.ts           (uses /tmp cache if present)
 *   bun run scripts/extract-osm.ts --refresh (forces fresh download)
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ORIGIN, project, simplify } from "../src/game/geo";
import { ROAD_TYPES, BUILDING_KINDS, WATER_KINDS, type LagosDataset, type XZ, type OsmRoad, type OsmBuilding, type OsmWater, type OsmPoi } from "../src/game/osm-types";

const BBOX: [number, number, number, number] = [6.438, 3.37, 6.475, 3.42];
const CACHE = "/tmp/osm-lagos-raw.json";
const OUT = "src/game/data/lagos-island.json";
const MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const b = BBOX.join(",");
const QUERY = `[out:json][timeout:180];(
way["highway"](${b});way["building"](${b});relation["building"](${b});
way["natural"~"coastline|water"](${b});relation["natural"="water"](${b});
way["waterway"~"canal|river|stream|riverbank"](${b});node["amenity"](${b}););out body geom;`;

type G = { lat: number; lon: number };
type El = { type: string; id: number; tags?: Record<string, string>; geometry?: G[]; members?: { role: string; geometry?: G[] }[]; lat?: number; lon?: number };

async function download(): Promise<{ elements: El[]; osm3s: { timestamp_osm_base: string } }> {
  if (existsSync(CACHE) && !process.argv.includes("--refresh")) return JSON.parse(readFileSync(CACHE, "utf8"));
  for (const m of MIRRORS) {
    try {
      const r = await fetch(m, { method: "POST", headers: { "User-Agent": "LagosIslandGame/1.0", "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(QUERY) });
      const txt = await r.text();
      if (!r.ok || !txt.startsWith("{")) throw new Error(`${r.status}`);
      writeFileSync(CACHE, txt);
      return JSON.parse(txt);
    } catch (e) { console.warn("mirror failed", m, e); }
  }
  throw new Error("All Overpass mirrors failed");
}

const q = (v: number) => Math.round(v * 10) / 10;
const proj = (g: G[], eps: number): XZ[] => simplify(g.map((p) => project(p.lat, p.lon)), eps).map(([x, z]) => [q(x), q(z)]);
const hash = (n: number) => { let h = n ^ 0x9e3779b9; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const num = (s?: string) => { const v = parseFloat(s ?? ""); return Number.isFinite(v) && v > 0 ? v : undefined; };

function buildingKind(t: Record<string, string>): number {
  const k = (s: (typeof BUILDING_KINDS)[number]) => BUILDING_KINDS.indexOf(s);
  const a = t.amenity, bd = t.building;
  if (a === "bank" || t.office === "bank") return k("bank");
  if (a === "place_of_worship" || ["church", "cathedral", "mosque", "chapel"].includes(bd)) return t.historic || t.heritage ? k("heritage") : k("worship");
  if (t.historic || t.heritage) return k("heritage");
  if (a === "fast_food" || a === "restaurant") return k("restaurant");
  if (a === "cafe") return k("cafe");
  if (t.tourism === "hotel" || bd === "hotel") return k("hotel");
  if (t.shop || bd === "retail" || a === "marketplace" || bd === "kiosk") return k("shop");
  if (t.office || ["office", "commercial"].includes(bd)) return k("office");
  if (["residential", "house", "apartments", "detached", "terrace", "dormitory"].includes(bd)) return k("residential");
  if (["public", "government", "civic", "school", "hospital", "university", "college"].includes(bd) || ["school", "hospital", "townhall", "courthouse", "police"].includes(a)) return k("civic");
  return k("other");
}

function segDist(px: number, pz: number, a: XZ, c: XZ) {
  const dx = c[0] - a[0], dz = c[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}

async function main() {
  const raw = await download();
  const els = raw.elements;
  const roads: OsmRoad[] = [], buildings: OsmBuilding[] = [], water: OsmWater[] = [], pois: OsmPoi[] = [];

  for (const e of els) {
    const t = e.tags ?? {};
    if (e.type === "way" && t.highway && e.geometry) {
      let ty = ROAD_TYPES.indexOf(t.highway as never);
      if (ty < 0) { if (["steps", "path", "cycleway", "track"].includes(t.highway)) ty = ROAD_TYPES.indexOf("footway"); else ty = ROAD_TYPES.indexOf("other"); }
      const ow = t.oneway === "yes" || t.oneway === "1" || t.junction === "roundabout" || t.highway === "motorway" ? 1 : t.oneway === "-1" ? -1 : 0;
      const defLanes = ty <= 3 ? 2 : ty <= 7 ? 2 : 1;
      roads.push({ id: e.id, name: t.name, type: ty, lanes: Math.round(num(t.lanes) ?? (ow ? defLanes : defLanes * 2)), oneway: ow,
        bridge: !!t.bridge && t.bridge !== "no", tunnel: !!t.tunnel && t.tunnel !== "no", layer: parseInt(t.layer ?? "0") || 0, path: proj(e.geometry, 0.35) });
    }
  }

  // Corridor reference lines for height fallbacks: real Marina + Broad Street centrelines.
  const corridor = roads.filter((r) => /marina|broad street/i.test(r.name ?? "") && !/alakoro/i.test(r.name ?? ""));
  const nearCorridor = (x: number, z: number) => corridor.some((r) => r.path.some((p, i) => i > 0 && segDist(x, z, r.path[i - 1], p) < 120));
  const broad = roads.filter((r) => /^broad street$/i.test(r.name ?? "")).flatMap((r) => r.path);
  const broadZ = broad.length ? broad.reduce((s, p) => s + p[1], 0) / broad.length : -300;

  for (const e of els) {
    const t = e.tags ?? {};
    if (!t.building) continue;
    let ring: G[] | undefined;
    if (e.type === "way") ring = e.geometry;
    else if (e.type === "relation") ring = e.members?.filter((m) => m.role === "outer" && m.geometry).sort((a, c) => c.geometry!.length - a.geometry!.length)[0]?.geometry;
    if (!ring || ring.length < 4) continue;
    const poly = proj(ring, 0.3);
    if (poly.length > 1 && poly[0][0] === poly.at(-1)![0] && poly[0][1] === poly.at(-1)![1]) poly.pop();
    if (poly.length < 3) continue;
    const kind = buildingKind(t), K = BUILDING_KINDS[kind];
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
    const tl = num(t["building:levels"]), th = num(t.height);
    let levels: number, height: number;
    const r = hash(e.id);
    if (tl || th) { levels = Math.round(tl ?? th! / 3.3); height = th ?? levels * 3.3 + 1; }
    else {
      let lo: number, hi: number;
      if (K === "bank") [lo, hi] = [8, 14];
      else if (K === "restaurant" || K === "cafe") [lo, hi] = [1, 2];
      else if (K === "shop") [lo, hi] = [1, 3];
      else if ((K === "office" || K === "hotel") || (nearCorridor(cx, cz) && K !== "residential")) [lo, hi] = nearCorridor(cx, cz) ? [10, 20] : [5, 10];
      else if (K === "residential" || cz < broadZ) [lo, hi] = [2, 4];
      else if (K === "heritage" || K === "worship") [lo, hi] = [2, 3];
      else [lo, hi] = [3, 3];
      levels = lo + Math.floor(r * (hi - lo + 1));
      height = K === "restaurant" || K === "cafe" ? (levels === 1 ? 4.5 : 7.5) : levels * 3.4 + 0.6;
    }
    buildings.push({ id: e.id, name: t.name, kind, levels, height: q(height), tagged: !!(tl || th), poly });
  }

  for (const e of els) {
    const t = e.tags ?? {};
    const wk = t.natural === "coastline" ? "coastline" : t.natural === "water" ? "water" : t.waterway;
    if (!wk || t.building || t.highway) continue;
    const wi = WATER_KINDS.indexOf(wk as never);
    const kind = wi < 0 ? WATER_KINDS.indexOf("other") : wi;
    const add = (g: G[], id: number) => {
      const closed = g.length > 3 && g[0].lat === g.at(-1)!.lat && g[0].lon === g.at(-1)!.lon;
      water.push({ id, name: t.name, kind, closed, path: proj(g, 0.5) });
    };
    if (e.type === "way" && e.geometry) add(e.geometry, e.id);
    else if (e.type === "relation") e.members?.forEach((m) => m.role === "outer" && m.geometry && add(m.geometry, e.id));
  }
  for (const e of els) if (e.type === "node" && e.tags?.amenity && e.lat != null) {
    const [x, z] = project(e.lat, e.lon!);
    pois.push({ id: e.id, name: e.tags.name, amenity: e.tags.amenity, p: [q(x), q(z)] });
  }

  const [s, w, n, eLon] = BBOX;
  const [minX, maxZ] = project(s, w), [maxX, minZ] = project(n, eLon);
  const ds: LagosDataset = {
    source: "© OpenStreetMap contributors (ODbL) via Overpass API", timestamp: raw.osm3s?.timestamp_osm_base ?? "",
    origin: { ...ORIGIN }, bbox: BBOX, bounds: { minX: q(minX), maxX: q(maxX), minZ: q(minZ), maxZ: q(maxZ) },
    roads, buildings, water, pois,
  };
  mkdirSync("src/game/data", { recursive: true });
  const json = JSON.stringify(ds, (_k, v) => (v === undefined ? undefined : v));
  writeFileSync(OUT, json);
  console.log(`roads ${roads.length}, buildings ${buildings.length} (${buildings.filter((x) => x.tagged).length} tagged heights), water ${water.length}, pois ${pois.length}, ${(json.length / 1024).toFixed(0)} KB`);
}
main();
