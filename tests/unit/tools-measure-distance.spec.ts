import type { ToolContext } from "@/modules/tools/types";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { measureDistanceTool } from "@/modules/tools/measure-distance";

/**
 * Minimal fake `Map` covering the subset of the MapLibre API that the
 * distance tool touches. Tracks added sources / layers / listeners so we
 * can assert clean teardown.
 */
function createFakeMap() {
  const sources = new Map<string, unknown>();
  const layers = new Map<string, unknown>();
  const listenersByEvent = new Map<string, Set<(...args: unknown[]) => void>>();
  const canvasStyle: Record<string, string> = {};

  const map = {
    addSource: vi.fn((id: string, spec: unknown) => {
      sources.set(id, spec);
    }),
    removeSource: vi.fn((id: string) => {
      sources.delete(id);
    }),
    getSource: vi.fn((id: string) => {
      if (!sources.has(id)) return undefined;
      return { setData: vi.fn() };
    }),
    addLayer: vi.fn((spec: { id: string }) => {
      layers.set(spec.id, spec);
    }),
    removeLayer: vi.fn((id: string) => {
      layers.delete(id);
    }),
    getLayer: vi.fn((id: string) => layers.get(id)),
    on: vi.fn((type: string, fn: (...args: unknown[]) => void) => {
      const set = listenersByEvent.get(type) ?? new Set();
      set.add(fn);
      listenersByEvent.set(type, set);
    }),
    off: vi.fn((type: string, fn: (...args: unknown[]) => void) => {
      listenersByEvent.get(type)?.delete(fn);
    }),
    getCanvas: vi.fn(() => ({ style: canvasStyle })),
  };

  return { map, sources, layers, listenersByEvent, canvasStyle };
}

function makeCtx(map: ReturnType<typeof createFakeMap>["map"]): ToolContext & {
  emitMock: ReturnType<typeof vi.fn>;
  suspendMock: ReturnType<typeof vi.fn>;
  restoreMock: ReturnType<typeof vi.fn>;
} {
  const emit = vi.fn();
  const suspend = vi.fn();
  const restore = vi.fn();
  return {
    // The fake covers the API surface the tool actually uses.
    map: map as unknown as ToolContext["map"],
    suspend,
    restore,
    emit,
    suspendMock: suspend,
    restoreMock: restore,
    emitMock: emit,
  };
}

describe("measureDistanceTool", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("identifies as measure-distance with shortcut m", () => {
    expect(measureDistanceTool.id).toBe("measure-distance");
    expect(measureDistanceTool.label).toBe("Measure distance");
    expect(measureDistanceTool.shortcut).toBe("m");
  });

  it("adds 3 sources and 3 layers on setup and suspends map interactions", () => {
    const { map, sources, layers } = createFakeMap();
    const ctx = makeCtx(map);

    measureDistanceTool.setup(ctx);

    expect(sources.size).toBe(3);
    expect(layers.size).toBe(3);
    expect(ctx.suspendMock).toHaveBeenCalledOnce();
    expect(map.getCanvas).toHaveBeenCalled();
  });

  it("registers click / mousemove / dblclick listeners plus a keydown handler", () => {
    const { map, listenersByEvent } = createFakeMap();
    const ctx = makeCtx(map);
    const addEventListener = vi.spyOn(window, "addEventListener");

    measureDistanceTool.setup(ctx);

    expect(listenersByEvent.get("click")?.size).toBe(1);
    expect(listenersByEvent.get("mousemove")?.size).toBe(1);
    expect(listenersByEvent.get("dblclick")?.size).toBe(1);
    expect(addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function), {
      capture: true,
    });
  });

  it("cleanup removes every source, layer, and listener it added", () => {
    const { map, sources, layers, listenersByEvent } = createFakeMap();
    const ctx = makeCtx(map);
    const removeEventListener = vi.spyOn(window, "removeEventListener");

    const result = measureDistanceTool.setup(ctx);
    result.cleanup();

    expect(sources.size).toBe(0);
    expect(layers.size).toBe(0);
    for (const set of listenersByEvent.values()) {
      expect(set.size).toBe(0);
    }
    expect(removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function), {
      capture: true,
    });
    expect(ctx.restoreMock).toHaveBeenCalledOnce();
  });

  it("cleanup is idempotent — calling it twice does not throw or double-restore", () => {
    const { map } = createFakeMap();
    const ctx = makeCtx(map);

    const result = measureDistanceTool.setup(ctx);
    result.cleanup();
    result.cleanup();

    expect(ctx.restoreMock).toHaveBeenCalledOnce();
  });
});
