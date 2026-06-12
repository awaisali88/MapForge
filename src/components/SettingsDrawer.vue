<script setup lang="ts">
import type { StyleSpecification } from "maplibre-gl";

import { Settings } from "@lucide/vue";
import { storeToRefs } from "pinia";
import { computed, ref } from "vue";

import Drawer from "@/components/ui/Drawer.vue";
import IconButton from "@/components/ui/IconButton.vue";
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
const {
  terrain,
  graticule,
  contours,
  hexGrid,
  mgrsGrid,
  globe,
  mgrsAuto,
  mgrsAccuracy,
  hexAuto,
  hexResolution,
} = storeToRefs(overlays);
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

// MGRS accuracy options: value matches MgrsAccuracy (0–4).
const mgrsAccuracyOptions = [
  { label: "100 km", value: 0 },
  { label: "10 km", value: 1 },
  { label: "1 km", value: 2 },
  { label: "100 m", value: 3 },
  { label: "10 m", value: 4 },
];

// H3 resolution options: value matches H3 resolution level (0–8).
const h3ResolutionOptions = [
  { label: "Res 0", value: 0 },
  { label: "Res 1", value: 1 },
  { label: "Res 2", value: 2 },
  { label: "Res 3", value: 3 },
  { label: "Res 4", value: 4 },
  { label: "Res 5", value: 5 },
  { label: "Res 6", value: 6 },
  { label: "Res 7", value: 7 },
  { label: "Res 8", value: 8 },
];
</script>

<template>
  <IconButton
    label="Settings"
    :aria-expanded="open"
    class="bg-surface-raised/90 border-border absolute top-3 left-3 z-10 border shadow-lg backdrop-blur"
    data-testid="settings-button"
    @click="open = true"
  >
    <Settings :size="18" />
  </IconButton>

  <Drawer v-model:visible="open" header="Settings" data-testid="settings-drawer">
    <p class="text-faint text-xs font-semibold tracking-wide uppercase">Basemap</p>
    <Select
      :model-value="selectedBasemap"
      :options="basemapOptions"
      :option-group-label="grouped ? 'label' : undefined"
      :option-group-children="grouped ? 'items' : undefined"
      data-testid="basemap-select"
      @update:model-value="setBasemap"
    />

    <hr class="border-border my-1" />
    <p class="text-faint text-xs font-semibold tracking-wide uppercase">Overlays</p>

    <label class="flex items-center justify-between gap-2 text-sm">
      <span>Globe (3D)</span>
      <ToggleSwitch
        :model-value="globe"
        data-testid="toggle-globe"
        @update:model-value="(v: boolean) => overlays.set('globe', v)"
      />
    </label>

    <label v-if="demAvailable" class="flex items-center justify-between gap-2 text-sm">
      <span>3D Terrain</span>
      <ToggleSwitch
        :model-value="terrain"
        data-testid="toggle-terrain"
        @update:model-value="(v: boolean) => overlays.set('terrain', v)"
      />
    </label>

    <label class="flex items-center justify-between gap-2 text-sm">
      <span>Graticule (lat/lon)</span>
      <ToggleSwitch
        :model-value="graticule"
        data-testid="toggle-graticule"
        @update:model-value="(v: boolean) => overlays.set('graticule', v)"
      />
    </label>

    <template v-if="demAvailable">
      <label class="flex items-center justify-between gap-2 text-sm">
        <span>Contours</span>
        <ToggleSwitch
          :model-value="contours"
          data-testid="toggle-contours"
          @update:model-value="(v: boolean) => overlays.set('contours', v)"
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
          @update:model-value="
            (v) => typeof v === 'string' && overlays.setContourUnits(v as 'ft' | 'm')
          "
        />
      </div>
    </template>

    <!-- Hexagon grid (H3) with auto/manual resolution sub-row -->
    <label class="flex items-center justify-between gap-2 text-sm">
      <span>Hexagon grid (H3)</span>
      <ToggleSwitch
        :model-value="hexGrid"
        data-testid="toggle-hexgrid"
        @update:model-value="(v: boolean) => overlays.set('hexGrid', v)"
      />
    </label>
    <template v-if="hexGrid">
      <div class="flex items-center justify-between gap-2 pl-3 text-sm">
        <span class="text-muted">Auto resolution</span>
        <ToggleSwitch
          :model-value="hexAuto"
          data-testid="toggle-hex-auto"
          @update:model-value="(v: boolean) => overlays.setHexAuto(v)"
        />
      </div>
      <div v-if="!hexAuto" class="flex items-center justify-between gap-2 pl-3 text-sm">
        <span class="text-muted">Resolution</span>
        <Select
          :model-value="hexResolution"
          :options="h3ResolutionOptions"
          data-testid="hex-resolution-select"
          @update:model-value="(v) => typeof v === 'number' && overlays.setHexResolution(v)"
        />
      </div>
    </template>

    <!-- MGRS grid with auto/manual accuracy sub-row -->
    <label class="flex items-center justify-between gap-2 text-sm">
      <span>MGRS grid</span>
      <ToggleSwitch
        :model-value="mgrsGrid"
        data-testid="toggle-mgrsgrid"
        @update:model-value="(v: boolean) => overlays.set('mgrsGrid', v)"
      />
    </label>
    <template v-if="mgrsGrid">
      <div class="flex items-center justify-between gap-2 pl-3 text-sm">
        <span class="text-muted">Auto accuracy</span>
        <ToggleSwitch
          :model-value="mgrsAuto"
          data-testid="toggle-mgrs-auto"
          @update:model-value="(v: boolean) => overlays.setMgrsAuto(v)"
        />
      </div>
      <div v-if="!mgrsAuto" class="flex items-center justify-between gap-2 pl-3 text-sm">
        <span class="text-muted">Accuracy</span>
        <Select
          :model-value="mgrsAccuracy"
          :options="mgrsAccuracyOptions"
          data-testid="mgrs-accuracy-select"
          @update:model-value="(v) => typeof v === 'number' && overlays.setMgrsAccuracy(v)"
        />
      </div>
    </template>

    <hr class="border-border my-1" />
    <p class="text-muted text-xs" data-testid="status-line">Drawings: {{ drawings.count }}</p>
  </Drawer>
</template>
