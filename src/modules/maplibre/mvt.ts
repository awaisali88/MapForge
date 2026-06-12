// Ported from orbat-mapper (MIT) — https://github.com/orbat-mapper/orbat-mapper — original at src/modules/maplibreview/mgrsgrid/mgrsTileProtocol.ts
/**
 * Shared, framework-agnostic Mapbox Vector Tile (MVT / PBF) encoder.
 *
 * This is the byte-encoding + tile-coordinate core that BOTH the MGRS and H3
 * custom MapLibre protocols build on. It hand-encodes the MVT protobuf via the
 * `pbf` package (proven against MapLibre's tile pipeline in orbat-mapper) and
 * exposes the tile-coordinate helpers (`tileBounds`, `latToMercatorY`,
 * `project`) the geometry generators need.
 *
 * Compared to orbat-mapper's inline encoder, this module generalises:
 *   - multiple named layers per tile;
 *   - per-feature geometry of type point (1) / line (2) / polygon (3);
 *   - per-feature PROPERTIES via a keys/values/tags table (required because H3
 *     features carry { h3, res } and MGRS labels carry { label }).
 *
 * The wire constants are kept faithful to orbat-mapper / the MVT 2.1 spec:
 *   - layer `version` field 15 → 2
 *   - layer `extent` field 5 → 4096
 *   - command ids MoveTo=1, LineTo=2, ClosePath=7
 *   - geometry type tags point=1, line=2, polygon=3
 *
 * @see https://github.com/mapbox/vector-tile-spec/tree/master/2.1
 */
import { PbfWriter } from "pbf";

/** MVT tile extent (coordinate space is 0..EXTENT on each axis). */
export const EXTENT = 4096;

/** Geometry command ids (lower 3 bits of a command integer). */
const CMD_MOVE_TO = 1;
const CMD_LINE_TO = 2;
const CMD_CLOSE_PATH = 7;

/** MVT geometry type tags (the feature `type` field). */
export const GeomType = {
  POINT: 1,
  LINE: 2,
  POLYGON: 3,
} as const;
export type GeomType = (typeof GeomType)[keyof typeof GeomType];

/** A tile-space coordinate (integers in 0..EXTENT, but unrounded inputs are accepted). */
export type Point = [number, number];

/** Scalar property values an MVT value table can carry. */
export type PropertyValue = string | number | boolean;

/**
 * A feature to encode. `geometry` is one or more rings/lines of tile-space
 * points: a single ring for points (one point) and lines, or one-or-more
 * closed rings for polygons. `properties` are optional and get folded into the
 * layer's keys/values/tags tables.
 */
export interface MvtFeatureInput {
  id?: number;
  type: GeomType;
  /** For POINT: `[[x, y]]`. For LINE: `[[...line]]`. For POLYGON: `[[...ring], ...]`. */
  geometry: Point[][];
  properties?: Record<string, PropertyValue>;
}

// ---------- low-level encoding helpers (faithful to orbat / the MVT spec) ----------

/** Zig-zag encode a signed 32-bit delta into an unsigned varint-friendly int. */
export function zigzag(n: number): number {
  return (n << 1) ^ (n >> 31);
}

/** Pack a command id + repeat count into a single command integer. */
export function command(id: number, count: number): number {
  return (id & 0x7) | (count << 3);
}

/** Encode a single point's geometry: one MoveTo. */
function encodePointGeometry(pt: Point): number[] {
  return [command(CMD_MOVE_TO, 1), zigzag(Math.round(pt[0])), zigzag(Math.round(pt[1]))];
}

/** Encode a polyline's geometry: MoveTo to the first vertex, then LineTo the rest. */
function encodeLineGeometry(pts: Point[]): number[] {
  const geom: number[] = [];
  let cx = 0;
  let cy = 0;
  const x0 = Math.round(pts[0]![0]);
  const y0 = Math.round(pts[0]![1]);
  geom.push(command(CMD_MOVE_TO, 1));
  geom.push(zigzag(x0 - cx), zigzag(y0 - cy));
  cx = x0;
  cy = y0;
  if (pts.length > 1) {
    geom.push(command(CMD_LINE_TO, pts.length - 1));
    for (let i = 1; i < pts.length; i++) {
      const xi = Math.round(pts[i]![0]);
      const yi = Math.round(pts[i]![1]);
      geom.push(zigzag(xi - cx), zigzag(yi - cy));
      cx = xi;
      cy = yi;
    }
  }
  return geom;
}

/**
 * Encode a polygon's geometry: for each ring, MoveTo the first vertex, LineTo
 * the intermediate vertices, then ClosePath. If a ring is given with an
 * explicit closing vertex equal to its first, that duplicate is dropped (the
 * ClosePath command closes it instead, per the MVT spec).
 */
