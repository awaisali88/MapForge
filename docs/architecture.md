# Architecture

MapForge is a minimal, map-first Vue 3 sandbox. It exists to build and test map tooling on MapLibre GL and to develop a future plugin module.

## Boot flow

`main.ts` (createApp, Pinia, router, PrimeVue unstyled, `LUCIDE_CONTEXT` provide, native context-menu suppression) → `App.vue` (`<RouterView />`) → one route → `views/MapHome.vue` → `components/MapView.vue` (full-screen map) with `components/SettingsDrawer.vue` overlaid (gear icon → left drawer).

## Map core

`composables/useMapLibre.ts` holds the map in a `shallowRef` and exposes `mount(container, options?)` / `destroy()` (destroy is registered with `onBeforeUnmount`). The initial basemap, center, and zoom come from the basemap registry and the `VITE_*` env vars.

> The map instance is never placed in reactive state — reactive proxies break the engine internals.

## Basemaps

`modules/maplibre/basemaps.ts` is the basemap registry. A `BasemapSource` is either a **vector** style (a style.json URL — OpenFreeMap Liberty/Bright/Positron) or a **raster** XYZ tile set (Google satellite/hybrid/roadmap/terrain + Esri World Imagery), turned into a minimal style by `buildRasterStyle`. `resolveBasemapStyle` returns a `map.setStyle` argument (a URL for vector, a generated style object for raster), so `SettingsDrawer` switches any basemap with a single `setStyle` call. The default honors `VITE_MAPLIBRE_STYLE_URL`; the Google tile template is configurable via `VITE_GOOGLE_TILES_TEMPLATE`.

> ⚠️ The Google `mt*.google.com` endpoint is unofficial and undocumented — sandbox/dev use only. For production use the keyed Google Map Tiles API; the key-less **Esri World Imagery** entry is shipped as a legitimate alternative.

### Local tiles + 3D terrain

`localBasemaps()` reads `VITE_LOCAL_IMAGERY` / `VITE_LOCAL_OSM` / `VITE_LOCAL_HYBRID` / `VITE_LOCAL_ELEVATION` (a LAN tile server) and returns raster entries for any that are set — surfaced under a separate **Local** group in the `SettingsDrawer` basemap dropdown (PrimeVue `Select` option groups). OSM/Hybrid are TileServer-GL **512px** styles, so those entries declare `tileSize: 512` (imagery/elevation stay 256). A third **composite** kind (`buildCompositeStyle`) stacks several raster layers in one style — used for **Google Satellite + Hybrid**, where the transparent Hybrid labels/roads overlay Google Satellite imagery. All raster/composite styles render over a **white** background (`RASTER_BACKGROUND`) so partially-transparent tiles read as a light map, not dark gaps.

A DEM is **not** a basemap (raw DEM tiles are RGB-encoded elevation), so elevation is handled apart from the registry: `modules/maplibre/terrain.ts` describes the DEM `raster-dem` source (encoding from `VITE_LOCAL_ELEVATION_ENCODING`, default `terrarium`), and `composables/useTerrain.ts` toggles 3D relief via `map.setTerrain`. Because a basemap switch (`map.setStyle`) wipes every source and the terrain setting, `useTerrain` re-adds the DEM source and re-applies terrain on the map's `style.load` event (the same wipe-and-restore shape `useTerraDraw` uses). `MapView` also calls `useTerrain.suspendForStyleSwitch()` (clear terrain) _before_ the switch: a `setStyle` deletes `style.projection` until the new style loads, and terrain's render-to-texture pass can fire a render in that window that crashes reading `style.projection.shaderPreludeCode`. Tearing terrain down first removes that pass; `useTerraDraw` also passes `{ diff: false }` to force a clean rebuild instead of a diff that races the half-loaded style. The elevation tile URL also yields a raw-tile **Local Elevation (raw tiles)** basemap entry purely to confirm the tiles serve.

## Drawing + measuring (Terra Draw)

Drawing and measuring are handled by `composables/useTerraDraw.ts`, which mounts the `@watergis/maplibre-gl-terradraw` `MaplibreMeasureControl` — a MapLibre control with its **own toolbar UI** (top-right) and built-in distance/area measurement. MapForge ships no hand-rolled drawing controls.

`useTerraDraw` mirrors finalized features into `stores/drawings.ts` (via `setAll`, on every Terra Draw `change`/`finish`) so the app keeps an exportable copy and a live count. Because `map.setStyle` (a basemap switch) wipes Terra Draw's layers and its adapter skips re-render on a style swap, `useTerraDraw` re-hydrates on `styledata` (snapshot → `clear()` → `addFeatures()` → `recalc()`), so drawings and measurement labels survive basemap changes. Raster basemap styles include a `glyphs` endpoint so the measurement text renders over imagery.

