import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";

import { useToolsStore } from "@/stores/tools";

describe("tools store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts with no active tool and empty history", () => {
    const store = useToolsStore();
    expect(store.activeId).toBeNull();
    expect(store.history).toEqual([]);
  });

  it("toggle() activates a tool when none is active", () => {
    const store = useToolsStore();
    store.toggle("measure-distance");
    expect(store.activeId).toBe("measure-distance");
  });

  it("toggle() with the same id deactivates the tool", () => {
    const store = useToolsStore();
    store.toggle("measure-distance");
    store.toggle("measure-distance");
    expect(store.activeId).toBeNull();
  });

  it("toggle() with a different id replaces the active tool", () => {
    const store = useToolsStore();
    store.toggle("measure-distance");
    store.toggle("draw-polygon");
    expect(store.activeId).toBe("draw-polygon");
  });

  it("activate() always sets the active tool, no toggling", () => {
    const store = useToolsStore();
    store.activate("measure-distance");
    store.activate("measure-distance");
    expect(store.activeId).toBe("measure-distance");
  });

  it("deactivate() clears the active tool", () => {
    const store = useToolsStore();
    store.activate("draw-polygon");
    store.deactivate();
    expect(store.activeId).toBeNull();
  });

  it("history records each activation in most-recent-first order, deduped", () => {
    const store = useToolsStore();
    store.activate("measure-distance");
    store.activate("draw-polygon");
    store.activate("measure-distance");
    expect(store.history).toEqual(["measure-distance", "draw-polygon"]);
  });

  it("history caps at 10 entries", () => {
    const store = useToolsStore();
    for (let i = 0; i < 15; i++) {
      store.activate(`tool-${i}`);
    }
    expect(store.history.length).toBe(10);
    expect(store.history[0]).toBe("tool-14");
  });
});
