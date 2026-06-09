import type { Feature } from "geojson";

import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { nanoid } from "@/utils/id";

export interface StoredDrawing {
  /** Stable id for the stored entry (the feature's id when present). */
  id: string;
  /** A finalized GeoJSON feature. */
  feature: Feature;
  /** Epoch ms when the entry was recorded. */
  createdAt: number;
}

/**
 * Drawings store — an exportable mirror of the shapes drawn with the Terra Draw
 * control (`useTerraDraw`). Terra Draw owns rendering on the map; this store
 * keeps a plain, serializable copy of the finalized features for inspection,
 * export, and the on-screen count. It is replaced wholesale via `setAll` on
 * every Terra Draw change.
 */
export const useDrawingsStore = defineStore("drawings", () => {
  const drawings = ref<StoredDrawing[]>([]);

  const count = computed(() => drawings.value.length);

  const featureCollection = computed(() => ({
    type: "FeatureCollection" as const,
    features: drawings.value.map((d) => d.feature),
  }));

  /** Replace the mirror with the current set of drawn features. */
  function setAll(features: Feature[]): void {
    drawings.value = features.map((feature) => ({
      id: typeof feature.id === "string" ? feature.id : nanoid(),
      feature,
      createdAt: Date.now(),
    }));
  }

  function add(feature: Feature): string {
    const id = nanoid();
    drawings.value.push({ id, feature, createdAt: Date.now() });
    return id;
  }

  function remove(id: string): void {
    drawings.value = drawings.value.filter((d) => d.id !== id);
  }

  function clear(): void {
    drawings.value = [];
  }

  return {
    drawings,
    count,
    featureCollection,
    setAll,
    add,
    remove,
    clear,
  };
});
