import { describe, expect, it } from "vitest";
import { validateMapConnectivity } from "./map-connectivity";
import { generateMap } from "./map-generator";
import { desertOutpostTheme, getMapTheme } from "./map-themes";

describe("map generator foundation", () => {
  it("registers the Desert Outpost theme separately from terrain rules", () => {
    expect(getMapTheme("desert-outpost")).toEqual(desertOutpostTheme);
    expect(desertOutpostTheme.presentation.assetSetId).toBe("prototype-desert");
    expect(desertOutpostTheme.generation.clusterSize).toEqual({ minimum: 2, maximum: 5 });
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

    expect(result.board.tiles.length).toBeGreaterThan(0);
    expect(result.board.tiles.length).toBeLessThan(12);
    expect(result.board.tiles.every((tile) =>
      tile.x >= 0 && tile.x < 4 && tile.y >= 0 && tile.y < 3
    )).toBe(true);
    expect(result.board.tiles.every((tile) => tile.movementCost >= 1)).toBe(true);
    expect(result.recipe).toEqual({
      generatorVersion: 2,
      width: 4,
      height: 3,
      seed: 42,
      themeId: "desert-outpost",
      themeVersion: 2,
      terrainDensity: 1,
    });
  });

  it("can leave the terrain layer empty while still placing themed objects", () => {
    const result = generateMap({
      width: 8,
      height: 8,
      seed: 42,
      themeId: "desert-outpost",
      terrainDensity: 0,
    });

    expect(result.board.tiles).toEqual([]);
    expect(result.board.objects?.length).toBeGreaterThanOrEqual(3);
    expect(result.board.objects?.length).toBeLessThanOrEqual(5);
    expect(validateMapConnectivity(result.board)).toEqual({
      horizontal: true,
      vertical: true,
      valid: true,
    });
  });

  it("groups most terrain into same-type orthogonal clusters", () => {
    const result = generateMap({
      width: 12,
      height: 12,
      seed: 1138,
      themeId: "desert-outpost",
      terrainDensity: 0.5,
    });
    const tilesByPosition = new Map(
      result.board.tiles.map((tile) => [`${tile.x},${tile.y}`, tile]),
    );
    const clusteredTileCount = result.board.tiles.filter((tile) => [
      [tile.x - 1, tile.y],
      [tile.x + 1, tile.y],
      [tile.x, tile.y - 1],
      [tile.x, tile.y + 1],
    ].some(([x, y]) =>
      tilesByPosition.get(`${x},${y}`)?.terrainType === tile.terrainType
    )).length;

    expect(clusteredTileCount / result.board.tiles.length).toBeGreaterThanOrEqual(0.75);
  });

  it("keeps horizontal and vertical corridors open for many seeds", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const result = generateMap({
        width: 8,
        height: 8,
        seed,
        themeId: "desert-outpost",
        terrainDensity: 0.8,
      });

      expect(validateMapConnectivity(result.board), `seed ${seed}`).toEqual({
        horizontal: true,
        vertical: true,
        valid: true,
      });
    }
  });

  it("detects when blocking terrain cuts the horizontal corridor", () => {
    const result = generateMap({
      width: 3,
      height: 3,
      seed: 1,
      themeId: "desert-outpost",
      terrainDensity: 0,
    });
    result.board.tiles = Array.from({ length: 3 }, (_, y) => ({
      x: 1,
      y,
      terrainType: "Building",
      defenseBonus: 2,
      attackBonus: 0,
      movementCost: 2,
      blocksLineOfSight: true,
    }));

    expect(validateMapConnectivity(result.board)).toEqual({
      horizontal: false,
      vertical: true,
      valid: false,
    });
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
