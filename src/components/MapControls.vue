<script setup lang="ts">
import type { StyleSpecification } from "maplibre-gl";

import { Mountain } from "@lucide/vue";
import { computed, ref } from "vue";

import Button from "@/components/ui/Button.vue";
import Select from "@/components/ui/Select.vue";
import {
  BASEMAPS,
  defaultBasemap,
  localBasemaps,
  resolveBasemapStyle,
} from "@/modules/maplibre/basemaps";
import { useDrawingsStore } from "@/stores/drawings";

/**
 * MapControls — the basemap switcher overlay (top-left). Drawing + measuring is
 * handled by the Terra Draw toolbar (top-right; see `useTerraDraw`). This panel
 * switches basemaps, toggles 3D terrain (when a local DEM is configured), and
 * shows the count of drawn features mirrored in the store.
 *
 * Locally-hosted tiles (`localBasemaps()`) are grouped under a separate
 * "Local" category; when none are configured the dropdown stays flat.
 */
const props = defineProps<{
  switchBasemap: (style: StyleSpecification | string) => void;
  /** Whether a local DEM is configured (shows the 3D-terrain toggle). */
  terrainAvailable: boolean;
  /** Whether 3D terrain is currently enabled. */
  terrainEnabled: boolean;
  /** Flip 3D terrain on/off. */
  toggleTerrain: () => void;
}>();

const drawings = useDrawingsStore();

// Include the env-provided custom style (if any) at the top of the online list.
const initialBasemap = defaultBasemap();
const onlineBasemaps = initialBasemap.id === "custom" ? [initialBasemap, ...BASEMAPS] : BASEMAPS;
const local = localBasemaps();
const allBasemaps = [...onlineBasemaps, ...local];

// Grouped dropdown when local tiles exist; otherwise the flat online list.
const grouped = local.length > 0;
const basemapOptions = computed(() => {
  const toOpts = (list: typeof allBasemaps) => list.map((b) => ({ label: b.label, value: b.id }));
  if (!grouped) return toOpts(onlineBasemaps);
  return [
    { label: "Online", items: toOpts(onlineBasemaps) },
    { label: "Local", items: toOpts(local) },
  ];
});

const basemap = ref<string>(initialBasemap.id);

function setBasemap(value: null | number | string): void {
  if (typeof value !== "string") return;
  const src = allBasemaps.find((b) => b.id === value);
  if (!src) return;
  basemap.value = value;
  props.switchBasemap(resolveBasemapStyle(src));
}
</script>

<template>
  <div
    class="bg-surface-raised/90 border-border absolute top-3 left-3 z-10 flex flex-col gap-2 rounded-lg border p-2 shadow-lg backdrop-blur"
  >
    <Select
      :model-value="basemap"
      :options="basemapOptions"
      :option-group-label="grouped ? 'label' : undefined"
      :option-group-children="grouped ? 'items' : undefined"
      data-testid="basemap-select"
      @update:model-value="setBasemap"
    />

    <Button
      v-if="terrainAvailable"
      :variant="terrainEnabled ? 'primary' : 'secondary'"
      size="sm"
      data-testid="terrain-toggle"
      :aria-pressed="terrainEnabled"
      @click="toggleTerrain"
    >
      <Mountain :size="14" />
      3D Terrain
    </Button>

    <p class="text-muted px-1 text-xs" data-testid="status-line">Drawings: {{ drawings.count }}</p>
  </div>
</template>
