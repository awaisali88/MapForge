import type { Feature, FeatureCollection, Point } from "geojson";
import type { Map as MaplibreMap } from "maplibre-gl";

import { iterateGzds, llToUtm, utmToLl } from "./mgrsTileProtocol";

/**
 * Graticule-style MGRS edge labels.
 *
 * Instead of a full MGRS reference centred in every cell (cluttered at fine
 * resolutions), label the grid *lines* with their principal easting / northing
 * value where they cross the viewport border — at the default north-up
 * orientation easting values land on the top/bottom edges and northing on the
 * left/right, mirroring the lat/lon graticule. Each line is tested against all
 * four edges, so when the map is rotated (e.g. north pointing right) the labels
 * follow the lines onto whichever edge they exit and never disappear.
 *
 * The crossings are computed in **screen space** for the current camera, so the
 * caller must recompute on every move/zoom (via a GeoJSON `setData`) to keep the
 * labels pinned to the edges as the user pans — exactly like the graticule.
 *
 * Each emitted point carries a `label` string (the grid value) and sits a few
 * pixels inside the edge it belongs to, unprojected back to lng/lat so MapLibre
 * positions it. Geometry is straight in UTM (slightly curved in lng/lat) and
 * clipped to each GZD, reusing the same UTM helpers as the tile protocol.
 */

const EMPTY: FeatureCollection<Point> = { type: "FeatureCollection", features: [] };

/** Pixels inside the viewport edge to place a label so its text isn't clipped. */
const EDGE_MARGIN = 18;

/** Samples per grid line when projecting it to screen to find edge crossings. */
const LINE_SAMPLES = 28;

/** Skip a GZD if it would emit more than this many lines per axis (perf guard). */
const MAX_LINES_PER_AXIS = 400;

/**
 * The principal grid value shown for a UTM easting/northing: the line's position
 * within its 100 km square, printed in the grid's own unit so it is always a
 * whole, zero-padded number (no decimals):
 *
 *   - cell ≥ 1 km  → kilometers, two digits   ("05", "67")
 *   - cell < 1 km  → hundreds of metres, three digits ("675", "672")
 *
 * Sub-km grids need the extra digit because two adjacent 100 m lines would both
 * round to the same 2-digit km value and collide.
 */
export function formatGridValue(utmMeters: number, cellMeters: number): string {
  const within = ((utmMeters % 100000) + 100000) % 100000;
  if (cellMeters >= 1000) {
    return String(Math.round(within / 1000) % 100).padStart(2, "0");
  }
  return String(Math.round(within / 100) % 1000).padStart(3, "0");
}

/**
 * Compute the MGRS edge labels for the current viewport at the given cell size.
 * Returns an empty collection when the viewport is degenerate or out of the MGRS
 * latitude range.
 */
