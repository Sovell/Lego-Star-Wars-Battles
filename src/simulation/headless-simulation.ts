import {
  applyScenarioMapPreset,
  createScenarioDraft,
  generateScenarioDraftMap,
  startBattleFromDraft,
} from "../app/scenario-draft";
import { starterArmies } from "../data";
import { areArmiesAllied } from "../core/army-relations";
import { runBotTurn } from "../core/ai/bot-turn-runner";
import type { BotActivationStopReason } from "../core/ai/bot-controller";
import type { MissionActionResult, MissionSessionState } from "../core/scenario/mission-session";
import { applyMissionAction } from "../core/scenario/mission-session";
import { applyMissionDirectorRound } from "../core/scenario/mission-director";
import { createMissionState } from "../core/scenario/scenario-engine";
import { applyScheduledScenarioEvents } from "../core/scenario/scheduled-events";
import type {
  MissionEvent,
  MissionState,
  MissionStatus,
  ScenarioDefinition,
} from "../core/scenario/scenario-types";
import { createSeededRandomSource } from "../core/random";
import { canEndTurn, getRemainingActivationCount } from "../core/rules/activation";
import { getTemplate } from "../core/rules/state";
import type { Army, Battle } from "../types";

export type HeadlessTerminationReason =
  | "mission-completed"
  | "round-limit"
  | "action-limit"
  | "stalled";

export type SimulationArmyMetrics = {
  armyId: string;
  playerName: string;
  faction: string;
  teamId?: 1 | 2;
  initialUnits: number;
  totalUnitsSeen: number;
  reinforcements: number;
  destroyedUnits: number;
  reserveUnits: number;
  initialPower: number;
  remainingPower: number;
  initialHp: number;
  remainingHp: number;
};

export type HeadlessSimulationCounters = {
  engineActions: number;
  botActions: number;
  activationsDrawn: number;
  activationsResolved: number;
  activationsPassed: number;
  roundsEnded: number;
  phaseChanges: number;
  enemyWaves: number;
  emergencySupport: number;
  botStopReasons: Record<BotActivationStopReason, number>;
};

export type HeadlessSimulationResult = {
  scenarioId: string;
  scenarioName: string;
  seed: number;
  outcome: MissionStatus | "Incomplete";
  terminationReason: HeadlessTerminationReason;
  roundsPlayed: number;
  roundsCompleted: number;
  finalTurn: number;
  playerArmyId?: string;
  enemyArmyId?: string;
  playerRemainingPowerPercentage: number;
  enemyRemainingPowerPercentage: number;
  counters: HeadlessSimulationCounters;
  armies: SimulationArmyMetrics[];
};

export type RunHeadlessSimulationOptions = {
  scenario: ScenarioDefinition;
  seed: number;
  armies?: Army[];
  maxRounds?: number;
  maxEngineActions?: number;
};

type MutableMetrics = {
  counters: HeadlessSimulationCounters;
};

const defaultMaxEngineActions = 20_000;

/**
 * Executes a complete bot-vs-bot mission through the production action,
 * scenario-event and Mission Director pipelines. No rule is reimplemented here.
 */
