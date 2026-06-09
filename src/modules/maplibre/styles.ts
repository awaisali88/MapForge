/**
 * MapLibre style URLs.
 *
 * OpenFreeMap is the default for the template — community-run, no API key
 * required, OSM-derived. For air-gapped or rate-sensitive deployments, host
 * your own style.json and point `VITE_MAPLIBRE_STYLE_URL` at it (see
 * `docs/deployment.md` for the offline mode walkthrough).
 */
export const OPENFREEMAP_LIBERTY = "https://tiles.openfreemap.org/styles/liberty";
export const OPENFREEMAP_BRIGHT = "https://tiles.openfreemap.org/styles/bright";
export const OPENFREEMAP_POSITRON = "https://tiles.openfreemap.org/styles/positron";

/**
 * Minimal stub style for offline scenarios — no sources, single background
 * layer painted in the project's dark surface color. Useful as a fallback
 * when remote tile servers aren't reachable.
 */
export const OFFLINE_STUB_STYLE = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0b1120" },
    },
  ],
} as const;
