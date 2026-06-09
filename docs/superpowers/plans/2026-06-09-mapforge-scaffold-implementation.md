# MapForge Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold MapForge — a MapLibre-first Vue 3 sandbox forked from CommandVue — so that `pnpm install && pnpm dev` boots to a full-screen MapLibre map (OpenFreeMap, no API key) with a starter control overlay that activates the measure / draw-polygon tools, renders drawn shapes, clears them, and switches basemaps; then `pnpm lint && type-check && test && spell && build` all pass.

**Architecture:** Fresh minimal fork (spec Approach A). Copy CommandVue's proven MapLibre-native foundations (map composable, tool registry, drawings/geo modules, a UI-primitive subset, utils, token CSS) and all meta-infrastructure (agent rules, GitHub config, quality tooling), adapted from `CommandVue` → `MapForge`. Write a fresh, minimal app shell (`main.ts`, `App.vue`, one-route router, `MapView.vue`, `MapControls.vue`, `useDrawingLayer.ts`). Drop every heavy application system (Dockview, chrome bars, theming/presets/workspaces, Cesium, symbology, telemetry, charts, DataTable).

**Tech Stack:** Vue 3 + Vite 8 + TypeScript (strict) · Pinia · Vue Router · MapLibre GL · PrimeVue (unstyled) + Tailwind v4 · `@turf/*` + `mgrs` + `h3-js` · `@lucide/vue` · `floating-vue` · Vitest + `@vue/test-utils` · ESLint flat config + Prettier + CSpell + commitlint + husky + lint-staged · VitePress.

**Source of truth:** `docs/superpowers/specs/2026-06-09-mapforge-scaffold-design.md`.
**Copy-from root (read-only, never modify):** `D:\Work\UraanAI\Public\CommandVue` (referred to below as `$SRC`). MapForge root is `D:\Work\UraanAI\Public\MapForge` (`$DST`).

---

## Deviations from the spec (review these first)

All are within the spec's stated intent (§8 port-time caveat, §11 "keep what's imported"); flagged for transparency. None require new design work.

1. **`Tooltip.vue`, `Select.vue`, `ContextMenu.vue` are ported-with-trim, not verbatim.** Each imports dropped composables (`@/composables/useOverlayTarget`, `@/composables/usePopoutOverlayDismiss` — Dockview pop-out-window support). Per spec §8 ("anything that reaches into a dropped module is trimmed"), the pop-out/`append-to`/overlay-container logic is removed; the public API, `pt` theme, and slots are preserved. Trimmed source is inlined in Task 2.6.
2. **Dependency ledger refined to actual imports** (spec §11 "exact retained set… resolve at port time"). Dropped because no kept file imports them: `browser-fs-access` (`utils/files.ts` is a DOM-only stub), `idb`, `formatcoords` (`geo/coords.ts` hand-rolls formatting; uses `mgrs` for MGRS). Kept though not yet imported (spec-named platform libs): `class-variance-authority`, `es-toolkit`, `@vueuse/core`. `@turf/*` reduced to the 7 the geo module imports (drop `bbox`, `destination`, `great-circle`). `fake-indexeddb` dropped (no kept test uses it). `dayjs` kept (`utils/format.ts` uses it).
3. **`@fontsource-variable/inter` is imported in `main.ts`** (as CommandVue does), so `main.css` simply drops its `@import "../fonts/local-fonts.css"` line with no replacement.
4. **Tool source/layer namespace `commandvue:` → `mapforge:`** in `draw-polygon.ts` / `measure-distance.ts` (cosmetic internal ids; consistent with the project-wide rename).
5. **Default theme = `data-theme="dark"`**, applied statically (reduced anti-FOUC script per spec §12). Best for a map sandbox; tool labels use dark halos.
6. **`useDrawingLayer` re-adds its source/layers on `styledata`** (not only `load`) so the basemap `Select` (which calls `map.setStyle`, wiping sources) keeps drawings visible. Within spec §7's intent.
7. **`.internal/` regime and all 5 `commandvue-*` agent skills dropped** (spec §13); the `no-internal-on-main`, `datatable-governance`, `ui-primitive-governance` workflows and `labeler.yml` are dropped; `ci.yml` loses its `check:single-source` step (script dropped).
8. **No git remote yet** (spec §4). The plan commits to a local `feat/scaffold` branch and merges to `main` locally at the end; GitHub workflows are kept but dormant until a remote exists.

---

## File structure (what gets created)

```
MapForge/
├── .agent/{README.md, rules/×6, workflows/{library-first,documentation-sync}.md}   # adapted
├── .github/{workflows/{ci,cspell}.yml, dependabot.yml, FUNDING.yml, PULL_REQUEST_TEMPLATE.md, ISSUE_TEMPLATE/×3}
├── .husky/{pre-commit, commit-msg}
├── dictionaries/{operations,project,tech}.txt
├── docs/{.vitepress/config.ts, index.md, architecture.md, superpowers/{specs,plans}/…}
├── packages/.gitkeep
├── public/favicon.svg
├── src/
│   ├── assets/{images/.gitkeep, styles/{main,tokens}.css}
│   ├── components/
│   │   ├── MapView.vue, MapControls.vue                          # FRESH
│   │   ├── common/LoadingSpinner.vue                            # ported
│   │   └── ui/{Button,IconButton,Tooltip*,Select*,Slider,ContextMenu*}.vue, index.ts   # *=trimmed
│   ├── composables/{useMapLibre.ts, useToolRegistry.ts, useDrawingLayer.ts}   # last is FRESH
│   ├── modules/{maplibre/{styles,types}.ts, tools/{index,types,draw-polygon,measure-distance}.ts, geo/{coords,h3,measure,types}.ts}
│   ├── router/{index,routes}.ts                                 # FRESH
│   ├── stores/{tools,drawings}.ts
│   ├── views/MapHome.vue                                        # FRESH
│   ├── utils/{cn,id,format,files}.ts
│   ├── App.vue, main.ts                                         # FRESH
├── tests/{setup.ts, unit/{geo-coords,geo-measure,maplibre-styles,tools-measure-distance,tools-store,useDrawingLayer}.spec.ts}
├── index.html, env.d.ts                                         # adapted
├── package.json, pnpm-workspace.yaml                           # fresh/trimmed
├── vite.config.ts, vitest.config.ts, tsconfig{,.app,.node,.vitest}.json
├── eslint.config.ts, .prettierrc, .prettierignore, commitlint.config.ts, lint-staged.config.js, cspell.json
├── Dockerfile, docker-compose.yml, nginx.conf, .dockerignore
├── .editorconfig, .gitattributes, .gitignore, .nvmrc
├── CLAUDE.md, README.md, CHANGELOG.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, LICENSE
```

**Dropped (NOT created), for reference:** `.npmrc` (Cesium-only hoist), `.agent/skills/`, `.github/workflows/{datatable-governance,no-internal-on-main,ui-primitive-governance}.yml`, `.github/labeler.yml`, `src/volt/`, `src/assets/fonts/`, `src/assets/styles/dockview.css`, all dropped modules/stores/composables/components per spec §10, `scripts/`.

**Verbatim-port note:** "Copy `$SRC\<path>` → `$DST\<path>`" means read the source file and write it byte-identical (PowerShell: `Copy-Item`). After copying, the task's verify step confirms it resolves. Files needing edits show the exact final content or the exact edit.

---

## Phase 0 — Tooling, configs & meta-infrastructure

Goal: `pnpm install` succeeds and the quality tooling is in place. No app code yet.

### Task 0.0: Scaffold branch

**Files:** none (git).

- [ ] **Step 1: Branch off main**

Run:
```powershell
git -C D:\Work\UraanAI\Public\MapForge checkout -b feat/scaffold
git -C D:\Work\UraanAI\Public\MapForge branch --show-current
```
Expected: prints `feat/scaffold`.

---

### Task 0.1: package.json, workspace, node version

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `packages/.gitkeep`, `src/assets/images/.gitkeep`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "mapforge",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "A MapLibre-first Vue 3 sandbox for building and testing map tools (drawing, measuring) and CommandVue plugins.",
  "keywords": [
    "vue",
    "vue3",
    "maplibre",
    "map",
    "geospatial",
    "drawing",
    "measure",
    "map-tools",
    "sandbox",
    "typescript"
  ],
  "license": "Apache-2.0",
  "author": "Uraan AI <hello@uraanai.com>",
  "homepage": "https://github.com/uraanai/MapForge#readme",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/uraanai/MapForge.git"
  },
  "bugs": {
    "url": "https://github.com/uraanai/MapForge/issues"
  },
  "engines": {
    "node": ">=22.12.0"
  },
  "packageManager": "pnpm@10.15.0",
  "scripts": {
    "dev": "vite",
    "build": "run-p type-check \"build-only {@}\" --",
    "build-only": "vite build",
    "preview": "vite preview",
    "type-check": "vue-tsc --build",
    "lint": "eslint . --fix --cache",
    "format": "prettier --write src/",
    "format:check": "prettier --check src/",
    "test": "vitest run",
    "test:watch": "vitest",
    "spell": "cspell \"**/*.{ts,vue,md,json}\" --no-progress",
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:preview": "vitepress preview docs",
    "prepare": "husky",
    "docker:build": "docker build -t mapforge:local .",
    "docker:up": "docker compose up --build",
    "docker:down": "docker compose down"
  },
  "dependencies": {
    "@fontsource-variable/inter": "^5.1.0",
    "@lucide/vue": "^1.17.0",
    "@primevue/icons": "^4.5.5",
    "@turf/area": "^7.0.0",
    "@turf/bearing": "^7.0.0",
    "@turf/centroid": "^7.0.0",
    "@turf/distance": "^7.0.0",
    "@turf/helpers": "^7.0.0",
    "@turf/length": "^7.0.0",
    "@turf/midpoint": "^7.0.0",
    "@vueuse/core": "^14.3.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "dayjs": "^1.11.21",
    "es-toolkit": "^1.47.0",
    "floating-vue": "^5.2.2",
    "h3-js": "^4.1.0",
    "maplibre-gl": "^5.0.0",
    "mgrs": "^2.1.0",
    "nanoid": "^5.0.9",
    "pinia": "^3.0.4",
    "primevue": "^4.2.5",
    "tailwind-merge": "^3.6.0",
    "tw-animate-css": "^1.0.0",
    "vue": "^3.5.35",
    "vue-router": "^5.1.0"
  },
  "devDependencies": {
    "@commitlint/cli": "^21.0.2",
    "@commitlint/config-conventional": "^21.0.2",
    "@commitlint/types": "^21.0.1",
    "@tailwindcss/forms": "^0.5.10",
    "@tailwindcss/typography": "^0.5.16",
    "@tailwindcss/vite": "^4.0.0",
    "@tsconfig/node22": "^22.0.0",
    "@types/geojson": "^7946.0.14",
    "@types/jsdom": "^28.0.3",
    "@types/node": "^25.9.2",
    "@vitejs/plugin-vue": "^6.0.7",
    "@vue/eslint-config-prettier": "^10.2.0",
    "@vue/eslint-config-typescript": "^14.8.0",
    "@vue/test-utils": "^2.4.11",
    "@vue/tsconfig": "^0.9.1",
    "cspell": "^10.0.1",
    "eslint": "^10.4.1",
    "eslint-plugin-perfectionist": "^5.9.0",
    "eslint-plugin-vue": "^10.9.2",
    "husky": "^9.1.7",
    "jiti": "^2.4.2",
    "jsdom": "^29.1.1",
    "lint-staged": "^17.0.7",
    "npm-run-all2": "^9.0.1",
    "prettier": "^3.4.2",
    "prettier-plugin-tailwindcss": "^0.8.0",
    "tailwindcss": "^4.0.0",
    "tailwindcss-primeui": "^0.6.1",
    "typescript": "~6.0.3",
    "vite": "^8.0.16",
    "vitepress": "^1.6.4",
    "vitest": "^4.1.8",
    "vue-tsc": "^3.3.4"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild"]
  }
}
```

- [ ] **Step 2: Write `pnpm-workspace.yaml`** (monorepo-ready per spec §14)

```yaml
packages:
  - '.'
  - 'packages/*'
