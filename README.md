# MapForge

A MapLibre-first Vue 3 sandbox for building and testing map tools (drawing, measuring) and CommandVue plugins.

MapForge boots straight to a full-screen [MapLibre GL](https://maplibre.org/) map and ships the [Terra Draw](https://terradraw.io/) toolbar (draw + measure) plus a basemap switcher — OpenFreeMap vector styles and Google / Esri raster imagery. It is forked from the CommandVue template, stripped to the proven map-native foundations.

## Requirements

- Node `>= 22.12.0`
- pnpm `10.x` (via Corepack: `corepack enable`)

## Quick start

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`.

## Stack

| Layer           | Choice                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| Framework       | Vue 3 + Vite                                                                                            |
| Language        | TypeScript (strict)                                                                                     |
| Router          | Vue Router                                                                                              |
| State           | Pinia                                                                                                   |
| UI components   | PrimeVue (unstyled) + Tailwind v4                                                                       |
| 2D map          | MapLibre GL                                                                                             |
| Basemaps        | OpenFreeMap (vector) + Google / Esri (raster)                                                           |
| Draw + measure  | Terra Draw (`@watergis/maplibre-gl-terradraw`)                                                          |
| Graticule       | `geogrid-maplibre-gl` (lat/lon grid lines + labels)                                                     |
| Contours        | `maplibre-contour` (DEM contour lines)                                                                  |
| MGRS/H3 grids   | Custom MapLibre vector-tile protocols (`mgrstile://` / `h3tile://`) built on `mgrs`, `h3-js`, and `pbf` |
| MVT encoding    | `pbf` ^5.x (runtime); `@mapbox/vector-tile` ^3.x (dev)                                                  |
| Geospatial math | @turf/\*, mgrs, h3-js                                                                                   |
| Icons           | @lucide/vue                                                                                             |
| Tooltips        | floating-vue                                                                                            |
| Quality         | ESLint, Prettier, Vitest, vue-tsc, CSpell, commitlint, husky                                            |
| Docs            | VitePress                                                                                               |

## Scripts

| Script                                            | What it does                                                         |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm dev`                                        | Start the Vite dev server                                            |
| `pnpm dev:tunnel`                                 | Dev server + Cloudflare quick tunnel (public URL for remote testing) |
| `pnpm build`                                      | Type-check + production build                                        |
| `pnpm preview`                                    | Preview the production build                                         |
| `pnpm type-check`                                 | `vue-tsc --build`                                                    |
| `pnpm lint`                                       | ESLint (with `--fix`)                                                |
| `pnpm format` / `format:check`                    | Prettier write / check                                               |
| `pnpm test` / `test:watch`                        | Vitest                                                               |
| `pnpm spell`                                      | CSpell                                                               |
| `pnpm docs:dev` / `docs:build` / `docs:preview`   | VitePress                                                            |
| `pnpm docker:build` / `docker:up` / `docker:down` | Docker image / compose                                               |

### Remote testing (Cloudflare quick tunnel)

`pnpm dev:tunnel` runs the dev server and opens a Cloudflare **quick tunnel**, printing a public `https://<random>.trycloudflare.com` URL you can open from any device. It uses the `cloudflared` dev-dependency, which downloads its own binary automatically on first run — no Cloudflare account or manual install required.

The URL is **ephemeral** (it changes every run) and, while the command is running, your local dev server is **publicly reachable** by anyone who has the URL. Stop the command (Ctrl+C) when you're done.

## Configuration

Copy `.env.example` to `.env.local` and override as needed. Only `VITE_`-prefixed vars reach the browser.

| Variable                                                         | Purpose                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| `VITE_APP_NAME`                                                  | Display name                                            |
| `VITE_DEFAULT_MAP_CENTER_LAT` / `_LON` / `VITE_DEFAULT_MAP_ZOOM` | Initial map camera                                      |
| `VITE_MAPLIBRE_STYLE_URL`                                        | Optional self-hosted MapLibre style.json (default)      |
| `VITE_GOOGLE_TILES_TEMPLATE`                                     | Google raster tile template (sandbox-only — see note)   |
| `VITE_LOCAL_IMAGERY`                                             | Local aerial/satellite raster XYZ tiles (`{z}/{x}/{y}`) |
| `VITE_LOCAL_OSM`                                                 | Local OSM street raster XYZ tiles (512px)               |
| `VITE_LOCAL_HYBRID`                                              | Local hybrid raster XYZ tiles (512px)                   |
| `VITE_LOCAL_ELEVATION`                                           | Local DEM/elevation XYZ tiles → enables 3D terrain      |
| `VITE_LOCAL_ELEVATION_ENCODING`                                  | Elevation encoding: `terrarium` (default) or `mapbox`   |
| `VITE_LOCAL_TILES_MAX_ZOOM`                                      | Max zoom for the local tile sets (default `19`)         |

> **Note:** the Google basemaps use the unofficial `mt*.google.com` endpoint — fine for a local sandbox, but ToS-gray and not for production. Use the keyed Google Map Tiles API for production; the registry also ships a key-less **Esri World Imagery** basemap.

### Local / LAN tiles + 3D terrain

Point the `VITE_LOCAL_*` vars at your own tile server (standard XYZ, `{z}/{x}/{y}`). Configured layers appear under a separate **Local** group in the basemap dropdown. Setting `VITE_LOCAL_ELEVATION` also adds a **3D Terrain** toggle (the DEM is wired as a `raster-dem` source via `map.setTerrain`) plus a raw-tile **Local Elevation (raw tiles)** preview entry so you can confirm the elevation tiles serve. Set `VITE_LOCAL_ELEVATION_ENCODING` to match your DEM (`terrarium` vs `mapbox`) — a mismatch makes terrain look spiky or inverted.

When a Hybrid layer is set, a composite **Google Satellite + Hybrid** entry also appears — it stacks the (transparent) Hybrid labels/roads over Google Satellite imagery in one style.

Two formatting notes: **percent-encode spaces** in tile URLs (a TileServer-GL style id like `OSM OpenMapTiles` → `OSM%20OpenMapTiles`), and the OSM/Hybrid TileServer-GL styles are served at **512px** (the `/512/` path) — MapForge declares `tileSize: 512` for those so they align at the right zoom. Raster basemaps render over a **white** backdrop, so partially-transparent tiles (e.g. an OSM style with no land fill) read as a normal light map rather than dark gaps.

## Overlays & settings drawer

Click the **gear icon** (top-left) to open the left settings drawer. It consolidates all map controls:

- **Basemap** — switch between OpenFreeMap vector styles (Liberty, Bright, Positron), Google raster layers (Satellite, Hybrid, Roadmap, Terrain), Esri World Imagery, and any locally-configured tile sets.
- **3D Terrain** — shown only when `VITE_LOCAL_ELEVATION` is configured; tilts the map to 60° pitch when enabled.
- **Graticule** — lat/lon grid lines and degree labels via `geogrid-maplibre-gl`.
- **Hexagon grid (H3)** — real H3 hexagonal cells rendered via a custom `h3tile://` MapLibre vector-tile protocol (powered by `h3-js` + `pbf`). Resolution is derived from zoom automatically, or set manually (res 0–8) via a sub-control. Handles poles and antimeridian via a dual-strategy enumeration (global precompute at res ≤ 4; `polygonToCells` at finer resolutions).
- **MGRS grid** — a two-tier real UTM/GZD tessellation: a static GZD graticule (zone/band boundaries with Norway and Svalbard zone exceptions) plus a dynamic fine grid via the custom `mgrstile://` vector-tile protocol (powered by `mgrs` + `pbf`). The resolution steps through a 12-level ladder (1000 km → 500 km → 200 km → 100 km → 50 km → 10 km → 5 km → 2 km → 1 km → 500 m → 200 m → 100 m) automatically as you zoom, or can be fixed manually via a sub-control. At 100 km / 50 km the full MGRS reference is centered in each cell; at 10 km and finer the grid lines are labeled graticule-style along the viewport border (easting values on the top/bottom edges, northing on the left/right), and those labels track the edges as you pan. A small bottom-right indicator (just above the cursor readout) shows the active resolution whenever the grid is on, and the cursor readout itself switches from decimal degrees to MGRS.
- **Contours** — DEM elevation contour lines and labels via `maplibre-contour` (requires `VITE_LOCAL_ELEVATION`). A **Units** sub-control switches between meters and feet; changing units rebuilds the contour source immediately.

The **bottom-right cursor readout** shows the pointer position as decimal degrees (`lat°N lon°E`) by default, or as an MGRS grid reference when the MGRS grid overlay is active.

All settings (active overlays, contour units, last-used basemap) are persisted to `localStorage` and restored on reload — including the map's initial style, which is applied from the persisted basemap before the map mounts.

## Project structure

```
src/
├── components/
│   ├── MapView.vue          # full-screen map + overlay composable wiring
│   ├── SettingsDrawer.vue   # gear icon → left drawer (basemap + overlays)
│   ├── CoordinateReadout.vue# bottom-right cursor-coordinate display
│   ├── common/              # LoadingSpinner
│   └── ui/                  # PrimeVue-wrapped primitives
├── composables/             # useMapLibre, useTerraDraw, useGraticule, useHexGrid,
│                            # useMgrsGrid, useContours, useTerrain, useCoordinateReadout
├── modules/
│   ├── maplibre/            # style URLs + basemap registry + terrain config
│   │                        # + mvt.ts encoder + mgrsTileProtocol.ts + h3TileProtocol.ts
│   └── geo/                 # @turf / mgrs / h3 math (coords, measure, h3 helpers)
├── router/                  # one route → MapHome
├── stores/                  # drawings (Terra Draw mirror) + overlays (persisted settings)
├── views/MapHome.vue
└── utils/                   # cn, id, format, files
packages/                    # reserved for the future plugin module
```

Drawing + measuring use Terra Draw's own toolbar (top-right); the gear icon (top-left) opens the settings drawer.

## Documentation

`pnpm docs:dev`, or read [`docs/architecture.md`](./docs/architecture.md).

## License

[Apache 2.0](./LICENSE). Built by [Uraan AI](https://uraanai.com).
