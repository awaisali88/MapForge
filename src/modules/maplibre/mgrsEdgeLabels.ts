import type { Feature, FeatureCollection, Point } from "geojson";
import type { Map as MaplibreMap } from "maplibre-gl";

import { iterateGzds, llToUtm, utmToLl } from "./mgrsTileProtocol";

/**
 * Graticule-style MGRS edge labels.
 *
 * Instead of a full MGRS reference centred in every cell (cluttered at fine
 * resolutions), label the grid *lines* with their principal easting / northing
 * value where they cross the viewport border — easting values along the top and
 * bottom edges, northing values along the left and right edges, mirroring how
 * the lat/lon graticule labels its lines.
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
 * The principal grid value shown for a UTM easting/northing: the value within
 * its 100 km square, in kilometers. Whole km for cell sizes ≥ 1 km (e.g. "67"),
 * one decimal for sub-km cells (e.g. "67.5" at 500 m).
 */
function formatGridValue(utmMeters: number, cellMeters: number): string {
  const within = ((utmMeters % 100000) + 100000) % 100000;
  const km = within / 1000;
  return cellMeters >= 1000 ? String(Math.round(km)) : km.toFixed(1);
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

    // Constant-easting (≈ vertical) lines → top & bottom edge crossings.
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
        if (prev) {
          for (const edgeY of [0, height]) {
            if ((prev.y - edgeY) * (cur.y - edgeY) <= 0 && prev.y !== cur.y) {
              const t = (edgeY - prev.y) / (cur.y - prev.y);
              const x = prev.x + (cur.x - prev.x) * t;
              if (x >= 0 && x <= width) {
                pushLabel(x, edgeY === 0 ? EDGE_MARGIN : height - EDGE_MARGIN, text);
              }
            }
          }
        }
        prev = cur;
      }
    }

    // Constant-northing (≈ horizontal) lines → left & right edge crossings.
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
        if (prev) {
          for (const edgeX of [0, width]) {
            if ((prev.x - edgeX) * (cur.x - edgeX) <= 0 && prev.x !== cur.x) {
              const t = (edgeX - prev.x) / (cur.x - prev.x);
              const y = prev.y + (cur.y - prev.y) * t;
              if (y >= 0 && y <= height) {
                pushLabel(edgeX === 0 ? EDGE_MARGIN : width - EDGE_MARGIN, y, text);
              }
            }
          }
        }
        prev = cur;
      }
    }
  }

  return { type: "FeatureCollection", features };
}
