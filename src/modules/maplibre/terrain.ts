/**
 * Local terrain (DEM) configuration.
 *
 * A DEM is **not** a basemap — raw DEM tiles are RGB-encoded elevation, not
 * imagery. In MapLibre a DEM is a `raster-dem` source consumed by
 * `map.setTerrain()` (3D relief) and/or a hillshade layer, applied *on top of*
 * whichever basemap is active. So terrain lives here, separate from the basemap
 * registry (`basemaps.ts`), and is wired by `composables/useTerrain.ts`.
 *
 * The DEM tile URL + encoding come from the `VITE_LOCAL_ELEVATION*` env vars
 * (see `.env.example`); when no elevation URL is set, `localDemConfig()` returns
 * `null` and the 3D-terrain toggle is hidden.
 */

/** RGB → elevation decoding scheme of the DEM tiles. */
export type DemEncoding = "mapbox" | "terrarium";

export interface LocalDemConfig {
  /** XYZ tile URL templates (`{z}/{x}/{y}`). */
  tiles: string[];
  encoding: DemEncoding;
  tileSize: number;
  maxzoom: number;
}

const DEFAULT_MAX_ZOOM = 19;

/** Shared maxzoom for the locally-hosted tile sets (raster + DEM). */
export function localTilesMaxZoom(): number {
  const raw = import.meta.env.VITE_LOCAL_TILES_MAX_ZOOM;
  const n = Number(raw);
  return raw && Number.isFinite(n) ? n : DEFAULT_MAX_ZOOM;
}

/**
 * The local DEM source descriptor read from env, or `null` when
 * `VITE_LOCAL_ELEVATION` is unset. Encoding defaults to `terrarium`
 * (override with `VITE_LOCAL_ELEVATION_ENCODING=mapbox`).
 */
export function localDemConfig(): LocalDemConfig | null {
  const url = import.meta.env.VITE_LOCAL_ELEVATION;
  if (!url) return null;
  const encoding: DemEncoding =
    import.meta.env.VITE_LOCAL_ELEVATION_ENCODING === "mapbox" ? "mapbox" : "terrarium";
  return { tiles: [url], encoding, tileSize: 256, maxzoom: localTilesMaxZoom() };
}
