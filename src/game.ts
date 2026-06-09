import { board, starterArmies } from "./data";
import { buildActivationBag, drawActivation } from "./rules/activation";
import { resolveAttack as resolveCombatAttack } from "./rules/combat";
import { moveUnit } from "./rules/movement";
import { resetUnitForNextTurn } from "./rules/morale";
import { applyOrder } from "./rules/orders";
import { findUnit, getArmyCost, getTemplate, replaceUnit, templateById } from "./rules/state";
import { applyVictoryState } from "./rules/victory";
import { getVictoryState } from "./rules/victory";
import type { Army, AttackResult, Battle, CombatLogEntry } from "./types";

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
  const armies = battle.armies.map((army) => ({
    ...army,
    units: army.units.map((unit) => resetUnitForNextTurn(unit, getTemplate(unit))),
  }));

  return applyVictoryState({
    ...battle,
    turn: battle.turn + 1,
    armies,
    activationBag: buildActivationBag(armies),
    activeActivation: undefined,
    phase: "Activation",
  });
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
): { battle: Battle; result?: AttackResult; log: string } {
  const result = resolveCombatAttack(battle, attackerId, defenderId, weaponId);

  return {
    ...result,
    battle: applyVictoryState(result.battle),
  };
}

export {
  applyOrder,
  drawActivation,
  findUnit,
  getArmyCost,
  getTemplate,
  getVictoryState,
  moveUnit,
  replaceUnit,
  templateById,
};
