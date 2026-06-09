import type { StyleSpecification } from "maplibre-gl";

import { OPENFREEMAP_BRIGHT, OPENFREEMAP_LIBERTY, OPENFREEMAP_POSITRON } from "./styles";

/**
 * Basemap registry.
 *
 * A basemap is either a full MapLibre **vector** style (a style.json URL, e.g.
 * OpenFreeMap) or a **raster** XYZ tile set (built into a minimal style by
 * `buildRasterStyle`). The consumer switches basemaps with a single
 * `map.setStyle(resolveBasemapStyle(source))` call regardless of kind.
 *
 * Google raster basemaps use the `mt*.google.com/vt` endpoint. NOTE: that
 * endpoint is **unofficial and undocumented** — no SLA, against Google's ToS,
 * and may break or rate-limit without notice. It is included for local/sandbox
 * use only. For production use the keyed Google Map Tiles API
 * (https://developers.google.com/maps/documentation/tile). `Esri World Imagery`
 * is included as a legitimate, key-less satellite alternative.
 */

export type BasemapSource =
  | { id: string; label: string; kind: "vector"; url: string }
  | {
      id: string;
      label: string;
      kind: "raster";
      tiles: string[];
      tileSize?: number;
      maxzoom?: number;
      attribution: string;
    };

const GOOGLE_ATTR = "© Google — unofficial mt.google.com tiles, sandbox use only";
const ESRI_ATTR = "Esri, Maxar, Earthstar Geographics";

/**
 * Google tile-URL template. `{lyrs}` selects the layer type (s=satellite,
 * y=hybrid, m=roadmap, p=terrain); `{s}` is the load-balancing subdomain.
 * Overridable via `VITE_GOOGLE_TILES_TEMPLATE`.
 */
const GOOGLE_TILES_TEMPLATE = "https://mt{s}.google.com/vt/lyrs={lyrs}&x={x}&y={y}&z={z}";

/**
 * Expand the Google template into one explicit URL per `mt0..mt3` subdomain
 * (MapLibre has no Leaflet-style `{s}` subdomain option), substituting the
 * `lyrs` layer type. `{x}`/`{y}`/`{z}` are left for MapLibre to fill.
 */
export function googleTiles(lyrs: "m" | "p" | "s" | "y"): string[] {
  const template = import.meta.env.VITE_GOOGLE_TILES_TEMPLATE ?? GOOGLE_TILES_TEMPLATE;
  return [0, 1, 2, 3].map((n) => template.replace("{s}", String(n)).replace("{lyrs}", lyrs));
}

export const BASEMAPS: BasemapSource[] = [
  { id: "liberty", label: "Liberty (vector)", kind: "vector", url: OPENFREEMAP_LIBERTY },
  { id: "bright", label: "Bright (vector)", kind: "vector", url: OPENFREEMAP_BRIGHT },
  { id: "positron", label: "Positron (vector)", kind: "vector", url: OPENFREEMAP_POSITRON },
  {
    id: "google-satellite",
    label: "Google Satellite",
    kind: "raster",
    tiles: googleTiles("s"),
    maxzoom: 20,
    attribution: GOOGLE_ATTR,
  },
  {
    id: "google-hybrid",
    label: "Google Hybrid",
    kind: "raster",
    tiles: googleTiles("y"),
    maxzoom: 20,
    attribution: GOOGLE_ATTR,
  },
  {
    id: "google-roadmap",
    label: "Google Roadmap",
    kind: "raster",
    tiles: googleTiles("m"),
    maxzoom: 20,
    attribution: GOOGLE_ATTR,
  },
  {
    id: "google-terrain",
    label: "Google Terrain",
    kind: "raster",
    tiles: googleTiles("p"),
    maxzoom: 20,
    attribution: GOOGLE_ATTR,
  },
  {
    id: "esri-imagery",
    label: "Esri World Imagery",
    kind: "raster",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    maxzoom: 19,
    attribution: ESRI_ATTR,
  },
];

/** Build a minimal MapLibre style that renders a single raster basemap. */
export function buildRasterStyle(
  src: Extract<BasemapSource, { kind: "raster" }>,
): StyleSpecification {
  return {
    version: 8,
    // A glyphs endpoint so symbol/text layers (e.g. Terra Draw measurement
    // labels) can render over raster basemaps, which carry no fonts of their
    // own. OpenFreeMap's glyph server reliably serves "Noto Sans Regular" (the
    // font the Terra Draw control is configured to use).
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      basemap: {
        type: "raster",
        tiles: src.tiles,
        tileSize: src.tileSize ?? 256,
        maxzoom: src.maxzoom ?? 20,
        attribution: src.attribution,
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#0b1120" } },
      { id: "basemap", type: "raster", source: "basemap" },
    ],
  };
}

/** Resolve a basemap to a `setStyle` argument: a URL (vector) or a style object (raster). */
export function resolveBasemapStyle(src: BasemapSource): StyleSpecification | string {
  return src.kind === "vector" ? src.url : buildRasterStyle(src);
}

/**
 * The initial basemap. Honors `VITE_MAPLIBRE_STYLE_URL` (a self-hosted vector
 * style) when set, otherwise the first registry entry (OpenFreeMap Liberty).
 */
export function defaultBasemap(): BasemapSource {
  const custom = import.meta.env.VITE_MAPLIBRE_STYLE_URL;
  if (custom) return { id: "custom", label: "Custom (env)", kind: "vector", url: custom };
  return BASEMAPS[0]!;
}
