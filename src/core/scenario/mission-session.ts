import type { Battle } from "../../types";
import {
  applyBattleAction,
  type BattleAction,
  type BattleActionContext,
  type BattleActionResult,
} from "../battle-actions";
import { applyScenarioEvents } from "./scenario-engine";
import {
  applyScenarioTriggerEffects,
  deriveScenarioTriggerSignals,
  type ScenarioTriggerSignal,
} from "./scheduled-events";
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
  const roundSignals: ScenarioTriggerSignal[] = completedTurn
    ? [
        { type: "RoundEnded", round: session.battle.turn },
        { type: "RoundStarted", round: completedTurn.turn },
      ]
    : [];
  const triggerSignals = deriveScenarioTriggerSignals({
    battleBefore: session.battle,
    battleAfter: battleResult.battle,
    missionBefore: session.mission,
    missionAfter: scenarioResult.mission,
    scenario,
    battleEvents: battleResult.events,
    roundSignals: roundSignals.filter(
      (signal): signal is Extract<ScenarioTriggerSignal, { type: "RoundStarted" | "RoundEnded" }> =>
        signal.type === "RoundStarted" || signal.type === "RoundEnded",
    ),
  });
  const triggeredResult = applyScenarioTriggerEffects(
    battleResult.battle,
    scenarioResult.mission,
    scenario,
    triggerSignals,
  );
  const battle = triggeredResult.mission.status === "Active"
    ? triggeredResult.battle
    : {
        ...triggeredResult.battle,
        activeActivation: undefined,
      };

  return {
    ...battleResult,
    battle,
    mission: triggeredResult.mission,
    missionEvents: [...scenarioResult.events, ...triggeredResult.events],
  };
}
