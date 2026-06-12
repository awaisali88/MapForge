import type { FeatureCollection, LineString, Point } from "geojson";
import type { Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { useDebounceFn } from "@vueuse/core";
import { onBeforeUnmount, watch } from "vue";

import {
  MGRS_PROTOCOL,
  type MgrsAccuracy,
  registerMgrsProtocol,
  setMgrsAccuracy,
} from "@/modules/maplibre/mgrsTileProtocol";
import { useOverlaysStore } from "@/stores/overlays";

/**
 * MGRS reference-grid overlay — two-tier vector-tile approach.
 *
 * **Tier 1 — static GeoJSON GZD graticule** (always visible when the grid is
 * on): parallels every 8° (-80…84), meridians every 6° with Norway/Svalbard
 * exceptions, one GZD centroid label per zone. Built once and module-cached.
 *
 * **Tier 2 — dynamic MVT fine grid** (`mgrstile://{z}/{x}/{y}`): the 100 km /
 * 10 km / 1 km / 100 m / 10 m cell grid. Accuracy is module-global (set via
 * `setMgrsAccuracy`); a change forces a source remove + re-add (the only
 * reliable way to flush MapLibre's per-tile cache). Below `FINE_MIN_ZOOM = 5`
 * the fine source is removed, leaving only the GZD tier.
 *
 * ## Lifecycle — idle-defer on basemap switch
 *
 * `onStyleLoad` removes stale layers then defers re-add to the next `'idle'`
 * event — NOT `style.load` directly — to avoid the null-`light` render crash:
 *
 *   TypeError: Cannot read properties of null (reading 'updateTransitions')
 *
 * This is the same pattern used by `useContours` / `useGraticule`.
 *
 * ## Accuracy vs. style-load race
 *
 * The accuracy remove/re-add (`rebuildFine`) is guarded by
 * `bound.isStyleLoaded()` so it never fires during the `style.load → idle`
 * window. If the style is mid-load, `onStyleLoad → scheduleRebuild` will
 * re-add everything at the correct accuracy once idle anyway.
 */

// ---------- source / layer id constants ----------

const GZD_LINE_SOURCE = "mgrs-gzd-lines";
const GZD_LABEL_SOURCE = "mgrs-gzd-labels";
const GZD_LINE_LAYER = "mgrs-gzd-line";
const GZD_LABEL_LAYER = "mgrs-gzd-label";

const FINE_SOURCE = "mgrs-fine";
const FINE_LINE_LAYER = "mgrs-fine-line";
const FINE_LABEL_LAYER = "mgrs-fine-label";

/** Below this map zoom the fine source is suppressed (only GZD tier shown). */
const FINE_MIN_ZOOM = 5;

// ---------- accuracy / tile-zoom mappings ----------

/** Derive MGRS accuracy from map zoom (auto mode). */
function zoomToAccuracy(zoom: number): MgrsAccuracy {
  if (zoom < 8) return 0; // 100 km
  if (zoom < 11) return 1; // 10 km
  if (zoom < 14) return 2; // 1 km
  if (zoom < 17) return 3; // 100 m
  return 4; // 10 m
}

/**
 * Fixed tile-zoom per accuracy so tile boundaries don't shift as the user
 * zooms — MapLibre overzooms beyond `maxzoom` so the tiles stay valid.
 * a=0→5, 1→8, 2→11, 3→14, 4→17.
 */
function accuracyToTileZoom(a: MgrsAccuracy): number {
  const map: Record<MgrsAccuracy, number> = { 0: 5, 1: 8, 2: 11, 3: 14, 4: 17 };
  return map[a];
}

// ---------- static GZD graticule (module-cached) ----------

const BANDS = "CDEFGHJKLMNPQRSTUVWX";

function bandLatRange(band: string): [number, number] {
  if (band === "X") return [72, 84];
  const idx = BANDS.indexOf(band);
  return [-80 + idx * 8, -80 + (idx + 1) * 8];
}

function meridianSegment(
  lng: number,
  lat1: number,
  lat2: number,
): GeoJSON.Feature<GeoJSON.LineString> {
  const coords: GeoJSON.Position[] = [];
  for (let lat = lat1; lat <= lat2; lat += 1) coords.push([lng, lat]);
  return {
    type: "Feature",
    properties: { kind: "meridian", lng },
    geometry: { type: "LineString", coordinates: coords },
  };
}

function buildGzdLines(): FeatureCollection<LineString> {
  const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];

  // Parallels at band edges (-80…84 step 8°; X band top is 84).
  const lats = [
    -80, -72, -64, -56, -48, -40, -32, -24, -16, -8, 0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 84,
  ];
  for (const lat of lats) {
    const coords: GeoJSON.Position[] = [];
    for (let lng = -180; lng <= 180; lng += 2) coords.push([lng, lat]);
    features.push({
      type: "Feature",
      properties: { kind: "parallel", lat },
      geometry: { type: "LineString", coordinates: coords },
    });
  }

  // Standard 6° meridians for most bands.
  for (let lng = -180; lng <= 180; lng += 6) {
    features.push(meridianSegment(lng, -80, 56));
    features.push(meridianSegment(lng, 64, 72));
  }

  // V band (56–64°): 31V=0–3°, 32V=3–12°; everything else standard.
  for (let lng = -180; lng <= 0; lng += 6) features.push(meridianSegment(lng, 56, 64));
  features.push(meridianSegment(3, 56, 64));
  for (let lng = 12; lng <= 180; lng += 6) features.push(meridianSegment(lng, 56, 64));

  // X band (72–84°): Svalbard exceptions — 31X=0–9°, 33X=9–21°, 35X=21–33°, 37X=33–42°.
  // 32X, 34X, 36X do not exist.
  for (let lng = -180; lng <= 0; lng += 6) features.push(meridianSegment(lng, 72, 84));
  for (const lng of [9, 21, 33, 42]) features.push(meridianSegment(lng, 72, 84));
  for (let lng = 48; lng <= 180; lng += 6) features.push(meridianSegment(lng, 72, 84));

  return { type: "FeatureCollection", features };
}

