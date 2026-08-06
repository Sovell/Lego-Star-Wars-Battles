import type { Army, ArmyControl, Battle, TeamId } from "../types";

export function getArmyControl(army: Army): ArmyControl {
  return army.control ?? "Human";
}

export function getArmyTeamId(army: Army): TeamId | string {
  return army.teamId ?? army.id;
}

export function withDefaultArmyConfiguration(
  armies: Army[],
  requestedDefenderArmyId?: string,
): Army[] {
  const defenderArmyId = armies.some((army) => army.id === requestedDefenderArmyId)
    ? requestedDefenderArmyId
    : armies[0]?.id;

  return armies.map((army) => ({
    ...army,
    teamId: army.teamId ?? (army.id === defenderArmyId ? 1 : 2),
    control: army.control ?? (army.id === defenderArmyId ? "Human" : "Bot"),
  }));
}

export function areArmiesAllied(
  battle: Pick<Battle, "armies">,
  leftArmyId: string,
  rightArmyId: string,
): boolean {
  if (leftArmyId === rightArmyId) return true;

  const left = battle.armies.find((army) => army.id === leftArmyId);
  const right = battle.armies.find((army) => army.id === rightArmyId);
  return Boolean(
    left?.teamId !== undefined &&
    right?.teamId !== undefined &&
    left.teamId === right.teamId,
  );
}

export function areArmiesEnemies(
  battle: Pick<Battle, "armies">,
  leftArmyId: string,
  rightArmyId: string,
): boolean {
  return !areArmiesAllied(battle, leftArmyId, rightArmyId);
}
