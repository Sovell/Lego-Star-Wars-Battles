import type { UnitInstance, UnitStatus, UnitTemplate } from "../types";

export function getStatusAfterDamage(
  unit: UnitInstance,
  template: UnitTemplate,
  nextHp: number,
  nextSuppression: number,
): UnitStatus {
  if (nextHp === 0) {
    return "Destroyed";
  }

  if (nextSuppression >= template.morale) {
    return "Pinned";
  }

  return unit.status;
}

export function resetUnitForNextTurn(unit: UnitInstance, template: UnitTemplate): UnitInstance {
  if (unit.status === "Destroyed") {
    return unit;
  }

  const nextSuppression = Math.max(0, unit.suppression - 1);

  return {
    ...unit,
    status: nextSuppression >= template.morale ? "Pinned" : "Ready",
    suppression: nextSuppression,
  };
}
