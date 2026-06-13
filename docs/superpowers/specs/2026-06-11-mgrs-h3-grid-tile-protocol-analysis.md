# MapForge MGRS & H3 Grid Upgrade — Analysis & Multi-Phase Execution Plan

> Planning artifact (no code yet). Synthesized from a multi-agent analysis of the
> `orbat-mapper-reference` MapLibre grid implementations + verification of MapForge's
> `useContours.ts` / `stores/overlays.ts`. To be executed by subagents after the open
> questions in §8 are answered.

---

## 1. Executive summary

**Core finding.** MapForge's MGRS and H3 grids are _viewport-GeoJSON_ overlays: on every
settled `moveend`/`zoomend` they read `map.getBounds()`, regenerate the whole feature
collection on the main thread, and push it through `GeoJSONSource.setData`. Four structural
defects:

1. **Recompute jank** — full regeneration + re-upload on every pan/zoom.
2. **Hard truncation caps** — `MAX_LINES = 2000` (MGRS), `MAX_CELLS = 20000` (H3); beyond the
   cap, features are silently `slice()`d to an arbitrary subset.
3. **MGRS is not real MGRS** — a lat/lon graticule with labels sampled at one mid-latitude, not
   a UTM-zone / 100 km GZD tessellation. No UTM zone exceptions (Norway 32V, Svalbard
   31/33/35/37X), no polar limits.
4. **No antimeridian/pole handling** — H3 uses a naive bbox ring; `polygonToCells` failures near
   poles are swallowed (grid silently empties).

**orbat-mapper's approach** solves all four by treating each grid as an **on-the-fly custom
vector-tile protocol** (`maplibre-gl.addProtocol`): MapLibre requests `{z}/{x}/{y}` tiles, a
handler hand-encodes an MVT (PBF) tile per request, and MapLibre's native tile pipeline handles
culling, caching, and zoom — _no `setData`-on-move at all_. MGRS lines are generated in true UTM
space per GZD with hard-coded zone exceptions; H3 cells use a two-strategy enumeration (global
precompute ≤ res 4 / `polygonToCells` > res 4) that structurally dodges the pole/antimeridian
failures.

**Already precedented in MapForge.** `useContours` registers a global maplibre protocol once at
module scope and feeds a `type: "vector"` source from a protocol URL with `source-layer`
line/symbol layers — exactly the transport an MGRS/H3 tile protocol needs.

**Recommendation.** Replace both viewport-GeoJSON grids with custom vector-tile protocols,
modeled on orbat-mapper's algorithms but reconciled to MapForge's conventions (persisted
`overlays` store toggles; **idle-deferred** re-add after `setStyle` — _not_ orbat's `style.load`,
because MapForge has a confirmed null-`light` render crash if you add in the `style.load`
window; defensive try/catch teardown). For MVT encoding, **port orbat-mapper's hand-rolled `pbf`
encoder** (rationale + alternative in §6). Keep `mgrs` and `h3-js`; add only `pbf`. The three
highest-risk areas — MGRS UTM math, H3 dual-strategy enumeration, MVT byte encoding — each get a
dedicated unit-test phase.

---

## 2. How orbat-mapper renders the MGRS grid

Source: `orbat-mapper-reference/.../mgrsgrid/{mgrsTileProtocol.ts (546 lines), useMgrsGrid.ts}`.
**No worker, no geojson-vt, no vt-pbf, no @mapbox/vector-tile.** Surface: `maplibre-gl`
(`addProtocol`/`removeProtocol`), `mgrs` (`forward` only), `pbf` (low-level protobuf writer).

### 2.1 Two-tier design

- **Tier 1 — static GeoJSON GZD graticule** (always on when grid on): `mgrsGzdLineSource` +
  `mgrsGzdLabelSource`, lazily built once and module-cached (`cachedGzdLines ??=`). Lines =
  parallels every 8° (-80…84) + meridians every 6° with hand-coded Norway/Svalbard exceptions.
  Labels = one point per GZD centroid, `properties.id = "33U"` etc., skipping nonexistent
  32X/34X/36X.
- **Tier 2 — dynamic per-accuracy custom-protocol MVT** (`mgrsFineSource`, ≥ map zoom 5): the
  fine 100 km / 10 km / 1 km / 100 m / 10 m grid.

