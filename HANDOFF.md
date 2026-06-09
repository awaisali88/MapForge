# MapForge — Session Handoff & Continuation Prompt

> **Purpose of this file:** carry the full context of the planning session into a
> fresh Claude Code session so it knows *what MapForge is, what was decided, the
> current state, and exactly what to do next.* This is a temporary planning artifact —
> delete it once scaffolding is complete.
>
> **Authoritative design lives in:**
> `docs/superpowers/specs/2026-06-09-mapforge-scaffold-design.md` — read that first.

---

## ▶ Paste-this kickoff prompt for the new session

```
Continue building MapForge — a new MapLibre-first Vue 3 sandbox being forked from
CommandVue (source: D:\Work\UraanAI\Public\CommandVue) into this folder
(D:\Work\UraanAI\Public\MapForge).

Read these first, in order:
  1. docs/superpowers/specs/2026-06-09-mapforge-scaffold-design.md  ← approved, authoritative design spec
  2. HANDOFF.md  ← full session history and context (this file)

The design is ALREADY APPROVED (Approach A: fresh minimal fork). Do NOT re-brainstorm.
The spec is the single source of truth for what to port / write fresh / drop.

Next step: use the `writing-plans` skill to turn the spec into a step-by-step
implementation plan, then execute it (executing-plans / subagent-driven-development)
to scaffold the project. If anything in the spec is ambiguous or you want to deviate,
ask before doing so.

End goal of the scaffold: `pnpm install && pnpm dev` boots straight to a full-screen
MapLibre map (OpenFreeMap, no API key) with a starter control overlay whose buttons
activate the measure / draw-polygon tools, render the drawn shapes, clear them, and
switch basemaps — then `pnpm lint && type-check && test && build` all green.
```

---

## 1. The original request (verbatim)

> I need to work on a new project, so basically what I need is: can you copy the complete
> code from this report to a new folder inside the parent directory? What I need to do is I
> don't need everything from this project, like the TacView or the theme generation or
> things like that.
>
> This new project will be a testing project for the map libra and tools that I need to
> build on the map libra library, like the drawings, and create a new lp module that will
> only be installable into this repo. That will be part of the later discussions. First I
> need to have this project, with all of its base structure, its rules, agent rules, github
> rules, and everything from this project, into a new project. Can you name that project
> properly as well and create a new folder in the parent directory and add every related
> file from this project into the directory? I just don't need the doc view or the tool bar
> status bar; I just need the map to be loaded on the main window. Then we will add some
> controls and add some buttons over there to build something on the map or test different
> plugins or things on the map.

**Transcription decoded** (request came via voice/remote):
- "map libra" / "map libra library" → **MapLibre GL** (the 2D map engine).
- "lp module" → **plugin module** — an installable package the project will produce ("later discussions").
- "doc view" → **Dockview** (the panel/window manager) — to be dropped.
- "tool bar status bar" → the **Chrome bars** (top bar + status bar) — to be dropped.
- "TacView" → interpreted as the **tactical / operational-domain features** (symbology/milsymbol,
  entities, telemetry, charts). There is no module literally named "TacView" in CommandVue.
- "this repo" (that the plugin installs into) → **CommandVue**, and by extension MapForge as the dev harness.

---

## 2. What MapForge is

A clean, **map-first Vue 3 sandbox** forked from the CommandVue template. It boots straight to
a **full-screen MapLibre GL map** and exists to:
1. Build & test **map tools** on MapLibre (drawing, measuring, future tools).
2. Develop a future **plugin module ("lp module")** that installs into CommandVue (and MapForge),
   living as a workspace package under `packages/`.

It keeps all of CommandVue's **meta-infrastructure** (agent rules, GitHub config, tooling, quality
gates) and the **proven MapLibre-native foundations**, and discards the heavy application systems.

---

## 3. Decisions locked in this session

**Clarifying answers (from the user):**
| Question | Answer |
| --- | --- |
| Project name | **MapForge** (folder `MapForge`, package `mapforge`) |
| 3D globe (Cesium) | **Drop — MapLibre only** |
| Map tooling to port | **Port tools + drawings + geo** (the Tool Registry, drawings store, @turf geo math) |
| Git / remote | **Fresh repo, no remote yet** |

