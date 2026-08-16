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
  const attackerCells = getAttackerCells(requirements, width, height);
  const objects: BattlefieldObject[] = [];

  for (const requirement of requirements.requiredObjects) {
    for (let index = 0; index < requirement.count; index += 1) {
      const storyPlacement =
        requirement.placement === "defender-depth" || requirement.placement === "assault-route";
      const candidates = listCandidates({
        width,
        height,
        terrainByPosition,
        deploymentCells,
        objects,
        minimumSpacing: getRequiredObjectSpacing(requirement.placement),
        requirePassableTerrain: !storyPlacement,
      });
      const position = selectRequiredPosition(
        candidates,
        requirement.placement,
        attackerCells,
        defenderCells,
        corridorCells,
        objects.filter((object) => object.type === requirement.objectType),
        index,
        requirement.count,
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
  attackerCells: Position[],
  defenderCells: Position[],
  corridorCells: ReadonlySet<string>,
  matchingObjects: BattlefieldObject[],
  placementIndex: number,
  placementCount: number,
  width: number,
  height: number,
  random: RandomSource,
): Position | undefined {
  if (candidates.length === 0) return undefined;
  const center = { x: (width - 1) / 2, y: (height - 1) / 2 };
  if (
    (placement === "defender-depth" || placement === "assault-route") &&
    attackerCells.length > 0 &&
    defenderCells.length > 0
  ) {
    return selectStoryPosition({
      candidates,
      placement,
      attackerCells,
      defenderCells,
      corridorCells,
      placementIndex,
      placementCount,
      width,
      height,
      random,
    });
  }
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

function selectStoryPosition({
  candidates,
  placement,
  attackerCells,
  defenderCells,
  corridorCells,
  placementIndex,
  placementCount,
  width,
  height,
  random,
}: {
  candidates: Position[];
  placement: Extract<MapObjectPlacement, "defender-depth" | "assault-route">;
  attackerCells: Position[];
  defenderCells: Position[];
  corridorCells: ReadonlySet<string>;
  placementIndex: number;
  placementCount: number;
  width: number;
  height: number;
  random: RandomSource;
}): Position {
  const attacker = centroid(attackerCells);
  const defender = centroid(defenderCells);
  const progressStart = placement === "defender-depth" ? 0.62 : 0.58;
  const progressEnd = placement === "defender-depth" ? 0.88 : 0.83;
  const ratio = placementCount <= 1 ? 1 : placementIndex / (placementCount - 1);
  const progress = progressStart + (progressEnd - progressStart) * ratio;
  const direction = { x: defender.x - attacker.x, y: defender.y - attacker.y };
  const directionLengthSquared = direction.x ** 2 + direction.y ** 2;
  const minimumProgress = placement === "defender-depth" ? 0.55 : 0.5;
  const forwardCandidates = directionLengthSquared > 0
    ? candidates.filter((candidate) => {
        const progress = (
          (candidate.x - attacker.x) * direction.x +
          (candidate.y - attacker.y) * direction.y
        ) / directionLengthSquared;
        return progress >= minimumProgress;
      })
    : candidates;
  const storyCandidates = forwardCandidates.length > 0 ? forwardCandidates : candidates;
  const horizontalAdvance = Math.abs(direction.x) >= Math.abs(direction.y);
  const lateralDistance = Math.max(1, Math.min(width, height) * 0.2);
  const lateralSign = placementCount <= 1 ? 0 : placementIndex % 2 === 0 ? -1 : 1;
  const target = {
    x: attacker.x + direction.x * progress + (horizontalAdvance ? 0 : lateralSign * lateralDistance),
    y: attacker.y + direction.y * progress + (horizontalAdvance ? lateralSign * lateralDistance : 0),
  };

  return chooseAmongBest(
    storyCandidates,
    (candidate) =>
      Math.hypot(candidate.x - target.x, candidate.y - target.y) * 100 +
      (corridorCells.has(positionKey(candidate)) ? 1 : 0),
    "minimum",
    random,
  );
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
  return getArmyCells(requirements, requirements.defenderArmySlot, width, height);
}

function getAttackerCells(
  requirements: MapScenarioRequirements,
  width: number,
  height: number,
): Position[] {
  return getArmyCells(requirements, requirements.attackerArmySlot, width, height);
}

function getArmyCells(
  requirements: MapScenarioRequirements,
  armySlot: number | undefined,
  width: number,
  height: number,
): Position[] {
  const configured = requirements.deploymentZones
    .find((zone) => zone.armySlot === armySlot)
    ?.cells.filter((cell) => isOnBoard(cell, width, height));
  if (configured?.length) return configured;
  switch (armySlot ?? 0) {
    case 1: return Array.from({ length: height }, (_, y) => ({ x: width - 1, y }));
    case 2: return Array.from({ length: width }, (_, x) => ({ x, y: 0 }));
    case 3: return Array.from({ length: width }, (_, x) => ({ x, y: height - 1 }));
    default: return Array.from({ length: height }, (_, y) => ({ x: 0, y }));
  }
}

function getRequiredObjectSpacing(placement: MapObjectPlacement): number {
  if (placement === "defender-depth" || placement === "assault-route") return 3;
  return placement === "distributed" ? 2 : 1;
}

function centroid(positions: Position[]): Position {
  return {
    x: positions.reduce((sum, position) => sum + position.x, 0) / positions.length,
    y: positions.reduce((sum, position) => sum + position.y, 0) / positions.length,
  };
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
