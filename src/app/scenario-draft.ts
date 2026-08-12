import { createBattle } from "../core/battle-state";
import {
  generateMap,
  type MapGenerationRecipe,
  type MapThemeId,
} from "../core/map-generation";
import { generateDeploymentZones } from "../core/map-generation/deployment-zone-generator";
import { getTemplate, templateById } from "../core/rules/state";
import type {
  DeploymentZone,
  ScenarioDefinition,
  ScenarioScheduledEvent,
} from "../core/scenario/scenario-types";
import type { Army, Battle, Board, UnitInstance } from "../types";
import { createEmptyBoard } from "./new-game-state";

export type ScenarioDraft = {
  armies: Army[];
  board: Board;
  scenarioId: string;
  defenderArmyId?: string;
  deploymentZones: DeploymentZone[];
  roundTarget?: number;
  stageRoundTargets?: number[];
  scheduledEvents: ScenarioScheduledEvent[];
  mapGeneration?: ScenarioMapGenerationState;
};

export type ScenarioMapGenerationState = {
  themeId: MapThemeId;
  seed: number;
  lastRecipe?: MapGenerationRecipe;
};

export const defaultMapGenerationState: ScenarioMapGenerationState = {
  themeId: "desert-outpost",
  seed: 1138,
};

export type ComposerOrigin = "menu" | "setup";

export function createScenarioDraft(
  scenarioId: string,
  input: Partial<Omit<ScenarioDraft, "scenarioId">> = {},
): ScenarioDraft {
  return {
    scenarioId,
    armies: structuredClone(input.armies ?? []),
    board: structuredClone(input.board ?? createEmptyBoard()),
    deploymentZones: structuredClone(input.deploymentZones ?? []),
    scheduledEvents: structuredClone(input.scheduledEvents ?? []),
    mapGeneration: structuredClone(input.mapGeneration ?? defaultMapGenerationState),
    ...(input.defenderArmyId ? { defenderArmyId: input.defenderArmyId } : {}),
    ...(input.roundTarget ? { roundTarget: input.roundTarget } : {}),
    ...(input.stageRoundTargets
      ? { stageRoundTargets: structuredClone(input.stageRoundTargets) }
      : {}),
  };
}

export function getScenarioMapGenerationState(
  draft: Pick<ScenarioDraft, "mapGeneration">,
): ScenarioMapGenerationState {
  return structuredClone(draft.mapGeneration ?? defaultMapGenerationState);
}

export function updateScenarioMapGenerationState(
  draft: ScenarioDraft,
  patch: Partial<Pick<ScenarioMapGenerationState, "themeId" | "seed">>,
): ScenarioDraft {
  const current = getScenarioMapGenerationState(draft);
  return {
    ...draft,
    mapGeneration: {
      ...current,
      ...patch,
      ...(patch.seed === undefined ? {} : { seed: normalizeMapSeed(patch.seed) }),
    },
  };
}

export function markScenarioDraftMapEdited(draft: ScenarioDraft): ScenarioDraft {
  const { lastRecipe: _lastRecipe, ...settings } = getScenarioMapGenerationState(draft);
  return { ...draft, mapGeneration: settings };
}

export function hasManualScenarioMap(draft: ScenarioDraft): boolean {
  const hasMapContent = draft.board.tiles.length > 0 ||
    (draft.board.objects?.length ?? 0) > 0 ||
    draft.deploymentZones.some((zone) => zone.cells.length > 0);
  return hasMapContent && !draft.mapGeneration?.lastRecipe;
}

export function generateScenarioDraftMap(
  draft: ScenarioDraft,
  scenario: ScenarioDefinition,
  useNextSeed = false,
): ScenarioDraft {
  if (scenario.mapPreset) {
    throw new Error("Predefined mission maps cannot be regenerated.");
  }
  if (draft.armies.length < 2 || draft.armies.length > 4) {
    throw new Error("Map generation requires two to four configured armies.");
  }
  const settings = getScenarioMapGenerationState(draft);
  const seed = useNextSeed ? nextMapSeed(settings.seed) : settings.seed;
  const defenderArmySlot = draft.armies.findIndex(
    (army) => army.id === draft.defenderArmyId,
  );
  const generated = generateMap({
    width: draft.board.width,
    height: draft.board.height,
    seed,
    themeId: settings.themeId,
    scenario,
    armies: draft.armies,
    ...(defenderArmySlot >= 0 ? { defenderArmySlot } : {}),
  });

  return {
    ...draft,
    board: generated.board,
    deploymentZones: generated.deploymentZones,
    mapGeneration: {
      themeId: settings.themeId,
      seed,
      lastRecipe: generated.recipe,
    },
  };
}

