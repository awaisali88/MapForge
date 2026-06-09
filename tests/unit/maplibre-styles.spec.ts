import { describe, expect, it } from "vitest";

import {
  OFFLINE_STUB_STYLE,
  OPENFREEMAP_BRIGHT,
  OPENFREEMAP_LIBERTY,
  OPENFREEMAP_POSITRON,
} from "@/modules/maplibre/styles";

describe("maplibre style constants", () => {
  it("OpenFreeMap URLs point at the public CDN over HTTPS", () => {
    expect(OPENFREEMAP_LIBERTY).toBe("https://tiles.openfreemap.org/styles/liberty");
    expect(OPENFREEMAP_BRIGHT).toMatch(/^https:\/\/tiles\.openfreemap\.org\/styles\//);
    expect(OPENFREEMAP_POSITRON).toMatch(/^https:\/\/tiles\.openfreemap\.org\/styles\//);
  });

  it("OFFLINE_STUB_STYLE is a valid v8 spec with a single background layer", () => {
    expect(OFFLINE_STUB_STYLE.version).toBe(8);
    expect(OFFLINE_STUB_STYLE.sources).toEqual({});
    expect(OFFLINE_STUB_STYLE.layers).toHaveLength(1);
    expect(OFFLINE_STUB_STYLE.layers[0]?.type).toBe("background");
  });
});
