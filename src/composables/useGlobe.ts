import type { Map as MaplibreMap, SkySpecification } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { onBeforeUnmount, watch } from "vue";

import { useOverlaysStore } from "@/stores/overlays";

/**
 * 3D globe projection, driven by `overlays.globe`.
 *
 * MapLibre's globe is **adaptive**: it renders a sphere when zoomed out and
 * smoothly transitions to a flat (mercator) map as you zoom in — exactly the
 * "looks like a globe when I move away" behavior. `setProjection` is a cheap
 * camera/render change (not a layer add), so unlike the other overlays it's
 * safe to apply directly on `style.load` without the idle-defer.
 *
 * A `setStyle` basemap switch resets the projection to the new style's default
 * (mercator), so we re-apply on every `style.load`. A subtle sky/atmosphere is
 * added when the globe is on so the sphere reads against the background.
 */

// Fade the atmosphere out as the globe flattens into mercator (zoom 0→7).
const GLOBE_SKY: SkySpecification = {
  "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
};

export function useGlobe(mapRef: ShallowRef<MaplibreMap | null>): void {
  const overlays = useOverlaysStore();
  let bound: MaplibreMap | null = null;

  function apply(map: MaplibreMap): void {
    if (overlays.globe) {
      map.setProjection({ type: "globe" });
      map.setSky(GLOBE_SKY);
    } else {
      map.setProjection({ type: "mercator" });
      map.setSky({});
    }
  }

  // A basemap switch (setStyle) resets the projection — re-apply once loaded.
  function onStyleLoad(): void {
    if (bound) apply(bound);
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("style.load", onStyleLoad);
    if (map.isStyleLoaded()) apply(map);
  }

  function detach(): void {
    if (bound) bound.off("style.load", onStyleLoad);
    bound = null;
  }

  watch(
    () => overlays.globe,
    () => {
      if (bound) apply(bound);
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
