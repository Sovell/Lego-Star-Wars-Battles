import type { TerrainTile, TerrainType } from "../../types";
import { createSeededRandomSource, randomIndex, type RandomSource } from "../random";
import { createTerrainTile } from "../terrain-definitions";
import type {
  GeneratedMap,
  MapGenerationConfig,
  MapGenerationRecipe,
  MapScenarioRequirements,
  MapTerrainWeight,
} from "./map-generation-types";
import { createMapArmyLayout, generateDeploymentZones } from "./deployment-zone-generator";
import { placeMapObjects } from "./map-object-placement";
import { getMapTheme } from "./map-themes";
import { createMapTopologyPlan, type MapClusterShape } from "./map-topology";
import { getMapScenarioRequirements } from "./scenario-map-requirements";

export function generateMap(config: MapGenerationConfig): GeneratedMap {
  const scenarioRequirements = getMapScenarioRequirements(
    config.scenario,
    config.defenderArmySlot,
  );
  const recipe = createRecipe(config, scenarioRequirements);
  const generatedDeploymentZones = generateDeploymentZones({
    width: recipe.width,
    height: recipe.height,
    armies: config.armies,
    defenderArmySlot: scenarioRequirements.defenderArmySlot,
    depth: recipe.deploymentDepth,
  });
  const requirements = {
    ...scenarioRequirements,
    deploymentZones: normalizeDeploymentZones(
      generatedDeploymentZones.length > 0
        ? generatedDeploymentZones
        : scenarioRequirements.deploymentZones,
      recipe.width,
      recipe.height,
    ),
  };
  const theme = getMapTheme(recipe.themeId);
  const random = createSeededRandomSource(recipe.seed);
  const topology = createMapTopologyPlan({
    motif: recipe.generationMotif,
    width: recipe.width,
    height: recipe.height,
    random,
  });
  const corridorCells = topology.corridorCells;
  const reservedTerrainCells = new Set([
    ...corridorCells,
    ...requirements.deploymentZones.flatMap((zone) =>
      zone.cells.map(({ x, y }) => `${x},${y}`)
    ),
  ]);
  const targetTileCount = Math.min(
    Math.round(recipe.width * recipe.height * recipe.terrainDensity),
    recipe.width * recipe.height - reservedTerrainCells.size,
  );
  const tiles = createTerrainClusters({
    width: recipe.width,
    height: recipe.height,
    targetTileCount,
    corridorCells: reservedTerrainCells,
    clusterSize: theme.generation.clusterSize,
    terrainWeights: theme.generation.terrainWeights,
    clusterShape: topology.clusterShape,
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
  const dressedTiles = dressScenarioObjectives({
    tiles,
    objects,
    requirements,
    corridorCells,
    width: recipe.width,
    height: recipe.height,
  });
  const objectCells = new Set(
    objects.map(({ position }) => `${position.x},${position.y}`),
  );
  const finalTiles = dressedTiles.filter(({ x, y }) => !objectCells.has(`${x},${y}`));

  return {
    board: {
      width: recipe.width,
      height: recipe.height,
      tiles: finalTiles,
      objects,
    },
    deploymentZones: structuredClone(requirements.deploymentZones),
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
    generatorVersion: 5,
    width: config.width,
    height: config.height,
    seed: config.seed,
    themeId: config.themeId,
    themeVersion: theme.version,
    generationMotif: theme.generation.motif,
    terrainDensity,
    ...(requirements.scenarioId ? { scenarioId: requirements.scenarioId } : {}),
    ...(requirements.defenderArmySlot !== undefined
      ? { defenderArmySlot: requirements.defenderArmySlot }
      : {}),
    deploymentDepth: config.deploymentDepth ?? 2,
    armyLayout: createMapArmyLayout(config.armies),
  };
}

function normalizeDeploymentZones(
  zones: MapScenarioRequirements["deploymentZones"],
  width: number,
  height: number,
): MapScenarioRequirements["deploymentZones"] {
  return zones.map((zone) => ({
    ...zone,
    cells: zone.cells.filter(({ x, y }) =>
      x >= 0 && y >= 0 && x < width && y < height
    ),
  }));
}

function createTerrainClusters({
  width,
  height,
  targetTileCount,
  corridorCells,
  clusterSize,
  terrainWeights,
  clusterShape,
  random,
}: {
  width: number;
  height: number;
  targetTileCount: number;
  corridorCells: ReadonlySet<string>;
  clusterSize: { minimum: number; maximum: number };
  terrainWeights: MapTerrainWeight[];
  clusterShape: MapClusterShape;
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
      clusterShape,
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
  clusterShape,
  random,
}: {
  origin: Position;
  terrainType: TerrainType;
  desiredSize: number;
  width: number;
  height: number;
  corridorCells: ReadonlySet<string>;
  tiles: Map<string, TerrainTile>;
  clusterShape: MapClusterShape;
  random: RandomSource;
}): void {
  const clusterCells: Position[] = [];
  addCell(origin);

  while (clusterCells.length < desiredSize) {
    const candidates = uniquePositions(
      clusterCells.flatMap((cell) => clusterNeighbors(cell, width, height, clusterShape)),
    )
      .filter((cell) => isAvailable(cell, corridorCells, tiles));
    if (candidates.length === 0) break;
    addCell(candidates[randomIndex(candidates.length, random)]);
  }

  function addCell(cell: Position): void {
    tiles.set(positionKey(cell), createTerrainTile(terrainType, cell.x, cell.y));
    clusterCells.push(cell);
  }
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

function dressScenarioObjectives({
  tiles,
  objects,
  requirements,
  corridorCells,
  width,
  height,
}: {
  tiles: TerrainTile[];
  objects: NonNullable<GeneratedMap["board"]["objects"]>;
  requirements: MapScenarioRequirements;
  corridorCells: ReadonlySet<string>;
  width: number;
  height: number;
}): TerrainTile[] {
  const storyRequirements = requirements.requiredObjects.filter(({ placement }) =>
    placement === "defender-depth" || placement === "assault-route"
  );
  if (storyRequirements.length === 0) return tiles;

  const attackerCells = requirements.deploymentZones
    .find(({ armySlot }) => armySlot === requirements.attackerArmySlot)?.cells ?? [];
  const defenderCells = requirements.deploymentZones
    .find(({ armySlot }) => armySlot === requirements.defenderArmySlot)?.cells ?? [];
  if (attackerCells.length === 0 || defenderCells.length === 0) return tiles;

  const attacker = centroid(attackerCells);
  const defender = centroid(defenderCells);
  const delta = { x: defender.x - attacker.x, y: defender.y - attacker.y };
  const forward = Math.abs(delta.x) >= Math.abs(delta.y)
    ? { x: Math.sign(delta.x), y: 0 }
    : { x: 0, y: Math.sign(delta.y) };
  const occupiedCells = new Set(objects.map(({ position }) => positionKey(position)));
  const deploymentCells = new Set(
    requirements.deploymentZones.flatMap(({ cells }) => cells.map(positionKey)),
  );
  const terrainByPosition = new Map(tiles.map((tile) => [positionKey(tile), tile]));
  const requiredCount = requirements.requiredObjects.reduce((sum, entry) => sum + entry.count, 0);
  const requiredObjects = objects.slice(0, requiredCount);

  requiredObjects.forEach((object, index) => {
    const lateral = Math.abs(forward.x) > 0
      ? { x: 0, y: index % 2 === 0 ? -1 : 1 }
      : { x: index % 2 === 0 ? -1 : 1, y: 0 };
    setFirstAvailableTerrain(
      "DifficultTerrain",
      [
        offset(object.position, -forward.x, -forward.y),
        offset(object.position, -forward.x + lateral.x, -forward.y + lateral.y),
        offset(object.position, -forward.x - lateral.x, -forward.y - lateral.y),
      ],
      terrainByPosition,
      occupiedCells,
      deploymentCells,
      corridorCells,
      width,
      height,
    );
    setFirstAvailableTerrain(
      "HeavyCover",
      [
        offset(object.position, lateral.x, lateral.y),
        offset(object.position, -lateral.x, -lateral.y),
        offset(object.position, forward.x, forward.y),
      ],
      terrainByPosition,
      occupiedCells,
      deploymentCells,
      corridorCells,
      width,
      height,
    );
  });

  return [...terrainByPosition.values()];
}

function setFirstAvailableTerrain(
  terrainType: TerrainType,
  candidates: Array<{ x: number; y: number }>,
  terrainByPosition: Map<string, TerrainTile>,
  occupiedCells: ReadonlySet<string>,
  deploymentCells: ReadonlySet<string>,
  corridorCells: ReadonlySet<string>,
  width: number,
  height: number,
): void {
  const isAvailable = ({ x, y }: { x: number; y: number }) => {
    const key = `${x},${y}`;
    return x >= 0 && y >= 0 && x < width && y < height &&
      !occupiedCells.has(key) &&
      !deploymentCells.has(key);
  };
  const position = candidates.find((candidate) =>
    isAvailable(candidate) && !corridorCells.has(positionKey(candidate))
  ) ?? candidates.find(isAvailable);
  if (position) {
    terrainByPosition.set(positionKey(position), createTerrainTile(terrainType, position.x, position.y));
  }
}

function centroid(positions: Array<{ x: number; y: number }>): { x: number; y: number } {
  return {
    x: positions.reduce((sum, position) => sum + position.x, 0) / positions.length,
    y: positions.reduce((sum, position) => sum + position.y, 0) / positions.length,
  };
}

function offset(position: { x: number; y: number }, x: number, y: number) {
  return { x: position.x + x, y: position.y + y };
}

function clusterNeighbors(
  position: Position,
  width: number,
  height: number,
  shape: MapClusterShape,
): Position[] {
  if (shape === "compact") return neighbors(position, width, height);

  const candidates = shape === "organic"
    ? [
        ...neighbors(position, width, height),
        { x: position.x - 1, y: position.y - 1 },
        { x: position.x + 1, y: position.y - 1 },
        { x: position.x - 1, y: position.y + 1 },
        { x: position.x + 1, y: position.y + 1 },
      ]
    : [
        { x: position.x - 1, y: position.y },
        { x: position.x + 1, y: position.y },
      ];

  return candidates.filter(({ x, y }) => x >= 0 && y >= 0 && x < width && y < height);
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

type Position = { x: number; y: number };
