import type { AbilityDefinition, Battle, OrderType } from "../types";
import { validateUnitActivation } from "../core/rules/activation";
import { getLegalAbilityActions } from "../core/legal-actions/get-legal-ability-actions";
import { getLegalAttackActions } from "../core/legal-actions/get-legal-attack-actions";
import { getLegalPositionActions } from "../core/legal-actions/get-legal-position-actions";
import { findUnit } from "../core/rules/state";
import type { ScenarioDefinition } from "../core/scenario/scenario-types";
import { boardPositionKey, type BoardPosition } from "./board-view-model";

export type BoardInteractionMode =
  | "idle"
  | "disabled"
  | "movement"
  | "reserve"
  | "attack"
  | "ability-position"
  | "ability-target";

export type BoardCellInteraction =
  | "default"
  | "legal"
  | "invalid"
  | "target"
  | "selected"
  | "reserve";

export type BoardInteractionModel = {
  mode: BoardInteractionMode;
  hint?: string;
  legalCells: ReadonlySet<string>;
  invalidCells: ReadonlySet<string>;
  targetCells: ReadonlySet<string>;
  reserveEntryCells: ReadonlySet<string>;
  selectedCell?: string;
};

export type BoardInteractionInput = {
  battle: Battle;
  scenario: ScenarioDefinition;
  interactionDisabled: boolean;
  missionActive: boolean;
  selectedUnitId: string;
  selectedOrder: OrderType;
  selectedWeaponId: string;
  selectingMovePosition: boolean;
  selectingAbilityPosition: boolean;
  selectedAbility?: AbilityDefinition;
  abilityTargetUnitId?: string;
  abilityTargetPosition?: BoardPosition;
  targetUnitId?: string;
};

