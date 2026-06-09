import { cellToBoundary, cellToLatLng, gridDisk, latLngToCell } from "h3-js";

/**
 * Convert a lat/lon position to an H3 cell index at the requested
 * resolution (0–15; 7 ≈ 5 km, 9 ≈ 175 m, 11 ≈ 25 m).
 */
export function latLonToCell(lat: number, lon: number, resolution = 7): string {
  return latLngToCell(lat, lon, resolution);
}

/** Center lat/lon of an H3 cell. */
export function cellToLatLon(cell: string): { lat: number; lon: number } {
  const [lat, lon] = cellToLatLng(cell);
  return { lat, lon };
}

/**
 * Cell boundary as a ring of `[lon, lat]` positions, ready to drop into a
 * GeoJSON Polygon. H3 returns `[lat, lon]` by default; we flip for
 * GeoJSON's lon-first convention.
 */
export function cellBoundaryLonLat(cell: string): [number, number][] {
  return cellToBoundary(cell).map(([lat, lon]) => [lon, lat]);
}

/** Cells within `k` rings of the given cell (includes the center cell). */
export function neighbors(cell: string, k = 1): string[] {
  return gridDisk(cell, k);
}
