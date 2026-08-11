import type { BattleEvent } from "../battle-actions";
import type { Army, Battle } from "../../types";
import { areArmiesAllied, areArmiesEnemies, getArmyTeamId } from "../army-relations";
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
    : armies[scenario.defaultDefenderArmySlot ?? 0]?.id ?? armies[0]?.id;
  const attackerArmyId = armies.find((army) =>
    defenderArmyId && areArmiesEnemies({ armies }, army.id, defenderArmyId)
  )?.id;

  return {
    scenarioId: scenario.id,
    status: "Active",
    roundsCompleted: 0,
    ...(scenario.scheduledEvents?.length
      ? { scheduledEvents: structuredClone(scenario.scheduledEvents), resolvedEventIds: [] }
      : {}),
    ...(defenderArmyId ? { defenderArmyId } : {}),
    ...(attackerArmyId ? { attackerArmyId } : {}),
    ...(scenario.victoryCondition.type === "ControlTerritory"
      ? { territoryOwners: {}, territoryScores: {} }
      : {}),
    ...(scenario.victoryCondition.type === "DestroyObjects"
      ? { destroyedObjectiveIds: [] }
      : {}),
    ...(scenario.victoryCondition.type === "ProgressiveControl"
      ? {
          objectiveStage: 0,
          stageStartedRound: 0,
          stageRoundTargets: structuredClone(
            scenario.victoryCondition.stageRoundLimits ??
              Array(scenario.victoryCondition.count).fill(scenario.victoryCondition.roundLimit),
          ),
        }
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
    (event) => event.type === "ArmyEliminated" && (
      battle
        ? areArmiesAllied(battle, event.armyId, defeatedArmyId) && (() => {
            const defenderTeam = battle.armies.filter((army) =>
              areArmiesAllied(battle, army.id, defeatedArmyId)
            );
            return defenderTeam.length === 1
              ? event.armyId === defeatedArmyId
              : defenderTeam.every((army) =>
                  army.units.every((unit) => unit.status === "Destroyed")
                );
          })()
        : event.armyId === defeatedArmyId
    ),
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

  if (scenario.victoryCondition.type === "DestroyObjects") {
    return applyDestroyObjectsProgress(
      mission,
      scenario.victoryCondition,
      battleEvents,
      battle,
      completedRounds,
    );
  }

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

  if (scenario.victoryCondition.type === "ProgressiveControl") {
    return applyProgressiveControlRound(
      mission,
      scenario.victoryCondition,
      scenario.deploymentZones,
      battle,
      completedRounds,
    );
  }

  if (scenario.victoryCondition.type === "SurviveAndExtract") {
    return applyExtractionRound(
      mission,
      scenario.victoryCondition,
      scenario.zones ?? [],
      battle,
      completedRounds,
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
      (unit) => defenderArmyId && areArmiesAllied(battle!, unit.armyId, defenderArmyId),
    );
    const enemyPresent = unitsOnPoint.some(
      (unit) => !defenderArmyId || areArmiesEnemies(battle!, unit.armyId, defenderArmyId),
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

function applyDestroyObjectsProgress(
  mission: MissionState,
  condition: Extract<ScenarioDefinition["victoryCondition"], { type: "DestroyObjects" }>,
  battleEvents: BattleEvent[],
  battle: Battle | undefined,
  completedRounds: number,
): ScenarioEngineResult {
  const destroyedIds = new Set(mission.destroyedObjectiveIds ?? []);
  for (const object of battle?.board.objects ?? []) {
    if (object.type === condition.objectType && object.status === "Destroyed") {
      destroyedIds.add(object.id);
    }
  }
  for (const event of battleEvents) {
    if (event.type === "BattlefieldObjectDestroyed" && event.objectType === condition.objectType) {
      destroyedIds.add(event.objectId);
    }
  }
  const roundsCompleted = mission.roundsCompleted + completedRounds;
  const roundLimit = mission.roundTarget ?? condition.roundLimit;
  const nextMission = {
    ...mission,
    roundsCompleted,
    destroyedObjectiveIds: [...destroyedIds],
  };

  if (destroyedIds.size >= condition.count) {
    return {
      mission: { ...nextMission, status: "Victory" },
      events: [{
        type: "MissionCompleted",
        status: "Victory",
        message: `Cele strategiczne zniszczone: ${condition.count}/${condition.count}.`,
      }],
    };
  }
  if (roundsCompleted >= roundLimit) {
    return {
      mission: { ...nextMission, status: "Defeat" },
      events: [{
        type: "MissionCompleted",
        status: "Defeat",
        message: "Limit rund minął, zanim zniszczono wszystkie cele strategiczne.",
      }],
    };
  }
  return {
    mission: nextMission,
    events: battleEvents.some((event) => event.type === "BattlefieldObjectDestroyed")
      ? [{
          type: "MissionProgress",
          message: `Zniszczone cele: ${destroyedIds.size}/${condition.count}.`,
        }]
      : [],
  };
}

function applyProgressiveControlRound(
  mission: MissionState,
  condition: Extract<ScenarioDefinition["victoryCondition"], { type: "ProgressiveControl" }>,
  deploymentZones: ScenarioDefinition["deploymentZones"],
  battle: Battle | undefined,
  completedRounds: number,
): ScenarioEngineResult {
  const attacker = battle?.armies[condition.attackerArmySlot];
  const objectives = orderObjectivesFromDeployment(
    (battle?.board.objects ?? []).filter((object) =>
      object.type === condition.objectiveType && object.status === "Active"
    ),
    deploymentZones.find((zone) => zone.armySlot === condition.attackerArmySlot)?.cells ?? [],
  );
  let objectiveStage = mission.objectiveStage ?? 0;
  const currentStage = objectiveStage;
  const target = objectives[objectiveStage];

  if (attacker && target && battle && teamControlsPosition(battle, attacker.id, target.position)) {
    objectiveStage += 1;
  }
  const roundsCompleted = mission.roundsCompleted + completedRounds;
  const roundLimit = mission.roundTarget ?? condition.roundLimit;
  const stageRoundTargets = mission.stageRoundTargets ?? condition.stageRoundLimits ?? [];
  const stageStartedRound = objectiveStage > currentStage
    ? roundsCompleted
    : mission.stageStartedRound ?? 0;
  const nextMission = {
    ...mission,
    roundsCompleted,
    objectiveStage,
    stageRoundTargets: [...stageRoundTargets],
    stageStartedRound,
  };

  if (objectiveStage >= condition.count) {
    return {
      mission: { ...nextMission, status: "Victory" },
      events: [{
        type: "MissionCompleted",
        status: "Victory",
        message: "Linia obrony została przełamana sektor po sektorze.",
      }],
    };
  }
  const currentStageLimit = stageRoundTargets[currentStage];
  const roundsInCurrentStage = roundsCompleted - (mission.stageStartedRound ?? 0);
  if (
    objectiveStage === currentStage &&
    Number.isInteger(currentStageLimit) &&
    currentStageLimit > 0 &&
    roundsInCurrentStage >= currentStageLimit
  ) {
    return {
      mission: { ...nextMission, status: "Defeat" },
      events: [{
        type: "MissionCompleted",
        status: "Defeat",
        message: `Nie przełamano sektora ${currentStage + 1} w wyznaczonym czasie.`,
      }],
    };
  }
  if (roundsCompleted >= roundLimit) {
    return {
      mission: { ...nextMission, status: "Defeat" },
      events: [{
        type: "MissionCompleted",
        status: "Defeat",
        message: "Natarcie zatrzymało się przed ostatnim sektorem.",
      }],
    };
  }
  return {
    mission: nextMission,
    events: [{
      type: "MissionProgress",
      message: `Przełamane sektory: ${objectiveStage}/${condition.count}.`,
    }],
  };
}

function applyExtractionRound(
  mission: MissionState,
  condition: Extract<ScenarioDefinition["victoryCondition"], { type: "SurviveAndExtract" }>,
  zones: NonNullable<ScenarioDefinition["zones"]>,
  battle: Battle | undefined,
  completedRounds: number,
): ScenarioEngineResult {
  const roundsCompleted = mission.roundsCompleted + completedRounds;
  const roundLimit = mission.roundTarget ?? condition.roundLimit;
  const army = battle?.armies[condition.armySlot];
  const extractionZone = zones.find((zone) => zone.id === condition.zoneId);
  const extractionCells = new Set(
    (extractionZone?.cells ?? []).map(({ x, y }) => `${x},${y}`),
  );
  const extractedUnits = army && battle
    ? battle.armies.flatMap((candidate) => candidate.units).filter((unit) =>
        unit.status !== "Destroyed" &&
        unit.position &&
        areArmiesAllied(battle, unit.armyId, army.id) &&
        extractionCells.has(`${unit.position.x},${unit.position.y}`)
      ).length
    : 0;
  const nextMission = { ...mission, roundsCompleted };

  if (roundsCompleted >= condition.minimumRounds && extractedUnits >= condition.minimumUnits) {
    return {
      mission: { ...nextMission, status: "Victory" },
      events: [{
        type: "MissionCompleted",
        status: "Victory",
        message: "Oddział przetrwał zasadzkę i dotarł do strefy ewakuacji.",
      }],
    };
  }
  if (roundsCompleted >= roundLimit) {
    return {
      mission: { ...nextMission, status: "Defeat" },
      events: [{
        type: "MissionCompleted",
        status: "Defeat",
        message: "Okno ewakuacji zamknęło się.",
      }],
    };
  }
  return {
    mission: nextMission,
    events: [{
      type: "MissionProgress",
      message: roundsCompleted < condition.minimumRounds
        ? `Przetrwaj jeszcze ${condition.minimumRounds - roundsCompleted} rund.`
        : `Jednostki w strefie ewakuacji: ${extractedUnits}/${condition.minimumUnits}.`,
    }],
  };
}

function teamControlsPosition(
  battle: Battle,
  armyId: string,
  position: { x: number; y: number },
): boolean {
  const occupants = battle.armies.flatMap((army) => army.units).filter((unit) =>
    unit.status !== "Destroyed" &&
    unit.position?.x === position.x &&
    unit.position.y === position.y
  );
  return occupants.some((unit) => areArmiesAllied(battle, unit.armyId, armyId)) &&
    !occupants.some((unit) => areArmiesEnemies(battle, unit.armyId, armyId));
}

function orderObjectivesFromDeployment<T extends { position: { x: number; y: number } }>(
  objectives: T[],
  deploymentCells: { x: number; y: number }[],
): T[] {
  const origin = deploymentCells.length > 0
    ? {
        x: deploymentCells.reduce((sum, cell) => sum + cell.x, 0) / deploymentCells.length,
        y: deploymentCells.reduce((sum, cell) => sum + cell.y, 0) / deploymentCells.length,
      }
    : { x: 0, y: 0 };
  return [...objectives].sort((left, right) =>
    manhattanDistance(left.position, origin) - manhattanDistance(right.position, origin)
  );
}

function manhattanDistance(
  first: { x: number; y: number },
  second: { x: number; y: number },
): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
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
  const requiredRounds = mission.roundTarget ?? (
    scenario.victoryCondition.type === "ControlTerritory"
      ? scenario.victoryCondition.rounds
      : 0
  );
  const rankedArmies = [...(battle?.armies ?? [])].sort(
    (left, right) =>
      (territoryScores[right.id] ?? 0) - (territoryScores[left.id] ?? 0),
  );
  const teamScores = new Map<string | number, number>();
  for (const army of battle?.armies ?? []) {
    const teamId = getArmyTeamId(army);
    teamScores.set(teamId, (teamScores.get(teamId) ?? 0) + (territoryScores[army.id] ?? 0));
  }
  const rankedTeams = [...teamScores.entries()].sort((left, right) => right[1] - left[1]);
  const leader = rankedTeams[0];
  const runnerUp = rankedTeams[1];
  const tied =
    leader &&
    runnerUp &&
    leader[1] === runnerUp[1];

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

  const leadingArmy = (battle?.armies ?? []).find(
    (army) => getArmyTeamId(army) === leader[0],
  );
  const status = leadingArmy && defenderArmyId &&
      areArmiesAllied(battle!, leadingArmy.id, defenderArmyId)
    ? "Victory"
    : "Defeat";
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
      message: `Drużyna ${String(leader[0])} wygrywa kontrolę terytorium wynikiem ${leader[1]} pkt.`,
    }],
  };
}