export function createBoardInteractionModel(
  input: BoardInteractionInput,
): BoardInteractionModel {
  const empty = createEmptyModel(input.interactionDisabled ? "disabled" : "idle");
  if (input.interactionDisabled || !input.missionActive) return empty;

  const selectedUnit = findUnit(input.battle, input.selectedUnitId);
  if (!selectedUnit || selectedUnit.status === "Destroyed") return empty;

  if (
    input.selectingMovePosition &&
    (input.selectedOrder === "Move" || input.selectedOrder === "Advance")
  ) {
    const positionActions = getLegalPositionActions(
      input.battle,
      input.scenario,
      selectedUnit.id,
      input.selectedOrder,
    );
    if (!selectedUnit.position) {
      const activationError = validateUnitActivation(input.battle, selectedUnit.id);
      const reserveEntryCells = toCellSet(
        positionActions.map((action) => action.targetPosition),
      );
      return {
        mode: "reserve",
        hint: activationError ?? "Niebieskie pola: legalne wejście jednostki z rezerwy.",
        legalCells: reserveEntryCells,
        reserveEntryCells,
        targetCells: new Set(),
        invalidCells: complementCells(input.battle, reserveEntryCells),
      };
    }

    const legalCells = toCellSet(
      positionActions.map((action) => action.targetPosition),
    );
    return {
      mode: "movement",
      hint: "Zielone pola: legalny zasięg ruchu.",
      legalCells,
      reserveEntryCells: new Set(),
      targetCells: new Set(),
      invalidCells: complementCells(input.battle, legalCells),
    };
  }

  if (input.selectingAbilityPosition && input.selectedAbility) {
    const legalAbilityActions = getLegalAbilityActions(
      input.battle,
      selectedUnit.id,
      input.selectedAbility.id,
    ).filter((action) =>
      !input.abilityTargetUnitId || action.targetUnitId === input.abilityTargetUnitId
    );
    const legalCells = toCellSet(
      legalAbilityActions.flatMap((action) =>
        action.targetPosition ? [action.targetPosition] : []
      ),
    );
    return {
      mode: "ability-position",
      hint: "Zielone pola: legalny cel pozycyjny zdolności.",
      legalCells,
      reserveEntryCells: new Set(),
      targetCells: new Set(),
      invalidCells: complementCells(input.battle, legalCells),
      selectedCell: input.abilityTargetPosition
        ? boardPositionKey(input.abilityTargetPosition.x, input.abilityTargetPosition.y)
        : undefined,
    };
  }

  if (input.selectedOrder === "Attack" && input.selectedWeaponId) {
    const targetCells = new Set<string>();
    const legalAttacks = getLegalAttackActions(input.battle, selectedUnit.id)
      .filter((action) => action.weaponId === input.selectedWeaponId);
    for (const action of legalAttacks) {
      const position = action.type === "Attack"
        ? findUnit(input.battle, action.defenderId)?.position
        : input.battle.board.objects?.find((object) => object.id === action.objectId)?.position;
      if (position) {
        targetCells.add(boardPositionKey(position.x, position.y));
      }
    }
    const selectedTarget = input.targetUnitId
      ? findUnit(input.battle, input.targetUnitId)
      : undefined;
    return {
      mode: "attack",
      hint: "Czerwone pola: legalne cele wybranej broni.",
      legalCells: new Set(),
      invalidCells: new Set(),
      targetCells,
      reserveEntryCells: new Set(),
      selectedCell: selectedTarget?.position
        ? boardPositionKey(selectedTarget.position.x, selectedTarget.position.y)
        : undefined,
    };
  }

  if (input.selectedAbility) {
    const targetCells = new Set<string>();
    const legalAbilityActions = getLegalAbilityActions(
      input.battle,
      selectedUnit.id,
      input.selectedAbility.id,
    ).filter((action) =>
      !input.abilityTargetPosition ||
      (action.targetPosition?.x === input.abilityTargetPosition.x &&
        action.targetPosition.y === input.abilityTargetPosition.y)
    );
    for (const action of legalAbilityActions) {
      const target = action.targetUnitId
        ? findUnit(input.battle, action.targetUnitId)
        : undefined;
      if (target?.position) {
        targetCells.add(boardPositionKey(target.position.x, target.position.y));
      }
    }
    if (targetCells.size === 0) return empty;
    const selectedTarget = input.abilityTargetUnitId
      ? findUnit(input.battle, input.abilityTargetUnitId)
      : undefined;
    return {
      mode: "ability-target",
      hint: "Fioletowe pola: legalne cele wybranej zdolności.",
      legalCells: new Set(),
      invalidCells: new Set(),
      targetCells,
      reserveEntryCells: new Set(),
      selectedCell: selectedTarget?.position
        ? boardPositionKey(selectedTarget.position.x, selectedTarget.position.y)
        : undefined,
    };
  }

  return empty;
}

export function getBoardCellInteraction(
  model: BoardInteractionModel,
  x: number,
  y: number,
): BoardCellInteraction {
  const key = boardPositionKey(x, y);
  if (model.selectedCell === key) return "selected";
  if (model.reserveEntryCells.has(key)) return "reserve";
  if (model.targetCells.has(key)) return "target";
  if (model.legalCells.has(key)) return "legal";
  if (model.invalidCells.has(key)) return "invalid";
  return "default";
}

function createEmptyModel(mode: "idle" | "disabled"): BoardInteractionModel {
  return {
    mode,
    legalCells: new Set(),
    invalidCells: new Set(),
    targetCells: new Set(),
    reserveEntryCells: new Set(),
  };
}

function boardPositions(battle: Battle): BoardPosition[] {
  return Array.from(
    { length: battle.board.width * battle.board.height },
    (_, index) => ({
      x: index % battle.board.width,
      y: Math.floor(index / battle.board.width),
    }),
  );
}

function toCellSet(positions: BoardPosition[]): Set<string> {
  return new Set(positions.map(({ x, y }) => boardPositionKey(x, y)));
}

function complementCells(battle: Battle, cells: ReadonlySet<string>): Set<string> {
  return toCellSet(
    boardPositions(battle).filter(({ x, y }) => !cells.has(boardPositionKey(x, y))),
  );
}
