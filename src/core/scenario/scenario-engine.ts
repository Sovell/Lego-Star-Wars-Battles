import type { BattleEvent } from "../battle-actions";
import type { MissionEvent, MissionState, ScenarioDefinition } from "./scenario-types";

export type ScenarioEngineResult = {
  mission: MissionState;
  events: MissionEvent[];
};

export function createMissionState(scenario: ScenarioDefinition): MissionState {
  return {
    scenarioId: scenario.id,
    status: "Active",
    roundsCompleted: 0,
  };
}

export function applyScenarioEvents(
  mission: MissionState,
  scenario: ScenarioDefinition,
  battleEvents: BattleEvent[],
): ScenarioEngineResult {
  if (mission.scenarioId !== scenario.id) {
    throw new Error(
      `Mission scenario ${mission.scenarioId} does not match definition ${scenario.id}.`,
    );
  }

  if (mission.status !== "Active") {
    return { mission, events: [] };
  }

  const defeatedArmyId = scenario.defeatCondition?.type === "ArmyEliminated"
    ? scenario.defeatCondition.armyId
    : undefined;
  const defeatTriggered = defeatedArmyId !== undefined && battleEvents.some(
    (event) => event.type === "ArmyEliminated" && event.armyId === defeatedArmyId,
  );

  if (defeatTriggered) {
    return {
      mission: { ...mission, status: "Defeat" },
      events: [{
        type: "MissionCompleted",
        status: "Defeat",
        message: "Misja zakonczona porazka: armia obroncow zostala wyeliminowana.",
      }],
    };
  }

  const completedRounds = battleEvents.filter((event) => event.type === "TurnEnded").length;
  if (completedRounds === 0) {
    return { mission, events: [] };
  }

  const roundsCompleted = mission.roundsCompleted + completedRounds;
  const requiredRounds = scenario.victoryCondition.rounds;

  if (roundsCompleted < requiredRounds) {
    return {
      mission: { ...mission, roundsCompleted },
      events: [],
    };
  }

  const completedMission: MissionState = {
    ...mission,
    status: "Victory",
    roundsCompleted: requiredRounds,
  };

  return {
    mission: completedMission,
    events: [
      {
        type: "MissionCompleted",
        status: "Victory",
        message: `Misja zakonczona zwyciestwem: przetrwano ${requiredRounds} rundy.`,
      },
    ],
  };
}