export function applyScenarioMapPreset(
  draft: ScenarioDraft,
  scenario: ScenarioDefinition,
): ScenarioDraft {
  const preset = scenario.mapPreset;
  if (!preset) {
    throw new Error("Scenario does not define a map preset.");
  }
  if (draft.armies.length === 1 || draft.armies.length > 4) {
    throw new Error("Mission map presets require no armies or two to four configured armies.");
  }

  // Generate the board against a canonical four-army layout. This reserves both
  // complete board edges and keeps terrain and objects identical regardless of
  // whether the player brings two, three, or four armies.
  const canonicalArmies = [
    { id: "preset-team-1-a", teamId: 1 as const },
    { id: "preset-team-2-a", teamId: 2 as const },
    { id: "preset-team-1-b", teamId: 1 as const },
    { id: "preset-team-2-b", teamId: 2 as const },
  ];
  const generated = generateMap({
    width: preset.width,
    height: preset.height,
    seed: preset.seed,
    themeId: preset.themeId,
    terrainDensity: preset.terrainDensity,
    scenario,
    armies: canonicalArmies,
    defenderArmySlot: scenario.defaultDefenderArmySlot ?? 0,
  });
  const deploymentZones = draft.armies.length === 0
    ? structuredClone(scenario.deploymentZones)
    : generateDeploymentZones({
        width: preset.width,
        height: preset.height,
        armies: draft.armies,
        defenderArmySlot: Math.max(
          0,
          draft.armies.findIndex((army) => army.id === draft.defenderArmyId),
        ),
        depth: generated.recipe.deploymentDepth,
      });

  return {
    ...draft,
    board: generated.board,
    deploymentZones,
    mapGeneration: {
      themeId: preset.themeId,
      seed: preset.seed,
      lastRecipe: generated.recipe,
    },
  };
}

export function nextMapSeed(seed: number): number {
  return (Math.imul(normalizeMapSeed(seed), 1664525) + 1013904223) >>> 0;
}

export function normalizeMapSeed(seed: number): number {
  return Number.isFinite(seed) ? Math.trunc(seed) >>> 0 : defaultMapGenerationState.seed;
}

export function prepareComposerDraft(
  origin: ComposerOrigin,
  currentDraft: ScenarioDraft,
  defaultScenarioId: string,
): ScenarioDraft {
  return origin === "setup"
    ? structuredClone(currentDraft)
    : createScenarioDraft(defaultScenarioId);
}

export function createPreparationBattle(draft: ScenarioDraft): Battle {
  return {
    id: "scenario-draft",
    turn: 1,
    armies: structuredClone(draft.armies),
    board: structuredClone(draft.board),
    activationBag: [],
    activeActivation: undefined,
    phase: "Setup",
  };
}

export function startBattleFromDraft(draft: ScenarioDraft): Battle {
  const armies = resetArmies(draft.armies);
  const battle = createBattle(armies);

  return {
    ...battle,
    board: resetBoard(draft.board),
  };
}

export function createInitialBattleSnapshot(battle: Battle): Battle {
  const armies = resetArmies(battle.armies);
  const initialBattle = createBattle(armies);

  return {
    ...initialBattle,
    id: battle.id,
    board: resetBoard(battle.board),
  };
}

export function restartDraftFromBattle(
  initialBattle: Battle,
  scenarioId: string,
  defenderArmyId?: string,
  roundTarget?: number,
  deploymentZones: DeploymentZone[] = [],
  scheduledEvents: ScenarioScheduledEvent[] = [],
  stageRoundTargets?: number[],
): ScenarioDraft {
  const resetBattle = createInitialBattleSnapshot(initialBattle);

  return createScenarioDraft(scenarioId, {
    armies: resetBattle.armies,
    board: resetBattle.board,
    defenderArmyId,
    deploymentZones,
    scheduledEvents,
    roundTarget,
    stageRoundTargets,
  });
}

export function alignDeploymentZones(
  zones: DeploymentZone[],
  armyCount: number,
): DeploymentZone[] {
  return Array.from({ length: armyCount }, (_, armySlot) => {
    const existing = zones.find((zone) => zone.armySlot === armySlot);
    return existing
      ? structuredClone(existing)
      : {
          id: `army-slot-${armySlot}-entry`,
          armySlot,
          cells: [],
        };
  });
}

