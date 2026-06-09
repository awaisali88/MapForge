<script setup lang="ts">
import type { StyleSpecification } from "maplibre-gl";

import { ref } from "vue";

import Select from "@/components/ui/Select.vue";
import { BASEMAPS, defaultBasemap, resolveBasemapStyle } from "@/modules/maplibre/basemaps";
import { useDrawingsStore } from "@/stores/drawings";

/**
 * MapControls — the basemap switcher overlay (top-left). Drawing + measuring is
 * handled by the Terra Draw toolbar (top-right; see `useTerraDraw`). This panel
 * switches basemaps and shows the count of drawn features mirrored in the store.
 */
const props = defineProps<{ switchBasemap: (style: StyleSpecification | string) => void }>();

const drawings = useDrawingsStore();

// Include the env-provided custom style (if any) at the top of the list.
const initialBasemap = defaultBasemap();
const allBasemaps = initialBasemap.id === "custom" ? [initialBasemap, ...BASEMAPS] : BASEMAPS;
const basemapOptions = allBasemaps.map((b) => ({ label: b.label, value: b.id }));

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
      data-testid="basemap-select"
      @update:model-value="setBasemap"
    />

    <p class="text-muted px-1 text-xs" data-testid="status-line">Drawings: {{ drawings.count }}</p>
  </div>
</template>
