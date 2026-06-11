import type { Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import mlcontour from "maplibre-contour";
import maplibregl from "maplibre-gl";
import { onBeforeUnmount, watch } from "vue";

import { localDemConfig } from "@/modules/maplibre/terrain";
import { useOverlaysStore } from "@/stores/overlays";

/**
 * DEM contour lines + elevation labels via `maplibre-contour`.
 *
 * `maplibre-contour` registers a custom maplibre protocol that turns the local
 * `raster-dem` tiles into on-the-fly vector contour tiles. We add a `vector`
 * source pointed at `demSource.contourProtocolUrl(...)`, plus a line layer and a
 * symbol label layer. `overlays.contourUnits` (m/ft) drives the elevation
 * `multiplier` and the label suffix; a units change rebuilds the source.
 *
 * ## Why idle-defer on basemap switch
 *
 * After `map.setStyle(...)` MapLibre re-runs `Style._load`, which sets
 * `_loaded = true` BEFORE constructing `this.light = new Light(...)`. Adding a
 * source/layer in that window flips `_changed`, and the next `Style.update()`
 * reads `this.light.updateTransitions()` against a null `light`, throwing:
 *
 *   TypeError: Cannot read properties of null (reading 'updateTransitions')
 *
 * So we DON'T re-add on `style.load` directly. We defer the re-add to the next
 * `'idle'` event (the same pattern `useGraticule`/`useTerraDraw` use), by which
 * time light/sky/projection are fully initialized and transitions have settled.
 */

const SOURCE = "contours";
const LINE_LAYER = "contour-lines";
const LABEL_LAYER = "contour-labels";

// One DemSource + protocol registration per app (module scope). The protocol is
// global to the maplibre instance, so it must be registered exactly once.
const dem = localDemConfig();
let demSource: InstanceType<typeof mlcontour.DemSource> | null = null;
if (dem) {
  demSource = new mlcontour.DemSource({
    url: dem.tiles[0]!,
    encoding: dem.encoding,
    maxzoom: dem.maxzoom,
    worker: true,
  });
  demSource.setupMaplibre(maplibregl);
}

/** Contour lines + labels from the local DEM. Units (m/ft) drive the multiplier. */
export function useContours(mapRef: ShallowRef<MaplibreMap | null>): void {
  const overlays = useOverlaysStore();
  let bound: MaplibreMap | null = null;

  function add(map: MaplibreMap): void {
    if (!demSource || map.getSource(SOURCE)) return;
    const multiplier = overlays.contourUnits === "ft" ? 3.28084 : 1;
    map.addSource(SOURCE, {
      type: "vector",
      tiles: [
        demSource.contourProtocolUrl({
          multiplier,
          // [minor, major] interval (metres) per zoom. maplibre-contour uses the
          // entry for the highest key <= the tile zoom, so without low-zoom keys
          // NOTHING renders until you're zoomed to 11+. Start at zoom 8 so
          // contours appear as soon as you zoom into terrain.
          thresholds: {
            8: [500, 2000],
            10: [200, 1000],
            11: [200, 1000],
            12: [100, 500],
            13: [100, 500],
            14: [50, 200],
            15: [20, 100],
          },
          contourLayer: "contours",
          elevationKey: "ele",
          levelKey: "level",
        }),
      ],
      maxzoom: 15,
    });
    map.addLayer({
      id: LINE_LAYER,
      type: "line",
      source: SOURCE,
      "source-layer": "contours",
      paint: {
        "line-color": "rgba(120,90,40,0.6)",
        "line-width": ["match", ["get", "level"], 1, 1.2, 0.5],
      },
    });
    map.addLayer({
      id: LABEL_LAYER,
      type: "symbol",
      source: SOURCE,
      "source-layer": "contours",
      filter: [">", ["get", "level"], 0],
      layout: {
        "symbol-placement": "line",
        "text-size": 10,
        "text-field": ["concat", ["number-format", ["get", "ele"], {}], overlays.contourUnits],
        "text-font": ["Noto Sans Regular"],
      },
      paint: { "text-halo-color": "white", "text-halo-width": 1 },
    });
  }

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

  function rebuild(): void {
    if (!bound) return;
    remove(bound);
    if (overlays.contours && bound.isStyleLoaded()) add(bound);
  }

  // After a basemap switch (setStyle) the old source/layers are wiped. Re-add on
  // the next 'idle' — NOT on 'style.load' directly — so light/sky/projection are
  // fully initialized and the add doesn't trigger the null-light render crash.
  function scheduleRebuild(map: MaplibreMap): void {
    map.once("idle", () => {
      if (bound === map && overlays.contours && !map.getSource(SOURCE)) add(map);
    });
  }

  function onStyleLoad(): void {
    if (!bound) return;
    remove(bound); // stale layers were wiped by setStyle
    if (overlays.contours) scheduleRebuild(bound);
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("style.load", onStyleLoad);
    if (overlays.contours && map.isStyleLoaded()) add(map);
  }

  function detach(): void {
    if (!bound) return;
    bound.off("style.load", onStyleLoad);
    remove(bound);
    bound = null;
  }

  // Toggle on → add immediately (style already loaded); toggle off → remove.
  watch(
    () => overlays.contours,
    (on) => {
      if (!bound) return;
      if (on) {
        if (bound.isStyleLoaded()) add(bound);
      } else {
        remove(bound);
      }
    },
  );

  // Units change → rebuild the source so the multiplier + label suffix update.
  watch(
    () => overlays.contourUnits,
    () => rebuild(),
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
