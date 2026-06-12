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

## MVT tile encoder

`modules/maplibre/mvt.ts` is a shared, framework-agnostic Mapbox Vector Tile (MVT/PBF) encoder — ported from [orbat-mapper](https://github.com/orbat-mapper/orbat-mapper) (MIT). It hand-encodes tiles via the `pbf` package (the same approach proven in orbat-mapper's tile pipeline) and exposes:

- **`TileBuilder` / `LayerBuilder`** — build a tile from named layers; each layer accumulates features with optional per-feature property maps (keys/values/tags tables, per the MVT 2.1 spec).
- **`encodeTile`** — convenience function: map of layer name → features → `ArrayBuffer`.
- **`GeomType`** — constants for point (1), line (2), polygon (3).
- **`tileBounds`** — Web-Mercator geographic + Mercator-Y bounds for a `z/x/y` tile.
- **`project`** — project `lng/lat` into a tile's `0..4096` pixel space (linear in longitude, Mercator in latitude so the grid aligns with MapLibre's rendering).

Both the MGRS and H3 custom protocols delegate all byte-encoding and coordinate-math to this module. Empty layers are always emitted so style `source-layer` references resolve even on tiles with no features.

## Custom tile protocols

### `mgrstile://` — MGRS reference grid

`modules/maplibre/mgrsTileProtocol.ts` (ported from orbat-mapper, MIT) registers the `mgrstile://{z}/{x}/{y}` protocol with MapLibre via `addProtocol`. For each tile it:

1. Iterates the Grid Zone Designators (GZDs) that intersect the tile's bounds. GZD geometry is exact: band parallels every 8° (-80…84), 6° meridians, with Norway (band V: 31V=0–3°, 32V=3–12°) and Svalbard (band X: non-standard 31X/33X/35X/37X widths; 32X/34X/36X don't exist) exceptions fully handled.
2. For each GZD, samples the boundary to build a tight UTM bounding box, then walks constant-easting and constant-northing grid lines at the current cell size. Each line is densified to `lng/lat` via UTM→LL and bisection-clipped at the GZD boundary, so lines are straight in UTM space (slightly curved in lat/lng) and stop at the zone/band edge.
3. Places cell labels at true UTM midpoints via `mgrs.forward`.

The tile always emits **two layers** (even when empty):

- `"mgrs"` — `LINE` features (grid boundaries), no properties.
- `"mgrs_labels"` — `POINT` features with a `"label"` string property.

The grid line spacing is set in metres via `setMgrsCellMeters` (decoupled from the MGRS label digit precision, which `cellMetersToDigits` derives so non-decade cell sizes like 200 m / 500 m / 50 km work). `useMgrsGrid` drives this through a 9-step ladder (100 km → 50 km → 10 km → 5 km → 2 km → 1 km → 500 m → 200 m → 100 m).

**Labels.** At 100 km / 50 km the tile's `mgrs_labels` layer centers the full MGRS reference in each cell. At 10 km and finer those are hidden in favor of **graticule-style edge labels** (`modules/maplibre/mgrsEdgeLabels.ts`): the principal grid value of each easting/northing line where it crosses the viewport border (easting on top/bottom, northing on left/right), computed in screen space and refreshed on every `move` (throttled to one animation frame) so they ride the edges as the user pans — the same UX as the lat/lon graticule. The handler is abort-aware — cancelled tiles throw `AbortError` so rapid zoom/pan tile cancellations stay out of the console.

### `h3tile://` — H3 hexagon grid

`modules/maplibre/h3TileProtocol.ts` (ported from orbat-mapper, MIT) registers the `h3tile://{z}/{x}/{y}` protocol. For each tile it enumerates H3 cells via one of two strategies (split at resolution 4):

- **Strategy A (res ≤ 4):** Pre-computes every cell at the resolution once (`getRes0Cells` → `cellToChildren`, cached per resolution) and filters by center-in-padded-bbox. Avoids `polygonToCells` at coarse resolutions where it would choke near poles and the antimeridian.
- **Strategy B (res > 4):** Calls `polygonToCells` on the padded tile bbox (small at high zoom). Handles antimeridian clipping with up to three bbox calls (deduped via a `Set`) and widens longitude padding at high latitudes to compensate for Mercator foreshortening.

Each cell is projected into MVT tile space with per-vertex longitude normalization relative to the shifted cell center, preventing ring tears across the antimeridian seam. The tile emits **one layer**:

- `"h3"` — `POLYGON` features with `{ h3: <cellId>, res: <resolution> }` properties (so cells can be picked or labelled).

The handler is abort-aware (same pattern as `mgrstile://`).

## Overlays

All overlay settings are held in `stores/overlays.ts` — a serializable Pinia store persisted to `localStorage` (via `@vueuse/core` `useLocalStorage`). It stores boolean flags for each overlay (`graticule`, `hexGrid`, `mgrsGrid`, `contours`, `terrain`), the contour units (`m`/`ft`), the last-used `basemapId`, and the MGRS/H3 tunables described below. On reload, `MapView.vue` reads `basemapId` and passes the resolved style as the initial `MapOptions.style` so the map mounts on the persisted basemap without a post-mount `setStyle` call.

