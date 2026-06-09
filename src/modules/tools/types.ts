import type { Feature } from "geojson";
import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * Stable identifier for a tool. The first two are baked in; downstream forks
 * can introduce their own ids — the open string union keeps it extensible
 * without losing autocomplete on the built-ins.
 */
export type ToolId = "measure-distance" | "draw-polygon" | (string & Record<never, never>);

/**
 * Runtime context handed to a tool's `setup()`.
 *
 * The host (the panel that owns the map) is responsible for constructing
 * this — `suspend` / `restore` typically toggle `map.dragPan` and
 * `map.doubleClickZoom`, and `emit` typically dispatches into a store.
 */
export interface ToolContext {
  map: MapLibreMap;
  /** Pause map interactions that conflict with tool input. Idempotent. */
  suspend(): void;
  /** Re-enable previously suspended interactions. Idempotent. */
  restore(): void;
  /** Submit a finalized feature; the host wires this to its store. */
  emit(feature: Feature): void;
}

/** What every `setup()` returns — the cleanup contract is mandatory. */
export interface ToolSetupResult {
  /**
   * Remove every listener / source / layer the tool added. Called when the
   * user activates a different tool, deactivates, or the host unmounts.
   * Must be safe to call multiple times.
   */
  cleanup(): void;
}

/**
 * A tool definition.
 *
 * Tools are plain JS objects, not Vue components — they live below the
 * component layer and own their MapLibre lifecycle directly. The `setup`
 * function is called when the tool is activated and returns the cleanup.
 */
export interface Tool {
  /** Stable id, matches `useToolsStore.activeId`. */
  id: ToolId;
  /** Human-readable label for menus, toolbars, and the command palette. */
  label: string;
  /** Optional keyboard shortcut (e.g. "m"). Wired by useKeyboardShortcuts. */
  shortcut?: string;
  /** Lucide-style icon name; the consuming component picks the icon. */
  icon?: string;
  /**
   * Initialize the tool on the given map. Called on activation; the
   * returned `cleanup` must release every resource the tool added.
   */
  setup(ctx: ToolContext): ToolSetupResult;
}
