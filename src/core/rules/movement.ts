import type { Battle, UnitInstance } from "../../types";
import { validateUnitActivation } from "./activation";
import { isOnBoard, type GridPosition } from "./geometry";
import { getUnitAtPosition } from "./occupancy";
import { findPath } from "./pathfinding";
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
  const path = findPath(
    battle,
    unit.position,
    targetPosition,
    {
      unitId: unit.id,
      movementBudget,
      maxCost: movementBudget,
    },
  );
  if (!path) {
    return {
      battle,
      log: `${template.name} nie moze dotrzec na to pole w limicie ruchu ${movementBudget}.`,
    };
  }
  const movementCost = path.cost;

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
