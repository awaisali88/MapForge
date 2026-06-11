<script setup lang="ts">
import { onMounted, ref } from "vue";

import MapControls from "@/components/MapControls.vue";
import { useMapLibre } from "@/composables/useMapLibre";
import { useTerraDraw } from "@/composables/useTerraDraw";
import { useTerrain } from "@/composables/useTerrain";

/**
 * MapView — owns the MapLibre lifecycle and drawing wiring.
 *
 *   - `useMapLibre` creates/destroys the map (held in a shallowRef).
 *   - `useTerraDraw` mounts the Terra Draw control (its own toolbar + built-in
 *     measurement), mirrors finalized features into the drawings store, and
 *     re-hydrates them after a basemap switch.
 *   - `useTerrain` enables 3D relief from a locally-hosted DEM (when configured).
 *
 * The map fills the viewport; `<MapControls>` overlays the basemap switcher.
 */
const container = ref<HTMLDivElement | null>(null);
const { map, mount } = useMapLibre();
const { switchBasemap: applyBasemapStyle } = useTerraDraw(map);
const {
  available: terrainAvailable,
  enabled: terrainEnabled,
  toggle: toggleTerrain,
  suspendForStyleSwitch,
} = useTerrain(map);

// Tear terrain down before the style swap (avoids a render-during-setStyle crash;
// useTerrain re-applies it on the new style's `style.load`), then switch.
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
    <MapControls
      :switch-basemap="switchBasemap"
      :terrain-available="terrainAvailable"
      :terrain-enabled="terrainEnabled"
      :toggle-terrain="toggleTerrain"
    />
  </div>
</template>
