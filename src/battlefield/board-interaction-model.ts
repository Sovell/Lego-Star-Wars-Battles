import type { AbilityDefinition, Battle, OrderType } from "../types";
import { useActiveAbility } from "../core/rules/active-abilities";
import { resolveAttack } from "../core/rules/combat";
import { getLegalReserveEntryCells } from "../core/rules/deployment";
import { advanceUnit, moveUnit } from "../core/rules/movement";
import { resolveObjectAttack } from "../core/rules/object-combat";
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

const deterministicRoll = () => 6;

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
    if (!selectedUnit.position) {
      const reserveEntryCells = toCellSet(
        getLegalReserveEntryCells(input.battle, input.scenario, selectedUnit.id),
      );
      return {
        mode: "reserve",
        hint: "Niebieskie pola: legalne wejście jednostki z rezerwy.",
        legalCells: reserveEntryCells,
        reserveEntryCells,
        targetCells: new Set(),
        invalidCells: complementCells(input.battle, reserveEntryCells),
      };
    }

    const legalCells = toCellSet(
      boardPositions(input.battle).filter((position) => {
        const result = input.selectedOrder === "Advance"
          ? advanceUnit(input.battle, selectedUnit.id, position)
          : moveUnit(input.battle, selectedUnit.id, position);
        return result.battle !== input.battle;
      }),
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
    const legalCells = toCellSet(
      boardPositions(input.battle).filter((position) =>
        useActiveAbility(
          input.battle,
          {
            unitId: selectedUnit.id,
            abilityId: input.selectedAbility!.id,
            ...(input.abilityTargetUnitId
              ? { targetUnitId: input.abilityTargetUnitId }
              : {}),
            targetPosition: position,
          },
          deterministicRoll,
        ).battle !== input.battle,
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
    for (const army of input.battle.armies) {
      for (const unit of army.units) {
        const attack = resolveAttack(
          input.battle,
          selectedUnit.id,
          unit.id,
          input.selectedWeaponId,
          deterministicRoll,
        );
        if (attack.result && unit.position) {
          targetCells.add(boardPositionKey(unit.position.x, unit.position.y));
        }
      }
    }
    for (const object of input.battle.board.objects ?? []) {
      const attack = resolveObjectAttack(
        input.battle,
        selectedUnit.id,
        object.id,
        input.selectedWeaponId,
        deterministicRoll,
      );
      if (attack.result) {
        targetCells.add(boardPositionKey(object.position.x, object.position.y));
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

  if (
    input.selectedAbility &&
    input.abilityTargetUnitId &&
    requiresUnitTarget(input.selectedAbility)
  ) {
    const targetCells = new Set<string>();
    for (const army of input.battle.armies) {
      for (const unit of army.units) {
        const result = useActiveAbility(
          input.battle,
          {
            unitId: selectedUnit.id,
            abilityId: input.selectedAbility.id,
            targetUnitId: unit.id,
            ...(input.abilityTargetPosition
              ? { targetPosition: input.abilityTargetPosition }
              : {}),
          },
          deterministicRoll,
        );
        if (result.battle !== input.battle && unit.position) {
          targetCells.add(boardPositionKey(unit.position.x, unit.position.y));
        }
      }
    }
    const selectedTarget = findUnit(input.battle, input.abilityTargetUnitId);
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

function requiresUnitTarget(ability: AbilityDefinition): boolean {
  return [
    "restore_hp",
    "damage_and_push",
    "direct_damage",
    "bonus_move_then_melee_attack",
    "move_after_attack",
    "task_force_once_per_turn_movement_bonus",
    "task_force_attack_bonus_against_damaged",
    "task_force_attack_bonus_against_hero",
  ].includes(ability.effect.type);
}
