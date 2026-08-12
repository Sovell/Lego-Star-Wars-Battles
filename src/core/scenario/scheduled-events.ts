import type {
  Army,
  Battle,
  BattlefieldObjectType,
  UnitInstance,
} from "../../types";
import type { BattleEvent } from "../battle-actions";
import { buildActivationBag } from "../rules/activation";
import { templateById } from "../rules/state";
import type {
  MissionEvent,
  MissionState,
  ScenarioDefinition,
  ScenarioEventEffect,
  ScenarioEventTrigger,
  ScenarioScheduledEvent,
} from "./scenario-types";

export type ScenarioTriggerSignal =
  | { type: "RoundStarted" | "RoundEnded"; round: number }
  | { type: "UnitDestroyed"; unitId: string; armyId: string; templateId: string }
  | { type: "ObjectDestroyed"; objectId: string; objectType: BattlefieldObjectType }
  | { type: "UnitEnteredZone"; unitId: string; armyId: string; zoneId: string }
  | {
      type: "TerritoryCaptured";
      armyId: string;
      position: { x: number; y: number };
    }
  | { type: "ArmyStrengthBelow"; armyId: string; percentage: number };

export type ScheduledScenarioEventResult = {
  battle: Battle;
  mission: MissionState;
  events: MissionEvent[];
};

export function validateScheduledScenarioEvents(
  events: readonly ScenarioScheduledEvent[],
  armies: readonly Army[],
): boolean {
  if (
    events.some((event) => !event.id.trim() || !event.name.trim()) ||
    new Set(events.map((event) => event.id)).size !== events.length
  ) {
    return false;
  }
  return events.every((event) =>
    validateTrigger(event.trigger, armies) && validateEffect(event.effect, armies)
  );
}

/** Compatibility entry point for round-based events and existing saves. */
export function applyScheduledScenarioEvents(
  battle: Battle,
  mission: MissionState,
  scenario: ScenarioDefinition,
  timings: Array<Extract<ScenarioTriggerSignal, { type: "RoundStarted" | "RoundEnded" }>>,
): ScheduledScenarioEventResult {
  return applyScenarioTriggerEffects(battle, mission, scenario, timings);
}

/** Resolves every still-pending event whose trigger matches a runtime signal. */
export function applyScenarioTriggerEffects(
  battle: Battle,
  mission: MissionState,
  scenario: ScenarioDefinition,
  signals: readonly ScenarioTriggerSignal[],
): ScheduledScenarioEventResult {
  if (mission.status !== "Active" || signals.length === 0) {
    return { battle, mission, events: [] };
  }

  const definitions = mission.scheduledEvents ?? scenario.scheduledEvents ?? [];
  const resolvedIds = new Set(mission.resolvedEventIds ?? []);
  const dueEvents = definitions.filter((event) =>
    !resolvedIds.has(event.id) && signals.some((signal) => triggerMatches(event.trigger, signal))
  );
  if (dueEvents.length === 0) {
    return { battle, mission, events: [] };
  }

  let nextBattle = battle;
  let nextMission = mission;
  const missionEvents: MissionEvent[] = [];
  for (const event of dueEvents) {
    if (nextMission.status !== "Active") break;
    const result = applyEffect(nextBattle, nextMission, scenario, event);
    nextBattle = result.battle;
    nextMission = result.mission;
    resolvedIds.add(event.id);
    missionEvents.push({
      type: "ScheduledEventResolved",
      eventId: event.id,
      message: result.message,
    }, ...result.events);
  }

  return {
    battle: nextBattle,
    mission: {
      ...nextMission,
      scheduledEvents: structuredClone(definitions),
      resolvedEventIds: [...resolvedIds],
    },
    events: missionEvents,
  };
}

