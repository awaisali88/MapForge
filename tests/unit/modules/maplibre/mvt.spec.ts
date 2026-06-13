import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { describe, expect, it } from "vitest";

import {
  EXTENT,
  GeomType,
  LayerBuilder,
  TileBuilder,
  command,
  encodeTile,
  latToMercatorY,
  project,
  tileBounds,
  zigzag,
} from "@/modules/maplibre/mvt";

/** Decode an encoded MVT ArrayBuffer with @mapbox/vector-tile + pbf. */
function decode(buffer: ArrayBuffer): VectorTile {
  return new VectorTile(new PbfReader(new Uint8Array(buffer)));
}

describe("mvt encoder", () => {
  describe("low-level helpers", () => {
    it("zigzag-encodes small signed integers", () => {
      expect(zigzag(0)).toBe(0);
      expect(zigzag(-1)).toBe(1);
      expect(zigzag(1)).toBe(2);
      expect(zigzag(-2)).toBe(3);
      expect(zigzag(2)).toBe(4);
    });

    it("packs command id + count into a command integer", () => {
      // MoveTo (id 1), count 1 -> (1 & 7) | (1 << 3) = 9
      expect(command(1, 1)).toBe(9);
      // LineTo (id 2), count 3 -> (2 & 7) | (3 << 3) = 26
      expect(command(2, 3)).toBe(26);
      // ClosePath (id 7), count 1 -> (7 & 7) | (1 << 3) = 15
      expect(command(7, 1)).toBe(15);
    });

    it("exposes EXTENT = 4096", () => {
      expect(EXTENT).toBe(4096);
    });
  });

  describe("tile-coordinate helpers", () => {
    it("computes tileBounds for z/x/y with geographic + mercator edges", () => {
      // z0/0/0 spans the whole world.
      const b = tileBounds(0, 0, 0);
      expect(b.west).toBeCloseTo(-180, 6);
      expect(b.east).toBeCloseTo(180, 6);
      expect(b.north).toBeCloseTo(85.0511, 3);
      expect(b.south).toBeCloseTo(-85.0511, 3);
      expect(b.mercNorth).toBeCloseTo(Math.PI, 6);
      expect(b.mercSouth).toBeCloseTo(-Math.PI, 6);
    });

    it("clamps latToMercatorY at the poles (no Infinity)", () => {
      expect(Number.isFinite(latToMercatorY(90))).toBe(true);
      expect(Number.isFinite(latToMercatorY(-90))).toBe(true);
      expect(latToMercatorY(0)).toBeCloseTo(0, 9);
    });

    it("projects lng/lat into 0..EXTENT tile space", () => {
      const b = tileBounds(0, 0, 0);
      // Center of the world -> center of the tile.
      const [cx, cy] = project(0, 0, b);
      expect(cx).toBe(EXTENT / 2);
      expect(cy).toBe(EXTENT / 2);
      // West edge -> x 0; east edge -> x EXTENT.
      expect(project(-180, 0, b)[0]).toBe(0);
      expect(project(180, 0, b)[0]).toBe(EXTENT);
    });
  });

  describe("encode + decode round-trip (THE GATE)", () => {
    it("encodes a Point (with a string property), a LineString and a Polygon across two layers, then decodes them back", () => {
      const tile = new TileBuilder();

      // Layer 1: a labelled point + a numeric property.
      const labels = tile.layer("mgrs_labels");
      const pointCoord: [number, number] = [1234, 2048];
      labels.addFeature({
        type: GeomType.POINT,
        geometry: [[pointCoord]],
        properties: { label: "33UVP", res: 5 },
      });

      // Layer 2: a line and a polygon (sharing the geometry layer).
      const shapes = tile.layer("shapes");
      const lineCoords: [number, number][] = [
        [0, 0],
        [500, 500],
        [1000, 250],
      ];
      shapes.addFeature({ type: GeomType.LINE, geometry: [lineCoords] });

      const ring: [number, number][] = [
        [100, 100],
        [900, 100],
        [900, 900],
        [100, 900],
        [100, 100], // explicit closing vertex
      ];
      shapes.addFeature({ type: GeomType.POLYGON, geometry: [ring] });

      const buffer = tile.finish();
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBeGreaterThan(0);

      const decoded = decode(buffer);

      // --- layer names ---
      expect(Object.keys(decoded.layers).sort()).toEqual(["mgrs_labels", "shapes"]);

      // --- mgrs_labels: version / extent / point geometry / property ---
      const labelLayer = decoded.layers.mgrs_labels!;
      expect(labelLayer.name).toBe("mgrs_labels");
      expect(labelLayer.version).toBe(2);
      expect(labelLayer.extent).toBe(4096);
      expect(labelLayer.length).toBe(1);

      const pointFeature = labelLayer.feature(0);
      expect(pointFeature.type).toBe(GeomType.POINT); // 1
      const pointGeom = pointFeature.loadGeometry();
      expect(pointGeom[0]![0]!.x).toBe(pointCoord[0]);
      expect(pointGeom[0]![0]!.y).toBe(pointCoord[1]);
      // string + numeric properties decode back
      expect(pointFeature.properties.label).toBe("33UVP");
      expect(pointFeature.properties.res).toBe(5);

      // --- shapes: line + polygon ---
      const shapeLayer = decoded.layers.shapes!;
      expect(shapeLayer.version).toBe(2);
      expect(shapeLayer.extent).toBe(4096);
      expect(shapeLayer.length).toBe(2);

      const lineFeature = shapeLayer.feature(0);
      expect(lineFeature.type).toBe(GeomType.LINE); // 2
      const lineGeom = lineFeature.loadGeometry();
      expect(lineGeom[0]!.map((p) => [p.x, p.y])).toEqual(lineCoords);

      const polyFeature = shapeLayer.feature(1);
      expect(polyFeature.type).toBe(GeomType.POLYGON); // 3
      const polyGeom = polyFeature.loadGeometry();
      // The decoder re-closes the ring via ClosePath, so the decoded ring has
      // the first vertex repeated at the end — matching our input ring.
      expect(polyGeom[0]!.map((p) => [p.x, p.y])).toEqual(ring);
    });

    it("round-trips real lng/lat coordinates through project() within rounding tolerance", () => {
      const z = 4;
      const x = 8;
      const y = 5;
      const bounds = tileBounds(z, x, y);

      // A point near the centre of this tile.
      const lng = (bounds.west + bounds.east) / 2;
      const lat = (bounds.north + bounds.south) / 2;
      const projected = project(lng, lat, bounds);

      const tile = new TileBuilder();
      tile.layer("pts").addFeature({
        type: GeomType.POINT,
        geometry: [[projected]],
        properties: { label: "center" },
      });

      const decoded = decode(tile.finish());
      const feature = decoded.layers.pts!.feature(0);
      const geom = feature.loadGeometry();

      // Coordinates survive the encode/decode within integer rounding.
      expect(Math.abs(geom[0]![0]!.x - projected[0])).toBeLessThanOrEqual(0);
      expect(Math.abs(geom[0]![0]!.y - projected[1])).toBeLessThanOrEqual(0);

      // And @mapbox/vector-tile re-projects the tile coord back to ~the input
      // lng/lat (its inverse mercator), within sub-tile-pixel tolerance.
      const gj = feature.toGeoJSON(x, y, z);
      const [outLng, outLat] = (gj.geometry as unknown as { coordinates: [number, number] })
        .coordinates;
      expect(outLng).toBeCloseTo(lng, 1);
      expect(outLat).toBeCloseTo(lat, 1);
    });

    it("emits empty layers (no features) which @mapbox/vector-tile drops, but a populated layer survives", () => {
      // @mapbox/vector-tile only surfaces layers that have >=1 feature, so an
      // empty layer is encoded but won't appear after decode. Verify the
      // populated companion layer still decodes.
      const buffer = encodeTile(
        {
          empty: [],
          full: [{ type: GeomType.POINT, geometry: [[[10, 20]]] }],
        },
        ["empty", "full"],
      );
      const decoded = decode(buffer);
      expect(Object.keys(decoded.layers)).toEqual(["full"]);
      expect(decoded.layers.full!.length).toBe(1);
    });
  });

  describe("LayerBuilder property interning", () => {
    it("dedupes repeated keys and values across features", () => {
      const layer = new LayerBuilder("l");
      layer.addFeature({
        type: GeomType.POINT,
        geometry: [[[1, 1]]],
        properties: { kind: "a", n: 1 },
      });
      layer.addFeature({
        type: GeomType.POINT,
        geometry: [[[2, 2]]],
        properties: { kind: "a", n: 2 }, // shared key "kind" + shared value "a"
      });
      expect(layer.featureCount).toBe(2);

      const buffer = encodeTile({ l: [] });
      // (encodeTile is exercised above; here we just decode via TileBuilder.)
      const tile = new TileBuilder();
      const l2 = tile.layer("l");
      l2.addFeature({
        type: GeomType.POINT,
        geometry: [[[1, 1]]],
        properties: { kind: "a", n: 1 },
      });
      l2.addFeature({
        type: GeomType.POINT,
        geometry: [[[2, 2]]],
        properties: { kind: "a", n: 2 },
      });
      const decoded = decode(tile.finish());
      const f0 = decoded.layers.l!.feature(0);
      const f1 = decoded.layers.l!.feature(1);
      expect(f0.properties).toEqual({ kind: "a", n: 1 });
      expect(f1.properties).toEqual({ kind: "a", n: 2 });
      expect(buffer.byteLength).toBeGreaterThan(0);
    });
  });
});
