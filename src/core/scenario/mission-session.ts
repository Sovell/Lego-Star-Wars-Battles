import type { Battle } from "../../types";
import {
  applyBattleAction,
  type BattleAction,
  type BattleActionContext,
  type BattleActionResult,
} from "../battle-actions";
import { applyScenarioEvents } from "./scenario-engine";
import { applyScheduledScenarioEvents } from "./scheduled-events";
import type { MissionEvent, MissionState, ScenarioDefinition } from "./scenario-types";

export type MissionSessionState = {
  battle: Battle;
  mission: MissionState;
};

export type MissionActionContext = Omit<
  BattleActionContext,
  "scenario" | "victoryMode"
>;

export type MissionActionResult = BattleActionResult & {
  mission: MissionState;
  missionEvents: MissionEvent[];
};

export function applyMissionAction(
  session: MissionSessionState,
  scenario: ScenarioDefinition,
  action: BattleAction,
  context: MissionActionContext = {},
): MissionActionResult {
  if (session.mission.status !== "Active") {
    return {
      battle: session.battle,
      mission: session.mission,
      events: [],
      missionEvents: [],
      log: "Misja jest juz zakonczona. Uruchom ja ponownie, aby kontynuowac.",
    };
  }

  const battleResult = applyBattleAction(session.battle, action, {
    ...context,
    scenario,
    victoryMode: "Scenario",
  });
  const scenarioResult = applyScenarioEvents(
    session.mission,
    scenario,
    battleResult.events,
    battleResult.battle,
  );
  const completedTurn = battleResult.events.find((event) => event.type === "TurnEnded");
  const scheduledResult = completedTurn && scenarioResult.mission.status === "Active"
    ? applyScheduledScenarioEvents(
        battleResult.battle,
        scenarioResult.mission,
        scenario,
        [
          { type: "RoundEnded", round: session.battle.turn },
          { type: "RoundStarted", round: completedTurn.turn },
        ],
      )
    : {
        battle: battleResult.battle,
        mission: scenarioResult.mission,
        events: [],
      };
  const battle = scheduledResult.mission.status === "Active"
    ? scheduledResult.battle
    : {
        ...scheduledResult.battle,
        activeActivation: undefined,
      };

  return {
    ...battleResult,
    battle,
    mission: scheduledResult.mission,
    missionEvents: [...scenarioResult.events, ...scheduledResult.events],
  };
}
