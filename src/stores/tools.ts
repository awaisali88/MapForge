import type { ToolId } from "@/modules/tools/types";

import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Tools store — owns the single source of truth for which tool is active.
 *
 * The actual tool lifecycle (event listeners, MapLibre source/layer
 * management) lives in `useToolRegistry`, which watches `activeId` and
 * calls `setup()` / `cleanup()` on the matching tool.
 *
 * Toggle semantics:
 *   - `toggle(id)` activates the tool if none is active or a different one
 *     is active; deactivates if the same id is already active.
 *   - `activate(id)` always sets — used by the command palette and
 *     keyboard shortcuts where the user picked the tool explicitly.
 *   - `deactivate()` clears.
 */
export const useToolsStore = defineStore("tools", () => {
  const activeId = ref<ToolId | null>(null);
  const history = ref<ToolId[]>([]);
  const maxHistory = 10;

  function recordHistory(id: ToolId) {
    history.value = [id, ...history.value.filter((h) => h !== id)].slice(0, maxHistory);
  }

  function toggle(id: ToolId): void {
    if (activeId.value === id) {
      activeId.value = null;
      return;
    }
    activeId.value = id;
    recordHistory(id);
  }

  function activate(id: ToolId): void {
    activeId.value = id;
    recordHistory(id);
  }

  function deactivate(): void {
    activeId.value = null;
  }

  return {
    activeId,
    history,
    toggle,
    activate,
    deactivate,
  };
});
