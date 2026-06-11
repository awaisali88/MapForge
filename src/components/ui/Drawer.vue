<script setup lang="ts">
import PvDrawer from "primevue/drawer";

import { cn } from "@/utils/cn";

/**
 * Drawer — thin wrapper over PrimeVue Drawer (unstyled), token-styled via :pt.
 * Left-positioned by default. `v-model:visible` controls open state.
 *
 * Note: the close button passthrough key in PrimeVue 4 is `pcCloseButton`
 * (not `closeButton`).
 */
withDefaults(defineProps<{ visible?: boolean; header?: string; position?: "left" | "right" }>(), {
  visible: false,
  header: undefined,
  position: "left",
});
defineEmits<{ "update:visible": [value: boolean] }>();
</script>

<template>
  <PvDrawer
    :visible="visible"
    :header="header"
    :position="position"
    :pt="{
      root: {
        class: cn('bg-surface-raised text-foreground border-border w-72 border-r shadow-xl'),
      },
      header: { class: 'flex items-center justify-between px-4 py-3 border-b border-border' },
      title: { class: 'text-sm font-semibold' },
      content: { class: 'p-4 flex flex-col gap-3 overflow-y-auto' },
      mask: { class: 'bg-black/30' },
      pcCloseButton: { root: { class: 'text-faint hover:text-foreground' } },
    }"
    @update:visible="(v: boolean) => $emit('update:visible', v)"
  >
    <slot />
  </PvDrawer>
</template>
