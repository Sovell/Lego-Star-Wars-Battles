import type { Battle, OrderType, UnitInstance } from "../../types";
import { validateUnitActivation } from "./activation";
import { getTemplate, findUnit, replaceUnit } from "./state";

export function applyOrder(
  battle: Battle,
  unitId: string,
  order: OrderType,
): { battle: Battle; log: string } {
  const validationError = validateUnitActivation(battle, unitId);
  if (validationError) {
    return { battle, log: validationError };
  }

  const unit = findUnit(battle, unitId);
  if (!unit) {
    return { battle, log: "Nie znaleziono jednostki." };
  }

  const updatedUnit: UnitInstance = {
    ...unit,
    status: "Activated",
    suppression: order === "Rally" ? Math.max(0, unit.suppression - 2) : unit.suppression,
    activeEffects: unit.activeEffects?.filter((effect) => effect !== "advance_pending"),
  };

  return {
    battle: { ...replaceUnit(battle, updatedUnit), activeActivation: undefined },
    log:
      order === "Rally"
        ? `${getTemplate(unit).name} wykonuje Rally i usuwa do 2 suppression.`
        : `${getTemplate(unit).name} otrzymuje rozkaz ${order}.`,
  };
}
