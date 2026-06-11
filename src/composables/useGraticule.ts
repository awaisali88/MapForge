import type { Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { GeoGrid } from "geogrid-maplibre-gl";
import "geogrid-maplibre-gl/dist/geogrid.css";
import { onBeforeUnmount, watch } from "vue";

import { useOverlaysStore } from "@/stores/overlays";

/**
 * Lat/lon graticule overlay via `geogrid-maplibre-gl`.
 *
 * ## Why idle-defer on basemap switch
 *
 * After `map.setStyle(...)` MapLibre re-runs `Style._load`, which sets
 * `_loaded = true` BEFORE constructing `this.light = new Light(...)`. If
 * anything calls `Style.update()` (triggered by `_changed` becoming true)
 * in that narrow window, it reads `this.light.updateTransitions()` against
 * a null `light` and throws:
 *
 *   TypeError: Cannot read properties of null (reading 'updateTransitions')
 *
 * Adding geogrid's layers/sources during that window sets `_changed` and
 * triggers exactly that render path. The fix is the same pattern
 * `useTerraDraw` uses for setStyle-survival: **defer the re-add to the
 * next `'idle'` event**, by which time light/sky/projection are fully
 * initialized and all transition bookkeeping has settled.
 *
 * ## Toggle semantics
 *
 * - Toggle on  → `build()` immediately if style is loaded; nothing to do
 *               if style hasn't loaded yet (initial mount with persisted
 *               graticule on — `attach()` calls `build()` once
 *               `isStyleLoaded()` is true, otherwise the first `style.load`
 *               handler handles it).
 * - Toggle off → `remove()`.
 * - Style switch → `suspendForStyleSwitch()` tears down before setStyle;
 *                  `onStyleLoad` schedules a rebuild via `scheduleRebuild`.
 * - Detach     → full cleanup.
 */
export function useGraticule(mapRef: ShallowRef<MaplibreMap | null>): {
  suspendForStyleSwitch: () => void;
} {
  const overlays = useOverlaysStore();
  let bound: MaplibreMap | null = null;
  let grid: GeoGrid | null = null;

  function build(map: MaplibreMap): void {
    if (grid) return;
    grid = new GeoGrid({
      map,
      gridStyle: { color: "rgba(70,80,100,0.55)", width: 1 },
      labelStyle: {
        color: "rgba(40,45,60,0.95)",
        fontSize: "12px",
        textShadow: "0 0 2px rgba(255,255,255,0.85)",
      },
      zoomLevelRange: [0, 14],
    });
    // We only build when the style is already loaded (toggle-on while loaded, or
    // deferred to 'idle' after a style switch), so geogrid's constructor
    // map.once('load', add) won't fire — add() ourselves.
    grid.add();
  }

  function remove(): void {
    if (!grid) return;
    try {
      grid.remove();
    } catch {
      /* layers may already be wiped by setStyle */
    }
    grid = null;
  }

  // After a basemap switch, rebuild once the map is idle: light/sky/projection
  // are fully initialized and transitions have settled, so geogrid's layer adds
  // don't trigger a render that reads a null style.light.
  function scheduleRebuild(map: MaplibreMap): void {
    map.once("idle", () => {
      if (bound === map && overlays.graticule && !grid) build(map);
    });
  }

  function onStyleLoad(): void {
    if (!bound) return;
    remove(); // stale layers were wiped by setStyle; detach listeners
    if (overlays.graticule) scheduleRebuild(bound);
  }

  /**
   * Detach the grid (layers + move/projectiontransition listeners) before the
   * setStyle reload window so nothing renders against the half-built style.
   * `onStyleLoad` → `scheduleRebuild` → `'idle'` will reconstruct it once
   * light/sky/projection are fully initialized.
   */
  function suspendForStyleSwitch(): void {
    remove();
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("style.load", onStyleLoad);
    // Style already loaded when we attach (e.g. graticule persisted on and the
    // map loaded fast)? build now. Otherwise the initial 'style.load' handles it.
    if (overlays.graticule && map.isStyleLoaded()) build(map);
  }

  function detach(): void {
    if (!bound) return;
    bound.off("style.load", onStyleLoad);
    remove();
    bound = null;
  }

  watch(
    () => overlays.graticule,
    (on) => {
      if (!bound) return;
      if (on) {
        if (bound.isStyleLoaded()) build(bound); // toggle on → show immediately
      } else {
        remove(); // toggle off → hide
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

  return { suspendForStyleSwitch };
}