**MGRS tunables** (persisted): `mgrsAuto` (derive the resolution level from zoom vs. fixed) and `mgrsLevel` (0–8 index into the 9-step ladder, 0=100 km … 8=100 m). While the grid is on, `useMgrsGrid` exposes a reactive `resolutionLabel` (e.g. `"1 km"`) that `MapView.vue` shows in the bottom-right `MgrsResolutionIndicator`, just above the cursor readout.
**H3 tunables** (persisted): `hexAuto` (derive resolution from zoom vs. fixed) and `hexResolution` (H3 resolution 0–8).

Each overlay is managed by a dedicated composable — `useGraticule`, `useHexGrid`, `useMgrsGrid`, `useContours`, `useTerrain` — that watches its store flag and owns its MapLibre lifecycle (add source/layer on enable, remove on disable). All overlays re-add their sources and layers on the map's **`style.load`** event after a basemap switch, because `map.setStyle` wipes every source, layer, and the terrain setting. Overlay composables guard adds with `getSource`/`getLayer` checks so they are idempotent.

**Why `style.load` and not `styledata`?** The `style.load` event fires once the style is fully loaded and `style.projection` is non-null. Re-adding layers during `styledata` (which fires multiple times mid-transition) can crash the render pipeline while `style.projection` is transiently null. For composables that must tear down _before_ the switch begins (terrain, graticule), `MapView.vue` calls their `suspendForStyleSwitch()` action before handing the style to `useTerraDraw.switchBasemap`.

### Overlay composables

| Composable     | Library / protocol                      | Description                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useGraticule` | `geogrid-maplibre-gl`                   | Lat/lon grid lines and degree labels. `GeoGrid` is rebuilt fresh on each `style.load` (the library's layer references become stale after a style wipe).                                                                                                                                                                                                                                             |
| `useHexGrid`   | `h3tile://` protocol (`h3-js` + `pbf`)  | H3 hexagonal cells via the custom `h3tile://` vector-tile protocol. Adds a `type:"vector"` source; MapLibre's tile pipeline handles viewport culling and caching. Resolution is auto (zoom-derived) or manual (res 0–8); a change forces a source remove + re-add to bust the tile cache. Idle-defer re-add on basemap switch (same pattern as `useContours`).                                      |
| `useMgrsGrid`  | `mgrstile://` protocol (`mgrs` + `pbf`) | Two-tier MGRS grid: (1) a static GeoJSON GZD graticule (zone/band boundaries with Norway/Svalbard exceptions, always visible when the overlay is on); (2) a dynamic fine grid via the custom `mgrstile://` vector-tile protocol, suppressed below zoom 5. Accuracy (100 km → 10 m) is auto (zoom-derived) or manual; a change forces a source remove + re-add. Idle-defer re-add on basemap switch. |
| `useContours`  | `maplibre-contour`                      | DEM-derived contour lines and elevation labels from the local `raster-dem` source. A module-scoped `DemSource` singleton registers the contour tile protocol once; the source and layers are rebuilt when units (m/ft) change.                                                                                                                                                                      |
| `useTerrain`   | MapLibre GL                             | `map.setTerrain` from the local DEM. Tears down before a basemap switch and re-applies on `style.load`.                                                                                                                                                                                                                                                                                             |

### UI components

`components/SettingsDrawer.vue` — a gear `IconButton` (top-left, `z-10`) opens a PrimeVue `Drawer` (left, width 18 rem) containing: a basemap `Select`, a 3D Terrain toggle (shown only when a local DEM is configured), and rows for Graticule, Hexagon grid (H3), MGRS grid, and Contours. The Contours row exposes a units sub-control (meters / feet) when the contour overlay is active. All toggle state flows through the `overlays` store.

`components/CoordinateReadout.vue` — a fixed bottom-right chip (monospace, `z-10`) showing the cursor position. `useCoordinateReadout` listens to MapLibre `mousemove`/`mouseout` events and formats the coordinate via `formatForReadout` (`modules/geo/coords.ts`): MGRS when the MGRS grid overlay is on (with decimal-degrees fallback for positions outside the UTM range), decimal degrees otherwise. The format switches live when the MGRS toggle changes.

## Controls

`components/SettingsDrawer.vue` is the single entry point for all map controls. A gear `IconButton` (top-left) opens a PrimeVue `Drawer` (left) containing: a basemap `Select` (switches via `resolveBasemapStyle` + `map.setStyle`), a 3D Terrain toggle (shown only when a local DEM is configured), and independent toggles for Graticule, Hexagon grid, MGRS grid, and Contours. Toggle state is persisted via the `overlays` Pinia store. The drawing/measure toolbar is Terra Draw's own, top-right.

## The plugin ("lp module")

`pnpm-workspace.yaml` includes `packages/*`. A future plugin lives under `packages/<name>` as its own workspace package, ultimately consumable by CommandVue. Its design is a separate spec.
