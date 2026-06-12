import type { FeatureCollection, LineString, Point } from "geojson";
import type { Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { useDebounceFn } from "@vueuse/core";
import { type Ref, onBeforeUnmount, readonly, ref, watch } from "vue";

import {
  MGRS_PROTOCOL,
  registerMgrsProtocol,
  setMgrsCellMeters,
} from "@/modules/maplibre/mgrsTileProtocol";
import { useOverlaysStore } from "@/stores/overlays";

/**
 * MGRS reference-grid overlay — two-tier vector-tile approach.
 *
 * **Tier 1 — static GeoJSON GZD graticule** (always visible when the grid is
 * on): parallels every 8° (-80…84), meridians every 6° with Norway/Svalbard
 * exceptions, one GZD centroid label per zone. Built once and module-cached.
 *
 * **Tier 2 — dynamic MVT fine grid** (`mgrstile://{z}/{x}/{y}`): a 7-step grid
 * stepping 100 km → 50 km → 10 km → 1 km → 500 m → 200 m → 100 m as the user
 * zooms in (see `MGRS_LEVELS`). The cell size is module-global (set via
 * `setMgrsCellMeters`); a change forces a source remove + re-add (the only
 * reliable way to flush MapLibre's per-tile cache). Below `FINE_MIN_ZOOM` the
 * fine source is removed, leaving only the GZD tier.
 *
 * ## Resolution indicator
 *
 * `resolutionLabel` (returned reactive ref) tracks the active level's label
 * (e.g. `"1 km"`, or `"GZD"` below `FINE_MIN_ZOOM`) so the UI can show the
 * current MGRS grid resolution; it is `""` whenever the grid is off.
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
const FINE_MIN_ZOOM = 3;

// ---------- resolution levels & zoom mappings ----------

/**
 * One MGRS fine-grid resolution step.
 *
 *  - `meters`   — grid line spacing (the cell box edge length).
 *  - `label`    — human-readable size shown in the resolution indicator.
 *  - `tileZoom` — the fixed tile zoom this level's source is generated at.
 *     MapLibre overzooms beyond `maxzoom`, so the tile boundaries (and thus the
 *     grid lines) stay put while the user zooms within a level. `tileZoom` is
 *     chosen so one tile spans ~15–30 cells at the equator — dense enough to be
 *     visible, sparse enough to stay under the protocol's 200-lines/axis guard.
 */
interface MgrsLevel {
  meters: number;
  label: string;
  tileZoom: number;
}

/** Coarsest (index 0) → finest (index 6). The order the manual select uses. */
const MGRS_LEVELS: readonly MgrsLevel[] = [
  { meters: 100000, label: "100 km", tileZoom: 4 },
  { meters: 50000, label: "50 km", tileZoom: 5 },
  { meters: 10000, label: "10 km", tileZoom: 7 },
  { meters: 1000, label: "1 km", tileZoom: 11 },
  { meters: 500, label: "500 m", tileZoom: 12 },
  { meters: 200, label: "200 m", tileZoom: 13 },
  { meters: 100, label: "100 m", tileZoom: 14 },
];

/** Clamp an arbitrary (persisted) index into a valid `MGRS_LEVELS` index. */
function clampLevelIndex(i: number): number {
  return Math.max(0, Math.min(MGRS_LEVELS.length - 1, Math.round(i)));
}

/**
 * Derive the level index from map zoom (auto mode). Thresholds are tuned so the
 * incoming finer cell is at least ~40 px wide at the switch, keeping boxes
 * legible across the whole range rather than snapping between two coarse steps.
 */
function zoomToLevelIndex(zoom: number): number {
  if (zoom < 7) return 0; // 100 km
  if (zoom < 9) return 1; // 50 km
  if (zoom < 12) return 2; // 10 km
  if (zoom < 13) return 3; // 1 km
  if (zoom < 14) return 4; // 500 m
  if (zoom < 15) return 5; // 200 m
  return 6; // 100 m
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

/**
 * MGRS reference-grid overlay — two-tier (GZD graticule + MVT fine grid).
 * Returns `resolutionLabel`, a reactive string of the active fine-grid cell
 * size (e.g. `"1 km"`, `"GZD"` below `FINE_MIN_ZOOM`, `""` when off) for the
 * bottom-right resolution indicator.
 */
export function useMgrsGrid(mapRef: ShallowRef<MaplibreMap | null>): {
  resolutionLabel: Readonly<Ref<string>>;
} {
  const overlays = useOverlaysStore();
  let bound: MaplibreMap | null = null;

  // The cell size (m) the fine source is currently baked at, or null when the
  // fine source is absent. Lets `rebuildFine` skip a no-op remove/re-add when
  // the level hasn't changed (avoids a grid flash on same-level zoomend).
  let activeFineMeters: number | null = null;

  // The active level's label (e.g. "1 km"), "GZD" below FINE_MIN_ZOOM, or ""
  // when the grid is off — drives the bottom-right resolution indicator.
  const resolutionLabel = ref("");

  // True while a rebuild is deferred to the next 'idle' (style was mid-load).
  // Caps the deferred-rebuild listeners to one at a time.
  let idleRetryQueued = false;

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

  function addFine(map: MaplibreMap, level: MgrsLevel): void {
    if (map.getSource(FINE_SOURCE)) return;
    const tz = level.tileZoom;
    map.addSource(FINE_SOURCE, {
      type: "vector",
      tiles: [`${MGRS_PROTOCOL}://{z}/{x}/{y}`],
      minzoom: Math.max(0, tz - 1),
      maxzoom: tz,
    });
    activeFineMeters = level.meters;
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
    activeFineMeters = null;
  }

  // ---- Effective level + resolution label ----

  /** The level to draw now: zoom-derived in auto mode, stored index in manual. */
  function effectiveLevel(map: MaplibreMap): MgrsLevel {
    const idx = overlays.mgrsAuto
      ? zoomToLevelIndex(map.getZoom())
      : clampLevelIndex(overlays.mgrsLevel);
    return MGRS_LEVELS[idx]!;
  }

  /** Recompute the indicator label from the grid's on/off + zoom + level. */
  function updateResolutionLabel(): void {
    if (!bound || !overlays.mgrsGrid) {
      resolutionLabel.value = "";
      return;
    }
    resolutionLabel.value = bound.getZoom() < FINE_MIN_ZOOM ? "GZD" : effectiveLevel(bound).label;
  }

  // ---- Combined add / remove ----

  function add(map: MaplibreMap): void {
    addGzd(map);
    if (map.getZoom() >= FINE_MIN_ZOOM) {
      const level = effectiveLevel(map);
      setMgrsCellMeters(level.meters);
      addFine(map, level);
    }
    updateResolutionLabel();
  }

  function remove(map: MaplibreMap): void {
    removeFine(map);
    removeGzd(map);
    updateResolutionLabel();
  }

  // ---- Level rebuild (remove + re-add fine only) ----
  //
  // The protocol caches tiles by {z}/{x}/{y} alone; the cell size is
  // module-global. To flush the cache, the source must be removed and re-added.
  // Guarded by `isStyleLoaded()` so it never fires during the style.load→idle
  // window (in that window `scheduleRebuild` re-adds at the current level once
  // idle), and by `activeFineMeters` so a same-level zoomend is a no-op.

  function rebuildFine(): void {
    if (!bound || !overlays.mgrsGrid) return;
    // Style mid-load (e.g. tiles still fetching right after a fast zoom): a
    // remove/re-add now would be dropped by MapLibre, so retry once the map
    // goes idle. Without this the grid level can stick after rapid zooming.
    if (!bound.isStyleLoaded()) {
      if (!idleRetryQueued) {
        idleRetryQueued = true;
        bound.once("idle", () => {
          idleRetryQueued = false;
          rebuildFine();
        });
      }
      return;
    }
    if (bound.getZoom() < FINE_MIN_ZOOM) {
      removeFine(bound);
      updateResolutionLabel();
      return;
    }
    const level = effectiveLevel(bound);
    if (level.meters !== activeFineMeters || !bound.getSource(FINE_SOURCE)) {
      setMgrsCellMeters(level.meters);
      removeFine(bound);
      addFine(bound, level);
    }
    updateResolutionLabel();
  }

  const rebuildFineDebounced = useDebounceFn(rebuildFine, 200);

  // ---- Zoom-driven level update ----

  // Live (un-debounced) — keep the indicator label tracking the zoom the moment
  // a threshold is crossed, even before the debounced source rebuild lands.
  function onZoom(): void {
    if (overlays.mgrsGrid) updateResolutionLabel();
  }

  // Debounced source rebuild. Runs in both auto and manual mode so the
  // FINE_MIN_ZOOM floor is honored; the `activeFineMeters` guard makes a
  // same-level zoom a no-op.
  function onZoomEnd(): void {
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
    map.on("zoom", onZoom);
    map.on("zoomend", onZoomEnd);
    if (overlays.mgrsGrid && map.isStyleLoaded()) add(map);
  }

  function detach(): void {
    if (!bound) return;
    bound.off("style.load", onStyleLoad);
    bound.off("zoom", onZoom);
    bound.off("zoomend", onZoomEnd);
    remove(bound);
    bound = null;
    idleRetryQueued = false;
    resolutionLabel.value = "";
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

  // Auto ↔ manual mode switch → rebuild fine at the now-effective level.
  watch(
    () => overlays.mgrsAuto,
    () => {
      if (bound && bound.isStyleLoaded()) rebuildFine();
    },
  );

  watch(
    () => overlays.mgrsLevel,
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

  return { resolutionLabel: readonly(resolutionLabel) };
}
