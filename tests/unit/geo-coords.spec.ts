import { describe, expect, it } from "vitest";

import {
  formatCoords,
  latLonToDecimal,
  latLonToDMS,
  latLonToMGRS,
  mgrsToLatLon,
} from "@/modules/geo/coords";

describe("geo/coords", () => {
  describe("latLonToDecimal", () => {
    it("formats positive lat/lon with N/E suffixes", () => {
      expect(latLonToDecimal(30, 70)).toBe("30.0000°N 70.0000°E");
    });

    it("formats negative lat/lon with S/W suffixes", () => {
      expect(latLonToDecimal(-30, -70)).toBe("30.0000°S 70.0000°W");
    });

    it("honors the precision argument", () => {
      expect(latLonToDecimal(30.123456, 70.987654, 2)).toBe("30.12°N 70.99°E");
    });
  });

  describe("latLonToDMS", () => {
    it("converts whole degrees", () => {
      expect(latLonToDMS(30, 70)).toBe(`30°00'00.0"N 70°00'00.0"E`);
    });

    it("converts fractional degrees to D°M'S\"H", () => {
      expect(latLonToDMS(30.5, 70.25)).toBe(`30°30'00.0"N 70°15'00.0"E`);
    });

    it("uses S/W hemispheres for negative values", () => {
      const out = latLonToDMS(-1, -2);
      expect(out).toContain("S");
      expect(out).toContain("W");
    });
  });

  describe("MGRS", () => {
    it("latLonToMGRS produces a non-empty grid identifier", () => {
      const mgrs = latLonToMGRS(30, 70, 5);
      expect(mgrs.length).toBeGreaterThan(8);
      expect(mgrs).toMatch(/^\d{1,2}[A-Z]{3}/);
    });

    it("round-trips lat/lon within ~10 m at 5-digit precision", () => {
      const lat = 30.1234;
      const lon = 70.5678;
      const mgrs = latLonToMGRS(lat, lon, 5);
      const back = mgrsToLatLon(mgrs);
      expect(back.lat).toBeCloseTo(lat, 3);
      expect(back.lon).toBeCloseTo(lon, 3);
    });

    it("tolerates whitespace in the input string", () => {
      const mgrs = latLonToMGRS(30, 70, 4);
      const spaced = mgrs.replace(/(.{3})/g, "$1 ");
      const back = mgrsToLatLon(spaced);
      expect(back.lat).toBeCloseTo(30, 2);
      expect(back.lon).toBeCloseTo(70, 2);
    });
  });

  describe("formatCoords dispatcher", () => {
    it("dispatches DD format by default", () => {
      expect(formatCoords(30, 70)).toBe("30.0000°N 70.0000°E");
    });

    it("dispatches DMS when requested", () => {
      expect(formatCoords(30.5, 70, "DMS")).toContain(`30°30`);
    });

    it("dispatches MGRS when requested", () => {
      expect(formatCoords(30, 70, "MGRS")).toMatch(/^\d{1,2}[A-Z]{3}/);
    });
  });
});
