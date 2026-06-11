# Settings drawer, grid overlays, contours & cursor readout — design

> Spec for consolidating MapForge's map controls into a left **Settings drawer**, and
> adding three grid overlays (graticule, H3 hexagon, MGRS), DEM **contour lines**, and a
> live **cursor-coordinate readout**. Approved 2026-06-11.

## Overview

Today MapForge has two floating controls (top-left basemap `Select`, a "3D Terrain" button).
This work replaces them with a single gear icon that opens a left drawer holding every map
setting, and adds a set of toggleable overlays plus a bottom-right coordinate readout.

### Goals

- One **gear icon** (top-left) → PrimeVue **Drawer** (left) containing: basemap switch, and
  independent on/off toggles for Graticule, Hexagon (H3), MGRS grid, Contours, 3D Terrain.
  Any combination — including none — is valid.
- **Contour lines** from the existing local DEM (`VITE_LOCAL_ELEVATION`, terrarium), with a
  meters/feet toggle.
- A **cursor readout** in the bottom-right: MGRS when the MGRS grid is on (auto-falling back to
  lat/lon where MGRS is undefined, e.g. beyond ±80°), otherwise lat/lon (decimal degrees).
- Settings **persist** across reloads (localStorage).

### Non-goals

- No new tile servers or env vars (contours reuse the elevation DEM).
- No editing/measuring changes (Terra Draw is untouched).
- No grid _snapping_ or coordinate _entry_ — the readout is display-only.

## Architecture

A central **`overlays` Pinia store** holds serializable toggle state; **one focused composable
per overlay** owns that overlay's MapLibre lifecycle and watches its store flag. The drawer only
flips store flags; the readout only reads them. This mirrors the existing `useTerrain` /
`useTerraDraw` pattern and the project's "one store per concern / composables own lifecycle"
rules.

```
SettingsDrawer.vue ──(actions)──► stores/overlays.ts ◄──(watch flags)── use{Graticule,HexGrid,
        ▲                              │                                   MgrsGrid,Contours,Terrain}
   gear IconButton                     │                                        │ (add/remove layers,
                                       ▼                                        │  re-add on style.load)
                              CoordinateReadout.vue ◄── useCoordinateReadout ──► MapLibre map
                                (bottom-right)            (mousemove → format)
```

### `stores/overlays.ts` (serializable, persisted)

State: `graticule`, `hexGrid`, `mgrsGrid`, `contours`, `terrain` (booleans), `contourUnits`
(`'m' | 'ft'`), `basemapId` (string). Actions: `toggle(key)`, `setContourUnits(u)`,
`setBasemap(id)`. Persisted to `localStorage` (via `@vueuse/core` `useLocalStorage` or a watch),
so reload restores the last basemap + overlay set. No map instances or DOM refs in the store.

### Composables (each: watch flag → add/remove → re-add on `style.load`)

A basemap switch (`map.setStyle`) wipes every source/layer, so each composable re-adds itself on
the map's `style.load` event when its flag is on (idempotent, guarded by `getSource`/`getLayer`).
Terrain additionally tears down **before** `setStyle` (the projection-deletion race fixed
earlier); the other overlays are ordinary layers and only need the re-add.

- **`useGraticule(map)`** — wraps `geogrid-maplibre-gl`'s `GeoGrid`. On enable, construct
  `new GeoGrid({ map, gridStyle, labelStyle, zoomLevelRange, beforeLayerId })`; on disable,
  destroy/remove it. Recreate on `style.load`. (Exact teardown method confirmed against the lib
  during implementation; if it lacks a destroy, fall back to removing its layers/source.)
- **`useHexGrid(map)`** — H3 overlay via existing `h3-js`. On `moveend`/`zoomend` (debounced):
  compute the viewport bbox, pick an H3 resolution from zoom (bounded so cell count stays small),
  cover the viewport with `polygonToCells`, build a GeoJSON of cell boundaries
  (reusing `modules/geo/h3.ts` `cellBoundaryLonLat`), and update one GeoJSON source + line layer.
- **`useMgrsGrid(map)`** — MGRS overlay via existing `mgrs`. Zoom-adaptive grid interval
  (100 km / 10 km / 1 km squares); build viewport-clipped grid lines as GeoJSON + a line layer,
  with MGRS labels at cell origins. **Highest-risk / heaviest unit** — detailed algorithm in the
  plan; capped line count + debounce to protect frame rate.
