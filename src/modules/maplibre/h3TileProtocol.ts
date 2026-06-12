import { polygonToCells, cellToBoundary, cellToLatLng, getRes0Cells, cellToChildren } from "h3-js";
// Ported from orbat-mapper (MIT) — https://github.com/orbat-mapper/orbat-mapper — original at src/modules/maplibreview/h3grid/h3TileProtocol.ts
/**
 * Custom MapLibre protocol that generates H3 hex-grid MVT tiles on the fly.
 *
 * MapLibre requests `h3tile://{z}/{x}/{y}` tiles; this handler hand-encodes one
 * MVT (PBF) tile per request via the shared {@link ./mvt} encoder, so MapLibre's
 * native tile pipeline handles viewport culling, caching, and zoom management —
 * no `setData`-on-move.
 *
 * The per-tile cell enumeration splits into two strategies at
 * {@link GLOBAL_ENUM_MAX_RES}:
 *   - **Strategy A (res ≤ 4):** a global precompute of every cell at the
 *     resolution (`getRes0Cells` → `cellToChildren`, cached per res) is filtered
 *     by a center-in-padded-bbox test. At coarse resolutions, where
 *     `polygonToCells` is most likely to choke on huge polygons near the poles /
 *     antimeridian, it is never called.
 *   - **Strategy B (res > 4):** `polygonToCells` on the padded tile bbox (which
 *     is geographically tiny at high zoom, so the call is safe and bounded),
 *     with antimeridian clipping (≤ 3 calls deduped via a Set) and high-latitude
 *     longitude padding.
 *
 * DEVIATION FROM ORBAT (intentional): orbat emits a single `"h3"` polygon layer
 * with NO feature properties (only a sequential integer id). MapForge emits the
 * same `"h3"` layer but gives every feature two properties — `h3` (the cell id
 * string) and `res` (the resolution number) — so a hex can be picked / labelled.
 */
import { addProtocol, removeProtocol } from "maplibre-gl";

import {
  EXTENT,
  GeomType,
  TileBuilder,
  project,
  tileBounds,
  type Point,
  type TileBounds,
} from "./mvt";

/** Protocol scheme — source `tiles` use `h3tile://{z}/{x}/{y}`. */
export const H3_PROTOCOL = "h3tile";

/** A 1-tile coordinate buffer around the [0, EXTENT] box, matching orbat. */
const TILE_BUFFER = EXTENT;

type LngLat = [number, number];

/** A cell selected for a tile, with the longitude shift that lands it in-bounds. */
interface CellRef {
  id: string;
  centerLng: number;
  shift: number;
}

/**
 * Max resolution that uses global enumeration (Strategy A) instead of
 * `polygonToCells` (Strategy B).
 */
export const GLOBAL_ENUM_MAX_RES = 4;

/**
 * Shared mutable resolution — module-global, set by the composable via
 * {@link setH3Resolution} before triggering a tile reload. Kept out of the URL
 * so the consumer flushes MapLibre's tile cache by removing/re-adding the source.
 */
let currentResolution = 2;

/** Memoized cell boundaries (lng/lat rings), cleared on resolution change. */
let boundaryCache = new Map<string, LngLat[]>();

/** Cached global cell list with pre-computed centers for fast per-tile filtering. */
let globalCellCache: {
  res: number;
  cells: Array<{ id: string; lat: number; lng: number }>;
} | null = null;

/**
 * All H3 cells at `res` with their centers, cached per resolution. Built from
 * the 122 res-0 base cells refined down to `res` via `cellToChildren`. Sizes are
 * roughly `122 × 7^res` (the exact figure is the sum of h3 child counts).
 */
export function getGlobalCells(res: number): Array<{ id: string; lat: number; lng: number }> {
  if (globalCellCache && globalCellCache.res === res) return globalCellCache.cells;
  let allCells = getRes0Cells();
  if (res >= 1) {
    allCells = allCells.flatMap((c) => cellToChildren(c, res));
  }
  const cells = allCells.map((id) => {
    const [lat, lng] = cellToLatLng(id);
    return { id, lat, lng };
  });
  globalCellCache = { res, cells };
  return cells;
}

/**
 * Set the module-global resolution. Clears the boundary cache (cells differ per
 * res) and warms the global-cell cache for the global-enumeration regime.
 */
export function setH3Resolution(res: number): void {
  if (res !== currentResolution) {
    boundaryCache = new Map();
  }
  currentResolution = res;
  if (res <= GLOBAL_ENUM_MAX_RES) {
    getGlobalCells(res);
  }
}

/** The current module-global resolution (for diagnostics / tests). */
export function getH3Resolution(): number {
  return currentResolution;
}

/** Memoized `cellToBoundary(cell, true)` → closed-able `[lng, lat]` ring. */
function getCellBoundary(cell: string): LngLat[] {
  const cached = boundaryCache.get(cell);
  if (cached) return cached;
  const boundary = cellToBoundary(cell, true) as LngLat[];
  boundaryCache.set(cell, boundary);
  return boundary;
}

/**
 * Project a lng/lat into the tile's 0..EXTENT space, clamped to a 1-tile buffer
 * so wildly out-of-tile vertices don't overflow MVT's varint range.
 */
