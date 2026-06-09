import type { Feature } from "geojson";

import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useDrawingsStore } from "@/stores/drawings";

function poly(id?: string): Feature {
  return {
    type: "Feature",
    id,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
    properties: {},
  };
}

describe("drawings store", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("starts empty", () => {
    const s = useDrawingsStore();
    expect(s.count).toBe(0);
    expect(s.featureCollection.features).toHaveLength(0);
  });

  it("setAll replaces the mirror and drives count + featureCollection", () => {
    const s = useDrawingsStore();
    s.setAll([poly("a"), poly("b")]);
    expect(s.count).toBe(2);
    expect(s.featureCollection.type).toBe("FeatureCollection");
    expect(s.featureCollection.features).toHaveLength(2);

    s.setAll([poly("c")]);
    expect(s.count).toBe(1);
  });

  it("setAll reuses a string feature id, else generates one", () => {
    const s = useDrawingsStore();
    s.setAll([poly("keep"), poly(undefined)]);
    expect(s.drawings[0]?.id).toBe("keep");
    expect(typeof s.drawings[1]?.id).toBe("string");
    expect(s.drawings[1]?.id).not.toBe("");
  });

  it("clear empties the mirror", () => {
    const s = useDrawingsStore();
    s.setAll([poly("a")]);
    s.clear();
    expect(s.count).toBe(0);
  });
});
