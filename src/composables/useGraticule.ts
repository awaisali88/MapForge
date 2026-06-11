import type { Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { GeoGrid } from "geogrid-maplibre-gl";
import "geogrid-maplibre-gl/dist/geogrid.css";
import { onBeforeUnmount, watch } from "vue";

import { useOverlaysStore } from "@/stores/overlays";

/**
 * Lat/lon graticule overlay via `geogrid-maplibre-gl`.
 *
 * `new GeoGrid({...})` immediately adds its layers and DOM labels to the map —
 * no separate `.add()` is needed on first construction. `.remove()` / `.add()`
 * toggle them on subsequent calls.
 *
 * Lifecycle note: a basemap switch (`map.setStyle`, fired in `useTerraDraw`)
 * wipes every source and layer including the grid's. On `style.load` we call
 * `.remove()` on the stale instance first (to detach its `move` /
 * `projectiontransition` map listeners), swallow the expected layer-removal
 * throws, then construct a fresh `GeoGrid` against the new style. Skipping
 * `.remove()` leaves dangling listeners pointing at wiped sources, causing
 * `Cannot read properties of undefined (reading 'setData')` on every pan.
 *
 * Toggle on  → if no instance yet: construct one (auto-adds).
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
      gridStyle: { color: "rgba(255,255,255,0.4)", width: 1 },
      labelStyle: { color: "rgba(255,255,255,0.7)", fontSize: "12px" },
      zoomLevelRange: [0, 14],
    });
    // new GeoGrid() immediately adds itself; no extra .add() required.
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
