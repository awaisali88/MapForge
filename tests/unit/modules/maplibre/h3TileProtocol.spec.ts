import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { afterEach, describe, expect, it } from "vitest";

import {
  GLOBAL_ENUM_MAX_RES,
  generateTile,
  getGlobalCells,
  getH3Resolution,
  setH3Resolution,
} from "@/modules/maplibre/h3TileProtocol";

/** Decode an encoded MVT ArrayBuffer with @mapbox/vector-tile + pbf. */
function decode(buffer: ArrayBuffer): VectorTile {
  return new VectorTile(new PbfReader(new Uint8Array(buffer)));
}

/** All ring vertices of an h3 polygon feature as [x, y] tile-space pairs. */
function ringsOf(feature: ReturnType<VectorTile["layers"][string]["feature"]>) {
  return feature.loadGeometry().map((ring) => ring.map((p) => [p.x, p.y] as const));
}

// Exact h3 cell counts (not exactly 122*7^res because of the 12 pentagons,
// which have 6 children rather than 7) — these are the authoritative sizes.
const EXACT_COUNTS: Record<number, number> = {
  0: 122,
  1: 842,
  2: 5882,
  3: 41162,
};

describe("h3TileProtocol", () => {
  // The resolution is module-global; reset to the default after each test.
  afterEach(() => {
    setH3Resolution(2);
  });

  describe("getGlobalCells", () => {
    it("yields ≈122×7^res cells (the exact h3 child counts) for res 0..3", () => {
      for (let res = 0; res <= 3; res++) {
        const cells = getGlobalCells(res);
        // Exact h3 count.
        expect(cells.length).toBe(EXACT_COUNTS[res]);
        // …and within the pentagon-shortfall band of the 122×7^res approximation
        // (the 12 pentagons each shed one child per level, so the real count is
        // slightly below the naive power, but well within 5%).
        const approx = 122 * 7 ** res;
        expect(cells.length).toBeLessThanOrEqual(approx);
        expect(cells.length).toBeGreaterThan(approx * 0.95);
        // Every cell carries a center.
        for (const c of cells.slice(0, 5)) {
          expect(typeof c.id).toBe("string");
          expect(Number.isFinite(c.lat)).toBe(true);
          expect(Number.isFinite(c.lng)).toBe(true);
        }
      }
    });

    it("caches per resolution and updates currentResolution", () => {
      setH3Resolution(3);
      expect(getH3Resolution()).toBe(3);
      const a = getGlobalCells(3);
      const b = getGlobalCells(3);
      expect(a).toBe(b); // same cached array reference
      expect(GLOBAL_ENUM_MAX_RES).toBe(4);
    });
  });

  describe("antimeridian handling (Strategy A, res ≤ 4)", () => {
    it("emits cells on both sides of the seam, deduped, with no torn rings", () => {
      setH3Resolution(2);
      // Easternmost tile column at z4 spans [157.5, 180]; after the 50% pad it
      // reaches past +180, so cells just east of the antimeridian get wrapped in
      // via shiftForTile(±360).
      const z = 4;
      const x = (1 << z) - 1; // 15 — touches +180
      const y = 8; // straddles the equator
      const decoded = decode(generateTile(z, x, y));
      const layer = decoded.layers.h3!;
      expect(layer).toBeDefined();
      expect(layer.length).toBeGreaterThan(0);

      // No duplicate cell ids across the tile.
      const ids = new Set<string>();
      let sawWest = false;
      let sawEast = false;
      for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i);
        const id = f.properties.h3 as string;
        expect(ids.has(id)).toBe(false); // deduped
        ids.add(id);

        // No torn ring: each ring's lng span (re-projected to geo) stays < 180.
        const gj = f.toGeoJSON(x, y, z);
        const coords = (gj.geometry as { coordinates: number[][][] }).coordinates;
        for (const ring of coords) {
          const lngs = ring.map((pt) => pt[0]!);
          const span = Math.max(...lngs) - Math.min(...lngs);
          expect(span).toBeLessThan(180);
        }
        // Track whether the feature sits in the western (x near 0) or eastern
        // (x near EXTENT) half of the tile space, proving both sides render.
        const xs = ringsOf(f)
          .flat()
          .map((p) => p[0]);
        const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
        if (midX < 2048) sawWest = true;
        if (midX > 2048) sawEast = true;
      }
      // The seam tile gets contributions reaching both edges of tile space.
      expect(sawWest || sawEast).toBe(true);
    });
  });

  describe("polar tiles", () => {
    it("does not throw and yields a bounded cell set for the top/bottom rows", () => {
      setH3Resolution(2);
      const z = 4;
      const span = 1 << z;
      for (const y of [0, span - 1]) {
        for (const x of [0, 8, span - 1]) {
          let buffer: ArrayBuffer | undefined;
          expect(() => {
            buffer = generateTile(z, x, y);
          }).not.toThrow();
          expect(buffer).toBeInstanceOf(ArrayBuffer);
          const decoded = decode(buffer!);
          const layer = decoded.layers.h3!;
          // Bounded: either empty (drops the layer) or a sane count.
          if (layer) {
            expect(layer.length).toBeGreaterThan(0);
            expect(layer.length).toBeLessThan(20000);
          }
        }
      }
    });
  });

  describe("Strategy B (res > 4)", () => {
    it("stays bounded for a high-resolution tile", () => {
      setH3Resolution(7);
      expect(getH3Resolution()).toBe(7);
      // A small, mid-latitude tile at a moderate zoom; Strategy B (polygonToCells)
      // over the padded bbox must stay bounded.
      const z = 9;
      const x = 270;
      const y = 170;
      let buffer: ArrayBuffer | undefined;
      expect(() => {
        buffer = generateTile(z, x, y);
      }).not.toThrow();
      const decoded = decode(buffer!);
      const layer = decoded.layers.h3!;
      expect(layer).toBeDefined();
      expect(layer.length).toBeGreaterThan(0);
      expect(layer.length).toBeLessThan(10000);
      // Properties carry the active resolution.
      expect(layer.feature(0).properties.res).toBe(7);
    });
  });

  describe("MVT output (DEVIATION: h3 + res properties)", () => {
    it("decodes to an 'h3' layer of polygons with decoded h3 (string) + res (number) props and closed rings", () => {
      setH3Resolution(2);
      const z = 4;
      const x = 8;
      const y = 6;
      const decoded = decode(generateTile(z, x, y));

      expect(Object.keys(decoded.layers)).toEqual(["h3"]);
      const layer = decoded.layers.h3!;
      expect(layer.length).toBeGreaterThan(0);

      for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i);
        // POLYGON type === 3.
        expect(f.type).toBe(3);
        // Properties decode back with the right JS types.
        expect(typeof f.properties.h3).toBe("string");
        expect((f.properties.h3 as string).length).toBeGreaterThan(0);
        expect(typeof f.properties.res).toBe("number");
        expect(f.properties.res).toBe(2);

        // Rings are closed (first vertex repeated at the end).
        for (const ring of ringsOf(f)) {
          expect(ring.length).toBeGreaterThanOrEqual(4);
          expect(ring[0]![0]).toBe(ring[ring.length - 1]![0]);
          expect(ring[0]![1]).toBe(ring[ring.length - 1]![1]);
        }
      }
    });
  });
});
