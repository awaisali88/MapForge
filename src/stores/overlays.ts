import { useLocalStorage } from "@vueuse/core";
import { defineStore } from "pinia";
import { readonly } from "vue";

/** Overlay keys whose boolean flags the settings drawer controls. */
export type OverlayKey = "contours" | "globe" | "graticule" | "hexGrid" | "mgrsGrid" | "terrain";
export type ContourUnits = "ft" | "m";

/**
 * Serializable map-overlay settings, persisted to localStorage so a reload
 * restores the last basemap + overlay set. Components read via `storeToRefs`
 * and mutate only through the actions.
 */
export const useOverlaysStore = defineStore("overlays", () => {
  const graticule = useLocalStorage("mapforge:overlay:graticule", false);
  const hexGrid = useLocalStorage("mapforge:overlay:hexGrid", false);
  const mgrsGrid = useLocalStorage("mapforge:overlay:mgrsGrid", false);
  const contours = useLocalStorage("mapforge:overlay:contours", false);
  const terrain = useLocalStorage("mapforge:overlay:terrain", false);
  // 3D globe projection (globe when zoomed out, flat when zoomed in). Default on.
  const globe = useLocalStorage("mapforge:overlay:globe", true);
  const contourUnits = useLocalStorage<ContourUnits>("mapforge:overlay:contourUnits", "m");
  const basemapId = useLocalStorage("mapforge:overlay:basemapId", "");

  // Internal writable map used by actions; never exposed directly.
  const flags = { graticule, hexGrid, mgrsGrid, contours, terrain, globe };

  function toggle(key: OverlayKey): void {
    flags[key].value = !flags[key].value;
  }
  function set(key: OverlayKey, value: boolean): void {
    flags[key].value = value;
  }
  function setContourUnits(u: ContourUnits): void {
    contourUnits.value = u;
  }
  function setBasemap(id: string): void {
    basemapId.value = id;
  }

  return {
    graticule: readonly(graticule),
    hexGrid: readonly(hexGrid),
    mgrsGrid: readonly(mgrsGrid),
    contours: readonly(contours),
    terrain: readonly(terrain),
    globe: readonly(globe),
    contourUnits: readonly(contourUnits),
    basemapId: readonly(basemapId),
    toggle,
    set,
    setContourUnits,
    setBasemap,
  };
});
