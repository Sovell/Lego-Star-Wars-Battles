import type { Army, Battle, UnitInstance } from "../../types";
import { buildActivationBag } from "../rules/activation";
import { templateById } from "../rules/state";
import type {
  MissionEvent,
  MissionState,
  ScenarioDefinition,
  ScenarioEventTrigger,
  ScenarioScheduledEvent,
} from "./scenario-types";

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
    events.some((event) => !event.id.trim()) ||
    new Set(events.map((event) => event.id)).size !== events.length
  ) {
    return false;
  }
  return events.every((event) => {
    const army = armies.find((candidate) => candidate.id === event.effect.armyId);
    return Boolean(
      event.name.trim() &&
      Number.isInteger(event.trigger.round) &&
      event.trigger.round >= 1 &&
      army &&
      event.effect.units.length > 0 &&
      event.effect.units.every((unit) => {
        const template = templateById.get(unit.templateId);
        return template?.faction === army.faction &&
          Number.isInteger(unit.count) &&
          unit.count >= 1;
      })
    );
  });
}

export function applyScheduledScenarioEvents(
  battle: Battle,
  mission: MissionState,
  scenario: ScenarioDefinition,
  timings: ScenarioEventTrigger[],
): ScheduledScenarioEventResult {
  if (mission.status !== "Active" || timings.length === 0) {
    return { battle, mission, events: [] };
  }

  const definitions = mission.scheduledEvents ?? scenario.scheduledEvents ?? [];
  const resolvedIds = new Set(mission.resolvedEventIds ?? []);
  const dueEvents = definitions.filter((event) =>
    !resolvedIds.has(event.id) && timings.some((timing) =>
      timing.type === event.trigger.type && timing.round === event.trigger.round
    )
  );
  if (dueEvents.length === 0) {
    return { battle, mission, events: [] };
  }

  let nextBattle = battle;
  const missionEvents: MissionEvent[] = [];
  for (const event of dueEvents) {
    const result = deployReinforcements(nextBattle, scenario, event);
    nextBattle = result.battle;
    resolvedIds.add(event.id);
    missionEvents.push({
      type: "ScheduledEventResolved",
      eventId: event.id,
      message: result.message,
    });
  }

  return {
    battle: nextBattle,
    mission: {
      ...mission,
      scheduledEvents: structuredClone(definitions),
      resolvedEventIds: [...resolvedIds],
    },
    events: missionEvents,
  };
}

function deployReinforcements(
  battle: Battle,
  scenario: ScenarioDefinition,
  event: ScenarioScheduledEvent,
): { battle: Battle; message: string } {
  const armyIndex = battle.armies.findIndex((army) => army.id === event.effect.armyId);
  const army = battle.armies[armyIndex];
  if (!army) {
    return {
      battle,
      message: `Zdarzenie „${event.name}” nie zostało wykonane: wskazana armia nie istnieje.`,
    };
  }

  const requestedTemplates = event.effect.units.flatMap(({ templateId, count }) => {
    const template = templateById.get(templateId);
    const normalizedCount = Math.max(0, Math.floor(count));
    if (!template || template.faction !== army.faction || normalizedCount === 0) return [];
    return Array.from({ length: normalizedCount }, () => template);
  });
  if (requestedTemplates.length === 0) {
    return {
      battle,
      message: `Zdarzenie „${event.name}” nie zostało wykonane: nie skonfigurowano legalnych jednostek.`,
    };
  }

  const occupiedCells = new Set(
    battle.armies.flatMap((candidateArmy) => candidateArmy.units)
      .filter((unit) => unit.status !== "Destroyed" && unit.position)
      .map((unit) => `${unit.position!.x},${unit.position!.y}`),
  );
  const zone = scenario.deploymentZones.find((candidate) => candidate.armySlot === armyIndex);
  const entryCells = [...(zone?.cells ?? [])]
    .filter((position, index, cells) =>
      position.x >= 0 && position.x < battle.board.width &&
      position.y >= 0 && position.y < battle.board.height &&
      cells.findIndex((candidate) =>
        candidate.x === position.x && candidate.y === position.y
      ) === index &&
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
  const reinforcementTokens = buildActivationBag([{
    ...army,
    units: addedUnits,
  }]);
  const deployedCount = addedUnits.filter((unit) => unit.position).length;
  const reserveCount = addedUnits.length - deployedCount;
  const reserveSuffix = reserveCount > 0
    ? ` ${reserveCount} pozostaje w rezerwie z powodu braku wolnych pól.`
    : "";

  return {
    battle: {
      ...battle,
      armies,
      activationBag: [...battle.activationBag, ...reinforcementTokens],
    },
    message: `Zdarzenie „${event.name}”: ${addedUnits.length} jednostek dołącza do armii ${army.playerName}; ${deployedCount} wchodzi na mapę.${reserveSuffix}`,
  };
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
