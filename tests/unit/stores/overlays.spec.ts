import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";

import { useOverlaysStore } from "@/stores/overlays";

describe("overlays store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("defaults every overlay to off and units to meters", () => {
    const s = useOverlaysStore();
    expect(s.graticule).toBe(false);
    expect(s.mgrsGrid).toBe(false);
    expect(s.contourUnits).toBe("m");
  });

  it("toggle(key) flips a single flag", () => {
    const s = useOverlaysStore();
    s.toggle("graticule");
    expect(s.graticule).toBe(true);
    s.toggle("graticule");
    expect(s.graticule).toBe(false);
  });

  it("persists flags to localStorage", async () => {
    const s = useOverlaysStore();
    s.toggle("mgrsGrid");
    await nextTick();
    expect(localStorage.getItem("mapforge:overlay:mgrsGrid")).toContain("true");
  });

  it("setContourUnits and setBasemap update state", () => {
    const s = useOverlaysStore();
    s.setContourUnits("ft");
    s.setBasemap("google-satellite");
    expect(s.contourUnits).toBe("ft");
    expect(s.basemapId).toBe("google-satellite");
  });
});
