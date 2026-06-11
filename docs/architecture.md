# Architecture

MapForge is a minimal, map-first Vue 3 sandbox. It exists to build and test map tooling on MapLibre GL and to develop a future plugin module.

## Boot flow

`main.ts` (createApp, Pinia, router, PrimeVue unstyled, `LUCIDE_CONTEXT` provide, native context-menu suppression) → `App.vue` (`<RouterView />`) → one route → `views/MapHome.vue` → `components/MapView.vue` (full-screen map) with `components/SettingsDrawer.vue` overlaid (gear icon → left drawer).

## Map core

`composables/useMapLibre.ts` holds the map in a `shallowRef` and exposes `mount(container, options?)` / `destroy()` (destroy is registered with `onBeforeUnmount`). The initial basemap, center, and zoom come from the basemap registry and the `VITE_*` env vars.

> The map instance is never placed in reactive state — reactive proxies break the engine internals.

## Basemaps

`modules/maplibre/basemaps.ts` is the basemap registry. A `BasemapSource` is either a **vector** style (a style.json URL — OpenFreeMap Liberty/Bright/Positron) or a **raster** XYZ tile set (Google satellite/hybrid/roadmap/terrain + Esri World Imagery), turned into a minimal style by `buildRasterStyle`. `resolveBasemapStyle` returns a `map.setStyle` argument (a URL for vector, a generated style object for raster), so `MapControls` switches any basemap with a single `setStyle` call. The default honors `VITE_MAPLIBRE_STYLE_URL`; the Google tile template is configurable via `VITE_GOOGLE_TILES_TEMPLATE`.

> ⚠️ The Google `mt*.google.com` endpoint is unofficial and undocumented — sandbox/dev use only. For production use the keyed Google Map Tiles API; the key-less **Esri World Imagery** entry is shipped as a legitimate alternative.

### Local tiles + 3D terrain

`localBasemaps()` reads `VITE_LOCAL_IMAGERY` / `VITE_LOCAL_OSM` / `VITE_LOCAL_HYBRID` / `VITE_LOCAL_ELEVATION` (a LAN tile server) and returns raster entries for any that are set — surfaced under a separate **Local** group in the `MapControls` dropdown (PrimeVue `Select` option groups). OSM/Hybrid are TileServer-GL **512px** styles, so those entries declare `tileSize: 512` (imagery/elevation stay 256). A third **composite** kind (`buildCompositeStyle`) stacks several raster layers in one style — used for **Google Satellite + Hybrid**, where the transparent Hybrid labels/roads overlay Google Satellite imagery. All raster/composite styles render over a **white** background (`RASTER_BACKGROUND`) so partially-transparent tiles read as a light map, not dark gaps.

A DEM is **not** a basemap (raw DEM tiles are RGB-encoded elevation), so elevation is handled apart from the registry: `modules/maplibre/terrain.ts` describes the DEM `raster-dem` source (encoding from `VITE_LOCAL_ELEVATION_ENCODING`, default `terrarium`), and `composables/useTerrain.ts` toggles 3D relief via `map.setTerrain`. Because a basemap switch (`map.setStyle`) wipes every source and the terrain setting, `useTerrain` re-adds the DEM source and re-applies terrain on the map's `style.load` event (the same wipe-and-restore shape `useTerraDraw` uses). `MapView` also calls `useTerrain.suspendForStyleSwitch()` (clear terrain) _before_ the switch: a `setStyle` deletes `style.projection` until the new style loads, and terrain's render-to-texture pass can fire a render in that window that crashes reading `style.projection.shaderPreludeCode`. Tearing terrain down first removes that pass; `useTerraDraw` also passes `{ diff: false }` to force a clean rebuild instead of a diff that races the half-loaded style. The elevation tile URL also yields a raw-tile **Local Elevation (raw tiles)** basemap entry purely to confirm the tiles serve.

## Drawing + measuring (Terra Draw)

Drawing and measuring are handled by `composables/useTerraDraw.ts`, which mounts the `@watergis/maplibre-gl-terradraw` `MaplibreMeasureControl` — a MapLibre control with its **own toolbar UI** (top-right) and built-in distance/area measurement. MapForge ships no hand-rolled drawing controls.

`useTerraDraw` mirrors finalized features into `stores/drawings.ts` (via `setAll`, on every Terra Draw `change`/`finish`) so the app keeps an exportable copy and a live count. Because `map.setStyle` (a basemap switch) wipes Terra Draw's layers and its adapter skips re-render on a style swap, `useTerraDraw` re-hydrates on `styledata` (snapshot → `clear()` → `addFeatures()` → `recalc()`), so drawings and measurement labels survive basemap changes. Raster basemap styles include a `glyphs` endpoint so the measurement text renders over imagery.

## Geo utilities

`modules/geo/{coords,h3,measure}.ts` provide coordinate formatting (DD/DMS/MGRS), H3 helpers, and @turf-backed distance/length/area/midpoint/centroid/bearing — a standalone geospatial-math surface independent of the drawing UI.

## Controls

`components/SettingsDrawer.vue` replaces the old `MapControls` panel. A gear `IconButton` (top-left) opens a PrimeVue `Drawer` (left) containing: a basemap `Select` (switches via `resolveBasemapStyle` + `map.setStyle`), a 3D Terrain toggle (shown only when a local DEM is configured), and placeholder rows for grid overlays and contours added in later phases. Toggle state is persisted via the `overlays` Pinia store. The drawing/measure toolbar is Terra Draw's own, top-right.

## The plugin ("lp module")

`pnpm-workspace.yaml` includes `packages/*`. A future plugin lives under `packages/<name>` as its own workspace package, ultimately consumable by CommandVue. Its design is a separate spec.