function encodePolygonGeometry(rings: Point[][]): number[] {
  const geom: number[] = [];
  let cx = 0;
  let cy = 0;
  for (const ringRaw of rings) {
    if (ringRaw.length < 3) continue;
    let ring = ringRaw;
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    if (
      ring.length > 3 &&
      Math.round(first[0]) === Math.round(last[0]) &&
      Math.round(first[1]) === Math.round(last[1])
    ) {
      ring = ring.slice(0, -1);
    }
    if (ring.length < 3) continue;

    const x0 = Math.round(ring[0]![0]);
    const y0 = Math.round(ring[0]![1]);
    geom.push(command(CMD_MOVE_TO, 1));
    geom.push(zigzag(x0 - cx), zigzag(y0 - cy));
    cx = x0;
    cy = y0;

    geom.push(command(CMD_LINE_TO, ring.length - 1));
    for (let i = 1; i < ring.length; i++) {
      const xi = Math.round(ring[i]![0]);
      const yi = Math.round(ring[i]![1]);
      geom.push(zigzag(xi - cx), zigzag(yi - cy));
      cx = xi;
      cy = yi;
    }
    geom.push(command(CMD_CLOSE_PATH, 1));
  }
  return geom;
}

function encodeGeometry(feature: MvtFeatureInput): number[] {
  switch (feature.type) {
    case GeomType.POINT:
      return encodePointGeometry(feature.geometry[0]![0]!);
    case GeomType.LINE:
      return encodeLineGeometry(feature.geometry[0]!);
    case GeomType.POLYGON:
      return encodePolygonGeometry(feature.geometry);
    default:
      return [];
  }
}

// ---------- layer assembly (keys / values / tags tables) ----------

interface EncodedFeature {
  id: number;
  tags: number[];
  type: GeomType;
  geom: number[];
}

/**
 * Accumulates features for one named layer, interning property keys and values
 * into the layer's shared tables and producing per-feature tag pointers.
 */
export class LayerBuilder {
  readonly name: string;
  private features: EncodedFeature[] = [];
  private keys: string[] = [];
  private values: PropertyValue[] = [];
  private keyIndex = new Map<string, number>();
  private valueIndex = new Map<string, number>();

  constructor(name: string) {
    this.name = name;
  }

  /** Number of features added so far. */
  get featureCount(): number {
    return this.features.length;
  }

  private internKey(key: string): number {
    let i = this.keyIndex.get(key);
    if (i === undefined) {
      i = this.keys.length;
      this.keyIndex.set(key, i);
      this.keys.push(key);
    }
    return i;
  }

  private internValue(value: PropertyValue): number {
    // Values are deduped per (type, value) so e.g. number 1 and string "1"
    // don't collide.
    const dedupeKey = `${typeof value}:${String(value)}`;
    let i = this.valueIndex.get(dedupeKey);
    if (i === undefined) {
      i = this.values.length;
      this.valueIndex.set(dedupeKey, i);
      this.values.push(value);
    }
    return i;
  }

  /** Add a feature; folds its properties into the shared key/value tables. */
  addFeature(feature: MvtFeatureInput): void {
    const tags: number[] = [];
    if (feature.properties) {
      for (const [key, value] of Object.entries(feature.properties)) {
        if (value === undefined || value === null) continue;
        tags.push(this.internKey(key), this.internValue(value));
      }
    }
    this.features.push({
      id: feature.id ?? this.features.length,
      tags,
      type: feature.type,
      geom: encodeGeometry(feature),
    });
  }

  /** @internal Snapshot for the pbf writer. */
  toWireLayer(): WireLayer {
    return {
      name: this.name,
      features: this.features,
      keys: this.keys,
      values: this.values,
    };
  }
}

interface WireLayer {
  name: string;
  features: EncodedFeature[];
  keys: string[];
  values: PropertyValue[];
}

// ---------- pbf writers (field numbers per the MVT 2.1 protobuf schema) ----------

function writeValue(value: PropertyValue, pbf: PbfWriter): void {
  if (typeof value === "string") {
    pbf.writeStringField(1, value);
  } else if (typeof value === "boolean") {
    pbf.writeBooleanField(7, value);
  } else if (Number.isInteger(value)) {
    // sint (zig-zag) covers negative integers cleanly.
    pbf.writeSVarintField(6, value);
  } else {
    pbf.writeDoubleField(3, value);
  }
}

function writeFeature(feature: EncodedFeature, pbf: PbfWriter): void {
  pbf.writeVarintField(1, feature.id);
  if (feature.tags.length) pbf.writePackedVarint(2, feature.tags);
  pbf.writeVarintField(3, feature.type);
  if (feature.geom.length) pbf.writePackedVarint(4, feature.geom);
}

