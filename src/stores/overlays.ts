import { useLocalStorage } from "@vueuse/core";
import { defineStore } from "pinia";

/** Boolean overlay toggles the settings drawer controls. */
export type OverlayKey = "contours" | "graticule" | "hexGrid" | "mgrsGrid" | "terrain";
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
  const contourUnits = useLocalStorage<ContourUnits>("mapforge:overlay:contourUnits", "m");
  const basemapId = useLocalStorage("mapforge:overlay:basemapId", "");

  const flags = { graticule, hexGrid, mgrsGrid, contours, terrain };

  function toggle(key: OverlayKey): void {
    flags[key].value = !flags[key].value;
  }
  function setContourUnits(u: ContourUnits): void {
    contourUnits.value = u;
  }
  function setBasemap(id: string): void {
    basemapId.value = id;
  }

  return {
    graticule,
    hexGrid,
    mgrsGrid,
    contours,
    terrain,
    contourUnits,
    basemapId,
    toggle,
    setContourUnits,
    setBasemap,
  };
});
