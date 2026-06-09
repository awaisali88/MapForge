# MapForge — Scaffold Design Spec

- **Date:** 2026-06-09
- **Status:** Approved (design); pending spec review
- **Author:** Awais Ali (with Claude Code)
- **Source project:** CommandVue (`D:\Work\UraanAI\Public\CommandVue`)
- **Target:** `D:\Work\UraanAI\Public\MapForge`

---

## 1. Summary

MapForge is a new Vue 3 project forked from the CommandVue template, stripped down
to a **map-first sandbox**. It boots straight to a full-screen MapLibre GL map and
exists to build and test **map tools** (drawing, measuring, future plugins) on top
of MapLibre — and, later, to develop a **plugin module ("lp module")** that installs
into CommandVue.

It keeps all of CommandVue's meta-infrastructure (agent rules, GitHub config, tooling,
quality gates) and the *proven, MapLibre-native* foundations (map composable, tool
registry, drawings/geo modules, a subset of UI primitives), and discards the heavy
application systems CommandVue layers on top: Dockview, the Chrome bars (top/status),
theming/theme-generation, presets, workspaces, Cesium, and the operational-domain
features (symbology/milsymbol, entities, telemetry, charts).

## 2. Goals / Non-goals

**Goals**

- A clean, minimal Vue 3 + Vite + TypeScript project that boots to a full-screen
  MapLibre map with no API key required (OpenFreeMap default style).
- Carry over the proven tool-registry → drawings pipeline so map tools work day one.
- Carry over all the project's "rules" surfaces (agent rules, GitHub workflows,
  linting/formatting/testing/spell-check, commit conventions) adapted to MapForge.
- Be **monorepo-ready** so a future plugin lives as `packages/<plugin>` and installs
  into MapForge (and ultimately CommandVue) as a workspace package.
- A minimal **starter control overlay** with a few buttons that prove the ported tool
  chain works (activate measure / draw, clear, switch basemap).

**Non-goals (this scaffold)**

- Designing or building the actual plugin ("lp module") — explicitly a later discussion.
- Re-implementing any dropped system (Dockview, chrome, theming, presets, workspaces,
  Cesium, symbology, telemetry, charts).
- Rich tool UX beyond the starter buttons — that's the next iteration.
- A GitHub remote / CI runs — fresh local repo only, no remote yet.

## 3. Approach

**Approach A — Fresh minimal fork (chosen).** Copy the meta-infrastructure and the
proven foundations, then write a fresh, minimal app shell (`main.ts`, `App.vue`,
`MapView.vue`) that boots to the map. Rejected alternative (B): clone the whole repo
and delete/rewire the heavy systems — those systems are deeply coupled through
`main.ts`, `App.vue`, the storage seed, and cross-store references, producing a long
debugging tail for a sandbox that should start clean.

## 4. Project identity & location

- **Folder:** `D:\Work\UraanAI\Public\MapForge`
- **package.json `name`:** `mapforge`
- **Description:** "A MapLibre-first Vue 3 sandbox for building and testing map tools
  (drawing, measuring) and CommandVue plugins."
- **Git:** fresh `git init` on `main`, no remote. (Created already; this spec is the
  first commit.)
- **License/author:** Apache-2.0, Uraan AI (inherited from CommandVue).

## 5. Repository structure (target)

