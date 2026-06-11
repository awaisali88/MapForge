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
      // PrimeVue's ToggleSwitch DOM is: root > input(checkbox) + slider > handle.
      // `group` on root lets the handle react to root's `data-p-checked`; the
      // input is the (invisible) click target; `slider: contents` removes its box
      // so the absolutely-positioned handle anchors to root.
      root: {
        class: cn(
          'group relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors',
          'bg-surface-sunken data-[p-checked=true]:bg-accent-600',
          'focus-within:ring-2 focus-within:ring-[color:var(--color-focus-ring)]',
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
        ),
      },
      input: { class: 'absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0' },
      slider: { class: 'contents' },
      handle: {
        class: cn(
          'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
          'group-data-[p-checked=true]:translate-x-4',
        ),
      },
    }"
    @update:model-value="(v: boolean) => $emit('update:modelValue', v)"
  />
</template>
