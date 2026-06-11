import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { useDebounceFn } from "@vueuse/core";
import { onBeforeUnmount, watch } from "vue";

import { type Bbox, h3ResolutionForZoom, hexGridGeoJSON } from "@/modules/geo/grid";
import { useOverlaysStore } from "@/stores/overlays";

/**
 * H3 hexagon grid overlay.
 *
 * Adds a GeoJSON source + line layer whose data is recomputed on every
 * `moveend`/`zoomend` (debounced, 150 ms) so the visible cells always match
 * the current viewport. The store flag `overlays.hexGrid` drives the
 * toggle; the layer is removed when disabled.
 *
 * ## Why idle-defer on basemap switch
 *
 * After `map.setStyle(...)` MapLibre re-runs `Style._load`, which sets
 * `_loaded = true` BEFORE constructing `this.light = new Light(...)`. Adding
 * a source/layer in that narrow window flips `_changed`, and the next
 * `Style.update()` reads `this.light.updateTransitions()` against a null
 * `light`, throwing:
 *
 *   TypeError: Cannot read properties of null (reading 'updateTransitions')
 *
 * So `onStyleLoad` does NOT re-add directly — it defers to `map.once('idle')`
 * by which time light/sky/projection are fully initialized.
 */

const SOURCE = "hexgrid";
const LAYER = "hexgrid-lines";

/** H3 hexagon grid overlay; recomputes visible cells on move/zoom (debounced). */
export function useHexGrid(mapRef: ShallowRef<MaplibreMap | null>): void {
  const overlays = useOverlaysStore();
  let bound: MaplibreMap | null = null;

  function currentGeoJSON(map: MaplibreMap) {
    const b = map.getBounds();
    const bbox: Bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    return hexGridGeoJSON(bbox, h3ResolutionForZoom(map.getZoom()));
  }

  function add(map: MaplibreMap): void {
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: "geojson", data: currentGeoJSON(map) });
    }
    if (!map.getLayer(LAYER)) {
      map.addLayer({
        id: LAYER,
        type: "line",
        source: SOURCE,
        paint: { "line-color": "rgba(16,196,162,0.5)", "line-width": 1 },
      });
    }
  }

  function update(): void {
    if (!bound || !overlays.hexGrid) return;
    const src = bound.getSource(SOURCE) as GeoJSONSource | undefined;
    src?.setData(currentGeoJSON(bound));
  }
  const updateDebounced = useDebounceFn(update, 150);

  function remove(map: MaplibreMap): void {
    // On unmount the map may already be destroyed (style gone) — getLayer throws then.
    try {
      if (map.getLayer(LAYER)) map.removeLayer(LAYER);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    } catch {
      /* map torn down */
    }
  }

  // After a basemap switch (`setStyle`) the source + layer are wiped. Defer
  // the re-add to the next 'idle' event — NOT style.load directly — so
  // light/sky/projection are fully initialized before we mutate the style.
  function scheduleRebuild(map: MaplibreMap): void {
    map.once("idle", () => {
      if (bound === map && overlays.hexGrid && !map.getSource(SOURCE)) add(map);
    });
  }

  function onStyleLoad(): void {
    if (!bound) return;
    // setStyle wiped our source/layer; schedule rebuild via idle.
    if (overlays.hexGrid) scheduleRebuild(bound);
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("style.load", onStyleLoad);
    map.on("moveend", updateDebounced);
    map.on("zoomend", updateDebounced);
    if (overlays.hexGrid && map.isStyleLoaded()) add(map);
  }

  function detach(): void {
    if (!bound) return;
    bound.off("style.load", onStyleLoad);
    bound.off("moveend", updateDebounced);
    bound.off("zoomend", updateDebounced);
    remove(bound);
    bound = null;
  }

  // Toggle on → add immediately (style already loaded); toggle off → remove.
  watch(
    () => overlays.hexGrid,
    (on) => {
      if (!bound) return;
      if (on) {
        if (bound.isStyleLoaded()) add(bound);
      } else {
        remove(bound);
      }
    },
  );

  watch(
    mapRef,
    (m) => {
      detach();
      if (m) attach(m);
    },
    { immediate: true },
  );

  onBeforeUnmount(detach);
}