```
MapForge/
├── .agent/
│   ├── README.md                         # adapted
│   ├── rules/                            # adapted (see §10)
│   │   ├── project-and-stack.md
│   │   ├── ui-and-components.md
│   │   ├── architecture.md
│   │   ├── git-workflow.md
│   │   ├── verification.md
│   │   └── libraries-and-knowledge.md
│   └── workflows/{library-first.md, documentation-sync.md}   # kept (generic)
├── .github/
│   ├── workflows/{ci.yml, cspell.yml}    # kept (governance workflows dropped)
│   ├── dependabot.yml, labeler.yml, FUNDING.yml              # adapted
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── ISSUE_TEMPLATE/{bug_report.yml, feature_request.yml, config.yml}
├── dictionaries/{operations.txt, project.txt, tech.txt}      # kept (project.txt adapted)
├── docs/
│   ├── .vitepress/config.ts              # trimmed sidebar
│   ├── index.md                          # MapForge intro
│   ├── architecture.md                   # map/tools/plugin model
│   └── superpowers/specs/2026-06-09-mapforge-scaffold-design.md   # this file
├── packages/.gitkeep                     # reserved for the future plugin (lp module)
├── public/favicon.svg
├── src/
│   ├── assets/
│   │   ├── images/.gitkeep
│   │   └── styles/{main.css, tokens.css} # ported + trimmed (no dockview/theme imports)
│   ├── components/
│   │   ├── MapView.vue                    # FRESH — full-screen map + tool wiring
│   │   ├── MapControls.vue               # FRESH — starter control overlay
│   │   ├── common/LoadingSpinner.vue     # ported (optional)
│   │   └── ui/{Button.vue, IconButton.vue, Tooltip.vue, Select.vue,
│   │           Slider.vue, ContextMenu.vue, index.ts}   # ported subset
│   ├── composables/
│   │   ├── useMapLibre.ts                # ported verbatim
│   │   ├── useToolRegistry.ts            # ported verbatim
│   │   └── useDrawingLayer.ts            # FRESH — render drawings store → map source/layers
│   ├── modules/
│   │   ├── maplibre/{styles.ts, types.ts}                # ported verbatim
│   │   ├── tools/{index.ts, types.ts, draw-polygon.ts, measure-distance.ts}   # ported verbatim
│   │   └── geo/{coords.ts, h3.ts, measure.ts, types.ts}  # ported verbatim
│   ├── router/{index.ts, routes.ts}      # FRESH — minimal single route
│   ├── stores/{tools.ts, drawings.ts}    # ported verbatim
│   ├── views/MapHome.vue                 # FRESH — wraps MapView (route target)
│   ├── utils/{cn.ts, id.ts, format.ts, files.ts}         # ported verbatim
│   ├── App.vue                           # FRESH — mounts RouterView/MapView
│   └── main.ts                           # FRESH — minimal bootstrap
├── tests/                                # vitest setup + ported unit tests (see §11)
├── index.html                           # adapted (title, static theme, no cesium)
├── package.json                         # trimmed deps + scripts
├── pnpm-workspace.yaml                  # packages: ['.', 'packages/*']
├── vite.config.ts                       # Cesium block removed
├── vitest.config.ts, tsconfig*.json, eslint.config.ts,
│   .prettierrc, .prettierignore, commitlint.config.ts,
│   lint-staged.config.js, cspell.json, env.d.ts          # kept (trimmed where noted)
├── Dockerfile, docker-compose.yml, nginx.conf            # adapted (names)
├── CLAUDE.md                            # rewritten slim index
├── README.md, CHANGELOG.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, LICENSE
├── .husky/                              # kept (hooks)
└── .editorconfig, .gitattributes, .gitignore, .nvmrc, .npmrc, .dockerignore   # kept
```

## 6. Boot flow

1. `main.ts` — `createApp(App)`, install Pinia, the minimal router, PrimeVue (unstyled),
   provide `LUCIDE_CONTEXT` (the Lucide functional-component inject fix), and `mount`.
   **No** storage seed, theme bootstrap, chrome/panel/preset/theme registration,
   workspace load. The context-menu suppression from CommandVue's `main.ts` is kept
   (optional) so future custom map context menus aren't shadowed by the native menu.
2. `App.vue` — renders `<RouterView />` (single route → `MapHome`). No workspace/theme/
   layout/preset boot.
3. `MapHome.vue` → `<MapView />` full-screen.

## 7. Component / composable design

**`MapView.vue` (fresh)** — owns the map lifecycle and tool wiring. Lifts the proven
core from `MapLibrePanel.vue`, minus the panel/preset/dockview coupling:

```ts
const container = ref<HTMLDivElement | null>(null);
const { map, mount } = useMapLibre();
const drawings = useDrawingsStore();
useToolRegistry(map, { tools: TOOLS, onFinalize: (f) => drawings.add(f) });
useDrawingLayer(map, drawings);            // render finalized features
onMounted(() => container.value && mount(container.value));
```

Template: a full-screen container (`h-screen w-screen`) with `<MapControls />`
absolutely positioned as an overlay.

