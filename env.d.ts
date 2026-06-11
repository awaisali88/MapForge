/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_DEFAULT_MAP_CENTER_LAT?: string;
  readonly VITE_DEFAULT_MAP_CENTER_LON?: string;
  readonly VITE_DEFAULT_MAP_ZOOM?: string;
  readonly VITE_MAPLIBRE_STYLE_URL?: string;
  readonly VITE_GOOGLE_TILES_TEMPLATE?: string;
  // Local / LAN tile server (all optional; standard XYZ {z}/{x}/{y}).
  readonly VITE_LOCAL_IMAGERY?: string;
  readonly VITE_LOCAL_OSM?: string;
  readonly VITE_LOCAL_HYBRID?: string;
  readonly VITE_LOCAL_ELEVATION?: string;
  readonly VITE_LOCAL_ELEVATION_ENCODING?: string;
  readonly VITE_LOCAL_TILES_MAX_ZOOM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
