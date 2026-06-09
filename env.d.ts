/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_DEFAULT_MAP_CENTER_LAT?: string;
  readonly VITE_DEFAULT_MAP_CENTER_LON?: string;
  readonly VITE_DEFAULT_MAP_ZOOM?: string;
  readonly VITE_MAPLIBRE_STYLE_URL?: string;
  readonly VITE_GOOGLE_TILES_TEMPLATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