### 2.2 Protocol registration & URL scheme

```ts
export const MGRS_PROTOCOL = "mgrstile";
export function registerMgrsProtocol() {
  addProtocol(MGRS_PROTOCOL, async (params) => {
    const url = params.url.replace(`${MGRS_PROTOCOL}://`, "");
    const [z, x, y] = url.split("/");
    return { data: generateTile(+z, +x, +y) }; // { data: ArrayBuffer }
  });
}
```

Source declares `tiles: ["mgrstile://{z}/{x}/{y}"]`. Handler is `async` but synchronous in
substance (no fetch/worker). **Accuracy is module-global, NOT in the URL** (`currentAccuracy`,
`setMgrsAccuracy(a)`), so the consumer must force a tile refresh when it changes. `EXTENT = 4096`.

### 2.3 Per-tile geometry math

- **Accuracy → cell size:** `accuracyCellMeters(a) = 10^(5-a)` → a=0→100 km (GZD+2-letter
  square), 1→10 km, 2→1 km, 3→100 m, 4→10 m. Precision is driven by `currentAccuracy`, not zoom.
- **Tile bbox** (`tileBounds(z,x,y)`): lat/lng west/east/north/south **plus** mercator-Y of
  north/south edges (`mercN/mercS`) for correct vertical projection. `generateTile` clamps to
  MGRS-valid lat **[-80, 84]** / lng **[-180, 180]**; returns an empty tile if nothing remains.
- **GZD enumeration** — `BANDS = "CDEFGHJKLMNPQRSTUVWX"` (I, O omitted). 8° bands from -80, **X
  widened to 12° (72→84)**. Longitude 6°/zone via `zoneLngRange(zone, band)` with exceptions:
  Norway band V `31V→[0,3]`, `32V→[3,12]`; Svalbard band X `31X→[0,9]`, `33X→[9,21]`,
  `35X→[21,33]`, `37X→[33,42]`. `iterateGzds` yields only intersecting GZDs; skips 32X/34X/36X;
  skips default 31V/32V then **re-emits them after the loop** so custom ranges win.
- **Grid-line algorithm (per GZD per tile):** clip GZD to tile → sample its 4 edges (`NS=8`)
  through `llToUtm` to a tight UTM bbox → snap to grid (`floor/ceil` × cellM) → **perf bound:
  skip GZD if `>200` lines either axis** → walk constant-easting and constant-northing lines,
  each densified into `NSEG=24` segments → `walkLine` converts each UTM sample back to lat/lng
  (`utmToLl`), tests `inGzd`, and **clips at the GZD boundary by 14-iteration bisection**
  (`bisectCrossing`). Each polyline → one MVT line feature (`type:2`).
- **Labels:** per cell centre (UTM `e+cellM/2, n+cellM/2`) → lat/lng; reject if outside GZD or
  outside the _unclamped_ tile bbox; `id = forward([lng,lat], accuracy)` (try/catch→continue);
  `formatLabel` keeps the GZD id whole at accuracy 0, else `prefix\n<easting> <northing>`.

### 2.4 MVT output (hand-encoded via `pbf`)

Two layers always emitted: **`"mgrs"`** (LineString `type:2`, _no tags_ — styling is layer-only)
and **`"mgrs_labels"`** (Point `type:1`, single key `"label"`). Empty tile still emits both
layers so style refs resolve. Helpers: `zigzag(n)=(n<<1)^(n>>31)`, `command(id,count)=(id&0x7)|(count<<3)`;
layer version field 15→2, extent field 5→4096; `project()` uses **unclamped** west/east + merc
bounds, Web-Mercator Y, rounded ints.

### 2.5 UTM ↔ lat/lng — deliberate dual mechanism

- **Labels** use the **`mgrs` npm package `forward([lng,lat], accuracy)`** (canonical id).
- **Grid geometry** uses **custom inlined UTM math** (`llToUtm`/`utmToLl`) — not proj4, not the
  `mgrs` projection API — with constants copied verbatim from `mgrs` (`e²=0.00669438`,
  `e'²=0.006739496752268451`, `k0=0.9996`, meridional-arc base `6367449.145945056`,
  `A_EARTH=6378137`). `llToUtm` takes a `zoneOverride` so points project into a neighbouring
  zone's frame (essential for straight cross-GZD lines); `+5e5` false easting, `+1e7` false
  northing for `lat<0`. Sharing constants keeps lines pixel-consistent with `forward`'s labels.

