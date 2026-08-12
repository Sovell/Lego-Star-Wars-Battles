import type { Battle, OrderType } from "../../types";
import type { BattleAction } from "../battle-actions";
import { validateUnitActivation } from "../rules/activation";
import { getLegalReserveEntryCells } from "../rules/deployment";
import { getReachableCells } from "../rules/pathfinding";
import { findUnit, getTemplate } from "../rules/state";
import type { ScenarioDefinition } from "../scenario/scenario-types";

export type PositionOrder = Extract<OrderType, "Move" | "Advance">;

export type LegalPositionAction = Extract<
  BattleAction,
  { type: "MoveUnit" | "AdvanceUnit" | "DeployUnit" }
>;

/**
 * Generates only position actions accepted by the rules engine.
 * Consumers may score or render these actions, but must still apply them
 * through applyBattleAction(), which remains the final authority.
 */
export function getLegalPositionActions(
  battle: Battle,
  scenario: ScenarioDefinition,
  unitId: string,
  order: PositionOrder,
): LegalPositionAction[] {
  const unit = findUnit(battle, unitId);
  if (!unit || validateUnitActivation(battle, unitId)) return [];

  if (!unit.position) {
    return getLegalReserveEntryCells(battle, scenario, unitId).map(
      (targetPosition): LegalPositionAction => ({
        type: "DeployUnit",
        unitId,
        targetPosition,
      }),
    );
  }
  if (unit.movedThisTurn) return [];

  const movementBonus = unit.activeEffects?.includes("movement_bonus:1") ? 1 : 0;
  const movementBudget = getTemplate(unit).movement + movementBonus;
  return getReachableCells(battle, unit.position, movementBudget, { unitId }).map(
    ({ position: targetPosition }): LegalPositionAction => order === "Advance"
      ? { type: "AdvanceUnit", unitId, targetPosition }
      : { type: "MoveUnit", unitId, targetPosition },
  );
}
