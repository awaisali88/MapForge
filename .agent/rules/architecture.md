# Architecture & conventions

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Architectural rules

1. **The MapLibre map instance is never stored in reactive state.** Hold it in a `shallowRef` (see `useMapLibre`). Reactive proxies break the map engine's internals.
2. **Tools register through the Tool Registry pattern** (`src/modules/tools/`). A tool is a plain object with `id`, `label`, optional `icon`/`shortcut`, and `setup(ctx) → { cleanup() }`. `cleanup()` must remove every listener / source / layer the tool added and be safe to call repeatedly. `useToolRegistry` watches `useToolsStore.activeId` and runs `setup`/`cleanup` on the matching tool.
3. **Pinia stores hold serializable state only.** No DOM refs, no Map instances in stores. The active tool id lives in `stores/tools`; finalized features live in `stores/drawings`.
4. **Composables own lifecycle.** Map creation/teardown happens in `useMapLibre` (mount + `onBeforeUnmount` destroy). Rendering of finalized drawings is a consumer's job — `useDrawingLayer` mirrors `drawings.featureCollection` into a MapLibre GeoJSON source.
5. **Tools own their MapLibre resources directly.** They add sources/layers under a `mapforge:` namespace and remove them in `cleanup()`.

---

## The MapForge model

- **Map core:** `composables/useMapLibre.ts` + `modules/maplibre/{styles,types}.ts`. Default style is OpenFreeMap Liberty (no API key). Center/zoom defaults live in `useMapLibre`.
- **Tools:** `modules/tools/{index,types,draw-polygon,measure-distance}.ts` + `composables/useToolRegistry.ts` + `stores/tools.ts`. `TOOLS` is the registry array; downstream code extends it by spreading.
- **Drawings + geo:** `stores/drawings.ts` (finalized features) + `composables/useDrawingLayer.ts` (rendering) + `modules/geo/{coords,h3,measure,types}.ts` (@turf / mgrs / h3 math).
- **App shell:** `main.ts` → `App.vue` (`<RouterView />`) → one route → `views/MapHome.vue` → `components/MapView.vue` (full-screen map) with `components/MapControls.vue` overlay.
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
- Stores: lowercase singular (`tools.ts`, `drawings.ts`).
- Modules: lowercase, domain-grouped (`modules/maplibre/`, `modules/geo/`, `modules/tools/`).
- Types: colocated with their module.

---

## Testing conventions

- Unit tests in `tests/unit/` mirror `src/` structure.
- Use Vitest + @vue/test-utils.
- Test utilities, composables, store logic, and tool lifecycles. Don't aim for component snapshot coverage.
