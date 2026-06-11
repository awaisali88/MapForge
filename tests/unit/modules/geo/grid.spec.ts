import { describe, expect, it } from "vitest";

import { h3ResolutionForZoom, hexGridGeoJSON } from "@/modules/geo/grid";

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