function buildGzdLabels(): FeatureCollection<Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (let zone = 1; zone <= 60; zone++) {
    for (const band of BANDS) {
      // 32X, 34X, 36X don't exist.
      if (band === "X" && (zone === 32 || zone === 34 || zone === 36)) continue;
      const [latS, latN] = bandLatRange(band);
      let lngW = -180 + (zone - 1) * 6;
      let lngE = -180 + zone * 6;
      // Norway band V exceptions.
      if (band === "V") {
        if (zone === 31) {
          lngW = 0;
          lngE = 3;
        } else if (zone === 32) {
          lngW = 3;
          lngE = 12;
        }
      }
      // Svalbard band X exceptions.
      if (band === "X") {
        if (zone === 31) {
          lngW = 0;
          lngE = 9;
        } else if (zone === 33) {
          lngW = 9;
          lngE = 21;
        } else if (zone === 35) {
          lngW = 21;
          lngE = 33;
        } else if (zone === 37) {
          lngW = 33;
          lngE = 42;
        }
      }
      features.push({
        type: "Feature",
        properties: { id: `${zone}${band}` },
        geometry: { type: "Point", coordinates: [(lngW + lngE) / 2, (latS + latN) / 2] },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

let cachedGzdLines: FeatureCollection<LineString> | null = null;
let cachedGzdLabels: FeatureCollection<Point> | null = null;

function getGzdLines(): FeatureCollection<LineString> {
  return (cachedGzdLines ??= buildGzdLines());
}
function getGzdLabels(): FeatureCollection<Point> {
  return (cachedGzdLabels ??= buildGzdLabels());
}

// ---------- module-scope protocol registration (once) ----------

let mgrsProtocolRegistered = false;

// ---------- composable ----------

/** MGRS reference-grid overlay — two-tier (GZD graticule + MVT fine grid). */
export function useMgrsGrid(mapRef: ShallowRef<MaplibreMap | null>): void {
  const overlays = useOverlaysStore();
  let bound: MaplibreMap | null = null;

  // Register the custom tile protocol exactly once per app (module-global).
  if (!mgrsProtocolRegistered) {
    registerMgrsProtocol();
    mgrsProtocolRegistered = true;
  }

  // ---- GZD tier (static GeoJSON) ----

  function addGzd(map: MaplibreMap): void {
    if (!map.getSource(GZD_LINE_SOURCE)) {
      map.addSource(GZD_LINE_SOURCE, { type: "geojson", data: getGzdLines() });
    }
    if (!map.getSource(GZD_LABEL_SOURCE)) {
      map.addSource(GZD_LABEL_SOURCE, { type: "geojson", data: getGzdLabels() });
    }
    if (!map.getLayer(GZD_LINE_LAYER)) {
      map.addLayer({
        id: GZD_LINE_LAYER,
        type: "line",
        source: GZD_LINE_SOURCE,
        paint: {
          "line-color": "#f59e0b",
          "line-opacity": 0.7,
          "line-width": 1.8,
        },
      });
    }
    if (!map.getLayer(GZD_LABEL_LAYER)) {
      map.addLayer({
        id: GZD_LABEL_LAYER,
        type: "symbol",
        source: GZD_LABEL_SOURCE,
        layout: {
          "text-field": ["get", "id"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 16,
        },
        paint: {
          "text-color": "#f59e0b",
          "text-halo-color": "rgba(0,0,0,0.7)",
          "text-halo-width": 1.2,
        },
      });
    }
  }

  function removeGzd(map: MaplibreMap): void {
    try {
      if (map.getLayer(GZD_LABEL_LAYER)) map.removeLayer(GZD_LABEL_LAYER);
      if (map.getLayer(GZD_LINE_LAYER)) map.removeLayer(GZD_LINE_LAYER);
      if (map.getSource(GZD_LABEL_SOURCE)) map.removeSource(GZD_LABEL_SOURCE);
      if (map.getSource(GZD_LINE_SOURCE)) map.removeSource(GZD_LINE_SOURCE);
    } catch {
      /* map torn down */
    }
  }

  // ---- Fine tier (MVT vector-tile source) ----

  function addFine(map: MaplibreMap, accuracy: MgrsAccuracy): void {
    if (map.getSource(FINE_SOURCE)) return;
    const tz = accuracyToTileZoom(accuracy);
    map.addSource(FINE_SOURCE, {
      type: "vector",
      tiles: [`${MGRS_PROTOCOL}://{z}/{x}/{y}`],
      minzoom: Math.max(0, tz - 1),
      maxzoom: tz,
    });
    if (!map.getLayer(FINE_LINE_LAYER)) {
      map.addLayer({
        id: FINE_LINE_LAYER,
        type: "line",
        source: FINE_SOURCE,
        "source-layer": "mgrs",
        paint: {
          "line-color": "#f59e0b",
          "line-opacity": 0.6,
          "line-width": 1.2,
        },
      });
    }
    if (!map.getLayer(FINE_LABEL_LAYER)) {
      map.addLayer({
        id: FINE_LABEL_LAYER,
        type: "symbol",
        source: FINE_SOURCE,
        "source-layer": "mgrs_labels",
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 11,
          "text-max-width": 8,
        },
        paint: {
          "text-color": "#f59e0b",
          "text-halo-color": "rgba(0,0,0,0.7)",
          "text-halo-width": 1.2,
        },
      });
    }
  }

  function removeFine(map: MaplibreMap): void {
    try {
      if (map.getLayer(FINE_LABEL_LAYER)) map.removeLayer(FINE_LABEL_LAYER);
      if (map.getLayer(FINE_LINE_LAYER)) map.removeLayer(FINE_LINE_LAYER);
      if (map.getSource(FINE_SOURCE)) map.removeSource(FINE_SOURCE);
    } catch {
      /* map torn down */
    }
  }

  // ---- Combined add / remove ----

  function add(map: MaplibreMap): void {
    addGzd(map);
    const zoom = map.getZoom();
    if (zoom >= FINE_MIN_ZOOM) {
      const accuracy = overlays.mgrsAuto
        ? zoomToAccuracy(zoom)
        : (overlays.mgrsAccuracy as MgrsAccuracy);
      setMgrsAccuracy(accuracy);
      addFine(map, accuracy);
    }
  }

  function remove(map: MaplibreMap): void {
    removeFine(map);
    removeGzd(map);
  }

  // ---- Accuracy rebuild (remove + re-add fine only) ----
  //
  // The protocol caches tiles by {z}/{x}/{y} alone; accuracy is module-global.
  // To flush the cache, the source must be removed and re-added. This is
  // guarded by `isStyleLoaded()` so it never fires during the style.load→idle
  // window — in that window `scheduleRebuild` will re-add at the current
  // accuracy once idle.

  function rebuildFine(): void {
    if (!bound || !overlays.mgrsGrid) return;
    if (!bound.isStyleLoaded()) return;
    const zoom = bound.getZoom();
    if (zoom < FINE_MIN_ZOOM) {
      removeFine(bound);
      return;
    }
    const accuracy = overlays.mgrsAuto
      ? zoomToAccuracy(zoom)
      : (overlays.mgrsAccuracy as MgrsAccuracy);
    setMgrsAccuracy(accuracy);
    removeFine(bound);
    addFine(bound, accuracy);
  }

  const rebuildFineDebounced = useDebounceFn(rebuildFine, 200);

  // ---- Zoom-driven accuracy update (auto mode) ----

  function onZoomEnd(): void {
    if (!overlays.mgrsAuto) return;
    rebuildFineDebounced();
  }

  // ---- Style-load / basemap-switch lifecycle (idle-defer) ----

  function scheduleRebuild(map: MaplibreMap): void {
    map.once("idle", () => {
      if (bound === map && overlays.mgrsGrid && !map.getSource(GZD_LINE_SOURCE)) add(map);
    });
  }

  function onStyleLoad(): void {
    if (!bound) return;
    remove(bound); // setStyle wiped our sources/layers
    if (overlays.mgrsGrid) scheduleRebuild(bound);
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("style.load", onStyleLoad);
    map.on("zoomend", onZoomEnd);
    if (overlays.mgrsGrid && map.isStyleLoaded()) add(map);
  }

  function detach(): void {
    if (!bound) return;
    bound.off("style.load", onStyleLoad);
    bound.off("zoomend", onZoomEnd);
    remove(bound);
    bound = null;
  }

  // ---- Watchers ----

  // Toggle on → add immediately; toggle off → remove.
  watch(
    () => overlays.mgrsGrid,
    (on) => {
      if (!bound) return;
      if (on) {
        if (bound.isStyleLoaded()) add(bound);
      } else {
        remove(bound);
      }
    },
  );

  // Auto ↔ manual mode switch, or manual accuracy change → rebuild fine.
  watch(
    () => overlays.mgrsAuto,
    () => {
      if (bound && bound.isStyleLoaded()) rebuildFine();
    },
  );

  watch(
    () => overlays.mgrsAccuracy,
    () => {
      // Only act when in manual mode; auto mode is driven by zoomend.
      if (!overlays.mgrsAuto && bound && bound.isStyleLoaded()) rebuildFine();
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
