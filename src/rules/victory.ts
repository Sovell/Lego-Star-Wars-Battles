import type { Battle } from "../types";

export function getStandingArmies(battle: Battle): string[] {
  return battle.armies
    .filter((army) => army.units.some((unit) => unit.status !== "Destroyed"))
    .map((army) => army.id);
}

export function getVictoryState(battle: Battle): { finished: boolean; winnerArmyId?: string } {
  const standingArmies = getStandingArmies(battle);

  return {
    finished: standingArmies.length <= 1,
    winnerArmyId: standingArmies[0],
  };
}

export function applyVictoryState(battle: Battle): Battle {
  const victory = getVictoryState(battle);

  return victory.finished ? { ...battle, activeActivation: undefined, phase: "Finished" } : battle;
}
