import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BASEMAPS,
  buildRasterStyle,
  defaultBasemap,
  findBasemapById,
  googleTiles,
  resolveBasemapStyle,
} from "@/modules/maplibre/basemaps";

describe("basemaps registry", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("googleTiles", () => {
    it("expands the default template into 4 mt0..mt3 subdomain URLs with lyrs substituted", () => {
      const tiles = googleTiles("s");
      expect(tiles).toHaveLength(4);
      expect(tiles[0]).toBe("https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}");
      expect(tiles[3]).toBe("https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}");
      // {x}/{y}/{z} placeholders are left for MapLibre to fill.
      for (const t of tiles) expect(t).toContain("x={x}&y={y}&z={z}");
    });

    it("substitutes the requested layer type", () => {
      expect(googleTiles("y")[0]).toContain("lyrs=y");
      expect(googleTiles("m")[0]).toContain("lyrs=m");
      expect(googleTiles("p")[0]).toContain("lyrs=p");
    });

    it("honors VITE_GOOGLE_TILES_TEMPLATE override", () => {
      vi.stubEnv("VITE_GOOGLE_TILES_TEMPLATE", "https://ex.test/{s}/l={lyrs}/{z}/{x}/{y}");
      const tiles = googleTiles("s");
      expect(tiles).toEqual([
        "https://ex.test/0/l=s/{z}/{x}/{y}",
        "https://ex.test/1/l=s/{z}/{x}/{y}",
        "https://ex.test/2/l=s/{z}/{x}/{y}",
        "https://ex.test/3/l=s/{z}/{x}/{y}",
      ]);
    });
  });

  describe("buildRasterStyle", () => {
    it("produces a valid v8 style with a background + raster layer", () => {
      const style = buildRasterStyle({
        id: "x",
        label: "X",
        kind: "raster",
        tiles: ["https://t/{z}/{x}/{y}"],
        attribution: "attr",
      });
      expect(style.version).toBe(8);
      const src = style.sources.basemap;
      expect(src?.type).toBe("raster");
      if (src?.type === "raster") {
        expect(src.tiles).toEqual(["https://t/{z}/{x}/{y}"]);
        expect(src.tileSize).toBe(256);
        expect(src.attribution).toBe("attr");
      }
      expect(style.layers).toHaveLength(2);
      expect(style.layers[0]?.type).toBe("background");
      expect(style.layers[1]?.type).toBe("raster");
    });
  });

  describe("resolveBasemapStyle", () => {
    it("returns the URL string for a vector basemap", () => {
      const liberty = BASEMAPS.find((b) => b.id === "liberty")!;
      const style = resolveBasemapStyle(liberty);
      expect(typeof style).toBe("string");
      expect(style).toBe(liberty.kind === "vector" ? liberty.url : "");
    });

    it("returns a style object for a raster basemap", () => {
      const sat = BASEMAPS.find((b) => b.id === "google-satellite")!;
      const style = resolveBasemapStyle(sat);
      expect(typeof style).not.toBe("string");
      if (typeof style === "string") throw new Error("expected a style object");
      expect(style.version).toBe(8);
      expect(style.sources.basemap?.type).toBe("raster");
    });
  });

  describe("BASEMAPS", () => {
    it("includes the vector + Google + Esri entries", () => {
      const ids = BASEMAPS.map((b) => b.id);
      expect(ids).toEqual(
        expect.arrayContaining([
          "liberty",
          "bright",
          "positron",
          "google-satellite",
          "google-hybrid",
          "google-roadmap",
          "google-terrain",
          "esri-imagery",
        ]),
      );
    });

    it("Google basemaps are raster with 4 subdomain tiles", () => {
      const sat = BASEMAPS.find((b) => b.id === "google-satellite")!;
      expect(sat.kind).toBe("raster");
      if (sat.kind === "raster") expect(sat.tiles).toHaveLength(4);
    });

    it("Esri imagery is a single-URL raster with z/y/x order and maxzoom 19", () => {
      const esri = BASEMAPS.find((b) => b.id === "esri-imagery")!;
      expect(esri.kind).toBe("raster");
      if (esri.kind === "raster") {
        expect(esri.tiles).toHaveLength(1);
        expect(esri.tiles[0]).toContain("/{z}/{y}/{x}");
        expect(esri.maxzoom).toBe(19);
      }
    });
  });

  describe("findBasemapById", () => {
    it("returns a known online basemap by id", () => {
      const result = findBasemapById("liberty");
      expect(result).toBeDefined();
      expect(result?.id).toBe("liberty");
      expect(result?.kind).toBe("vector");
    });

    it("returns another known online basemap", () => {
      const result = findBasemapById("esri-imagery");
      expect(result).toBeDefined();
      expect(result?.id).toBe("esri-imagery");
    });

    it("returns undefined for an unknown id", () => {
      expect(findBasemapById("does-not-exist")).toBeUndefined();
    });

    it("returns undefined for an empty string", () => {
      expect(findBasemapById("")).toBeUndefined();
    });
  });

  describe("defaultBasemap", () => {
    it("defaults to liberty when VITE_MAPLIBRE_STYLE_URL is unset", () => {
      const def = defaultBasemap();
      expect(def.id).toBe("liberty");
      expect(def.kind).toBe("vector");
    });

    it("uses VITE_MAPLIBRE_STYLE_URL when set", () => {
      vi.stubEnv("VITE_MAPLIBRE_STYLE_URL", "https://example.com/style.json");
      const def = defaultBasemap();
      expect(def.id).toBe("custom");
      expect(def).toMatchObject({ kind: "vector", url: "https://example.com/style.json" });
    });
  });
});
