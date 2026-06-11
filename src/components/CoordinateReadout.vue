<script setup lang="ts">
/**
 * CoordinateReadout — bottom-right cursor coordinate overlay.
 * Renders nothing when `text` is empty (cursor off-canvas).
 */
defineProps<{ text: string }>();
</script>

<template>
  <div
    v-if="text"
    class="bg-surface-raised/90 border-border text-foreground absolute right-3 bottom-3 z-10 rounded-md border px-2 py-1 font-mono text-xs shadow-lg backdrop-blur"
    data-testid="coordinate-readout"
  >
    {{ text }}
  </div>
</template>
