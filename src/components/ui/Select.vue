<script setup lang="ts">
import PvSelect from "primevue/select";

import { cn } from "@/utils/cn";

/**
 * Select — thin wrapper over PrimeVue Select. Preserves the
 * `options: { label, value, disabled }[]` API and maps to PrimeVue's
 * `optionLabel` / `optionValue` / `optionDisabled`.
 */
interface Option {
  label: string;
  value: number | string;
  disabled?: boolean;
}

interface Props {
  modelValue?: null | number | string;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  /** Show an inline clear button (sets modelValue to null). */
  showClear?: boolean;
}

withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  placeholder: undefined,
  disabled: false,
  showClear: false,
});

defineEmits<{
  "update:modelValue": [value: null | number | string];
}>();
</script>

<template>
  <PvSelect
    :model-value="modelValue"
    :options="options"
    option-label="label"
    option-value="value"
    option-disabled="disabled"
    :placeholder="placeholder"
    :disabled="disabled"
    :show-clear="showClear"
    :pt="{
      root: {
        class: cn(
          'inline-flex items-center w-full rounded-md border border-border bg-surface text-foreground',
          'min-h-[var(--density-control-height)] text-[length:var(--density-font-size)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)]',
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
        ),
      },
      label: {
        class:
          'flex-1 px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)] truncate',
      },
      dropdown: { class: 'px-2 text-faint' },
      overlay: {
        class: 'z-[100] mt-1 rounded-md border border-border bg-surface-raised py-1 shadow-lg',
      },
      listContainer: { class: 'max-h-60 overflow-auto' },
      list: { class: 'list-none p-0 m-0' },
      option: {
        class: cn(
          'text-foreground cursor-pointer',
          'px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)] text-[length:var(--density-font-size)]',
          'hover:bg-surface-sunken aria-selected:bg-surface-sunken',
          'aria-disabled:cursor-not-allowed aria-disabled:opacity-40',
        ),
      },
    }"
    @update:model-value="(v) => $emit('update:modelValue', v)"
  />
</template>