```

- [ ] **Step 3: Write `.nvmrc`**

```
22
```

- [ ] **Step 4: Create placeholder dirs**

Create `packages/.gitkeep` and `src/assets/images/.gitkeep` (empty files).

---

### Task 0.2: TypeScript project configs

**Files:** Create `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.vitest.json` (all verbatim from `$SRC`).

- [ ] **Step 1: Copy all four verbatim**

```powershell
$s='D:\Work\UraanAI\Public\CommandVue'; $d='D:\Work\UraanAI\Public\MapForge'
Copy-Item "$s\tsconfig.json" "$d\tsconfig.json"
Copy-Item "$s\tsconfig.app.json" "$d\tsconfig.app.json"
Copy-Item "$s\tsconfig.node.json" "$d\tsconfig.node.json"
Copy-Item "$s\tsconfig.vitest.json" "$d\tsconfig.vitest.json"
```
These are stack-generic (strict, ES2022, Bundler resolution, `@/*` → `./src/*`). No edits needed.

- [ ] **Step 2: Verify** the four files exist and `tsconfig.json` references node/app/vitest.

---

### Task 0.3: Vite, Vitest, env types

**Files:** Create `vite.config.ts` (trimmed), `vitest.config.ts` (verbatim), `env.d.ts` (adapted).

- [ ] **Step 1: Write `vite.config.ts`** (Cesium `define` + `optimizeDeps` + JSDoc removed)

```ts
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

/**
 * Base Vite configuration for MapForge.
 *
 * Minimal by design: the Vue + Tailwind v4 plugins, the `@` → `src` alias,
 * a fixed dev port, and the Playwright/temp watch ignores. No Cesium asset
 * wiring (MapForge is MapLibre-only).
 */
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    watch: {
      // Playwright MCP writes per-interaction snapshots into `.playwright-mcp/`.
      // Without this exclusion they trigger an infinite HMR reload loop.
      ignored: ["**/.playwright-mcp/**", "**/temp/**"],
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
```

- [ ] **Step 2: Copy `vitest.config.ts` verbatim** from `$SRC` (it `mergeConfig`s vite.config, jsdom env, `setupFiles: ["./tests/setup.ts"]`).

```powershell
Copy-Item "D:\Work\UraanAI\Public\CommandVue\vitest.config.ts" "D:\Work\UraanAI\Public\MapForge\vitest.config.ts"
```

- [ ] **Step 3: Write `env.d.ts`** (drop `VITE_WS_URL`, add `VITE_MAPLIBRE_STYLE_URL`; semicolons per Prettier)

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_DEFAULT_MAP_CENTER_LAT?: string;
  readonly VITE_DEFAULT_MAP_CENTER_LON?: string;
  readonly VITE_DEFAULT_MAP_ZOOM?: string;
  readonly VITE_MAPLIBRE_STYLE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

### Task 0.4: Lint / format / commit tooling

**Files:** Create `eslint.config.ts` (trimmed), `.prettierrc` (verbatim), `.prettierignore` (trimmed), `commitlint.config.ts` (renamed), `lint-staged.config.js` (verbatim).

- [ ] **Step 1: Write `eslint.config.ts`** (renamed to `mapforge/*`; Volt + DataTable + cesium ignores removed; generic `primevue/*` consumer restriction + raw-HTML restriction kept)

```ts
import skipFormatting from "@vue/eslint-config-prettier/skip-formatting";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import perfectionist from "eslint-plugin-perfectionist";
import pluginVue from "eslint-plugin-vue";

/**
 * Flat ESLint config for MapForge.
 *
 * Composition:
 *   - eslint-plugin-vue (flat/recommended)
 *   - @vue/eslint-config-typescript (recommended, no type-aware rules — fast)
 *   - eslint-plugin-perfectionist (import sorting only)
 *   - @vue/eslint-config-prettier/skip-formatting (defer formatting to Prettier)
 *
 * Custom rules:
 *   - no-explicit-any is an error
 *   - consistent-type-imports + verbatimModuleSyntax expects `import type`
 *   - vue/multi-word-component-names is off (App.vue and view names allowed)
 *   - no-console warns except for warn / error
 *   - PrimeVue components are imported only inside src/components/ui/** ;
 *     consumers use the ui/* wrappers (PrimeVue-first rule)
 *   - raw <button>/<input>/<select>/<textarea> restricted outside ui/**
 */
export default defineConfigWithVueTs(
  {
    name: "mapforge/ignores",
    ignores: [
      "**/dist/**",
      "**/dist-ssr/**",
      "**/coverage/**",
      "**/.vite/**",
      "**/node_modules/**",
      "pnpm-lock.yaml",
      "dictionaries/**",
      ".husky/_/**",
      "eslint.config.ts",
      // VitePress config is standalone (loaded by the `vitepress` CLI via its
      // own bundler); not part of the app's project-references graph.
      "docs/.vitepress/**",
    ],
  },
  {
    name: "mapforge/files",
    files: ["**/*.{ts,mts,tsx,vue}"],
  },
  pluginVue.configs["flat/recommended"],
  vueTsConfigs.recommended,
  skipFormatting,
  {
    name: "mapforge/rules",
    plugins: {
      perfectionist,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "vue/multi-word-component-names": "off",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Restrict direct PrimeVue *component* imports from consumer code. The
      // negation entries carve out non-component helper modules (types, the
      // bootstrap config/api singletons). Consumers use the ui/* wrappers.
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["primevue/*", "!primevue/menuitem", "!primevue/config", "!primevue/api"],
              message:
                "Direct primevue/* component imports are restricted to UI primitive files (src/components/ui/**). Consumer code should import the project wrapper instead.",
              allowTypeImports: true,
            },
          ],
        },
      ],
      "vue/no-restricted-html-elements": [
        "warn",
        {
          element: ["button", "input", "select", "textarea"],
          message:
            "Raw HTML interactive elements are restricted. Use the UI primitive wrappers in src/components/ui/* (Button, IconButton, Select).",
        },
      ],
      "perfectionist/sort-imports": [
        "error",
        {
          type: "natural",
          order: "asc",
          newlinesBetween: 1,
          groups: [
            "type",
            ["builtin", "external"],
            "type-internal",
            "internal",
            ["type-parent", "type-sibling", "type-index"],
            ["parent", "sibling", "index"],
            "unknown",
          ],
        },
      ],
    },
  },
  {
    name: "mapforge/declarations",
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // UI primitive layer — these files are the wrappers themselves, so raw
    // HTML interactive elements and direct primevue/* imports are expected.
    // The restrictions above apply to *consumers* of these primitives.
    name: "mapforge/ui-primitives",
    files: ["src/components/ui/**/*.{ts,vue}"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": "off",
      "vue/no-restricted-html-elements": "off",
    },
  },
);
```

- [ ] **Step 2: Copy `.prettierrc` verbatim** from `$SRC`.

```powershell
Copy-Item "D:\Work\UraanAI\Public\CommandVue\.prettierrc" "D:\Work\UraanAI\Public\MapForge\.prettierrc"
```

- [ ] **Step 3: Write `.prettierignore`** (CommandVue's minus the `public/cesium/` line)

```
node_modules/
dist/
pnpm-lock.yaml
CHANGELOG.md
LICENSE
CODE_OF_CONDUCT.md
dictionaries/*.txt
coverage/
.vite/
```

- [ ] **Step 4: Write `commitlint.config.ts`** (CommandVue verbatim with the header comment renamed)

```ts
import type { UserConfig } from "@commitlint/types";

/**
 * Conventional Commits enforcement for MapForge.
 *
 * The allowed `type-enum` mirrors the list documented in `CONTRIBUTING.md`.
 * Header length is bumped to 100 to match Prettier's `printWidth`.
 */
const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 100],
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "chore", "docs", "refactor", "test", "build", "ci", "perf", "style", "revert"],
    ],
    "body-max-line-length": [1, "always", 120],
  },
};

