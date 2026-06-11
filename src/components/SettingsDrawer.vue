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
// Only `terrain` is wired this phase; grid refs (graticule, hexGrid, mgrsGrid, contours)
// are added from storeToRefs when their toggle rows land in Phases 3–6.
const { terrain } = storeToRefs(overlays);
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

    <label v-if="demAvailable" class="flex items-center justify-between gap-2 text-sm">
      <span>3D Terrain</span>
      <ToggleSwitch
        :model-value="terrain"
        data-testid="toggle-terrain"
        @update:model-value="(v: boolean) => overlays.set('terrain', v)"
      />
    </label>

    <!-- Grid + contour rows are added in their phases (graticule, hexGrid, mgrsGrid, contours). -->

    <hr class="border-border my-1" />
    <p class="text-muted text-xs" data-testid="status-line">Drawings: {{ drawings.count }}</p>
  </Drawer>
</template>
