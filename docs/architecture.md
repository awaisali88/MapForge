# Architecture

MapForge is a minimal, map-first Vue 3 sandbox. It exists to build and test map tooling on MapLibre GL and to develop a future plugin module.

## Boot flow

`main.ts` (createApp, Pinia, router, PrimeVue unstyled, `LUCIDE_CONTEXT` provide, native context-menu suppression) → `App.vue` (`<RouterView />`) → one route → `views/MapHome.vue` → `components/MapView.vue` (full-screen map) with `components/MapControls.vue` overlaid.

## Map core

`composables/useMapLibre.ts` holds the map in a `shallowRef` and exposes `mount(container, options?)` / `destroy()` (destroy is registered with `onBeforeUnmount`). The initial basemap, center, and zoom come from the basemap registry and the `VITE_*` env vars.

> The map instance is never placed in reactive state — reactive proxies break the engine internals.

## Basemaps

`modules/maplibre/basemaps.ts` is the basemap registry. A `BasemapSource` is either a **vector** style (a style.json URL — OpenFreeMap Liberty/Bright/Positron) or a **raster** XYZ tile set (Google satellite/hybrid/roadmap/terrain + Esri World Imagery), turned into a minimal style by `buildRasterStyle`. `resolveBasemapStyle` returns a `map.setStyle` argument (a URL for vector, a generated style object for raster), so `MapControls` switches any basemap with a single `setStyle` call. The default honors `VITE_MAPLIBRE_STYLE_URL`; the Google tile template is configurable via `VITE_GOOGLE_TILES_TEMPLATE`.

> ⚠️ The Google `mt*.google.com` endpoint is unofficial and undocumented — sandbox/dev use only. For production use the keyed Google Map Tiles API; the key-less **Esri World Imagery** entry is shipped as a legitimate alternative.

## Drawing + measuring (Terra Draw)

Drawing and measuring are handled by `composables/useTerraDraw.ts`, which mounts the `@watergis/maplibre-gl-terradraw` `MaplibreMeasureControl` — a MapLibre control with its **own toolbar UI** (top-right) and built-in distance/area measurement. MapForge ships no hand-rolled drawing controls.

`useTerraDraw` mirrors finalized features into `stores/drawings.ts` (via `setAll`, on every Terra Draw `change`/`finish`) so the app keeps an exportable copy and a live count. Because `map.setStyle` (a basemap switch) wipes Terra Draw's layers and its adapter skips re-render on a style swap, `useTerraDraw` re-hydrates on `styledata` (snapshot → `clear()` → `addFeatures()` → `recalc()`), so drawings and measurement labels survive basemap changes. Raster basemap styles include a `glyphs` endpoint so the measurement text renders over imagery.

## Geo utilities

`modules/geo/{coords,h3,measure}.ts` provide coordinate formatting (DD/DMS/MGRS), H3 helpers, and @turf-backed distance/length/area/midpoint/centroid/bearing — a standalone geospatial-math surface independent of the drawing UI.

## Controls

`components/MapControls.vue` is a small top-left overlay: a basemap `Select` (switches via `resolveBasemapStyle` + `map.setStyle`) and a count of the drawn features mirrored in the store. The drawing/measure toolbar is Terra Draw's own, top-right.

## The plugin ("lp module")

`pnpm-workspace.yaml` includes `packages/*`. A future plugin lives under `packages/<name>` as its own workspace package, ultimately consumable by CommandVue. Its design is a separate spec.