export function toggleDeploymentZoneCell(
  zones: DeploymentZone[],
  armyCount: number,
  selectedArmySlot: number,
  position: { x: number; y: number },
): DeploymentZone[] {
  const aligned = alignDeploymentZones(zones, armyCount);
  const selectedContainsCell = aligned
    .find((zone) => zone.armySlot === selectedArmySlot)
    ?.cells.some((cell) => cell.x === position.x && cell.y === position.y);

  return aligned.map((zone) => {
    const cellsWithoutPosition = zone.cells.filter(
      (cell) => cell.x !== position.x || cell.y !== position.y,
    );
    return {
      ...zone,
      cells: zone.armySlot === selectedArmySlot && !selectedContainsCell
        ? [...cellsWithoutPosition, position]
        : cellsWithoutPosition,
    };
  });
}

export function remapDeploymentZonesByArmy(
  zones: DeploymentZone[],
  previousArmies: Array<Pick<Army, "id">>,
  nextArmies: Array<Pick<Army, "id">>,
): DeploymentZone[] {
  return nextArmies.map((army, nextArmySlot) => {
    const previousArmySlot = previousArmies.findIndex(
      (previousArmy) => previousArmy.id === army.id,
    );
    const previousZone = zones.find((zone) => zone.armySlot === previousArmySlot);
    return {
      id: `army-slot-${nextArmySlot}-entry`,
      armySlot: nextArmySlot,
      cells: structuredClone(previousZone?.cells ?? []),
    };
  });
}

export function remapScheduledEventsByArmy(
  events: readonly ScenarioScheduledEvent[],
  previousArmies: Array<Pick<Army, "id">>,
  nextArmies: Array<Pick<Army, "id" | "faction">>,
): ScenarioScheduledEvent[] {
  return events.flatMap((event) => {
    const cloned = structuredClone(event);
    if ("armyId" in cloned.trigger && cloned.trigger.armyId) {
      const nextTriggerArmy = findRemappedArmy(
        cloned.trigger.armyId,
        previousArmies,
        nextArmies,
        inferFactionFromArmyId(cloned.trigger.armyId),
      );
      if (!nextTriggerArmy && cloned.trigger.type === "ArmyStrengthBelow") return [];
      cloned.trigger = {
        ...cloned.trigger,
        armyId: nextTriggerArmy?.id,
      } as typeof cloned.trigger;
    }
    const effect = cloned.effect;
    if (
      effect.type !== "DeployReinforcements" &&
      effect.type !== "SpawnUnits" &&
      effect.type !== "ChangeAIProfile"
    ) {
      return [cloned];
    }
    const effectFaction = effect.type === "ChangeAIProfile"
      ? inferFactionFromArmyId(effect.armyId)
      : templateById.get(effect.units[0]?.templateId)?.faction;
    const nextArmy = findRemappedArmy(
      effect.armyId,
      previousArmies,
      nextArmies,
      effectFaction,
    );
    if (!nextArmy) return [];
    if (effect.type === "ChangeAIProfile") {
      return [{ ...cloned, effect: { ...effect, armyId: nextArmy.id } }];
    }
    return [{
      ...cloned,
      effect: {
        ...effect,
        armyId: nextArmy.id,
        units: effect.units.filter((unit) =>
          templateById.get(unit.templateId)?.faction === nextArmy.faction
        ),
      },
    }];
  });
}

function findRemappedArmy(
  armyId: string,
  previousArmies: Array<Pick<Army, "id">>,
  nextArmies: Array<Pick<Army, "id" | "faction">>,
  intendedFaction?: Army["faction"],
) {
  const previousSlot = previousArmies.findIndex((army) => army.id === armyId);
  return nextArmies.find((army) => army.id === armyId)
    ?? nextArmies.find((army) => army.faction === intendedFaction)
    ?? nextArmies[previousSlot]
    ?? nextArmies[0];
}

function inferFactionFromArmyId(armyId: string): Army["faction"] | undefined {
  const normalized = armyId.toLowerCase();
  if (normalized.includes("republic")) return "Republic";
  if (normalized.includes("separatist")) return "Separatists";
  return undefined;
}

function resetArmies(armies: Army[]): Army[] {
  return structuredClone(armies).map((army) => ({
    ...army,
    units: army.units.map((unit) => resetUnit(unit, army.id)),
  }));
}

function resetUnit(unit: UnitInstance, armyId: string): UnitInstance {
  return {
    ...unit,
    armyId,
    currentHp: getTemplate(unit).maxHp,
    suppression: 0,
    abilityCooldowns: {},
    activeEffects: [],
    movedThisTurn: false,
    status: "Ready",
  };
}

function resetBoard(board: Board): Board {
  const nextBoard = structuredClone(board);

  return {
    ...nextBoard,
    objects: (nextBoard.objects ?? []).map((object) => ({
      ...object,
      currentHp: object.maxHp,
      status: "Active",
    })),
  };
}
