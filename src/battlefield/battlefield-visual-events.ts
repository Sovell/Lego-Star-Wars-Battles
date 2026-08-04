import type { AttackResult, Battle, FactionId, ObjectAttackResult } from "../types";

export type BattlefieldVisualEvent = {
  id: number;
  type: "attack";
  source: { x: number; y: number };
  target: { x: number; y: number };
  faction?: FactionId;
  damage: number;
  destroyed: boolean;
};

export function createBattlefieldVisualEvent(
  id: number,
  sourceBattle: Battle,
  result: { attackResult?: AttackResult; objectAttackResult?: ObjectAttackResult },
): BattlefieldVisualEvent | undefined {
  const combatResult = result.attackResult ?? result.objectAttackResult;
  if (!combatResult) return undefined;

  const attacker = sourceBattle.armies
    .flatMap((army) => army.units)
    .find((unit) => unit.id === combatResult.attackerId);
  const source = attacker?.position;
  const target = result.attackResult?.defenderPosition
    ?? result.objectAttackResult?.objectPosition;
  if (!attacker || !source || !target) return undefined;

  return {
    id,
    type: "attack",
    source: { ...source },
    target: { ...target },
    faction: sourceBattle.armies.find((army) => army.id === attacker.armyId)?.faction,
    damage: combatResult.damage,
    destroyed: combatResult.destroyed,
  };
}
