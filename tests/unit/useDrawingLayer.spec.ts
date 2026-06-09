import type { Feature } from "geojson";
import type { Map as MaplibreMap } from "maplibre-gl";

import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, shallowRef } from "vue";

import { useDrawingLayer } from "@/composables/useDrawingLayer";
import { useDrawingsStore } from "@/stores/drawings";

/** Run a composable inside a real component setup so lifecycle hooks fire. */
function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
  let result!: T;
  const app = createApp({
    setup() {
      result = composable();
      return () => null;
    },
  });
  app.mount(document.createElement("div"));
  return { result, unmount: () => app.unmount() };
}

/** Minimal fake MapLibre map covering the API useDrawingLayer touches. */
function createFakeMap() {
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers = new Map<string, unknown>();
  const listeners = new Map<string, Set<() => void>>();

  const map = {
    isStyleLoaded: vi.fn(() => false),
    addSource: vi.fn((id: string) => {
      sources.set(id, { setData: vi.fn() });
    }),
    getSource: vi.fn((id: string) => sources.get(id)),
    removeSource: vi.fn((id: string) => {
      sources.delete(id);
    }),
    addLayer: vi.fn((spec: { id: string }) => {
      layers.set(spec.id, spec);
    }),
    getLayer: vi.fn((id: string) => layers.get(id)),
    removeLayer: vi.fn((id: string) => {
      layers.delete(id);
    }),
    on: vi.fn((type: string, fn: () => void) => {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    }),
    off: vi.fn((type: string, fn: () => void) => {
      listeners.get(type)?.delete(fn);
    }),
  };

  function fire(type: string): void {
    for (const fn of listeners.get(type) ?? []) fn();
  }

  return { map, sources, layers, listeners, fire };
}

const polygon: Feature = {
  type: "Feature",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  },
  properties: {},
};

describe("useDrawingLayer", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("adds a source and three layers when the map fires 'load'", () => {
    const { map, sources, layers, fire } = createFakeMap();
    const drawings = useDrawingsStore();
    const { unmount } = withSetup(() =>
      useDrawingLayer(shallowRef(map as unknown as MaplibreMap), drawings),
    );

    expect(sources.size).toBe(0); // nothing added before 'load'
    fire("load");

    expect(sources.has("mapforge:drawings")).toBe(true);
    expect(layers.size).toBe(3);
    unmount();
  });

  it("pushes featureCollection to the source when drawings change", async () => {
    const { map, sources, fire } = createFakeMap();
    const drawings = useDrawingsStore();
    const { unmount } = withSetup(() =>
      useDrawingLayer(shallowRef(map as unknown as MaplibreMap), drawings),
    );
    fire("load");
    const src = sources.get("mapforge:drawings")!;
    src.setData.mockClear();

    drawings.add(polygon);
    await Promise.resolve();
    await Promise.resolve();

    expect(src.setData).toHaveBeenCalled();
    const fc = src.setData.mock.calls.at(-1)![0];
    expect(fc.features).toHaveLength(1);
    unmount();
  });

  it("re-adds the source after a style switch wipes it ('styledata')", () => {
    const { map, sources, layers, fire } = createFakeMap();
    const drawings = useDrawingsStore();
    const { unmount } = withSetup(() =>
      useDrawingLayer(shallowRef(map as unknown as MaplibreMap), drawings),
    );
    fire("load");
    sources.clear(); // setStyle wipes sources...
    layers.clear(); // ...and layers
    map.isStyleLoaded.mockReturnValue(true); // new style finished loading

    fire("styledata");

    expect(sources.has("mapforge:drawings")).toBe(true);
    expect(layers.size).toBe(3);
    unmount();
  });

  it("removes its layers, source, and listeners on unmount", () => {
    const { map, sources, layers, listeners, fire } = createFakeMap();
    const drawings = useDrawingsStore();
    const { unmount } = withSetup(() =>
      useDrawingLayer(shallowRef(map as unknown as MaplibreMap), drawings),
    );
    fire("load");
    unmount();

    expect(sources.size).toBe(0);
    expect(layers.size).toBe(0);
    expect(listeners.get("load")?.size ?? 0).toBe(0);
    expect(listeners.get("styledata")?.size ?? 0).toBe(0);
  });

  it("attaches when the map ref changes from null to a map", async () => {
    const { map, sources, fire } = createFakeMap();
    const drawings = useDrawingsStore();
    const mapRef = shallowRef<MaplibreMap | null>(null);
    const { unmount } = withSetup(() => useDrawingLayer(mapRef, drawings));

    // Mounted while the map is still null — the real MapView path (the map is
    // created in onMounted, after the composable runs).
    expect(sources.size).toBe(0);

    mapRef.value = map as unknown as MaplibreMap;
    await Promise.resolve(); // let the mapRef watcher attach listeners
    await Promise.resolve();
    fire("load");

    expect(sources.has("mapforge:drawings")).toBe(true);
    unmount();
  });
});
