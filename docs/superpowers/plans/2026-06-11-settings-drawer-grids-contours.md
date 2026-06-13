# Settings Drawer, Grid Overlays, Contours & Cursor Readout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all map controls into a left settings drawer (gear icon, top-left) and add graticule / H3-hexagon / MGRS grid overlays, DEM contour lines, and a bottom-right cursor-coordinate readout — each independently toggleable and persisted.

**Architecture:** A serializable `overlays` Pinia store holds the toggle flags; one focused composable per overlay owns its MapLibre lifecycle and watches its store flag, re-adding itself on every `style.load` (basemap switches wipe sources/layers). The drawer flips store flags; the readout reads them. Pure geometry/format logic is extracted into `modules/geo/*` so it's unit-testable without a map.

**Tech Stack:** Vue 3 + Pinia + PrimeVue (unstyled) + MapLibre GL 5, `maplibre-contour`, `geogrid-maplibre-gl`, existing `h3-js` / `mgrs` / `@vueuse/core`.

**Spec:** `docs/superpowers/specs/2026-06-11-settings-drawer-grids-contours-design.md`

**Project conventions that govern this plan:**

- Map instance lives in a `shallowRef`, never reactive state.
- Pinia stores hold serializable state only; expose actions, read via `storeToRefs`.
- Composables own lifecycle; re-add overlay sources/layers on `styledata`/`style.load` (a `setStyle` basemap switch wipes them). Guard adds with `getSource`/`getLayer`.
- Library-first: wrap PrimeVue components under `src/components/ui/*` with `:pt` tokens; no raw `<button>`/`<input>` outside `ui/**`.
- Testing: unit-test pure utilities + store logic (Vitest + `@vue/test-utils`); imperative map-plugin wiring is verified at runtime (Playwright MCP), not unit-tested.
- Verify the running app after wiring each overlay (drawer toggle → overlay appears, survives a basemap switch, console clean). Screenshots → `.verification-screenshots/<branch>/`.
- Conventional Commits; commit body lines ≤ 120 chars; end agent commits with the `Co-Authored-By: Claude …` trailer. Branch already created: `feat/settings-drawer-overlays`.

---

## File Structure

**Create:**

- `src/stores/overlays.ts` — toggle flags + contour units + basemapId; persisted to localStorage; actions.
- `src/components/ui/Drawer.vue` — PrimeVue `Drawer` wrapper (`:pt` tokens).
- `src/components/ui/ToggleSwitch.vue` — PrimeVue `ToggleSwitch` wrapper (`:pt` tokens).
- `src/components/SettingsDrawer.vue` — gear `IconButton` → left `Drawer`; basemap select + overlay toggles + contour-units control.
- `src/components/CoordinateReadout.vue` — bottom-right cursor-coordinate overlay.
- `src/composables/useCoordinateReadout.ts` — mousemove → formatted coordinate string.
- `src/composables/useGraticule.ts` — `geogrid-maplibre-gl` lifecycle.
- `src/composables/useHexGrid.ts` — H3 viewport overlay lifecycle.
- `src/composables/useMgrsGrid.ts` — MGRS viewport overlay lifecycle.
- `src/composables/useContours.ts` — `maplibre-contour` lifecycle.
- `src/modules/geo/grid.ts` — pure geometry: viewport bbox → H3 cell GeoJSON; MGRS grid-line GeoJSON; zoom→resolution/interval helpers.
- Tests: `tests/unit/stores/overlays.spec.ts`, `tests/unit/modules/geo/grid.spec.ts`, `tests/unit/composables/coordinateFormat.spec.ts`.

**Modify:**

- `src/composables/useTerrain.ts` — read `store.terrain` instead of owning `enabled`.
- `src/components/MapView.vue` — mount the composables + `SettingsDrawer` + `CoordinateReadout`; own `switchBasemap`.
- `src/modules/geo/coords.ts` — add `formatForReadout(lat, lon, mgrs: boolean)` (MGRS with lat/lon fallback, else DD).
- `package.json` — add `maplibre-contour`, `geogrid-maplibre-gl`.
- `dictionaries/tech.txt` — `graticule`, `geogrid`, `mlcontour`, `gzd`, `easting`, `northing`.
- `README.md`, `docs/architecture.md`, locked-stack table — document overlays + new deps.

**Delete:**

- `src/components/MapControls.vue` — absorbed by `SettingsDrawer`.

---

## Phase 0 — Dependencies

### Task 0.1: Install the two libraries

**Files:** Modify `package.json` (+ `pnpm-lock.yaml`).

- [ ] **Step 1: Install**

Run: `pnpm add maplibre-contour geogrid-maplibre-gl`
Expected: both added to `dependencies`; lockfile updated.

- [ ] **Step 2: Verify types resolve**

Run: `pnpm exec node -e "require.resolve('maplibre-contour'); require.resolve('geogrid-maplibre-gl')"`
Expected: no error.

- [ ] **Step 3: Add a shim if `geogrid-maplibre-gl` ships no types**

Check `node_modules/geogrid-maplibre-gl` for a `.d.ts` or `types` field. If absent, add to `src/shims.d.ts`:

```ts
declare module "geogrid-maplibre-gl" {
  import type { Map as MaplibreMap } from "maplibre-gl";
  export interface GeoGridOptions {
    map: MaplibreMap;
    beforeLayerId?: string;
    gridStyle?: { color?: string; width?: number; dasharray?: number[] };
    labelStyle?: { color?: string; fontSize?: number; textShadow?: string };
    zoomLevelRange?: [number, number];
    gridDensity?: (zoom: number) => number;
    formatLabels?: (degrees: number) => number | string;
  }
  export class GeoGrid {
    constructor(options: GeoGridOptions);
    add(): void;
    remove(): void;
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/shims.d.ts
git commit -m "build: add maplibre-contour and geogrid-maplibre-gl"
```

---

## Phase 1 — Foundation: overlays store + drawer shell

### Task 1.1: Overlays store (TDD)

**Files:** Create `src/stores/overlays.ts`; Test `tests/unit/stores/overlays.spec.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { setActivePinia, createPinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useOverlaysStore } from "@/stores/overlays";

describe("overlays store", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("defaults every overlay to off and units to meters", () => {
    const s = useOverlaysStore();
    expect(s.graticule).toBe(false);
    expect(s.mgrsGrid).toBe(false);
    expect(s.contourUnits).toBe("m");
  });

  it("toggle(key) flips a single flag", () => {
    const s = useOverlaysStore();
    s.toggle("graticule");
    expect(s.graticule).toBe(true);
    s.toggle("graticule");
    expect(s.graticule).toBe(false);
  });

  it("persists flags to localStorage", () => {
    const s = useOverlaysStore();
    s.toggle("mgrsGrid");
    expect(localStorage.getItem("mapforge:overlay:mgrsGrid")).toContain("true");
  });

  it("setContourUnits and setBasemap update state", () => {
    const s = useOverlaysStore();
    s.setContourUnits("ft");
    s.setBasemap("google-satellite");
    expect(s.contourUnits).toBe("ft");
    expect(s.basemapId).toBe("google-satellite");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/unit/stores/overlays.spec.ts`
