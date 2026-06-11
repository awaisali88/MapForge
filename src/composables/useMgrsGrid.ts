import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { useDebounceFn } from "@vueuse/core";
import { onBeforeUnmount, watch } from "vue";

import { type Bbox, mgrsGridGeoJSON } from "@/modules/geo/grid";
import { useOverlaysStore } from "@/stores/overlays";

/**
 * MGRS reference-grid overlay.
 *
 * Adds a GeoJSON source + a line layer + an MGRS-label symbol layer whose data
 * is recomputed on every `moveend`/`zoomend` (debounced, 150 ms) so the grid
 * always matches the current viewport. The store flag `overlays.mgrsGrid` drives
 * the toggle; all layers are removed when disabled.
 *
 * ## Why idle-defer on basemap switch
 *
 * After `map.setStyle(...)` MapLibre re-runs `Style._load`, which sets
 * `_loaded = true` BEFORE constructing `this.light = new Light(...)`. Adding a
 * source/layer in that narrow window causes the next `Style.update()` to read
 * `this.light.updateTransitions()` against a null `light`, throwing:
 *
 *   TypeError: Cannot read properties of null (reading 'updateTransitions')
 *
 * So `onStyleLoad` does NOT re-add directly — it defers to `map.once('idle')`
 * by which time light/sky/projection are fully initialized. This is the same
 * pattern used by `useHexGrid`, `useContours`, and `useGraticule`.
 */

const SOURCE = "mgrsgrid";
const LINE_LAYER = "mgrsgrid-lines";
const LABEL_LAYER = "mgrsgrid-labels";

/** MGRS reference-grid overlay; recomputes on move/zoom (debounced). */
export function useMgrsGrid(mapRef: ShallowRef<MaplibreMap | null>): void {
  const overlays = useOverlaysStore();
  let bound: MaplibreMap | null = null;

  function currentGeoJSON(map: MaplibreMap) {
    const b = map.getBounds();
    const bbox: Bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    return mgrsGridGeoJSON(bbox, map.getZoom());
  }

  function add(map: MaplibreMap): void {
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: "geojson", data: currentGeoJSON(map) });
    }
    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER,
        type: "line",
        source: SOURCE,
        paint: { "line-color": "rgba(255,210,80,0.55)", "line-width": 1 },
      });
    }
    if (!map.getLayer(LABEL_LAYER)) {
      map.addLayer({
        id: LABEL_LAYER,
        type: "symbol",
        source: SOURCE,
        // Only label longitude (vertical) lines; lat lines have no label property.
        filter: ["==", ["get", "axis"], "lon"],
        layout: {
          "text-field": ["get", "label"],
          "text-size": 10,
          "text-font": ["Noto Sans Regular"],
          // One label at the center of each line, and drop any that still overlap,
          // so dense longitude lines render as sparse, centered MGRS references.
          "symbol-placement": "line-center",
          "text-allow-overlap": false,
          "text-ignore-placement": false,
        },
        paint: {
          "text-color": "rgba(255,210,80,0.9)",
          "text-halo-color": "black",
          "text-halo-width": 1,
        },
      });
    }
  }

  function update(): void {
    if (!bound || !overlays.mgrsGrid) return;
    const src = bound.getSource(SOURCE) as GeoJSONSource | undefined;
    src?.setData(currentGeoJSON(bound));
  }
  const updateDebounced = useDebounceFn(update, 150);

  function remove(map: MaplibreMap): void {
    // On unmount the map may already be destroyed (style gone) — getLayer throws then.
    try {
      [LABEL_LAYER, LINE_LAYER].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    } catch {
      /* map torn down */
    }
  }

  // After a basemap switch (`setStyle`) the source + layers are wiped. Defer
  // the re-add to the next 'idle' event — NOT style.load directly — so
  // light/sky/projection are fully initialized before we mutate the style.
  function scheduleRebuild(map: MaplibreMap): void {
    map.once("idle", () => {
      if (bound === map && overlays.mgrsGrid && !map.getSource(SOURCE)) add(map);
    });
  }

  function onStyleLoad(): void {
    if (!bound) return;
    // setStyle wiped our source/layers; schedule rebuild via idle.
    if (overlays.mgrsGrid) scheduleRebuild(bound);
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("style.load", onStyleLoad);
    map.on("moveend", updateDebounced);
    map.on("zoomend", updateDebounced);
    if (overlays.mgrsGrid && map.isStyleLoaded()) add(map);
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
    () => overlays.mgrsGrid,
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
