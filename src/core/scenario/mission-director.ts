import type { Army, Battle } from "../../types";
import { areArmiesAllied, areArmiesEnemies } from "../army-relations";
import { getTemplate } from "../rules/state";
import { templateById } from "../rules/state";
import { applyScenarioEventEffect } from "./scheduled-events";
import type {
  MissionDirectorDefinition,
  MissionDirectorPhase,
  MissionDirectorState,
  MissionEvent,
  MissionState,
  ScenarioDefinition,
  ScenarioReinforcementUnit,
  ScenarioScheduledEvent,
} from "./scenario-types";

export type MissionDirectorResult = {
  battle: Battle;
  mission: MissionState;
  events: MissionEvent[];
};

/**
 * Evaluates one authored pacing tick. Decisions depend only on the current
 * session state, so the same save always produces the same intervention and
 * can later be replayed by the headless simulator.
 */
export function applyMissionDirectorRound(
  battle: Battle,
  mission: MissionState,
  scenario: ScenarioDefinition,
  round: number,
): MissionDirectorResult {
  const definition = scenario.missionDirector;
  if (!definition || mission.status !== "Active" || !Number.isInteger(round) || round < 1) {
    return { battle, mission, events: [] };
  }
  const previousState = mission.directorState ?? createMissionDirectorState();
  if (previousState.lastEvaluatedRound === round) {
    return { battle, mission, events: [] };
  }

  let nextBattle = battle;
  let nextMission: MissionState = {
    ...mission,
    directorState: { ...previousState, lastEvaluatedRound: round },
  };
  const events: MissionEvent[] = [];
  const phase = getMissionDirectorPhase(round, getMissionRoundLimit(nextMission, scenario));
  const profile = definition.phaseProfiles?.[phase];
  const enemyArmy = nextBattle.armies[definition.enemyArmySlot];

  if (phase !== previousState.phase) {
    nextMission = withDirectorState(nextMission, { phase });
    if (profile && enemyArmy && nextMission.botProfiles?.[enemyArmy.id] !== profile) {
      const profileResult = applyScenarioEventEffect(
        nextBattle,
        nextMission,
        scenario,
        directorEvent(scenario, round, "phase", {
          type: "ChangeAIProfile",
          armyId: enemyArmy.id,
          profile,
        }),
      );
      nextBattle = profileResult.battle;
      nextMission = profileResult.mission;
    }
    events.push({
      type: "MissionDirectorIntervention",
      intervention: "PhaseChanged",
      message: `Mission Director: faza misji zmienia się na ${phaseLabel(phase)}${profile ? `; profil AI: ${profile}` : ""}.`,
    });
  }

  const support = definition.emergencySupport;
  const playerArmy = nextBattle.armies[definition.playerArmySlot];
  const directorState = nextMission.directorState ?? createMissionDirectorState();
  const playerStrength = playerArmy
    ? getTeamStrengthPercentage(nextBattle, nextMission, playerArmy.id)
    : 100;
  const playerPower = playerArmy ? getTeamCombatPower(nextBattle, playerArmy.id) : 0;
  const enemyPower = enemyArmy ? getTeamCombatPower(nextBattle, enemyArmy.id) : 0;
  const supportCooldownElapsed = directorState.lastSupportRound === undefined ||
    round - directorState.lastSupportRound >= (support?.cooldownRounds ?? 0);

  if (
    support && playerArmy && round >= support.firstRound &&
    directorState.supportUses < support.maxUses && supportCooldownElapsed &&
    playerStrength <= support.strengthBelowPercentage && playerPower < enemyPower
  ) {
    const wave = support.waves[directorState.supportUses % support.waves.length];
    const result = applyReinforcementIntervention(
      nextBattle,
      nextMission,
      scenario,
      round,
      "support",
      playerArmy.id,
      wave,
    );
    nextBattle = result.battle;
    nextMission = withDirectorState(result.mission, {
      supportUses: directorState.supportUses + 1,
      lastSupportRound: round,
    });
    events.push({
      type: "MissionDirectorIntervention",
      intervention: "EmergencySupport",
      message: `Mission Director: awaryjne wsparcie dołącza do armii ${playerArmy.playerName}.`,
    }, ...result.events);
    return { battle: nextBattle, mission: nextMission, events };
  }

  const escalation = definition.escalation;
  const waveDue = escalation && round >= escalation.firstRound &&
    (round - escalation.firstRound) % escalation.interval === 0;
  if (
    escalation && waveDue && enemyArmy && playerArmy &&
    directorState.wavesDeployed < escalation.maxWaves &&
    enemyPower <= playerPower * escalation.powerRatioThreshold
  ) {
    const wave = escalation.waves[directorState.wavesDeployed % escalation.waves.length];
    const result = applyReinforcementIntervention(
      nextBattle,
      nextMission,
      scenario,
      round,
      "enemy-wave",
      enemyArmy.id,
      wave,
    );
    nextBattle = result.battle;
    nextMission = withDirectorState(result.mission, {
      wavesDeployed: directorState.wavesDeployed + 1,
      lastWaveRound: round,
    });
    events.push({
      type: "MissionDirectorIntervention",
      intervention: "EnemyWave",
      message: `Mission Director: nowa fala wzmacnia armię ${enemyArmy.playerName}.`,
    }, ...result.events);
  }

  return { battle: nextBattle, mission: nextMission, events };
}

