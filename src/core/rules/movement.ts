import type { Battle, UnitInstance } from "../../types";
import { validateUnitActivation } from "./activation";
import { distance, isOnBoard, type GridPosition } from "./geometry";
import { getTemplate, findUnit, replaceUnit } from "./state";
import { getTerrainAtPosition } from "./terrain";
import { getUnitAtPosition } from "./occupancy";

export function getMoveDistance(baseMovement: number, movementCost: number): number {
  return Math.max(1, Math.floor(baseMovement / Math.max(1, movementCost)));
}

export function moveUnit(
  battle: Battle,
  unitId: string,
  targetPosition: GridPosition,
): { battle: Battle; log: string } {
  return performMovement(battle, unitId, targetPosition, false);
}

export function advanceUnit(
  battle: Battle,
  unitId: string,
  targetPosition: GridPosition,
): { battle: Battle; log: string } {
  return performMovement(battle, unitId, targetPosition, true);
}

function performMovement(
  battle: Battle,
  unitId: string,
  targetPosition: GridPosition,
  keepActivationForAttack: boolean,
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

  if (unit.movedThisTurn) {
    return { battle, log: "Ta jednostka wykonała już ruch w tej rundzie." };
  }

  const occupyingUnit = getUnitAtPosition(battle, targetPosition, unitId);
  if (occupyingUnit) {
    return {
      battle,
      log: `Pole ${targetPosition.x}, ${targetPosition.y} jest zajete przez ${getTemplate(occupyingUnit).name}.`,
    };
  }

  const template = getTemplate(unit);
  const terrain = getTerrainAtPosition(battle, targetPosition);
  const movementCost = terrain?.movementCost ?? 1;
  const movementDistance = unit.position ? distance(unit.position, targetPosition) : 1;
  const movementBonus = unit.activeEffects?.includes("movement_bonus:1") ? 1 : 0;
  const maxDistance = unit.position
    ? getMoveDistance(template.movement + movementBonus, movementCost)
    : 1;

  if (movementDistance > maxDistance) {
    return {
      battle,
      log: `${template.name} nie moze ruszyc sie na to pole: dystans ${movementDistance}/${maxDistance}.`,
    };
  }

  const updatedUnit: UnitInstance = {
    ...unit,
    position: targetPosition,
    status: keepActivationForAttack ? unit.status : "Activated",
    movedThisTurn: true,
    activeEffects: keepActivationForAttack
      ? [...(unit.activeEffects ?? []), "advance_pending"]
      : unit.activeEffects,
  };

  return {
    battle: {
      ...replaceUnit(battle, updatedUnit),
      activeActivation: keepActivationForAttack ? battle.activeActivation : undefined,
    },
    log: keepActivationForAttack
      ? `${template.name} wykonuje Advance na pole ${targetPosition.x}, ${targetPosition.y} (dystans ${movementDistance}/${maxDistance}) i może teraz zaatakować.`
      : `${template.name} wykonuje Move na pole ${targetPosition.x}, ${targetPosition.y} (dystans ${movementDistance}/${maxDistance}).`,
  };
}
