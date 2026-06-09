# Architecture & conventions

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Architectural rules

1. **The MapLibre map instance is never stored in reactive state.** Hold it in a `shallowRef` (see `useMapLibre`). Reactive proxies break the map engine's internals.
2. **Drawing + measuring use Terra Draw** via `@watergis/maplibre-gl-terradraw` (`composables/useTerraDraw.ts`) — a MapLibre control with its own toolbar UI and built-in measurement. Don't hand-roll drawing controls; configure/extend the Terra Draw control (modes, measure options) instead.
3. **Basemaps go through the registry** (`modules/maplibre/basemaps.ts`). A `BasemapSource` is a vector style URL or a raster XYZ tile set; `resolveBasemapStyle` yields a `map.setStyle` argument so every basemap switches the same way. Add new basemaps to `BASEMAPS`.
4. **Pinia stores hold serializable state only.** No DOM refs, no Map instances in stores. `stores/drawings` is a plain, serializable mirror of the Terra Draw features (Terra Draw owns rendering).
5. **Composables own lifecycle.** Map creation/teardown happens in `useMapLibre` (mount + `onBeforeUnmount` destroy); the Terra Draw control mounts/cleans up in `useTerraDraw`. A `map.setStyle` basemap switch wipes overlay layers, so anything added on top of the style must re-add on `styledata` (see `useTerraDraw`).

---

## The MapForge model

- **Map core:** `composables/useMapLibre.ts` + `modules/maplibre/{styles,basemaps,types}.ts`. Initial basemap / center / zoom come from the registry + `VITE_*` env vars.
- **Basemaps:** `modules/maplibre/basemaps.ts` — vector (OpenFreeMap) + raster (Google, Esri). `VITE_GOOGLE_TILES_TEMPLATE` configures the (unofficial, sandbox-only) Google endpoint.
- **Drawing + measure:** `composables/useTerraDraw.ts` (the `@watergis/maplibre-gl-terradraw` control) → mirrors finalized features into `stores/drawings.ts`.
- **Geo math:** `modules/geo/{coords,h3,measure,types}.ts` (@turf / mgrs / h3) — a standalone utility surface.
- **App shell:** `main.ts` → `App.vue` (`<RouterView />`) → one route → `views/MapHome.vue` → `components/MapView.vue` with `components/MapControls.vue` (basemap switcher) overlay.
- **Future plugin ("lp module"):** lives under `packages/<name>` as a workspace package, ultimately consumable by CommandVue. Its design is a separate spec.

---

## State management rules

- One store per concern. Don't create kitchen-sink stores.
- Stores expose actions; components don't mutate state directly.
- Use `storeToRefs` when destructuring state in components.

---

## File / folder conventions

- Components: PascalCase (`MapControls.vue`).
- Composables: camelCase, prefixed with `use` (`useMapLibre.ts`).
- Stores: lowercase singular (`drawings.ts`).
- Modules: lowercase, domain-grouped (`modules/maplibre/`, `modules/geo/`).
- Types: colocated with their module.

---

## Testing conventions

- Unit tests in `tests/unit/` mirror `src/` structure.
- Use Vitest + @vue/test-utils.
- Test utilities, composables, and store logic. Imperative map-plugin wiring (Terra Draw) is verified at runtime, not unit-tested.
