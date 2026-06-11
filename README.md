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

| Layer           | Choice                                                       |
| --------------- | ------------------------------------------------------------ |
| Framework       | Vue 3 + Vite                                                 |
| Language        | TypeScript (strict)                                          |
| Router          | Vue Router                                                   |
| State           | Pinia                                                        |
| UI components   | PrimeVue (unstyled) + Tailwind v4                            |
| 2D map          | MapLibre GL                                                  |
| Basemaps        | OpenFreeMap (vector) + Google / Esri (raster)                |
| Draw + measure  | Terra Draw (`@watergis/maplibre-gl-terradraw`)               |
| Geospatial math | @turf/\*, mgrs, h3-js                                        |
| Icons           | @lucide/vue                                                  |
| Tooltips        | floating-vue                                                 |
| Quality         | ESLint, Prettier, Vitest, vue-tsc, CSpell, commitlint, husky |
| Docs            | VitePress                                                    |

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

## Project structure

```
src/
├── components/
│   ├── MapView.vue          # full-screen map + drawing wiring
│   ├── MapControls.vue      # basemap switcher overlay
│   ├── common/              # LoadingSpinner
│   └── ui/                  # PrimeVue-wrapped primitives
├── composables/             # useMapLibre, useTerraDraw
├── modules/
│   ├── maplibre/            # style URLs + basemap registry + types
│   └── geo/                 # @turf / mgrs / h3 math
├── router/                  # one route → MapHome
├── stores/                  # drawings (mirror of Terra Draw features)
├── views/MapHome.vue
└── utils/                   # cn, id, format, files
packages/                    # reserved for the future plugin module
```

Drawing + measuring use Terra Draw's own toolbar (top-right); `MapControls` (top-left) switches basemaps.

## Documentation

`pnpm docs:dev`, or read [`docs/architecture.md`](./docs/architecture.md).

## License

[Apache 2.0](./LICENSE). Built by [Uraan AI](https://uraanai.com).
