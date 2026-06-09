---
layout: home

hero:
  name: MapForge
  text: A MapLibre-first Vue 3 sandbox
  tagline: Build and test map tools — drawing, measuring, and CommandVue plugins — on a full-screen MapLibre map.
  actions:
    - theme: brand
      text: Get started
      link: /architecture
    - theme: alt
      text: View on GitHub
      link: https://github.com/uraanai/MapForge

features:
  - title: Map-first
    details: Boots straight to a full-screen MapLibre GL map using OpenFreeMap — no API key required.
  - title: Tool registry
    details: Plain-object tools with a setup/cleanup contract. measure-distance and draw-polygon ship built-in; add your own to the TOOLS array.
  - title: Drawings + geo
    details: Finalized features land in a Pinia store and render via a GeoJSON layer. Geospatial math via @turf, mgrs, and h3-js.
  - title: Plugin-ready
    details: A pnpm workspace (packages/*) reserved for a future plugin module installable into CommandVue.
---

## Quickstart

```bash
pnpm install
pnpm dev
```

The dev server boots at `http://localhost:5173` to a full-screen map with a starter control overlay: toggle the measure / draw-polygon tools, clear drawings, and switch basemaps.

## What to read first

1. [**Architecture**](/architecture) — the map composable, the tool registry, how drawings render, and where the future plugin lives.

## License

Apache 2.0. Use it, fork it, brand it.
