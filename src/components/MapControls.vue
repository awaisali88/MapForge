<script setup lang="ts">
import type { Map as MaplibreMap } from "maplibre-gl";
import type { Component } from "vue";

import { Pentagon, Ruler, Trash2 } from "@lucide/vue";
import { computed, ref } from "vue";

import IconButton from "@/components/ui/IconButton.vue";
import Select from "@/components/ui/Select.vue";
import Tooltip from "@/components/ui/Tooltip.vue";
import { BASEMAPS, defaultBasemap, resolveBasemapStyle } from "@/modules/maplibre/basemaps";
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

// Include the env-provided custom style (if any) at the top of the list.
const initialBasemap = defaultBasemap();
const allBasemaps = initialBasemap.id === "custom" ? [initialBasemap, ...BASEMAPS] : BASEMAPS;
const basemapOptions = allBasemaps.map((b) => ({ label: b.label, value: b.id }));

const basemap = ref<string>(initialBasemap.id);

const activeToolLabel = computed(() => {
  const active = TOOLS.find((t) => t.id === tools.activeId);
  return active ? active.label : "None";
});

function setBasemap(value: null | number | string): void {
  if (typeof value !== "string") return;
  const src = allBasemaps.find((b) => b.id === value);
  if (!src) return;
  basemap.value = value;
  props.map?.setStyle(resolveBasemapStyle(src));
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
      :options="basemapOptions"
      data-testid="basemap-select"
      @update:model-value="setBasemap"
    />

    <p class="text-muted px-1 text-xs" data-testid="status-line">
      Tool: {{ activeToolLabel }} · Drawings: {{ drawings.count }}
    </p>
  </div>
</template>