**`MapControls.vue` (fresh)** — the starter overlay. Buttons (via ported `IconButton` +
`Tooltip`): one toggle per tool in `TOOLS` (drives `useToolsStore.toggle(id)`, icon from
`tool.icon`), a "Clear drawings" button (`drawings.clear()`), a
basemap `Select` (switch among the OpenFreeMap styles in `modules/maplibre/styles.ts`
via `map.setStyle`), and an inline status line (active tool, drawing count). This panel
is intentionally small — it proves the chain works and is the seed for richer controls.

**`useDrawingLayer.ts` (fresh)** — the drawings store explicitly leaves rendering to the
consumer. This composable adds a GeoJSON source + fill/line/circle layers on map `load`,
and `watch`es `drawings.featureCollection` to `source.setData(...)` so finalized shapes
render. Cleans up on unmount.

## 8. Ported files (verbatim / near-verbatim)

All confirmed free of Cesium/Dockview/panel coupling during exploration:

- **Map core:** `composables/useMapLibre.ts`, `modules/maplibre/styles.ts`, `modules/maplibre/types.ts`
- **Tools:** `composables/useToolRegistry.ts`, `modules/tools/{index,types,draw-polygon,measure-distance}.ts`, `stores/tools.ts`
- **Drawings + geo:** `stores/drawings.ts`, `modules/geo/{coords,h3,measure,types}.ts`
- **UI primitives (subset):** `components/ui/{Button,IconButton,Tooltip,Select,Slider,ContextMenu}.vue` + a trimmed `components/ui/index.ts`
- **Utils:** `utils/{cn,id,format,files}.ts`
- **Styles:** `assets/styles/{main.css,tokens.css}` (trim `@import` of `dockview.css` and any theme/font-catalog imports; keep the static default token set)
- **Optional:** `components/common/LoadingSpinner.vue`

> On port, confirm each file's imports resolve within the kept set; anything that
> reaches into a dropped module is either trimmed or the file is reclassified as fresh.

## 9. Fresh-written files

`src/main.ts`, `src/App.vue`, `src/components/MapView.vue`, `src/components/MapControls.vue`,
`src/composables/useDrawingLayer.ts`, `src/router/{index,routes}.ts`, `src/views/MapHome.vue`,
and an adapted `index.html`.

## 10. Dropped (not copied)

- **Engines/systems:** `modules/cesium/`, `modules/chrome/`, `modules/panels/`,
  `modules/presets/`, `modules/themes/`, `modules/workspaces/`, `modules/symbology/`,
  `modules/realtime/`, `modules/shortcuts/`, `modules/storage/`.
- **Stores:** all except `tools`, `drawings` (drops chrome, connection, entities, layout,
  minimized, notification, panelState, preset, session, telemetry, theme, ui, workspace).
- **Composables:** `useCesium`, `useTheme`, `useThemeAuthoring`, `usePanelApi`,
  `usePanelState`, `usePopout*`, `usePopoutWindows`, `useConnectionNotifications`,
  `useWebSocketClient`, `useFontLoader`, `useKeyboardShortcuts`, `useOverlayTarget`,
  `useNotify` (toast chain — see note), `useConfirm` (deferred — see note).
- **Components:** `components/{chrome,dialogs,layout,panels,presets,showcase}/` (all),
  most of `components/common`.
- **Views:** `AboutView`, `DemoView`, `dev/`, original `HomeView`.
- **Assets:** `assets/styles/dockview.css`, `assets/themes/*.json` (6), `assets/fonts/*`.
- **Public:** `public/cesium/`, `public/popout.html`.
- **Scripts:** `copy-cesium-assets.mjs`, `demo-theme-generation.ts`,
  `build-google-catalog.mjs`, `dev-tunnel.mjs`, `check-single-source.mjs`.
- **Other:** `.internal/`, `directives/horizontalWheel.ts`, the `.verification-screenshots/`,
  `.playwright-mcp/`, `temp/`, `dist/`, `all-console-errors.log` artifacts.

**Toast/notification note:** the toast feedback system (`useNotify` + `notification`
store + a `NotificationOutlets` host + `ui/Toast.vue` + `ui/toastTheme.ts`) is a
self-contained chain. It is **deferred** for the scaffold (starter uses inline status +
on-map rendering). It can be ported wholesale later when richer feedback is wanted.
`useConfirm` (PrimeVue `ConfirmationService` + `ConfirmDialog`) is deferred for the same
reason — the starter "Clear drawings" action clears directly (sandbox geometry is cheap to
redo); re-add `useConfirm` + register `ConfirmationService` in `main.ts` when a destructive
action warrants it.

