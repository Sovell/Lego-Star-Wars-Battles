import type { BattleEvent } from "../battle-actions";
import type { Battle } from "../../types";
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
  battle?: Battle,
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
    ? battle?.armies[scenario.defeatCondition.armySlot]?.id
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

  const destroyedObjectType = scenario.defeatCondition?.type === "BattlefieldObjectDestroyed"
    ? scenario.defeatCondition.objectType
    : undefined;
  const objectDefeatTriggered = destroyedObjectType !== undefined && battleEvents.some(
    (event) =>
      event.type === "BattlefieldObjectDestroyed" &&
      event.objectType === destroyedObjectType,
  );

  if (objectDefeatTriggered) {
    return {
      mission: { ...mission, status: "Defeat" },
      events: [{
        type: "MissionCompleted",
        status: "Defeat",
        message: "Misja zakonczona porazka: chroniony obiekt zostal zniszczony.",
      }],
    };
  }

  const completedRounds = battleEvents.filter((event) => event.type === "TurnEnded").length;
  if (completedRounds === 0) {
    return { mission, events: [] };
  }

  let roundsCompleted = mission.roundsCompleted + completedRounds;
  const requiredRounds = mission.roundTarget ?? scenario.victoryCondition.rounds;

  if (scenario.victoryCondition.type === "ProtectObject") {
    const condition = scenario.victoryCondition;
    const protectedObject = battle?.board.objects?.find(
      (object) => object.type === condition.objectType && object.status === "Active",
    );

    if (!protectedObject) {
      return {
        mission,
        events: [{
          type: "MissionProgress",
          message: "Nie postawiono generatora. Runda nie liczy sie do celu misji.",
        }],
      };
    }
  }

  if (scenario.victoryCondition.type === "DefendPoint") {
    const condition = scenario.victoryCondition;
    const defensePoint = battle?.board.objects?.find(
      (object) =>
        object.type === condition.objectiveType && object.status === "Active",
    );

    if (!defensePoint) {
      return {
        mission,
        events: [{
          type: "MissionProgress",
          message: "Nie wyznaczono punktu obrony. Postaw go na mapie przed koncem rundy.",
        }],
      };
    }

    const unitsOnPoint = (battle?.armies ?? [])
      .flatMap((army) => army.units)
      .filter((unit) =>
        unit.status !== "Destroyed" &&
        unit.position?.x === defensePoint.position.x &&
        unit.position.y === defensePoint.position.y,
      );
    const defenderPresent = unitsOnPoint.some(
      (unit) => unit.armyId === battle?.armies[condition.defenderArmySlot]?.id,
    );
    const enemyPresent = unitsOnPoint.some(
      (unit) => unit.armyId !== battle?.armies[condition.defenderArmySlot]?.id,
    );

    if (!defenderPresent || enemyPresent) {
      return {
        mission: { ...mission, roundsCompleted: 0 },
        events: [{
          type: "MissionProgress",
          message: "Punkt nie jest kontrolowany przez obroncow. Postep obrony spada do zera.",
        }],
      };
    }

    roundsCompleted = mission.roundsCompleted + completedRounds;
  }

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
        message: scenario.victoryCondition.type === "DefendPoint"
          ? `Misja zakonczona zwyciestwem: punkt utrzymano przez ${requiredRounds} rundy.`
          : scenario.victoryCondition.type === "ProtectObject"
            ? `Misja zakonczona zwyciestwem: generator ochroniono przez ${requiredRounds} rundy.`
            : `Misja zakonczona zwyciestwem: przetrwano ${requiredRounds} rundy.`,
      },
    ],
  };
}
