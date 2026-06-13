import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { describe, expect, it } from "vitest";

import {
  bandLatRange,
  cellMetersToDigits,
  generateTile,
  iterateGzds,
  llToUtm,
  setMgrsCellMeters,
  utmToLl,
  zoneLngRange,
} from "@/modules/maplibre/mgrsTileProtocol";

/** Decode an encoded MVT ArrayBuffer with @mapbox/vector-tile + pbf. */
function decode(buffer: ArrayBuffer): VectorTile {
  return new VectorTile(new PbfReader(new Uint8Array(buffer)));
}

/** UTM zone number for a longitude (1..60). */
function zoneFor(lng: number): number {
  return Math.floor((lng + 180) / 6) + 1;
}

describe("mgrs tile protocol", () => {
  describe("UTM round-trip (llToUtm → utmToLl)", () => {
    const samples: Array<{ name: string; lat: number; lng: number }> = [
      { name: "N hemisphere, zone 32 (Germany)", lat: 50.1, lng: 8.7 },
      { name: "N hemisphere, zone 18 (New York)", lat: 40.7, lng: -74.0 },
      { name: "S hemisphere, zone 23 (Rio)", lat: -22.9, lng: -43.2 },
      { name: "S hemisphere, zone 34 (Johannesburg)", lat: -26.2, lng: 28.0 },
      { name: "Near equator, N (Singapore)", lat: 1.35, lng: 103.8 },
    ];

    for (const s of samples) {
      it(`round-trips ${s.name} to < 1e-3 m`, () => {
        const zone = zoneFor(s.lng);
        const { easting, northing } = llToUtm(s.lat, s.lng, zone);
        const back = utmToLl(easting, northing, zone, s.lat < 0);

        // Convert the lat/lng error back into metres at this latitude so the
        // assertion is a true ground-distance tolerance.
        const metersPerDegLat = 111_320;
        const metersPerDegLng = 111_320 * Math.cos((s.lat * Math.PI) / 180);
        const dLatM = Math.abs(back.lat - s.lat) * metersPerDegLat;
        const dLngM = Math.abs(back.lng - s.lng) * metersPerDegLng;
        const errorM = Math.hypot(dLatM, dLngM);

        expect(errorM).toBeLessThan(1e-3);
      });
    }
  });

  describe("cellMetersToDigits", () => {
    it("maps decade cell sizes to their MGRS digit precision", () => {
      expect(cellMetersToDigits(100000)).toBe(0);
      expect(cellMetersToDigits(10000)).toBe(1);
      expect(cellMetersToDigits(1000)).toBe(2);
      expect(cellMetersToDigits(100)).toBe(3);
      expect(cellMetersToDigits(10)).toBe(4);
    });

    it("rounds non-decade cell sizes down to the finest decade ≤ the cell", () => {
      // 50 km labels at 10 km precision; 5 km / 2 km at 1 km precision;
      // 500 m / 200 m label at 100 m precision.
      expect(cellMetersToDigits(50000)).toBe(1);
      expect(cellMetersToDigits(5000)).toBe(2);
      expect(cellMetersToDigits(2000)).toBe(2);
      expect(cellMetersToDigits(500)).toBe(3);
      expect(cellMetersToDigits(200)).toBe(3);
    });
  });

  describe("GZD longitude exceptions (Norway / Svalbard)", () => {
    it("returns the Norway band-V special ranges", () => {
      expect(zoneLngRange(31, "V")).toEqual([0, 3]);
      expect(zoneLngRange(32, "V")).toEqual([3, 12]);
    });

    it("returns the Svalbard band-X special ranges", () => {
      expect(zoneLngRange(31, "X")).toEqual([0, 9]);
      expect(zoneLngRange(33, "X")).toEqual([9, 21]);
      expect(zoneLngRange(35, "X")).toEqual([21, 33]);
      expect(zoneLngRange(37, "X")).toEqual([33, 42]);
    });

    it("returns the default 6° range for a normal zone/band", () => {
      expect(zoneLngRange(32, "U")).toEqual([6, 12]);
      expect(zoneLngRange(1, "N")).toEqual([-180, -174]);
    });

    it("widens band X to 72..84", () => {
      expect(bandLatRange("X")).toEqual([72, 84]);
    });
  });

  describe("iterateGzds", () => {
    it("omits the non-existent 32X / 34X / 36X zones", () => {
      // Box covering the Svalbard band X across the relevant longitudes.
      const gzds = [...iterateGzds(0, 42, 72, 84)];
      const bandX = gzds.filter((g) => g.band === "X");
      const zones = bandX.map((g) => g.zone);
      expect(zones).not.toContain(32);
      expect(zones).not.toContain(34);
      expect(zones).not.toContain(36);
      // The Svalbard specials are present with their custom ranges.
      const z31 = bandX.find((g) => g.zone === 31);
      const z33 = bandX.find((g) => g.zone === 33);
      const z35 = bandX.find((g) => g.zone === 35);
      const z37 = bandX.find((g) => g.zone === 37);
      expect(z31).toMatchObject({ lngW: 0, lngE: 9 });
      expect(z33).toMatchObject({ lngW: 9, lngE: 21 });
      expect(z35).toMatchObject({ lngW: 21, lngE: 33 });
      expect(z37).toMatchObject({ lngW: 33, lngE: 42 });
    });

    it("re-emits 31V / 32V with their Norway special ranges (not the default)", () => {
      const gzds = [...iterateGzds(0, 12, 56, 64)];
      const bandV = gzds.filter((g) => g.band === "V");
      const z31 = bandV.filter((g) => g.zone === 31);
      const z32 = bandV.filter((g) => g.zone === 32);
      // Each emitted exactly once, with the special longitude range.
      expect(z31).toHaveLength(1);
      expect(z32).toHaveLength(1);
      expect(z31[0]).toMatchObject({ lngW: 0, lngE: 3 });
      expect(z32[0]).toMatchObject({ lngW: 3, lngE: 12 });
    });
  });

  describe("generateTile MVT output", () => {
    it("decodes a mid-latitude land tile to both layers with line features", () => {
      setMgrsCellMeters(100000);
      // z5/16/10 covers central Europe (~lat 50, lng 10) — land, mid-latitude.
      const tile = decode(generateTile(5, 16, 10));

      // The line layer is populated for a mid-latitude land tile.
      expect(tile.layers.mgrs).toBeDefined();
      const lineLayer = tile.layers.mgrs!;
      expect(lineLayer.length).toBeGreaterThanOrEqual(1);

      // Every "mgrs" feature is a LineString (type 2) with no properties.
      const f0 = lineLayer.feature(0);
      expect(f0.type).toBe(2);
      expect(Object.keys(f0.properties)).toHaveLength(0);

      // Labels layer carries a "label" string property when populated.
      // (@mapbox/vector-tile drops the layer entirely if it has no features.)
      const labelLayer = tile.layers.mgrs_labels;
      if (labelLayer && labelLayer.length > 0) {
        const lf = labelLayer.feature(0);
        expect(lf.type).toBe(1);
        expect(typeof lf.properties.label).toBe("string");
      }
    });

    it("emits an empty-but-valid tile with zero line features for a polar tile (> 84°)", () => {
      setMgrsCellMeters(100000);
      // z8/128/0 sits entirely above 84°N → clamps to an empty-but-valid tile.
      // Both layers are still encoded on the wire (so style source-layer refs
      // resolve), but @mapbox/vector-tile drops zero-feature layers on decode,
      // so the assertion is "no line/label features present".
      const tile = decode(generateTile(8, 128, 0));

      // mgrs / mgrs_labels are either absent (dropped because empty) or zero-length.
      expect(tile.layers.mgrs?.length ?? 0).toBe(0);
      expect(tile.layers.mgrs_labels?.length ?? 0).toBe(0);
    });
  });
});
