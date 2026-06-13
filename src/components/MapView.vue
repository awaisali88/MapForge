<script setup lang="ts">
import { storeToRefs } from "pinia";
import { onMounted, ref } from "vue";

import CoordinateReadout from "@/components/CoordinateReadout.vue";
import MgrsResolutionIndicator from "@/components/MgrsResolutionIndicator.vue";
import SettingsDrawer from "@/components/SettingsDrawer.vue";
import { useContours } from "@/composables/useContours";
import { useCoordinateReadout } from "@/composables/useCoordinateReadout";
import { useGlobe } from "@/composables/useGlobe";
import { useGraticule } from "@/composables/useGraticule";
import { useHexGrid } from "@/composables/useHexGrid";
import { useMapLibre } from "@/composables/useMapLibre";
import { useMgrsGrid } from "@/composables/useMgrsGrid";
import { useTerraDraw } from "@/composables/useTerraDraw";
import { useTerrain } from "@/composables/useTerrain";
import { findBasemapById, resolveBasemapStyle } from "@/modules/maplibre/basemaps";
import { useOverlaysStore } from "@/stores/overlays";

/**
 * MapView — owns the MapLibre lifecycle and wires all overlays.
 *
 *   - `useMapLibre` creates/destroys the map (held in a shallowRef).
 *   - `useTerraDraw` mounts the Terra Draw control (its own toolbar + built-in
 *     measurement), mirrors finalized features into the drawings store, and
 *     re-hydrates them after a basemap switch.
 *   - `useTerrain` enables 3D relief (reads the overlays store; toggle is in the
 *     settings drawer).
 *   - `useGraticule`, `useHexGrid`, `useMgrsGrid`, `useContours` — overlay
 *     composables that each watch the overlays store and manage their own
 *     MapLibre lifecycle (attach/detach on style.load, suspend before setStyle,
 *     re-add on idle/style.load after a basemap switch).
 *   - `useGlobe` — 3D globe projection (adaptive: globe when zoomed out).
 *   - `useCoordinateReadout` — bottom-right cursor readout (lat/lon + MGRS).
 *
 * The bottom-right overlay stack shows the `MgrsResolutionIndicator` (active
 * MGRS grid cell size, only while the grid is on) above the cursor readout.
 * `<SettingsDrawer>` replaces the old `<MapControls>` floating panel.
 */
const container = ref<HTMLDivElement | null>(null);
const { map, mount } = useMapLibre();
const { switchBasemap: applyBasemapStyle } = useTerraDraw(map);
const { suspendForStyleSwitch: suspendTerrain } = useTerrain(map);
const { suspendForStyleSwitch: suspendGraticule } = useGraticule(map);
useHexGrid(map);
const { resolutionLabel: mgrsResolution } = useMgrsGrid(map);
useContours(map);
useGlobe(map);
const { text: readout } = useCoordinateReadout(map);

// Show the MGRS resolution indicator only while the MGRS grid is enabled.
const { mgrsGrid } = storeToRefs(useOverlaysStore());

// Tear terrain and graticule down before the style swap (avoids render-during-setStyle
// crashes; both composables re-apply on the new style's `style.load`), then switch.
function switchBasemap(style: Parameters<typeof applyBasemapStyle>[0]): void {
  suspendTerrain();
  suspendGraticule();
  applyBasemapStyle(style);
}

onMounted(() => {
  if (!container.value) return;
  const overlays = useOverlaysStore();
  const persisted = overlays.basemapId ? findBasemapById(overlays.basemapId) : undefined;
  mount(container.value, persisted ? { style: resolveBasemapStyle(persisted) } : {});
});
</script>

<template>
  <div class="relative h-screen w-screen overflow-hidden">
    <div ref="container" class="bg-surface-sunken h-full w-full" data-testid="map-container" />
    <SettingsDrawer :switch-basemap="switchBasemap" />
    <!-- Bottom-right overlay stack: MGRS resolution above the cursor readout. -->
    <div class="absolute right-3 bottom-3 z-10 flex flex-col items-end gap-1.5">
      <MgrsResolutionIndicator v-if="mgrsGrid" :label="mgrsResolution" />
      <CoordinateReadout :text="readout" />
    </div>
  </div>
</template>
