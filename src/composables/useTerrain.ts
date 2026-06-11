import type { Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { onBeforeUnmount, ref, watch } from "vue";

import { localDemConfig } from "@/modules/maplibre/terrain";

/**
 * 3D terrain via a locally-hosted DEM (`raster-dem` + `map.setTerrain`).
 *
 * The DEM source/config comes from env (`modules/maplibre/terrain.ts`). When no
 * DEM URL is configured, `available` is `false` and the toggle stays hidden.
 *
 * Lifecycle note: a basemap switch (`map.setStyle`, in `useTerraDraw`) wipes
 * every source and the terrain setting. So we re-apply on the map's `style.load`
 * event (fires once per `setStyle`), re-adding the DEM source and re-enabling
 * terrain whenever it was on — mirroring how `useTerraDraw` rebuilds its control.
 */

const DEM_SOURCE_ID = "local-dem";
const EXAGGERATION = 1;

export interface TerrainApi {
  /** Whether a local DEM is configured (drives toggle visibility). */
  available: ShallowRef<boolean>;
  /** Whether 3D terrain is currently enabled. */
  enabled: ShallowRef<boolean>;
  /** Flip terrain on/off (no-op when no DEM is configured). */
  toggle: () => void;
  /**
   * Clear live terrain *before* a `setStyle` basemap switch, keeping `enabled`
   * so it re-applies on the next `style.load`. Call this before switching
   * basemaps: a `setStyle` deletes `style.projection` until the new style loads,
   * and terrain's render-to-texture pass can fire a render in that window —
   * which crashes reading `style.projection.shaderPreludeCode`. Tearing terrain
   * down first removes that render pass and the crash.
   */
  suspendForStyleSwitch: () => void;
}

export function useTerrain(mapRef: ShallowRef<MaplibreMap | null>): TerrainApi {
  const dem = localDemConfig();
  const available = ref(dem !== null);
  const enabled = ref(false);
  let bound: MaplibreMap | null = null;

  /** Add the DEM source once (idempotent — guarded by `getSource`). */
  function ensureSource(map: MaplibreMap): void {
    if (!dem || map.getSource(DEM_SOURCE_ID)) return;
    map.addSource(DEM_SOURCE_ID, {
      type: "raster-dem",
      tiles: dem.tiles,
      encoding: dem.encoding,
      tileSize: dem.tileSize,
      maxzoom: dem.maxzoom,
    });
  }

  /** Reflect `enabled` onto the live map. setTerrain needs the source first. */
  function applyTerrain(map: MaplibreMap): void {
    if (enabled.value && dem) {
      ensureSource(map);
      map.setTerrain({ source: DEM_SOURCE_ID, exaggeration: EXAGGERATION });
    } else {
      map.setTerrain(null);
    }
  }

  function setEnabled(value: boolean): void {
    if (!available.value) return;
    enabled.value = value;
    const map = bound;
    if (!map) return;
    applyTerrain(map);
    // Flat (pitch 0) terrain is invisible — tilt in on enable, level out on disable.
    if (value && map.getPitch() < 30) map.easeTo({ pitch: 60, duration: 600 });
    else if (!value && map.getPitch() > 0) map.easeTo({ pitch: 0, duration: 600 });
  }

  function toggle(): void {
    setEnabled(!enabled.value);
  }

  function suspendForStyleSwitch(): void {
    // Clear the live terrain but leave `enabled` set — onStyleLoad re-applies it.
    if (bound && enabled.value) bound.setTerrain(null);
  }

  // A basemap switch wiped the DEM source + terrain — restore if it was on.
  function onStyleLoad(): void {
    if (bound && enabled.value) applyTerrain(bound);
  }

  function attach(map: MaplibreMap): void {
    bound = map;
    map.on("style.load", onStyleLoad);
  }

  function detach(): void {
    if (bound) bound.off("style.load", onStyleLoad);
    bound = null;
  }

  watch(
    mapRef,
    (m) => {
      detach();
      if (m) attach(m);
    },
    { immediate: true },
  );

  onBeforeUnmount(detach);

  return { available, enabled, toggle, suspendForStyleSwitch };
}
