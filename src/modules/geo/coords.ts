import { forward, inverse } from "mgrs";

/** Coordinate format supported by `formatCoords`. */
export type CoordFormat = "DD" | "DMS" | "MGRS";

/** Format a single decimal-degree value as `DDD.dddd°N` / `DDD.dddd°W`. */
function decimalDegrees(value: number, axis: "lat" | "lon", precision: number): string {
  const hemisphere = axis === "lat" ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${Math.abs(value).toFixed(precision)}°${hemisphere}`;
}

/**
 * Format lat/lon as decimal degrees with hemisphere suffix.
 *
 * @example
 *   latLonToDecimal(30.123, 70.456) // "30.1230°N 70.4560°E"
 */
export function latLonToDecimal(lat: number, lon: number, precision = 4): string {
  return `${decimalDegrees(lat, "lat", precision)} ${decimalDegrees(lon, "lon", precision)}`;
}

/** Format a single decimal-degree value as degrees-minutes-seconds. */
function decimalToDMS(decimal: number, axis: "lat" | "lon"): string {
  const hemisphere = axis === "lat" ? (decimal >= 0 ? "N" : "S") : decimal >= 0 ? "E" : "W";
  const abs = Math.abs(decimal);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = ((minutesFloat - minutes) * 60).toFixed(1);
  return `${degrees}°${minutes.toString().padStart(2, "0")}'${seconds.padStart(4, "0")}"${hemisphere}`;
}

/**
 * Format lat/lon as degrees-minutes-seconds.
 *
 * @example
 *   latLonToDMS(30.5, 70.25) // `30°30'00.0"N 70°15'00.0"E`
 */
export function latLonToDMS(lat: number, lon: number): string {
  return `${decimalToDMS(lat, "lat")} ${decimalToDMS(lon, "lon")}`;
}

/**
 * Convert lat/lon to an MGRS grid reference at the given precision (0–5,
 * where 5 = 1 m resolution).
 */
export function latLonToMGRS(lat: number, lon: number, precision = 5): string {
  return forward([lon, lat], precision);
}

/** Convert an MGRS grid reference back to lat/lon. Tolerant of whitespace. */
export function mgrsToLatLon(value: string): { lat: number; lon: number } {
  const [lon, lat] = inverse(value.replace(/\s+/g, ""));
  return { lat, lon };
}

/** Single-dispatch formatter — pick the format you want at the call site. */
export function formatCoords(lat: number, lon: number, format: CoordFormat = "DD"): string {
  switch (format) {
    case "DD":
      return latLonToDecimal(lat, lon);
    case "DMS":
      return latLonToDMS(lat, lon);
    case "MGRS":
      return latLonToMGRS(lat, lon);
  }
}
