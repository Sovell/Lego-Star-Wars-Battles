import type { TerrainTile, TerrainType } from "../../types";
import { createSeededRandomSource, randomIndex, type RandomSource } from "../random";
import { terrainPresets } from "../terrain-presets";
import type {
  GeneratedMap,
  MapGenerationConfig,
  MapGenerationRecipe,
  MapScenarioRequirements,
  MapTerrainWeight,
} from "./map-generation-types";
import { placeMapObjects } from "./map-object-placement";
import { getMapTheme } from "./map-themes";
import { getMapScenarioRequirements } from "./scenario-map-requirements";

export function generateMap(config: MapGenerationConfig): GeneratedMap {
  const requirements = getMapScenarioRequirements(config.scenario, config.defenderArmySlot);
  const recipe = createRecipe(config, requirements);
  const theme = getMapTheme(recipe.themeId);
  const random = createSeededRandomSource(recipe.seed);
  const corridorCells = createCrossMapCorridors(recipe.width, recipe.height, random);
  const targetTileCount = Math.min(
    Math.round(recipe.width * recipe.height * recipe.terrainDensity),
    recipe.width * recipe.height - corridorCells.size,
  );
  const tiles = createTerrainClusters({
    width: recipe.width,
    height: recipe.height,
    targetTileCount,
    corridorCells,
    clusterSize: theme.generation.clusterSize,
    terrainWeights: theme.generation.terrainWeights,
    random,
  });
  const objects = placeMapObjects({
    width: recipe.width,
    height: recipe.height,
    terrainTiles: tiles,
    corridorCells,
    requirements,
    theme,
    random,
  });

  return {
    board: {
      width: recipe.width,
      height: recipe.height,
      tiles,
      objects,
    },
    recipe,
  };
}

function createRecipe(
  config: MapGenerationConfig,
  requirements: MapScenarioRequirements,
): MapGenerationRecipe {
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
    generatorVersion: 2,
    width: config.width,
    height: config.height,
    seed: config.seed,
    themeId: config.themeId,
    themeVersion: theme.version,
    terrainDensity,
    ...(requirements.scenarioId ? { scenarioId: requirements.scenarioId } : {}),
    ...(requirements.defenderArmySlot !== undefined
      ? { defenderArmySlot: requirements.defenderArmySlot }
      : {}),
  };
}

function createTerrainClusters({
  width,
  height,
  targetTileCount,
  corridorCells,
  clusterSize,
  terrainWeights,
  random,
}: {
  width: number;
  height: number;
  targetTileCount: number;
  corridorCells: ReadonlySet<string>;
  clusterSize: { minimum: number; maximum: number };
  terrainWeights: MapTerrainWeight[];
  random: RandomSource;
}): TerrainTile[] {
  assertClusterSize(clusterSize);
  const tiles = new Map<string, TerrainTile>();

  while (tiles.size < targetTileCount) {
    const availableCells = listAvailableCells(width, height, corridorCells, tiles);
    if (availableCells.length === 0) break;
    const origin = availableCells[randomIndex(availableCells.length, random)];
    const terrainType = selectWeightedTerrain(terrainWeights, random);
    const desiredSize = clusterSize.minimum + randomIndex(
      clusterSize.maximum - clusterSize.minimum + 1,
      random,
    );
    growCluster({
      origin,
      terrainType,
      desiredSize: Math.min(desiredSize, targetTileCount - tiles.size),
      width,
      height,
      corridorCells,
      tiles,
      random,
    });
  }

  return [...tiles.values()].sort((first, second) =>
    first.y - second.y || first.x - second.x
  );
}

function growCluster({
  origin,
  terrainType,
  desiredSize,
  width,
  height,
  corridorCells,
  tiles,
  random,
}: {
  origin: Position;
  terrainType: TerrainType;
  desiredSize: number;
  width: number;
  height: number;
  corridorCells: ReadonlySet<string>;
  tiles: Map<string, TerrainTile>;
  random: RandomSource;
}): void {
  const clusterCells: Position[] = [];
  addCell(origin);

  while (clusterCells.length < desiredSize) {
    const candidates = uniquePositions(clusterCells.flatMap((cell) => neighbors(cell, width, height)))
      .filter((cell) => isAvailable(cell, corridorCells, tiles));
    if (candidates.length === 0) break;
    addCell(candidates[randomIndex(candidates.length, random)]);
  }

  function addCell(cell: Position): void {
    tiles.set(positionKey(cell), createTerrainTile(terrainType, cell.x, cell.y));
    clusterCells.push(cell);
  }
}

function createCrossMapCorridors(
  width: number,
  height: number,
  random: RandomSource,
): ReadonlySet<string> {
  const cells = new Set<string>();
  let y = randomIndex(height, random);
  for (let x = 0; x < width; x += 1) {
    cells.add(positionKey({ x, y }));
    if (x < width - 1) {
      const nextY = clamp(y + chooseCorridorStep(random), 0, height - 1);
      cells.add(positionKey({ x, y: nextY }));
      y = nextY;
    }
  }

  let x = randomIndex(width, random);
  for (let verticalY = 0; verticalY < height; verticalY += 1) {
    cells.add(positionKey({ x, y: verticalY }));
    if (verticalY < height - 1) {
      const nextX = clamp(x + chooseCorridorStep(random), 0, width - 1);
      cells.add(positionKey({ x: nextX, y: verticalY }));
      x = nextX;
    }
  }
  return cells;
}

function chooseCorridorStep(random: RandomSource): -1 | 0 | 1 {
  const roll = random();
  if (roll < 0.25) return -1;
  if (roll >= 0.75) return 1;
  return 0;
}

function listAvailableCells(
  width: number,
  height: number,
  corridorCells: ReadonlySet<string>,
  tiles: ReadonlyMap<string, TerrainTile>,
): Position[] {
  const cells: Position[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = { x, y };
      if (isAvailable(cell, corridorCells, tiles)) cells.push(cell);
    }
  }
  return cells;
}

function neighbors(position: Position, width: number, height: number): Position[] {
  return [
    { x: position.x - 1, y: position.y },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y - 1 },
    { x: position.x, y: position.y + 1 },
  ].filter(({ x, y }) => x >= 0 && y >= 0 && x < width && y < height);
}

function uniquePositions(positions: Position[]): Position[] {
  return [...new Map(positions.map((position) => [positionKey(position), position])).values()];
}

function isAvailable(
  position: Position,
  corridorCells: ReadonlySet<string>,
  tiles: ReadonlyMap<string, TerrainTile>,
): boolean {
  const key = positionKey(position);
  return !corridorCells.has(key) && !tiles.has(key);
}

function positionKey({ x, y }: Position): string {
  return `${x},${y}`;
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

function assertClusterSize(clusterSize: { minimum: number; maximum: number }): void {
  if (
    !Number.isInteger(clusterSize.minimum) ||
    !Number.isInteger(clusterSize.maximum) ||
    clusterSize.minimum <= 0 ||
    clusterSize.maximum < clusterSize.minimum
  ) {
    throw new Error("Map theme cluster size must define a positive minimum and maximum.");
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

type Position = { x: number; y: number };
