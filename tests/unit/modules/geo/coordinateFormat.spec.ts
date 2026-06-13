import { describe, expect, it } from "vitest";

import { formatForReadout } from "@/modules/geo/coords";

describe("formatForReadout", () => {
  it("returns decimal degrees when mgrs is false", () => {
    expect(formatForReadout(30, 70, false)).toBe("30.0000°N 70.0000°E");
  });

  it("returns an MGRS string when mgrs is true and in range", () => {
    const out = formatForReadout(30, 70, true);
    expect(out).toMatch(/^\d{1,2}[C-X]/); // GZD prefix, e.g. "42R..."
  });

  it("falls back to lat/lon when MGRS is undefined (out of range, e.g. > 84°)", () => {
    const out = formatForReadout(88, 70, true);
    expect(out).toContain("°N");
  });
});
