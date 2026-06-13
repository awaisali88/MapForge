import type { Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { useDebounceFn } from "@vueuse/core";
import { onBeforeUnmount, watch } from "vue";

import {
  H3_PROTOCOL,
  registerH3Protocol,
  setH3Resolution,
} from "@/modules/maplibre/h3TileProtocol";
import { useOverlaysStore } from "@/stores/overlays";

/**
 * H3 hexagon grid overlay — custom vector-tile protocol approach.
 *
 * Source `h3-hex` requests `h3tile://{z}/{x}/{y}` tiles; the handler in
 * `h3TileProtocol` generates MVT tiles on the fly. Resolution is module-global
 * (set via `setH3Resolution`). When the resolution changes, the source must be
 * removed and re-added because `maxzoom` is baked from the resolution and
 * MapLibre caches tiles by `{z}/{x}/{y}` without any resolution component.
 *
 * ## Auto vs manual resolution
 *
 * In auto mode (`overlays.hexAuto = true`) the composable derives the target
 * resolution from the map's current zoom via `zoomToDefaultResolution`. On live
 * `zoom` events (debounced 200 ms) only a coarsen (lower res) is allowed —
 * MapLibre already shows higher-detail tiles while zooming in; a full rebuild
 * would jank. The debounced `zoomend` handler does the full refine.
 *
 * In manual mode the stored `overlays.hexResolution` is used directly; a store
 * watch triggers a full source rebuild when it changes.
 *
 * ## Lifecycle — idle-defer on basemap switch
 *
 * Same pattern as `useContours` / `useMgrsGrid`: `onStyleLoad` defers re-add
 * to the next `'idle'` event to avoid the null-`light` render crash.
 *
 * ## Resolution vs. style-load race
 *
 * `rebuildH3` is guarded by `bound.isStyleLoaded()` so it never fires during
 * the `style.load → idle` window. `scheduleRebuild` will re-add at the correct
 * resolution once idle.
 */

const SOURCE = "h3-hex";
const LAYER = "h3-hex-line";

// ---------- zoom / resolution mappings ----------

/** Derive H3 resolution from map zoom (auto mode). */
function zoomToDefaultResolution(zoom: number): number {
  if (zoom < 2) return 0;
  if (zoom < 3) return 1;
  if (zoom < 4.5) return 2;
  if (zoom < 6) return 3;
  if (zoom < 7.5) return 4;
  if (zoom < 9) return 5;
  if (zoom < 10.5) return 6;
  if (zoom < 12) return 7;
  return 8;
}

/**
 * Fixed tile-zoom per H3 resolution so tile boundaries don't shift while the
 * user zooms. MapLibre overzooms beyond `maxzoom`, keeping the grid stable.
 * res: 0→2, 1→3, 2→4, 3→5, 4→7, 5→9, 6→10, 7→11, 8→12.
 */
function h3ResToTileZoom(res: number): number {
  const table = [2, 3, 4, 5, 7, 9, 10, 11, 12];
  return table[Math.min(res, 8)] ?? 12;
}

// ---------- module-scope protocol registration (once) ----------

let h3ProtocolRegistered = false;

// ---------- composable ----------

/** H3 hexagon grid overlay driven by the custom `h3tile://` vector-tile protocol. */
export function useHexGrid(mapRef: ShallowRef<MaplibreMap | null>): void {
  const overlays = useOverlaysStore();
  let bound: MaplibreMap | null = null;

  // Register the custom tile protocol exactly once per app (module-global).
  if (!h3ProtocolRegistered) {
    registerH3Protocol();
    h3ProtocolRegistered = true;
  }

  // ---- Effective resolution ----

  function currentResolution(map: MaplibreMap): number {
    return overlays.hexAuto ? zoomToDefaultResolution(map.getZoom()) : overlays.hexResolution;
  }

  // ---- Source / layer add & remove ----

  function addH3(map: MaplibreMap, res: number): void {
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, {
        type: "vector",
        tiles: [`${H3_PROTOCOL}://{z}/{x}/{y}`],
        minzoom: 0,
        maxzoom: h3ResToTileZoom(res),
      });
    }
    if (!map.getLayer(LAYER)) {
      map.addLayer({
        id: LAYER,
        type: "line",
        source: SOURCE,
        "source-layer": "h3",
        paint: {
          "line-color": "#3b82f6",
          "line-opacity": 0.5,
          "line-width": 1.5,
        },
      });
    }
  }

  function removeH3(map: MaplibreMap): void {
    try {
      if (map.getLayer(LAYER)) map.removeLayer(LAYER);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    } catch {
      /* map torn down */
    }
  }

  function add(map: MaplibreMap): void {
    const res = currentResolution(map);
    setH3Resolution(res);
    addH3(map, res);
  }

  function remove(map: MaplibreMap): void {
    removeH3(map);
  }

  // ---- Resolution rebuild (remove + re-add source) ----
  //
  // `maxzoom` is baked from resolution; MapLibre caches tiles by {z}/{x}/{y}.
  // The only reliable cache-bust is a source remove + re-add.
  // Guard by `isStyleLoaded()` to avoid firing during the style.load→idle window.

  function rebuildH3(): void {
    if (!bound || !overlays.hexGrid) return;
    if (!bound.isStyleLoaded()) return;
    const res = currentResolution(bound);
    setH3Resolution(res);
    removeH3(bound);
    addH3(bound, res);
  }

  const rebuildH3Debounced = useDebounceFn(rebuildH3, 200);

  // ---- Zoom-driven resolution update (auto mode) ----

  function onZoom(): void {
    // Eager coarsen only: if the new resolution would be lower (coarser), apply
    // it immediately so MapLibre doesn't render a too-fine grid while zooming out.
    if (!overlays.hexAuto || !bound || !overlays.hexGrid) return;
    if (!bound.isStyleLoaded()) return;
    const newRes = zoomToDefaultResolution(bound.getZoom());
    // Coarser = lower number; eagerly rebuild on coarsen.
    const currentRes = overlays.hexResolution;
    if (newRes < currentRes) {
      setH3Resolution(newRes);
      removeH3(bound);
      addH3(bound, newRes);
    }
  }

  function onZoomEnd(): void {
    if (!overlays.hexAuto) return;
    rebuildH3Debounced();
  }

  // ---- Style-load / basemap-switch lifecycle (idle-defer) ----

  function scheduleRebuild(map: MaplibreMap): void {
    map.once("idle", () => {
      if (bound === map && overlays.hexGrid && !map.getSource(SOURCE)) add(map);
    });
  }

  function onStyleLoad(): void {
    if (!bound) return;
    remove(bound); // setStyle wiped our source/layer
    if (overlays.hexGrid) scheduleRebuild(bound);
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("style.load", onStyleLoad);
    map.on("zoom", onZoom);
    map.on("zoomend", onZoomEnd);
    if (overlays.hexGrid && map.isStyleLoaded()) add(map);
  }

  function detach(): void {
    if (!bound) return;
    bound.off("style.load", onStyleLoad);
    bound.off("zoom", onZoom);
    bound.off("zoomend", onZoomEnd);
    remove(bound);
    bound = null;
  }

  // ---- Watchers ----

  // Toggle on → add immediately; toggle off → remove.
  watch(
    () => overlays.hexGrid,
    (on) => {
      if (!bound) return;
      if (on) {
        if (bound.isStyleLoaded()) add(bound);
      } else {
        remove(bound);
      }
    },
  );

  // Auto ↔ manual mode switch → rebuild with correct resolution.
  watch(
    () => overlays.hexAuto,
    () => {
      if (bound && bound.isStyleLoaded()) rebuildH3();
    },
  );

  // Manual resolution change (guard: skip when auto mode drives resolution).
  watch(
    () => overlays.hexResolution,
    () => {
      if (!overlays.hexAuto && bound && bound.isStyleLoaded()) rebuildH3();
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
