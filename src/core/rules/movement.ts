import type { Battle, UnitInstance } from "../../types";
import { isTerrainEnterable } from "../terrain-definitions";
import { validateUnitActivation } from "./activation";
import { isOnBoard, type GridPosition } from "./geometry";
import { getUnitAtPosition } from "./occupancy";
import { findUnit, getTemplate, replaceUnit } from "./state";
import { getHazardSuppression, getTerrainAtPosition } from "./terrain";

export function getMoveDistance(baseMovement: number, movementCost: number): number {
  return Math.max(1, Math.floor(baseMovement / Math.max(1, movementCost)));
}

export function moveUnit(battle: Battle, unitId: string, targetPosition: GridPosition) {
  return performMovement(battle, unitId, targetPosition, false);
}

export function advanceUnit(battle: Battle, unitId: string, targetPosition: GridPosition) {
  return performMovement(battle, unitId, targetPosition, true);
}

function performMovement(
  battle: Battle,
  unitId: string,
  targetPosition: GridPosition,
  keepActivationForAttack: boolean,
): { battle: Battle; log: string } {
  const validationError = validateUnitActivation(battle, unitId);
  if (validationError) return { battle, log: validationError };
  if (!isOnBoard(battle, targetPosition)) {
    return { battle, log: "Cel ruchu znajduje sie poza plansza." };
  }

  const unit = findUnit(battle, unitId);
  if (!unit) return { battle, log: "Nie znaleziono jednostki." };
  if (!unit.position) {
    return { battle, log: "Jednostka jest w rezerwie i musi wejsc przez strefe rozmieszczenia." };
  }
  if (unit.movedThisTurn) {
    return { battle, log: "Ta jednostka wykonala juz ruch w tej rundzie." };
  }
  const occupyingUnit = getUnitAtPosition(battle, targetPosition, unitId);
  if (occupyingUnit) {
    return {
      battle,
      log: `Pole ${targetPosition.x}, ${targetPosition.y} jest zajete przez ${getTemplate(occupyingUnit).name}.`,
    };
  }

  const template = getTemplate(unit);
  const movementBonus = unit.activeEffects?.includes("movement_bonus:1") ? 1 : 0;
  const movementBudget = template.movement + movementBonus;
  const movementCost = getMovementPathCost(
    battle,
    unit.position,
    targetPosition,
    unit.id,
    movementBudget,
  );
  if (movementCost === undefined) {
    return {
      battle,
      log: `${template.name} nie moze dotrzec na to pole w limicie ruchu ${movementBudget}.`,
    };
  }

  const terrain = getTerrainAtPosition(battle, targetPosition);
  const hazardSuppression = getHazardSuppression(terrain);
  const nextSuppression = unit.suppression + hazardSuppression;
  const pinnedByHazard = nextSuppression >= template.morale;
  const canContinueActivation = keepActivationForAttack && !pinnedByHazard;
  const updatedUnit: UnitInstance = {
    ...unit,
    position: targetPosition,
    status: pinnedByHazard ? "Pinned" : keepActivationForAttack ? unit.status : "Activated",
    suppression: nextSuppression,
    movedThisTurn: true,
    activeEffects: canContinueActivation
      ? [...(unit.activeEffects ?? []), "advance_pending"]
      : unit.activeEffects,
  };
  const hazardLog = hazardSuppression
    ? ` Teren niebezpieczny: suppression +${hazardSuppression}${pinnedByHazard ? ", jednostka zostaje przygwozdzona" : ""}.`
    : "";

  return {
    battle: {
      ...replaceUnit(battle, updatedUnit),
      activeActivation: canContinueActivation ? battle.activeActivation : undefined,
    },
    log: (canContinueActivation
      ? `${template.name} wykonuje Advance na pole ${targetPosition.x}, ${targetPosition.y} (koszt ${movementCost}/${movementBudget}) i moze teraz zaatakowac.`
      : `${template.name} wykonuje ${keepActivationForAttack ? "Advance" : "Move"} na pole ${targetPosition.x}, ${targetPosition.y} (koszt ${movementCost}/${movementBudget}).`) + hazardLog,
  };
}

function getMovementPathCost(
  battle: Battle,
  start: GridPosition,
  target: GridPosition,
  unitId: string,
  budget: number,
): number | undefined {
  const costs = new Map<string, number>([[positionKey(start), 0]]);
  const queue: Array<{ position: GridPosition; cost: number }> = [{ position: start, cost: 0 }];
  while (queue.length > 0) {
    queue.sort((left, right) => left.cost - right.cost);
    const current = queue.shift();
    if (!current || current.cost > (costs.get(positionKey(current.position)) ?? Infinity)) continue;
    if (current.position.x === target.x && current.position.y === target.y) return current.cost;
    for (const position of adjacentPositions(current.position)) {
      if (!isOnBoard(battle, position)) continue;
      const terrain = getTerrainAtPosition(battle, position);
      if (!isTerrainEnterable(terrain) || getUnitAtPosition(battle, position, unitId)) continue;
      // Nawet najwolniejsza jednostka moze wejsc o jedno pole w trudny teren.
      const stepCost = Math.min(movementBudgetFloor(budget), Math.max(1, terrain?.movementCost ?? 1));
      const cost = current.cost + stepCost;
      const key = positionKey(position);
      if (cost > budget || cost >= (costs.get(key) ?? Infinity)) continue;
      costs.set(key, cost);
      queue.push({ position, cost });
    }
  }
  return undefined;
}

function movementBudgetFloor(budget: number): number {
  return Math.max(1, budget);
}

function adjacentPositions(position: GridPosition): GridPosition[] {
  const positions: GridPosition[] = [];
  for (let y = -1; y <= 1; y += 1) {
    for (let x = -1; x <= 1; x += 1) {
      if (x !== 0 || y !== 0) positions.push({ x: position.x + x, y: position.y + y });
    }
  }
  return positions;
}

function positionKey(position: GridPosition): string {
  return `${position.x},${position.y}`;
}
