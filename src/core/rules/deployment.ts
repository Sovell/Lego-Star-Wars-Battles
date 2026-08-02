import type { Battle, UnitInstance } from "../../types";
import type { ScenarioDefinition } from "../scenario/scenario-types";
import { validateUnitActivation } from "./activation";
import { isOnBoard, type GridPosition } from "./geometry";
import { getUnitAtPosition } from "./occupancy";
import { findUnit, getTemplate, replaceUnit } from "./state";

export function getLegalReserveEntryCells(
  battle: Battle,
  scenario: ScenarioDefinition,
  unitId: string,
): GridPosition[] {
  const unit = findUnit(battle, unitId);
  if (!unit || unit.position || unit.status === "Destroyed") {
    return [];
  }

  const armySlot = battle.armies.findIndex((army) => army.id === unit.armyId);
  if (armySlot < 0) {
    return [];
  }

  const zone = scenario.deploymentZones.find(
    (candidate) => candidate.armySlot === armySlot,
  );
  if (!zone) {
    return [];
  }

  const seen = new Set<string>();
  return zone.cells.filter((position) => {
    const key = `${position.x},${position.y}`;
    if (
      seen.has(key) ||
      !isOnBoard(battle, position) ||
      getUnitAtPosition(battle, position, unit.id)
    ) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function deployUnit(
  battle: Battle,
  scenario: ScenarioDefinition,
  unitId: string,
  targetPosition: GridPosition,
): { battle: Battle; log: string } {
  const validationError = validateUnitActivation(battle, unitId);
  if (validationError) {
    return { battle, log: validationError };
  }

  const unit = findUnit(battle, unitId);
  if (!unit) {
    return { battle, log: "Nie znaleziono jednostki." };
  }
  if (unit.position) {
    return {
      battle,
      log: `${getTemplate(unit).name} jest już na planszy i powinien wykonać ruch.`,
    };
  }

  const legalCells = getLegalReserveEntryCells(battle, scenario, unitId);
  if (
    !legalCells.some(
      (position) =>
        position.x === targetPosition.x && position.y === targetPosition.y,
    )
  ) {
    return {
      battle,
      log: `Pole ${targetPosition.x}, ${targetPosition.y} nie jest legalnym polem wejścia tej armii.`,
    };
  }

  const updatedUnit: UnitInstance = {
    ...unit,
    position: targetPosition,
    status: "Activated",
    movedThisTurn: true,
  };

  return {
    battle: {
      ...replaceUnit(battle, updatedUnit),
      activeActivation: undefined,
    },
    log: `${getTemplate(unit).name} wchodzi z rezerwy na pole ${targetPosition.x}, ${targetPosition.y}.`,
  };
}