/** Converts normal battle and mission state changes into scenario trigger signals. */
export function deriveScenarioTriggerSignals({
  battleBefore,
  battleAfter,
  missionBefore,
  missionAfter,
  scenario,
  battleEvents,
  roundSignals = [],
}: {
  battleBefore: Battle;
  battleAfter: Battle;
  missionBefore: MissionState;
  missionAfter: MissionState;
  scenario: ScenarioDefinition;
  battleEvents: readonly BattleEvent[];
  roundSignals?: Array<Extract<ScenarioTriggerSignal, { type: "RoundStarted" | "RoundEnded" }>>;
}): ScenarioTriggerSignal[] {
  const signals: ScenarioTriggerSignal[] = [...roundSignals];

  for (const event of battleEvents) {
    if (event.type === "UnitDestroyed") {
      const unit = findUnit(battleAfter, event.unitId) ?? findUnit(battleBefore, event.unitId);
      if (unit) {
        signals.push({
          type: "UnitDestroyed",
          unitId: unit.id,
          armyId: unit.armyId,
          templateId: unit.templateId,
        });
      }
    }
    if (event.type === "BattlefieldObjectDestroyed") {
      signals.push({
        type: "ObjectDestroyed",
        objectId: event.objectId,
        objectType: event.objectType,
      });
    }
    if (event.type === "UnitMoved" || event.type === "UnitDeployed") {
      const unit = findUnit(battleAfter, event.unitId);
      const previous = findUnit(battleBefore, event.unitId)?.position;
      if (!unit?.position) continue;
      for (const zone of scenario.zones ?? []) {
        const entered = containsPosition(zone.cells, unit.position) &&
          (!previous || !containsPosition(zone.cells, previous));
        if (entered) {
          signals.push({
            type: "UnitEnteredZone",
            unitId: unit.id,
            armyId: unit.armyId,
            zoneId: zone.id,
          });
        }
      }
    }
  }

  const previousOwners = missionBefore.territoryOwners ?? {};
  for (const [positionKey, armyId] of Object.entries(missionAfter.territoryOwners ?? {})) {
    if (previousOwners[positionKey] === armyId) continue;
    const position = parsePosition(positionKey);
    if (position) signals.push({ type: "TerritoryCaptured", armyId, position });
  }

  for (const army of battleAfter.armies) {
    const initial = missionAfter.initialArmyStrength?.[army.id] ??
      missionBefore.initialArmyStrength?.[army.id] ??
      army.units.reduce((total, unit) => total + Math.max(0, unit.currentHp), 0);
    const current = army.units.reduce(
      (total, unit) => total + (unit.status === "Destroyed" ? 0 : Math.max(0, unit.currentHp)),
      0,
    );
    signals.push({
      type: "ArmyStrengthBelow",
      armyId: army.id,
      percentage: initial > 0 ? (current / initial) * 100 : 0,
    });
  }

  return signals;
}

function validateTrigger(trigger: ScenarioEventTrigger, armies: readonly Army[]): boolean {
  switch (trigger.type) {
    case "RoundStarted":
    case "RoundEnded":
      return Number.isInteger(trigger.round) && trigger.round >= 1;
    case "UnitDestroyed":
      return !trigger.armyId || armies.some((army) => army.id === trigger.armyId);
    case "ObjectDestroyed":
      return Boolean(trigger.objectId?.trim() || trigger.objectType);
    case "UnitEnteredZone":
      return Boolean(trigger.zoneId.trim()) &&
        (!trigger.armyId || armies.some((army) => army.id === trigger.armyId));
    case "TerritoryCaptured":
      return !trigger.armyId || armies.some((army) => army.id === trigger.armyId);
    case "ArmyStrengthBelow":
      return armies.some((army) => army.id === trigger.armyId) &&
        Number.isFinite(trigger.percentage) &&
        trigger.percentage >= 0 && trigger.percentage <= 100;
  }
}

function validateEffect(effect: ScenarioEventEffect, armies: readonly Army[]): boolean {
  switch (effect.type) {
    case "DeployReinforcements":
    case "SpawnUnits": {
      const army = armies.find((candidate) => candidate.id === effect.armyId);
      return Boolean(
        army && effect.units.length > 0 && effect.units.every((unit) =>
          templateById.get(unit.templateId)?.faction === army.faction &&
          Number.isInteger(unit.count) && unit.count >= 1
        )
      );
    }
    case "ChangeObjective":
      return Boolean(effect.name.trim() && effect.description.trim());
    case "PlaceObject":
      return Boolean(effect.object.id.trim() && effect.object.name.trim()) &&
        (effect.object.destructible ? effect.object.maxHp >= 1 : effect.object.maxHp >= 0);
    case "ChangeAIProfile":
      return armies.some((army) => army.id === effect.armyId);
    case "ShowMessage":
    case "Victory":
    case "Defeat":
      return Boolean(effect.message.trim());
  }
}

