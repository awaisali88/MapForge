<script setup lang="ts">
import type { MenuItem } from "primevue/menuitem";

import PvContextMenu from "primevue/contextmenu";
import { twMerge } from "tailwind-merge";
import { computed, ref } from "vue";

/**
 * ContextMenu — thin wrapper over PrimeVue `ContextMenu` (unstyled).
 *
 * Exposes `show(event)` / `hide()` from the underlying instance so callers can
 * drive it imperatively from a `@contextmenu` handler. Consumers can supply an
 * `#item` slot to customize each row. The `pt` prop merges into the wrapper's
 * defaults via `twMerge` on class strings.
 */
interface PtSlot {
  class?: string;
  [key: string]: unknown;
}

interface Props {
  model: MenuItem[];
  pt?: Record<string, PtSlot>;
  /** Where PrimeVue mounts the overlay. Defaults to document.body. */
  appendTo?: HTMLElement | "body" | "self";
}

const props = withDefaults(defineProps<Props>(), {
  appendTo: "body",
});

const cm = ref<InstanceType<typeof PvContextMenu> | null>(null);

function show(event: MouseEvent): void {
  cm.value?.show(event);
}

function hide(): void {
  cm.value?.hide();
}

defineExpose({ show, hide });

const baseTheme: Record<string, PtSlot> = {
  root: {
    class:
      "border-border bg-surface-raised z-50 min-w-[220px] rounded-md border py-1 shadow-xl outline-none",
  },
  rootList: { class: "flex flex-col outline-none" },
  item: { class: "relative" },
  itemContent: { class: "hover:bg-surface-sunken cursor-pointer transition-colors" },
  itemLink: {
    class:
      "text-foreground flex items-center gap-2 px-[var(--density-cell-padding-x)] py-[var(--density-cell-padding-y)] text-[length:var(--density-font-size)]",
  },
  itemIcon: { class: "text-muted size-3.5" },
  submenu: {
    class:
      "border-border bg-surface-raised z-50 min-w-[220px] rounded-md border py-1 shadow-xl outline-none",
  },
  submenuIcon: { class: "text-muted ml-auto size-3" },
  separator: { class: "border-border my-1 border-t" },
};

const mergedPt = computed(() => {
  const consumer = props.pt ?? {};
  const out: Record<string, PtSlot> = {};
  const keys = new Set([...Object.keys(baseTheme), ...Object.keys(consumer)]);
  for (const key of keys) {
    const base = baseTheme[key] ?? {};
    const over = consumer[key] ?? {};
    out[key] = {
      ...base,
      ...over,
      class: twMerge(base.class, over.class),
    };
  }
  return out;
});
</script>

<template>
  <PvContextMenu ref="cm" :model="model" unstyled :pt="mergedPt" :append-to="appendTo">
    <template v-if="$slots.item" #item="slotProps">
      <slot name="item" v-bind="slotProps" />
    </template>
  </PvContextMenu>
</template>