- **`useContours(map)`** — `maplibre-contour`. Once: `new DemSource({ url: VITE_LOCAL_ELEVATION,
encoding: 'terrarium', maxzoom, worker: true })` + `demSource.setupMaplibre(maplibregl)`. On
  enable: add a `vector` source from `demSource.contourProtocolUrl({ multiplier, thresholds,
contourLayer, elevationKey, levelKey })` + a line layer + a symbol label layer. `multiplier`
  follows `contourUnits` (1 for m, 3.28084 for ft); switching units rebuilds the source. Glyphs
  for labels come from the existing raster-style glyph endpoint / vector style.
- **`useTerrain(map)`** — refactored to read `store.terrain` instead of owning its own ref;
  keeps `suspendForStyleSwitch()`.
- **`useCoordinateReadout(map)`** — on map `mousemove`, take `e.lngLat` and format via
  `modules/geo/coords.ts`: MGRS (with lat/lon fallback on throw) when `store.mgrsGrid`, else
  decimal-degrees. Exposes a reactive string; clears on `mouseout`.

### Components

- **`components/SettingsDrawer.vue`** — gear `ui/IconButton` (lucide `Settings`, top-left) toggles
  a `ui/Drawer.vue` (PrimeVue `Drawer`, left). Body: basemap `ui/Select` (bound to
  `store.basemapId` → calls the existing `switchBasemap` orchestration), a divider, then
  `ui/ToggleSwitch` rows for each overlay, and a meters/feet control for contours.
- **`components/CoordinateReadout.vue`** — bottom-right absolute overlay rendering the readout
  string (monospace, token-styled, non-interactive).
- New UI primitives (library-first rule): **`ui/Drawer.vue`** (PrimeVue `Drawer`, `:pt` tokens)
  and **`ui/ToggleSwitch.vue`** (PrimeVue `ToggleSwitch`, `:pt` tokens).
- **`MapControls.vue`** is removed/absorbed; **`MapView.vue`** mounts `SettingsDrawer` +
  `CoordinateReadout` and keeps owning the `switchBasemap` orchestration (terrain suspend →
  Terra Draw setStyle).

## Dependencies

Add `maplibre-contour` and `geogrid-maplibre-gl`. `h3-js` and `mgrs` already in the stack. Fetch
current docs for both new libs + PrimeVue `Drawer`/`ToggleSwitch` via Context7 before wiring.

## Phasing

Built together, but in this order so each layer rests on a verified foundation:

1. **Foundation** — `overlays` store (+ persistence), `ui/Drawer` + `ui/ToggleSwitch`,
   `SettingsDrawer`; move basemap select + terrain toggle in; delete the floating `MapControls`.
2. **Cursor readout** — `useCoordinateReadout` + `CoordinateReadout.vue` (lat/lon + MGRS fallback).
3. **Graticule** — `useGraticule` (geogrid-maplibre-gl).
4. **Contours** — `useContours` (maplibre-contour) + meters/feet toggle.
5. **Hexagon (H3) grid** — `useHexGrid`.
6. **MGRS grid** — `useMgrsGrid` (heaviest).

## Testing

- **Unit (Vitest):** store toggles + persistence; H3 viewport-cell generation (bbox → bounded
  cell set); MGRS grid-line generation + zoom→interval; readout format selection (MGRS-on →
  MGRS, fallback → lat/lon). Pure functions extracted from the composables so they're testable
  without a map.
- **Runtime (Playwright MCP):** drawer opens/closes; each toggle adds/removes its overlay;
  overlays survive a basemap switch (re-add on `style.load`); readout updates on hover and
  switches format with the MGRS toggle; contours render + flip units; console stays clean.

## Risks & mitigations

- **Basemap-switch wipe** — every overlay re-adds on `style.load`; verified per overlay.
- **MGRS grid complexity/perf** — debounce + cap line count + zoom-bounded interval; isolated in
  its own composable so it can't destabilize the others.
- **`geogrid-maplibre-gl` teardown API** — confirm destroy/remove during implementation; fall
  back to manual layer removal if absent.
- **Contour worker / protocol registration** — register the `maplibre-contour` protocol once at
  module scope; guard re-adds with `getSource`.

## Documentation sync (same PR)

Locked-stack table + README Stack (add `maplibre-contour`, `geogrid-maplibre-gl`); README
features + `docs/architecture.md` (new "Overlays" section); CSpell dictionaries
(`graticule`, `geogrid`, `mlcontour`, `terrarium` already added, etc.). No new env vars.