function triggerMatches(
  trigger: ScenarioEventTrigger,
  signal: ScenarioTriggerSignal,
): boolean {
  if (trigger.type !== signal.type) return false;
  switch (trigger.type) {
    case "RoundStarted":
    case "RoundEnded":
      return signal.type === trigger.type && signal.round === trigger.round;
    case "UnitDestroyed":
      return signal.type === "UnitDestroyed" &&
        (!trigger.unitId || trigger.unitId === signal.unitId) &&
        (!trigger.armyId || trigger.armyId === signal.armyId) &&
        (!trigger.templateId || trigger.templateId === signal.templateId);
    case "ObjectDestroyed":
      return signal.type === "ObjectDestroyed" &&
        (!trigger.objectId || trigger.objectId === signal.objectId) &&
        (!trigger.objectType || trigger.objectType === signal.objectType);
    case "UnitEnteredZone":
      return signal.type === "UnitEnteredZone" &&
        trigger.zoneId === signal.zoneId &&
        (!trigger.armyId || trigger.armyId === signal.armyId);
    case "TerritoryCaptured":
      return signal.type === "TerritoryCaptured" &&
        (!trigger.armyId || trigger.armyId === signal.armyId) &&
        (!trigger.position || samePosition(trigger.position, signal.position));
    case "ArmyStrengthBelow":
      return signal.type === "ArmyStrengthBelow" &&
        trigger.armyId === signal.armyId &&
        signal.percentage <= trigger.percentage;
  }
}

function applyEffect(
  battle: Battle,
  mission: MissionState,
  scenario: ScenarioDefinition,
  event: ScenarioScheduledEvent,
): ScheduledScenarioEventResult & { message: string } {
  const effect = event.effect;
  switch (effect.type) {
    case "DeployReinforcements": {
      const armySlot = battle.armies.findIndex((army) => army.id === effect.armyId);
      const cells = scenario.deploymentZones.find((zone) => zone.armySlot === armySlot)?.cells ?? [];
      return addUnits(battle, mission, event, effect.armyId, effect.units, cells);
    }
    case "SpawnUnits": {
      const zoneCells = effect.zoneId
        ? scenario.zones?.find((zone) => zone.id === effect.zoneId)?.cells ?? []
        : [];
      return addUnits(
        battle,
        mission,
        event,
        effect.armyId,
        effect.units,
        effect.positions ?? zoneCells,
      );
    }
    case "ChangeObjective":
      return {
        battle,
        mission: {
          ...mission,
          activeObjectiveId: effect.objectiveId,
          activeObjectiveName: effect.name,
          activeObjectiveDescription: effect.description,
        },
        events: [],
        message: `Nowy cel misji: ${effect.name}. ${effect.description}`,
      };
    case "PlaceObject": {
      const duplicate = battle.board.objects?.some((object) => object.id === effect.object.id);
      const onBoard = effect.object.position.x >= 0 &&
        effect.object.position.x < battle.board.width &&
        effect.object.position.y >= 0 &&
        effect.object.position.y < battle.board.height;
      if (duplicate || !onBoard) {
        return {
          battle,
          mission,
          events: [],
          message: `Zdarzenie „${event.name}” nie umieściło obiektu: identyfikator lub pole jest nieprawidłowe.`,
        };
      }
      return {
        battle: {
          ...battle,
          board: {
            ...battle.board,
            objects: [...(battle.board.objects ?? []), {
              ...structuredClone(effect.object),
              currentHp: effect.object.maxHp,
              status: "Active",
            }],
          },
        },
        mission,
        events: [],
        message: `Zdarzenie „${event.name}”: na mapie pojawia się ${effect.object.name}.`,
      };
    }
    case "ChangeAIProfile":
      return {
        battle,
        mission: {
          ...mission,
          botProfiles: { ...(mission.botProfiles ?? {}), [effect.armyId]: effect.profile },
        },
        events: [],
        message: `Zdarzenie „${event.name}”: profil AI armii zmienia się na ${effect.profile}.`,
      };
    case "ShowMessage":
      return { battle, mission, events: [], message: effect.message };
    case "Victory":
      return {
        battle,
        mission: { ...mission, status: "Victory" },
        events: [{ type: "MissionCompleted", status: "Victory", message: effect.message }],
        message: effect.message,
      };
    case "Defeat":
      return {
        battle,
        mission: { ...mission, status: "Defeat" },
        events: [{ type: "MissionCompleted", status: "Defeat", message: effect.message }],
        message: effect.message,
      };
  }
}

