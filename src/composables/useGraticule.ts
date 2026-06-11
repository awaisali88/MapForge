import type { Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { GeoGrid } from "geogrid-maplibre-gl";
import "geogrid-maplibre-gl/dist/geogrid.css";
import { onBeforeUnmount, watch } from "vue";

import { useOverlaysStore } from "@/stores/overlays";

/**
 * Lat/lon graticule overlay via `geogrid-maplibre-gl`.
 *
 * `new GeoGrid({...})` registers `map.once('load', add)` internally. Because
 * MapLibre's `'load'` event fires exactly once at init, any `GeoGrid`
 * constructed after that point (user toggle, basemap switch) will never have
 * its deferred `add()` called by the constructor. `build()` therefore calls
 * `grid.add()` itself when `map.loaded()` is already true. `.remove()` /
 * `.add()` are used for subsequent toggle calls.
 *
 * Lifecycle note: a basemap switch (`map.setStyle`, fired in `useTerraDraw`)
 * wipes every source and layer including the grid's. On `style.load` we call
 * `.remove()` on the stale instance first (to detach its `move` /
 * `projectiontransition` map listeners), swallow the expected layer-removal
 * throws, then construct a fresh `GeoGrid` against the new style. Skipping
 * `.remove()` leaves dangling listeners pointing at wiped sources, causing
 * `Cannot read properties of undefined (reading 'setData')` on every pan.
 *
 * Toggle on  → if no instance yet: build() — adds immediately if map loaded,
 *              otherwise deferred to map.once('load').
 *              if instance exists but was `.remove()`d: call `.add()`.
 * Toggle off → `.remove()`.
 * Detach     → `.remove()`, null instance and listener, null bound.
 */
export function useGraticule(mapRef: ShallowRef<MaplibreMap | null>): void {
  const overlays = useOverlaysStore();
  let bound: MaplibreMap | null = null;
  let grid: GeoGrid | null = null;

  function build(map: MaplibreMap): void {
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
    // GeoGrid's constructor registers map.once('load', add). MapLibre's 'load'
    // fires exactly once at init — when build() is called post-load (user toggle
    // or basemap switch) that handler never fires. Call add() ourselves in that
    // case. When the map hasn't loaded yet (initial mount with persisted
    // graticule on), the constructor's once('load') handles it and map.loaded()
    // is false here, so we don't double-add.
    if (map.loaded()) grid.add();
  }

  function enable(): void {
    if (!bound) return;
    if (!grid) {
      build(bound);
    } else {
      grid.add();
    }
  }

  function disable(): void {
    if (!grid) return;
    try {
      grid.remove();
    } catch {
      /* layers may already be gone if setStyle fired concurrently */
    }
  }

  function onStyleLoad(): void {
    if (!bound || !overlays.graticule) return;
    if (grid) {
      // Detach the stale instance's map listeners (move, projectiontransition,
      // etc.) before discarding it. remove() also tries to drop layers/sources
      // that setStyle already wiped, so layer-removal throws are expected and
      // swallowed — listener cleanup is all we need here.
      try {
        grid.remove();
      } catch {
        /* layers already wiped by setStyle — ignore */
      }
      grid = null;
    }
    // Build a fresh GeoGrid against the new style (constructor auto-adds).
    build(bound);
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("style.load", onStyleLoad);
    if (overlays.graticule) enable();
  }

  function detach(): void {
    if (!bound) return;
    bound.off("style.load", onStyleLoad);
    disable();
    grid = null;
    bound = null;
  }

  watch(
    () => overlays.graticule,
    (on) => (on ? enable() : disable()),
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
