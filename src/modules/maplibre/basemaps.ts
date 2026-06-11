import type { StyleSpecification } from "maplibre-gl";

import { OPENFREEMAP_BRIGHT, OPENFREEMAP_LIBERTY, OPENFREEMAP_POSITRON } from "./styles";
import { localTilesMaxZoom } from "./terrain";

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

/** One stacked raster tile set (bottom → top) inside a composite basemap. */
export interface RasterLayer {
  tiles: string[];
  tileSize?: number;
  maxzoom?: number;
}

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
    }
  | {
      // A stack of raster layers in one style — e.g. a satellite base with a
      // transparent labels/roads overlay on top. Layers render bottom → top.
      id: string;
      label: string;
      kind: "composite";
      layers: RasterLayer[];
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

const LOCAL_ATTR = "Local tiles";

/**
 * Locally-hosted raster basemaps, read from `VITE_LOCAL_*` env vars (a LAN tile
 * server). Only the ones whose URL is set are returned, so unconfigured entries
 * never appear in the dropdown. These are surfaced under a separate "Local"
 * group in `MapControls`.
 *
 * `tileSize` matters: imagery/elevation are 256px; the OSM/Hybrid TileServer-GL
 * styles are served at 512px (the `/512/` path segment), so they MUST declare
 * `tileSize: 512` or MapLibre renders them at the wrong zoom scale.
 *
 * The elevation entry is a **raw-tile preview** (RGB-encoded elevation shown as
 * a plain raster) purely to confirm the DEM tiles serve — to actually *use* the
 * elevation data as 3D relief, see `useTerrain` / the terrain toggle.
 */
export function localBasemaps(): BasemapSource[] {
  const env = import.meta.env;
  const maxzoom = localTilesMaxZoom();
  const raster = (
    id: string,
    label: string,
    url: string,
    tileSize?: number,
  ): Extract<BasemapSource, { kind: "raster" }> => ({
    id,
    label,
    kind: "raster",
    tiles: [url],
    tileSize,
    maxzoom,
    attribution: LOCAL_ATTR,
  });

  const out: BasemapSource[] = [];
  if (env.VITE_LOCAL_IMAGERY)
    out.push(raster("local-imagery", "Local Imagery", env.VITE_LOCAL_IMAGERY));
  if (env.VITE_LOCAL_OSM) out.push(raster("local-osm", "Local OSM", env.VITE_LOCAL_OSM, 512));
  if (env.VITE_LOCAL_HYBRID)
    out.push(raster("local-hybrid", "Local Hybrid", env.VITE_LOCAL_HYBRID, 512));
  // Composite: Google Satellite base + the (transparent) local Hybrid labels/
  // roads overlaid on top. Only meaningful when a Hybrid layer is configured.
  if (env.VITE_LOCAL_HYBRID) {
    out.push({
      id: "google-satellite-hybrid",
      label: "Google Satellite + Hybrid",
      kind: "composite",
      layers: [
        { tiles: googleTiles("s"), maxzoom: 20 },
        { tiles: [env.VITE_LOCAL_HYBRID], tileSize: 512, maxzoom },
      ],
      attribution: `${GOOGLE_ATTR}; ${LOCAL_ATTR}`,
    });
  }
  if (env.VITE_LOCAL_ELEVATION) {
    out.push(
      raster("local-elevation-preview", "Local Elevation (raw tiles)", env.VITE_LOCAL_ELEVATION),
    );
  }
  return out;
}

// A glyphs endpoint so symbol/text layers (e.g. Terra Draw measurement labels)
// can render over raster basemaps, which carry no fonts of their own.
// OpenFreeMap's glyph server reliably serves "Noto Sans Regular" (the font the
// Terra Draw control is configured to use).
const GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

// White, not the app's dark navy: raster tile sets (e.g. an OSM style) are often
// transparent where there's no data (land with no fill), and a white backdrop
// reads as a normal light map instead of dark gaps. Imagery is opaque, so the
// backdrop only shows briefly while tiles load or where a tile 404s.
const RASTER_BACKGROUND = "#ffffff";

const backgroundLayer = {
  id: "background",
  type: "background" as const,
  paint: { "background-color": RASTER_BACKGROUND },
};

/** Build a minimal MapLibre style that renders a single raster basemap. */
export function buildRasterStyle(
  src: Extract<BasemapSource, { kind: "raster" }>,
): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      basemap: {
        type: "raster",
        tiles: src.tiles,
        tileSize: src.tileSize ?? 256,
        maxzoom: src.maxzoom ?? 20,
        attribution: src.attribution,
      },
    },
    layers: [backgroundLayer, { id: "basemap", type: "raster", source: "basemap" }],
  };
}

/**
 * Build a style that stacks several raster layers (bottom → top) — e.g. a
 * satellite base with a transparent labels/roads overlay drawn on top.
 */
export function buildCompositeStyle(
  src: Extract<BasemapSource, { kind: "composite" }>,
): StyleSpecification {
  const sources: StyleSpecification["sources"] = {};
  const layers: StyleSpecification["layers"] = [backgroundLayer];
  src.layers.forEach((layer, i) => {
    const id = `basemap-${i}`;
    sources[id] = {
      type: "raster",
      tiles: layer.tiles,
      tileSize: layer.tileSize ?? 256,
      maxzoom: layer.maxzoom ?? 20,
      attribution: src.attribution,
    };
    layers.push({ id, type: "raster", source: id });
  });
  return { version: 8, glyphs: GLYPHS, sources, layers };
}

/** Resolve a basemap to a `setStyle` argument: a URL (vector) or a built style. */
export function resolveBasemapStyle(src: BasemapSource): StyleSpecification | string {
  if (src.kind === "vector") return src.url;
  if (src.kind === "composite") return buildCompositeStyle(src);
  return buildRasterStyle(src);
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
