import "maplibre-gl/dist/maplibre-gl.css";
import { Map as MapLibreMap, type MapOptions } from "maplibre-gl";
import { onBeforeUnmount, shallowRef } from "vue";

import { defaultBasemap, resolveBasemapStyle } from "@/modules/maplibre/basemaps";

/** Read a numeric VITE_ env var, falling back when unset / blank / non-finite. */
function envNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * MapLibre map composable.
 *
 * Holds the map in a `shallowRef` (map engines must never live in a reactive
 * proxy) and exposes imperative `mount` / `destroy` actions. `destroy()` is
 * registered with `onBeforeUnmount` so the WebGL context is always released
 * when the calling component tears down.
 *
 * The initial basemap, center, and zoom come from the basemap registry and the
 * `VITE_*` env vars (see `modules/maplibre/basemaps.ts` and `.env.example`);
 * override per-mount via the options argument.
 */
export function useMapLibre() {
  const map = shallowRef<MapLibreMap | null>(null);
  let resizeObserver: ResizeObserver | null = null;

  function mount(container: HTMLElement, options: Partial<MapOptions> = {}): MapLibreMap {
    if (map.value) {
      throw new Error("useMapLibre: map is already mounted on a container.");
    }
    const lon = envNumber(import.meta.env.VITE_DEFAULT_MAP_CENTER_LON, 70);
    const lat = envNumber(import.meta.env.VITE_DEFAULT_MAP_CENTER_LAT, 30);
    const zoom = envNumber(import.meta.env.VITE_DEFAULT_MAP_ZOOM, 4);
    const instance = new MapLibreMap({
      container,
      style: resolveBasemapStyle(defaultBasemap()),
      center: [lon, lat],
      zoom,
      attributionControl: { compact: true },
      ...options,
    });
    map.value = instance;

    // MapLibre's built-in `trackResize` only listens for *window* resizes, not
    // container resizes (e.g. a flex/grid layout settling to its final size
    // after the map is created). Observe the container and resize the map to
    // fit; guard zero sizes so a hidden tab (0×0) doesn't resize to nothing.
    resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) instance.resize();
    });
    resizeObserver.observe(container);

    return instance;
  }

  function destroy(): void {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (map.value) {
      try {
        map.value.remove();
      } catch {
        // A third-party control's onRemove can throw during teardown (e.g. the
        // Terra Draw control clearing layers that map.remove() already disposed).
        // The map is going away regardless — don't let it break unmount.
      }
    }
    map.value = null;
  }

  onBeforeUnmount(destroy);

  return { map, mount, destroy };
}