export default config;
```

- [ ] **Step 5: Copy `lint-staged.config.js` verbatim** from `$SRC`.

```powershell
Copy-Item "D:\Work\UraanAI\Public\CommandVue\lint-staged.config.js" "D:\Work\UraanAI\Public\MapForge\lint-staged.config.js"
```

---

### Task 0.5: Spell-check config + dictionaries

**Files:** Create `cspell.json` (trimmed), `dictionaries/operations.txt` (verbatim), `dictionaries/tech.txt` (verbatim), `dictionaries/project.txt` (adapted).

- [ ] **Step 1: Write `cspell.json`** (drop `public/cesium/**`, `.internal/**`, `src/assets/fonts/google-catalog.json` ignore paths)

```json
{
  "$schema": "https://raw.githubusercontent.com/streetsidesoftware/cspell/main/cspell.schema.json",
  "version": "0.2",
  "language": "en",
  "useGitignore": true,
  "dictionaryDefinitions": [
    { "name": "operations", "path": "./dictionaries/operations.txt", "addWords": true },
    { "name": "project", "path": "./dictionaries/project.txt", "addWords": true },
    { "name": "tech", "path": "./dictionaries/tech.txt", "addWords": true }
  ],
  "dictionaries": [
    "operations",
    "project",
    "tech",
    "en_US",
    "softwareTerms",
    "typescript",
    "node",
    "html",
    "css",
    "filetypes"
  ],
  "ignorePaths": [
    "node_modules/**",
    "dist/**",
    "dist-ssr/**",
    ".vite/**",
    "pnpm-lock.yaml",
    ".git/**",
    "coverage/**",
    "*.svg",
    "LICENSE",
    "CHANGELOG.md"
  ],
  "ignoreRegExpList": ["/[A-Za-z0-9+/=]{40,}/", "/0x[0-9a-fA-F]+/", "/[A-Z][A-Z0-9*-]{5,}/"],
  "words": []
}
```

- [ ] **Step 2: Copy `operations.txt` and `tech.txt` verbatim** (unused terms are harmless to CSpell; keeps coverage broad so ported docs don't trip).

```powershell
$s='D:\Work\UraanAI\Public\CommandVue\dictionaries'; $d='D:\Work\UraanAI\Public\MapForge\dictionaries'
Copy-Item "$s\operations.txt" "$d\operations.txt"
Copy-Item "$s\tech.txt" "$d\tech.txt"
```

- [ ] **Step 3: Write `dictionaries/project.txt`** (CommandVue's list, keeping `commandvue`/`CommandVue` since MapForge docs reference the parent project, plus MapForge terms)

```
# Project-specific words for MapForge.

mapforge
MapForge
commandvue
CommandVue
basemap
basemaps
geospatial
lonlat
customizer
titlebox
dockpanel
floatpanel
menubar
statusbar
uraanai
Uraan
awaisali
dockview
Dockview
maplibre
MapLibre
primevue
PrimeVue
vueuse
VueUse
pinia
Pinia
milsymbol
orbat
cesiumjs
CesiumJS
fontsource
Fontsource
heroicons
Heroicons
iconify
Iconify
lucide
Lucide
openfreemap
OpenFreeMap
serializability
repoints
repointed
spawnable
Repoint
retheme
touchpoints
handrolled
affordances
WCAG
Volted
Vuetify
firstrule
browsable
headerless
Headerless
headered
groupview
popout
lato
merriweather
menlo
montserrat
```

---

### Task 0.6: Editor / git / docker meta-files

**Files:** Create `.editorconfig` (verbatim), `.gitattributes` (verbatim), `.dockerignore` (verbatim), `.gitignore` (adapted), `.husky/pre-commit`, `.husky/commit-msg`, `Dockerfile`, `docker-compose.yml`, `nginx.conf` (renamed).

- [ ] **Step 1: Copy verbatim** `.editorconfig`, `.gitattributes`, `.dockerignore`.

```powershell
$s='D:\Work\UraanAI\Public\CommandVue'; $d='D:\Work\UraanAI\Public\MapForge'
Copy-Item "$s\.editorconfig" "$d\.editorconfig"
Copy-Item "$s\.gitattributes" "$d\.gitattributes"
Copy-Item "$s\.dockerignore" "$d\.dockerignore"
```

- [ ] **Step 2: Write `.gitignore`** (CommandVue's, minus the `public/cesium/` block and the `.internal/` un-ignore block; project header renamed)

```
# =============================================================================
# Node.js — based on https://github.com/github/gitignore/blob/main/Node.gitignore
# =============================================================================
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
lerna-debug.log*
.pnpm-debug.log*
report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json
pids
*.pid
*.seed
*.pid.lock
lib-cov
coverage
*.lcov
.nyc_output
.grunt
bower_components
.lock-wscript
build/Release
node_modules/
jspm_packages/
*.tsbuildinfo
.npm
.eslintcache
.stylelintcache
.node_repl_history
*.tgz
.yarn-integrity

# dotenv — `.env.example` is committed; everything else is ignored.
.env
.env.*
!.env.example

.cache
.parcel-cache
.next
out
.nuxt
.output
.vuepress/dist
.temp
.docusaurus
.serverless/
.fusebox/
.dynamodb/
.firebase/
.tern-port
.pnpm-store
.pnp.*
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions

# =============================================================================
# Vite
# =============================================================================
dist/
dist-ssr/
.vite/
*.local
vite.config.js.timestamp-*
vite.config.ts.timestamp-*

# =============================================================================
# IDE / editor
# =============================================================================
.idea/
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
.vscode-test
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# =============================================================================
# OS
# =============================================================================
.DS_Store
Thumbs.db
desktop.ini

# =============================================================================
# MapForge project-specific
# =============================================================================

# Husky internals (hooks themselves are committed; only the runtime cache is ignored)
.husky/_

# VitePress runtime + build output (the .vitepress/config.ts itself IS committed)
docs/.vitepress/cache/
docs/.vitepress/dist/

# Playwright MCP writes per-interaction snapshots + console logs here
.playwright-mcp/

# Verification-protocol screenshots — Stage 1 captures from Playwright runs.
.verification-screenshots/

# Scratch / temp dirs used during agent sessions
temp/

# Claude Code session-local runtime
.claude/scheduled_tasks.lock
.claude/settings.local.json
```

- [ ] **Step 3: Create husky hooks** (husky v9 single-line).

`.husky/pre-commit`:
```sh
pnpm exec lint-staged
```
`.husky/commit-msg`:
```sh
pnpm exec commitlint --edit "$1"
```

- [ ] **Step 4: Write `Dockerfile`** (CommandVue's, `commandvue`→`mapforge`)

Copy `$SRC\Dockerfile` → `$DST\Dockerfile`, then replace every `commandvue` with `mapforge` and `CommandVue` with `MapForge` (image tag `mapforge:local`, the header banner, the two run/build comment lines). No structural change.

- [ ] **Step 5: Write `docker-compose.yml`** (CommandVue's, renamed)

Copy `$SRC\docker-compose.yml` → `$DST\docker-compose.yml`, then replace `commandvue`→`mapforge` / `CommandVue`→`MapForge` throughout (`image: mapforge:local`, `container_name: mapforge-frontend`, banner + the commented backend stub references).

- [ ] **Step 6: Write `nginx.conf`** (CommandVue's, renamed, Cesium block removed)

Copy `$SRC\nginx.conf` → `$DST\nginx.conf`, then: (a) replace `CommandVue`→`MapForge` in the banner, (b) **delete the entire `location /cesium/ { … }` block** (the "Cesium runtime assets are likewise immutable per version." block). Leave everything else.

---

### Task 0.7: GitHub config

**Files:** Create `.github/workflows/ci.yml` (trimmed), `.github/workflows/cspell.yml` (verbatim), `.github/dependabot.yml` (trimmed groups), `.github/FUNDING.yml` (verbatim), `.github/PULL_REQUEST_TEMPLATE.md` (trimmed), `.github/ISSUE_TEMPLATE/{bug_report,config,feature_request}.yml` (renamed). **Do NOT create** `labeler.yml` or the three governance workflows.

- [ ] **Step 1: Write `.github/workflows/ci.yml`** (CommandVue's minus the "Single-source guard" step)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    name: Lint · Type-check · Test · Build
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      - name: Install pnpm
        uses: pnpm/action-setup@v6

      - name: Setup Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Type-check
        run: pnpm type-check

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
```

- [ ] **Step 2: Copy `.github/workflows/cspell.yml` verbatim** from `$SRC`.

- [ ] **Step 3: Write `.github/dependabot.yml`** (drop the `cesium` and `tanstack` groups; keep `maplibre`, `turf`, others)

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    # Dependency updates flow through `develop`, then ride the release branch
    # into `main` (see CLAUDE.md → Git & workflow). Dependabot reads THIS file
    # only from the default branch, so the setting takes effect once on `main`.
    target-branch: "develop"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "UTC"
    open-pull-requests-limit: 10
    commit-message:
      prefix: "chore"
      include: "scope"
    labels:
      - "dependencies"
    groups:
      vue:
        patterns:
          - "vue"
          - "vue-*"
          - "@vue/*"
          - "@vitejs/plugin-vue"
        update-types:
          - "minor"
          - "patch"
      vite:
        patterns:
          - "vite"
          - "vite-plugin-*"
          - "@vitejs/*"
      maplibre:
        patterns:
          - "maplibre-*"
      turf:
        patterns:
          - "@turf/*"
      eslint:
        patterns:
          - "eslint"
          - "eslint-*"
          - "@vue/eslint-config-*"
        update-types:
          - "minor"
          - "patch"
      commitlint:
        patterns:
          - "@commitlint/*"
      types:
        patterns:
          - "@types/*"

  - package-ecosystem: "github-actions"
    directory: "/"
    target-branch: "develop"
    schedule:
      interval: "weekly"
      day: "monday"
    commit-message:
      prefix: "ci"
    labels:
      - "dependencies"
      - "github-actions"
```

- [ ] **Step 4: Copy `.github/FUNDING.yml` verbatim** from `$SRC` (fully commented; org handles unchanged).

- [ ] **Step 5: Write `.github/PULL_REQUEST_TEMPLATE.md`** (CommandVue's minus the prompt/phase + governance-flags blocks that reference dropped subsystems)

```markdown
## Summary

<!-- One paragraph: what changes, why now. -->

## Target branch

- [ ] This PR targets `develop` (default for feature work)
- [ ] This PR targets `main` (release PR only — squash-merge from develop)

## Type of change

- [ ] `feat` — new feature or capability
- [ ] `fix` — bug fix
- [ ] `docs` — documentation only
- [ ] `refactor` — code change that neither fixes a bug nor adds a feature
- [ ] `chore` — tooling, config, dependency updates
- [ ] `perf` — performance improvement
- [ ] `test` — adding or fixing tests
- [ ] `ci` — CI configuration change
- [ ] `release` — version bump and changelog update

## Verification

- [ ] `pnpm install` succeeds
- [ ] `pnpm lint` passes
- [ ] `pnpm type-check` passes
- [ ] `pnpm test` passes
- [ ] `pnpm spell` passes
- [ ] `pnpm build` succeeds
- [ ] Manual smoke test (if applicable) completed — describe below

### Manual smoke test notes

<!-- What did you click through? What worked, what didn't? -->

## Screenshots or recordings

<!-- For UI changes, attach before/after. -->

## Documentation impact

- [ ] No documentation changes needed
- [ ] Updated `CLAUDE.md` / `.agent/rules/` to reflect new conventions
- [ ] Updated `docs/...` for end users or downstream consumers

## Reviewer notes

<!-- Anything specific to look at, areas of risk, follow-ups deferred. -->
```

- [ ] **Step 6: Create the three issue templates** by copying from `$SRC\.github\ISSUE_TEMPLATE\` and replacing `CommandVue`→`MapForge` and the two config.yml URLs (`uraanai/CommandVue`→`uraanai/MapForge`).

```powershell
$s='D:\Work\UraanAI\Public\CommandVue\.github\ISSUE_TEMPLATE'; $d='D:\Work\UraanAI\Public\MapForge\.github\ISSUE_TEMPLATE'
New-Item -ItemType Directory -Force $d | Out-Null
Copy-Item "$s\bug_report.yml" "$d\bug_report.yml"
Copy-Item "$s\config.yml" "$d\config.yml"
Copy-Item "$s\feature_request.yml" "$d\feature_request.yml"
```
Then in all three replace `CommandVue`→`MapForge`; in `config.yml` replace `github.com/uraanai/CommandVue`→`github.com/uraanai/MapForge` (2 URLs).

---

### Task 0.8: Agent rules & workflows

**Files:** Create `.agent/README.md` (adapted), `.agent/rules/{project-and-stack,ui-and-components,architecture,git-workflow,verification,libraries-and-knowledge}.md` (adapted), `.agent/workflows/{library-first,documentation-sync}.md` (trimmed). **No** `.agent/skills/`.

- [ ] **Step 1: Write `.agent/README.md`** (drop the Skills table; MapForge has no skills yet)

```markdown
# .agent — AI Agent Configuration

This directory holds configuration and reference material for AI coding agents working on MapForge.

## Rules

High-level, always-on rules live in [`CLAUDE.md`](../CLAUDE.md) at the repo root, which `@import`s the focused modules under [`rules/`](./rules):

| Module | Covers |
| --- | --- |
| `rules/project-and-stack.md` | What MapForge is, the locked technology stack, the "don't add" list |
| `rules/ui-and-components.md` | Library-first / PrimeVue-first rules, the component mapping table, icons, styling |
| `rules/architecture.md` | Map composable + tool registry + drawings/geo model, state & file conventions |
| `rules/git-workflow.md` | Conventional Commits, branch/PR conventions |
| `rules/verification.md` | Two-stage verification protocol, the vue-tsc cache gotcha |
| `rules/libraries-and-knowledge.md` | Context7-first rule, documentation-sync, memory surfaces |

## Workflows

| File | Purpose |
| --- | --- |
| `workflows/library-first.md` | How to check for a pre-built component before hand-rolling UI |
| `workflows/documentation-sync.md` | "When I change X, what else do I update?" Read before any non-trivial change. |

## Adding skills

When MapForge grows a subsystem worth documenting for agents (e.g. a map-tools skill or the future plugin module), add a skill under `.agent/skills/<name>/` with a `SKILL.md` and optional `reference/*`. None exist yet — they are authored as those subsystems are built.

## Canonical guidance

For rules that apply to all agents in all sessions, see [`CLAUDE.md`](../CLAUDE.md) at the repo root.
```

- [ ] **Step 2: Write `.agent/rules/project-and-stack.md`** (rewritten purpose + trimmed locked-stack table)

```markdown
# Project & stack

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Project context

**MapForge** is a MapLibre-first Vue 3 sandbox for building and testing map tools (drawing, measuring, future tools) on top of MapLibre GL, and for developing a future plugin module ("lp module") that installs into CommandVue (and MapForge) as a workspace package under `packages/`.

It boots straight to a full-screen 2D map. It is deliberately minimal: no panel/window manager, no chrome bars, no theming engine, no 3D globe, no operational-domain features. Keep additions generic and map-focused.

**Maintainer:** Uraan AI — https://uraanai.com
**Repository:** https://github.com/uraanai/MapForge
**License:** Apache 2.0

---

## Locked technology stack

Do not substitute libraries from this list without explicit instruction.

| Layer | Choice |
| --- | --- |
| Framework | Vue 3 + Vite |
| Language | TypeScript (strict) |
| Router | Vue Router |
| State | Pinia |
| Package manager | pnpm (with workspaces) |
| UI components | PrimeVue (unstyled) + Tailwind v4 |
| 2D map | MapLibre GL |
| Geospatial math | @turf/\*, mgrs, h3-js |
| Icons | @lucide/vue |
| Tooltips | floating-vue |
| Utilities | @vueuse/core, dayjs, es-toolkit, nanoid |
| Spell-check (code) | CSpell + dictionaries/\*.txt |
| Build | Vite |
| Quality | ESLint flat config, Prettier, Vitest, vue-tsc |
| Containerization | Multi-stage Dockerfile + docker-compose.yml |
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
```

- [ ] **Step 3: Write `.agent/rules/ui-and-components.md`** (keep library-first/PrimeVue-first + generic mappings; drop DataTable/TanStack, Volt, charts, domain-symbology framing)

```markdown
# UI & components

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Library-first rule (MANDATORY)

**Before building any UI component, check if PrimeVue — or another already-installed library in the locked stack — has a pre-built equivalent. If it does, use it. Do not roll your own.**

This applies to every UI surface: menus, dropdowns, dialogs, context menus, form controls, tooltips, sliders, tags, dividers — all of it. PrimeVue 4 ships 80+ unstyled components consumed with `:pt` (passthrough) for Tailwind theming. Maps come from `maplibre-gl`. The locked-stack table (in [`project-and-stack.md`](./project-and-stack.md)) names everything available.

### Workflow

1. **Before writing markup** for a new UI element, scan PrimeVue's component list (https://primevue.org — fetch via Context7 with library id `/websites/primevue`). The full reference workflow lives in [`.agent/workflows/library-first.md`](../workflows/library-first.md).
2. **If a PrimeVue component fits**, use it directly (or extend the relevant `src/components/ui/*` wrapper). Style via `:pt` to match project tokens — never rely on PrimeVue's bundled styles.
3. **If no PrimeVue component fits**, surface the gap before writing custom code. Ask the user.
4. **If something custom genuinely is required**, document why in the component's docstring.

### Common mappings (memorize)

| Need | Use |
| --- | --- |
| Modal / dialog | PrimeVue `Dialog` |
| Right-click context menu | PrimeVue `ContextMenu` (wrapped by `ui/ContextMenu`) — never hand-roll outside-click + clientX/Y |
| Top menu bar / nested submenus | PrimeVue `Menubar` |
| Dropdown popup | PrimeVue `Menu` (popup mode) or `TieredMenu` |
| Tabbed UI | PrimeVue `Tabs` + `TabList` + `Tab` + `TabPanels` |
| Section grouping with legend | PrimeVue `Fieldset` |
| Inline label / badge | PrimeVue `Tag` or `Chip` |
| Dropdown select | PrimeVue `Select` (wrapped by `ui/Select`) |
| Text input | PrimeVue `InputText` or `IconField` + `InputIcon` |
| Textarea | PrimeVue `Textarea` — never raw `<textarea>` |
| Checkbox / radio | PrimeVue `Checkbox` (`binary`) / `RadioButton` |
| Color picker | PrimeVue `ColorPicker` — never `<input type=color>` |
| Range / slider | `ui/Slider` (hand-rolled, pointer-capture) or PrimeVue `Slider` — never `<input type=range>` |
| Date picker | PrimeVue `DatePicker` |
| Button | PrimeVue `Button` (wrapped by `ui/Button` + `ui/IconButton`) |
| Tooltip | `ui/Tooltip` (floating-vue) |
| Popover | PrimeVue `Popover` |
| Divider | PrimeVue `Divider` |

If the need isn't on this list, check the PrimeVue catalog before inventing custom markup. Add new mappings here as you discover them. (A tabular-data surface — `@tanstack/vue-table` via a `DataTable.vue` wrapper — is deferred; add it and an ADR if/when a table is needed.)

---

## UI primitives

MapForge uses PrimeVue (unstyled mode) as the foundation for UI primitives, wrapped under `src/components/ui/*` with the project token vocabulary applied via `:pt`.

- **Shipped wrappers today:** `Button`, `IconButton`, `Select`, `Tooltip` (floating-vue), `Slider` (hand-rolled pointer-capture), `ContextMenu`.
- **Default location for a new primitive:** `src/components/ui/<Name>.vue` — a thin wrapper over the PrimeVue component, styled via `:pt`, exposing a narrowed project API.
- **Forbidden:** raw `<button>`, `<input>`, `<select>`, `<textarea>` outside the UI-primitive definitions themselves. ESLint enforces this (warn-level); the `ui/**` files are exempt.
- **Forbidden:** non-PrimeVue UI libraries (Element Plus, Naive UI, Vuetify, etc.) without explicit justification.

---

## Icon usage rules

- **@lucide/vue** — the icon set for UI chrome (buttons, toolbars, controls, status). Always use **named imports** (`import { Ruler } from "@lucide/vue"`); never `import * as Icons`. Tree-shaking depends on it.
- If a feature needs a different/larger icon set later, add it to the locked stack first.

---

## Styling rules

- Tailwind v4 utility-first. No CSS modules; no scoped styles for layout/spacing.
- Use the `cn()` helper from `src/utils/cn.ts` (clsx + tailwind-merge) when composing dynamic classes.
- Design tokens live in `src/assets/styles/tokens.css` as CSS variables. Override brand colors there; don't hardcode hex in components.
- Dark mode toggles via `data-theme="dark"` on `<html>` (MapForge defaults to `dark`).
```

- [ ] **Step 4: Write `.agent/rules/architecture.md`** (drop Panel/Chrome/Preset registry sections; keep the map/tool/composable rules)

```markdown
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
```

- [ ] **Step 5: Write `.agent/rules/git-workflow.md`** (keep Conventional Commits + GitFlow conventions as reference; note no remote yet; drop `.internal/` + release-PR specifics)

```markdown
# Git & workflow

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Commit conventions

Conventional Commits, enforced by commitlint:

- `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`, `perf:`, `style:`, `revert:`

Header max length is 100 (matches Prettier's `printWidth`).

---

## Branch and workflow conventions

MapForge follows a GitFlow-style workflow. **No git remote and no branch protection exist yet** — the repo is a fresh local `main`. The conventions below are carried over from the CommandVue template so they're ready when a remote is added; until then, treat them as the intended shape, not enforced gates.

- **Don't commit directly to `main`** once real history exists — branch first. Conventional branch naming mirrors the commit prefix: `feat/...`, `fix/...`, `docs/...`, `refactor/...`, `chore/...`.
- **One branch per logical unit of work.**
- **When a remote exists,** feature work targets `develop`; release PRs target `main`; PR titles follow Conventional Commits. Add branch protection + the CI/CSpell required checks at that point.

### The required sequence (once a remote exists)

```bash
git checkout develop && git pull origin develop
git checkout -b <type>/<short-slug>
# … edit, commit (lint-staged + commitlint hooks run automatically) …
git push -u origin <type>/<short-slug>
gh pr create --base develop --title "<conventional-commit-style>" --body "<summary + test plan>"
# Stop and wait for the user to merge. Do not auto-merge.
```

### Critical "don'ts"

- **Never amend a published commit** or force-push a shared branch.
- **Never auto-merge** a PR without the user's go-ahead.
- If you accidentally edit a protected branch: `git checkout -b <type>/<slug>` carries your changes to a feature branch; commit/push/PR from there.

End agent commit messages with the `Co-Authored-By: Claude …` trailer.
```

- [ ] **Step 6: Write `.agent/rules/verification.md`** (keep the two-stage protocol + vue-tsc cache gotcha; replace Cesium/milsymbol/echarts/dockview failure examples with MapLibre relevance)

```markdown
# Verification

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Runtime verification (mandatory after major-version bumps)

The static gauntlet (`pnpm lint && pnpm type-check && pnpm test && pnpm spell && pnpm build && pnpm docs:build`) does **not** prove a major-version migration is safe. All can pass while the running app is broken in ways that only surface when components mount in the browser.

**After any major-version bump** of a UI framework, build tool, state library, or the map library:

1. Run `pnpm dev` and confirm the map mounts + key flows work (activate a tool, draw, clear, switch basemap). Drive verification with the **Playwright MCP** server (`mcp__plugin_playwright_playwright__*`) when possible; otherwise ask the user to verify manually.
2. Exercise **every surface that uses the bumped library** — runtime regressions are mount-specific.
3. Watch for these failure modes:
   - **Vite `optimizeDeps` failures** — `Cannot optimize dependency: X`, pre-bundle vs raw-serve interop.
   - **Vue `inject` regressions** with functional components (the Lucide 1.16 / Vue 3.5 `LUCIDE_CONTEXT` bug — `main.ts` provides an empty context to satisfy it; keep that provide).
   - **ESM ↔ CJS interop mismatches** — a `.d.ts` claims a named export the ESM module doesn't provide.
   - **MapLibre lifecycle** — adding sources/layers before `style.load`, or after `setStyle` wipes them (re-add on `styledata`; see `useDrawingLayer`).
4. When CI is green but the page doesn't mount, the relevant tooling is **browser console + dev-server stderr**, not the build log.

**Do not** report a migration complete until the running app has been clicked through.

---

## Type-checking — don't trust a cached `vue-tsc` pass

`pnpm type-check` runs `vue-tsc --build`, which caches results in `node_modules/.tmp/*.tsbuildinfo`. That incremental cache can report a **clean pass while the committed code has a real type error** — and `--build --force` does not reliably bust it. CI runs cache-free and catches it.

When a type-check result is load-bearing — before claiming a PR is green — make it cache-free first:

```powershell
Get-ChildItem -Recurse -Filter *.tsbuildinfo | Remove-Item -Force; pnpm type-check
```

…or just trust CI's clean run over a local green.

---

## Verification protocol — automated + human review

Every substantial change ends with two verification stages, in order:

1. **Automated functional verification** — drive a real browser (Playwright MCP) through the change and assert on observable state (DOM attributes, console output, screenshots at named checkpoints). Binary pass/fail; no design judgment. Do not open a PR / claim done until this is green. Screenshots go to `.verification-screenshots/<branch>/<checkpoint>.png` (gitignored).
2. **Human design review** — a short GitHub-markdown task-list (`- [ ]`, 3–7 items) of subjective checks automation can't make (map fills viewport, control overlay legible/positioned, tool affordances clear, drawings visually distinct), plus a final `- [ ] Ready to merge`. The maintainer ticks each box and merges only when all are checked.

**Tool availability:** probe for `mcp__plugin_playwright_playwright__*`; if missing, run `ToolSearch` with `query: "playwright browser"`. If still unavailable, fall back to a manual smoke-test checklist and state so explicitly.
```

- [ ] **Step 7: Write `.agent/rules/libraries-and-knowledge.md`** (keep Context7-first + documentation-sync + memory; drop Cesium/milsymbol gotchas; MapForge memory path)

```markdown
# Libraries, gotchas & knowledge

> Module of [`CLAUDE.md`](../../CLAUDE.md). Loaded into context via `@import`.

## Library integration — Context7 first

**Mandatory rule, no exceptions:** Before writing, modifying, or debugging any code that integrates a third-party library, framework, SDK, CLI tool, or cloud service, fetch current docs via the **Context7 MCP** server. Use `mcp__context7__resolve-library-id` then `mcp__context7__query-docs`. **Never** rely on training-data knowledge or blog posts older than ~6 months.

This applies to: integrating a new package, bumping a major version, debugging a runtime error that names a library (e.g. `maplibre-gl`, `<Lucide Icon>`, PrimeVue), and acting on any tutorial/blog link the user shares. It does **not** apply to refactoring our own code, writing scripts from scratch, or debugging business logic.

Full rationale + decision matrix lives in [`.agent/workflows/documentation-sync.md`](../workflows/documentation-sync.md).

---

## Library-specific notes (do not regress)

### MapLibre GL

- **The map instance lives in a `shallowRef`, never reactive state** (`useMapLibre`). Reactive proxies break the engine.
- **Adding sources/layers requires the style to be loaded.** Add on the `load` event (fires once). `setStyle` (basemap switch) wipes all sources/layers — re-add yours on `styledata` (see `useDrawingLayer`). Guard adds with `getSource(id)` checks so they're idempotent.
- **Default style is OpenFreeMap Liberty** — community-run, no API key. For air-gapped use, host your own style.json and point `VITE_MAPLIBRE_STYLE_URL` at it; `modules/maplibre/styles.ts` also exports an `OFFLINE_STUB_STYLE` fallback.

### @lucide/vue

- `<Icon>` is a functional component that calls `inject(LUCIDE_CONTEXT)` on render. `main.ts` calls `app.provide(LUCIDE_CONTEXT, {})` at the root so the destructure inside the icon doesn't throw. Keep that provide.

---

## Keeping documentation in sync

The canonical reference for "when I change X, what else do I update" is [`.agent/workflows/documentation-sync.md`](../workflows/documentation-sync.md). Consult it before any non-trivial change and apply the relevant updates in the same PR. The short version:

- **Integrating / bumping / debugging a library** → fetch current docs via Context7 MCP.
- **New / removed dependency** → update `README.md` Stack table **and** the locked-stack table in [`project-and-stack.md`](./project-and-stack.md).
- **New / renamed / removed `pnpm` script** → update `README.md` Scripts table.
- **New environment variable** → update `README.md` Configuration table, `.env.example`, and `docs/` if user-facing.
- **New tool** → add under `src/modules/tools/`, export from `src/modules/tools/index.ts` (`TOOLS`).
- **New `docs/*.md` page** → register in `docs/.vitepress/config.ts` sidebar.
- **CSpell-flagged term** → add to `dictionaries/{operations,project,tech}.txt`, never to `cspell.json`.

## Agent memory

This project uses claude-mem. Observations flow automatically through its hooks; no manual writes needed in worker runtime. After a major change that should be searchable, the corpus name is `mapforge`. The session memory path is `~/.claude/projects/D--Work-UraanAI-Public-MapForge/`.
```

- [ ] **Step 8: Write `.agent/workflows/library-first.md`** (CommandVue's, with Step 5's stack bullets trimmed to MapForge and the CommandVue history paragraph dropped)

Copy `$SRC\.agent\workflows\library-first.md` → `$DST`, then:
- Replace `CommandVue` → `MapForge` throughout.
- In **Step 5** ("If PrimeVue does NOT have it — check the rest of the locked stack"), replace the bullet list with only:
  ```
  - **2D maps** → `maplibre-gl`.
  - **Geospatial math** → `@turf/*`, `mgrs`, `h3-js`.
  - **Icons** → `@lucide/vue` (named imports only).
  - **Date math** → `dayjs`.
  - **Functional utils** → `es-toolkit` (NOT lodash).
  ```
  (Drop the Charts/3D-maps/symbology/markdown/drag-and-drop/fuzzy-search bullets.)
- In the wrappers parenthetical (Step 4), change the wrapper list to `(Button, IconButton, Select, Tooltip, ContextMenu)`.
- Drop the final "Before this rule existed, the project shipped a hand-rolled…" sentence (CommandVue-specific history) from the "Why this exists" section; keep the rest.

- [ ] **Step 9: Write `.agent/workflows/documentation-sync.md`** (CommandVue's, with dropped-subsystem rows removed)

Copy `$SRC\.agent\workflows\documentation-sync.md` → `$DST`, then:
- Replace `CommandVue` → `MapForge`; replace the corpus name `commandvue` → `mapforge` and the memory path `D--Work-UraanAI-Public-CommandVue` → `D--Work-UraanAI-Public-MapForge`.
- In **Feature additions**, delete the "New panel", "New realtime message type" rows; rewrite the "New tool" row to: `Implement under src/modules/tools/; export in src/modules/tools/index.ts (TOOLS); document in docs/ if user-facing.`; keep "New composable" and "New Pinia store" (drop their `docs/state.md` reference or change to `docs/`).
- In **Documentation site** and **Tooling/configuration**, drop rows that reference dropped docs (`docs/theming.md`, `docs/styling.md`, `docs/realtime.md`, `docs/panels.md`) — keep the generic sidebar-registration and CSpell-dictionary rows.
- In **Code & dependency changes**, drop the "New keyboard shortcut" row (no shortcuts module).
- Keep the Library-integration block, the Lifecycle/CHANGELOG-release-only policy, Repository identity, Anti-patterns, and See-also sections (rename links to existing files only).

---

### Task 0.9: Root CLAUDE.md, docs, governance docs

**Files:** Create `CLAUDE.md`, `docs/.vitepress/config.ts`, `docs/index.md`, `docs/architecture.md`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `CHANGELOG.md`.

- [ ] **Step 1: Write `CLAUDE.md`** (slim `@import` index; drop the Agent-skills section)

```markdown
# MapForge — Claude Code / Agent Instructions

This file is read by Claude Code and other AI coding agents at the start of every session. It defines the project's stack, conventions, and rules so agents produce consistent, high-quality code.

The full ruleset is split into focused modules under [`.agent/rules/`](./.agent/rules) and imported below. Claude Code expands every `@import` inline at session start, so the complete ruleset still loads as one — this split is for maintainability. **Edit the relevant module, and keep the import list below in sync when you add or remove one.**

---

## Rule modules

**Project & stack** — what MapForge is, the locked technology stack, the "don't add" list, brand colors:
@./.agent/rules/project-and-stack.md

**UI & components** — library-first / PrimeVue-first rules, the component mapping table, icons, styling:
@./.agent/rules/ui-and-components.md

**Architecture & conventions** — the map composable + tool registry + drawings/geo model, state, file & testing conventions:
@./.agent/rules/architecture.md

**Git & workflow** — commit conventions, branch/PR conventions:
@./.agent/rules/git-workflow.md

**Verification** — runtime verification after major version bumps, the `vue-tsc` cache gotcha, the two-stage verification protocol:
@./.agent/rules/verification.md

**Libraries, gotchas & knowledge** — Context7-first rule, MapLibre/Lucide notes, the documentation-sync table, the memory surfaces:
@./.agent/rules/libraries-and-knowledge.md
```

- [ ] **Step 2: Write `docs/.vitepress/config.ts`** (renamed; sidebar trimmed to the pages that exist)

```ts
import { defineConfig } from "vitepress";

/**
 * VitePress site config for MapForge's documentation.
 */
