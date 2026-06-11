<script setup lang="ts">
import PvToggleSwitch from "primevue/toggleswitch";

import { cn } from "@/utils/cn";

/** ToggleSwitch — thin wrapper over PrimeVue ToggleSwitch, token-styled via :pt. */
withDefaults(defineProps<{ modelValue?: boolean; disabled?: boolean }>(), {
  modelValue: false,
  disabled: false,
});
defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

<template>
  <PvToggleSwitch
    :model-value="modelValue"
    :disabled="disabled"
    :pt="{
      root: {
        class: cn(
          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
          'bg-surface-sunken data-[p-checked=true]:bg-accent-600',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)]',
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
        ),
      },
      slider: { class: 'hidden' },
      handle: {
        class: cn(
          'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform',
          'data-[p-checked=true]:translate-x-4',
        ),
      },
    }"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
  />
</template>
