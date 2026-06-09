import { describe, expect, it } from "vitest";

import {
  areaSquareMeters,
  bearingDegrees,
  centroidOfRing,
  distanceMeters,
  lengthMeters,
  midpointBetween,
} from "@/modules/geo/measure";

describe("geo/measure", () => {
  it("distanceMeters returns 0 for identical points", () => {
    expect(distanceMeters([70, 30], [70, 30])).toBe(0);
  });

  it("distanceMeters approximates known great-circle distance", () => {
    // 1° of latitude at the equator ≈ 111.2 km.
    const d = distanceMeters([0, 0], [0, 1]);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("lengthMeters returns 0 for under-two-point paths", () => {
    expect(lengthMeters([])).toBe(0);
    expect(lengthMeters([[0, 0]])).toBe(0);
  });

  it("lengthMeters accumulates segment lengths", () => {
    const path = [
      [0, 0],
      [0, 1],
      [0, 2],
    ] as [number, number][];
    const len = lengthMeters(path);
    // ~2 × 111 km
    expect(len).toBeGreaterThan(220_000);
    expect(len).toBeLessThan(224_000);
  });

  it("areaSquareMeters auto-closes the ring if needed", () => {
    const openRing = [
      [70, 30],
      [70.01, 30],
      [70.01, 30.01],
      [70, 30.01],
    ] as [number, number][];
    const closedRing = [...openRing, openRing[0]!];
    expect(areaSquareMeters(openRing)).toBeCloseTo(areaSquareMeters(closedRing), 0);
  });

  it("areaSquareMeters returns 0 for degenerate rings", () => {
    expect(areaSquareMeters([])).toBe(0);
    expect(areaSquareMeters([[0, 0]])).toBe(0);
    expect(
      areaSquareMeters([
        [0, 0],
        [1, 0],
      ]),
    ).toBe(0);
  });

  it("midpointBetween falls roughly between the inputs", () => {
    const mid = midpointBetween([0, 0], [10, 0]);
    expect(mid[0]).toBeCloseTo(5, 1);
    expect(mid[1]).toBeCloseTo(0, 1);
  });

  it("centroidOfRing is inside the bounding box of a square", () => {
    const ring = [
      [70, 30],
      [70.1, 30],
      [70.1, 30.1],
      [70, 30.1],
    ] as [number, number][];
    const c = centroidOfRing(ring);
    expect(c[0]).toBeCloseTo(70.05, 2);
    expect(c[1]).toBeCloseTo(30.05, 2);
  });

  it("bearingDegrees from south to north is approximately 0", () => {
    const b = bearingDegrees([0, 0], [0, 1]);
    expect(b).toBeCloseTo(0, 0);
  });

  it("bearingDegrees from west to east is approximately 90", () => {
    const b = bearingDegrees([0, 0], [1, 0]);
    expect(b).toBeCloseTo(90, 0);
  });
});
