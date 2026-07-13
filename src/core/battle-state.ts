import { board, starterArmies } from "../data";
import { buildActivationBag, drawActivation } from "./rules/activation";
import { moveUnit } from "./rules/movement";
import { applyOrder } from "./rules/orders";
import { findUnit, getArmyCost, getTemplate, replaceUnit, templateById } from "./rules/state";
import { getVictoryState } from "./rules/victory";
import type { Army, AttackResult, Battle, CombatLogEntry } from "../types";
import { applyBattleAction } from "./battle-actions";
import type { DiceRoller } from "./random";

export function createBattle(armies: Army[] = starterArmies): Battle {
  const battleArmies = structuredClone(armies);

  return {
    id: crypto.randomUUID(),
    turn: 1,
    armies: battleArmies,
    board,
    activationBag: buildActivationBag(battleArmies),
    activeActivation: undefined,
    phase: "Activation",
  };
}

export function endTurn(battle: Battle): Battle {
  return applyBattleAction(battle, { type: "EndTurn" }).battle;
}

export function createLog(turn: number, message: string): CombatLogEntry {
  return {
    id: crypto.randomUUID(),
    turn,
    message,
  };
}

export function resolveAttack(
  battle: Battle,
  attackerId: string,
  defenderId: string,
  weaponId: string,
  rollD6?: DiceRoller,
): { battle: Battle; result?: AttackResult; log: string } {
  const result = applyBattleAction(
    battle,
    { type: "Attack", attackerId, defenderId, weaponId },
    { rollD6 },
  );

  return { battle: result.battle, result: result.attackResult, log: result.log };
}

export {
  applyOrder,
  applyBattleAction,
  drawActivation,
  findUnit,
  getArmyCost,
  getTemplate,
  getVictoryState,
  moveUnit,
  replaceUnit,
  templateById,
};