**Approach:** **A — Fresh minimal fork** (copy meta-infra + proven foundations, write a fresh
minimal app shell). Rejected B (clone-everything-then-strip) — the dropped systems are too
coupled through `main.ts`/`App.vue`/the storage seed for a clean strip.

**Judgment calls baked into the spec (user may override):**
- **Toast + confirm-dialog chains deferred** (lean starter; feedback via inline status + on-map
  rendering). Both are self-contained and easy to port later.
- **Minimal one-route router kept** (vs. `App.vue` rendering `MapView` directly).
- **`@tanstack`/DataTable + domain icon packs (mdi/heroicons) dropped** until a table / those
  icons are actually needed.
- **Starter `MapControls` overlay included now** (doubles as proof the ported tool chain works).

---

## 4. Key findings from exploring CommandVue (why the plan is what it is)

- **MapLibre footprint is tiny & cleanly separable:** `composables/useMapLibre.ts` depends only on
  `maplibre-gl` + `modules/maplibre/styles.ts`. Default style is **OpenFreeMap Liberty** — no API
  key, loads out of the box.
- **The tool chain is MapLibre-native and decoupled** — this is the gold for the user's goal:
  - `useToolRegistry(mapRef, { tools: TOOLS, onFinalize })` watches `useToolsStore.activeId`, runs a
    tool's `setup(ctx)` / `cleanup()`. `ToolContext` wraps `map.dragPan` / `map.doubleClickZoom` and
    pipes finalized features to `onFinalize`.
  - `MapLibrePanel.vue` shows the exact wiring to lift:
    `useToolRegistry(map, { tools: TOOLS, onFinalize: (f) => drawings.add(f) })`.
  - `modules/tools/` ships `measure-distance` + `draw-polygon` (plain JS objects, not components).
  - `stores/{tools,drawings}` and `modules/geo/*` are clean (pinia + geojson + @turf/mgrs/h3 only).
- **The heavy stuff is deeply coupled in `main.ts` / `App.vue`:** Dockview panel registration, Chrome
  system, Themes (+ theme-studio/generation), Presets, Workspaces, the storage seed all boot
  together — hence the fresh-shell approach.
- **`drawings` store explicitly leaves rendering to the consumer** → that's why the plan adds a fresh
  `useDrawingLayer` composable to mirror `drawings.featureCollection` into a MapLibre GeoJSON source.
- **`pnpm-workspace.yaml` is already monorepo-ready** (`packages: ['.']` with a comment about
  `./packages/*`) → the future plugin slots in as `packages/<plugin>`.
- **Drops to remember:** `vite.config.ts` has a Cesium block (`define.CESIUM_BASE_URL`,
  `optimizeDeps.include: ["mersenne-twister"]`) to remove; `scripts/copy-cesium-assets.mjs` +
  the `predev`/`prebuild` hooks go; `public/cesium/` + `public/popout.html` go; `assets/styles/dockview.css`,
  the 6 `assets/themes/*.json`, and `assets/fonts/*` go.

---

## 5. Current state of the MapForge repo

- **Location:** `D:\Work\UraanAI\Public\MapForge`
- **Git:** fresh repo on branch `main`, **no remote**. User config inherited (Awais Ali).
- **Commits so far:**
  - `7ca222f docs: MapForge scaffold design spec` — the authoritative spec.
  - (this file is committed on top.)
- **What exists:** only `docs/superpowers/specs/2026-06-09-mapforge-scaffold-design.md` and this
  `HANDOFF.md`.
- **What does NOT exist yet:** no `package.json`, no `src/`, no copied files, no `node_modules`,
  no `.agent`/`.github`/configs. **All of that is the scaffolding job the spec describes.**

---

## 6. The authoritative spec (section map)

`docs/superpowers/specs/2026-06-09-mapforge-scaffold-design.md` contains:
- §1–4 Summary, goals/non-goals, approach, identity & location
- §5 **Target repo structure** (full tree — keep/fresh/drop annotated)
- §6 **Boot flow** (`main.ts` → `App.vue` → `MapHome` → `MapView`)
- §7 **Component/composable design** (`MapView`, `MapControls`, `useDrawingLayer`) with the tool-wiring snippet
- §8 **Ported files** (verbatim list)
- §9 **Fresh-written files**
- §10 **Dropped** list (incl. the deferred toast/confirm note)
- §11 **Dependency changes** (keep/drop tables) + script changes
- §12 **Config changes** (`vite.config.ts`, `index.html`, `env.d.ts`, `.env.example`, tsconfig)
- §13 **Meta-infra adaptation** (`.agent/rules`, skills, `.github`, `CLAUDE.md`, dictionaries, docs, `.internal`)
- §14 **The plugin ("lp module") placeholder** — `packages/*`, no code now
- §15 Testing · §16 **Verification plan** (2-stage) · §17 Open questions · §18 Out of scope

