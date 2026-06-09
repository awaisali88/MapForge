<script setup lang="ts">
import PvButton from "primevue/button";
import { computed, useAttrs } from "vue";

import { cn } from "@/utils/cn";

/**
 * IconButton — icon-only Button wrapper over PrimeVue Button.
 * Always sets `aria-label` from the required `label` prop.
 *
 * Consumer `class="…"` is merged into the underlying button via `cn()` so
 * conflicting Tailwind utilities (e.g. `p-0` vs the default `p-[5px]`) resolve
 * predictably through `tailwind-merge`. `inheritAttrs` is disabled so that
 * fallthrough class doesn't ALSO land on the root unmerged.
 */
defineOptions({ inheritAttrs: false });

type Variant = "ghost" | "solid";
type Size = "sm" | "md" | "lg";

interface Props {
  label: string;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: "ghost",
  size: "md",
  disabled: false,
});

const attrs = useAttrs();

const variantClass: Record<Variant, string> = {
  ghost: "bg-transparent text-foreground hover:bg-surface-raised",
  solid: "bg-surface-raised text-foreground border border-border hover:bg-surface-sunken",
};

// `sm` is the density-driven default — height + padding + icon size all pull
// from `--density-*` so the icon button rescales with `data-density` on
// `<html>`. The svg-size selector pulls `--density-icon-size`. `md` and `lg`
// stay fixed for callout uses.
const sizeClass: Record<Size, string> = {
  sm: "p-[var(--density-cell-padding-y)] min-h-[var(--density-control-height)] min-w-[var(--density-control-height)] [&_svg]:size-[var(--density-icon-size)]",
  md: "p-1.5 [&_svg]:size-4",
  lg: "p-2 [&_svg]:size-5",
};

const rootClass = computed(() =>
  cn(
    "inline-flex items-center justify-center rounded-md transition-colors duration-150 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-focus-ring)] focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variantClass[props.variant],
    sizeClass[props.size],
    attrs.class as string | undefined,
  ),
);

const forwardedAttrs = computed(() => {
  // Strip `class` from $attrs — it's already merged into rootClass via cn().
  // Everything else (data-*, aria-*, @click, …) still falls through.
  const { class: _omit, ...rest } = attrs;
  return rest;
});
</script>

<template>
  <PvButton
    type="button"
    :disabled="disabled"
    :aria-label="label"
    v-bind="forwardedAttrs"
    :pt="{
      root: { class: rootClass },
      label: { class: 'inline-flex items-center' },
    }"
  >
    <slot />
  </PvButton>
</template>
