import type { TerrainTile, TerrainType } from "../../types";
import { createSeededRandomSource, type RandomSource } from "../random";
import { terrainPresets } from "../terrain-presets";
import type {
  GeneratedMap,
  MapGenerationConfig,
  MapGenerationRecipe,
  MapTerrainWeight,
} from "./map-generation-types";
import { getMapTheme } from "./map-themes";

export function generateMap(config: MapGenerationConfig): GeneratedMap {
  const recipe = createRecipe(config);
  const theme = getMapTheme(recipe.themeId);
  const random = createSeededRandomSource(recipe.seed);
  const tiles: TerrainTile[] = [];

  for (let y = 0; y < recipe.height; y += 1) {
    for (let x = 0; x < recipe.width; x += 1) {
      if (random() >= recipe.terrainDensity) continue;
      const terrainType = selectWeightedTerrain(theme.generation.terrainWeights, random);
      tiles.push(createTerrainTile(terrainType, x, y));
    }
  }

  return {
    board: {
      width: recipe.width,
      height: recipe.height,
      tiles,
      objects: [],
    },
    recipe,
  };
}

function createRecipe(config: MapGenerationConfig): MapGenerationRecipe {
  assertPositiveInteger(config.width, "Map width");
  assertPositiveInteger(config.height, "Map height");
  if (!Number.isInteger(config.seed)) {
    throw new Error("Map seed must be an integer.");
  }

  const theme = getMapTheme(config.themeId);
  const terrainDensity = config.terrainDensity ?? theme.generation.defaultTerrainDensity;
  if (!Number.isFinite(terrainDensity) || terrainDensity < 0 || terrainDensity > 1) {
    throw new Error("Terrain density must be between 0 and 1.");
  }

  return {
    generatorVersion: 1,
    width: config.width,
    height: config.height,
    seed: config.seed,
    themeId: config.themeId,
    terrainDensity,
  };
}

function selectWeightedTerrain(
  weights: MapTerrainWeight[],
  random: RandomSource,
): TerrainType {
  const totalWeight = weights.reduce((sum, entry) => {
    if (!Number.isFinite(entry.weight) || entry.weight <= 0) {
      throw new Error(`Terrain weight for ${entry.terrainType} must be greater than zero.`);
    }
    return sum + entry.weight;
  }, 0);
  if (totalWeight === 0) {
    throw new Error("Map theme must define at least one weighted terrain type.");
  }

  const roll = random() * totalWeight;
  let boundary = 0;
  for (const entry of weights) {
    boundary += entry.weight;
    if (roll < boundary) return entry.terrainType;
  }
  return weights[weights.length - 1].terrainType;
}

function createTerrainTile(terrainType: TerrainType, x: number, y: number): TerrainTile {
  const preset = terrainPresets.find((entry) => entry.terrainType === terrainType);
  if (!preset) {
    throw new Error(`Map theme uses terrain without a preset: ${terrainType}.`);
  }
  return { ...preset, x, y };
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}
