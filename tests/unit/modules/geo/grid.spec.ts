import { describe, expect, it } from "vitest";

import {
  h3ResolutionForZoom,
  hexGridGeoJSON,
  mgrsGridGeoJSON,
  mgrsStepForZoom,
} from "@/modules/geo/grid";

describe("h3 grid", () => {
  it("maps zoom to a bounded H3 resolution", () => {
    expect(h3ResolutionForZoom(2)).toBeLessThan(h3ResolutionForZoom(12));
    expect(h3ResolutionForZoom(0)).toBeGreaterThanOrEqual(0);
    expect(h3ResolutionForZoom(22)).toBeLessThanOrEqual(15);
  });

  it("builds a FeatureCollection of polygons covering a small bbox", () => {
    // bbox: [west, south, east, north]
    const fc = hexGridGeoJSON([70, 30, 70.5, 30.5], 6);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features.length).toBeGreaterThan(0);
    expect(fc.features[0]!.geometry.type).toBe("Polygon");
  });

  it("caps the cell count so a huge bbox at high resolution stays bounded", () => {
    // near-world at res 5 returns ~116k cells (no OOM); the cap must slice to 20000
    const fc = hexGridGeoJSON([-170, -80, 170, 80], 5);
    expect(fc.features.length).toBe(20000);
  });
});

describe("mgrs grid", () => {
  it("uses a smaller degree step at higher zoom", () => {
    expect(mgrsStepForZoom(3)).toBeGreaterThan(mgrsStepForZoom(12));
  });

  it("builds line features clipped to the bbox", () => {
    const fc = mgrsGridGeoJSON([70, 30, 71, 31], 8);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features.every((f) => f.geometry.type === "LineString")).toBe(true);
    expect(fc.features.length).toBeGreaterThan(0);
  });

  it("stays bounded for a world bbox", () => {
    const fc = mgrsGridGeoJSON([-180, -80, 180, 80], 2);
    expect(fc.features.length).toBeLessThanOrEqual(2000);
  });

  it("caps a world bbox at mid-zoom and keeps both axes", () => {
    const fc = mgrsGridGeoJSON([-180, -80, 180, 80], 8); // step 0.1 → would be thousands
    expect(fc.features.length).toBeLessThanOrEqual(2000);
    expect(fc.features.some((f) => f.properties?.axis === "lon")).toBe(true);
    expect(fc.features.some((f) => f.properties?.axis === "lat")).toBe(true);
  });
});