export function runHeadlessSimulation({
  scenario,
  seed,
  armies = starterArmies,
  maxRounds,
  maxEngineActions = defaultMaxEngineActions,
}: RunHeadlessSimulationOptions): HeadlessSimulationResult {
  if (!Number.isInteger(seed)) throw new Error("Simulation seed must be an integer.");
  if (!Number.isInteger(maxEngineActions) || maxEngineActions < 1) {
    throw new Error("Simulation action limit must be a positive integer.");
  }

  const prepared = prepareHeadlessSession(scenario, armies, seed);
  let session = prepared.session;
  const initialArmies = structuredClone(session.battle.armies);
  const randomSource = createSeededRandomSource(seed);
  const metrics: MutableMetrics = { counters: createCounters() };
  recordMissionEvents(metrics, prepared.initialEvents);
  const safeRoundLimit = maxRounds ?? getScenarioRoundLimit(scenario) + 2;
  let activationIndex = 0;
  let terminationReason: HeadlessTerminationReason | undefined;

  while (session.mission.status === "Active") {
    if (session.battle.turn - 1 >= safeRoundLimit) {
      terminationReason = "round-limit";
      break;
    }
    if (metrics.counters.engineActions >= maxEngineActions) {
      terminationReason = "action-limit";
      break;
    }

    const activeArmyId = session.battle.activeActivation?.armyId;
    if (activeArmyId) {
      const botResult = runBotTurn({
        session,
        scenario: prepared.scenario,
        armyId: activeArmyId,
        profile: session.mission.botProfiles?.[activeArmyId],
        decisionSeed: `simulation:${scenario.id}:${seed}:${activationIndex}`,
        actionContext: { randomSource },
      });
      activationIndex += 1;
      metrics.counters.activationsResolved += 1;
      metrics.counters.botStopReasons[botResult.stopReason] += 1;
      for (const step of botResult.steps) {
        metrics.counters.engineActions += 1;
        metrics.counters.botActions += 1;
        recordActionResult(metrics, step.result);
      }
      if (botResult.fallbackResult) {
        metrics.counters.engineActions += 1;
        recordActionResult(metrics, botResult.fallbackResult);
      }
      session = { battle: botResult.battle, mission: botResult.mission };
      continue;
    }

    if (getRemainingActivationCount(session.battle) > 0) {
      const result = applyMissionAction(
        session,
        prepared.scenario,
        { type: "DrawActivation" },
        { randomSource },
      );
      metrics.counters.engineActions += 1;
      recordActionResult(metrics, result);
      if (!result.events.some((event) => event.type === "ActivationDrawn")) {
        terminationReason = "stalled";
        session = { battle: result.battle, mission: result.mission };
        break;
      }
      session = { battle: result.battle, mission: result.mission };
      continue;
    }

    if (canEndTurn(session.battle)) {
      const result = applyMissionAction(
        session,
        prepared.scenario,
        { type: "EndTurn" },
        { randomSource },
      );
      metrics.counters.engineActions += 1;
      recordActionResult(metrics, result);
      if (!result.events.some((event) => event.type === "TurnEnded")) {
        terminationReason = "stalled";
        session = { battle: result.battle, mission: result.mission };
        break;
      }
      session = { battle: result.battle, mission: result.mission };
      continue;
    }

    terminationReason = "stalled";
    break;
  }

  terminationReason ??= session.mission.status === "Active"
    ? "stalled"
    : "mission-completed";
  const playerArmyId = session.battle.armies[scenario.missionDirector?.playerArmySlot ?? 0]?.id;
  const enemyArmyId = session.battle.armies[scenario.missionDirector?.enemyArmySlot ?? 1]?.id;
  const armyMetrics = buildArmyMetrics(initialArmies, session.battle);

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    seed,
    outcome: session.mission.status === "Active" ? "Incomplete" : session.mission.status,
    terminationReason,
    roundsPlayed: Math.max(0, session.battle.turn - 1),
    roundsCompleted: session.mission.roundsCompleted,
    finalTurn: session.battle.turn,
    ...(playerArmyId ? { playerArmyId } : {}),
    ...(enemyArmyId ? { enemyArmyId } : {}),
    playerRemainingPowerPercentage: getTeamRemainingPowerPercentage(
      initialArmies,
      session.battle,
      playerArmyId,
    ),
    enemyRemainingPowerPercentage: getTeamRemainingPowerPercentage(
      initialArmies,
      session.battle,
      enemyArmyId,
    ),
    counters: metrics.counters,
    armies: armyMetrics,
  };
}

function prepareHeadlessSession(
  scenario: ScenarioDefinition,
  sourceArmies: Army[],
  seed: number,
): { session: MissionSessionState; scenario: ScenarioDefinition; initialEvents: MissionEvent[] } {
  if (sourceArmies.length < 2 || sourceArmies.length > 4) {
    throw new Error("Headless missions require two to four armies.");
  }
  const armies = structuredClone(sourceArmies).map((army) => ({
    ...army,
    control: "Bot" as const,
    units: army.units.map((unit) => ({
      ...unit,
      position: null,
      status: "Ready" as const,
      suppression: 0,
      movedThisTurn: false,
      abilityCooldowns: {},
      activeEffects: [],
    })),
  }));
  const defenderArmyId = armies[scenario.defaultDefenderArmySlot ?? 0]?.id;
  let draft = createScenarioDraft(scenario.id, {
    armies,
    defenderArmyId,
    deploymentZones: scenario.deploymentZones,
    scheduledEvents: scenario.scheduledEvents ?? [],
    ...(scenario.board ? { board: scenario.board } : {}),
    mapGeneration: {
      themeId: scenario.recommendedMapThemeId ?? "desert-outpost",
      seed,
    },
  });
  draft = scenario.mapPreset
    ? applyScenarioMapPreset(draft, scenario)
    : generateScenarioDraftMap(draft, scenario);
  const activeScenario: ScenarioDefinition = {
    ...scenario,
    deploymentZones: structuredClone(draft.deploymentZones),
    scheduledEvents: structuredClone(draft.scheduledEvents),
  };
  let battle: Battle = {
    ...startBattleFromDraft(draft, activeScenario),
    id: `simulation:${scenario.id}:${seed}`,
  };
  let mission: MissionState = {
    ...createMissionState(activeScenario, battle.armies, defenderArmyId),
    deploymentZones: structuredClone(activeScenario.deploymentZones),
  };
  const startEvents = applyScheduledScenarioEvents(
    battle,
    mission,
    activeScenario,
    [{ type: "RoundStarted", round: 1 }],
  );
  battle = startEvents.battle;
  mission = startEvents.mission;
  const directorStart = applyMissionDirectorRound(battle, mission, activeScenario, 1);

  return {
    session: { battle: directorStart.battle, mission: directorStart.mission },
    scenario: activeScenario,
    initialEvents: [...startEvents.events, ...directorStart.events],
  };
}

