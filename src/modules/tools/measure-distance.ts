import type { Tool, ToolContext, ToolSetupResult } from "./types";
import type { Feature, FeatureCollection, Position } from "geojson";
import type { GeoJSONSource, MapMouseEvent } from "maplibre-gl";

import { distanceMeters, lengthMeters, midpointBetween } from "@/modules/geo/measure";

const NS = "mapforge:measure-distance";
const SRC_DRAFT = `${NS}:draft`;
const SRC_LABELS = `${NS}:labels`;
const SRC_HANDLES = `${NS}:handles`;
const LYR_LINE = `${NS}:line`;
const LYR_LABELS = `${NS}:labels`;
const LYR_HANDLES = `${NS}:handles`;

const emptyFC = (): FeatureCollection => ({ type: "FeatureCollection", features: [] });

const emptyLineString = (): Feature => ({
  type: "Feature",
  geometry: { type: "LineString", coordinates: [] },
  properties: {},
});

/**
 * Distance-measurement tool for MapLibre.
 *
 * Lifecycle:
 *   click       → append vertex, re-render
 *   mousemove   → rubber-band the trailing segment to the cursor
 *   dblclick    → finalize: emit a LineString Feature with totalMeters
 *   Enter       → same as dblclick
 *   Escape      → cancel, return to idle
 *
 * Rendering:
 *   - One GeoJSON source for the dashed in-progress line (`:draft`)
 *   - One symbol source for per-segment labels + a total label (`:labels`)
 *   - One circle source for vertex handles (`:handles`)
 *
 * The tool owns its sources/layers under a `mapforge:` namespace and
 * removes everything in `cleanup()` — that's how `useToolRegistry` keeps
 * the map free of stale state when switching tools.
 */
export const measureDistanceTool: Tool = {
  id: "measure-distance",
  label: "Measure distance",
  shortcut: "m",
  icon: "ruler",
  setup({ map, suspend, restore, emit }: ToolContext): ToolSetupResult {
    const vertices: Position[] = [];
    let cursor: Position | null = null;

    map.addSource(SRC_DRAFT, { type: "geojson", data: emptyLineString() });
    map.addSource(SRC_LABELS, { type: "geojson", data: emptyFC() });
    map.addSource(SRC_HANDLES, { type: "geojson", data: emptyFC() });

    map.addLayer({
      id: LYR_LINE,
      type: "line",
      source: SRC_DRAFT,
      paint: {
        "line-color": "#3b82f6",
        "line-width": 2,
        "line-dasharray": [3, 2],
      },
    });

    map.addLayer({
      id: LYR_LABELS,
      type: "symbol",
      source: SRC_LABELS,
      layout: {
        "text-field": ["get", "text"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
        "text-anchor": "center",
        "text-offset": [0, -1],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "#0b1120",
        "text-halo-width": 1.5,
      },
    });

    map.addLayer({
      id: LYR_HANDLES,
      type: "circle",
      source: SRC_HANDLES,
      paint: {
        "circle-radius": 5,
        "circle-color": "#fbbf24",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
      },
    });

    suspend();
    map.getCanvas().style.cursor = "crosshair";

    function render(): void {
      const liveCoords = cursor && vertices.length > 0 ? [...vertices, cursor] : vertices;
      const draft: Feature = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: liveCoords },
        properties: {},
      };
      (map.getSource(SRC_DRAFT) as GeoJSONSource | undefined)?.setData(draft);
      (map.getSource(SRC_LABELS) as GeoJSONSource | undefined)?.setData(buildLabels(liveCoords));
      (map.getSource(SRC_HANDLES) as GeoJSONSource | undefined)?.setData(buildHandles(vertices));
    }

    function onClick(e: MapMouseEvent): void {
      const next: Position = [e.lngLat.lng, e.lngLat.lat];
      if (vertices.length > 0) {
        const last = vertices[vertices.length - 1]!;
        if (distanceMeters(last, next) < 3) return;
      }
      vertices.push(next);
      render();
    }

    function onMove(e: MapMouseEvent): void {
      cursor = [e.lngLat.lng, e.lngLat.lat];
      if (vertices.length > 0) render();
    }

    function finalize(): void {
      if (vertices.length < 2) return;
      const feature: Feature = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [...vertices] },
        properties: {
          kind: "measure-distance",
          totalMeters: lengthMeters(vertices),
        },
      };
      emit(feature);
      reset();
    }

    function reset(): void {
      vertices.length = 0;
      cursor = null;
      render();
    }

    function onDblClick(e: MapMouseEvent): void {
      e.preventDefault();
      finalize();
    }

    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        reset();
      } else if (e.key === "Enter") {
        finalize();
      }
    }

    map.on("click", onClick);
    map.on("mousemove", onMove);
    map.on("dblclick", onDblClick);
    window.addEventListener("keydown", onKey, { capture: true });

    let disposed = false;
    return {
      cleanup(): void {
        if (disposed) return;
        disposed = true;

        window.removeEventListener("keydown", onKey, { capture: true });

        try {
          if (!map || typeof map.off !== "function") return;
          map.off("click", onClick);
          map.off("mousemove", onMove);
          map.off("dblclick", onDblClick);
          if (map.getLayer(LYR_LINE)) map.removeLayer(LYR_LINE);
          if (map.getLayer(LYR_LABELS)) map.removeLayer(LYR_LABELS);
          if (map.getLayer(LYR_HANDLES)) map.removeLayer(LYR_HANDLES);
          if (map.getSource(SRC_DRAFT)) map.removeSource(SRC_DRAFT);
          if (map.getSource(SRC_LABELS)) map.removeSource(SRC_LABELS);
          if (map.getSource(SRC_HANDLES)) map.removeSource(SRC_HANDLES);
          map.getCanvas().style.cursor = "";
        } catch {
          // Map was torn down before cleanup ran (HMR or panel-unmount race);
          // sources/layers go with it, so the only thing left to do is restore().
        }
        try {
          restore();
        } catch {
          /* map gone — restore is a no-op */
        }
      },
    };
  },
};

function buildLabels(coords: Position[]): FeatureCollection {
  if (coords.length < 2) return emptyFC();
  const features: Feature[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]!;
    const b = coords[i]!;
    const seg = distanceMeters(a, b);
    total += seg;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: midpointBetween(a, b) },
      properties: { text: formatMeters(seg), kind: "segment" },
    });
  }
  const tail = coords[coords.length - 1]!;
  features.push({
    type: "Feature",
    geometry: { type: "Point", coordinates: tail },
    properties: { text: `Total: ${formatMeters(total)}`, kind: "total" },
  });
  return { type: "FeatureCollection", features };
}

function buildHandles(vertices: Position[]): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: vertices.map((v, i) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: v },
      properties: { vertexIndex: i },
    })),
  };
}

function formatMeters(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${meters.toFixed(0)} m`;
}
