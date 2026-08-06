import { createBattlefieldObject } from "../battlefield-objects";
import { randomIndex, type RandomSource } from "../random";
import type { BattlefieldObject, BattlefieldObjectType, TerrainTile } from "../../types";
import type {
  MapObjectPlacement,
  MapObjectWeight,
  MapScenarioRequirements,
  MapTheme,
} from "./map-generation-types";

export function placeMapObjects({
  width,
  height,
  terrainTiles,
  corridorCells,
  requirements,
  theme,
  random,
}: {
  width: number;
  height: number;
  terrainTiles: TerrainTile[];
  corridorCells: ReadonlySet<string>;
  requirements: MapScenarioRequirements;
  theme: MapTheme;
  random: RandomSource;
}): BattlefieldObject[] {
  const terrainByPosition = new Map(
    terrainTiles.map((tile) => [positionKey(tile), tile]),
  );
  const deploymentCells = new Set(
    requirements.deploymentZones.flatMap((zone) =>
      zone.cells
        .filter((cell) => isOnBoard(cell, width, height))
        .map(positionKey)
    ),
  );
  const defenderCells = getDefenderCells(requirements, width, height);
  const objects: BattlefieldObject[] = [];

  for (const requirement of requirements.requiredObjects) {
    for (let index = 0; index < requirement.count; index += 1) {
      const candidates = listCandidates({
        width,
        height,
        terrainByPosition,
        deploymentCells,
        objects,
        minimumSpacing: requirement.placement === "distributed" ? 2 : 1,
      });
      const position = selectRequiredPosition(
        candidates,
        requirement.placement,
        defenderCells,
        objects.filter((object) => object.type === requirement.objectType),
        width,
        height,
        random,
      );
      if (!position) {
        throw new Error(
          `Cannot place required ${requirement.objectType} for scenario ${requirements.scenarioId}.`,
        );
      }
      objects.push(createGeneratedObject(requirement.objectType, position, objects.length));
    }
  }

  const budget = theme.generation.objectBudget;
  assertObjectBudget(budget);
  const objectCount = budget.minimum + randomIndex(budget.maximum - budget.minimum + 1, random);
  for (let index = 0; index < objectCount; index += 1) {
    const candidates = listCandidates({
      width,
      height,
      terrainByPosition,
      deploymentCells,
      objects,
      corridorCells,
      minimumSpacing: budget.minimumSpacing,
      requirePassableTerrain: false,
    });
    if (candidates.length === 0) break;
    const objectType = selectWeightedObject(budget.objectWeights, random);
    const position = candidates[randomIndex(candidates.length, random)];
    objects.push(createGeneratedObject(objectType, position, objects.length));
  }

  return objects;
}

function listCandidates({
  width,
  height,
  terrainByPosition,
  deploymentCells,
  objects,
  corridorCells,
  minimumSpacing,
  requirePassableTerrain = true,
}: {
  width: number;
  height: number;
  terrainByPosition: ReadonlyMap<string, TerrainTile>;
  deploymentCells: ReadonlySet<string>;
  objects: BattlefieldObject[];
  corridorCells?: ReadonlySet<string>;
  minimumSpacing: number;
  requirePassableTerrain?: boolean;
}): Position[] {
  const candidates: Position[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const position = { x, y };
      const key = positionKey(position);
      const terrain = terrainByPosition.get(key);
      if (
        deploymentCells.has(key) ||
        corridorCells?.has(key) ||
        (requirePassableTerrain && terrain && (
          terrain.movementCost > 1 || terrain.blocksLineOfSight
        )) ||
        objects.some((object) => distance(object.position, position) < minimumSpacing)
      ) {
        continue;
      }
      candidates.push(position);
    }
  }
  return candidates;
}

