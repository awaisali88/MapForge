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