Expected: FAIL — cannot find module `@/stores/overlays`.

- [ ] **Step 3: Implement the store**

```ts
import { useLocalStorage } from "@vueuse/core";
import { defineStore } from "pinia";

/** Boolean overlay toggles the settings drawer controls. */
export type OverlayKey = "contours" | "graticule" | "hexGrid" | "mgrsGrid" | "terrain";
export type ContourUnits = "ft" | "m";

/**
 * Serializable map-overlay settings, persisted to localStorage so a reload
 * restores the last basemap + overlay set. Components read via `storeToRefs`
 * and mutate only through the actions.
 */
export const useOverlaysStore = defineStore("overlays", () => {
  const graticule = useLocalStorage("mapforge:overlay:graticule", false);
  const hexGrid = useLocalStorage("mapforge:overlay:hexGrid", false);
  const mgrsGrid = useLocalStorage("mapforge:overlay:mgrsGrid", false);
  const contours = useLocalStorage("mapforge:overlay:contours", false);
  const terrain = useLocalStorage("mapforge:overlay:terrain", false);
  const contourUnits = useLocalStorage<ContourUnits>("mapforge:overlay:contourUnits", "m");
  const basemapId = useLocalStorage("mapforge:overlay:basemapId", "");

  const flags = { graticule, hexGrid, mgrsGrid, contours, terrain };

  function toggle(key: OverlayKey): void {
    flags[key].value = !flags[key].value;
  }
  function setContourUnits(u: ContourUnits): void {
    contourUnits.value = u;
  }
  function setBasemap(id: string): void {
    basemapId.value = id;
  }

  return {
    graticule,
    hexGrid,
    mgrsGrid,
    contours,
    terrain,
    contourUnits,
    basemapId,
    toggle,
    setContourUnits,
    setBasemap,
  };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/unit/stores/overlays.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stores/overlays.ts tests/unit/stores/overlays.spec.ts
git commit -m "feat: add persisted overlays settings store"
```

### Task 1.2: `ui/ToggleSwitch.vue` wrapper

**Files:** Create `src/components/ui/ToggleSwitch.vue`.

- [ ] **Step 1: Implement** (no unit test — UI primitive, verified at runtime)

```vue
<script setup lang="ts">
import PvToggleSwitch from "primevue/toggleswitch";

import { cn } from "@/utils/cn";

/** ToggleSwitch — thin wrapper over PrimeVue ToggleSwitch, token-styled via :pt. */
withDefaults(defineProps<{ modelValue?: boolean; disabled?: boolean }>(), {
  modelValue: false,
  disabled: false,
});
defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

<template>
  <PvToggleSwitch
    :model-value="modelValue"
    :disabled="disabled"
    :pt="{
      root: {
        class: cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
          'bg-surface-sunken data-[p-checked=true]:bg-accent-600',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)]',
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
        ),
      },
      slider: { class: 'hidden' },
      handle: {
        class: cn(
          'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform',
          'data-[p-checked=true]:translate-x-4',
        ),
      },
    }"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
  />
</template>
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec vue-tsc --build`
Expected: no errors. (If PrimeVue's `pt` slot/handle keys differ, adjust to the keys reported; confirm against `/websites/primevue` via Context7.)

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ToggleSwitch.vue
git commit -m "feat: add ui/ToggleSwitch PrimeVue wrapper"
```

### Task 1.3: `ui/Drawer.vue` wrapper

**Files:** Create `src/components/ui/Drawer.vue`.

- [ ] **Step 1: Implement**

```vue
<script setup lang="ts">
import PvDrawer from "primevue/drawer";

import { cn } from "@/utils/cn";

/**
 * Drawer — thin wrapper over PrimeVue Drawer (unstyled), token-styled via :pt.
 * Left-positioned by default. `v-model:visible` controls open state.
 */
withDefaults(defineProps<{ visible?: boolean; header?: string; position?: "left" | "right" }>(), {
  visible: false,
  header: undefined,
  position: "left",
});
defineEmits<{ "update:visible": [value: boolean] }>();
</script>

<template>
  <PvDrawer
    :visible="visible"
    :header="header"
    :position="position"
    :pt="{
      root: {
        class: cn('bg-surface-raised text-foreground border-border w-72 border-r shadow-xl'),
      },
      header: { class: 'flex items-center justify-between px-4 py-3 border-b border-border' },
      title: { class: 'text-sm font-semibold' },
      content: { class: 'p-4 flex flex-col gap-3 overflow-y-auto' },
      mask: { class: 'bg-black/30' },
      closeButton: { class: 'text-faint hover:text-foreground' },
    }"
    @update:visible="(v: boolean) => $emit('update:visible', v)"
  >
    <slot />
  </PvDrawer>
</template>
```

- [ ] **Step 2: Type-check** — `pnpm exec vue-tsc --build` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Drawer.vue
git commit -m "feat: add ui/Drawer PrimeVue wrapper"
```

### Task 1.4: `SettingsDrawer.vue` (basemap + terrain only, this phase)

**Files:** Create `src/components/SettingsDrawer.vue`.

This phase wires the drawer shell, the basemap select (moved from `MapControls`), and the terrain toggle. Grid/contour toggles are added as their phases land (Steps reference the same overlay rows; add rows incrementally).

- [ ] **Step 1: Implement the drawer**