export default defineConfig({
  title: "MapForge",
  description:
    "A MapLibre-first Vue 3 sandbox for building and testing map tools (drawing, measuring) and CommandVue plugins.",
  cleanUrls: true,
  lastUpdated: true,
  appearance: "dark",

  head: [
    ["meta", { name: "theme-color", content: "#0b1120" }],
    ["meta", { name: "og:type", content: "website" }],
    ["meta", { name: "og:title", content: "MapForge documentation" }],
    [
      "meta",
      {
        name: "og:description",
        content:
          "MapLibre-first Vue 3 sandbox for building map tools — drawing, measuring, and CommandVue plugins.",
      },
    ],
  ],

  themeConfig: {
    nav: [{ text: "Guide", link: "/architecture" }],

    sidebar: [
      {
        text: "Overview",
        items: [
          { text: "Introduction", link: "/" },
          { text: "Architecture", link: "/architecture" },
        ],
      },
    ],

    socialLinks: [{ icon: "github", link: "https://github.com/uraanai/MapForge" }],

    editLink: {
      pattern: "https://github.com/uraanai/MapForge/edit/main/docs/:path",
      text: "Edit this page on GitHub",
    },

    footer: {
      message: "Apache 2.0 licensed. Built by Uraan AI.",
      copyright: "© 2026 Uraan AI",
    },

    search: { provider: "local" },
  },
});
```

- [ ] **Step 3: Write `docs/index.md`** (fresh MapForge landing page)

```markdown
---
layout: home

