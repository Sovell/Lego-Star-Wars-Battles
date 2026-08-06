import type { Battle } from "../../types";
import { findUnit } from "../rules/state";
import type { ScenarioDefinition } from "../scenario/scenario-types";
import {
  getLegalAbilityActions,
  type LegalAbilityAction,
} from "./get-legal-ability-actions";
import {
  getLegalAttackActions,
  type LegalAttackAction,
} from "./get-legal-attack-actions";
import {
  getLegalOrderActions,
  type LegalOrderAction,
} from "./get-legal-order-actions";
import {
  getLegalPositionActions,
  type LegalPositionAction,
  type PositionOrder,
} from "./get-legal-position-actions";

export type LegalUnitAction =
  | LegalPositionAction
  | LegalAttackAction
  | LegalAbilityAction
  | LegalOrderAction;

/**
 * Thin facade over the specialized legal-action generators.
 */
export function getLegalUnitActions(
  battle: Battle,
  scenario: ScenarioDefinition,
  unitId: string,
): LegalUnitAction[] {
  const unit = findUnit(battle, unitId);
  if (!unit) return [];

  if (unit.status === "Pinned") {
    return getLegalOrderActions(battle, unitId);
  }

  const positionOrders: PositionOrder[] = unit.position
    ? ["Move", "Advance"]
    : ["Move"];

  return [
    ...positionOrders.flatMap((order) =>
      getLegalPositionActions(battle, scenario, unitId, order)
    ),
    ...getLegalAttackActions(battle, unitId),
    ...getLegalAbilityActions(battle, unitId),
    ...getLegalOrderActions(battle, unitId),
  ];
}
