import "@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css";

import type { Feature } from "geojson";
import type { Map as MaplibreMap } from "maplibre-gl";
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
 *   - mirrors finalized features into the `drawings` store (for the count +
 *     export), replacing the mirror on every change;
 *   - re-hydrates the drawings after a basemap switch — `map.setStyle` wipes
 *     Terra Draw's layers and its adapter skips re-render on a style swap
 *     (terra-draw#44), so we snapshot → clear → re-add on `styledata`.
 */

// Toolbar modes, in button order. `render` is the static view/finish mode.
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

export function useTerraDraw(mapRef: ShallowRef<MaplibreMap | null>): void {
  const drawings = useDrawingsStore();
  let bound: MaplibreMap | null = null;
  let control: MaplibreMeasureControl | null = null;
  let draw: ReturnType<MaplibreMeasureControl["getTerraDrawInstance"]> | null = null;

  function mirror(): void {
    if (!draw) return;
    drawings.setAll(draw.getSnapshot().filter(isDrawnFeature) as Feature[]);
  }

  function onStyleData(): void {
    // A basemap switch (map.setStyle) wiped Terra Draw's layers. Features remain
    // in its in-memory store, but the adapter won't re-render them on a style
    // swap — force it: snapshot → clear → re-add, then redraw measure labels.
    if (!bound || !bound.isStyleLoaded() || !draw) return;
    const snapshot = draw.getSnapshot().filter(isDrawnFeature);
    if (snapshot.length === 0) return;
    draw.clear();
    draw.addFeatures(snapshot);
    control?.recalc();
  }

  function init(map: MaplibreMap): void {
    control = new MaplibreMeasureControl({ modes: MODES, open: true, computeElevation: false });
    map.addControl(control, "top-right");
    draw = control.getTerraDrawInstance() ?? null;
    draw?.on("finish", () => mirror());
    draw?.on("change", (_ids, type) => {
      if (type !== "styling") mirror();
    });
    map.on("styledata", onStyleData);
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    if (map.isStyleLoaded()) init(map);
    else map.once("style.load", () => init(map));
  }

  function detach(): void {
    if (!bound) return;
    const map = bound;
    bound = null;
    try {
      map.off("styledata", onStyleData);
      if (control && map.hasControl(control)) map.removeControl(control);
    } catch {
      // Teardown race (HMR / unmount) — the control + listeners go with the map.
    }
    control = null;
    draw = null;
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
}