hero:
  name: MapForge
  text: A MapLibre-first Vue 3 sandbox
  tagline: Build and test map tools — drawing, measuring, and CommandVue plugins — on a full-screen MapLibre map.
  actions:
    - theme: brand
      text: Get started
      link: /architecture
    - theme: alt
      text: View on GitHub
      link: https://github.com/uraanai/MapForge

features:
  - title: Map-first
    details: Boots straight to a full-screen MapLibre GL map using OpenFreeMap — no API key required.
  - title: Tool registry
    details: Plain-object tools with a setup/cleanup contract. measure-distance and draw-polygon ship built-in; add your own to the TOOLS array.
  - title: Drawings + geo
    details: Finalized features land in a Pinia store and render via a GeoJSON layer. Geospatial math via @turf, mgrs, and h3-js.
  - title: Plugin-ready
    details: A pnpm workspace (packages/*) reserved for a future plugin module installable into CommandVue.
---

## Quickstart

```bash
pnpm install
pnpm dev
```

The dev server boots at `http://localhost:5173` to a full-screen map with a starter control overlay: toggle the measure / draw-polygon tools, clear drawings, and switch basemaps.

## What to read first

1. [**Architecture**](/architecture) — the map composable, the tool registry, how drawings render, and where the future plugin lives.

## License

Apache 2.0. Use it, fork it, brand it.
```

- [ ] **Step 4: Write `docs/architecture.md`** (fresh, concise — mirrors `.agent/rules/architecture.md`)

```markdown
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
```

- [ ] **Step 5: Write `README.md`** (fresh MapForge README)

```markdown
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

| Layer | Choice |
| --- | --- |
| Framework | Vue 3 + Vite |
| Language | TypeScript (strict) |
| Router | Vue Router |
| State | Pinia |
| UI components | PrimeVue (unstyled) + Tailwind v4 |
| 2D map | MapLibre GL |
| Geospatial math | @turf/\*, mgrs, h3-js |
| Icons | @lucide/vue |
| Tooltips | floating-vue |
| Quality | ESLint, Prettier, Vitest, vue-tsc, CSpell, commitlint, husky |
| Docs | VitePress |

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Start the Vite dev server |
| `pnpm build` | Type-check + production build |
| `pnpm preview` | Preview the production build |
| `pnpm type-check` | `vue-tsc --build` |
| `pnpm lint` | ESLint (with `--fix`) |
| `pnpm format` / `format:check` | Prettier write / check |
| `pnpm test` / `test:watch` | Vitest |
| `pnpm spell` | CSpell |
| `pnpm docs:dev` / `docs:build` / `docs:preview` | VitePress |
| `pnpm docker:build` / `docker:up` / `docker:down` | Docker image / compose |

## Configuration

Copy `.env.example` to `.env.local` and override as needed. Only `VITE_`-prefixed vars reach the browser.

| Variable | Purpose |
| --- | --- |
| `VITE_APP_NAME` | Display name |
| `VITE_DEFAULT_MAP_CENTER_LAT` / `_LON` / `VITE_DEFAULT_MAP_ZOOM` | Initial map camera |
| `VITE_MAPLIBRE_STYLE_URL` | Optional self-hosted MapLibre style.json |

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
```

- [ ] **Step 6: Write `CONTRIBUTING.md`** (CommandVue's, adapted)

Copy `$SRC\CONTRIBUTING.md` → `$DST`, then:
- Replace `CommandVue` → `MapForge` and `uraanai/CommandVue` → `uraanai/MapForge`.
- **Delete the "## UI primitives" section** (the PrimeVue-first/Volt/DataTable/ADR-0002 block) — its essence now lives in `.agent/rules/ui-and-components.md`; replace with a one-line pointer: `> UI conventions (PrimeVue-first, the ui/* wrappers) live in .agent/rules/ui-and-components.md.`
- **Delete the "## Terminology guidance" section** (operational symbology / SIDC / milsymbol).
- In the Quality-gates / required-commands list, ensure the commands are `pnpm lint`, `type-check`, `test`, `spell`, `build` (drop any `check:single-source`).
- In any "clone" instruction, the repo URL is `https://github.com/uraanai/MapForge.git`.

- [ ] **Step 7: Write `SECURITY.md`** (CommandVue's, renamed)

Copy `$SRC\SECURITY.md` → `$DST`, then replace `CommandVue` → `MapForge`, the subject prefix `[CommandVue]` → `[MapForge]`, and any `uraanai/CommandVue` URL → `uraanai/MapForge`. The `security@uraanai.com` address is unchanged.

- [ ] **Step 8: Copy `CODE_OF_CONDUCT.md` and `LICENSE` verbatim** from `$SRC` (CODE_OF_CONDUCT references only "Uraan AI" / `conduct@uraanai.com`, unchanged; LICENSE is pure Apache-2.0, `Copyright 2026 Uraan AI` unchanged).

```powershell
$s='D:\Work\UraanAI\Public\CommandVue'; $d='D:\Work\UraanAI\Public\MapForge'
Copy-Item "$s\CODE_OF_CONDUCT.md" "$d\CODE_OF_CONDUCT.md"
Copy-Item "$s\LICENSE" "$d\LICENSE"
```

- [ ] **Step 9: Write `CHANGELOG.md`** (fresh)

```markdown
# Changelog

All notable changes to MapForge are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Initial MapForge scaffold: full-screen MapLibre map (OpenFreeMap, no API key),
  ported tool registry with `measure-distance` and `draw-polygon` tools, drawings
  store + rendering layer, and a starter control overlay (tool toggles, clear
  drawings, basemap switch).
- Meta-infrastructure forked from CommandVue: agent rules, GitHub config, and the
  quality tooling (ESLint, Prettier, Vitest, vue-tsc, CSpell, commitlint, husky).
```

---

### Task 0.10: `.env.example`, favicon, install

**Files:** Create `.env.example`, `public/favicon.svg`.

- [ ] **Step 1: Write `.env.example`** (drop `VITE_WS_URL`; reword for MapLibre; add style URL)

```
# MapForge environment variables.
#
# This file is COMMITTED as a documented template. To override locally, copy it
# to `.env.local` (git-ignored). Never commit real secrets.
#
# Only variables prefixed with VITE_ are exposed to the browser.

# Application display name (shown in the browser tab).
VITE_APP_NAME="MapForge"

# Default MapLibre camera (decimal degrees + zoom).
VITE_DEFAULT_MAP_CENTER_LAT=30.0
VITE_DEFAULT_MAP_CENTER_LON=70.0
VITE_DEFAULT_MAP_ZOOM=4

# Optional: a self-hosted MapLibre style.json URL (air-gapped / rate-sensitive
# deployments). When unset, MapForge uses the public OpenFreeMap Liberty style.
# VITE_MAPLIBRE_STYLE_URL=
```

- [ ] **Step 2: Copy `public/favicon.svg` verbatim** from `$SRC\public\favicon.svg`.

```powershell
New-Item -ItemType Directory -Force "D:\Work\UraanAI\Public\MapForge\public" | Out-Null
Copy-Item "D:\Work\UraanAI\Public\CommandVue\public\favicon.svg" "D:\Work\UraanAI\Public\MapForge\public\favicon.svg"
```

- [ ] **Step 3: Install dependencies**

Run:
```powershell
corepack enable
pnpm -C D:\Work\UraanAI\Public\MapForge install
```
Expected: resolves and installs without error; creates `pnpm-lock.yaml`, `node_modules/`, and (via `prepare: husky`) the `.husky/_/` runtime. If any peer-dep warning blocks, note it but a clean install should succeed.

- [ ] **Step 4: Commit Phase 0**

```powershell
git -C D:\Work\UraanAI\Public\MapForge add -A
git -C D:\Work\UraanAI\Public\MapForge commit -m @'
chore: scaffold MapForge tooling and meta-infrastructure

package.json (trimmed deps/scripts), TS/Vite/Vitest configs, ESLint/Prettier/
commitlint/lint-staged, CSpell + dictionaries, Docker, .github, .agent rules +
workflows, CLAUDE.md, docs scaffold, root governance docs.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
'@
```

---

## Phase 1 — Proven foundations (ported)

Goal: port the MapLibre-native code + its tests; `pnpm test`, `lint`, `type-check` stay green. Depends on Phase 0.

### Task 1.1: Map core, tools, geo, stores (verbatim)

**Files:** Create `src/modules/maplibre/{styles,types}.ts`, `src/modules/tools/{index,types,draw-polygon,measure-distance}.ts`, `src/modules/geo/{coords,h3,measure,types}.ts`, `src/stores/{tools,drawings}.ts`, `src/composables/{useMapLibre,useToolRegistry}.ts`.

- [ ] **Step 1: Copy verbatim** (all confirmed free of dropped-module imports):

```powershell
$s='D:\Work\UraanAI\Public\CommandVue\src'; $d='D:\Work\UraanAI\Public\MapForge\src'
New-Item -ItemType Directory -Force "$d\modules\maplibre","$d\modules\tools","$d\modules\geo","$d\stores","$d\composables" | Out-Null
Copy-Item "$s\modules\maplibre\styles.ts" "$d\modules\maplibre\styles.ts"
Copy-Item "$s\modules\maplibre\types.ts" "$d\modules\maplibre\types.ts"
Copy-Item "$s\modules\tools\index.ts" "$d\modules\tools\index.ts"
Copy-Item "$s\modules\tools\types.ts" "$d\modules\tools\types.ts"
Copy-Item "$s\modules\tools\draw-polygon.ts" "$d\modules\tools\draw-polygon.ts"
Copy-Item "$s\modules\tools\measure-distance.ts" "$d\modules\tools\measure-distance.ts"
Copy-Item "$s\modules\geo\coords.ts" "$d\modules\geo\coords.ts"
Copy-Item "$s\modules\geo\h3.ts" "$d\modules\geo\h3.ts"
Copy-Item "$s\modules\geo\measure.ts" "$d\modules\geo\measure.ts"
Copy-Item "$s\modules\geo\types.ts" "$d\modules\geo\types.ts"
Copy-Item "$s\stores\tools.ts" "$d\stores\tools.ts"
Copy-Item "$s\stores\drawings.ts" "$d\stores\drawings.ts"
Copy-Item "$s\composables\useMapLibre.ts" "$d\composables\useMapLibre.ts"
Copy-Item "$s\composables\useToolRegistry.ts" "$d\composables\useToolRegistry.ts"
```

- [ ] **Step 2: Rename the tool namespace** `commandvue:` → `mapforge:` in both tool files.

In `src/modules/tools/draw-polygon.ts` change:
```ts
const NS = "commandvue:draw-polygon";
```
to:
```ts
const NS = "mapforge:draw-polygon";
```
In `src/modules/tools/measure-distance.ts` change:
```ts
const NS = "commandvue:measure-distance";
```
to:
```ts
const NS = "mapforge:measure-distance";
```

- [ ] **Step 3: Verify imports resolve within the kept set.** Confirm none of these files import anything outside: `vue`, `pinia`, `maplibre-gl`, `geojson` (types), `@turf/*`, `mgrs`, `h3-js`, `@/utils/id`, and each other. (Established during exploration; this is a re-check after copy.)

Run a quick grep for stray imports:
```powershell
Select-String -Path "D:\Work\UraanAI\Public\MapForge\src\modules\*\*.ts","D:\Work\UraanAI\Public\MapForge\src\stores\*.ts","D:\Work\UraanAI\Public\MapForge\src\composables\useMapLibre.ts","D:\Work\UraanAI\Public\MapForge\src\composables\useToolRegistry.ts" -Pattern "from \"@/(modules/(cesium|chrome|panels|presets|themes|workspaces|symbology|realtime|shortcuts|storage)|stores/(?!tools|drawings))"
```
Expected: no matches.

---

### Task 1.2: Utils (verbatim)

**Files:** Create `src/utils/{cn,id,format,files}.ts`.

- [ ] **Step 1: Copy verbatim**

```powershell
$s='D:\Work\UraanAI\Public\CommandVue\src\utils'; $d='D:\Work\UraanAI\Public\MapForge\src\utils'
New-Item -ItemType Directory -Force $d | Out-Null
Copy-Item "$s\cn.ts" "$d\cn.ts"
Copy-Item "$s\id.ts" "$d\id.ts"
Copy-Item "$s\format.ts" "$d\format.ts"
Copy-Item "$s\files.ts" "$d\files.ts"
```
`cn.ts` (clsx + tailwind-merge), `id.ts` (nanoid), `format.ts` (dayjs + plugins), `files.ts` (DOM-only stub). All clean.

---

### Task 1.3: Token + global CSS

**Files:** Create `src/assets/styles/tokens.css` (verbatim), `src/assets/styles/main.css` (one line dropped).

- [ ] **Step 1: Copy `tokens.css` verbatim** (zero imports; fully self-contained light + dark theme).

```powershell
$s='D:\Work\UraanAI\Public\CommandVue\src\assets\styles'; $d='D:\Work\UraanAI\Public\MapForge\src\assets\styles'
New-Item -ItemType Directory -Force $d | Out-Null
Copy-Item "$s\tokens.css" "$d\tokens.css"
```

- [ ] **Step 2: Copy `main.css`, then delete the fonts import.**

```powershell
Copy-Item "$s\main.css" "$d\main.css"
```
Then in `src/assets/styles/main.css`, **delete the line**:
```css
@import "../fonts/local-fonts.css";
```
(No replacement — `main.ts` imports `@fontsource-variable/inter` directly. The other `@import`s — `tailwindcss`, `./tokens.css`, `tw-animate-css`, `tailwindcss-primeui` — and the `@plugin` lines stay. The `--p-surface-*` bridge block, scrollbar/focus/selection rules, and the ContextMenu submenu-positioning rules stay; they theme the kept PrimeVue primitives.)

- [ ] **Step 3: Verify** `main.css` no longer references `../fonts/` or `dockview.css`:
```powershell
Select-String -Path "D:\Work\UraanAI\Public\MapForge\src\assets\styles\main.css" -Pattern "fonts/|dockview"
```
Expected: no matches.

---

### Task 1.4: Ported unit tests + setup

**Files:** Create `tests/setup.ts`, `tests/unit/{geo-coords,geo-measure,maplibre-styles,tools-measure-distance,tools-store}.spec.ts` (all verbatim).

- [ ] **Step 1: Copy the test setup + the five kept-unit specs verbatim.**

```powershell
$s='D:\Work\UraanAI\Public\CommandVue\tests'; $d='D:\Work\UraanAI\Public\MapForge\tests'
New-Item -ItemType Directory -Force "$d\unit" | Out-Null
Copy-Item "$s\setup.ts" "$d\setup.ts"
Copy-Item "$s\unit\geo-coords.spec.ts" "$d\unit\geo-coords.spec.ts"
Copy-Item "$s\unit\geo-measure.spec.ts" "$d\unit\geo-measure.spec.ts"
Copy-Item "$s\unit\maplibre-styles.spec.ts" "$d\unit\maplibre-styles.spec.ts"
Copy-Item "$s\unit\tools-measure-distance.spec.ts" "$d\unit\tools-measure-distance.spec.ts"
Copy-Item "$s\unit\tools-store.spec.ts" "$d\unit\tools-store.spec.ts"
```
(`tests/setup.ts` stubs `ResizeObserver` + `matchMedia` for jsdom — no `fake-indexeddb`. The five specs cover only kept units and have no dropped-code coupling.)

- [ ] **Step 2: Run the ported tests.**

Run:
```powershell
pnpm -C D:\Work\UraanAI\Public\MapForge test
```
Expected: PASS — five spec files, all green (geo-coords, geo-measure, maplibre-styles, tools-measure-distance, tools-store).

- [ ] **Step 3: Commit Phase 1 foundations.**

```powershell
git -C D:\Work\UraanAI\Public\MapForge add -A
git -C D:\Work\UraanAI\Public\MapForge commit -m @'
feat: port MapLibre-native foundations from CommandVue

Map core (useMapLibre, maplibre styles/types), tool registry +
measure-distance/draw-polygon (mapforge namespace), drawings + tools stores,
geo math (coords/h3/measure), utils, token + global CSS, and the unit tests
covering those units.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
'@
```

---

## Phase 2 — UI primitives & fresh app shell

Goal: the app boots to a map with working controls. Depends on Phase 1.

### Task 2.1: Clean UI primitives (verbatim)

**Files:** Create `src/components/ui/{Button,IconButton,Slider}.vue`, `src/components/common/LoadingSpinner.vue`.

- [ ] **Step 1: Copy verbatim** (Button/IconButton use `primevue/button` + `@/utils/cn`; Slider is vue-only; LoadingSpinner uses `@lucide/vue`).

```powershell
$s='D:\Work\UraanAI\Public\CommandVue\src\components'; $d='D:\Work\UraanAI\Public\MapForge\src\components'
New-Item -ItemType Directory -Force "$d\ui","$d\common" | Out-Null
Copy-Item "$s\ui\Button.vue" "$d\ui\Button.vue"
Copy-Item "$s\ui\IconButton.vue" "$d\ui\IconButton.vue"
Copy-Item "$s\ui\Slider.vue" "$d\ui\Slider.vue"
Copy-Item "$s\common\LoadingSpinner.vue" "$d\common\LoadingSpinner.vue"
```

---

### Task 2.2: Trimmed UI primitives (pop-out coupling removed)

**Files:** Create `src/components/ui/{Tooltip,Select,ContextMenu}.vue` (trimmed), `src/components/ui/index.ts` (trimmed barrel).

- [ ] **Step 1: Write `src/components/ui/Tooltip.vue`** (floating-vue, no `useOverlayTarget`)

```vue
<script setup lang="ts">
import { Tooltip as VTooltip } from "floating-vue";
import "floating-vue/dist/style.css";

/**
 * Tooltip — thin wrapper over floating-vue's `Tooltip`. floating-ui handles
 * placement, collision avoidance, arrow positioning, and ARIA.
 *
 * Surface:
 *   - `label` — string shown in the tooltip.
 *   - `placement?` — default `top`.
 *   - `delay?` — open/close delay in ms; default `200`.
 *   - `disabled?`
 *   - default slot — the trigger element.
 *
 * Styling is driven by the floating-vue popper CSS overrides at the bottom,
 * scoped to the project's surface / foreground / border tokens.
 */
interface Props {
  label: string;
  placement?:
    | "auto"
    | "auto-start"
    | "auto-end"
    | "top"
    | "top-start"
    | "top-end"
    | "right"
    | "right-start"
    | "right-end"
    | "bottom"
    | "bottom-start"
    | "bottom-end"
    | "left"
    | "left-start"
    | "left-end";
  delay?: number;
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  placement: "top",
  delay: 200,
  disabled: false,
});
</script>

