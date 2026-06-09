import type { Position } from "geojson";

import turfArea from "@turf/area";
import turfBearing from "@turf/bearing";
import turfCentroid from "@turf/centroid";
import turfDistance from "@turf/distance";
import { lineString, point as turfPoint, polygon as turfPolygon } from "@turf/helpers";
import turfLength from "@turf/length";
import turfMidpoint from "@turf/midpoint";

/**
 * Great-circle distance between two `[lon, lat]` positions, in meters.
 * Backed by `@turf/distance` (haversine).
 */
export function distanceMeters(a: Position, b: Position): number {
  return turfDistance(turfPoint(a), turfPoint(b), { units: "meters" });
}

/**
 * Total length of a path defined by an ordered list of `[lon, lat]`
 * positions, in meters. Returns 0 for fewer than two positions.
 */
export function lengthMeters(coords: Position[]): number {
  if (coords.length < 2) return 0;
  return turfLength(lineString(coords), { units: "meters" });
}

/**
 * Geodesic area of a polygon's outer ring, in square meters. The first and
 * last positions are implicitly joined — callers do not need to close the
 * ring themselves.
 */
export function areaSquareMeters(ring: Position[]): number {
  if (ring.length < 3) return 0;
  const closed: Position[] =
    ring[0]![0] === ring[ring.length - 1]![0] && ring[0]![1] === ring[ring.length - 1]![1]
      ? ring
      : [...ring, ring[0]!];
  return turfArea(turfPolygon([closed]));
}

/** Midpoint of the geodesic line between two `[lon, lat]` positions. */
export function midpointBetween(a: Position, b: Position): Position {
  return turfMidpoint(turfPoint(a), turfPoint(b)).geometry.coordinates as Position;
}

/** Centroid of a polygon ring (`[lon, lat]`). */
export function centroidOfRing(ring: Position[]): Position {
  if (ring.length < 3) {
    return ring[0] ?? [0, 0];
  }
  const closed: Position[] =
    ring[0]![0] === ring[ring.length - 1]![0] && ring[0]![1] === ring[ring.length - 1]![1]
      ? ring
      : [...ring, ring[0]!];
  return turfCentroid(turfPolygon([closed])).geometry.coordinates as Position;
}

/** Initial bearing in degrees clockwise from north, from `a` toward `b`. */
export function bearingDegrees(a: Position, b: Position): number {
  return turfBearing(turfPoint(a), turfPoint(b));
}
