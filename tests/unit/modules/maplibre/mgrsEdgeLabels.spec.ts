import { describe, expect, it } from "vitest";

import { formatGridValue } from "@/modules/maplibre/mgrsEdgeLabels";

describe("mgrs edge labels — formatGridValue", () => {
  it("prints km grids as two zero-padded digits, no decimals", () => {
    // cell ≥ 1 km → kilometers, two digits.
    expect(formatGridValue(467000, 1000)).toBe("67");
    expect(formatGridValue(460000, 10000)).toBe("60");
    expect(formatGridValue(465000, 5000)).toBe("65");
    expect(formatGridValue(462000, 2000)).toBe("62");
    // Zero-padded and 100 km-square relative.
    expect(formatGridValue(405000, 1000)).toBe("05");
    expect(formatGridValue(400000, 1000)).toBe("00");
    expect(formatGridValue(500000, 1000)).toBe("00"); // wraps at the 100 km square
  });

  it("prints sub-km grids as three zero-padded digits (hundreds of metres)", () => {
    // cell < 1 km → hundreds of metres, three digits — no decimals.
    expect(formatGridValue(467500, 500)).toBe("675");
    expect(formatGridValue(467000, 500)).toBe("670");
    expect(formatGridValue(467200, 200)).toBe("672");
    expect(formatGridValue(467100, 100)).toBe("671");
    expect(formatGridValue(405300, 100)).toBe("053");
  });

  it("never emits a decimal point for any standard cell size", () => {
    for (const cell of [10000, 5000, 2000, 1000, 500, 200, 100]) {
      for (let e = 400000; e < 500000; e += cell) {
        expect(formatGridValue(e, cell)).not.toContain(".");
      }
    }
  });
});
