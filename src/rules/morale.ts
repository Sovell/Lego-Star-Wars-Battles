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
  const nextCooldowns = Object.entries(unit.abilityCooldowns ?? {}).reduce<Record<string, number>>(
    (cooldowns, [abilityId, cooldown]) => {
      const nextCooldown = Math.max(0, cooldown - 1);
      if (nextCooldown > 0) {
        cooldowns[abilityId] = nextCooldown;
      }

      return cooldowns;
    },
    {},
  );

  return {
    ...unit,
    status: nextSuppression >= template.morale ? "Pinned" : "Ready",
    suppression: nextSuppression,
    abilityCooldowns: nextCooldowns,
    activeEffects: [],
    movedThisTurn: false,
  };
}
