/** Compact pre-baked OpenStreetMap dataset for Lagos Island (+ bridge landings). Coords in metres, [x, z]. */
export type XZ = [number, number];

export const ROAD_TYPES = [
  "motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",
  "secondary", "secondary_link", "tertiary", "tertiary_link", "residential",
  "unclassified", "service", "living_street", "pedestrian", "footway", "other",
] as const;
export const BUILDING_KINDS = [
  "residential", "office", "bank", "restaurant", "cafe", "shop", "hotel", "heritage", "worship", "civic", "other",
] as const;
export const WATER_KINDS = ["coastline", "water", "canal", "river", "riverbank", "other"] as const;

export interface OsmRoad {
  id: number; name?: string; type: number; lanes: number;
  /** 1 = forward one-way, -1 = reverse one-way, 0 = two-way */
  oneway: number; bridge: boolean; tunnel: boolean; layer: number; path: XZ[];
}
export interface OsmBuilding {
  id: number; name?: string; kind: number; levels: number; height: number;
  /** true when levels/height came from OSM tags rather than zoning fallbacks */
  tagged: boolean; poly: XZ[];
}
export interface OsmWater { id: number; name?: string; kind: number; closed: boolean; path: XZ[] }
export interface OsmPoi { id: number; name?: string; amenity: string; p: XZ }

export interface LagosDataset {
  source: string; timestamp: string;
  origin: { lat: number; lon: number };
  bbox: [number, number, number, number];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  roads: OsmRoad[]; buildings: OsmBuilding[]; water: OsmWater[]; pois: OsmPoi[];
}
