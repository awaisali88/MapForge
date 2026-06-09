import "@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css";

import type { Feature } from "geojson";
import type { Map as MaplibreMap, StyleSpecification } from "maplibre-gl";
import type { GeoJSONStoreFeatures } from "terra-draw";
import type { ShallowRef } from "vue";

import { MaplibreMeasureControl, type TerradrawMode } from "@watergis/maplibre-gl-terradraw";
import { onBeforeUnmount, watch } from "vue";

import { useDrawingsStore } from "@/stores/drawings";

/**
 * Drawing + measuring via Terra Draw (`@watergis/maplibre-gl-terradraw`).
 *
 * The control brings its own toolbar UI (top-right) and built-in distance/area
 * measurement, so MapForge ships no hand-rolled drawing controls. This
 * composable:
 *   - mounts the control once the map style is loaded, and removes it on unmount;
 *   - mirrors finalized features into the `drawings` store (count + export);
 *   - exposes `switchBasemap`, which preserves drawn features across a basemap
 *     change. `map.setStyle` wipes every layer — including Terra Draw's geometry
 *     AND the measure control's own label sources, which the control does not
 *     rebuild on its own (it then throws on the next update). So we snapshot the
 *     features, remove the control before `setStyle`, and rebuild it + re-add the
 *     features once the new style is ready.
 */

// Toolbar modes, in button order. `render` is the static view / finish mode.
const MODES: TerradrawMode[] = [
  "render",
  "point",
  "linestring",
  "polygon",
  "rectangle",
  "circle",
  "select",
  "delete",
];

/** Drop Terra Draw's transient helper geometry (select midpoints / handles). */
function isDrawnFeature(feature: GeoJSONStoreFeatures): boolean {
  const props = feature.properties ?? {};
  return !props.midPoint && !props.selectionPoint;
}

export interface TerraDrawApi {
  /** Switch the basemap via `map.setStyle`, preserving the drawn features. */
  switchBasemap: (style: StyleSpecification | string) => void;
}

export function useTerraDraw(mapRef: ShallowRef<MaplibreMap | null>): TerraDrawApi {
  const drawings = useDrawingsStore();
  let bound: MaplibreMap | null = null;
  let control: MaplibreMeasureControl | null = null;
  let draw: ReturnType<MaplibreMeasureControl["getTerraDrawInstance"]> | null = null;

  function snapshot(): GeoJSONStoreFeatures[] {
    return draw ? draw.getSnapshot().filter(isDrawnFeature) : [];
  }

  function mirror(): void {
    drawings.setAll(snapshot() as Feature[]);
  }

  function addControl(map: MaplibreMap): void {
    control = new MaplibreMeasureControl({ modes: MODES, open: true, computeElevation: false });
    // The control's default label font ("Open Sans …") 404s on OpenFreeMap's
    // glyph endpoint; "Noto Sans Regular" is served by both OpenFreeMap and the
    // raster basemaps' (openmaptiles) glyph endpoints.
    control.fontGlyphs = ["Noto Sans Regular"];
    map.addControl(control, "top-right");
    draw = control.getTerraDrawInstance() ?? null;
    draw?.on("finish", () => mirror());
    draw?.on("change", (_ids, type) => {
      if (type !== "styling") mirror();
    });
  }

  function removeControl(map: MaplibreMap): void {
    try {
      if (control && map.hasControl(control)) map.removeControl(control);
    } catch {
      // Teardown race (HMR / unmount) — the control goes with the map.
    }
    control = null;
    draw = null;
  }

  function switchBasemap(style: StyleSpecification | string): void {
    const map = bound;
    if (!map) return;
    const features = snapshot();
    // Remove the control before setStyle so it never touches its about-to-be-
    // wiped label sources, then rebuild on the new style and re-add the features.
    removeControl(map);
    map.setStyle(style);
    map.once("idle", () => {
      if (!bound) return;
      addControl(bound);
      if (features.length && draw) {
        draw.addFeatures(features);
        control?.recalc();
      }
      mirror();
    });
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    if (map.isStyleLoaded()) addControl(map);
    else
      map.once("style.load", () => {
        if (bound) addControl(bound);
      });
  }

  function detach(): void {
    if (!bound) return;
    const map = bound;
    bound = null;
    removeControl(map);
  }

  watch(
    mapRef,
    (m) => {
      detach();
      if (m) attach(m);
    },
    { immediate: true },
  );

  onBeforeUnmount(detach);

  return { switchBasemap };
}
