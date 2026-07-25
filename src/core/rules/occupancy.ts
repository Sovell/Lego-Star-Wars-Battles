import type { Battle, UnitInstance } from "../../types";
import type { GridPosition } from "./geometry";

export function getUnitAtPosition(
  battle: Battle,
  position: GridPosition,
  excludedUnitId?: string,
): UnitInstance | undefined {
  return battle.armies
    .flatMap((army) => army.units)
    .find(
      (unit) =>
        unit.id !== excludedUnitId &&
        unit.status !== "Destroyed" &&
        unit.position?.x === position.x &&
        unit.position.y === position.y,
    );
}

export function isPositionFree(
  battle: Battle,
  position: GridPosition,
  excludedUnitId?: string,
): boolean {
  return !getUnitAtPosition(battle, position, excludedUnitId);
}
