<script setup lang="ts">
/**
 * CoordinateReadout — cursor coordinate pill (lat/lon, or MGRS when that grid
 * is on). Positioned by its parent (the bottom-right overlay stack in MapView);
 * renders nothing when `text` is empty (cursor off-canvas).
 */
defineProps<{ text: string }>();
</script>

<template>
  <div
    v-if="text"
    class="bg-surface-raised/90 border-border text-foreground rounded-md border px-2 py-1 font-mono text-xs shadow-lg backdrop-blur"
    data-testid="coordinate-readout"
  >
    {{ text }}
  </div>
</template>
