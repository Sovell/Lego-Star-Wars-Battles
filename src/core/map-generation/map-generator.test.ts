import { describe, expect, it } from "vitest";
import { generateMap } from "./map-generator";
import { desertOutpostTheme, getMapTheme } from "./map-themes";

describe("map generator foundation", () => {
  it("registers the Desert Outpost theme separately from terrain rules", () => {
    expect(getMapTheme("desert-outpost")).toEqual(desertOutpostTheme);
    expect(desertOutpostTheme.presentation.assetSetId).toBe("prototype-desert");
    expect(desertOutpostTheme.generation.terrainWeights).toEqual([
      { terrainType: "DifficultTerrain", weight: 4 },
      { terrainType: "LightCover", weight: 3 },
      { terrainType: "HeavyCover", weight: 2 },
      { terrainType: "Building", weight: 1 },
    ]);
  });

  it("recreates the same map from the same seed and recipe", () => {
    const config = {
      width: 8,
      height: 8,
      seed: 1977,
      themeId: "desert-outpost" as const,
    };

    expect(generateMap(config)).toEqual(generateMap(config));
  });

  it("produces a different terrain layout for a different seed", () => {
    const first = generateMap({
      width: 8,
      height: 8,
      seed: 1977,
      themeId: "desert-outpost",
    });
    const second = generateMap({
      width: 8,
      height: 8,
      seed: 2005,
      themeId: "desert-outpost",
    });

    expect(first.board.tiles).not.toEqual(second.board.tiles);
  });

  it("creates terrain tiles from the shared gameplay presets", () => {
    const result = generateMap({
      width: 4,
      height: 3,
      seed: 42,
      themeId: "desert-outpost",
      terrainDensity: 1,
    });

    expect(result.board.tiles).toHaveLength(12);
    expect(result.board.tiles.every((tile) =>
      tile.x >= 0 && tile.x < 4 && tile.y >= 0 && tile.y < 3
    )).toBe(true);
    expect(result.board.tiles.every((tile) => tile.movementCost >= 1)).toBe(true);
    expect(result.recipe).toEqual({
      generatorVersion: 1,
      width: 4,
      height: 3,
      seed: 42,
      themeId: "desert-outpost",
      terrainDensity: 1,
    });
  });

  it("can generate an empty mechanical layer over the themed ground", () => {
    const result = generateMap({
      width: 8,
      height: 8,
      seed: 42,
      themeId: "desert-outpost",
      terrainDensity: 0,
    });

    expect(result.board.tiles).toEqual([]);
    expect(result.board.objects).toEqual([]);
  });

  it("rejects invalid dimensions, seeds, and density", () => {
    expect(() => generateMap({
      width: 0,
      height: 8,
      seed: 1,
      themeId: "desert-outpost",
    })).toThrow("Map width must be a positive integer.");
    expect(() => generateMap({
      width: 8,
      height: 8,
      seed: 1.5,
      themeId: "desert-outpost",
    })).toThrow("Map seed must be an integer.");
    expect(() => generateMap({
      width: 8,
      height: 8,
      seed: 1,
      themeId: "desert-outpost",
      terrainDensity: 1.1,
    })).toThrow("Terrain density must be between 0 and 1.");
  });
});
