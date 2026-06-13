<script setup lang="ts">
/**
 * MgrsResolutionIndicator — small amber pill showing the active MGRS grid
 * resolution (e.g. "MGRS 1 km"). Sits just above the cursor CoordinateReadout
 * in the bottom-right stack. Renders nothing when `label` is empty (i.e. the
 * MGRS grid is off), so it only appears while the grid is enabled.
 */
defineProps<{ label: string }>();
</script>

<template>
  <div
    v-if="label"
    class="bg-surface-raised/90 rounded-md border border-amber-500/60 px-2 py-1 font-mono text-xs text-amber-500 shadow-lg backdrop-blur"
    data-testid="mgrs-resolution-indicator"
  >
    MGRS {{ label }}
  </div>
</template>
