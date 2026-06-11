import type { Map as MaplibreMap } from "maplibre-gl";
import type { ShallowRef } from "vue";

import { ref } from "vue";

/** Bottom-right cursor coordinate readout. Stub — replaced in Phase 2. */

export function useCoordinateReadout(_map: ShallowRef<MaplibreMap | null>) {
  return { text: ref("") };
}
