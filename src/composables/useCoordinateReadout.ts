import type { Map as MaplibreMap, MapMouseEvent } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { onBeforeUnmount, ref, watch } from "vue";

import { formatForReadout } from "@/modules/geo/coords";
import { useOverlaysStore } from "@/stores/overlays";

/**
 * Bottom-right cursor readout. Tracks the pointer over the map and formats the
 * position as MGRS (when the MGRS grid is on, with lat/lon fallback) or decimal
 * degrees. Returns a reactive string for `CoordinateReadout.vue`.
 *
 * Lifecycle mirrors `useTerrain`: watches `mapRef` with `{ immediate: true }`,
 * binds map events on attach, unbinds on detach, and calls `onBeforeUnmount`.
 * When `overlays.mgrsGrid` toggles, re-renders the last known position so the
 * format switches live without needing to move the cursor.
 */
export function useCoordinateReadout(mapRef: ShallowRef<MaplibreMap | null>) {
  const overlays = useOverlaysStore();
  const text = ref("");
  let bound: MaplibreMap | null = null;
  let lastLngLat: { lat: number; lng: number } | null = null;

  function render(): void {
    if (!lastLngLat) {
      text.value = "";
      return;
    }
    text.value = formatForReadout(lastLngLat.lat, lastLngLat.lng, overlays.mgrsGrid);
  }

  function onMove(e: MapMouseEvent): void {
    lastLngLat = { lat: e.lngLat.lat, lng: e.lngLat.lng };
    render();
  }

  function onOut(): void {
    lastLngLat = null;
    text.value = "";
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
  }

  function detach(): void {
    if (!bound) return;
    bound.off("mousemove", onMove);
    bound.off("mouseout", onOut);
    bound = null;
  }

  // Re-render with the last known position when the MGRS toggle changes so the
  // format switches live (no cursor move required).
  watch(() => overlays.mgrsGrid, render);

  watch(
    mapRef,
    (m) => {
      detach();
      if (m) attach(m);
    },
    { immediate: true },
  );

  onBeforeUnmount(detach);

  return { text };
}
