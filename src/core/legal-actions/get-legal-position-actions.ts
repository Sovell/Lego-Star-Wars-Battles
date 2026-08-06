import type { Battle, OrderType } from "../../types";
import type { BattleAction } from "../battle-actions";
import { deployUnit } from "../rules/deployment";
import { advanceUnit, moveUnit } from "../rules/movement";
import { findUnit } from "../rules/state";
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
  if (!unit) return [];

  return boardPositions(battle).flatMap<LegalPositionAction>((targetPosition) => {
    if (!unit.position) {
      const action: LegalPositionAction = {
        type: "DeployUnit",
        unitId,
        targetPosition,
      };
      return deployUnit(battle, scenario, unitId, targetPosition).battle === battle
        ? []
        : [action];
    }

    const action: LegalPositionAction = order === "Advance"
      ? { type: "AdvanceUnit", unitId, targetPosition }
      : { type: "MoveUnit", unitId, targetPosition };
    const result = order === "Advance"
      ? advanceUnit(battle, unitId, targetPosition)
      : moveUnit(battle, unitId, targetPosition);
    return result.battle === battle ? [] : [action];
  });
}

function boardPositions(battle: Battle): Array<{ x: number; y: number }> {
  return Array.from(
    { length: battle.board.width * battle.board.height },
    (_, index) => ({
      x: index % battle.board.width,
      y: Math.floor(index / battle.board.width),
    }),
  );
}