<template>
  <VTooltip
    :triggers="['hover', 'focus']"
    :placement="placement"
    :delay="delay"
    :disabled="disabled"
    :distance="6"
  >
    <slot />
    <template #popper>
      <span class="cv-tooltip-content">{{ label }}</span>
    </template>
  </VTooltip>
</template>

<style>
/* Theme floating-vue's default popper to match the project's surface tokens. */
.v-popper--theme-tooltip .v-popper__inner {
  background-color: var(--color-surface-raised);
  color: var(--color-foreground);
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1rem;
  box-shadow: var(--shadow-md);
}
.v-popper--theme-tooltip .v-popper__arrow-outer {
  border-color: var(--color-surface-raised);
}
.v-popper--theme-tooltip .v-popper__arrow-inner {
  visibility: hidden;
}
.cv-tooltip-content {
  display: inline-block;
  white-space: nowrap;
}
</style>
```

- [ ] **Step 2: Write `src/components/ui/Select.vue`** (PrimeVue Select, no overlay-target / pop-out-dismiss)

```vue
<script setup lang="ts">
import PvSelect from "primevue/select";

import { cn } from "@/utils/cn";

/**
 * Select — thin wrapper over PrimeVue Select. Preserves the
 * `options: { label, value, disabled }[]` API and maps to PrimeVue's
 * `optionLabel` / `optionValue` / `optionDisabled`.
 */
interface Option {
  label: string;
  value: number | string;
  disabled?: boolean;
}

interface Props {
  modelValue?: null | number | string;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  /** Show an inline clear button (sets modelValue to null). */
  showClear?: boolean;
}

withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  placeholder: undefined,
  disabled: false,
  showClear: false,
});

defineEmits<{
  "update:modelValue": [value: null | number | string];
}>();
</script>

<template>
  <PvSelect
    :model-value="modelValue"
    :options="options"
    option-label="label"
    option-value="value"
    option-disabled="disabled"
    :placeholder="placeholder"
    :disabled="disabled"
    :show-clear="showClear"
    :pt="{
      root: {
        class: cn(
          'inline-flex items-center w-full rounded-md border border-border bg-surface text-foreground',
          'min-h-[var(--density-control-height)] text-[length:var(--density-font-size)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)]',
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
        ),
      },
      label: {
        class:
          'flex-1 px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)] truncate',
      },
      dropdown: { class: 'px-2 text-faint' },
      overlay: {
        class: 'z-[100] mt-1 rounded-md border border-border bg-surface-raised py-1 shadow-lg',
      },
      listContainer: { class: 'max-h-60 overflow-auto' },
      list: { class: 'list-none p-0 m-0' },
      option: {
        class: cn(
          'text-foreground cursor-pointer',
          'px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)] text-[length:var(--density-font-size)]',
          'hover:bg-surface-sunken aria-selected:bg-surface-sunken',
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-40',
        ),
      },
    }"
    @update:model-value="(v) => $emit('update:modelValue', v)"
  />
</template>
```

- [ ] **Step 3: Write `src/components/ui/ContextMenu.vue`** (PrimeVue ContextMenu, no overlay-target; `appendTo` defaults to `"body"`)

```vue
<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";

import PvContextMenu from "primevue/contextmenu";
import { twMerge } from "tailwind-merge";
import { computed, ref } from "vue";

/**
 * ContextMenu — thin wrapper over PrimeVue `ContextMenu` (unstyled).
 *
 * Exposes `show(event)` / `hide()` from the underlying instance so callers can
 * drive it imperatively from a `@contextmenu` handler. Consumers can supply an
 * `#item` slot to customize each row. The `pt` prop merges into the wrapper's
 * defaults via `twMerge` on class strings.
 */
interface PtSlot {
  class?: string;
  [key: string]: unknown;
}

interface Props {
  model: MenuItem[];
  pt?: Record<string, PtSlot>;
  /** Where PrimeVue mounts the overlay. Defaults to document.body. */
  appendTo?: HTMLElement | "body" | "self";
}

const props = withDefaults(defineProps<Props>(), {
  appendTo: "body",
});

const cm = ref<InstanceType<typeof PvContextMenu> | null>(null);

function show(event: MouseEvent): void {
  cm.value?.show(event);
}

function hide(): void {
  cm.value?.hide();
}

defineExpose({ show, hide });

const baseTheme: Record<string, PtSlot> = {
  root: {
    class:
      "border-border bg-surface-raised z-50 min-w-[220px] rounded-md border py-1 shadow-xl outline-none",
  },
  rootList: { class: "flex flex-col outline-none" },
  item: { class: "relative" },
  itemContent: { class: "hover:bg-surface-sunken cursor-pointer transition-colors" },
  itemLink: {
    class:
      "text-foreground flex items-center gap-2 px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)] text-[length:var(--density-font-size)]",
  },
  itemIcon: { class: "text-muted size-3.5" },
  submenu: {
    class:
      "border-border bg-surface-raised z-50 min-w-[220px] rounded-md border py-1 shadow-xl outline-none",
  },
  submenuIcon: { class: "text-muted ml-auto size-3" },
  separator: { class: "border-border my-1 border-t" },
};

