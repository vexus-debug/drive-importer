/** Real-world anchor: the Marina/CMS stop on Lagos Island (OSM node). Game (0,0) sits here. */
export const ORIGIN = { lat: 6.4494976, lon: 3.3897778 } as const;
const R = 6378137;
const RAD = Math.PI / 180;
const K = Math.cos(ORIGIN.lat * RAD);
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
const Y0 = mercY(ORIGIN.lat);

/** Mercator projection scaled to true metres at the origin. +X = east, -Z = north. */
export function project(lat: number, lon: number): [number, number] {
  const x = R * (lon - ORIGIN.lon) * RAD * K;
  const z = -R * (mercY(lat) - Y0) * K;
  return [x, z];
}

export function unproject(x: number, z: number): [number, number] {
  const lon = x / (R * RAD * K) + ORIGIN.lon;
  const lat = (2 * Math.atan(Math.exp(-z / (R * K) + Y0)) - Math.PI / 2) / RAD;
  return [lat, lon];
}

/** Ramer–Douglas–Peucker polyline simplification. */
export function simplify(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, az] = pts[a], [bx, bz] = pts[b];
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    let best = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = L < 1e-6 ? Math.hypot(pts[i][0] - ax, pts[i][1] - az) : Math.abs(dx * (az - pts[i][1]) - dz * (ax - pts[i][0])) / L;
      if (d > best) { best = d; idx = i; }
    }
    if (best > eps) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