function projectClamped(lng: number, lat: number, bounds: TileBounds): Point {
  const [x, y] = project(lng, lat, bounds);
  return [
    Math.min(EXTENT + TILE_BUFFER, Math.max(-TILE_BUFFER, x)),
    Math.min(EXTENT + TILE_BUFFER, Math.max(-TILE_BUFFER, y)),
  ];
}

/**
 * Generate a single H3 tile as an MVT `ArrayBuffer`. Emits ONE layer `"h3"` of
 * POLYGON features, each carrying `{ h3: <cellId>, res: <resolution> }`.
 */
export function generateTile(z: number, x: number, y: number): ArrayBuffer {
  const bounds = tileBounds(z, x, y);

  // Pad the tile bounds to include cells that overlap tile edges. Since we only
  // render lines (no fill), duplicate cells across tiles are visually identical.
  const lngPad = (bounds.east - bounds.west) * 0.5;
  const latPad = (bounds.north - bounds.south) * 0.5;
  const padWest = bounds.west - lngPad;
  const padEast = bounds.east + lngPad;
  const padSouth = Math.max(bounds.south - latPad, -90);
  const padNorth = Math.min(bounds.north + latPad, 90);

  /**
   * The longitude shift (0, +360, or -360) that lands `lng` inside
   * [padWest, padEast), or null if the cell isn't in this tile. Lets a hex near
   * the antimeridian render in the tiles on either side of the seam.
   */
  function shiftForTile(lng: number): number | null {
    for (const shift of [0, 360, -360]) {
      const s = lng + shift;
      if (s >= padWest && s < padEast) return shift;
    }
    return null;
  }

  const cellsForTile: CellRef[] = [];

  if (currentResolution <= GLOBAL_ENUM_MAX_RES) {
    // Strategy A — global precompute + center-in-padded-bbox filter.
    const global = getGlobalCells(currentResolution);
    for (const { id, lat, lng } of global) {
      if (lat < padSouth || lat >= padNorth) continue;
      const shift = shiftForTile(lng);
      if (shift !== null) cellsForTile.push({ id, centerLng: lng, shift });
    }
  } else {
    // Strategy B — polygonToCells over the padded bbox. At high latitudes,
    // widen the longitude padding (mercator tiles are narrower there).
    const midLat = (bounds.north + bounds.south) / 2;
    const latFactor = Math.min(2, 1 / Math.max(Math.cos((midLat * Math.PI) / 180), 0.1));
    const highLatPadWest = bounds.west - (bounds.east - bounds.west) * Math.max(0.5, latFactor);
    const highLatPadEast = bounds.east + (bounds.east - bounds.west) * Math.max(0.5, latFactor);

    // Clip the polygon to ±180° and issue up to 3 polygonToCells calls for any
    // portion that wraps across the antimeridian, deduped via a Set.
    const ranges: Array<[number, number]> = [];
    const clippedWest = Math.max(highLatPadWest, -180);
    const clippedEast = Math.min(highLatPadEast, 180);
    if (clippedWest < clippedEast) ranges.push([clippedWest, clippedEast]);
    if (highLatPadWest < -180) ranges.push([highLatPadWest + 360, 180]);
    if (highLatPadEast > 180) ranges.push([-180, highLatPadEast - 360]);

    const seen = new Set<string>();
    for (const [w, e] of ranges) {
      const polygon = [
        [w, padSouth],
        [e, padSouth],
        [e, padNorth],
        [w, padNorth],
        [w, padSouth],
      ];
      for (const id of polygonToCells([polygon], currentResolution, true)) {
        if (seen.has(id)) continue;
        seen.add(id);
        const [, lng] = cellToLatLng(id);
        const shift = shiftForTile(lng);
        if (shift !== null) cellsForTile.push({ id, centerLng: lng, shift });
      }
    }
  }

  const tile = new TileBuilder();
  const layer = tile.layer("h3");

  for (const { id: cell, centerLng, shift } of cellsForTile) {
    const shiftedCenter = centerLng + shift;
    const boundary = getCellBoundary(cell);
    const ring: Point[] = new Array(boundary.length + 1);

    // Normalize each vertex relative to the shifted cell center (prevents the
    // ring tearing across the antimeridian seam), then project.
    for (let i = 0; i < boundary.length; i++) {
      const [lng, lat] = boundary[i]!;
      let normalizedLng = lng + shift;
      while (normalizedLng - shiftedCenter > 180) normalizedLng -= 360;
      while (normalizedLng - shiftedCenter < -180) normalizedLng += 360;
      ring[i] = projectClamped(normalizedLng, lat, bounds);
    }
    // Explicitly close the ring.
    ring[boundary.length] = ring[0]!;

    layer.addFeature({
      type: GeomType.POLYGON,
      geometry: [ring],
      properties: { h3: cell, res: currentResolution },
    });
  }

  return tile.finish();
}

/** Register the `h3tile://` protocol globally (maplibre static — all maps). */
export function registerH3Protocol(): void {
  addProtocol(H3_PROTOCOL, async (params) => {
    const url = params.url.replace(`${H3_PROTOCOL}://`, "");
    const parts = url.split("/");
    const z = parseInt(parts[0]!, 10);
    const x = parseInt(parts[1]!, 10);
    const y = parseInt(parts[2]!, 10);
    const data = generateTile(z, x, y);
    return { data };
  });
}

/** Unregister the `h3tile://` protocol. */
export function unregisterH3Protocol(): void {
  removeProtocol(H3_PROTOCOL);
}