### 2.6 Composable layer stack + zoom-based level styling (`useMgrsGrid.ts`)

Fine source: `minzoom: max(0, tileZoom-1)`, `maxzoom: tileZoom`, where
**`accuracyToTileZoom(a) = [5,8,11,14,17][a]`** (fixed tile zoom per accuracy so tile boundaries
don't shift while zooming; MapLibre overzooms beyond maxzoom). Layers insert `before "unitLayer"`.

| Layer           | type   | source-layer    | key paint/layout                                                |
| --------------- | ------ | --------------- | --------------------------------------------------------------- |
| `mgrsGzdLine`   | line   | (geojson)       | width 1.8 (thicker), opacity 0.7                                |
| `mgrsGzdLabel`  | symbol | (geojson)       | `text-field ["get","id"]`, size **16**, halo rgba(0,0,0,.7)/1.2 |
| `mgrsFineLine`  | line   | `"mgrs"`        | width 1.2, opacity ~0.6 (fainter)                               |
| `mgrsFineLabel` | symbol | `"mgrs_labels"` | `text-field ["get","label"]`, size **11**, `text-max-width 8`   |

Visual hierarchy is from **constants baked into paint, not zoom expressions**. Decluttering =
MapLibre's **default symbol collision**. Zoom-driven level switching is **imperative JS**:
`zoomToAccuracy(zoom)` (`<8→0,<11→1,<14→2,<17→3,≥17→4`), `FINE_MIN_ZOOM=5` (below it the fine
source is removed, leaving only the GZD graticule). `updateAccuracy` (debounced 200 ms on
`zoomend`) → `setMgrsAccuracy(a)` then **fully removes + re-adds the fine source/layers** (the
only reliable cache-bust, since tiles are MapLibre-cached by `{z}/{x}/{y}` and accuracy isn't in
the key).

### 2.7 Lifecycle (orbat's version — MapForge MUST diverge, see §5.2)

Re-add on **`style.load`** gated by `showMgrsGrid`; idempotent `getSource`/`getLayer` guards;
protocol registered once globally, never torn down; no `onBeforeUnmount`. No projection
awareness (mercator-baked tiles).

---

## 3. How orbat-mapper renders the H3 hex grid

Source: `.../h3grid/{h3TileProtocol.ts, useH3HexGrid.ts}` + dead `greenland.geo.json`/`iceland.geo.json`.
Architecturally a near-twin of the MGRS protocol; geometry comes from `h3-js`.

### 3.1 Protocol & source

`H3_PROTOCOL = "h3tile"`; `map.addSource("h3HexSource", { type:"vector", tiles:["h3tile://{z}/{x}/{y}"],
minzoom:0, maxzoom:tileZoom })`. **Resolution is out-of-band module state** (`currentResolution`,
default 2), set by `setH3Resolution(res)` (clears `boundaryCache`, warms `globalCellCache`).
h3-js used: `polygonToCells`, `cellToBoundary`, `cellToLatLng`, `getRes0Cells`, `cellToChildren`.

### 3.2 Per-tile algorithm — two strategies split at `GLOBAL_ENUM_MAX_RES = 4`

Tile bbox **padded 50%** each direction (overlap is fine — lines only, no fill).

- **Strategy A (res ≤ 4) — global precompute + center-filter (NOT `polygonToCells`).**
  `getGlobalCells(res)`: `getRes0Cells()` (122) → `cellToChildren(c,res)` → `{id,lat,lng}`.
  Cached per res (`globalCellCache`); per-tile filter is a center-in-padded-bbox test +
  `shiftForTile(lng)`. Sizes ≈ `122 × 7^res` (res4 ≈ 288 K cells, built once → linear scan per
  tile). **This is the decisive pole/antimeridian mitigation** — at coarse res, where
  `polygonToCells` is most likely to fail on huge polygons, it's never called.
- **Strategy B (res > 4) — `polygonToCells([polygon], res, true)`** on the padded bbox (per-tile
  bbox is geographically tiny → safe regime). Widens lng padding at high latitude
  (`latFactor = min(2, 1/max(cos(midLat),0.1))`).

### 3.3 Antimeridian / polar edge cases

- `shiftForTile(lng)` returns `0 | ±360` (lands center in padded tile) or `null` (skip).
- Strategy B clips the bbox to ±180 and issues **up to 3 separate `polygonToCells` calls** for
  wrapped ranges, deduped via a `seen` Set.
- Per-vertex unwrap prevents hex tearing across the seam; pole clamping `latToMercatorY` clamps
  lat ±89.999°.
- **The bundled `greenland.geo.json`/`iceland.geo.json` are DEAD** (unreferenced Natural Earth
  polygons, vestigial from an abandoned clip-to-landmass approach). **Do not copy them.**

### 3.4 Boundary → pixels & MVT output

`cellToBoundary(cell, true)` (`[lng,lat]`), memoized; project to `EXTENT=4096`, true-merc Y,
clamp to a 1-tile buffer, round ints, ring explicitly closed. `pbf` hand-rolled (same helpers as
MGRS). Single layer **`"h3"`**, POLYGON `type:3`. **Feature properties: NONE** — only a
sequential per-tile integer `id`. **No H3 cell id, no resolution** → you cannot click a hex to
read its index (gap to close if MapForge wants picking/labels).

### 3.5 Composable (`useH3HexGrid.ts`)

**One layer only** — `h3HexLine` (line, `source-layer:"h3"`, `#3b82f6`, opacity 0.5, width 1.5),
inserted `before "unitLayer"`. No fill, no labels, no zoom filter. `h3ResToTileZoom(res) =
[2,3,4,5,7,9,10,11,12]` (clamp res 8) pins tile zoom per res; `zoomToDefaultResolution` for auto
mode. **Changing resolution = full source+layer rebuild** (maxzoom is baked from res). Eager
coarsen on live `zoom`; debounced-200 ms refine on `zoomend`.

### 3.6 Lifecycle

Re-add on **`style.load`** gated by `showHexGrid`; idempotent guards; no teardown; protocol never
unregistered; no projection awareness; no Web Worker.

---

## 4. orbat-mapper MapLibre integration architecture relevant to us

1. **Protocols are global, registered once behind a module-scoped latch** (`addProtocol` =
   maplibre static, all maps). `unregister*` exists but is never called. _Identical to MapForge's
   `useContours` module-scope `demSource.setupMaplibre()`._
2. **The map is passed INTO the grid composable as `ShallowRef<MlMap | undefined>`** — the
   composable reacts via `watch(mlMap, …, {immediate:true})`, detaching from the old map.
3. **Basemap switch uses `setStyle(style, { diff:false })`** (clean slate; wipes every custom
   source/layer **and `addImage` images**).
4. **Everything re-adds on `style.load`** (run once at mount for already-loaded), gated by
   `show*`, idempotent guards. orbat does NOT use `idle`/`styledata`. **⚠️ MapForge MUST diverge
   here — see §5.2.**
5. **Parameter change (accuracy/resolution) = remove + re-add source** to flush MapLibre's tile
   cache; zoom-driven updates **debounced 200 ms**; **fixed tile-zoom per accuracy/resolution**.
6. **Grid layers inserted `before` the interactive layer** (`"unitLayer"`) so they sit beneath.
7. **Projection/globe:** `setProjection({type})`; projection is not part of the style, re-applied
   on `style.load`; bidirectional sync via `projectiontransition`.

---

## 5. MapForge today vs target

### 5.1 Comparison table

| Dimension               | MapForge today (viewport-GeoJSON)                              | Target (custom vector-tile protocol)                                              |
| ----------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Transport**           | `GeoJSONSource.setData` on debounced moveend/zoomend (150 ms)  | `addProtocol` → `type:"vector"` source → native tile pipeline                     |
| **MGRS correctness**    | lat/lon graticule; labels at one mid-lat; **not real UTM/GZD** | true UTM-space lines per GZD; canonical `forward` labels; GZD tier                |
| **MGRS UTM exceptions** | none                                                           | Norway 32V/31V + Svalbard 31/33/35/37X; 32/34/36X deleted                         |
| **H3 enumeration**      | bbox ring → `polygonToCells`, cap `slice(0,20000)`             | dual strategy: global precompute ≤res4 / `polygonToCells` >res4                   |
| **Performance**         | full regen + re-upload every settled pan/zoom (jank)           | per-tile gen, MapLibre culls/caches; no setData-on-move                           |
| **Truncation**          | silent `slice` (2000 lines / 20000 cells)                      | per-tile bounded; perf guard (`>200 lines`/GZD skip), no global cap               |
| **Antimeridian**        | none                                                           | H3 `shiftForTile ±360` + ≤3 split + vertex unwrap; MGRS cut at ±180 (known limit) |
| **Poles**               | `latLonToMGRS` throws→swallowed; H3 silently empties           | MGRS clamp [-80,84]; H3 global-enum dodges + lat clamp ±89.999                    |
| **Labels**              | MGRS lon-axis only at mid-lat; H3 none                         | MGRS GZD (16) + fine (11) symbol layers, dedup; H3 none (no props)                |
| **Picking**             | `properties.cell` on H3                                        | **none in orbat** (props discarded) — gap to close if wanted                      |

### 5.2 Conventions any replacement MUST keep (MapForge-specific, non-negotiable)

1. **Idle-defer re-add after `setStyle` — NOT `style.load`.** `Style._load` sets `_loaded=true`
   _before_ constructing `this.light`; adding a layer in that window → `Cannot read properties of
null (reading 'updateTransitions')`. Use `useContours.scheduleRebuild` verbatim: `onStyleLoad`
   → `remove(bound)` then `map.once("idle", () => { if (bound===map && overlays.<flag> &&
!map.getSource(SOURCE)) add(map); })`. **orbat's `style.load` re-add would crash MapForge.**
2. **Toggle via the persisted `overlays` store only** (`overlays.mgrsGrid`/`hexGrid`,
   `watch(() => overlays.<flag>)`). New tunables become store fields; changing one triggers
   `rebuild()`.
3. **Defensive try/catch teardown** (`remove()` wrapped; `detach()` unbinds listeners then
   removes; detach-before-attach on map swap).
4. **Idempotent adds** guarded by `!map.getSource(SOURCE)` / `!map.getLayer(...)`.
5. **Protocol registered exactly once at module scope** behind a latch (mirror `useContours`).
6. **Layer insertion:** MapForge has no `"unitLayer"` — insert **beneath the Terra Draw / drawings
   layers** (resolve the Terra Draw layer id at add time; fall back to top-of-stack if absent).

---

## 6. Recommended target approach

### 6.1 Encoding toolchain — port orbat's hand-rolled `pbf` encoder (primary)

| Option                                          | Deps       | Pros                                                                                                               | Cons                                                                                                                                  |
| ----------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Port orbat's `pbf` encoder** (recommended) | `pbf` only | proven vs MapLibre; MGRS+H3 share one ~60-line encoder; matches the briefs' exact algorithms; smallest dep surface | hand-rolled MVT is the highest-risk area; must be unit-tested via `@mapbox/vector-tile` decode                                        |
| **B. `geojson-vt` + `vt-pbf`**                  | 2 deps     | well-trodden recipe                                                                                                | geojson-vt emits JSON not PBF (must run vt-pbf after); re-slices GeoJSON we already cut; loses orbat's UTM-line/boundary-clip control |

**Recommendation: A.** The briefs give orbat's encoder + UTM math + H3 dual-strategy _complete_.
Porting keeps it to **one new dep (`pbf`)** and avoids re-deriving the UTM line generation
geojson-vt can't express. Keep B as the Phase-1 fallback if the encoder proves flaky.

### 6.2 Port vs build fresh

**Port the protocol files** (`mgrsTileProtocol.ts`, `h3TileProtocol.ts`) as the algorithmic core
(the hard-won UTM constants, GZD exceptions, H3 dual-strategy). **Build the composables fresh** —
orbat's use `style.load` (crashes us), `"unitLayer"` (we lack), and a popover UI we don't have.

### 6.3 Dependencies

- **Add:** `pbf`. **Add (dev):** `@mapbox/vector-tile` (decode in tests, not shipped).
- **Keep:** `mgrs`, `h3-js`. **Copy nothing else** (the dead geojson files stay behind).
- Update README Stack + `project-and-stack.md` locked-stack table.

### 6.4 How it slots in

- **Protocol files** `src/modules/maplibre/{mvt.ts, mgrsTileProtocol.ts, h3TileProtocol.ts}` —
  self-contained, no Vue/store; export `register*`/`generateTile`/`set*`.
- **Registration** at module scope of each composable (latch), like `useContours`.
- **Composables** keep their paths (`useMgrsGrid.ts`/`useHexGrid.ts`, bodies replaced); toggles
  off the store; `scheduleRebuild` idle-defer verbatim; imperative level switch (remove+re-add on
  accuracy/resolution change) reuses the store-`rebuild()` pattern.
- **`src/modules/geo/grid.ts`** (`mgrsGridGeoJSON`/`hexGridGeoJSON`) becomes dead → delete those
  exports + tests in the final phase (or feature-flag for one release).

### 6.5 Licensing (blocks Phase 2+)

Confirm `orbat-mapper-reference`'s license vs MapForge's **Apache 2.0**. If permissive
(MIT/Apache/BSD): port with an attribution header citing the source. If GPL/AGPL/unlicensed: **do
not copy** — clean-room from this doc's algorithm descriptions and cite the analysis, not the
files.

---

## 7. Multi-phase, multi-agent execution plan

Legend: **[S]** sequential · **[∥]** parallel with siblings. Risk 🔴 high / 🟠 med / 🟢 low.

- **Phase 0 — Licensing + decisions gate [S] 🟢.** Resolve §8 before any code (license, encoder
  A/B, MGRS GZD tier, H3 picking, store fields, rollback flag, setStyle mode). Output: a decision
  record. Gates everything.
- **Phase 1 — Deps + shared MVT encoder [S] 🔴.** Create `src/modules/maplibre/mvt.ts` (`zigzag`,
  `command`, `writeLayer/Feature`, tile writer v2/extent 4096, `project`, `latToMercatorY`,
  `tileBounds`). Add `pbf` (+ dev `@mapbox/vector-tile`); docs. **Gate:** unit test encodes a
  known Line/Point/Polygon, decodes via `@mapbox/vector-tile`, asserts coordinate round-trip +
  layer name/version/extent. If it can't pass, fall back to Option B here.
- **Phase 2 — MGRS tile protocol [S after P1] 🔴.** Create `mgrsTileProtocol.ts` (protocol reg,
  `MgrsAccuracy`/`setMgrsAccuracy`, `llToUtm`/`utmToLl` verbatim constants, `zoneLngRange`
  exceptions, `iterateGzds`, `generateTile`, `formatLabel`; `mgrs.forward` for labels). **Tests:**
  UTM round-trip <1e-3 m across hemispheres/zones; exact exception ranges for 31V/32V/31X/33X/35X/37X
  - 32X/34X/36X omitted; label-vs-line cell-centre consistency; `generateTile` decodes to
    `mgrs`/`mgrs_labels`; polar tile (>84°) empty-but-valid. Antimeridian = documented known limit.
- **Phase 3 — MGRS composable + styling [S after P2] 🟠.** Rewrite `useMgrsGrid.ts`: module-scope
  latch reg; GZD tier per P0; fine source `minzoom:max(0,tz-1)/maxzoom:tz`,
  `accuracyToTileZoom=[5,8,11,14,17]`, `zoomToAccuracy`, `FINE_MIN_ZOOM=5`; `updateAccuracy`
  debounced 200 ms → remove/re-add fine. **MapForge idle-defer lifecycle**, store toggle,
  try/catch teardown, insert beneath Terra Draw. Store: add MGRS tunable fields if P0 says. **Verify:**
  Playwright toggle/pan/zoom across accuracy thresholds + basemap-switch survival, console clean.
- **Phase 4 — H3 tile protocol incl. edge cases [∥ with P2, S after P1] 🔴.** Create
  `h3TileProtocol.ts` (protocol reg, `setH3Resolution`, `GLOBAL_ENUM_MAX_RES=4`, `getGlobalCells`,
  `shiftForTile`, Strategy A/B, antimeridian ≤3-split + vertex unwrap, high-lat padding,
  `cellToBoundary` projection, `generateTile`). Emit cell-id props per P0. Do NOT copy the geojson
  files. **Tests:** `getGlobalCells` counts ≈122×7^res; antimeridian tile cells both sides deduped,
  no torn rings; polar tile bounded + no throw; res>4 uses `polygonToCells` bounded; decode to
  closed `"h3"` polygons. Consider `polygonToCellsExperimental` as a Strategy-B hardening.
- **Phase 5 — H3 composable [S after P4] 🟠.** Rewrite `useHexGrid.ts`: latch reg; source
  `maxzoom=h3ResToTileZoom([2,3,4,5,7,9,10,11,12])`; `zoomToDefaultResolution` auto mode; single
  `h3HexLine` beneath Terra Draw; eager-coarsen/debounced-refine; resolution change = remove/re-add;
  **idle-defer lifecycle**, store toggle, try/catch teardown; guard the resolution-watcher feedback
  loop. Store: hex tunables per P0. **Verify:** Playwright toggle/zoom/antimeridian/near-pole pan,
  basemap-switch survival, console clean.
- **Phase 6 — Integration + globe compat [S after P3 & P5] 🟠.** Both grids beneath Terra Draw,
  coexist with contours/graticule (z-order, no id collisions). **Globe:** protocols bake mercator
  tiles; verify MapLibre reprojects acceptably onto the globe, else document as a known limitation
  or gate fine grids to mercator (P0 decision). Assess adopting `setStyle({diff:false})`. **Verify:**
  Playwright matrix {MGRS,H3}×{mercator,globe}×{basemap A,B}.
- **Phase 7 — Cleanup + verification + docs [S, final] 🟢.** Delete dead
  `mgrsGridGeoJSON`/`hexGridGeoJSON` + tests (or flag). Full cache-free gauntlet
  (type-check/lint/test/spell/build/docs:build). CSpell add `mgrstile`/`h3tile`/UTM terms. Update
  `architecture.md` (tile-protocol grid pattern). Two-stage verify (Playwright green + human
  design-review checklist).

**Critical path:** P0 → P1 → (P2 ∥ P4) → (P3 ∥ P5) → P6 → P7. P1 must finish alone (shared
`mvt.ts`). **Highest-risk:** 🔴 MVT encoding (P1 decode-gate), 🔴 H3 pole/antimeridian (P4
`polygonToCellsExperimental` fallback), 🔴 MGRS UTM zone exceptions (P2 exact-range tests). The
idle-defer-vs-remove/re-add race (P3/P5) is the subtle MapForge-unique integration risk.

---

## 8. Open questions for the user (must answer before Phase 2)

1. **Licensing (blocks P2+):** orbat-mapper-reference's license? Verbatim port into Apache-2.0
   MapForge (with attribution) acceptable, or clean-room from this doc?
2. **Encoder:** Option **A** (port `pbf` hand-rolled, +1 dep) vs **B** (geojson-vt+vt-pbf, +2 deps)?
   (Recommend A, B as fallback.)
3. **MGRS GZD tier:** keep orbat's two-tier (static GeoJSON GZD graticule + dynamic fine), or
   generate the GZD frame purely from accuracy-0 fine tiles (simpler, one source)?
4. **H3 picking/labels:** emit cell-id (+ resolution) feature properties so a hex can be clicked /
   labeled (orbat emits none)? And encode resolution into the URL (`h3tile://{res}/{z}/{x}/{y}`)
   to avoid the remove/re-add cache-bust?
5. **Store tunables → settings drawer:** which controls become persisted fields? (MGRS
   auto-accuracy vs manual + line color/opacity; H3 auto-resolution vs manual + line color/opacity.)
6. **Globe:** ship mercator-baked grids reprojected onto the globe (document distortion), or gate
   fine grids to mercator-only?
7. **Rollback:** delete old `*GridGeoJSON` immediately (P7) or keep behind a flag for one release?
8. **`setStyle` mode:** adopt orbat's `setStyle(style, {diff:false})` for a clean basemap switch
   (re-adds `addImage` images), or keep MapForge's current behavior?