const mergedPt = computed(() => {
  const consumer = props.pt ?? {};
  const out: Record<string, PtSlot> = {};
  const keys = new Set([...Object.keys(baseTheme), ...Object.keys(consumer)]);
  for (const key of keys) {
    const base = baseTheme[key] ?? {};
    const over = consumer[key] ?? {};
    out[key] = {
      ...base,
      ...over,
      class: twMerge(base.class, over.class),
    };
  }
  return out;
});
</script>

<template>
  <PvContextMenu ref="cm" :model="model" unstyled :pt="mergedPt" :append-to="appendTo">
    <template v-if="$slots.item" #item="slotProps">
      <slot name="item" v-bind="slotProps" />
    </template>
  </PvContextMenu>
</template>
```

- [ ] **Step 4: Write `src/components/ui/index.ts`** (only the kept primitives; adds the previously-unexported Slider)

```ts
export { default as Button } from "./Button.vue";
export { default as ContextMenu } from "./ContextMenu.vue";
export { default as IconButton } from "./IconButton.vue";
export { default as Select } from "./Select.vue";
export { default as Slider } from "./Slider.vue";
export { default as Tooltip } from "./Tooltip.vue";
```

- [ ] **Step 5: Verify no dropped-composable imports remain.**
```powershell
Select-String -Path "D:\Work\UraanAI\Public\MapForge\src\components\ui\*.vue" -Pattern "useOverlayTarget|usePopoutOverlayDismiss"
```
Expected: no matches.

---

### Task 2.3: `useDrawingLayer` composable (TDD)

**Files:**
- Create: `src/composables/useDrawingLayer.ts`
- Test: `tests/unit/useDrawingLayer.spec.ts`

- [ ] **Step 1: Write the failing test** `tests/unit/useDrawingLayer.spec.ts`

```ts
import type { Feature } from "geojson";
import type { Map as MaplibreMap } from "maplibre-gl";

import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, shallowRef } from "vue";

import { useDrawingLayer } from "@/composables/useDrawingLayer";
import { useDrawingsStore } from "@/stores/drawings";

/** Run a composable inside a real component setup so lifecycle hooks fire. */
function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result!: T;
  const app = createApp({
    setup() {
      result = composable();
      return () => null;
    },
  });
  app.mount(document.createElement("div"));
  return { result, unmount: () => app.unmount() };
}

/** Minimal fake MapLibre map covering the API useDrawingLayer touches. */
function createFakeMap() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, unknown>();
  const listeners = new Map<string, Set<() => void>>();

  const map = {
    isStyleLoaded: vi.fn(() => false),
    addSource: vi.fn((id: string) => {
      sources.set(id, { setData: vi.fn() });
    }),
    getSource: vi.fn((id: string) => sources.get(id)),
    removeSource: vi.fn((id: string) => {
      sources.delete(id);
    }),
    addLayer: vi.fn((spec: { id: string }) => {
      layers.set(spec.id, spec);
    }),
    getLayer: vi.fn((id: string) => layers.get(id)),
    removeLayer: vi.fn((id: string) => {
      layers.delete(id);
    }),
    on: vi.fn((type: string, fn: () => void) => {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    }),
    off: vi.fn((type: string, fn: () => void) => {
      listeners.get(type)?.delete(fn);
    }),
  };

  function fire(type: string): void {
    for (const fn of listeners.get(type) ?? []) fn();
  }

  return { map, sources, layers, listeners, fire };
}

const polygon: Feature = {
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
  properties: {},
};

describe("useDrawingLayer", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds a source and three layers when the map fires 'load'", () => {
    const { map, sources, layers, fire } = createFakeMap();
    const drawings = useDrawingsStore();
    const { unmount } = withSetup(() =>
      useDrawingLayer(shallowRef(map as unknown as MaplibreMap), drawings),
    );

    expect(sources.size).toBe(0); // nothing added before 'load'
    fire("load");

    expect(sources.has("mapforge:drawings")).toBe(true);
    expect(layers.size).toBe(3);
    unmount();
  });

  it("pushes featureCollection to the source when drawings change", async () => {
    const { map, sources, fire } = createFakeMap();
    const drawings = useDrawingsStore();
    const { unmount } = withSetup(() =>
      useDrawingLayer(shallowRef(map as unknown as MaplibreMap), drawings),
    );
    fire("load");
    const src = sources.get("mapforge:drawings")!;
    src.setData.mockClear();

    drawings.add(polygon);
    await Promise.resolve();
    await Promise.resolve();

    expect(src.setData).toHaveBeenCalled();
    const fc = src.setData.mock.calls.at(-1)![0];
    expect(fc.features).toHaveLength(1);
    unmount();
  });

  it("re-adds the source after a style switch wipes it ('styledata')", () => {
    const { map, sources, fire } = createFakeMap();
    const drawings = useDrawingsStore();
    const { unmount } = withSetup(() =>
      useDrawingLayer(shallowRef(map as unknown as MaplibreMap), drawings),
    );
    fire("load");
    sources.clear(); // setStyle wiped sources/layers

    fire("styledata");

    expect(sources.has("mapforge:drawings")).toBe(true);
    unmount();
  });

  it("removes its layers and source on unmount", () => {
    const { map, sources, layers, fire } = createFakeMap();
    const drawings = useDrawingsStore();
    const { unmount } = withSetup(() =>
      useDrawingLayer(shallowRef(map as unknown as MaplibreMap), drawings),
    );
    fire("load");
    unmount();

    expect(sources.size).toBe(0);
    expect(layers.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm -C D:\Work\UraanAI\Public\MapForge exec vitest run tests/unit/useDrawingLayer.spec.ts`
Expected: FAIL — `Failed to resolve import "@/composables/useDrawingLayer"` (module not yet created).

- [ ] **Step 3: Write `src/composables/useDrawingLayer.ts`**

```ts
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { onBeforeUnmount, watch } from "vue";

import { useDrawingsStore } from "@/stores/drawings";

const SRC = "mapforge:drawings";
const LYR_FILL = "mapforge:drawings:fill";
const LYR_LINE = "mapforge:drawings:line";
const LYR_POINT = "mapforge:drawings:point";

type DrawingsStore = ReturnType<typeof useDrawingsStore>;

/**
 * Renders finalized drawings (the `drawings` store) onto a MapLibre map.
 *
 * The drawings store deliberately leaves rendering to the consumer. This
 * composable owns a single GeoJSON source with fill / line / circle layers and
 * keeps it in sync with `drawings.featureCollection`:
 *
 *   - adds the source + layers on the map's `load` event (idempotent);
 *   - re-adds them on `styledata` because `map.setStyle` (basemap switch) wipes
 *     all sources and layers;
 *   - watches `featureCollection` and calls `source.setData(...)` on change;
 *   - removes everything on unmount.
 *
 * Layers are unfiltered for `line` (renders LineStrings and Polygon outlines)
 * and geometry-filtered for `fill` (Polygons) and `circle` (Points), so all
 * finalized geometry types render correctly from one source.
 */
export function useDrawingLayer(
  mapRef: ShallowRef<MaplibreMap | null>,
  drawings: DrawingsStore,
): void {
  let bound: MaplibreMap | null = null;

  function sync(map: MaplibreMap): void {
    const src = map.getSource(SRC) as GeoJSONSource | undefined;
    src?.setData(drawings.featureCollection);
  }

  function ensure(map: MaplibreMap): void {
    if (!map.getSource(SRC)) {
      map.addSource(SRC, { type: "geojson", data: drawings.featureCollection });
      map.addLayer({
        id: LYR_FILL,
        type: "fill",
        source: SRC,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "fill-color": "#22d3ee", "fill-opacity": 0.15 },
      });
      map.addLayer({
        id: LYR_LINE,
        type: "line",
        source: SRC,
        paint: { "line-color": "#22d3ee", "line-width": 2 },
      });
      map.addLayer({
        id: LYR_POINT,
        type: "circle",
        source: SRC,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 4,
          "circle-color": "#22d3ee",
          "circle-stroke-color": "#0b1120",
          "circle-stroke-width": 1,
        },
      });
    }
    sync(map);
  }

  function onLoad(): void {
    if (bound) ensure(bound);
  }

  function onStyleData(): void {
    // setStyle wipes sources/layers; re-add ours once the new style is usable.
    if (bound && bound.isStyleLoaded()) ensure(bound);
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("load", onLoad);
    map.on("styledata", onStyleData);
    if (map.isStyleLoaded()) ensure(map);
  }

  function detach(): void {
    if (!bound) return;
    const map = bound;
    bound = null;
    try {
      map.off("load", onLoad);
      map.off("styledata", onStyleData);
      if (map.getLayer(LYR_FILL)) map.removeLayer(LYR_FILL);
      if (map.getLayer(LYR_LINE)) map.removeLayer(LYR_LINE);
      if (map.getLayer(LYR_POINT)) map.removeLayer(LYR_POINT);
      if (map.getSource(SRC)) map.removeSource(SRC);
    } catch {
      // Map was torn down first; its sources/layers went with it.
    }
  }

  watch(
    mapRef,
    (map) => {
      detach();
      if (map) attach(map);
    },
    { immediate: true },
  );

  watch(
    () => drawings.featureCollection,
    () => {
      if (bound) sync(bound);
    },
  );

  onBeforeUnmount(detach);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm -C D:\Work\UraanAI\Public\MapForge exec vitest run tests/unit/useDrawingLayer.spec.ts`
Expected: PASS — all four tests.

- [ ] **Step 5: Commit**

```powershell
git -C D:\Work\UraanAI\Public\MapForge add -A
git -C D:\Work\UraanAI\Public\MapForge commit -m @'
feat: add UI primitives subset and useDrawingLayer

Port Button/IconButton/Slider/LoadingSpinner verbatim; trim
Tooltip/Select/ContextMenu to drop dropped pop-out composables; fresh
useDrawingLayer mirrors the drawings store into a MapLibre GeoJSON layer
(TDD: source/layer add, setData on change, styledata re-add, unmount cleanup).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
'@
```

---

### Task 2.4: Fresh app shell — bootstrap, router, views

**Files:** Create `src/main.ts`, `src/App.vue`, `src/router/{index,routes}.ts`, `src/views/MapHome.vue`, `index.html`.

- [ ] **Step 1: Write `src/main.ts`**

```ts
import "@fontsource-variable/inter";

import "@/assets/styles/main.css";

import { LUCIDE_CONTEXT } from "@lucide/vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import { createApp } from "vue";

import App from "./App.vue";
import { router } from "./router";

// Suppress the browser's native context menu site-wide so future custom map
// context menus aren't shadowed by it. The native menu is preserved for text
// editing surfaces (input / textarea / contenteditable) so cut/copy/paste keep
// working.
window.addEventListener(
  "contextmenu",
  (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("input, textarea, [contenteditable=''], [contenteditable='true']")) {
      return;
    }
    event.preventDefault();
  },
  { capture: true },
);

const app = createApp(App);

// @lucide/vue's <Icon> functional component calls inject(LUCIDE_CONTEXT) on
// render; provide an empty object at the root so the destructure doesn't throw
// (Vue 3.5 / Lucide 1.16 interaction).
app.provide(LUCIDE_CONTEXT, {});

app.use(createPinia());
app.use(router);

// PrimeVue in unstyled mode — all styling comes from the ui/* wrappers via the
// passthrough (pt) API.
app.use(PrimeVue, { unstyled: true });

app.mount("#app");
```

- [ ] **Step 2: Write `src/App.vue`**

```vue
<script setup lang="ts">
// MapForge app shell — renders the single route (MapHome → MapView). No
// workspace / theme / layout / preset boot; this is a map-first sandbox.
</script>

<template>
  <RouterView />
</template>
```

- [ ] **Step 3: Write `src/router/routes.ts`**

```ts
import type { RouteRecordRaw } from "vue-router";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "map-home",
    component: () => import("@/views/MapHome.vue"),
  },
];
```

- [ ] **Step 4: Write `src/router/index.ts`**

```ts
import { createRouter, createWebHistory } from "vue-router";

import { routes } from "./routes";

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
```

- [ ] **Step 5: Write `src/views/MapHome.vue`**

```vue
<script setup lang="ts">
import MapView from "@/components/MapView.vue";
</script>

<template>
  <MapView />
</template>
```

- [ ] **Step 6: Write `index.html`** (title/description → MapForge; anti-FOUC reduced to a static `dark` default)

```html
<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="MapForge — a MapLibre-first Vue 3 sandbox for building and testing map tools."
    />
    <title>MapForge</title>
    <!--
      Static default theme. MapForge ships a single dark default (set on <html>
      above). When a runtime theme toggle is added, replace this with the
      anti-FOUC reader that hydrates from storage before first paint.
    -->
  </head>
  <body class="antialiased">
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

---

### Task 2.5: MapView + MapControls

