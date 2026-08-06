import type { Battle } from "../../types";
import { getArmyTeamId } from "../army-relations";

export function getStandingArmies(battle: Battle): string[] {
  return battle.armies
    .filter((army) => army.units.some((unit) => unit.status !== "Destroyed"))
    .map((army) => army.id);
}

export function getVictoryState(battle: Battle): { finished: boolean; winnerArmyId?: string } {
  const standingArmies = getStandingArmies(battle);
  const standingTeams = new Set(
    battle.armies
      .filter((army) => standingArmies.includes(army.id))
      .map(getArmyTeamId),
  );

  return {
    finished: standingTeams.size <= 1,
    winnerArmyId: standingArmies[0],
  };
}

export function applyVictoryState(battle: Battle): Battle {
  const victory = getVictoryState(battle);

  return victory.finished ? { ...battle, activeActivation: undefined, phase: "Finished" } : battle;
}
