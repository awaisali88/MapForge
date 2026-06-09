<script setup lang="ts">
import { onMounted, ref } from "vue";

import MapControls from "@/components/MapControls.vue";
import { useMapLibre } from "@/composables/useMapLibre";
import { useTerraDraw } from "@/composables/useTerraDraw";

/**
 * MapView — owns the MapLibre lifecycle and drawing wiring.
 *
 *   - `useMapLibre` creates/destroys the map (held in a shallowRef).
 *   - `useTerraDraw` mounts the Terra Draw control (its own toolbar + built-in
 *     measurement), mirrors finalized features into the drawings store, and
 *     re-hydrates them after a basemap switch.
 *
 * The map fills the viewport; `<MapControls>` overlays the basemap switcher.
 */
const container = ref<HTMLDivElement | null>(null);
const { map, mount } = useMapLibre();

useTerraDraw(map);

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
