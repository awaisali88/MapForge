import type { Tool, ToolContext, ToolSetupResult } from "./types";
import type { Feature, FeatureCollection, Position } from "geojson";
import type { GeoJSONSource, MapMouseEvent } from "maplibre-gl";

import { areaSquareMeters, centroidOfRing, distanceMeters } from "@/modules/geo/measure";

const NS = "mapforge:draw-polygon";
const SRC_DRAFT = `${NS}:draft`;
const SRC_LABEL = `${NS}:label`;
const SRC_HANDLES = `${NS}:handles`;
const LYR_FILL = `${NS}:fill`;
const LYR_LINE = `${NS}:line`;
const LYR_LABEL = `${NS}:label`;
const LYR_HANDLES = `${NS}:handles`;

const emptyFC = (): FeatureCollection => ({ type: "FeatureCollection", features: [] });

const emptyPolygon = (): Feature => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [[]] },
  properties: {},
});

/**
 * Polygon-drawing tool for MapLibre.
 *
 * Lifecycle:
 *   click       → append vertex, re-render the ring (auto-closed to cursor)
 *   mousemove   → rubber-band the closing edge to the cursor
 *   dblclick    → finalize: emit a Polygon Feature with areaSquareMeters
 *   Enter       → same as dblclick
 *   Escape      → cancel, return to idle
 *
 * The closed ring during preview is `[…vertices, cursor, vertices[0]]` so
 * the user can see the full shape (including the closing segment) before
 * committing. Finalization needs at least 3 vertices.
 *
 * Rendering uses four layers on three sources: fill + dashed outline on
 * the draft polygon, a centroid area label, and a handles overlay.
 */
export const drawPolygonTool: Tool = {
  id: "draw-polygon",
  label: "Draw polygon",
  shortcut: "p",
  icon: "pentagon",
  setup({ map, suspend, restore, emit }: ToolContext): ToolSetupResult {
    const vertices: Position[] = [];
    let cursor: Position | null = null;

    map.addSource(SRC_DRAFT, { type: "geojson", data: emptyPolygon() });
    map.addSource(SRC_LABEL, { type: "geojson", data: emptyFC() });
    map.addSource(SRC_HANDLES, { type: "geojson", data: emptyFC() });

    map.addLayer({
      id: LYR_FILL,
      type: "fill",
      source: SRC_DRAFT,
      paint: {
        "fill-color": "#3b82f6",
        "fill-opacity": 0.18,
      },
    });

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
      id: LYR_LABEL,
      type: "symbol",
      source: SRC_LABEL,
      layout: {
        "text-field": ["get", "text"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
        "text-anchor": "center",
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

    function ringForRender(): Position[] {
      if (vertices.length === 0) return [];
      if (cursor) return [...vertices, cursor, vertices[0]!];
      return [...vertices, vertices[0]!];
    }

    function render(): void {
      const ring = ringForRender();
      const polygon: Feature = {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: ring.length > 0 ? [ring] : [[]] },
        properties: {},
      };
      (map.getSource(SRC_DRAFT) as GeoJSONSource | undefined)?.setData(polygon);
      (map.getSource(SRC_LABEL) as GeoJSONSource | undefined)?.setData(buildAreaLabel(vertices));
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
      if (vertices.length < 3) return;
      const ring = [...vertices, vertices[0]!];
      const feature: Feature = {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [ring] },
        properties: {
          kind: "draw-polygon",
          areaSquareMeters: areaSquareMeters(vertices),
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
          if (map.getLayer(LYR_FILL)) map.removeLayer(LYR_FILL);
          if (map.getLayer(LYR_LINE)) map.removeLayer(LYR_LINE);
          if (map.getLayer(LYR_LABEL)) map.removeLayer(LYR_LABEL);
          if (map.getLayer(LYR_HANDLES)) map.removeLayer(LYR_HANDLES);
          if (map.getSource(SRC_DRAFT)) map.removeSource(SRC_DRAFT);
          if (map.getSource(SRC_LABEL)) map.removeSource(SRC_LABEL);
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

function buildAreaLabel(vertices: Position[]): FeatureCollection {
  if (vertices.length < 3) return emptyFC();
  const area = areaSquareMeters(vertices);
  const centroid = centroidOfRing(vertices);
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: centroid },
        properties: { text: formatArea(area), kind: "area" },
      },
    ],
  };
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

function formatArea(squareMeters: number): string {
  if (squareMeters >= 1_000_000) return `${(squareMeters / 1_000_000).toFixed(2)} km²`;
  return `${squareMeters.toFixed(0)} m²`;
}