```vue
<script setup lang="ts">
import type { StyleSpecification } from "maplibre-gl";

import { Settings } from "@lucide/vue";
import { storeToRefs } from "pinia";
import { computed, ref } from "vue";

import IconButton from "@/components/ui/IconButton.vue";
import Drawer from "@/components/ui/Drawer.vue";
import Select from "@/components/ui/Select.vue";
import ToggleSwitch from "@/components/ui/ToggleSwitch.vue";
import {
  BASEMAPS,
  defaultBasemap,
  localBasemaps,
  resolveBasemapStyle,
} from "@/modules/maplibre/basemaps";
import { localDemConfig } from "@/modules/maplibre/terrain";
import { useDrawingsStore } from "@/stores/drawings";
import { useOverlaysStore } from "@/stores/overlays";

const props = defineProps<{ switchBasemap: (style: StyleSpecification | string) => void }>();

const open = ref(false);
const overlays = useOverlaysStore();
const { graticule, hexGrid, mgrsGrid, contours, terrain } = storeToRefs(overlays);
const drawings = useDrawingsStore();

// Basemap options (grouped Online / Local — same logic the old MapControls used).
const initialBasemap = defaultBasemap();
const onlineBasemaps = initialBasemap.id === "custom" ? [initialBasemap, ...BASEMAPS] : BASEMAPS;
const local = localBasemaps();
const allBasemaps = [...onlineBasemaps, ...local];
const grouped = local.length > 0;
const basemapOptions = computed(() => {
  const toOpts = (list: typeof allBasemaps) => list.map((b) => ({ label: b.label, value: b.id }));
  if (!grouped) return toOpts(onlineBasemaps);
  return [
    { label: "Online", items: toOpts(onlineBasemaps) },
    { label: "Local", items: toOpts(local) },
  ];
});

// Persisted basemap id (or the default).
const selectedBasemap = computed(() => overlays.basemapId || initialBasemap.id);
const demAvailable = localDemConfig() !== null;

function setBasemap(value: null | number | string): void {
  if (typeof value !== "string") return;
  const src = allBasemaps.find((b) => b.id === value);
  if (!src) return;
  overlays.setBasemap(value);
  props.switchBasemap(resolveBasemapStyle(src));
}
</script>

<template>
  <IconButton
    class="bg-surface-raised/90 border-border absolute top-3 left-3 z-10 border shadow-lg backdrop-blur"
    aria-label="Open settings"
    data-testid="settings-button"
    @click="open = true"
  >
    <Settings :size="18" />
  </IconButton>

  <Drawer v-model:visible="open" header="Settings" data-testid="settings-drawer">
    <label class="text-faint text-xs font-semibold tracking-wide uppercase">Basemap</label>
    <Select
      :model-value="selectedBasemap"
      :options="basemapOptions"
      :option-group-label="grouped ? 'label' : undefined"
      :option-group-children="grouped ? 'items' : undefined"
      data-testid="basemap-select"
      @update:model-value="setBasemap"
    />

    <hr class="border-border my-1" />
    <label class="text-faint text-xs font-semibold tracking-wide uppercase">Overlays</label>

    <label v-if="demAvailable" class="flex items-center justify-between gap-2 text-sm">
      <span>3D Terrain</span>
      <ToggleSwitch
        :model-value="terrain"
        data-testid="toggle-terrain"
        @update:model-value="overlays.toggle('terrain')"
      />
    </label>

    <!-- Grid + contour rows are added in their phases (graticule, hexGrid, mgrsGrid, contours). -->

    <hr class="border-border my-1" />
    <p class="text-muted text-xs" data-testid="status-line">Drawings: {{ drawings.count }}</p>
  </Drawer>
</template>
```

- [ ] **Step 2: Refactor `useTerrain` to read the store**

Modify `src/composables/useTerrain.ts`:

- Remove the internal `enabled` ref and `toggle`. Import and read the store:

```ts
import { useOverlaysStore } from "@/stores/overlays";
// inside useTerrain(mapRef):
const overlays = useOverlaysStore();
const dem = localDemConfig();
const available = ref(dem !== null);
// Replace `enabled.value` reads with `overlays.terrain`. Watch the store flag:
watch(
  () => overlays.terrain,
  (on) => {
    const map = bound;
    if (!map || !available.value) return;
    applyTerrain(map);
    if (on && map.getPitch() < 30) map.easeTo({ pitch: 60, duration: 600 });
    else if (!on && map.getPitch() > 0) map.easeTo({ pitch: 0, duration: 600 });
  },
);
```

- `applyTerrain` uses `overlays.terrain && dem` instead of `enabled.value`.
- `onStyleLoad` uses `overlays.terrain`.
- `suspendForStyleSwitch` uses `overlays.terrain`.
- Return `{ available, suspendForStyleSwitch }` (drop `enabled`/`toggle` — the drawer owns the toggle now).

- [ ] **Step 3: Swap `MapControls` → `SettingsDrawer` in `MapView.vue`, delete `MapControls.vue`**

Modify `src/components/MapView.vue`:

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";

import CoordinateReadout from "@/components/CoordinateReadout.vue";
import SettingsDrawer from "@/components/SettingsDrawer.vue";
import { useCoordinateReadout } from "@/composables/useCoordinateReadout";
import { useContours } from "@/composables/useContours";
import { useGraticule } from "@/composables/useGraticule";
import { useHexGrid } from "@/composables/useHexGrid";
import { useMapLibre } from "@/composables/useMapLibre";
import { useMgrsGrid } from "@/composables/useMgrsGrid";
import { useTerraDraw } from "@/composables/useTerraDraw";
import { useTerrain } from "@/composables/useTerrain";

const container = ref<HTMLDivElement | null>(null);
const { map, mount } = useMapLibre();
const { switchBasemap: applyBasemapStyle } = useTerraDraw(map);
const { suspendForStyleSwitch } = useTerrain(map);
useGraticule(map);
useHexGrid(map);
useMgrsGrid(map);
useContours(map);
const { text: readout } = useCoordinateReadout(map);

function switchBasemap(style: Parameters<typeof applyBasemapStyle>[0]): void {
  suspendForStyleSwitch();
  applyBasemapStyle(style);
}

onMounted(() => {
  if (container.value) mount(container.value);
});
</script>

<template>
  <div class="relative h-screen w-screen overflow-hidden">
    <div ref="container" class="bg-surface-sunken h-full w-full" data-testid="map-container" />
    <SettingsDrawer :switch-basemap="switchBasemap" />
    <CoordinateReadout :text="readout" />
  </div>
