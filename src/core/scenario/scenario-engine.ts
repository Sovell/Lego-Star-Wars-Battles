import type { BattleEvent } from "../battle-actions";
import type { Army, Battle } from "../../types";
import type { MissionEvent, MissionState, ScenarioDefinition } from "./scenario-types";

export type ScenarioEngineResult = {
  mission: MissionState;
  events: MissionEvent[];
};

export function createMissionState(
  scenario: ScenarioDefinition,
  armies: Army[] = [],
  requestedDefenderArmyId?: string,
): MissionState {
  const defenderArmyId = armies.some((army) => army.id === requestedDefenderArmyId)
    ? requestedDefenderArmyId
    : armies[0]?.id;
  const attackerArmyId = armies.find((army) => army.id !== defenderArmyId)?.id;

  return {
    scenarioId: scenario.id,
    status: "Active",
    roundsCompleted: 0,
    ...(defenderArmyId ? { defenderArmyId } : {}),
    ...(attackerArmyId ? { attackerArmyId } : {}),
    ...(scenario.victoryCondition.type === "ControlTerritory"
      ? { territoryOwners: {}, territoryScores: {} }
      : {}),
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

  const defenderArmyId = mission.defenderArmyId ?? (
    scenario.defeatCondition?.type === "ArmyEliminated"
      ? battle?.armies[scenario.defeatCondition.armySlot]?.id
      : scenario.victoryCondition.type === "DefendPoint"
        ? battle?.armies[scenario.victoryCondition.defenderArmySlot]?.id
        : battle?.armies[0]?.id
  );
  const defeatedArmyId = scenario.defeatCondition?.type === "ArmyEliminated"
    ? defenderArmyId
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

  if (scenario.victoryCondition.type === "ControlTerritory") {
    return applyTerritoryRound(
      mission,
      scenario,
      battle,
      completedRounds,
      defenderArmyId,
    );
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
      (unit) => unit.armyId === defenderArmyId,
    );
    const enemyPresent = unitsOnPoint.some(
      (unit) => unit.armyId !== defenderArmyId,
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

function applyTerritoryRound(
  mission: MissionState,
  scenario: ScenarioDefinition,
  battle: Battle | undefined,
  completedRounds: number,
  defenderArmyId: string | undefined,
): ScenarioEngineResult {
  const territoryOwners = { ...(mission.territoryOwners ?? {}) };
  for (const unit of (battle?.armies ?? []).flatMap((army) => army.units)) {
    if (unit.status !== "Destroyed" && unit.position) {
      territoryOwners[`${unit.position.x},${unit.position.y}`] = unit.armyId;
    }
  }

  const territoryScores = { ...(mission.territoryScores ?? {}) };
  for (const army of battle?.armies ?? []) {
    const controlledPoints = Object.entries(territoryOwners).reduce(
      (total, [positionKey, armyId]) => {
        if (armyId !== army.id) {
          return total;
        }
        const strategic = battle?.board.objects?.some(
          (object) =>
            object.type === "StrategicPoint" &&
            object.status === "Active" &&
            `${object.position.x},${object.position.y}` === positionKey,
        );
        return total + (strategic ? 2 : 1);
      },
      0,
    );
    territoryScores[army.id] =
      (territoryScores[army.id] ?? 0) + controlledPoints * completedRounds;
  }

  const roundsCompleted = mission.roundsCompleted + completedRounds;
  const requiredRounds = mission.roundTarget ?? scenario.victoryCondition.rounds;
  const rankedArmies = [...(battle?.armies ?? [])].sort(
    (left, right) =>
      (territoryScores[right.id] ?? 0) - (territoryScores[left.id] ?? 0),
  );
  const leader = rankedArmies[0];
  const runnerUp = rankedArmies[1];
  const tied =
    leader &&
    runnerUp &&
    (territoryScores[leader.id] ?? 0) === (territoryScores[runnerUp.id] ?? 0);

  if (roundsCompleted < requiredRounds || tied || !leader) {
    return {
      mission: {
        ...mission,
        roundsCompleted,
        territoryOwners,
        territoryScores,
      },
      events: tied && roundsCompleted >= requiredRounds
        ? [{
            type: "MissionProgress",
            message: "Kontrola terytorium pozostaje nierozstrzygnięta. Rozpoczyna się dogrywka.",
          }]
        : [{
            type: "MissionProgress",
            message: `Punktacja terytorium: ${rankedArmies.map((army) => `${army.faction} ${territoryScores[army.id] ?? 0}`).join(", ")}.`,
          }],
    };
  }

  const status = leader.id === defenderArmyId ? "Victory" : "Defeat";
  return {
    mission: {
      ...mission,
      status,
      roundsCompleted,
      territoryOwners,
      territoryScores,
    },
    events: [{
      type: "MissionCompleted",
      status,
      message: `${leader.faction} wygrywa kontrolę terytorium wynikiem ${territoryScores[leader.id] ?? 0} pkt.`,
    }],
  };
}
