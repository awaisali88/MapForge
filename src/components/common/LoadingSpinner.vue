<script setup lang="ts">
import { Loader2 } from "@lucide/vue";

defineProps<{
  label?: string;
}>();
</script>

<template>
  <div
    class="bg-surface-sunken flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center"
    role="status"
  >
    <Loader2 class="text-accent-500 size-6 animate-spin" />
    <p v-if="label" class="text-muted text-xs">{{ label }}</p>
  </div>
</template>