</template>
```

> NOTE: `useGraticule`/`useHexGrid`/`useMgrsGrid`/`useContours`/`useCoordinateReadout`/`CoordinateReadout.vue` are created in later phases. To keep this phase compiling, create **no-op stubs** for them now (each: `export function useX(_map) {}`; readout stub returns `{ text: ref("") }`; `CoordinateReadout.vue` renders nothing), and flesh them out in their phases. Stub code:

```ts
// src/composables/useGraticule.ts (stub) — replace in Phase 3
import type { Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";
export function useGraticule(_map: ShallowRef<MaplibreMap | null>): void {}
```

(Same shape for `useHexGrid`, `useMgrsGrid`, `useContours`.)

```ts
// src/composables/useCoordinateReadout.ts (stub) — replace in Phase 2
import type { Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";
import { ref } from "vue";
export function useCoordinateReadout(_map: ShallowRef<MaplibreMap | null>) {
  return { text: ref("") };
}
```

```vue
<!-- src/components/CoordinateReadout.vue (stub) — replace in Phase 2 -->
<script setup lang="ts">
defineProps<{ text: string }>();
</script>
<template>
  <span v-if="false">{{ text }}</span>
</template>
```

- [ ] **Step 4: Delete `MapControls.vue` and update docs references**

Run: `git rm src/components/MapControls.vue`
Update `docs/architecture.md` "Controls" section + boot-flow line to reference `SettingsDrawer` instead of `MapControls`.

- [ ] **Step 5: Static gauntlet**

Run: `pnpm lint && pnpm exec vitest run && pnpm type-check`
Expected: pass (pre-existing warnings only).

- [ ] **Step 6: Runtime verify (Playwright MCP)**

`pnpm dev`; open the app. Assert: gear icon top-left; click → drawer opens with Basemap select + 3D Terrain toggle (only if DEM configured) + Drawings line; switching basemap works; terrain toggle tilts/flattens; close drawer; console clean. Screenshot → `.verification-screenshots/feat-settings-drawer-overlays/phase1-drawer.png`.

- [ ] **Step 7: Commit**

```bash
git add src/components/SettingsDrawer.vue src/components/MapView.vue src/composables/useTerrain.ts \
        src/composables/useGraticule.ts src/composables/useHexGrid.ts src/composables/useMgrsGrid.ts \
        src/composables/useContours.ts src/composables/useCoordinateReadout.ts \
        src/components/CoordinateReadout.vue docs/architecture.md
git rm src/components/MapControls.vue
git commit -m "feat: settings drawer consolidates basemap + terrain controls"
```

---

## Phase 2 — Cursor coordinate readout

### Task 2.1: `formatForReadout` (TDD)

**Files:** Modify `src/modules/geo/coords.ts`; Test `tests/unit/composables/coordinateFormat.spec.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { formatForReadout } from "@/modules/geo/coords";

describe("formatForReadout", () => {
  it("returns decimal degrees when mgrs is false", () => {
    expect(formatForReadout(30, 70, false)).toBe("30.0000°N 70.0000°E");
  });

  it("returns an MGRS string when mgrs is true and in range", () => {
    const out = formatForReadout(30, 70, true);
    expect(out).toMatch(/^\d{1,2}[C-X]/); // GZD prefix, e.g. "42R..."
  });

  it("falls back to lat/lon when MGRS is undefined (out of range, e.g. > 84°)", () => {
    const out = formatForReadout(88, 70, true);
    expect(out).toContain("°N");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run tests/unit/composables/coordinateFormat.spec.ts`
Expected: FAIL — `formatForReadout` is not exported.

- [ ] **Step 3: Implement** — append to `src/modules/geo/coords.ts`:

```ts
/**
 * Format a cursor position for the on-map readout. When `mgrs` is true, return
 * an MGRS grid reference, falling back to decimal degrees if MGRS can't be
 * computed (e.g. beyond the ±80–84° UTM range, where `mgrs` throws). Otherwise
 * return decimal degrees.
 */
export function formatForReadout(lat: number, lon: number, mgrs: boolean): string {
  if (mgrs) {
    try {
      return latLonToMGRS(lat, lon);
    } catch {
      return latLonToDecimal(lat, lon);
    }
  }
  return latLonToDecimal(lat, lon);
}
```

- [ ] **Step 4: Run to verify it passes** — `pnpm exec vitest run tests/unit/composables/coordinateFormat.spec.ts` → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/geo/coords.ts tests/unit/composables/coordinateFormat.spec.ts
git commit -m "feat: add formatForReadout (MGRS-or-lat/lon) helper"
```

### Task 2.2: `useCoordinateReadout` + `CoordinateReadout.vue` (replace stubs)

**Files:** Replace `src/composables/useCoordinateReadout.ts` and `src/components/CoordinateReadout.vue`.

- [ ] **Step 1: Implement the composable**

```ts
import type { Map as MaplibreMap, MapMouseEvent } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { onBeforeUnmount, ref, watch } from "vue";

import { formatForReadout } from "@/modules/geo/coords";
import { useOverlaysStore } from "@/stores/overlays";

/**
 * Bottom-right cursor readout. Tracks the pointer over the map and formats the
 * position as MGRS (when the MGRS grid is on, with lat/lon fallback) or decimal
 * degrees. Returns a reactive string for `CoordinateReadout.vue`.
 */
export function useCoordinateReadout(mapRef: ShallowRef<MaplibreMap | null>) {
  const overlays = useOverlaysStore();
  const text = ref("");
  let bound: MaplibreMap | null = null;
  let lastLngLat: { lat: number; lng: number } | null = null;

  function render(): void {
    if (!lastLngLat) {
      text.value = "";
      return;
    }
    text.value = formatForReadout(lastLngLat.lat, lastLngLat.lng, overlays.mgrsGrid);
  }

  function onMove(e: MapMouseEvent): void {
    lastLngLat = { lat: e.lngLat.lat, lng: e.lngLat.lng };
    render();
  }
  function onOut(): void {
    lastLngLat = null;
    text.value = "";
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
  }
  function detach(): void {
    if (!bound) return;
    bound.off("mousemove", onMove);
    bound.off("mouseout", onOut);
    bound = null;
  }

  // Re-render when the MGRS toggle changes so the format switches live.
  watch(() => overlays.mgrsGrid, render);

  watch(
    mapRef,
    (m) => {
      detach();
      if (m) attach(m);
    },
    { immediate: true },
  );
  onBeforeUnmount(detach);

  return { text };
}
```

- [ ] **Step 2: Implement the component**

```vue
<script setup lang="ts">
defineProps<{ text: string }>();
</script>

<template>
  <div
    v-if="text"
    class="bg-surface-raised/90 border-border text-foreground absolute right-3 bottom-3 z-10 rounded-md border px-2 py-1 font-mono text-xs shadow-lg backdrop-blur"
    data-testid="coordinate-readout"
  >
    {{ text }}
  </div>
</template>
```

- [ ] **Step 3: Static gauntlet** — `pnpm lint && pnpm exec vitest run && pnpm type-check` → pass.

- [ ] **Step 4: Runtime verify** — `pnpm dev`; hover the map → bottom-right shows `lat°N lon°E`; toggle MGRS grid on (after Phase 6, or temporarily flip the store flag) → format becomes MGRS; move off-canvas → readout clears; console clean. Screenshot `phase2-readout.png`.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useCoordinateReadout.ts src/components/CoordinateReadout.vue
git commit -m "feat: bottom-right cursor coordinate readout (lat/lon + MGRS)"
```

---

## Phase 3 — Graticule overlay (`geogrid-maplibre-gl`)

### Task 3.1: `useGraticule` (replace stub)

**Files:** Replace `src/composables/useGraticule.ts`; add the toggle row to `SettingsDrawer.vue`.

- [ ] **Step 1: Implement the composable**

```ts
import type { Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { GeoGrid } from "geogrid-maplibre-gl";
import { onBeforeUnmount, watch } from "vue";

import { useOverlaysStore } from "@/stores/overlays";

/**
 * Lat/lon graticule via `geogrid-maplibre-gl`. Constructing a `GeoGrid` adds its
 * layers; `.remove()` / `.add()` toggle them. A basemap switch (`setStyle`)
 * wipes the grid's layers, so we re-`add()` on `style.load` when enabled.
 */
export function useGraticule(mapRef: ShallowRef<MaplibreMap | null>): void {
  const overlays = useOverlaysStore();
  let bound: MaplibreMap | null = null;
  let grid: GeoGrid | null = null;

  function build(map: MaplibreMap): void {
    grid = new GeoGrid({
      map,
      gridStyle: { color: "rgba(255,255,255,0.4)", width: 1 },
      labelStyle: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
      zoomLevelRange: [0, 14],
    });
  }

  function enable(): void {
    if (!bound) return;
    if (!grid) build(bound);
    else grid.add();
  }
  function disable(): void {
    grid?.remove();
  }
  function onStyleLoad(): void {
    if (bound && overlays.graticule) {
      // setStyle wiped the layers; rebuild fresh against the new style.
      grid = null;
      build(bound);
    }
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("style.load", onStyleLoad);
    if (overlays.graticule) enable();
  }
  function detach(): void {
    if (!bound) return;
    bound.off("style.load", onStyleLoad);
    disable();
    grid = null;
    bound = null;
  }

  watch(
    () => overlays.graticule,
    (on) => (on ? enable() : disable()),
  );
  watch(
    mapRef,
    (m) => {
      detach();
      if (m) attach(m);
    },
    { immediate: true },
  );
  onBeforeUnmount(detach);
}
```

> If `new GeoGrid` does not immediately render (needs an explicit `.add()`), call `grid.add()` after `build()`. Confirm at runtime; adjust `enable()` accordingly.

- [ ] **Step 2: Add the drawer toggle row** — in `SettingsDrawer.vue`, inside the Overlays block:

```vue
<label class="flex items-center justify-between gap-2 text-sm">
  <span>Graticule (lat/lon)</span>
  <ToggleSwitch
    :model-value="graticule"
    data-testid="toggle-graticule"
    @update:model-value="overlays.toggle('graticule')"
  />
</label>
```

- [ ] **Step 3: Static gauntlet** — `pnpm lint && pnpm exec vitest run && pnpm type-check` → pass.

- [ ] **Step 4: Runtime verify** — toggle Graticule on → lat/lon lines + labels appear; switch basemap → lines persist (re-added on `style.load`); toggle off → lines gone; console clean. Screenshot `phase3-graticule.png`.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useGraticule.ts src/components/SettingsDrawer.vue
git commit -m "feat: graticule overlay via geogrid-maplibre-gl"
```

---

## Phase 4 — Contours (`maplibre-contour`)

### Task 4.1: `useContours` (replace stub) + units toggle

**Files:** Replace `src/composables/useContours.ts`; add Contours toggle + units control to `SettingsDrawer.vue`.

- [ ] **Step 1: Implement the composable**

```ts
import type { Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import maplibregl from "maplibre-gl";
import mlcontour from "maplibre-contour";
import { onBeforeUnmount, watch } from "vue";

import { localDemConfig } from "@/modules/maplibre/terrain";
import { useOverlaysStore } from "@/stores/overlays";

const SOURCE = "contours";
const LINE_LAYER = "contour-lines";
const LABEL_LAYER = "contour-labels";

// One DemSource + protocol registration per app (module scope).
const dem = localDemConfig();
let demSource: mlcontour.DemSource | null = null;
if (dem) {
  demSource = new mlcontour.DemSource({
    url: dem.tiles[0]!,
    encoding: dem.encoding,
    maxzoom: dem.maxzoom,
    worker: true,
  });
  demSource.setupMaplibre(maplibregl);
}

/** Contour lines + labels from the local DEM. Units (m/ft) drive the multiplier. */
export function useContours(mapRef: ShallowRef<MaplibreMap | null>): void {
  const overlays = useOverlaysStore();
  let bound: MaplibreMap | null = null;

  function add(map: MaplibreMap): void {
    if (!demSource || map.getSource(SOURCE)) return;
    const multiplier = overlays.contourUnits === "ft" ? 3.28084 : 1;
    map.addSource(SOURCE, {
      type: "vector",
      tiles: [
        demSource.contourProtocolUrl({
          multiplier,
          thresholds: {
            11: [200, 1000],
            12: [100, 500],
            13: [100, 500],
            14: [50, 200],
            15: [20, 100],
          },
          contourLayer: "contours",
          elevationKey: "ele",
          levelKey: "level",
        }),
      ],
      maxzoom: 15,
    });
    map.addLayer({
      id: LINE_LAYER,
      type: "line",
      source: SOURCE,
      "source-layer": "contours",
      paint: {
        "line-color": "rgba(120,90,40,0.6)",
        "line-width": ["match", ["get", "level"], 1, 1.2, 0.5],
      },
    });
    map.addLayer({
      id: LABEL_LAYER,
      type: "symbol",
      source: SOURCE,
      "source-layer": "contours",
      filter: [">", ["get", "level"], 0],
      layout: {
        "symbol-placement": "line",
        "text-size": 10,
        "text-field": ["concat", ["number-format", ["get", "ele"], {}], overlays.contourUnits],
        "text-font": ["Noto Sans Regular"],
      },
      paint: { "text-halo-color": "white", "text-halo-width": 1 },
    });
  }

  function remove(map: MaplibreMap): void {
    [LABEL_LAYER, LINE_LAYER].forEach((id) => map.getLayer(id) && map.removeLayer(id));
    if (map.getSource(SOURCE)) map.removeSource(SOURCE);
  }

  function rebuild(): void {
    if (!bound) return;
    remove(bound);
    if (overlays.contours) add(bound);
  }

  function onStyleLoad(): void {
    if (bound && overlays.contours) add(bound);
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("style.load", onStyleLoad);
    if (overlays.contours && map.isStyleLoaded()) add(map);
  }
  function detach(): void {
    if (!bound) return;
    bound.off("style.load", onStyleLoad);
    remove(bound);
    bound = null;
  }

  watch(
    () => overlays.contours,
    () => rebuild(),
  );
  watch(
    () => overlays.contourUnits,
    () => rebuild(),
  );
  watch(
    mapRef,
    (m) => {
      detach();
      if (m) attach(m);
    },
    { immediate: true },
  );
  onBeforeUnmount(detach);
}
```

> Confirm `maplibre-contour`'s default-export shape (`mlcontour.DemSource`) and `contourProtocolUrl` option names against the package during implementation; adjust if the installed version differs.

- [ ] **Step 2: Add drawer rows** (Contours toggle, shown only when DEM configured; m/ft control). In `SettingsDrawer.vue`:

```vue
<template v-if="demAvailable">
  <label class="flex items-center justify-between gap-2 text-sm">
    <span>Contours</span>
    <ToggleSwitch
      :model-value="contours"
      data-testid="toggle-contours"
      @update:model-value="overlays.toggle('contours')"
    />
  </label>
  <div v-if="contours" class="flex items-center justify-between gap-2 pl-3 text-sm">
    <span class="text-muted">Units</span>
    <Select
      :model-value="overlays.contourUnits"
      :options="[
        { label: 'Meters', value: 'm' },
        { label: 'Feet', value: 'ft' },
      ]"
      data-testid="contour-units"
      @update:model-value="(v) => typeof v === 'string' && overlays.setContourUnits(v as 'ft' | 'm')"
    />
  </div>
</template>
```

- [ ] **Step 3: Static gauntlet** — pass.

- [ ] **Step 4: Runtime verify** — toggle Contours on (over the DEM-covered area, mid zoom) → contour lines + elevation labels render; flip Units → labels switch m↔ft and intervals rebuild; switch basemap → contours persist; toggle off → gone; console clean. Screenshot `phase4-contours.png`.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useContours.ts src/components/SettingsDrawer.vue
git commit -m "feat: DEM contour lines via maplibre-contour with m/ft toggle"
```

---

## Phase 5 — Hexagon (H3) grid overlay

### Task 5.1: H3 viewport geometry (TDD)

**Files:** Create `src/modules/geo/grid.ts`; Test `tests/unit/modules/geo/grid.spec.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { h3ResolutionForZoom, hexGridGeoJSON } from "@/modules/geo/grid";

describe("h3 grid", () => {
  it("maps zoom to a bounded H3 resolution", () => {
    expect(h3ResolutionForZoom(2)).toBeLessThan(h3ResolutionForZoom(12));
    expect(h3ResolutionForZoom(0)).toBeGreaterThanOrEqual(0);
    expect(h3ResolutionForZoom(22)).toBeLessThanOrEqual(15);
  });

  it("builds a FeatureCollection of polygons covering a small bbox", () => {
    // bbox: [west, south, east, north]
    const fc = hexGridGeoJSON([70, 30, 70.5, 30.5], 6);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features.length).toBeGreaterThan(0);
    expect(fc.features[0]!.geometry.type).toBe("Polygon");
  });

  it("caps the cell count so a huge bbox at high resolution stays bounded", () => {
    const fc = hexGridGeoJSON([-180, -85, 180, 85], 9);
    expect(fc.features.length).toBeLessThanOrEqual(20000);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm exec vitest run tests/unit/modules/geo/grid.spec.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
import type { Feature, FeatureCollection, Polygon } from "geojson";

import { polygonToCells } from "h3-js";

import { cellBoundaryLonLat } from "./h3";

/** Bounding box as `[west, south, east, north]` (lon/lat degrees). */
export type Bbox = [number, number, number, number];

const MAX_CELLS = 20000;

/** Zoom → H3 resolution (0–15), tuned so on-screen cell counts stay manageable. */
export function h3ResolutionForZoom(zoom: number): number {
  const res = Math.round((zoom - 2) * 0.7);
  return Math.max(0, Math.min(15, res));
}

/** H3 hexagon cells covering `bbox` at `resolution`, as GeoJSON polygons. */
export function hexGridGeoJSON(bbox: Bbox, resolution: number): FeatureCollection<Polygon> {
  const [w, s, e, n] = bbox;
  // h3-js polygonToCells wants [lat, lng] rings, closed implicitly.
  const ring: [number, number][] = [
    [s, w],
    [s, e],
    [n, e],
    [n, w],
    [s, w],
  ];
  let cells: string[] = [];
  try {
    cells = polygonToCells(ring, resolution);
  } catch {
    cells = [];
  }
  if (cells.length > MAX_CELLS) cells = cells.slice(0, MAX_CELLS);
  const features: Feature<Polygon>[] = cells.map((cell) => ({
    type: "Feature",
    properties: { cell },
    geometry: { type: "Polygon", coordinates: [closeRing(cellBoundaryLonLat(cell))] },
  }));
  return { type: "FeatureCollection", features };
}

function closeRing(coords: [number, number][]): [number, number][] {
  if (coords.length === 0) return coords;
  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  return first[0] === last[0] && first[1] === last[1] ? coords : [...coords, first];
}
```

- [ ] **Step 4: Run to verify it passes** — `pnpm exec vitest run tests/unit/modules/geo/grid.spec.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/geo/grid.ts tests/unit/modules/geo/grid.spec.ts
git commit -m "feat: H3 viewport hex-grid geometry helpers"
```

### Task 5.2: `useHexGrid` (replace stub) + toggle row

**Files:** Replace `src/composables/useHexGrid.ts`; add toggle row to `SettingsDrawer.vue`.

- [ ] **Step 1: Implement the composable**

```ts
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { useDebounceFn } from "@vueuse/core";
import { onBeforeUnmount, watch } from "vue";

import { h3ResolutionForZoom, hexGridGeoJSON, type Bbox } from "@/modules/geo/grid";
import { useOverlaysStore } from "@/stores/overlays";

const SOURCE = "hexgrid";
const LAYER = "hexgrid-lines";

/** H3 hexagon grid overlay; recomputes visible cells on move/zoom (debounced). */
export function useHexGrid(mapRef: ShallowRef<MaplibreMap | null>): void {
  const overlays = useOverlaysStore();
  let bound: MaplibreMap | null = null;

  function currentGeoJSON(map: MaplibreMap) {
    const b = map.getBounds();
    const bbox: Bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    return hexGridGeoJSON(bbox, h3ResolutionForZoom(map.getZoom()));
  }

  function add(map: MaplibreMap): void {
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: "geojson", data: currentGeoJSON(map) });
    }
    if (!map.getLayer(LAYER)) {
      map.addLayer({
        id: LAYER,
        type: "line",
        source: SOURCE,
        paint: { "line-color": "rgba(16,196,162,0.5)", "line-width": 1 },
      });
    }
  }
  function update(): void {
    if (!bound || !overlays.hexGrid) return;
    const src = bound.getSource(SOURCE) as GeoJSONSource | undefined;
    src?.setData(currentGeoJSON(bound));
  }
  const updateDebounced = useDebounceFn(update, 150);

  function remove(map: MaplibreMap): void {
    if (map.getLayer(LAYER)) map.removeLayer(LAYER);
    if (map.getSource(SOURCE)) map.removeSource(SOURCE);
  }

  function enable(): void {
    if (bound) add(bound);
  }
  function disable(): void {
    if (bound) remove(bound);
  }
  function onStyleLoad(): void {
    if (bound && overlays.hexGrid) add(bound);
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("style.load", onStyleLoad);
    map.on("moveend", updateDebounced);
    map.on("zoomend", updateDebounced);
    if (overlays.hexGrid && map.isStyleLoaded()) add(map);
  }
  function detach(): void {
    if (!bound) return;
    bound.off("style.load", onStyleLoad);
    bound.off("moveend", updateDebounced);
    bound.off("zoomend", updateDebounced);
    remove(bound);
    bound = null;
  }

  watch(
    () => overlays.hexGrid,
    (on) => (on ? enable() : disable()),
  );
  watch(
    mapRef,
    (m) => {
      detach();
      if (m) attach(m);
    },
    { immediate: true },
  );
  onBeforeUnmount(detach);
}
```

- [ ] **Step 2: Add drawer toggle row** (in `SettingsDrawer.vue`, Overlays block):

```vue
<label class="flex items-center justify-between gap-2 text-sm">
  <span>Hexagon grid (H3)</span>
  <ToggleSwitch
    :model-value="hexGrid"
    data-testid="toggle-hexgrid"
    @update:model-value="overlays.toggle('hexGrid')"
  />
</label>
```

- [ ] **Step 3: Static gauntlet** — pass.

- [ ] **Step 4: Runtime verify** — toggle Hexagon on → hex cells render; pan/zoom → cells recompute (debounced) and stay bounded; switch basemap → persists; toggle off → gone; console clean. Screenshot `phase5-hexgrid.png`.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useHexGrid.ts src/components/SettingsDrawer.vue
git commit -m "feat: H3 hexagon grid overlay"
```

---

## Phase 6 — MGRS grid overlay (heaviest)

### Task 6.1: MGRS grid geometry (TDD)

**Files:** Modify `src/modules/geo/grid.ts`; extend `tests/unit/modules/geo/grid.spec.ts`.

Pragmatic, bounded approach: at the current zoom pick a degree step (`mgrsStepForZoom`), walk a lat/lon lattice clipped to the viewport, and emit grid lines as a `FeatureCollection<LineString>`; label sample points with their MGRS reference (via `latLonToMGRS`, skipping points where it throws). This is a usable reference grid, not a true UTM-zone tessellation — documented as such. Bounded by capping line count.

- [ ] **Step 1: Write the failing test** (append)

```ts
import { mgrsGridGeoJSON, mgrsStepForZoom } from "@/modules/geo/grid";

describe("mgrs grid", () => {
  it("uses a smaller degree step at higher zoom", () => {
    expect(mgrsStepForZoom(3)).toBeGreaterThan(mgrsStepForZoom(12));
  });

  it("builds line features clipped to the bbox", () => {
    const fc = mgrsGridGeoJSON([70, 30, 71, 31], 8);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features.every((f) => f.geometry.type === "LineString")).toBe(true);
    expect(fc.features.length).toBeGreaterThan(0);
  });

  it("stays bounded for a world bbox", () => {
    const fc = mgrsGridGeoJSON([-180, -80, 180, 80], 2);
    expect(fc.features.length).toBeLessThanOrEqual(2000);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — FAIL (functions missing).

- [ ] **Step 3: Implement** (append to `src/modules/geo/grid.ts`)

```ts
import type { LineString } from "geojson";

import { latLonToMGRS } from "./coords";

const MAX_LINES = 2000;

/** Zoom → grid spacing in degrees (coarse when zoomed out, fine when zoomed in). */
export function mgrsStepForZoom(zoom: number): number {
  if (zoom < 4) return 8;
  if (zoom < 7) return 1;
  if (zoom < 10) return 0.1;
  return 0.01;
}

/**
 * A bounded lat/lon reference grid labeled with MGRS, clipped to `bbox`. NOTE:
 * a pragmatic graticule-style grid (not a true UTM-zone/100km tessellation),
 * sufficient for a sandbox MGRS reference.
 */
export function mgrsGridGeoJSON(bbox: Bbox, zoom: number): FeatureCollection<LineString> {
  const [w, s, e, n] = bbox;
  const step = mgrsStepForZoom(zoom);
  const features: Feature<LineString>[] = [];
  const snap = (v: number) => Math.floor(v / step) * step;

  for (let lon = snap(w); lon <= e && features.length < MAX_LINES; lon += step) {
    let label = "";
    try {
      label = latLonToMGRS((s + n) / 2, lon, 0);
    } catch {
      label = "";
    }
    features.push({
      type: "Feature",
      properties: { axis: "lon", value: lon, label },
      geometry: {
        type: "LineString",
        coordinates: [
          [lon, s],
          [lon, n],
        ],
      },
    });
  }
  for (let lat = snap(s); lat <= n && features.length < MAX_LINES; lat += step) {
    features.push({
      type: "Feature",
      properties: { axis: "lat", value: lat },
      geometry: {
        type: "LineString",
        coordinates: [
          [w, lat],
          [e, lat],
        ],
      },
    });
  }
  return { type: "FeatureCollection", features };
}
```

- [ ] **Step 4: Run to verify it passes** — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/geo/grid.ts tests/unit/modules/geo/grid.spec.ts
git commit -m "feat: MGRS reference-grid geometry helpers"
```

### Task 6.2: `useMgrsGrid` (replace stub) + toggle row

**Files:** Replace `src/composables/useMgrsGrid.ts`; add toggle row to `SettingsDrawer.vue`.

- [ ] **Step 1: Implement the composable** (same shape as `useHexGrid`, with a line layer + an MGRS label symbol layer)

```ts
import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { useDebounceFn } from "@vueuse/core";
import { onBeforeUnmount, watch } from "vue";

import { mgrsGridGeoJSON, mgrsStepForZoom, type Bbox } from "@/modules/geo/grid";
import { useOverlaysStore } from "@/stores/overlays";

const SOURCE = "mgrsgrid";
const LINE_LAYER = "mgrsgrid-lines";
const LABEL_LAYER = "mgrsgrid-labels";

/** MGRS reference-grid overlay; recomputes on move/zoom (debounced). */
export function useMgrsGrid(mapRef: ShallowRef<MaplibreMap | null>): void {
  const overlays = useOverlaysStore();
  let bound: MaplibreMap | null = null;

  function currentGeoJSON(map: MaplibreMap) {
    const b = map.getBounds();
    const bbox: Bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    return mgrsGridGeoJSON(bbox, map.getZoom());
  }

  function add(map: MaplibreMap): void {
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: "geojson", data: currentGeoJSON(map) });
    }
    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER,
        type: "line",
        source: SOURCE,
        paint: { "line-color": "rgba(255,210,80,0.55)", "line-width": 1 },
      });
    }
    if (!map.getLayer(LABEL_LAYER)) {
      map.addLayer({
        id: LABEL_LAYER,
        type: "symbol",
        source: SOURCE,
        filter: ["==", ["get", "axis"], "lon"],
        layout: {
          "text-field": ["get", "label"],
          "text-size": 10,
          "text-font": ["Noto Sans Regular"],
          "symbol-placement": "line",
        },
        paint: {
          "text-color": "rgba(255,210,80,0.9)",
          "text-halo-color": "black",
          "text-halo-width": 1,
        },
      });
    }
  }
  function update(): void {
    if (!bound || !overlays.mgrsGrid) return;
    (bound.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(currentGeoJSON(bound));
  }
  const updateDebounced = useDebounceFn(update, 150);

  function remove(map: MaplibreMap): void {
    [LABEL_LAYER, LINE_LAYER].forEach((id) => map.getLayer(id) && map.removeLayer(id));
    if (map.getSource(SOURCE)) map.removeSource(SOURCE);
  }

  function onStyleLoad(): void {
    if (bound && overlays.mgrsGrid) add(bound);
  }
  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("style.load", onStyleLoad);
    map.on("moveend", updateDebounced);
    map.on("zoomend", updateDebounced);
    if (overlays.mgrsGrid && map.isStyleLoaded()) add(map);
  }
  function detach(): void {
    if (!bound) return;
    bound.off("style.load", onStyleLoad);
    bound.off("moveend", updateDebounced);
    bound.off("zoomend", updateDebounced);
    remove(bound);
    bound = null;
  }

  watch(
    () => overlays.mgrsGrid,
    (on) => (on ? bound && add(bound) : bound && remove(bound)),
  );
  watch(
    mapRef,
    (m) => {
      detach();
      if (m) attach(m);
    },
    { immediate: true },
  );
  onBeforeUnmount(detach);
}
```

- [ ] **Step 2: Add drawer toggle row**

```vue
<label class="flex items-center justify-between gap-2 text-sm">
  <span>MGRS grid</span>
  <ToggleSwitch
    :model-value="mgrsGrid"
    data-testid="toggle-mgrsgrid"
    @update:model-value="overlays.toggle('mgrsGrid')"
  />
</label>
```

- [ ] **Step 3: Static gauntlet** — pass.

- [ ] **Step 4: Runtime verify** — toggle MGRS on → grid lines + MGRS labels render and the **cursor readout switches to MGRS** (Phase 2 integration); pan/zoom → recomputes, bounded; switch basemap → persists; toggle off → gone + readout returns to lat/lon; console clean. Screenshot `phase6-mgrs.png`.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useMgrsGrid.ts src/components/SettingsDrawer.vue
git commit -m "feat: MGRS reference grid overlay + readout integration"
```

---

## Phase 7 — Docs, stack table, final verification

### Task 7.1: Documentation sync

**Files:** Modify `README.md`, `docs/architecture.md`, `.agent/rules/project-and-stack.md`, `dictionaries/tech.txt`.

- [ ] **Step 1:** Locked-stack table (`.agent/rules/project-and-stack.md`) + README Stack: add `maplibre-contour` (contours) and `geogrid-maplibre-gl` (graticule) rows; note H3/MGRS grids built on existing `h3-js`/`mgrs`.
- [ ] **Step 2:** README: new "Overlays & settings drawer" section (gear → drawer; the five toggles; cursor readout; contour units; everything persists).
- [ ] **Step 3:** `docs/architecture.md`: new "Overlays" section — `overlays` store + one composable per overlay + `style.load` re-add lifecycle + `SettingsDrawer`/`CoordinateReadout`; update "Controls" section (MapControls → SettingsDrawer).
- [ ] **Step 4:** `dictionaries/tech.txt`: add `graticule`, `geogrid`, `mlcontour`, `gzd`, `easting`, `northing`. Run `pnpm spell` → 0 issues.
- [ ] **Step 5: Commit** — `git commit -am "docs: document overlays, settings drawer & cursor readout"`

### Task 7.2: Full gauntlet + end-to-end runtime sweep

- [ ] **Step 1:** Cache-free type-check: `Get-ChildItem -Recurse -Filter *.tsbuildinfo | Remove-Item -Force; pnpm type-check`
- [ ] **Step 2:** `pnpm lint && pnpm exec vitest run && pnpm spell && pnpm build && pnpm docs:build` → all green.
- [ ] **Step 3: Runtime sweep (Playwright MCP):** with the LAN/tunnel tiles configured — open drawer; enable all five overlays together; confirm each renders, the readout shows MGRS; switch through Liberty → Google Satellite → Local OSM → Google Satellite + Hybrid and confirm **every overlay survives each switch** (re-added on `style.load`) with terrain on; reload the page and confirm settings persisted; console clean throughout. Screenshots per checkpoint.
- [ ] **Step 4: Human-review checklist** (markdown task-list): overlays legible/distinct; drawer readable + positioned; readout unobtrusive; grids align; contours readable; `- [ ] Ready to merge`.

---

## Self-Review (against the spec)

- **Spec coverage:** drawer + gear (P1) ✓; basemap consolidation (P1) ✓; terrain in drawer (P1, store refactor) ✓; cursor readout MGRS-or-lat/lon (P2) ✓; graticule (P3) ✓; contours + m/ft (P4) ✓; H3 grid (P5) ✓; MGRS grid (P6) ✓; persistence (P1 store) ✓; per-overlay `style.load` re-add ✓; deps (P0) ✓; docs/stack/cspell (P7) ✓; unit tests for store/geometry/format + runtime for wiring ✓.
- **Placeholder scan:** no TBD/TODO; the two "confirm against the installed package" notes (geogrid `.add()` timing, `maplibre-contour` export shape) are explicit runtime checks, not deferred work.
- **Type consistency:** store keys (`graticule`/`hexGrid`/`mgrsGrid`/`contours`/`terrain`, `contourUnits`, `basemapId`) match across store, composables, and drawer; `Bbox` and helper names (`hexGridGeoJSON`, `h3ResolutionForZoom`, `mgrsGridGeoJSON`, `mgrsStepForZoom`, `formatForReadout`) match between `modules/geo/grid.ts`/`coords.ts`, their tests, and the composables; `suspendForStyleSwitch` retained on `useTerrain`.
- **Known iteration points (flagged, not blockers):** geogrid `new GeoGrid` vs explicit `.add()` on first render; `maplibre-contour` default-export/option names; MGRS grid is a pragmatic reference grid (documented), not a true UTM tessellation; PrimeVue `ToggleSwitch` `:pt` slot keys.
