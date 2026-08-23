import { getVictoryState } from "../../core/battle-state";
import {
  createCampaignBattlePackage,
  resolveCampaignBattle,
  type CampaignBattlePackage,
  type CampaignBattleRequest,
  type CampaignBattleResolution,
} from "../../core/campaign";
import {
  createSavedCampaign,
  type SavedCampaign,
} from "../../core/persistence/save-types";
import type { MissionState } from "../../core/scenario/scenario-types";
import type { Battle } from "../../types";

/** Application-only context for returning from a generated tactical battle to a campaign save. */
export type ActiveCampaignBattle = {
  campaignId: string;
  savedCampaignId: string;
  battleId: string;
  request: CampaignBattleRequest;
  returnView: "campaign";
  battlePackage: CampaignBattlePackage;
};

export function createActiveCampaignBattle(savedCampaign: SavedCampaign): ActiveCampaignBattle {
  const battlePackage = createCampaignBattlePackage(savedCampaign.campaign);
  return {
    campaignId: savedCampaign.campaign.id,
    savedCampaignId: savedCampaign.id,
    battleId: battlePackage.request.id,
    request: battlePackage.request,
    returnView: "campaign",
    battlePackage,
  };
}

export function resolveActiveCampaignBattle(
  savedCampaign: SavedCampaign,
  activeBattle: ActiveCampaignBattle,
  finalBattle: Battle,
  mission: MissionState,
): {
  savedCampaign: SavedCampaign;
  resolution: CampaignBattleResolution;
  winnerFactionId: "Republic" | "Separatists";
} {
  if (
    activeBattle.campaignId !== savedCampaign.campaign.id ||
    activeBattle.savedCampaignId !== savedCampaign.id ||
    activeBattle.battlePackage.request.id !== activeBattle.battleId ||
    activeBattle.request.id !== activeBattle.battleId
  ) throw new Error("Campaign battle session does not match the loaded campaign save.");

  const winnerFactionId = getCampaignBattleWinnerFaction(activeBattle.battlePackage, finalBattle, mission);
  const resolution = resolveCampaignBattle(
    savedCampaign.campaign,
    activeBattle.battlePackage,
    finalBattle,
    winnerFactionId,
  );
  return {
    savedCampaign: createSavedCampaign({
      campaign: resolution.state,
      battleIds: [...new Set([...savedCampaign.battleIds, activeBattle.battleId])],
      createdAt: savedCampaign.createdAt,
    }),
    resolution,
    winnerFactionId,
  };
}

export function getCampaignBattleWinnerFaction(
  battlePackage: CampaignBattlePackage,
  battle: Battle,
  mission: MissionState,
): "Republic" | "Separatists" {
  const request = battlePackage.request;
  if (mission.status !== "Active") {
    const defenderObjective = battlePackage.scenario.victoryCondition.type === "DefendPoint";
    const attackerWon = defenderObjective
      ? mission.status === "Defeat"
      : mission.status === "Victory";
    return attackerWon ? request.attackerFactionId : request.defenderFactionId;
  }
  if (battle.phase !== "Finished") {
    throw new Error("Campaign battle is not finished yet.");
  }
  const winnerArmyId = getVictoryState(battle).winnerArmyId;
  const winner = battle.armies.find(({ id }) => id === winnerArmyId);
  if (winner?.faction === request.attackerFactionId) return request.attackerFactionId;
  if (winner?.faction === request.defenderFactionId) return request.defenderFactionId;
  throw new Error("Finished campaign battle has no valid winning faction.");
}
