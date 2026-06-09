import type { Battle, UnitInstance } from "../types";
import { validateUnitActivation } from "./activation";
import { distance, isOnBoard, type GridPosition } from "./geometry";
import { getTemplate, findUnit, replaceUnit } from "./state";
import { getTerrainAtPosition } from "./terrain";

export function getMoveDistance(baseMovement: number, movementCost: number): number {
  return Math.max(1, Math.floor(baseMovement / Math.max(1, movementCost)));
}

export function moveUnit(
  battle: Battle,
  unitId: string,
  targetPosition: GridPosition,
): { battle: Battle; log: string } {
  const validationError = validateUnitActivation(battle, unitId);
  if (validationError) {
    return { battle, log: validationError };
  }

  if (!isOnBoard(battle, targetPosition)) {
    return { battle, log: "Cel ruchu znajduje sie poza plansza." };
  }

  const unit = findUnit(battle, unitId);
  if (!unit) {
    return { battle, log: "Nie znaleziono jednostki." };
  }

  const template = getTemplate(unit);
  const terrain = getTerrainAtPosition(battle, targetPosition);
  const movementCost = terrain?.movementCost ?? 1;
  const movementDistance = unit.position ? distance(unit.position, targetPosition) : 1;
  const totalCost = movementDistance * movementCost;

  if (totalCost > template.movement) {
    return {
      battle,
      log: `${template.name} nie moze ruszyc sie na to pole: koszt ${totalCost}/${template.movement}.`,
    };
  }

  const updatedUnit: UnitInstance = {
    ...unit,
    position: targetPosition,
    status: "Activated",
  };

  return {
    battle: { ...replaceUnit(battle, updatedUnit), activeActivation: undefined },
    log: `${template.name} wykonuje ruch na pole ${targetPosition.x}, ${targetPosition.y} (koszt ${totalCost}/${template.movement}).`,
  };
}
