import type { Battle } from "../../types";
import { areArmiesAllied } from "../army-relations";
import type { MissionState } from "../scenario/scenario-types";
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
  armyId: string,
): BotProfileId {
  return mission.defenderArmyId &&
    areArmiesAllied(battle, armyId, mission.defenderArmyId)
    ? "defensive"
    : "aggressive";
}