**Files:** Create `src/components/MapView.vue`, `src/components/MapControls.vue`.

- [ ] **Step 1: Write `src/components/MapView.vue`** (lifts the proven wiring from `MapLibrePanel.vue`, minus panel/preset coupling)

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";

import MapControls from "@/components/MapControls.vue";
import { useDrawingLayer } from "@/composables/useDrawingLayer";
import { useMapLibre } from "@/composables/useMapLibre";
import { useToolRegistry } from "@/composables/useToolRegistry";
import { TOOLS } from "@/modules/tools";
import { useDrawingsStore } from "@/stores/drawings";

/**
 * MapView — owns the MapLibre lifecycle and tool wiring for the sandbox.
 *
 *   - `useMapLibre` creates/destroys the map (held in a shallowRef).
 *   - `useToolRegistry` activates tools and pipes finalized features to the
 *     drawings store.
 *   - `useDrawingLayer` renders those finalized features back onto the map.
 *
 * The map fills the viewport; `<MapControls>` overlays the starter controls.
 */
const container = ref<HTMLDivElement | null>(null);
const { map, mount } = useMapLibre();
const drawings = useDrawingsStore();

useToolRegistry(map, {
  tools: TOOLS,
  onFinalize: (feature) => drawings.add(feature),
});
useDrawingLayer(map, drawings);

onMounted(() => {
  if (container.value) mount(container.value);
});
</script>

<template>
  <div class="relative h-screen w-screen overflow-hidden">
    <div ref="container" class="bg-surface-sunken h-full w-full" data-testid="map-container" />
    <MapControls :map="map" />
  </div>
</template>
```

- [ ] **Step 2: Write `src/components/MapControls.vue`** (tool toggles + clear + basemap select)

```vue
<script setup lang="ts">
import type { Map as MaplibreMap } from "maplibre-gl";
import type { Component } from "vue";

import { Pentagon, Ruler, Trash2 } from "@lucide/vue";
import { computed, ref } from "vue";

import IconButton from "@/components/ui/IconButton.vue";
import Select from "@/components/ui/Select.vue";
import Tooltip from "@/components/ui/Tooltip.vue";
import {
  OPENFREEMAP_BRIGHT,
  OPENFREEMAP_LIBERTY,
  OPENFREEMAP_POSITRON,
} from "@/modules/maplibre/styles";
import { TOOLS } from "@/modules/tools";
import { useDrawingsStore } from "@/stores/drawings";
import { useToolsStore } from "@/stores/tools";

/**
 * MapControls — the starter overlay. Proves the ported tool chain works:
 * one toggle per tool in TOOLS, a Clear-drawings button, a basemap switcher,
 * and an inline status line. Intentionally small — the seed for richer controls.
 */
const props = defineProps<{ map: MaplibreMap | null }>();

const tools = useToolsStore();
const drawings = useDrawingsStore();

// Map each tool's Lucide-style icon name to a concrete component.
const ICONS: Record<string, Component> = {
  ruler: Ruler,
  pentagon: Pentagon,
};

const BASEMAPS = [
  { label: "Liberty", value: OPENFREEMAP_LIBERTY },
  { label: "Bright", value: OPENFREEMAP_BRIGHT },
  { label: "Positron", value: OPENFREEMAP_POSITRON },
];

const basemap = ref<string>(OPENFREEMAP_LIBERTY);

const activeToolLabel = computed(() => {
  const active = TOOLS.find((t) => t.id === tools.activeId);
  return active ? active.label : "None";
});

function setBasemap(value: null | number | string): void {
  if (typeof value !== "string") return;
  basemap.value = value;
  props.map?.setStyle(value);
}
</script>

<template>
  <div
    class="bg-surface-raised/90 border-border absolute top-3 left-3 z-10 flex flex-col gap-2 rounded-lg border p-2 shadow-lg backdrop-blur"
  >
    <div class="flex items-center gap-1">
      <Tooltip v-for="tool in TOOLS" :key="tool.id" :label="tool.label">
        <IconButton
          :label="tool.label"
          :variant="tools.activeId === tool.id ? 'solid' : 'ghost'"
          :data-testid="`tool-${tool.id}`"
          :aria-pressed="tools.activeId === tool.id"
          @click="tools.toggle(tool.id)"
        >
          <component :is="ICONS[tool.icon ?? '']" v-if="tool.icon && ICONS[tool.icon]" />
          <span v-else class="text-xs">{{ tool.label[0] }}</span>
        </IconButton>
      </Tooltip>

      <Tooltip label="Clear drawings">
        <IconButton
          label="Clear drawings"
          variant="ghost"
          data-testid="clear-drawings"
          :disabled="drawings.count === 0"
          @click="drawings.clear()"
        >
          <Trash2 />
        </IconButton>
      </Tooltip>
    </div>

    <Select
      :model-value="basemap"
      :options="BASEMAPS"
      data-testid="basemap-select"
      @update:model-value="setBasemap"
    />

    <p class="text-muted px-1 text-xs" data-testid="status-line">
      Tool: {{ activeToolLabel }} · Drawings: {{ drawings.count }}
    </p>
  </div>
</template>
```

- [ ] **Step 3: Type-check + lint the new code.**

Run:
```powershell
pnpm -C D:\Work\UraanAI\Public\MapForge lint
Get-ChildItem -Path D:\Work\UraanAI\Public\MapForge -Recurse -Filter *.tsbuildinfo | Remove-Item -Force
pnpm -C D:\Work\UraanAI\Public\MapForge type-check
```
Expected: lint passes (auto-fixes import order); type-check passes cache-free. If `@lucide/vue` lacks a named `Pentagon`/`Ruler`/`Trash2` export, the type-check/lint will flag it — substitute the closest valid Lucide export and update `ICONS`.

- [ ] **Step 4: Commit**

```powershell
git -C D:\Work\UraanAI\Public\MapForge add -A
git -C D:\Work\UraanAI\Public\MapForge commit -m @'
feat: fresh app shell — boots to a full-screen MapLibre map

main.ts (Pinia, router, PrimeVue unstyled, LUCIDE_CONTEXT, context-menu
suppression), App.vue + one-route router + MapHome, MapView (map + tool wiring),
MapControls (tool toggles, clear, basemap select), adapted index.html.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
'@
```

---

## Phase 3 — Verification

Goal: the full static gauntlet is green and the running app passes the Stage-1 runtime checks. Depends on Phase 2.

### Task 3.1: Static gauntlet

**Files:** none (may require small fixes surfaced by the tools).

- [ ] **Step 1: Run each gate; fix any failure at its root.**

```powershell
cd D:\Work\UraanAI\Public\MapForge
pnpm lint
pnpm format:check
Get-ChildItem -Recurse -Filter *.tsbuildinfo | Remove-Item -Force
pnpm type-check
pnpm test
pnpm spell
pnpm build
pnpm docs:build
```
Expected: all green. Likely small fixes:
- **spell:** add any newly-flagged word to `dictionaries/project.txt` (never `cspell.json`).
- **format:check:** run `pnpm format` to auto-fix, then re-check.
- **type-check:** run cache-free (the tsbuildinfo delete above).
- **lint (`primevue/*` restriction):** consumer files importing PrimeVue should go through `ui/*`; the `ui/**` files are exempt. `MapControls` imports only `ui/*` + `@lucide/vue` — compliant.

- [ ] **Step 2: Commit any fixes.**

```powershell
git -C D:\Work\UraanAI\Public\MapForge add -A
git -C D:\Work\UraanAI\Public\MapForge commit -m @'
chore: green the static gauntlet (lint, type-check, test, spell, build, docs)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
'@
```
(Skip if there was nothing to fix.)

---

### Task 3.2: Stage-1 runtime verification (Playwright MCP)

**Files:** none (screenshots to `.verification-screenshots/feat-scaffold/`, gitignored).

- [ ] **Step 1: Start the dev server.**

Run (background): `pnpm -C D:\Work\UraanAI\Public\MapForge dev`
Expected: Vite serves at `http://localhost:5173`.

- [ ] **Step 2: Probe for Playwright MCP tools.**

If `mcp__plugin_playwright_playwright__*` aren't loaded, run `ToolSearch` with `query: "playwright browser"`. If unavailable, fall back to a manual smoke test and record it explicitly.

- [ ] **Step 3: Drive the runtime assertions** (navigate `http://localhost:5173`, capture a screenshot at each checkpoint):

1. **Boots to map:** `[data-testid="map-container"]` is present and fills the viewport; the MapLibre `<canvas>` exists; **0 console errors** at load.
2. **Measure tool:** click `[data-testid="tool-measure-distance"]` → `aria-pressed="true"`, status line shows `Tool: Measure distance`. Click two points on the map, then double-click → a finalized LineString renders (drawings count → 1).
3. **Draw-polygon tool:** click `[data-testid="tool-draw-polygon"]` → status shows `Tool: Draw polygon`. Click three points, double-click → a polygon renders (count → 2).
4. **Clear:** click `[data-testid="clear-drawings"]` → rendered drawings disappear; status `Drawings: 0`; button becomes disabled.
5. **Basemap:** open `[data-testid="basemap-select"]`, choose "Positron" → style switches with no console error; previously-drawn shapes (if any re-added) still render via the `styledata` re-add.

- [ ] **Step 4: Record results.** Produce a Stage-1 table (assertion id · description · result · screenshot path) with console-error/warning counts and a PASS/FAIL line. If any assertion fails, fix the root cause and re-run before proceeding.

- [ ] **Step 5: Stop the dev server.**

---

### Task 3.3: Stage-2 human review + finish the branch

**Files:** none.

- [ ] **Step 1: Present the Stage-2 checklist** for the user to tick (`pnpm dev`, open `http://localhost:5173`):

```
- [ ] The map fills the entire viewport with no gaps or scrollbars.
- [ ] The control overlay is legible, well-positioned (top-left), and readable over the map.
- [ ] Tool buttons clearly show active vs inactive state; icons read correctly.
- [ ] Drawn measure lines and polygons are visually distinct and easy to see.
- [ ] Switching basemaps feels instant and the controls stay readable on each.
- [ ] Ready to merge.
```

- [ ] **Step 2: After approval, finish the branch.** Invoke the `superpowers:finishing-a-development-branch` skill. With no remote yet, the expected path is a local merge to `main`:

```powershell
git -C D:\Work\UraanAI\Public\MapForge checkout main
git -C D:\Work\UraanAI\Public\MapForge merge --no-ff feat/scaffold -m "feat: scaffold MapForge (map-first MapLibre sandbox)"
```

- [ ] **Step 3: Delete the planning artifact.** `HANDOFF.md` is a temporary planning doc (it says so) — remove it once scaffolding is complete, and commit.

```powershell
git -C D:\Work\UraanAI\Public\MapForge rm HANDOFF.md
git -C D:\Work\UraanAI\Public\MapForge commit -m "docs: remove HANDOFF planning artifact (scaffold complete)"
```

---

## Self-review (spec coverage)

- §1–4 (summary/goals/approach/identity): package.json identity, fresh shell, monorepo workspace → Tasks 0.1, 2.4. ✔
- §5 (repo structure): every listed file created or explicitly dropped → all phases. ✔
- §6 (boot flow): main.ts → App.vue → MapHome → MapView; Pinia/router/PrimeVue unstyled/LUCIDE_CONTEXT/context-menu suppression; no seed/theme/chrome/preset → Task 2.4. ✔
- §7 (component/composable design): MapView wiring, MapControls overlay, useDrawingLayer source/layers + watch + styledata → Tasks 2.3, 2.5. ✔
- §8 (ported verbatim): map core, tools, geo, stores, utils, primitive subset, styles → Tasks 1.1–1.3, 2.1–2.2 (with the §8-prescribed trims for Tooltip/Select/ContextMenu + the fonts-import drop in main.css). ✔
- §9 (fresh files): main.ts, App.vue, MapView, MapControls, useDrawingLayer, router/{index,routes}, MapHome, index.html → Tasks 2.3–2.5. ✔
- §10 (dropped): nothing from the drop list is created; toast/confirm deferred → confirmed across phases. ✔
- §11 (deps + scripts): trimmed package.json with the refined ledger → Task 0.1 (+ Deviations §2). ✔
- §12 (config changes): vite (no Cesium), index.html (static theme), env.d.ts (no WS, +style URL), .env.example, tsconfig kept → Tasks 0.3, 0.10, 2.4. ✔
- §13 (meta-infra adaptation): rules ×6, skills removed, .github (governance dropped, ci single-source step removed), dictionaries, docs, CLAUDE.md, .internal dropped → Tasks 0.7–0.9. ✔
- §14 (plugin placeholder): `pnpm-workspace.yaml` `packages/*` + `packages/.gitkeep` → Task 0.1. ✔
- §15 (testing): five ported specs + setup; fresh useDrawingLayer test; dropped-system tests skipped; fake-indexeddb dropped → Tasks 1.4, 2.3. ✔
- §16 (verification): static gauntlet + Stage-1 Playwright + Stage-2 checklist → Phase 3. ✔
- §17 (open questions): minimal router kept, drawings in-memory, toast/confirm deferred, plugin = separate spec → followed. ✔

No spec requirement is left without a task.
