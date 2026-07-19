import type { Battle } from "../../types";
import {
  applyBattleAction,
  type BattleAction,
  type BattleActionContext,
  type BattleActionResult,
} from "../battle-actions";
import { applyScenarioEvents } from "./scenario-engine";
import type { MissionEvent, MissionState, ScenarioDefinition } from "./scenario-types";

export type MissionSessionState = {
  battle: Battle;
  mission: MissionState;
};

export type MissionActionContext = Omit<BattleActionContext, "victoryMode">;

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
    victoryMode: "Scenario",
  });
  const scenarioResult = applyScenarioEvents(
    session.mission,
    scenario,
    battleResult.events,
    battleResult.battle,
  );
  const battle = scenarioResult.mission.status === "Active"
    ? battleResult.battle
    : {
        ...battleResult.battle,
        activeActivation: undefined,
      };

  return {
    ...battleResult,
    battle,
    mission: scenarioResult.mission,
    missionEvents: scenarioResult.events,
  };
}
