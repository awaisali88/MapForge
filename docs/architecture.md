# Architecture

MapForge is a minimal, map-first Vue 3 sandbox. It exists to build and test map tools on MapLibre GL and to develop a future plugin module.

## Boot flow

`main.ts` (createApp, Pinia, router, PrimeVue unstyled, `LUCIDE_CONTEXT` provide, native context-menu suppression) → `App.vue` (`<RouterView />`) → one route → `views/MapHome.vue` → `components/MapView.vue` (full-screen map) with `components/MapControls.vue` overlaid.

## Map core

`composables/useMapLibre.ts` holds the map in a `shallowRef` and exposes `mount(container, options?)` / `destroy()` (destroy is registered with `onBeforeUnmount`). The default style is OpenFreeMap Liberty (`modules/maplibre/styles.ts`); center `[70, 30]`, zoom `4`.

> The map instance is never placed in reactive state — reactive proxies break the engine internals.

## Tools

A tool is a plain object: `{ id, label, icon?, shortcut?, setup(ctx) → { cleanup() } }` (`modules/tools/types.ts`). `setup` receives a `ToolContext` (`{ map, suspend(), restore(), emit(feature) }`); it adds its own MapLibre sources/layers under a `mapforge:` namespace and returns a `cleanup()` that removes them.

`useToolRegistry(mapRef, { tools, onFinalize })` watches `useToolsStore.activeId`: switching tools runs the previous tool's `cleanup()` then the new tool's `setup()`. `MapView` wires `onFinalize` to `useDrawingsStore().add`. Built-ins: `measure-distance`, `draw-polygon` (`modules/tools/index.ts` `TOOLS`).

## Drawings + geo

`stores/drawings.ts` holds finalized features and exposes a `featureCollection` computed. The store leaves rendering to the consumer: `composables/useDrawingLayer.ts` adds a GeoJSON source + fill/line/circle layers on map `load`, re-adds them after a `setStyle` basemap switch (`styledata`), and watches `featureCollection` to keep the source in sync. `modules/geo/{coords,h3,measure}.ts` provide coordinate formatting (DD/DMS/MGRS), H3 helpers, and @turf-backed distance/length/area/midpoint/centroid/bearing.

## Controls

`components/MapControls.vue` is a small overlay: one toggle per tool in `TOOLS` (via `useToolsStore.toggle`), a "Clear drawings" button (`useDrawingsStore.clear`), and a basemap `Select` that calls `map.setStyle`. It's intentionally minimal — the seed for richer controls.

## The plugin ("lp module")

`pnpm-workspace.yaml` includes `packages/*`. A future plugin lives under `packages/<name>` as its own workspace package, ultimately consumable by CommandVue. Its design is a separate spec.
