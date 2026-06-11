# Project & stack

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Project context

**MapForge** is a MapLibre-first Vue 3 sandbox for building and testing map tools (drawing, measuring, future tools) on top of MapLibre GL, and for developing a future plugin module ("lp module") that installs into CommandVue (and MapForge) as a workspace package under `packages/`.

It boots straight to a full-screen 2D map. It is deliberately minimal: no panel/window manager, no chrome bars, no theming engine, no 3D globe, no operational-domain features. Keep additions generic and map-focused.

**Maintainer:** Uraan AI — https://uraanai.com
**Repository:** https://github.com/awaisali88/MapForge
**License:** Apache 2.0

---

## Locked technology stack

Do not substitute libraries from this list without explicit instruction.

| Layer              | Choice                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Framework          | Vue 3 + Vite                                                                             |
| Language           | TypeScript (strict)                                                                      |
| Router             | Vue Router                                                                               |
| State              | Pinia                                                                                    |
| Package manager    | pnpm (with workspaces)                                                                   |
| UI components      | PrimeVue (unstyled) + Tailwind v4                                                        |
| 2D map             | MapLibre GL                                                                              |
| Basemaps           | OpenFreeMap (vector) + Google / Esri (raster); see `modules/maplibre/basemaps.ts`        |
| Draw + measure     | Terra Draw (`@watergis/maplibre-gl-terradraw`)                                           |
| Graticule overlay  | `geogrid-maplibre-gl` (lat/lon grid lines + labels)                                      |
| Contour overlay    | `maplibre-contour` (DEM-driven contour lines; H3 + MGRS grids use existing h3-js / mgrs) |
| Geospatial math    | @turf/\*, mgrs, h3-js                                                                    |
| Icons              | @lucide/vue                                                                              |
| Tooltips           | floating-vue                                                                             |
| Utilities          | @vueuse/core, dayjs, es-toolkit, nanoid                                                  |
| Spell-check (code) | CSpell + dictionaries/\*.txt                                                             |
| Build              | Vite                                                                                     |
| Quality            | ESLint flat config, Prettier, Vitest, vue-tsc                                            |
| Containerization   | Multi-stage Dockerfile + docker-compose.yml                                              |
| Documentation site | VitePress (`docs/.vitepress/config.ts`; `pnpm docs:dev` / `docs:build` / `docs:preview`) |

A table/grid library (`@tanstack/vue-table`), a confirm/toast feedback chain, and other surfaces are intentionally deferred — add them (and a row here) when a feature needs them.

---

## What not to do

- Do not add a second map engine. MapLibre GL only (the Cesium 3D globe was deliberately dropped).
- Do not add lodash. Use `es-toolkit`.
- Do not add Moment. Use `dayjs`.
- Do not add Axios for the sandbox. Use native `fetch`.
- Do not introduce SSR or Nuxt-specific patterns.
- Do not import full icon packs. Named imports only.
- Do not commit secrets, API keys, or `.env` files.

---

## Brand colors (overridable defaults)

The sandbox ships with neutral slate/blue token defaults (see `src/assets/styles/tokens.css`). Uraan AI's brand accents, if you rebrand:

- Navy: `#0B1120`
- Teal: `#10C4A2`