---

## 7. Next steps (in order)

1. **`writing-plans`** — turn the spec into a concrete, ordered implementation plan. Suggested phase
   shape:
   - **Phase 0 — Scaffold meta-infra:** copy & adapt configs, `.agent/rules`, `.github`, `CLAUDE.md`,
     `package.json` (trimmed deps/scripts), `pnpm-workspace.yaml`, tsconfigs, `vite.config.ts`
     (Cesium block removed), `index.html`, dictionaries, docs scaffold, `packages/.gitkeep`.
   - **Phase 1 — Port foundations:** `modules/{maplibre,tools,geo}`, `stores/{tools,drawings}`,
     `composables/{useMapLibre,useToolRegistry}`, UI-primitive subset, utils, token CSS (trimmed).
   - **Phase 2 — Fresh app shell:** `main.ts`, `App.vue`, `router`, `views/MapHome.vue`,
     `components/MapView.vue`, `components/MapControls.vue`, `composables/useDrawingLayer.ts`.
   - **Phase 3 — Tests + verification:** port unit tests for kept units, add `useDrawingLayer` test,
     run the static gauntlet + Stage-1 Playwright runtime check (boots to map; tools draw; shapes render).
2. **`pnpm install`** in MapForge, then iterate until `pnpm dev` boots the map cleanly.
3. **Execute** (executing-plans / subagent-driven-development), verifying per the spec's §16.
4. **Then (separate cycle):** brainstorm/spec the **plugin ("lp module")** under `packages/`.

---

## 8. Critical context the new session needs

- **Source repo to copy from:** `D:\Work\UraanAI\Public\CommandVue` (do not modify it — it's a
  separate, git-protected project on its own `develop` branch).
- **The new session may not auto-load CommandVue's `CLAUDE.md`** (different cwd). Until MapForge's own
  adapted `.agent/rules/*` exist (created in Phase 0), follow the source rules from CommandVue. The
  ones that matter most here:
  - **Context7-first:** before integrating/bumping/debugging any library (MapLibre, PrimeVue, Vite,
    Vue, @turf, etc.), fetch current docs via Context7 MCP — don't rely on training data.
  - **vue-tsc cache gotcha:** `pnpm type-check` can report a stale clean pass. Before claiming green,
    run cache-free: delete `*.tsbuildinfo` then `pnpm type-check` (or trust CI).
  - **Library-first / PrimeVue-first:** use PrimeVue (unstyled) + the `ui/*` wrappers for UI surfaces;
    no raw `<button>/<input>/<select>/<textarea>`. `@tanstack/vue-table` is the table exception (only
    when a table is needed).
  - **Two-stage verification:** Stage 1 automated (Playwright MCP, binary pass/fail) before any PR;
    Stage 2 human design checklist.
  - **Conventional Commits + GitFlow** conventions are carried over (no remote/branch-protection yet —
    fresh `main` only for now). End commit messages with the `Co-Authored-By: Claude ...` line.
- **The tool pattern to preserve (don't re-architect):** tools are plain objects with
  `setup(ctx) → { cleanup() }`; `useToolRegistry` owns activation; the host wires `onFinalize` to
  `drawings.add`; rendering of finalized features is the consumer's job (`useDrawingLayer`).
- **MapLibre map instances live in `shallowRef`/plain refs, never reactive state** (same rule as
  Cesium) — reactivity proxies break the engine internals.

---

## 9. Things to confirm with the user (if relevant during execution)

- Keep the deferred toast/confirm decision, or port them in now?
- Keep the minimal router, or collapse to `App.vue` → `MapView` directly?
- Any preferred starter basemap / default map center & zoom (spec defaults to OpenFreeMap Liberty,
  center `[70, 30]`, zoom `4` — inherited from CommandVue's `useMapLibre`).
- Naming for the future plugin package under `packages/` (deferred — separate discussion).
