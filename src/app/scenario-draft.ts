import { createBattle } from "../core/battle-state";
import { getTemplate } from "../core/rules/state";
import type { DeploymentZone } from "../core/scenario/scenario-types";
import type { Army, Battle, Board, UnitInstance } from "../types";
import { createEmptyBoard } from "./new-game-state";

export type ScenarioDraft = {
  armies: Army[];
  board: Board;
  scenarioId: string;
  defenderArmyId?: string;
  deploymentZones: DeploymentZone[];
  roundTarget?: number;
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
    ...(input.defenderArmyId ? { defenderArmyId: input.defenderArmyId } : {}),
    ...(input.roundTarget ? { roundTarget: input.roundTarget } : {}),
  };
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
): ScenarioDraft {
  const resetBattle = createInitialBattleSnapshot(initialBattle);

  return createScenarioDraft(scenarioId, {
    armies: resetBattle.armies,
    board: resetBattle.board,
    defenderArmyId,
    deploymentZones,
    roundTarget,
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

function resetArmies(armies: Army[]): Army[] {
  return structuredClone(armies).map((army) => ({
    ...army,
    units: army.units.map(resetUnit),
  }));
}

function resetUnit(unit: UnitInstance): UnitInstance {
  return {
    ...unit,
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