export function validateMissionDirector(
  definition: MissionDirectorDefinition | undefined,
  armies: readonly Army[],
): boolean {
  if (!definition) return true;
  if (
    !validArmySlot(definition.playerArmySlot, armies) ||
    !validArmySlot(definition.enemyArmySlot, armies) ||
    definition.playerArmySlot === definition.enemyArmySlot ||
    !areArmiesEnemies(
      { armies: [...armies] },
      armies[definition.playerArmySlot].id,
      armies[definition.enemyArmySlot].id,
    )
  ) return false;

  const escalation = definition.escalation;
  if (escalation && (
    !positiveInteger(escalation.firstRound) ||
    !positiveInteger(escalation.interval) ||
    !nonNegativeInteger(escalation.maxWaves) ||
    !Number.isFinite(escalation.powerRatioThreshold) || escalation.powerRatioThreshold <= 0 ||
    escalation.waves.length === 0 ||
    !wavesMatchArmy(escalation.waves, armies[definition.enemyArmySlot])
  )) return false;

  const support = definition.emergencySupport;
  if (support && (
    !positiveInteger(support.firstRound) ||
    !Number.isFinite(support.strengthBelowPercentage) ||
    support.strengthBelowPercentage < 0 || support.strengthBelowPercentage > 100 ||
    !nonNegativeInteger(support.maxUses) ||
    !nonNegativeInteger(support.cooldownRounds) ||
    support.waves.length === 0 ||
    !wavesMatchArmy(support.waves, armies[definition.playerArmySlot])
  )) return false;

  return true;
}

export function getMissionDirectorPhase(
  round: number,
  roundLimit: number,
): MissionDirectorPhase {
  const progress = Math.max(0, Math.min(1, round / Math.max(1, roundLimit)));
  if (progress <= 0.25) return "Opening";
  if (progress <= 0.55) return "Escalation";
  if (progress <= 0.8) return "Crisis";
  return "Finale";
}

export function getTeamCombatPower(battle: Battle, anchorArmyId: string): number {
  return battle.armies
    .filter((army) => areArmiesAllied(battle, army.id, anchorArmyId))
    .flatMap((army) => army.units)
    .reduce((total, unit) => {
      if (unit.status === "Destroyed") return total;
      const template = getTemplate(unit);
      return total + template.cost * Math.max(0, unit.currentHp) / template.maxHp;
    }, 0);
}

function getTeamStrengthPercentage(
  battle: Battle,
  mission: MissionState,
  anchorArmyId: string,
): number {
  const alliedArmies = battle.armies.filter((army) =>
    areArmiesAllied(battle, army.id, anchorArmyId)
  );
  const initial = alliedArmies.reduce(
    (sum, army) => sum + (mission.initialArmyStrength?.[army.id] ?? 0),
    0,
  );
  const current = alliedArmies.flatMap((army) => army.units).reduce(
    (sum, unit) => sum + (unit.status === "Destroyed" ? 0 : Math.max(0, unit.currentHp)),
    0,
  );
  return initial > 0 ? Math.min(100, current / initial * 100) : 100;
}

function applyReinforcementIntervention(
  battle: Battle,
  mission: MissionState,
  scenario: ScenarioDefinition,
  round: number,
  kind: string,
  armyId: string,
  units: ScenarioReinforcementUnit[],
) {
  return applyScenarioEventEffect(
    battle,
    mission,
    scenario,
    directorEvent(scenario, round, kind, {
      type: "DeployReinforcements",
      armyId,
      units,
    }),
  );
}

function directorEvent(
  scenario: ScenarioDefinition,
  round: number,
  kind: string,
  effect: ScenarioScheduledEvent["effect"],
): ScenarioScheduledEvent {
  return {
    id: `director:${scenario.id}:${kind}:${round}`,
    name: `Mission Director — ${kind}`,
    trigger: { type: "RoundStarted", round },
    effect,
    visibility: "Announced",
  };
}

function withDirectorState(
  mission: MissionState,
  patch: Partial<MissionDirectorState>,
): MissionState {
  return {
    ...mission,
    directorState: {
      ...createMissionDirectorState(),
      ...(mission.directorState ?? {}),
      ...patch,
    },
  };
}

function createMissionDirectorState(): MissionDirectorState {
  return { wavesDeployed: 0, supportUses: 0 };
}

function getMissionRoundLimit(mission: MissionState, scenario: ScenarioDefinition): number {
  if (mission.roundTarget) return mission.roundTarget;
  if (scenario.victoryCondition.type === "DefendPoint") {
    return scenario.victoryCondition.roundLimit;
  }
  return "rounds" in scenario.victoryCondition
    ? scenario.victoryCondition.rounds
    : scenario.victoryCondition.roundLimit;
}

function wavesMatchArmy(
  waves: ScenarioReinforcementUnit[][],
  army: Army | undefined,
): boolean {
  return Boolean(army && waves.every((wave) =>
    wave.length > 0 && wave.every(({ templateId, count }) =>
      templateById.get(templateId)?.faction === army.faction && positiveInteger(count)
    )
  ));
}

function validArmySlot(slot: number, armies: readonly Army[]): boolean {
  return nonNegativeInteger(slot) && slot < armies.length;
}

function positiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

function nonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function phaseLabel(phase: MissionDirectorPhase): string {
  switch (phase) {
    case "Opening": return "otwarcie";
    case "Escalation": return "eskalacja";
    case "Crisis": return "kryzys";
    case "Finale": return "finał";
  }
}