## 11. Dependency changes (package.json)

**Keep (runtime):** `vue`, `vue-router`, `pinia`, `@vueuse/core`; `maplibre-gl`;
`@turf/*` (those the geo module imports), `mgrs`, `h3-js`, `formatcoords`; `primevue`,
`@primevue/icons`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`,
`tailwindcss-primeui`; `@lucide/vue`; `floating-vue` (Tooltip); `nanoid` (id util);
`es-toolkit`; `dayjs` (if `format.ts` uses it); `browser-fs-access` (GeoJSON export in
`files.ts`); `idb` (only if a kept util imports it — else drop).

**Drop (runtime):** `cesium`, `dockview-vue`, `echarts`, `vue-echarts`, `milsymbol`,
`@orbat-mapper/convert-symbology`, `culori`, `markdown-it`, `@atlaskit/pragmatic-drag-and-drop(*)`,
`@tanstack/vue-table`, `@tanstack/vue-virtual` (re-add with `DataTable.vue` if/when a
table surface is needed — keep the rule generic), all `@fontsource/*` **except**
`@fontsource-variable/inter`, `@heroicons/vue` + `@iconify-prerendered/vue-mdi` (domain
icon packs — re-add if a ported primitive needs them), `fuzzysort` (search util dropped),
`ulid`, `zod` (unless a kept file imports it).

**Dev deps:** keep the quality/tooling set (eslint + plugins, prettier(+tailwind),
vitest, `@vue/test-utils`, vue-tsc, tailwind(+forms,+typography,+vite), cspell, husky,
commitlint(+types), lint-staged, `@types/*` for kept libs, vitepress, `@vitejs/plugin-vue`,
`npm-run-all2`, jiti, jsdom, fake-indexeddb). Drop: `mersenne-twister`,
`vite-plugin-static-copy`, `cloudflared`, `tsx` (only if no remaining `.ts` script needs
it; commitlint config is resolved by jiti), `@types/markdown-it`, `@types/culori`.

> Exact retained `@turf/*` set is whatever `modules/geo/*` imports — resolve at port time.

**Scripts (package.json):** drop `predev`/`predev:tunnel`/`prebuild` (Cesium asset copy),
`dev:tunnel`, `theme:demo`, `check:single-source`. Keep `dev`, `build`, `build-only`,
`preview`, `type-check`, `lint`, `format`, `format:check`, `test`, `test:watch`, `spell`,
`docs:*`, `prepare`, `docker:*`.

## 12. Config changes

- **`vite.config.ts`:** remove `define.CESIUM_BASE_URL`, remove `optimizeDeps.include:
  ["mersenne-twister"]` (and the Cesium comment block). Keep the `@` alias, the
  `.playwright-mcp`/`temp` watch ignores, port 5173, build target/sourcemap, the
  vue + tailwind plugins.
- **`index.html`:** title → MapForge; keep the anti-FOUC inline script but reduce it to
  apply a single static default `data-theme`; remove Cesium/telemetry references.
- **`env.d.ts`:** remove the `CESIUM_BASE_URL` ambient global if declared.
- **`.env.example`:** keep `VITE_APP_NAME` (→ MapForge) and the map center/zoom vars;
  drop `VITE_WS_URL` (telemetry). Add `VITE_MAPLIBRE_STYLE_URL` (optional self-hosted style).
- **tsconfig\*:** keep as-is (strict, ES2022, bundler resolution, `@` paths).

## 13. Meta-infrastructure adaptation

- **`.agent/rules/`:**
  - `project-and-stack.md` — rename to MapForge; trim the locked-stack table to the kept
    libraries; rewrite the "don't add" + brand notes; describe MapForge's purpose.
  - `architecture.md` — drop the Panel/Chrome/Preset/Workspace registry sections; add the
    MapForge model: map composable + tool registry + drawings/geo + (future) plugin module;
    keep the "viewers never in reactive state / shallowRef" and "composables own lifecycle"
    rules (still apply to MapLibre).
  - `ui-and-components.md` — keep library-first/PrimeVue-first rules and the generic
    component-mapping table; drop the TanStack/DataTable ADR section (note: add when a table
    is needed); keep icon + styling rules.
  - `git-workflow.md` — keep Conventional Commits + GitFlow conventions; note "no remote /
    branch protection yet" and adjust repo URLs; drop the `.internal/` + release-PR specifics
    until a remote exists (keep as reference).
  - `verification.md` — keep the two-stage protocol + vue-tsc cache gotcha; drop the
    Cesium-specific runtime-verification example, keep MapLibre relevance.
  - `libraries-and-knowledge.md` — keep Context7-first + documentation-sync; drop the Cesium
    and milsymbol gotchas; keep any MapLibre notes; update the memory section to MapForge.
- **`.agent/skills/`:** remove the five `commandvue-*` skills (they document dropped
  systems). MapForge-specific skills (e.g. `mapforge-map-tools`, `mapforge-plugin-development`)
  are authored later as those subsystems are built. Keep `.agent/workflows/{library-first,
  documentation-sync}.md` (generic).
- **`CLAUDE.md`:** rewrite as MapForge's slim `@import` index pointing at the adapted rules.
- **`.github/`:** keep `ci.yml` + `cspell.yml`; drop `datatable-governance.yml`,
  `ui-primitive-governance.yml`, `no-internal-on-main.yml`. Adapt `dependabot.yml`
  (target-branch, ecosystems), `labeler.yml`, issue/PR templates, `FUNDING.yml` (names/URLs).
- **`dictionaries/`:** keep; adapt `project.txt` (MapForge terms; drop CommandVue-only terms
  as cspell flags them).
- **`docs/`:** trimmed VitePress scaffold — `index.md`, `architecture.md`, trimmed
  `.vitepress/config.ts` sidebar. Drop CommandVue's `panels.md`, `tools.md`, `theming.md`,
  `decisions/*`, `audits/*`.
- **`.internal/`:** dropped.

## 14. The plugin ("lp module") — placeholder only

`pnpm-workspace.yaml` → `packages: ['.', 'packages/*']`; create `packages/.gitkeep`. No
plugin code now. The future plugin will be `packages/<name>` (its own `package.json`,
buildable/installable as a workspace dep, ultimately consumable by CommandVue). Its design
is a separate brainstorm/spec cycle.

## 15. Testing

- Keep the Vitest setup (config + any `tests/` setup file, `fake-indexeddb` if a kept path
  needs it).
- Port the unit tests that cover kept units only: `tools`, `drawings`, `geo`, `useMapLibre`,
  `useToolRegistry` (whatever exists under `tests/unit/` mirroring those paths).
- Drop all tests for dropped systems (panels, presets, chrome, workspaces, themes, cesium,
  symbology, telemetry).
- Add light tests for the fresh `useDrawingLayer` (source/layer add + `setData` on change).

## 16. Verification plan

Per the project's two-stage protocol (kept in `verification.md`):

**Stage 1 — automated (Playwright MCP):**
1. `pnpm install` succeeds.
2. `pnpm dev` → app boots; a full-screen MapLibre canvas is present (`[data-testid="map-..."]`),
   0 console errors at load.
3. Activate the measure tool → map click sequence produces a finalized feature; activate
   draw-polygon → produces a polygon; both render via `useDrawingLayer`.
4. "Clear drawings" empties the rendered layer; basemap `Select` switches styles without error.
5. `pnpm lint && pnpm type-check && pnpm test && pnpm spell && pnpm build` all green
   (run `type-check` cache-free per the vue-tsc gotcha).

**Stage 2 — human design review:** a short checkbox list (map fills viewport, control
overlay legible/positioned, tool affordances clear, drawings visually distinct) + "Ready
to merge".

## 17. Open questions / future work

- Whether to keep a minimal router or have `App.vue` render `MapView` directly (spec keeps a
  one-route router for extensibility; trivially collapsible).
- Whether the starter should persist drawings (IDB) — deferred; stores are in-memory now.
- Toast system port timing (deferred per §10).
- The plugin module architecture — separate spec.

## 18. Out of scope

The plugin's design/build; any dropped system; remote/CI setup; rich tooling UX beyond the
starter overlay.