function createCounters(): HeadlessSimulationCounters {
  return {
    engineActions: 0,
    botActions: 0,
    activationsDrawn: 0,
    activationsResolved: 0,
    activationsPassed: 0,
    roundsEnded: 0,
    phaseChanges: 0,
    enemyWaves: 0,
    emergencySupport: 0,
    botStopReasons: {
      "activation-completed": 0,
      "inactive-army": 0,
      "no-legal-action": 0,
      "action-rejected": 0,
      "step-limit": 0,
    },
  };
}

function recordActionResult(metrics: MutableMetrics, result: MissionActionResult): void {
  for (const event of result.events) {
    if (event.type === "ActivationDrawn") metrics.counters.activationsDrawn += 1;
    if (event.type === "ActivationPassed") metrics.counters.activationsPassed += 1;
    if (event.type === "TurnEnded") metrics.counters.roundsEnded += 1;
  }
  recordMissionEvents(metrics, result.missionEvents);
}

function recordMissionEvents(metrics: MutableMetrics, events: readonly MissionEvent[]): void {
  for (const event of events) {
    if (event.type !== "MissionDirectorIntervention") continue;
    if (event.intervention === "PhaseChanged") metrics.counters.phaseChanges += 1;
    if (event.intervention === "EnemyWave") metrics.counters.enemyWaves += 1;
    if (event.intervention === "EmergencySupport") metrics.counters.emergencySupport += 1;
  }
}

function buildArmyMetrics(initialArmies: Army[], finalBattle: Battle): SimulationArmyMetrics[] {
  return finalBattle.armies.map((army) => {
    const initialArmy = initialArmies.find((candidate) => candidate.id === army.id);
    const initialUnits = initialArmy?.units.length ?? 0;
    return {
      armyId: army.id,
      playerName: army.playerName,
      faction: army.faction,
      ...(army.teamId ? { teamId: army.teamId } : {}),
      initialUnits,
      totalUnitsSeen: army.units.length,
      reinforcements: Math.max(0, army.units.length - initialUnits),
      destroyedUnits: army.units.filter((unit) => unit.status === "Destroyed").length,
      reserveUnits: army.units.filter((unit) =>
        unit.status !== "Destroyed" && unit.position === null
      ).length,
      initialPower: getArmyPower(initialArmy),
      remainingPower: getArmyPower(army, true),
      initialHp: getArmyHp(initialArmy),
      remainingHp: getArmyHp(army, true),
    };
  });
}

function getTeamRemainingPowerPercentage(
  initialArmies: Army[],
  finalBattle: Battle,
  anchorArmyId: string | undefined,
): number {
  if (!anchorArmyId) return 0;
  const initialPower = initialArmies
    .filter((army) => areArmiesAllied({ armies: initialArmies }, army.id, anchorArmyId))
    .reduce((sum, army) => sum + getArmyPower(army), 0);
  const remainingPower = finalBattle.armies
    .filter((army) => areArmiesAllied(finalBattle, army.id, anchorArmyId))
    .reduce((sum, army) => sum + getArmyPower(army, true), 0);
  return initialPower > 0 ? roundMetric(remainingPower / initialPower * 100) : 0;
}

function getArmyPower(army: Army | undefined, useRemainingHp = false): number {
  if (!army) return 0;
  return roundMetric(army.units.reduce((sum, unit) => {
    if (useRemainingHp && unit.status === "Destroyed") return sum;
    const template = getTemplate(unit);
    const healthRatio = useRemainingHp
      ? Math.max(0, unit.currentHp) / template.maxHp
      : 1;
    return sum + template.cost * healthRatio;
  }, 0));
}

function getArmyHp(army: Army | undefined, useRemainingHp = false): number {
  if (!army) return 0;
  return army.units.reduce((sum, unit) =>
    sum + (useRemainingHp
      ? unit.status === "Destroyed" ? 0 : Math.max(0, unit.currentHp)
      : getTemplate(unit).maxHp), 0);
}

function getScenarioRoundLimit(scenario: ScenarioDefinition): number {
  if (scenario.victoryCondition.type === "DefendPoint") {
    return scenario.victoryCondition.roundLimit;
  }
  return "rounds" in scenario.victoryCondition
    ? scenario.victoryCondition.rounds
    : scenario.victoryCondition.roundLimit;
}

function roundMetric(value: number): number {
  return Math.round(value * 10) / 10;
}
