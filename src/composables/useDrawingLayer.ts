import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { onBeforeUnmount, watch } from "vue";

import { type useDrawingsStore } from "@/stores/drawings";

const SRC = "mapforge:drawings";
const LYR_FILL = "mapforge:drawings:fill";
const LYR_LINE = "mapforge:drawings:line";
const LYR_POINT = "mapforge:drawings:point";

type DrawingsStore = ReturnType<typeof useDrawingsStore>;

/**
 * Renders finalized drawings (the `drawings` store) onto a MapLibre map.
 *
 * The drawings store deliberately leaves rendering to the consumer. This
 * composable owns a single GeoJSON source with fill / line / circle layers and
 * keeps it in sync with `drawings.featureCollection`:
 *
 *   - adds the source + layers on the map's `load` event (idempotent);
 *   - re-adds them on `styledata` because `map.setStyle` (basemap switch) wipes
 *     all sources and layers;
 *   - watches `featureCollection` and calls `source.setData(...)` on change;
 *   - removes everything on unmount.
 *
 * Layers are unfiltered for `line` (renders LineStrings and Polygon outlines)
 * and geometry-filtered for `fill` (Polygons) and `circle` (Points), so all
 * finalized geometry types render correctly from one source.
 */
export function useDrawingLayer(
  mapRef: ShallowRef<MaplibreMap | null>,
  drawings: DrawingsStore,
): void {
  let bound: MaplibreMap | null = null;

  function sync(map: MaplibreMap): void {
    const src = map.getSource(SRC) as GeoJSONSource | undefined;
    src?.setData(drawings.featureCollection);
  }

  function ensure(map: MaplibreMap): void {
    if (!map.getSource(SRC)) {
      map.addSource(SRC, { type: "geojson", data: drawings.featureCollection });
      map.addLayer({
        id: LYR_FILL,
        type: "fill",
        source: SRC,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#22d3ee", "fill-opacity": 0.15 },
      });
      map.addLayer({
        id: LYR_LINE,
        type: "line",
        source: SRC,
        paint: { "line-color": "#22d3ee", "line-width": 2 },
      });
      map.addLayer({
        id: LYR_POINT,
        type: "circle",
        source: SRC,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 4,
          "circle-color": "#22d3ee",
          "circle-stroke-color": "#0b1120",
          "circle-stroke-width": 1,
        },
      });
    }
    sync(map);
  }

  function onLoad(): void {
    if (bound) ensure(bound);
  }

  function onStyleData(): void {
    // setStyle wipes sources/layers; re-add ours once the new style is usable.
    if (bound && bound.isStyleLoaded()) ensure(bound);
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("load", onLoad);
    map.on("styledata", onStyleData);
    if (map.isStyleLoaded()) ensure(map);
  }

  function detach(): void {
    if (!bound) return;
    const map = bound;
    bound = null;
    try {
      map.off("load", onLoad);
      map.off("styledata", onStyleData);
      if (map.getLayer(LYR_FILL)) map.removeLayer(LYR_FILL);
      if (map.getLayer(LYR_LINE)) map.removeLayer(LYR_LINE);
      if (map.getLayer(LYR_POINT)) map.removeLayer(LYR_POINT);
      if (map.getSource(SRC)) map.removeSource(SRC);
    } catch {
      // Map was torn down first; its sources/layers went with it.
    }
  }

  watch(
    mapRef,
    (map) => {
      detach();
      if (map) attach(map);
    },
    { immediate: true },
  );

  watch(
    () => drawings.featureCollection,
    () => {
      if (bound) sync(bound);
    },
  );

  onBeforeUnmount(detach);
}
