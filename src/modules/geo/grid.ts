import type { Feature, FeatureCollection, Polygon } from "geojson";

import { polygonToCells } from "h3-js";

import { cellBoundaryLonLat } from "./h3";

/** Bounding box as `[west, south, east, north]` (lon/lat degrees). */
export type Bbox = [number, number, number, number];

const MAX_CELLS = 20000;

/**
 * Map a MapLibre zoom level to an H3 resolution (0–15), tuned so the
 * number of on-screen cells stays manageable at every zoom.
 */
export function h3ResolutionForZoom(zoom: number): number {
  const res = Math.round((zoom - 2) * 0.7);
  return Math.max(0, Math.min(15, res));
}

/** Close a GeoJSON ring: append the first vertex if the ring isn't already closed. */
function closeRing(coords: [number, number][]): [number, number][] {
  if (coords.length === 0) return coords;
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  return first[0] === last[0] && first[1] === last[1] ? coords : [...coords, first];
}

/**
 * Build a GeoJSON `FeatureCollection<Polygon>` of H3 hexagon cells that cover
 * `bbox` at the given `resolution`. Cell count is capped at 20 000 so a large
 * viewport at high resolution can't freeze the renderer.
 *
 * Each feature carries a `cell` property with the H3 cell index string.
 */
export function hexGridGeoJSON(bbox: Bbox, resolution: number): FeatureCollection<Polygon> {
  const [w, s, e, n] = bbox;
  // h3-js `polygonToCells` expects a closed ring of [lat, lng] pairs.
  const ring: [number, number][] = [
    [s, w],
    [s, e],
    [n, e],
    [n, w],
    [s, w],
  ];
  let cells: string[] = [];
  try {
    cells = polygonToCells(ring, resolution);
  } catch {
    cells = [];
  }
  if (cells.length > MAX_CELLS) cells = cells.slice(0, MAX_CELLS);
  const features: Feature<Polygon>[] = cells.map((cell) => ({
    type: "Feature",
    properties: { cell },
    geometry: { type: "Polygon", coordinates: [closeRing(cellBoundaryLonLat(cell))] },
  }));
  return { type: "FeatureCollection", features };
}
