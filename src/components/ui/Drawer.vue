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
        class: cn(
          // Unstyled PrimeVue ships NO positioning CSS — dock the panel to the
          // full-height left edge ourselves (otherwise it floats centered).
          'fixed inset-y-0 left-0 z-50 flex h-screen w-72 flex-col',
          'bg-surface-raised text-foreground border-border border-r shadow-xl',
        ),
      },
      mask: { class: 'fixed inset-0 z-40 bg-black/30' },
      header: {
        class: 'flex shrink-0 items-center justify-between border-b border-border px-4 py-3',
      },
      title: { class: 'text-sm font-semibold' },
      content: { class: 'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4' },
      pcCloseButton: { root: { class: 'text-faint hover:text-foreground' } },
    }"
    @update:visible="(v: boolean) => $emit('update:visible', v)"
  >
    <slot />
  </PvDrawer>
</template>
