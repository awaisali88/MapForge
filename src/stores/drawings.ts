import type { Feature } from "geojson";

import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { nanoid } from "@/utils/id";

export interface StoredDrawing {
  /** Stable id for the stored entry. */
  id: string;
  /** The finalized GeoJSON feature emitted by a tool. */
  feature: Feature;
  /** Epoch ms when the user committed the drawing. */
  createdAt: number;
}

/**
 * Drawings store — holds every feature that a tool finalizes
 * (`measure-distance`, `draw-polygon`, future selections). Separate from
 * `entitiesStore` because drawings are operator-created scratch geometry
 * with a different lifecycle than received operational entities.
 *
 * The store is plain reactive state; rendering the persistent layer that
 * displays these drawings is the consumer's job (a panel can subscribe and
 * mirror to a MapLibre source).
 */
export const useDrawingsStore = defineStore("drawings", () => {
  const drawings = ref<StoredDrawing[]>([]);

  const count = computed(() => drawings.value.length);

  const featureCollection = computed(() => ({
    type: "FeatureCollection" as const,
    features: drawings.value.map((d) => d.feature),
  }));

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
    add,
    remove,
    clear,
  };
});
