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

  // MGRS grid tunables (persisted).
  // mgrsAuto: true = derive the level from zoom; false = use mgrsLevel directly.
  // mgrsLevel: 0–8 index into MGRS_LEVELS (0=100 km … 8=100 m); see useMgrsGrid.
  const mgrsAuto = useLocalStorage("mapforge:overlay:mgrsAuto", true);
  const mgrsLevel = useLocalStorage("mapforge:overlay:mgrsLevel", 0);

  // H3 hexagon grid tunables (persisted).
  // hexAuto: true = derive resolution from zoom; false = use hexResolution directly.
  // hexResolution: 0–8 (H3 resolution level).
  const hexAuto = useLocalStorage("mapforge:overlay:hexAuto", true);
  const hexResolution = useLocalStorage("mapforge:overlay:hexResolution", 3);

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

  // MGRS tunable actions.
  function setMgrsAuto(b: boolean): void {
    mgrsAuto.value = b;
  }
  function setMgrsLevel(n: number): void {
    mgrsLevel.value = n;
  }

  // H3 tunable actions.
  function setHexAuto(b: boolean): void {
    hexAuto.value = b;
  }
  function setHexResolution(n: number): void {
    hexResolution.value = n;
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
    mgrsAuto: readonly(mgrsAuto),
    mgrsLevel: readonly(mgrsLevel),
    hexAuto: readonly(hexAuto),
    hexResolution: readonly(hexResolution),
    toggle,
    set,
    setContourUnits,
    setBasemap,
    setMgrsAuto,
    setMgrsLevel,
    setHexAuto,
    setHexResolution,
  };
});
