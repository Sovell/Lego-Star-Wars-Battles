import type { Battle } from "../../types";
import type { MissionState, ScenarioDefinition } from "../scenario/scenario-types";
import type { BotDecision, BotDecisionContext } from "./bot-controller";
import { defensiveBotDoctrine } from "./bot-doctrine";
import { chooseDoctrineBotAction } from "./bot-strategy";

/** Compatibility adapter for the defensive doctrine. */
export function chooseDefenderBotAction(
  battle: Battle,
  scenario: ScenarioDefinition,
  defenderArmyId: string,
  mission?: MissionState,
  decisionContext?: BotDecisionContext,
): BotDecision | undefined {
  return chooseDoctrineBotAction(
    battle,
    scenario,
    defenderArmyId,
    defensiveBotDoctrine,
    mission,
    decisionContext,
  );
}