export function computeMgrsEdgeLabels(
  map: MaplibreMap,
  cellMeters: number,
): FeatureCollection<Point> {
  const canvas = map.getCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return EMPTY;

  const bounds = map.getBounds();
  const west = bounds.getWest();
  const east = bounds.getEast();
  const south = Math.max(bounds.getSouth(), -80);
  const north = Math.min(bounds.getNorth(), 84);
  if (north <= south || east <= west) return EMPTY;

  const features: Feature<Point>[] = [];

  /** Unproject a screen point back to lng/lat and push it as a labelled point. */
  const pushLabel = (sx: number, sy: number, text: string): void => {
    const ll = map.unproject([sx, sy]);
    features.push({
      type: "Feature",
      properties: { label: text },
      geometry: { type: "Point", coordinates: [ll.lng, ll.lat] },
    });
  };

  /**
   * Push a label wherever the screen segment a→b crosses any of the four
   * viewport edges, nudged inward. Testing all four edges (not just top/bottom
   * for easting lines and left/right for northing) keeps the labels on screen at
   * any map rotation — when the map is turned 90°, easting lines run horizontally
   * and exit the side edges, not the top/bottom.
   */
  const addEdgeCrossings = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    text: string,
  ): void => {
    for (const edgeY of [0, height]) {
      if ((a.y - edgeY) * (b.y - edgeY) <= 0 && a.y !== b.y) {
        const t = (edgeY - a.y) / (b.y - a.y);
        const x = a.x + (b.x - a.x) * t;
        if (x >= 0 && x <= width) {
          pushLabel(x, edgeY === 0 ? EDGE_MARGIN : height - EDGE_MARGIN, text);
        }
      }
    }
    for (const edgeX of [0, width]) {
      if ((a.x - edgeX) * (b.x - edgeX) <= 0 && a.x !== b.x) {
        const t = (edgeX - a.x) / (b.x - a.x);
        const y = a.y + (b.y - a.y) * t;
        if (y >= 0 && y <= height) {
          pushLabel(edgeX === 0 ? EDGE_MARGIN : width - EDGE_MARGIN, y, text);
        }
      }
    }
  };

  for (const gzd of iterateGzds(west, east, south, north)) {
    const zone = gzd.zone;
    const isSouth = gzd.band < "N";

    // Visible portion of this GZD in lng/lat.
    const gW = Math.max(gzd.lngW, west);
    const gE = Math.min(gzd.lngE, east);
    const gS = Math.max(gzd.latS, south);
    const gN = Math.min(gzd.latN, north);
    if (gW >= gE || gS >= gN) continue;

    // Tight UTM bbox of that visible region (UTM isn't axis-aligned with the
    // viewport, so sample along every edge).
    let eMin = Infinity;
    let eMax = -Infinity;
    let nMin = Infinity;
    let nMax = -Infinity;
    const sample = (lng: number, lat: number): void => {
      const u = llToUtm(lat, lng, zone);
      if (u.easting < eMin) eMin = u.easting;
      if (u.easting > eMax) eMax = u.easting;
      if (u.northing < nMin) nMin = u.northing;
      if (u.northing > nMax) nMax = u.northing;
    };
    const edgeSamples = 8;
    for (let i = 0; i <= edgeSamples; i++) {
      const t = i / edgeSamples;
      sample(gW + (gE - gW) * t, gS);
      sample(gW + (gE - gW) * t, gN);
      sample(gW, gS + (gN - gS) * t);
      sample(gE, gS + (gN - gS) * t);
    }
    if (!isFinite(eMin)) continue;

    const eStart = Math.floor(eMin / cellMeters) * cellMeters;
    const eEnd = Math.ceil(eMax / cellMeters) * cellMeters;
    const nStart = Math.floor(nMin / cellMeters) * cellMeters;
    const nEnd = Math.ceil(nMax / cellMeters) * cellMeters;
    if (
      (eEnd - eStart) / cellMeters > MAX_LINES_PER_AXIS ||
      (nEnd - nStart) / cellMeters > MAX_LINES_PER_AXIS
    ) {
      continue;
    }

    const inGzd = (lng: number, lat: number): boolean =>
      lng >= gzd.lngW - 1e-9 &&
      lng <= gzd.lngE + 1e-9 &&
      lat >= gzd.latS - 1e-9 &&
      lat <= gzd.latN + 1e-9;

    // Constant-easting lines: label where each crosses any viewport edge.
    for (let e = eStart; e <= eEnd + 0.5; e += cellMeters) {
      const text = formatGridValue(e, cellMeters);
      let prev: { x: number; y: number } | null = null;
      for (let s = 0; s <= LINE_SAMPLES; s++) {
        const n = nMin + ((nMax - nMin) * s) / LINE_SAMPLES;
        const ll = utmToLl(e, n, zone, isSouth);
        if (!inGzd(ll.lng, ll.lat)) {
          prev = null;
          continue;
        }
        const p = map.project([ll.lng, ll.lat]);
        const cur = { x: p.x, y: p.y };
        if (prev) addEdgeCrossings(prev, cur, text);
        prev = cur;
      }
    }

    // Constant-northing lines: label where each crosses any viewport edge.
    for (let n = nStart; n <= nEnd + 0.5; n += cellMeters) {
      const text = formatGridValue(n, cellMeters);
      let prev: { x: number; y: number } | null = null;
      for (let s = 0; s <= LINE_SAMPLES; s++) {
        const e = eMin + ((eMax - eMin) * s) / LINE_SAMPLES;
        const ll = utmToLl(e, n, zone, isSouth);
        if (!inGzd(ll.lng, ll.lat)) {
          prev = null;
          continue;
        }
        const p = map.project([ll.lng, ll.lat]);
        const cur = { x: p.x, y: p.y };
        if (prev) addEdgeCrossings(prev, cur, text);
        prev = cur;
      }
    }
  }

  return { type: "FeatureCollection", features };
}
