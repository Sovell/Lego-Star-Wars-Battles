import type { Battle, UnitInstance, UnitStatus, UnitTemplate } from "../../types";
import type { DiceRoller } from "../random";
import { distance, isOnBoard, type GridPosition } from "./geometry";
import { isPositionFree } from "./occupancy";
import { findUnit, getTemplate, replaceUnit } from "./state";

export type MoraleRetreatResult = {
  battle: Battle;
  rolls: [number, number];
  retreatedTo?: GridPosition;
  failed: boolean;
};

export function crossedCriticalHpThreshold(
  template: UnitTemplate,
  previousHp: number,
  nextHp: number,
): boolean {
  return (
    nextHp > 0 &&
    previousHp / template.maxHp >= 0.2 &&
    nextHp / template.maxHp < 0.2
  );
}

export function resolveMoraleRetreat(
  battle: Battle,
  unitId: string,
  threatPosition: GridPosition,
  rollD6: DiceRoller,
): MoraleRetreatResult {
  const unit = findUnit(battle, unitId);
  if (!unit?.position || unit.status === "Destroyed") {
    return { battle, rolls: [1, 1], failed: false };
  }

  const rolls: [number, number] = [rollD6(), rollD6()];
  if (rolls[0] + rolls[1] <= getTemplate(unit).morale) {
    return { battle, rolls, failed: false };
  }

  const retreatPosition = getAdjacentPositions(unit.position)
    .filter((position) => isOnBoard(battle, position))
    .filter((position) => isPositionFree(battle, position, unit.id))
    .sort((left, right) => {
      const distanceDifference =
        distance(right, threatPosition) - distance(left, threatPosition);
      if (distanceDifference !== 0) {
        return distanceDifference;
      }

      return left.y - right.y || left.x - right.x;
    })[0];
  const updatedUnit: UnitInstance = {
    ...unit,
    status: "Pinned",
    suppression: unit.suppression + 1,
    position: retreatPosition ?? unit.position,
  };

  return {
    battle: replaceUnit(battle, updatedUnit),
    rolls,
    failed: true,
    ...(retreatPosition ? { retreatedTo: retreatPosition } : {}),
  };
}

function getAdjacentPositions(position: GridPosition): GridPosition[] {
  const positions: GridPosition[] = [];
  for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
    for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
      if (xOffset !== 0 || yOffset !== 0) {
        positions.push({
          x: position.x + xOffset,
          y: position.y + yOffset,
        });
      }
    }
  }

  return positions;
}

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
