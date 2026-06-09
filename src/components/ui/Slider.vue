<script setup lang="ts">
import { computed, ref } from "vue";

/**
 * Pointer-capture slider (Track B — pop-out interactive components).
 *
 * Hand-rolled instead of the Volt/PrimeVue Slider: PrimeVue's Slider tracks its
 * drag with `document`-level mousemove/mouseup listeners bound to the OPENER
 * window, so a drag inside a popped-out dockview window never tracks (the drag
 * "sticks" and only the release registers). See
 * docs/decisions/0003-slider-pointer-capture.md.
 *
 * This uses `setPointerCapture`, which routes all subsequent pointer events for
 * that pointer to the captured element regardless of which window it lives in —
 * so the drag works identically docked AND popped out, with no document
 * listeners. Token-pure (var() utilities only); keyboard + ARIA included.
 */
const props = withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
  }>(),
  { min: 0, max: 100, step: 1, disabled: false },
);
const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const track = ref<HTMLElement | null>(null);
const dragging = ref(false);

const percent = computed(() => {
  const span = props.max - props.min;
  if (span <= 0) return 0;
  return ((clamp(props.modelValue) - props.min) / span) * 100;
});

function clamp(v: number): number {
  return Math.min(props.max, Math.max(props.min, v));
}
function quantize(v: number): number {
  const stepped = Math.round((v - props.min) / props.step) * props.step + props.min;
  const dp = (String(props.step).split(".")[1] ?? "").length; // kill float drift
  return clamp(Number(stepped.toFixed(dp)));
}
function valueFromClientX(clientX: number): number {
  const el = track.value;
  if (!el) return props.modelValue;
  const rect = el.getBoundingClientRect();
  const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
  return quantize(props.min + ratio * (props.max - props.min));
}
function commit(v: number): void {
  if (v !== props.modelValue) emit("update:modelValue", v);
}

function onPointerDown(e: PointerEvent): void {
  if (props.disabled) return;
  // Capture on the track → every move/up for this pointer routes here, even
  // across window boundaries (the pop-out fix). No document listeners.
  track.value?.setPointerCapture(e.pointerId);
  dragging.value = true;
  commit(valueFromClientX(e.clientX));
  e.preventDefault();
}
function onPointerMove(e: PointerEvent): void {
  if (dragging.value) commit(valueFromClientX(e.clientX));
}
function onPointerUp(e: PointerEvent): void {
  if (!dragging.value) return;
  dragging.value = false;
  track.value?.releasePointerCapture(e.pointerId);
}
function onKeydown(e: KeyboardEvent): void {
  if (props.disabled) return;
  let next = props.modelValue;
  if (e.key === "ArrowRight" || e.key === "ArrowUp") next += props.step;
  else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next -= props.step;
  else if (e.key === "Home") next = props.min;
  else if (e.key === "End") next = props.max;
  else return;
  e.preventDefault();
  commit(quantize(next));
}
</script>

<template>
  <div
    ref="track"
    class="relative h-[3px] w-full touch-none rounded-xs bg-[var(--color-border-strong)] select-none"
    :class="disabled ? 'pointer-events-none opacity-50' : 'cursor-pointer'"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div
      class="absolute inset-y-0 left-0 rounded-xs bg-[var(--color-interactive)]"
      :style="{ width: `${percent}%` }"
    />
    <div
      role="slider"
      tabindex="0"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-valuenow="modelValue"
      :aria-disabled="disabled"
      class="absolute top-1/2 -ms-2.5 -mt-2.5 size-5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-base)] shadow-sm transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus-ring)]"
      :style="{ left: `${percent}%` }"
      @keydown="onKeydown"
    />
  </div>
</template>
