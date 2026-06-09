<script setup lang="ts">
import { Tooltip as VTooltip } from "floating-vue";
import "floating-vue/dist/style.css";

/**
 * Tooltip — thin wrapper over floating-vue's `Tooltip`. floating-ui handles
 * placement, collision avoidance, arrow positioning, and ARIA.
 *
 * Surface:
 *   - `label` — string shown in the tooltip.
 *   - `placement?` — default `top`.
 *   - `delay?` — open/close delay in ms; default `200`.
 *   - `disabled?`
 *   - default slot — the trigger element.
 *
 * Styling is driven by the floating-vue popper CSS overrides at the bottom,
 * scoped to the project's surface / foreground / border tokens.
 */
interface Props {
  label: string;
  placement?:
    | "auto"
    | "auto-start"
    | "auto-end"
    | "top"
    | "top-start"
    | "top-end"
    | "right"
    | "right-start"
    | "right-end"
    | "bottom"
    | "bottom-start"
    | "bottom-end"
    | "left"
    | "left-start"
    | "left-end";
  delay?: number;
  disabled?: boolean;
}

withDefaults(defineProps<Props>(), {
  placement: "top",
  delay: 200,
  disabled: false,
});
</script>

<template>
  <VTooltip
    :triggers="['hover', 'focus']"
    :placement="placement"
    :delay="delay"
    :disabled="disabled"
    :distance="6"
  >
    <slot />
    <template #popper>
      <span class="cv-tooltip-content">{{ label }}</span>
    </template>
  </VTooltip>
</template>

<style>
/* Theme floating-vue's default popper to match the project's surface tokens. */
.v-popper--theme-tooltip .v-popper__inner {
  background-color: var(--color-surface-raised);
  color: var(--color-foreground);
  border: 1px solid var(--color-border);
  border-radius: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  line-height: 1rem;
  box-shadow: var(--shadow-md);
}
.v-popper--theme-tooltip .v-popper__arrow-outer {
  border-color: var(--color-surface-raised);
}
.v-popper--theme-tooltip .v-popper__arrow-inner {
  visibility: hidden;
}
.cv-tooltip-content {
  display: inline-block;
  white-space: nowrap;
}
</style>
