import type { Battle } from "../../types";
import type { MissionState, ScenarioDefinition } from "../scenario/scenario-types";
import type { BotDecision } from "./bot-controller";
import { aggressiveBotDoctrine } from "./bot-doctrine";
import { chooseDoctrineBotAction } from "./bot-strategy";

export type { BotDecision } from "./bot-controller";

/** Compatibility adapter for the aggressive doctrine. */
export function chooseAttackerBotAction(
  battle: Battle,
  scenario: ScenarioDefinition,
  attackerArmyId: string,
  mission?: MissionState,
): BotDecision | undefined {
  return chooseDoctrineBotAction(
    battle,
    scenario,
    attackerArmyId,
    aggressiveBotDoctrine,
    mission,
  );
}
