# MapForge

A MapLibre-first Vue 3 sandbox for building and testing map tools (drawing, measuring) and CommandVue plugins.

MapForge boots straight to a full-screen [MapLibre GL](https://maplibre.org/) map (OpenFreeMap, no API key) and ships a small control overlay that activates the built-in tools, renders what you draw, clears it, and switches basemaps. It is forked from the CommandVue template, stripped to the proven map-native foundations.

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
| Geospatial math | @turf/\*, mgrs, h3-js                                        |
| Icons           | @lucide/vue                                                  |
| Tooltips        | floating-vue                                                 |
| Quality         | ESLint, Prettier, Vitest, vue-tsc, CSpell, commitlint, husky |
| Docs            | VitePress                                                    |

## Scripts

| Script                                            | What it does                  |
| ------------------------------------------------- | ----------------------------- |
| `pnpm dev`                                        | Start the Vite dev server     |
| `pnpm build`                                      | Type-check + production build |
| `pnpm preview`                                    | Preview the production build  |
| `pnpm type-check`                                 | `vue-tsc --build`             |
| `pnpm lint`                                       | ESLint (with `--fix`)         |
| `pnpm format` / `format:check`                    | Prettier write / check        |
| `pnpm test` / `test:watch`                        | Vitest                        |
| `pnpm spell`                                      | CSpell                        |
| `pnpm docs:dev` / `docs:build` / `docs:preview`   | VitePress                     |
| `pnpm docker:build` / `docker:up` / `docker:down` | Docker image / compose        |

## Configuration

Copy `.env.example` to `.env.local` and override as needed. Only `VITE_`-prefixed vars reach the browser.

| Variable                                                         | Purpose                                  |
| ---------------------------------------------------------------- | ---------------------------------------- |
| `VITE_APP_NAME`                                                  | Display name                             |
| `VITE_DEFAULT_MAP_CENTER_LAT` / `_LON` / `VITE_DEFAULT_MAP_ZOOM` | Initial map camera                       |
| `VITE_MAPLIBRE_STYLE_URL`                                        | Optional self-hosted MapLibre style.json |

## Project structure

```
src/
├── components/
│   ├── MapView.vue          # full-screen map + tool wiring
│   ├── MapControls.vue      # starter control overlay
│   ├── common/              # LoadingSpinner
│   └── ui/                  # PrimeVue-wrapped primitives
├── composables/             # useMapLibre, useToolRegistry, useDrawingLayer
├── modules/
│   ├── maplibre/            # style URLs + types
│   ├── tools/               # tool registry + measure-distance, draw-polygon
│   └── geo/                 # @turf / mgrs / h3 math
├── router/                  # one route → MapHome
├── stores/                  # tools, drawings
├── views/MapHome.vue
└── utils/                   # cn, id, format, files
packages/                    # reserved for the future plugin module
```

## Documentation

`pnpm docs:dev`, or read [`docs/architecture.md`](./docs/architecture.md).

## License

[Apache 2.0](./LICENSE). Built by [Uraan AI](https://uraanai.com).