function selectRequiredPosition(
  candidates: Position[],
  placement: MapObjectPlacement,
  defenderCells: Position[],
  matchingObjects: BattlefieldObject[],
  width: number,
  height: number,
  random: RandomSource,
): Position | undefined {
  if (candidates.length === 0) return undefined;
  const center = { x: (width - 1) / 2, y: (height - 1) / 2 };
  if (placement === "defender-side" && defenderCells.length > 0) {
    return chooseAmongBest(candidates, (candidate) => {
      const zoneDistance = Math.min(...defenderCells.map((cell) => distance(cell, candidate)));
      return zoneDistance * 100 + distance(candidate, center);
    }, "minimum", random);
  }
  if (placement === "distributed" && matchingObjects.length > 0) {
    return chooseAmongBest(candidates, (candidate) =>
      Math.min(...matchingObjects.map((object) => distance(object.position, candidate))),
    "maximum", random);
  }
  return chooseAmongBest(candidates, (candidate) => distance(candidate, center), "minimum", random);
}

function chooseAmongBest(
  candidates: Position[],
  score: (position: Position) => number,
  preference: "minimum" | "maximum",
  random: RandomSource,
): Position {
  const scores = candidates.map((candidate) => ({ candidate, score: score(candidate) }));
  const bestScore = preference === "minimum"
    ? Math.min(...scores.map((entry) => entry.score))
    : Math.max(...scores.map((entry) => entry.score));
  const best = scores.filter((entry) => entry.score === bestScore);
  return best[randomIndex(best.length, random)].candidate;
}

function getDefenderCells(
  requirements: MapScenarioRequirements,
  width: number,
  height: number,
): Position[] {
  const configured = requirements.deploymentZones
    .find((zone) => zone.armySlot === requirements.defenderArmySlot)
    ?.cells.filter((cell) => isOnBoard(cell, width, height));
  if (configured?.length) return configured;
  switch (requirements.defenderArmySlot ?? 0) {
    case 1: return Array.from({ length: height }, (_, y) => ({ x: width - 1, y }));
    case 2: return Array.from({ length: width }, (_, x) => ({ x, y: 0 }));
    case 3: return Array.from({ length: width }, (_, x) => ({ x, y: height - 1 }));
    default: return Array.from({ length: height }, (_, y) => ({ x: 0, y }));
  }
}

function selectWeightedObject(weights: MapObjectWeight[], random: RandomSource) {
  const totalWeight = weights.reduce((sum, entry) => {
    if (!Number.isFinite(entry.weight) || entry.weight <= 0) {
      throw new Error(`Object weight for ${entry.objectType} must be greater than zero.`);
    }
    return sum + entry.weight;
  }, 0);
  if (totalWeight === 0) throw new Error("Map theme must define at least one weighted object type.");
  const roll = random() * totalWeight;
  let boundary = 0;
  for (const entry of weights) {
    boundary += entry.weight;
    if (roll < boundary) return entry.objectType;
  }
  return weights[weights.length - 1].objectType;
}

function createGeneratedObject(
  type: BattlefieldObjectType,
  position: Position,
  index: number,
): BattlefieldObject {
  return createBattlefieldObject(
    type,
    position,
    `generated-${type.toLowerCase()}-${index + 1}`,
  );
}

function assertObjectBudget(budget: MapTheme["generation"]["objectBudget"]): void {
  if (
    !Number.isInteger(budget.minimum) ||
    !Number.isInteger(budget.maximum) ||
    budget.minimum < 0 ||
    budget.maximum < budget.minimum ||
    !Number.isInteger(budget.minimumSpacing) ||
    budget.minimumSpacing < 1
  ) {
    throw new Error("Map theme object budget is invalid.");
  }
}

function isOnBoard(position: Position, width: number, height: number): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < width && position.y < height;
}

function distance(first: Position, second: Position): number {
  return Math.max(Math.abs(first.x - second.x), Math.abs(first.y - second.y));
}

function positionKey({ x, y }: Position): string {
  return `${x},${y}`;
}

type Position = { x: number; y: number };