function writeLayer(layer: WireLayer, pbf: PbfWriter): void {
  pbf.writeStringField(1, layer.name);
  for (const f of layer.features) pbf.writeMessage(2, writeFeature, f);
  for (const k of layer.keys) pbf.writeStringField(3, k);
  for (const v of layer.values) pbf.writeMessage(4, writeValue, v);
  pbf.writeVarintField(5, EXTENT);
  pbf.writeVarintField(15, 2);
}

function writeTileMessage(layers: WireLayer[], pbf: PbfWriter): void {
  for (const l of layers) pbf.writeMessage(3, writeLayer, l);
}

// ---------- public tile builder API ----------

/**
 * Builds an MVT tile from one or more named layers. Create a tile, grab one or
 * more layers via {@link layer}, add features to them, then call {@link finish}
 * to get the encoded `ArrayBuffer`.
 *
 * Empty layers are still emitted so a style's `source-layer` references resolve
 * even when a tile has no features.
 */
export class TileBuilder {
  private layers: LayerBuilder[] = [];
  private byName = new Map<string, LayerBuilder>();

  /** Get (or lazily create) a named layer to add features to. */
  layer(name: string): LayerBuilder {
    let l = this.byName.get(name);
    if (!l) {
      l = new LayerBuilder(name);
      this.byName.set(name, l);
      this.layers.push(l);
    }
    return l;
  }

  /** Encode all layers into a finished MVT/PBF `ArrayBuffer`. */
  finish(): ArrayBuffer {
    const pbf = new PbfWriter();
    writeTileMessage(
      this.layers.map((l) => l.toWireLayer()),
      pbf,
    );
    const out = pbf.finish();
    // Return a tightly-sized ArrayBuffer copy so callers can hand it straight
    // to MapLibre without a stale view over a larger backing buffer.
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
  }
}

/**
 * Convenience: build a tile from a plain map of layer name → features.
 * `layerOrder` (when given) fixes the emit order, and lets you emit empty
 * layers that aren't present in `featuresByLayer`.
 */
export function encodeTile(
  featuresByLayer: Record<string, MvtFeatureInput[]>,
  layerOrder?: string[],
): ArrayBuffer {
  const builder = new TileBuilder();
  const names = layerOrder ?? Object.keys(featuresByLayer);
  for (const name of names) {
    const layer = builder.layer(name);
    for (const f of featuresByLayer[name] ?? []) layer.addFeature(f);
  }
  return builder.finish();
}

// ---------- tile-coordinate helpers (Web-Mercator) ----------

/**
 * Web-Mercator Y (in radians of the Gudermannian projection) for a latitude,
 * clamped to ±89.999° so the poles don't blow up to ±Infinity.
 */
export function latToMercatorY(lat: number): number {
  const clamped = Math.max(Math.min(lat, 89.999), -89.999);
  const latRad = (clamped * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
}

/** Geographic + mercator bounds of an XYZ tile. */
export interface TileBounds {
  west: number;
  east: number;
  north: number;
  south: number;
  /** Mercator-Y of the tile's north edge. */
  mercNorth: number;
  /** Mercator-Y of the tile's south edge. */
  mercSouth: number;
}

/** Geographic + mercator bounds for tile `z/x/y`. */
export function tileBounds(z: number, x: number, y: number): TileBounds {
  const scale = 1 << z;
  const mercN = Math.PI - (2 * Math.PI * y) / scale;
  const mercS = Math.PI - (2 * Math.PI * (y + 1)) / scale;
  return {
    west: (x / scale) * 360 - 180,
    east: ((x + 1) / scale) * 360 - 180,
    north: (Math.atan(Math.sinh(mercN)) * 180) / Math.PI,
    south: (Math.atan(Math.sinh(mercS)) * 180) / Math.PI,
    mercNorth: mercN,
    mercSouth: mercS,
  };
}

/**
 * Project lng/lat into a tile's 0..EXTENT pixel space using the tile's
 * geographic west/east and mercator north/south edges. X is linear in
 * longitude; Y uses Web-Mercator so the grid lines up with MapLibre's
 * rendering. Returns rounded integer tile coordinates.
 */
export function project(lng: number, lat: number, bounds: TileBounds): Point {
  const x = ((lng - bounds.west) / (bounds.east - bounds.west)) * EXTENT;
  const mercY = latToMercatorY(lat);
  const y = ((bounds.mercNorth - mercY) / (bounds.mercNorth - bounds.mercSouth)) * EXTENT;
  return [Math.round(x), Math.round(y)];
}
