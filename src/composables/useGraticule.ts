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
 * wipes every source and layer including the grid's. On `style.load` we discard
 * the stale instance and construct a fresh `GeoGrid` against the new style, which
 * re-adds the grid automatically. This is the safest approach: re-calling `.add()`
 * on an instance whose internal layers no longer exist causes errors.
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
    grid?.remove();
  }

  function onStyleLoad(): void {
    if (!bound || !overlays.graticule) return;
    // setStyle wiped the grid's internal layers; discard the stale instance and
    // build a fresh one against the new style (constructor auto-adds).
    grid = null;
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
