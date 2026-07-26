import { createBattle } from "../core/battle-state";
import { getTemplate } from "../core/rules/state";
import type { Army, Battle, Board, UnitInstance } from "../types";
import { createEmptyBoard } from "./new-game-state";

export type ScenarioDraft = {
  armies: Army[];
  board: Board;
  scenarioId: string;
  defenderArmyId?: string;
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
): ScenarioDraft {
  const resetBattle = createInitialBattleSnapshot(initialBattle);

  return createScenarioDraft(scenarioId, {
    armies: resetBattle.armies,
    board: resetBattle.board,
    defenderArmyId,
    roundTarget,
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
