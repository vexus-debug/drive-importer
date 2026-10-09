/** Sanity checks for the baked Lagos dataset: counts, bounds, polygon integrity, landmark positions. */
import { readFileSync } from "node:fs";
import { project } from "../src/game/geo";
import type { LagosDataset } from "../src/game/osm-types";

const d: LagosDataset = JSON.parse(readFileSync("src/game/data/lagos-island.json", "utf8"));
const errs: string[] = [];
const B = d.bounds, pad = 600;
const inB = ([x, z]: [number, number]) => x > B.minX - pad && x < B.maxX + pad && z > B.minZ - pad && z < B.maxZ + pad;
if (d.roads.length < 1000) errs.push(`too few roads ${d.roads.length}`);
if (d.buildings.length < 3000) errs.push(`too few buildings ${d.buildings.length}`);
d.buildings.forEach((b) => { if (b.poly.length < 3) errs.push(`degenerate building ${b.id}`); if (!b.poly.every(inB)) errs.push(`building out of bounds ${b.id}`); });
d.roads.forEach((r) => { if (r.path.length < 2) errs.push(`degenerate road ${r.id}`); });
const named = (re: RegExp) => d.buildings.find((b) => re.test(b.name ?? "")) ?? d.roads.find((r) => re.test(r.name ?? ""));
for (const [re, lat, lon] of [[/Cathedral Church of Christ/, 6.4507, 3.3900], [/NECOM House/, 6.4462, 3.3975], [/Lagos Central Mosque/, 6.4571, 3.3879]] as const) {
  const f = named(re);
  if (!f) { errs.push(`missing landmark ${re}`); continue; }
  const pts = "poly" in f ? f.poly : f.path;
  const [ex, ez] = project(lat, lon);
  const dmin = Math.min(...pts.map(([x, z]) => Math.hypot(x - ex, z - ez)));
  console.log(`${re.source}: nearest vertex ${dmin.toFixed(1)} m from reference`);
  if (dmin > 80) errs.push(`landmark misplaced ${re}`);
}
console.log(`roads ${d.roads.length}, buildings ${d.buildings.length}, water ${d.water.length}, pois ${d.pois.length}`);
if (errs.length) { console.error(errs.slice(0, 20).join("\n")); process.exit(1); }
console.log("OK");