function addUnits(
  battle: Battle,
  mission: MissionState,
  event: ScenarioScheduledEvent,
  armyId: string,
  units: Array<{ templateId: string; count: number }>,
  requestedCells: { x: number; y: number }[],
): ScheduledScenarioEventResult & { message: string } {
  const army = battle.armies.find((candidate) => candidate.id === armyId);
  if (!army) {
    return {
      battle,
      mission,
      events: [],
      message: `Zdarzenie „${event.name}” nie zostało wykonane: wskazana armia nie istnieje.`,
    };
  }

  const requestedTemplates = units.flatMap(({ templateId, count }) => {
    const template = templateById.get(templateId);
    const normalizedCount = Math.max(0, Math.floor(count));
    if (!template || template.faction !== army.faction || normalizedCount === 0) return [];
    return Array.from({ length: normalizedCount }, () => template);
  });
  if (requestedTemplates.length === 0) {
    return {
      battle,
      mission,
      events: [],
      message: `Zdarzenie „${event.name}” nie zostało wykonane: brak legalnych jednostek.`,
    };
  }

  const occupiedCells = new Set(
    battle.armies.flatMap((candidateArmy) => candidateArmy.units)
      .filter((unit) => unit.status !== "Destroyed" && unit.position)
      .map((unit) => `${unit.position!.x},${unit.position!.y}`),
  );
  const entryCells = [...requestedCells]
    .filter((position, index, cells) =>
      position.x >= 0 && position.x < battle.board.width &&
      position.y >= 0 && position.y < battle.board.height &&
      cells.findIndex((candidate) => samePosition(candidate, position)) === index &&
      !occupiedCells.has(`${position.x},${position.y}`)
    )
    .sort((left, right) => left.x - right.x || left.y - right.y);
  const existingIds = new Set(
    battle.armies.flatMap((candidateArmy) => candidateArmy.units.map((unit) => unit.id)),
  );
  const addedUnits: UnitInstance[] = requestedTemplates.map((template, index) => {
    const position = entryCells[index] ?? null;
    if (position) occupiedCells.add(`${position.x},${position.y}`);
    return {
      id: createUniqueUnitId(existingIds, army.id, event.id, template.id, index),
      templateId: template.id,
      armyId: army.id,
      currentHp: template.maxHp,
      suppression: 0,
      abilityCooldowns: {},
      activeEffects: [],
      movedThisTurn: false,
      position,
      status: "Ready",
      hidden: false,
    };
  });
  const armies = battle.armies.map((candidateArmy) =>
    candidateArmy.id === army.id
      ? { ...candidateArmy, units: [...candidateArmy.units, ...addedUnits] }
      : candidateArmy
  );
  const updatedArmy = armies.find((candidateArmy) => candidateArmy.id === army.id)!;
  const armyTokens = buildActivationBag([updatedArmy]);
  const deployedCount = addedUnits.filter((unit) => unit.position).length;
  const reserveCount = addedUnits.length - deployedCount;
  const reserveSuffix = reserveCount > 0
    ? ` ${reserveCount} pozostaje w rezerwie z powodu braku wolnych pól.`
    : "";

  return {
    battle: {
      ...battle,
      armies,
      activationBag: [
        ...battle.activationBag.filter((token) => token.armyId !== army.id),
        ...armyTokens,
      ],
    },
    mission,
    events: [],
    message: `Zdarzenie „${event.name}”: ${addedUnits.length} jednostek dołącza do armii ${army.playerName}; ${deployedCount} wchodzi na mapę.${reserveSuffix}`,
  };
}

function findUnit(battle: Battle, unitId: string): UnitInstance | undefined {
  return battle.armies.flatMap((army) => army.units).find((unit) => unit.id === unitId);
}

function containsPosition(
  cells: { x: number; y: number }[],
  position: { x: number; y: number },
): boolean {
  return cells.some((cell) => samePosition(cell, position));
}

function samePosition(
  left: { x: number; y: number },
  right: { x: number; y: number },
): boolean {
  return left.x === right.x && left.y === right.y;
}

function parsePosition(value: string): { x: number; y: number } | undefined {
  const [x, y] = value.split(",").map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined;
}

function createUniqueUnitId(
  existingIds: Set<string>,
  armyId: string,
  eventId: string,
  templateId: string,
  index: number,
): string {
  const safeEventId = eventId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const baseId = `${armyId}_reinforcement_${safeEventId}_${templateId}_${index + 1}`;
  let candidate = baseId;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `${baseId}_${suffix}`;
    suffix += 1;
  }
  existingIds.add(candidate);
  return candidate;
}
