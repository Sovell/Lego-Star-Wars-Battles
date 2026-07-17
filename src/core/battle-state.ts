import { board, starterArmies } from "../data";
import { buildActivationBag } from "./rules/activation";
import { findUnit, getArmyCost, getTemplate, replaceUnit, templateById } from "./rules/state";
import { getVictoryState } from "./rules/victory";
import type { Army, Battle, CombatLogEntry } from "../types";
import { applyBattleAction } from "./battle-actions";

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

export function createLog(turn: number, message: string): CombatLogEntry {
  return {
    id: crypto.randomUUID(),
    turn,
    message,
  };
}

export {
  applyBattleAction,
  findUnit,
  getArmyCost,
  getTemplate,
  getVictoryState,
  replaceUnit,
  templateById,
};
