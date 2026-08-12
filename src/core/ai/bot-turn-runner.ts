import type { Battle } from "../../types";
import { areArmiesAllied } from "../army-relations";
import type { MissionState, ScenarioDefinition } from "../scenario/scenario-types";
import {
  runBotActivation,
  type BotActivationResult,
  type RunBotActivationOptions,
} from "./bot-controller";
import type { BotProfileId } from "./bot-doctrine";
import { chooseBotAction } from "./bot-strategy";

export type RunBotTurnOptions = Omit<RunBotActivationOptions, "chooseAction"> & {
  profile?: BotProfileId;
};

/**
 * Runs one bot turn without exposing strategy wiring to the UI. A scenario may
 * override the profile; otherwise mission allegiance preserves the old
 * attacker/aggressor and defender/holder behavior.
 */
export function runBotTurn(options: RunBotTurnOptions): BotActivationResult {
  const { profile: requestedProfile, ...activationOptions } = options;
  const profile = requestedProfile ?? resolveDefaultBotProfile(
    activationOptions.session.battle,
    activationOptions.session.mission,
    activationOptions.scenario,
    activationOptions.armyId,
  );

  return runBotActivation({
    ...activationOptions,
    chooseAction: (battle, scenario, armyId, mission, decisionContext) =>
      chooseBotAction(
        battle,
        scenario,
        armyId,
        profile,
        mission,
        decisionContext,
      ),
  });
}

export function resolveDefaultBotProfile(
  battle: Battle,
  mission: MissionState,
  scenario: ScenarioDefinition,
  armyId: string,
): BotProfileId {
  const condition = scenario.victoryCondition;
  if (condition.type === "ControlTerritory") return "objective";

  if (condition.type === "ProgressiveControl") {
    const attackerArmyId = battle.armies[condition.attackerArmySlot]?.id;
    if (attackerArmyId && areArmiesAllied(battle, armyId, attackerArmyId)) {
      return "objective";
    }
  }

  if (condition.type === "DestroyObjects") {
    const attackerArmyId = mission.attackerArmyId;
    if (attackerArmyId && areArmiesAllied(battle, armyId, attackerArmyId)) {
      return "objective";
    }
  }

  if (condition.type === "SurviveAndExtract") {
    const extractingArmyId = battle.armies[condition.armySlot]?.id;
    if (extractingArmyId && areArmiesAllied(battle, armyId, extractingArmyId)) {
      return "objective";
    }
    return "hunter";
  }

  return mission.defenderArmyId &&
    areArmiesAllied(battle, armyId, mission.defenderArmyId)
    ? "defensive"
    : "aggressive";
}