## Geo utilities

`modules/geo/{coords,h3,measure}.ts` provide coordinate formatting (DD/DMS/MGRS), H3 helpers, and @turf-backed distance/length/area/midpoint/centroid/bearing — a standalone geospatial-math surface independent of the drawing UI.

## Overlays

All overlay settings are held in `stores/overlays.ts` — a serializable Pinia store persisted to `localStorage` (via `@vueuse/core` `useLocalStorage`). It stores boolean flags for each overlay (`graticule`, `hexGrid`, `mgrsGrid`, `contours`, `terrain`), the contour units (`m`/`ft`), and the last-used `basemapId`. On reload, `MapView.vue` reads `basemapId` and passes the resolved style as the initial `MapOptions.style` so the map mounts on the persisted basemap without a post-mount `setStyle` call.

Each overlay is managed by a dedicated composable — `useGraticule`, `useHexGrid`, `useMgrsGrid`, `useContours`, `useTerrain` — that watches its store flag and owns its MapLibre lifecycle (add source/layer on enable, remove on disable). All overlays re-add their sources and layers on the map's **`style.load`** event after a basemap switch, because `map.setStyle` wipes every source, layer, and the terrain setting. Overlay composables guard adds with `getSource`/`getLayer` checks so they are idempotent.

**Why `style.load` and not `styledata`?** The `style.load` event fires once the style is fully loaded and `style.projection` is non-null. Re-adding layers during `styledata` (which fires multiple times mid-transition) can crash the render pipeline while `style.projection` is transiently null. For composables that must tear down _before_ the switch begins (terrain, graticule), `MapView.vue` calls their `suspendForStyleSwitch()` action before handing the style to `useTerraDraw.switchBasemap`.

### Overlay composables

| Composable     | Library               | Description                                                                                                                                                                                                                    |
| -------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useGraticule` | `geogrid-maplibre-gl` | Lat/lon grid lines and degree labels. `GeoGrid` is rebuilt fresh on each `style.load` (the library's layer references become stale after a style wipe).                                                                        |
| `useHexGrid`   | `h3-js`               | H3 hexagonal cells covering the current viewport. A GeoJSON source is updated on `moveend`/`zoomend` (debounced 150 ms) via `setData`; cell count is capped at 20 000.                                                         |
| `useMgrsGrid`  | `mgrs`                | A lat/lon reference grid with MGRS labels — a pragmatic graticule-style overlay, not a true UTM-zone tessellation. Lines and a symbol label layer are updated on pan/zoom (debounced); line count is capped at 2 000.          |
| `useContours`  | `maplibre-contour`    | DEM-derived contour lines and elevation labels from the local `raster-dem` source. A module-scoped `DemSource` singleton registers the contour tile protocol once; the source and layers are rebuilt when units (m/ft) change. |
| `useTerrain`   | MapLibre GL           | `map.setTerrain` from the local DEM. Tears down before a basemap switch and re-applies on `style.load`.                                                                                                                        |

### UI components

`components/SettingsDrawer.vue` — a gear `IconButton` (top-left, `z-10`) opens a PrimeVue `Drawer` (left, width 18 rem) containing: a basemap `Select`, a 3D Terrain toggle (shown only when a local DEM is configured), and rows for Graticule, Hexagon grid (H3), MGRS grid, and Contours. The Contours row exposes a units sub-control (meters / feet) when the contour overlay is active. All toggle state flows through the `overlays` store.

`components/CoordinateReadout.vue` — a fixed bottom-right chip (monospace, `z-10`) showing the cursor position. `useCoordinateReadout` listens to MapLibre `mousemove`/`mouseout` events and formats the coordinate via `formatForReadout` (`modules/geo/coords.ts`): MGRS when the MGRS grid overlay is on (with decimal-degrees fallback for positions outside the UTM range), decimal degrees otherwise. The format switches live when the MGRS toggle changes.

## Controls

`components/SettingsDrawer.vue` is the single entry point for all map controls. A gear `IconButton` (top-left) opens a PrimeVue `Drawer` (left) containing: a basemap `Select` (switches via `resolveBasemapStyle` + `map.setStyle`), a 3D Terrain toggle (shown only when a local DEM is configured), and independent toggles for Graticule, Hexagon grid, MGRS grid, and Contours. Toggle state is persisted via the `overlays` Pinia store. The drawing/measure toolbar is Terra Draw's own, top-right.

## The plugin ("lp module")

`pnpm-workspace.yaml` includes `packages/*`. A future plugin lives under `packages/<name>` as its own workspace package, ultimately consumable by CommandVue. Its design is a separate spec.
