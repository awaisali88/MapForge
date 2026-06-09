import type { Tool, ToolContext } from "@/modules/tools/types";
import type { Feature } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";

import { onBeforeUnmount, type ShallowRef, watch } from "vue";

import { useToolsStore } from "@/stores/tools";

export interface UseToolRegistryOptions {
  /** Tools available for activation. */
  tools: readonly Tool[];
  /** Called when a tool emits a finalized feature. */
  onFinalize?: (feature: Feature) => void;
}

/**
 * Tool lifecycle orchestrator.
 *
 * Watches `useToolsStore.activeId`. When it changes:
 *   1. The previous tool's `cleanup()` runs (if any).
 *   2. If the new id maps to a registered tool and the map is available,
 *      the tool's `setup(ctx)` runs.
 *
 * The `ToolContext` wires `suspend` / `restore` to `map.dragPan` and
 * `map.doubleClickZoom`, and pipes `emit` to the caller's `onFinalize`.
 *
 * Always call this from a component setup() so `onBeforeUnmount` can fire
 * the final cleanup when the host unmounts.
 */
export function useToolRegistry(
  mapRef: ShallowRef<MapLibreMap | null>,
  options: UseToolRegistryOptions,
): void {
  const store = useToolsStore();
  let currentCleanup: (() => void) | null = null;

  function makeContext(map: MapLibreMap): ToolContext {
    return {
      map,
      suspend() {
        map.dragPan.disable();
        map.doubleClickZoom.disable();
      },
      restore() {
        map.dragPan.enable();
        map.doubleClickZoom.enable();
      },
      emit(feature) {
        options.onFinalize?.(feature);
      },
    };
  }

  function teardown(): void {
    if (!currentCleanup) return;
    const cleanup = currentCleanup;
    currentCleanup = null;
    try {
      cleanup();
    } catch (err) {
      // A tool's cleanup must never propagate into Vue's unmount sequence —
      // throwing here corrupts the patch tree (Cannot read properties of null:
      // 'subTree' chains downstream). Swallow + log instead.
      if (typeof console !== "undefined") {
        console.warn("[useToolRegistry] cleanup threw:", err);
      }
    }
  }

  watch(
    () => [store.activeId, mapRef.value] as const,
    ([id, mapInstance]) => {
      teardown();
      if (!id || !mapInstance) return;
      const tool = options.tools.find((t) => t.id === id);
      if (!tool) return;
      const ctx = makeContext(mapInstance);
      currentCleanup = tool.setup(ctx).cleanup;
    },
    { immediate: true },
  );

  onBeforeUnmount(teardown);
}
