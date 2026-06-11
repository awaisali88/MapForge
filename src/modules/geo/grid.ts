import type { Feature, FeatureCollection, LineString, Polygon } from "geojson";

import { polygonToCells } from "h3-js";

import { latLonToMGRS } from "./coords";
import { cellBoundaryLonLat } from "./h3";

/** Bounding box as `[west, south, east, north]` (lon/lat degrees). */
export type Bbox = [number, number, number, number];

const MAX_CELLS = 20000;

/**
 * Map a MapLibre zoom level to an H3 resolution (0–15), tuned so the
 * number of on-screen cells stays manageable at every zoom.
 */
export function h3ResolutionForZoom(zoom: number): number {
  // Empirical fit: H3 res ~0 near zoom 2, rising ~0.7 res per zoom level so
  // hexagons stay roughly tile-sized as the user zooms in (capped at 0–15).
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

const MAX_LINES = 2000;

/**
 * Map a MapLibre zoom level to a lat/lon grid spacing in degrees. Coarser when
 * zoomed out so the line count stays manageable; finer when zoomed in so the
 * grid remains useful as a reference.
 */
export function mgrsStepForZoom(zoom: number): number {
  if (zoom < 4) return 8;
  if (zoom < 7) return 1;
  if (zoom < 10) return 0.1;
  return 0.01;
}

/**
 * Build a bounded lat/lon reference grid labeled with MGRS, clipped to `bbox`,
 * as a `FeatureCollection<LineString>`.
 *
 * NOTE: This is a pragmatic graticule-style grid — evenly-spaced lat/lon lines
 * annotated with MGRS references at sample points — NOT a true UTM-zone /
 * 100 km GZD tessellation. It is sufficient as a sandbox MGRS reference overlay.
 *
 * Line count is capped at `MAX_LINES` (2 000) so a world-extent view stays fast.
 * MGRS labels are computed only for longitude lines (at the bbox mid-latitude);
 * points where `latLonToMGRS` throws (e.g. polar regions) are silently skipped.
 */
export function mgrsGridGeoJSON(bbox: Bbox, zoom: number): FeatureCollection<LineString> {
  const [w, s, e, n] = bbox;
  const step = mgrsStepForZoom(zoom);
  const features: Feature<LineString>[] = [];
  const snap = (v: number): number => Math.floor(v / step) * step;

  // Longitude (vertical) lines — carry MGRS label at bbox mid-latitude.
  for (
    let lon = snap(w);
    lon <= e && features.length < MAX_LINES;
    lon = +(lon + step).toFixed(10)
  ) {
    let label = "";
    try {
      label = latLonToMGRS((s + n) / 2, lon, 0);
    } catch {
      label = "";
    }
    features.push({
      type: "Feature",
      properties: { axis: "lon", value: lon, label },
      geometry: {
        type: "LineString",
        coordinates: [
          [lon, s],
          [lon, n],
        ],
      },
    });
  }

  // Latitude (horizontal) lines — no MGRS label (would duplicate with lon lines).
  for (
    let lat = snap(s);
    lat <= n && features.length < MAX_LINES;
    lat = +(lat + step).toFixed(10)
  ) {
    features.push({
      type: "Feature",
      properties: { axis: "lat", value: lat },
      geometry: {
        type: "LineString",
        coordinates: [
          [w, lat],
          [e, lat],
        ],
      },
    });
  }

  return { type: "FeatureCollection", features };
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
